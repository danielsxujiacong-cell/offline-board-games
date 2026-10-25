const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
(async () => {
  const root = path.resolve(__dirname, ".."),
    base = process.env.TEST_URL || "http://127.0.0.1:8080";
  const context = await chromium.launchPersistentContext(
    path.join(root, ".openai/lost-cities-browser"),
    {
      channel: "msedge",
      headless: true,
      viewport: { width: 390, height: 844 },
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
    await page.evaluate(() => localStorage.removeItem("lost-cities-save-v1"));
    await page.reload();
    assert.equal(await page.locator("[data-card]").count(), 0);
    await page.click("#accept");
    assert.equal(await page.locator("[data-card]").count(), 8);
    await page.click("[data-card]");
    await page.reload();
    assert.equal(await page.locator("[data-card]").count(), 0);
    await page.click("#accept");
    assert.equal(await page.locator(".selected").count(), 1);
    for (const w of [320, 375, 390, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow ${w}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(root, ".openai/lost-cities-mobile.png"),
      fullPage: true,
    });
    await page.click("#rules");
    assert.ok(await page.locator("#rulebook").isVisible());
    await page.click("#close-rules");
    let turns = 0,
      plays = 0;
    while (turns < 44) {
      if (await page.locator("#accept").count()) await page.click("#accept");
      assert.equal(await page.locator("[data-card]").count(), 8);
      await page.locator("[data-card]").first().click();
      if ((await page.locator("#play").isEnabled()) && turns % 2 === 0) {
        await page.click("#play");
        plays++;
      } else await page.click("#discard");
      assert.equal(await page.locator("[data-card]").count(), 7);
      assert.ok(await page.locator("#play").isDisabled());
      if (turns === 0) {
        const before = await page.evaluate(() =>
          localStorage.getItem("lost-cities-save-v1"),
        );
        await page.reload();
        assert.equal(await page.locator("[data-card]").count(), 0);
        await page.click("#accept");
        assert.equal(
          await page.evaluate(() =>
            localStorage.getItem("lost-cities-save-v1"),
          ),
          before,
        );
      }
      await page.click("[data-draw=deck]");
      turns++;
      assert.equal(await page.locator("[data-card]").count(), 0);
    }
    assert.ok(plays > 0);
    assert.ok(await page.locator(".result").isVisible());
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("lost-cities-save-v1")),
    );
    assert.equal(saved.history.length, 1);
    const manual = saved.game.expeditions.map((rows) =>
      Object.values(rows).reduce((total, col) => {
        if (!col.length) return total;
        return (
          total +
          (col
            .filter((c) => c.type === "number")
            .reduce((v, c) => v + c.value, 0) -
            20) *
            (col.filter((c) => c.type === "wager").length + 1) +
          (col.length >= 8 ? 20 : 0)
        );
      }, 0),
    );
    assert.deepEqual(saved.totals, manual);
    await page.reload();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("lost-cities-save-v1")).history
            .length,
      ),
      1,
    );
    await page.screenshot({
      path: path.join(root, ".openai/lost-cities-result.png"),
      fullPage: true,
    });
    page.once("dialog", (d) => d.dismiss());
    await page.click("#reset");
    assert.ok(await page.locator(".result").isVisible());
    await page.click("#next");
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("lost-cities-save-v1")).history
            .length,
      ),
      1,
    );
    // Restore ended game to exercise confirmed reset, then a damaged save without overwrite.
    await page.evaluate(
      (s) => localStorage.setItem("lost-cities-save-v1", JSON.stringify(s)),
      saved,
    );
    await page.reload();
    page.once("dialog", (d) => d.accept());
    await page.click("#reset");
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("lost-cities-save-v1")).history
            .length,
      ),
      0,
    );
    await page.evaluate(() =>
      localStorage.setItem("lost-cities-save-v1", "broken"),
    );
    await page.reload();
    assert.ok(await page.locator("#repair").isVisible());
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lost-cities-save-v1")),
      "broken",
    );
    page.once("dialog", (d) => d.dismiss());
    await page.click("#repair");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lost-cities-save-v1")),
      "broken",
    );
    page.once("dialog", (d) => d.accept());
    await page.click("#repair");
    assert.ok(await page.locator("#accept").isVisible());
    await page.goto(base + "/");
    assert.equal(await page.locator('a[href="./lost-cities/"]').count(), 1);
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      await r.update();
    });
    const cache = fs
      .readFileSync(path.join(root, "service-worker.js"), "utf8")
      .match(/CACHE_NAME = '([^']+)'/)[1];
    await page.waitForFunction(
      async (name) => (await caches.keys()).includes(name),
      cache,
    );
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    const entries = [
      "",
      ...Array.from(
        fs
          .readFileSync(path.join(root, "index.html"), "utf8")
          .matchAll(/class="game[^"\n]*" href="\.\/([^"\n]+)"/g),
        (m) => m[1],
      ),
    ];
    for (const entry of entries) {
      const r = await page.goto(base + "/" + entry);
      assert.equal(r.status(), 200);
      assert.ok(r.fromServiceWorker());
      if (entry)
        assert.notEqual(
          await page.title(),
          "Daniel 的桌游｜中文离线聚会桌游合集",
        );
      console.log("OFFLINE OK", entry || "lobby");
    }
    await page.goto(base + "/lost-cities/");
    await page.click("#accept");
    assert.equal(await page.locator("[data-card]").count(), 8);
    assert.deepEqual(errors, []);
    console.log(
      `PASS: ${turns} full UI turns, ${plays} expedition plays, manual scoring, PLAY/DRAW refresh, privacy, reset/cancel, corruption, 320–1280px, ${entries.length} offline routes`,
    );
  } finally {
    await context.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
