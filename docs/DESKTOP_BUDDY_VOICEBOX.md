# Desktop Buddy Voicebox

The desktop buddy TTS path prefers a local Voicebox profile before falling back
to the existing Hermes/Edge TTS chain.

## Release Behavior

The Desktop Buddy is bundled with the desktop app. On first launch after this
release, the app opens the buddy once and writes a small marker into Electron
user data so clients know it is installed and available. After that, clients can
open or close it from the sidebar buddy control.

The buddy window includes:

- Packaged GLB model and SVG face overlay.
- Idle eye tracking against the desktop cursor.
- Collapsible clipped controls for chat focus, mic/STT, and close.
- Cortex clipper reactions for `Linked`, `Ingesting`, `Saved`, and
  `Clip failed`.

## Local Voicebox Profile

- Profile name: `80M Desktop Buddy`
- Voicebox client id: `80m-desktop-buddy`
- Engine: `kokoro`
- Preset voice: `am_puck`

The local profile is stored in `/home/falcon/Apps/code/voicebox/data/voicebox.db`
and includes a subtle effects chain for a brighter, compact buddy voice.

## Run Voicebox

```bash
cd /home/falcon/Apps/code/voicebox
VOICEBOX_MODELS_DIR=/home/falcon/.cache/huggingface/hub backend/venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 17493
```

Health check:

```bash
curl http://127.0.0.1:17493/health
```

## Desktop App Overrides

The Electron main process reads these optional environment variables:

- `VOICEBOX_URL`, default `http://127.0.0.1:17493`
- `VOICEBOX_PROFILE`, default `80M Desktop Buddy`
- `VOICEBOX_CLIENT_ID`, default `80m-desktop-buddy`
- `VOICEBOX_ENGINE`, default `kokoro`
- `VOICEBOX_DISABLED=1` to force the old fallback path

True cloned voices should only be created from a consented reference sample.
