export const VALUES = [2,2,2,3,3,4,5];
export const ACTIONS = {secret:1, discard:2, gift:3, compete:4};
export function shuffle(cards, rng = Math.random) {
  const a = [...cards];
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
export function newGame(rng = Math.random) { return deal({round:0, starter:0, markers:Array(7).fill(null)},rng); }
function deal(old,rng) {
  const cards=shuffle(VALUES.flatMap((n,type)=>Array.from({length:n},(_,i)=>({id:`${type}-${i}`,type}))),rng);
  return {round:old.round+1,starter:old.starter,turn:old.starter,markers:[...old.markers],
    removed:cards.pop(),deck:cards.slice(12),players:[0,1].map(p=>({hand:cards.slice(p*6,p*6+6),table:[],secret:[],discard:[],used:[]})),
    phase:'handoff',recipient:old.starter,pending:null,winner:null};
}
export function accept(s) {
  if(s.phase!=='handoff') throw Error('当前无需交接');
  if(s.pending) { s.phase='choice'; return; }
  const card=s.deck.pop(); if(!card) throw Error('牌库已空');
  s.players[s.turn].hand.push(card); s.phase='action';
}
export function act(s,action,ids) {
  const p=s.players[s.turn];
  if(s.phase!=='action'||!Object.hasOwn(ACTIONS,action)||p.used.includes(action)) throw Error('行动不可用');
  if(new Set(ids).size!==ACTIONS[action]||ids.length!==ACTIONS[action]||ids.some(id=>!p.hand.some(c=>c.id===id))) throw Error('所选牌数错误');
  const cards=ids.map(id=>p.hand.find(c=>c.id===id));
  p.hand=p.hand.filter(c=>!ids.includes(c.id)); p.used.push(action);
  if(action==='secret'||action==='discard') { p[action].push(...cards); finish(s); }
  else { s.pending={action,cards,actor:s.turn}; s.recipient=1-s.turn; s.phase='handoff'; }
}
export function choose(s,index) {
  if(s.phase!=='choice'||!Number.isInteger(index)||index<0||index> (s.pending.action==='gift'?2:1)) throw Error('选择无效');
  const {action,cards,actor}=s.pending;
  const taken=action==='gift'?[cards[index]]:cards.slice(index*2,index*2+2);
  s.players[1-actor].table.push(...taken); s.players[actor].table.push(...cards.filter(c=>!taken.includes(c)));
  s.pending=null; finish(s);
}
function finish(s) {
  if(s.players.every(p=>p.used.length===4)) {s.phase='roundEnd';s.recipient=null;}
  else {s.turn=1-s.turn;s.recipient=s.turn;s.phase='handoff';}
}
export function counts(p,reveal=false) { const a=Array(7).fill(0); for(const c of [...p.table,...(reveal?p.secret:[])]) a[c.type]++; return a; }
export function scores(markers) {return [0,1].map(p=>({count:markers.filter(m=>m===p).length,points:markers.reduce((n,m,i)=>n+(m===p?VALUES[i]:0),0)}));}
export function winner(markers) {const a=scores(markers);const points=a.findIndex(x=>x.points>=11);return points>=0?points:a.findIndex(x=>x.count>=4);}
export function settle(s) {
  if(s.phase!=='roundEnd') throw Error('本轮尚未结束');
  const a=s.players.map(p=>counts(p,true));
  s.markers=s.markers.map((m,i)=>a[0][i]===a[1][i]?m:a[0][i]>a[1][i]?0:1);
  const w=winner(s.markers);s.winner=w<0?null:w;s.phase=w<0?'roundResult':'gameOver';
}
export function nextRound(s,rng=Math.random) {
  if(s.phase!=='roundResult') throw Error('不可开始下一轮');
  return deal({...s,starter:1-s.starter},rng);
}
// Only public information crosses the privacy boundary. Hidden cards never enter the DOM.
export function view(s) {
  const reveal=['roundResult','gameOver'].includes(s.phase);
  return {round:s.round,turn:s.turn,phase:s.phase,recipient:s.recipient,markers:s.markers,scores:scores(s.markers),winner:s.winner,deck:s.deck.length,
    players:s.players.map(p=>({used:p.used,counts:counts(p,reveal),handSize:p.hand.length})),
    hand:s.phase==='action'?s.players[s.turn].hand:[],
    pending:s.phase==='choice'?s.pending:null};
}
