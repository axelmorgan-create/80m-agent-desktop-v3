# Hermes v0.12+ Desktop Feature Plan

Date checked: 2026-05-06
Profile refresh checked: 2026-05-08

## Current Baseline

- Local desktop source repo: `/home/falcon/Apps/code/80m-agent-desktop`.
- Packaged runtime folder: `/home/falcon/Apps/80m-agent-desktop/80mAgentControl-linux-x64`.
- Installed Hermes was `Hermes Agent v0.12.0 (2026.4.30)` at the first audit.
- Current local Hermes for the profile-refresh pass is
  `Hermes Agent v0.13.0 (2026.5.7)`, with the CLI reporting additional upstream
  commits available via `hermes update`.
- Local gateway is running and `/health`, `/v1/capabilities`, and `/v1/models` respond.
- API capabilities currently exposed locally include Chat Completions, Responses API, streaming, Runs API, run events SSE, run stop, tool progress events, and `X-Hermes-Session-Id`.
- Desktop bridge surface is broad: Electron preload, preload types, and Tauri bridge currently expose the same 118 `window.hermesAPI` methods.
- Live `/v1/runs` verification passed on 2026-05-04: the API streamed `message.delta`, emitted `run.completed`, and returned a completed poll status.

## Implementation Status

- Done: desktop capability API for Hermes version, `/v1/capabilities`, `/v1/models`, Tool Gateway status, v0.12 gates, and update availability.
- Done: safe upgrade API that creates a Hermes backup, runs `hermes update --check`, then runs `hermes update`.
- Done: Curator command API for status, dry run, run, pause/resume, backup/rollback, pin/unpin, restore, plus report reading.
- Done: Runs API client methods for start, status, and stop.
- Done: Settings health UI for v0.12 readiness, API surface, Runs support, Tool Gateway eligibility, and backup-plus-upgrade.
- Done: Settings Curator tab with status, actions, skill pin/unpin/restore, and latest output/report.
- Done: Tools screen Tool Gateway eligibility banner.
- Done: primary desktop chat uses Runs events when `/v1/capabilities` reports Runs/event support, with Chat Completions/SSE kept as fallback.
- Done: desktop chat keeps the input active while a foreground run is busy. The
  renderer now supports FIFO queued follow-up turns, staged steer turns, and
  isolated background runs from either the busy-mode switcher or the `/queue`,
  `/steer`, `/background`, `/bg`, and `/btw` slash commands.
- Current Runs API boundary: Hermes chat docs support busy input modes
  `interrupt`, `queue`, and `steer`, plus `/background`; the current local
  `/v1/runs` API exposes run start/status/events/stop but not a native steer
  endpoint. Desktop therefore stages steer messages as the next foreground turn
  until upstream exposes a dedicated mid-run steering API.
- Done: renderer bundle no longer imports the heavy syntax-highlighter language registry.
- Done: Kanban task creation and assignment now normalize profile ids to Hermes'
  lowercase spawnable profile format. The desktop filters non-spawnable
  assignees out of task controls, auto-nudges the dispatcher after creating or
  assigning ready tasks, and surfaces dispatcher skip counts instead of silently
  doing nothing.
- Done: desktop agent/profile creation now follows the Hermes profile docs:
  creating from the app defaults to `hermes profile create <name> --clone
--clone-from <selected-profile>`, advanced calls can request blank,
  `--clone-all`, `--no-alias`, or `--no-skills`, and profile create/delete/active
  changes emit a `profiles-changed` event.
- Done: the app naturally discovers profiles made outside the app. Electron
  watches `~/.hermes/active_profile` and `~/.hermes/profiles`; renderer surfaces
  also refresh on focus/visibility and a fallback timer. Sidebar, Agents,
  Settings, and Kanban all refresh from `listProfiles()`.
- Done: native Tauri commands now cover the v0.12 capability/update APIs, Runs
  start/status/stop, Kanban board/task/dispatcher actions, voice STT/TTS, and
  custom window controls. Remaining Tauri fallbacks are lower-level desktop
  conveniences such as Tailscale mobile setup and workspace file watching.
- Done: Settings now has a shared profile-aware audit API and Overview tab for
  runtime/API/profile/tool-gateway/memory/cron/MCP/curator/Kanban status,
  grouped as Needs Attention, Behind Upstream, Ready, Optional Setup, and
  Plan-Gated. The same pass fixed backup/import to target the selected profile
  and choose a real archive path before `hermes import`.

## Verification Baseline

Run these before and after feature work:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run smoke:hermes
```

`npm run lint` is configured as a warning-first cleanup gate so active UI work is visible without blocking builds.

Kanban-specific checks:

```bash
hermes profile list
hermes kanban assignees --json
hermes kanban dispatch --json
hermes kanban show <task-id> --json
hermes kanban log <task-id>
```

If `dispatch --json` reports `skipped_nonspawnable`, the assignee is not a real
Hermes profile. Profile directories must be canonical lowercase ids such as
`prawnius`; title-cased folders such as `Prawnius` are ignored by Hermes v0.12's
worker spawner.

Profile-refresh checks:

```bash
hermes profile create desktop-smoke --clone --clone-from default
hermes profile list
hermes kanban assignees --json
hermes profile delete desktop-smoke --yes
```

The desktop should show the temporary profile in the sidebar switcher, Agents
screen, Settings profile list, and Kanban assignee controls without an app
restart.

## Hermes v0.12 Features To Surface

- Curator: `hermes curator status`, dry run, run, backup, rollback, pause/resume, pin/unpin, restore.
- Self-improvement visibility: show memory/skill update activity and curator reports without letting the UI silently mutate protected skills.
- Tool Gateway: detect Nous Portal subscription status and expose managed web, image generation, TTS, and browser automation only when available.
- Model/provider upgrades: first-class LM Studio, GMI Cloud, Azure AI Foundry, MiniMax OAuth, Tencent Tokenhub, and remote model catalogs for Nous Portal/OpenRouter.
- API server upgrades: prefer Responses/Runs for long jobs and structured progress; keep Chat Completions as fallback.
- Media and creative tools: Piper/local TTS, Spotify, Google Meet plugin, ComfyUI, TouchDesigner-MCP, and native multimodal image routing.
- Gateway/platform expansion: plugin-hosted messaging adapters, Yuanbao, and Teams plugin support.

## Implementation Phases

### Phase 0 - Upgrade And Capability Gate

1. Done: Add a `getHermesCapabilities` desktop API that calls `/v1/capabilities`, `hermes --version`, and `hermes status`.
2. Done: Add version/capability gates in the renderer so v0.12-only controls are hidden or marked unavailable on v0.11.
3. Done: Add a safe upgrade flow: run `hermes backup`, `hermes update --check`, then `hermes update`, with post-update doctor/smoke checks.

### Phase 1 - Health Dashboard

1. Done: Create a single health model for install, gateway, API server, model/provider, Tool Gateway, toolsets, profiles, memory, cron, MCP, Curator, Kanban, and optional integrations.
2. In progress: Surface actionable issues from `hermes doctor`: missing Tool Gateway subscription, optional tool keys, WhatsApp bridge audit, tinker-atropos, Skills Hub init.
3. Keep secrets masked and never render raw `.env` values.

### Phase 2 - Runs API Chat Runtime

1. Done: Keep current SSE chat path working.
2. Done: Add a Runs API client for long-running tasks: start run, stream `/events`, stop run, resume by run/session id.
3. Done: Route primary desktop chat to Runs events when Hermes supports it, with Chat Completions/SSE fallback.
4. Done: Render structured tool progress events and persisted assistant tool-call blocks instead of hiding tool activity behind short status labels.
5. Done: Persist request ids and session ids so switching sessions never cross-wires streaming output.
6. Done: Allow Codex-style busy input: foreground runs can keep working while
   follow-up messages queue, steering notes are staged for the next turn
   boundary, and background runs stream back into the visible conversation
   without taking over the foreground loading state.

### Phase 3 - Curator And Skills Control

1. Done: Add a Curator screen or Skills subtab with status, dry run, run now, pause/resume, backup/rollback, pin/unpin, restore.
2. Done: Show `logs/curator/run.json` and `REPORT.md` in the desktop UI.
3. Done: Protect hand-authored skills by making pinning explicit before enabling mutating curator workflows.
4. Done: Add v0.13 controls for archived skill listing, manual archive, and prune preview.

### Phase 4 - Tool Gateway And Toolsets

1. Done: Show Nous Tool Gateway eligibility from `hermes status`.
2. In progress: Add per-tool toggles for managed web, image generation, TTS, and browser automation.
3. Done: Keep direct API-key providers visible as fallbacks when Tool Gateway is unavailable.
4. Add browser private-url routing status so local dashboard testing and public browsing are understandable.
5. Done: Settings Overview distinguishes direct-key fallbacks from Nous Tool Gateway subscription gating.

### Phase 5 - Second Brain And Memory

1. Treat Hermes built-in memory as small, curated working memory.
2. Put large knowledge into Obsidian, session search, and external memory providers instead of bloating `MEMORY.md`.
3. Turn the current desktop memory-limit override into an explicit "Long Memory experimental mode" with warnings, or restore upstream-sized limits.
4. Add provider setup/status flows for Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, and Supermemory.
5. Done: Settings Overview shows active external memory provider state and links users to provider setup docs when built-in memory is the only active layer.

### Phase 6 - Schedules And Gateway Automations

1. Let users schedule from an existing session or prompt, preserving model/provider/session metadata.
2. Add delivery-target health checks for Discord and configured gateway platforms.
3. Add job run history, last output, and retry/disable controls.
4. Done: Settings Overview includes cron scheduler status and calls out v0.13 no-agent watchdog availability.

### Phase 7 - Performance And Packaging

1. Done: Reduce renderer bundle cost by removing the heavy syntax-highlighting registry from chat markdown rendering.
2. Keep Tauri and Electron bridge coverage tests strict.
3. Continue shrinking the remaining Tauri fallback/stub commands before making Tauri the default build.
4. Rebuild packaged artifacts only after source, build, smoke, and packaged launch checks pass.

## Key Risks

- Upstream Hermes memory limits are intentionally small; bypassing them in the desktop can cause prompt bloat or upstream rejection.
- Tool Gateway is subscription-gated, so the UI must distinguish "not configured" from "not included in account".
- v0.12 controls must remain capability-gated for older or remote Hermes installs even though the local default install is now v0.12.
- The repo currently has substantial uncommitted feature work; stage narrowly and avoid bundling unrelated edits.

## Primary References

- https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.30
- https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/curator/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/
