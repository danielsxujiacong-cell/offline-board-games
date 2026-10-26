import {createClient} from './vendor/supabase.js';
import {config} from './config.js';
import {names,gifts,giftArt,portraitArt,labels} from '../art.js';
import {VALUES,ACTIONS} from '../engine.js';

const app=document.querySelector('#online-app'),status=document.querySelector('#connection'),error=document.querySelector('#error');
const storageKey='hanamikoji-online-room-v1';
const supabase=createClient(config.url,config.publishableKey,{auth:{storageKey:'hanamikoji-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let user=null,room=null,channel=null,busy=false,connected=navigator.onLine,selected=[],action='',syncing=false;
const messages={unauthorized:'登录已失效，请刷新重新连接。',not_member:'你不是这个房间的玩家。',version_conflict:'牌局已更新，已重新同步，请确认后再操作。',room_unavailable:'房间不存在、已满或不可加入。',not_your_turn:'现在不是你的回合。',illegal_action:'所选行动或牌不合法，请重新选择。',illegal_choice:'请选择有效的公开选项。',players_not_ready:'需两位玩家都准备后，由房主开始。',room_expired:'房间已过期，请创建新房间。',room_closed:'房间已关闭。',rate_limited:'操作过于频繁，请稍后再试。'};
function showError(message){error.textContent=message;}
function setConnection(text){status.textContent=text;}
const invite=()=>{const url=new URL(location.href);url.hash=room.code;url.search='';return url.href;};
function apply(snapshot){if(room&&room.id===snapshot.id&&room.version>=snapshot.version)return false;room=snapshot;selected=[];action='';localStorage.setItem(storageKey,room.id);render();return true;}
async function session(){const {data,error}=await supabase.auth.getSession();if(error)throw error;if(data.session)return data.session;const login=await supabase.auth.signInAnonymously();if(login.error)throw new Error('项目尚未开启匿名登录／注册，或需要 CAPTCHA。请按联机配置文档启用后重试。');return login.data.session;}
async function call(command){
  const auth=await session();user=auth.user;
  const response=await fetch(`${config.url}/functions/v1/${config.functionName}`,{method:'POST',cache:'no-store',headers:{apikey:config.publishableKey,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify(command)});
  let result;try{result=await response.json();}catch{throw new Error('联机接口尚未部署或响应异常；单机版仍可使用。');}
  if(!response.ok){const err=new Error(messages[result.error]||`联机请求失败：${result.error||response.status}`);err.code=result.error;throw err;}
  return result;
}
async function sync(){
  if(syncing||!room||!navigator.onLine)return;syncing=true;
  const id=room.id;
  try{const value=await call({type:'sync',roomId:id});if(room?.id!==id)return;const wasConnected=connected;connected=true;const changed=apply(value);if(!changed&&!wasConnected)render();setConnection('已连接 · 棋盘已同步');}
  catch(e){connected=false;setConnection('连接中断 · 等待重试');showError(e.message);render();}
  finally{syncing=false;}
}
async function subscribe(){
  if(channel)await supabase.removeChannel(channel);
  channel=supabase.channel('hanamikoji-owner-'+user.id+'-'+room.id)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'hanamikoji_player_views',filter:'user_id=eq.'+user.id},payload=>{if(payload.new.room_id===room?.id)apply(payload.new.snapshot);})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'hanamikoji_player_views',filter:'user_id=eq.'+user.id},payload=>{if(payload.new.room_id===room?.id)apply(payload.new.snapshot);})
   .subscribe(state=>{if(state==='SUBSCRIBED'){setConnection('实时连接已建立');void sync();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state))setConnection('实时连接重试中 · 正在定期同步');});
}
async function send(type,extra={}){
  if(busy||!navigator.onLine)return;busy=true;showError('');render();
  const command={type,requestId:crypto.randomUUID(),...(['create','join'].includes(type)?{}:{roomId:room.id,version:room.version}),...extra};
  try{
    // One retry uses the SAME key. A response lost after commit cannot duplicate a turn.
    let result;try{result=await call(command);}catch(e){if(e instanceof TypeError&&navigator.onLine)result=await call(command);else throw e;}
    apply(result);connected=true;setConnection('已连接 · 棋盘已同步');
    if(type==='create'||type==='join'){location.hash=room.code;await subscribe();}
  }catch(e){showError(e.message);if(e.code==='version_conflict')await sync();}
  finally{busy=false;render();}
}
function card(c,interactive=false){const order=selected.indexOf(c.id);return `<button class="card ${order>=0?'selected':''}" style="--tone:var(--c${c.type})" ${interactive?`data-card="${c.id}" aria-pressed="${order>=0}"`:'disabled'}><span class="card-corner">${names[c.type]}<em>${VALUES[c.type]}</em></span>${giftArt(c.type)}<b>${gifts[c.type]}</b><span class="card-family">${names[c.type]}之礼 · ${VALUES[c.type]} 魅力</span>${order>=0?`<small>第 ${order+1} 张${action==='compete'?' · '+(order<2?'甲组':'乙组'):''}</small>`:''}</button>`;}
function board(b){return `<section class="scores">${b.scores.map((s,p)=>`<div class="player p${p} ${p===room.seat?'current':''}"><b>玩家 ${p+1}${p===room.seat?' · 你':''}</b><strong>${s.points} <small>魅力</small> / ${s.count} <small>位</small></strong><span>${Object.keys(ACTIONS).map(a=>`${b.players[p].used.includes(a)?'✓':'○'}${labels[a]}`).join('　')}</span></div>`).join('')}</section><div class="board" aria-label="七位艺伎棋盘">${VALUES.map((n,i)=>`<article style="--tone:var(--c${i})"><div class="tally">${b.players[0].counts[i]}</div><div class="portrait">${portraitArt(i)}<h2>${names[i]}</h2><b>${n}</b></div><div class="owner ${b.markers[i]===null?'neutral':'p'+b.markers[i]}">${b.markers[i]===null?'未倾心':'玩家 '+(b.markers[i]+1)}</div><div class="tally">${b.players[1].counts[i]}</div></article>`).join('')}</div><p class="hint">上排：玩家 1 · 下排：玩家 2${['roundResult','gameOver'].includes(b.phase)?' · 已含密约':' · 密约尚未计入'}</p>`;}
function gameContent(b){
  const myTurn=b.phase==='action'&&b.turn===room.seat;
  const mine=myTurn&&!busy&&connected;
  let html='';
  if(b.phase==='gameOver')html=`<h2>玩家 ${b.winner+1} 获胜${b.winner===room.seat?' · 恭喜你':''}</h2><p>${b.scores[b.winner].points>=11?'魅力达到 11 分':'获得至少 4 位艺伎'}。</p>`;
  else if(b.phase==='roundResult')html='<h2>本轮结算 · 尚未分胜负</h2><p>支持标记保留，下一轮交换先手。</p><button class="primary" data-send="next">开始下一轮</button>';
  else if(b.phase==='choice'){
    const choosing=b.recipient===room.seat,groups=b.pending.action==='gift'?b.pending.cards.map(c=>[c]):[b.pending.cards.slice(0,2),b.pending.cards.slice(2)];
    html=`<h2>${choosing?'请你选择':'等待对手选择'} · ${labels[b.pending.action]}</h2><p>所选${b.pending.action==='gift'?'一张':'一组'}归选择方，其余归行动方。</p><div class="choices">${groups.map((g,i)=>`<div><div class="hand">${g.map(c=>card(c)).join('')}</div>${choosing?`<button class="primary" data-choice="${i}">选择${b.pending.action==='gift'?'第 '+(i+1)+' 张':i===0?'甲组':'乙组'}</button>`:''}</div>`).join('')}</div>`;
  }else html=`<h2>${myTurn?'轮到你了':'等待玩家 '+(b.turn+1)+' 行动'}</h2><p>第 ${b.round} 轮 · 牌库 ${b.deck} 张${myTurn?' · 已由服务端摸牌':''}</p>`;
  if(myTurn)html+=`<div class="actions">${Object.entries(ACTIONS).map(([a,n])=>`<button data-action="${a}" class="${a===action?'active':''}" ${!mine||b.players[room.seat].used.includes(a)?'disabled':''}>${labels[a]}<small>${n} 张 ${b.players[room.seat].used.includes(a)?'· 已用':''}</small></button>`).join('')}</div><p>${action==='compete'?'依次选 4 张，前两张为甲组、后两张为乙组。':action?`选择 ${ACTIONS[action]} 张用于${labels[action]}。`:'先选择行动，再选择手牌。'}</p>`;
  if(!['roundResult','gameOver'].includes(b.phase))html+=`<div class="your-hand"><h3>你的手牌 · ${b.hand.length} 张</h3><div class="hand">${b.hand.map(c=>card(c,mine)).join('')}</div>${myTurn?`<button id="commit" class="primary" ${!mine||!action||selected.length!==ACTIONS[action]?'disabled':''}>确认${labels[action]||'行动'} · ${selected.length}/${ACTIONS[action]||0}</button>`:''}</div>`;
  return html;
}
function render(){
  if(!user){app.innerHTML='<section class="lobby"><h2>在线双人花宴</h2><p>正在连接匿名身份。若项目尚未开启匿名登录，请先完成配置。</p><button id="login">重试连接</button></section>';app.querySelector('#login').onclick=boot;return;}
  if(!room){const code=/^[A-HJ-NP-Z2-9]{10}$/.test(location.hash.slice(1))?location.hash.slice(1):'';app.innerHTML=`<section class="lobby"><h2>共赴一场花宴</h2><p>每人使用自己的设备。创建房间后，把房间码或邀请链接交给对手。</p><button class="primary" id="create" ${busy?'disabled':''}>创建房间</button><label for="code">加入房间 · 10 位房间码</label><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10" value="${code}" placeholder="例如 ABCD234567"><div class="row"><button id="join" ${busy?'disabled':''}>加入房间</button></div></section>`;app.querySelector('#create').onclick=()=>send('create');app.querySelector('#join').onclick=()=>send('join',{code:app.querySelector('#code').value.trim().toUpperCase()});return;}
  const b=room.board;
  const lobby=`<section class="lobby"><h2>等待花宴开席</h2><p>玩家 1：${room.ready[0]?'已准备':'未准备'} · 玩家 2：${!room.members[1]?'等待加入':room.ready[1]?'已准备':'未准备'}</p><div class="row"><button data-send="ready">${room.ready[room.seat]?'取消准备':'我准备好了'}</button>${room.isHost?`<button class="primary" data-send="start" ${!room.members[1]||!room.ready.every(Boolean)?'disabled':''}>开始游戏</button>`:''}</div></section>`;
  let content=room.status==='closed'?'<section class="lobby"><h2>房间已关闭</h2><p>房主或玩家已主动退出，可以创建新房间。</p></section>':lobby;
  if(b){
    content=`<div class="round">第 ${b.round} 轮 <span>玩家 ${b.starter+1} 先手 · 版本 ${room.version}</span></div>${board(b)}<section class="play">${gameContent(b)}</section><details class="own-private"><summary>查看自己的密约与取舍牌</summary><p>密约 · 轮末计分</p><div class="hand">${b.secret.map(c=>card(c)).join('')||'尚未使用密约'}</div><p>取舍 · 不计分</p><div class="hand">${b.discard.map(c=>card(c)).join('')||'尚未使用取舍'}</div></details>`;
    if(room.isHost&&!room.restartRequested)content+='<div class="room-tools"><button id="restart">请求重新开局</button></div>';
    if(room.restartRequested)content+=`<section class="restart-request"><p>${room.isHost?'已请求重新开局，等待对手确认。':'房主请求重新开局，同意后当前进度会清空。'}</p>${!room.isHost?'<button data-send="restartAccept">同意重新开局</button><button data-send="restartDecline">继续当前对局</button>':''}</section>`;
  }
  app.innerHTML=`<div class="room-tools"><span class="room-code">房间 ${room.code}</span><span>玩家 ${room.seat+1} · ${room.isHost?'房主':'来宾'} · 第 ${room.game} 局</span><button id="copy">复制邀请链接</button><button id="leave">${room.status==='closed'?'返回大厅':'退出并关闭房间'}</button></div><a class="invite-link" href="${invite()}">${invite()}</a>${content}`;
  app.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(invite());setConnection('邀请链接已复制');}catch{setConnection('请长按上方链接复制。');}};
  app.querySelector('#leave').onclick=async()=>{if(room.status!=='closed'&&!confirm('确定退出并关闭房间？双方将无法继续此局。'))return;if(room.status!=='closed')await send('leave');if(room.status!=='closed')return;localStorage.removeItem(storageKey);location.hash='';room=null;selected=[];action='';if(channel)await supabase.removeChannel(channel);render();};
  app.querySelector('#restart')?.addEventListener('click',()=>{if(confirm('请求重新开局？需对手同意后才会清空当前对局。'))void send('restart');});
  app.querySelectorAll('[data-send]').forEach(button=>button.onclick=()=>send(button.dataset.send,button.dataset.send==='ready'?{ready:!room.ready[room.seat]}:{}));
  app.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>{action=button.dataset.action;selected=[];render();});
  app.querySelectorAll('[data-card]').forEach(button=>button.onclick=()=>{const id=button.dataset.card;if(selected.includes(id))selected=selected.filter(x=>x!==id);else if(action&&selected.length<ACTIONS[action])selected.push(id);render();});
  app.querySelector('#commit')?.addEventListener('click',()=>send('act',{action,ids:[...selected]}));
  app.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>send('choose',{index:Number(button.dataset.choice)}));
  if(busy||!connected)app.querySelectorAll('button:not(#copy):not(#leave)').forEach(button=>button.disabled=true);
}
async function boot(){
  showError('');render();
  try{const auth=await session();user=auth.user;connected=navigator.onLine;setConnection('匿名身份已连接');const id=localStorage.getItem(storageKey);if(id){try{apply(await call({type:'sync',roomId:id}));await subscribe();}catch(e){if(['not_member','room_unavailable','room_expired'].includes(e.code))localStorage.removeItem(storageKey);else{connected=false;setConnection('连接中断 · 房间已保留，请重新同步');}showError(e.message);}}render();}
  catch(e){setConnection('在线模式配置未就绪 · 单机版不受影响');showError(e.message);render();}
}
document.querySelector('#refresh').onclick=()=>room?sync():boot();
window.addEventListener('offline',()=>{connected=false;setConnection('已断网 · 操作暂停，重连后恢复');render();});
window.addEventListener('online',()=>{connected=true;if(room)void sync();else void boot();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){app.replaceChildren();}else if(room){render();void sync();}else void boot();});
setInterval(()=>{if(room&&!document.hidden&&navigator.onLine)void sync();},5000);
void boot();
