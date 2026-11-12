(function (root) {
  'use strict';
  const data = root.ZhangnanData || (typeof require === 'function' ? require('./data.js') : null);
  const clean = text => String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/[？?！!。～~]+$/g, '');
  const mirror = text => text.replace(/你|我|您/g, char => ({ 你: '我', 我: '你', 您: '我' })[char]);
  const short = (text, length = 22) => Array.from(text).slice(0, length).join('');
  const trimSubject = text => text.replace(/^(?:请问|请告诉我|想问一下|那个|这个|这根|这只|这杯|这碗|这块|这瓶|这种|这|那)/, '').replace(/(?:到底|究竟)/g, '').trim();
  const actionOf = text => short(mirror(text.replace(/^.*?(?:怎么样才能|怎样才能|怎么才能|如何才能|怎么能|怎样能|怎样|如何|怎么)/, '').replace(/^(?:才|能|可以|去|做才能)+/, '').replace(/(?:呢|呀|啊|吗|么|嘛|吧|才能好|才好|比较好)$/g, '')));

  function classify(input) {
    const q = clean(input);
    const classic = data.classics.find(item => item.answers && clean(item.question) === q);
    if (classic) return { category: 'classic:' + clean(classic.question), candidates: classic.answers };
    let match;
    if (/(?:你是谁|你叫什么|你的名字|你是张楠)/.test(q)) return { category: 'identity', candidates: ['我是张楠，也就是正在回答你的这个张楠。', '张楠。叫我张楠，就算叫对了。', '你在张楠问答里问到的，自然是张楠。'] };
    if (/星期几|周几|几月几[号日]/.test(q)) return { category: 'calendar', candidates: ['今天是昨天的后一天。', '今天这个日子，明天就算昨天了。', '日历上写着今天的那格，就是今天。'] };
    if (/下雨|下雪|晴天|阴天|天气|气温|会不会冷|会不会热/.test(q)) {
      const day = (q.match(/大后天|后天|明天|今天|今晚|周末|下周/) || ['那天'])[0];
      const event = /下雪/.test(q) ? '雪' : /下雨/.test(q) ? '雨' : null;
      return { category: 'weather', candidates: event ? [`${day}下不下${event}，得看${day}有没有${event}。`, `有${event}的时候，${day}就不算没${event}。`, `${day}的${event}，要下了才能算下了。`] : [`${day}的天气，就是${day}出门能感受到的天气。`, `等到了${day}，就知道${day}是什么天气了。`, `${day}冷不冷，主要看${day}有多冷。`] };
    }
    if ((match = q.match(/(.{1,25}?)(?:是)?什么味(?:道|儿)?/))) {
      const subject = short(mirror(trimSubject(match[1]).replace(/是$/, '')), 16) || '它';
      return { category: 'taste', candidates: [`就是${subject}该有的味道。`, `${subject}吃起来，还是有${subject}的特点。`, `${subject}的味道，尝到的那一口最清楚。`, `你尝到的，就是${subject}的味道。`] };
    }
    if (/(?:吃|喝)(?:点|些)?什么|(?:午饭|晚饭|早餐|夜宵).*(?:选|推荐)/.test(q)) {
      const meal = (q.match(/早餐|早饭|午饭|午餐|晚餐|晚饭|夜宵/) || [q.includes('中午') ? '午饭' : q.includes('晚上') ? '晚饭' : '这顿饭'])[0];
      return { category: 'meal', candidates: [`等吃上了，${meal}吃什么就确定了。`, `${meal}最后吃的，就是最后选中的那个。`, `先决定吃什么，就知道${meal}吃什么了。`, `${meal}可以吃点能算作${meal}的东西。`, `这次吃的，会成为你吃过的东西。`] };
    }
    if (/好吃|好喝|难吃|难喝/.test(q)) {
      const quality = (q.match(/好吃|好喝|难吃|难喝/) || ['好吃'])[0];
      return { category: 'food-quality', candidates: [`因为尝起来${quality}。`, `${quality}这件事，尝起来最有发言权。`, `要不是${quality}，就不算${quality}了。`, `你觉得${quality}的，正好就是它${quality}的地方。`] };
    }
    if (/好看|漂亮|帅不帅|可爱|美不美|酷不酷/.test(q)) return { category: 'appearance', candidates: ['好看的地方，确实是越看越好看。', '可爱这件事，可爱起来就很明显。', '你认真看过之后，就算认真看过了。', '这份好看，主要体现在看起来好看。'] };
    if (/好玩|有趣|无聊/.test(q)) return { category: 'fun', candidates: ['好不好玩，玩的时候就会有感觉。', '有趣的地方，正好是它不无聊的地方。', '玩过以后，你就多了一次玩过的经历。', '这个游戏玩起来，就是这个游戏的玩法。'] };
    if (/爱我|喜欢我|陪我|想我/.test(q)) return { category: 'affection', candidates: ['我在陪你聊天，这天就不算你一个人聊的。', '你来找我的时候，我就在你找到的地方。', '现在陪着你的，正好就是现在的我。', '能一直聊的时候，我们就一直聊。'] };
    if ((match = q.match(/(?:什么时候|几点|何时)(?:才|能|可以|才能|才可以)?(.+)/))) {
      const action = short(mirror(match[1].replace(/(?:呢|呀|啊|吗)$/g, '')), 18);
      return { category: 'when', candidates: [`等到${action}的时候，就${action}了。`, `到了能${action}的那个时候，就能${action}了。`, `${action}之前，暂时还不算${action}。`, `等${action}这件事发生了，时间也就对上了。`] };
    }
    if (/多久|多长时间|多长|多少分钟|多少小时/.test(q)) {
      const topic = short(mirror(q.split(/(?:要|得|需要|还要)?(?:多久|多长时间|多长|多少分钟|多少小时)/)[0]), 14);
      return { category: 'duration', candidates: [`${topic ? topic + '的时间' : '这段时间'}，就是从开始到结束那么久。`, `等结束的时候，就知道一共花了多久。`, `在它结束之前，时间还得接着算。`, `要是快一点，花的时间就会少一点。`] };
    }
    if (/哪里|哪儿|在哪|何处|去哪/.test(q)) {
      const subject = short(mirror(q.split(/(?:在|到|去)?(?:哪里|哪儿|哪|何处)/)[0]).replace(/(?:究竟|到底|现在|应该|可以|要|是|在|去|到|了)+$/g, ''), 16);
      if (/去|玩|旅行|旅游/.test(q)) return { category: 'where-go', candidates: ['选好要去的地方，就有地方去了。', '去了哪里，哪里就是这次去的地方。', '你想去的那个地方，应该就在你想去的名单里。', '到了目的地，就知道自己到哪儿了。'] };
      return { category: 'where', candidates: [`${subject || '它'}就在${subject ? '它' : '自己'}现在待着的地方。`, `找到了，就知道${subject || '它'}在哪儿了。`, `在找到${subject || '它'}的那个地方，就能找到${subject || '它'}。`, `${subject || '它'}的位置，就是它所在的位置。`] };
    }
    if (/选哪个|怎么选|如何选|该选|还是|纠结|选择/.test(q)) return { category: 'choice', candidates: ['选了其中一个，就少了一个没选过的。', '你最后选的那个，就是你的最终选择。', '先选一个；选好了，就算作出选择了。', '两个都想选，说明你还没只选一个。', '等你决定了，答案就跟着确定了。'] };
    if (/为什么|为啥|怎么回事|为何/.test(q)) {
      if (/时间|过得.*快/.test(q)) return { category: 'time-why', candidates: ['因为你发现的时候，时间已经过去了。', '过去的时间，确实不会还停在刚才。', '你觉得快的这段时间，已经过得挺快了。'] };
      const feeling = (q.match(/累|困|饿|渴|开心|难过|紧张|焦虑|生气/) || [])[0];
      if (feeling) return { category: 'feeling', candidates: [`${feeling}的时候，确实就会觉得${feeling}。`, `因为你现在的感受，正好是${feeling}。`, `要是不${feeling}了，就不是现在这个感觉了。`, `这份${feeling}，主要体现在你感觉到了它。`] };
      const before = q.split(/为什么|为啥|为何/)[0];
      const after = q.replace(/^.*?(?:为什么|为啥|为何)/, '');
      const statement = short(mirror((before + after).replace(/[呢呀啊吗]$/g, '')), 24);
      return { category: 'why', candidates: [`${statement || '这件事'}，肯定有它之所以这样的原因。`, `因为事情发展到这里，就成了${statement ? '你说的这个样子' : '现在这样'}。`, `要不是这样，你就不会问为什么这样了。`, `关于${statement ? '「' + statement + '」' : '这件事'}，原因就在导致它发生的原因里。`] };
    }
    if (/怎么|怎样|如何/.test(q) && !/(?:会怎么样|(?:明天|后天|以后|未来|下周)怎么样)/.test(q)) {
      const action = actionOf(q) || '把这件事做好';
      return { category: 'how', candidates: [`想${action}，得先做到${action}。`, `等你成功${action}，就算学会${action}了。`, `${action}的关键，就是做到前面说的这件事。`, `先开始${action}，就不算完全没开始。`, `用能${action}的方法，就能往${action}的方向走。`] };
    }
    if ((match = q.match(/(?:什么是|何为)(.+)/)) || (match = q.match(/(.+?)(?:的)?(?:意义|意思|定义)(?:是)?什么/))) {
      const subject = short(mirror(match[1]), 16);
      return { category: 'definition', candidates: [`${subject}，就是被叫作${subject}的那个东西。`, `说到${subject}，说的就是${subject}这件事。`, `${subject}的意思，主要就在${subject}的意思里。`, `弄明白${subject}之后，就知道${subject}是什么了。`] };
    }
    if (/多少钱|贵不贵|便宜|价格/.test(q)) return { category: 'price', candidates: ['价格是多少，就得按多少来算。', '贵不贵，主要得看它有多贵。', '买下来的时候，花掉的就是它的价钱。', '便宜一点，确实就能少花一点。'] };
    if (/多少|几个|几次|几岁/.test(q)) return { category: 'quantity', candidates: ['有多少个，数完就是多少个。', '全部加起来，就是总共的数量。', '比现在多一个，就比现在多一个。', '你数出来的那个数，就是这次的结果。'] };
    if (/明天|后天|以后|未来|下周|会怎么样/.test(q)) {
      const time = (q.match(/大后天|后天|明天|以后|未来|下周/) || ['以后'])[0];
      return { category: 'future', candidates: [`等${time}到了，就知道了。`, `${time}的事，等发生了就不算没发生。`, `${time}会怎么样，得让${time}先来。`, `到${time}再回头看，今天就成了以前。`] };
    }
    if (/能不能|可不可以|会不会|是不是|有没有|行不行|对不对|可以吗|能.*吗|会.*吗|吗$|么$/.test(q)) {
      const subject = short(mirror(q.replace(/[吗么嘛呢]$/g, '')), 22);
      return { category: 'yes-no', candidates: [`${subject ? '关于「' + subject + '」' : '这个问题'}，确定了就有确定的答案了。`, '可以的时候，自然就不算不可以。', '有这回事，就说明不是没这回事。', '等结果出来，就能知道答案对不对了。', '是就是，不是就还不能算是。'] };
    }
    if (/^(?:你好|嗨|哈喽|hello|hi|在吗|早上好|晚上好)$/i.test(q)) return { category: 'greeting', candidates: ['你好。你这一句，确实让我收到问候了。', '在呢。能回答你，就算在。', '见到你了，这就不算没见到。', '你好呀，打完招呼就算认识了。'] };
    if ((match = q.match(/(?:想|想要|准备)(.+)/))) {
      const action = short(mirror(match[1]), 20);
      return { category: 'wish', candidates: [`想${action}的时候，确实会有想${action}的感觉。`, `如果开始${action}，就不只是想${action}了。`, `${action}这件事，你已经认真想过了。`, `做完${action}，就会多一件做完的事。`] };
    }
    const topic = short(mirror(q.split(/[，,。；;！!？?]/)[0]), 22);
    return { category: 'general', candidates: [`关于「${topic}」，你确实已经把问题问出来了。`, `「${topic}」这件事，得看它具体是怎么一回事。`, `说到「${topic}」，那我们说的就是同一件事了。`, `你想知道「${topic}」，说明这就是你现在想知道的。`, `等「${topic}」有了答案，就不会还没答案了。`, `「${topic}」这个问题，问出来以后就算问过了。`] };
  }

  function createReplyEngine(options = {}) {
    let recent = (options.recent || []).slice(-40);
    const random = options.random || Math.random;
    return {
      answer(question) {
        const q = clean(question);
        if (!q) throw new RangeError('请先写一个问题');
        const result = classify(short(q, 180));
        let available = result.candidates.filter(answer => !recent.includes(answer));
        if (!available.length) available = result.candidates.filter(answer => answer !== recent.at(-1));
        if (!available.length) available = result.candidates;
        // The first encounter with a real classic retains its original punchline.
        const firstClassic = result.category.startsWith('classic:') && result.candidates.every(answer => !recent.includes(answer));
        const answer = firstClassic ? available[0] : available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
        recent.push(answer); recent = recent.slice(-40);
        return { answer, category: result.category };
      },
      reset() { recent = []; }
    };
  }
  const api = { createReplyEngine, classify };
  root.ZhangnanEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
