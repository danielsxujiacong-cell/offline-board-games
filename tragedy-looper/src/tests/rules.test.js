import test from "node:test";
import assert from "node:assert/strict";
import { data as d } from "./fixtures.js";
import {
  createGame,
  hand,
  lockSelection,
  reveal,
  resetLoop,
  canMove,
  changeCounter,
  publicView,
} from "../state/game-state.js";
import { resolutionGroups, applyGroup } from "../state/resolution.js";
import { advance } from "../state/phase-machine.js";
import {
  readSave,
  writeSave,
  SAVE_KEY,
  validateState,
} from "../state/persistence.js";
import { incidentCheck, confirmIncident } from "../state/incidents.js";
import {
  useAbility,
  abilityTargets,
  skillAvailable,
} from "../state/abilities.js";
import {
  killCharacter,
  confirmLoopEnd,
  lossReasons,
} from "../state/conditions.js";
const game = (id = "the-first-script") =>
  createGame(d, id, id === "the-first-script" ? 3 : 4);
const card = (o, id, n = 1, target = "school") => ({
  cardInstanceId: `${o}:${id}:${n}`,
  target,
  owner: o,
});
function prepared(cards) {
  const s = game();
  s.phase = "cardResolve";
  s.revealed = cards;
  s.resolutionOrigin = Object.fromEntries(
    Object.entries(s.characters).map(([id, c]) => [id, c.location]),
  );
  return s;
}
const roleAbility = (r, id) =>
  d.roles.find((x) => x.id === r).abilities.find((x) => x.id === id);
const charAbility = (c, id) =>
  d.characters
    .find((x) => x.id === c)
    .goodwillAbilities.find((x) => x.id === id);
test("two original scripts: exact duration, roles, incident schedule, and separate public view", () => {
  const [a, b] = d.scripts;
  assert.deepEqual(
    [a.defaultLoops, a.daysPerLoop, a.loopOptions],
    [3, 4, [3, 2]],
  );
  assert.deepEqual(
    [b.defaultLoops, b.daysPerLoop, b.loopOptions],
    [4, 5, [4, 3]],
  );
  assert.equal(a.mainPlot, "murder-plan");
  assert.equal(a.subplot, "shadow-of-the-ripper");
  assert.deepEqual(a.roles, {
    "girl-student": "key-person",
    "office-worker": "killer",
    doctor: "brain",
    "police-officer": "conspiracy-theorist",
    "shrine-maiden": "serial-killer",
    "boy-student": "person",
  });
  assert.deepEqual(b.roles, {
    "boy-student": "cultist",
    "girl-student": "person",
    "shrine-maiden": "conspiracy-theorist",
    "office-worker": "person",
    doctor: "key-person",
    patient: "person",
  });
  assert.deepEqual(
    a.incidents.map((x) => [x.day, x.incident, x.culprit]),
    [
      [2, "murder", "office-worker"],
      [3, "suicide", "girl-student"],
    ],
  );
  assert.deepEqual(
    b.incidents.map((x) => [x.day, x.incident, x.culprit]),
    [
      [1, "increasing-unease", "shrine-maiden"],
      [3, "hospital-incident", "boy-student"],
      [5, "faraway-murder", "patient"],
    ],
  );
  assert.equal(b.mainPlot, "a-place-to-protect");
  assert.equal(b.subplot, "an-unsettling-rumor");
  assert.equal(a.finalGuess, false);
  assert.equal(b.finalGuess, false);
  assert.equal(publicView(game(), d).script.roles, undefined);
  assert.equal(publicView(game(), d).script.incidents[0].culprit, undefined);
});
test("printed initial positions, original thresholds and location restrictions", () => {
  const a = game(),
    b = game("prevailing-secrecy");
  assert.equal(a.characters["girl-student"].location, "school");
  assert.equal(a.characters["police-officer"].location, "city");
  assert.equal(b.characters.patient.location, "hospital");
  assert.equal(canMove(b, d, "patient", "shrine"), false);
  b.patientReleased = true;
  assert.equal(canMove(b, d, "patient", "shrine"), true);
  assert.equal(canMove(a, d, "shrine-maiden", "city"), false);
  assert.equal(canMove(a, d, "office-worker", "school"), false);
  assert.deepEqual(
    d.characters.map((c) => c.paranoiaLimit),
    [2, 3, 2, 2, 3, 2, 2],
  );
});
test("34 physical cards; unique instances; per-owner cooldowns", () => {
  assert.equal(hand(d, "GM").length, 10);
  assert.equal(hand(d, "P1").length, 8);
  assert.equal(
    new Set(
      ["GM", "P1", "P2", "P3"].flatMap((o) =>
        hand(d, o).map((c) => c.cardInstanceId),
      ),
    ).size,
    34,
  );
  assert.equal(hand(d, "GM").filter((c) => c.id === "paranoia-plus").length, 2);
  assert.equal(
    hand(d, "GM").find((c) => c.id === "paranoia-minus").limited,
    false,
  );
  assert.equal(
    hand(d, "P1").find((c) => c.id === "paranoia-minus").limited,
    true,
  );
});
test("GM duplicate targets and repeated card instance rejected; two same-name copies legal", () => {
  const s = game();
  s.phase = "selection";
  s.selection.GM = [
    card("GM", "paranoia-plus", 1, "doctor"),
    card("GM", "paranoia-plus", 2, "doctor"),
    card("GM", "move-h", 1, "school"),
  ];
  assert.throws(() => lockSelection(s, d, "GM"), /重复/);
  s.selection.GM[1].target = "hospital";
  lockSelection(s, d, "GM");
  assert.equal(s.locked.GM, true);
  assert.throws(() => lockSelection(s, d, "GM"));
});
test("protagonist targets distinct; overlap with GM legal; all four required to reveal", () => {
  const s = game();
  s.phase = "selection";
  s.selection.GM = [
    card("GM", "move-h", 1, "school"),
    card("GM", "move-v", 1, "hospital"),
    card("GM", "intrigue-double", 1, "shrine"),
  ];
  lockSelection(s, d, "GM");
  s.selection.P1 = [card("P1", "goodwill-double", 1, "school")];
  lockSelection(s, d, "P1");
  s.selection.P2 = [card("P2", "move-h", 1, "school")];
  assert.throws(() => lockSelection(s, d, "P2"), /重复/);
  s.selection.P2[0].target = "city";
  lockSelection(s, d, "P2");
  assert.throws(() => reveal(s, d));
  s.selection.P3 = [card("P3", "forbid-intrigue", 1, "shrine")];
  lockSelection(s, d, "P3");
  reveal(s, d);
  assert.equal(s.revealed.length, 6);
  assert.deepEqual(s.usedCards, [
    "GM:intrigue-double:1",
    "P1:goodwill-double:1",
  ]);
  assert.equal(s.usedCards.includes("P2:goodwill-double:1"), false);
});
test("unavailable limited card cannot be selected and one player never locks another", () => {
  const s = game();
  s.phase = "selection";
  s.locked.GM = true;
  s.usedCards = ["P1:goodwill-double:1"];
  s.selection.P1 = [card("P1", "goodwill-double", 1, "doctor")];
  assert.throws(() => lockSelection(s, d, "P1"), /不可用/);
  s.selection.P1 = [];
  s.selection.P2 = [card("P2", "goodwill-double", 1, "doctor")];
  lockSelection(s, d, "P2");
});
for (const [a, b, expected] of [
  ["h", "v", "d"],
  ["d", "h", "v"],
  ["d", "v", "h"],
  ["h", "h", "h"],
  ["v", "v", "v"],
])
  test(`movement ${a}+${b}=${expected}`, () => {
    const s = prepared([
      card("GM", "move-" + a, 1, "boy-student"),
      card("P1", "move-" + b, 1, "boy-student"),
    ]);
    const g = resolutionGroups(s, d)[0];
    assert.equal(g.direction, expected);
    applyGroup(s, d, g.target);
    assert.equal(
      s.characters["boy-student"].location,
      { h: "city", v: "shrine", d: "hospital" }[expected],
    );
    assert.throws(() => applyGroup(s, d, g.target));
  });
test("forbid movement first, ordered card priorities, forbidden final destination", () => {
  const s = prepared([
    card("GM", "move-v", 1, "shrine-maiden"),
    card("P1", "move-h", 1, "shrine-maiden"),
  ]);
  assert.equal(resolutionGroups(s, d)[0].restricted, true);
  applyGroup(s, d, "shrine-maiden");
  assert.equal(s.characters["shrine-maiden"].location, "shrine");
  const a = prepared([
    card("GM", "move-v", 1, "doctor"),
    card("P1", "forbid-move", 1, "doctor"),
  ]);
  assert.deepEqual(
    resolutionGroups(a, d)[0].cards.map((c) => c.card.priority),
    [1, 2],
  );
  applyGroup(a, d, "doctor");
  assert.equal(a.characters.doctor.location, "hospital");
});
test("location bluff is legal but has no numeric effect", () => {
  const s = prepared([
    card("GM", "paranoia-plus", 1, "school"),
    card("P1", "goodwill-double", 1, "school"),
  ]);
  assert.equal(resolutionGroups(s, d)[0].changes.length, 0);
  applyGroup(s, d, "school");
  assert.deepEqual(s.locations.school, { intrigue: 0 });
  assert.throws(() => changeCounter(s, "school", "paranoia", 1));
});
test("global Forbid Intrigue cancellation across different targets", () => {
  const s = prepared([
    card("GM", "intrigue-double", 1, "school"),
    card("P1", "forbid-intrigue", 1, "school"),
    card("P2", "forbid-intrigue", 1, "city"),
  ]);
  assert.equal(resolutionGroups(s, d)[0].conflict, true);
  applyGroup(s, d, "school");
  assert.equal(s.locations.school.intrigue, 2);
  const a = prepared([
    card("GM", "intrigue-double", 1, "school"),
    card("P1", "forbid-intrigue", 1, "school"),
  ]);
  applyGroup(a, d, "school");
  assert.equal(a.locations.school.intrigue, 0);
});
test("counter increases precede decreases and forbid paranoia blocks both", () => {
  const s = prepared([
    card("GM", "paranoia-minus", 1, "doctor"),
    card("P1", "paranoia-plus", 1, "doctor"),
  ]);
  assert.deepEqual(
    resolutionGroups(s, d)[0].changes.map((c) => c.amount),
    [1, -1],
  );
  applyGroup(s, d, "doctor");
  assert.equal(s.characters.doctor.paranoia, 0);
  const a = prepared([
    card("GM", "forbid-paranoia", 1, "doctor"),
    card("P1", "paranoia-plus", 1, "doctor"),
  ]);
  applyGroup(a, d, "doctor");
  assert.equal(a.characters.doctor.paranoia, 0);
});
test("cultist override uses post-movement location consistently across group confirmation order", () => {
  const s = game("prevailing-secrecy");
  s.phase = "cardResolve";
  s.revealed = [
    card("GM", "move-v", 1, "boy-student"),
    card("P1", "forbid-intrigue", 1, "shrine"),
    card("GM", "intrigue-double", 1, "shrine"),
  ];
  s.resolutionOrigin = Object.fromEntries(
    Object.entries(s.characters).map(([id, c]) => [id, c.location]),
  );
  s.cultistOverride = true;
  applyGroup(s, d, "shrine");
  assert.equal(s.locations.shrine.intrigue, 2);
  applyGroup(s, d, "boy-student");
  assert.equal(s.characters["boy-student"].location, "shrine");
});
test("daily sequence covers all stages, leader transfer exactly once, blocks unresolved cards and incidents", () => {
  const s = game();
  advance(s, d);
  assert.equal(s.phase, "morning");
  advance(s, d);
  assert.equal(s.phase, "selection");
  assert.throws(() => advance(s, d));
  s.phase = "cardResolve";
  s.revealed = [card("GM", "move-h")];
  assert.throws(() => advance(s, d), /全部/);
  s.resolutionDone.school = true;
  advance(s, d);
  assert.equal(s.phase, "mastermindAbility");
  advance(s, d);
  assert.equal(s.phase, "goodwillAbility");
  advance(s, d);
  assert.equal(s.phase, "incidentStep");
  advance(s, d);
  assert.equal(s.phase, "leaderTransfer");
  advance(s, d);
  assert.equal(s.leader, 2);
  assert.equal(s.phase, "dayEnd");
  advance(s, d);
  advance(s, d);
  assert.equal(s.day, 2);
  assert.equal(s.phase, "morning");
  s.phase = "incidentStep";
  assert.throws(() => advance(s, d), /事件/);
});
test("incident basic checks independent from extra effect: alive and >= threshold", () => {
  const s = game();
  s.phase = "incidentStep";
  assert.equal(incidentCheck(s, d).scheduled, false);
  s.day = 2;
  assert.equal(incidentCheck(s, d).triggers, false);
  s.characters["office-worker"].paranoia = 3;
  assert.equal(incidentCheck(s, d).triggers, true);
  s.characters["office-worker"].alive = false;
  assert.equal(incidentCheck(s, d).triggers, false);
  assert.equal(confirmIncident(s, d).occurred, false);
});
test("Murder valid other same-location target and Suicide kill Key Person immediately", () => {
  const s = game();
  s.day = 2;
  s.phase = "incidentStep";
  s.characters["office-worker"].paranoia = 2;
  assert.throws(
    () => confirmIncident(s, d, { target: "girl-student" }),
    /合法/,
  );
  s.characters["girl-student"].location = "city";
  confirmIncident(s, d, { target: "girl-student" });
  assert.equal(s.characters["girl-student"].alive, false);
  assert.equal(s.phase, "loopEnd");
  assert.equal(s.failed, true);
  const a = game();
  a.phase = "incidentStep";
  a.day = 3;
  a.characters["girl-student"].paranoia = 3;
  confirmIncident(a, d, { target: "girl-student" });
  assert.equal(a.failed, true);
});
test("Increasing Unease requires two distinct living targets", () => {
  const s = game("prevailing-secrecy");
  s.phase = "incidentStep";
  s.characters["shrine-maiden"].paranoia = 2;
  assert.throws(
    () => confirmIncident(s, d, { target: "doctor", secondTarget: "doctor" }),
    /不同/,
  );
  confirmIncident(s, d, { target: "doctor", secondTarget: "patient" });
  assert.equal(s.characters.doctor.paranoia, 2);
  assert.equal(s.characters.patient.intrigue, 1);
  assert.throws(() => confirmIncident(s, d));
});
for (const count of [0, 1, 2])
  test(`Hospital Incident additional condition ${count} intrigue is explicitly confirmed`, () => {
    const s = game("prevailing-secrecy");
    s.day = 3;
    s.phase = "incidentStep";
    s.characters["boy-student"].paranoia = 2;
    s.locations.hospital.intrigue = count;
    assert.equal(s.characters.doctor.alive, true);
    const result = confirmIncident(s, d);
    assert.equal(result.occurred, true);
    assert.equal(result.effective, count > 0);
    assert.equal(s.characters.doctor.alive, count === 0);
    assert.equal(!!s.protagonistsDead, count >= 2);
    assert.equal(s.failed, count > 0);
  });
test("Faraway Murder occurs without effect if no character has two intrigue", () => {
  const s = game("prevailing-secrecy");
  s.day = 5;
  s.phase = "incidentStep";
  s.characters.patient.paranoia = 2;
  const result = confirmIncident(s, d);
  assert.equal(result.occurred, true);
  assert.equal(result.effective, false);
});
test("Doctor as Key Person and School only checked on loop end", () => {
  const s = game("prevailing-secrecy");
  s.locations.school.intrigue = 2;
  assert.deepEqual(lossReasons(s, d), []);
  assert.equal(lossReasons(s, d, { loopEnd: true }).length, 1);
  killCharacter(s, d, "doctor");
  assert.equal(s.phase, "loopEnd");
  assert.equal(s.characters.doctor.location, "hospital");
  assert.equal(s.characters.doctor.alive, false);
});
test("Killer night conditions use role data and do not depend on character names", () => {
  const s = game();
  s.phase = "dayEnd";
  const a = roleAbility("killer", "killer-key");
  assert.equal(abilityTargets(s, d, "office-worker", a).length, 0);
  s.characters["girl-student"].location = "city";
  s.characters["girl-student"].intrigue = 2;
  useAbility(s, d, "office-worker", a, { target: "girl-student" });
  assert.equal(s.failed, true);
  const b = game();
  b.phase = "dayEnd";
  b.characters["office-worker"].intrigue = 4;
  useAbility(b, d, "office-worker", roleAbility("killer", "killer-heroes"));
  assert.equal(b.protagonistsDead, true);
  assert.equal(b.phase, "loopEnd");
});
test("Serial Killer counts living characters; corpses remain but are not counted", () => {
  const s = game();
  s.phase = "dayEnd";
  s.characters["girl-student"].location = "shrine";
  s.characters.doctor.location = "shrine";
  s.characters.doctor.alive = false;
  const a = roleAbility("serial-killer", "serial-kill");
  assert.deepEqual(abilityTargets(s, d, "shrine-maiden", a), ["girl-student"]);
  useAbility(s, d, "shrine-maiden", a, { target: "girl-student" });
  assert.equal(s.failed, true);
});
test("Goodwill refusal consumes ability use, goodwill is requirement and not deducted", () => {
  const s = game();
  s.phase = "goodwillAbility";
  s.characters["office-worker"].goodwill = 3;
  const a = charAbility("office-worker", "office-reveal");
  assert.equal(
    useAbility(s, d, "office-worker", a, { refuse: true }),
    "refused",
  );
  assert.equal(skillAvailable(s, "office-worker", a), false);
  assert.equal(s.publicRoles["office-worker"], undefined);
  assert.equal(s.characters["office-worker"].goodwill, 3);
});
test("reveal role, independent once-per-loop skills, Doctor discharge reset", () => {
  const s = game();
  s.phase = "goodwillAbility";
  s.characters["shrine-maiden"].goodwill = 5;
  s.characters.doctor.location = "shrine";
  useAbility(
    s,
    d,
    "shrine-maiden",
    charAbility("shrine-maiden", "shrine-reveal"),
    { target: "doctor" },
  );
  assert.equal(s.publicRoles.doctor, "brain");
  assert.equal(s.characters["shrine-maiden"].goodwill, 5);
  assert.equal(
    skillAvailable(
      s,
      "shrine-maiden",
      charAbility("shrine-maiden", "shrine-reveal"),
    ),
    false,
  );
  const a = game("prevailing-secrecy");
  a.phase = "goodwillAbility";
  a.characters.doctor.goodwill = 3;
  useAbility(a, d, "doctor", charAbility("doctor", "doctor-discharge"));
  assert.equal(a.patientReleased, true);
});
test("police prevention at the point of death consumes exactly one loop use", () => {
  const s = game();
  s.characters["police-officer"].goodwill = 5;
  s.characters["girl-student"].location = "city";
  s.characters["office-worker"].paranoia = 2;
  s.phase = "incidentStep";
  s.day = 2;
  confirmIncident(s, d, {
    target: "girl-student",
    preventTarget: "girl-student",
  });
  assert.equal(s.characters["girl-student"].alive, true);
  assert.equal(s.failed, false);
  assert.equal(s.usedSkills["police-officer:police-protect"], 1);
});
test("loop reset preserves public roles, deductions, history and current leader, restores layout and instances", () => {
  const s = game();
  s.publicRoles.doctor = "brain";
  s.deductions["doctor:brain"] = 3;
  s.characters.doctor.location = "city";
  s.characters.doctor.paranoia = 9;
  s.usedCards = ["P1:goodwill-double:1"];
  s.usedSkills.test = 1;
  s.patientReleased = true;
  s.locations.school.intrigue = 5;
  s.leader = 3;
  killCharacter(s, d, "girl-student");
  confirmLoopEnd(s, d);
  const history = s.history.length;
  resetLoop(s, d);
  assert.equal(s.loop, 2);
  assert.equal(s.day, 1);
  assert.equal(s.phase, "loopStart");
  assert.equal(s.characters.doctor.location, "hospital");
  assert.equal(s.characters.doctor.paranoia, 0);
  assert.equal(s.characters["girl-student"].alive, true);
  assert.equal(s.locations.school.intrigue, 0);
  assert.deepEqual(s.usedCards, []);
  assert.deepEqual(s.usedSkills, {});
  assert.equal(s.publicRoles.doctor, "brain");
  assert.equal(s.deductions["doctor:brain"], 3);
  assert.ok(s.history.length > history);
  assert.equal(s.patientReleased, false);
  assert.equal(s.leader, 3);
});
test("complete surviving loop wins immediately; all failed loops GM wins without final guess", () => {
  const s = game();
  s.day = 4;
  s.phase = "loopEnd";
  confirmLoopEnd(s, d);
  assert.equal(s.winner, "protagonists");
  assert.throws(() => advance(s, d));
  const a = game();
  for (let i = 1; i <= 3; i++) {
    killCharacter(a, d, "girl-student");
    confirmLoopEnd(a, d);
    if (i < 3) resetLoop(a, d);
  }
  assert.equal(a.winner, "GM");
  assert.equal(a.phase, "finished");
  assert.throws(() => resetLoop(a, d));
});
test("all stages, secret GM choices and partly completed resolution persist and recover exactly", () => {
  for (const phase of [
    "loopStart",
    "morning",
    "selection",
    "cardResolve",
    "mastermindAbility",
    "goodwillAbility",
    "incidentStep",
    "leaderTransfer",
    "dayEnd",
    "nextDay",
    "loopEnd",
    "finished",
  ]) {
    const s = game();
    s.phase = phase;
    s.selection.GM = [
      card("GM", "move-h", 1, "doctor"),
      card("GM", "move-v", 1, "school"),
      card("GM", "paranoia-plus", 1, "hospital"),
    ];
    s.locked.GM = true;
    s.selection.P1 = [card("P1", "goodwill-double", 1, "boy-student")];
    s.resolutionDone.doctor = true;
    const storage = new Map();
    storage.getItem = (k) => storage.get(k) ?? null;
    storage.setItem = (k, v) => storage.set(k, v);
    assert.equal(writeSave(storage, s), null);
    const result = readSave(storage, d);
    assert.deepEqual(result.state, s);
    assert.equal(publicView(result.state, d).script.roles, undefined);
  }
});
test("corrupt, incompatible and inaccessible storage are reported without overwriting", () => {
  for (const raw of [
    "{broken",
    JSON.stringify({ version: 99 }),
    JSON.stringify({ ...game(), characters: {} }),
    JSON.stringify({ ...game(), phase: "fake" }),
  ]) {
    let writes = 0;
    const storage = { getItem: () => raw, setItem: () => writes++ };
    const result = readSave(storage, d);
    assert.ok(result.error);
    assert.equal(result.raw, raw);
    assert.equal(writes, 0);
  }
  assert.ok(
    readSave(
      {
        getItem() {
          throw Error("blocked");
        },
      },
      d,
    ).error,
  );
  assert.ok(
    writeSave(
      {
        setItem() {
          throw Error("quota");
        },
      },
      game(),
    ).includes("保存失败"),
  );
  assert.equal(readSave({ getItem: () => null }, d).state, null);
});
test("malformed selected instances, public identities, deduction and cooldown data reject without rendering", () => {
  for (const edit of [
    (s) => (s.selection.GM = [null]),
    (s) =>
      (s.selection.P1 = [{ cardInstanceId: "GM:move-h:1", target: "doctor" }]),
    (s) => (s.usedCards = ["invented"]),
    (s) => (s.publicRoles.doctor = "invented"),
    (s) => (s.deductions.x = 5),
    (s) => (s.leader = 4),
    (s) => (s.revealed = [{}]),
  ]) {
    const s = game();
    edit(s);
    assert.throws(() => validateState(s, d));
  }
});
test("mandatory night kill must precede optional Killer effect", () => {
  const s = game();
  s.phase = "dayEnd";
  s.characters["girl-student"].location = "shrine";
  s.characters["office-worker"].intrigue = 4;
  assert.throws(
    () =>
      useAbility(s, d, "office-worker", roleAbility("killer", "killer-heroes")),
    /强制/,
  );
});
test("police can reveal an incident that occurred in a previous loop", () => {
  const s = game();
  s.day = 2;
  s.phase = "incidentStep";
  s.characters["office-worker"].paranoia = 2;
  s.characters["boy-student"].location = "city";
  confirmIncident(s, d, { target: "boy-student" });
  killCharacter(s, d, "girl-student");
  confirmLoopEnd(s, d);
  resetLoop(s, d);
  assert.equal(s.incidentResults.length, 0);
  assert.equal(s.incidentHistory.length, 1);
  s.phase = "goodwillAbility";
  s.characters["police-officer"].goodwill = 4;
  useAbility(
    s,
    d,
    "police-officer",
    charAbility("police-officer", "police-culprit"),
    { incident: "murder" },
  );
  assert.ok(s.history.at(-2).message.includes("上班族"));
});
