# Project context

## Goal

Describe the desired outcome and who uses it.

## Scope

- In scope: 用 JSON 管理画卡、批量导入、开发阶段数据校验。
- Out of scope: 后台管理系统、数据库、复杂 UI 和玩法改造。

## Constraints

- Platforms, data sources, privacy requirements, and non-negotiable choices.

## Key decisions

| Date | Decision | Reason |
| --- | --- | --- |
| YYYY-MM-DD | Initial repository structure | Makes cross-device work easy to resume |
| 2026-09-21 | 画卡统一存放于 `data/cards.json`，图片使用 `assets/cards/card_NNN.webp` | 新增画卡只改数据，不改游戏核心代码 |

## Verification

`node scripts/validate-cards.js` 已验证现有 5 张画卡全部通过。网页通过 HTTP 服务读取 `data/cards.json`，避免直接打开 HTML 时的 fetch 限制。
