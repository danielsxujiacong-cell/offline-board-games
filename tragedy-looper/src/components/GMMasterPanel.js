import { scriptFor, hand } from "../state/game-state.js";
import {
  abilityTasks,
  abilityTargets,
  skillAvailable,
  skillKey,
} from "../state/abilities.js";
import { lossReasons } from "../state/conditions.js";
import { choiceRow } from "./CardSelection.js";
import { IncidentChecklist } from "./IncidentChecklist.js";
import { name, esc, options, button } from "./shared.js";
export function GMMasterPanel(s, d) {
  const script = scriptFor(s, d);
  return `<div class="dialog-top"><div><small>FOR MASTERMIND ONLY</small><h2 id="gm-title">剧本之主 · 暗箱</h2></div>${button("隐藏并关闭 ×", "close-gm", 'class="quiet"')}</div><p class="hint">此面板防止线下误看；本地数据及 PIN 不具备真正的数据安全权限。切换到后台或刷新会重新遮蔽。</p><section class="gm-section"><h3>本阶段待办</h3>${
    abilityTasks(s, d, { secret: true })
      .filter((t) => t.ability.timing !== "always")
      .map(({ source, ability: a }) => {
        const k = skillKey(source, a),
          available = skillAvailable(s, source, a),
          targets = abilityTargets(s, d, source, a);
        return `<form class="ability-form" data-source="${source}" data-skill="${a.id}"><h4>${name(d, source)} · ${a.mandatory ? "必须检查" : "可选"} ${a.goodwillRequired ? "♥ " + a.goodwillRequired : ""}</h4><p>${esc(a.description)}</p>${a.condition ? `<small>${esc(a.condition)}</small>` : ""}<p class="muted">${a.oncePerLoop ? "每轮回一次" : "每天一次"} · ${available ? "未使用" : s.usedSkills[k] ? "已使用" : "需求不满足"}</p>${a.effect.type === "counter" || a.effect.type === "kill" || a.effect.type === "reveal" || a.effect.type === "preventDeath" ? `<label>目标<select name="target"><option value="">请选择</option>${options(targets, d)}</select></label>` : ""}${a.effect.choice ? '<label>变化<select name="delta"><option value="-1">不安 −1</option><option value="1">不安 +1</option></select></label>' : ""}${
          a.effect.type === "revealCulprit"
            ? `<label>之前发生的事件<select name="incident">${options(
                s.incidentHistory
                  .filter((i) => i.occurred)
                  .map((i) => i.incident),
                d,
              )}</select></label>`
            : ""
        }${a.effect.type === "kill" ? '<label class="check"><input type="checkbox" name="police"> 使用同地点警察友好 5 防止此次死亡</label>' : ""}${a.timing === "goodwillAbility" ? '<label class="check"><input type="checkbox" name="refuse"> GM 根据真实身份拒绝（若允许）</label>' : ""}${a.effect.type === "preventDeath" ? "<p>请在死亡确认流程勾选防护，届时检查同地点及次数。</p>" : ["locationLoss", "friendDeath", "keyDeath"].includes(a.effect.type) ? "<p>请在下方轮回判定中统一确认。</p>" : `<button type="submit" ${!available ? "disabled" : ""}>确认使用技能</button>`}</form>`;
      })
      .join("") || "<p>没有本阶段可用技能。仍需检查所有强制条件。</p>"
  }${["loopStart", "morning", "mastermindAbility", "goodwillAbility", "dayEnd"].includes(s.phase) ? button("已核对本阶段技能，继续", "gm-advance", 'class="primary"') : ""}</section>${s.phase === "selection" ? `<section class="gm-section"><h3>秘密行动 · GM</h3>${!s.locked.GM ? `<form id="gm-cards">${[0, 1, 2].map((i) => choiceRow(s, d, "GM", i)).join("")}<button class="primary" type="submit">锁定 GM 出牌并隐藏</button></form>` : `<p class="sealed">三张卡已锁定</p>${s.selection.GM.map((c) => `<p>${esc(hand(d, "GM").find((x) => x.cardInstanceId === c.cardInstanceId)?.name)} → ${name(d, c.target)}</p>`).join("")}`}</section>` : ""}${s.phase === "incidentStep" ? IncidentChecklist(s, d) + (s.incidentResults.some((i) => i.day === s.day) ? button("事件确认完成，继续", "no-incident", 'class="primary"') : !script.incidents.some((i) => i.day === s.day) ? button("确认无事件，继续", "no-incident", 'class="primary"') : "") : ""}${s.phase === "loopEnd" ? `<section class="gm-section"><h3>轮回结束 · GM 判定</h3><p>${lossReasons(s, d, { loopEnd: true }).map(esc).join("、") || "没有触发失败条件；若完整经历最后一天，主人公获胜。"}</p>${!s.loopEndChecked ? button("核对并确认本轮回胜负", "loop-verdict", 'class="primary"') : button("确认回溯到下一轮回", "reset-loop", 'class="primary"')}</section>` : ""}<details class="gm-section"><summary>隐藏真相 · 本局完整资料</summary><p>主线 ${name(d, script.mainPlot)} / 支线 ${name(d, script.subplot)}</p><h3>真实身份</h3>${Object.entries(
    script.roles,
  )
    .map(
      ([id, role]) =>
        `<div class="truth-row"><span>${name(d, id)} → <b>${name(d, role)}</b> <small>友好拒绝：${{ none: "无", optional: "可选", mandatory: "强制" }[d.roles.find((r) => r.id === role).goodwillRefusal]}</small></span>${button(s.publicRoles[id] ? "已公开" : "公开身份", "publish-role", `data-target="${id}" ${s.publicRoles[id] ? "disabled" : ""}`)}<p>${
          d.roles
            .find((r) => r.id === role)
            .abilities.map((a) => esc(a.description))
            .join("<br>") || "无身份技能"
        }</p></div>`,
    )
    .join(
      "",
    )}<h3>事件真凶</h3>${script.incidents.map((i) => `<p>Day ${i.day} · ${name(d, i.incident)} → ${name(d, i.culprit)}</p>`).join("")}<h3>胜负条件</h3><p>关键人物死亡立即失败；主人公死亡立即失败。完整轮回未失败则主人公获胜；全部轮回失败则 GM 获胜。无最终猜测。</p>${[
    script.mainPlot,
    script.subplot,
  ]
    .map((id) =>
      d.plots
        .find((p) => p.id === id)
        .rules.map((a) => `<p>${esc(a.description)}</p>`)
        .join(""),
    )
    .join(
      "",
    )}<p>杀手：日终同地关键人物至少 2 密谋可杀死；自身至少 4 密谋可杀死主人公。连环杀手：日终同地恰好一名其他存活角色，必须杀死。</p></details><section class="gm-section"><h3>人工死亡与防护确认</h3><form id="death-form"><label>角色<select name="target">${options(
    Object.keys(s.characters).filter((id) => s.characters[id].alive),
    d,
  )}</select></label><label class="check"><input type="checkbox" name="police"> 使用警察友好 5 防止本次死亡（同地点、每轮回一次；GM 核对拒绝规则）</label><button type="submit">确认死亡／防止死亡</button></form></section><section class="gm-section"><h3>初始布局</h3><p>${Object.entries(
    s.initialLayout,
  )
    .map(([id, l]) => name(d, id) + " → " + name(d, l))
    .join(
      "；",
    )}</p><p class="muted">按原版角色卡印刷起点初始化，每次回溯恢复此布局。</p></section>`;
}
