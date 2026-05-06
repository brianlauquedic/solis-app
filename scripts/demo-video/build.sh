#!/usr/bin/env bash
#
# build.sh — end-to-end pipeline that produces dist/sakura-demo-3min.mp4
# from the Sakura repo. Generates voiceover via Edge TTS, records the
# browser via Playwright, the terminal via vhs, the closing card via
# ffmpeg, and composes everything into a single H.264 MP4.
#
# Usage:
#   bash scripts/demo-video/build.sh                # full rebuild
#   SKIP_VOICEOVER=1 bash scripts/demo-video/build.sh   # reuse cached vo
#   SKIP_BROWSER=1 SKIP_TERMINAL=1 bash scripts/demo-video/build.sh
#                                                  # only rebuild compose
#
# Output: scripts/demo-video/dist/sakura-demo-3min.mp4

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

# ── Step 1 · voiceover ───────────────────────────────────────────────
if [ "${SKIP_VOICEOVER:-}" = "1" ] && [ -f dist/voiceover.mp3 ]; then
  echo "▶ step 1/5: voiceover [SKIPPED — using cached dist/voiceover.mp3]"
else
  echo "▶ step 1/5: generating voiceover via Edge TTS…"
  bash generate-voiceover.sh
fi

# ── Step 2 · browser recording (Playwright) ──────────────────────────
if [ "${SKIP_BROWSER:-}" = "1" ] && [ -f dist/browser.webm ]; then
  echo "▶ step 2/5: browser recording [SKIPPED — using cached dist/browser.webm]"
else
  echo "▶ step 2/5: recording browser via Playwright… (~140s wall-clock)"
  cd ../..
  npx tsx scripts/demo-video/record-browser.ts
  cd scripts/demo-video
fi

# ── Step 3 · terminal recording (vhs) ────────────────────────────────
if [ "${SKIP_TERMINAL:-}" = "1" ] && [ -f dist/terminal.mp4 ]; then
  echo "▶ step 3/5: terminal recording [SKIPPED — using cached dist/terminal.mp4]"
else
  echo "▶ step 3/5: recording terminal via vhs… (~35s wall-clock)"
  # vhs runs from the repo root because terminal.tape calls
  # `npx tsx scripts/e2e-intent-execute.ts`. The .tape's `Output` path
  # is relative to the repo root, writing directly to dist/terminal.mp4.
  cd ../..
  vhs scripts/demo-video/terminal.tape
  cd scripts/demo-video
fi

# ── Step 4 · closing card (ffmpeg) ───────────────────────────────────
if [ "${SKIP_CLOSING:-}" = "1" ] && [ -f dist/closing-card.mp4 ]; then
  echo "▶ step 4/5: closing card [SKIPPED — using cached dist/closing-card.mp4]"
else
  echo "▶ step 4/5: rendering closing card via ffmpeg…"
  bash closing-card.sh
fi

# ── Step 5 · compose final MP4 ───────────────────────────────────────
echo "▶ step 5/5: composing final MP4 via ffmpeg…"

# Read per-shot timings.
START_INTRO=$(python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='INTRO'][0]['start_sec'])")
START_S2=$(python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='SHOT-2'][0]['start_sec'])")
DUR_S2=$(python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='SHOT-2'][0]['visual_dur_sec'])")
START_S5=$(python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='SHOT-5'][0]['start_sec'])")
DUR_S5=$(python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='SHOT-5'][0]['visual_dur_sec'])")
TOTAL=$(python3 -c "import json; print(json.load(open('dist/timings.json'))['total_sec'])")

echo "  total: ${TOTAL}s · SHOT-2 overlay at ${START_S2}s (${DUR_S2}s) · SHOT-5 overlay at ${START_S5}s (${DUR_S5}s)"

# Speed-up the terminal video to fit within SHOT-2 budget (e2e wall-
# clock is ~60s but the SHOT-2 visual budget is ~30s; ratio ~2x).
TERM_REAL_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/terminal.mp4)
TERM_SPEED=$(python3 -c "print(round($TERM_REAL_DUR / $DUR_S2, 4))")
echo "  terminal.mp4 ${TERM_REAL_DUR}s → speedup ${TERM_SPEED}x to fit ${DUR_S2}s budget"

# Compose plan:
#  - Base layer: browser.webm (full 138s of browser footage)
#  - Overlay terminal.mp4 sped up by TERM_SPEED to fit SHOT-2 budget
#  - Overlay closing-card.mp4 starting at SHOT-5 start_sec, for SHOT-5 dur
#  - Audio: voiceover.mp3 (already aligned)
#  - Output: dist/sakura-demo-3min.mp4 @ 1080p, 30fps, H.264, CRF 22

ffmpeg -y -hide_banner -loglevel warning \
  -i dist/browser.webm \
  -i dist/terminal.mp4 \
  -i dist/closing-card.mp4 \
  -i dist/voiceover.mp3 \
  -filter_complex "
    [0:v]scale=1920:1080,setpts=PTS-STARTPTS,fps=30[base];
    [1:v]scale=1920:1080,setpts=(PTS-STARTPTS)/${TERM_SPEED}+(${START_S2}/TB),fps=30[term];
    [2:v]scale=1920:1080,setpts=PTS-STARTPTS+(${START_S5}/TB),fps=30[close];
    [base][term]overlay=enable='between(t,${START_S2},${START_S2}+${DUR_S2})':eof_action=pass[v1];
    [v1][close]overlay=enable='between(t,${START_S5},${START_S5}+${DUR_S5})':eof_action=pass[vout]
  " \
  -map "[vout]" -map "3:a" \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  -c:a aac -b:a 128k \
  -t "${TOTAL}" \
  -movflags +faststart \
  dist/sakura-demo-3min.mp4

DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/sakura-demo-3min.mp4)
SIZE_BYTES=$(stat -f %z dist/sakura-demo-3min.mp4 2>/dev/null || stat -c %s dist/sakura-demo-3min.mp4)
SIZE_MB=$(python3 -c "print(f'{$SIZE_BYTES/1024/1024:.1f}')")

echo ""
echo "✓ dist/sakura-demo-3min.mp4 — ${DUR}s, ${SIZE_MB}MB"
echo "  H.264 1080p · 30fps · CRF 22 · AAC 128k"
