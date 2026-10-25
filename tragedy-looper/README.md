# 惨剧轮回 Tragedy Looper · First Steps MVP

现有 `offline-board-games` 合集的独立静态入口：`/tragedy-looper/`。不依赖构建、后端、数据库、WebSocket、CDN 字体或网络房间。使用原有根 Service Worker 缓存本游戏资源，没有修改大厅或其他小游戏页面。

## 使用

在仓库根目录运行 `python -m http.server 8080`，打开 `http://127.0.0.1:8080/tragedy-looper/`。

1. 从下拉框选择官方原版剧本及默认／挑战轮回数。
2. GM 点击独立暗箱按钮，经二次确认后查看真相、核对阶段并选择三张秘密行动。锁定即关闭暗箱。
3. 主人公在同一屏幕共同讨论，各锁定一张卡，全部锁定后统一亮牌。双方各自不可重复目标，双方之间可以重叠。
4. 按目标逐组确认执行，或使用地图 ±／位置菜单手动处理，再标记已处理。**不要既手动改数又确认执行同一组**。移动先合并再检查禁止地点；禁止卡只作用于行动卡。
5. GM 在各阶段核对技能与事件，主动确认使用或跳过可选技能。满足条件的强制夜间技能必须先执行。关键人物／主人公死亡的确认操作会立即进入轮回结束。轮回结束的主线条件由 GM 再确认。
6. 确认失败后，经确认回溯；全部失败则 GM 获胜。完整存活任意轮回则主人公获胜，没有最终猜测。

友好值是技能需求，不会因技能使用扣除。拒绝友好技能仍计为使用。警察原版友好 5 在死亡确认时使用，以防止同地点的一次角色死亡；未采用后续修订版的 Extra 标记机制。病人由医生解除限制后仍需要移动效果才能出院。

## 原版核对与来源

本实现基线为 Z-Man 原版 First Steps，**不是 New Tragedies**。中文说明为实现所用意译，不宣称为官方中文译名。

- [原版 Player's Handbook](https://images-cdn.zmangames.com/us-east-1/filer_public/bc/e8/bce8e73f-d200-4a9f-be90-b3c59b8bb330/zm7470_tragedy_looper_rules.pdf)：卡表、摆台、每日顺序及 First Steps。
- [原版 Mastermind's Handbook](https://images-cdn.zmangames.com/us-east-1/filer_public/d2/1b/d21bf5e1-0661-4d8d-aa02-369b4204b7db/en-tragedylooper-masterbook_lowrez.pdf)：印刷页 17／21 两个教学剧本及教学技能总表。
- 出版商旧链接在开发时返回 502，核对使用 [Player's Handbook PDF 镜像](https://cdn.1j1ju.com/medias/4a/87/06-tragedy-looper-rulebook.pdf)、[规则文本](https://www.rulespal.com/tragedy-looper/rulebook) 和 [原版 Mastermind's Handbook 镜像](https://manuals.plus/m/3119e3122d8f6207274caacd4b33eed98af18d38b7a3dcd42f45e8c562154240)。不随应用打包规则书全文或官方美术。
- [Prevailing Secrecy 结构化资料](https://tragedy-looper.github.io/script/overview/?title=%22Prevailing+Secrecy%22)，以及其 [公开源数据](https://github.com/Tragedy-Looper/tragedy-looper.github.io/tree/master/data/base-game)：仅选用原版同名条目，不使用 `(NT)` 条目；该站警察技能已经修订，不能用它覆盖原版技能。

核对结果：

| 项目       | The First Script                                           | Prevailing Secrecy                                                                                             |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 默认／挑战 | 3／2 轮回                                                  | 4／3 轮回                                                                                                      |
| 每轮天数   | 4                                                          | 5                                                                                                              |
| 主线       | Murder Plan                                                | A Place to Protect                                                                                             |
| 支线       | Shadow of the Ripper                                       | An Unsettling Rumor                                                                                            |
| 关键人物   | Girl Student                                               | Doctor                                                                                                         |
| 事件真凶   | Day 2 Murder → Office Worker；Day 3 Suicide → Girl Student | Day 1 Increasing Unease → Shrine Maiden；Day 3 Hospital Incident → Boy Student；Day 5 Faraway Murder → Patient |

身份逐项记录在独立剧本 JSON 中。初始布局按角色卡印刷起点保存：Hospital 医生／病人；Shrine 巫女；City 上班族／警察；School 男女学生。禁止地点：巫女不能进入 City，上班族不能进入 School，病人初始不能离开 Hospital。没有自行指定新的“官方摆台”。原版每轮回重置不另行重置领袖，保留上一日移交后的领袖；初局默认 P1。

行动卡可以合法打在地点上作虚张声势（无效果）。即使某张移动卡单独指向禁止地点，也允许出牌：双方移动会合并，最终方向才决定移动是否被取消。这避免错误禁止能与对方移动卡合成合法移动的出牌。多名主人公的禁止密谋跨目标全局相互抵消。

## 数据、状态与秘密

- `src/data/schema.json`：JSON Schema Draft 2020-12 完整 bundle schema，`$defs` 覆盖所有独立文件对象。`goodwillRequired` 表示需求，不使用易误导的 `goodwillCost`。
- `src/data/*.json`、`src/data/scripts/*.json`：地点、角色、身份、剧情、事件、卡牌及剧本；修改现有机制下的剧本无需改 UI。
- `src/state/`：牌局状态与卡牌实例、阶段、卡牌结算、能力、事件、胜负、持久化分别实现。
- `src/components/`：地图、人物、选牌、结算、事件清单、推理矩阵和 GM 暗箱。
- 卡牌实例键为 `owner:cardId:copyNumber`，GM 与 P1／P2／P3 各自独立。技能键为 `source:abilityId`，同时保存每天／每轮回使用记录。
- `localStorage['tragedy-looper.save']` 保存完整状态，版本为 1。每次选择、锁定、计数器修改、结算与阶段变化均保存。GM 解锁状态只在内存；关闭、后台、刷新均遮蔽，公开界面不生成隐藏身份映射或未亮 GM 卡牌。
- 读取损坏、未知版本、结构错误时阻止新局覆盖，提供原始导出、有效 JSON 导入及明确清除；配额／写入失败在界面提示，允许导出内存牌局。当前是首个存档版本；未来未知版本明确拒绝，不尝试有损降级。
- 防窥二次确认**不是安全权限**。全部剧本、秘密与存档都在单设备前端，可通过开发工具查看。历史公开效果，但不会记录隐藏能力来源；推理笔记不会自动公开真实身份。

本版属于 GM 主持、提示与确认的线下数字化桌面。GM 对事件目标、死亡防护、可选技能及是否使用能力负责。不会在未点击确认时擅自触发事件或判定剧情胜负。

## 测试

在仓库根目录运行：

```sh
node --test tragedy-looper/src/tests/*.test.js
python tragedy-looper/src/tests/schema.py
node tragedy-looper/src/tests/browser.cjs
node tragedy-looper/src/tests/full-games.cjs
```

Schema 测试需要 Python `jsonschema`；浏览器测试需要 Playwright、Chromium 和前述 HTTP 服务。可用 `TEST_URL`、`PLAYWRIGHT_PATH`、`CHROMIUM_PATH` 指定测试环境。测试依赖不属于静态 App，也不需部署。

浏览器验收包括两步真实选牌、秘密刷新恢复、分组结算恢复、事件／技能确认、死亡与回溯、存档损坏／导入／配额失败、360／390／768／1440 宽度、根 Service Worker 及大厅加 15 个游戏共 16 个入口的断网打开。另经真实 UI 分别完成两个剧本的完整 4／5 天轮回与终局刷新。

现有合集继续使用原 GitHub main → EdgeOne 发布流程，无新增部署服务。所有游戏资源使用相对入口 URL，适配目标子路径。

原作：BakaFire；Tragedy Looper / 惨劇RoopeR。非官方线下辅助实现。
