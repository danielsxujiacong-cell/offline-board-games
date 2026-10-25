# 开发与交接指南

线上路径 `https://games.danielxu.cn/sheriff/`。源码在 `sheriff/`，沿用 GitHub main → EdgeOne 静态发布，无构建、运行时依赖、账号或后台。

用户文本建议 React/TypeScript/Tailwind；MVP 采用合集现有的原生 ES Modules 和本地 CSS，避免引入新构建链和 CDN。功能规则集中在纯逻辑模块，后续可以替换 UI。

- `engine.js`：156 张牌数据、洗牌、状态转换、校验、金币转移与计分。
- `app.js`：DOM、传阅遮罩、输入草稿、localStorage、刷新/后台隐私。
- `style.css`：中世纪走私漫画风：粗墨线、砖红/芥末黄/青绿、歪斜吊牌、蜡封印章和手机四列货牌。
- `art.js`：原创 SVG 货物、麻袋、角色肖像及各阶段场景插图。
- `assets/gate.webp`：AI 生成的原创城门对峙插画，已压缩为约 300 KB 的本地 WebP，支持离线。
- `index.html`：应用入口及内置规则弹窗。
- `RULES.md`：玩家规则、原版来源和所有自定义差异。

状态流转：`market → pack → sheriff → result → market`，第六回合 result 后 `over`。遮罩是独立 UI 状态，不更改逻辑阶段。封袋后从手牌移除实际货物；结算后清除袋数据，公开战报只保留合法公开货物及被查袋。结算函数只能从 sheriff 调用，防止重复扣款。

金币为整数，罚款赔偿可以为负，贿赂总额不超过 `max(0, merchant.coins)`。卡牌全程应守恒 156，双方金币总和应守恒 100。王冠双方零张不发奖，非零同数才平分。

存档键 `sheriff-dual-bags-v1`。确认阶段才保存；装袋草稿不保存。所有隐私数据仅在浏览器，无跨设备同步。存档明文保存属于信任式传阅。将来如加联机，必须由服务端持有手牌、验证玩家身份和动作，不能把全局状态发送给客户端。

## 运行、测试、发布

仓库根目录启动任意静态 HTTP 服务，例如 `python -m http.server 8080`，打开 `/sheriff/`。

规则测试：`node --test tests/sheriff.test.mjs`。

浏览器测试：`node tests/sheriff-browser.cjs`，复用已有 Playwright 与 Edge。`PLAYWRIGHT_PATH` 指定包，`TEST_URL` 指定服务地址；测试配置文件与截图位于被忽略的 `.openai/`。

发布只提交本次文件；确认大厅入口、sitemap 和 Service Worker 新版本及预缓存资源一起更新。推送 main 后等待 EdgeOne，验证线上 HTML/JS 与预期一致。现有 SW 缓存优先，旧客户端打开大厅刷新后将收到新版；新版本安装完成前勿断网。

不运行 `sync-games.ps1` 更新本游戏。下一步迭代优先实际双人试玩、平衡性记录、可选回合数；本版本不宣称已完成人类平衡性测试。

## 漫画视觉版本（2026-10-25）

开局为商人/警长城门对峙，交接为机密货单，换牌为市集，装袋为马车货台，裁决为检查哨，结算为带通行/查获/赔偿印章的城门战报，终局为财富榜，规则弹窗为城门公告。所有货牌以原创内联 SVG 替换系统 Emoji。插画随站点预缓存，无远程字体、图标或图片请求。玩法与存档格式保持一致。
