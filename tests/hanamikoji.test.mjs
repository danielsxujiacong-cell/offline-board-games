import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,shuffle,accept,act,choose,settle,nextRound,view,counts,winner,VALUES,ACTIONS,beginReview,closeReview,hidePrivate,scores} from '../games/hanamikoji/engine.js';
const all=s=>[s.removed,...s.deck,...s.players.flatMap(p=>[...p.hand,...p.table,...p.secret,...p.discard]),...(s.pending?.cards||[])];
function playRound(s){for(let i=0;i<8;i++){accept(s);const a=['secret','discard','gift','compete'][Math.floor(i/2)];act(s,a,s.players[s.turn].hand.slice(0,{secret:1,discard:2,gift:3,compete:4}[a]).map(c=>c.id));if(s.pending){accept(s);choose(s,i%2);}assert.equal(all(s).length,21);}return s;}
test('21 unique cards, correct multiplicities, 6/6/8/1 deal and unbiased-shuffle boundaries',()=>{const s=newGame();assert.equal(all(s).length,21);assert.equal(new Set(all(s).map(c=>c.id)).size,21);assert.deepEqual(VALUES.map((_,i)=>all(s).filter(c=>c.type===i).length),VALUES);assert.deepEqual(s.players.map(p=>p.hand.length),[6,6]);assert.equal(s.deck.length,8);const a=[1,2,3];assert.deepEqual(shuffle(a,()=>.999),a);assert.deepEqual(shuffle(a,()=>0),[2,3,1]);assert.deepEqual(a,[1,2,3]);});
test('handoff never exposes private cards; acceptance draws exactly once',()=>{const s=newGame();assert.deepEqual(view(s).hand,[]);accept(s);assert.equal(view(s).hand.length,7);assert.equal(s.deck.length,7);assert.throws(()=>accept(s));act(s,'secret',[s.players[0].hand[0].id]);assert.deepEqual(view(s).hand,[]);assert.equal(view(s).players[0].counts.reduce((a,b)=>a+b),0);assert.equal(s.players[0].secret.length,1);assert.equal(s.turn,1);accept(s);assert.equal(s.players[1].hand.length,7);});
test('gift is selected by opponent, remaining cards go to actor; no draw during choice',()=>{const s=newGame();accept(s);const cards=s.players[0].hand.slice(0,3);act(s,'gift',cards.map(c=>c.id));assert.equal(view(s).pending,null);assert.deepEqual(view(s).hand,[]);assert.equal(s.recipient,1);accept(s);assert.deepEqual(view(s).hand,[]);assert.equal(view(s).pending.cards.length,3);assert.equal(s.deck.length,7);assert.throws(()=>choose(s,3));choose(s,1);assert.deepEqual(s.players[1].table,[cards[1]]);assert.equal(s.players[0].table.length,2);assert.equal(s.turn,1);assert.equal(view(s).pending,null);accept(s);assert.equal(s.deck.length,6);});
test('competition preserves ordered pairs and both opponent choices',()=>{for(const option of [0,1]){const s=newGame();accept(s);const cards=s.players[0].hand.slice(0,4);act(s,'compete',cards.map(c=>c.id));accept(s);choose(s,option);assert.deepEqual(s.players[1].table,cards.slice(option*2,option*2+2));assert.equal(s.players[0].table.length,2);}});
test('invalid actions cannot mutate state or reuse action',()=>{const s=newGame();assert.throws(()=>act(s,'secret',[]));accept(s);const before=JSON.stringify(s);for(const [a,ids] of [['bad',[]],['discard',[s.players[0].hand[0].id,s.players[0].hand[0].id]],['secret',['missing']]])assert.throws(()=>act(s,a,ids));assert.equal(JSON.stringify(s),before);act(s,'secret',[s.players[0].hand[0].id]);accept(s);act(s,'secret',[s.players[1].hand[0].id]);accept(s);assert.throws(()=>act(s,'secret',[s.players[0].hand[0].id]));});
test('all four actions, conservation, round-end confirmation and secret scoring',()=>{const s=playRound(newGame());assert.equal(s.phase,'roundEnd');assert.equal(s.deck.length,0);for(const p of s.players){assert.equal(p.hand.length,0);assert.equal(p.used.length,4);assert.equal(p.discard.length,2);assert.equal(p.secret.length,1);assert.equal(counts(p).reduce((a,b)=>a+b),7);assert.equal(counts(p,true).reduce((a,b)=>a+b),8);}assert.throws(()=>accept(s));settle(s);assert.ok(['roundResult','gameOver'].includes(s.phase));assert.throws(()=>settle(s));});
test('ties and zero counts retain support; larger count moves support',()=>{const s=newGame();s.phase='roundEnd';s.markers=[0,1,null,null,null,null,null];s.players.forEach(p=>{p.table=[];p.secret=[];});s.players[0].secret=[{type:2}];settle(s);assert.deepEqual(s.markers,[0,1,0,null,null,null,null]);});
test('next round retains markers, alternates starter, resets all cards and actions',()=>{let s=playRound(newGame());s.phase='roundResult';s.markers=[0,1,null,0,1,null,null];const old=[...s.markers];s=nextRound(s);assert.deepEqual(s.markers,old);assert.equal(s.starter,1);assert.equal(s.turn,1);assert.equal(s.round,2);assert.equal(all(s).length,21);assert.ok(s.players.every(p=>p.used.length===0&&p.secret.length===0&&p.discard.length===0&&p.table.length===0));s.phase='roundResult';s=nextRound(s);assert.equal(s.starter,0);assert.equal(s.round,3);});
test('four supporters, eleven charm, no winner, and charm priority',()=>{assert.equal(winner([0,0,0,0,null,null,null]),0);assert.equal(winner([null,null,null,null,1,1,1]),1);assert.equal(winner([0,0,0,0,1,1,1]),1);assert.equal(winner([null,null,null,null,null,null,null]),-1);assert.equal(winner([1,1,1,1,0,0,0]),0);});
test('many complete games keep invariants through randomized selections',()=>{for(let n=0;n<80;n++){let s=newGame();for(let round=0;round<10;round++){playRound(s);settle(s);assert.equal(new Set(all(s).map(c=>c.id)).size,21);if(s.phase==='gameOver')break;s=nextRound(s);}}});

function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];}
function conserved(s){const cards=all(s);assert.equal(cards.length,21);assert.equal(new Set(cards.map(c=>c.id)).size,21);assert.deepEqual(VALUES.map((_,type)=>cards.filter(c=>c.type===type).length),VALUES);}
function immutableRejection(s,fn){const before=structuredClone(s);assert.throws(fn);assert.deepEqual(s,before);}

test('all 576 pairs of action orders: legal hands, exact transfers, conservation after every transition',()=>{
 const orders=permutations(Object.keys(ACTIONS));let seed=0;
 for(const first of orders)for(const second of orders){
  const random=rng(++seed),s=newGame(random),ordersByPlayer=[first,second];
  for(let turn=0;turn<8;turn++){
   const actor=s.turn,p=s.players[actor],deckSize=s.deck.length,handSize=p.hand.length;
   conserved(s);accept(s);assert.equal(s.deck.length,deckSize-1);assert.equal(p.hand.length,handSize+1);
   const action=ordersByPlayer[actor][p.used.length],cards=shuffle(p.hand,random).slice(0,ACTIONS[action]);
   const beforeTables=s.players.map(p=>p.table.length);
   act(s,action,cards.map(c=>c.id));conserved(s);assert.equal(p.hand.length,handSize+1-ACTIONS[action]);
   assert.equal(view(s).hand.length,0);
   if(action==='gift'||action==='compete'){
    const drawCount=s.deck.length;assert.equal(view(s).pending,null);accept(s);assert.equal(s.deck.length,drawCount);
    assert.equal(view(s).hand.length,0);const option=Math.floor(random()*(action==='gift'?3:2));
    choose(s,option);conserved(s);
    const received=action==='gift'?[cards[option]]:cards.slice(option*2,option*2+2);
    assert.deepEqual(s.players[1-actor].table.slice(beforeTables[1-actor]),received);
    assert.deepEqual(p.table.slice(beforeTables[actor]),cards.filter(c=>!received.includes(c)));
   }
   assert.equal(new Set(p.used).size,p.used.length);
  }
  assert.equal(s.phase,'roundEnd');assert.ok(s.players.every(p=>p.hand.length===0&&p.used.length===4));
  assert.equal(s.deck.length,0);assert.equal(all(s).filter(c=>c===s.removed).length,1);
  const expected=s.markers.map((m,i)=>{const [a,b]=s.players.map(p=>[...p.table,...p.secret].filter(c=>c.type===i).length);return a===b?m:a>b?0:1;});
  settle(s);conserved(s);assert.deepEqual(s.markers,expected);
 }
});

test('bad card counts and opponent cards are rejected atomically for every action',()=>{
 for(const [action,n] of Object.entries(ACTIONS)){
  const s=newGame(rng(7));accept(s);const ids=s.players[0].hand.map(c=>c.id);
  for(const chosen of [ids.slice(0,n-1),ids.slice(0,n+1),[s.players[1].hand[0].id,...ids.slice(0,n-1)]])immutableRejection(s,()=>act(s,action,chosen));
 }
});

test('choices reject bad indices, early choice, duplicate choice and action during pending choice',()=>{
 for(const action of ['gift','compete']){
  const s=newGame();accept(s);act(s,action,s.players[0].hand.slice(0,ACTIONS[action]).map(c=>c.id));
  immutableRejection(s,()=>choose(s,0));immutableRejection(s,()=>act(s,'secret',[s.players[0].hand[0].id]));
  accept(s);for(const i of [-1,.5,NaN,Infinity,'0',action==='gift'?3:2])immutableRejection(s,()=>choose(s,i));
  choose(s,0);immutableRejection(s,()=>choose(s,0));
 }
});

test('nonzero ties keep prior owner, secrets count only at scoring, discards and removed never score',()=>{
 const s=newGame();s.phase='roundEnd';s.markers=[1,0,null,null,null,null,null];
 s.players.forEach(p=>{p.table=[];p.secret=[];p.discard=[];});
 s.players[0].table=[{type:0},{type:1},{type:2}];s.players[1].table=[{type:0},{type:1}];
 s.players[1].secret=[{type:2}];s.players[0].secret=[{type:3}];s.players[1].discard=[{type:3},{type:3}];s.removed={type:3};
 assert.equal(view(s).players[1].counts[2],0);settle(s);
 assert.deepEqual(s.markers,[1,0,null,0,null,null,null]);assert.equal(view(s).players[1].counts[2],1);
});

test('all 2187 support arrangements obey 11-point priority over four supporters',()=>{
 for(let code=0;code<3**7;code++){
  let x=code;const markers=VALUES.map(()=>{const v=x%3;x=Math.floor(x/3);return [null,0,1][v];});
  const pointTotals=[0,1].map(p=>markers.reduce((sum,m,i)=>sum+(m===p?VALUES[i]:0),0));
  let expected=-1;for(const p of [0,1])if(pointTotals[p]>=11)expected=p;
  if(expected<0)for(const p of [0,1])if(markers.filter(m=>m===p).length>=4)expected=p;
  assert.equal(winner(markers),expected);assert.equal(scores(markers)[0].points,pointTotals[0]);
 }
});

test('scoring and next round are disallowed before completion; victory ends the game',()=>{
 const s=newGame();immutableRejection(s,()=>settle(s));immutableRejection(s,()=>nextRound(s));
 s.phase='roundEnd';s.markers=[null,null,null,null,1,1,1];s.players.forEach(p=>{p.table=[];p.secret=[];});settle(s);
 assert.equal(s.winner,1);assert.equal(s.phase,'gameOver');immutableRejection(s,()=>nextRound(s));immutableRejection(s,()=>accept(s));
});

test('fresh restart clears all progress and does not reuse previous arrays',()=>{
 const old=playRound(newGame(rng(4)));settle(old);const fresh=newGame(rng(5));
 assert.equal(fresh.round,1);assert.equal(fresh.starter,0);assert.equal(fresh.winner,null);assert.equal(fresh.pending,null);assert.equal(fresh.phase,'handoff');
 assert.deepEqual(fresh.markers,Array(7).fill(null));assert.ok(fresh.players.every(p=>p.used.length===0&&p.table.length===0&&p.secret.length===0&&p.discard.length===0));
 const snapshot=structuredClone(old);accept(fresh);assert.deepEqual(old,snapshot);conserved(fresh);
});

test('private review requires owner confirmation, shows only that owner, resumes without drawing',()=>{
 const s=newGame(rng(9));accept(s);act(s,'secret',[s.players[0].hand[0].id]);accept(s);act(s,'discard',s.players[1].hand.slice(0,2).map(c=>c.id));accept(s);
 const before={deck:s.deck.length,hand:[...s.players[0].hand],used:[...s.players[0].used]};
 beginReview(s,1);assert.deepEqual(view(s).hand,[]);assert.equal(view(s).privateCards,null);assert.equal(view(s).pending,null);
 accept(s);assert.equal(view(s).privateCards.player,1);assert.equal(view(s).privateCards.discard.length,2);assert.equal(view(s).privateCards.secret.length,0);
 immutableRejection(s,()=>beginReview(s,0));immutableRejection(s,()=>act(s,'gift',[]));
 hidePrivate(s);assert.equal(view(s).privateCards,null);accept(s);closeReview(s);
 assert.equal(s.phase,'resumeHandoff');assert.equal(s.recipient,0);assert.deepEqual(view(s).hand,[]);accept(s);
 assert.equal(s.deck.length,before.deck);assert.deepEqual(s.players[0].hand,before.hand);assert.deepEqual(s.players[0].used,before.used);conserved(s);
});

test('reviewing during a public choice or round end never resolves it or draws a card',()=>{
 const s=newGame();beginReview(s,0);accept(s);closeReview(s);assert.equal(s.phase,'handoff');assert.equal(s.deck.length,8);
 accept(s);act(s,'gift',s.players[0].hand.slice(0,3).map(c=>c.id));accept(s);
 const pending=structuredClone(s.pending),deck=s.deck.length;beginReview(s,0);accept(s);closeReview(s);
 assert.equal(s.phase,'handoff');assert.equal(s.recipient,1);assert.deepEqual(s.pending,pending);accept(s);assert.equal(s.phase,'choice');assert.equal(s.deck.length,deck);
 s.phase='roundEnd';beginReview(s,1);accept(s);closeReview(s);assert.equal(s.phase,'roundEnd');
});

test('backgrounding private hand repeatedly restores exactly the same turn without a draw',()=>{
 const s=newGame();accept(s);const hand=structuredClone(s.players[0].hand),deck=s.deck.length;
 for(let i=0;i<5;i++){hidePrivate(s);assert.equal(s.phase,'resumeHandoff');assert.equal(view(s).hand.length,0);hidePrivate(s);accept(s);assert.deepEqual(s.players[0].hand,hand);assert.equal(s.deck.length,deck);}
});
