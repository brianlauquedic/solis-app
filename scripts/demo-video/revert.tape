# scripts/demo-video/revert.tape — vhs script for SHOT-1.5 (revert demo)
#
# Replays the captured revert-output.txt (over-cap action attempt that
# fails the Groth16 circuit's C2 constraint).
# Output: scripts/demo-video/dist/revert.mp4. Visual budget: ~25s.

Output scripts/demo-video/dist/revert.mp4

Set Width 1920
Set Height 1080
Set FontFamily "JetBrainsMono Nerd Font"
Set FontSize 22
Set Padding 24
Set Theme "Catppuccin Mocha"
Set Shell "zsh"

Hide
Type "clear" Enter
Sleep 200ms
Type "bash scripts/demo-video/replay-revert.sh" Enter
Show

# Replay runs ~14.5s. Hold final 🛑 REVERTED frame for ~10 seconds.
Sleep 25s
