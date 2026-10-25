import test from "node:test";
import assert from "node:assert/strict";
import {
  cards,
  COLORS,
  newGame,
  scoreColumn,
  scores,
  playReason,
  drawReason,
  transition,
  settle,
  freshSession,
  nextGame,
} from "../lost-cities/engine.js";
import { load, save, validate, KEY } from "../lost-cities/storage.js";
const c = (type, value = 0, color = "yellow") => ({
  id: `${type}-${value}`,
  type,
  value,
  color,
});
test("60 cards, unique IDs, 3 wagers + 2–10 per color, deal 8/8/44", () => {
  const deck = cards();
  assert.equal(deck.length, 60);
  assert.equal(new Set(deck.map((c) => c.id)).size, 60);
  for (const color of COLORS) {
    const a = deck.filter((c) => c.color === color);
    assert.equal(a.filter((c) => c.type === "wager").length, 3);
    assert.deepEqual(
      a.filter((c) => c.type === "number").map((c) => c.value),
      [2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
  }
  const g = newGame();
  assert.deepEqual(
    g.hands.map((a) => a.length),
    [8, 8],
  );
  assert.equal(g.deck.length, 44);
});
test("required scoring and all five colors, bonus outside multiplier", () => {
  for (const [col, want] of [
    [[], 0],
    [[c("wager")], -40],
    [[c("wager"), c("wager")], -60],
    [[c("wager"), c("wager"), c("wager")], -80],
    [[2, 3, 6, 9, 10].map((v) => c("number", v)), 10],
    [
      [
        c("wager"),
        c("wager"),
        ...[2, 4, 6, 7, 8, 9].map((v) => c("number", v)),
      ],
      68,
    ],
  ])
    assert.equal(scoreColumn(col).score, want);
  const g = newGame();
  for (const color of COLORS)
    g.expeditions[0][color] = [c("number", 10, color)];
  assert.equal(scores(g)[0].total, -50);
});
test("investment limits, type, strictly ascending and phase guards", () => {
  const g = newGame();
  const wager = cards().find((c) => c.type === "wager");
  g.hands[0][0] = wager;
  g.expeditions[0].yellow = [c("number", 2)];
  assert.match(playReason(g, wager), /之后/);
  g.expeditions[0].yellow = [c("wager"), c("wager"), c("wager")];
  assert.match(playReason(g, wager), /最多/);
  const n = c("number", 2);
  g.hands[0][0] = n;
  g.expeditions[0].yellow = [c("number", 2)];
  assert.match(playReason(g, n), /大于/);
  g.expeditions[0].yellow = [c("wager")];
  assert.equal(playReason(g, n), "");
  assert.throws(() => transition(g, { type: "draw", source: "deck" }));
  g.selected = n.id;
  const next = transition(g, { type: "discard" });
  assert.equal(next.phase, "DRAW");
  assert.equal(next.hands[0].length, 7);
  assert.throws(() => transition(next, { type: "discard" }));
  assert.match(drawReason(next, "yellow"), /刚弃掉/);
  assert.match(drawReason(next, "blue"), /为空/);
  next.discards.blue.push(c("number", 5, "blue"));
  assert.equal(drawReason(next, "blue"), "");
  const done = transition(next, { type: "draw", source: "blue" });
  assert.equal(done.player, 1);
  assert.equal(done.hands[0].length, 8);
  assert.equal(done.justDiscardedCardId, null);
});
test("complete legal round, save PLAY and DRAW, settle exactly once, next/reset", () => {
  const storage = {
    raw: null,
    getItem() {
      return this.raw;
    },
    setItem(k, v) {
      this.raw = v;
    },
  };
  let s = freshSession();
  save(s, storage);
  assert.deepEqual(load(storage), s);
  for (let i = 0; i < 44; i++) {
    s.game = transition(s.game, {
      type: "select",
      id: s.game.hands[s.game.player][0].id,
    });
    save(s, storage);
    assert.deepEqual(load(storage), s);
    s.game = transition(s.game, { type: "discard" });
    save(s, storage);
    assert.deepEqual(load(storage), s);
    s.game = transition(s.game, { type: "draw", source: "deck" });
    validate(s);
  }
  assert.equal(s.game.ended, true);
  assert.equal(s.game.deck.length, 0);
  assert.equal(s.game.phase, "END");
  assert.throws(() => transition(s.game, { type: "draw", source: "deck" }));
  settle(s);
  save(s, storage);
  let restored = load(storage);
  settle(restored);
  assert.equal(restored.history.length, 1);
  assert.deepEqual(restored.totals, s.totals);
  assert.equal(nextGame(restored).history.length, 1);
  assert.deepEqual(nextGame(restored, true).totals, [0, 0]);
  assert.equal(nextGame(restored, true).history.length, 0);
});
test("corrupt and incompatible saves are preserved", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ version: 99 }),
    JSON.stringify({ ...freshSession(), totals: [1, 0] }),
  ]) {
    const storage = {
      getItem: () => raw,
      setItem: () => assert.fail("must preserve"),
    };
    assert.throws(() => load(storage));
  }
  const s = freshSession();
  s.game.deck[0] = s.game.deck[1];
  assert.throws(() => validate(s));
});
