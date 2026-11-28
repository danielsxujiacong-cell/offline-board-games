import {QUESTIONS} from './questions-data.js';

export const PACK_META={
  '边界与直觉':{icon:'🌀',desc:'分类边界 · 原版魂'},
  '吃喝与消费':{icon:'🍽️',desc:'干饭买买 · 极速吵架'},
  '生活与脑洞':{icon:'🧠',desc:'脑回路 · 离谱对比'},
  '观点与社交':{icon:'🗣️',desc:'价值观 · 社交拉扯'},
  '情侣日常':{icon:'💕',desc:'恋爱细节 · 求生欲'},
  '微醺暧昧':{icon:'🍷',desc:'深夜私密 · 成人幽默'},
};

export const DEFAULT_OFF_PACKS=new Set();
export const prompts=QUESTIONS.map(([category,left,right,hints=''],i)=>({id:`q-${i}`,category,left,right,hints}));
export const packs=Object.fromEntries(
  [...new Set(prompts.map(p=>p.category))].map(category=>[category,prompts.filter(p=>p.category===category).length])
);

export function shuffle(items){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

export function score(t,g){
  const d=Math.abs(t-g);
  return d<=3?4:d<=8?3:d<=14?2:0;
}

export function roundComment(points,bonus=false){
  if(points===4)return bonus?'正中红心！共用一个大脑 · 续命 +1 回合':'正中红心！共用一个大脑';
  if(points===3)return '就差一根头发丝！高度同频';
  if(points===2)return '擦边接住信号，算你们默契';
  return '确定插电源了吗？信号拐去火星了';
}

export function rating(total,rounds=6){
  const max=Math.max(1,rounds*4);
  const ratio=total/max;
  if(ratio>=0.85)return '共用一个大脑';
  if(ratio>=0.65)return '灵魂共鸣搭档';
  if(ratio>=0.42)return '电波勉强接通';
  if(ratio>=0.2)return '同频还在加载';
  return '建议检查电源线';
}

const BEST_KEY='wavelength-best-v2';
export function readBest(){
  try{
    const v=JSON.parse(localStorage.getItem(BEST_KEY)||'null');
    return v&&typeof v.bestScore==='number'?v:{bestScore:0,bestStreak:0,games:0};
  }catch{return {bestScore:0,bestStreak:0,games:0}}
}

export function recordBest(total,maxStreak){
  const prev=readBest();
  const isNewScore=total>prev.bestScore;
  const next={
    bestScore:Math.max(prev.bestScore,total),
    bestStreak:Math.max(prev.bestStreak,maxStreak||0),
    games:(prev.games||0)+1,
  };
  try{localStorage.setItem(BEST_KEY,JSON.stringify(next))}catch{}
  return {best:next,isNewScore};
}
