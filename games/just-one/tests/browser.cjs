const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = process.env.TEST_BROWSER === 'webkit' ? await webkit.launch({headless:true}) : await chromium.launch({headless:true, channel:'msedge'});
 const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 const base=process.env.TEST_URL || 'http://127.0.0.1:8080';
 await page.goto(base+'/games/just-one/');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('1 / 13'));
 assert.equal(await page.locator('#words li').count(),5);
 assert.equal(await page.locator('#words').isVisible(),false);
 await page.click('#reveal'); assert.equal(await page.locator('#words').isVisible(),true);
 await page.click('#next'); assert.equal(await page.locator('#words').isVisible(),false);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('just-one-round-v1')));
 assert.equal(new Set(state.order).size,13); assert.equal(state.index,1);
 await page.reload(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('2 / 13'));
 assert.equal(await page.locator('#words').isVisible(),false);
 for (let i=0;i<11;i++) await page.click('#next');
 assert.equal(await page.locator('#next').isDisabled(),true);
 page.on('dialog',d=>d.accept()); await page.click('#restart');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('1 / 13'));
 for(const difficulty of ['hard','insane','normal']) {
   await page.selectOption('#difficulty',difficulty);
   await page.waitForFunction(d=>JSON.parse(localStorage.getItem('just-one-round-v1')).difficulty===d,difficulty);
   assert.equal(await page.locator('#words li').count(),5);
 }
 await page.screenshot({path:'outputs/just-one-portrait.png',fullPage:true});
 await page.click('#board-tab');
 assert.equal(await page.locator('textarea#clue').count(),1);
 await page.click('#clue'); await page.fill('#clue','海风');
 assert.equal(await page.inputValue('#clue'),'海风');
 assert.equal(await page.locator('#clue').evaluate(e=>e===document.activeElement),true);
 const before=await page.locator('#clue').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 await page.click('#larger'); assert.ok(await page.locator('#clue').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>before);
 await page.click('#smaller'); await page.click('#toggle');
 assert.equal(await page.inputValue('#clue'),'');
 assert.equal(await page.locator('#clue').getAttribute('placeholder'),'已隐藏');
 assert.equal(await page.locator('#clue').evaluate(e=>e.readOnly),true);
 await page.click('#toggle'); assert.equal(await page.inputValue('#clue'),'海风');
 // Direct editing preserves composition, line breaks, and the caret without swapping input surfaces.
 await page.click('#clue');
 await page.locator('#clue').evaluate(e=>{
   e.dispatchEvent(new CompositionEvent('compositionstart',{data:'独'}));
   e.value='独家暗语'; e.setSelectionRange(2,2);
   e.dispatchEvent(new InputEvent('input',{bubbles:true,data:'家',isComposing:true}));
   e.dispatchEvent(new CompositionEvent('compositionend',{data:'家'}));
 });
 assert.equal(await page.inputValue('#clue'),'独家暗语');
 assert.equal(await page.locator('#clue').evaluate(e=>e.selectionStart),2);
 await page.fill('#clue','海风\n独家暗语');
 await page.click('#done');
 assert.equal(await page.locator('#clue').evaluate(e=>e===document.activeElement),false);
 for(const [width,height] of [[844,390],[667,375],[568,320],[320,568],[844,180]]) {
   await page.setViewportSize({width,height});
   await page.waitForTimeout(80);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}x${height} overflow`);
   assert.ok(await page.locator('#clear').evaluate(e=>e.getBoundingClientRect().bottom <= visualViewport.height+visualViewport.offsetTop),`${width}x${height} controls fit`);
   assert.ok(await page.locator('#clue').evaluate(e=>e.clientHeight>40),`${width}x${height} input visible`);
 }
 await page.setViewportSize({width:844,height:390});
 await page.fill('#clue','一段很长很长的提示词用来验证手机上的换行和布局');
 await page.click('#done'); await page.waitForTimeout(80);
 await page.screenshot({path:'outputs/just-one-landscape.png',fullPage:true});
 await page.click('#clue');
 // Simulate iOS-style keyboard: visual viewport shrinks/pans while layout viewport stays unchanged.
 await page.evaluate(()=>{
   Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>160});
   Object.defineProperty(visualViewport,'offsetTop',{configurable:true,get:()=>60});
   visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll'));
 });
 await page.waitForTimeout(80);
 assert.equal(await page.locator('#clue').evaluate(e=>e===document.activeElement),true);
 assert.ok(await page.locator('#clue').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=60 && r.bottom<=220}),'input above keyboard');
 assert.ok(await page.locator('#clear').evaluate(e=>e.getBoundingClientRect().bottom<=220),'toolbar above keyboard');
 await page.fill('#clue','键盘中直接修改');
 await page.screenshot({path:'outputs/just-one-keyboard-simulated.png',fullPage:true});
 await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
 await page.click('#done'); await page.waitForTimeout(80);
 assert.ok(await page.locator('#display').evaluate(e=>e.getBoundingClientRect().height>220),'full board restored');
 assert.equal(await page.inputValue('#clue'),'键盘中直接修改');
 await page.click('#clear'); assert.equal(await page.inputValue('#clue'),'');
 await page.fill('#clue','刷新不保留');
 await page.click('#board-back'); await page.click('#board-tab');
 assert.equal(await page.inputValue('#clue'),'刷新不保留');
 await page.reload(); assert.equal(await page.inputValue('#clue'),'');
 if (process.env.TEST_BROWSER === 'webkit') {
   assert.deepEqual(errors,[]);
   console.log('PASS WebKit: CSV/13-card/resume flow; direct textarea, IME/caret, mobile viewport matrix, simulated keyboard pan/shrink/restore, hide/clear/resize. Offline suite runs separately on Chromium (Windows WebKit offline reload has an internal engine error).');
   await browser.close(); return;
 }
 await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject)=>setTimeout(()=>reject(new Error('Service Worker installation exceeded 120s')),120000))]); if(!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 const expectedCache=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../../service-worker.js'),'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
 const cached=await page.evaluate(async name=>{const c=await caches.open(name);return (await c.keys()).map(r=>r.url);},expectedCache);
 assert.ok(cached.some(u=>u.endsWith('/data/insane.csv')));
 await context.setOffline(true);
 await page.reload(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('/ 13'));
 for(const difficulty of ['hard','insane']) {await page.selectOption('#difficulty',difficulty);await page.waitForFunction(d=>JSON.parse(localStorage.getItem('just-one-round-v1')).difficulty===d,difficulty);}
 await page.getByRole('link',{name:'← 返回游戏大厅'}).click();
 await page.waitForURL(base+'/'); assert.equal(await page.getByRole('link',{name:/独家暗语/}).count(),1);
 for(const slug of ['fake-artist-new-york','fake-painter','pick-one-for-me','spyfall','werewords-companion','just-one']) {
   const response=await page.goto(base+'/games/'+slug+'/'); assert.equal(response.status(),200,slug);
   assert.ok((await page.title()).length>0,slug);
 }
 assert.deepEqual(errors,[]);
 await context.setOffline(false);
 console.log('PASS: 3 CSV loads; 13 unique cards; resume/restart/end; direct textarea/IME/resize/hide/clear; mobile portrait/landscape and simulated keyboard open/close; direct URL; current SW; six offline entries and lobby return; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
