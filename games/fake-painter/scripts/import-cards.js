const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const batchFile = path.resolve(root, process.argv[2] || 'data/cards_batch.json');
const cardsFile = path.resolve(root, 'data/cards.json');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

if (!fs.existsSync(batchFile)) {
  console.error(`❌ 找不到批量数据文件：${path.relative(root, batchFile)}`);
  process.exit(1);
}
let batch;
try { batch = readJson(batchFile); } catch (error) { console.error(`❌ 批量数据 JSON 无法读取：${error.message}`); process.exit(1); }
if (!Array.isArray(batch) || !batch.length) { console.error('❌ 批量数据必须是非空数组。'); process.exit(1); }

const validation = spawnSync(process.execPath, [path.join(__dirname, 'validate-cards.js'), path.relative(root, batchFile)], { cwd: root, encoding: 'utf8' });
process.stdout.write(validation.stdout || '');
process.stderr.write(validation.stderr || '');
if (validation.status !== 0) { console.error('❌ 校验未通过，未写入正式画卡文件。'); process.exit(validation.status || 1); }

const cards = readJson(cardsFile);
const existing = new Set(cards.map(card => card.id));
const duplicates = batch.filter(card => existing.has(card.id));
const added = batch.filter(card => !existing.has(card.id));
if (duplicates.length) console.log(`ℹ️ 跳过已存在画卡：${duplicates.map(card => card.id).join(', ')}`);
if (added.length) fs.writeFileSync(cardsFile, `${JSON.stringify([...cards, ...added], null, 2)}\n`, 'utf8');
console.log(`✅ 成功加入 ${added.length} 张，跳过重复 ${duplicates.length} 张。`);
