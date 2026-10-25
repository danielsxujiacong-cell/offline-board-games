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

test("all legal subsets in every color use independent score oracle, exact 7/8 boundary", () => {
  for (const color of COLORS)
    for (let mask = 0; mask < 512; mask++)
      for (let w = 0; w <= 3; w++) {
        const numbers = Array.from({ length: 9 }, (_, i) => i + 2).filter(
          (_, i) => mask & (1 << i),
        );
        const col = [
          ...Array.from({ length: w }, () => c("wager", 0, color)),
          ...numbers.map((v) => c("number", v, color)),
        ];
        const expected = col.length
          ? (numbers.reduce((a, v) => a + v, 0) - 20) * (w + 1) +
            (col.length >= 8 ? 20 : 0)
          : 0;
        assert.equal(scoreColumn(col).score, expected);
      }
  assert.equal(
    scoreColumn([
      c("wager"),
      c("wager"),
      ...[2, 4, 6, 7, 8].map((v) => c("number", v)),
    ]).bonus,
    0,
  );
  assert.equal(
    scoreColumn([
      c("wager"),
      c("wager"),
      ...[2, 4, 6, 7, 8, 9].map((v) => c("number", v)),
    ]).score,
    68,
  );
  assert.equal(
    scoreColumn(cards().filter((c) => c.color === "red")).score,
    156,
  );
});

function finish(s, choose = () => "discard") {
  while (!s.game.ended) {
    const g = s.game;
    g.selected = g.hands[g.player][0].id;
    s.game = transition(g, { type: choose(g) });
    s.game = transition(s.game, { type: "draw", source: "deck" });
  }
  return s;
}

test("discard draws only top card, restriction expires, one remaining deck card does not end early", () => {
  let s = freshSession();
  // Move 43 deck cards into valid, ordered color discard piles, retaining all 60 IDs.
  for (const x of s.game.deck.splice(0, 43)) s.game.discards[x.color].push(x);
  const g = s.game,
    discardCard = g.hands[0][0],
    other = COLORS.find(
      (color) => color !== discardCard.color && g.discards[color].length,
    );
  g.selected = discardCard.id;
  const draw = transition(g, { type: "discard" }),
    before = structuredClone(draw);
  assert.throws(
    () => transition(draw, { type: "draw", source: discardCard.color }),
    /刚弃掉/,
  );
  assert.deepEqual(draw, before);
  const top = draw.discards[other].at(-1);
  let after = transition(draw, { type: "draw", source: other });
  assert.equal(after.hands[0].at(-1).id, top.id);
  assert.equal(after.deck.length, 1);
  assert.equal(after.ended, false);
  assert.equal(after.player, 1);
  after.selected = after.hands[1].find((x) => x.color !== discardCard.color).id;
  after = transition(after, { type: "discard" });
  assert.equal(drawReason(after, discardCard.color), "");
  after = transition(after, { type: "draw", source: discardCard.color });
  assert.equal(after.hands[1].at(-1).id, discardCard.id);
  after.selected = after.hands[0][0].id;
  after = transition(after, { type: "discard" });
  const finalCard = after.deck[0],
    player = after.player;
  after = transition(after, { type: "draw", source: "deck" });
  assert.equal(after.hands[player].at(-1).id, finalCard.id);
  assert.equal(after.player, player);
  assert.equal(after.phase, "END");
  assert.equal(after.ended, true);
  assert.deepEqual(
    after.hands.map((h) => h.length),
    [8, 8],
  );
  for (const type of ["play", "discard", "select", "draw"])
    assert.throws(
      () => transition(after, { type, id: finalCard.id, source: "deck" }),
      /结束/,
    );
  s.game = after;
  validate(s);
});

test("rejected actions preserve state and cannot use opponent cards or skip stages", () => {
  const g = newGame(),
    snapshot = structuredClone(g);
  for (const a of [
    { type: "select", id: g.hands[1][0].id },
    { type: "play" },
    { type: "discard" },
    { type: "draw", source: "deck" },
    { type: "draw", source: "unknown" },
    { type: "cheat" },
  ]) {
    assert.throws(() => transition(g, a));
    assert.deepEqual(g, snapshot);
  }
  g.selected = g.hands[0][0].id;
  const draw = transition(g, { type: "discard" });
  for (const type of ["play", "discard", "select"])
    assert.throws(() => transition(draw, { type, id: draw.hands[0][0].id }));
  const next = transition(draw, { type: "draw", source: "deck" });
  assert.throws(() => transition(next, { type: "draw", source: "deck" }));
});

test("three real investment cards may precede any increasing numbers; type overrides value", () => {
  const g = newGame();
  g.hands[0] = cards()
    .filter((x) => x.color === "yellow")
    .slice(0, 8);
  for (const card of g.hands[0].slice(0, 3)) {
    assert.equal(playReason(g, card), "");
    g.expeditions[0].yellow.push(card);
  }
  const two = g.hands[0].find((x) => x.value === 2);
  assert.equal(playReason(g, two), "");
  g.expeditions[0].yellow.push(two);
  assert.match(playReason(g, g.hands[0][0]), /之后/);
  const ten = c("number", 10);
  g.hands[0].push(ten);
  assert.equal(playReason(g, ten), "");
  g.expeditions[0].yellow.push(ten);
  assert.match(playReason(g, c("number", 3)), /手牌/);
  assert.match(
    playReason(
      g,
      g.hands[0].find((card) => card.value === 3),
    ),
    /大于 10/,
  );
  const fakeWager = { ...g.hands[0][0], value: 99 };
  assert.match(playReason(g, fakeWager), /之后/);
});

test("multi-round nonzero cumulative scores and interrupted settlement stay idempotent", () => {
  let s = freshSession();
  const storage = {
    raw: null,
    getItem() {
      return this.raw;
    },
    setItem(k, v) {
      this.raw = v;
    },
  };
  for (let round = 0; round < 3; round++) {
    let first = true;
    s = finish(s, () => {
      const type = first ? "play" : "discard";
      first = false;
      return type;
    });
    save(s, storage);
    s = load(storage);
    settle(s);
    const once = structuredClone(s);
    settle(s);
    assert.deepEqual(s, once);
    save(s, storage);
    s = load(storage);
    settle(s);
    assert.deepEqual(s, once);
    assert.deepEqual(
      s.totals,
      [0, 1].map((i) => s.history.reduce((n, h) => n + h.players[i].total, 0)),
    );
    assert.equal(s.history.length, round + 1);
    if (round < 2) s = nextGame(s);
  }
  assert.equal(new Set(s.history.map((h) => h.id)).size, 3);
  assert.ok(s.history.some((h) => h.players.some((p) => p.total !== 0)));
  const reset = nextGame(s, true);
  validate(reset);
  assert.equal(reset.history.length, 0);
  assert.deepEqual(reset.totals, [0, 0]);
});

test("seeded complete games preserve 60 cards, hand sizes, immutable rejection and saved order", () => {
  let seed = 12345;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let game = 0; game < 30; game++) {
    let s = freshSession(),
      turn = 0;
    while (!s.game.ended) {
      const g = s.game;
      const chosen = g.hands[g.player][Math.floor(random() * 8)];
      g.selected = chosen.id;
      s.game = transition(g, {
        type: random() < 0.6 && !playReason(g, chosen) ? "play" : "discard",
      });
      validate(s);
      const allowed = COLORS.filter((color) => !drawReason(s.game, color));
      const source =
        turn % 3 && allowed.length
          ? allowed[Math.floor(random() * allowed.length)]
          : "deck";
      const deckCount = s.game.deck.length;
      s.game = transition(s.game, { type: "draw", source });
      validate(s);
      assert.equal(s.game.deck.length, deckCount - (source === "deck" ? 1 : 0));
      assert.deepEqual(JSON.parse(JSON.stringify(s)).game, s.game);
      turn++;
      assert.ok(turn <= 132);
    }
    settle(s);
    validate(s);
  }
});

test("all malformed save structures and impossible historical expeditions reject with recovery guidance", () => {
  const complete = finish(freshSession());
  settle(complete);
  const mutations = [
    (s) => (s.game.hands[0] = null),
    (s) => (s.game.deck[0] = null),
    (s) => (s.game.expeditions[0].extra = []),
    (s) => (s.history = [null]),
    (s) => (s.game.id = ""),
    (s) => (s.game.selected = s.game.hands[1][0].id),
    (s) => (s.history[0].time = "nonsense"),
    (s) => (s.history[0].players[0] = null),
    (s) =>
      (s.history[0].players[0].columns.yellow = {
        sum: 0,
        wagers: 4,
        count: 4,
        bonus: 0,
        score: -100,
      }),
    (s) =>
      (s.history[0].players[0].columns.yellow = {
        sum: 3,
        wagers: 0,
        count: 2,
        bonus: 0,
        score: -17,
      }),
  ];
  for (const mutate of mutations) {
    const s = structuredClone(complete);
    mutate(s);
    const raw = JSON.stringify(s);
    const store = {
      getItem: () => raw,
      setItem: () => assert.fail("do not overwrite"),
    };
    assert.throws(() => load(store), /存档损坏.*导出备份/);
  }
  const partial = freshSession();
  partial.game.deck[0] = null;
  assert.throws(() => validate(partial), /存档损坏.*导出备份/);
});

test("continuation starter follows cumulative leader, including negative scores; reset starts player 1", () => {
  for (const totals of [
    [68, -40],
    [-40, 68],
    [-80, -10],
    [-10, -80],
    [0, 0],
    [-40, -40],
  ])
    for (const lastPlayer of [0, 1]) {
      const s = freshSession();
      s.totals = totals;
      s.game.player = lastPlayer;
      assert.equal(nextGame(s).game.player, totals[0] >= totals[1] ? 0 : 1);
      assert.equal(nextGame(s, true).game.player, 0);
    }
});
