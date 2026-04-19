# Sakura Mutual

> **The first ZK-verified mutual liquidation insurance for Solana DeFi.**
>
> Pay a premium. Get rescued from liquidation. Prove eligibility on-chain
> in 400ms — without revealing your position.

Built for [Colosseum Frontier Hackathon 2026](https://frontier.colosseum.org/)
(April 6 – May 11) · Solana mainnet-ready · Powered by Claude Sonnet 4.6.

---

## Why this exists

A $4B Solana lending market gets liquidated, repeatedly, every market
cycle. Bots take 5–15% of every liquidated position. Existing
"protection" tools (Apricot Assist, Solend's Soft Liquidations) only
cover their own protocol — and none of them prove on-chain why a
rescue happened.

**Sakura Mutual is liquidation insurance done right**: a mutual pool
where every policyholder is also an underwriter, every claim is
ZK-verified, and the rescue lands within the same block as the price
tick.

---

## Three products in one app

### 1. Nonce Guardian
Reactive defense for the April 2026 $285M durable-nonce hijack class.
Scans your wallet's `SystemProgram` accounts via `getProgramAccounts`,
flags any whose authority was rotated to an attacker.

→ `lib/nonce-scanner.ts` · `app/api/nonce-guardian` · `components/NonceGuardian.tsx`

### 2. Ghost Run
Solana-native multi-step strategy preview. Builds an unsigned
transaction with `@solana/web3.js`, calls `simulateTransaction` against
current chain state, returns precise token deltas + gas + conflicts.
The first consumer-grade Solana ghost executor.

→ `lib/ghost-run.ts` · `app/api/ghost-run/{simulate,execute}` · `components/GhostRun.tsx`

### 3. Liquidation Shield (headline)
Pre-authorize a USDC rescue cap via SPL `approve`. AI watches your
Kamino / MarginFi / Solend health factor. When it drops, Sakura
generates a Groth16 proof + Pyth-bound payout in one transaction.
Token program enforces the cap.

→ `programs/sakura-insurance` · `lib/zk-proof.ts` · `app/api/liquidation-shield/{monitor,rescue}` · `components/LiquidationShield.tsx`

---

## Architecture in one diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 / React 19)                                       │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐                │
│  │NonceGuardian │  │GhostRun  │  │LiquidationShield   │                │
│  └──────┬───────┘  └────┬─────┘  └─────────┬──────────┘                │
└─────────┼───────────────┼──────────────────┼───────────────────────────┘
          │               │                  │
          ▼               ▼                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Vercel Fluid Compute (Next.js App Router routes)                      │
│  /api/nonce-guardian │ /api/ghost-run/* │ /api/liquidation-shield/*    │
│  /api/insurance/claim-with-repay                                       │
│                                                                        │
│  lib/managed-agent.ts  ──► Claude Sonnet 4.6 (Managed Agents API)      │
│  lib/zk-proof.ts        ──► snarkjs Groth16 (BN254)                    │
│  lib/nonce-scanner.ts   ──► Helius RPC                                 │
└─────────────────────────┬──────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Solana                                                                │
│  programs/sakura-insurance/  (Anchor)                                  │
│    • initialize_pool / buy_policy / close_policy                       │
│    • claim_payout_with_zk_proof  ── alt_bn128_pairing  ── Groth16 OK   │
│                                  ── Pyth owner+feed_id+slot+price OK   │
│                                  ── ClaimRecord PDA  (replay guard)    │
│                                                                        │
│  Pyth Pull Oracle  (PYTH_RECEIVER_PROGRAM_ID, SOL/USD feed)            │
│  Kamino / MarginFi / Solend obligation accounts                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Quickstart (local devnet)

```bash
# 1. Install
npm install

# 2. Compile circuit (requires `circom` 2.1.6 globally)
cd circuits && bash compile.sh && cd ..

# 3. Generate trusted setup (Phase 2)
bash circuits/setup-phase2.sh         # uses circuits/ptau/pot11_final.ptau

# 4. Generate the on-chain verifying key
node scripts/parse-vk-to-rust.js

# 5. Build & deploy Anchor program (devnet)
anchor build && anchor deploy --provider.cluster devnet

# 6. Run the app
cp .env.example .env.local            # fill ANTHROPIC_API_KEY, HELIUS_API_KEY
npm run dev
```

Full rebuild instructions in [`docs/REBUILD.md`](./docs/REBUILD.md).

---

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/PITCH.md`](./docs/PITCH.md) | 10-page hackathon pitch deck |
| [`docs/WHITEPAPER.md`](./docs/WHITEPAPER.md) | Cryptographic + economic spec |
| [`docs/AUDIT.md`](./docs/AUDIT.md) | Self-audit checklist mapped to source lines |
| [`docs/MERKLE_DESIGN.md`](./docs/MERKLE_DESIGN.md) | v0.3 Merkle privacy upgrade |
| [`docs/AUDIT_KEY.md`](./docs/AUDIT_KEY.md) | Selective-disclosure design |
| [`ceremony/TRANSCRIPT.md`](./ceremony/TRANSCRIPT.md) | Trusted setup provenance + hashes |
| [`docs/REBUILD.md`](./docs/REBUILD.md) | Reproducible-build instructions |

---

## Stack

- **Smart contracts**: Anchor 0.31, `groth16-solana` (Light Protocol fork)
- **ZK**: circom 2.1.6, circomlib 2.0.5, snarkjs 0.7.6
- **Oracle**: Pyth Pull (V2 layout, owner + feed_id pinned in program)
- **Frontend**: Next.js 16, React 19, Tailwind, wallet-adapter
- **AI**: Claude Sonnet 4.6 via Managed Agents API (`anthropic-beta:
  managed-agents-2026-04-01`), four skills under `.claude/skills/`
- **Hosting**: Vercel Fluid Compute (Node 24)
- **DeFi orchestration**: solana-agent-kit ^2.0.10

---

## Status

- [x] Anchor program: mutual pool + ZK claim verifier
- [x] Liquidation circuit: Poseidon + LessThan + Num2Bits range checks
- [x] Pyth binding: owner + feed_id + slot + price match
- [x] Three working UI flows (Nonce Guardian, Ghost Run, Liquidation Shield)
- [x] Claude Managed Agents wrapper + four skills
- [x] Trusted setup transcript + reproducible artifact hashes
- [x] Self-audit checklist (`docs/AUDIT.md`)
- [ ] 7-contributor public ceremony  *(post-hackathon)*
- [ ] Merkle-tree privacy upgrade    *(designed; v0.3)*
- [ ] Squads multisig for admin      *(v0.3)*
- [ ] Halborn / OtterSec audit       *(post-funding)*

---

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
