const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const prompts = new Set();
let total = 0;
for (const mode of ['word', 'scene', 'brainstorm']) {
  for (const level of ['normal', 'hard', 'extreme']) {
    const name = `${mode}-${level}.tsv`;
    const text = fs.readFileSync(path.join(__dirname, 'data', name), 'utf8');
    assert.equal(text.charCodeAt(0), 0xfeff, `${name}: Excel UTF-8 BOM`);
    const [header, ...rows] = text.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
    assert.equal(header, 'id\tprompt\texample', name);
    assert.ok(rows.length >= 90, `${name}: at least 90 prompts`);
    rows.forEach((row, i) => {
      const cells = row.split('\t');
      assert.equal(cells.length, 3, `${name}:${i + 2}`);
      const [id, prompt, example] = cells;
      assert.equal(id, String(i + 1).padStart(3, '0'), `${name}: sequential ID`);
      assert.ok(prompt.trim() && example.trim(), `${name}:${id}: nonempty fields`);
      assert.ok(!prompts.has(prompt), `${name}:${id}: duplicate prompt`);
      prompts.add(prompt);
      if (mode === 'word') {
        const seed = prompt.match(/从「(.+)」开始/);
        assert.ok(seed, `${name}:${id}: word-chain seed`);
        const answers = example.split('、');
        if (level === 'hard') assert.ok(answers.every(answer => [...answer].length >= 3), `${name}:${id}: >=3 characters`);
        if (level === 'extreme') assert.ok([...seed[1]].length === 4 && answers.every(answer => [...answer].length === 4), `${name}:${id}: four-character idioms`);
      }
    });
    total += rows.length;
    console.log(`${name}: ${rows.length} valid rows`);
  }
}
console.log(`PASS: ${total} unique prompts; nine Excel-ready banks with examples.`);
