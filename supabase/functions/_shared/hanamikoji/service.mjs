import {newGame,accept,act,choose,settle,nextRound,counts,scores} from './engine.js';

export class Fault extends Error {
  constructor(code,status=400){super(code);this.code=code;this.status=status;}
}
const requireRule=(ok,code,status=400)=>{if(!ok)throw new Fault(code,status);};
export const secureRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function roomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:10},()=>alphabet[Math.floor(secureRandom()*32)]).join('');}
export function createRoom(actor){
  return {id:crypto.randomUUID(),code:roomCode(),version:0,users:[actor,null],ready:[false,false],status:'waiting',restartRequested:false,game:1,state:null,
    expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()};
}
export function seat(room,actor){const p=room.users.indexOf(actor);requireRule(p>=0,'not_member',403);return p;}
function advance(state){
  if(state.phase==='roundEnd')settle(state);
  if(state.phase==='handoff')accept(state); // Exactly once, atomically with the previous action.
}
export function transition(original,actor,command,rng=secureRandom){
  const room=structuredClone(original),type=command.type;
  requireRule(Date.parse(room.expiresAt)>Date.now(),'room_expired',410);
  requireRule(room.status!=='closed','room_closed',410);
  if(type==='join'){
    requireRule(room.status==='waiting','room_unavailable',409);
    if(room.users.includes(actor))return room;
    requireRule(room.users[1]===null,'room_unavailable',409);
    room.users[1]=actor;room.ready=[false,false];return room;
  }
  const p=seat(room,actor);
  if(type==='leave'){room.status='closed';room.state=null;room.ready=[false,false];return room;}
  if(type==='ready'){
    requireRule(room.status==='waiting'&&typeof command.ready==='boolean','invalid_ready');
    room.ready[p]=command.ready;return room;
  }
  if(type==='start'){
    requireRule(p===0,'host_only',403);
    requireRule(room.status==='waiting'&&room.users[1]&&room.ready.every(Boolean),'players_not_ready',409);
    room.state=newGame(rng);advance(room.state);room.status='playing';return room;
  }
  if(type==='restart'){
    requireRule(p===0,'host_only',403);requireRule(room.status==='playing','no_game',409);
    room.restartRequested=true;return room;
  }
  if(type==='restartAccept'||type==='restartDecline'){
    requireRule(p===1&&room.restartRequested,'no_restart_request',409);
    if(type==='restartAccept'){room.state=null;room.status='waiting';room.ready=[false,false];room.game++;}
    room.restartRequested=false;return room;
  }
  requireRule(room.status==='playing'&&room.state,'no_game',409);
  const s=room.state;
  if(type==='act'){
    requireRule(s.phase==='action'&&s.turn===p,'not_your_turn',403);
    requireRule(typeof command.action==='string'&&Array.isArray(command.ids)&&command.ids.length<=4&&command.ids.every(id=>typeof id==='string'&&id.length<24),'invalid_cards');
    try{act(s,command.action,command.ids);}catch{throw new Fault('illegal_action');}
    advance(s);
  }else if(type==='choose'){
    requireRule(s.phase==='choice'&&s.recipient===p,'not_your_choice',403);
    try{choose(s,command.index);}catch{throw new Fault('illegal_choice');}
    advance(s);
  }else if(type==='next'){
    requireRule(s.phase==='roundResult','round_not_finished',409);room.state=nextRound(s,rng);advance(room.state);
  }else throw new Fault('unknown_command');
  return room;
}

// Explicit allowlist. Never return the authoritative room/state object to a client.
export function snapshot(room,actor){
  const p=seat(room,actor),s=room.status==='closed'?null:room.state;
  const result={id:room.id,code:room.code,version:room.version,seat:p,isHost:p===0,status:room.status,ready:[...room.ready],
    members:room.users.map(Boolean),restartRequested:room.restartRequested,game:room.game,expiresAt:room.expiresAt};
  if(!s)return {...result,board:null};
  const reveal=['roundResult','gameOver'].includes(s.phase);
  return {...result,board:{round:s.round,starter:s.starter,phase:s.phase,turn:s.turn,recipient:s.recipient,winner:s.winner,markers:[...s.markers],scores:scores(s.markers),deck:s.deck.length,
    players:s.players.map(player=>({counts:counts(player,reveal),used:[...player.used],handSize:player.hand.length})),
    hand:structuredClone(s.players[p].hand),secret:structuredClone(s.players[p].secret),discard:structuredClone(s.players[p].discard),
    pending:s.phase==='choice'?{action:s.pending.action,cards:structuredClone(s.pending.cards)}:null}};
}
const fields={create:[],join:['code'],sync:[],ready:['ready'],start:[],leave:[],restart:[],restartAccept:[],restartDecline:[],act:['action','ids'],choose:['index'],next:[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validate(c){
  requireRule(c&&typeof c==='object'&&!Array.isArray(c)&&Object.hasOwn(fields,c.type),'invalid_command');
  const allowed=new Set(['type','requestId','roomId','version',...fields[c.type]]);
  requireRule(Object.keys(c).every(key=>allowed.has(key)),'unexpected_field');
  if(c.type!=='sync')requireRule(uuid.test(c.requestId||''),'invalid_request_id');
  if(!['create','join'].includes(c.type))requireRule(uuid.test(c.roomId||''),'invalid_room_id');
  if(!['create','join','sync'].includes(c.type))requireRule(Number.isSafeInteger(c.version)&&c.version>=0,'invalid_version');
  if(c.type==='join')requireRule(/^[A-HJ-NP-Z2-9]{10}$/.test(c.code||''),'invalid_room_code');
}
export async function fingerprint(command){const text=JSON.stringify(Object.fromEntries(Object.keys(command).sort().map(key=>[key,command[key]])));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');}

export function makeHandler({store,authenticate,origins,rng=secureRandom}){
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
    if(origin&&origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
    const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(origin&&!origins.includes(origin))return respond({error:'origin_not_allowed'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return respond({error:'method_not_allowed'},405);
    try{
      const bearer=request.headers.get('authorization')||'';
      requireRule(/^Bearer [^\s]+$/.test(bearer),'unauthorized',401);
      const actor=await authenticate(bearer.slice(7));requireRule(uuid.test(actor||''),'unauthorized',401);
      await store.rateLimit(actor);
      const reader=request.body?.getReader(),chunks=[];let size=0;
      if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Fault('request_too_large',413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const text=new TextDecoder().decode(bytes);
      let command;try{command=JSON.parse(text);}catch{throw new Fault('invalid_json');}validate(command);
      if(command.type==='sync'){
        const room=await store.getRoom(command.roomId);requireRule(room,'room_unavailable',404);seat(room,actor);
        requireRule(Date.parse(room.expiresAt)>Date.now(),'room_expired',410);return respond(snapshot(room,actor));
      }
      const hash=await fingerprint(command),receipt=await store.receipt(actor,command.requestId);
      if(receipt){requireRule(receipt.fingerprint===hash,'request_id_reused',409);const current=await store.getRoom(receipt.room_id);requireRule(current,'room_unavailable',404);return respond(snapshot(current,actor));}
      let room,expected;
      if(command.type==='create'){room=createRoom(actor);expected=-1;}
      else{
        room=command.type==='join'?await store.findCode(command.code):await store.getRoom(command.roomId);
        requireRule(room,'room_unavailable',404);
        if(command.type!=='join')seat(room,actor);
        expected=command.type==='join'?room.version:command.version;
        requireRule(expected===room.version,'version_conflict',409);
        room=transition(room,actor,command,rng);room.version=expected+1;
      }
      const views=room.users.filter(Boolean).map(user=>({user_id:user,snapshot:snapshot(room,user)}));
      const id=await store.commit({room,expected,actor,requestId:command.requestId,hash,views});
      const committed=await store.getRoom(id);return respond(snapshot(committed,actor));
    }catch(e){return respond({error:e instanceof Fault?e.code:'server_error'},e instanceof Fault?e.status:500);}
  };
}
