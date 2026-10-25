import {
  COLORS,
  NAMES,
  playReason,
  drawReason,
  scores,
  transition,
  freshSession,
  nextGame,
  settle,
} from "./engine.js";
import { KEY, load, save } from "./storage.js";
const root = document.querySelector("#game"),
  notice = document.querySelector("#notice");
let session,
  locked = true,
  blocked = false;
const label = (c) => (c.type === "wager" ? "投资" : String(c.value));
function card(c, extra = "") {
  return `<span class="card ${c.color} ${c.type} ${extra}"><b>${label(c)}</b><span class="landscape" aria-hidden="true"></span><small>${NAMES[c.color]}${c.type === "wager" ? " · ×" : ""}</small></span>`;
}
function persist() {
  try {
    save(session);
    notice.textContent = "已自动保存";
    return true;
  } catch (e) {
    notice.textContent = `保存失败：${e.message} 请导出备份，勿关闭页面。`;
    return false;
  }
}
function route(player) {
  const result = scores(session.game)[player];
  return `<section class="player"><h2>玩家 ${player + 1} <span>${result.total} 分</span></h2><div class="routes">${COLORS.map(
    (color) => {
      const col = session.game.expeditions[player][color],
        d = result.columns[color];
      return `<div class="route ${color}"><h3>${NAMES[color]}</h3><div class="trail">${col.length ? col.map((c) => `<span>${label(c)}</span>`).join("") : "<i>尚未出发</i>"}</div><strong>${d.score} 分</strong><small>${d.count} 张 · 投资 ${d.wagers}</small></div>`;
    },
  ).join("")}</div></section>`;
}
function results() {
  const result = scores(session.game),
    diff = result[0].total - result[1].total;
  return `<section class="result"><small>EXPEDITION COMPLETE</small><h2>${diff === 0 ? "势均力敌 · 平局" : `玩家 ${diff > 0 ? 1 : 2} 远征获胜`}</h2><div class="table-wrap"><table><thead><tr><th>路线</th><th>玩家 1</th><th>玩家 2</th></tr></thead><tbody>${COLORS.map(
    (c) =>
      `<tr><th>${NAMES[c]}</th>${result
        .map((p) => {
          const d = p.columns[c];
          return `<td><b>${d.score}</b><small>${d.count ? `(${d.sum} − 20) × ${d.wagers + 1} + ${d.bonus}` : "空路线"}</small></td>`;
        })
        .join("")}</tr>`,
  ).join(
    "",
  )}<tr><th>本局</th>${result.map((p) => `<td><b>${p.total}</b></td>`).join("")}</tr><tr><th>累计</th>${session.totals.map((s) => `<td>${s}</td>`).join("")}</tr></tbody></table></div><button id="next">再来一局</button><button id="reset" class="secondary">清零并开始新计分赛</button></section><details><summary>远征历史 · ${session.history.length} 局</summary>${session.history
    .slice()
    .reverse()
    .map(
      (h, i) =>
        `<p>第 ${session.history.length - i} 局 · ${new Date(h.time).toLocaleString("zh-CN")}<br>玩家 1：${h.players[0].total}　玩家 2：${h.players[1].total}</p><div class="history-detail">${COLORS.map((c) => `${NAMES[c]} ${h.players[0].columns[c].score} / ${h.players[1].columns[c].score}`).join(" · ")}</div>`,
    )
    .join("")}</details>`;
}
function render() {
  if (blocked) return;
  const g = session.game;
  if (g.ended) {
    root.innerHTML = results();
    bind();
    return;
  }
  if (locked) {
    root.innerHTML = `<section class="handoff"><div class="compass" aria-hidden="true">✥</div><small>远征日志已封存</small><h2>请交给玩家 ${g.player + 1}</h2><p>${g.phase === "DRAW" ? "恢复到摸牌阶段：请完成一次摸牌。" : "轮到你规划下一步远征。"}</p><button id="accept">我已准备好，查看手牌</button><p class="muted">确认周围无人查看，再打开你的日志</p></section>`;
    bind();
    return;
  }
  const selected = g.hands[g.player].find((c) => c.id === g.selected),
    reason = playReason(g, selected);
  root.innerHTML = `${route(1 - g.player)}<section class="public"><div class="phase"><b>玩家 ${g.player + 1} · ${g.phase === "PLAY" ? "① 出牌" : "② 摸牌"}</b><button id="hide" class="secondary">隐藏手牌</button></div><div class="supply"><button data-draw="deck" class="deck ${g.phase === "DRAW" ? "legal" : ""}" ${drawReason(g, "deck") ? "disabled" : ""}><span>✥</span><b>${g.deck.length}</b><small>公共牌库</small></button><div class="discards">${COLORS.map(
    (c) => {
      const pile = g.discards[c],
        r = drawReason(g, c);
      return `<button data-draw="${c}" class="discard ${c} ${!r ? "legal" : ""}" ${r ? "disabled" : ""} aria-label="${NAMES[c]}弃牌堆，${pile.length} 张${r ? "，" + r : ""}">${pile.length ? card(pile.at(-1)) : `<span class="empty">${NAMES[c]}<br>空</span>`}<small>${pile.length} 张</small></button>`;
    },
  ).join(
    "",
  )}</div></div><p class="instruction">${g.phase === "PLAY" ? "选择一张手牌，打入远征或弃置。" : "点击亮起的牌库或弃牌堆顶牌，完成摸牌。"}${g.justDiscardedCardId ? " 刚弃掉的牌不能立即拿回。" : ""}</p></section>${route(g.player)}<section class="private"><h2>你的手牌 <small>${g.hands[g.player].length} 张 · 左右滑动查看</small></h2><div class="hand">${[
    ...g.hands[g.player],
  ]
    .sort(
      (a, b) =>
        COLORS.indexOf(a.color) - COLORS.indexOf(b.color) || a.value - b.value,
    )
    .map(
      (c) =>
        `<button data-card="${c.id}" class="hand-card ${g.selected === c.id ? "selected" : ""}" ${g.phase !== "PLAY" ? "disabled" : ""} aria-label="${NAMES[c.color]} ${label(c)}" aria-pressed="${g.selected === c.id}">${card(c)}</button>`,
    )
    .join(
      "",
    )}</div><div class="actions"><button id="play" ${reason ? "disabled" : ""}>打入远征</button><button id="discard" ${!selected || g.phase !== "PLAY" ? "disabled" : ""}>弃牌</button></div><p id="reason">${selected ? reason || `可出发：${NAMES[selected.color]} ${label(selected)}` : "先选择一张手牌"}</p></section>`;
  bind();
}
function action(a) {
  if (locked || blocked) return;
  try {
    const oldPlayer = session.game.player;
    session.game = transition(session.game, a);
    if (session.game.ended) settle(session);
    if (oldPlayer !== session.game.player) locked = true;
    persist();
    render();
  } catch (e) {
    notice.textContent = e.message;
  }
}
function bind() {
  root.querySelector("#accept")?.addEventListener("click", () => {
    locked = false;
    render();
  });
  root.querySelector("#hide")?.addEventListener("click", () => {
    locked = true;
    render();
  });
  root
    .querySelectorAll("[data-card]")
    .forEach(
      (b) => (b.onclick = () => action({ type: "select", id: b.dataset.card })),
    );
  root
    .querySelectorAll("[data-draw]")
    .forEach(
      (b) =>
        (b.onclick = () => action({ type: "draw", source: b.dataset.draw })),
    );
  for (const type of ["play", "discard"])
    root
      .querySelector("#" + type)
      ?.addEventListener("click", () => action({ type }));
  root.querySelector("#next")?.addEventListener("click", () => {
    session = nextGame(session);
    locked = true;
    persist();
    render();
  });
  root.querySelector("#reset")?.addEventListener("click", () => {
    if (
      confirm(
        "确定清除累计分数和全部历史记录，并开始新计分赛？此操作无法撤销。",
      )
    ) {
      session = nextGame(session, true);
      locked = true;
      persist();
      render();
    }
  });
}
function exportSave() {
  const raw = blocked ? localStorage.getItem(KEY) : JSON.stringify(session),
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([raw || ""], { type: "application/json" }),
  );
  a.download = "lost-cities-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
try {
  session = load() || freshSession();
  if (session.game.ended) settle(session);
  persist();
  render();
} catch (e) {
  blocked = true;
  notice.textContent = e.message;
  root.innerHTML =
    '<section class="result"><h2>存档需要处理</h2><p>未覆盖现有存档。先导出原始数据备份；重置将删除此游戏的本地记录。</p><button id="export">导出原始存档</button><button id="repair" class="secondary">重置损坏存档</button></section>';
  root.querySelector("#export").onclick = exportSave;
  root.querySelector("#repair").onclick = () => {
    if (confirm("确定删除当前存档及历史？建议先导出备份。")) {
      session = freshSession();
      if (persist()) {
        blocked = false;
        locked = true;
        render();
      }
    }
  };
}
document.querySelector("#rules").onclick = () =>
  document.querySelector("#rulebook").showModal();
document.querySelector("#close-rules").onclick = () =>
  document.querySelector("#rulebook").close();
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !blocked && !session.game.ended) {
    locked = true;
    render();
  }
});
const backup = document.createElement("button");
backup.textContent = "导出存档备份";
backup.className = "backup secondary";
backup.onclick = () => {
  try {
    exportSave();
  } catch (e) {
    notice.textContent = e.message;
  }
};
document.querySelector("footer").before(backup);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("../service-worker.js").catch(() => {});
