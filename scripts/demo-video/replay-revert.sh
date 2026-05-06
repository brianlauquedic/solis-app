#!/usr/bin/env bash
#
# replay-revert.sh — streams the captured revert-output.txt to stdout
# with realistic per-line delays. Visual budget per timings.json: ~25s.

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SOURCE="${1:-${HERE}/cache/revert-output.txt}"

if [ ! -f "$SOURCE" ]; then
  echo "✗ no revert capture at $SOURCE" >&2
  exit 1
fi

# Print the canonical command so the visible terminal looks like the
# user just typed `npx tsx scripts/e2e-intent-revert.ts`.
printf "\033[36m❯\033[0m npx tsx scripts/e2e-intent-revert.ts\n"
sleep 0.5

awk '
  {
    print
    fflush()
    line = $0
    if (line ~ /^\[5\/6\] Agent attempts/) {
      system("sleep 1.2")  # build tension before the violation
    } else if (line ~ /^\[6\/6\] Witness/) {
      system("sleep 1.0")
    } else if (line ~ /C2.*FAIL/) {
      system("sleep 0.8")  # let the FAIL line breathe
    } else if (line ~ /^🛑 REVERTED/) {
      system("sleep 0.6")
    } else if (line ~ /^  ✓/) {
      system("sleep 0.4")
    } else if (line ~ /^\[/) {
      system("sleep 0.5")
    } else if (line ~ /^━━━/) {
      system("sleep 0.05")
    } else {
      system("sleep 0.2")
    }
  }
' "$SOURCE"
