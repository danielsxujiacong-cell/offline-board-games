# 花见小路在线模式

本次只复用 `lanlan-cloud-pet` / `vjqsorzsilxblufpdxxc`（新加坡）。未创建项目。用户已授权上线，`hanamikoji-api` 已部署（JWT 验证开启），网页沿用 GitHub main → 现有静态托管链路。单机页继续在 `/games/hanamikoji/`，新增在线页 `/games/hanamikoji/online/`。

## 已实施的数据库变更

迁移 `migrations/20261025141024_hanamikoji_online.sql` 已通过连接工具应用；迁移历史版本与本地文件已对齐。最初用 CLI `migration new` 生成脚手架，远端应用工具分配实际版本后按返回版本对齐。不要重复执行、不要对已有项目运行 reset。

| 新对象 | 用途／浏览器权限 |
| --- | --- |
| `hanamikoji_rooms` | 完整权威状态；客户端无任何权限、不发布 Realtime |
| `hanamikoji_player_views` | 每位玩家一行，经裁剪仅含本人的私牌；客户端只有本人 SELECT 权限 |
| `hanamikoji_commands` | 玩家 UUID + 请求 UUID 唯一、请求摘要；仅服务端访问 |
| `hanamikoji_rate_limits` | 每身份每分钟 90 次，最多 3 个未结束有效房间；仅服务端访问 |
| `hanamikoji_commit` | Service-role-only、SECURITY INVOKER；行锁 + 版本 CAS + 幂等事务，同步写权威状态与双方视图 |
| `hanamikoji_rate_limit` | Service-role-only、SECURITY INVOKER；原子限流 |

四张表均开启 RLS；后三个服务端数据表没有客户端 policy 是有意拒绝一切客户端读写，不是漏配。Realtime 仅增加 `hanamikoji_player_views`，使用 Postgres Changes 的 SELECT RLS 逐用户过滤；没有新增开放 Broadcast/Presence，也没有改 `realtime.messages` 或全局公开通道配置。对手手牌、密约、取舍、牌库顺序和暗扣牌不会进入你的 HTTP 或 Realtime 视图。公开赠予／竞争的选项双方均可看见。

房间码 10 位（50 bit 随机空间），24 小时有效；仅是加入邀请，不是身份凭据。房主/来宾由已验证的 Supabase Auth UUID 绑定。服务端向 Auth `/user` 校验 JWT，不接受客户端玩家编号或整局状态。轮次、行动、牌 ID、选择、胜负均由共享规则引擎校验。所有写操作必须携带请求 UUID 和预期版本，重复请求不重复执行，过期版本返回 409 后客户端刷新。重开须房主发起、对手同意，再重新准备；任何玩家主动退出都会关闭房间并清除可见私牌。关页面或掉线不等于主动退出。

原有表、函数、policy 的定义摘要在迁移前后均为 `74f2f2223a66963cceaaa34d45568e0f`。远端执行 `tests/hanamikoji-verify.sql` 验证本人行、第三方隔离、写入/内部 RPC 禁止、幂等和 CAS；测试写入已回滚。外部匿名 REST 对完整表、视图和内部 RPC 请求均被拒绝（HTTP 401）。原 Realtime `two_rooms_boom_counter` 保留。已有其他功能的安全顾问警告未修改；本新增对象没有公开可执行的 SECURITY DEFINER。

## 生产配置与维护

用户已手动开启匿名登录与注册；真实 Supabase 匿名 Auth、受控接口及 Realtime 对局已通过验证。

1. 已在 [此项目认证设置](https://supabase.com/dashboard/project/vjqsorzsilxblufpdxxc/auth/providers) 开启 **Anonymous Sign-Ins**；同时允许 **Allow new users to sign up**。这属于项目范围的设置，匿名用户同样拥有 `authenticated` 角色；先确认已有应用允许新增匿名身份。没有改动现有策略/RPC 来绕过这些设置。
2. 已发布 `hanamikoji-api`。后续更新仅发布该函数，不省略函数名、不加 `--prune` 或 `--no-verify-jwt`：

   ```powershell
   .\.openai\hanamikoji-tools\node_modules\.bin\supabase.cmd functions deploy hanamikoji-api --project-ref vjqsorzsilxblufpdxxc --use-api
   ```

3. 服务端使用 Supabase Edge 内置的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。通常不需手动配置密钥；若运行环境缺少这些变量，只在服务端 Secret 中配置，绝不放入网页、URL 或聊天。前端 `config.js` 仅包含 publishable key。可选 `HANAMIKOJI_ALLOWED_ORIGINS` 是逗号分隔白名单，默认正式域名及 localhost/127.0.0.1:8080。其他开发端口需加入白名单；不要使用 `*`。
4. 不要只因为开启匿名登录就盲目更改 CAPTCHA/其他应用的认证设置。当前客户端未集成 CAPTCHA 组件；若项目开启强制 CAPTCHA，需先接入验证码 token 才能登录。Supabase Auth 自身限流与本游戏服务端限流均应保留。
5. 数据库迁移已完成，无需你手动执行 SQL。真实云端联调命令：`node --tls-max-v1.2 tests/hanamikoji-cloud.mjs --run`。本机 Node 默认 TLS 握手曾被网络重置，使用现代 TLS 1.2 可正常访问，并未关闭证书校验。该命令会创建两个真实匿名测试用户、关闭测试房间，但不会以 admin 身份删除用户。匿名身份丢失（清理本地数据/换设备）不能仅凭房间码找回，以免冒名顶替。

## 本地验收与构建

所有依赖和 npm 缓存在 G 盘 `.openai/`，没有安装 Docker、Deno 或大型运行环境。已安装 CLI 2.122.0、Supabase JS 2.118.0、esbuild 0.28.2、PGlite 0.5.11，精确依赖与锁文件在本目录 `hanamikoji-tools-package.json` / `hanamikoji-tools-lock.json`。

如将来需要重建工具目录（当前无需重复安装），在 G 盘项目根目录创建 `.openai/hanamikoji-tools/`，把上述两个文件分别复制为其中的 `package.json` / `package-lock.json`，执行 `npm ci --prefix .openai/hanamikoji-tools --cache .openai/npm-cache --no-audit --no-fund`。不要在 C 盘创建依赖目录。

```powershell
# 项目根目录
node scripts/hanamikoji-build.mjs
node --test tests/hanamikoji.test.mjs tests/hanamikoji-online.test.mjs
node tests/hanamikoji-online-browser.mjs
python -m http.server 8080 --bind 127.0.0.1
# 另一个终端，需要现有 Playwright 或通过 PLAYWRIGHT_PATH 指定已有包
node tests/hanamikoji-browser.cjs
```

构建只复制单机引擎到 Edge `_shared`（自动测试逐字相等），打包本地 SDK，并编译检查 Edge TypeScript 到忽略目录；不执行部署。Supabase 没有要求前端构建服务器，已生成浏览器静态产物。更新规则后必须重新运行 build，不能独立修改生成的共享引擎。SDK 已打包在 `games/hanamikoji/online/vendor/`，单机页不会加载它或发起 Supabase 请求。

无需开启云端 Auth 即可人工验收 UI/对局：

```powershell
node tests/hanamikoji-online-dev.mjs
```

打开 `http://127.0.0.1:8098/games/hanamikoji/online/`，在普通窗口和独立无痕窗口各开一份；每个浏览器身份不同。**这是明确的本地测试模拟器**：实际执行 PostgreSQL、迁移/RLS/RPC、服务端规则和浏览器 SDK，但 Auth 与 Realtime 传输为替身；只绑定 loopback，没有生产凭据，数据只存在此进程内存。不要部署此测试服务器。

实际结果：32 项单机+联机逻辑/SQL 测试通过；本地双浏览器 E2E 通过完整获胜对局、全部四行动、自己的 Realtime 投影、第三人拒绝、重开同意/拒绝、掉线重连、刷新恢复、丢失响应后的同请求重试一次、房主退出及 320/375/390 手机、横屏、桌面布局。原单机触屏套件及大厅/所有游戏 Network Offline 入口通过，无页面异常。真实 Supabase Auth/API/Realtime E2E 已通过：真实匿名身份、四行动、计分获胜、幂等、双方私有 Realtime、重连同步、重新开局和退出。生产 REST 适配器补充了 void RPC 空响应兼容与回归测试；同版本重复通知不再重绘牌面。可用 `node tests/hanamikoji-production-browser.mjs` 运行真实双浏览器联调，`TEST_URL` 可指定正式站点；其自动同步轮询被关闭以证明 WebSocket 更新生效。

安全顾问对三张权威内部表提示 [RLS 无客户端策略](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) 为 INFO，与拒绝客户端访问设计一致。其他原有项目警告不在本任务范围内，未改动。

官方核对：[匿名登录](https://supabase.com/docs/guides/auth/auth-anonymous)、[Edge 授权](https://supabase.com/docs/guides/functions/auth-headers)、[Postgres Changes 与 RLS](https://supabase.com/docs/guides/realtime/authorization#interaction-with-postgres-changes)。已查阅 2026-10-25 changelog；近期 TLS 升级及 server 框架适配器弃用不影响本实现的现代 HTTPS、原生 fetch 与默认 JWT 验证。
