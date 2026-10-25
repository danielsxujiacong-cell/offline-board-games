import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database} from './hanamikoji-db.mjs';
import {makeHandler,snapshot,transition,createRoom} from '../supabase/functions/_shared/hanamikoji/service.mjs';
import {RestStore} from '../supabase/functions/_shared/hanamikoji/rest-store.mjs';
const users=[0,1,2,3].map(()=>crypto.randomUUID());
let db,store,handler;
before(async()=>{({db,store}=await database());for(const id of users)await db.query('insert into auth.users(id) values($1)',[id]);let seed=7;handler=makeHandler({store,origins:['http://localhost:8080'],authenticate:async token=>users.includes(token)?token:null,rng:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});});
after(async()=>{await db?.close();});
async function call(actor,body){const response=await handler(new Request('http://api.test',{method:'POST',headers:{Authorization:'Bearer '+actor,Origin:'http://localhost:8080','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}
const command=(type,room,extra={})=>({type,requestId:crypto.randomUUID(),...(room?{roomId:room.id,version:room.version}:{}),...extra});
let room;
test('production REST adapter accepts empty 204 responses from void RPCs',async()=>{
 const store=new RestStore('https://test.invalid','server-only',async()=>new Response(null,{status:204}));
 await assert.doesNotReject(store.rateLimit(users[0]));
});
test('server and offline game import exactly the same rule engine',async()=>{assert.equal(await readFile(new URL('../games/hanamikoji/engine.js',import.meta.url),'utf8'),await readFile(new URL('../supabase/functions/_shared/hanamikoji/engine.js',import.meta.url),'utf8'));});
test('create, idempotent retry, join and third-player rejection',async()=>{
 const c=command('create');const a=await call(users[0],c);assert.equal(a.status,200);room=a.body;assert.equal(room.code.length,10);
 const retry=await call(users[0],c);assert.equal(retry.body.id,room.id);assert.equal(retry.body.version,0);
 assert.equal((await call(users[0],{...c,type:'leave',roomId:room.id,version:0})).status,409);
 const joined=await call(users[1],command('join',null,{code:room.code}));assert.equal(joined.status,200);room=joined.body;
 assert.equal(room.seat,1);assert.equal((await call(users[2],command('join',null,{code:room.code}))).status,409);
 assert.equal((await call(users[2],{type:'sync',roomId:room.id})).status,403);
});
test('readiness and start require both players, only host can start',async()=>{
 assert.equal((await call(users[0],command('start',room))).status,409);
 room=(await call(users[0],command('ready',room,{ready:true}))).body;
 room=(await call(users[1],command('ready',room,{ready:true}))).body;
 assert.equal((await call(users[1],command('start',room))).status,403);
 room=(await call(users[0],command('start',room))).body;
 assert.equal(room.board.hand.length,7);assert.equal(room.board.deck,7);
 const guest=(await call(users[1],{type:'sync',roomId:room.id})).body;
 assert.equal(guest.board.hand.length,6);assert.equal(guest.board.secret.length,0);
 assert.ok(!JSON.stringify(guest).includes('removed'));assert.ok(!JSON.stringify(guest).includes('users'));
 assert.ok(room.board.hand.every(c=>!guest.board.hand.some(x=>x.id===c.id)));
});
test('RLS: owner reads only own projection; strangers read no rows; all client writes and full state/RPC access denied',async()=>{
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[0]]);
 try{
  const own=(await db.query('select user_id,snapshot from public.hanamikoji_player_views')).rows;
  assert.equal(own.length,1);assert.equal(own[0].user_id,users[0]);
  for(const table of ['hanamikoji_rooms','hanamikoji_commands','hanamikoji_rate_limits'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
  await assert.rejects(db.query("update public.hanamikoji_player_views set snapshot='{}'"),/permission denied/);
  await assert.rejects(db.query('select public.hanamikoji_rate_limit($1)',[users[0]]),/permission denied/);
  await assert.rejects(db.query("select public.hanamikoji_commit('{}',0,$1,$2,'abc','[]')",[users[0],crypto.randomUUID()]),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[2]]);assert.equal((await db.query('select * from public.hanamikoji_player_views')).rows.length,0);
 }finally{await db.exec('reset role');}
 await db.exec('set role anon');try{await assert.rejects(db.query('select * from public.hanamikoji_player_views'),/permission denied/);}finally{await db.exec('reset role');}
});
test('forged turns/cards/fields reject without altering state; concurrent actions have exactly one winner',async()=>{
 const original=await store.getRoom(room.id),before=original.version;
 assert.equal((await call(users[1],command('act',room,{action:'secret',ids:[room.board.hand[0].id]}))).status,403);
 assert.equal((await call(users[0],command('act',room,{action:'secret',ids:['forged']}))).status,400);
 assert.equal((await call(users[0],{...command('act',room,{action:'secret',ids:[room.board.hand[0].id]}),player:1})).status,400);
 assert.equal((await store.getRoom(room.id)).version,before);
 const a=command('act',room,{action:'secret',ids:[room.board.hand[0].id]});
 const b=command('act',room,{action:'discard',ids:room.board.hand.slice(0,2).map(c=>c.id)});
 const responses=await Promise.all([call(users[0],a),call(users[0],b)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const success=responses.find(r=>r.status===200),winning=responses[0].status===200?a:b;
 room=success.body;assert.equal(room.version,before+1);
 const replay=await call(users[0],winning);assert.equal(replay.status,200);assert.equal(replay.body.version,room.version);
});
test('full authoritative game: all actions, every transition conserves 21 cards, private projections and reconnect match',async()=>{
 for(let i=0;i<160;i++){
  // Simulate elapsed minutes for this accelerated test; production keeps the real limit.
  await db.exec("update public.hanamikoji_rate_limits set window_start=now()-interval '2 minutes' where requests>60");
  const full=await store.getRoom(room.id),s=full.state;
  const all=[s.removed,...s.deck,...s.players.flatMap(p=>[...p.hand,...p.table,...p.secret,...p.discard]),...(s.pending?.cards||[])];
  assert.equal(all.length,21);assert.equal(new Set(all.map(c=>c.id)).size,21);
  if(s.phase==='gameOver'){assert.notEqual(s.winner,null);break;}
  const who=s.phase==='choice'?s.recipient:s.turn;
  const mine=snapshot(full,users[who]);
  const other=snapshot(full,users[1-who]);
  assert.ok(!('state' in mine));assert.ok(!('removed' in mine.board));
  for(const id of s.players[1-who].secret.map(c=>c.id))assert.ok(!mine.board.secret.some(c=>c.id===id));
  let c;
  if(s.phase==='roundResult')c=command('next',mine);
  else if(s.phase==='choice')c=command('choose',mine,{index:i%2});
  else{const action=['secret','discard','gift','compete'].find(a=>!s.players[who].used.includes(a));c=command('act',mine,{action,ids:mine.board.hand.slice(0,{secret:1,discard:2,gift:3,compete:4}[action]).map(c=>c.id)});}
  const result=await call(users[who],c);assert.equal(result.status,200,JSON.stringify(result));room=result.body;
  const reconnected=await call(users[1-who],{type:'sync',roomId:room.id});assert.equal(reconnected.status,200);assert.equal(reconnected.body.version,room.version);
  assert.equal(reconnected.body.seat,1-who);assert.deepEqual(reconnected.body.board.markers,room.board.markers);
  assert.deepEqual(reconnected.body.board.hand,(await store.getRoom(room.id)).state.players[1-who].hand);
  if(i===159)assert.fail('game did not finish');
 }
});
test('restart requires opponent approval, resets readiness and game, host exit closes both views',async()=>{
 room=(await call(users[0],{type:'sync',roomId:room.id})).body;
 room=(await call(users[0],command('restart',room))).body;assert.equal(room.restartRequested,true);
 assert.equal((await call(users[0],command('restartAccept',room))).status,409);
 room=(await call(users[1],command('restartDecline',room))).body;assert.equal(room.restartRequested,false);
 room=(await call(users[0],command('restart',room))).body;
 room=(await call(users[1],command('restartAccept',room))).body;assert.equal(room.board,null);assert.deepEqual(room.ready,[false,false]);assert.equal(room.game,2);
 room=(await call(users[0],command('leave',room))).body;assert.equal(room.status,'closed');
 const guest=(await call(users[1],{type:'sync',roomId:room.id})).body;assert.equal(guest.status,'closed');assert.equal(guest.board,null);
});
test('HTTP rejects missing/forged identity, foreign origins, unknown commands and oversized payloads',async()=>{
 assert.equal((await handler(new Request('http://api.test',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await call('fake-token',{type:'sync',roomId:room.id})).status,401);
 assert.equal((await handler(new Request('http://api.test',{method:'OPTIONS',headers:{Origin:'https://evil.test'}}))).status,403);
 assert.equal((await call(users[0],{type:'anything'})).status,400);
 assert.equal((await call(users[0],{type:'create',requestId:crypto.randomUUID(),extra:'x'.repeat(5000)})).status,413);
});
test('simultaneous duplicate request commits once and concurrent joins fill exactly one guest seat',async()=>{
 const c=command('create');const duplicate=await Promise.all([call(users[3],c),call(users[3],c)]);
 assert.ok(duplicate.every(r=>r.status===200));assert.equal(duplicate[0].body.id,duplicate[1].body.id);
 const created=duplicate[0].body;
 const joins=await Promise.all([call(users[0],command('join',null,{code:created.code})),call(users[2],command('join',null,{code:created.code}))]);
 assert.deepEqual(joins.map(r=>r.status).sort(),[200,409]);
 assert.equal((await store.getRoom(created.id)).users.filter(Boolean).length,2);
});
test('SQL projection failure rolls back state and receipt together',async()=>{
 const fresh=createRoom(users[2]),req=crypto.randomUUID();
 await assert.rejects(store.commit({room:fresh,expected:-1,actor:users[2],requestId:req,hash:'a'.repeat(64),views:[]}),/missing_projection/);
 assert.equal(await store.getRoom(fresh.id),undefined);assert.equal(await store.receipt(users[2],req),undefined);
 await assert.rejects(store.commit({room:fresh,expected:-1,actor:users[2],requestId:req,hash:'a'.repeat(64),views:[{user_id:users[3],snapshot:{id:fresh.id,version:0}}]}),/invalid_projection_owner/);
 assert.equal(await store.getRoom(fresh.id),undefined);
});
test('expired rooms reject actions and rate limiting returns 429',async()=>{
 const expired=createRoom(users[2]);expired.expiresAt=new Date(Date.now()-1000).toISOString();
 assert.throws(()=>transition(expired,users[2],{type:'ready',ready:true}),/room_expired/);
 await db.query("insert into public.hanamikoji_rate_limits(actor_id,window_start,requests) values($1,date_trunc('minute',now()),90) on conflict(actor_id) do update set window_start=excluded.window_start,requests=90",[users[2]]);
 const limited=await call(users[2],command('create'));assert.equal(limited.status,429);assert.equal(limited.body.error,'rate_limited');
});
