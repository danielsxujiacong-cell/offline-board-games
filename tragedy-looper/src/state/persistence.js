import { VERSION, cardFor, validateSelection } from "./game-state.js";
export const SAVE_KEY = "tragedy-looper.save";
export function validateState(s, data) {
  if (!s || s.version !== VERSION)
    throw Error("不支持的存档版本，原存档已保留");
  const script = data.scripts.find((x) => x.id === s.scriptId);
  if (
    !script ||
    !script.loopOptions.includes(s.loops) ||
    !Number.isInteger(s.loop) ||
    s.loop < 1 ||
    s.loop > s.loops ||
    !Number.isInteger(s.day) ||
    s.day < 1 ||
    s.day > script.daysPerLoop
  )
    throw Error("存档剧本或进度损坏");
  const phases = [
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
  ];
  if (!phases.includes(s.phase)) throw Error("存档阶段损坏");
  for (const key of [
    "characters",
    "locations",
    "initialLayout",
    "locked",
    "publicRoles",
    "deductions",
    "usedSkills",
    "daySkills",
    "selection",
    "resolutionDone",
  ])
    if (!s[key] || typeof s[key] !== "object" || Array.isArray(s[key]))
      throw Error("存档缺少 " + key);
  for (const key of [
    "usedCards",
    "history",
    "incidentResults",
    "incidentHistory",
  ])
    if (!Array.isArray(s[key])) throw Error("存档缺少 " + key);
  for (const id of script.characters) {
    const c = s.characters[id];
    if (
      !c ||
      !data.locations.some((l) => l.id === c.location) ||
      !data.locations.some((l) => l.id === s.initialLayout[id]) ||
      typeof c.alive !== "boolean" ||
      ["paranoia", "goodwill", "intrigue"].some(
        (k) => !Number.isInteger(c[k]) || c[k] < 0,
      )
    )
      throw Error("角色存档损坏");
  }
  for (const l of data.locations)
    if (
      !Number.isInteger(s.locations[l.id]?.intrigue) ||
      s.locations[l.id].intrigue < 0
    )
      throw Error("地点存档损坏");
  for (const o of ["GM", "P1", "P2", "P3"]) {
    if (
      !Array.isArray(s.selection[o]) ||
      s.selection[o].length > (o === "GM" ? 3 : 1)
    )
      throw Error("选牌存档损坏");
    for (const choice of s.selection[o])
      if (
        !choice ||
        typeof choice.cardInstanceId !== "string" ||
        typeof choice.target !== "string" ||
        (choice.cardInstanceId &&
          (!cardFor(data, choice.cardInstanceId) ||
            !choice.cardInstanceId.startsWith(o + ":"))) ||
        (choice.target &&
          !s.characters[choice.target] &&
          !s.locations[choice.target])
      )
        throw Error("行动卡或目标存档损坏");
    if (
      s.phase === "selection" &&
      s.locked[o] &&
      validateSelection(s, data, o, s.selection[o])
    )
      throw Error("锁定行动存档损坏");
  }
  if (!Number.isInteger(s.leader) || s.leader < 1 || s.leader > 3)
    throw Error("领袖存档损坏");
  for (const id of s.usedCards)
    if (typeof id !== "string" || !cardFor(data, id))
      throw Error("冷却存档损坏");
  for (const [id, role] of Object.entries(s.publicRoles))
    if (
      !script.characters.includes(id) ||
      !data.roles.some((r) => r.id === role)
    )
      throw Error("已公开身份存档损坏");
  for (const value of Object.values(s.deductions))
    if (!Number.isInteger(value) || value < 0 || value > 3)
      throw Error("推理存档损坏");
  if (
    s.revealed != null &&
    (!Array.isArray(s.revealed) ||
      s.revealed.some(
        (c) =>
          !c ||
          typeof c.cardInstanceId !== "string" ||
          !cardFor(data, c.cardInstanceId) ||
          (!s.characters[c.target] && !s.locations[c.target]),
      ))
  )
    throw Error("亮牌存档损坏");
  if (
    s.history.some(
      (e) =>
        !e ||
        typeof e.message !== "string" ||
        !Number.isInteger(e.loop) ||
        !Number.isInteger(e.day),
    )
  )
    throw Error("日志存档损坏");
  if (
    s.incidentResults.some(
      (e) =>
        !e ||
        !Number.isInteger(e.day) ||
        !data.incidents.some((i) => i.id === e.incident),
    )
  )
    throw Error("事件进度存档损坏");
  return s;
}
export function readSave(storage, data) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { state: null };
    return { state: validateState(JSON.parse(raw), data) };
  } catch (e) {
    return { state: null, error: "无法读取存档：" + e.message, raw };
  }
}
export function writeSave(storage, s) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(s));
    return null;
  } catch (e) {
    return "保存失败：" + e.message + "。请导出存档后再刷新。";
  }
}
