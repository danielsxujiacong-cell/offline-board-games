import {bindSpectrum} from './spectrum.js';
import {showReportImage} from './report.js';
import {packs,prompts,PACK_META,DEFAULT_OFF_PACKS,shuffle,score,roundComment,rating,readBest,recordBest} from './prompts.js';

const app=document.querySelector('#app');
let s=null,peeked=false,targetVisible=false,showHint=false;
const $=q=>document.querySelector(q);
const escape=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PREF_KEY='wavelength-prefs-v2';

function readPrefs(){
  try{return JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{}}catch{return {}}
}
function savePrefs(patch){
  try{localStorage.setItem(PREF_KEY,JSON.stringify({...readPrefs(),...patch}))}catch{}
}
const save=()=>{try{sessionStorage.setItem('wavelength-v1',JSON.stringify(s))}catch{}};
function hide(){
  targetVisible=false;
  const t=$('#secret-track');
  if(t)t.classList.add('hidden-target');
  const btn=$('#peek');
  if(btn){btn.textContent='👁 点击查看靶心';btn.setAttribute('aria-pressed','false')}
}

document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()});
window.addEventListener('pagehide',hide);
$('#rules').onclick=()=>{hide();$('#help').showModal()};
$('#close-help').onclick=()=>$('#help').close();

const nicknamePairs=[['糯米团子','芝麻汤圆'],['小熊软糖','橘子汽水'],['月亮','星星'],['奶油泡芙','焦糖布丁'],['山间清风','海边晚霞'],['摸鱼小猫','打盹小熊']];

function home(){
  const prefs=readPrefs();
  const fallbackNames=nicknamePairs[Math.floor(Math.random()*nicknamePairs.length)];
  const savedNames=Array.isArray(prefs.names)&&prefs.names.length===2?prefs.names:fallbackNames;
  const savedPacks=Array.isArray(prefs.packs)?prefs.packs.filter(p=>p in packs):null;
  const activePacks=savedPacks?.length?new Set(savedPacks):new Set(Object.keys(packs).filter(p=>!DEFAULT_OFF_PACKS.has(p)));
  const mode=prefs.mode==='endless'?'endless':'classic';
  const best=readBest();

  document.body.classList.remove('report-screen');
  hide();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  app.innerHTML=`<div class="hero"><section><div class="eyebrow">TUNE INTO EACH OTHER</div><h1>你们，<em>同频</em>吗？</h1><p class="intro">极短光谱，纯直觉调频。猜的不是标准答案，是对方脑子里的刻度。</p><div class="tags"><span class="tag">${prompts.length} 组原版风短题</span><span class="tag">🎯 靶心续命 +1 局</span>${best.bestScore?`<span class="tag best">🏆 最高 ${best.bestScore} 分 · ${best.bestStreak} 连击</span>`:''}</div><div class="wave" aria-hidden="true">${Array.from({length:23},(_,i)=>`<i style="--h:${18+Math.sin(i*.9)**2*54}px"></i>`).join('')}</div></section><form class="panel" id="setup"><div class="setup-row"><div><label for="a">发射员先手</label><input id="a" type="text" maxlength="12" placeholder="玩家 A" autocomplete="off" value="${escape(savedNames[0])}"></div><div><label for="b">另一位搭档</label><input id="b" type="text" maxlength="12" placeholder="玩家 B" autocomplete="off" value="${escape(savedNames[1])}"></div></div><a class="online-entry" href="./online/">📱 双人各拿手机联机 · 实时围观指针 ↗</a><label>回合模式</label><div class="mode-switch"><label class="mode-opt"><input type="radio" name="mode" value="classic" ${mode==='classic'?'checked':''}>🎯 6 局 · 靶心续命</label><label class="mode-opt"><input type="radio" name="mode" value="endless" ${mode==='endless'?'checked':''}>♾️ 无限畅玩</label></div><label>题包（${prompts.length} 题 · 点选开关）</label><div class="packs">${Object.keys(packs).map(p=>{const meta=PACK_META[p]||{icon:'✨'};return `<label class="pack-chip ${p==='微醺暧昧'?'spicy':''}"><input type="checkbox" name="pack" value="${p}" ${activePacks.has(p)?'checked':''}><span>${meta.icon} ${p}</span><span class="pack-count">${packs[p]}</span></label>`}).join('')}</div><div id="error" class="error" role="alert"></div><button class="primary wide">开始对频 ↗</button>${s?'<button type="button" id="resume" class="wide">继续刚才的一局</button>':''}</form></div><footer>灵感来自 Wavelength · 纯直觉双人合作 · 零数据上传</footer>`;

  $('#setup').onsubmit=e=>{
    e.preventDefault();
    const selected=[...document.querySelectorAll('[name=pack]:checked')].map(el=>el.value);
    if(!selected.length){$('#error').textContent='至少选一类题包再开始。';return}
    const chosenMode=document.querySelector('[name=mode]:checked')?.value==='endless'?'endless':'classic';
    const names=[$('#a').value.trim()||fallbackNames[0],$('#b').value.trim()||fallbackNames[1]];
    savePrefs({names,packs:selected,mode:chosenMode});
    s={names,mode:chosenMode,targetRounds:chosenMode==='endless'?0:6,bonusRounds:0,streak:0,maxStreak:0,deck:shuffle(prompts.filter(p=>selected.includes(p.category))),round:0,history:[],phase:'sender',recorded:false};
    history.pushState({wavelengthPlay:true},'','#play');
    next();
  };
  if($('#resume'))$('#resume').onclick=()=>{history.pushState({wavelengthPlay:true},'','#play');render()};
}

function next(){
  if(!s.deck.length){s.phase='report';render();return}
  s.target=14+Math.floor(Math.random()*73);
  s.prompt=s.deck.pop();
  s.clue='';
  s.guess=50;
  s.phase='sender';
  peeked=false;
  targetVisible=false;
  showHint=false;
  save();
  render();
}

function track(secret=false,guess=false,reveal=false,hidden=secret){
  const showTarget=secret||s.phase!=='guess';
  return `<div class="track ${hidden?'hidden-target':''} ${reveal?'reveal-track':''}" ${secret?'id="secret-track"':''}>${showTarget?`<span class="zone" style="left:${s.target-14}%;width:28%"></span><span class="zone three" style="left:${s.target-8}%;width:16%"></span><span class="zone four" style="left:${s.target-3}%;width:6%"></span><span class="targetline" style="left:${s.target}%"></span>`:''}${secret?'<span class="secret-veil" aria-hidden="true">🙈 靶心已隐藏</span>':''}${reveal?'<span class="curtain curtain-left" aria-hidden="true"></span><span class="curtain curtain-right" aria-hidden="true"></span>':''}${guess?`<span class="needle" style="left:clamp(4px,${s.guess}%,calc(100% - 4px))"></span>`:''}<i class="guide" style="left:25%"></i><i class="guide mid" style="left:50%"></i><i class="guide" style="left:75%"></i></div>`;
}

const endpoints=()=>`<div class="endpoints"><span>${escape(s.prompt.left)}</span><span>${escape(s.prompt.right)}</span></div>`;

function render(){
  document.body.classList.toggle('report-screen',s.phase==='report');
  hide();
  save();
  const sender=escape(s.names[s.round%2]),receiver=escape(s.names[1-s.round%2]);
  const total=s.history.reduce((a,r)=>a+r.points,0);
  const mode=s.mode==='endless'?'endless':'classic';
  const roundLabel=mode==='endless'?`ROUND ${s.round+1} · 无限`:`ROUND ${Math.min(s.round+1,s.targetRounds)} / ${String(s.targetRounds).padStart(2,'0')}`;
  const dotsHtml=mode==='endless'
    ?`<div class="hud-badges"><span class="badge">已完成 ${s.history.length} 题</span>${s.streak>0?`<span class="badge hot">🔥 ${s.streak} 连击</span>`:''}</div>`
    :`<div class="dots">${Array.from({length:s.targetRounds},(_,i)=>`<i class="dot ${i<=s.round?'done':''} ${i>=6?'bonus':''}"></i>`).join('')}</div>`;

  app.innerHTML=`<section class="game"><div class="topline"><button type="button" id="home" class="back-button">← 返回</button><div class="hud-badges">${s.streak>0&&mode==='classic'?`<span class="badge hot">🔥 ${s.streak} 连击</span>`:''}${s.bonusRounds>0?`<span class="badge bonus">+${s.bonusRounds} 续命</span>`:''}<span class="badge">${total} 分</span></div></div><div class="topline" style="margin-top:8px"><span class="eyebrow">${roundLabel}</span>${dotsHtml}</div><div class="panel" id="stage"></div></section>`;
  $('#home').onclick=()=>{hide();if(history.state?.wavelengthPlay)history.back();else home()};
  const stage=$('#stage');

  if(s.phase==='sender'){
    const hints=s.prompt.hints||'';
    stage.innerHTML=`<div class="eyebrow">01 / ${escape(s.prompt.category)} · 只给发射员看</div><h2>${sender}，发出你的信号</h2><p class="small">请 ${receiver} 暂时移开视线</p>${endpoints()}${track(true,false,false,!targetVisible)}<button type="button" class="peek" id="peek" aria-pressed="${targetVisible}">${targetVisible?'🙈 点击隐藏靶心':'👁 点击查看靶心'}</button><div class="tools"><button type="button" id="swap">换一题</button><button type="button" id="custom">自定义</button>${hints?`<button type="button" id="hint-toggle">💡 灵感</button>`:''}</div><div class="hint-box" id="hint-box" ${showHint?'':'hidden'}><span>灵感参考：<strong>${escape(hints)}</strong></span></div><form id="clue-form"><label for="clue">留一个具体事物（不报数字，不用端点词）</label><input id="clue" type="text" maxlength="40" placeholder="比如：螺蛳粉、番茄、周一早八" autocomplete="off" value="${escape(s.clue)}"><div class="error" id="error" role="alert"></div><button class="primary wide">隐藏靶心，交给 ${receiver} →</button><button type="button" class="oral-btn" id="oral">🗣️ 已口头说线索，直接交给 ${receiver} →</button></form>`;

    $('#peek').onclick=()=>{
      targetVisible=!targetVisible;
      if(targetVisible)peeked=true;
      $('#secret-track')?.classList.toggle('hidden-target',!targetVisible);
      $('#peek').textContent=targetVisible?'🙈 点击隐藏靶心':'👁 点击查看靶心';
      $('#peek').setAttribute('aria-pressed',String(targetVisible));
    };
    $('#clue').oninput=e=>{s.clue=e.target.value;save()};
    if($('#hint-toggle'))$('#hint-toggle').onclick=()=>{showHint=!showHint;$('#hint-box').hidden=!showHint};
    $('#swap').onclick=()=>{if(!s.deck.length){$('#error').textContent='题库已抽完，可使用自定义光谱。';return}s.prompt=s.deck.pop();s.clue='';showHint=false;render()};
    $('#custom').onclick=()=>{
      hide();const d=document.createElement('dialog');
      d.innerHTML='<form><h2>自定义光谱</h2><label>左端<input name="left" type="text" required maxlength="18"></label><label>右端<input name="right" type="text" required maxlength="18"></label><p class="small">两端要清楚可比较，不暗示已知靶心。</p><div class="dialog-actions"><button type="button" id="cancel-custom">取消</button><button class="primary">使用</button></div></form>';
      document.body.append(d);d.showModal();
      d.querySelector('#cancel-custom').onclick=()=>d.close();
      d.onclose=()=>d.remove();
      d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),left=f.get('left').trim(),right=f.get('right').trim();if(!left||!right||left===right)return;s.prompt={left,right,category:'自定义',hints:''};s.clue='';showHint=false;d.close();render()};
    };
    const submitClue=(clueText)=>{
      hide();
      if(!peeked){$('#error').textContent='先按住看一眼靶心，再交给搭档。';return}
      if(!clueText){$('#error').textContent='先写一个线索，或点下方「口头说线索」。';return}
      s.clue=clueText;s.phase='handoff';render();
    };
    $('#clue-form').onsubmit=e=>{e.preventDefault();submitClue($('#clue').value.trim())};
    $('#oral').onclick=()=>submitClue($('#clue').value.trim()||'口头线索');

  }else if(s.phase==='handoff'){
    stage.classList.add('center');
    stage.innerHTML=`<div class="eyebrow">02 / 信号已加密</div><div class="locked" aria-hidden="true">〰️</div><h2>把手机交给 ${receiver}</h2><p>靶心已隐藏，${sender} 请保持沉默</p><button class="primary wide" id="receive">我是 ${receiver}，开始调频</button>`;
    $('#receive').onclick=()=>{s.phase='guess';render()};

  }else if(s.phase==='guess'){
    stage.innerHTML=`<div class="eyebrow">03 / ${receiver} 调频中</div><h2>在 ${sender} 心里，它在哪？</h2><div class="clue">「${escape(s.clue)}」</div>${endpoints()}${track(false,true)}<div class="nudge-row"><button type="button" class="nudge-btn" id="minus" aria-label="往左微调">← 微调</button><span class="nudge-hint">左右拖动上方电波条 · 纯直觉</span><button type="button" class="nudge-btn" id="plus" aria-label="往右微调">微调 →</button></div><button class="primary wide" id="lock">锁定电波，拉开幕布 ↗</button>`;
    const spectrum=$('.track');
    const update=n=>{
      s.guess=Math.max(0,Math.min(100,Math.round(Number(n))));
      spectrum.setAttribute('aria-valuenow',s.guess);
      $('.needle').style.left=`clamp(4px,${s.guess}%,calc(100% - 4px))`;
      save();
    };
    bindSpectrum(spectrum,update);update(s.guess);
    $('#minus').onclick=()=>update(s.guess-2);
    $('#plus').onclick=()=>update(s.guess+2);
    $('#lock').onclick=()=>{
      const points=score(s.target,s.guess);
      let bonus=false;
      if(points===4){
        s.streak=(s.streak||0)+1;
        s.maxStreak=Math.max(s.maxStreak||0,s.streak);
        if(mode==='classic'&&s.deck.length>0){
          s.targetRounds=(s.targetRounds??6)+1;
          s.bonusRounds=(s.bonusRounds||0)+1;
          bonus=true;
        }
      }else{
        s.streak=0;
      }
      s.history.push({...s.prompt,clue:s.clue,target:s.target,guess:s.guess,points,bonus,sender:s.names[s.round%2]});
      s.phase='reveal';
      render();
      if(points===4){
        celebrate();
        navigator.vibrate?.([35,45,70]);
      }else if(points===3){
        navigator.vibrate?.(25);
      }
    };

  }else if(s.phase==='reveal'){
    const r=s.history.at(-1);
    const isLastClassic=mode==='classic'&&(s.round+1>=s.targetRounds||!s.deck.length);
    stage.innerHTML=`<div class="eyebrow">04 / 信号解码</div><div class="topline"><h2>${escape(roundComment(r.points,r.bonus))}</h2><span class="score score-pop">+${r.points}</span></div>${r.bonus?'<div class="badge bonus" style="margin-bottom:6px">🔥 正中靶心 · 奖励 +1 回合续命卡！</div>':''}<div class="clue">「${escape(s.clue)}」</div>${endpoints()}${track(false,true,true)}<p class="note">聊一聊：为什么你把「${escape(s.clue)}」放在这里？</p>${mode==='endless'?`<div class="tools"><button type="button" id="finish-endless">结算本局战报</button><button class="primary" id="next">${s.deck.length?'下一题 →':'查看战报'}</button></div>`:`<button class="primary wide" id="next">${isLastClassic?'查看默契战报 →':'下一回合，交换身份 →'}</button>`}`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>$('.reveal-track')?.classList.add('revealed')));
    $('#next').onclick=()=>{
      s.round++;
      if((mode==='classic'&&s.round>=s.targetRounds)||!s.deck.length){s.phase='report';render()}
      else next();
    };
    if($('#finish-endless'))$('#finish-endless').onclick=()=>{s.phase='report';render()};

  }else{
    stage.classList.add('report-panel');
    const maxScore=Math.max(4,s.history.length*4);
    let bestNote='';
    if(!s.recorded&&s.history.length>0){
      const {best,isNewScore}=recordBest(total,s.maxStreak||0);
      s.recorded=true;
      s.isNewRecord=isNewScore;
      save();
      bestNote=isNewScore?`<div class="badge bonus">🎉 刷新最高分纪录：${best.bestScore} 分！</div>`:'';
    }else if(s.isNewRecord){
      bestNote=`<div class="badge bonus">🎉 刷新最高分纪录！</div>`;
    }
    stage.innerHTML=`<div class="eyebrow">SESSION COMPLETE / 默契战报</div><h2>${escape(s.names.join(' × '))}</h2>${bestNote}<div class="score">${total}<span style="font-size:20px"> / ${maxScore}</span></div><h2>${rating(total,s.history.length)}</h2><p class="small">共 ${s.history.length} 回合 · 同步率 ${Math.round(total/maxScore*100)}%${s.bonusRounds?` · 靶心续命 +${s.bonusRounds}`:''}${s.maxStreak>1?` · 最高 ${s.maxStreak} 连击`:''}</p><div class="history">${s.history.map((r,i)=>`<article><span class="eyebrow">${String(i+1).padStart(2,'0')} / ${escape(r.sender)} 发射${r.bonus?' · +1续命':''}</span><p>${escape(r.left)} ↔ ${escape(r.right)}</p><p><strong>「${escape(r.clue)}」</strong> · +${r.points} 分</p></article>`).join('')}</div><div class="tools"><button id="share">复制战报</button><button id="save-image" class="wx-btn">🖼️ 战报海报 · 发微信</button><button id="print">打印 / PDF</button></div><p class="small" id="share-status" role="status"></p><button class="primary wide" id="again">再来一局 ↗</button>`;

    $('#again').onclick=()=>{s=null;try{sessionStorage.removeItem('wavelength-v1')}catch{}home()};
    $('#save-image').onclick=()=>showReportImage(s);
    $('#print').onclick=()=>{
      const status=$('#share-status');
      status.textContent='请在系统打印窗口选择打印机或另存为 PDF。';
      try{if(typeof window.print!=='function')throw new Error('Print unavailable');window.print()}
      catch{status.textContent='此浏览器未能打开打印窗口，请使用保存战报图片。'}
    };
    $('#share').onclick=async()=>{
      const text=`电波同步｜${s.names.join(' × ')}\n${total}/${maxScore} 分 · ${rating(total,s.history.length)}\n`+s.history.map((r,i)=>`${i+1}. ${r.left} ↔ ${r.right}：「${r.clue}」 +${r.points}分`).join('\n')+'\nhttps://games.danielxu.cn/wavelength/';
      try{await navigator.clipboard.writeText(text);$('#share-status').textContent='战报已复制，快发给搭档吧。'}
      catch{$('#share-status').textContent='浏览器未允许复制，请使用保存战报图片。'}
    };
  }
}

function celebrate(){
  for(let i=0;i<36;i++){
    const el=document.createElement('i');el.className='confetti';
    el.style.cssText=`--x:${Math.random()*100}vw;--c:${['#d7f77b','#f3ae83','#7ac9c0'][i%3]};--d:${Math.random()*.4}s`;
    document.body.append(el);setTimeout(()=>el.remove(),2400);
  }
}

window.addEventListener('popstate',()=>home());
try{
  const saved=JSON.parse(sessionStorage.getItem('wavelength-v1'));
  if(saved&&Array.isArray(saved.history)&&Array.isArray(saved.deck)&&saved.names?.length===2&&['sender','handoff','guess','reveal','report'].includes(saved.phase))s=saved;
}catch{}
home();
if('serviceWorker' in navigator)navigator.serviceWorker.register('../service-worker.js').catch(()=>{});
