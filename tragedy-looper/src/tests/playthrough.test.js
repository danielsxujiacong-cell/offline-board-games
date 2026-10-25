import test from "node:test";
import assert from "node:assert/strict";
import { data as d } from "./fixtures.js";
import {
  createGame,
  hand,
  lockSelection,
  reveal,
  resetLoop,
} from "../state/game-state.js";
import { advance } from "../state/phase-machine.js";
import { applyGroup, resolutionGroups } from "../state/resolution.js";
import {
  abilityTasks,
  abilityTargets,
  skillAvailable,
  useAbility,
} from "../state/abilities.js";
import {
  incidentCheck,
  incidentTargets,
  confirmIncident,
} from "../state/incidents.js";
import { confirmLoopEnd } from "../state/conditions.js";
import { validateState } from "../state/persistence.js";
test("audit: 100 seeded complete games keep valid saves and match independent victory oracle", () => {
  let seed = 20261025;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const outcomes = { GM: 0, protagonists: 0 };
  let turns = 0;
  for (let n = 0; n < 100; n++) {
    const script = d.scripts[n % 2];
    let s = createGame(d, script.id, script.defaultLoops),
      steps = 0;
    const save = () => {
      s = validateState(JSON.parse(JSON.stringify(s)), d);
      for (const c of Object.values(s.characters))
        for (const k of ["paranoia", "goodwill", "intrigue"])
          assert.ok(Number.isInteger(c[k]) && c[k] >= 0);
    };
    const skills = () => {
      const tasks = abilityTasks(s, d, { secret: true })
        .filter((t) => t.ability.timing === s.phase)
        .sort(
          (a, b) => Number(b.ability.mandatory) - Number(a.ability.mandatory),
        );
      for (const { source, ability: a } of tasks) {
        if (
          a.timing !== s.phase ||
          !skillAvailable(s, source, a) ||
          (!a.mandatory && rand() < 0.5)
        )
          continue;
        const targets = abilityTargets(s, d, source, a);
        if (
          ["counter", "reveal", "kill"].includes(a.effect.type) &&
          !targets.length
        )
          continue;
        if (
          a.effect.type === "killProtagonists" &&
          s.characters[source].intrigue < 4
        )
          continue;
        if (a.effect.type === "releasePatient" && !s.characters.patient?.alive)
          continue;
        if (
          [
            "preventDeath",
            "revealCulprit",
            "revealedGoodwill",
            "friendDeath",
            "locationLoss",
            "keyDeath",
          ].includes(a.effect.type)
        )
          continue;
        useAbility(s, d, source, a, {
          target: pick(targets),
          delta: rand() < 0.5 ? -1 : 1,
        });
        save();
      }
    };
    while (!s.winner) {
      assert.ok(++steps < 250, "game must terminate");
      if (s.phase === "loopEnd") {
        const oracle =
          !!s.protagonistsDead ||
          Object.entries(script.roles).some(
            ([id, r]) => r === "key-person" && !s.characters[id].alive,
          ) ||
          (script.id === "prevailing-secrecy" &&
            s.locations.school.intrigue >= 2);
        assert.equal(s.failed || oracle, oracle);
        confirmLoopEnd(s, d);
        if (!oracle) assert.equal(s.winner, "protagonists");
        else if (s.loop === s.loops) assert.equal(s.winner, "GM");
        else resetLoop(s, d);
        save();
        continue;
      }
      if (s.phase === "selection") {
        const targets = [
            ...Object.keys(s.characters).filter((id) => s.characters[id].alive),
            ...Object.keys(s.locations),
          ],
          heroUsed = new Set();
        for (const owner of ["GM", "P1", "P2", "P3"]) {
          const available = hand(d, owner).filter(
              (c) => !s.usedCards.includes(c.cardInstanceId),
            ),
            usedTargets = owner === "GM" ? new Set() : heroUsed,
            selected = [];
          for (let j = 0; j < (owner === "GM" ? 3 : 1); j++) {
            const card = pick(
                available.filter(
                  (c) =>
                    !selected.some(
                      (x) => x.cardInstanceId === c.cardInstanceId,
                    ),
                ),
              ),
              target = pick(targets.filter((t) => !usedTargets.has(t)));
            selected.push({ cardInstanceId: card.cardInstanceId, target });
            usedTargets.add(target);
          }
          s.selection[owner] = selected;
          lockSelection(s, d, owner);
          save();
        }
        reveal(s, d);
        turns++;
        save();
        continue;
      }
      if (s.phase === "cardResolve") {
        skills();
        const groups = resolutionGroups(s, d).map((g) => g.target);
        while (groups.length) {
          const target = pick(groups);
          applyGroup(s, d, target);
          groups.splice(groups.indexOf(target), 1);
          save();
        }
        advance(s, d);
        save();
        continue;
      }
      if (s.phase === "incidentStep") {
        const check = incidentCheck(s, d);
        if (check.scheduled) {
          const targets = incidentTargets(s, d, check),
            target = pick(targets);
          confirmIncident(s, d, {
            target,
            secondTarget: pick(targets.filter((t) => t !== target)),
          });
          save();
        }
        if (s.phase === "incidentStep") advance(s, d);
        save();
        continue;
      }
      if (
        ["mastermindAbility", "goodwillAbility", "dayEnd"].includes(s.phase)
      ) {
        skills();
        if (s.phase === "loopEnd") continue;
      }
      advance(s, d);
      save();
    }
    outcomes[s.winner]++;
  }
  assert.ok(outcomes.GM > 0 && outcomes.protagonists > 0);
  console.log(
    `Independent playthrough audit: ${turns} days, GM ${outcomes.GM}, protagonists ${outcomes.protagonists}`,
  );
});
