# Handoff

2026-10-23：Just One 位于 `games/just-one/`，本次只改白板编辑体验和变态题库，未改普通/困难 CSV、抽题加载逻辑或其他游戏业务；未运行 sync-games.ps1。

白板：同一个 textarea 同时用于大字展示和直接编辑；input 维护内存状态，不回写中文输入过程中的 value/caret。通过 VisualViewport resize/scroll、动态高度和 safe-area 适配横竖屏与键盘；低高度隐藏辅助文案，保留所有操作。提示词不上传、不写持久存储。点击完成收起键盘，隐藏状态从 textarea 移除提示值，展示时恢复。

题库：变态 CSV 已自主重制，60 张 / 300 词，UTF-8 BOM；全站三档共 900 词无重复。选词侧重大众听过但难用单一词提示的梗、典故、人物和社会/科技/心理概念，维护说明含选词规则与中文研究来源。普通、困难文件保持原样。

验证：`node games/just-one/validate-data.cjs`、app.js / service-worker.js 语法检查；`node games/just-one/tests/browser.cjs` 在 HTTP + Edge 通过题库加载、13 卡、刷新、直接编辑、中文组合输入/光标、隐藏/恢复、缩放、清空、320–844 宽手机视口及模拟键盘缩小/平移/恢复、六个离线入口和大厅返回。TEST_BROWSER=webkit 对应 WebKit 的题库和白板套件；Windows WebKit 在断网 reload 时报告引擎内部错误，离线部分使用 Chromium 验证。浏览器模拟不是 iOS/安卓真机键盘验收，真机触屏、输入法与安装体验仍待实测，题库难度也需要聚会试玩反馈。

测试需要 Playwright（可用 NODE_PATH 指向现有安装）；WebKit 缓存使用项目内 cache/playwright，通过 PLAYWRIGHT_BROWSERS_PATH 指定。截图在 outputs/，两者均被 Git 忽略。本项目无构建步骤。Service Worker v7 预缓存同一路径及新题库，通过 main 现有链路发布到 https://games.danielxu.cn/games/just-one/，不改域名/DNS。
