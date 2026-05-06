#!/usr/bin/env bash
#
# hook.sh — generates the opening hook (~15s) — black background with
# "$42M" → "$33M structurally impossible" → Sakura wordmark, each
# fading in via ffmpeg drawtext + alpha-time expressions.
#
# Output: scripts/demo-video/dist/hook.mp4
# Visual budget per timings.json HOOK shot: ~14.95s.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

DUR_SEC="${DUR_SEC:-14.95}"
WIDTH=1920
HEIGHT=1080

FONT_LATIN=""
for f in \
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf" \
  "/System/Library/Fonts/Supplemental/Helvetica Neue.ttc" \
  "/System/Library/Fonts/Helvetica.ttc"; do
  if [ -f "$f" ]; then FONT_LATIN="$f"; break; fi
done
FONT_CJK=""
for f in \
  "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc" \
  "/System/Library/Fonts/Hiragino Sans GB.ttc"; do
  if [ -f "$f" ]; then FONT_CJK="$f"; break; fi
done

if [ -z "$FONT_LATIN" ] || [ -z "$FONT_CJK" ]; then
  echo "✗ font not found"; exit 1
fi
echo "fonts: LATIN=$FONT_LATIN · CJK=$FONT_CJK"

# Three-phase reveal:
#   0–4s:  $42M (large, center) — "Six Solana agent incidents 2024-25"
#   4–9s:  $33M (large, center, brand 朱) "structurally impossible"
#   9–15s: 桜 + Sakura wordmark + tagline (logo lock-up)
#
# alpha=between(t,0,4) gates visibility per phase. fade-in over 0.4s
# at start of each phase via min((t-T)/0.4, 1).

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_SEC}:r=30" \
  -vf "
    drawtext=fontfile='${FONT_LATIN}':text='\$42M':fontcolor=white:fontsize=240:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t,0.2),0,if(lt(t,0.6),(t-0.2)/0.4,if(lt(t,3.6),1,if(lt(t,4),(4-t)/0.4,0))))',
    drawtext=fontfile='${FONT_LATIN}':text='Six Solana agent incidents · 2024–2025':fontcolor=#888888:fontsize=42:x=(w-text_w)/2:y=(h/2)+150:alpha='if(lt(t,0.6),0,if(lt(t,1),(t-0.6)/0.4,if(lt(t,3.6),1,if(lt(t,4),(4-t)/0.4,0))))',
    drawtext=fontfile='${FONT_LATIN}':text='\$33M':fontcolor=#FF6A00:fontsize=240:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='if(lt(t,4),0,if(lt(t,4.4),(t-4)/0.4,if(lt(t,8.6),1,if(lt(t,9),(9-t)/0.4,0))))',
    drawtext=fontfile='${FONT_LATIN}':text='structurally impossible':fontcolor=#cccccc:fontsize=46:x=(w-text_w)/2:y=(h/2)+150:alpha='if(lt(t,4.4),0,if(lt(t,4.8),(t-4.4)/0.4,if(lt(t,8.6),1,if(lt(t,9),(9-t)/0.4,0))))',
    drawtext=fontfile='${FONT_CJK}':text='桜':fontcolor=#FF6A00:fontsize=200:x=(w-text_w)/2:y=(h/2)-280:alpha='if(lt(t,9),0,if(lt(t,9.6),(t-9)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Sakura':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h/2)-60:alpha='if(lt(t,9.4),0,if(lt(t,10),(t-9.4)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Solana-native execution-bounds verifier for AI agents':fontcolor=#cccccc:fontsize=36:x=(w-text_w)/2:y=(h/2)+90:alpha='if(lt(t,10),0,if(lt(t,10.6),(t-10)/0.6,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium -r 30 \
  dist/hook.mp4

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/hook.mp4)
size=$(ls -l dist/hook.mp4 | awk '{print $5}')
echo "✓ dist/hook.mp4 — ${dur}s, ${size} bytes"
