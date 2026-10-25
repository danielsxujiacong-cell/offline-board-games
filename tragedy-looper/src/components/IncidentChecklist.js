import { incidentCheck, incidentTargets } from "../state/incidents.js";
import { name, esc, options } from "./shared.js";
export function IncidentChecklist(s, d) {
  const c = incidentCheck(s, d);
  if (!c.scheduled) return "<p>今日未安排事件。</p>";
  const result = s.incidentResults.find((i) => i.day === s.day);
  return `<section class="gm-section"><h3>事件：${name(d, c.incident)}</h3><ul class="checklist"><li>✓ 今天已安排事件</li><li>${c.alive ? "✓" : "×"} 真凶 ${name(d, c.culprit)} ${c.alive ? "存活" : "已死亡"}</li><li>${c.panicked ? "✓" : "×"} 不安达到阈值：${s.characters[c.culprit].paranoia} / ${d.characters.find((x) => x.id === c.culprit).paranoiaLimit}</li></ul><p>${esc(c.definition.effectDescription)}</p>${
    result
      ? `<p class="ok">已确认：${result.occurred ? (result.effective ? "发生并执行效果" : "发生，但效果未触发") : "未发生"}</p>`
      : `<form id="incident-form">${
          c.triggers
            ? `<p class="warning">基本条件满足。请核对额外效果条件、目标及死亡防护，再确认执行。</p>${["kill", "unease", "spreading"].includes(c.definition.effect.type) ? `<label>效果目标<select name="target"><option value="">请选择</option>${options(incidentTargets(s, d, c), d)}</select></label>` : ""}${
                ["unease", "spreading"].includes(c.definition.effect.type)
                  ? `<label>另一名角色（必须不同）<select name="secondTarget"><option value="">请选择</option>${options(
                      Object.keys(s.characters).filter(
                        (id) => s.characters[id].alive,
                      ),
                      d,
                    )}</select></label>`
                  : ""
              }${
                c.definition.effect.type === "missing"
                  ? `<label>移动地点<select name="destination">${options(
                      d.locations.map((l) => l.id),
                      d,
                    )}</select></label>`
                  : ""
              }${c.definition.effect.type === "hospital" ? `<p class="hint">医院密谋 ${s.locations.hospital.intrigue}：${s.locations.hospital.intrigue >= 2 ? "医院所有人及主人公死亡" : s.locations.hospital.intrigue === 1 ? "医院所有人死亡" : "事件发生但无效果"}</p>` : ""}`
            : "<p>基本触发条件未满足：事件不会发生。</p>"
        }${
          c.triggers &&
          ["kill", "hospital"].includes(c.definition.effect.type) &&
          s.characters["police-officer"]
            ? `<label>警察防止一次死亡（友好 5、同地点、每轮回一次）<select name="preventTarget"><option value="">不使用</option>${options(
                Object.keys(s.characters).filter(
                  (id) => s.characters[id].alive,
                ),
                d,
              )}</select></label>`
            : ""
        }<label class="check"><input type="checkbox" required> 我已核对条件及效果</label><button type="submit" class="primary">确认${c.triggers ? "事件与效果" : "事件不发生"}</button></form>`
  }</section>`;
}
