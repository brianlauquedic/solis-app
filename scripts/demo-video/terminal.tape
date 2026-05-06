# scripts/demo-video/terminal.tape — vhs script for SHOT-2 (terminal e2e)
#
# Renders a captured `npx tsx scripts/e2e-intent-execute.ts` run as a
# programmatic terminal session. Output: scripts/demo-video/dist/
# terminal.mp4. Visual budget per timings.json: 30.17s.
#
# The actual `replay-e2e.sh` prints "❯ npx tsx scripts/e2e-intent-
# execute.ts\n" as its first line, then streams the captured output —
# so the viewer sees a clean "command + output" terminal session.
#
# Why replay vs live: the e2e is flaky on devnet because Pyth slot can
# drift between proof gen and execute submission, occasionally tripping
# the on-chain OraclePriceMismatch guard (which is correct behavior —
# but visually anticlimactic). We capture a successful run once into
# cache/e2e-output.txt and replay it deterministically. The output IS
# real on-chain data from a real run — only the playback is scripted.

Output scripts/demo-video/dist/terminal.mp4

Set Width 1920
Set Height 1080
Set FontFamily "JetBrainsMono Nerd Font"
Set FontSize 22
Set Padding 24
Set Theme "Catppuccin Mocha"
Set Shell "zsh"

# Reset terminal state from any prior content. Hide so the viewer
# doesn't see the `clear` typed.
Hide
Type "clear" Enter
Sleep 200ms
Type "bash scripts/demo-video/replay-e2e.sh" Enter
Show

# Replay runs ~20s (printing the simulated command + output). Hold the
# final "🎉 E2E PASS" frame for ~7 seconds.
Sleep 27s
