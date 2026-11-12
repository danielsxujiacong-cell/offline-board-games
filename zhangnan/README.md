# 张楠问答

入口：<https://games.danielxu.cn/zhangnan/>。本仓库直接维护，原生 HTML/CSS/JavaScript，无安装、构建、API Key 或后端；沿用 GitHub `main` → 既有 EdgeOne 静态发布，不增加托管项目或修改 DNS。

## 文件与维护

- `index.html` / `style.css`：奶油白、淡紫色小舞台及手机布局，输入区跟随 VisualViewport 和安全区域。
- `data.js`：经典问答、三批快捷问题和点击反馈。香蕉问答为用户提供的真实例子，其他内容为创作的风格句式。
- `engine.js`：独立回复引擎，`ZhangnanEngine.createReplyEngine({ recent }).answer(question)` 返回 `{ answer, category }`。按味道、原因、做法、时间、地点、天气、选择等问题类型匹配，提取对象或动作，并避开最近的回复。
- `app.js`：串行提问队列（最多另排 5 个）、逐字回答、历史、重开、输入法保护和离线注册。重开用会话编号取消旧异步流程；动画没有按提问增加 interval。
- `assets/character.webp`：用户定稿的紫灰短发、深色日系学院穿搭 Q 版角色。
- `assets/blink.webp` / `assets/talk.webp`：生成的闭眼及开口表情。CSS 羽化蒙版只取眼睛／嘴部，头和身体使用独立裁剪层；待机眨眼与呼吸、思考歪头、回答嘴型、点击反馈均真实实现。换素材需同时校准 `style.css` 的蒙版坐标和 HTML 中的头／身体 clipPath。不要只换一张图并宣称完成动画。

回复是**纯前端规则与句式生成**，没有接入大模型，没有真实多轮语义理解。以后接 AI 时保留引擎接口，将联网请求单独实现，不将 API 或私密请求加入 Service Worker 缓存。

## 记录与隐私

已完成问答存入当前浏览器的 `localStorage['zhangnan-chat-v1']`（版本 1），最多保留最近 100 组；刷新恢复最后一组，历史面板可查看。排队和未完成问题仅存内存，刷新取消。无账号、上传或跨设备同步。存储不可用时仍可玩；“重新聊聊”经确认后清空该设备的问答记录并取消队列。所有输入通过 `textContent` 显示。

发布素材均为生成的卡通衍生图；私人参考照片未复制进仓库。WebP 仅做发布编码压缩，原始生成文件留在云端工作区。截图、日志和临时浏览器配置在被忽略的 `.openai/zhangnan/`，不提交。

## 本地预览与验证

从仓库根目录启动：

```sh
python -m http.server 8080
node --test tests/zhangnan.test.mjs
node tests/zhangnan-browser.cjs
```

浏览器测试复用现有 Playwright（可设 `PLAYWRIGHT_PATH`）、Linux 系统 Chromium / Windows Edge；`TEST_BROWSER_PATH` 指定可执行文件，`TEST_URL` 指定 HTTP 根地址。覆盖真实发送、快捷问题、三条连续排队、IME、历史刷新、重开与取消旧回答、实际表情层和恒定动画数量、长问题、文本注入、320/390/768/1440px、横屏、模拟键盘、减少动态效果，以及 HTTP Service Worker 下大厅和全部实际游戏入口的 Network Offline 导航。

代码更新后递增根 `service-worker.js` 的 `CACHE_NAME`，保留其他游戏的资源列表和逻辑。新增文件同步加入预缓存；入口维护在根 `index.html`，SEO 地址在 `sitemap.xml`。**不运行 `sync-games.ps1`。**

自动化设备模拟不等于实体 iPhone / Android 键盘与触屏验收；请在实际手机打开正式地址检查手感。
