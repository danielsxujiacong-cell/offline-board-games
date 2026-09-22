# 项目工作规则

- 这是五个独立游戏的离线发行版，不在此处重构原项目。
- 源码更新先检查 `sync-games.ps1` 的五个来源路径与各自 Git remote。
- 不复制 `.git`、`node_modules`、缓存、临时归档或机器凭据。
- 发布前必须使用 HTTP 服务器注册 Service Worker，并在浏览器 Network Offline 下验证大厅和五个游戏入口。
