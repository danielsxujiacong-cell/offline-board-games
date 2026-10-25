// LOCAL TEST FIXTURE ONLY: real PostgreSQL rules/RPCs, simulated Auth and Realtime transport.
// Binds loopback, has no production credentials, and cannot be used as the deployed backend.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {database} from './hanamikoji-db.mjs';
import {makeHandler} from '../supabase/functions/_shared/hanamikoji/service.mjs';
const require=createRequire(import.meta.url);
const {wsServer:WebSocketServer}=require(process.env.PLAYWRIGHT_UTILS||'C:/Users/weissblake/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/lib/utilsBundle.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function serve(port=8098){
 const {db,store}=await database(),tokens=new Map(),refresh=new Map();
 let base,handler;
 const issue=async(id=crypto.randomUUID())=>{
  await db.query('insert into auth.users(id) values($1) on conflict do nothing',[id]);
  const user={id,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:new Date().toISOString()};
  const payload={sub:id,role:'authenticated',is_anonymous:true,exp:Math.floor(Date.now()/1000)+3600};
  const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.test-'+crypto.randomUUID();
  const r=crypto.randomUUID(),session={access_token:token,refresh_token:r,token_type:'bearer',expires_in:3600,expires_at:payload.exp,user};tokens.set(token,user);refresh.set(r,id);return session;
 };
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,base),body=await new Promise(resolve=>{let s='';req.on('data',chunk=>s+=chunk);req.on('end',()=>resolve(s));});
   const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
   if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(url.pathname==='/auth/v1/signup'){json(await issue());return;}
   if(url.pathname==='/auth/v1/token'){const id=refresh.get(JSON.parse(body).refresh_token);json(id?await issue(id):{error:'invalid_refresh_token'},id?200:401);return;}
   if(url.pathname==='/auth/v1/user'){const user=tokens.get((req.headers.authorization||'').slice(7));json(user||{error:'unauthorized'},user?200:401);return;}
   if(url.pathname==='/functions/v1/hanamikoji-api'){
    const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})}));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
   }
   if(url.pathname==='/games/hanamikoji/online/config.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(`export const config={url:${JSON.stringify(base)},publishableKey:'test-publishable',functionName:'hanamikoji-api'};`);return;}
   const relative=decodeURIComponent(url.pathname).replace(/^\//,'');let file=path.resolve(root,relative||'index.html');
   if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
   const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await fs.readFile(file));
  }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'test_fixture_error'}));console.error(e.message);}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 let seed=1;handler=makeHandler({store,origins:[base],authenticate:async token=>tokens.get(token)?.id,rng:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}});
 const wss=new WebSocketServer({server,path:'/realtime/v1/websocket'});
 const peers=new Set();
 wss.on('connection',ws=>{
  const peer={ws,channels:new Map()};peers.add(peer);
  const emit=(topic,event,payload,ref=null,joinRef=null,array=false)=>ws.send(JSON.stringify(array?[joinRef,ref,topic,event,payload]:{topic,event,payload,ref,join_ref:joinRef}));
  peer.emit=emit;
  ws.on('message',raw=>{
   const parsed=JSON.parse(raw.toString()),array=Array.isArray(parsed);
   const message=array?{join_ref:parsed[0],ref:parsed[1],topic:parsed[2],event:parsed[3],payload:parsed[4]}:parsed;
   const {topic,event,payload,ref,join_ref}=message;
   if(event==='phx_join'){
    const user=tokens.get(payload.access_token),specs=payload.config?.postgres_changes||[];
    if(!user){emit(topic,'phx_reply',{status:'error',response:{}},ref,join_ref,array);return;}
    peer.channels.set(topic,{user,spec:specs.find(s=>s.event==='UPDATE')||specs[0],updateId:Math.max(1,specs.findIndex(s=>s.event==='UPDATE')+1),array,joinRef:join_ref||ref});
    emit(topic,'phx_reply',{status:'ok',response:{postgres_changes:specs.map((s,i)=>({...s,id:i+1}))}},ref,join_ref,array);
   }else if(event==='heartbeat')emit(topic,'phx_reply',{status:'ok',response:{}},ref,join_ref,array);
   else if(event==='phx_leave'){peer.channels.delete(topic);emit(topic,'phx_reply',{status:'ok',response:{}},ref,join_ref,array);}
  });
  ws.on('close',()=>peers.delete(peer));
 });
 store.listeners.add(async roomId=>{
  const rows=(await db.query('select * from public.hanamikoji_player_views where room_id=$1',[roomId])).rows;
  for(const peer of peers)for(const [topic,c] of peer.channels){
   const row=rows.find(row=>row.user_id===c.user.id);
   if(!row||c.spec?.table!=='hanamikoji_player_views'||c.spec?.filter!=='user_id=eq.'+c.user.id)continue;
   if(peer.ws.readyState===1)peer.emit(topic,'postgres_changes',{ids:[c.updateId],data:{columns:[{name:'room_id',type:'uuid'},{name:'user_id',type:'uuid'},{name:'version',type:'int8'},{name:'snapshot',type:'jsonb'},{name:'expires_at',type:'timestamptz'}],schema:'public',table:'hanamikoji_player_views',commit_timestamp:new Date().toISOString(),type:'UPDATE',record:row,old_record:{},errors:null}},null,c.joinRef,c.array);
  }
 });
 return {base,db,store,close:async()=>{for(const p of peers)p.ws.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));await db.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const fixture=await serve();console.log('LOCAL SIMULATOR ONLY: '+fixture.base+'/games/hanamikoji/online/');console.log('Auth/Realtime are simulated; database and authoritative rules are real.');process.on('SIGINT',async()=>{await fixture.close();process.exit();});}
