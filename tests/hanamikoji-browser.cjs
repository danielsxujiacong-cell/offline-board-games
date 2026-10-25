const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const profile=fs.mkdtempSync(path.join(root,'.openai/hanamikoji-acceptance-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const base=process.env.TEST_URL || 'http://127.0.0.1:8080';
 await context.addInitScript(()=>{let seed=1;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 const noOverflow=async p=>assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
 const tap=async(p,selector)=>{const el=p.locator(selector);await el.scrollIntoViewIfNeeded();await el.tap();};
 try {
  const page=await context.newPage();
  await page.goto(base+'/');
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;await reg.update();});
  const expectedCache=fs.readFileSync(path.join(root,'service-worker.js'),'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
  await page.waitForFunction(async name=>{const c=await caches.open(name);return !!(await c.match(new URL('/games/hanamikoji/app.js',location.href)));},expectedCache);
  await page.reload();
  // Real touch input in portrait and landscape, including the formerly clipped handoff.
  for(const [width,height] of [[320,568],[375,667],[390,844],[568,320],[667,375],[844,390],[768,1024],[1280,900]]){
   const p=await context.newPage();await p.setViewportSize({width,height});await p.goto(base+'/games/hanamikoji/');
   assert.equal(await p.locator('[data-card]').count(),0);await noOverflow(p);
   assert.equal(await p.locator('header').evaluate(e=>e.inert),true);
   await tap(p,'#accept');assert.equal(await p.locator('[data-card]').count(),7);
   assert.equal(await p.locator('#new').evaluate(e=>e.getBoundingClientRect().height>=44),true);
   const minWidth=width<=550?76:90;
   assert.equal(await p.locator('[data-card]').first().evaluate((e,n)=>e.getBoundingClientRect().width>=n,minWidth),true);
   await tap(p,'[data-action="compete"]');
   for(let i=0;i<4;i++){await p.locator('[data-card]').nth(i).scrollIntoViewIfNeeded();await p.locator('[data-card]').nth(i).tap();}
   assert.equal(await p.locator('[data-card][aria-pressed="true"]').count(),4);await noOverflow(p);
   assert.equal(await p.locator('[data-card] small').first().textContent(),'第 1 张 · 甲组');
   assert.equal(await p.locator('[data-card] small').last().textContent(),'第 4 张 · 乙组');
   if(width===320||width===390||width===1280)await p.screenshot({path:path.join(root,`.openai/hanamikoji-acceptance-${width}.png`),fullPage:true});
   await tap(p,'#commit');assert.equal(await p.locator('[data-card]').count(),0);await tap(p,'#accept');
   assert.equal(await p.locator('.choices .gift-art').count(),4);await noOverflow(p);
   for(const choice of await p.locator('[data-choice]').all())assert.equal((await choice.boundingBox()).height>=44,true);
   await tap(p,'[data-choice="1"]');assert.equal(await p.locator('[data-card]').count(),0);
   console.log(`TOUCH/LAYOUT OK ${width}x${height}`);await p.close();
  }
  await page.goto(base+'/games/hanamikoji/');await tap(page,'#accept');
  assert.equal(await page.locator('[data-card]').count(),7);
  const ids=await page.locator('[data-card]').evaluateAll(es=>es.map(e=>e.dataset.card));
  await tap(page,'[data-action="secret"]');await page.locator('[data-card]').first().tap();
  page.once('dialog',d=>d.dismiss());await tap(page,'#new');assert.equal(await page.locator('[aria-pressed="true"]').count(),1);
  // pagehide/BFCache-style privacy gate preserves hand, selected action and the already drawn card.
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.locator('[data-card]').count(),0);
  await tap(page,'#accept');assert.deepEqual(await page.locator('[data-card]').evaluateAll(es=>es.map(e=>e.dataset.card)),ids);
  assert.equal(await page.locator('[aria-pressed="true"]').count(),1);assert.match(await page.locator('.round').textContent(),/牌库 7 张/);
  // Switching actions and deselecting cannot leave an invalid commit enabled.
  await tap(page,'[data-action="discard"]');assert.equal(await page.locator('[aria-pressed="true"]').count(),0);assert.equal(await page.locator('#commit').isDisabled(),true);
  await tap(page,'[data-action="secret"]');await page.locator('[data-card]').first().tap();await page.locator('[data-card]').first().tap();assert.equal(await page.locator('#commit').isDisabled(),true);
  async function finishRound(firstAccepted=false){
   for(let i=0;i<8;i++){
    if(i||!firstAccepted)await tap(page,'#accept');
    const action=['secret','discard','gift','compete'][Math.floor(i/2)];
    const actor=Number((await page.locator('.play h2').textContent()).match(/玩家 (\d)/)[1])-1;
    await tap(page,`[data-action="${action}"]`);
    for(let j=0;j<({secret:1,discard:2,gift:3,compete:4}[action]);j++){await page.locator('[data-card]').nth(j).scrollIntoViewIfNeeded();await page.locator('[data-card]').nth(j).tap();}
    await tap(page,'#commit');assert.equal(await page.locator('[data-card]').count(),0);
    if(i===0){
     // At a handoff the previous actor can privately inspect only their own secret.
     await tap(page,`.curtain [data-review="${actor}"]`);assert.equal(await page.locator('.private-secret').count(),0);
     await tap(page,'#accept');assert.equal(await page.locator('.private-secret .card').count(),1);assert.equal(await page.locator('[data-card]').count(),0);
     await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});
     assert.equal(await page.locator('.private-secret').count(),0);await tap(page,'#accept');await tap(page,'#close-review');
     assert.equal(await page.locator('[data-card]').count(),0);
    }
    if(action==='gift'||action==='compete'){
     assert.equal(await page.locator('[data-choice]').count(),0);await tap(page,'#accept');assert.equal(await page.locator('[data-card]').count(),0);
     if(i===4){
      await tap(page,'[data-review="1"]');await tap(page,'#accept');assert.equal(await page.locator('.private-discard .card').count(),2);
      await tap(page,'#close-review');assert.equal(await page.locator('[data-choice]').count(),0);await tap(page,'#accept');
     }
     await tap(page,'[data-choice="0"]');assert.equal(await page.locator('[data-card]').count(),0);
    }
   }
   assert.match(await page.locator('.round').textContent(),/牌库 0 张/);
   page.once('dialog',d=>d.dismiss());await tap(page,'#settle');assert.equal(await page.locator('#settle').count(),1);
   page.once('dialog',d=>d.accept());await tap(page,'#settle');assert.equal(await page.locator('#settle').count(),0);
  }
  await finishRound(true);assert.equal(await page.locator('#next').count(),1,'seed 1 must exercise a genuine continuing round');
  const owners=await page.locator('.owner').allTextContents();await tap(page,'#next');
  assert.deepEqual(await page.locator('.owner').allTextContents(),owners);assert.match(await page.locator('.round').textContent(),/第 2 轮.*牌库 8 张 · 玩家 2 先手/);
  assert.equal(await page.locator('[data-card]').count(),0);
  for(let round=2;round<=12;round++){await finishRound();if(!await page.locator('#next').count())break;await tap(page,'#next');}
  assert.match(await page.locator('.play h2').textContent(),/获胜/);
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'重新开局',exact:true}).tap();assert.match(await page.locator('.play h2').textContent(),/获胜/);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'重新开局',exact:true}).tap();
  assert.match(await page.locator('.round').textContent(),/第 1 轮.*牌库 8 张/);assert.ok((await page.locator('.owner').allTextContents()).every(x=>x==='未倾心'));
  assert.equal(await page.locator('[data-card]').count(),0);await tap(page,'#accept');assert.equal(await page.locator('[data-card]').count(),7);
  console.log('GAMEPLAY OK: full multi-round game, private review, pagehide, cancelled/confirmed restart and scoring');
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  const entries=['',...Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/class="game[^"\n]*" href="\.\/([^"\n]+)"/g),m=>m[1])];
  for(const entry of entries){const response=await page.goto(base+'/'+entry);assert.equal(response.status(),200);assert.ok(response.fromServiceWorker());if(entry)assert.notEqual(await page.title(),'Daniel 的桌游｜中文离线聚会桌游合集');console.log('OFFLINE OK',entry||'lobby');}
  assert.deepEqual(errors,[]);console.log('PASS all Hanamikoji browser acceptance checks; zero page errors');
 }finally{
  await context.close();
  const safeRoot=path.resolve(root,'.openai')+path.sep;
  if(path.resolve(profile).startsWith(safeRoot)&&path.basename(profile).startsWith('hanamikoji-acceptance-'))fs.rmSync(profile,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exit(1);});
