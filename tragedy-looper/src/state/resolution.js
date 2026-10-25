import {
  cardFor,
  moveDestination,
  canMove,
  changeCounter,
  record,
} from "./game-state.js";
export function resolutionGroups(s, d) {
  const all = (s.revealed || []).map((c) => ({
    ...c,
    card: cardFor(d, c.cardInstanceId),
  }));
  const conflict =
    all.filter((c) => c.owner !== "GM" && c.card.id === "forbid-intrigue")
      .length >= 2;
  return [...new Set(all.map((c) => c.target))].map((target) => {
    const cards = all
      .filter((c) => c.target === target)
      .sort(
        (a, b) =>
          a.card.priority - b.card.priority ||
          (b.card.effect.amount || 0) - (a.card.effect.amount || 0),
      );
    const moves = cards
      .filter((c) => c.card.effect.type === "move")
      .map((c) => c.card.effect.direction);
    const direction =
      moves.length === 2
        ? moves[0] === moves[1]
          ? moves[0]
          : ({ h: 1, v: 2, d: 3 }[moves[0]] ^
                { h: 1, v: 2, d: 3 }[moves[1]]) ===
              1
            ? "h"
            : ({ h: 1, v: 2, d: 3 }[moves[0]] ^
                  { h: 1, v: 2, d: 3 }[moves[1]]) ===
                2
              ? "v"
              : "d"
        : moves[0];
    const blockedMove = cards.some((c) => c.card.id === "forbid-move");
    const destination =
      s.characters[target] && direction
        ? moveDestination(
            s.resolutionOrigin?.[target] || s.characters[target].location,
            direction,
          )
        : null;
    const restricted = destination && !canMove(s, d, target, destination);
    const location = !!s.locations[target];
    const blocked = new Set(
      cards
        .filter(
          (c) =>
            c.card.effect.type === "forbid" &&
            !(
              c.card.id === "forbid-intrigue" &&
              (conflict || (s.cultistOverride && cultistHere(s, d, target)))
            ),
        )
        .map((c) => c.card.effect.counter),
    );
    const changes = cards
      .filter(
        (c) =>
          c.card.effect.type === "counter" &&
          !blocked.has(c.card.effect.counter) &&
          (!location || c.card.locationEffective),
      )
      .map((c) => ({
        counter: c.card.effect.counter,
        amount: c.card.effect.amount,
      }));
    return {
      target,
      cards,
      conflict,
      moves,
      direction,
      destination,
      restricted,
      blockedMove,
      changes,
      location,
    };
  });
}
function cultistHere(s, d, target) {
  const script = d.scripts.find((x) => x.id === s.scriptId);
  const location = projectedLocation(s, d, target);
  return Object.entries(script.roles).some(
    ([id, r]) =>
      r === "cultist" &&
      s.characters[id].alive &&
      projectedLocation(s, d, id) === location,
  );
}
export function applyGroup(s, d, target) {
  if (s.resolutionDone[target]) throw Error("已结算");
  const g = resolutionGroups(s, d).find((g) => g.target === target);
  if (!g) throw Error("没有此组");
  if (g.destination && !g.restricted && !g.blockedMove)
    s.characters[target].location = g.destination;
  for (const c of g.changes) changeCounter(s, target, c.counter, c.amount);
  s.resolutionDone[target] = true;
  record(s, `${target} 行动卡组已确认结算`);
}

function projectedLocation(s, d, id) {
  if (s.locations[id]) return id;
  const origin = s.resolutionOrigin?.[id] || s.characters[id].location;
  const cards = (s.revealed || [])
    .filter((c) => c.target === id)
    .map((c) => cardFor(d, c.cardInstanceId));
  if (cards.some((c) => c.id === "forbid-move")) return origin;
  const moves = cards
    .filter((c) => c.effect.type === "move")
    .map((c) => c.effect.direction);
  if (!moves.length) return origin;
  const masks = { h: 1, v: 2, d: 3 },
    mask =
      moves.length === 1 || moves[0] === moves[1]
        ? masks[moves[0]]
        : masks[moves[0]] ^ masks[moves[1]];
  const destination = moveDestination(origin, { 1: "h", 2: "v", 3: "d" }[mask]);
  return canMove(s, d, id, destination) ? destination : origin;
}
