# Vendored Hermes Kanban Plugin

Source: `NousResearch/hermes-agent/plugins/kanban`

Imported from upstream commit `50ab0a85a7472017a26abd7794103ddffed3d450` on 2026-05-05.

This folder is kept as a reference copy of the upstream dashboard plugin assets:

- `dashboard/manifest.json`
- `dashboard/plugin_api.py`
- `dashboard/dist/index.js`
- `dashboard/dist/style.css`
- `systemd/hermes-kanban-dispatcher.service`

The 80M desktop app does not execute this bundled plugin directly. The native app screen talks to the installed local Hermes CLI and database contract through `src/main/kanban.ts`, while this folder preserves the upstream implementation for GitHub review and future parity work.
