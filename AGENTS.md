# 项目工作规则

- 这是七个游戏的离线发行版，其中 Just One 和 Pass the Bomb 在本仓库直接维护，不在此处重构原项目。
- 源码更新先检查 `sync-games.ps1` 的五个来源路径与各自 Git remote。
- 不复制 `.git`、`node_modules`、缓存、临时归档或机器凭据。
- 发布前必须使用 HTTP 服务器注册 Service Worker，并在浏览器 Network Offline 下验证大厅和七个游戏入口。

- Just One 位于 `games/just-one/`，无构建依赖；题库检查命令：`node games/just-one/validate-data.cjs`。不运行整站同步脚本来更新它。
- Pass the Bomb 位于 `pass-the-bomb/`，无构建依赖；测试：`node pass-the-bomb/tests/browser.cjs`（需 Playwright 和 HTTP 服务）。九份 UTF-8 BOM TSV 在 `data/`，可用 Excel 编辑；不可通过传递或应用设置重置当前轮截止时间。
