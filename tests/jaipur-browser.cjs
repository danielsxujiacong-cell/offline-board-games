const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8080';
fs.mkdirSync(path.join(root,'.openai'),{recursive:true});
const profile=fs.mkdtempSync(path.join(root,'.openai/jaipur-browser-'));
const context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
try{
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const other of context.pages())if(other!==page)await other.close();
const cleanup=await context.newCDPSession(page);await cleanup.send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});
await page.goto(base+'/jaipur/');assert.match(await page.title(),/Jaipur/);assert.equal(await page.locator('[data-area=hand]').count(),0);
await page.reload();assert.equal(await page.locator('[data-area=hand]').count(),0);await page.tap('#accept');
await page.tap('#rules');assert.ok(await page.locator('#rulebook').isVisible());assert.match(await page.locator('#rulebook').innerText(),/非官方/);await page.tap('#close-rules');
for(const w of [320,390,768,1280]){await page.setViewportSize({width:w,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${w}`);}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'.openai/jaipur-mobile.png'),fullPage:true});
await page.tap('[data-mode=exchange]');assert.match(await page.locator('#error').innerText(),/2～5/);assert.ok(await page.locator('#commit').isDisabled());
await page.tap('[data-mode=camels]');await page.tap('#commit');assert.ok(await page.locator('.handoff').isVisible());assert.equal(await page.locator('[data-area=hand]').count(),0);assert.equal(await page.locator('.private').count(),0);
const tokenValues={diamond:[7,7,5,5,5],gold:[6,6,5,5,5],silver:[5,5,5,5,5],silk:[5,3,3,2,2,1,1],spice:[5,3,3,2,2,1,1],leather:[4,3,2,1,1,1,1,1,1]};
const bonusValues={3:[1,1,2,2,2,3,3],4:[4,4,5,5,6,6],5:[8,8,9,10,10]};
let queues,earned,bonusCounts,remaining,starter=0,badges=[0,0];
function resetLedger(){queues=structuredClone(tokenValues);earned=[[],[]];bonusCounts=[{3:0,4:0,5:0},{3:0,4:0,5:0}];remaining={3:7,4:6,5:5};}
resetLedger();
function validBonusTotals(totals){
 let sums=new Set(['0,0']);
 for(const k of [3,4,5]){
  const pairs=new Set(),values=bonusValues[k];
  function assign(i,a,b,x,y){if(i===values.length){if(!a&&!b)pairs.add(`${x},${y}`);return;}if(a+b>values.length-i)return;assign(i+1,a,b,x,y);if(a)assign(i+1,a-1,b,x+values[i],y);if(b)assign(i+1,a,b-1,x,y+values[i]);}
  assign(0,bonusCounts[0][k],bonusCounts[1][k],0,0);
  const next=new Set();for(const s of sums)for(const pair of pairs){const a=s.split(',').map(Number),b=pair.split(',').map(Number);next.add(`${a[0]+b[0]},${a[1]+b[1]}`);}sums=next;
 }
 return sums.has(totals.join(','));
}
async function verifyScore(){
 const scores=await page.locator('.scoretable>div').evaluateAll(es=>es.map(e=>{const t=e.innerText;const m=t.match(/商品 (\d+) \+ 奖励 (\d+) \+ 骆驼 (\d+)/),n=t.match(/奖励 (\d+) 枚 · 商品 (\d+) 枚/);return {total:Number(e.querySelector('strong').textContent.match(/\d+/)[0]),goods:+m[1],bonus:+m[2],camel:+m[3],bonusCount:+n[1],goodsCount:+n[2]};}));
 const herds=await page.locator('.player small').evaluateAll(es=>es.map(e=>Number(e.textContent.match(/骆驼圈\s*(\d+)/)[1])));
 scores.forEach((s,i)=>{assert.equal(s.goods,earned[i].reduce((a,b)=>a+b,0));assert.equal(s.goodsCount,earned[i].length);assert.equal(s.bonusCount,Object.values(bonusCounts[i]).reduce((a,b)=>a+b,0));assert.equal(s.camel,herds[i]>herds[1-i]?5:0);assert.equal(s.total,s.goods+s.bonus+s.camel);});
 assert.ok(validBonusTotals(scores.map(s=>s.bonus)),'bonus totals must be possible from the independent finite pools');
 let winner=starter;for(const key of ['total','bonusCount','goodsCount'])if(scores[0][key]!==scores[1][key]){winner=scores[0][key]>scores[1][key]?0:1;break;}
 assert.match(await page.locator('.result h2').innerText(),new RegExp(`商人 ${winner+1}`));badges[winner]++;
 assert.deepEqual(await page.locator('.badges').evaluateAll(es=>es.map(e=>Number(e.getAttribute('aria-label').match(/\d+/)[0]))),badges);starter=1-winner;
 if(badges[winner]===2)assert.match(await page.locator('.result h2').innerText(),/整场胜利/);
 console.log('INDEPENDENT SCORE OK',scores.map(s=>s.total).join(' / '));
}
let turns=0,rounds=0;
for(;turns<700;turns++){
 if(turns%12===0)await page.setViewportSize(turns%24===0?{width:390,height:844}:{width:844,height:390});
 if(await page.locator('#accept').count()){assert.equal(await page.locator('[data-area=hand]').count(),0);await page.tap('#accept');}
 if(await page.locator('#next').count()){await verifyScore();rounds++;assert.equal(await page.locator('#commit').count(),0);await page.tap('#next');resetLedger();continue;}
 if(await page.locator('.result').count()){await verifyScore();assert.match(await page.locator('.result').innerText(),/整场胜利/);assert.equal(await page.locator('#commit').count(),0);break;}
 const data=await page.evaluate(()=>{const types=['diamond','gold','silver','silk','spice','leather','camel'];return Object.fromEntries(['hand','market'].map(a=>[a,[...document.querySelectorAll(`[data-area=${a}]`)].map(b=>types.find(t=>b.classList.contains(t)))]));});
 const groups=Object.entries(data.hand.reduce((o,t,i)=>((o[t]??=[]).push(i),o),{})).filter(([t,ids])=>ids.length>=(['diamond','gold','silver'].includes(t)?2:1)).sort((a,b)=>b[1].length-a[1].length);
 if(groups.length&&(groups[0][1].length>=2||data.hand.length>=6||!data.market.some(t=>t!=='camel'))){const who=Number((await page.locator('.private h2').innerText()).match(/商人 (\d+)/)[1])-1,[type,ids]=groups[0],pool=Math.min(ids.length,5);earned[who].push(...queues[type].splice(0,ids.length));if(ids.length>=3&&remaining[pool]){bonusCounts[who][pool]++;remaining[pool]--;}await page.tap('[data-mode=sell]');for(const i of ids)await page.tap(`[data-area=hand][data-index="${i}"]`);}
 else if(data.market.some(t=>t!=='camel')&&data.hand.length<7){await page.tap('[data-mode=take]');await page.tap(`[data-area=market][data-index="${data.market.findIndex(t=>t!=='camel')}"]`);}
 else await page.tap('[data-mode=camels]');
 assert.ok(await page.locator('#commit').isEnabled(),await page.locator('#error').innerText());await page.tap('#commit');
 if(await page.locator('.handoff').count())assert.equal(await page.locator('[data-area=hand]').count(),0);
}
assert.ok(turns<700);assert.ok(rounds>=1&&rounds<=2);await page.screenshot({path:path.join(root,'.openai/jaipur-victory.png'),fullPage:true});
page.once('dialog',d=>d.accept());await page.tap('#restart');assert.ok(await page.locator('#accept').isVisible());assert.equal(await page.locator('[data-area=hand]').count(),0);
await page.goto(base+'/');assert.equal(await page.locator('a.game[href="./jaipur/"]').count(),1);
await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});
const cache=fs.readFileSync(path.join(root,'service-worker.js'),'utf8').match(/CACHE_NAME = '([^']+)'/)[1];
await page.waitForFunction(async name=>(await caches.keys()).includes(name),cache);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
const entries=['',...Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/class="game[^"\n]*" href="\.\/([^"\n]+)"/g),m=>m[1])];assert.ok(entries.includes('jaipur/'));
for(const entry of entries){const r=await page.goto(base+'/'+entry);assert.equal(r.status(),200);assert.ok(r.fromServiceWorker());if(entry)assert.notEqual(await page.title(),'Daniel 的桌游｜中文离线聚会桌游合集');console.log('OFFLINE OK',entry||'lobby');}
await page.goto(base+'/jaipur/');await page.reload();await page.tap('#accept');assert.ok(await page.locator('.private').isVisible());assert.deepEqual(errors,[]);
console.log(`PASS: full match (${turns} steps), handoff privacy, rules, invalid actions, refresh, 320–1280px, portrait/landscape full-match touch play, home card, all offline routes`);
}finally{await context.close();if(path.dirname(profile)===path.join(root,'.openai'))fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
