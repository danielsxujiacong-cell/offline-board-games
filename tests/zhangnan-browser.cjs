const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.TEST_OUTPUT_DIR || path.join(root, '.openai/zhangnan'));
fs.mkdirSync(out, { recursive: true });
const base = (process.env.TEST_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const expectedCache = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
const launchOptions = process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : process.platform === 'linux' ? { executablePath: '/usr/bin/chromium' } : { channel: 'msedge' };

(async () => {
  const browser = await chromium.launch({ ...launchOptions, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const page = await context.newPage();
  const waitIdle = async (count) => {
    await page.waitForFunction(n => document.querySelector('#history-count').textContent === String(n) && document.querySelector('.scene').dataset.state === 'idle', count, { timeout: 30000 });
  };
  const input = page.locator('#question-input');
  async function send(question) { await input.fill(question); await page.locator('#send-button').click(); }
  async function clickQuick(question) {
    const button = page.getByRole('button', { name: question, exact: true });
    for (let batch = 0; batch < 5; batch++) {
      if (await button.count()) { await button.click(); return; }
      await page.locator('#shuffle').click();
    }
    throw new Error('Quick question is missing: ' + question);
  }
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow');
  const reset = async () => { await page.locator('#reset-open').click(); await page.locator('#reset-confirm').click(); };
  try {
    await page.goto(base + '/');
    assert.equal(await page.locator('a[href="./zhangnan/"]').count(), 1);
    await page.locator('a[href="./zhangnan/"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.quick-question').length === 4);
    assert.match(await page.title(), /张楠问答/);
    assert.equal(await page.locator('.home-link').getAttribute('href'), '../');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#character img')).every(img => img.complete && img.naturalWidth > 0), null, { timeout: 30000 });
    assert.equal(await page.locator('#character img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)), true);
    await noOverflow();

    await send('   ');
    assert.match(await page.locator('#toast').textContent(), /先写点什么/);
    assert.equal(await page.locator('#history-count').textContent(), '0');
    await input.fill('你在干什么？');
    await input.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '你' })));
    await input.press('Enter');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.scene').getAttribute('data-state'), 'idle');
    await input.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你在干什么？' })));
    await input.press('Enter');
    assert.equal(await page.locator('.scene').getAttribute('data-state'), 'idle');
    await page.waitForTimeout(150);
    await input.press('Enter');
    await waitIdle(1);
    assert.equal(await page.locator('#answer-text').textContent(), '我在做我现在做的事。');
    console.log('PASS empty input and Chinese IME composition/confirmation');

    await page.getByRole('button', { name: '这香蕉是什么味道？', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.scene').dataset.state === 'thinking');
    await page.waitForTimeout(400);
    const transform = await page.locator('.head-layer').evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(transform, 'none');
    assert.notEqual(transform, 'matrix(1, 0, 0, 1, 0, 0)');
    await page.screenshot({ path: path.join(out, 'thinking-mobile.png') });
    await page.waitForFunction(() => document.querySelector('.scene').dataset.state === 'speaking');
    assert.equal(await page.locator('.talk-art').evaluate(el => getComputedStyle(el).animationName), 'talk');
    await page.locator('.talk-art').evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 50; });
    assert.equal(await page.locator('.talk-art').evaluate(el => Number(getComputedStyle(el).opacity)), 1);
    await page.screenshot({ path: path.join(out, 'talking-mobile.png') });
    await waitIdle(2);
    assert.equal(await page.locator('#answer-text').textContent(), '就是香蕉味。');
    await page.locator('#character').click();
    assert.equal(await page.locator('#character').evaluate(el => el.classList.contains('is-poked')), true);
    await page.locator('.blink-art').evaluate(el => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 2640; });
    assert.equal(await page.locator('.blink-art').evaluate(el => Number(getComputedStyle(el).opacity)), 1);
    await page.waitForTimeout(950);
    await page.screenshot({ path: path.join(out, 'blink-mobile.png') });
    await page.locator('.blink-art').evaluate(el => el.getAnimations()[0].play());
    console.log('PASS actual blink and talking layers, head tilt and tap response');

    for (const question of ['怎么才能早起？', '我的手机在哪里？', '明天会下雨吗？']) await send(question);
    await waitIdle(5);
    await page.locator('#history-open').click();
    assert.equal(await page.locator('.history-turn').count(), 5);
    assert.match(await page.locator('.history-turn').nth(2).textContent(), /早起/);
    assert.match(await page.locator('.history-turn').nth(3).textContent(), /手机/);
    assert.match(await page.locator('.history-turn').nth(4).textContent(), /明天.*雨/);
    await page.screenshot({ path: path.join(out, 'history-mobile.png') });
    await page.locator('[data-close="history-dialog"]').first().click();
    await page.reload();
    await waitIdle(5);
    assert.equal(await page.locator('#question-text').textContent(), '明天会下雨吗？');
    const durations = await page.locator('#character').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.effect.getTiming().duration).sort());
    assert.deepEqual(durations, [4800, 6000]);
    console.log('PASS three rapid sends, ordered history, reload and constant animation count/duration');

    await page.locator('#reset-open').click();
    await page.locator('[data-close="reset-dialog"]').click();
    assert.equal(await page.locator('#history-count').textContent(), '5');
    await send('这是一条即将被清空的问题');
    await reset();
    await send('你为什么这么说？');
    await waitIdle(1);
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#answer-text').textContent(), '因为我是这么想的。');
    assert.equal(await page.locator('#history-count').textContent(), '1');
    assert.equal(await page.locator('#question-text').textContent(), '你为什么这么说？');
    await reset(); await page.reload(); await waitIdle(0);
    console.log('PASS cancelled reset, in-flight reset cancellation and cleared persisted history');

    for (const [index, question, expected] of [
      [1, '牛奶多少钱？', '114514元。'],
      [2, '那面包呢？', '114514元。'],
      [3, '为什么这么贵？', '因为不便宜。']
    ]) {
      await send(question); await waitIdle(index);
      assert.equal(await page.locator('#answer-text').textContent(), expected);
    }
    await page.reload(); await waitIdle(3);
    for (const [index, question, expected] of [
      [4, '那蛋糕呢？', '114514元。'],
      [5, '你刚才说什么？', '114514元。'],
      [6, '你几岁？', '114514岁。'],
      [7, '那体重呢？', '114514斤。'],
      [8, '我好累。', '累了就是累了。']
    ]) {
      await send(question); await waitIdle(index);
      assert.equal(await page.locator('#answer-text').textContent(), expected);
    }
    await send('那面包呢？'); await waitIdle(9);
    assert.doesNotMatch(await page.locator('#answer-text').textContent(), /114514/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zhangnan-chat-v1')));
    assert.equal(saved.version, 1);
    assert.equal(saved.turns.length, 9);
    assert.ok(saved.turns.every(turn => Array.from(turn.answer).length <= 20));
    await reset();
    await send('你刚才说什么？'); await waitIdle(1);
    assert.equal(await page.locator('#answer-text').textContent(), '刚才还没说。');
    await send('那面包呢？'); await waitIdle(2);
    assert.doesNotMatch(await page.locator('#answer-text').textContent(), /114514/);
    for (const [index, question] of [[3, '你到底是谁？'], [4, '你哪位？']]) {
      await send(question); await waitIdle(index);
      assert.equal(await page.locator('#answer-text').textContent(), '我是你爹。');
    }
    await send('牛奶贵不贵？'); await waitIdle(5);
    assert.equal(await page.locator('#answer-text').textContent(), '贵就是贵。');
    await page.screenshot({ path: path.join(out, 'short-replies-mobile.png') });
    await reset();
    console.log('PASS fixed jokes, units, intent, contextual follow-ups, refresh, topic switch and reset');

    const firstBatch = await page.locator('#quick-questions').textContent();
    await page.locator('#shuffle').click(); assert.notEqual(await page.locator('#quick-questions').textContent(), firstBatch);
    await send('<img src=x onerror=alert(1)>'); await waitIdle(1);
    assert.equal(await page.locator('#question-bubble img').count(), 0);
    assert.equal(await page.locator('#question-text').textContent(), '<img src=x onerror=alert(1)>');
    await send('我想问一个很长的问题'.repeat(9)); await waitIdle(2); await noOverflow();
    await reset();
    await clickQuick('今天吃什么？'); await waitIdle(1);
    console.log('PASS functional shuffle, safe plain text and long questions');

    for (const [width, height] of [[320,568], [390,844], [768,1024], [1440,1000], [844,390]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      await noOverflow();
      const sendBounds = await page.locator('#send-button').boundingBox();
      assert.ok(sendBounds.x >= 0 && sendBounds.x + sendBounds.width <= width && sendBounds.y + sendBounds.height <= height, 'send action within viewport');
      await page.screenshot({ path: path.join(out, `page-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await input.focus();
    await page.setViewportSize({ width: 390, height: 420 });
    await page.waitForTimeout(100);
    assert.ok(await page.locator('#send-button').evaluate(el => el.getBoundingClientRect().bottom <= visualViewport.height + visualViewport.offsetTop));
    await input.fill('怎么才能早起？'); await input.press('Enter'); await waitIdle(2);
    await page.setViewportSize({ width: 390, height: 844 }); await input.blur();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.character-breathe').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('PASS 320/390/768/1440/landscape layout, simulated keyboard resize and reduced motion');

    await page.goto(base + '/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(async name => { const cache = await caches.open(name); return Boolean(await cache.match(new URL('/zhangnan/assets/blink.webp', location.href))); }, expectedCache);
    const entries = await page.locator('a.game').evaluateAll(links => links.map(link => new URL(link.href).pathname));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    for (const entry of ['/', ...entries]) {
      const response = await page.goto(base + entry);
      assert.equal(response.status(), 200, entry);
      assert.ok(response.fromServiceWorker(), entry);
      if (entry !== '/') assert.notEqual(await page.title(), 'Daniel 的桌游｜中文离线聚会桌游合集', entry);
      console.log('OFFLINE OK', entry);
    }
    await page.goto(base + '/zhangnan/');
    await reset();
    await clickQuick('这香蕉是什么味道？'); await waitIdle(1);
    assert.equal(await page.locator('#answer-text').textContent(), '就是香蕉味。');
    await page.reload(); await waitIdle(1);
    await send('牛奶多少钱？'); await waitIdle(2);
    assert.equal(await page.locator('#answer-text').textContent(), '114514元。');
    await page.reload(); await waitIdle(2);
    await send('那面包呢？'); await waitIdle(3);
    assert.equal(await page.locator('#answer-text').textContent(), '114514元。');
    await send('你是谁？'); await waitIdle(4);
    assert.equal(await page.locator('#answer-text').textContent(), '我是你爹。');
    await page.locator('.home-link').click(); assert.match(await page.title(), /Daniel 的桌游/);
    assert.deepEqual(errors, []);
    console.log(`PASS all acceptance checks; lobby + ${entries.length} real offline entries; zero page errors`);
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
