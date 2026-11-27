import fs from 'node:fs';
import assert from 'node:assert/strict';

const questions=JSON.parse(fs.readFileSync(new URL('../wavelength/questions.json',import.meta.url),'utf8'));
const prompts=questions.map(([category,left,right,hints=''],i)=>({id:`q-${i}`,category,left,right,hints}));
const packs=Object.fromEntries([...new Set(questions.map(row=>row[0]))].map(c=>[c,questions.filter(row=>row[0]===c).length]));

assert.equal(questions.length,210,'精选210题');
assert.deepEqual(Object.keys(packs),['边界与直觉','吃喝与消费','生活与脑洞','观点与社交','情侣日常','微醺暧昧']);
const seen=new Set();
for(const [i,row] of questions.entries()){
  assert.equal(row.length,4,`第${i+1}题应为[分类,左端,右端,灵感]`);
  for(const value of row){assert.equal(typeof value,'string');assert.ok(value.trim());assert.equal(value,value.trim());assert.ok(!/[\n\r<>]/.test(value));}
  assert.ok(row[1].length>=1&&row[1].length<=6,`第${i+1}题左端超6字`);
  assert.ok(row[2].length>=1&&row[2].length<=6,`第${i+1}题右端超6字`);
  assert.notEqual(row[1],row[2],`第${i+1}题两端相同`);
  const key=row.slice(1,3).map(s=>s.normalize('NFKC').replace(/[\s，。！？、：；]/g,'')).sort().join('|');
  assert.ok(!seen.has(key),`第${i+1}题重复或反向重复`);seen.add(key);
}
assert.equal(prompts.length,questions.length);
assert.equal(new Set(prompts.map(p=>p.id)).size,questions.length);
assert.equal(Object.values(packs).reduce((a,n)=>a+n,0),questions.length);
console.log(`PASS ${questions.length}题 / ${Object.keys(packs).length}类：格式、长度、去重、ID、灵感`);
