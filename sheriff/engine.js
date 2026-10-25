export const GOODS = {
 apple:{name:'苹果',emoji:'🍎',count:48,value:2,penalty:2,bonus:15},
 cheese:{name:'奶酪',emoji:'🧀',count:36,value:3,penalty:2,bonus:12},
 chicken:{name:'小鸡',emoji:'🐔',count:24,value:4,penalty:2,bonus:10},
 pepper:{name:'胡椒',emoji:'🌶️',count:18,value:6,penalty:4},
 mead:{name:'蜂蜜酒',emoji:'🍺',count:16,value:7,penalty:4},
 silk:{name:'丝绸',emoji:'🧣',count:9,value:8,penalty:4},
 crossbow:{name:'十字弩',emoji:'🏹',count:5,value:9,penalty:4}
};
export const LEGAL = ['apple','cheese','chicken'];
export const merchant = s => (s.round-1)%2;
export const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const check = (ok,msg) => {if(!ok) throw Error(msg);};
function draw(s,p){while(p.hand.length<8){if(!s.deck.length){s.deck=shuffle(s.discard);s.discard=[];}check(s.deck.length,'牌库不足');p.hand.push(s.deck.pop());}}
export function create(names){const s={version:1,round:1,phase:'market',deck:shuffle(Object.entries(GOODS).flatMap(([k,g])=>Array(g.count).fill(k))),discard:[],players:names.map(name=>({name:name.trim().slice(0,16)||'玩家',coins:50,hand:[],stall:[],vault:[]})),bags:[],reports:[]};s.players.forEach(p=>draw(s,p));return s;}
export function exchange(s,indices){check(s.phase==='market','当前不能换牌');check(new Set(indices).size===indices.length&&indices.length<=5&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<8),'最多换五张');const p=s.players[merchant(s)];const removed=p.hand.filter((_,i)=>indices.includes(i));p.hand=p.hand.filter((_,i)=>!indices.includes(i));draw(s,p);s.discard.push(...removed);s.phase='pack';}
export function validateBags(s,bags){check(bags.length===2,'需要两个袋子');const ids=bags.flatMap(b=>b.indices);check(ids.length<=7&&new Set(ids).size===ids.length,'两袋合计最多七张，不可重复');for(const b of bags){check(b.indices.length>=1&&b.indices.length<=4,'每袋一至四张');check(LEGAL.includes(b.declared),'只能申报合法物资');check(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<s.players[merchant(s)].hand.length),'无效卡牌');}check(bags.every(b=>Number.isInteger(b.bribe)&&b.bribe>=0)&&bags.reduce((n,b)=>n+b.bribe,0)<=Math.max(0,s.players[merchant(s)].coins),'买路财总额不可超过现有金币');}
export function seal(s,bags){check(s.phase==='pack','当前不能装袋');validateBags(s,bags);const p=s.players[merchant(s)];s.bags=bags.map(b=>({declared:b.declared,bribe:b.bribe,cards:b.indices.map(i=>p.hand[i])}));const used=bags.flatMap(b=>b.indices);p.hand=p.hand.filter((_,i)=>!used.includes(i));s.phase='sheriff';}
export function negotiate(s,bribes){check(s.phase==='sheriff','当前不能谈判');check(bribes.length===2&&bribes.every(n=>Number.isInteger(n)&&n>=0)&&bribes.reduce((a,b)=>a+b,0)<=Math.max(0,s.players[merchant(s)].coins),'买路财总额不可超过现有金币');s.bags.forEach((b,i)=>b.bribe=bribes[i]);}
export function resolve(s,inspect){check(s.phase==='sheriff'&&[-1,0,1].includes(inspect),'无效裁决');const m=s.players[merchant(s)],sheriff=s.players[1-merchant(s)];s.reports=s.bags.map((b,i)=>{const inspected=i===inspect,wrong=inspected?b.cards.filter(k=>k!==b.declared):[],accepted=inspected?b.cards.filter(k=>k===b.declared):b.cards;let transfer=0;if(!inspected)transfer=b.bribe;else if(wrong.length)transfer=wrong.reduce((n,k)=>n+GOODS[k].penalty,0);else transfer=-b.cards.reduce((n,k)=>n+GOODS[k].penalty,0);m.coins-=transfer;sheriff.coins+=transfer;accepted.forEach(k=>(LEGAL.includes(k)?m.stall:m.vault).push(k));s.discard.push(...wrong);return {inspected,declared:b.declared,count:b.cards.length,visible:inspected?b.cards:accepted.filter(k=>LEGAL.includes(k)),hidden:inspected?0:accepted.filter(k=>!LEGAL.includes(k)).length,wrong,transfer};});draw(s,m);s.bags=[];s.phase='result';}
export function next(s){check(s.phase==='result','当前不能换回合');if(s.round===6)s.phase='over';else{s.round++;s.phase='market';s.reports=[];}}
export function scores(s){return s.players.map((p,i)=>{const legal=p.stall.reduce((n,k)=>n+GOODS[k].value,0),black=p.vault.reduce((n,k)=>n+GOODS[k].value,0);const crowns=LEGAL.map(k=>{const mine=p.stall.filter(x=>x===k).length,other=s.players[1-i].stall.filter(x=>x===k).length;return mine===0?0:mine>other?GOODS[k].bonus:mine===other?Math.floor(GOODS[k].bonus/2):0;});return {coins:p.coins,legal,black,crowns,total:p.coins+legal+black+crowns.reduce((a,b)=>a+b,0)};});}
