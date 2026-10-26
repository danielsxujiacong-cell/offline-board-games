import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './wavelength-db.mjs';import {createRoom,transition,snapshot,makeHandler,categories} from '../supabase/functions/_shared/wavelength/service.mjs';
const users=Array.from({length:4},()=>crypto.randomUUID());let db,store,handler,room;const ids=new Set();
before(async()=>{({db,store}=await database());for(const id of users)await db.query('insert into auth.users(id) values($1)',[id]);handler=makeHandler({store,origins:['http://127.0.0.1:8091'],authenticate:async token=>users.includes(token)?token:null,rng:()=>.5})});after(async()=>db?.close());
const cmd=(type,r,extra={})=>({type,requestId:crypto.randomUUID(),...(r?{roomId:r.id,version:r.version}:{}),...extra});
async function call(actor,body){const response=await handler(new Request('http://test',{method:'POST',headers:{Authorization:'Bearer '+actor,Origin:'http://127.0.0.1:8091','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()}}
async function act(actor,type,extra={}){const r=await call(users[actor],cmd(type,room,extra));assert.equal(r.status,200,JSON.stringify(r.body));room=r.body;return r.body}
async function sync(actor){return (await call(users[actor],{type:'sync',roomId:room.id})).body}
test('canonical server library exactly matches frontend library',()=>assert.equal(fs.readFileSync('wavelength/questions.json','utf8'),fs.readFileSync('supabase/functions/_shared/wavelength/questions.json','utf8')));
test('create, retry, names/categories, outsider and capacity',async()=>{
 const c=cmd('create',null,{name:'A <&>',packs:categories});let res=await call(users[0],c);assert.equal(res.status,200);room=res.body;const repeat=await call(users[0],c);assert.equal(repeat.body.id,room.id);assert.equal(repeat.body.version,0);
 assert.equal((await call(users[1],cmd('start',room))).status,403);
 const joined=await call(users[1],cmd('join',null,{code:room.code,name:'B'}));assert.equal(joined.status,200);room=joined.body;assert.equal(room.seat,1);
 assert.equal((await call(users[2],cmd('join',null,{code:room.code,name:'C'}))).status,409);
 assert.equal((await call(users[2],{type:'sync',roomId:room.id})).status,403);
 assert.equal((await call(users[0],cmd('create',null,{name:'bad',packs:['unknown']}))).status,400);
});
test('ready gate, host-only start, hidden target and deck',async()=>{
 assert.equal((await call(users[0],cmd('start',room))).status,409);await act(0,'ready',{ready:true});await act(1,'ready',{ready:true});assert.equal((await call(users[1],cmd('start',room))).status,403);await act(0,'start');const a=await sync(0),b=await sync(1);assert.ok(Number.isInteger(a.board.target));assert.equal(Object.hasOwn(b.board,'target'),false);assert.equal(JSON.stringify(b).includes('deck'),false);assert.equal(Object.hasOwn(b,'users'),false);
 const result=await db.query('select snapshot from wavelength_player_views where room_id=$1 and user_id=$2',[room.id,users[1]]);assert.equal(Object.hasOwn(result.rows[0].snapshot.board,'target'),false);
});
test('swap/custom keep target, receiver cannot set clue or guess early, stale versions',async()=>{
 const a=await sync(0),target=a.board.target;assert.equal((await call(users[1],cmd('swap',room))).status,403);const stale=cmd('swap',room);await act(0,'swap');assert.equal(room.board.target,target);assert.equal((await call(users[0],stale)).status,409);await act(0,'custom',{left:'超级冷',right:'超级热'});assert.equal(room.board.target,target);assert.equal((await call(users[1],cmd('guess',room,{guess:target}))).status,403);
});
test('six rounds, both ready gate, target projection reverses, server scoring & idempotency',async()=>{
 let total=0;
 for(let i=0;i<6;i++){
  const sender=i%2,receiver=1-sender;const before=await sync(sender);assert.equal(before.board.round,i);const target=before.board.target;assert.ok(target>=14&&target<=86);const other=await sync(receiver);assert.equal(Object.hasOwn(other.board,'target'),false);
  await act(sender,'clue',{clue:i===0?'《三体》':'火锅'});for(const p of [0,1])assert.equal(Object.hasOwn((await sync(p)).board,'target'),false);
  assert.equal((await call(users[sender],cmd('guess',room,{guess:target}))).status,403);assert.equal((await call(users[receiver],{...cmd('guess',room,{guess:target}),target:10})).status,400);assert.equal((await call(users[receiver],cmd('guess',room,{guess:100.2}))).status,400);
  const offsets=[0,3,8,14,15,9],points=[4,4,3,2,0,2];const c=cmd('guess',room,{guess:target+offsets[i]});const first=await call(users[receiver],c);assert.equal(first.status,200);room=first.body;const retry=await call(users[receiver],c);assert.equal(retry.status,200);assert.equal(retry.body.version,room.version);assert.equal(room.board.history.length,i+1);assert.equal(room.board.history.at(-1).points,points[i]);total+=points[i];
  await act(0,'next');assert.equal(room.board.phase,'reveal');await act(1,'next');assert.equal(room.board.phase,i===5?'report':'sender');
 }
 assert.equal(room.board.history.reduce((n,r)=>n+r.points,0),total);assert.equal(room.board.history.length,6);
});
test('restart needs partner consent; close removes all secrets',async()=>{
 await act(0,'restart');assert.equal(room.restartRequested,true);await act(1,'restartDecline');assert.equal(room.board.phase,'report');await act(0,'restart');await act(1,'restartAccept');assert.equal(room.board,null);assert.equal(room.status,'waiting');assert.deepEqual(room.ready,[false,false]);await act(0,'leave');assert.equal(room.status,'closed');assert.equal((await sync(1)).board,null);
});
test('RLS: only own projection; raw state, writes and internal RPCs are denied',async()=>{
 const policies=await db.query("select relname,relrowsecurity from pg_class where relname like 'wavelength_%' and relkind='r'");assert.ok(policies.rows.every(r=>r.relrowsecurity));
 await db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users[2]]);assert.equal((await tx.query('select * from wavelength_player_views')).rows.length,0)});
 for(const sql of ['select * from wavelength_rooms','select * from wavelength_commands','select * from wavelength_rate_limits',"update wavelength_player_views set version=999","select wavelength_rate_limit('"+users[0]+"')"]){await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query(sql)}),/permission denied/)}
});
test('invalid auth and CORS are rejected',async()=>{assert.equal((await call(crypto.randomUUID(),{type:'sync',roomId:room.id})).status,401);const r=await handler(new Request('http://test',{method:'OPTIONS',headers:{Origin:'https://evil.invalid'}}));assert.equal(r.status,403)});
