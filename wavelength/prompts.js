const response=await fetch(new URL('./questions.json',import.meta.url),{cache:'no-store'});
if(!response.ok)throw new Error('题库加载失败，请联网刷新后重试');
const questions=await response.json();
export const prompts=questions.map(([category,left,right],i)=>({id:`q-${i}`,category,left,right}));
export const packs=Object.fromEntries([...new Set(prompts.map(p=>p.category))].map(category=>[category,prompts.filter(p=>p.category===category).length]));
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function score(t,g){const d=Math.abs(t-g);return d<=3?4:d<=8?3:d<=14?2:0}
export function rating(n){return n>=21?'共用一个大脑':n>=16?'灵魂共鸣搭档':n>=9?'同频还在加载':'跨服聊天选手'}
