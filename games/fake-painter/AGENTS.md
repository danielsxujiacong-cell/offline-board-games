# Project instructions

## Orientation

- Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/HANDOFF.md` before modifying the project.
- Keep `README.md` understandable to a non-technical reader; put detailed decisions and constraints in `docs/PROJECT_CONTEXT.md`.
- Treat `docs/HANDOFF.md` as the current work log. Update it whenever a task leaves meaningful follow-up work.

## Efficient execution

- Before acting, identify the requested outcome, scope, acceptance criteria, and constraints. Ask only for information that would materially change the result or create meaningful risk; otherwise make a reasonable assumption and state it.
- Begin with the smallest relevant read-only check. Stop once the available evidence is sufficient to answer or complete the task; do not browse, scan the entire repository, reread documentation, or create plans/subtasks without a task-specific reason.
- For defined, reversible, low-impact work, act concisely and run only meaningful verification. Expand investigation, planning, testing, or review for complex, uncertain, high-risk, destructive, or externally visible work.
- Keep stable rules here and dynamic state in `docs/HANDOFF.md`. Update README, CHANGELOG, PROJECT_CONTEXT, or HANDOFF only when their facts change; do not rewrite documentation for trivial edits.
- Final handoffs state only completed work, verification, and blockers or the next action.

## Git and delivery

- This repository is the source of truth across computers. Inspect `git status` first; when clean, synchronize before edits without discarding local work.
- Keep exactly one independent project per repository. Do not add unrelated files.
- Before a final handoff, review `.gitignore` and staged content for secrets, update documentation that changed, verify the project in proportion to the change, commit with a clear message, and push.
- Keep final user-facing deliverables under `deliverables/` when that fits the project. Keep source assets under `assets/`.

## Project-specific commands

Record setup, run, build, and test commands here once known.
