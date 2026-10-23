const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true, channel:'msedge'});
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
 await page.click('#board-tab'); await page.fill('#clue','海风'); await page.click('button[type=submit]');
 assert.equal(await page.locator('#clue-text').textContent(),'海风');
 const before=await page.locator('#clue-text').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 await page.click('#larger'); assert.ok(await page.locator('#clue-text').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>before);
 await page.click('#smaller'); await page.click('#toggle'); assert.equal(await page.locator('#clue-text').textContent(),'已隐藏');
 await page.click('#toggle'); assert.equal(await page.locator('#clue-text').textContent(),'海风');
 await page.click('#edit'); assert.equal(await page.locator('#clue').isVisible(),true);
 await page.fill('#clue','一段很长很长的提示词用来验证手机上的换行和布局'); await page.click('button[type=submit]');
 await page.setViewportSize({width:844,height:390});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.waitForTimeout(100);
 assert.ok(await page.locator('#clear').evaluate(e=>e.getBoundingClientRect().bottom <= innerHeight), 'landscape controls fit screen');
 await page.screenshot({path:'outputs/just-one-landscape.png',fullPage:true});
 await page.click('#clear'); assert.equal(await page.inputValue('#clue'),'');
 await page.reload(); assert.equal(await page.inputValue('#clue'),'');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready; if(!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 const cached=await page.evaluate(async()=>{const c=await caches.open('daniel-board-games-v5');return (await c.keys()).map(r=>r.url);});
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
 console.log('PASS: 3 CSV loads; 13 unique cards; resume/restart/end; clue edit/resize/hide/clear; portrait/landscape; direct URL; SW v5; six offline entries and lobby return; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
