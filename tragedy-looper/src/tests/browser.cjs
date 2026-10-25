const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.TEST_URL || "http://127.0.0.1:8080",
  root = path.resolve(__dirname, "../../..");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const check = (value, message) => {
    assert.ok(value, message);
    checks++;
  };
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const save = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("tragedy-looper.save")),
    );
  async function gm() {
    await page.locator("#gm-open").click();
    check(
      await page
        .locator("#gm-dialog")
        .innerText()
        .then((x) => !x.includes("真实身份")),
      "GM gate hides truth",
    );
    await page.getByRole("button", { name: "我是 GM，确认查看秘密" }).click();
  }
  async function gmAdvance() {
    await gm();
    await page.getByRole("button", { name: "已核对本阶段技能，继续" }).click();
  }
  async function choose(owner, index, id, target) {
    await page
      .locator(`[data-choice-card="${owner}"][data-index="${index}"]`)
      .selectOption(`${owner}:${id}:1`);
    await page
      .locator(`[data-choice-target="${owner}"][data-index="${index}"]`)
      .selectOption(target);
  }
  try {
    await page.goto(base + "/tragedy-looper/");
    await page.waitForSelector("#start-form");
    check(
      (await page.locator("#script-select option").count()) === 2,
      "two built-in scripts",
    );
    await page.locator("#script-select").selectOption("prevailing-secrecy");
    check(
      (await page.locator(".setup-meta").innerText()).includes("5 天"),
      "Prevailing 5 days",
    );
    check(
      (await page.locator("#loops-select").inputValue()) === "4",
      "Prevailing 4 loops",
    );
    await page.locator("#script-select").selectOption("the-first-script");
    check(
      (await page.locator("#loops-select").inputValue()) === "3",
      "First 3 loops",
    );
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "intro no overflow " + width,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#start-form button").click();
    await gmAdvance();
    await gmAdvance();
    // Actual same-screen GM and protagonist flow, including partial restore.
    await gm();
    await choose("GM", 0, "move-h", "school");
    await choose("GM", 1, "intrigue-double", "hospital");
    await choose("GM", 2, "paranoia-plus", "shrine");
    check(
      await page
        .locator(
          '[data-choice-target="GM"][data-index="2"] option[value="hospital"]',
        )
        .evaluate((el) => el.disabled),
      "GM duplicate target disabled",
    );
    await page.getByRole("button", { name: "锁定 GM 出牌并隐藏" }).click();
    check(
      !(await page.locator("#gm-dialog").isVisible()),
      "GM lock closes secrets",
    );
    check(
      (await page.locator("#app").innerText()).includes("GM 三张行动已封存"),
      "GM public sealed state",
    );
    check(
      !(await page.locator('[data-choice-card="GM"]').count()),
      "GM cards absent from public DOM",
    );
    await choose("P1", 0, "forbid-intrigue", "hospital");
    await page.getByRole("button", { name: "锁定 P1", exact: true }).click();
    check(
      await page
        .locator('[data-choice-target="P2"] option[value="hospital"]')
        .evaluate((el) => el.disabled),
      "protagonist duplicate disabled",
    );
    await page.reload();
    await page.waitForSelector('[data-choice-card="P2"]');
    check(
      (await save()).locked.GM && (await save()).locked.P1,
      "locked progress restored",
    );
    check(
      !(await page.locator("#gm-dialog").isVisible()),
      "refresh reseals GM",
    );
    check(
      !(await page.locator('[data-choice-card="GM"]').count()),
      "refresh no secret card DOM",
    );
    await choose("P2", 0, "forbid-intrigue", "school");
    await page.getByRole("button", { name: "锁定 P2", exact: true }).click();
    await choose("P3", 0, "goodwill-double", "doctor");
    await page.getByRole("button", { name: "锁定 P3", exact: true }).click();
    await page.getByRole("button", { name: "亮牌结算 →" }).click();
    check(
      (await page.locator("#app").innerText()).includes(
        "主人公的禁止密谋卡相互抵消",
      ),
      "global intrigue conflict visible",
    );
    check(
      (await page.locator(".resolve-group li").count()) === 6,
      "six cards shown",
    );
    await page
      .locator('[data-action="resolve"][data-target="hospital"]')
      .click();
    check(
      (await save()).locations.hospital.intrigue === 2,
      "cross-target forbids cancel",
    );
    await page.reload();
    await page.waitForSelector(".resolution-groups");
    check(
      (await save()).resolutionDone.hospital,
      "partial resolution restored",
    );
    while (await page.locator('[data-action="resolve"]').count())
      await page.locator('[data-action="resolve"]').first().click();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "board/resolution no overflow " + width,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "结算完成，进入 GM 能力 →" })
      .click();
    await gmAdvance();
    // Goodwill effect executes without consuming goodwill.
    await gm();
    const ability = page.locator('form[data-skill="doctor-paranoia"]');
    await ability.locator('select[name="target"]').selectOption("doctor");
    await ability.locator('select[name="delta"]').selectOption("1");
    await ability.locator('button[type="submit"]').click();
    check(
      (await save()).characters.doctor.paranoia === 1,
      "Doctor ability effect",
    );
    check(
      (await save()).characters.doctor.goodwill === 2,
      "Goodwill not spent",
    );
    await page.getByRole("button", { name: "已核对本阶段技能，继续" }).click();
    await gm();
    check(
      (await page.locator("#gm-dialog").innerText()).includes("今日未安排事件"),
      "Day1 no incident",
    );
    await page.getByRole("button", { name: "隐藏并关闭 ×" }).click();
    // No-event stage needs an explicit GM confirmation to advance.
    await gm();
    await page.getByRole("button", { name: "确认无事件，继续" }).click();
    await page.getByRole("button", { name: "确认并继续 →" }).click();
    check((await save()).leader === 2, "clockwise leader transfer");
    await gmAdvance();
    await page.getByRole("button", { name: "确认并继续 →" }).click();
    check((await save()).day === 2, "next day");
    // Deduction and published identity survive a real death, verdict and loop reset.
    await page.getByRole("button", { name: "身份推理", exact: true }).click();
    await page.locator('[data-key="doctor:brain"]').click();
    await gm();
    await page.locator("details.gm-section summary").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator('[data-action="publish-role"][data-target="doctor"]')
      .click();
    await page.locator("#death-form select").selectOption("girl-student");
    await page.locator("#death-form button").click();
    check((await save()).phase === "loopEnd", "key death ends loop");
    await page.getByRole("button", { name: "核对并确认本轮回胜负" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "确认回溯到下一轮回" }).click();
    const state = await save();
    check(state.loop === 2 && state.day === 1, "reset loop/day");
    check(
      state.publicRoles.doctor === "brain" &&
        state.deductions["doctor:brain"] === 1,
      "public role and deduction persist",
    );
    check(
      state.usedCards.length === 0 &&
        Object.keys(state.usedSkills).length === 0,
      "all cooldowns reset",
    );
    check(
      state.characters.doctor.location === "hospital" &&
        state.characters.doctor.paranoia === 0,
      "initial layout reset",
    );
    check(state.characters["girl-student"].alive, "resurrect");
    // Corrupt save is not overwritten; valid import recovers.
    await page.evaluate(() =>
      localStorage.setItem("tragedy-looper.save", "{damaged"),
    );
    await page.reload();
    await page.waitForSelector(".recovery");
    check(
      (await page.evaluate(() =>
        localStorage.getItem("tragedy-looper.save"),
      )) === "{damaged",
      "corrupt original preserved",
    );
    await page
      .locator("#import-file")
      .setInputFiles({
        name: "save.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(state)),
      });
    await page.waitForSelector(".game-heading");
    check((await save()).loop === 2, "valid import restored");
    // Actual browser storage write failure is prominently reported.
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new Error("quota test");
      };
    });
    await page.getByRole("button", { name: "舞台地图", exact: true }).click();
    await page
      .locator(
        '[data-action="counter"][data-target="doctor"][data-counter="intrigue"][data-delta="1"]',
      )
      .click();
    check(
      (await page.locator("#app").innerText()).includes("存储失败"),
      "write failure warning",
    );
    await page.reload();
    await page.waitForSelector(".game-heading");
    // Install whole-site worker and open all existing entry points offline.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const cacheName = fs
      .readFileSync(path.join(root, "service-worker.js"), "utf8")
      .match(/CACHE_NAME = '([^']+)'/)[1];
    await page.waitForFunction(
      async (name) =>
        (await caches.keys()).includes(name) &&
        !!(await caches.match(
          "/tragedy-looper/src/data/scripts/prevailing-secrecy.json",
        )),
      cacheName,
    );
    await page.reload();
    const entrances = [
      "/",
      "/games/fake-artist-new-york/",
      "/games/fake-painter/",
      "/games/pick-one-for-me/",
      "/games/spyfall/",
      "/games/werewords-companion/",
      "/games/just-one/",
      "/pass-the-bomb/",
      "/wasabi-roulette/",
      "/two-faced/",
      "/fun-employed/",
      "/games/friend-court/",
      "/games/hanamikoji/",
      "/lost-cities/",
      "/jaipur/",
      "/tragedy-looper/",
    ];
    await context.setOffline(true);
    for (const url of entrances) {
      const response = await page.goto(base + url);
      check(response && response.ok(), "offline entry " + url);
      check(
        (await page.locator("body").innerText()).length > 30,
        "offline content " + url,
      );
    }
    await page.waitForSelector(".game-heading");
    check((await save()).loop === 2, "offline save resumed");
    await page.screenshot({
      path: "/tmp/tragedy-looper-mobile.png",
      fullPage: true,
    });
    check(
      errors.length === 0,
      "no browser runtime errors: " + errors.join("; "),
    );
    console.log(
      `PASS: ${checks} browser checks, 360/390/768/1440px, 16 offline entrances`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
