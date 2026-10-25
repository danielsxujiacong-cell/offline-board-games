import { scriptFor, changeCounter, canMove, record } from "./game-state.js";
import { useAbility } from "./abilities.js";
import { killCharacter, confirmImmediateLoss } from "./conditions.js";
export function incidentCheck(s, d) {
  const scheduled = scriptFor(s, d).incidents.find((i) => i.day === s.day);
  if (!scheduled) return { scheduled: false };
  const culprit = s.characters[scheduled.culprit];
  const character = d.characters.find((c) => c.id === scheduled.culprit);
  const incident = d.incidents.find((i) => i.id === scheduled.incident);
  const alive = culprit.alive,
    panicked = culprit.paranoia >= character.paranoiaLimit;
  return {
    scheduled: true,
    ...scheduled,
    definition: incident,
    alive,
    panicked,
    triggers: alive && panicked,
  };
}
export function incidentTargets(s, d, check) {
  const ids = Object.keys(s.characters).filter((id) => s.characters[id].alive);
  switch (check.definition.effect.target) {
    case "otherHere":
      return ids.filter(
        (id) =>
          id !== check.culprit &&
          s.characters[id].location === s.characters[check.culprit].location,
      );
    case "self":
      return [check.culprit];
    case "intrigue2":
      return ids.filter((id) => s.characters[id].intrigue >= 2);
    default:
      return ids;
  }
}
export function confirmIncident(
  s,
  d,
  { target, secondTarget, destination, preventTarget } = {},
) {
  if (
    s.phase !== "incidentStep" ||
    s.incidentResults.some((i) => i.day === s.day)
  )
    throw Error("当前事件已确认或时机不符");
  const check = incidentCheck(s, d);
  if (!check.scheduled) throw Error("今日无事件");
  let effective = false;
  if (check.triggers) {
    const e = check.definition.effect;
    if (preventTarget) {
      if (
        (e.type === "kill" && preventTarget !== target) ||
        (e.type === "hospital" &&
          (s.locations.hospital.intrigue < e.killAt ||
            s.characters[preventTarget]?.location !== "hospital")) ||
        !["kill", "hospital"].includes(e.type)
      )
        throw Error("防护目标未面临本事件死亡");
      const a = d.characters
        .find((c) => c.id === "police-officer")
        ?.goodwillAbilities.find((a) => a.effect.type === "preventDeath");
      if (!s.characters["police-officer"]) throw Error("本局没有警察");
      useAbility(s, d, "police-officer", a, { target: preventTarget });
    }
    if (e.type === "kill") {
      const targets = incidentTargets(s, d, check);
      if (targets.length) {
        if (!targets.includes(target)) throw Error("请选择合法死亡目标");
        killCharacter(s, d, target, { prevent: target === preventTarget });
        effective = true;
      }
    }
    if (e.type === "unease") {
      const targets = incidentTargets(s, d, check);
      if (
        !targets.includes(target) ||
        !targets.includes(secondTarget) ||
        target === secondTarget
      )
        throw Error("请选择两名不同的存活角色");
      changeCounter(s, target, "paranoia", 2);
      changeCounter(s, secondTarget, "intrigue", 1);
      effective = true;
    }
    if (e.type === "hospital") {
      const count = s.locations.hospital.intrigue;
      if (count >= e.killAt) {
        for (const [id, c] of Object.entries(s.characters))
          if (c.alive && c.location === "hospital")
            killCharacter(s, d, id, { prevent: id === preventTarget });
        effective = true;
      }
      if (count >= e.protagonistsAt) {
        s.protagonistsDead = true;
        confirmImmediateLoss(s, d);
        effective = true;
      }
    }
    if (e.type === "missing") {
      if (!canMove(s, d, check.culprit, destination))
        throw Error("移动地点不合法");
      s.characters[check.culprit].location = destination;
      changeCounter(s, destination, "intrigue", 1);
      effective = true;
    }
    if (e.type === "spreading") {
      if (
        target === secondTarget ||
        !s.characters[target]?.alive ||
        !s.characters[secondTarget]?.alive
      )
        throw Error("目标无效");
      changeCounter(s, target, "goodwill", -2);
      changeCounter(s, secondTarget, "goodwill", 2);
      effective = true;
    }
  }
  const result = {
    day: s.day,
    incident: check.incident,
    occurred: check.triggers,
    effective,
  };
  s.incidentResults.push(result);
  s.incidentHistory.push({ ...result, loop: s.loop });
  record(
    s,
    `${check.definition.name}：${!check.triggers ? "未发生（基本条件不满足）" : effective ? "发生，效果已确认" : "发生，但效果未触发"}`,
  );
  return result;
}
