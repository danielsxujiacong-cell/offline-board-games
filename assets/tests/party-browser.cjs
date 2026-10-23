const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const data=vm.runInNewContext(fs.readFileSync('assets/party-data.js','utf8')+';PARTY_DATA');
for(const [key,min] of Object.entries({restrictions:25,topics:20,scripts:15,jobs:25,traits:60})){
 assert.ok(data[key].length>=min,key);assert.equal(new Set(data[key].map(x=>typeof x==='string'?x:x.title)).size,data[key].length);
}
assert.ok(data.scripts.every(x=>x.secretDetail.length>=75&&x.secretDetail.length<=150));
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const base=process.env.TEST_URL||'http://127.0.0.1:8097';
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 // CDN is optional: all functional and offline QA runs with it unavailable.
 await context.route('https://cdn.tailwindcss.com/**',r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 await page.goto(base+'/wasabi-roulette/');
 await page.clock.install();
 await click('deal');let poison=0;
 for(let i=1;i<=6;i++){
  assert.match(await page.locator('main').innerText(),new RegExp('请递给玩家 '+i));
  assert.doesNotMatch(await page.locator('main').innerText(),/你是中毒影帝|正常人|暗中执行/);
  await click('show');if((await page.locator('main').innerText()).includes('你是中毒影帝'))poison++;
  if(i===1){await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('[data-action="show"]').count(),1);await click('show');}
  await click('hide');
 }
 assert.equal(poison,1);await click('public');assert.equal(await page.locator('[data-clock]').innerText(),'03:00');
 await click('timer-toggle');await page.clock.runFor(2100);assert.equal(await page.locator('[data-clock]').innerText(),'02:58');await click('timer-toggle');await page.clock.runFor(3100);assert.equal(await page.locator('[data-clock]').innerText(),'02:58');await click('timer-reset');assert.equal(await page.locator('[data-clock]').innerText(),'03:00');await click('timer-toggle');await page.clock.runFor(180100);assert.equal(await page.locator('[data-clock]').innerText(),'00:00');assert.ok(await page.locator('[data-action="timer-toggle"]').isDisabled());await click('reveal');assert.match(await page.locator('main').innerText(),/玩家 [1-6] 是影帝/);await click('next');
 // Minimum and maximum player count preserve exactly one actor.
 for(const count of [4,10]){await page.locator('#players').fill(String(count));await click('deal');let n=0;for(let i=0;i<count;i++){await click('show');if((await page.locator('main').innerText()).includes('你是中毒影帝'))n++;await click('hide');}assert.equal(n,1);await page.click('#restart');await page.click('#confirm-restart');}
 await page.goto(base+'/two-faced/');await click('deal');let experts=0,bluffs=0;
 for(const actor of ['A','B']){
  await page.locator(`[data-actor="${actor}"]`).click();assert.doesNotMatch(await page.locator('main').innerText(),/你是真专家|你什么都不知道/);
  await click('show');const txt=await page.locator('main').innerText();if(txt.includes('你是真专家'))experts++;if(txt.includes('你什么都不知道'))bluffs++;
  // Partner cannot open another secret while one is displayed.
  const other=actor==='A'?'B':'A';if(actor==='A'){await page.locator(`[data-actor="${other}"]`).click();assert.equal(await page.locator('main').innerText(),txt);}
  await click('hide');assert.doesNotMatch(await page.locator('main').innerText(),/你是真专家|你什么都不知道/);
 }
 assert.equal(experts,1);assert.equal(bluffs,1);await click('public');await page.clock.runFor(1100);assert.equal(await page.locator('[data-clock]').innerText(),'02:59');for(let i=0;i<3;i++){await page.locator(`[data-question="${i}"]`).click();assert.equal(await page.locator(`[data-question="${i}"]`).getAttribute('aria-expanded'),'true');}await click('reveal');assert.match(await page.locator('main').innerText(),/演员 [AB] 是混子/);
 await page.goto(base+'/fun-employed/');const job=await page.locator('#job-preview').innerText();await click('job-refresh');assert.notEqual(await page.locator('#job-preview').innerText(),job);await click('deal');assert.equal(await page.locator('.applicant').count(),5);await click('resume');assert.equal(await page.locator('.chip').count(),3);assert.equal(new Set(await page.locator('.chip').allTextContents()).size,3);await click('reroll');await click('pitch');assert.equal(await page.locator('[data-clock]').innerText(),'00:45');await page.clock.runFor(40100);assert.equal(await page.locator('[data-clock]').innerText(),'00:05');assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('urgent')));await page.clock.runFor(5100);assert.equal(await page.locator('[data-clock]').innerText(),'00:00');assert.ok(!(await page.locator('body').evaluate(e=>e.classList.contains('urgent'))));await click('offer');assert.match(await page.locator('main').innerText(),/录用！/);assert.equal(await page.locator('.confetti').count(),1);await click('job-next');assert.equal(await page.locator('.applicant').count(),5);assert.equal(await page.locator('.chip').count(),0);
 await click('resume');await click('pitch');await page.clock.runFor(3100);await click('reroll');assert.equal(await page.locator('[data-clock]').innerText(),'00:42');await page.click('#restart');await page.click('#cancel-restart');assert.equal(await page.locator('.applicant').count(),5);await page.click('#restart');await page.click('#confirm-restart');assert.equal(await page.locator('#players').count(),1);
 await page.click('#sound');assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.goto(base+'/two-faced/');assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');await page.click('#sound');
 for(const width of [320,390,844]){await page.setViewportSize({width,height:width===844?390:844});for(const route of ['wasabi-roulette','two-faced','fun-employed']){await page.goto(base+'/'+route+'/');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow '+width);}}
 // Online install followed by genuine offline navigations for all existing and new games.
 await page.goto(base+'/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const routes=await page.locator('.game').evaluateAll(es=>es.map(e=>e.getAttribute('href')));assert.equal(routes.length,10);
 assert.ok(await page.evaluate(async()=>{const c=await caches.open('daniel-board-games-v10');return !!(await c.match('/assets/party.js'));}));
 await context.setOffline(true);
 for(const route of routes){await page.goto(new URL(route,base+'/').href);assert.ok(!await page.locator('.games').count(),'offline silently returned lobby: '+route);assert.ok((await page.locator('body').innerText()).length>20);}
 for(const route of ['wasabi-roulette','two-faced','fun-employed']){await page.goto(base+'/'+route+'/');await click('deal');assert.ok(await page.locator('main').innerText());}
 await page.goto(base+'/');assert.equal(await page.locator('.game').count(),10);
 assert.deepEqual(errors,[]);
 console.log('PASS: data quality, privacy, 4/6/10 players, timers, questions, offers, sound preference, 320/390/844 layouts and ten offline games');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

