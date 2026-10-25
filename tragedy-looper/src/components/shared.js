export const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const button = (label, action, extra = "") =>
  `<button data-action="${action}" ${extra}>${label}</button>`;
export const name = (d, id) =>
  esc(
    [
      ...d.characters,
      ...d.locations,
      ...d.roles,
      ...d.plots,
      ...d.incidents,
    ].find((x) => x.id === id)?.name || id,
  );
export const options = (ids, d, selected) =>
  ids
    .map(
      (id) =>
        `<option value="${id}" ${id === selected ? "selected" : ""}>${name(d, id)}</option>`,
    )
    .join("");
export const counterNames = {
  paranoia: "不安",
  goodwill: "友好",
  intrigue: "密谋",
};
export function counter(s, id, k, label) {
  const value = (s.characters[id] || s.locations[id])[k];
  return `<div class="counter ${k}"><span>${label}</span><div>${button("−", "counter", `data-target="${id}" data-counter="${k}" data-delta="-1" aria-label="${id} ${label}减少" ${value === 0 ? "disabled" : ""}`)}<strong>${value}</strong>${button("+", "counter", `data-target="${id}" data-counter="${k}" data-delta="1" aria-label="${id} ${label}增加"`)}</div></div>`;
}
