import {
  hand,
  legalTarget,
  moveDestination,
  canMove,
} from "../state/game-state.js";
import { name, esc, button } from "./shared.js";
export function choiceRow(s, d, owner, index) {
  const choice = s.selection[owner][index] || {},
    cards = hand(d, owner),
    card = cards.find((c) => c.cardInstanceId === choice.cardInstanceId),
    sameSide =
      owner === "GM"
        ? s.selection.GM
        : Object.entries(s.selection)
            .filter(([o]) => o !== "GM")
            .flatMap(([, cs]) => cs);
  const usedTargets = sameSide
    .filter((c) => c !== s.selection[owner][index])
    .map((c) => c.target);
  const usedInstances = s.selection[owner]
    .filter((_, i) => i !== index)
    .map((c) => c.cardInstanceId);
  return `<div class="choice-row"><label>${owner === "GM" ? "行动 " + (index + 1) : owner + " 行动卡"}<select data-choice-card="${owner}" data-index="${index}" aria-label="${owner} 卡牌 ${index + 1}"><option value="">选择行动卡</option>${cards.map((c) => `<option value="${c.cardInstanceId}" ${choice.cardInstanceId === c.cardInstanceId ? "selected" : ""} ${s.usedCards.includes(c.cardInstanceId) || usedInstances.includes(c.cardInstanceId) ? "disabled" : ""}>${esc(c.name)}${c.copies[owner === "GM" ? "GM" : "protagonist"] > 1 ? " #" + c.cardInstanceId.split(":")[2] : ""}${c.limited ? " · 每轮回一次" : ""}${s.usedCards.includes(c.cardInstanceId) ? "（已用）" : ""}</option>`).join("")}</select></label><label>目标<select data-choice-target="${owner}" data-index="${index}" aria-label="${owner} 目标 ${index + 1}"><option value="">选择角色或地点</option>${[...Object.keys(s.characters), ...Object.keys(s.locations)].map((id) => `<option value="${id}" ${choice.target === id ? "selected" : ""} ${usedTargets.includes(id) || (card && !legalTarget(s, d, card, id)) ? "disabled" : ""}>${name(d, id)}${s.locations[id] ? " · 地点" : ""}${!s.characters[id]?.alive && s.characters[id] ? " · 尸体" : ""}</option>`).join("")}</select></label></div>${card && choice.target && s.locations[choice.target] && !card.locationEffective ? '<p class="hint">该目标合法，但本牌在地点上不产生效果。</p>' : ""}${card?.effect.type === "move" && s.characters[choice.target] && !canMove(s, d, choice.target, moveDestination(s.characters[choice.target].location, card.effect.direction)) ? '<p class="hint">此方向单独移动会进入禁止地点。最终按双方移动合并后判断，禁止地点则原地不动。</p>' : ""}`;
}
export function CardSelection(s, d) {
  return `<section class="panel selection"><div class="section-label">SIMULTANEOUS ACTION / 同屏秘密行动</div><h2>${!s.locked.GM ? "01 · 剧本之主秘密选牌" : "02 · 主人公共同选牌"}</h2>${!s.locked.GM ? `<p class="muted">GM 在独立暗箱选择三张卡，锁定后交给主人公共同讨论。</p>${button("打开 GM 秘密选牌", "gm", 'class="primary"')}` : `<p class="sealed">◈ GM 三张行动已封存 · 亮牌前保持隐藏</p><div class="protagonists">${["P1", "P2", "P3"].map((o, i) => `<article class="player-choice"><div class="player-title"><h3>${o}</h3><span>${s.leader === i + 1 ? "本日领袖" : s.locked[o] ? "已锁定" : "共同讨论"}</span></div>${s.locked[o] ? `<p>✓ ${name(d, s.selection[o][0].target)} · ${esc(hand(d, o).find((c) => c.cardInstanceId === s.selection[o][0].cardInstanceId)?.name)}</p>` : choiceRow(s, d, o, 0) + button("锁定 " + o, "lock", `data-owner="${o}"`)}</article>`).join("")}</div>${["P1", "P2", "P3"].every((o) => s.locked[o]) ? button("亮牌结算 →", "reveal", 'class="primary reveal"') : ""}`}</section>`;
}
