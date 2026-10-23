const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const mode of ['word','scene','brainstorm']) for (const level of ['normal','hard','extreme']) {
  const text=fs.readFileSync(path.join(root,'data',`${mode}-${level}.tsv`),'utf8');
  assert.equal(text.charCodeAt(0),0xfeff);
  const [header,...rows]=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
  assert.equal(header,'id\tprompt\texample'); assert.ok(rows.length>=30);
  assert.equal(new Set(rows.map(r=>r.split('\t')[1])).size,rows.length);
  for(const row of rows) { const cells=row.split('\t'); assert.equal(cells.length,3); assert.ok(cells.every(Boolean)); }
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.addInitScript(()=>{
      window.blasts=0;
      Object.defineProperty(navigator,'vibrate',{value:()=>{window.blasts++;return true;}});
    });
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const base=process.env.TEST_URL||'http://127.0.0.1:8080';
    await page.goto(base+'/pass-the-bomb/');
    await page.waitForFunction(()=>document.querySelector('#action').textContent==='点燃引信');
    await page.clock.install();
    const apply=async(min,max)=>{await page.fill('#min-time',String(min));await page.fill('#max-time',String(max));await page.click('#time-form button');};
    await apply(5,3); assert.match(await page.textContent('#time-status'),/最长时间/);
    assert.equal(await page.textContent('#range'),'15～45 秒');
    await apply(0,0);
    let previous='';
    for(const mode of ['word','scene','brainstorm']) for(const level of ['normal','hard','extreme']) {
      await page.selectOption('#mode',mode);await page.selectOption('#difficulty',level);
      await page.click('#action');assert.match(await page.textContent('#status'),/炸啦/);
      assert.equal(await page.textContent('#action'),'再来一轮');
      const prompt=await page.textContent('#prompt'); assert.ok(prompt && prompt!==previous); previous=prompt;
    }
    assert.equal(await page.evaluate(()=>blasts),9);
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.evaluate(()=>blasts),9);
    await apply(1,1); await page.click('#action');
    const first=await page.textContent('#prompt');
    await page.clock.runFor(650); await page.click('#action');
    assert.equal(await page.textContent('#prompt'),first);
    assert.equal(await page.locator('#mode').isDisabled(),true);
    // Changing settings during a round must not extend or resample the active deadline.
    await apply(30,60);await page.clock.runFor(400);
    assert.match(await page.textContent('#status'),/炸啦/);
    assert.equal(await page.evaluate(()=>blasts),10);
    await page.click('#action'); assert.notEqual(await page.textContent('#prompt'),first);
    // Emulate a suspended page: wall clock advances without timer delivery, then resume.
    await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+61000;document.dispatchEvent(new Event('visibilitychange'));});
    assert.match(await page.textContent('#status'),/炸啦/);
    assert.equal(await page.evaluate(()=>blasts),11);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));window.dispatchEvent(new Event('focus'));});
    assert.equal(await page.evaluate(()=>blasts),11);
    // Fixed random values prove each round samples the configured inclusive bounds.
    await apply(0,10);
    await page.evaluate(()=>{Math.random=()=>0;}); await page.click('#action');
    assert.match(await page.textContent('#status'),/炸啦/);
    await page.evaluate(()=>{Math.random=()=>.999;});await page.click('#action');
    await page.clock.runFor(9800);assert.equal(await page.textContent('#action'),'传给下家');
    await page.clock.runFor(250);assert.equal(await page.textContent('#action'),'再来一轮');
    await apply(.1,.1);await page.click('#action');await page.clock.runFor(150);
    assert.equal(await page.textContent('#action'),'再来一轮');
    await page.click('#sound');assert.equal(await page.getAttribute('#sound','aria-pressed'),'false');
    await page.click('#sound');assert.equal(await page.getAttribute('#sound','aria-pressed'),'true');
    fs.mkdirSync('outputs',{recursive:true});
    for(const [width,height] of [[320,568],[390,844],[844,390]]) {
      await page.setViewportSize({width,height});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(await page.locator('#action').isVisible());
      await page.screenshot({path:`outputs/pass-the-bomb-${width}.png`,fullPage:true});
    }
    await page.clock.uninstall?.();
    // A fresh page verifies the actual shared service worker and every offline entry.
    const offline=await context.newPage();await offline.goto(base+'/');
    await offline.evaluate(()=>navigator.serviceWorker.ready);
    await offline.waitForFunction(()=>navigator.serviceWorker.controller);
    const links=await offline.locator('a.game').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
    assert.equal(links.length,7);
    await context.setOffline(true);
    for(const link of links) {
      await offline.goto(new URL(link,base+'/').href);assert.ok(await offline.title());
      assert.notEqual(await offline.title(),'Daniel 的桌游',`Offline game must not fall back to lobby: ${link}`);
      assert.ok((await offline.locator('body').innerText()).trim().length>30);
    }
    await offline.goto(base+'/pass-the-bomb/');
    await offline.waitForFunction(()=>document.querySelector('#action').textContent==='点燃引信');
    await offline.fill('#min-time','0');await offline.fill('#max-time','0');await offline.click('#time-form button');
    await offline.click('#action');assert.match(await offline.textContent('#status'),/炸啦/);
    await offline.goto(base+'/');assert.equal(await offline.locator('a.game').count(),7);
    assert.deepEqual(errors,[]);
    console.log('PASS: 9 banks / 270 prompts; all modes; 0, decimal, random and fixed ranges; unchanged pass deadline; single explosion; resume; mobile layouts; seven offline entries.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
