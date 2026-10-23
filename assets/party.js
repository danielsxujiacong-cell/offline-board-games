/* Three standalone routes; secrets exist in memory only and are removed from DOM when hidden. */
(() => {
  'use strict';
  const D = PARTY_DATA, mode = document.body.dataset.mode, app = document.querySelector('main');
  const names = {wasabi:'芥末俄罗斯轮盘',two:'双簧大忽悠',job:'戏精求职部'};
  const pick = list => list[Math.floor(Math.random()*list.length)];
  const triple = () => { const pool=[...D.traits], result=[]; for(let i=0;i<3;i++) result.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); return result; };
  const btn = (label, action, cls='', extra='') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  let state, phase='setup', count=mode==='job'?5:6, timer=null, audio=null, audioOn=false;
  try {audioOn=localStorage.getItem('party-sound')==='on';}catch{}
  const soundButton=document.querySelector('#sound');
  function soundLabel(){soundButton.textContent=audioOn?'♪ 音效开':'♪ 音效关';soundButton.setAttribute('aria-pressed',String(audioOn));}
  function unlock(){if(!audioOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
  function beep(end=false,urgent=false){
    if(!audioOn)return;unlock();if(!audio)return;
    try{for(let k=0;k<(urgent&&!end?3:1);k++){
      const o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime+k*.22;
      o.type=end?'sawtooth':'sine';o.frequency.value=end?180:urgent?1040:700;
      g.gain.setValueAtTime(.09,at);g.gain.exponentialRampToValueAtTime(.001,at+(end?.7:.12));
      o.connect(g);g.connect(audio.destination);o.start(at);o.stop(at+(end?.75:.15));
    }}catch{}
  }
  soundButton.addEventListener('click',()=>{audioOn=!audioOn;try{localStorage.setItem('party-sound',audioOn?'on':'off');}catch{}unlock();soundLabel();if(audioOn)beep();});soundLabel();
  function stopTimer(){if(timer)clearInterval(timer.id);timer=null;document.body.classList.remove('urgent');}
  function paintTimer(){if(!timer)return;const el=document.querySelector('[data-clock]');if(el)el.textContent=`${String(Math.floor(timer.remaining/60)).padStart(2,'0')}:${String(timer.remaining%60).padStart(2,'0')}`;const toggle=document.querySelector('[data-action="timer-toggle"]');if(toggle)toggle.textContent=timer.running?'暂停':timer.remaining===0?'时间到':'开始 / 继续';if(toggle)toggle.disabled=timer.remaining===0;document.body.classList.toggle('urgent',timer.total===45&&timer.running&&timer.remaining<=5&&timer.remaining>0);}
  function tick(){if(!timer?.running)return;const next=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));if(next!==timer.remaining){timer.remaining=next;if(next===0){timer.running=false;beep(true);const label=document.querySelector('.timer-label');if(label)label.textContent='时间到！请停止表演 / 提问';}else beep(false,timer.total===45&&next<=5);paintTimer();}}
  function initTimer(total,auto=false){stopTimer();timer={total,remaining:total,running:auto,deadline:Date.now()+total*1000};timer.id=setInterval(tick,100);paintTimer();}
  const timerUI = (small=false) => `<div class="timer ${small?'small-timer':''}" data-clock role="timer" aria-label="剩余时间"></div><div class="timer-label" role="status">${small?'45 秒路演 · 最后 5 秒闪烁提醒':'180 秒 · 手机放桌面，全员开演'}</div><div class="actions">${btn('开始 / 继续','timer-toggle')}${btn('重置计时','timer-reset','secondary')}</div>`;
  function steps(active){const labels=mode==='wasabi'?['人数设置','传阅身份','聊天开演','揭晓影帝']:mode==='two'?['演员就位','防窥看牌','记者审讯','揭晓混子']:['老板上任','即兴面试','发放 Offer'];return `<div class="steps">${labels.map((v,i)=>`<span class="${i===active?'active':''}">${i+1} ${v}</span>`).join('')}</div>`;}
  function hero(kicker,title,sub){return `<section class="hero"><span class="badge">${kicker}</span><h1>${title}</h1><p class="muted">${sub}</p></section>`;}
  function renderSetup(){stopTimer();phase='setup';state=null;app.innerHTML=steps(0)+hero(mode==='wasabi'?'ACT 01 / 表情管理':mode==='two'?'ACT 02 / 默契危机':'ACT 03 / 全员上岗',names[mode],mode==='wasabi'?'一桌正常人，一个藏不住的影帝。谁先露馅？':mode==='two'?'一个知道全部，一个全靠硬编。搭档别拆台！':'简历越离谱，态度越诚恳。老板，您看我还有机会吗？')+(mode==='two'?`<section class="panel"><h2>两位联合发布人，请就位。</h2><p>选出 2 名玩家并排坐好，分别担任演员 A、演员 B。其余人组成娱记审讯团。</p><p class="muted">看牌时其余人转身；A、B 依次确认身份后查看，搭档也要避开屏幕。看完隐藏，再进入 3 分钟发布会。</p>${btn('生成双簧剧本 →','deal','full')}</section>`:`<section class="panel"><label for="players">${mode==='wasabi'?'玩家人数':'应聘者人数（另选 1 人当冷血 HR）'}</label><div class="range"><input id="players" type="range" min="${mode==='wasabi'?4:2}" max="10" value="${count}"><output class="count" for="players">${count}</output></div><p class="muted">${mode==='wasabi'?'4–10 人 · 单手机依次传阅 · 3 分钟聊天':'2–10 位应聘者 + 1 位老板 · 每人 45 秒强行圆谎'}</p>${mode==='job'?`<div class="paper panel"><div class="eyebrow" style="color:#101018">今日热招 / NOW HIRING</div><h2 id="job-preview">${pick(D.jobs)}</h2></div>${btn('↻ 刷新招聘职位','job-refresh','secondary full')}<div class="actions">${btn('老板就位，开始发简历 →','deal')}</div>`:btn('开始发牌 →','deal','full')}</section>`);}
  function deal(){stopTimer();if(mode==='wasabi'){state={poison:Math.floor(Math.random()*count)+1,restriction:pick(D.restrictions),topic:pick(D.topics),player:1,visible:false};phase='cards';renderWasabiCard();}else if(mode==='two'){state={expert:Math.random()<.5?'A':'B',script:pick(D.scripts),seen:{A:false,B:false},actor:null,visible:false};phase='cards';renderTwoCards();}else{state={job:document.querySelector('#job-preview').textContent,people:Array.from({length:count},()=>({traits:null,open:false})),active:null,round:1};phase='interviews';renderJobs();}}
  function renderWasabiCard(){const s=state;app.innerHTML=steps(1)+`<p class="eyebrow">PRIVATE CASTING / ${s.player} OF ${count}</p>`+(s.visible?`<section class="panel ${s.player===s.poison?'secret':'safe'}"><h2>${s.player===s.poison?'⚠ 你是中毒影帝！':'✓ 正常人'}</h2><p>${s.player===s.poison?'在接下来的 3 分钟聊天里，暗中执行以下指令，且死不承认：':'请自然地聊话题，并眯着眼睛观察身边谁的微表情或动作不对劲！'}</p>${s.player===s.poison?`<h2>${s.restriction}</h2>`:''}${btn('看完了，隐藏并传给下一位','hide','secondary full')}</section>`:`<section class="panel center"><span class="lock" aria-hidden="true">🔒</span><p class="muted">请其他玩家移开视线</p><h2>请递给玩家 ${s.player}</h2><p>确认手机在本人手里后再查看。</p>${btn(`我是玩家 ${s.player}，点击查看`,'show','full')}</section>`);}
  function renderTwoCards(){const s=state;app.innerHTML=steps(1)+hero('PRIVATE / 别偷看','剧本，只给本人看','一次只展开一张卡。另一位演员请移开视线。')+`<div class="split">${['A','B'].map(a=>`<section class="panel"><h3>演员 ${a} 专属区</h3><p class="muted">${s.seen[a]?'✓ 已看完并隐藏':'🔒 尚未查看'}</p>${btn(s.seen[a]?'已锁定':`请递给演员 ${a}`,'actor','secondary',`data-actor="${a}" ${s.seen[a]?'disabled':''}`)}</section>`).join('')}</div>`+(s.actor?`<section class="panel ${s.visible?'secret':'center'}">${s.visible?`<h2>${s.actor===s.expert?'🎓 你是真专家':'⚠ 你什么都不知道！'}</h2><p>${s.actor===s.expert?s.script.secretDetail:'请盯着搭档的眼睛，根据他说的话现场即兴附和、强行补充细节，装作这件事也是你亲历的！'}</p>${btn('看完了，隐藏并传给下一位','hide','secondary full')}`:`<span class="lock">🔒</span><h2>请递给演员 ${s.actor}</h2>${btn(`我是演员 ${s.actor}，点击查看`,'show','full')}`}</section>`:'')+`<section class="panel paper"><div class="eyebrow" style="color:#101018">两位共享的公开标题</div><h2>${s.script.title}</h2></section>${s.seen.A&&s.seen.B?btn('底牌已隐藏，开始记者审讯 →','public','full'):''}`;}
  function renderPublic(){stopTimer();phase='public';const two=mode==='two';app.innerHTML=steps(2)+hero(two?'PRESS CONFERENCE / 限时追问':'ON AIR / 全员处刑',two?'发布会，开始！':'谁在偷偷加戏？',two?'记者团轮流追问，两位演员都要回答。':'自然聊天、留心表情。结束后大家一指禅投票，再揭晓。')+`<section class="panel paper"><div class="eyebrow" style="color:#101018">${two?'今日头条':'日常聊天话题'}</div><h2>${two?state.script.title:state.topic}</h2></section><section class="panel">${timerUI()}</section>`+(two?`<section class="panel"><h3>记者团 · 灵感助攻</h3><div class="questions">${[1,2,3].map((x,i)=>btn(`提问灵感 ${x}`,'question','',`data-question="${i}" aria-expanded="false"`)).join('')}</div></section>`:'')+btn(two?'揭晓谁是混子 →':'一指禅投票结束，揭晓影帝 →','reveal','danger full');initTimer(180,two);}
  function reveal(){stopTimer();phase='reveal';app.innerHTML=steps(3)+hero('THE BIG REVEAL / 演技结算',mode==='two'?`演员 ${state.expert==='A'?'B':'A'} 是混子！`:`玩家 ${state.poison} 是影帝！`,'全桌掌声，送给这位深藏不露的朋友。')+`<section class="panel secret"><h3>${mode==='two'?`真专家是演员 ${state.expert} · 真实剧本`:'TA 的秘密演技限制令'}</h3><h2>${mode==='two'?state.script.title:state.restriction}</h2>${mode==='two'?`<p>${state.script.secretDetail}</p>`:''}</section>${btn('下一局，再飙一次 →','next','full')}`;}
  function renderJobs(){const s=state;app.innerHTML=steps(1)+`<section class="sticky-job"><div class="eyebrow">ROUND ${s.round} / 冷血 HR 正在招聘</div><h2>${s.job}</h2></section><p class="muted">轮到谁就展开谁的简历。把三个词全都圆进自我介绍，老板听完发 Offer。</p>`+s.people.map((p,i)=>`<section class="panel applicant"><h3>应聘者 ${i+1}</h3>${p.open?`<div class="chips">${p.traits.map(t=>`<span class="chip">${t}</span>`).join('')}</div><div class="actions">${btn('↻ 单独重抽此人','reroll','secondary',`data-person="${i}"`)}${btn('收起简历','fold','secondary',`data-person="${i}"`)}</div>${s.active===i?timerUI(true):`<div class="actions">${btn('▶ 开始 45 秒路演','pitch','',`data-person="${i}"`)}</div>`}<div class="actions">${btn('录用发 Offer 🎉','offer','danger',`data-person="${i}"`)}</div>`:`<p class="muted">3 个离谱特长 · 即开即演</p>${btn('展开这份简历 →','resume','full',`data-person="${i}"`)}`}</section>`).join('');paintTimer();}
  function offer(i){stopTimer();phase='offer';app.innerHTML=steps(2)+`<section class="panel center"><span class="badge">YOU ARE HIRED</span><h2>应聘者 ${i+1}</h2><div class="offer">录用！</div><p>恭喜入职「${state.job}」</p><p class="muted">老板可以换人当，下一轮继续硬编。</p>${btn('下一轮招聘 →','job-next','full')}</section>`;const box=document.createElement('div');box.className='confetti';box.setAttribute('aria-hidden','true');box.innerHTML=Array.from({length:70},()=>`<i style="--x:${Math.random()*100}%;--c:${pick(['#c5ff4a','#ff58b6','#56e5ff','#ffe25a'])};--d:${Math.random()*.5}s"></i>`).join('');document.body.append(box);setTimeout(()=>box.remove(),3500);beep(true);}
  app.addEventListener('input',e=>{if(e.target.id==='players'){count=Number(e.target.value);document.querySelector('output').textContent=count;}});
  app.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;unlock();const a=b.dataset.action,i=Number(b.dataset.person);switch(a){
    case 'deal':deal();break;
    case 'job-refresh':document.querySelector('#job-preview').textContent=pick(D.jobs.filter(j=>j!==document.querySelector('#job-preview').textContent));break;
    case 'show':if(phase!=='cards')break;state.visible=true;mode==='wasabi'?renderWasabiCard():renderTwoCards();break;
    case 'hide':state.visible=false;if(mode==='wasabi'){if(state.player<count){state.player++;renderWasabiCard();}else{phase='ready';app.innerHTML=steps(1)+`<section class="panel center"><span class="lock">✓</span><h2>全员看完，秘密已隐藏。</h2><p>把手机放到桌子中央，准备聊天。</p>${btn('进入公共屏 →','public','full')}</section>`;}}else{state.seen[state.actor]=true;state.actor=null;renderTwoCards();}break;
    case 'actor':if(state.visible||state.seen[b.dataset.actor])break;state.actor=b.dataset.actor;renderTwoCards();break;
    case 'public':renderPublic();break;
    case 'timer-toggle':if(!timer||timer.remaining===0)break;if(timer.running){tick();timer.running=false;}else{timer.deadline=Date.now()+timer.remaining*1000;timer.running=true;}paintTimer();break;
    case 'timer-reset':if(timer)initTimer(timer.total);break;
    case 'reveal':reveal();break;
    case 'next':renderSetup();break;
    case 'question':b.textContent=D.questions[Number(b.dataset.question)];b.setAttribute('aria-expanded','true');break;
    case 'resume':state.people[i].traits ||= triple();state.people[i].open=true;renderJobs();break;
    case 'fold':state.people[i].open=false;if(state.active===i){stopTimer();state.active=null;}renderJobs();break;
    case 'reroll':state.people[i].traits=triple();renderJobs();break;
    case 'pitch':state.active=i;renderJobs();initTimer(45,true);break;
    case 'offer':offer(i);break;
    case 'job-next':state={job:pick(D.jobs.filter(j=>j!==state.job)),people:Array.from({length:count},()=>({traits:null,open:false})),active:null,round:state.round+1};phase='interviews';renderJobs();break;
  }});
  function hideOnLeave(){if(phase==='cards'&&state?.visible){state.visible=false;mode==='wasabi'?renderWasabiCard():renderTwoCards();}tick();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hideOnLeave();else tick();});window.addEventListener('pagehide',hideOnLeave);window.addEventListener('blur',hideOnLeave);
  const dialog=document.querySelector('#restart-dialog');document.querySelector('#restart').addEventListener('click',()=>{hideOnLeave();dialog.showModal();});document.querySelector('#cancel-restart').addEventListener('click',()=>dialog.close());document.querySelector('#confirm-restart').addEventListener('click',()=>{dialog.close();renderSetup();});
  document.querySelectorAll('nav a').forEach(link=>link.addEventListener('click',hideOnLeave));
  window.addEventListener('pageshow',hideOnLeave);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('../service-worker.js').catch(()=>{});
  renderSetup();
})();
