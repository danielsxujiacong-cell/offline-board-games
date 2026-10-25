const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  base = process.env.TEST_URL || "http://127.0.0.1:8080",
  KEY = "lost-cities-save-v1";
async function fixture(page, options = {}) {
  await page.evaluate(
    async ({ options, KEY }) => {
      const { cards, freshSession } = await import("/lost-cities/engine.js");
      const { validate } = await import("/lost-cities/storage.js");
      const s = freshSession(),
        g = s.game,
        remaining = new Map(cards().map((c) => [c.id, c]));
      const take = (id) => {
        const c = remaining.get(id);
        if (!c) throw Error("fixture duplicate " + id);
        remaining.delete(id);
        return c;
      };
      g.hands[0] = (
        options.hand || [
          "yellow-w0",
          "yellow-2",
          "yellow-3",
          "blue-w0",
          "blue-2",
          "green-10",
          "red-9",
          "white-8",
        ]
      ).map(take);
      for (const [player, rows] of Object.entries(options.routes || {}))
        for (const [color, ids] of Object.entries(rows))
          g.expeditions[player][color] = ids.map(take);
      for (const [color, ids] of Object.entries(options.discards || {}))
        g.discards[color] = ids.map(take);
      g.hands[1] = [...remaining.values()].slice(0, 8).map((c) => take(c.id));
      const left = [...remaining.values()];
      g.deck = left.slice(0, options.deckCount ?? left.length);
      for (const c of left.slice(g.deck.length)) g.discards[c.color].push(c);
      validate(s);
      localStorage.setItem(KEY, JSON.stringify(s));
    },
    { options, KEY },
  );
  await page.reload();
  assert.equal(await page.locator("[data-card]").count(), 0);
  await page.click("#accept");
}
async function snapshot(page) {
  return page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)), KEY);
}
async function swipeHand(page, cdp) {
  await page.locator(".hand").scrollIntoViewIfNeeded();
  const box = await page.locator(".hand").boundingBox();
  const x = box.x + box.width - 20,
    y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - (i * box.width) / 10, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(
    () => document.querySelector(".hand").scrollLeft > 50,
  );
}
(async () => {
  const context = await chromium.launchPersistentContext(
    path.join(root, ".openai/lost-cities-audit"),
    {
      channel: "msedge",
      headless: true,
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    },
  );
  try {
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/");
    const currentCache = require("node:fs")
      .readFileSync(path.join(root, "service-worker.js"), "utf8")
      .match(/CACHE_NAME = '([^']+)'/)[1];
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
    });
    await page.waitForFunction(async (name) => {
      const reg = await navigator.serviceWorker.getRegistration();
      const cached = await caches.open(name);
      return (
        reg?.active?.state === "activated" &&
        !reg.installing &&
        !reg.waiting &&
        !!(await cached.match(new URL("/lost-cities/engine.js", location.href)))
      );
    }, currentCache);
    await page.reload();
    await page.goto(base + "/lost-cities/");
    const cdp = await context.newCDPSession(page);
    // Real touch input, rightmost selection, actual tap on the action buttons, privacy and history navigation.
    for (const width of [375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await fixture(page);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await page
          .locator(".hand")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
      );
      await swipeHand(page, cdp);
      await page.locator("[data-card]").last().tap();
      assert.ok(
        await page.locator(".hand").evaluate((e) => {
          const r = e.querySelector(".selected").getBoundingClientRect(),
            b = e.getBoundingClientRect();
          return r.left >= b.left - 1 && r.right <= b.right + 1;
        }),
        "selected card must remain visible",
      );
      const scroll = await page.locator(".hand").evaluate((e) => e.scrollLeft);
      assert.ok(scroll > 50);
      for (const id of ["play", "discard"]) {
        const box = await page.locator("#" + id).boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44);
        await page.locator("#" + id).click({ trial: true });
      }
      await page.screenshot({
        path: path.join(root, `.openai/lost-cities-${width}-audit.png`),
        fullPage: true,
      });
      await page.locator("#discard").tap();
      assert.equal((await snapshot(page)).game.phase, "DRAW");
      assert.equal(await page.locator("[data-card]").count(), 7);
      const source = (await snapshot(page)).game.justDiscardedCardId.split(
        "-",
      )[0];
      assert.ok(await page.locator(`[data-draw=${source}]`).isDisabled());
      await page.locator("[data-draw=deck]").tap();
      assert.equal(await page.locator(".private").count(), 0);
      assert.equal(await page.locator("[data-card]").count(), 0);
      assert.equal(await page.locator("[data-draw]").count(), 0);
      const lockBefore = await snapshot(page);
      await page.reload();
      assert.deepEqual(await snapshot(page), lockBefore);
      assert.equal(await page.locator("[data-card]").count(), 0);
      await page.locator("#accept").tap();
      assert.equal(await page.locator("[data-card]").count(), 8);
      await page.locator("#hide").tap();
      assert.equal(await page.locator(".private").count(), 0);
      await page.click("#accept");
      await page.goto(base + "/");
      await page.goBack();
      assert.equal(await page.locator(".private").count(), 0);
      assert.ok(await page.locator("#accept").isVisible());
      console.log(
        `MOBILE ${width}: touch swipe, selection retention, taps, 44px targets, no overflow, handoff/refresh/back privacy OK`,
      );
    }
    await fixture(page, {
      routes: { 0: { yellow: ["yellow-w1", "yellow-w2", "yellow-5"] } },
      discards: { yellow: ["yellow-6"], blue: ["blue-3", "blue-4"] },
    });
    for (const id of ["yellow-w0", "yellow-2", "yellow-3"]) {
      await page.locator(`[data-card="${id}"]`).click();
      assert.ok(await page.locator("#play").isDisabled());
      assert.match(
        await page.locator("#reason").innerText(),
        id.includes("-w") ? /之后/ : /大于/,
      );
    }
    const before = await snapshot(page);
    await page.click("#discard");
    const draw = await snapshot(page);
    assert.equal(draw.game.phase, "DRAW");
    assert.equal(draw.game.discards.yellow.at(-1).id, "yellow-3");
    assert.ok(await page.locator("[data-draw=yellow]").isDisabled());
    assert.ok(await page.locator("[data-draw=white]").isDisabled());
    assert.ok(await page.locator("[data-draw=blue]").isEnabled());
    await page.reload();
    assert.equal(await page.locator("[data-card]").count(), 0);
    await page.click("#accept");
    assert.deepEqual(await snapshot(page), draw);
    assert.ok(await page.locator("[data-draw=yellow]").isDisabled());
    await page.click("[data-draw=blue]");
    const after = await snapshot(page);
    assert.equal(after.game.hands[0].at(-1).id, "blue-4");
    assert.equal(after.game.discards.blue.at(-1).id, "blue-3");
    assert.deepEqual(after.game.deck, before.game.deck);
    assert.equal(after.game.player, 1);
    assert.equal(after.game.justDiscardedCardId, null);
    console.log(
      "UI RULES: ascending/wager prohibition, illegal reasons, just-discard restriction survives DRAW reload, empty pile, top-only pickup, no automatic draw OK",
    );
    await fixture(page, {
      hand: [
        "yellow-w2",
        "yellow-3",
        "yellow-5",
        "yellow-10",
        "blue-w1",
        "green-2",
        "red-2",
        "white-2",
      ],
      routes: {
        0: {
          yellow: [
            "yellow-w0",
            "yellow-w1",
            "yellow-2",
            "yellow-4",
            "yellow-6",
            "yellow-7",
            "yellow-8",
            "yellow-9",
          ],
        },
        1: { blue: ["blue-w0"] },
      },
      deckCount: 1,
    });
    const atOne = await snapshot(page);
    assert.equal(atOne.game.deck.length, 1);
    assert.equal(atOne.game.ended, false);
    assert.match(await page.locator(".player").last().innerText(), /68 分/);
    await page.click('[data-card="yellow-3"]');
    await page.click("#discard");
    assert.equal(await page.locator(".result").count(), 0);
    await page.click("[data-draw=deck]");
    const ended = await snapshot(page);
    assert.deepEqual(ended.totals, [68, -40]);
    assert.equal(ended.game.ended, true);
    assert.equal(ended.game.deck.length, 0);
    assert.equal(ended.history.length, 1);
    assert.equal(ended.history[0].players[0].columns.yellow.bonus, 20);
    assert.equal(await page.locator("[data-card]").count(), 0);
    assert.equal(await page.locator("#accept").count(), 0);
    assert.match(await page.locator(".result").innerText(), /玩家 1 远征获胜/);
    for (let i = 0; i < 3; i++) {
      await page.reload();
      assert.deepEqual(await snapshot(page), ended);
    }
    page.once("dialog", (d) => d.dismiss());
    await page.click("#reset");
    assert.deepEqual(await snapshot(page), ended);
    await page.click("#next");
    const next = await snapshot(page);
    assert.deepEqual(next.totals, [68, -40]);
    assert.equal(next.game.player, 0, "cumulative leader starts the next game");
    assert.deepEqual(next.history, ended.history);
    assert.equal(next.game.deck.length, 44);
    assert.notEqual(next.game.id, ended.game.id);
    // A tied result is rendered as a draw; history and totals stay intact on reload.
    await page.evaluate(async (KEY) => {
      const { freshSession, transition, settle } =
        await import("/lost-cities/engine.js");
      const s = freshSession();
      while (!s.game.ended) {
        s.game = transition(s.game, {
          type: "select",
          id: s.game.hands[s.game.player][0].id,
        });
        s.game = transition(s.game, { type: "discard" });
        s.game = transition(s.game, { type: "draw", source: "deck" });
      }
      settle(s);
      localStorage.setItem(KEY, JSON.stringify(s));
    }, KEY);
    await page.reload();
    assert.match(await page.locator(".result").innerText(), /平局/);
    page.once("dialog", (d) => d.accept());
    await page.click("#reset");
    assert.deepEqual((await snapshot(page)).totals, [0, 0]);
    assert.equal((await snapshot(page)).history.length, 0);
    console.log(
      "UI BOUNDARIES: 8-card ×3 +20=68, final deck card immediate END, nonzero totals, repeated END reload, next/cancel/reset, tie OK",
    );
    const damaged = structuredClone(ended);
    damaged.game.hands[0] = null;
    await page.evaluate(
      ({ KEY, damaged }) => localStorage.setItem(KEY, JSON.stringify(damaged)),
      { KEY, damaged },
    );
    await page.reload();
    assert.match(
      await page.locator("#notice").innerText(),
      /存档损坏.*导出备份/,
    );
    assert.deepEqual(await snapshot(page), damaged);
    assert.equal(await page.locator("[data-card]").count(), 0);
    const downloadEvent = page.waitForEvent("download");
    await page.click("#export");
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), "lost-cities-backup.json");
    assert.deepEqual(await snapshot(page), damaged);
    // Quota failure must be visible, while the last valid stored state remains untouched.
    await page.evaluate((KEY) => localStorage.removeItem(KEY), KEY);
    await page.reload();
    await page.click("#accept");
    const stored = await page.evaluate((KEY) => localStorage.getItem(KEY), KEY);
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      };
    });
    await page.locator("[data-card]").first().click();
    assert.match(await page.locator("#notice").innerText(), /保存失败/);
    assert.equal(
      await page.evaluate((KEY) => localStorage.getItem(KEY), KEY),
      stored,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: extended MVP audit, damaged save export and quota failure preservation, no browser exceptions",
    );
  } finally {
    await context.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
