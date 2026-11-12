(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const storageKey = 'zhangnan-chat-v1';
  const maxHistory = 100;
  const scene = $('.scene');
  const questionInput = $('#question-input');
  const questionText = $('#question-text');
  const answerText = $('#answer-text');
  const form = $('#question-form');
  let turns = [];
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && saved.version === 1 && Array.isArray(saved.turns)) {
      turns = saved.turns.filter(turn => turn && typeof turn.question === 'string' && typeof turn.answer === 'string' && turn.question.length <= 180 && turn.answer.length <= 500).slice(-maxHistory);
    }
  } catch { storageAvailable = false; }
  const engine = ZhangnanEngine.createReplyEngine({ recent: turns.map(turn => turn.answer) });
  let queue = [];
  let processing = false;
  let session = 0;
  let composing = false;
  let compositionEnded = 0;
  let batch = 0;
  let toastTimer;
  let pokeTimer;

  function toast(text) {
    clearTimeout(toastTimer);
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, turns })); }
    catch { if (storageAvailable) toast('这台设备暂时存不下记录了，当前仍然可以聊。'); storageAvailable = false; }
  }
  function animateBubble(element) {
    element.classList.remove('just-arrived');
    void element.offsetWidth;
    element.classList.add('just-arrived');
  }
  function showQuestion(question) {
    questionText.textContent = question;
    $('#question-bubble').hidden = false;
    scene.classList.add('has-question');
    animateBubble($('#question-bubble'));
  }
  function setState(state, text) {
    scene.dataset.state = state;
    $('#state-text').textContent = text;
  }
  function updateCount() { $('#history-count').textContent = turns.length; }
  function updateQueueHint() {
    $('#composer-hint').textContent = queue.length ? `还有 ${queue.length} 个问题在排队` : processing ? '她正在认真组织语言…' : '认真提问 · 随缘长知识';
  }
  const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  async function processQueue() {
    if (processing) return;
    processing = true;
    const currentSession = session;
    while (queue.length && currentSession === session) {
      const question = queue.shift();
      showQuestion(question);
      setState('thinking', ZhangnanData.thinking[Math.floor(Math.random() * ZhangnanData.thinking.length)]);
      updateQueueHint();
      await pause(760 + Math.random() * 350);
      if (currentSession !== session) return;
      const { answer, category } = engine.answer(question);
      setState('speaking', '这句，确实很有道理。');
      answerText.textContent = '';
      animateBubble($('#answer-bubble'));
      for (const character of Array.from(answer)) {
        if (currentSession !== session) return;
        answerText.textContent += character;
        answerText.scrollTop = answerText.scrollHeight;
        await pause(33);
      }
      if (currentSession !== session) return;
      turns.push({ question, answer, category, time: Date.now() });
      turns = turns.slice(-maxHistory);
      save(); updateCount();
      if ($('#history-dialog').open) renderHistory();
      $('#answer-announcement').textContent = `张楠回答：${answer}`;
      await pause(450);
      if (currentSession !== session) return;
      setState('idle', '回答完毕。下一个问题？');
      if (queue.length) await pause(450);
    }
    if (currentSession === session) { processing = false; updateQueueHint(); }
  }
  function ask(raw) {
    const question = raw.trim().replace(/\s+/g, ' ');
    if (!question) { toast('先写点什么吧，空白也是有点太空白了。'); questionInput.focus(); return false; }
    if (Array.from(question).length > 180) { toast('问题短一点吧，180 字以内就好。'); return false; }
    if (queue.length >= 5) { toast('先等等她，还有好几个问题没认真想完。'); return false; }
    queue.push(question);
    if (processing) { toast('记住了，一个一个认真答。'); updateQueueHint(); }
    processQueue();
    return true;
  }
  function renderQuickQuestions() {
    const container = $('#quick-questions');
    container.replaceChildren();
    // Put the four approved core examples in the first batch.
    const batches = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]];
    for (const index of batches[batch]) {
      const item = ZhangnanData.classics[index];
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'quick-question';
      const mark = document.createElement('span'); mark.className = 'question-mark'; mark.textContent = item.mark; mark.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = item.question;
      button.append(mark, text); button.addEventListener('click', () => ask(item.question));
      container.append(button);
    }
  }
  function renderHistory() {
    const container = $('#history-list');
    container.replaceChildren();
    if (!turns.length) {
      const empty = document.createElement('p'); empty.className = 'history-empty';
      empty.textContent = '本本还是空的。\n问一个问题，就多一条废话。';
      container.append(empty); return;
    }
    for (const turn of turns) {
      const entry = document.createElement('article'); entry.className = 'history-turn';
      const question = document.createElement('div'); question.className = 'history-question';
      const questionLabel = document.createElement('small'); questionLabel.textContent = '你问';
      const questionBody = document.createElement('span'); questionBody.textContent = turn.question;
      question.append(questionLabel, questionBody);
      const answer = document.createElement('div'); answer.className = 'history-answer';
      const answerLabel = document.createElement('small'); answerLabel.textContent = '张楠答';
      const answerBody = document.createElement('span'); answerBody.textContent = turn.answer;
      answer.append(answerLabel, answerBody); entry.append(question, answer); container.append(entry);
    }
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
  }
  function openDialog(id) {
    questionInput.blur();
    if (id === 'history-dialog') renderHistory();
    $('#' + id).showModal();
  }
  $('#history-open').addEventListener('click', () => openDialog('history-dialog'));
  $('#reset-open').addEventListener('click', () => openDialog('reset-dialog'));
  for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $('#' + button.dataset.close).close());
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  $('#reset-confirm').addEventListener('click', () => {
    session++; queue = []; processing = false; turns = []; engine.reset(); save(); updateCount();
    $('#question-bubble').hidden = true; questionText.textContent = '';
    scene.classList.remove('has-question'); answerText.textContent = '新的一聊，开始了就算开始了。';
    $('#answer-announcement').textContent = ''; questionInput.value = ''; resizeInput();
    setState('idle', '在呢，重新问一个吧。'); updateQueueHint(); $('#reset-dialog').close();
    toast('翻篇了。现在是一个全新的现在。');
  });
  $('#shuffle').addEventListener('click', () => { batch = (batch + 1) % 3; renderQuickQuestions(); });
  $('#character').addEventListener('click', () => {
    clearTimeout(pokeTimer);
    $('#character').classList.remove('is-poked'); void $('#character').offsetWidth;
    $('#character').classList.add('is-poked');
    toast(ZhangnanData.pokes[Math.floor(Math.random() * ZhangnanData.pokes.length)]);
    pokeTimer = setTimeout(() => $('#character').classList.remove('is-poked'), 900);
  });
  function resizeInput() { questionInput.style.height = 'auto'; questionInput.style.height = Math.min(questionInput.scrollHeight, 88) + 'px'; }
  questionInput.addEventListener('input', resizeInput);
  questionInput.addEventListener('compositionstart', () => { composing = true; });
  questionInput.addEventListener('compositionend', () => { composing = false; compositionEnded = performance.now(); });
  questionInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229 && performance.now() - compositionEnded > 100) {
      event.preventDefault(); form.requestSubmit();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (composing) return;
    if (ask(questionInput.value)) { questionInput.value = ''; resizeInput(); }
  });
  $('#send-button').addEventListener('pointerdown', event => { if (document.activeElement === questionInput) event.preventDefault(); });

  // VisualViewport keeps the send action above keyboards that overlay the layout viewport.
  const viewport = window.visualViewport;
  let fullHeight = viewport ? viewport.height : innerHeight;
  function updateViewport() {
    const height = viewport ? viewport.height : innerHeight;
    if (document.activeElement !== questionInput) fullHeight = Math.max(fullHeight, height);
    const inset = viewport ? Math.max(0, innerHeight - height - viewport.offsetTop) : 0;
    document.documentElement.style.setProperty('--keyboard-inset', inset + 'px');
    document.documentElement.classList.toggle('keyboard-open', document.activeElement === questionInput && (fullHeight - height > 130 || height < 460));
  }
  viewport?.addEventListener('resize', updateViewport);
  viewport?.addEventListener('scroll', updateViewport);
  window.addEventListener('resize', updateViewport);
  questionInput.addEventListener('focus', updateViewport);
  questionInput.addEventListener('blur', updateViewport);
  window.addEventListener('orientationchange', () => { fullHeight = viewport ? viewport.height : innerHeight; updateViewport(); });
  function updateConnection() { $('#connection-label').textContent = navigator.onLine ? '离线也能聊' : '正在离线聊天'; }
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('../service-worker.js').catch(() => { /* The page also works without installation. */ });
  if (turns.length) {
    const last = turns.at(-1); showQuestion(last.question); answerText.textContent = last.answer;
    $('#state-text').textContent = '接着聊吧，我还在。';
  }
  renderQuickQuestions(); updateCount(); updateConnection(); updateViewport(); resizeInput();
})();
