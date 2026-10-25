import {newGame,accept,act,choose,settle,nextRound,view,VALUES,ACTIONS,beginReview,closeReview,hidePrivate} from './engine.js';
let state=newGame(), selected=[], action='';
import {names,gifts,giftArt,portraitArt,labels} from './art.js';
const app=document.querySelector('#app');
const card=(c,i,selectable=true)=>`<button class="card ${selected.includes(c.id)?'selected':''}" ${selectable?`data-card="${c.id}" aria-pressed="${selected.includes(c.id)}"`:'disabled'} style="--tone:var(--c'+c.type+')"><span class="card-corner">${names[c.type]}<em>${VALUES[c.type]}</em></span>${giftArt(c.type)}<b>${gifts[c.type]}</b><span class="card-family">${names[c.type]}之礼 · ${VALUES[c.type]} 魅力</span>${selectable&&selected.includes(c.id)?`<small>第 ${selected.indexOf(c.id)+1} 张${action==='compete'?' · '+(selected.indexOf(c.id)<2?'甲组':'乙组'):''}</small>`:''}</button>`;
function render(){
 const v=view(state);const hidden=['handoff','resumeHandoff','reviewHandoff'].includes(v.phase);
 app.innerHTML=`<div class="round">第 ${v.round} 轮 <span>牌库 ${v.deck} 张 · 玩家 ${state.starter+1} 先手</span></div><section class="scores">${v.scores.map((s,p)=>`<div class="player p${p}"><b>玩家 ${p+1}</b><strong>${s.points} <small>魅力</small> / ${s.count} <small>位</small></strong><span>${Object.keys(ACTIONS).map(a=>`${v.players[p].used.includes(a)?'✓':'○'}${labels[a]}`).join('　')}</span></div>`).join('')}</section><div class="board" aria-label="七位艺伎棋盘">${VALUES.map((n,i)=>`<article style="--tone:var(--c${i})"><div class="tally">${v.players[0].counts[i]}</div><div class="portrait">${portraitArt(i)}<h2>${names[i]}</h2><b>${n}</b></div><div class="owner ${v.markers[i]===null?'neutral':'p'+v.markers[i]}">${v.markers[i]===null?'未倾心':'玩家 '+(v.markers[i]+1)}</div><div class="tally">${v.players[1].counts[i]}</div></article>`).join('')}</div><p class="hint">上排：玩家 1 物品 · 下排：玩家 2 物品${['roundResult','gameOver'].includes(v.phase)?'（已含密约）':'（不含密约）'} · 支持平局时保留</p><section class="play" aria-live="polite">${content(v)}</section>${['handoff','action','choice','roundEnd'].includes(v.phase)?`<nav class="review-actions" aria-label="查看自己的暗置牌"><span>仅本人确认后可查看</span><button data-review="0">玩家 1 · 暗置牌</button><button data-review="1">玩家 2 · 暗置牌</button></nav>`:''}${hidden?`<div class="curtain" role="dialog" aria-modal="true" aria-label="玩家交接"><div><span class="curtain-caption">花街夜宴 · 席间交接</span><span class="seal">花</span><h2>请将设备交给玩家 ${v.recipient+1}</h2><p>${v.phase==='reviewHandoff'?'确认后仅查看你自己的密约与取舍牌':v.phase==='resumeHandoff'?'确认后恢复手牌，不会重复摸牌':state.pending?'确认后查看公开选项并亲自选择':'确认后查看手牌（自动摸 1 张）'}</p><button class="primary" id="accept">我是玩家 ${v.recipient+1}，确认接手</button><p>私人信息已遮住</p>${state.round===1&&state.deck.length===8&&v.phase==='handoff'?'<a class="online-entry" href="./online/">各用一台设备？进入在线双人 →</a>':''}${v.phase==='handoff'?`<nav class="review-actions" aria-label="查看自己的暗置牌"><button data-review="0">玩家 1 · 暗置牌</button><button data-review="1">玩家 2 · 暗置牌</button></nav>`:''}</div></div>`:''}`;
 document.querySelector('header').inert=hidden;
 document.querySelector('.title').inert=hidden;
 document.querySelector('.mode-switch').inert=hidden;
 document.querySelector('details').inert=hidden;
 [...app.children].forEach(el=>{if(!el.classList.contains('curtain'))el.inert=hidden;});
 app.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{beginReview(state,Number(b.dataset.review));render();});
 app.querySelector('#close-review')?.addEventListener('click',()=>{closeReview(state);render();});
 app.querySelector('#accept')?.addEventListener('click',()=>{accept(state);render();});
 app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{action=b.dataset.action;selected=[];render();});
 app.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const id=b.dataset.card;if(selected.includes(id))selected=selected.filter(x=>x!==id);else if(action&&selected.length<ACTIONS[action])selected.push(id);render();});
 app.querySelector('#commit')?.addEventListener('click',()=>{act(state,action,selected);selected=[];action='';render();});
 app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{choose(state,Number(b.dataset.choice));render();});
 app.querySelector('#settle')?.addEventListener('click',()=>{if(confirm('翻开双方密约并结算本轮？')){settle(state);render();}});
 app.querySelector('#next')?.addEventListener('click',()=>{state=nextRound(state);render();});
}
function content(v){
 if(v.phase==='review')return `<h2>玩家 ${v.privateCards.player+1} · 我的暗置牌</h2><p>密约（轮末计分）</p><div class="hand private-secret">${v.privateCards.secret.map(c=>card(c,0,false)).join('')||'尚未使用密约'}</div><p>取舍（本轮不计分）</p><div class="hand private-discard">${v.privateCards.discard.map(c=>card(c,0,false)).join('')||'尚未使用取舍'}</div><button class="primary" id="close-review">遮住并返回对局</button>`;
 if(v.phase==='action')return `<h2>玩家 ${v.turn+1} · 请选择行动</h2><p>已摸牌 · 手牌 ${v.hand.length} 张</p><div class="actions">${Object.entries(ACTIONS).map(([a,n])=>`<button data-action="${a}" class="${action===a?'active':''}" ${v.players[v.turn].used.includes(a)?'disabled':''}>${labels[a]}<small>${n} 张 ${v.players[v.turn].used.includes(a)?'· 已用':''}</small></button>`).join('')}</div><p>${action==='compete'?'依次选 4 张：前两张为甲组，后两张为乙组。':action?`选择 ${ACTIONS[action]} 张用于${labels[action]}。`:'先选行动，再点选手牌。'}</p><div class="hand">${v.hand.map(c=>card(c)).join('')}</div><button id="commit" class="primary" ${!action||selected.length!==ACTIONS[action]?'disabled':''}>确认${labels[action]||'行动'}${action?' · '+selected.length+'/'+ACTIONS[action]:''}</button>`;
 if(v.phase==='choice'){const p=v.pending;const groups=p.action==='gift'?p.cards.map(c=>[c]):[p.cards.slice(0,2),p.cards.slice(2)];return `<h2>玩家 ${v.recipient+1} · ${labels[p.action]}选择</h2><p>你选择的${p.action==='gift'?'一张':'一组'}归你，其余归玩家 ${p.actor+1}。手牌保持隐藏。</p><div class="choices">${groups.map((g,i)=>`<div><div class="hand">${g.map(c=>card(c,0,false)).join('')}</div><button class="primary" data-choice="${i}">选择${p.action==='gift'?'第 '+(i+1)+' 张':i===0?'甲组':'乙组'}</button></div>`).join('')}</div>`;}
 if(v.phase==='roundEnd')return '<h2>本轮行动已完成</h2><p>所有手牌已用完。双方准备好后，翻开密约。</p><button class="primary" id="settle">结束并结算本轮</button>';
 if(v.phase==='gameOver')return `<h2>玩家 ${v.winner+1} 获胜</h2><p>${v.scores[v.winner].points>=11?'魅力达到 11 分':'获得至少 4 位艺伎'}。感谢共赏花街。</p><button class="primary" onclick="document.querySelector('#new').click()">重新开局</button>`;
 if(v.phase==='roundResult')return '<h2>本轮结算 · 尚未分胜负</h2><p>保留支持标记，回收全部 21 张牌并交换先手。</p><button class="primary" id="next">开始下一轮</button>';
 return '<h2>等待交接</h2>';
}
document.querySelector('#new').onclick=()=>{if(confirm('确定重新开局？当前对局将结束。')){state=newGame();selected=[];action='';render();}};
function protectPrivate(){hidePrivate(state);render();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)protectPrivate();});
window.addEventListener('pagehide',protectPrivate);
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('../../service-worker.js').catch(()=>{});
