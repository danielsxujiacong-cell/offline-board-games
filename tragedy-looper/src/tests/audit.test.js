import test from "node:test";
import assert from "node:assert/strict";
import { data as d } from "./fixtures.js";
import { createGame, resetLoop } from "../state/game-state.js";
import { confirmIncident } from "../state/incidents.js";
import { confirmLoopEnd } from "../state/conditions.js";
const first = () => createGame(d, "the-first-script", 3);
const second = () => createGame(d, "prevailing-secrecy", 4);
test("audit: empty Hospital at one Intrigue occurs without an effect", () => {
  const s = second();
  s.phase = "incidentStep";
  s.day = 3;
  s.characters["boy-student"].paranoia = 2;
  s.locations.hospital.intrigue = 1;
  s.characters.doctor.location = "city";
  s.patientReleased = true;
  s.characters.patient.location = "city";
  const result = confirmIncident(s, d);
  assert.equal(result.occurred, true);
  assert.equal(result.effective, false);
  assert.equal(s.failed, false);
});
test("audit: invalid Murder target must not consume police protection", () => {
  const s = first();
  s.phase = "incidentStep";
  s.day = 2;
  s.characters["office-worker"].paranoia = 2;
  s.characters["police-officer"].goodwill = 5;
  s.characters["girl-student"].location = "city";
  const before = structuredClone(s);
  assert.throws(
    () =>
      confirmIncident(s, d, {
        target: "office-worker",
        preventTarget: "office-worker",
      }),
    /合法/,
  );
  assert.deepEqual(s, before);
});
test("audit: protagonist death has an explicit public result without disclosing role source", () => {
  const s = second();
  s.phase = "incidentStep";
  s.day = 3;
  s.characters["boy-student"].paranoia = 2;
  s.locations.hospital.intrigue = 2;
  confirmIncident(s, d);
  assert.ok(s.history.some((e) => e.message.includes("主人公死亡")));
  assert.ok(!s.history.some((e) => e.message.includes("关键人物")));
});
for (const count of [0, 1, 2])
  test(`audit: dead Hospital culprit prevents event even with ${count} Intrigue`, () => {
    const s = second();
    s.phase = "incidentStep";
    s.day = 3;
    s.characters["boy-student"].alive = false;
    s.characters["boy-student"].paranoia = 9;
    s.locations.hospital.intrigue = count;
    const result = confirmIncident(s, d);
    assert.equal(result.occurred, false);
    assert.equal(s.characters.doctor.alive, true);
    assert.equal(s.protagonistsDead, undefined);
  });
test("audit: School two Intrigue loses only at loop end, every loop then awards GM", () => {
  const s = second();
  for (let loop = 1; loop <= 4; loop++) {
    s.day = 5;
    s.phase = "loopEnd";
    s.locations.school.intrigue = 2;
    confirmLoopEnd(s, d);
    assert.equal(s.failed, true);
    if (loop < 4) {
      assert.equal(s.winner, null);
      resetLoop(s, d);
      assert.equal(s.locations.school.intrigue, 0);
    } else assert.equal(s.winner, "GM");
  }
});
test("audit: Faraway Murder can kill Doctor from another location and retains corpse", () => {
  const s = second();
  s.day = 5;
  s.phase = "incidentStep";
  s.characters.patient.paranoia = 2;
  s.characters.doctor.location = "school";
  s.characters.doctor.intrigue = 2;
  confirmIncident(s, d, { target: "doctor" });
  assert.equal(s.characters.doctor.alive, false);
  assert.equal(s.characters.doctor.location, "school");
  assert.equal(s.phase, "loopEnd");
  assert.equal(s.failed, true);
});
