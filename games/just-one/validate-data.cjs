const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const seen = new Set();
for (const name of ['normal','hard','insane']) {
  const bytes = fs.readFileSync(path.join(__dirname, 'data', name + '.csv'));
  assert.equal(bytes.subarray(0,3).toString('hex'), 'efbbbf', `${name}: BOM`);
  const rows = bytes.toString('utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  assert.equal(rows.shift(), '词1,词2,词3,词4,词5');
  assert.ok(rows.length >= 60);
  for (const [i, row] of rows.entries()) {
    const words = row.split(',');
    assert.equal(words.length, 5, `${name}:${i+2}`);
    assert.equal(new Set(words).size, 5);
    for (const word of words) {
      assert.match(word, /^[\u3400-\u9fff]+$/u);
      assert.ok(!seen.has(word), `重复用词：${word}`);
      seen.add(word);
    }
  }
  console.log(`${name}: ${rows.length} cards, ${rows.length * 5} unique words, UTF-8 BOM OK`);
}
console.log(`Total: ${seen.size} unique words; no cross-level duplicates`);
