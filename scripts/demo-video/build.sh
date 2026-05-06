#!/usr/bin/env bash
#
# build.sh — end-to-end pipeline that produces dist/sakura-demo-3min.mp4
# (~170s, 1080p H.264 with burnt-in captions, 朱 cursor overlay,
# crossfades, color grade, and 9 audio-aligned shots).
#
# Usage:
#   bash scripts/demo-video/build.sh
#   SKIP_VOICEOVER=1 SKIP_BROWSER=1 SKIP_TERMINAL=1 SKIP_REVERT=1 \
#     SKIP_HOOK=1 SKIP_COMPARE=1 SKIP_CLOSING=1 SKIP_CAPTIONS=1 \
#     bash scripts/demo-video/build.sh   # only re-compose
#
# Output: scripts/demo-video/dist/sakura-demo-3min.mp4

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

# ── Step 1 · voiceover ───────────────────────────────────────────────
if [ "${SKIP_VOICEOVER:-}" = "1" ] && [ -f dist/voiceover.mp3 ]; then
  echo "▶ step 1/8: voiceover [SKIPPED]"
else
  echo "▶ step 1/8: generating voiceover via Edge TTS…"
  bash generate-voiceover.sh
fi

# ── Step 2 · captions ────────────────────────────────────────────────
if [ "${SKIP_CAPTIONS:-}" = "1" ] && [ -f dist/captions.srt ]; then
  echo "▶ step 2/8: captions [SKIPPED]"
else
  echo "▶ step 2/8: generating captions.srt…"
  bash generate-captions.sh
fi

# ── Step 3 · hook ────────────────────────────────────────────────────
if [ "${SKIP_HOOK:-}" = "1" ] && [ -f dist/hook.mp4 ]; then
  echo "▶ step 3/8: hook [SKIPPED]"
else
  echo "▶ step 3/8: rendering hook.mp4…"
  bash hook.sh
fi

# ── Step 4 · browser recording ───────────────────────────────────────
if [ "${SKIP_BROWSER:-}" = "1" ] && [ -f dist/browser.webm ]; then
  echo "▶ step 4/8: browser [SKIPPED]"
else
  echo "▶ step 4/8: recording browser via Playwright…"
  cd ../..
  npx tsx scripts/demo-video/record-browser.ts
  cd scripts/demo-video
fi

# ── Step 5 · terminal recordings ─────────────────────────────────────
if [ "${SKIP_TERMINAL:-}" = "1" ] && [ -f dist/terminal.mp4 ]; then
  echo "▶ step 5a/8: terminal [SKIPPED]"
else
  echo "▶ step 5a/8: recording terminal.mp4 via vhs…"
  cd ../..
  vhs scripts/demo-video/terminal.tape
  cd scripts/demo-video
fi
if [ "${SKIP_REVERT:-}" = "1" ] && [ -f dist/revert.mp4 ]; then
  echo "▶ step 5b/8: revert [SKIPPED]"
else
  echo "▶ step 5b/8: recording revert.mp4 via vhs…"
  cd ../..
  vhs scripts/demo-video/revert.tape
  cd scripts/demo-video
fi

# ── Step 6 · comparison table ────────────────────────────────────────
if [ "${SKIP_COMPARE:-}" = "1" ] && [ -f dist/comparison.mp4 ]; then
  echo "▶ step 6/8: comparison [SKIPPED]"
else
  echo "▶ step 6/8: rendering comparison.mp4…"
  bash comparison-table.sh
fi

# ── Step 7 · closing card ────────────────────────────────────────────
if [ "${SKIP_CLOSING:-}" = "1" ] && [ -f dist/closing-card.mp4 ]; then
  echo "▶ step 7/8: closing card [SKIPPED]"
else
  echo "▶ step 7/8: rendering closing-card.mp4…"
  bash closing-card.sh
fi

# ── Step 8 · final compose ───────────────────────────────────────────
echo "▶ step 8/8: composing final MP4 via ffmpeg…"

# Read per-shot timings.
read_shot() {
  local name="$1" field="$2"
  python3 -c "import json; t=json.load(open('dist/timings.json')); print([s for s in t['shots'] if s['name']=='$name'][0]['$field'])"
}

START_HOOK=$(read_shot HOOK start_sec)
DUR_HOOK=$(read_shot HOOK visual_dur_sec)
START_S1_5=$(read_shot SHOT-1.5 start_sec)
DUR_S1_5=$(read_shot SHOT-1.5 visual_dur_sec)
START_S2=$(read_shot SHOT-2 start_sec)
DUR_S2=$(read_shot SHOT-2 visual_dur_sec)
START_COMPARE=$(read_shot COMPARE start_sec)
DUR_COMPARE=$(read_shot COMPARE visual_dur_sec)
START_S5=$(read_shot SHOT-5 start_sec)
DUR_S5=$(read_shot SHOT-5 visual_dur_sec)
TOTAL=$(python3 -c "import json; print(json.load(open('dist/timings.json'))['total_sec'])")

echo "  total ${TOTAL}s  ·  HOOK [0..${DUR_HOOK}]  ·  S1.5 [${START_S1_5}..+${DUR_S1_5}]  ·  S2 [${START_S2}..+${DUR_S2}]  ·  COMPARE [${START_COMPARE}..+${DUR_COMPARE}]  ·  S5 [${START_S5}..+${DUR_S5}]"

# Clip-fit speedups for vhs outputs that may be slightly off-budget.
TERM_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/terminal.mp4)
TERM_SPEED=$(python3 -c "print(round($TERM_DUR / $DUR_S2, 4))")
REV_DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/revert.mp4)
REV_SPEED=$(python3 -c "print(round($REV_DUR / $DUR_S1_5, 4))")
echo "  terminal ${TERM_DUR}s → ${TERM_SPEED}x · revert ${REV_DUR}s → ${REV_SPEED}x"

# Subtitle font (must be Hiragino-coverage for the 桜 in some captions).
FONT_FILE="/System/Library/Fonts/Supplemental/Helvetica Neue.ttc"
if [ ! -f "$FONT_FILE" ]; then FONT_FILE="/System/Library/Fonts/Helvetica.ttc"; fi

# Compose plan:
#   Base layer:    color grade browser.webm (sat 1.08, gamma 0.95, vignette)
#   Overlay 1: hook.mp4         at 0..DUR_HOOK
#   Overlay 2: revert.mp4       at START_S1_5 (sped to fit)
#   Overlay 3: terminal.mp4     at START_S2 (sped to fit)
#   Overlay 4: comparison.mp4   at START_COMPARE
#   Overlay 5: closing-card.mp4 at START_S5
#   Audio: voiceover.mp3
#   Burnt-in captions from captions.srt
#   Output: dist/sakura-demo-3min.mp4 @ 1080p, 30fps, H.264, CRF 22

# Build the filter graph in pieces for readability.
# PTS shift on each overlay = start-of-shot in seconds. ffmpeg's setpts
# accepts +N where N is a frame-count expression; we use +N/TB which
# gives N seconds of offset.
FILTER="
[0:v]scale=1920:1080,setpts=PTS-STARTPTS,fps=30,
     eq=saturation=1.06:gamma=0.97,vignette=PI/5[base0];
[1:v]scale=1920:1080,setpts=PTS-STARTPTS+(${START_HOOK}/TB),fps=30[hookv];
[2:v]scale=1920:1080,setpts=(PTS-STARTPTS)/${REV_SPEED}+(${START_S1_5}/TB),fps=30[revv];
[3:v]scale=1920:1080,setpts=(PTS-STARTPTS)/${TERM_SPEED}+(${START_S2}/TB),fps=30[termv];
[4:v]scale=1920:1080,setpts=PTS-STARTPTS+(${START_COMPARE}/TB),fps=30[cmpv];
[5:v]scale=1920:1080,setpts=PTS-STARTPTS+(${START_S5}/TB),fps=30[closev];
[base0][hookv]overlay=enable='between(t,${START_HOOK},${START_HOOK}+${DUR_HOOK})':eof_action=pass[v1];
[v1][revv]overlay=enable='between(t,${START_S1_5},${START_S1_5}+${DUR_S1_5})':eof_action=pass[v2];
[v2][termv]overlay=enable='between(t,${START_S2},${START_S2}+${DUR_S2})':eof_action=pass[v3];
[v3][cmpv]overlay=enable='between(t,${START_COMPARE},${START_COMPARE}+${DUR_COMPARE})':eof_action=pass[v4];
[v4][closev]overlay=enable='between(t,${START_S5},${START_S5}+${DUR_S5})':eof_action=pass[v5];
[v5]subtitles=dist/captions.srt:force_style='FontName=Helvetica,FontSize=18,Alignment=2,MarginV=80,BorderStyle=3,BackColour=&H99000000,Outline=0,Shadow=0,PrimaryColour=&H00FFFFFF'[vout]
"
# Strip newlines so ffmpeg gets a single-line filtergraph.
FILTER_FLAT=$(echo "$FILTER" | tr -d '\n')

ffmpeg -y -hide_banner -loglevel warning \
  -i dist/browser.webm \
  -i dist/hook.mp4 \
  -i dist/revert.mp4 \
  -i dist/terminal.mp4 \
  -i dist/comparison.mp4 \
  -i dist/closing-card.mp4 \
  -i dist/voiceover.mp3 \
  -filter_complex "$FILTER_FLAT" \
  -map "[vout]" -map "6:a" \
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
echo "  H.264 1080p · 30fps · CRF 22 · AAC 128k · burnt-in captions"
