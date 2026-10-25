import {newGame,accept,act,choose,settle,nextRound,view,VALUES,ACTIONS} from './engine.js';
let state=newGame(), selected=[], action='';
const names=['樱','梅','菊','藤','莲','枫','月'],icons=['✿','❀','✺','❧','❁','✦','☾'];
const gifts=['香囊','花簪','折扇','茶盏','和伞','三味线','诗笺'];
// Original vector artwork: layered woodblock shapes and seven distinct gift motifs.
const motifs=[
 '<path d="M19 20h26l5 30Q32 65 14 50Z"/><path d="m23 14 9 8 9-8M24 23l-4 25m20-25 4 25"/><circle cx="32" cy="40" r="6"/>',
 '<path d="m22 55 16-37m-9 39 15-35"/><path d="M35 17c-12-9 6-20 8-6 12-9 18 10 4 11 4 14-14 15-12 2-12 2-15-13 0-7Z"/>',
 '<path d="M10 32Q32 0 54 32L32 56Z"/><path d="m32 56-14-28m14 28V18m0 38 14-28M11 32q21-12 42 0"/>',
 '<path d="M12 24h36v16Q30 60 12 40Zm36 4h7q9 15-10 15M15 52h36M23 17q-8-6 0-12m12 12q-8-6 0-12"/>',
 '<path d="M7 30Q32-6 57 30Q43 24 32 30Q20 24 7 30Zm25-20v43q0 12-9 6"/><path d="M32 12Q19 16 18 28m14-16q13 4 14 16"/>',
 '<path d="m33 8 9 3-7 27-9-3ZM18 34l23 7-6 20-23-7Z"/><path d="m36 10-14 44m17-43L25 55m9-39 12 3m-13 5 11 3"/>',
 '<path d="M14 13h32v41H14ZM14 13q-8-9-8 0t8 0m32 41q8-9 8 0t-8 0M22 24h16M22 32h16M22 40h10"/>'
];
const giftArt=i=>`<svg class="gift-art" viewBox="0 0 64 68" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${motifs[i]}</svg>`;
const portraitArt=i=>`<svg class="geisha-art" viewBox="0 0 120 196" aria-hidden="true"><defs><pattern id="weave${i}" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 9 0 18 9 9 18Z" fill="none" stroke="#f6dfb2" stroke-opacity=".25"/></pattern></defs><circle cx="72" cy="51" r="37" fill="#f5d9ab" opacity=".45"/><path d="M0 154Q35 133 44 103h30q15 30 46 51v42H0Z" fill="var(--tone)"/><path d="M0 154Q35 133 44 103h30q15 30 46 51v42H0Z" fill="url(#weave${i})"/><path d="m43 103 17 37 16-37-8-10H51Z" fill="#f0d9b3"/><path d="m41 108 20 32-16 36-17-55Zm36 0-16 32 16 36 18-55Z" fill="#252733"/><path d="M44 57q-4 26 8 36l-2 14 15 5 4-19q17-14 13-35Z" fill="#efd2ac"/><path d="M39 68Q20 31 49 26q1-17 20-13 23-2 22 20 15 16-8 43l-5-21q-22 5-28-12Z" fill="#202330"/><ellipse cx="${48+i*3}" cy="25" rx="22" ry="${13+i%3*2}" fill="#202330"/><path d="m31 ${33+i*2} 60-7" stroke="#c4a266" stroke-width="3"/><circle cx="${35+i%3*5}" cy="${30+i*2}" r="7" fill="var(--tone)"/><circle cx="${35+i%3*5}" cy="${30+i*2}" r="2" fill="#f4d49b"/><path d="m72 69 5 1m-9 13 6 1" stroke="#9b4843" stroke-width="2"/><path d="M21 155h77v25H21Z" fill="#d1ac68"/><path d="m40 155 18 13-18 12m38-25-18 13 18 12" fill="#9a493f"/><path d="M91 110q-6 27-28 36l9 12q36-10 39-31" fill="var(--tone)"/><path d="m67 145-12-4-13 7 23 8" fill="#efd2ac"/><path d="m43 146-25-23q27-18 40 1Z" fill="#e5c78c"/><path d="m43 146-13-23m13 23 1-29" stroke="#9e6b51" fill="none"/></svg>`;
const labels={secret:'密约',discard:'取舍',gift:'赠予',compete:'竞争'};
const app=document.querySelector('#app');
const card=(c,i,selectable=true)=>`<button class="card ${selected.includes(c.id)?'selected':''}" ${selectable?`data-card="${c.id}" aria-pressed="${selected.includes(c.id)}"`:'disabled'} style="--tone:var(--c'+c.type+')"><span class="card-corner">${names[c.type]}<em>${VALUES[c.type]}</em></span>${giftArt(c.type)}<b>${gifts[c.type]}</b><span class="card-family">${names[c.type]}之礼 · ${VALUES[c.type]} 魅力</span>${selectable&&selected.includes(c.id)?`<small>第 ${selected.indexOf(c.id)+1} 张${action==='compete'?' · '+(selected.indexOf(c.id)<2?'甲组':'乙组'):''}</small>`:''}</button>`;
function render(){
 const v=view(state);const hidden=v.phase==='handoff';
 app.innerHTML=`<div class="round">第 ${v.round} 轮 <span>牌库 ${v.deck} 张 · 玩家 ${state.starter+1} 先手</span></div><section class="scores">${v.scores.map((s,p)=>`<div class="player p${p}"><b>玩家 ${p+1}</b><strong>${s.points} <small>魅力</small> / ${s.count} <small>位</small></strong><span>${Object.keys(ACTIONS).map(a=>`${v.players[p].used.includes(a)?'✓':'○'}${labels[a]}`).join('　')}</span></div>`).join('')}</section><div class="board" aria-label="七位艺伎棋盘">${VALUES.map((n,i)=>`<article style="--tone:var(--c${i})"><div class="tally">${v.players[0].counts[i]}</div><div class="portrait">${portraitArt(i)}<h2>${names[i]}</h2><b>${n}</b></div><div class="owner ${v.markers[i]===null?'neutral':'p'+v.markers[i]}">${v.markers[i]===null?'未倾心':'玩家 '+(v.markers[i]+1)}</div><div class="tally">${v.players[1].counts[i]}</div></article>`).join('')}</div><p class="hint">上排：玩家 1 物品 · 下排：玩家 2 物品${['roundResult','gameOver'].includes(v.phase)?'（已含密约）':'（不含密约）'} · 支持平局时保留</p><section class="play" aria-live="polite">${content(v)}</section>${hidden?`<div class="curtain"><div><span class="curtain-caption">花街夜宴 · 席间交接</span><span class="seal">花</span><h2>请将设备交给玩家 ${v.recipient+1}</h2><p>${state.pending?'确认后查看公开选项并亲自选择':'确认后查看手牌（自动摸 1 张）'}</p><button class="primary" id="accept">我是玩家 ${v.recipient+1}，确认接手</button><p>私人信息已遮住</p></div></div>`:''}`;
 app.querySelector('#accept')?.addEventListener('click',()=>{accept(state);render();});
 app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{action=b.dataset.action;selected=[];render();});
 app.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{const id=b.dataset.card;if(selected.includes(id))selected=selected.filter(x=>x!==id);else if(action&&selected.length<ACTIONS[action])selected.push(id);render();});
 app.querySelector('#commit')?.addEventListener('click',()=>{act(state,action,selected);selected=[];action='';render();});
 app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{choose(state,Number(b.dataset.choice));render();});
 app.querySelector('#settle')?.addEventListener('click',()=>{if(confirm('翻开双方密约并结算本轮？')){settle(state);render();}});
 app.querySelector('#next')?.addEventListener('click',()=>{state=nextRound(state);render();});
}
function content(v){
 if(v.phase==='action')return `<h2>玩家 ${v.turn+1} · 请选择行动</h2><p>已摸牌 · 手牌 ${v.hand.length} 张</p><div class="actions">${Object.entries(ACTIONS).map(([a,n])=>`<button data-action="${a}" class="${action===a?'active':''}" ${v.players[v.turn].used.includes(a)?'disabled':''}>${labels[a]}<small>${n} 张 ${v.players[v.turn].used.includes(a)?'· 已用':''}</small></button>`).join('')}</div><p>${action==='compete'?'依次选 4 张：前两张为甲组，后两张为乙组。':action?`选择 ${ACTIONS[action]} 张用于${labels[action]}。`:'先选行动，再点选手牌。'}</p><div class="hand">${v.hand.map(c=>card(c)).join('')}</div><button id="commit" class="primary" ${!action||selected.length!==ACTIONS[action]?'disabled':''}>确认${labels[action]||'行动'}${action?' · '+selected.length+'/'+ACTIONS[action]:''}</button>`;
 if(v.phase==='choice'){const p=v.pending;const groups=p.action==='gift'?p.cards.map(c=>[c]):[p.cards.slice(0,2),p.cards.slice(2)];return `<h2>玩家 ${v.recipient+1} · ${labels[p.action]}选择</h2><p>你选择的${p.action==='gift'?'一张':'一组'}归你，其余归玩家 ${p.actor+1}。手牌保持隐藏。</p><div class="choices">${groups.map((g,i)=>`<div><div class="hand">${g.map(c=>card(c,0,false)).join('')}</div><button class="primary" data-choice="${i}">选择${p.action==='gift'?'第 '+(i+1)+' 张':i===0?'甲组':'乙组'}</button></div>`).join('')}</div>`;}
 if(v.phase==='roundEnd')return '<h2>本轮行动已完成</h2><p>所有手牌已用完。双方准备好后，翻开密约。</p><button class="primary" id="settle">结束并结算本轮</button>';
 if(v.phase==='gameOver')return `<h2>玩家 ${v.winner+1} 获胜</h2><p>${v.scores[v.winner].points>=11?'魅力达到 11 分':'获得至少 4 位艺伎'}。感谢共赏花街。</p><button class="primary" onclick="document.querySelector('#new').click()">重新开局</button>`;
 if(v.phase==='roundResult')return '<h2>本轮结算 · 尚未分胜负</h2><p>保留支持标记，回收全部 21 张牌并交换先手。</p><button class="primary" id="next">开始下一轮</button>';
 return '<h2>等待交接</h2>';
}
document.querySelector('#new').onclick=()=>{if(confirm('确定重新开局？当前对局将结束。')){state=newGame();selected=[];action='';render();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='action'){// Returning requires confirmation, without drawing twice.
 app.innerHTML='<div class="curtain"><div><h2>私人信息已遮住</h2><button id="resume" class="primary">当前玩家确认继续</button></div></div>';app.querySelector('#resume').onclick=render;
}});
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('../../service-worker.js').catch(()=>{});
