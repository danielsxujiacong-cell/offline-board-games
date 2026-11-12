# Handoff

## 2026-11-12 · 张楠短句、固定梗与简单追问

在笔记本 `G:\_Codex project\02_Game\offline-board-games` 的 `main` 开发，起点 `bdad145`，工作区干净且与 origin/main 一致。沿用原生静态页和 GitHub → EdgeOne 链路；复用 G 盘既有 Playwright 1.64.1 与系统 Edge，无依赖安装或构建。已核对同步脚本及五个源路径，旧 werewords-companion 来源不存在；本页直接维护，未运行同步脚本。

`data.js` 收敛为用户确认的固定短句和同义问法，经典句不再强制去重；数字统一为 114514，单位随数值问题变化。“我是你爹。”仅用于直接询问身份，名字问题仍答“张楠。”，其他日常是平淡短废话。回复最多 20 个 Unicode 字符、一个完整句子；动作或主题过长时使用完整短兜底，不裁切回答。思考、点击、初始和重开台词同步缩短，五批快捷问题覆盖新梗。

`engine.js` 先判断原因／判断／方法，再处理数值和单位，修正“绳子多长”被当作时间。明确单位从“多少／几”后的单位取值，避免从问题陈述的 3 瓶／3 公里误触发或取错单位；默认单位和维护说明见 `zhangnan/README.md`。`createReplyEngine({ history, recent, random })` 新增可选 history，`.answer(question)` 仍返回 `{ answer, category }`，`.reset()` 清空话题、最近三轮和近期回答。初始化重放最近三轮有效问题，支持价格／味道／方法的“那…呢”追问、价格原因接话与复述；明确新话题覆盖旧话题。UI 从既有 turns 初始化，沿用 `zhangnan-chat-v1` / version 1 / 最近 100 组历史，无迁移。旧长回答仍可查看，要求复述时用短句说明。

本轮验证通过：

- `node --test tests/zhangnan.test.mjs`：13 组，覆盖稳定重复、礼貌前缀和同义问法、身份梗范围、默认及明确单位、原因／判断／陈述、长度与时长、简单追问、话题切换、三轮恢复、复述与重置、旧存档兼容和完整短句上限。
- `node tests/zhangnan-browser.cjs`：HTTP 服务 + 系统 Edge，真实发送、快捷按钮、IME、连续排队、刷新、取消／确认重开、历史格式兼容、固定梗与单位、追问／切换／复述、动画与点击、纯文本显示、320/390/768/1440px 与横屏、模拟键盘、减少动态效果全部通过，零 pageerror。
- CDP Network Offline：大厅 + 全部 18 个实际入口由 Service Worker 返回对应页面，张楠可断网提问、刷新后继承价格话题、触发身份梗并回到大厅。
- 缓存递增为 `daniel-board-games-v55-zhangnan-short-replies`，资源清单及其他游戏业务保持原样；JS 语法与差异空白检查通过。

浏览器证据位于忽略目录 `.openai/zhangnan-short-local/`，包括 short-replies-mobile、表情层、历史及多视口截图。发布后使用正式根地址重跑同一浏览器套件，并核对线上 engine/data/app 与本地文件及 v55 缓存一致；结果以实际自定义域名检查为准。实体手机输入法与触屏手感仍由用户真机体验。

## 2026-11-12 · 张楠问答第一版

在实际云端 `/workspace/offline-board-games` 开发。开始前阅读根 AGENTS、README 和本文件，确认工作区干净；先快进同步 origin/main 的 `8d4d283`，保留电波同步 435 题及情侣分类的全部更新。未运行同步脚本、未改其他游戏业务、域名、DNS 或托管配置。继续沿用同一 GitHub `main` → 既有 EdgeOne 静态链路。

新增 `/zhangnan/`（无构建、运行依赖或后端），奶油白／淡紫舞台，采用用户最后确认的紫灰齐肩发、日系 JK 穿搭 Q 版角色。`character.webp` 加生成的闭眼／开口表情，通过独立头／身体裁剪、眼睛／嘴部羽化蒙版和 CSS 动画实现真实眨眼、呼吸、思考歪头、回答嘴型与点击反馈；提问不会增加动画定时器。三个 WebP 合计约 520 KB，私人参考照片未入库。

`data.js` / `engine.js` 与 UI 分离：经典问答（首次香蕉固定为“就是香蕉味。”）、按问题类型提取对象／动作／时间的前端废话句式、近期回答去重。明确没有大模型或真正多轮理解。输入和快捷按钮均触发真实问答；支持串行连续提问、逐字回答、历史小本本、刷新恢复、确认重开和取消旧队列。最多 100 组已完成问答仅保存在本机 `localStorage['zhangnan-chat-v1']`，未完成问题刷新取消。无账号或数据上传。

根大厅首位新增入口，回大厅使用 `../`；更新 sitemap，Service Worker 由 v53 递增为 `daniel-board-games-v54-zhangnan`，新增本页全部运行资源预缓存并保留原游戏列表与网络逻辑。维护细节见 `zhangnan/README.md`。

已验证：

- `node --test tests/zhangnan.test.mjs`：7 项通过，经典原句、类型／对象对应、有限随机下去重、长输入、恢复与重置。
- `node tests/zhangnan-browser.cjs`：真实输入／快捷按钮／三条快速发送的顺序、空输入、中文 IME 确认和发送分离、刷新历史、取消重开／思考中重开、长问题和纯文本显示、闭眼及嘴型实际渲染／歪头／点击、动画持续时间和数量稳定、320/390/768/1440px 及横屏无溢出、模拟键盘缩小后仍可发送、减少动态效果模式、子路径刷新与双向大厅导航。零 pageerror。
- HTTP 服务注册 SW 后使用 CDP Network Offline 验证**大厅 + 全部 18 个实际入口**，均由 SW 返回对应页面；新页可离线提问、刷新历史和回大厅。
- `node --test tests/*.test.mjs`：85/85 通过。初次执行缺少既有在线游戏测试的 PGlite；仅在被忽略的 `.openai/zhangnan-test-tools` 安装测试依赖，并让已有测试引用该安装后重跑通过，没有新增页面运行依赖或修改数据库／在线服务。
- 既有 `tests/hanamikoji-browser.cjs`、`games/just-one/tests/browser.cjs`、`pass-the-bomb/tests/browser.cjs` 全部通过；Just One 1500 词与炸弹 810 题验证通过。测试复用现有 Playwright 和 Linux Chromium，旧测试使用临时 preload 适配其 Windows Edge 配置。

真实 HTTP 预览截图位于忽略目录 `.openai/zhangnan/mobile-final.png`、`desktop-final.png`，另有闭眼、开口、历史和多视口证据；测试日志与依赖均不提交。仅完成浏览器设备模拟，实体 iPhone／Android 的输入法、键盘和触屏手感仍需用户手机验收。

发布核验限制：本次云环境的出站域名规则没有放行 `games.danielxu.cn`，HTTPS 探测在代理 CONNECT 阶段返回 403；网页读取工具也无法访问该域名。GitHub 可访问，推送后可检查源码及既有自动发布任务，但任务成功不能单独证明 EdgeOne 自定义域名已刷新。手机验收地址：<https://games.danielxu.cn/zhangnan/>，大厅：<https://games.danielxu.cn/>。不将本地预览或 push 成功写成正式域名验收成功。

## 2026-10-25 花见小路

新增 `/games/hanamikoji/`，完整四行动、对手亲选赠予/竞争、确认交接后才显示手牌、行动后立即移除手牌 DOM，轮末翻开密约、支持平局保留、11 分优先与多轮交换先手。源码直接在本仓库维护，不运行 sync-games.ps1。规则与界面为本地 JS，无运行依赖、安装或打包步骤；package.json 仅声明模块类型供 Node 测试使用。刷新会结束当前内存对局。

规则测试 `node --test tests/hanamikoji.test.mjs`（10 项）及 `node tests/hanamikoji-browser.cjs` 通过；后者沿用现有 Playwright/Edge，用 PLAYWRIGHT_PATH 指定已有包、TEST_URL 指定地址。覆盖整轮、交接无手牌 DOM、取消重开/结算、隐藏恢复不重复摸牌、390/1280 视口无横向溢出、CDP Network Offline 下大厅及全部 12 个真实游戏入口。现有 Just One / Pass the Bomb 题库验证亦通过。

实现 2d8854e、静态服务器 MIME 兼容修正 f435bba 已推送 main，GitHub 部署检查成功。正式域名 app.js/engine.js 返回 application/javascript，浏览器在 https://games.danielxu.cn 完整通过相同整轮及全部 13 个离线入口测试；SW v16。截图在忽略目录 .openai/。不使用 .mjs 作为线上脚本，当前部署将其返回 application/octet-stream。仅做浏览器设备模拟，未声称实体手机验证。

2026-10-23 嘴炮炸弹题库三倍扩充：九份 TSV 各追加 60 题，合计 270 → 810（每档 90）。原 001–030 文本完整保留；新增内容覆盖聚餐、KTV、社交翻车、宠物、虚构世界、拟人用途及带约束的脑洞设定。每题有维护用答案示例，参考来源与中文筛选标准在 `pass-the-bomb/data/题库维护与来源.md`。没有改 app.js、CSS、时间设置或其他游戏源码。

验证通过：`node pass-the-bomb/validate-data.cjs`（810 题全库题面无重复、连续编号、BOM、接词长度）；对比 Git 证明原 270 题未变；`node pass-the-bomb/tests/browser.cjs`（九档新增题确实可抽到、0/小数/随机时间、传递不重计时、后台恢复、单次爆炸、320/390/844 视口、11 个真实离线入口）；`node --check service-worker.js`。合并远端同期演技题库扩容 3110df4 后缓存递增至 v13，保留对方变更，沿用现有 main → EdgeOne 发布链路。

上线核验：实现及缓存提交 c8c0159 已推送，GitHub Pages 工作流 39978266999 成功；独立访问 EdgeOne HTTPS 正式地址 https://games.danielxu.cn/pass-the-bomb/，九份 TSV 均返回 200、每份 90 题且与本地全文一致。线上浏览器逐一抽到九档 ID 090 新题，0 秒爆炸和 SW v13 均确认，无页面错误。截图 outputs/pass-the-bomb-expanded-live.png 为忽略产物，不上传。

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

## 2026-10-24 · SEO

大厅及十一个固定游戏入口补充标题、描述与 canonical，新增 robots.txt 与 sitemap.xml。Service Worker 缓存版本 v14，游戏脚本和题库未改动。
推送后需核对自定义域名已更新；搜索平台归属验证与 sitemap 提交由用户完成。

## 2026-10-27 · SEO 增量

六个较新入口补齐 canonical/robots 与缺失描述；惨剧轮回加入地图（共 19 个公开 URL）。SW v42。hanamikoji-browser.cjs 通过多视口、整局隐私与大厅和 17 个游戏离线导航；零页面异常。只提交 SEO 文件，其他在途题库工作保留。
