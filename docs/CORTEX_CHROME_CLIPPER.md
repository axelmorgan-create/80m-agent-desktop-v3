# Cortex Chrome Clipper

The source Chrome extension lives at:

```text
/home/falcon/Apps/code/80m-agent-desktop/extensions/cortex-clipper
```

Release builds bundle that source into Electron `extraResources`. On app
startup, 80M copies the extension into a stable user-data install folder and
the Settings > Mobile panel can open that folder for the client. This avoids
pointing Chrome at temporary AppImage mount paths.

Load it from Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose `Load unpacked`.
4. Select the local `cortex-clipper` folder opened by the desktop app.

Chrome does not allow a normal desktop app to silently force-install an
extension for unmanaged users. Official Chrome distribution paths are Chrome Web
Store installs, supported external installs, and managed enterprise policies:

- <https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions>
- <https://developer.chrome.com/docs/extensions/mv3/hosting>

The popup auto-connects to the local companion API and stores the pairing token
inside Chrome extension storage. Clients should only see a `Connected` state and
the `Save to Cortex` action; the token is not part of the normal UI.

Captured pages are posted to:

```text
POST http://127.0.0.1:8780/api/cortex/clip
```

The app writes the resulting Knowledge Knaight synthesis to the Obsidian-backed
Cortex folder:

```text
/home/falcon/obsidian-vault/cortex/web-clips
```

If a client setup uses a different local companion URL, open `Advanced`, change
the URL, and press `Save`. `Reset` clears the stored local token and reconnects.

## Desktop Buddy Feedback

The clip endpoint updates the Desktop Buddy during the ingest path:

- `Linked` when the extension auto-connects.
- `Ingesting` while Knowledge Knaight synthesis and note creation are running.
- `Saved` after the Markdown record lands in Cortex.
- `Clip failed` if the endpoint cannot parse, synthesize, or write the note.
