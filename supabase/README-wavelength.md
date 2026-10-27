# 电波同步双人联机

复用现有 **lanlan-cloud-pet / vjqsorzsilxblufpdxxc**，未创建新项目，也未更改其他应用的表、RPC、策略或 Auth 设置。原项目已经开启匿名登录。

## 访问与规则

- 同屏传递：`/wavelength/`。
- 双人联机：`/wavelength/online/`，首页有联机入口。
- 房主选昵称与话题，创建房间，把10位房间码/链接发给搭档；双方准备后房主开始。
- 6回合、24分制，轮流出题；服务端从345题中洗牌抽题。换题不换靶心，自定义端点可用。
- 出题人按住看靶心并发送必填线索；对方提交整数位置，服务端计算得分。双方都确认后才继续。
- 战报可以导出PNG图片与打印/PDF。重开需房主发起、搭档同意，再重新准备。
- 房间24小时有效。离开网页/掉线不退出；原浏览器保留身份及房间ID，返回可继续。主动退出关闭双方房间。清理浏览器身份或换设备后，不能仅凭邀请冒充原玩家。

## 隔离与并发

新增 `wavelength_rooms`（权威完整状态）、`wavelength_player_views`（本人投影）、`wavelength_commands`（请求幂等）、`wavelength_rate_limits`（每身份每分钟90次上限）。四表启用RLS。

浏览器对完整状态、命令、限流无读写权限；只对本人投影有SELECT。匿名Auth属于authenticated角色，策略另外核对`auth.uid() = user_id`和有效期，绝非所有authenticated用户都能看所有房间。完整靶心和剩余题序永不进入接收员的HTTP或Realtime负载；发送线索后，发射员自己的投影也隐藏靶心，揭晓后双方可见。历史已揭晓靶心允许复盘。

`wavelength-api`开启JWT平台验证，并向Auth `/user`二次校验身份。输入仅接受动作白名单、请求UUID、期望版本与必要参数，不接受玩家编号、总分或客户端整局状态。`wavelength_commit`和限流RPC为仅service_role可执行的SECURITY INVOKER，原子行锁/CAS、请求指纹与幂等键和双方投影在同一事务更新。每身份最多3个未关闭有效房间。

Realtime只发布投影表，按本人UUID订阅，RLS过滤。客户端保留15秒后台补偿同步；收到同版本消息不重绘。准备/下一回合遇到版本冲突时，只在原局/原阶段仍适用的条件下重新提交该意图一次；其他动作要求玩家重新确认。网络响应丢失会用同请求UUID重试，未确认动作保留在当前标签页，可安全重试。

客户端只保存匿名Auth会话、房间ID和本人线索/猜测草稿；不把完整房间或未揭晓靶心持久化。服务密钥只在Edge环境。公开`config.js`仅含publishable key。默认CORS为正式站点与localhost开发端口8080/8091；可通过`WAVELENGTH_ALLOWED_ORIGINS`配置，不使用`*`。

SQL已通过工具在远端应用，版本为`20261026044421_wavelength_online`；不要重复应用或reset。原有策略摘要在迁移前后相同：`8c4fe0d00d4eb2b3479d2853e0fa5674`。

## 题库维护

题库源文件仍为`wavelength/questions.json`。手动commit仅此文件，会更新同屏模式。**联机权威题库由服务端部署版本决定**，更新联机题库需先运行下方build复制题库，再单独部署`wavelength-api`。两端题库逐字一致的测试可防止漏同步。

## 开发与验证

本次复用G盘已有SDK、CLI和测试依赖，未新装大型依赖。前端复用仓库内已固定版本的Supabase JS 2.118.0（MIT），不加载CDN，也不修改花见小路SDK。

```powershell
$env:WAVELENGTH_TOOLS='G:\_Codex project\02_Game\offline-board-games\.openai\hanamikoji-tools\node_modules'
node scripts/wavelength-build.mjs
node --test tests/wavelength-online.test.mjs
python -m http.server 8091 --bind 127.0.0.1
# 另一终端，PLAYWRIGHT_PATH指向已有Playwright
node tests/wavelength-online-browser.cjs
node tests/wavelength-browser.cjs
node tests/wavelength-report-browser.cjs
```

真实双浏览器验收用真实Supabase匿名身份、Edge接口、RLS和WebSocket，关闭15秒补偿同步以证明实时更新。它会创建测试房间，最后退出关闭房间；不自动以管理员身份删除匿名用户。设置`TEST_URL=https://games.danielxu.cn`可在正式前端复验。

安全顾问对三个纯服务端表提示[启用RLS但无客户端策略](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)是预期拒绝访问；投影表[允许匿名Auth](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)符合本游戏游客模式，仍通过UUID隔离。未修改项目其他应用既有顾问项。新建索引的unused INFO无需为消除提示而删除。

官方文档核对：[Edge授权](https://supabase.com/docs/guides/functions/auth-headers)、[匿名身份](https://supabase.com/docs/guides/auth/auth-anonymous)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。2026-10-26查阅changelog及相关TLS/PG更新；本实现使用现代浏览器HTTPS、原生fetch和无扩展SQL，不依赖旧TLS、ltree或旧加密。
