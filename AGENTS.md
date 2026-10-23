# AGENTS.md

For architecture, conventions, commands, and project notes, see [`CLAUDE.md`](./CLAUDE.md).

This file exists for Codex compatibility and is intentionally a thin pointer.
Both Codex and Claude agents should follow `CLAUDE.md` as the single source of
truth — that's where the offline data pipeline, the shared `src/core/` rules
(DOM-free, `.ts` imports), and the render-on-demand renderer notes live.
Updating those rules in two places drifts; keep one.
