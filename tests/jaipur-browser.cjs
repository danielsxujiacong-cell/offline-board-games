const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8080';
const context=await chromium.launchPersistentContext(path.join(root,'.openai/jaipur-browser'),{channel:'msedge',headless:true,viewport:{width:390,height:844}});
try{
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const other of context.pages())if(other!==page)await other.close();
const cleanup=await context.newCDPSession(page);await cleanup.send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});
await page.goto(base+'/jaipur/');assert.match(await page.title(),/Jaipur/);assert.equal(await page.locator('[data-area=hand]').count(),0);
await page.reload();assert.equal(await page.locator('[data-area=hand]').count(),0);await page.click('#accept');
await page.click('#rules');assert.ok(await page.locator('#rulebook').isVisible());assert.match(await page.locator('#rulebook').innerText(),/非官方/);await page.click('#close-rules');
for(const w of [320,390,768,1280]){await page.setViewportSize({width:w,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${w}`);}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'.openai/jaipur-mobile.png'),fullPage:true});
await page.click('[data-mode=exchange]');assert.match(await page.locator('#error').innerText(),/2～5/);assert.ok(await page.locator('#commit').isDisabled());
await page.click('[data-mode=camels]');await page.click('#commit');assert.ok(await page.locator('.handoff').isVisible());assert.equal(await page.locator('[data-area=hand]').count(),0);assert.equal(await page.locator('.private').count(),0);
let turns=0,rounds=0;
for(;turns<700;turns++){
 if(await page.locator('#accept').count()){assert.equal(await page.locator('[data-area=hand]').count(),0);await page.click('#accept');}
 if(await page.locator('#next').count()){rounds++;assert.equal(await page.locator('#commit').count(),0);await page.click('#next');continue;}
 if(await page.locator('.result').count()){assert.match(await page.locator('.result').innerText(),/整场胜利/);assert.equal(await page.locator('#commit').count(),0);break;}
 const data=await page.evaluate(()=>{const types=['diamond','gold','silver','silk','spice','leather','camel'];return Object.fromEntries(['hand','market'].map(a=>[a,[...document.querySelectorAll(`[data-area=${a}]`)].map(b=>types.find(t=>b.classList.contains(t)))]));});
 const groups=Object.entries(data.hand.reduce((o,t,i)=>((o[t]??=[]).push(i),o),{})).filter(([t,ids])=>ids.length>=(['diamond','gold','silver'].includes(t)?2:1)).sort((a,b)=>b[1].length-a[1].length);
 if(groups.length&&(groups[0][1].length>=2||data.hand.length>=6||!data.market.some(t=>t!=='camel'))){await page.click('[data-mode=sell]');for(const i of groups[0][1])await page.click(`[data-area=hand][data-index="${i}"]`);}
 else if(data.market.some(t=>t!=='camel')&&data.hand.length<7){await page.click('[data-mode=take]');await page.click(`[data-area=market][data-index="${data.market.findIndex(t=>t!=='camel')}"]`);}
 else await page.click('[data-mode=camels]');
 assert.ok(await page.locator('#commit').isEnabled(),await page.locator('#error').innerText());await page.click('#commit');
 if(await page.locator('.handoff').count())assert.equal(await page.locator('[data-area=hand]').count(),0);
}
assert.ok(turns<700);assert.ok(rounds>=1&&rounds<=2);await page.screenshot({path:path.join(root,'.openai/jaipur-victory.png'),fullPage:true});
page.once('dialog',d=>d.accept());await page.click('#restart');assert.ok(await page.locator('#accept').isVisible());assert.equal(await page.locator('[data-area=hand]').count(),0);
await page.goto(base+'/');assert.equal(await page.locator('a.game[href="./jaipur/"]').count(),1);
await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});
const cache=fs.readFileSync(path.join(root,'service-worker.js'),'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
await page.waitForFunction(async name=>(await caches.keys()).includes(name),cache);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
const entries=['',...Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/class="game[^"\n]*" href="\.\/([^"\n]+)"/g),m=>m[1])];assert.ok(entries.includes('jaipur/'));
for(const entry of entries){const r=await page.goto(base+'/'+entry);assert.equal(r.status(),200);assert.ok(r.fromServiceWorker());if(entry)assert.notEqual(await page.title(),'Daniel 的桌游｜中文离线聚会桌游合集');console.log('OFFLINE OK',entry||'lobby');}
await page.goto(base+'/jaipur/');await page.reload();await page.click('#accept');assert.ok(await page.locator('.private').isVisible());assert.deepEqual(errors,[]);
console.log(`PASS: full match (${turns} steps), handoff privacy, rules, invalid actions, refresh, 320–1280px, home card, all offline routes`);
}finally{await context.close();}
})().catch(e=>{console.error(e);process.exit(1)});
