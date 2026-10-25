// Actual Supabase Auth/API/Realtime; no routes, test server or backend substitutions.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/weissblake/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8080';
const contexts=[],pages=[],frames=[0,0],errors=[];
const tap=async(p,s)=>{await p.locator(s).tap();};
const version=p=>p.locator('.round span').textContent().then(t=>Number(t.match(/版本 (\d+)/)[1]));
const atVersion=async(p,n)=>p.waitForFunction(n=>document.querySelector('.round span')?.textContent.includes('版本 '+n),n,{timeout:15000});
try{
 for(let p=0;p<2;p++){
  const context=await chromium.launchPersistentContext(path.join(root,'.openai/hanamikoji-real-'+p),{channel:'msedge',headless:true,viewport:{width:p?375:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});contexts.push(context);
  await context.addInitScript(()=>{localStorage.removeItem('hanamikoji-online-room-v1');const interval=window.setInterval;window.setInterval=(f,ms,...args)=>ms===5000?0:interval(f,ms,...args);});
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',ws=>ws.on('framereceived',e=>{try{const data=JSON.parse(e.payload),payload=Array.isArray(data)?data[4]:data.payload;if(payload?.data?.record?.snapshot){assert.equal(payload.data.record.snapshot.seat,p);frames[p]++;}}catch(e){if(e instanceof assert.AssertionError)errors.push(e.message);}}));
  await page.goto(base+'/games/hanamikoji/online/');
 }
 const [host,guest]=pages;
 await tap(host,'#create');await host.locator('.room-code').waitFor({timeout:20000});
 const code=(await host.locator('.room-code').textContent()).replace('房间 ','');
 await guest.locator('#code').fill(code);await tap(guest,'#join');
 await host.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 2：未准备'));
 await tap(host,'[data-send="ready"]');await guest.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 1：已准备'));
 await tap(guest,'[data-send="ready"]');await host.waitForFunction(()=>!document.querySelector('[data-send="start"]').disabled);
 await tap(host,'[data-send="start"]');await host.locator('[data-card]').first().waitFor();await guest.locator('.your-hand .card').first().waitFor();
 assert.equal(await host.locator('.your-hand .card').count(),7);assert.equal(await guest.locator('.your-hand .card').count(),6);
 await tap(host,'[data-action="secret"]');await host.locator('[data-card]').first().tap();
 await host.locator('[data-card]').first().evaluate(e=>e.dataset.acceptance='preserve');
 await tap(host,'#refresh');await host.waitForFunction(()=>document.querySelector('#connection').textContent.includes('已同步'));
 assert.equal(await host.locator('[data-acceptance="preserve"]').count(),1,'same version sync must not replace cards');
 assert.equal(await host.locator('[data-card][aria-pressed="true"]').count(),1);
 console.log('REAL BROWSER OK: anonymous identities, create/join/ready/start, private hands');
 for(let turn=0;turn<8;turn++){
  const player=pages[turn%2],other=pages[1-turn%2],action=['secret','discard','gift','compete'][Math.floor(turn/2)];
  const before=await version(player);
  await tap(player,`[data-action="${action}"]`);
  for(let i=0;i<({secret:1,discard:2,gift:3,compete:4}[action]);i++)await player.locator('[data-card]').nth(i).tap();
  await tap(player,'#commit');await Promise.all(pages.map(p=>atVersion(p,before+1)));
  if(action==='gift'||action==='compete'){
   assert.equal(await player.locator('[data-choice]').count(),0);await other.locator('[data-choice="0"]').waitFor();await tap(other,'[data-choice="0"]');await Promise.all(pages.map(p=>atVersion(p,before+2)));
  }
 }
 assert.match(await host.locator('.play h2').textContent(),/结算|获胜/);
 for(const n of frames)assert.ok(n>=10,'Realtime frames were not received');
 await contexts[1].setOffline(true);await guest.waitForFunction(()=>document.querySelector('#connection').textContent.includes('已断网'));
 await contexts[1].setOffline(false);await guest.waitForFunction(()=>document.querySelector('#connection').textContent.includes('已连接'));
 // Reload the current URL, bypassing the test's initial room-selection reset.
 const savedRoom=await host.evaluate(()=>localStorage.getItem('hanamikoji-online-room-v1'));
 await guest.evaluate(id=>localStorage.setItem('hanamikoji-online-room-v1',id),savedRoom);
 await guest.locator('#refresh').tap();await atVersion(guest,await version(host));
 for(const [w,h] of [[320,568],[375,667],[390,844],[667,375],[1280,900]]){await host.setViewportSize({width:w,height:h});assert.equal(await host.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await host.setViewportSize({width:390,height:844});await host.screenshot({path:path.join(root,'.openai/hanamikoji-production.png'),fullPage:true});
 host.once('dialog',d=>d.accept());await tap(host,'#restart');await guest.locator('[data-send="restartAccept"]').waitFor();await tap(guest,'[data-send="restartAccept"]');
 await host.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 1：未准备'));
 host.once('dialog',d=>d.accept());await tap(host,'#leave');await guest.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('房间已关闭'));
 assert.deepEqual(errors,[]);
 console.log('PASS REAL BROWSER: four actions, per-owner WebSockets (fallback polling disabled), round scoring, reconnect, restart, host exit, mobile/desktop. '+base);
}catch(e){
 for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:path.join(root,`.openai/hanamikoji-cloud-failure-${i}.png`),fullPage:true}).catch(()=>{});console.error('Player '+i+' UI:',await pages[i].locator('#error').textContent().catch(()=>''));}
 throw e;
}finally{for(const context of contexts)await context.close();}
