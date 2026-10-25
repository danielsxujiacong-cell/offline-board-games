# 开发与交接指南

线上路径 `https://games.danielxu.cn/sheriff/`。源码在 `sheriff/`，沿用 GitHub main → EdgeOne 静态发布，无构建、运行时依赖、账号或后台。

用户文本建议 React/TypeScript/Tailwind；MVP 采用合集现有的原生 ES Modules 和本地 CSS，避免引入新构建链和 CDN。功能规则集中在纯逻辑模块，后续可以替换 UI。

- `engine.js`：156 张牌数据、洗牌、状态转换、校验、金币转移与计分。
- `app.js`：DOM、传阅遮罩、输入草稿、localStorage、刷新/后台隐私。
- `style.css`：森林绿、黄铜、羊皮纸原创 CSS 视觉，手机四列手牌。
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
