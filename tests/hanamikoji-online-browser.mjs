import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {serve} from './hanamikoji-online-dev.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/weissblake/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fixture=await serve(0),browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],snapshots=[[],[]],contexts=[],pages=[];
try{
 for(let seat=0;seat<3;seat++){
  const context=await browser.newContext({viewport:{width:[320,375,390][seat],height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});contexts.push(context);
  // Disable the 5s fallback for this test so synchronization must use the websocket.
  await context.addInitScript(()=>{const interval=window.setInterval;window.setInterval=(f,ms,...args)=>ms===5000?0:interval(f,ms,...args);});
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  if(seat<2)page.on('websocket',ws=>ws.on('framereceived',e=>{try{const data=JSON.parse(e.payload);const payload=Array.isArray(data)?data[4]:data.payload;const snapshot=payload?.data?.record?.snapshot;if(snapshot)snapshots[seat].push(snapshot);}catch{}}));
 }
 const [host,guest,stranger]=pages;
 const tap=async(p,selector)=>{await p.locator(selector).scrollIntoViewIfNeeded();await p.locator(selector).tap();};
 const version=async(p,n)=>p.waitForFunction(n=>document.querySelector('.round span')?.textContent.includes('版本 '+n),n,{timeout:8000});
 await host.goto(fixture.base+'/games/hanamikoji/online/');await tap(host,'#create');await host.locator('.room-code').waitFor();
 const code=(await host.locator('.room-code').textContent()).replace('房间 ','');
 await guest.goto(fixture.base+'/games/hanamikoji/online/#'+code);assert.equal(await guest.locator('#code').inputValue(),code);await tap(guest,'#join');
 await host.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 2：未准备'));
 await tap(host,'[data-send="ready"]');await tap(guest,'[data-send="ready"]');await host.waitForFunction(()=>!document.querySelector('[data-send="start"]').disabled);
 await tap(host,'[data-send="start"]');await host.locator('[data-card]').first().waitFor();await guest.locator('.your-hand .card').first().waitFor();
 let room=(await fixture.store.findCode(code));await Promise.all([version(host,room.version),version(guest,room.version)]);
 assert.equal(await host.locator('[data-card]').count(),7);assert.equal(await guest.locator('.your-hand .card').count(),6);assert.equal(await guest.locator('[data-action]').count(),0);
 await stranger.goto(fixture.base+'/games/hanamikoji/online/#'+code);await tap(stranger,'#join');await stranger.waitForFunction(()=>document.querySelector('#error').textContent.includes('房间'));
 assert.equal(await stranger.locator('.your-hand').count(),0);
 console.log('PASS two independent identities, invite, readiness, start, stranger blocked, websocket synchronization');
 let seen=new Set();
 for(let step=0;step<100;step++){
  room=await fixture.store.findCode(code);const s=room.state;
  if(s.phase==='gameOver')break;
  const who=s.phase==='choice'?s.recipient:s.turn,p=pages[who];
  if(s.phase==='roundResult')await tap(host,'[data-send="next"]');
  else if(s.phase==='choice')await tap(p,'[data-choice="1"]');
  else{
   const action=['secret','discard','gift','compete'].find(a=>!s.players[who].used.includes(a));seen.add(action);
   await tap(p,`[data-action="${action}"]`);
   for(let i=0;i<({secret:1,discard:2,gift:3,compete:4}[action]);i++){await p.locator('[data-card]').nth(i).scrollIntoViewIfNeeded();await p.locator('[data-card]').nth(i).tap();}
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await tap(p,'#commit');
  }
  await Promise.all([version(host,room.version+1),version(guest,room.version+1)]);
  if(step===99)assert.fail('no victory after 100 commands');
 }
 assert.equal(seen.size,4);assert.equal((await fixture.store.findCode(code)).state.phase,'gameOver');
 for(let i=0;i<2;i++){assert.ok(snapshots[i].length>8);for(const value of snapshots[i]){assert.equal(value.seat,i);assert.ok(!('state' in value));assert.ok(!('removed' in (value.board||{})));assert.ok(!('users' in value));}}
 console.log('PASS full game and victory, all actions, per-owner realtime snapshots');
 host.once('dialog',d=>d.accept());await tap(host,'#restart');await guest.locator('[data-send="restartDecline"]').waitFor();await tap(guest,'[data-send="restartDecline"]');await host.locator('#restart').waitFor();
 host.once('dialog',d=>d.accept());await tap(host,'#restart');await guest.locator('[data-send="restartAccept"]').waitFor();await tap(guest,'[data-send="restartAccept"]');
 await host.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 1：未准备'));await guest.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('玩家 2：未准备'));
 await tap(host,'[data-send="ready"]');await tap(guest,'[data-send="ready"]');await host.waitForFunction(()=>!document.querySelector('[data-send="start"]').disabled);await tap(host,'[data-send="start"]');
 room=await fixture.store.findCode(code);await version(guest,room.version);
 await contexts[1].setOffline(true);await guest.waitForFunction(()=>document.querySelector('#connection').textContent.includes('已断网'));
 await tap(host,'[data-action="secret"]');await host.locator('[data-card]').first().tap();await tap(host,'#commit');
 await contexts[1].setOffline(false);room=await fixture.store.findCode(code);await version(guest,room.version);
 const identity=await guest.evaluate(()=>JSON.parse(localStorage.getItem('hanamikoji-auth-v1')).user.id);
 await guest.reload();await guest.locator('.your-hand').waitFor();assert.equal(await guest.evaluate(()=>JSON.parse(localStorage.getItem('hanamikoji-auth-v1')).user.id),identity);await version(guest,room.version);
 console.log('PASS restart agreement, disconnect/reconnect, reload preserves identity and exact game');
 const versionBeforeLost=room.version,requestIds=[];let drop=true;
 await guest.route('**/functions/v1/hanamikoji-api',async route=>{
  const command=route.request().postDataJSON();
  if(command.type==='act'){requestIds.push(command.requestId);if(drop){drop=false;await route.fetch();await route.abort('failed');return;}}
  await route.continue();
 });
 await tap(guest,'[data-action="discard"]');for(let i=0;i<2;i++){await guest.locator('[data-card]').nth(i).scrollIntoViewIfNeeded();await guest.locator('[data-card]').nth(i).tap();}
 await tap(guest,'#commit');await version(host,versionBeforeLost+1);await guest.waitForFunction(()=>!document.querySelector('#error').textContent);
 await guest.unroute('**/functions/v1/hanamikoji-api');assert.equal((await fixture.store.findCode(code)).version,versionBeforeLost+1);assert.equal(requestIds.length,2);assert.equal(requestIds[0],requestIds[1]);
 console.log('PASS dropped response retry reuses the same key and commits exactly once');
 for(const [w,h] of [[320,568],[375,667],[390,844],[568,320],[844,390],[1280,900]]){await guest.setViewportSize({width:w,height:h});assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:fileURLToPath(new URL('../.openai/hanamikoji-online-mobile.png',import.meta.url)),fullPage:true});
 host.once('dialog',d=>d.accept());await tap(host,'#leave');await guest.waitForFunction(()=>document.querySelector('.lobby')?.textContent.includes('房间已关闭'));
 assert.equal(await guest.locator('.your-hand').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS mobile portrait/landscape and desktop, host exit closes guest, zero page exceptions');
 console.log('LOCAL E2E PASSED. Supabase Auth/Realtime transport was simulated; PostgreSQL migration, RLS/RPCs, server rules and browser SDK/UI were executed.');
}finally{for(const context of contexts)await context.close();await browser.close();await fixture.close();}
