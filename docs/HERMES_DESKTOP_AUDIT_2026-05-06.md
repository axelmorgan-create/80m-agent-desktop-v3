# Hermes Desktop Audit - 2026-05-06

This repo's edit target is `/home/falcon/Apps/code/80m-agent-desktop`.
`/home/falcon/Apps/80m-agent-desktop` is the user handoff/runtime tree, and
`/opt/80m Agent Desktop` may be an older root-owned install.

## Sources Checked

- Official Hermes docs index: https://hermes-agent.nousresearch.com/docs/llms.txt
- API server docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- Gateway internals: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals
- Kanban docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban
- Upstream desktop repo: https://github.com/fathah/hermes-desktop

## Local Hermes Setup

- Hermes CLI is `Hermes Agent v0.12.0 (2026.4.30)`.
- Gateway is running through the user systemd service on `127.0.0.1:8642`.
- `.env` now explicitly contains `API_SERVER_ENABLED=true` plus an API server key.
- API smoke checks pass for `/health`, `/v1/models`, and `/v1/capabilities`.
- Capabilities expose chat completions, responses, Runs, run event SSE, run stop,
  tool progress events, and session continuity headers.

Do not print local config or environment secrets in audit output. Use masked
summaries for setup checks.

## Upstream Drift Fixed

Upstream `fathah/hermes-desktop` keeps install and startup light:

- sudo/password prompts are routed through a GUI askpass helper.
- install status does not block app startup on deep Python verification.
- verification runs lazily from the renderer after the UI is available.

This app now follows those patterns:

- `src/main/askpass.ts` provides the GUI askpass bridge.
- `runInstall()` receives the parent window and uses `SUDO_ASKPASS` on Linux/macOS.
- `checkInstallStatus()` is fast; `verifyInstall()` runs asynchronously.
- Renderer startup bounces back to setup only if lazy verification fails.
- Electron preload and Tauri bridge both expose `verifyInstall()`.

## Tauri Parity Fixed

The renderer had Tauri calls that were not registered natively. The bridge scan
now reports zero missing commands.

Native commands were added for:

- document preview and editable text/markdown/json/yaml saves
- workspace file watching via `workspace-file-changed`
- Obsidian vault get/set and vault counts
- Hermes Curator actions and report reads
- Tailscale mobile status/token commands

Tailscale mobile serving is still intentionally limited in Tauri: Electron owns
the mobile companion HTTP server today. The Tauri commands report that limitation
instead of pretending the server exists.

## Verification Gates

Run these after Hermes runtime or shell bridge changes:

```bash
npm run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
npm run lint
npm run test
npm run build
npm run smoke:hermes
npm run smoke:hermes:chat
npx electron-builder --dir
```

After rebuilding, sync the handoff runtime and compare app hashes:

```bash
rsync -a --delete dist/linux-unpacked/ /home/falcon/Apps/80m-agent-desktop/80mAgentControl-linux-x64/
ln -sf 80m-agent-desktop /home/falcon/Apps/80m-agent-desktop/80mAgentControl-linux-x64/80mAgentControl
sha256sum dist/linux-unpacked/resources/app.asar /home/falcon/Apps/80m-agent-desktop/80mAgentControl-linux-x64/resources/app.asar
```

The root-owned `/opt/80m Agent Desktop` install must be updated separately if
the user launches that copy.

## Remaining Environment Issues

`hermes doctor` still reports setup issues outside this app:

- Google/Gemini API key is invalid.
- `tinker-atropos` exists but is not installed.
- Optional tool/provider keys are missing for full tool access.
- Skills Hub has not been initialized.
- No GitHub token is configured for higher GitHub API rate limits.
