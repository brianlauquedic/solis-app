#!/usr/bin/env bash
#
# generate-voiceover.sh — split voiceover.txt by [SHOT ...] markers,
# generate one audio segment per shot via Edge TTS, concat with 0.5s
# inter-shot silence, write final voiceover.mp3 + a timing manifest
# that downstream scripts use to align visuals to audio.
#
# Output:
#   scripts/demo-video/dist/voiceover.mp3 — final voiceover audio
#   scripts/demo-video/dist/timings.json  — per-shot start_sec / dur_sec
#                                           used by ffmpeg compose

set -euo pipefail

cd "$(dirname "$0")"
mkdir -p dist cache

VOICE="${VOICE:-en-US-AriaNeural}"
RATE="${RATE:-+0%}"
PAUSE_SEC="${PAUSE_SEC:-0.6}"
EDGE_TTS="${HOME}/Library/Python/3.12/bin/edge-tts"

declare -a SHOT_NAMES=(INTRO SHOT-1 SHOT-2 SHOT-3 SHOT-4 SHOT-5)

# Split voiceover.txt by [...] markers into 6 numbered files.
python3 - <<'PY'
import re, pathlib
src = pathlib.Path("voiceover.txt").read_text()
chunks = re.split(r"^\[[^\]]+\]\s*$", src, flags=re.MULTILINE)
chunks = [c.strip() for c in chunks if c.strip()]
assert len(chunks) == 6, f"expected 6 shots, got {len(chunks)}"
for i, c in enumerate(chunks):
    pathlib.Path(f"cache/shot-{i}.txt").write_text(c)
print(f"split into {len(chunks)} shots")
PY

# Generate each shot's TTS audio.
for i in 0 1 2 3 4 5; do
  name="${SHOT_NAMES[$i]}"
  out="cache/shot-${i}.mp3"
  echo "[${name}] tts…"
  "$EDGE_TTS" \
    --voice "$VOICE" \
    --rate "$RATE" \
    --file "cache/shot-${i}.txt" \
    --write-media "$out" 2>&1 | tail -2 || true
done

# Build a 0.6s silence clip we can interleave between shots.
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=24000" \
  -t "$PAUSE_SEC" -c:a libmp3lame -b:a 128k cache/silence.mp3

# Concat: shot-0 [pause] shot-1 [pause] ... shot-5
{
  for i in 0 1 2 3 4 5; do
    echo "file 'shot-${i}.mp3'"
    if [ "$i" -lt 5 ]; then
      echo "file 'silence.mp3'"
    fi
  done
} > cache/concat-list.txt

ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i cache/concat-list.txt \
  -c:a libmp3lame -b:a 128k dist/voiceover.mp3

# Generate per-shot timings manifest. start_sec = sum of prior shots +
# pauses; dur_sec = this shot's audio + trailing pause (last shot has no
# trailing pause).
python3 - <<PY
import json, subprocess, pathlib
def dur(p):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(p)]
    )
    return float(out.strip())

pause = $PAUSE_SEC
shots = []
cursor = 0.0
for i in range(6):
    d = dur(f"cache/shot-{i}.mp3")
    trailing = pause if i < 5 else 0.0
    shots.append({
        "index": i,
        "name": "${SHOT_NAMES[0]} ${SHOT_NAMES[1]} ${SHOT_NAMES[2]} ${SHOT_NAMES[3]} ${SHOT_NAMES[4]} ${SHOT_NAMES[5]}".split()[i],
        "start_sec": round(cursor, 3),
        "audio_sec": round(d, 3),
        "trailing_pause_sec": round(trailing, 3),
        "visual_dur_sec": round(d + trailing, 3),
    })
    cursor += d + trailing

manifest = {
    "voice": "$VOICE",
    "rate": "$RATE",
    "pause_between_sec": pause,
    "total_sec": round(cursor, 3),
    "shots": shots,
}
pathlib.Path("dist/timings.json").write_text(json.dumps(manifest, indent=2))
print(f"\n✓ wrote dist/timings.json — total = {cursor:.2f}s (target ~180s)")
for s in shots:
    print(f"  {s['name']:8} start={s['start_sec']:7.2f}  audio={s['audio_sec']:6.2f}  visual_dur={s['visual_dur_sec']:6.2f}")
PY

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 dist/voiceover.mp3)
size=$(ls -l dist/voiceover.mp3 | awk '{print $5}')
echo ""
echo "✓ dist/voiceover.mp3 — ${dur}s, ${size} bytes"
