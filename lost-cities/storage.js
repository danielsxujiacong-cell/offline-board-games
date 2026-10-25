import { cards, COLORS, scores } from "./engine.js";
export const KEY = "lost-cities-save-v1";
const check = (condition) => {
  if (!condition)
    throw Error("存档损坏或版本不兼容；原始数据已保留。请导出备份后再重置。");
};
export function validate(s) {
  // All malformed nested shapes use the same actionable recovery message.
  try {
    return validateSession(s);
  } catch {
    check(false);
  }
}
function validateSession(s) {
  check(
    s?.version === 1 &&
      Array.isArray(s.totals) &&
      s.totals.length === 2 &&
      s.totals.every(Number.isFinite) &&
      Array.isArray(s.history),
  );
  const g = s.game;
  check(
    g &&
      typeof g.id === "string" &&
      g.id.length > 0 &&
      [0, 1].includes(g.player) &&
      ["PLAY", "DRAW", "END"].includes(g.phase) &&
      typeof g.ended === "boolean" &&
      typeof g.settled === "boolean" &&
      g.ended === (g.phase === "END"),
  );
  check(
    Array.isArray(g.hands) &&
      g.hands.length === 2 &&
      g.hands.every(Array.isArray) &&
      Array.isArray(g.deck) &&
      Array.isArray(g.expeditions) &&
      g.expeditions.length === 2,
  );
  const all = [...g.deck, ...g.hands.flat()];
  for (const row of [...g.expeditions, g.discards]) {
    check(
      row &&
        Object.keys(row).length === COLORS.length &&
        COLORS.every((c) => Array.isArray(row[c])),
    );
    for (const color of COLORS) {
      check(row[color].every((c) => c.color === color));
      all.push(...row[color]);
    }
  }
  const canonical = new Map(cards().map((c) => [c.id, c]));
  check(all.length === 60 && new Set(all.map((c) => c.id)).size === 60);
  for (const c of all) {
    const ref = canonical.get(c.id);
    check(
      ref &&
        ref.color === c.color &&
        ref.type === c.type &&
        ref.value === c.value,
    );
  }
  for (const rows of g.expeditions)
    for (const col of Object.values(rows)) {
      let last = 0,
        w = 0;
      for (const c of col) {
        if (c.type === "wager") {
          check(last === 0 && ++w <= 3);
        } else {
          check(c.value > last);
          last = c.value;
        }
      }
    }
  check(
    g.hands.every(
      (h, i) =>
        h.length === (!g.ended && g.phase === "DRAW" && i === g.player ? 7 : 8),
    ),
  );
  check(g.ended ? g.deck.length === 0 : g.deck.length > 0);
  check(
    g.selected === null ||
      (g.phase === "PLAY" &&
        g.hands[g.player].some((c) => c.id === g.selected)),
  );
  check(
    g.justDiscardedCardId === null ||
      (g.phase === "DRAW" &&
        COLORS.some((c) => g.discards[c].at(-1)?.id === g.justDiscardedCardId)),
  );
  const ids = new Set(),
    totals = [0, 0];
  for (const h of s.history) {
    check(
      typeof h.id === "string" &&
        h.id.length > 0 &&
        !ids.has(h.id) &&
        typeof h.time === "string" &&
        Number.isFinite(Date.parse(h.time)) &&
        Array.isArray(h.players) &&
        h.players.length === 2,
    );
    ids.add(h.id);
    h.players.forEach((p, i) => {
      check(
        p.columns &&
          COLORS.every((c) => {
            const d = p.columns[c];
            return (
              d &&
              ["sum", "wagers", "count", "bonus", "score"].every((k) =>
                Number.isFinite(d[k]),
              ) &&
              validColumnDetail(d) &&
              d.score ===
                (d.count ? (d.sum - 20) * (d.wagers + 1) + d.bonus : 0) &&
              d.bonus === (d.count >= 8 ? 20 : 0)
            );
          }),
      );
      check(p.total === COLORS.reduce((v, c) => v + p.columns[c].score, 0));
      totals[i] += p.total;
    });
  }
  check(totals.every((v, i) => v === s.totals[i]));
  check(!g.settled || (g.ended && ids.has(g.id)));
  if (ids.has(g.id)) {
    check(
      g.ended &&
        JSON.stringify(s.history.find((h) => h.id === g.id).players) ===
          JSON.stringify(scores(g)),
    );
  }
  return s;
}
// Feasible sums of n distinct values from 2–10, computed once for history validation.
const possibleSums = Array.from({ length: 10 }, () => new Set());
for (let mask = 0; mask < 512; mask++) {
  let count = 0,
    sum = 0;
  for (let i = 0; i < 9; i++)
    if (mask & (1 << i)) {
      count++;
      sum += i + 2;
    }
  possibleSums[count].add(sum);
}
function validColumnDetail(d) {
  return (
    ["sum", "wagers", "count", "bonus", "score"].every((k) =>
      Number.isInteger(d[k]),
    ) &&
    d.wagers >= 0 &&
    d.wagers <= 3 &&
    d.count >= d.wagers &&
    d.count <= d.wagers + 9 &&
    possibleSums[d.count - d.wagers].has(d.sum)
  );
}
export function load(storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Error("存档无法解析；原始数据已保留，请先导出备份。");
  }
  return validate(parsed);
}
export function save(session, storage = localStorage) {
  validate(session);
  storage.setItem(KEY, JSON.stringify(session));
}
