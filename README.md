# Daniel 的桌游

七款手机优先、可安装、可断网游玩的桌游合集 PWA。

## 本地运行

```powershell
python -m http.server 8080
```

打开 `http://127.0.0.1:8080/`。Service Worker 需要 HTTP(S) 环境，不能用 `file://` 直接打开。

## 包含游戏

- 嘴炮炸弹 Pass the Bomb：`/pass-the-bomb/`，三模式 × 三难度，270 道中文题，自定义 0 秒起的引信范围。
- 伪艺术家纽约行
- 赝品画师
- 今天纠结什么
- 间谍危机 Spyfall
- Werewords Companion
- 独家暗语 Just One（题库 / 可直接编辑的本地白板）：`/games/just-one/`

原六个游戏在 `games/`，嘴炮炸弹在 `pass-the-bomb/`，首页没有 iframe 或外链启动逻辑。`sync-games.ps1` 只同步原五个独立项目，不用于更新嘴炮炸弹。

## 离线安装

联网打开大厅并等待状态变为“✓ 离线游戏已准备完成”，再使用浏览器的“添加到主屏幕/安装 App”。之后可断网从主屏幕启动。

## 验证

Service Worker 使用 `daniel-board-games-v9` 版本缓存大厅、七个游戏及题库。更新发行内容时递增 `CACHE_NAME` 并重新运行离线验证。

## Just One 维护与发布

新增游戏直接在本仓库维护，不属于五个来源的同步脚本。词库为 `games/just-one/data/` 下三份 UTF-8 BOM CSV，每份 100 张卡，维护方法见同目录说明。运行 `node games/just-one/validate-data.cjs` 验证题库；本项目无构建步骤和 package.json。

GitHub main 为最终来源，通过现有 EdgeOne 链路发布至 https://games.danielxu.cn/ 。同步前先检查工作区，干净时使用 `git pull --ff-only`；提交前检查差异和忽略规则，验证后 commit / push，不覆盖本地修改。

## 嘴炮炸弹维护

九份题库在 `pass-the-bomb/data/`，可用 Excel 编辑；列为 `id`、`prompt`、`example`，保存为 UTF-8 制表符分隔文本。示例用于确认有解，不会在游戏中显示。每份至少保留 30 行，字段不能含制表符或换行。`make-data.py` 仅记录初始种子，手工编辑 TSV 后不要重新运行，以免覆盖修改。

普通接词无字数限制，困难至少三字，变态只接四字成语；均允许同音字。场景/脑洞由现场玩家判断合理答案。默认引信 15～45 秒，支持 0～0 秒立即爆炸。设置适用于所有模式，下次点燃使用；正在燃烧的引信保持原截止时间。后台不暂停，恢复时检查截止时间。音效与震动依赖设备支持。无构建步骤，测试命令见 AGENTS。
