import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createReplyEngine, classify } = require('../zhangnan/engine.js');
const data = require('../zhangnan/data.js');

test('approved real banana example and all four approved style examples retain the first punchline', () => {
  for (const item of data.classics.filter(item => item.answers)) {
    const engine = createReplyEngine({ random: () => 0.99 });
    assert.equal(engine.answer(item.question).answer, item.answers[0]);
  }
});

test('classics and free questions vary without consecutive repeats, even with fixed randomness', () => {
  for (const question of ['这香蕉是什么味道？', '怎么才能早起？', '我的钥匙在哪里？', '为什么要上班？', '今天吃什么？', '这是一个全新的问题']) {
    const engine = createReplyEngine({ random: () => 0 });
    const answers = Array.from({ length: 16 }, () => engine.answer(question).answer);
    assert.ok(new Set(answers).size >= 4, question);
    for (let i = 1; i < answers.length; i++) assert.notEqual(answers[i], answers[i - 1], question);
  }
});

test('free input routes by meaning and retains relevant subjects, actions or times', () => {
  const cases = [
    ['这个蛋糕是什么味道？', 'taste', /蛋糕/],
    ['怎么才能早起？', 'how', /早起/],
    ['我什么时候能下班？', 'when', /下班/],
    ['我的手机在哪里？', 'where', /你的手机/],
    ['明天会下雨吗？', 'weather', /明天.*雨/],
    ['煮面需要多久？', 'duration', /煮面/],
    ['晚饭吃什么？', 'meal', /晚饭/],
    ['什么是爱情？', 'definition', /爱情/],
    ['后天会怎么样？', 'future', /后天/],
    ['我想睡觉', 'wish', /睡觉/],
    ['为什么这么困？', 'feeling', /困/],
    ['今天星期几？', 'calendar', /今天/],
    ['周末去哪里玩？', 'where-go', /地方/],
    ['选哪个？', 'choice', /选/]
  ];
  for (const [question, category, pattern] of cases) {
    const result = createReplyEngine({ random: () => 0 }).answer(question);
    assert.equal(result.category, category, question);
    assert.match(result.answer, pattern, question);
  }
});

test('every quick question has a concise playable answer', () => {
  const engine = createReplyEngine({ random: () => 0.5 });
  for (const { question } of data.classics) {
    const result = engine.answer(question);
    assert.ok(result.answer.length > 3 && result.answer.length < 85);
    assert.ok(result.category !== 'general', question);
    assert.ok(result.answer.split(/[。！？]/).filter(Boolean).length <= 2);
  }
});

test('whitespace and full-width punctuation do not lose classic matching', () => {
  const engine = createReplyEngine();
  assert.equal(engine.answer('  这香蕉是什么味道？\n ').answer, '就是香蕉味。');
  assert.throws(() => engine.answer(' \n '), RangeError);
});

test('restored reply history avoids repeats and reset restores the classic', () => {
  const engine = createReplyEngine({ recent: ['就是香蕉味。'], random: () => 0 });
  assert.notEqual(engine.answer('这香蕉是什么味道？').answer, '就是香蕉味。');
  engine.reset();
  assert.equal(engine.answer('这香蕉是什么味道？').answer, '就是香蕉味。');
});

test('long and markup-like input remains bounded plain text', () => {
  for (const question of ['问题'.repeat(1000), '<img src=x onerror=alert(1)>', '我'.repeat(180) + '为什么']) {
    const result = createReplyEngine().answer(question);
    assert.ok(result.answer.length < 100);
    assert.equal(typeof result.answer, 'string');
  }
  assert.ok(classify('  ').candidates.length);
});
