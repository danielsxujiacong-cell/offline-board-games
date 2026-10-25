const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let days = 0;
  try {
    for (const [script, total] of [
      ["the-first-script", 4],
      ["prevailing-secrecy", 5],
    ]) {
      const context = await browser.newContext({
          viewport: { width: 768, height: 1024 },
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const gm = async () => {
        await page.locator("#gm-open").click();
        await page.locator('[data-action="unlock-gm"]').click();
      };
      const advanceGM = async () => {
        await gm();
        await page.locator('[data-action="gm-advance"]').click();
      };
      const choose = async (o, i, id, target) => {
        await page
          .locator(`[data-choice-card="${o}"][data-index="${i}"]`)
          .selectOption(`${o}:${id}:1`);
        await page
          .locator(`[data-choice-target="${o}"][data-index="${i}"]`)
          .selectOption(target);
      };
      await page.goto(
        (process.env.TEST_URL || "http://127.0.0.1:8080") + "/tragedy-looper/",
      );
      await page.waitForSelector("#start-form");
      await page.locator("#script-select").selectOption(script);
      await page.locator("#start-form button").click();
      await advanceGM();
      for (let day = 1; day <= total; day++) {
        await advanceGM();
        await gm();
        await choose("GM", 0, "move-h", "hospital");
        await choose("GM", 1, "move-v", "school");
        await choose("GM", 2, "paranoia-plus", "city");
        await page.locator("#gm-cards button").click();
        for (const [o, id, target] of [
          ["P1", "goodwill-plus", "doctor"],
          ["P2", "goodwill-plus", "boy-student"],
          ["P3", "forbid-intrigue", "shrine"],
        ]) {
          await choose(o, 0, id, target);
          await page.locator(`[data-action="lock"][data-owner="${o}"]`).click();
        }
        await page.locator('[data-action="reveal"]').click();
        while (await page.locator('[data-action="resolve"]').count())
          await page.locator('[data-action="resolve"]').first().click();
        await page.locator('[data-action="advance"]').click();
        await advanceGM();
        await advanceGM();
        await gm();
        if (await page.locator("#incident-form").count()) {
          await page.locator('#incident-form input[type="checkbox"]').check();
          await page.locator("#incident-form button").click();
        }
        await page.locator('[data-action="no-incident"]').click();
        await page.locator('[data-action="advance"]').click();
        await advanceGM();
        await page.locator('[data-action="advance"]').click();
        days++;
        const s = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("tragedy-looper.save")),
        );
        assert.equal(s.phase, day === total ? "loopEnd" : "morning");
      }
      await gm();
      await page.locator('[data-action="loop-verdict"]').click();
      assert.equal(
        (
          await page.evaluate(() =>
            JSON.parse(localStorage.getItem("tragedy-looper.save")),
          )
        ).winner,
        "protagonists",
      );
      assert.ok((await page.locator(".ending").innerText()).includes("命运"));
      await page.reload();
      await page.waitForSelector(".ending");
      assert.deepEqual(errors, []);
      console.log(
        `PASS: ${script} complete ${total}-day game through real UI, final verdict and reload`,
      );
      await context.close();
    }
    console.log(`PASS: 2 complete games / ${days} days / no skipped phases`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
