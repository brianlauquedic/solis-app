# Demo Video — Shot-by-shot recording checklist

> This file documents the **3-minute Colosseum Frontier 2026 submission
> video**. Two paths supported:
>
> 1. **Live human recording** (high authenticity, recommended for VC
>    follow-on use). Open browser left, terminal right, OBS single scene.
> 2. **Automated AI capture** via `scripts/demo-video/`
>    ([Playwright](https://playwright.dev) + [vhs](https://github.com/charmbracelet/vhs)
>    + [edge-tts](https://github.com/rany2/edge-tts)) — reproducible,
>    deterministic, no human time on set.
>
> Both paths produce the same `dist/sakura-demo-3min.mp4`. Honest note:
> path 2 looks slightly more synthetic (uniform mouse pacing, neural-TTS
> voiceover) — judges may identify it as AI-generated. The current
> production submission uses path 2.

## Pre-flight (live path)

```bash
# 1. Confirm devnet is reachable
solana balance --url devnet

# 2. Confirm Helius env (optional; publicnode is the zero-key fallback)
echo $HELIUS_API_KEY | head -c 10

# 3. Dry-run E2E to warm caches (real recording finishes in ~25s)
npx tsx scripts/e2e-intent-execute.ts

# 4. Clear the terminal
clear
```

Open in the browser:
- `https://www.sakuraaai.com/?demo=true` (or `http://localhost:3000/?demo=true`)
- Solscan: `https://solscan.io/account/AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp?cluster=devnet`

## Pre-flight (automated path)

```bash
# Run the orchestrator end-to-end. Browser via Playwright, terminal via
# vhs, voiceover via Edge TTS, compose via ffmpeg. ~3 min wall-clock.
bash scripts/demo-video/build.sh
# Output: dist/sakura-demo-3min.mp4
```

---

## Shot 1 — landing hero + intent signing UI (0:00–0:35)

1. Open `https://www.sakuraaai.com/` — show the editorial hero
   (kimono SVG, 桜印 favicon visible, "$4.48B Solana TVL addressable"
   banner).
2. Click **Try demo**. URL flips to `/?demo=true`. Sakura interface
   appears — `IntentSigner` component on screen.
3. Type natural-language intent into the textarea:
   *"Lend up to 1000 USDC into Kamino or Jupiter Lend, $10k max per
   action, one week."*
4. Adjust sliders: max amount **1000**, USD cap **10000**, hours **24**.
5. Toggle protocol pills: **Kamino ✓ Jupiter ✓ Jito ◯ Raydium ◯**.
6. Toggle action pills: **Lend ✓ Repay ✓ Swap ◯ Stake ◯**.
7. Click **Sign Intent**.
8. (Demo mode) status banner walks through `awaiting-signature` →
   `confirming` → success card with the 32-byte commitment hash.

**Voiceover (this shot)**:
> A user signs one sentence in their wallet. Seven private values —
> per-action cap, USD ceiling, allowed protocols, allowed actions,
> intent text, wallet, nonce — fold through a two-layer Poseidon hash
> into a thirty-two-byte commitment, anchored on-chain. The values
> never leave the browser. Only the hash reaches Solana.

## Shot 2 — terminal E2E (0:35–1:30)

1. Cut to terminal.
2. Run: `npx tsx scripts/e2e-intent-execute.ts`
3. As the output scrolls, the camera holds on these lines:
   - `[1/6] Protocol PDA : Ab3Z…M`
   - `[3/6] sign_intent ✓ on-chain commitment …`
   - `[4/6] priceMicro=… slot=…` (Pyth + Switchboard merge)
   - `[5/6] ✓ proof generated, public signals: 6`
   - `[5/6] off-chain snarkjs verify: ✓ OK`
   - `[6/6] ✓ execute landed: https://solscan.io/tx/<sig>`
4. Hold on the final "🎉 E2E PASS · ~204,460 CU" line for 2 seconds.

**Voiceover**:
> Now the agent acts. The Sakura execute_with_intent_proof handler
> takes the user-signed commitment, a fresh Pyth price, a Switchboard
> cross-check, and a Groth16 proof generated in the browser. Six
> checks land atomically. The DeFi instruction either passes the gate
> with a valid proof — or the entire transaction reverts. Two hundred
> four thousand compute units, on-chain.

## Shot 3 — on-chain proof on Solscan (1:30–2:10)

1. Copy the Solscan tx URL from the terminal output.
2. Paste into a browser tab. Let the page load.
3. Scroll to **Program Logs**. Highlight:
   - `Instruction: ExecuteWithIntentProof`
   - No revert — transaction succeeded.
4. Scroll to **Instructions** section. Show the 2-ix composition:
   `ComputeBudget` + `execute_with_intent_proof`.
5. Click the ActionRecord PDA in the "Token Balance Change" section
   (if visible) to show it was written. Otherwise hold on the
   instruction view.

**Voiceover**:
> The proof and the DeFi action share a single atomic v0 transaction.
> They both land, or they both revert — inseparably. Every action
> writes a permanent ActionRecord PDA on Solana. Lawyers, auditors,
> counterparties — anyone can reconstruct the execution from public
> chain data alone, no off-chain monitor.

## Shot 4 — audit feed inside the app (2:10–2:35)

1. Switch back to the Sakura interface.
2. Scroll down to the `ActionHistory` component.
3. Click `refresh`. The just-executed action appears at the top.
4. Zoom in: action type = **Lend**, target = **Kamino**, amount,
   oracle price, slot, keccak256 fingerprint.

**Voiceover**:
> Inside the app, the same execution renders as a human-readable line
> — action type, protocol, amount, oracle price, slot, fingerprint.
> The user sees what their agent did. Always.

## Shot 5 — closing card (2:35–3:00)

Static title card rendered in post:

```
                    桜  Sakura
        Solana-native execution-bounds verifier
               for AI agents

         $33M of 2024-25 Solana agent losses
            → structurally impossible

           sakuraaai.com  ·  MIT  ·  devnet today
```

Bottom line, smaller: `Built by @sakuraaijp · Colosseum Frontier 2026`

**Voiceover**:
> Six 2024–25 Solana agent incidents. Forty-two million dollars in
> user losses. Thirty-three million of that — seventy-eight percent —
> structurally impossible in the Sakura model. Live on devnet today,
> twelve CPI cells, MIT-licensed, permissionless integration.
> sakuraaai.com.

---

## Voiceover compilation

Full voiceover text, ready for TTS or reading: see
[`scripts/demo-video/voiceover.txt`](../scripts/demo-video/voiceover.txt).

Approximate cadence: ~150 wpm → ~450 words for 3:00 duration.

## Notes for live recording (path 1)

- Record voiceover separately from screen capture so retakes don't
  require re-running `e2e-intent-execute.ts`.
- Pause 0.5s between shots so editor transitions have room.
- For **Shot 1 step 7**, real Phantom can be used instead of demo mode
  if you want full authenticity; the sign-intent transaction lands on
  devnet, no real value at risk.
- Bottom-thirds, lower-third name supers, intro/outro cards: render
  in DaVinci Resolve / Final Cut / Descript per your editorial style.

## Notes for automated recording (path 2)

- All 5 shots are scripted in `scripts/demo-video/`. See that
  directory's README for invocation.
- The Phantom popup is replaced by demo mode's deterministic
  signature simulation (no extension needed).
- Edge TTS picks `en-US-AriaNeural` by default. Change `VOICE` in
  `build.sh` to swap voices.
