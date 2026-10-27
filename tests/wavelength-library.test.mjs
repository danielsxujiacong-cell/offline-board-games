import fs from 'node:fs';
const questions=JSON.parse(fs.readFileSync(new URL('../wavelength/questions.json',import.meta.url),'utf8'));
const prompts=questions.map(([category,left,right],i)=>({id:`q-${i}`,category,left,right}));
const packs=Object.fromEntries([...new Set(questions.map(row=>row[0]))].map(c=>[c,questions.filter(row=>row[0]===c).length]));

import assert from 'node:assert/strict';
assert.ok(questions.length>=300 && questions.length<=500,'精选300-500题');
assert.deepEqual(Object.keys(packs),['日常生活','美食消费','社交关系','亲密关系','娱乐脑洞','旅行自然']);
const seen=new Set();
for(const [i,row] of questions.entries()){
 assert.equal(row.length,3,`第${i+1}题应为[分类,左端,右端]`);
 for(const value of row){assert.equal(typeof value,'string');assert.ok(value.trim());assert.equal(value,value.trim());assert.ok(value.length<=36,`第${i+1}题过长`);assert.ok(!/[\n\r<>]/.test(value));}
 assert.notEqual(row[1],row[2],`第${i+1}题两端相同`);
 const key=row.slice(1).map(s=>s.normalize('NFKC').replace(/[\s，。！？、：；]/g,'')).sort().join('|');
 assert.ok(!seen.has(key),`第${i+1}题重复或反向重复`);seen.add(key);
}
assert.equal(prompts.length,questions.length);assert.equal(new Set(prompts.map(p=>p.id)).size,questions.length);
assert.equal(Object.values(packs).reduce((a,n)=>a+n,0),questions.length);assert.ok(packs['亲密关系']>=120,'亲密关系至少120题');

console.log(`PASS ${questions.length}题 / ${Object.keys(packs).length}类：格式、长度、去重、ID、洗牌`);
