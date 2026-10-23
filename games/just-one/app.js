'use strict';
const $ = id => document.getElementById(id);
const STORE = 'just-one-round-v1';
let cards = [], round = null, revealed = false, loading = false, request = 0;
let size = 96, clueHidden = false, clueValue = '';
let viewportFrame;
function parseCSV(text) {
  const rows = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => line.split(',').map(word => word.trim()));
  if (rows.shift()?.join(',') !== '词1,词2,词3,词4,词5' || rows.length < 13 || rows.some(row => row.length !== 5 || row.some(word => !word) || new Set(row).size !== 5)) throw new Error('题库格式不正确');
  return rows;
}
function shuffledIndices(length) {
  const indices = Array.from({length}, (_, i) => i);
  for (let i = length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  return indices.slice(0, 13);
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(round)); } catch {} }
function render() {
  $('words').replaceChildren();
  if (round) for (const word of cards[round.order[round.index]]) { const li = document.createElement('li'); li.textContent = word; $('words').append(li); }
  $('words').hidden = !revealed; $('cover').hidden = revealed;
  $('reveal').textContent = revealed ? '隐藏题卡' : '展示题卡';
  $('reveal').disabled = loading || !round; $('next').disabled = loading || !round || round.index === 12;
  if (round) { $('status').textContent = `第 ${round.index + 1} / 13 张 · ${$('difficulty').selectedOptions[0].textContent}${round.index === 12 ? ' · 最后一题，完成后可重新开局' : ''}`; $('progress').value = round.index + 1; }
}
async function load(resume = false) {
  const token = ++request, difficulty = $('difficulty').value;
  loading = true; round = null; revealed = false; render(); $('status').textContent = '正在加载题库…';
  try {
    const response = await fetch(`data/${difficulty}.csv`);
    if (!response.ok) throw new Error('加载失败');
    const loaded = parseCSV(await response.text());
    if (token !== request) return;
    cards = loaded;
    let stored; try { stored = JSON.parse(localStorage.getItem(STORE)); } catch {}
    const signature = JSON.stringify(cards);
    const valid = resume && stored?.difficulty === difficulty && stored.signature === signature && Number.isInteger(stored.index) && stored.index >= 0 && stored.index < 13 && Array.isArray(stored.order) && stored.order.length === 13 && new Set(stored.order).size === 13 && stored.order.every(i => Number.isInteger(i) && i >= 0 && i < cards.length);
    round = valid ? stored : {difficulty, signature, index:0, order:shuffledIndices(cards.length)};
    save();
  } catch { if (token === request) $('status').textContent = '题库加载失败，请检查网络或 CSV 格式，点击「重新开局」重试。'; }
  finally { if (token === request) { loading = false; render(); } }
}
function mode(board) { $('bank').hidden = board; $('board').hidden = !board; $('bank-tab').setAttribute('aria-pressed', !board); $('board-tab').setAttribute('aria-pressed', board); document.body.classList.toggle('board-mode', board); if (board) { window.scrollTo(0, 0); updateViewport(); } else { $('clue').blur(); document.body.classList.remove('board-compact'); } }
$('bank-tab').onclick = () => mode(false); $('board-tab').onclick = () => mode(true);
$('difficulty').onchange = () => load();
$('restart').onclick = () => { if (!round || confirm('重新随机抽取 13 张题卡？当前进度将被替换。')) load(); };
$('reveal').onclick = () => { revealed = !revealed; render(); };
$('next').onclick = () => { if (round && round.index < 12) { round.index++; revealed = false; save(); render(); } };
function fit() {
  const clue = $('clue'), measure = $('clue-measure');
  if (!clue.clientWidth || !clue.clientHeight) return;
  // A separate, invisible text measure avoids changing the value/caret during IME composition.
  measure.style.width = `${clue.clientWidth - 24}px`;
  measure.textContent = clue.value || clue.placeholder;
  if (measure.textContent.endsWith('\n')) measure.textContent += '\u200b';
  let pixels = clue.value ? size : Math.min(size, 40);
  measure.style.fontSize = `${pixels}px`;
  while (pixels > 24 && measure.getBoundingClientRect().height > clue.clientHeight - 16) {
    pixels -= 2; measure.style.fontSize = `${pixels}px`;
  }
  clue.style.fontSize = `${pixels}px`;
  const padding = Math.max(8, (clue.clientHeight - measure.getBoundingClientRect().height) / 2);
  clue.style.paddingTop = `${padding}px`; clue.style.paddingBottom = `${padding}px`;
}
function updateViewport() {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const root = document.documentElement.style;
    root.setProperty('--board-height', `${height}px`);
    root.setProperty('--board-width', `${viewport?.width ?? window.innerWidth}px`);
    root.setProperty('--board-top', `${viewport?.offsetTop ?? 0}px`);
    root.setProperty('--board-left', `${viewport?.offsetLeft ?? 0}px`);
    document.body.classList.toggle('board-compact', ! $('board').hidden && height < 310);
    fit();
  });
}
function showClue() {
  const clue = $('clue');
  clue.value = clueHidden ? '' : clueValue;
  clue.readOnly = clueHidden;
  clue.placeholder = clueHidden ? '已隐藏' : '点击这里写暗语';
  $('toggle').textContent = clueHidden ? '展示' : '隐藏';
  $('toggle').setAttribute('aria-pressed', String(clueHidden));
  fit();
}
$('clue').addEventListener('input', () => { clueValue = $('clue').value; fit(); });
$('clue').addEventListener('focus', updateViewport);
$('clue').addEventListener('blur', updateViewport);
$('clear').onclick = () => { clueValue = ''; clueHidden = false; showClue(); };
$('toggle').onclick = () => { $('clue').blur(); clueHidden = !clueHidden; showClue(); };
$('done').onclick = () => { $('clue').blur(); updateViewport(); };
$('board-back').onclick = () => mode(false);
$('larger').onclick = () => { size = Math.min(220, size + 16); fit(); };
$('smaller').onclick = () => { size = Math.max(24, size - 16); fit(); };
window.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
try { const stored = JSON.parse(localStorage.getItem(STORE)); if (['normal','hard','insane'].includes(stored?.difficulty)) $('difficulty').value = stored.difficulty; } catch {}
showClue(); load(true);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../../service-worker.js').catch(() => {});
