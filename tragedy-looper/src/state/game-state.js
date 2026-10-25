export const VERSION = 1;
export const owners = ["GM", "P1", "P2", "P3"];
export const copy = (x) => structuredClone(x);
export function createGame(data, scriptId, loops) {
  const script = data.scripts.find((x) => x.id === scriptId);
  if (!script || !script.loopOptions.includes(loops))
    throw Error("剧本或轮回数不合法");
  return {
    version: VERSION,
    scriptId,
    loops,
    loop: 1,
    day: 1,
    phase: "loopStart",
    leader: 1,
    initialLayout: copy(script.initialLayout),
    characters: Object.fromEntries(
      script.characters.map((id) => [
        id,
        {
          location: script.initialLayout[id],
          alive: true,
          paranoia: 0,
          goodwill: 0,
          intrigue: 0,
        },
      ]),
    ),
    locations: Object.fromEntries(
      data.locations.map((x) => [x.id, { intrigue: 0 }]),
    ),
    selection: { GM: [], P1: [], P2: [], P3: [] },
    locked: {},
    usedCards: [],
    usedSkills: {},
    daySkills: {},
    publicRoles: {},
    deductions: {},
    history: [],
    incidentResults: [],
    incidentHistory: [],
    resolutionDone: {},
    cultistOverride: false,
    patientReleased: false,
    failed: false,
    winner: null,
  };
}
export function scriptFor(s, d) {
  return d.scripts.find((x) => x.id === s.scriptId);
}
export function hand(data, owner) {
  return data.actionCards.flatMap((c) =>
    Array.from(
      { length: c.copies[owner === "GM" ? "GM" : "protagonist"] },
      (_, i) => ({
        ...c,
        owner,
        cardInstanceId: `${owner}:${c.id}:${i + 1}`,
        limited: c.oncePerLoop[owner === "GM" ? "GM" : "protagonist"],
      }),
    ),
  );
}
export function cardFor(d, instance) {
  const [owner, id] = instance.split(":");
  return hand(d, owner).find((c) => c.cardInstanceId === instance);
}
export function record(s, message) {
  s.history.push({ loop: s.loop, day: s.day, message });
}
export function canMove(s, d, id, location) {
  const c = d.characters.find((c) => c.id === id);
  return (
    !!s.characters[id] &&
    s.characters[id].alive &&
    d.locations.some((l) => l.id === location) &&
    (!c.forbiddenLocations.includes(location) ||
      (id === "patient" && s.patientReleased))
  );
}
export function moveDestination(location, direction) {
  const ids = ["hospital", "shrine", "city", "school"];
  const index = ids.indexOf(location);
  return ids[index ^ ({ h: 1, v: 2, d: 3 }[direction] || 0)];
}
export function legalTarget(s, d, card, target) {
  if (s.locations[target]) return true;
  if (!s.characters[target]?.alive) return false;
  // A movement can combine with the other side's movement. Do not reject a
  // single forbidden destination before both sides reveal (rules p.18).
  return !!card;
}
export function validateSelection(s, d, owner, choices) {
  if (!owners.includes(owner) || choices.length !== (owner === "GM" ? 3 : 1))
    return "出牌数量不正确";
  const seen = new Set(),
    cards = new Set();
  for (const choice of choices) {
    const c = hand(d, owner).find(
      (c) => c.cardInstanceId === choice.cardInstanceId,
    );
    if (
      !c ||
      s.usedCards.includes(c.cardInstanceId) ||
      cards.has(c.cardInstanceId)
    )
      return "卡牌不可用";
    if (!legalTarget(s, d, c, choice.target)) return "目标不合法";
    if (seen.has(choice.target)) return "同一方当天不能重复目标";
    seen.add(choice.target);
    cards.add(c.cardInstanceId);
  }
  if (owner !== "GM")
    for (const other of owners.slice(1).filter((x) => x !== owner))
      if (s.selection[other].some((c) => seen.has(c.target)))
        return "主人公目标不能重复";
  return null;
}
export function lockSelection(s, d, owner) {
  if (
    s.phase !== "selection" ||
    s.locked[owner] ||
    (owner !== "GM" && !s.locked.GM)
  )
    throw Error("当前不能锁定");
  const error = validateSelection(s, d, owner, s.selection[owner]);
  if (error) throw Error(error);
  s.locked[owner] = true;
  record(s, `${owner} 已锁定行动`);
}
export function reveal(s, d) {
  if (s.phase !== "selection" || !owners.every((o) => s.locked[o]))
    throw Error("尚未全部锁定");
  s.revealed = owners.flatMap((owner) =>
    s.selection[owner].map((c) => ({ ...c, owner })),
  );
  for (const c of s.revealed)
    if (
      cardFor(d, c.cardInstanceId).limited &&
      !s.usedCards.includes(c.cardInstanceId)
    )
      s.usedCards.push(c.cardInstanceId);
  s.resolutionOrigin = Object.fromEntries(
    Object.entries(s.characters).map(([id, c]) => [id, c.location]),
  );
  s.phase = "cardResolve";
  record(s, "六张行动卡已亮牌");
}
export function changeCounter(s, target, counter, delta) {
  const c = s.characters[target] || s.locations[target];
  if (!c || !(counter in c) || !Number.isInteger(delta))
    throw Error("计数器无效");
  c[counter] = Math.max(0, c[counter] + delta);
  record(s, `${target} ${counter} ${delta > 0 ? "+" : ""}${delta}`);
}
export function resetLoop(s, d) {
  if (
    s.phase !== "loopEnd" ||
    !s.failed ||
    !s.loopEndChecked ||
    s.loop >= s.loops
  )
    throw Error("不能进入下一轮回");
  s.loop++;
  s.day = 1;
  s.phase = "loopStart";
  for (const [id, c] of Object.entries(s.characters))
    Object.assign(c, {
      location: s.initialLayout[id],
      alive: true,
      paranoia: 0,
      goodwill: 0,
      intrigue: 0,
    });
  for (const l of Object.values(s.locations)) l.intrigue = 0;
  Object.assign(s, {
    usedCards: [],
    usedSkills: {},
    daySkills: {},
    selection: { GM: [], P1: [], P2: [], P3: [] },
    locked: {},
    revealed: null,
    resolutionDone: {},
    cultistOverride: false,
    patientReleased: false,
    failed: false,
    incidentResults: [],
    protagonistsDead: false,
    loopEndChecked: false,
  });
  record(s, "回溯至初始布局；已公开身份与推理保留");
}
export function publicView(s, d) {
  const script = scriptFor(s, d);
  return {
    script: {
      id: script.id,
      name: script.name,
      nameEn: script.nameEn,
      daysPerLoop: script.daysPerLoop,
      incidents: script.incidents.map(({ day, incident }) => ({
        day,
        incident,
      })),
    },
    characters: s.characters,
    locations: s.locations,
    publicRoles: s.publicRoles,
    leader: s.leader,
    phase: s.phase,
    loop: s.loop,
    day: s.day,
    selection:
      s.phase === "selection"
        ? {
            GM: s.locked.GM ? "已锁定" : "未锁定",
            ...Object.fromEntries(
              owners.slice(1).map((o) => [o, s.selection[o]]),
            ),
          }
        : s.revealed,
  };
}
