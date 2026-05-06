#!/usr/bin/env bash
#
# generate-captions.sh — generates dist/captions.srt with word-level
# timing for burnt-in subtitles.
#
# Approach: for each of the 9 shots, ask Edge TTS to emit both the
# audio AND a WordBoundary subtitle file. Then convert to .srt with
# global timestamps offset by the shot's start_sec from timings.json.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist cache

VOICE="${VOICE:-en-US-AriaNeural}"
RATE="${RATE:-+0%}"
EDGE_TTS="${HOME}/Library/Python/3.12/bin/edge-tts"

# Generate WebVTT subtitle file per shot via Edge TTS's
# --write-subtitles (WordBoundary). The audio is already in cache/
# from generate-voiceover.sh; we re-run with --write-subtitles to
# get word-level timings.
declare -a SHOT_NAMES=(HOOK INTRO SHOT-1 SHOT-1.5 SHOT-2 SHOT-3 COMPARE SHOT-4 SHOT-5)

for i in 0 1 2 3 4 5 6 7 8; do
  name="${SHOT_NAMES[$i]}"
  echo "[${name}] generating subtitles…"
  "$EDGE_TTS" \
    --voice "$VOICE" \
    --rate "$RATE" \
    --file "cache/shot-${i}.txt" \
    --write-media "cache/shot-${i}-sub.mp3" \
    --write-subtitles "cache/shot-${i}.vtt" 2>&1 | tail -1 || true
done

# Combine VTT files into one SRT, offsetting each shot by its
# start_sec from timings.json.
python3 - <<'PY'
import json, pathlib, re

timings = json.loads(pathlib.Path("dist/timings.json").read_text())
shots = timings["shots"]

# Parse a VTT file and yield (start_ms, end_ms, text) per cue.
def parse_vtt(path):
    text = pathlib.Path(path).read_text()
    cues = []
    # Edge TTS emits SRT format (",") despite the file extension.
    # Accept both "." and "," as fractional-second separators.
    pattern = re.compile(
        r"(\d+):(\d+):(\d+)[.,](\d+)\s+-->\s+(\d+):(\d+):(\d+)[.,](\d+)"
    )
    blocks = text.split("\n\n")
    for block in blocks:
        m = pattern.search(block)
        if not m:
            continue
        groups = list(m.groups())
        start_ms = (int(groups[0])*3600 + int(groups[1])*60 + int(groups[2]))*1000 + int(groups[3])
        end_ms   = (int(groups[4])*3600 + int(groups[5])*60 + int(groups[6]))*1000 + int(groups[7])
        # Get the text (line after the timestamp line)
        lines = block.strip().split("\n")
        text_start = next((i for i, l in enumerate(lines) if "-->" in l), -1)
        if text_start == -1:
            continue
        cue_text = " ".join(lines[text_start+1:]).strip()
        if cue_text:
            cues.append((start_ms, end_ms, cue_text))
    return cues

# Edge TTS emits one cue per word. Group consecutive words into
# subtitle lines of ~6-8 words for readability.
def group_words(cues, max_words=7, max_dur_ms=4000):
    if not cues:
        return []
    groups = []
    current = []
    for cue in cues:
        if not current:
            current.append(cue)
            continue
        # group end = last cue end, group start = first cue start
        gstart = current[0][0]
        # candidate group dur if we add this cue
        gend = cue[1]
        gdur = gend - gstart
        words_in_group = len(current)
        if words_in_group >= max_words or gdur > max_dur_ms:
            # finalize current group
            groups.append((current[0][0], current[-1][1], " ".join(c[2] for c in current)))
            current = [cue]
        else:
            current.append(cue)
    if current:
        groups.append((current[0][0], current[-1][1], " ".join(c[2] for c in current)))
    return groups

def fmt_srt_ts(ms):
    h = ms // 3600000; ms -= h * 3600000
    m = ms // 60000;   ms -= m * 60000
    s = ms // 1000;    ms -= s * 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

# Shots with their own large on-screen text — captions would overlap
# and obscure that text. Skip captions during these windows.
SKIP_NAMES = {"HOOK", "COMPARE", "SHOT-5"}

srt_lines = []
cue_n = 1
for shot in shots:
    i = shot["index"]
    if shot["name"] in SKIP_NAMES:
        print(f"  skipping captions for {shot['name']} (has its own large text)")
        continue
    vtt_path = f"cache/shot-{i}.vtt"
    if not pathlib.Path(vtt_path).exists():
        print(f"  warn: {vtt_path} missing, skipping {shot['name']}")
        continue
    cues = parse_vtt(vtt_path)
    # Edge TTS already groups into sentence chunks; if a cue has too
    # many words, fall back to word grouping. Otherwise pass-through.
    grouped = []
    for cue in cues:
        if len(cue[2].split()) > 8:
            # Re-split this single cue. We don't have word-level timings
            # so just split into halves with proportional time slicing.
            words = cue[2].split()
            mid = len(words) // 2
            mid_ms = cue[0] + (cue[1] - cue[0]) * mid // len(words)
            grouped.append((cue[0], mid_ms, " ".join(words[:mid])))
            grouped.append((mid_ms, cue[1], " ".join(words[mid:])))
        else:
            grouped.append(cue)
    offset_ms = int(shot["start_sec"] * 1000)
    for start_ms, end_ms, text in grouped:
        global_start = offset_ms + start_ms
        global_end   = offset_ms + end_ms
        srt_lines.append(f"{cue_n}")
        srt_lines.append(f"{fmt_srt_ts(global_start)} --> {fmt_srt_ts(global_end)}")
        srt_lines.append(text)
        srt_lines.append("")
        cue_n += 1

pathlib.Path("dist/captions.srt").write_text("\n".join(srt_lines))
print(f"✓ wrote dist/captions.srt — {cue_n - 1} cues")
PY
