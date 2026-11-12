(function (root) {
  'use strict';
  const data = {
    classics: [
      { question: '这香蕉是什么味道？', mark: '◡', category: 'taste', aliases: ['香蕉什么味', '香蕉什么味道', '这香蕉什么味', '香蕉是啥味', '这根香蕉是什么味道'], answers: ['就是香蕉味。'] },
      { question: '你在干什么？', mark: '✧', aliases: ['你在做什么', '你在干嘛', '你在做啥'], answers: ['我在做我现在做的事。'] },
      { question: '为什么这么好吃？', mark: '♡', answers: ['因为吃起来好吃。'] },
      { question: '明天会怎么样？', mark: '☀', answers: ['等明天到了就知道了。'] },
      { question: '你为什么这么说？', mark: '？', answers: ['因为我是这么想的。'] },
      { question: '今天吃什么？', mark: '◌' },
      { question: '怎么才能早起？', mark: '↗', category: 'how', aliases: ['如何才能早起', '怎样才能早起', '怎么早起', '怎么才可以早起', '咋才能早起'], answers: ['早起就能早起。'] },
      { question: '我什么时候能下班？', mark: '◷' },
      { question: '这游戏好玩吗？', mark: '✦' },
      { question: '周末去哪里玩？', mark: '⌁' },
      { question: '为什么时间过得这么快？', mark: '◴' },
      { question: '你会一直陪我吗？', mark: '♡' },
      { question: '牛奶多少钱？', mark: '¥', category: 'price', answers: ['114514元。'] },
      { question: '你几岁？', mark: '◷', category: 'age', answers: ['114514岁。'] },
      { question: '你是谁？', mark: '？', category: 'identity', answers: ['我是你爹。'] },
      { question: '我好累。', mark: '◌', category: 'feeling', aliases: ['我好累', '好累', '我今天好累'], answers: ['累了就是累了。'] },
      { question: '你在敷衍我吗？', mark: '✧', category: 'response', answers: ['我在回答你。'] }
    ],
    pokes: ['戳了就是戳了。', '我在呢。', '这一下是一下。', '戳到了。'],
    thinking: ['想想…', '嗯…', '等一下…', '让我想想…']
  };
  root.ZhangnanData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis === 'undefined' ? window : globalThis);
