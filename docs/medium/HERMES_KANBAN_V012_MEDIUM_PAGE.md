# Hermes Kanban v0.12: The 80M Desktop Integration Note

Hermes Kanban turns multi-agent work into a durable board instead of a temporary subagent call. A task is stored in `~/.hermes/kanban.db`, can be assigned to a named profile, and can survive restarts, retries, blocks, comments, and handoffs.

## What Changed

The new board gives Hermes a real coordination layer:

- Triage, todo, ready, running, blocked, and done states.
- Named profile assignment for specialist workers.
- Parent and child dependencies for staged workflows.
- Structured completion summaries and metadata for downstream agents.
- Comments and run history as the durable audit trail.
- Gateway-embedded dispatcher ticks that pick up ready tasks.

## Why It Matters

`delegate_task` is still useful for short, in-memory work. Kanban is the better shape when work needs to remain visible, be picked up by a named role, pause for human input, or carry context forward over multiple attempts.

For 80M Desktop, that means the app can now expose agent operations like a production board: open tasks, assign profiles, block work that needs input, complete with summaries, and keep the official Hermes notes one click away.

## 80M App Surface

The desktop implementation adds a native Kanban screen that talks to the installed local Hermes CLI:

- Loads boards, assignees, stats, and task columns.
- Creates new tasks with tenant, profile, workspace, runtime, priority, and skills.
- Opens a task drawer with comments, run history, and lifecycle actions.
- Nudges the dispatcher from the UI.
- Attaches the upstream plugin folder, release notes, docs, skill notes, and spec PDF as local references.

## Operating Notes

Ready tasks are claimed by the Hermes dispatcher, which normally runs inside `hermes gateway start`. A profile assigned to Kanban work should have the `kanban-worker` skill available. Orchestrator profiles can fan out child tasks and link dependencies with the `kanban-orchestrator` guidance.

The app keeps the upstream plugin code vendored for review, but uses the local Hermes CLI and `kanban.db` contract at runtime so it follows the user's installed Hermes environment.
