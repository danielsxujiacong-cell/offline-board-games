# Daniel 的桌游

五款手机优先、可安装、可断网游玩的桌游合集 PWA。

## 本地运行

```powershell
python -m http.server 8080
```

打开 `http://127.0.0.1:8080/`。Service Worker 需要 HTTP(S) 环境，不能用 `file://` 直接打开。

## 包含游戏

- 伪艺术家纽约行
- 赝品画师
- 今天纠结什么
- 间谍危机 Spyfall
- Werewords Companion

五个游戏的运行文件都在 `games/` 内，首页没有 iframe 或外链启动逻辑。`sync-games.ps1` 可从五个独立原项目重新同步发行快照，并排除 `.git`、缓存和开发目录。

## 离线安装

联网打开大厅并等待状态变为“✓ 离线游戏已准备完成”，再使用浏览器的“添加到主屏幕/安装 App”。之后可断网从主屏幕启动。

## 验证

Service Worker 使用 `daniel-board-games-v1` 版本缓存大厅、五个游戏的 HTML/CSS/JS/图片和本地字体候选资源。更新发行内容时递增 `CACHE_NAME` 并重新运行离线验证。
