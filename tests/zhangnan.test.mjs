import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createReplyEngine, classify } = require('../zhangnan/engine.js');
const data = require('../zhangnan/data.js');
const engine = options => createReplyEngine({ random: () => 0, ...options });

test('approved punchlines remain exact on every repeated question', () => {
  const cases = [
    ['怎么才能早起？', '早起就能早起。'], ['香蕉什么味？', '就是香蕉味。'],
    ['牛奶多少钱？', '114514元。'], ['你几岁？', '114514岁。'],
    ['你是谁？', '我是你爹。'], ['我好累。', '累了就是累了。'],
    ['你在敷衍我吗？', '我在回答你。']
  ];
  const e = engine({ random: () => 0.99 });
  for (let round = 0; round < 8; round++) {
    for (const [question, expected] of cases) assert.equal(e.answer(question).answer, expected, question);
  }
  for (const item of data.classics.filter(item => item.answers)) {
    const e = engine({ recent: item.answers });
    assert.equal(e.answer(item.question).answer, item.answers[0], item.question);
  }
});

test('politeness, whitespace, punctuation, particles and common synonyms preserve anchors', () => {
  for (const question of ['你哪位？', '你到底是谁啊？！', '您究竟是谁呢', '请问，你是谁呢？', '张楠，请问你是谁啊？']) {
    assert.equal(engine().answer(question).answer, '我是你爹。', question);
  }
  for (const question of ['怎样才能早起呢？', '如何才能早起', '咋才能早起啊', ' 怎么 才能 早起 ？\n']) {
    assert.equal(engine().answer(question).answer, '早起就能早起。', question);
  }
  for (const question of ['这根香蕉是什么味道呀？', '香蕉是啥味儿？', '请问香蕉是什么味道啊']) {
    assert.equal(engine().answer(question).answer, '就是香蕉味。', question);
  }
});

test('identity joke stays scoped to direct identity questions', () => {
  for (const question of ['他是谁？', '这是什么？', '我不开心', '我好累', '你是不是在敷衍我？', '你以为你是谁？', '我问过你是谁']) {
    assert.notEqual(engine().answer(question).answer, '我是你爹。', question);
  }
  assert.equal(engine().answer('你叫什么名字？').answer, '张楠。');
});

test('numeric questions use the intended physical dimension and default unit', () => {
  const cases = [
    ['牛奶多少钱', '元'], ['请问牛奶的价格是多少？', '元'],
    ['你今年几岁', '岁'], ['你有多大了', '岁'], ['你多高', '厘米'],
    ['你的身高是多少', '厘米'], ['楼有多高', '米'], ['这根绳子多长', '米'],
    ['桌子多宽', '米'], ['你多重', '斤'], ['这房间多大', '平方米'],
    ['这块地的面积是多少', '平方米'], ['明天多少度', '度'], ['气温是多少', '度'],
    ['还要多久能到', '分钟'], ['煮面需要多长时间', '分钟'],
    ['有多少苹果', '个'], ['一共有几个', '个'], ['现在几点', '点'],
    ['这个东西多大', ''], ['一加一等于几', '']
  ];
  for (const [question, unit] of cases) assert.equal(engine().answer(question).answer, '114514' + unit + '。', question);
  assert.equal(engine().answer('这根绳子多长').category, 'length');
  assert.equal(engine().answer('煮面需要多长时间').category, 'duration');
});

test('explicit units win without accidentally borrowing a unit from the subject', () => {
  const cases = [
    ['一瓶牛奶多少美元', '美元'], ['身高几米', '米'], ['绳子几厘米', '厘米'],
    ['体重多少公斤', '公斤'], ['还有几个小时', '小时'], ['有几个人', '人'],
    ['这里有多少辆车', '辆'], ['牛奶有几瓶', '瓶'], ['需要多少毫升', '毫升'],
    ['这房间多少平方厘米', '平方厘米'], ['温度多少华氏度', '华氏度'],
    ['身高多少cm', 'cm'], ['买3瓶牛奶需要多少钱', '元']
  ];
  for (const [question, unit] of cases) assert.equal(engine().answer(question).answer, '114514' + unit + '。', question);
});

test('why, judgement, methods and numeric statements do not become numeric questions', () => {
  const cases = [
    ['牛奶为什么这么贵？', '因为不便宜。'], ['为什么这么便宜？', '因为不贵。'],
    ['牛奶贵不贵？', '贵就是贵。'], ['这根绳子长不长？', '长就是长。'],
    ['怎么才能赚100万？', '赚100万就能赚100万。'],
    ['我今天跑了3公里，好累。', '累了就是累了。']
  ];
  for (const [question, expected] of cases) assert.equal(engine().answer(question).answer, expected, question);
  for (const question of ['我买了3瓶牛奶', '我今天花了114514元', '我今年20岁', '你是不是114514岁？']) {
    assert.ok(!engine().answer(question).answer.startsWith('114514'), question);
  }
});

test('other question families give short, relevant and complete sentences', () => {
  const cases = [
    ['这个蛋糕是什么味道？', '就是蛋糕味。'],
    ['怎么才能睡着？', '睡着就能睡着。'], ['怎么才能不困？', '不困就能不困。'],
    ['我什么时候能下班？', '下班了就下班了。'],
    ['我的手机在哪里？', '你的手机在它在的地方。'],
    ['明天会下雨吗？', '明天下雨就有雨。'],
    ['什么是爱情？', '爱情就是爱情。'], ['我不开心。', '不开心就是不开心。'],
    ['在吗？', '在呢。']
  ];
  for (const [question, expected] of cases) assert.equal(engine().answer(question).answer, expected, question);
});

test('elliptical follow-ups inherit topic and explicit new questions switch it', () => {
  const e = engine();
  assert.equal(e.answer('牛奶多少钱？').answer, '114514元。');
  assert.equal(e.answer('那面包呢？').answer, '114514元。');
  assert.equal(e.answer('为什么这么贵？').answer, '因为不便宜。');
  assert.equal(e.answer('那蛋糕呢？').answer, '114514元。');
  assert.equal(e.answer('你几岁？').answer, '114514岁。');
  assert.equal(e.answer('那你呢？').answer, '114514岁。');
  assert.equal(e.answer('那体重呢？').answer, '114514斤。');
  assert.equal(e.answer('我好累。').answer, '累了就是累了。');
  assert.equal(e.answer('那面包呢？').category, 'general');
  e.answer('牛奶多少钱？');
  assert.equal(e.answer('那不是牛奶').category, 'general');
});

test('explicit units and non-numeric topics carry through short follow-ups', () => {
  const e = engine();
  e.answer('牛奶多少美元？');
  assert.equal(e.answer('那面包呢？').answer, '114514美元。');
  e.answer('香蕉什么味？');
  assert.equal(e.answer('那蛋糕呢？').answer, '就是蛋糕味。');
  e.answer('怎么才能早起？');
  assert.equal(e.answer('那睡着呢？').answer, '睡着就能睡着。');
});

test('recall repeats the previous answer while reset clears both recall and topic', () => {
  const e = engine();
  assert.equal(e.answer('你刚才说什么？').answer, '刚才还没说。');
  e.answer('牛奶多少钱？');
  assert.equal(e.answer('你刚才说什么？').answer, '114514元。');
  assert.equal(e.answer('再说一遍').answer, '114514元。');
  assert.equal(e.answer('那面包呢？').answer, '114514元。');
  e.reset();
  assert.equal(e.answer('你刚才说什么？').answer, '刚才还没说。');
  assert.equal(e.answer('那面包呢？').category, 'general');
});

test('initial history restores recent context and does not mutate caller records', () => {
  const history = [
    { question: '你几岁？', answer: '114514岁。' },
    { question: '牛奶多少钱？', answer: '114514元。', category: 'price', time: 1 },
    { question: '为什么这么贵？', answer: '因为不便宜。', category: 'why', time: 2 },
    { question: '那面包呢？', answer: '114514元。', category: 'price', time: 3 }
  ];
  const original = JSON.stringify(history);
  const e = engine({ history });
  assert.equal(e.answer('你刚才说什么？').answer, '114514元。');
  assert.equal(e.answer('那蛋糕呢？').answer, '114514元。');
  assert.equal(JSON.stringify(history), original);
  const expired = engine({ history: [history[1], ...Array.from({ length: 3 }, () => ({ question: '你好', answer: '你好就是你好。' }))] });
  assert.equal(expired.answer('那面包呢？').category, 'general');
});

test('old or malformed history is compatible and long old replies are not truncated', () => {
  const e = engine({ history: [null, {}, { question: '牛奶多少钱？', answer: '价格是多少，就得按多少来算。'.repeat(3) }] });
  assert.equal(e.answer('你刚才说什么？').answer, '刚才那句说过了。');
  assert.equal(e.answer('那面包呢？').answer, '114514元。');
  assert.ok(engine({ history: 'invalid', recent: null }).answer('你好').answer);
});

test('all supplied candidates and quick questions meet the one-sentence length limit', () => {
  const samples = [
    ...data.classics.map(item => item.question), '这是一个全新的问题', '蛋糕什么味道',
    '怎么才能把我刚刚提到的那个非常非常复杂的问题解决掉',
    '我的手机在哪里', '为什么明天的事情总是那么难以预料',
    '问题'.repeat(1000), '<img src=x onerror=alert(1)>', '我'.repeat(180) + '为什么'
  ];
  for (const question of samples) {
    for (const answer of classify(question).candidates) {
      assert.ok(Array.from(answer).length <= 20, question + ':' + answer);
      assert.ok(answer.split(/[。！？!?]/).filter(Boolean).length <= 1, answer);
      assert.match(answer, /[。！？]$/);
    }
    assert.ok(Array.from(engine().answer(question).answer).length <= 20, question);
  }
  for (const { question } of data.classics) assert.notEqual(engine().answer(question).category, 'general', question);
  for (const text of [...data.pokes, ...data.thinking]) assert.ok(Array.from(text).length <= 12, text);
  assert.throws(() => engine().answer(' \n '), RangeError);
  assert.ok(classify('').candidates.length);
});
