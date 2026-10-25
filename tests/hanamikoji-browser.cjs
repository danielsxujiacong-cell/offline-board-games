const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const context=await chromium.launchPersistentContext(path.join(root,'.openai/hanamikoji-browser'),{channel:'msedge',headless:true,viewport:{width:390,height:844}});
 try {
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_URL || 'http://127.0.0.1:8080';
 await page.goto(base+'/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
 await page.goto(base+'/games/hanamikoji/');
 assert.equal(await page.locator('[data-card]').count(),0);
 await page.locator('#accept').click();
 // New-game cancellation must preserve a live hand and the single automatic draw.
 const initial=await page.locator('[data-card]').count();
 page.once('dialog',d=>d.dismiss());await page.locator('#new').click();
 assert.equal(await page.locator('[data-card]').count(),initial);
 // Hiding the page gates the same hand without another draw.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('[data-card]').count(),0);await page.locator('#resume').click();
 assert.equal(await page.locator('[data-card]').count(),7);
 for(let i=0;i<8;i++){
  if(i)await page.locator('#accept').click();
  const action=['secret','discard','gift','compete'][Math.floor(i/2)];
  await page.locator(`[data-action="${action}"]`).click();
  for(let j=0;j<({secret:1,discard:2,gift:3,compete:4}[action]);j++)await page.locator('[data-card]').nth(j).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#commit').click();assert.equal(await page.locator('[data-card]').count(),0);
  if(action==='gift'||action==='compete'){
   assert.equal(await page.locator('[data-choice]').count(),0);
   await page.locator('#accept').click();assert.equal(await page.locator('[data-card]').count(),0);
   await page.locator('[data-choice="0"]').click();
  }
 }
 page.once('dialog',d=>d.dismiss());await page.locator('#settle').click();assert.equal(await page.locator('#settle').count(),1);
 page.once('dialog',d=>d.accept());await page.locator('#settle').click();assert.equal(await page.locator('#settle').count(),0);
 assert.match(await page.locator('.play h2').textContent(),/获胜|结算/);
 fs.mkdirSync(path.join(root,'.openai'),{recursive:true});
 await page.screenshot({path:path.join(root,'.openai/hanamikoji-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:900});
 page.once('dialog',d=>d.accept());await page.locator('#new').click();await page.locator('#accept').click();
 assert.equal(await page.locator('[data-card]').count(),7);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(root,'.openai/hanamikoji-desktop.png'),fullPage:true});
 // CDP Network Offline, retaining SW interception (the same setting as DevTools).
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 const entries=['',...Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/class="game[^"\n]*" href="\.\/([^"\n]+)"/g),m=>m[1])];
 assert.equal(entries.length,13);
 for(const entry of entries){const response=await page.goto(base+'/'+entry);assert.equal(response.status(),200);assert.ok(response.fromServiceWorker());if(entry)assert.notEqual(await page.title(),'Daniel 的桌游｜中文离线聚会桌游合集');console.log('OFFLINE OK',entry||'lobby');}
 assert.deepEqual(errors,[]);
 console.log('PASS: full round, privacy, confirmations, mobile/desktop, all 13 offline entries');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exit(1);});
