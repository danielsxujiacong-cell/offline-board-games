export const COLORS = ["yellow", "blue", "white", "green", "red"];
export const NAMES = {
  yellow: "沙丘",
  blue: "深海",
  white: "雪峰",
  green: "雨林",
  red: "火山",
};
export function cards() {
  return COLORS.flatMap((color) => [
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `${color}-w${i}`,
      color,
      type: "wager",
      value: 0,
    })),
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `${color}-${i + 2}`,
      color,
      type: "number",
      value: i + 2,
    })),
  ]);
}
export function shuffle(deck, random = Math.random) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const rows = () => Object.fromEntries(COLORS.map((c) => [c, []]));
export function newGame(starter = 0) {
  const deck = shuffle(cards());
  return {
    id: globalThis.crypto.randomUUID(),
    player: starter,
    phase: "PLAY",
    hands: [deck.splice(0, 8), deck.splice(0, 8)],
    deck,
    expeditions: [rows(), rows()],
    discards: rows(),
    selected: null,
    justDiscardedCardId: null,
    ended: false,
    settled: false,
  };
}
export function scoreColumn(column) {
  const sum = column
      .filter((c) => c.type === "number")
      .reduce((s, c) => s + c.value, 0),
    wagers = column.filter((c) => c.type === "wager").length,
    bonus = column.length >= 8 ? 20 : 0;
  return {
    sum,
    wagers,
    count: column.length,
    bonus,
    score: column.length ? (sum - 20) * (wagers + 1) + bonus : 0,
  };
}
export function scores(g) {
  return g.expeditions.map((rows) => {
    const columns = Object.fromEntries(
      COLORS.map((c) => [c, scoreColumn(rows[c])]),
    );
    return { columns, total: COLORS.reduce((s, c) => s + columns[c].score, 0) };
  });
}
export function playReason(g, card) {
  if (g.ended || g.phase !== "PLAY") return "当前不是出牌阶段";
  if (!card || !g.hands[g.player].some((c) => c.id === card.id))
    return "请选择自己的手牌";
  const col = g.expeditions[g.player][card.color];
  if (card.type === "wager") {
    if (col.some((c) => c.type === "number")) return "数字牌之后不能投资";
    if (col.filter((c) => c.type === "wager").length >= 3)
      return "每条路线最多三张投资卡";
  } else {
    const last = col.filter((c) => c.type === "number").at(-1);
    if (last && card.value <= last.value) return `数字必须大于 ${last.value}`;
  }
  return "";
}
export function drawReason(g, source) {
  if (g.ended || g.phase !== "DRAW") return "请先出牌或弃牌";
  if (source === "deck") return g.deck.length ? "" : "公共牌库已空";
  if (!COLORS.includes(source)) return "无效的摸牌来源";
  const top = g.discards[source].at(-1);
  return !top
    ? "弃牌堆为空"
    : top.id === g.justDiscardedCardId
      ? "不能拿回本回合刚弃掉的牌"
      : "";
}
export function transition(g, action) {
  const n = structuredClone(g);
  if (n.ended) throw Error("本局已经结束");
  if (action.type === "select") {
    if (
      n.phase !== "PLAY" ||
      !n.hands[n.player].some((c) => c.id === action.id)
    )
      throw Error("现在不能选择这张牌");
    n.selected = action.id;
    return n;
  }
  if (action.type === "play" || action.type === "discard") {
    if (n.phase !== "PLAY") throw Error("请先完成摸牌");
    const i = n.hands[n.player].findIndex((c) => c.id === n.selected);
    if (i < 0) throw Error("请先选择手牌");
    const c = n.hands[n.player][i];
    if (action.type === "play") {
      const reason = playReason(n, c);
      if (reason) throw Error(reason);
      n.expeditions[n.player][c.color].push(c);
    } else {
      n.discards[c.color].push(c);
      n.justDiscardedCardId = c.id;
    }
    n.hands[n.player].splice(i, 1);
    n.selected = null;
    n.phase = "DRAW";
    return n;
  }
  if (action.type === "draw") {
    const reason = drawReason(n, action.source);
    if (reason) throw Error(reason);
    n.hands[n.player].push(
      action.source === "deck" ? n.deck.pop() : n.discards[action.source].pop(),
    );
    n.justDiscardedCardId = null;
    if (!n.deck.length) {
      n.ended = true;
      n.phase = "END";
    } else {
      n.player = 1 - n.player;
      n.phase = "PLAY";
    }
    return n;
  }
  throw Error("未知操作");
}
export function settle(session) {
  const g = session.game;
  if (!g.ended) return session;
  if (session.history.some((h) => h.id === g.id)) {
    g.settled = true;
    return session;
  }
  const result = scores(g);
  session.history.push({
    id: g.id,
    time: new Date().toISOString(),
    players: result,
  });
  session.totals = session.totals.map((v, i) => v + result[i].total);
  g.settled = true;
  return session;
}
export function freshSession() {
  return { version: 1, game: newGame(), totals: [0, 0], history: [] };
}
export function nextGame(session, reset = false) {
  return {
    version: 1,
    game: newGame(1 - session.game.player),
    totals: reset ? [0, 0] : [...session.totals],
    history: reset ? [] : structuredClone(session.history),
  };
}
