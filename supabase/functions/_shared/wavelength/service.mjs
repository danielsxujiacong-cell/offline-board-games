import questions from './questions.json' with {type:'json'};
export const categories=[...new Set(questions.map(r=>r[0]))];
export class Fault extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status}}
const requireRule=(ok,code,status=400)=>{if(!ok)throw new Fault(code,status)};
const text=(value,max,code)=>{requireRule(typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\x00-\x1f]/.test(value),code);return value.trim()};
export const secureRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function roomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:10},()=>alphabet[Math.floor(secureRandom()*32)]).join('');}
export function createRoom(actor,command){
 const name=text(command.name,12,'invalid_name');
 requireRule(Array.isArray(command.packs)&&command.packs.length>0&&command.packs.length<=6&&command.packs.every(c=>categories.includes(c))&&new Set(command.packs).size===command.packs.length,'invalid_packs');
 return {id:crypto.randomUUID(),code:roomCode(),version:0,users:[actor,null],names:[name,null],packs:[...command.packs],ready:[false,false],status:'waiting',restartRequested:false,game:1,state:null,expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()};
}
export function seat(room,actor){const p=room.users.indexOf(actor);requireRule(p>=0,'not_member',403);return p}
function draw(s,rng){requireRule(s.deck.length>0,'deck_empty');const [category,left,right]=questions[s.deck.pop()];s.prompt={category,left,right};s.clue=''}
function beginRound(s,rng){s.phase='sender';s.target=14+Math.floor(rng()*73);s.guess=null;s.nextReady=[false,false];draw(s,rng)}
function newGame(packs,rng){const deck=questions.flatMap(([c],i)=>packs.includes(c)?[i]:[]);for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}const s={round:0,deck,history:[]};beginRound(s,rng);return s}
export function transition(original,actor,c,rng=secureRandom){
 const room=structuredClone(original);requireRule(Date.parse(room.expiresAt)>Date.now(),'room_expired',410);requireRule(room.status!=='closed','room_closed',410);
 if(c.type==='join'){if(room.users.includes(actor))return room;requireRule(room.status==='waiting'&&room.users[1]===null,'room_unavailable',409);room.users[1]=actor;room.names[1]=text(c.name,12,'invalid_name');room.ready=[false,false];return room}
 const p=seat(room,actor);
 if(c.type==='leave'){room.status='closed';room.state=null;room.ready=[false,false];room.restartRequested=false;return room}
 if(c.type==='ready'){requireRule(room.status==='waiting'&&typeof c.ready==='boolean','invalid_ready');room.ready[p]=c.ready;return room}
 if(c.type==='start'){requireRule(p===0,'host_only',403);requireRule(room.status==='waiting'&&room.users[1]&&room.ready.every(Boolean),'players_not_ready',409);room.state=newGame(room.packs,rng);room.status='playing';return room}
 if(c.type==='restart'){requireRule(p===0&&room.status==='playing','host_only',403);room.restartRequested=true;return room}
 if(c.type==='restartAccept'||c.type==='restartDecline'){requireRule(p===1&&room.restartRequested,'no_restart_request',409);if(c.type==='restartAccept'){room.state=null;room.status='waiting';room.ready=[false,false];room.game++}room.restartRequested=false;return room}
 requireRule(room.status==='playing'&&room.state,'no_game',409);const s=room.state;
 if(['swap','custom','clue'].includes(c.type)){requireRule(s.phase==='sender'&&p===s.round%2,'not_sender',403);
  if(c.type==='swap')draw(s,rng);
  if(c.type==='custom'){const left=text(c.left,36,'invalid_spectrum'),right=text(c.right,36,'invalid_spectrum');requireRule(left!==right,'invalid_spectrum');s.prompt={left,right,category:'自定义'};s.clue=''}
  if(c.type==='clue'){s.clue=text(c.clue,40,'invalid_clue');s.phase='guess'}
 }else if(c.type==='guess'){
  requireRule(s.phase==='guess'&&p===1-s.round%2,'not_receiver',403);requireRule(Number.isInteger(c.guess)&&c.guess>=0&&c.guess<=100,'invalid_guess');s.guess=c.guess;const distance=Math.abs(s.target-s.guess),points=distance<=3?4:distance<=8?3:distance<=14?2:0;
  s.history.push({...s.prompt,clue:s.clue,target:s.target,guess:s.guess,points,sender:room.names[s.round%2]});s.phase='reveal';s.nextReady=[false,false];
 }else if(c.type==='next'){
  requireRule(s.phase==='reveal','round_not_finished',409);s.nextReady[p]=true;
  if(s.nextReady.every(Boolean)){s.round++;if(s.round===6)s.phase='report';else beginRound(s,rng)}
 }else throw new Fault('unknown_command');
 return room;
}
// Explicit per-player projection: never send deck order, UUIDs or the other player's hidden target.
export function snapshot(room,actor){
 const p=seat(room,actor),s=room.status==='closed'?null:room.state;
 const result={id:room.id,code:room.code,version:room.version,seat:p,isHost:p===0,status:room.status,ready:[...room.ready],members:room.users.map(Boolean),names:[...room.names],packs:[...room.packs],restartRequested:room.restartRequested,game:room.game,expiresAt:room.expiresAt};
 if(!s)return {...result,board:null};
 const board={round:s.round,phase:s.phase,sender:s.round%2,prompt:{...s.prompt},clue:s.clue,history:structuredClone(s.history),nextReady:[...s.nextReady]};
 if((s.phase==='sender'&&p===s.round%2)||['reveal','report'].includes(s.phase))board.target=s.target;
 if(['reveal','report'].includes(s.phase))board.guess=s.guess;
 return {...result,board};
}
const fields={create:['name','packs'],join:['code','name'],sync:[],ready:['ready'],start:[],leave:[],restart:[],restartAccept:[],restartDecline:[],swap:[],custom:['left','right'],clue:['clue'],guess:['guess'],next:[]};
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
      if(command.type==='create'){room=createRoom(actor,command);expected=-1;}
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
