(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const rules = {
    word: '用上一词的尾字接下一个词，允许同音字；每次说一个，不要重复。',
    scene: '围绕题目场景，每人说一个符合要求的事物；同一轮不要重复。',
    brainstorm: '每人想一个符合题目条件的点子；能解释得通就算过，不要重复。'
  };
  const banks = new Map();
  let phase = 'loading', minimum = 15, maximum = 45, deadline = 0, duration = 0;
  let timer = null, lastTick = 0, lastCard = null, audio = null, sound = true;
  // Use both clocks: performance resists clock corrections; wall time includes device sleep.
  let monotonicDeadline = 0;
  const remaining = () => Math.min(deadline - Date.now(), monotonicDeadline - performance.now());
  function tone(frequency, length, gain = .12) {
    if (!sound || !audio || audio.state !== 'running') return;
    const now = audio.currentTime, oscillator = audio.createOscillator(), envelope = audio.createGain();
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + length);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + length);
  }
  function unlockAudio() {
    if (!sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audio && AudioContext) audio = new AudioContext();
      if (audio?.state === 'suspended') audio.resume().catch(() => {});
    } catch { /* Audio support is optional. */ }
  }
  function boom() {
    if (!sound || !audio || audio.state !== 'running') return;
    const length = audio.sampleRate * .7, buffer = audio.createBuffer(1, length, audio.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    const source = audio.createBufferSource(), envelope = audio.createGain(), filter = audio.createBiquadFilter();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1600; envelope.gain.value = .6;
    source.connect(filter).connect(envelope).connect(audio.destination); source.start(); tone(65, .65, .45);
  }
  function explode() {
    if (phase !== 'running') return;
    phase = 'exploded'; clearInterval(timer); timer = null;
    document.body.className = 'exploded';
    $('status').textContent = '💥 炸啦！手机在谁手里，就是谁！';
    $('hint').textContent = '喘口气，再把新的话题点燃。';
    $('action').textContent = '再来一轮';
    $('mode').disabled = $('difficulty').disabled = false;
    boom();
    try { navigator.vibrate?.([180, 80, 280]); } catch { /* Optional hardware. */ }
  }
  function check() {
    if (phase !== 'running') return;
    const left = remaining();
    if (left <= 0) { explode(); return; }
    const now = performance.now(), interval = Math.max(160, Math.min(850, left / Math.max(duration, 1) * 850));
    if (now - lastTick >= interval && !document.hidden) { tone(900, .045, .07); lastTick = now; }
  }
  function start() {
    const cards = banks.get(`${$('mode').value}-${$('difficulty').value}`);
    if (!cards?.length) return;
    unlockAudio();
    const candidates = cards.filter(card => card !== lastCard);
    const card = candidates[Math.floor(Math.random() * candidates.length)] || cards[0];
    lastCard = card; $('prompt').textContent = card.prompt;
    $('hint').textContent = $('mode').value === 'word' ? '从这个词开始接龙。允许同音字，不要重复。' : '每人说一个答案。合理就过，不要重复。';
    $('status').textContent = '引信燃烧中 · 说完就传！';
    $('action').textContent = '传给下家';
    $('mode').disabled = $('difficulty').disabled = true;
    duration = (minimum + Math.random() * (maximum - minimum)) * 1000;
    deadline = Date.now() + duration; monotonicDeadline = performance.now() + duration;
    phase = 'running'; document.body.className = 'running'; lastTick = -Infinity;
    clearInterval(timer); check();
    if (phase === 'running') timer = setInterval(check, 50);
  }
  $('action').addEventListener('click', () => {
    if (phase === 'running') {
      unlockAudio(); check();
      if (phase === 'running') { $('status').textContent = '递给下家！引信还在烧…'; tone(600, .06, .07); }
    } else if (phase === 'ready' || phase === 'exploded') start();
    else if (phase === 'error') load();
  });
  $('mode').addEventListener('change', () => { $('rule').textContent = rules[$('mode').value]; });
  $('sound').addEventListener('click', () => {
    sound = !sound; $('sound').textContent = `音效：${sound ? '开' : '关'}`;
    $('sound').setAttribute('aria-pressed', String(sound));
    if (sound) unlockAudio(); else if (audio?.state === 'running') audio.suspend().catch(() => {});
  });
  $('time-form').addEventListener('submit', event => {
    event.preventDefault();
    const min = Number($('min-time').value), max = Number($('max-time').value);
    if ($('min-time').value.trim() === '' || $('max-time').value.trim() === '' || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min || max > Number.MAX_SAFE_INTEGER / 1000) {
      $('time-status').textContent = '请输入有效秒数：最短时间 ≥ 0，最长时间 ≥ 最短时间。'; return;
    }
    minimum = min; maximum = max;
    $('range').textContent = `${min}～${max} 秒`;
    $('time-status').textContent = phase === 'running' ? '设置已应用，下轮使用新范围；当前引信保持原截止时间。' : '设置已应用，下一次点燃立即使用新范围。';
  });
  ['visibilitychange', 'pageshow', 'focus'].forEach(event => window.addEventListener(event, check));
  document.addEventListener('visibilitychange', check);
  async function load() {
    phase = 'loading'; $('action').disabled = true; $('action').textContent = '题库加载中…';
    try {
      await Promise.all(Object.keys(rules).flatMap(mode => ['normal', 'hard', 'extreme'].map(async difficulty => {
        const response = await fetch(`data/${mode}-${difficulty}.tsv`);
        if (!response.ok) throw new Error('题库请求失败');
        const lines = (await response.text()).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
        if (lines.shift() !== 'id\tprompt\texample') throw new Error('题库格式错误');
        const cards = lines.map(line => { const [id, prompt, example] = line.split('\t'); return {id, prompt, example}; });
        if (cards.length < 30 || cards.some(card => !card.id || !card.prompt || !card.example)) throw new Error('题库不完整');
        banks.set(`${mode}-${difficulty}`, cards);
      })));
      phase = 'ready'; $('action').textContent = '点燃引信';
    } catch {
      phase = 'error'; $('status').textContent = '题库加载失败，请联网后重试。'; $('action').textContent = '重试加载题库';
    }
    $('action').disabled = false;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js').catch(() => {});
  load();
})();
