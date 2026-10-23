# Handoff

2026-10-23：在现有静态合集新增 `games/just-one/`，大厅现在包含六款游戏。Just One 直接在本仓库维护，未运行 sync-games.ps1，未修改其他游戏业务逻辑。

已完成：三档各 60 张 UTF-8 BOM CSV、每局 13 张无重复卡、本地进度恢复（刷新隐藏题卡）、手机横屏白板、编辑/清空/隐藏/缩放、根 Service Worker v5 预缓存。

验证：`node games/just-one/validate-data.cjs` 通过，900 词全局不重复。`node --check games/just-one/app.js` 与 service-worker.js 通过。`node games/just-one/tests/browser.cjs` 在本地 HTTP + Edge 无头浏览器通过：三档加载、抽题/终局/重开/刷新、白板操作、390×844 与 844×390 布局、直接入口、返回大厅、六款游戏断网入口和 CSV 缓存。测试依赖外部 Playwright，可通过 NODE_PATH 指向可用安装；测试截图写入被忽略的 outputs/。项目无 package.json 或构建命令。

发布：推送 GitHub main，沿用现有 EdgeOne 链路和 games.danielxu.cn。下一步为真实手机软键盘及主屏幕安装体验复核；浏览器模拟不等同于真机验证。不要改 DNS 或新建站点。
