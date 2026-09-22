# Project Context

本项目是现有五个独立网页游戏的静态离线打包发行版。原项目继续独立开发；本项目只复制稳定运行文件，并通过一个根目录 Service Worker 统一缓存。

离线边界：核心游戏运行不依赖远程 API。Werewords 原有 Tailwind CDN 已替换为本地兼容 CSS，fake-painter 的 Google Fonts 导入已移除并使用系统字体回退。浏览器的分享、保存海报等系统能力仍由设备支持情况决定。
