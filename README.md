# Daniel 的桌游

十四款手机优先、可安装、可断网游玩的桌游合集 PWA。

## 本地运行

```powershell
python -m http.server 8080
```

打开 `http://127.0.0.1:8080/`。Service Worker 需要 HTTP(S) 环境，不能用 `file://` 直接打开。

## 包含游戏

- 花见小路 Hanamikoji：`/games/hanamikoji/`，两人单设备传递，完整四行动、轮末结算与多轮支持继承。

- 嘴炮炸弹 Pass the Bomb：`/pass-the-bomb/`，三模式 × 三难度，810 道中文题（每档 90 题），自定义 0 秒起的引信范围。
- 伪艺术家纽约行
- 赝品画师
- 今天纠结什么
- 间谍危机 Spyfall
- Werewords Companion
- 独家暗语 Just One（题库 / 可直接编辑的本地白板）：`/games/just-one/`

原六个游戏在 `games/`，嘴炮炸弹在 `pass-the-bomb/`，首页没有 iframe 或外链启动逻辑。`sync-games.ps1` 只同步原五个独立项目，不用于更新嘴炮炸弹。

## 离线安装

联网打开大厅并等待状态变为“✓ 离线游戏已准备完成”，再使用浏览器的“添加到主屏幕/安装 App”。之后可断网从主屏幕启动。

## 验证

Service Worker 使用 `daniel-board-games-v21-jaipur` 版本缓存大厅、十四个游戏及题库。更新发行内容时递增 `CACHE_NAME` 并重新运行离线验证。

## 花见小路维护

源码在 `games/hanamikoji/`，仅本地 HTML/CSS/JavaScript，无构建或安装步骤，直接使用现有静态部署。原创花纹图形，无外部资源。对局仅保存当前页面内存，刷新会重新开局。规则测试：`node --test tests/hanamikoji.test.mjs`；浏览器测试：`node tests/hanamikoji-browser.cjs`（使用现有 Playwright，`PLAYWRIGHT_PATH` 可指定包路径，`TEST_URL` 可指定 HTTP 地址）。覆盖完整一轮、传递隐私、手机/桌面布局及所有入口 Network Offline 导航。

## Just One 维护与发布

新增游戏直接在本仓库维护，不属于五个来源的同步脚本。词库为 `games/just-one/data/` 下三份 UTF-8 BOM CSV，每份 100 张卡，维护方法见同目录说明。运行 `node games/just-one/validate-data.cjs` 验证题库；本项目无构建步骤和 package.json。

GitHub main 为最终来源，通过现有 EdgeOne 链路发布至 https://games.danielxu.cn/ 。同步前先检查工作区，干净时使用 `git pull --ff-only`；提交前检查差异和忽略规则，验证后 commit / push，不覆盖本地修改。

## 嘴炮炸弹维护

九份题库在 `pass-the-bomb/data/`，可用 Excel 编辑；列为 `id`、`prompt`、`example`，保存为 UTF-8 制表符分隔文本。示例用于确认有解，不会在游戏中显示。每份至少保留 90 行，字段不能含制表符或换行。运行 `node pass-the-bomb/validate-data.cjs` 检查题库；搜索参考、趣味与难度标准见 [题库维护与来源](pass-the-bomb/data/题库维护与来源.md)。`make-data.py` 仅记录初始种子，手工编辑 TSV 后不要重新运行，以免覆盖修改。

普通接词无字数限制，困难至少三字，变态只接四字成语；均允许同音字。场景/脑洞由现场玩家判断合理答案。默认引信 15～45 秒，支持 0～0 秒立即爆炸。设置适用于所有模式，下次点燃使用；正在燃烧的引信保持原截止时间。后台不暂停，恢复时检查截止时间。音效与震动依赖设备支持。无构建步骤，测试命令见 AGENTS。

## 派对演技三部曲

- `/wasabi-roulette/` 芥末俄罗斯轮盘：4–10 人传阅、秘密指令与 180 秒聊天。
- `/two-faced/` 双簧大忽悠：两位演员独立防窥卡、完整荒谬剧本与 180 秒审讯。
- `/fun-employed/` 戏精求职部：2–10 位应聘者加 HR，三词简历、45 秒路演与录用撒花。

统一源码在 `assets/party.js`、`assets/party.css`，硬编码词库在 `assets/party-data.js`。Tailwind CDN 为渐进增强，离线基础样式全部本地提供，游戏无后端、无构建步骤。音效偏好存浏览器本地，身份与简历只存当前页面内存；刷新/切换游戏会结束本局。

题库现有 **120 条演技限制令、96 个聊天话题、64 个完整双簧剧本、120 个职位、288 个特长**；全部硬编码内置。联网参考来源与筛选口径见 [题库维护](docs/PARTY_LIBRARY.md)。

验证：`node assets/tests/party-browser.cjs`，需现有 Playwright 安装和 HTTP 服务，`TEST_URL` 指定服务地址。

## 损友审判庭

入口：/games/friend-court/。100 道原创题、倒数指人、可选受害榜与 PNG 战报。无玩家设置和后端；投票计分在线下。规则与测试见 docs/FRIEND_COURT.md。

## 斋浦尔 Jaipur

入口 `/jaipur/`，原生 HTML/CSS/JavaScript，无构建、依赖安装、后端或外部素材。集中规则引擎 `jaipur/engine.js`；当前对局仅存内存，刷新重新开局。每次交接先移除秘密手牌，再由本人确认显示。完整原版数值与动作见页面交易规则；完全同分采用明确标注的网页自定义规则：本轮先手获胜。

验证：`node --test tests/*.test.mjs`；`node tests/jaipur-browser.cjs`（复用现有 Playwright，可用 `PLAYWRIGHT_PATH` 指定，`TEST_URL` 默认为 http://127.0.0.1:8080）。浏览器测试包含整场比赛、隐私、320–1280px 布局、子路径刷新和大厅及十四款游戏 Network Offline。

## 失落的城市 Lost Cities

入口 `/lost-cities/`，纯前端，无依赖安装和构建。古地图、黄铜罗盘与五色地形卡牌全部使用本地 CSS 绘制。60 张原版卡牌、严格出牌/摸牌阶段、公开远征与弃牌堆、隐私交接、同一函数实时/最终计分、自由续局和累计成绩。

存档键 `lost-cities-save-v1`，每次有效操作保存完整状态与唯一对局 ID，刷新与切后台重新隐藏手牌；支持 PLAY/DRAW 恢复、逐列结算与历史，已结束牌局不会重复累计。损坏或版本不兼容时保留原始存档，可导出备份并二次确认重置。仅在当前浏览器保存，无跨设备同步。

本地在仓库根目录运行 `python -m http.server 8080`，打开 `http://localhost:8080/lost-cities/`。规则/存档测试：`node --test tests/lost-cities.test.mjs`；浏览器验收：`node tests/lost-cities-browser.cjs`，复用现有 Playwright 与 Edge（可设置 `PLAYWRIGHT_PATH` 和 `TEST_URL`）。包括完整 44 回合、手动公式核对、刷新/交接隐私、清零确认、损坏存档、320–1280px 和大厅所有入口 Network Offline。自动化双人操作已验证，真实两人主观体验仍需人工验收。

沿用 GitHub main → EdgeOne 的静态部署，无服务器和新部署配置。
