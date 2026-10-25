import { scriptFor, record } from "./game-state.js";
export function lossReasons(s, d, { loopEnd = false } = {}) {
  const script = scriptFor(s, d),
    out = [];
  if (s.protagonistsDead) out.push("主人公死亡");
  for (const [id, role] of Object.entries(script.roles)) {
    if (role === "key-person" && !s.characters[id].alive)
      out.push("关键人物死亡");
    if (loopEnd && role === "friend" && !s.characters[id].alive)
      out.push("朋友死亡");
  }
  if (loopEnd)
    for (const id of [script.mainPlot, script.subplot])
      for (const rule of d.plots.find((p) => p.id === id).rules) {
        const e = rule.effect;
        if (e.type === "locationLoss") {
          let target = e.target;
          if (target === "brainStart") {
            const brain = Object.keys(script.roles).find(
              (k) => script.roles[k] === "brain",
            );
            target = s.initialLayout[brain];
          }
          if (s.locations[target]?.intrigue >= e.minimum)
            out.push(
              `${d.locations.find((l) => l.id === target).name}密谋达到 ${e.minimum}`,
            );
        }
      }
  return out;
}
export function confirmImmediateLoss(s, d) {
  const reasons = lossReasons(s, d);
  if (reasons.length) {
    s.failed = true;
    s.phase = "loopEnd";
    record(
      s,
      s.protagonistsDead
        ? "主人公死亡，轮回立即失败"
        : "主人公失败，轮回立即结束",
    );
  }
  return reasons;
}
export function killCharacter(s, d, id, { prevent = false } = {}) {
  const c = s.characters[id];
  if (!c?.alive) throw Error("不是存活角色");
  if (prevent) {
    record(s, `${id} 的死亡被警察防止`);
    return;
  }
  c.alive = false;
  record(s, `${id} 死亡，尸体留在原地`);
  confirmImmediateLoss(s, d);
}
export function confirmLoopEnd(s, d) {
  if (
    s.phase !== "loopEnd" ||
    s.loopEndChecked ||
    (!s.failed && s.day !== scriptFor(s, d).daysPerLoop)
  )
    throw Error("不能重复判定轮回");
  const reasons = lossReasons(s, d, { loopEnd: true });
  s.failed = s.failed || reasons.length > 0;
  s.loopEndChecked = true;
  const script = scriptFor(s, d);
  for (const [id, r] of Object.entries(script.roles))
    if (r === "friend" && !s.characters[id].alive) s.publicRoles[id] = r;
  if (!s.failed) {
    s.winner = "protagonists";
    s.phase = "finished";
    record(s, "完整轮回存活，主人公获胜");
  } else if (s.loop >= s.loops) {
    s.winner = "GM";
    s.phase = "finished";
    record(s, "全部轮回失败，剧本之主获胜；First Steps 无最终猜测");
  } else record(s, "GM 确认本轮回失败，可回溯");
  return reasons;
}
