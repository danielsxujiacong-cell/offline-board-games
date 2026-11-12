(function (root) {
  'use strict';
  const data = root.ZhangnanData || (typeof require === 'function' ? require('./data.js') : null);
  const size = text => Array.from(text).length;
  const clean = text => String(text || '').normalize('NFKC').replace(/\s+/g, '').replace(/[？?！!。．…～~]+$/g, '');
  const keyOf = text => clean(text).replace(/^(?:(?:张楠|请问一下|请问|想问一下|我想问一下)[，,:：]*)+/, '').replace(/[呀啊呢嘛吧]+$/g, '');
  const mirror = text => text.replace(/你|我|您/g, char => ({ 你: '我', 我: '你', 您: '我' })[char]);
  const phrase = (text, limit = 6) => {
    const value = mirror(text).replace(/^[，,:：]+|[，,:：]+$/g, '');
    return value && size(value) <= limit && !/[，,。；;？！?!<>「」“”]/.test(value) ? value : '';
  };
  const subjectOf = text => phrase(text.replace(/^(?:这个|那个|这根|那根|这只|那只|这杯|这碗|这块|这瓶|这种|这|那)/, '').replace(/是$/, ''));
  const fallback = () => ({ category: 'general', candidates: ['问了就算问了。', '说了就是说了。', '这样就是这样。'] });
  const reply = (category, candidates, extra = {}) => ({ category, candidates, ...extra });
  const units = '平方厘米|平方公里|平方米|立方米|摄氏度|华氏度|人民币|秒钟|毫秒|分钟|小时|钟头|星期|个月|千克|公斤|毫克|公里|千米|厘米|毫米|毫升|美元|美金|欧元|英镑|日元|港元|港币|块钱|岁|斤|米|度|秒|分|天|周|月|年|人|只|条|根|瓶|杯|碗|本|辆|次|件|张|台|头|份|套|袋|箱|包|支|口|点|个|元|块|%|cm|mm|km|kg|ml|m|g|L';
  const explicitUnit = new RegExp('(?:多少|几)(?:个(?=小时|人|月))?(' + units + ')', 'i');
  const defaultUnits = { price: '元', age: '岁', height: '厘米', length: '米', weight: '斤', area: '平方米', temperature: '度', duration: '分钟', quantity: '个', clock: '点' };

  function numberReply(category, unit = defaultUnits[category] || '') {
    const topic = { category, unit };
    return reply(category, ['114514' + unit + '。'], { fixed: true, topic });
  }

  function numerical(q) {
    if (!/多少|几(?!乎)|多(?:大|高|长|重|宽|厚|远|深|热|冷|久|快)|(?:价格|价钱|售价|费用|年龄|年纪|身高|长度|宽度|厚度|距离|深度|高度|体重|重量|面积|温度|气温|时长)(?:是啥|是什么|呢|$)/.test(q)) return null;
    const explicit = (q.match(explicitUnit) || [])[1];
    let category;
    let defaultUnit;
    if (/多少钱|(?:价格|价钱|售价|费用)|几块(?:钱)?|多少(?:元|块钱|块|美元|美金|人民币|欧元|英镑|日元|港元|港币)/.test(q)) category = 'price';
    else if (/几岁|多少岁|年龄|年纪|^(?:你|您|他|她|我|宝宝|孩子|小孩|小朋友|猫|狗)(?:今年|现在|到底|究竟|已经|有)*多大(?:了)?$/.test(q)) category = 'age';
    else if (/多久|多长时间|时长|(?:多少|几)(?:个)?(?:秒钟|毫秒|秒|分钟|分|小时|钟头|天|周|星期|个月|月|年)/.test(q)) category = 'duration';
    else if (/体重|重量|多重|(?:多少|几)(?:斤|公斤|千克|毫克|kg|g)/i.test(q)) category = 'weight';
    else if (/面积|(?:房间|房子|房|屋|教室|客厅|卧室|操场|土地|占地|院子).{0,5}多大|(?:多少|几)平方/.test(q)) category = 'area';
    else if (/温度|气温|(?:多少|几)(?:摄氏度|华氏度|度)|多热|多冷/.test(q)) category = 'temperature';
    else if (/身高|多高/.test(q)) { category = 'height'; defaultUnit = /身高|你|您|他|她|我|孩子|宝宝/.test(q) ? '厘米' : '米'; }
    else if (/多长|长度|多宽|宽度|多厚|厚度|多远|距离|多深|深度|高度|(?:多少|几)(?:米|厘米|毫米|公里|千米|cm|mm|km|m)/i.test(q)) category = 'length';
    else if (/几点|几时|多少点/.test(q)) category = 'clock';
    else if (/星期几|周几/.test(q)) return reply('calendar', ['星期114514。'], { fixed: true });
    else if (/几号|几日/.test(q)) return numberReply('calendar', '号');
    else if (/多大|多快|等于几|等于多少|数字|号码|编号/.test(q)) return numberReply('quantity', explicit || '');
    else category = 'quantity';
    return numberReply(category, explicit || defaultUnit || defaultUnits[category]);
  }

  function tasteReply(subject) {
    return reply('taste', [subject ? '就是' + subject + '味。' : '就是那个味。'], { fixed: true, topic: { category: 'taste' } });
  }

  function howReply(action) {
    return reply('how', [action ? action + '就能' + action + '。' : '做到了就做到了。'], { fixed: true, topic: { category: 'how' } });
  }

  function classify(input, topic = null, previous = null) {
    const raw = clean(input);
    if (size(raw) > 180) return fallback();
    const q = keyOf(raw);
    const classic = data.classics.find(item => item.answers && [item.question, ...(item.aliases || [])].some(alias => keyOf(alias) === q));
    if (classic) {
      const category = classic.category || 'classic:' + keyOf(classic.question);
      const currentTopic = defaultUnits[category] ? { category, unit: classic.unit || defaultUnits[category] } : ['taste', 'how'].includes(category) ? { category } : null;
      return reply(category, [classic.answers[0]], { fixed: true, topic: currentTopic });
    }
    if (/^(?:你|您)(?:到底|究竟|又)*(?:是谁|是哪位|是什么人|哪位)(?:来着)?$/.test(q)) return reply('identity', ['我是你爹。'], { fixed: true });
    if (/^(?:(?:你|您)叫(?:什么|啥)(?:名字)?|你的名字(?:是什么|是啥|叫什么)?|你是张楠吗)$/.test(q)) return reply('name', ['张楠。'], { fixed: true });
    if (/^(?:你)?(?:刚才|刚刚|上次|上一句)(?:说的|说了|说|回答的|回答了|回答)(?:是)?(?:什么|啥)(?:来着)?$|^(?:再|重新)(?:说|回答)(?:一遍|一次)$/.test(q)) {
      const answer = previous ? (size(previous.answer) <= 20 ? previous.answer : '刚才那句说过了。') : '刚才还没说。';
      return reply('recall', [answer], { fixed: true, topic });
    }
    if (/敷衍/.test(q) && /你|您/.test(q) && /吗|么|是不是|有没有|别|不要/.test(q)) return reply('response', ['我在回答你。'], { fixed: true });

    // Question intent comes before numeric keywords: asking why something is expensive is not asking its price.
    if (/为什么|为啥|为何|怎么回事|咋回事/.test(q)) {
      if (/贵|便宜/.test(q)) return reply('why', [/便宜/.test(q) ? '因为不贵。' : '因为不便宜。'], { fixed: true, topic: { category: 'price', unit: topic?.category === 'price' ? topic.unit : '元' } });
      if (/时间|过得.*快/.test(q)) return reply('time-why', ['因为时间没停。']);
      const feeling = (q.match(/不开心|不高兴|不舒服|开心|难过|紧张|焦虑|生气|累|困|饿|渴/) || [])[0];
      if (feeling) return reply('feeling', ['因为' + feeling + '。']);
      const statement = phrase(q.replace(/为什么|为啥|为何|怎么回事|咋回事/g, '').replace(/^(?:会|要)/, ''), 8);
      return reply('why', [statement ? '因为' + statement + '。' : '原因就是原因。']);
    }
    const judgement = q.match(/贵不贵|便宜不便宜|长不长|高不高|大不大|重不重|多不多|冷不冷|热不热/);
    if (judgement) {
      const word = judgement[0].split('不')[0];
      return reply('judgement', [word + '就是' + word + '。']);
    }
    if (/怎么|怎样|如何|咋/.test(q) && !/会怎么样|天气怎么样|(?:明天|后天|未来|下周|以后)怎么样|选|纠结|选择/.test(q)) {
      const action = phrase(q.replace(/^.*?(?:怎么样才能|怎么才能|怎样才能|如何才能|怎么才可以|怎么样|怎样|如何|怎么|咋)/, '').replace(/^(?:才|能|可以|才能|才可以)+/, ''));
      return howReply(action);
    }
    const numeric = numerical(q);
    if (numeric) return numeric;

    let match;
    if ((match = q.match(/^(.+?)(?:什么|啥|哪种)味(?:道|儿)?$/))) return tasteReply(subjectOf(match[1]));
    if (/下雨|下雪|晴天|阴天|天气|会不会冷|会不会热/.test(q)) {
      const day = (q.match(/大后天|后天|明天|今天|今晚|周末|下周/) || ['那天'])[0];
      const event = /下雪/.test(q) ? '雪' : /下雨/.test(q) ? '雨' : null;
      return reply('weather', [event ? day + '下' + event + '就有' + event + '。' : day + '到了就知道了。']);
    }
    if (/(?:吃|喝)(?:点|些)?什么|(?:午饭|晚饭|早餐|夜宵).*(?:选|推荐)/.test(q)) return reply('meal', ['吃了就知道了。', '选什么就吃什么。']);
    if ((match = q.match(/好吃|好喝|难吃|难喝/))) return reply('food-quality', [match[0] + '就是' + match[0] + '。']);
    if (/好看|漂亮|帅不帅|可爱|美不美|酷不酷/.test(q)) return reply('appearance', ['好看就是好看。']);
    if (/好玩|有趣|无聊/.test(q)) return reply('fun', ['玩了就算玩了。']);
    if (/爱我|喜欢我|陪我|想我/.test(q)) return reply('affection', ['聊着就是陪着。']);
    if ((match = q.match(/(?:什么时候|何时)(?:才可以|才能|才|能|可以)?(.+)/))) {
      const action = phrase(match[1]);
      return reply('when', [action ? action + '了就' + action + '了。' : '到时候就是时候。']);
    }
    if (/哪里|哪儿|在哪|何处|去哪/.test(q)) {
      if (/去|玩|旅行|旅游/.test(q)) return reply('where-go', ['去了就是去过了。']);
      const subject = phrase(q.split(/(?:在|到|去)?(?:哪里|哪儿|哪|何处)/)[0].replace(/(?:究竟|到底|现在|应该|可以|要|是|在|去|到|了)+$/g, ''));
      return reply('where', [subject ? subject + '在它在的地方。' : '就在它在的地方。']);
    }
    if (/选哪个|怎么选|如何选|该选|还是|纠结|选择/.test(q)) return reply('choice', ['选了就是选了。']);
    if ((match = q.match(/^(?:什么是|何为|什么叫)(.+)$/)) || (match = q.match(/^(.+?)(?:的)?(?:意义|意思|定义)(?:是)?什么$/))) {
      const subject = subjectOf(match[1]);
      return reply('definition', [subject ? subject + '就是' + subject + '。' : '意思就是那个意思。']);
    }
    if (/明天|后天|以后|未来|下周|会怎么样/.test(q) && /怎么样|怎样|如何|会发生什么/.test(q)) {
      const time = (q.match(/大后天|后天|明天|以后|未来|下周/) || ['以后'])[0];
      return reply('future', [time + '到了就知道了。']);
    }
    if (/^(?:你好|嗨|哈喽|hello|hi|在吗|早上好|晚上好)$/i.test(q)) return reply('greeting', [/在吗/.test(q) ? '在呢。' : '你好就是你好。']);
    if (/能不能|可不可以|会不会|是不是|有没有|行不行|对不对|可以吗|能.*吗|会.*吗|吗$|么$/.test(q)) return reply('yes-no', ['是就是。', '行了就是行了。']);
    const feeling = (q.split(/[，,。；;]/).at(-1).match(/不开心|不高兴|不舒服|不累|不困|不饿|不渴|开心|难过|紧张|焦虑|生气|累|困|饿|渴/) || [])[0];
    if (feeling) return reply('feeling', [feeling.length === 1 ? feeling + '了就是' + feeling + '了。' : feeling + '就是' + feeling + '。'], { fixed: true });
    if ((match = q.match(/(?:想要|想|准备)(.+)/))) {
      const action = phrase(match[1]);
      return reply('wish', [action ? action + '了就算' + action + '了。' : '想了就是想了。']);
    }

    // Only an elliptical follow-up inherits a topic; an explicit new question above always wins.
    const followup = /呢$/.test(raw) ? q.match(/^(?:那么|那|换成|还有|至于)?(.{1,12})$/) : null;
    if (followup && topic) {
      if (Object.hasOwn(defaultUnits, topic.category)) return numberReply(topic.category, topic.unit);
      if (topic.category === 'taste') return tasteReply(subjectOf(followup[1]));
      if (topic.category === 'how') return howReply(phrase(followup[1]));
    }
    return fallback();
  }

  function createReplyEngine(options = {}) {
    const validTurn = turn => turn && typeof turn.question === 'string' && typeof turn.answer === 'string' && size(turn.question) <= 180 && size(turn.answer) <= 500;
    let history = (Array.isArray(options.history) ? options.history : []).filter(validTurn).slice(-3);
    let recent = (Array.isArray(options.recent) ? options.recent : history.map(turn => turn.answer)).slice(-40);
    let topic = null;
    for (let index = 0; index < history.length; index++) topic = classify(history[index].question, topic, history[index - 1]).topic || null;
    const random = typeof options.random === 'function' ? options.random : Math.random;
    return {
      answer(question) {
        const q = clean(question);
        if (!q) throw new RangeError('请先写一个问题');
        const result = classify(q, topic, history.at(-1));
        const candidates = result.candidates.filter(answer => size(answer) <= 20 && answer.split(/[。！？!?]/).filter(Boolean).length <= 1);
        let available = result.fixed ? candidates : candidates.filter(answer => !recent.includes(answer));
        if (!available.length) available = candidates.length ? candidates : fallback().candidates;
        const roll = Number(random());
        const index = Number.isFinite(roll) ? Math.min(available.length - 1, Math.max(0, Math.floor(roll * available.length))) : 0;
        const answer = available[result.fixed ? 0 : index];
        history.push({ question: q, answer, category: result.category }); history = history.slice(-3);
        recent.push(answer); recent = recent.slice(-40);
        topic = result.topic || null;
        return { answer, category: result.category };
      },
      reset() { history = []; recent = []; topic = null; }
    };
  }
  const api = { createReplyEngine, classify };
  root.ZhangnanEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
