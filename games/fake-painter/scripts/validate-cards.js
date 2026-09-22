const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.resolve(root, process.argv[2] || 'data/cards.json');
const errors = [];
let cards;

try {
  cards = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(cards)) throw new Error('根内容必须是数组');
} catch (error) {
  console.error(`❌ JSON 无法读取：${error.message}`);
  process.exit(1);
}

const seen = new Set();
for (const [index, card] of cards.entries()) {
  const problems = [];
  const id = card && card.id;
  if (!id) problems.push('缺少 id');
  if (id && seen.has(id)) problems.push('id 重复');
  if (id) seen.add(id);
  if (!card || !String(card.title || '').trim()) problems.push('title 为空');
  if (!card || !Array.isArray(card.criteria) || card.criteria.length !== 10) {
    problems.push(`只有 ${card && Array.isArray(card.criteria) ? card.criteria.length : 0} 条评分标准`);
  } else if (card.criteria.some(item => !String(item || '').trim())) problems.push('criteria 有空项');
  if (!card || !String(card.image || '').trim()) problems.push('缺少图片路径');
  else {
    const imagePath = path.resolve(root, card.image);
    if (!fs.existsSync(imagePath)) problems.push('缺少图片');
    const expected = `${id}.webp`;
    if (path.basename(card.image) !== expected) problems.push(`图片文件名应为 ${expected}`);
  }
  if (problems.length) { errors.push(`${id || `第 ${index + 1} 张`} ${problems.join('；')}`); console.log(`❌ ${errors.at(-1)}`); }
  else console.log(`✅ ${id} 正常`);
}

if (errors.length) { console.error(`\n共 ${errors.length} 张画卡未通过校验。`); process.exit(1); }
console.log(`\n全部 ${cards.length} 张画卡校验通过。`);
