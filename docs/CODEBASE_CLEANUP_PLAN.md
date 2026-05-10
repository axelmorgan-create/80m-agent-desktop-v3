# 80m Agent Desktop Codebase Cleanup Plan

This plan keeps the current aesthetic and shipped components intact while making
the codebase easier to navigate, review, and release.

## Non-Negotiables

- Preserve the 80m visual language: borderless shell, ATM glow, compact icon
  controls, layered chat workspace, Second Brain motion, and readable themes.
- Keep source edits in `/home/falcon/Apps/code/80m-agent-desktop`.
- Treat `/home/falcon/Apps/80m-agent-desktop/80mAgentControl-linux-x64` as a
  packaged handoff target, not source.
- Verify meaningful renderer changes with `npm run build` before packaging.
- Do not move runtime behavior and visual polish in the same refactor unless the
  behavior is already covered by a build or smoke check.

## Phase 0: Completed In This Cleanup Pass

- Split the monolithic renderer stylesheet into ordered modules under
  `src/renderer/src/assets/styles/`.
- Kept `src/renderer/src/assets/main.css` as the cascade manifest so the shipped
  look stays stable.
- Extracted the chat conversation toolbar and split/tab workspace out of
  `Layout80m.tsx` into `ConversationWorkspace.tsx`.
- Moved conversation tab/session state into `conversations.ts`.
- Split the active 80m Settings surface into focused tab panels under
  `src/renderer/src/components/80m/Settings*Panel.tsx`.
- Moved window/external-link IPC, updater IPC, and Hermes profile watching out
  of `src/main/index.ts`.
- Preserved all existing IPC channel names while creating clearer main-process
  ownership boundaries.
- Removed the dead legacy renderer shell under `src/renderer/src/screens/Layout`
  plus the older Chat, Agents, Office, and Settings screens it alone referenced.
- Split main-process IPC registration into focused modules for runtime,
  workspace, profile data, chat, automation/Kanban, browser, window controls,
  updater, and profile watching.
- Split preload construction so `src/preload/index.ts` is only the context
  bridge entrypoint and `src/preload/hermes-api.ts` owns the exposed API map.
- Moved Hermes capabilities and run-status helpers into `src/main/hermes-runs.ts`
  while keeping `src/main/hermes.ts` focused on chat transport and gateway
  lifecycle.

## Phase 1: Renderer Boundaries

- Continue shrinking `Layout80m.tsx` until it only coordinates shell state,
  view routing, preview docking, and splash/portal transitions.
- Keep preview resizing in `useAgentPreviewDock`.
- Move avatar intro and Second Brain portal timing into hooks with clear return
  values.
- Keep feature screens under `src/renderer/src/screens/<Feature>/` and shared
  shell controls under `src/renderer/src/components/80m/`.

## Phase 2: Shared UI Primitives

- Create small shared controls for repeated icon buttons, segmented toggles,
  compact toolbars, screen headers, and empty states.
- Replace duplicated button markup in chat, Memory, Tools, Settings, and Kanban
  with those primitives.
- Keep class names stable during the first pass so the existing CSS modules can
  continue to carry the visual language.

## Phase 3: Feature Screen Refactors

- Continue shrinking `Settings.tsx` by moving API loading/saving effects into a
  `useSettingsState` hook.
- Split `Memory.tsx` into vault indexing, neural dashboard, provider settings,
  and entry list modules.
- Split `Kanban.tsx` into board data, task cards, filters, and worker actions.
- Split `Messages.tsx` into markdown rendering, tool-call rendering, transcript
  state, and message actions.
- Next renderer targets: split `Memory.tsx`, `ChatArea.tsx`, `Kanban.tsx`, and
  `Schedules.tsx` by state hooks, command actions, and presentation components.

## Phase 4: Main Process And IPC

- Continue grouping main-process services by responsibility inside the remaining
  oversized domain files: `installer.ts`, `desktop-services.ts`,
  `settings-audit.ts`, `claw3d.ts`, and `kanban.ts`.
- Keep IPC channel names stable and document new channels at the boundary where
  preload exposes them.
- Prefer typed request/response helpers over ad hoc payloads when adding new
  renderer-to-main calls.
- Next highest-value backend extractions: split installer doctor/update/backup
  helpers, and tighten the preload API return types currently asserted from the
  existing `HermesAPI` contract.

## Phase 5: Verification And Release Discipline

- Gate renderer refactors with `npm run typecheck` and `npm run build`.
- Run Hermes smoke checks when runtime, profile, Kanban, or chat transport code
  changes.
- Refresh the packaged handoff folder after user-visible renderer changes so the
  launcher does not show stale UI.
- Before a public release, confirm version metadata, build Linux assets, publish
  the GitHub release, and verify attached assets.
