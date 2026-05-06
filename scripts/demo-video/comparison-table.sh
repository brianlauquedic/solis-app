#!/usr/bin/env bash
#
# comparison-table.sh — generates the COMPARE shot (~21s): a motion-
# graphic table revealing 5 rows top-down comparing Sakura's revert
# behavior to four other approaches in this category.
#
# Output: scripts/demo-video/dist/comparison.mp4
# Visual budget per timings.json COMPARE shot: ~20.66s.
#
# Style: dark editorial. Title at top, 5 rows revealing at 2-second
# intervals. Sakura row highlighted in 朱 orange when it appears.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

DUR_SEC="${DUR_SEC:-20.66}"
WIDTH=1920
HEIGHT=1080

FONT_LATIN=""
for f in \
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf" \
  "/System/Library/Fonts/Supplemental/Helvetica Neue.ttc" \
  "/System/Library/Fonts/Helvetica.ttc"; do
  if [ -f "$f" ]; then FONT_LATIN="$f"; break; fi
done
if [ -z "$FONT_LATIN" ]; then echo "✗ font not found"; exit 1; fi

# Layout:
#   Title at y=120
#   Row 1 (Session-key) at y=300, reveals at t=2
#   Row 2 (Signed AI)   at y=400, reveals at t=4.5
#   Row 3 (AgentRunner) at y=500, reveals at t=7
#   Row 4 (AgentCred)   at y=600, reveals at t=9.5
#   Row 5 (Sakura)      at y=720, reveals at t=12 (in 朱 orange)
#
# Each row has two columns: approach name + outcome description.
# Faded-in via alpha=`min((t-T)/0.5, 1)`.

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=#0d0d0d:s=${WIDTH}x${HEIGHT}:d=${DUR_SEC}:r=30" \
  -vf "
    drawtext=fontfile='${FONT_LATIN}':text='What happens to an out-of-bounds action?':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=120:alpha='if(lt(t,0.4),(t/0.4),1)',
    drawtext=fontfile='${FONT_LATIN}':text='Approach':fontcolor=#666666:fontsize=28:x=320:y=240:alpha='if(lt(t,0.6),(t/0.6),1)',
    drawtext=fontfile='${FONT_LATIN}':text='Outcome':fontcolor=#666666:fontsize=28:x=860:y=240:alpha='if(lt(t,0.6),(t/0.6),1)',
    drawtext=fontfile='${FONT_LATIN}':text='Session-key rotation':fontcolor=#cccccc:fontsize=38:x=320:y=320:alpha='if(lt(t,2),0,if(lt(t,2.5),(t-2)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Lands · next key narrowed':fontcolor=#888888:fontsize=38:x=860:y=320:alpha='if(lt(t,2.2),0,if(lt(t,2.7),(t-2.2)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Signed AI':fontcolor=#cccccc:fontsize=38:x=320:y=420:alpha='if(lt(t,4.5),0,if(lt(t,5),(t-4.5)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Lands · receipt minted':fontcolor=#888888:fontsize=38:x=860:y=420:alpha='if(lt(t,4.7),0,if(lt(t,5.2),(t-4.7)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='AgentRunner':fontcolor=#cccccc:fontsize=38:x=320:y=520:alpha='if(lt(t,7),0,if(lt(t,7.5),(t-7)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Lands · rolled into Merkle root':fontcolor=#888888:fontsize=38:x=860:y=520:alpha='if(lt(t,7.2),0,if(lt(t,7.7),(t-7.2)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='AgentCred':fontcolor=#cccccc:fontsize=38:x=320:y=620:alpha='if(lt(t,9.5),0,if(lt(t,10),(t-9.5)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Lands up to hot-key balance':fontcolor=#888888:fontsize=38:x=860:y=620:alpha='if(lt(t,9.7),0,if(lt(t,10.2),(t-9.7)/0.5,1))',
    drawbox=x=300:y=720:w=1320:h=70:color=#FF6A00@0.12:t=fill:enable='gte(t,12)',
    drawtext=fontfile='${FONT_LATIN}':text='Sakura':fontcolor=#FF6A00:fontsize=46:x=320:y=735:alpha='if(lt(t,12),0,if(lt(t,12.5),(t-12)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='REVERTS · before the DeFi instruction executes':fontcolor=white:fontsize=42:x=860:y=735:alpha='if(lt(t,12.2),0,if(lt(t,12.7),(t-12.2)/0.5,1))',
    drawtext=fontfile='${FONT_LATIN}':text='alt_bn128 pairing  ·  ~204k CU per tx  ·  Solana 1.17':fontcolor=#666666:fontsize=28:x=(w-text_w)/2:y=900:alpha='if(lt(t,15),0,if(lt(t,15.5),(t-15)/0.5,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium -r 30 \
  dist/comparison.mp4

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/comparison.mp4)
size=$(ls -l dist/comparison.mp4 | awk '{print $5}')
echo "✓ dist/comparison.mp4 — ${dur}s, ${size} bytes"
