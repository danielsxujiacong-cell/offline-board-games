import { esc, counter } from "./shared.js";
import { CharacterCard } from "./CharacterCard.js";
export function LocationBoard(s, d) {
  return `<div class="board">${d.locations
    .map(
      (l, i) =>
        `<section class="location location-${l.id}"><div class="location-heading"><div><small>0${i + 1} / ${esc(l.nameEn.toUpperCase())}</small><h2>${esc(l.name)}</h2></div><span class="location-icon" aria-hidden="true">${["✚", "⛩", "▥", "▤"][i]}</span>${counter(s, l.id, "intrigue", "地点密谋")}</div><div class="residents">${
          Object.keys(s.characters)
            .filter((id) => s.characters[id].location === l.id)
            .map((id) => CharacterCard(s, d, id))
            .join("") ||
          '<p class="empty">此刻，无人在场。<br><small>从角色卡的位置菜单移动至这里</small></p>'
        }</div></section>`,
    )
    .join("")}</div>`;
}
