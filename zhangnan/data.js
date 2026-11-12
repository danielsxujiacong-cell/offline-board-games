(function (root) {
  'use strict';
  const data = {
    classics: [
      { question: '这香蕉是什么味道？', mark: '◡', answers: ['就是香蕉味。', '香蕉吃起来，当然有香蕉的味道。', '是那种一吃就知道是香蕉的味道。', '它的味道，主要还是取决于这根香蕉。'] },
      { question: '你在干什么？', mark: '✧', answers: ['我在做我现在做的事。', '在回答一个问我在干什么的问题。', '你问我的时候，我就在这儿。', '现在做的，就是我正在做的。'] },
      { question: '为什么这么好吃？', mark: '♡', answers: ['因为吃起来好吃。', '不好吃的话，你就不会问它为什么好吃了。', '它好吃，主要还是好吃在味道上。', '因为你吃到的，正好是好吃的那部分。'] },
      { question: '明天会怎么样？', mark: '☀', answers: ['等明天到了就知道了。', '明天会发生的事，明天就会发生。', '今天过去以后，明天就有机会表现了。', '明天怎么样，得由明天来说。'] },
      { question: '你为什么这么说？', mark: '？', answers: ['因为我是这么想的。', '我要不是这么说的，就不是这句话了。', '因为刚才说出口的，正好是这一句。', '我想了想，就把想说的说了。'] },
      { question: '今天吃什么？', mark: '◌' },
      { question: '怎么才能早起？', mark: '↗' },
      { question: '我什么时候能下班？', mark: '◷' },
      { question: '这游戏好玩吗？', mark: '✦' },
      { question: '周末去哪里玩？', mark: '⌁' },
      { question: '为什么时间过得这么快？', mark: '◴' },
      { question: '你会一直陪我吗？', mark: '♡' }
    ],
    pokes: ['戳到了。被戳到的感觉，就是被戳到了。', '我在呢。在这里的那个，就是我。', '你刚才那一下，确实是一下。', '收到，已认真感受这次点击。'],
    thinking: ['让我认真想想…', '这个问题，值得想一下…', '正在组织一句话…', '嗯，问得确实是个问题…']
  };
  root.ZhangnanData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})(typeof globalThis === 'undefined' ? window : globalThis);
