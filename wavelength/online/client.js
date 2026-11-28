import {createClient} from '../../games/hanamikoji/online/vendor/supabase.js';
import {config} from './config.js';
import {packs,PACK_META,DEFAULT_OFF_PACKS,roundComment,rating,readBest,recordBest} from '../prompts.js';
import {bindSpectrum} from '../spectrum.js';
import {showReportImage} from '../report.js';

const app=document.querySelector('#online-app'),status=document.querySelector('#connection'),error=document.querySelector('#error');
const $=s=>app.querySelector(s),escape=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=createClient(config.url,config.publishableKey,{auth:{storageKey:'wavelength-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

let user=null,room=null,channel=null,liveChannel=null,liveReady=false,busy=false,syncing=false,pending=null,connected=navigator.onLine,subscribedRoom=null;
let maskPeek=false,showHint=false,ghostGuess=null,partnerTyping=false,typingTimer=null,lastRevealKey='',recordedGame=null,danmakuSlot=0;
const roomKey='wavelength-online-room-v1',pendingKey='wavelength-online-pending-v1',prefsKey='wavelength-online-prefs-v3',legacyPrefsKey='wavelength-online-prefs-v2';

const messages={
  unauthorized:'身份已失效，请点击重新同步。',
  not_member:'此房间属于其他玩家，无法查看。',
  version_conflict:'对局刚刚更新，已同步最新状态。',
  request_id_reused:'请求编号重复，请刷新后重试。',
  room_unavailable:'房间不存在、已满或已关闭，请核对房间码。',
  not_sender:'现在不是你的出题阶段。',
  not_receiver:'现在不是你的猜题阶段。',
  invalid_name:'昵称需要 1 至 12 字。',
  invalid_packs:'请至少选择一类话题。',
  invalid_mode:'无效的回合模式。',
  invalid_spectrum:'请填写不同的左右端点，每端最多 36 字。',
  invalid_clue:'请填写 1 至 40 字的线索。',
  invalid_guess:'请选择 0 至 100 的整数位置。',
  game_not_finished:'本局尚未结束或已进入下一局，请重新同步。',
  cannot_finish:'当前阶段还不能提前结算。',
  room_expired:'房间超过 24 小时已过期，请重新建房。',
  room_closed:'对方已退出，房间已关闭。',
  rate_limited:'操作太频繁，请稍等几秒。',
  deck_empty:'所选话题已抽完，可以自定义光谱。',
};

const REACTIONS=[
  {id:'mind',label:'🤯 读心术!'},
  {id:'wild',label:'😂 脑回路清奇'},
  {id:'close',label:'🤌 差一点点!'},
  {id:'more',label:'🔥 再来一把!'},
];

const storage={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}},remove:k=>{try{localStorage.removeItem(k)}catch{}}};
const readPrefs=()=>{
  try{
    const cur=storage.get(prefsKey);
    if(cur)return JSON.parse(cur)||{};
    const old=JSON.parse(storage.get(legacyPrefsKey)||'null');
    if(old&&typeof old==='object'){
      const migrated={...(old.mode?{mode:old.mode}:{})};
      storage.set(prefsKey,JSON.stringify(migrated));
      return migrated;
    }
    return {};
  }catch{return {}}
};
const savePrefs=p=>storage.set(prefsKey,JSON.stringify({...readPrefs(),...p}));
const randomNickname=()=>['糯米团子','芝麻汤圆','小熊软糖','橘子汽水','奶油泡芙','焦糖布丁','摸鱼小猫','打盹小熊'][Math.floor(Math.random()*8)];
let nickname=storage.get('wavelength-online-name')?.trim()||randomNickname();
let lobbyTab=/^[A-HJ-NP-Z2-9]{10}$/.test(location.hash.slice(1))?'join':'create';

function rememberPending(command){pending=command;try{if(command)sessionStorage.setItem(pendingKey,JSON.stringify(command));else sessionStorage.removeItem(pendingKey)}catch{}}
function draftKey(){return room?`wavelength-draft:${room.id}:${room.game}:${room.board?.round}:${room.board?.phase}`:''}
function readDraft(){try{return JSON.parse(sessionStorage.getItem(draftKey()))||{}}catch{return {}}}
function draft(value){try{sessionStorage.setItem(draftKey(),JSON.stringify({...readDraft(),...value}))}catch{}}
function hide(){document.querySelector('#secret-track')?.classList.add('hidden-target')}

function showToast(text,fromPartner=false){
  const el=document.createElement('div');
  el.className=`reaction-toast${fromPartner?' partner':''}`;
  const slots=['22%','30%','38%'];
  el.style.bottom=slots[danmakuSlot%slots.length];
  danmakuSlot++;
  el.textContent=text;
  document.body.append(el);
  setTimeout(()=>el.remove(),2100);
}

async function copyText(text){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return true}catch{}
  }
  const ta=document.createElement('textarea');
  ta.value=text;ta.setAttribute('readonly','');
  ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(ta);ta.focus();ta.select();
  let ok=false;
  try{ok=document.execCommand('copy')}catch{}
  ta.remove();
  return ok;
}

function showWeChatGuide(){
  document.querySelector('#wx-share-guide')?.remove();
  const guide=document.createElement('div');
  guide.id='wx-share-guide';guide.className='wx-guide';guide.setAttribute('role','dialog');guide.setAttribute('aria-label','微信分享引导');
  guide.innerHTML='<div class="wx-guide-arrow" aria-hidden="true">↗</div><div class="wx-guide-card"><h3>发给微信搭档，一起对频！</h3><p>1. 点击右上角 <strong>···</strong> 直接转发给微信好友。</p><p>2. 邀请文案与链接也已自动复制，返回聊天窗直接粘贴也可以。</p><p class="small" style="opacity:.8">点击任意处关闭提示</p></div>';
  guide.onclick=()=>guide.remove();
  document.body.append(guide);
}

function inviteText(){
  return `〰️ 来和我玩「电波同步」测测脑回路！点链接直接进房（房间码 ${room.code}）：\n${invite()}`;
}

async function shareToWeChat(){
  const url=invite();
  const text=inviteText();
  const isWeChat=/micromessenger/i.test(navigator.userAgent);
  if(isWeChat){
    const copied=await copyText(text);
    status.textContent=copied?'请点右上角 ··· 转发（链接已复制）':'请点右上角 ··· 转发给微信好友';
    showWeChatGuide();
    return;
  }
  if(navigator.share){
    try{
      await navigator.share({title:'电波同步 · 邀请加入房间',text:`来和我玩「电波同步」测测脑回路！房间码：${room.code}`,url});
      status.textContent='已调起系统分享';
      return;
    }catch(e){
      if(e?.name==='AbortError')return;
    }
  }
  if(await copyText(text)){
    status.textContent='微信邀请文案已复制';
    showToast('✅ 邀请文案已复制，去微信粘贴即可');
  }else{
    status.textContent='请长按上方邀请链接复制';
  }
}

let sessionPromise=null;
async function session(){
  if(sessionPromise)return sessionPromise;
  sessionPromise=(async()=>{
    const {data,error:err}=await client.auth.getSession();
    if(err)throw err;
    if(data.session)return data.session;
    const login=await client.auth.signInAnonymously();
    if(login.error){
      throw new Error(login.error.status===429?'连接请求过多，请稍等一分钟后点击重新同步。':'匿名连接暂时失败，请点击重新同步。');
    }
    return login.data.session;
  })();
  try{return await sessionPromise}finally{sessionPromise=null}
}

async function call(command){
  const auth=await session();
  user=auth.user;
  const response=await fetch(config.url+'/functions/v1/'+config.functionName,{
    method:'POST',
    cache:'no-store',
    headers:{apikey:config.publishableKey,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},
    body:JSON.stringify(command),
  });
  let data;
  try{data=await response.json()}catch{throw new Error('服务器暂时无响应，请稍后重试。')}
  if(!response.ok){
    const e=new Error(messages[data.error]||'联机暂时失败，请重新同步。');
    e.code=data.error;e.status=response.status;throw e;
  }
  return data;
}

function apply(snapshot){
  connected=true;
  if(room&&room.id===snapshot.id&&room.version>=snapshot.version)return false;
  const prevPhase=room?.board?.phase,prevRound=room?.board?.round;
  room=snapshot;
  storage.set(roomKey,room.id);
  if(room.status!=='closed'){
    if(location.hash!=='#'+room.code)history.replaceState(null,'','#'+room.code);
    document.title=`电波同步 · 房间 ${room.code}`;
  }else{
    document.title='电波同步 · 双人联机';
  }
  if(room.board?.phase!==prevPhase||room.board?.round!==prevRound){
    ghostGuess=null;partnerTyping=false;showHint=false;maskPeek=false;
  }
  render();
  return true;
}

function broadcast(event,payload){
  if(!liveChannel){if(room)void subscribe();return}
  void liveChannel.send({type:'broadcast',event,payload});
}

let lastDialSent=0,pendingDialTimer=null,queuedDial=null;
function broadcastDial(val){
  const now=Date.now();
  if(now-lastDialSent>=90){
    lastDialSent=now;
    broadcast('dial',{value:val});
  }else{
    queuedDial=val;
    if(!pendingDialTimer){
      pendingDialTimer=setTimeout(()=>{
        pendingDialTimer=null;
        if(queuedDial!==null){
          lastDialSent=Date.now();
          broadcast('dial',{value:queuedDial});
          queuedDial=null;
        }
      },95);
    }
  }
}

let lastTypingSent=0;
function broadcastTyping(){
  const now=Date.now();
  if(now-lastTypingSent<1500)return;
  lastTypingSent=now;
  broadcast('typing',{});
}

async function subscribe(){
  if(!room||subscribedRoom===room.id)return;
  if(channel)await client.removeChannel(channel);
  if(liveChannel)await client.removeChannel(liveChannel);
  subscribedRoom=room.id;
  const id=room.id;

  channel=client.channel('wavelength-'+id+'-'+user.id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'wavelength_player_views',filter:'user_id=eq.'+user.id},payload=>{
      if(payload.new?.user_id===user.id&&payload.new.snapshot&&room?.id===id)apply(payload.new.snapshot);
    })
    .subscribe(state=>{
      if(room?.id!==id)return;
      status.textContent=state==='SUBSCRIBED'?'实时已连接 · 指针与结果秒同步':'连接恢复中 · 自动保底同步';
      if(state==='SUBSCRIBED')void sync();
    });

  liveChannel=client.channel('wavelength-live-'+id,{config:{broadcast:{self:false}}})
    .on('broadcast',{event:'dial'},({payload})=>{
      if(room?.id!==id)return;
      if(room.board?.phase==='guess'&&room.seat===room.board.sender&&typeof payload?.value==='number'){
        ghostGuess=Math.max(0,Math.min(100,Math.round(payload.value)));
        const ghost=document.querySelector('#ghost-needle');
        if(ghost){
          ghost.hidden=false;
          ghost.style.left=`clamp(4px,${ghostGuess}%,calc(100% - 4px))`;
        }
        const tip=document.querySelector('#watch-tip');
        if(tip)tip.textContent='搭档正在调频犹豫中…（实时指针围观）';
      }
    })
    .on('broadcast',{event:'typing'},()=>{
      if(room?.id!==id)return;
      if(room.board?.phase==='sender'&&room.seat!==room.board.sender){
        partnerTyping=true;
        const pill=document.querySelector('#typing-pill');
        if(pill)pill.hidden=false;
        clearTimeout(typingTimer);
        typingTimer=setTimeout(()=>{
          partnerTyping=false;
          const p=document.querySelector('#typing-pill');
          if(p)p.hidden=true;
        },2600);
      }
    })
    .on('broadcast',{event:'react'},({payload})=>{
      if(room?.id!==id||!payload?.label)return;
      const who=payload.from||room.names[1-room.seat]||'搭档';
      showToast(`${who}：${payload.label}`,true);
      navigator.vibrate?.(15);
    })
    .subscribe(state=>{liveReady=state==='SUBSCRIBED'});
}

async function sync(){
  if(!room||syncing||busy||!navigator.onLine)return;
  const id=room.id;syncing=true;
  try{
    const snapshot=await call({type:'sync',roomId:id});
    if(room?.id!==id)return;
    const updated=apply(snapshot);
    status.textContent='已同步 · '+(channel?'实时连接中':'在线');
    if(!updated)renderConnection();
  }catch(e){
    if(room?.id!==id)return;
    error.textContent=e.message;
    if(['room_expired','room_unavailable','not_member'].includes(e.code)){
      storage.remove(roomKey);room=null;render();
    }else{
      connected=false;status.textContent='连接中断，进度已保留';renderConnection();
    }
  }finally{syncing=false}
}

function renderConnection(){
  const needAuth=!!room;
  app.querySelectorAll('[data-mutation],#clue-form button,#custom-form button').forEach(b=>{
    b.disabled=busy||!connected||!!pending||(needAuth&&!user);
  });
  if($('#retry'))$('#retry').disabled=busy||!navigator.onLine;
  if(room?.board?.phase==='reveal'&&room.board.nextReady[room.seat])$('[data-send=next]').disabled=true;
  if(room?.returned?.[room.seat])$('[data-send=return]').disabled=true;
}

async function invoke(command){
  try{return await call(command)}
  catch(e){
    if(!e.status||e.status>=500||(command.type==='join'&&e.code==='version_conflict'))return await call(command);
    throw e;
  }
}

async function send(type,extra={},retry=false){
  if(busy||!navigator.onLine)return;
  if(!user){status.textContent='正在建立匿名连接…'}
  let command=retry?pending:{type,requestId:crypto.randomUUID(),...(!['create','join'].includes(type)?{roomId:room.id,version:room.version}:{}),...extra};
  if(!command)return;
  const intent={game:command.type==='return'?command.game:room?.game,round:room?.board?.round,phase:room?.board?.phase};
  busy=true;error.textContent='';rememberPending(command);renderConnection();
  try{
    let result;
    try{result=await invoke(command)}
    catch(e){
      if(e.code!=='version_conflict'||!['return','next'].includes(command.type))throw e;
      apply(await call({type:'sync',roomId:command.roomId}));
      const same=room.game===intent.game&&(command.type==='return'?room.board?.phase==='report':room.board?.phase==='reveal'&&room.board.round===intent.round);
      if(command.type==='return'&&room.game===intent.game+1)result=room;
      else{if(!same)throw e;command={...command,requestId:crypto.randomUUID(),version:room.version};rememberPending(command);result=await invoke(command)}
    }
    rememberPending(null);apply(result);await subscribe();status.textContent='已同步 · 实时连接中';
  }catch(e){
    error.textContent=e.message;
    if(e.status&&e.status<500){rememberPending(null);if(e.code==='version_conflict'){busy=false;await sync()}}
    else status.textContent='请求未确认，可安全重试，不会重复计分';
  }finally{busy=false;render()}
}

function invite(){const url=new URL(location.href);url.search='';url.hash=room.code;return url.href}

function spectrum(b,isSecret=false,guess=false,reveal=false,watchGhost=false,masked=false){
  const target=typeof b.target==='number';
  const guessVal=guess?(readDraft().guess??b.guess??50):50;
  return `<div class="track ${masked?'hidden-target':''} ${reveal?'reveal-track':''}" ${isSecret?'id="secret-track"':''}>${target?`<span class="zone" style="left:${b.target-14}%;width:28%"></span><span class="zone three" style="left:${b.target-8}%;width:16%"></span><span class="zone four" style="left:${b.target-3}%;width:6%"></span><span class="targetline" style="left:${b.target}%"></span>`:''}${isSecret?'<span class="secret-veil" aria-hidden="true">🙈 靶心已隐藏</span>':''}${reveal?'<span class="curtain curtain-left" aria-hidden="true"></span><span class="curtain curtain-right" aria-hidden="true"></span>':''}${watchGhost?`<span class="ghost-needle" id="ghost-needle" ${ghostGuess===null?'hidden':''} style="left:clamp(4px,${ghostGuess??50}%,calc(100% - 4px))"></span>`:''}${guess?`<span class="needle" style="left:clamp(4px,${guessVal}%,calc(100% - 4px))"></span>`:''}<i class="guide" style="left:25%"></i><i class="guide mid" style="left:50%"></i><i class="guide" style="left:75%"></i></div>`;
}

const endpoints=b=>`<div class="endpoints"><span>${escape(b.prompt.left)}</span><span>${escape(b.prompt.right)}</span></div>`;

function showCustom(){
  const d=document.createElement('dialog');
  d.innerHTML='<form id="custom-form"><h2>自定义光谱</h2><label>左端<input name="left" type="text" maxlength="36" required></label><label>右端<input name="right" type="text" maxlength="36" required></label><p class="small">换题不换靶心，两端要清楚可比较。</p><div class="dialog-actions"><button type="button" id="cancel">取消</button><button class="primary">使用</button></div></form>';
  document.body.append(d);d.showModal();
  d.querySelector('#cancel').onclick=()=>d.close();
  d.onclose=()=>d.remove();
  d.querySelector('form').onsubmit=e=>{
    e.preventDefault();const form=new FormData(e.target);d.close();
    void send('custom',{left:form.get('left').trim(),right:form.get('right').trim()});
  };
}

function confirmLeave(){
  if(room.status==='closed'){void finishLeave();return}
  const d=document.createElement('dialog');
  d.innerHTML='<h2>确定退出房间？</h2><p class="small">退出后双方房间将关闭并结束本局。</p><div class="dialog-actions"><button type="button" id="stay">继续玩</button><button type="button" class="primary" id="confirm-exit">确定退出</button></div>';
  document.body.append(d);d.showModal();
  d.querySelector('#stay').onclick=()=>d.close();
  d.onclose=()=>d.remove();
  d.querySelector('#confirm-exit').onclick=async()=>{
    d.close();
    await send('leave');
    if(room?.status==='closed')await finishLeave();
  };
}

async function finishLeave(){
  storage.remove(roomKey);room=null;subscribedRoom=null;liveReady=false;
  if(channel)await client.removeChannel(channel);
  if(liveChannel)await client.removeChannel(liveChannel);
  channel=null;liveChannel=null;
  history.replaceState(null,'',location.pathname);
  document.title='电波同步 · 双人联机';
  render();
}

function celebrate(){
  for(let i=0;i<36;i++){
    const el=document.createElement('i');el.className='confetti';
    el.style.cssText=`--x:${Math.random()*100}vw;--c:${['#d7f77b','#f3ae83','#7ac9c0'][i%3]};--d:${Math.random()*.4}s`;
    document.body.append(el);setTimeout(()=>el.remove(),2400);
  }
}

function render(){
  document.body.classList.toggle('report-screen',room?.board?.phase==='report'&&!room.returned?.[room.seat]);
  if(!room){
    const urlCode=/^[A-HJ-NP-Z2-9]{10}$/.test(location.hash.slice(1))?location.hash.slice(1):'';
    if(urlCode)lobbyTab='join';
    const prefs=readPrefs();
    const savedPacks=Array.isArray(prefs.packs)?prefs.packs.filter(p=>p in packs):null;
    const activePacks=savedPacks?.length?new Set(savedPacks):new Set(Object.keys(packs).filter(p=>!DEFAULT_OFF_PACKS.has(p)));
    const mode=prefs.mode==='endless'?'endless':'classic';
    const best=readBest();

    app.innerHTML=`<div class="panel"><div class="topline"><span class="eyebrow">ONLINE / 两个人，两台手机</span>${best.bestScore?`<span class="badge">🏆 最高 ${best.bestScore} 分</span>`:''}</div><h2>远一点，也能实时对频</h2><label for="name">你的昵称</label><input id="name" type="text" maxlength="12" placeholder="玩家" value="${escape(nickname)}"><div class="lobby-tabs" role="tablist"><button type="button" class="lobby-tab" id="tab-create" role="tab" aria-selected="${lobbyTab==='create'}">创建房间</button><button type="button" class="lobby-tab" id="tab-join" role="tab" aria-selected="${lobbyTab==='join'}">输入房间码加入</button></div><div class="lobby-pane" id="pane-create" ${lobbyTab==='create'?'':'hidden'}><label>回合模式</label><div class="mode-switch"><label class="mode-opt"><input type="radio" name="mode" value="classic" ${mode==='classic'?'checked':''}>🎯 6 局 · 靶心续命</label><label class="mode-opt"><input type="radio" name="mode" value="endless" ${mode==='endless'?'checked':''}>♾️ 无限畅玩</label></div><label>选择话题包</label><div class="packs">${Object.entries(packs).map(([name,n])=>{const meta=PACK_META[name]||{icon:'✨'};return `<label class="pack-chip ${name==='微醺暧昧'?'spicy':''}"><input type="checkbox" name="pack" value="${name}" ${activePacks.has(name)?'checked':''}><span>${meta.icon} ${name}</span><span class="pack-count">${n}</span></label>`}).join('')}</div><button id="create" data-mutation class="primary wide">创建双人房间 ↗</button></div><div class="lobby-pane" id="pane-join" ${lobbyTab==='join'?'':'hidden'}><label for="code">10 位房间码</label><input id="code" class="online-invite-code" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${urlCode}" placeholder="例如 ABCD234567"><button id="join" data-mutation class="primary wide">加入搭档的房间 ↗</button><p class="small" style="margin-top:10px">支持直接打开搭档发来的邀请链接，自动填好房间码。</p></div></div>`;

    $('#tab-create').onclick=()=>{lobbyTab='create';$('#tab-create').setAttribute('aria-selected','true');$('#tab-join').setAttribute('aria-selected','false');$('#pane-create').hidden=false;$('#pane-join').hidden=true};
    $('#tab-join').onclick=()=>{lobbyTab='join';$('#tab-join').setAttribute('aria-selected','true');$('#tab-create').setAttribute('aria-selected','false');$('#pane-join').hidden=false;$('#pane-create').hidden=true;$('#code').focus()};
    $('#name').oninput=e=>{nickname=e.target.value;storage.set('wavelength-online-name',nickname)};
    const readName=()=>{nickname=$('#name').value.trim()||randomNickname();$('#name').value=nickname;storage.set('wavelength-online-name',nickname);return nickname};
    $('#create').onclick=()=>{
      const selected=[...app.querySelectorAll('[name=pack]:checked')].map(el=>el.value);
      if(!selected.length){error.textContent='请至少选择一类话题。';return}
      const chosenMode=app.querySelector('[name=mode]:checked')?.value==='endless'?'endless':'classic';
      savePrefs({packs:selected,mode:chosenMode});
      void send('create',{name:readName(),packs:selected,mode:chosenMode});
    };
    $('#join').onclick=()=>{
      const code=$('#code').value.trim().toUpperCase();
      if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code)){error.textContent='请输入正确的 10 位房间码。';return}
      void send('join',{name:readName(),code});
    };
  }else{
    const b=room.board,sender=escape(room.names[b?.sender??0]||'搭档'),receiver=escape(room.names[1-(b?.sender??0)]||'搭档');
    const mode=(b?.mode||room.mode)==='endless'?'endless':'classic';
    const targetRounds=b?.targetRounds??6;
    let content='';

    if(room.status==='closed'){
      content='<div class="panel waiting"><h2>房间已关闭</h2><p>一位玩家已主动退出，可以返回创建新房间。</p></div>';
    }else if(!b){
      content=`<div class="panel waiting"><div class="eyebrow">PAIRING / 等搭档落座</div><h2>等待搭档加入…</h2><p class="small">话题：${room.packs.map(escape).join('、')} · ${mode==='endless'?'无限畅玩':'经典靶心续命'}</p><div class="players">${room.names.map(name=>`<div class="player ${name?'joined':''}">${escape(name||'等待加入…')}</div>`).join('')}</div><div class="invite-actions"><button type="button" id="wx-share-big" class="primary wx-btn">💬 一键微信分享给搭档</button><button type="button" id="copy-big">📋 复制邀请链接</button></div></div>`;
    }else if(b.phase==='report'&&room.returned?.[room.seat]){
      content='<div class="panel waiting"><h2>已回到房间，等待搭档</h2><p>搭档还在看战报；双方都返回后自动开下一局。</p><button data-mutation data-send="return" class="wide" disabled>已回到房间</button></div>';
    }else if(b.phase==='sender'){
      if(room.seat===b.sender){
        const hints=b.prompt.hints||'';
        content=`<div class="panel"><div class="topline"><span class="eyebrow">01 / ${escape(b.prompt.category)} · 你是发射员</span><button type="button" class="peek-toggle" id="toggle-mask" aria-pressed="${!maskPeek}">${maskPeek?'👁 显示靶心':'🙈 遮住靶心'}</button></div><h2>${sender}，给一个线索</h2>${endpoints(b)}${spectrum(b,true,false,false,false,maskPeek)}<div class="tools"><button type="button" data-mutation data-send="swap">换一题</button><button type="button" data-mutation id="custom">自定义</button>${hints?`<button type="button" id="hint-toggle">💡 灵感</button>`:''}</div><div class="hint-box" id="hint-box" ${showHint?'':'hidden'}><span>灵感参考：<strong>${escape(hints)}</strong></span></div><form id="clue-form"><label for="clue">留给 ${receiver} 的线索（不报数字，不用端点词）</label><input id="clue" type="text" maxlength="40" required autocomplete="off" value="${escape(readDraft().clue||'')}" placeholder="一个具体事物，比如：螺蛳粉、番茄"><button data-mutation class="primary wide">发送线索，看对方怎么猜 →</button></form></div>`;
      }else{
        content=`<div class="panel waiting"><div class="eyebrow">01 / 等待发射</div><h2>${sender} 正在想线索…</h2>${endpoints(b)}<div class="typing-pill" id="typing-pill" ${partnerTyping?'':'hidden'}>✨ 对方正在输入线索…</div><p class="small">靶心只显示在对方手机上，线索发出后你就可以拖动指针。</p></div>`;
      }
    }else if(b.phase==='guess'){
      if(room.seat===1-b.sender){
        content=`<div class="panel"><div class="eyebrow">02 / 你是接收员</div><h2>在 ${sender} 心里，它在哪？</h2><div class="clue">「${escape(b.clue)}」</div>${endpoints(b)}${spectrum(b,false,true)}<div class="nudge-row"><button type="button" class="nudge-btn" id="minus" aria-label="往左微调">← 微调</button><span class="nudge-hint">左右拖动上方电波条 · 实时同步</span><button type="button" class="nudge-btn" id="plus" aria-label="往右微调">微调 →</button></div><button data-mutation id="lock" class="primary wide">锁定电波，拉开幕布 ↗</button></div>`;
      }else{
        content=`<div class="panel waiting"><div class="eyebrow">02 / 实时围观</div><h2>${receiver} 正在调频…</h2><div class="clue">「${escape(b.clue)}」</div>${endpoints(b)}<div class="live-watch">${spectrum(b,false,false,false,true)}<p class="small" id="watch-tip">${ghostGuess===null?'等待对方触碰电波条…':'搭档正在调频犹豫中…（实时指针围观）'}</p></div></div>`;
      }
    }else if(b.phase==='reveal'){
      const r=b.history.at(-1);
      const isLastClassic=mode==='classic'&&(b.round+1>=targetRounds||b.deckLeft===0);
      const nextText=b.nextReady[room.seat]?'已就绪，等搭档…':isLastClassic?'聊好了，看战报 →':'聊好了，下一回合 →';
      content=`<div class="panel"><div class="eyebrow">03 / 共同揭晓</div><div class="topline"><h2>${escape(roundComment(r.points,r.bonus))}</h2><span class="score score-pop">+${r.points}</span></div>${r.bonus?'<div class="badge bonus" style="margin-bottom:6px">🔥 正中靶心 · 奖励 +1 回合续命卡！</div>':''}<div class="clue">「${escape(b.clue)}」</div>${endpoints(b)}${spectrum(b,false,true,true)}<div class="reactions">${REACTIONS.map(item=>`<button type="button" class="react-btn" data-react="${item.label}">${item.label}</button>`).join('')}</div><p class="small center">我方：${b.nextReady[room.seat]?'已就绪':'等待'} · 搭档：${b.nextReady[1-room.seat]?'已就绪':'等待'}</p>${mode==='endless'?`<div class="tools"><button type="button" data-mutation data-send="finish">结算战报</button><button data-mutation data-send="next" class="primary" ${b.nextReady[room.seat]?'disabled':''}>${nextText}</button></div>`:`<button data-mutation data-send="next" class="primary wide" ${b.nextReady[room.seat]?'disabled':''}>${nextText}</button>`}</div>`;
    }else{
      const total=b.history.reduce((n,r)=>n+r.points,0);
      const maxScore=Math.max(4,b.history.length*4);
      let bestNote='';
      if(recordedGame!==`${room.id}:${room.game}`&&b.history.length>0){
        const {best,isNewScore}=recordBest(total,b.maxStreak||0);
        recordedGame=`${room.id}:${room.game}`;
        bestNote=isNewScore?`<div class="badge bonus">🎉 刷新最高分纪录：${best.bestScore} 分！</div>`:'';
      }
      content=`<div class="panel report-panel"><div class="eyebrow">SESSION COMPLETE / 联机默契战报</div><h2>${room.names.map(escape).join(' × ')}</h2>${bestNote}<div class="score">${total}<span style="font-size:20px"> / ${maxScore}</span></div><h2>${rating(total,b.history.length)}</h2><p class="small">共 ${b.history.length} 回合 · 同步率 ${Math.round(total/maxScore*100)}%${b.bonusRounds?` · 续命 +${b.bonusRounds}`:''}${b.maxStreak>1?` · 最高 ${b.maxStreak} 连击`:''}</p><div class="history">${b.history.map((r,i)=>`<article><span class="eyebrow">${String(i+1).padStart(2,'0')} / ${escape(r.sender)} 发射${r.bonus?' · +1续命':''}</span><p>${escape(r.left)} ↔ ${escape(r.right)}</p><p><strong>「${escape(r.clue)}」</strong> · +${r.points} 分</p></article>`).join('')}</div><div class="tools"><button id="save-image" class="wx-btn">🖼️ 战报海报 · 发微信</button><button id="print">打印 / PDF</button></div><p id="share-status" class="small" role="status"></p><button data-mutation data-send="return" class="primary wide">同房间再来一局 ↗</button></div>`;
    }

    const totalNow=b?b.history.reduce((n,r)=>n+r.points,0):0;
    const roundBadge=b?(mode==='endless'?`ROUND ${b.round+1} · 无限`:`ROUND ${Math.min(targetRounds,b.round+1)} / ${String(targetRounds).padStart(2,'0')}`):'';
    app.innerHTML=`<div class="room-toolbar"><strong class="room-code">${room.code}</strong><span class="small">${escape(room.names[room.seat])} · ${room.isHost?'房主':'搭档'}</span><button type="button" id="wx-share" class="wx-btn">💬 微信分享</button><button type="button" id="copy">复制</button><button type="button" id="leave">${room.status==='closed'?'回大厅':'退出'}</button><div class="invite-row"><a class="invite" href="${invite()}">${invite()}</a></div></div>${b?`<div class="topline round-label"><span class="eyebrow">${roundBadge}</span><div class="hud-badges">${b.streak>0?`<span class="badge hot">🔥 ${b.streak} 连击</span>`:''}${b.bonusRounds>0?`<span class="badge bonus">+${b.bonusRounds} 续命</span>`:''}<span class="online-score">${totalNow} 分</span></div></div>`:''}${content}`;

    const copyInvite=async()=>{if(await copyText(invite())){status.textContent='邀请链接已复制';showToast('已复制邀请链接')}else status.textContent='请长按上方邀请链接复制'};
    $('#copy').onclick=copyInvite;
    $('#wx-share').onclick=()=>void shareToWeChat();
    if($('#copy-big'))$('#copy-big').onclick=copyInvite;
    if($('#wx-share-big'))$('#wx-share-big').onclick=()=>void shareToWeChat();
    $('#leave').onclick=confirmLeave;
    app.querySelectorAll('[data-send]').forEach(button=>button.onclick=()=>send(button.dataset.send,button.dataset.send==='return'?{game:room.game}:{}));

    if($('#toggle-mask'))$('#toggle-mask').onclick=()=>{
      maskPeek=!maskPeek;
      const t=$('#secret-track');
      if(t)t.classList.toggle('hidden-target',maskPeek);
      $('#toggle-mask').textContent=maskPeek?'👁 显示靶心':'🙈 遮住靶心';
      $('#toggle-mask').setAttribute('aria-pressed',String(!maskPeek));
    };
    if($('#hint-toggle'))$('#hint-toggle').onclick=()=>{showHint=!showHint;$('#hint-box').hidden=!showHint};
    if($('#clue'))$('#clue').oninput=e=>{draft({clue:e.target.value});broadcastTyping()};
    if($('#clue-form'))$('#clue-form').onsubmit=e=>{e.preventDefault();void send('clue',{clue:$('#clue').value.trim()})};
    if($('#custom'))$('#custom').onclick=showCustom;

    if($('#lock')){
      const slider=$('.track');
      let guess=readDraft().guess??50;
      const update=n=>{
        guess=Math.max(0,Math.min(100,Math.round(Number(n))));
        slider.setAttribute('aria-valuenow',guess);
        $('.needle').style.left=`clamp(4px,${guess}%,calc(100% - 4px))`;
        draft({guess});
      };
      bindSpectrum(slider,update,{onMove:broadcastDial});
      update(guess);
      $('#minus').onclick=()=>{update(guess-2);broadcastDial(guess)};
      $('#plus').onclick=()=>{update(guess+2);broadcastDial(guess)};
      $('#lock').onclick=()=>send('guess',{guess});
    }

    if(b?.phase==='reveal'){
      requestAnimationFrame(()=>requestAnimationFrame(()=>$('.reveal-track')?.classList.add('revealed')));
      const key=`${room.id}:${room.game}:${b.round}`;
      if(lastRevealKey!==key){
        lastRevealKey=key;
        const last=b.history.at(-1);
        if(last?.points===4){celebrate();navigator.vibrate?.([35,45,70])}
        else if(last?.points===3)navigator.vibrate?.(25);
      }
      app.querySelectorAll('[data-react]').forEach(btn=>{
        btn.onclick=()=>{
          const label=btn.dataset.react;
          showToast(`我：${label}`);
          broadcast('react',{label,from:room.names[room.seat]});
        };
      });
    }

    if($('#save-image'))$('#save-image').onclick=()=>showReportImage({names:room.names,history:b.history});
    if($('#print'))$('#print').onclick=()=>{try{if(typeof print!=='function')throw Error();print();$('#share-status').textContent='如未打开打印窗口，请使用保存战报图片。'}catch{$('#share-status').textContent='请使用保存战报图片。'}};
  }

  if(pending){
    const div=document.createElement('div');div.className='pending-tools';
    div.innerHTML='<span class="small">上次操作尚未确认，可安全重试</span><button id="retry">重试</button>';
    app.prepend(div);$('#retry').onclick=()=>send(null,{},true);
  }
  renderConnection();
}

async function boot(){
  error.textContent='';
  render();
  try{
    const auth=await session();
    user=auth.user;connected=navigator.onLine;
    try{pending=JSON.parse(sessionStorage.getItem(pendingKey))}catch{}
    const id=storage.get(roomKey);
    if(id){
      try{apply(await call({type:'sync',roomId:id}));await subscribe()}
      catch(e){error.textContent=e.message;if(['not_member','room_unavailable','room_expired'].includes(e.code))storage.remove(roomKey)}
    }
    status.textContent='在线身份已连接';
    renderConnection();
  }catch(e){
    connected=false;error.textContent=e.message;status.textContent='连接未完成，可点重新同步';renderConnection();
  }
}

document.querySelector('#refresh').onclick=()=>room?sync():boot();
window.addEventListener('offline',()=>{connected=false;status.textContent='已断网，进度保留；联网后可继续';renderConnection()});
window.addEventListener('online',()=>{connected=true;if(room)void sync();else void boot()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(room)void sync();else if(!user)void boot()}});
if(!globalThis.__WAVELENGTH_DISABLE_POLLING__)setInterval(()=>{if(room&&!document.hidden&&navigator.onLine)void sync()},15000);
void boot();
