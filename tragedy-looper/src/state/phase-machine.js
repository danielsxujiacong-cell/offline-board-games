import { record } from "./game-state.js";
export const phases = [
  ["loopStart", "轮回开始"],
  ["morning", "早晨"],
  ["selection", "选牌"],
  ["cardResolve", "翻牌结算"],
  ["mastermindAbility", "GM 角色能力"],
  ["goodwillAbility", "领袖友好能力"],
  ["incidentStep", "事件判定"],
  ["leaderTransfer", "领袖顺时针移交"],
  ["dayEnd", "日终／夜间"],
  ["nextDay", "下一天"],
  ["loopEnd", "轮回结束"],
  ["finished", "终局"],
];
export function advance(s, d) {
  const script = d.scripts.find((x) => x.id === s.scriptId);
  if (s.winner) throw Error("牌局已结束");
  if (["selection", "loopEnd", "finished"].includes(s.phase))
    throw Error("请使用当前阶段的专用操作");
  if (
    s.phase === "cardResolve" &&
    (s.revealed || []).some((c) => !s.resolutionDone[c.target])
  )
    throw Error("请完成全部目标结算");
  if (
    s.phase === "incidentStep" &&
    script.incidents.some((i) => i.day === s.day) &&
    !s.incidentResults.some((i) => i.day === s.day)
  )
    throw Error("GM 尚未确认事件");
  if (s.phase === "leaderTransfer") s.leader = (s.leader % 3) + 1;
  if (s.phase === "nextDay") {
    if (s.day === script.daysPerLoop) s.phase = "loopEnd";
    else {
      s.day++;
      s.phase = "morning";
      Object.assign(s, {
        selection: { GM: [], P1: [], P2: [], P3: [] },
        locked: {},
        revealed: null,
        resolutionDone: {},
        cultistOverride: false,
        daySkills: {},
      });
    }
  } else s.phase = phases[phases.findIndex((x) => x[0] === s.phase) + 1][0];
  record(s, `进入${phases.find((x) => x[0] === s.phase)[1]}`);
}
