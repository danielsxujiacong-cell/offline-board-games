'use strict';
const $ = id => document.getElementById(id);
const STORE = 'just-one-round-v1';
let cards = [], round = null, revealed = false, loading = false, request = 0;
let size = 96, clueHidden = false;
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
function mode(board) { $('bank').hidden = board; $('board').hidden = !board; $('bank-tab').setAttribute('aria-pressed', !board); $('board-tab').setAttribute('aria-pressed', board); document.body.classList.toggle('board-mode', board); if (board) fit(); }
$('bank-tab').onclick = () => mode(false); $('board-tab').onclick = () => mode(true);
$('difficulty').onchange = () => load();
$('restart').onclick = () => { if (!round || confirm('重新随机抽取 13 张题卡？当前进度将被替换。')) load(); };
$('reveal').onclick = () => { revealed = !revealed; render(); };
$('next').onclick = () => { if (round && round.index < 12) { round.index++; revealed = false; save(); render(); } };
function fit() {
  const display = $('display'), text = $('clue-text');
  if (!display.clientWidth) return;
  let pixels = size;
  text.style.fontSize = `${pixels}px`;
  while (pixels > 18 && (text.getBoundingClientRect().height > display.clientHeight - 32 || text.getBoundingClientRect().width > display.clientWidth - 16)) {
    pixels -= 2; text.style.fontSize = `${pixels}px`;
  }
}
function showClue() { $('clue-text').textContent = clueHidden ? '已隐藏' : ($('clue').value.trim() || '等待你的暗语'); $('toggle').textContent = clueHidden ? '展示' : '隐藏'; fit(); }
$('editor').onsubmit = event => { event.preventDefault(); if (!$('clue').value.trim()) { $('clue').focus(); return; } clueHidden = false; $('clue').blur(); $('editor').hidden = true; showClue(); };
$('edit').onclick = () => { $('editor').hidden = false; $('clue').focus(); };
$('clear').onclick = () => { $('clue').value = ''; clueHidden = false; $('editor').hidden = false; showClue(); $('clue').focus(); };
$('toggle').onclick = () => { clueHidden = !clueHidden; if (clueHidden) { $('editor').hidden = true; $('clue').blur(); } showClue(); };
$('larger').onclick = () => { size = Math.min(220, size + 16); fit(); }; $('smaller').onclick = () => { size = Math.max(24, size - 16); fit(); };
window.addEventListener('resize', fit);
try { const stored = JSON.parse(localStorage.getItem(STORE)); if (['normal','hard','insane'].includes(stored?.difficulty)) $('difficulty').value = stored.difficulty; } catch {}
showClue(); load(true);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../../service-worker.js').catch(() => {});
