# 损友审判庭

2026-10-23。按用户给定的「多数派陷阱 / 损友审判庭」方案实现，纯前端，无玩家设置、房间、数据库或线上投票。

## 规则
读题，按按钮倒数 3、2、1，同时指向在座一人（可指自己）。唯一最高票对象的支持者在线下各记 1 分；最高票并列则不计分。被指认者辩护后负责翻题，随时可跳过或休庭。结束时线下比较得分，同分共享胜利。

网页只提供题目、倒数、可选昵称受害次数和 PNG 战报。受害榜不是得分榜；平票可各记录一次，同一昵称同题不可重复记录，支持撤销本轮记录。进度与昵称仅写本机 localStorage，存储受限时仍可在当前页面玩。

## 题库与来源
100 道原创中文问题，四类各 25 题，按分类洗牌，不重复抽取。研究的是「谁最可能」同时指人机制；最初搜索到的 Herd Mentality 纸笔同答案规则不符合用户截图，未采用。

- https://www.rondovo.com/articles/most-likely-to-questions （同时指人、线下计分机制参考）
- https://toz-app.com/zh-Hans/blog/party-games/100-friends-whos-most-likely-to-questions （朋友局话题方向参考）
- https://toz-app.com/zh-Hans/blog/party-games/100-funny-whos-most-likely-to-questions （荒诞情景方向参考）

未批量复制来源题目；题库使用新写的中文情景。不是商业桌游的官方电子版。

## 维护
入口 /games/friend-court/，直接维护 index.html、styles.css、questions.js、app.js，无构建依赖。全站根 Service Worker v11 预缓存。测试：NODE_PATH 指向已有 Playwright 安装后运行 node games/friend-court/tests/browser.cjs，需要本地 HTTP 8080 和 Edge。GitHub main 经现有 EdgeOne 部署，不改变域名配置。
