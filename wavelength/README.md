# 电波同步 · 双人 MVP

入口 `/wavelength/`，无依赖、无 CDN、无后端。用任意静态 HTTP 服务运行仓库根目录即可。

## 本版规则
6 回合，两人各出题 3 次，合计 24 分。靶心均匀取整数 14–86；误差 ≤3 / ≤8 / ≤14 分别得 4 / 3 / 2 分，其余 0 分。范围收窄以保证计分带完整；本规则是改编，并非原版规则。得分率不是关系测评。

按住看靶心，松手、失焦、切后台都会隐藏；给一个具体事物，不能报位置、比例或用端点词暗示。数字作品名可用，由玩家自律。看过位置后可换题但不重抽靶心。已抽题不重复，选中题库耗尽后只能自定义。提示必填，最多40字。独立交接确认后才能猜，不能回看答案。页面刷新保留当前阶段，回到设置后点击继续；不保留靶心展开状态。游戏存于当前标签页 sessionStorage，不上传，关闭标签页后可能清除。

防窥只针对误看，开发者工具或主动查看存储不能防范。本版不加入加注、副模式，保持评分可比和轮次公平。

## 题库与来源
共 1120 组中文光谱：保留原有 120 组，新增 1000 组，20 类。原有六类各70组，其余十四类各50组。所有分类默认勾选，包括亲密关系，可以随时取消。未复制官方整套卡牌。
参考机制及话题方向：
- https://www.wavelength.zone/about （官方核心机制）
- https://www.wavelength.zone/app/faq （官方合作玩法）
- https://www.zhuoyouku.com/boardgame/ybapnyisstanxsiomlvsat4e （中文语境与光谱示例）
- https://www.reddit.com/r/boardgames/comments/1bvxrmn/ideas_for_a_custom_version_of_wavelength_where/ （以对方视角判断的讨论）

例如：末日累赘↔末日神器、包装比本体值钱↔本体比包装惊艳、需要自己消化↔需要抱抱安慰。避免含糊难懂、羞辱和强迫披露隐私的题目。题库集中在 questions.jsonon，每题一行；prompts.js 负责读取、分类、洗牌和计分。

## 维护指令
继续改进此仓库的 /wavelength/ 双人网页游戏。先读根目录 AGENTS.md 和 C_DRIVE_POLICY.md。保持纯静态、无外部依赖、14–86靶心、6轮24分制；更改游戏逻辑后运行 tests/wavelength-browser.cjs，验证完整六轮、触摸防窥、刷新恢复、320px布局和离线入口。仅提交本游戏改动；发布前更新 service-worker.js 的版本和缓存清单。


## 新增1000题的灵感与编辑原则

本次搜索阅读了公开光谱题目和情侣聊天素材，借鉴主题方向，新增题目重新用中文编写，不是复制官方或第三方整套题库。覆盖日常、美食、消费、社交、亲密关系、脑洞、旅行户外、职场校园、影视音乐、数码网络、运动游戏、童年回忆、居家生活、动物自然、穿搭审美、节日聚会、城市观察、语言表达、科学幻想、情绪性格。

参考：
- [光谱创作与主题方向](https://wavelengthonline.io/guides/suggested-prompts)：题目应能容纳中间位置。
- [情侣光谱玩法](https://wavelengthonline.io/guides/prompts-for-couples)：从对方的视角理解日常选择。
- [情侣聊天分类](https://www.ishindenshin.app/zh/guide/questions-for-couples/)：日常、回忆、相处、未来等维度。
- [玩家自定义讨论](https://www.reddit.com/r/boardgames/comments/1bvxrmn/ideas_for_a_custom_version_of_wavelength_where/)：从具体人物的认知出题。

不以数字编号或简单换词凑数，不重复已有光谱或反向复制；人工写作后用脚本检查格式与去重。属于主观认知游戏，允许玩家对端点理解有差异，但每组仍需要有可讨论的中间地带。

## 自己在 GitHub 增加题目

题库文件：[wavelength/questions.json](https://github.com/danielsxujiacong-cell/offline-board-games/blob/main/wavelength/questions.json)

直接编辑：[网页编辑入口](https://github.com/danielsxujiacong-cell/offline-board-games/edit/main/wavelength/questions.json)

每行格式是 `["分类", "左端", "右端"],`。例如，在最后的 `]` 前增加一行（上一行也要有英文逗号，最后一题后面不要加逗号）：

```json
  ["脑洞", "像龙的睡前故事", "像龙的起床铃声"]
```

保留最外层的 `[` 开头和 `]` 结尾，使用英文引号、逗号和方括号。中文标点可以放在引号内部；文本中的英文双引号需要写成 `\"`。建议用中文书名号等代替内层英文双引号。左右端点应是同一维度可比较的两极，不要把提示词或靶心写进题库。

新分类直接填写新分类名，界面会自动出现，题数也自动更新。建议端点尽量控制在18字以内，最长36字；空项、重复或反向重复不要加入。

点击 **Commit changes** 提交到 `main`，GitHub Pages 会自动部署。部署完成后刷新游戏，在线会优先读取新题库，失败则退回缓存题库。已开始的对局继续使用本局抽题列表，需要新开一局才使用新版完整题库。没有必要为了每次加题修改 Service Worker 版本。

本地检查：

```powershell
node tests/wavelength-library.test.mjs
```

## 返回与继续

所有回合阶段都有 `← 返回设置` 按钮，浏览器返回键同样回到设置。当前回合、线索、猜测位置保留，可点“继续刚才的一局”。返回不会撤销锁定、不会回到出题人偷看阶段，也不会重抽靶心。合集入口仍在页面顶部。点击“开始对频”才会开始新局。
