// Real Supabase integration, opt-in only. Never substitutes the local fixture.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {config} from '../games/hanamikoji/online/config.js';
const require=createRequire(import.meta.url);
const {createClient}=require('../.openai/hanamikoji-tools/node_modules/@supabase/supabase-js');
const headers={apikey:config.publishableKey};
const settings=await (await fetch(config.url+'/auth/v1/settings',{headers})).json();
const endpoint=await fetch(config.url+'/functions/v1/'+config.functionName,{headers});
const blockers=[];
if(!settings.external?.anonymous_users)blockers.push('Anonymous Sign-Ins is disabled');
if(settings.disable_signup)blockers.push('Allow new users to sign up is disabled');
if(endpoint.status===404)blockers.push('hanamikoji-api is not deployed');
if(blockers.length){console.log('BLOCKED (real cloud E2E not run): '+blockers.join('; '));process.exitCode=2;}
else if(!process.argv.includes('--run'))console.log('Cloud prerequisites ready. Use --run after approval to create two anonymous test users and exercise the real API/Realtime.');
else{
 const clients=[0,1].map(()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
 let room=null;
 try{
  const sessions=await Promise.all(clients.map(async c=>{const {data,error}=await c.auth.signInAnonymously();if(error)throw error;return data.session;}));
  async function call(p,command,expected=200){const response=await fetch(config.url+'/functions/v1/'+config.functionName,{method:'POST',headers:{...headers,Authorization:'Bearer '+sessions[p].access_token,'Content-Type':'application/json'},body:JSON.stringify(command)});const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;}
  const command=(type,extra={})=>({type,requestId:crypto.randomUUID(),...(!room||['join','create'].includes(type)?{}:{roomId:room.id,version:room.version}),...extra});
  room=await call(0,command('create'));const code=room.code;
  const observed=[new Map(),new Map()];
  await Promise.all(clients.map((client,p)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Realtime subscription timeout')),15000);
   client.channel('hanamikoji-cloud-test-'+p).on('postgres_changes',{event:'*',schema:'public',table:'hanamikoji_player_views',filter:'user_id=eq.'+sessions[p].user.id},event=>{
    if(event.new.room_id===room.id){const own=event.new.snapshot;assert.equal(own.seat,p);observed[p].set(own.version,own);}
   }).subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error(status));}});
  })));
  room=await call(1,command('join',{code}));room=await call(0,command('ready',{ready:true}));room=await call(1,command('ready',{ready:true}));room=await call(0,command('start'));
  await call(1,command('act',{action:'secret',ids:[room.board.hand[0].id]}),403);
  for(let step=0;step<160;step++){
   const b=room.board;if(b.phase==='gameOver')break;
   const p=b.phase==='choice'?b.recipient:b.turn;
   const own=await call(p,{type:'sync',roomId:room.id});room=own;
   let c;
   if(b.phase==='roundResult')c=command('next');
   else if(b.phase==='choice')c=command('choose',{index:0});
   else{const action=['secret','discard','gift','compete'].find(a=>!b.players[p].used.includes(a));c=command('act',{action,ids:own.board.hand.slice(0,{secret:1,discard:2,gift:3,compete:4}[action]).map(c=>c.id)});}
   room=await call(p,c);const replay=await call(p,c);assert.equal(replay.version,room.version);
   const started=Date.now();while(!observed[1-p].has(room.version)&&Date.now()-started<12000)await new Promise(resolve=>setTimeout(resolve,100));
   assert.ok(observed[1-p].has(room.version),'opponent Realtime view missing');
   // Stay below the real per-user limit; this opt-in test takes a few minutes.
   await new Promise(resolve=>setTimeout(resolve,1800));
   if(step===159)assert.fail('no victory within 160 commands');
  }
  const reconnect=await call(1,{type:'sync',roomId:room.id});assert.equal(reconnect.seat,1);assert.equal(reconnect.version,room.version);
  room=await call(0,command('restart'));room=await call(1,command('restartAccept'));assert.equal(room.board,null);
  room=await call(0,command('leave'));assert.equal((await call(1,{type:'sync',roomId:room.id})).status,'closed');
  console.log('PASS REAL Supabase: anonymous Auth, API authorization, all actions, idempotency, victory, per-owner Realtime, sync/restart/exit.');
 }finally{for(const client of clients)await client.removeAllChannels();}
}
