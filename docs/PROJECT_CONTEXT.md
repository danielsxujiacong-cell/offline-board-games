# Project Context

本项目是现有五个独立网页游戏的静态离线打包发行版。原项目继续独立开发；本项目只复制稳定运行文件，并通过一个根目录 Service Worker 统一缓存。

离线边界：核心游戏运行不依赖远程 API。Werewords 原有 Tailwind CDN 已替换为本地兼容 CSS，fake-painter 的 Google Fonts 导入已移除并使用系统字体回退。浏览器的分享、保存海报等系统能力仍由设备支持情况决定。

2026-10-23：新增本仓库直接维护的第六款游戏 Just One，采用米白、黑字及红蓝点缀。三档 CSV 各 100 张卡，由客户端加载；每局 13 张不同卡，进度只写 localStorage，白板内容只在页面内存。不需要数据库、登录、房间或同步服务。复用根 Service Worker v8 与大厅返回链接，保留原五个游戏的逻辑。
