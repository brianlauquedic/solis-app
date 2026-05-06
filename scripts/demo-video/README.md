# scripts/demo-video — Automated 3-min Colosseum demo video

End-to-end pipeline that produces `dist/sakura-demo-3min.mp4` for the
Colosseum Frontier 2026 submission, with no human screen-capture
required.

**Honest framing.** This is the AI-generated path. It's reproducible,
deterministic, and free of API-key dependencies — but the result will
look more synthetic than a human-narrated recording (uniform mouse
pacing, neural-TTS voiceover). The repo includes a parallel live-
recording shot list at [`docs/DEMO_SHOT_LIST.md`](../../docs/DEMO_SHOT_LIST.md)
for that path.

## Architecture

```
voiceover.txt ──[generate-voiceover.sh]──► dist/voiceover.mp3 + dist/timings.json
                                                                       │
                                                                       │ (per-shot
                                                                       │  start/dur)
                                                                       ▼
record-browser.ts ──[Playwright recordVideo]──► dist/browser.webm ──┐
terminal.tape ─────[vhs]──────────────────────► dist/terminal.mp4 ──┤
closing-card.sh ───[ffmpeg drawtext]──────────► dist/closing-card.mp4─┤
                                                                      │
                              [ffmpeg overlay + audio mux + H.264]    │
                                                                      ▼
                                            dist/sakura-demo-3min.mp4
```

## Tooling

| Tool | What it does | Install |
|---|---|---|
| `edge-tts` (Python) | Free Microsoft Edge neural TTS | `pip install --user edge-tts` |
| Playwright + Chromium | Programmatic browser recording | `npm install -D playwright && npx playwright install chromium` |
| `vhs` (charm.sh) | Programmatic terminal recording | `brew install vhs` |
| `ffmpeg` | Video composition | `brew install ffmpeg` |

## Per-shot composition (per `dist/timings.json`)

| Shot | Time | Source | Voiceover beat |
|---|---|---|---|
| INTRO | 0:00–0:15 | `browser.webm` (sakuraaai.com hero) | "where every other approach lets it land — Sakura reverts" |
| SHOT-1 | 0:15–0:38 | `browser.webm` (`/?demo=true` IntentSigner flow) | "user signs one sentence; seven private values fold into a 32-byte commitment" |
| SHOT-2 | 0:38–1:08 | `terminal.mp4` (vhs runs `e2e-intent-execute.ts`) | "six checks land atomically; 204k CU on-chain" |
| SHOT-3 | 1:08–1:32 | `browser.webm` (Solscan tx view) | "proof + DeFi action share a single atomic v0 tx" |
| SHOT-4 | 1:32–1:48 | `browser.webm` (back to app, ActionHistory) | "user sees what their agent did. Always." |
| SHOT-5 | 1:48–2:18 | `closing-card.mp4` (ffmpeg drawtext) | "$33M of agent losses → structurally impossible" |

## Run end-to-end

```bash
bash scripts/demo-video/build.sh
```

Wall-clock: ~3 min (browser recording dominates).

## Run individually

```bash
# Just regenerate voiceover (e.g. you edited voiceover.txt)
bash scripts/demo-video/generate-voiceover.sh

# Just rerun browser recording
npx tsx scripts/demo-video/record-browser.ts

# Just rerun terminal capture
vhs scripts/demo-video/terminal.tape

# Just rerender closing card
bash scripts/demo-video/closing-card.sh

# Just recompose final MP4 from cached pieces
SKIP_VOICEOVER=1 SKIP_BROWSER=1 SKIP_TERMINAL=1 SKIP_CLOSING=1 \
  bash scripts/demo-video/build.sh
```

## Customizing

### Voiceover language / voice

Default: `en-US-AriaNeural` (clear, professional). Override:

```bash
VOICE=en-US-JennyNeural bash scripts/demo-video/generate-voiceover.sh
# Or for Japanese:
VOICE=ja-JP-NanamiNeural bash scripts/demo-video/generate-voiceover.sh
# (translate voiceover.txt first)
```

List all voices:

```bash
~/Library/Python/3.12/bin/edge-tts --list-voices | grep en-US
```

### Voiceover pacing

```bash
RATE=-15% bash scripts/demo-video/generate-voiceover.sh   # 15% slower
RATE=+10% bash scripts/demo-video/generate-voiceover.sh   # 10% faster
```

### Solscan tx (SHOT-3)

The recorder defaults to a known successful Sakura devnet tx. Override
with a fresher one if available:

```bash
SOLSCAN_TX=<sig> npx tsx scripts/demo-video/record-browser.ts
```

Find recent successful txs:

```bash
curl -sS https://api.devnet.solana.com -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSignaturesForAddress","params":["AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp",{"limit":5}]}' \
  | jq -r '.result[] | select(.err==null) | .signature' | head -1
```

### Headed Chromium (debug)

```bash
HEADLESS=false npx tsx scripts/demo-video/record-browser.ts
```

## Limitations

- **Mouse pacing is uniform.** Playwright clicks at exact intervals.
  Judges who watch many AI-generated videos may identify it as such.
- **No real Phantom popup.** Sakura's `?demo=true` mode renders a
  deterministic mock signature; the recording uses that path.
- **Solscan tx is from a prior e2e run**, not generated during recording.
  This is by design — it keeps the visual deterministic and avoids
  showing a "loading…" state on Solscan during recording.
- **`dist/` is git-ignored.** All built artefacts live there; commit
  only the source scripts + voiceover.txt.

## Output spec

- Container: MP4
- Codec: H.264 (libx264), CRF 22, preset medium
- Resolution: 1920x1080
- Frame rate: 30 fps
- Audio: AAC 128 kbps
- Duration: ~138s (well under Colosseum's 3-min cap)
- Size: ~10–25 MB typical
- `+faststart` for streaming-friendly playback
