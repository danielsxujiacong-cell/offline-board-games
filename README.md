# Daniel 的桌游

十二款手机优先、可安装、可断网游玩的桌游合集 PWA。

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

Service Worker 使用 `daniel-board-games-v16` 版本缓存大厅、十二个游戏及题库。更新发行内容时递增 `CACHE_NAME` 并重新运行离线验证。

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
