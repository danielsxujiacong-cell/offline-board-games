# Handoff

2026-10-23 嘴炮炸弹：新增 `/pass-the-bomb/`，在本仓库直接维护，无需构建。三模式 × 三难度，共九份 UTF-8 BOM TSV / 270 题，包含维护用答案示例。自定义最短/最长秒数，允许 0 和小数，0～0 立即爆炸；同一轮固定截止时间，传递和应用设置不会重抽时间，设置用于下一轮。Date.now + performance.now 双时钟、后台恢复检查、一次性爆炸保护，Web Audio 合成音效和可选震动。未添加人数、计分、账号或联网功能。

发布验收：实现提交 `0cb3da8` 已推送 origin/main，GitHub Pages 工作流 39972225310 成功；EdgeOne 自定义域名已独立验证。真实 HTTPS 首页入口及 `/pass-the-bomb/` 均返回新页面，线上浏览器通过九份 TSV / 270 题加载、九种模式/难度的 0 秒回合与无页面错误检查。Just One 原有浏览器回归也通过，仅将其缓存版本断言由 v8 更新至 v9，未改游戏逻辑。项目静态发布，无额外构建命令。后续可直接在手机访问 https://games.danielxu.cn/pass-the-bomb/ 试玩音量、震动和题目难度。

本轮验证：`node --check pass-the-bomb/app.js`、`node --check service-worker.js`、`node pass-the-bomb/tests/browser.cjs` 通过。自动化覆盖九份题库、九种组合、0/小数/固定/随机时间、传递不重置、运行中设置、后台恢复、一次爆炸、音效开关，320/390/844 手机视口及七个真实离线入口（检查没有退回大厅）。输出截图在被忽略的 outputs/。使用已有 Playwright：`NODE_PATH=D:\_Codex project\02_Game\werewords-game-mvp\node_modules`；HTTP 服务端口 8096，测试通过 TEST_URL 指定。实际手机的扬声器/震动仍依赖用户设备，未声称真机验证。

Service Worker v9 新增炸弹和题库预缓存，并补齐原五游戏目录 URL，避免离线点目录入口时退回大厅；原游戏业务源码未改。部署沿用 main → EdgeOne 自动发布，同时 GitHub Pages 仍配置为 main 根目录；自定义域名应独立进行 HTTP 内容验证。后续只需按 Excel 维护 TSV 并递增缓存版本，不要重跑初始种子脚本覆盖人工修改。

2026-10-23：Just One 位于 `games/just-one/`，本次只改白板编辑体验和变态题库，未改普通/困难 CSV、抽题加载逻辑或其他游戏业务；未运行 sync-games.ps1。

白板：同一个 textarea 同时用于大字展示和直接编辑；input 维护内存状态，不回写中文输入过程中的 value/caret。通过 VisualViewport resize/scroll、动态高度和 safe-area 适配横竖屏与键盘；低高度隐藏辅助文案，保留所有操作。提示词不上传、不写持久存储。点击完成收起键盘，隐藏状态从 textarea 移除提示值，展示时恢复。

题库：变态 CSV 已自主重制，60 张 / 300 词，UTF-8 BOM；全站三档共 900 词无重复。选词侧重大众听过但难用单一词提示的梗、典故、人物和社会/科技/心理概念，维护说明含选词规则与中文研究来源。普通、困难文件保持原样。

验证：`node games/just-one/validate-data.cjs`、app.js / service-worker.js 语法检查；`node games/just-one/tests/browser.cjs` 在 HTTP + Edge 通过题库加载、13 卡、刷新、直接编辑、中文组合输入/光标、隐藏/恢复、缩放、清空、320–844 宽手机视口及模拟键盘缩小/平移/恢复、六个离线入口和大厅返回。TEST_BROWSER=webkit 对应 WebKit 的题库和白板套件；Windows WebKit 在断网 reload 时报告引擎内部错误，离线部分使用 Chromium 验证。浏览器模拟不是 iOS/安卓真机键盘验收，真机触屏、输入法与安装体验仍待实测，题库难度也需要聚会试玩反馈。

测试需要 Playwright（可用 NODE_PATH 指向现有安装）；WebKit 缓存使用项目内 cache/playwright，通过 PLAYWRIGHT_BROWSERS_PATH 指定。截图在 outputs/，两者均被 Git 忽略。本项目无构建步骤。Service Worker v7 预缓存同一路径及新题库，通过 main 现有链路发布到 https://games.danielxu.cn/games/just-one/，不改域名/DNS。


2026-10-23 题库扩充：普通、困难、变态各追加 40 张 / 200 词，目前各 100 张 / 500 词，全库 1500 词无完全重复。原有 60 张均保持内容不变；保留原抽题、白板和加载逻辑。维护说明记录本轮中文搜索来源；Service Worker v8 更新 CSV 缓存。本轮验证：题库格式/BOM/全局去重、原有 60 张内容保护和 Chromium 浏览器题库/13 卡/白板/离线六入口回归。未跟踪的 games/friend-court/ 是其他工作，不纳入本次提交。

2026-10-23 新增 /games/friend-court/：按用户截图采用同时指人玩法，100 道原创题，无玩家设置，无后端。投票与多数派得分在线下；本机可选记录受害榜并导出 PNG。根 SW v11 包含新游戏。来源和维护见 FRIEND_COURT.md。

损友审判庭验证通过：Edge 手机视口流程、3 秒倒数、记名去重与撤销、刷新恢复、PNG 下载、320/390/844/1280 宽无横向溢出、HTTP Service Worker 注册和离线大厅 + 七游戏入口。截图在忽略目录 outputs/，浏览器测试源文件随代码提交。

## 2026-10-23 演技三部曲

当前工作副本：offline-board-games-github-main；旧 offline-board-games 与远程历史无关，未对其做合并或覆盖。以 origin/main 为基线，新增 /wasabi-roulette/、/two-faced/、/fun-employed/，首页从 7 个入口增至 10 个；无构建步骤，继续使用 main → 现有 EdgeOne 发布链路与 games.danielxu.cn 域名。

assets/party-data.js 含 30 限制令、24 话题、16 完整剧本、30 职位、72 特长。assets/party.js 实现全部状态、严格确认再看牌、退出隐藏、倒计时绝对截止时间、暂停/重置、问答灵感、独立重抽、录用下一轮和跨页面音效偏好。新游戏不持久化秘密。

验证命令：node --check assets/party.js；node --check assets/party-data.js；node --check service-worker.js；node assets/tests/party-browser.cjs。浏览器测试需 NODE_PATH 指向现有 Playwright（本机 D:\_Codex project\02_Game\werewords-game-mvp\node_modules），TEST_URL 默认 http://127.0.0.1:8097。测试覆盖全部最低题库数/去重/故事长度、4/6/10 人恰好一名影帝、失焦隐藏、A/B 隔离、180 秒开始暂停重置到时、45 秒闪烁/结束、提问、重抽不重置计时、Offer 下一轮、音效偏好、320/390/844 宽无横向溢出，以及断网大厅和十个真实游戏入口。CDN 在测试中被阻断，确认本地基础样式和逻辑独立可用。截图 outputs/party-mobile.png 为忽略产物，不上传。下一步为真机试玩触屏操作、现场可读性和扬声器音量；未声称真机验证。

## 2026-10-23 演技题库扩容

同步至 origin/main 的 1545bec 后追加题库，保留新增的损友审判庭。五库由 30/24/16/30/72 扩至 120/96/64/120/288；每库新增原数量三倍，原题内容与顺序保留。全部条目硬编码，来源与人工筛选口径在 PARTY_LIBRARY.md。规则、UI、抽题状态机与其他游戏业务文件未修改。SW v12 缓存更新，测试改为十一个离线入口并增加原前缀摘要保护与扩容下限检查。测试仍用 NODE_PATH 指向已有 Playwright、TEST_URL 默认端口 8097；继续沿用 main 自动部署。后续如增加题目，同步更新对应数量下限及 SW 版本，不覆盖原题；实际趣味性继续由线下试玩反馈。

本轮验证通过：三份 JS 语法检查；题库数量、全库去重、原题前缀完整性、故事长度与正文唯一性；Edge 手机浏览器核心流程、320/390/844 布局及大厅与全部十一个游戏离线入口。运行时无新增依赖，无构建步骤。
