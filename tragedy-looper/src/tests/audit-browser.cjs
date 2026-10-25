const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const { data: d } = await import("./fixtures.js");
  const { createGame } = await import("../state/game-state.js");
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let scenarios = 0,
    mobileChecks = 0;
  const base = process.env.TEST_URL || "http://127.0.0.1:8080";
  const state = (script = "the-first-script") =>
    createGame(d, script, script === "the-first-script" ? 3 : 4);
  async function gm(p) {
    await p.locator("#gm-open").tap();
    await p.locator('[data-action="unlock-gm"]').tap();
  }
  async function seed(p, s) {
    await p.goto(base + "/tragedy-looper/");
    await p.waitForSelector("#start-form");
    await p.evaluate(
      (s) => localStorage.setItem("tragedy-looper.save", JSON.stringify(s)),
      s,
    );
    await p.reload();
    await p.waitForSelector(".game-heading");
  }
  try {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [667, 375],
      [844, 390],
      [768, 1024],
      [1024, 768],
    ]) {
      const c = await b.newContext({
          viewport: { width, height },
          isMobile: true,
          hasTouch: true,
        }),
        p = await c.newPage();
      await p.goto(base + "/tragedy-looper/");
      await p.waitForSelector("#start-form");
      await p.locator("#start-form button").tap();
      for (const tab of ["board", "archive", "deduction", "log"]) {
        await p.locator(`[data-action="tab"][data-tab="${tab}"]`).tap();
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `overflow ${width} ${tab}`,
        );
        mobileChecks++;
      }
      await p.locator('[data-tab="board"]').tap();
      const counter = p.locator(
        '[data-action="counter"][data-target="doctor"][data-counter="paranoia"][data-delta="1"]',
      );
      const box = await counter.boundingBox();
      assert.ok(
        box.width >= 44 && box.height >= 44,
        `touch target ${width}: ${box.width}x${box.height}`,
      );
      await counter.tap();
      assert.equal(
        (
          await p.evaluate(() =>
            JSON.parse(localStorage.getItem("tragedy-looper.save")),
          )
        ).characters.doctor.paranoia,
        1,
      );
      mobileChecks += 2;
      await gm(p);
      assert.ok(
        await p
          .locator("#gm-dialog select")
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
        `form font ${width}`,
      );
      await p.locator("details.gm-section summary").tap();
      await p
        .locator("#gm-dialog")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      const close = p.locator('[data-action="close-gm"]');
      const bb = await close.boundingBox();
      assert.ok(
        bb.y >= 0 && bb.y + bb.height <= height,
        `sticky close ${width}`,
      );
      assert.ok(
        await p
          .locator("#gm-dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        `dialog overflow ${width}`,
      );
      await close.tap();
      assert.equal(await p.locator("#gm-dialog").isVisible(), false);
      mobileChecks += 4;
      await c.close();
    }
    const cases = [
      {
        name: "Serial Killer mandatory night death",
        prepare: (s) => {
          s.phase = "dayEnd";
          s.characters["girl-student"].location = "shrine";
        },
        skill: "serial-kill",
        target: "girl-student",
        failed: true,
      },
      {
        name: "Killer kills protagonists",
        prepare: (s) => {
          s.phase = "dayEnd";
          s.characters["office-worker"].intrigue = 4;
        },
        skill: "killer-heroes",
        failed: true,
        heroes: true,
      },
      {
        name: "Murder kills Key Person",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 2;
          s.characters["office-worker"].paranoia = 2;
          s.characters["girl-student"].location = "city";
        },
        target: "girl-student",
        failed: true,
      },
      {
        name: "Suicide ends loop",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 3;
          s.characters["girl-student"].paranoia = 3;
        },
        target: "girl-student",
        failed: true,
      },
      {
        name: "Police prevents Murder once",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 2;
          s.characters["office-worker"].paranoia = 2;
          s.characters["girl-student"].location = "city";
          s.characters["police-officer"].goodwill = 5;
        },
        target: "girl-student",
        protect: true,
        failed: false,
      },
      ...[0, 1, 2].map((count) => ({
        name: `Hospital Incident ${count} Intrigue`,
        script: "prevailing-secrecy",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 3;
          s.characters["boy-student"].paranoia = 2;
          s.locations.hospital.intrigue = count;
        },
        failed: count > 0,
        heroes: count >= 2,
      })),
      {
        name: "Empty Hospital has no effect",
        script: "prevailing-secrecy",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 3;
          s.characters["boy-student"].paranoia = 2;
          s.locations.hospital.intrigue = 1;
          s.characters.doctor.location = "city";
          s.patientReleased = true;
          s.characters.patient.location = "city";
        },
        failed: false,
        noEffect: true,
      },
      {
        name: "Faraway Murder kills remote Doctor",
        script: "prevailing-secrecy",
        prepare: (s) => {
          s.phase = "incidentStep";
          s.day = 5;
          s.characters.patient.paranoia = 2;
          s.characters.doctor.intrigue = 2;
          s.characters.doctor.location = "school";
        },
        target: "doctor",
        failed: true,
      },
      {
        name: "School main plot checked at end",
        script: "prevailing-secrecy",
        prepare: (s) => {
          s.phase = "loopEnd";
          s.day = 5;
          s.locations.school.intrigue = 2;
        },
        verdict: true,
        failed: true,
      },
    ];
    for (const spec of cases) {
      const c = await b.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }),
        p = await c.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const s = state(spec.script);
      spec.prepare(s);
      await seed(p, s);
      await gm(p);
      if (spec.verdict) await p.locator('[data-action="loop-verdict"]').tap();
      else if (spec.skill) {
        const f = p.locator(`[data-skill="${spec.skill}"]`);
        if (spec.target)
          await f.locator('select[name="target"]').selectOption(spec.target);
        await f.locator('button[type="submit"]').tap();
      } else {
        const f = p.locator("#incident-form");
        if (spec.target)
          await f.locator('[name="target"]').selectOption(spec.target);
        if (spec.protect)
          await f.locator('[name="preventTarget"]').selectOption(spec.target);
        await f.locator("input[required]").check();
        await f.locator('button[type="submit"]').tap();
      }
      let actual = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("tragedy-looper.save")),
      );
      assert.equal(actual.failed, spec.failed, spec.name);
      if (spec.heroes) assert.equal(actual.protagonistsDead, true, spec.name);
      if (spec.noEffect) {
        assert.equal(actual.incidentResults[0].occurred, true);
        assert.equal(actual.incidentResults[0].effective, false);
      }
      if (spec.protect) {
        assert.equal(actual.characters["girl-student"].alive, true);
        assert.equal(actual.usedSkills["police-officer:police-protect"], 1);
      }
      if (spec.failed && !spec.verdict) {
        assert.equal(actual.phase, "loopEnd");
        await p.locator('[data-action="loop-verdict"]').tap();
      }
      await p.locator('[data-action="close-gm"]').tap();
      await p.reload();
      await p.waitForSelector(".game-heading");
      actual = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("tragedy-looper.save")),
      );
      assert.equal(actual.failed, spec.failed);
      if (spec.heroes)
        assert.ok(
          (await p.locator(".stage").innerText()).includes("主人公死亡"),
        );
      assert.deepEqual(errors, []);
      scenarios++;
      await c.close();
      console.log("PASS: " + spec.name);
    }
    console.log(
      `PASS: ${scenarios} losing/protection/event UI scenarios; ${mobileChecks} touch/layout checks across 6 viewports`,
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
