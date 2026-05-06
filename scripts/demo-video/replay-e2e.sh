#!/usr/bin/env bash
#
# replay-e2e.sh — streams the captured e2e-output.txt to stdout with
# realistic per-line delays. Used by terminal.tape so the visible
# terminal portion is reproducible (no Pyth slot drift, no flaky RPC),
# while still being the actual on-chain output from a real run.
#
# Calibration: the real e2e takes ~30-45s wall-clock. We stream 57
# lines over ~30s, with longer pauses on the heavy steps (proof gen,
# Switchboard fetch, execute submission) to mimic the natural rhythm.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SOURCE="${1:-${HERE}/cache/e2e-output.txt}"

if [ ! -f "$SOURCE" ]; then
  echo "✗ no e2e capture at $SOURCE" >&2
  exit 1
fi

# Print the canonical command for the viewer (so the visible terminal
# looks like the user just typed `npx tsx scripts/e2e-intent-execute.ts`).
printf "\033[36m❯\033[0m npx tsx scripts/e2e-intent-execute.ts\n"
sleep 0.6

# Stream lines with delays. Heuristic: most lines are quick; lines
# starting with [N/6] or "✓" are step boundaries — give those longer
# pauses to mimic real e2e wall-clock.
awk '
  {
    print
    fflush()
    line = $0
    if (line ~ /^\[5\/6\] Generating Groth16 proof/) {
      system("sleep 2.5")  # snarkjs proof gen really takes a moment
    } else if (line ~ /^\[6\/6\] Submitting/) {
      system("sleep 1.8")  # tx confirm wait
    } else if (line ~ /^\[4\.5\/6\] Fetching Switchboard/) {
      system("sleep 1.2")
    } else if (line ~ /^\[4\/6\] Posting fresh Pyth/) {
      system("sleep 1.0")
    } else if (line ~ /^\[3\/6\] sign_intent/) {
      system("sleep 0.8")
    } else if (line ~ /^\[2\/6\] User/) {
      system("sleep 0.6")
    } else if (line ~ /^\[1\/6\]/) {
      system("sleep 0.5")
    } else if (line ~ /^  ✓/) {
      system("sleep 0.4")  # acknowledgement after a step
    } else if (line ~ /^🎉/) {
      system("sleep 0.5")  # let the success line breathe
    } else if (line ~ /^━━━/) {
      system("sleep 0.1")
    } else {
      system("sleep 0.18")  # default per-line cadence
    }
  }
' "$SOURCE"
