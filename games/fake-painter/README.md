# 赝品画师

线下聚会桌游《赝品画师》的轻量网页 MVP。玩家在线下用纸笔作画，网页负责抽取画卡、隐藏评分标准和简单结算。

## Status

- **Stage:** complete MVP
- **Last updated:** 2026-09-21
- **Primary deliverable:** `index.html`

## Quick start

1. Open `index.html`, or run `python -m http.server 4173` in this folder.

```text
No dependencies or build step.
```

## 新增画卡

画卡数据在 `data/cards.json`，图片统一放在 `assets/cards/`，命名为 `card_001.webp`、`card_002.webp`……。批量新增时复制 `data/cards_batch_template.json` 为 `data/cards_batch.json`，填写标题、图片编号和 10 条 criteria，然后在项目根目录运行：

```text
node scripts/validate-cards.js data/cards_batch.json
node scripts/import-cards.js data/cards_batch.json
```

校验通过后，导入脚本会追加新卡、跳过已存在的 id，不覆盖原有画卡。网页请通过 HTTP 服务打开，例如 `python -m http.server 4173` 后访问 `http://localhost:4173`。

## Repository map

| Path | Purpose |
| --- | --- |
| `README.md` | Human overview and start point |
| `AGENTS.md` | Instructions for Codex working in this repository |
| `docs/PROJECT_CONTEXT.md` | Goals, constraints, decisions, and technical context |
| `docs/HANDOFF.md` | Current working state and next action |
| `CHANGELOG.md` | User-visible milestone history |
| `assets/` | Replaceable card placeholder images |
| `deliverables/` | Final shareable outputs, when applicable |

## Sync workflow

Before editing on either computer, inspect Git status and pull remote changes when the working tree is clean. Before handing off, update the relevant documentation, commit a descriptive change, and push it to GitHub.
