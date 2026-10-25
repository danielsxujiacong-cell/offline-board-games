import {
  createGame,
  scriptFor,
  hand,
  lockSelection,
  reveal,
  changeCounter,
  canMove,
  resetLoop,
  record,
  copy,
} from "./state/game-state.js";
import { advance, phases } from "./state/phase-machine.js";
import {
  readSave,
  writeSave,
  SAVE_KEY,
  validateState,
} from "./state/persistence.js";
import { applyGroup } from "./state/resolution.js";
import {
  abilityTasks,
  abilityTargets,
  skillAvailable,
  useAbility,
} from "./state/abilities.js";
import { confirmIncident } from "./state/incidents.js";
import { killCharacter, confirmLoopEnd } from "./state/conditions.js";
import { LocationBoard } from "./components/LocationBoard.js";
import { CardSelection } from "./components/CardSelection.js";
import { ResolutionPanel } from "./components/ResolutionPanel.js";
import { DeductionMatrix } from "./components/DeductionMatrix.js";
import { GMMasterPanel } from "./components/GMMasterPanel.js";
import { name, esc, button } from "./components/shared.js";
const app = document.querySelector("#app"),
  dialog = document.querySelector("#gm-dialog");
let d,
  s,
  storageBlocked = false,
  gmUnlocked = false,
  tab = "board",
  setupScript = "the-first-script",
  setupLoops = 3,
  rawSave = null,
  pendingDeath = null;
const browserStorage = {
  getItem(key) {
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
};
function notify(message) {
  document.querySelector("#notice").textContent = message;
  document.querySelector("#notice").classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(
    () => document.querySelector("#notice").classList.remove("visible"),
    5500,
  );
}
function persist() {
  const error = writeSave(browserStorage, s);
  if (error) {
    storageBlocked = true;
    notify(error);
  }
  render();
}
function transact(fn) {
  const previous = copy(s);
  try {
    fn();
    persist();
    if (gmUnlocked && dialog.open) renderGM();
  } catch (e) {
    s = previous;
    notify(e.message);
  }
}
function intro() {
  const script = d.scripts.find((x) => x.id === setupScript);
  return `<section class="intro"><div class="intro-art" aria-hidden="true"><div class="moon"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="kanji">輪<br>廻</span><div class="skyline"></div><span class="red-line"></span><span class="timecode">04:44:00 / REPEAT</span></div><div class="intro-copy"><div class="eyebrow">A TIME-LOOP DEDUCTION GAME</div><h1>惨剧轮回<span>TRAGEDY LOOPER</span></h1><p class="intro-lead">昨天的悲剧，明天还会重演。<br>只有你们，记得发生过的一切。</p><p class="muted">1 位剧本之主 · 3 位主人公 · 单设备线下共玩<br>原版 First Steps，合作推理，逃离既定的命运。</p><form id="start-form"><label>选择官方教学剧本<select id="script-select">${d.scripts.map((x) => `<option value="${x.id}" ${x.id === setupScript ? "selected" : ""}>${esc(x.nameEn)} · ${esc(x.name)}</option>`).join("")}</select></label><div class="setup-meta"><span>${script.daysPerLoop} 天 / 轮回</span><span>6 名登场角色</span><span>无最终猜测</span></div><label>轮回次数<select id="loops-select">${script.loopOptions.map((v, i) => `<option value="${v}" ${v === setupLoops ? "selected" : ""}>${v} 轮回 · ${i ? "挑战难度" : "默认教学"}</option>`).join("")}</select></label><button type="submit" class="primary start">开启轮回 <span>→</span></button></form><p class="fine">自动保存在此浏览器 · 无服务器 · 无网络房间<br>建议 GM 先阅读原版规则与 Mastermind’s Handbook。</p></div></section>`;
}
function archive() {
  const script = scriptFor(s, d);
  return `<section class="panel"><div class="section-label">PUBLIC DOSSIER / 公开档案</div><h2>${esc(script.nameEn)}</h2><p>${s.loops} 轮回，每轮 ${script.daysPerLoop} 天。只使用 1 主线 + 1 支线，具体剧情及身份由 GM 保密。完整存活任意一轮且未触发失败条件即获胜；没有最终猜测。</p><h3>公开事件日程</h3>${script.incidents
    .map((i) => {
      const def = d.incidents.find((x) => x.id === i.incident);
      return `<details><summary>Day ${i.day} · ${name(d, i.incident)} <small>${esc(def.nameEn)}</small></summary><p>触发前提：真凶存活，且不安达到其角色阈值。真凶由 GM 保密。</p><p>${esc(def.effectDescription)}</p></details>`;
    })
    .join(
      "",
    )}<h3>角色与友好技能</h3><p class="hint">友好是需求，不是消耗。普通友好技能每天一次，每轮回一次技能另行记录。GM 可依真实身份拒绝，拒绝仍计为使用。</p>${script.characters
    .map((id) => {
      const c = d.characters.find((c) => c.id === id);
      return `<details><summary>${esc(c.name)} · ${esc(c.nameEn)} / 不安 ${c.paranoiaLimit}</summary><p>属性：${esc(c.tags.join(" / "))}；起点：${name(d, c.startLocation)}；禁止地点：${c.forbiddenLocations.map((l) => name(d, l)).join("、") || "无"}</p>${c.goodwillAbilities.map((a) => `<p>♥ ${a.goodwillRequired} ${esc(a.description)} ${a.oncePerLoop ? "每轮回一次。" : ""}</p>`).join("") || "<p>无友好技能。</p>"}</details>`;
    })
    .join(
      "",
    )}<h3>行动卡规则速查</h3>${d.actionCards.map((c) => `<details><summary>${esc(c.name)} <small>GM ×${c.copies.GM} / 每位主人公 ×${c.copies.protagonist}</small></summary><p>${esc(c.description)}</p><p>每轮回限制：GM ${c.oncePerLoop.GM ? "一次" : "无"}；主人公 ${c.oncePerLoop.protagonist ? "一次" : "无"}。各人按实体卡独立追踪。</p></details>`).join("")}<h3>First Steps 全部身份与候选剧情</h3><p class="hint">以下是整个规则集的公共规则，不表示本局分配。</p>${d.roles.map((r) => `<details><summary>${esc(r.name)} · ${esc(r.nameEn)}</summary><p>友好拒绝：${{ none: "无", optional: "可选", mandatory: "强制" }[r.goodwillRefusal]}</p>${r.abilities.map((a) => `<p>[${esc(phases.find((p) => p[0] === a.timing)?.[1] || a.timing)}] ${esc(a.description)}</p>`).join("") || "<p>无特殊身份技能。</p>"}</details>`).join("")}${d.plots.map((p) => `<details><summary>${p.kind === "main" ? "主线" : "支线"} · ${esc(p.nameEn)}</summary><p>身份：${p.addedRoles.map((id) => name(d, id)).join("、")}</p>${p.rules.map((a) => `<p>${esc(a.description)}</p>`).join("")}<p>${esc(p.creationNote)}</p></details>`).join("")}</section>`;
}
function stagePanel() {
  const phase = phases.find((p) => p[0] === s.phase)[1];
  if (s.phase === "selection") return CardSelection(s, d);
  if (s.phase === "cardResolve")
    return (
      ResolutionPanel(s, d) +
      `<div class="stage-continue">${button("结算完成，进入 GM 能力 →", "advance", 'class="primary"')}</div>`
    );
  if (s.phase === "finished")
    return `<section class="panel ending"><div class="eyebrow">${s.winner === "protagonists" ? "THE FUTURE IS YOURS" : "THE LOOP CLOSES"}</div><h2>${s.winner === "protagonists" ? "命运，终于改变。" : "悲剧，再次如期而至。"}</h2><p>${s.winner === "protagonists" ? "主人公在完整轮回中存活，逃离了惨剧。" : "主人公在全部轮回中失败，剧本之主获胜。First Steps 不进行最终猜测。"}</p>${button("查看公开历史", "tab", 'data-tab="log"')}${button("开始另一局", "new", 'class="quiet"')}</section>`;
  const hints = {
    loopStart:
      "核对初始位置、存活状态、计数器与轮回开始技能。保留上日移交后的领袖；原版轮回重置不另行移交。",
    morning: "新的一天开始。GM 核对本阶段条件，再开始两步选牌。",
    mastermindAbility: "由 GM 在暗箱核对身份与剧情能力，公开效果，不公开来源。",
    goodwillAbility: `P${s.leader} 是本日领袖。共同讨论使用友好能力，GM 核对拒绝规则并确认。`,
    incidentStep:
      "GM 核对今日是否有事件、真凶是否存活及不安阈值，再确认额外条件与目标。",
    leaderTransfer: `确认后，领袖由 P${s.leader} 顺时针移交给 P${(s.leader % 3) + 1}。`,
    dayEnd: "GM 检查夜间身份能力，先处理强制技能，再处理可选技能。",
    nextDay: "确认后进入下一天；最后一天后进入轮回结束检查。",
    loopEnd: s.failed
      ? `${s.protagonistsDead ? "主人公死亡，本轮回已失败。" : "本轮回已失败。"}请 GM 检查轮回结束效果并确认结果，再回溯或结束整局。`
      : "最后一天已完成。请 GM 检查主线、支线和身份的轮回结束条件。",
  };
  return `<section class="panel stage"><div><div class="section-label">CURRENT PHASE / 当前阶段</div><h2>${phase}</h2><p class="muted">${hints[s.phase] || ""}</p>${
    s.phase === "goodwillAbility"
      ? `<div class="goodwill-list">${abilityTasks(s, d)
          .map(
            ({ source, ability: a }) =>
              `<p>${name(d, source)} · ♥ ${a.goodwillRequired} · ${esc(a.description)} <small>${skillAvailable(s, source, a) ? "可申请" : "需求不足或已使用"}</small></p>`,
          )
          .join("")}</div>`
      : ""
  }</div>${["leaderTransfer", "nextDay"].includes(s.phase) ? button("确认并继续 →", "advance", 'class="primary"') : button("GM 核对并确认 →", "gm", 'class="primary"')}</section>`;
}
function logText(message) {
  let text = message;
  for (const x of [...d.characters, ...d.locations].sort(
    (a, b) => b.id.length - a.id.length,
  ))
    text = text.replaceAll(x.id, x.name);
  for (const [en, zh] of Object.entries({
    paranoia: "不安",
    goodwill: "友好",
    intrigue: "密谋",
  }))
    text = text.replaceAll(en, zh);
  return esc(text);
}
function render() {
  if (!d) return;
  document.querySelector("#gm-open").disabled = !s || (storageBlocked && !s);
  if (!s) {
    app.innerHTML = storageBlocked
      ? `<section class="panel recovery"><h1>存档需要处理</h1><p>原存档已保留，未覆盖。可能是损坏、版本不支持，或浏览器禁止本地存储。</p><pre>${esc(rawSave?.error || "")}</pre>${button("导出原始存档", "export-raw")}${button("确认清除旧档并重新开始", "clear-corrupt", 'class="quiet"')}<label>恢复有效 JSON 存档<input type="file" id="import-file" accept="application/json"></label></section>`
      : intro();
    return;
  }
  const script = scriptFor(s, d);
  app.innerHTML = `<section class="game-heading"><div><div class="eyebrow">TRAGEDY LOOPER / 惨剧轮回</div><h1>${esc(script.nameEn)}<small>${esc(script.name)}</small></h1></div><div class="time-status"><div><strong>${String(s.loop).padStart(2, "0")}</strong><span>/ ${s.loops} 轮回</span></div><div><strong>${String(s.day).padStart(2, "0")}</strong><span>/ ${script.daysPerLoop} 天</span></div><span class="leader">领袖 P${s.leader}</span></div></section>${storageBlocked ? '<p class="warning">存储失败，本页状态尚在内存。请立即导出存档。</p>' : ""}<nav class="phase-track" aria-label="每日阶段">${phases
    .filter((x) => x[0] !== "finished")
    .map(
      ([id, n]) =>
        `<span ${id === s.phase ? 'aria-current="step" class="active"' : ""}>${n}</span>`,
    )
    .join("")}</nav><nav class="tabs" aria-label="游戏面板">${[
    ["board", "舞台地图"],
    ["archive", "公开档案"],
    ["deduction", "身份推理"],
    ["log", "轮回记录"],
  ]
    .map(([id, label]) =>
      button(
        label,
        "tab",
        `data-tab="${id}" class="${tab === id ? "active" : ""}"`,
      ),
    )
    .join("")}<span class="save-state">● 自动保存</span></nav>${
    tab === "board"
      ? stagePanel() + LocationBoard(s, d)
      : tab === "archive"
        ? archive()
        : tab === "deduction"
          ? DeductionMatrix(s, d)
          : `<section class="panel"><div class="section-label">CHRONICLE / 发生过的事不会消失</div><h2>轮回记录</h2><ol class="history">${
              s.history
                .slice()
                .reverse()
                .map(
                  (e) =>
                    `<li><small>LOOP ${e.loop} / DAY ${e.day}</small><p>${logText(e.message)}</p></li>`,
                )
                .join("") || "<p>故事尚未开始。</p>"
            }</ol></section>`
  }<footer class="game-footer"><span>FIRST STEPS · 线下共玩 · 本地存档</span><div>${button("导出存档", "export", 'class="quiet"')}${button("新开一局", "new", 'class="quiet"')}</div></footer>`;
}
function renderGM() {
  dialog.innerHTML = GMMasterPanel(s, d);
}
function openGM(deathTarget = null) {
  pendingDeath = deathTarget;
  gmUnlocked = false;
  dialog.innerHTML = `<div class="dialog-top"><h2 id="gm-title">仅供剧本之主查看</h2>${button("关闭 ×", "close-gm", 'class="quiet"')}</div><div class="gate-symbol">◈</div><p>接下来会显示隐藏身份、剧情与真凶。<br>请确认其他玩家已移开视线。</p><p class="muted">此确认仅用于线下防误看，不构成安全权限。</p>${button("我是 GM，确认查看秘密", "unlock-gm", 'class="primary"')}`;
  dialog.showModal();
}
function closeGM() {
  gmUnlocked = false;
  dialog.close();
  dialog.innerHTML = "";
}
function exportJSON(value, filename) {
  const blob = new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function confirmStage() {
  const pending = abilityTasks(s, d, { secret: true }).filter(
    (t) =>
      t.ability.mandatory &&
      skillAvailable(s, t.source, t.ability) &&
      ((t.ability.effect.type === "kill" &&
        abilityTargets(s, d, t.source, t.ability).length) ||
        (t.ability.effect.type === "revealedGoodwill" &&
          s.publicRoles[t.source])),
  );
  if (pending.length) throw Error("还有满足条件的强制技能，请先确认执行");
  advance(s, d);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const action = b.dataset.action;
  if (b.id === "gm-open") {
    openGM();
    return;
  }
  if (!action) return;
  if (action === "gm") {
    openGM();
    return;
  }
  if (action === "close-gm") {
    closeGM();
    return;
  }
  if (action === "unlock-gm") {
    gmUnlocked = true;
    renderGM();
    if (pendingDeath) {
      const select = dialog.querySelector("#death-form select");
      select.value = pendingDeath;
      select.scrollIntoView({ block: "center" });
    }
    return;
  }
  if (action === "tab") {
    tab = b.dataset.tab;
    render();
    return;
  }
  if (action === "export") {
    exportJSON(s, "tragedy-looper-save.json");
    return;
  }
  if (action === "export-raw") {
    exportJSON(rawSave?.raw || "", "tragedy-looper-damaged-save.json");
    return;
  }
  if (action === "clear-corrupt") {
    if (confirm("将清除原存档。请先导出备份。确认清除？")) {
      try {
        localStorage.removeItem(SAVE_KEY);
        storageBlocked = false;
        rawSave = null;
        pendingDeath = null;
        render();
      } catch (e) {
        notify("浏览器不允许清除或访问 localStorage。");
      }
    }
    return;
  }
  if (action === "new") {
    if (confirm("新开一局将替换当前存档。确认继续？")) {
      closeGM();
      s = null;
      storageBlocked = false;
      render();
    }
    return;
  }
  if (action === "death") {
    openGM(b.dataset.target);
    return;
  }
  if (s?.winner && !["deduce", "publish-role"].includes(action)) {
    notify("牌局已经结束，请新开一局");
    return;
  }
  transact(() => {
    switch (action) {
      case "counter":
        changeCounter(
          s,
          b.dataset.target,
          b.dataset.counter,
          Number(b.dataset.delta),
        );
        break;
      case "lock":
        lockSelection(s, d, b.dataset.owner);
        break;
      case "reveal":
        reveal(s, d);
        break;
      case "resolve":
        applyGroup(s, d, b.dataset.target);
        break;
      case "manual-resolve":
        s.resolutionDone[b.dataset.target] = true;
        record(s, "GM 已确认一组卡牌手动结算");
        break;
      case "advance":
        if (!["cardResolve", "leaderTransfer", "nextDay"].includes(s.phase))
          throw Error("请由 GM 确认本阶段");
        advance(s, d);
        break;
      case "no-incident":
        if (!gmUnlocked) throw Error("需要 GM 确认");
        advance(s, d);
        closeGM();
        break;
      case "gm-advance":
        if (!gmUnlocked) throw Error("请先确认 GM 身份");
        confirmStage();
        closeGM();
        break;
      case "deduce":
        s.deductions[b.dataset.key] =
          ((s.deductions[b.dataset.key] || 0) + 1) % 4;
        break;
      case "publish-role":
        if (!gmUnlocked) throw Error("需要 GM 确认");
        if (confirm("确认将该角色真实身份公开给主人公？"))
          s.publicRoles[b.dataset.target] = scriptFor(s, d).roles[
            b.dataset.target
          ];
        break;
      case "loop-verdict":
        if (!gmUnlocked) throw Error("需要 GM 确认");
        confirmLoopEnd(s, d);
        break;
      case "reset-loop":
        if (!gmUnlocked) throw Error("需要 GM 确认");
        if (
          confirm(
            "确认进入下一轮回？计数器、卡牌及技能将重置，推理与公开身份保留。",
          )
        ) {
          resetLoop(s, d);
          closeGM();
        }
        break;
    }
  });
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.id === "script-select") {
    setupScript = el.value;
    setupLoops = d.scripts.find((x) => x.id === setupScript).defaultLoops;
    render();
    return;
  }
  if (el.id === "loops-select") {
    setupLoops = Number(el.value);
    return;
  }
  if (el.id === "import-file") {
    try {
      const restored = validateState(JSON.parse(await el.files[0].text()), d);
      s = restored;
      storageBlocked = false;
      persist();
    } catch (error) {
      notify("导入失败：" + error.message);
    }
    return;
  }
  if (el.dataset.choiceCard || el.dataset.choiceTarget) {
    const owner = el.dataset.choiceCard || el.dataset.choiceTarget,
      index = Number(el.dataset.index);
    transact(() => {
      if (s.locked[owner] || s.phase !== "selection")
        throw Error("已锁定，不能修改");
      if (owner === "GM" && !gmUnlocked) throw Error("请先打开 GM 暗箱");
      while (s.selection[owner].length <= index)
        s.selection[owner].push({ cardInstanceId: "", target: "" });
      s.selection[owner][index][
        el.dataset.choiceCard ? "cardInstanceId" : "target"
      ] = el.value;
    });
    return;
  }
  if (el.dataset.move)
    transact(() => {
      if (s.winner) throw Error("牌局已经结束");
      if (!canMove(s, d, el.dataset.move, el.value))
        throw Error("地点限制：移动不合法");
      s.characters[el.dataset.move].location = el.value;
      record(s, `${name(d, el.dataset.move)} 移动至 ${name(d, el.value)}`);
    });
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === "start-form") {
    try {
      s = createGame(d, setupScript, setupLoops);
      storageBlocked = false;
      persist();
    } catch (error) {
      notify(error.message);
    }
    return;
  }
  if (s?.winner) {
    notify("牌局已经结束");
    return;
  }
  const input = Object.fromEntries(new FormData(form));
  if (!gmUnlocked) {
    notify("需要 GM 确认");
    return;
  }
  transact(() => {
    if (form.id === "gm-cards") {
      lockSelection(s, d, "GM");
      closeGM();
    } else if (form.id === "incident-form") {
      confirmIncident(s, d, input);
    } else if (form.classList.contains("ability-form")) {
      const task = abilityTasks(s, d, { secret: true }).find(
        (t) =>
          t.source === form.dataset.source &&
          t.ability.id === form.dataset.skill,
      );
      if (!task) throw Error("技能已不可用");
      if (input.police) {
        const a = d.characters
          .find((c) => c.id === "police-officer")
          .goodwillAbilities.find((a) => a.effect.type === "preventDeath");
        if (!s.characters["police-officer"]) throw Error("本局没有警察");
        useAbility(s, d, "police-officer", a, { target: input.target });
      }
      const result = useAbility(s, d, task.source, task.ability, {
        ...input,
        prevent: !!input.police,
        delta: Number(input.delta),
        refuse: !!input.refuse,
      });
      notify(
        result === "refused" ? "技能被拒绝，已记录使用次数" : "技能效果已确认",
      );
    } else if (form.id === "death-form") {
      if (input.police) {
        const a = d.characters
          .find((c) => c.id === "police-officer")
          ?.goodwillAbilities.find((a) => a.effect.type === "preventDeath");
        if (!s.characters["police-officer"]) throw Error("本局没有警察");
        useAbility(s, d, "police-officer", a, { target: input.target });
        killCharacter(s, d, input.target, { prevent: true });
      } else killCharacter(s, d, input.target);
    }
  });
});
dialog.addEventListener("cancel", () => {
  gmUnlocked = false;
  dialog.innerHTML = "";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && dialog.open) closeGM();
});
window.addEventListener("pagehide", () => {
  if (dialog.open) closeGM();
});
async function boot() {
  try {
    const files = [
      "locations",
      "characters",
      "roles",
      "plots",
      "incidents",
      "action-cards",
      "scripts/the-first-script",
      "scripts/prevailing-secrecy",
    ];
    const values = await Promise.all(
      files.map(async (f) => {
        const r = await fetch(new URL(`./data/${f}.json`, import.meta.url));
        if (!r.ok) throw Error(`${f} 加载失败`);
        return r.json();
      }),
    );
    d = {
      locations: values[0],
      characters: values[1],
      roles: values[2],
      plots: values[3],
      incidents: values[4],
      actionCards: values[5],
      scripts: values.slice(6),
    };
    rawSave = readSave(browserStorage, d);
    s = rawSave.state;
    storageBlocked = !!rawSave.error;
    render();
    if (rawSave.error) notify(rawSave.error);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/service-worker.js")
        .catch(() => notify("离线缓存未就绪；本地存档仍可使用"));
  } catch (error) {
    app.innerHTML = `<section class="panel"><h1>档案暂时无法打开</h1><p>${esc(error.message)}</p><p>请用 HTTP(S) 打开本页，联网重试以载入完整离线资源。</p><button onclick="location.reload()">重新加载</button></section>`;
  }
}
boot();
