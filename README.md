# Daniel 的桌游

六款手机优先、可安装、可断网游玩的桌游合集 PWA。

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
- 独家暗语 Just One（题库 / 可直接编辑的本地白板）：`/games/just-one/`

六个游戏的运行文件都在 `games/` 内，首页没有 iframe 或外链启动逻辑。`sync-games.ps1` 可从五个独立原项目重新同步发行快照，并排除 `.git`、缓存和开发目录。

## 离线安装

联网打开大厅并等待状态变为“✓ 离线游戏已准备完成”，再使用浏览器的“添加到主屏幕/安装 App”。之后可断网从主屏幕启动。

## 验证

Service Worker 使用 `daniel-board-games-v7` 版本缓存大厅、六个游戏的 HTML/CSS/JS/图片和本地字体候选资源。更新发行内容时递增 `CACHE_NAME` 并重新运行离线验证。

## Just One 维护与发布

新增游戏直接在本仓库维护，不属于五个来源的同步脚本。词库为 `games/just-one/data/` 下三份 UTF-8 BOM CSV，每份 60 张卡，维护方法见同目录说明。运行 `node games/just-one/validate-data.cjs` 验证题库；本项目无构建步骤和 package.json。

GitHub main 为最终来源，通过现有 EdgeOne 链路发布至 https://games.danielxu.cn/ 。同步前先检查工作区，干净时使用 `git pull --ff-only`；提交前检查差异和忽略规则，验证后 commit / push，不覆盖本地修改。
