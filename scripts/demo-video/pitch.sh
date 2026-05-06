#!/usr/bin/env bash
#
# pitch.sh — orchestrator for the 2-min Colosseum pitch video.
# Produces dist/sakura-pitch-2min.mp4.
#
# Generates 6 sections via ffmpeg drawtext + Wa-bijin overlay,
# concatenates with crossfades, mux pitch-voiceover.mp3 audio.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist cache/pitch

WIDTH=1920
HEIGHT=1080
FPS=30

# Read section durations from pitch-timings.json.
read_dur() {
  local name="$1"
  python3 -c "import json; t=json.load(open('dist/pitch-timings.json')); print([s for s in t['shots'] if s['name']=='$name'][0]['visual_dur_sec'])"
}
DUR_INTRO=$(read_dur INTRO)
DUR_STAKES=$(read_dur STAKES)
DUR_PATTERN=$(read_dur PATTERN)
DUR_SOLUTION=$(read_dur SOLUTION)
DUR_WHYME=$(read_dur WHYME)
DUR_CLOSE=$(read_dur CLOSE)

FONT_LATIN="/System/Library/Fonts/Supplemental/Times New Roman.ttf"
FONT_CJK="/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_HELV="/System/Library/Fonts/Helvetica.ttc"

# ── Section 1: INTRO (Sakura logo lock-up) ───────────────────────────
echo "▶ rendering INTRO (${DUR_INTRO}s)…"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_INTRO}:r=${FPS}" \
  -vf "
    drawtext=fontfile='${FONT_CJK}':text='桜':fontcolor=#FF6A00:fontsize=200:x=(w-text_w)/2:y=(h/2)-280:alpha='if(lt(t,0.4),0,if(lt(t,1.2),(t-0.4)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Sakura':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h/2)-60:alpha='if(lt(t,1),0,if(lt(t,1.8),(t-1)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Solana-native execution-bounds verifier for AI agents':fontcolor=#cccccc:fontsize=36:x=(w-text_w)/2:y=(h/2)+90:alpha='if(lt(t,1.6),0,if(lt(t,2.4),(t-1.6)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='— a 2-minute pitch by Brian Lau':fontcolor=#666666:fontsize=28:x=(w-text_w)/2:y=h-160:alpha='if(lt(t,2.4),0,if(lt(t,3.2),(t-2.4)/0.8,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  cache/pitch/sec-0.mp4

# ── Section 2: STAKES (3 cards: Mt.Gox / OKEx / FTX) ─────────────────
echo "▶ rendering STAKES (${DUR_STAKES}s)…"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_STAKES}:r=${FPS}" \
  -vf "
    drawtext=fontfile='${FONT_LATIN}':text='Self-custody, lost three times.':fontcolor=#888888:fontsize=42:x=(w-text_w)/2:y=80:alpha='if(lt(t,0.5),0,if(lt(t,1.5),(t-0.5)/1,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Mt.Gox':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=(h/2)-280:alpha='if(lt(t,2),0,if(lt(t,2.6),(t-2)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='2014':fontcolor=#FF6A00:fontsize=48:x=(w-text_w)/2:y=(h/2)-180:alpha='if(lt(t,2.4),0,if(lt(t,3),(t-2.4)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='OKEx':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=(h/2)-60:alpha='if(lt(t,7),0,if(lt(t,7.6),(t-7)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='2019':fontcolor=#FF6A00:fontsize=48:x=(w-text_w)/2:y=(h/2)+40:alpha='if(lt(t,7.4),0,if(lt(t,8),(t-7.4)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='FTX':fontcolor=white:fontsize=88:x=(w-text_w)/2:y=(h/2)+160:alpha='if(lt(t,12),0,if(lt(t,12.6),(t-12)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='2022':fontcolor=#FF6A00:fontsize=48:x=(w-text_w)/2:y=(h/2)+260:alpha='if(lt(t,12.4),0,if(lt(t,13),(t-12.4)/0.6,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Any rule a software operator can override, will be overridden.':fontcolor=#cccccc:fontsize=36:x=(w-text_w)/2:y=h-140:alpha='if(lt(t,16),0,if(lt(t,17),(t-16)/1,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  cache/pitch/sec-1.mp4

# ── Section 3: PATTERN ───────────────────────────────────────────────
echo "▶ rendering PATTERN (${DUR_PATTERN}s)…"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_PATTERN}:r=${FPS}" \
  -vf "
    drawtext=fontfile='${FONT_LATIN}':text='Agentic DeFi is the fourth iteration.':fontcolor=white:fontsize=66:x=(w-text_w)/2:y=200:alpha='if(lt(t,0.5),0,if(lt(t,1.3),(t-0.5)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='The agent promises convenience.':fontcolor=#cccccc:fontsize=44:x=(w-text_w)/2:y=380:alpha='if(lt(t,3),0,if(lt(t,3.8),(t-3)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='The operator behind it quietly reclaims':fontcolor=#cccccc:fontsize=44:x=(w-text_w)/2:y=460:alpha='if(lt(t,5.5),0,if(lt(t,6.3),(t-5.5)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='the ground retail surrendered in the 1990s.':fontcolor=#cccccc:fontsize=44:x=(w-text_w)/2:y=520:alpha='if(lt(t,7),0,if(lt(t,7.8),(t-7)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='\"My money, my rules\"':fontcolor=#666666:fontsize=42:x=(w-text_w)/2:y=720:alpha='if(lt(t,12),0,if(lt(t,12.8),(t-12)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='becomes marketing.':fontcolor=#FF6A00:fontsize=42:x=(w-text_w)/2:y=790:alpha='if(lt(t,14),0,if(lt(t,14.8),(t-14)/0.8,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  cache/pitch/sec-2.mp4

# ── Section 4: SOLUTION (typography + 3 B-roll clips of live product) ─
# Structure (32s):
#   0:00–3s   typography  "Sakura erases the operator class."
#   3:00–9s   B-roll #1   sakuraaai.com landing  + caption strip
#   9:00–12s  typography  "One sentence → 32-byte Poseidon commitment"
#   12:00–18s B-roll #2   IntentSigner UI         + caption strip
#   18:00–21s typography  "Groth16 proof, atomic with DeFi instruction"
#   21:00–27s B-roll #3   Solana Explorer · 206,325 CU · FINALIZED
#   27:00–32s typography  "Out-of-bounds is unreachable.  Live on devnet."
echo "▶ rendering SOLUTION (${DUR_SOLUTION}s)…"
# Single-line filter graph (newlines confuse ffmpeg's parser).
SOL_FILTER="[1:v]scale=1920:1080,setpts=PTS-STARTPTS+(3/TB)[broll1];[2:v]scale=1920:1080,setpts=PTS-STARTPTS+(12/TB)[broll2];[3:v]scale=1920:1080,setpts=PTS-STARTPTS+(21/TB)[broll3];[0:v][broll1]overlay=enable='between(t,3,9)':eof_action=pass[v1];[v1][broll2]overlay=enable='between(t,12,18)':eof_action=pass[v2];[v2][broll3]overlay=enable='between(t,21,27)':eof_action=pass[v3];[v3]drawtext=fontfile='${FONT_LATIN}':text='Sakura erases the operator class.':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.4),0,if(lt(t,1.2),(t-0.4)/0.8,if(lt(t,2.6),1,if(lt(t,3),(3-t)/0.4,0))))',drawtext=fontfile='${FONT_LATIN}':text='One sentence':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h/2)-60:alpha='if(lt(t,9.4),0,if(lt(t,10),(t-9.4)/0.6,if(lt(t,11.6),1,if(lt(t,12),(12-t)/0.4,0))))',drawtext=fontfile='${FONT_LATIN}':text='→  32-byte Poseidon commitment, on-chain':fontcolor=#FF6A00:fontsize=44:x=(w-text_w)/2:y=(h/2)+30:alpha='if(lt(t,9.8),0,if(lt(t,10.4),(t-9.8)/0.6,if(lt(t,11.6),1,if(lt(t,12),(12-t)/0.4,0))))',drawtext=fontfile='${FONT_LATIN}':text='Every action — a Groth16 proof,':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h/2)-50:alpha='if(lt(t,18.4),0,if(lt(t,19),(t-18.4)/0.6,if(lt(t,20.6),1,if(lt(t,21),(21-t)/0.4,0))))',drawtext=fontfile='${FONT_LATIN}':text='atomic with the DeFi instruction.':fontcolor=#cccccc:fontsize=44:x=(w-text_w)/2:y=(h/2)+30:alpha='if(lt(t,18.8),0,if(lt(t,19.4),(t-18.8)/0.6,if(lt(t,20.6),1,if(lt(t,21),(21-t)/0.4,0))))',drawtext=fontfile='${FONT_LATIN}':text='Out-of-bounds is not blocked.':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h/2)-100:alpha='if(lt(t,27.4),0,if(lt(t,28),(t-27.4)/0.6,1))',drawtext=fontfile='${FONT_LATIN}':text='It is unreachable.':fontcolor=#FF6A00:fontsize=72:x=(w-text_w)/2:y=(h/2)+0:alpha='if(lt(t,28.4),0,if(lt(t,29),(t-28.4)/0.6,1))',drawtext=fontfile='${FONT_LATIN}':text='Live on devnet  ·  12 CPI cells  ·  Kamino · Jupiter · Jito · Raydium':fontcolor=#888888:fontsize=28:x=(w-text_w)/2:y=(h/2)+150:alpha='if(lt(t,29.4),0,if(lt(t,30),(t-29.4)/0.6,1))'"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_SOLUTION}:r=${FPS}" \
  -i cache/pitch/broll-landing.mp4 \
  -i cache/pitch/broll-intent.mp4 \
  -i cache/pitch/broll-explorer.mp4 \
  -filter_complex "$SOL_FILTER" \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  -t "$DUR_SOLUTION" \
  cache/pitch/sec-3.mp4

# ── Section 5: WHYME ─────────────────────────────────────────────────
# Curly apostrophes (U+2019) so on-screen text matches voiceover exactly.
echo "▶ rendering WHYME (${DUR_WHYME}s)…"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_WHYME}:r=${FPS}" \
  -vf "
    drawtext=fontfile='${FONT_LATIN}':text='Why me.':fontcolor=#FF6A00:fontsize=72:x=(w-text_w)/2:y=180:alpha='if(lt(t,0.4),0,if(lt(t,1.2),(t-0.4)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='I’m Asian.':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=350:alpha='if(lt(t,2),0,if(lt(t,2.8),(t-2)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Watched a generation pay the tuition in 2022.':fontcolor=#cccccc:fontsize=42:x=(w-text_w)/2:y=460:alpha='if(lt(t,5),0,if(lt(t,5.8),(t-5)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='I’m not building this for the technically curious.':fontcolor=#cccccc:fontsize=42:x=(w-text_w)/2:y=620:alpha='if(lt(t,8),0,if(lt(t,8.8),(t-8)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='I’m building it for the next round of retail users —':fontcolor=#cccccc:fontsize=42:x=(w-text_w)/2:y=720:alpha='if(lt(t,11),0,if(lt(t,11.8),(t-11)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='so when their agent goes off-script, the action does not land.':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=800:alpha='if(lt(t,14),0,if(lt(t,14.8),(t-14)/0.8,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  cache/pitch/sec-4.mp4

# ── Section 6: CLOSE ─────────────────────────────────────────────────
echo "▶ rendering CLOSE (${DUR_CLOSE}s)…"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=${WIDTH}x${HEIGHT}:d=${DUR_CLOSE}:r=${FPS}" \
  -vf "
    drawtext=fontfile='${FONT_CJK}':text='桜':fontcolor=#FF6A00:fontsize=200:x=(w-text_w)/2:y=(h/2)-300:alpha='if(lt(t,0.4),0,if(lt(t,1.2),(t-0.4)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Sakura':fontcolor=white:fontsize=120:x=(w-text_w)/2:y=(h/2)-60:alpha='if(lt(t,0.8),0,if(lt(t,1.6),(t-0.8)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='MIT  ·  permissionless  ·  live':fontcolor=#cccccc:fontsize=42:x=(w-text_w)/2:y=(h/2)+120:alpha='if(lt(t,2),0,if(lt(t,2.8),(t-2)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='sakuraaai.com':fontcolor=#FF6A00:fontsize=56:x=(w-text_w)/2:y=(h/2)+220:alpha='if(lt(t,3.2),0,if(lt(t,4),(t-3.2)/0.8,1))',
    drawtext=fontfile='${FONT_LATIN}':text='Colosseum Frontier 2026':fontcolor=#666666:fontsize=24:x=(w-text_w)/2:y=h-80:alpha='if(lt(t,5),0,if(lt(t,5.8),(t-5)/0.8,1))'
  " \
  -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
  cache/pitch/sec-5.mp4

# ── Concat all 6 sections ────────────────────────────────────────────
echo "▶ concatenating sections…"
{
  for i in 0 1 2 3 4 5; do
    echo "file 'sec-${i}.mp4'"
  done
} > cache/pitch/concat-vid.txt

ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i cache/pitch/concat-vid.txt \
  -c copy cache/pitch/all-video.mp4

# ── Mux voiceover ────────────────────────────────────────────────────
echo "▶ muxing voiceover + subtitles…"

# Generate .srt for pitch
python3 - <<'PY'
import json, pathlib, re
timings = json.loads(pathlib.Path("dist/pitch-timings.json").read_text())
shots = timings["shots"]
# All pitch sections have on-screen typography matching the voiceover —
# burnt-in captions would compete with that text. Skip captions entirely
# for the pitch (the visual IS the caption).
SKIP = {"INTRO", "STAKES", "PATTERN", "SOLUTION", "WHYME", "CLOSE"}

def parse_vtt(path):
    text = pathlib.Path(path).read_text()
    cues = []
    pattern = re.compile(r"(\d+):(\d+):(\d+)[.,](\d+)\s+-->\s+(\d+):(\d+):(\d+)[.,](\d+)")
    blocks = text.split("\n\n")
    for block in blocks:
        m = pattern.search(block)
        if not m: continue
        g = list(m.groups())
        s = (int(g[0])*3600+int(g[1])*60+int(g[2]))*1000+int(g[3])
        e = (int(g[4])*3600+int(g[5])*60+int(g[6]))*1000+int(g[7])
        lines = block.strip().split("\n")
        ts = next((i for i,l in enumerate(lines) if "-->" in l), -1)
        if ts == -1: continue
        text_ = " ".join(lines[ts+1:]).strip()
        if text_: cues.append((s, e, text_))
    return cues

def fmt(ms):
    h = ms//3600000; ms-=h*3600000
    m = ms//60000;   ms-=m*60000
    s = ms//1000;    ms-=s*1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

srt = []
n = 1
for shot in shots:
    if shot["name"] in SKIP: continue
    cues = parse_vtt(f"cache/pitch/section-{shot['index']}.vtt")
    off = int(shot["start_sec"]*1000)
    for s,e,t in cues:
        srt.append(f"{n}\n{fmt(off+s)} --> {fmt(off+e)}\n{t}\n")
        n += 1
pathlib.Path("dist/pitch-captions.srt").write_text("\n".join(srt))
print(f"✓ pitch-captions.srt: {n-1} cues")
PY

# If pitch-captions.srt has any cues, burn them in. Otherwise skip the
# subtitles filter and just copy video.
SRT_LINES=$(wc -l < dist/pitch-captions.srt 2>/dev/null || echo 0)
if [ "$SRT_LINES" -gt 0 ]; then
  ffmpeg -y -hide_banner -loglevel warning \
    -i cache/pitch/all-video.mp4 \
    -i dist/pitch-voiceover.mp3 \
    -vf "subtitles=dist/pitch-captions.srt:force_style='FontName=Helvetica,FontSize=18,Alignment=2,MarginV=60,BorderStyle=3,BackColour=&H99000000,Outline=0,Shadow=0,PrimaryColour=&H00FFFFFF'" \
    -c:v libx264 -pix_fmt yuv420p -crf 22 -preset medium \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -shortest \
    dist/sakura-pitch-2min.mp4
else
  ffmpeg -y -hide_banner -loglevel warning \
    -i cache/pitch/all-video.mp4 \
    -i dist/pitch-voiceover.mp3 \
    -c:v copy \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    -shortest \
    dist/sakura-pitch-2min.mp4
fi

DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/sakura-pitch-2min.mp4)
SIZE=$(stat -f %z dist/sakura-pitch-2min.mp4 2>/dev/null || stat -c %s dist/sakura-pitch-2min.mp4)
SIZE_MB=$(python3 -c "print(f'{$SIZE/1024/1024:.1f}')")

echo ""
echo "✓ dist/sakura-pitch-2min.mp4 — ${DUR}s, ${SIZE_MB}MB"
echo "  H.264 1080p · 30fps · CRF 22 · AAC 128k · burnt-in captions"
