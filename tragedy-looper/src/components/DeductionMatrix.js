import { name, esc } from "./shared.js";
export function DeductionMatrix(s, d) {
  return `<section class="panel"><div class="section-label">DEDUCTION / 跨轮回保留</div><h2>人物关系调查</h2><p class="muted">点击循环：未知 · 怀疑 · 排除 · 确认。这里是玩家笔记，不会改变角色的已公开身份。表格可横向滚动。</p><div class="table-scroll" tabindex="0" aria-label="身份推理矩阵"><table><thead><tr><th>角色</th>${d.roles.map((r) => `<th>${esc(r.name)}<small>${esc(r.nameEn)}</small></th>`).join("")}</tr></thead><tbody>${Object.keys(
    s.characters,
  )
    .map(
      (id) =>
        `<tr><th>${name(d, id)}</th>${d.roles
          .map((r) => {
            const v = s.deductions[id + ":" + r.id] || 0;
            return `<td><button class="deduction state-${v}" data-action="deduce" data-key="${id}:${r.id}" aria-label="${name(d, id)} ${r.name} ${["未知", "怀疑", "排除", "确认"][v]}">${["·", "?", "×", "✓"][v]}</button></td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div></section>`;
}
