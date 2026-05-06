#!/usr/bin/env bash
#
# closing-card.sh — generates the SHOT-5 static closing card via ffmpeg
# drawtext filters. Outputs scripts/demo-video/dist/closing-card.mp4.
#
# Visual budget per timings.json: 29.23s.
# Style: black background, large white centered text. Editorial mood
# matching Sakura's brand (no gradients, no AI slop).

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

DUR_SEC="${DUR_SEC:-14.69}"
WIDTH=1920
HEIGHT=1080

# Two fonts: a Latin display face + a CJK face for the 桜 character.
# macOS Hiragino is bundled and covers all Japanese kanji we need.
FONT_LATIN=""
for f in \
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf" \
  "/System/Library/Fonts/Supplemental/Helvetica Neue.ttc" \
  "/System/Library/Fonts/Helvetica.ttc" \
  "/System/Library/Fonts/Times.ttc"; do
  if [ -f "$f" ]; then FONT_LATIN="$f"; break; fi
done
FONT_CJK=""
for f in \
  "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc" \
  "/System/Library/Fonts/Hiragino Sans GB.ttc" \
  "/System/Library/Fonts/PingFang.ttc"; do
  if [ -f "$f" ]; then FONT_CJK="$f"; break; fi
done
if [ -z "$FONT_LATIN" ] || [ -z "$FONT_CJK" ]; then
  echo "✗ font(s) not found · LATIN=$FONT_LATIN · CJK=$FONT_CJK"; exit 1
fi
echo "fonts: LATIN=$FONT_LATIN · CJK=$FONT_CJK"

# Build the closing card. Center-anchored text stack.
# The cherry-blossom 桜 character + headline + tagline + URL.
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_SEC}:r=30" \
  -vf "
    drawtext=fontfile='${FONT_CJK}':text='桜':fontcolor=#FF6A00:fontsize=240:x=(w-text_w)/2:y=(h/2)-340,
    drawtext=fontfile='${FONT_LATIN}':text='Sakura':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h/2)-100,
    drawtext=fontfile='${FONT_LATIN}':text='Solana-native execution-bounds verifier for AI agents':fontcolor=#cccccc:fontsize=42:x=(w-text_w)/2:y=(h/2)+40,
    drawtext=fontfile='${FONT_LATIN}':text='\$33M of 2024-25 Solana agent losses → structurally impossible':fontcolor=#cccccc:fontsize=36:x=(w-text_w)/2:y=(h/2)+130,
    drawtext=fontfile='${FONT_LATIN}':text='sakuraaai.com  ·  MIT  ·  devnet today':fontcolor=#888888:fontsize=32:x=(w-text_w)/2:y=(h/2)+220,
    drawtext=fontfile='${FONT_LATIN}':text='Colosseum Frontier 2026':fontcolor=#666666:fontsize=24:x=(w-text_w)/2:y=h-80
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium -r 30 \
  dist/closing-card.mp4

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/closing-card.mp4)
size=$(ls -l dist/closing-card.mp4 | awk '{print $5}')
echo "✓ dist/closing-card.mp4 — ${dur}s, ${size} bytes"
