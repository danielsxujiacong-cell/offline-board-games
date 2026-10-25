import { scriptFor, changeCounter, record } from "./game-state.js";
import { killCharacter, confirmImmediateLoss } from "./conditions.js";
export function abilityTasks(s, d, { secret = false } = {}) {
  const script = scriptFor(s, d);
  const tasks = [];
  for (const id of script.characters) {
    if (!s.characters[id].alive) continue;
    const c = d.characters.find((c) => c.id === id);
    if (s.phase === "goodwillAbility")
      for (const a of c.goodwillAbilities)
        tasks.push({ source: id, ability: a, secret: false });
    if (secret)
      for (const a of d.roles.find((r) => r.id === script.roles[id]).abilities)
        if (a.timing === s.phase || a.timing === "always")
          tasks.push({ source: id, ability: a, secret: true });
  }
  if (secret)
    for (const id of [script.mainPlot, script.subplot])
      for (const a of d.plots.find((p) => p.id === id).rules)
        if (a.timing === s.phase)
          tasks.push({ source: id, ability: a, secret: true });
  return tasks;
}
export function skillKey(source, a) {
  return `${source}:${a.id}`;
}
export function skillAvailable(s, source, a) {
  const key = skillKey(source, a);
  return (
    !(a.oncePerLoop ? s.usedSkills[key] : s.daySkills[key]) &&
    (!s.characters[source] ||
      (s.characters[source].alive &&
        s.characters[source].goodwill >= a.goodwillRequired))
  );
}
export function abilityTargets(s, d, source, a) {
  const e = a.effect,
    c = s.characters[source],
    alive = Object.keys(s.characters).filter((id) => s.characters[id].alive),
    here = alive.filter((id) => s.characters[id].location === c?.location);
  switch (e.target) {
    case "self":
      return c ? [source] : [];
    case "studentHere":
      return here.filter((id) =>
        d.characters.find((x) => x.id === id).tags.includes("student"),
      );
    case "characterHere":
      return here;
    case "otherHere":
      return here.filter((id) => id !== source);
    case "anyHere":
      return [c.location, ...here];
    case "location":
      return d.locations.map((l) => l.id);
    case "shrine":
      return c?.location === "shrine" ? ["shrine"] : [];
    case "keyHereIntrigue2":
      return here.filter(
        (id) =>
          scriptFor(s, d).roles[id] === "key-person" &&
          s.characters[id].intrigue >= 2,
      );
    case "onlyOtherHere":
      return here.filter((id) => id !== source).length === 1
        ? here.filter((id) => id !== source)
        : [];
    default:
      return alive;
  }
}
export function useAbility(
  s,
  d,
  source,
  a,
  { target, delta, refuse = false, incident, prevent = false } = {},
) {
  if (a.timing !== s.phase && a.effect.type !== "preventDeath")
    throw Error("技能时机不符");
  if (!skillAvailable(s, source, a)) throw Error("技能需求或次数不满足");
  if (
    !a.mandatory &&
    a.effect.type !== "preventDeath" &&
    abilityTasks(s, d, { secret: true }).some(
      (t) =>
        t.ability.mandatory &&
        t.ability.effect.type === "kill" &&
        skillAvailable(s, t.source, t.ability) &&
        abilityTargets(s, d, t.source, t.ability).length,
    )
  )
    throw Error("请先处理强制技能");
  const script = scriptFor(s, d),
    role =
      s.characters[source] &&
      d.roles.find((r) => r.id === script.roles[source]);
  if (
    a.timing === "goodwillAbility" &&
    role.goodwillRefusal !== "none" &&
    (refuse || role.goodwillRefusal === "mandatory")
  ) {
    const k = skillKey(source, a);
    s.usedSkills[k] = (s.usedSkills[k] || 0) + 1;
    s.daySkills[k] = true;
    record(s, "GM 确认友好技能被拒绝（计为已使用）");
    return "refused";
  }
  const e = a.effect,
    targets = abilityTargets(s, d, source, a);
  if (
    ["counter", "reveal", "kill"].includes(e.type) &&
    !targets.includes(target)
  )
    throw Error("技能没有合法目标或条件不满足");
  if (e.type === "counter") {
    const amount = e.choice ? (delta === -1 ? -1 : 1) : e.amount;
    changeCounter(s, target, e.counter, amount);
  }
  if (e.type === "reveal") s.publicRoles[target] = script.roles[target];
  if (e.type === "kill") killCharacter(s, d, target, { prevent });
  if (e.type === "killProtagonists") {
    if (s.characters[source].intrigue < 4) throw Error("自身密谋尚未达到 4");
    s.protagonistsDead = true;
    confirmImmediateLoss(s, d);
  }
  if (e.type === "releasePatient") {
    if (!s.characters.patient?.alive) throw Error("没有存活病人");
    s.patientReleased = true;
  }
  if (e.type === "ignoreForbidIntrigue") {
    if (Object.keys(s.resolutionDone).length)
      throw Error("请在结算任何卡组之前确认此技能");
    s.cultistOverride = true;
  }
  if (e.type === "revealedGoodwill") {
    if (s.publicRoles[source] !== script.roles[source])
      throw Error("该身份尚未公开");
    changeCounter(s, source, "goodwill", 1);
  }
  if (e.type === "revealCulprit") {
    const past = s.incidentHistory.find(
      (i) => i.occurred && i.incident === incident,
    );
    if (!past) throw Error("只能公开之前发生的事件");
    const culprit = script.incidents.find(
      (i) => i.incident === incident,
    ).culprit;
    record(
      s,
      `公开事件真凶：${d.incidents.find((i) => i.id === incident).name} → ${d.characters.find((c) => c.id === culprit).name}`,
    );
  }
  if (e.type === "preventDeath") {
    if (
      !s.characters[target]?.alive ||
      s.characters[source].location !== s.characters[target].location
    )
      throw Error("只能防止同地点角色死亡");
    record(s, "警察已防止一次死亡");
  }
  const key = skillKey(source, a);
  s.usedSkills[key] = (s.usedSkills[key] || 0) + 1;
  s.daySkills[key] = true;
  record(
    s,
    a.timing === "goodwillAbility"
      ? `${d.characters.find((c) => c.id === source)?.name} 的友好技能已确认`
      : "GM 已确认一个隐藏能力效果",
  );
  return "used";
}
