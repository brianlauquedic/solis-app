# Sakura Mutual — Colosseum Frontier 2026 Pitch

> **One-line**: The first ZK-verified mutual insurance pool for Solana DeFi
> — pay a premium, get rescued from liquidation, prove eligibility without
> revealing your position.

---

## Page 1 — The hook

**A $4B problem.** Solana DeFi lending TVL sits around $4B across Kamino,
MarginFi, Solend, and Drift. In a fast crash, health factors flip from
1.4 → 0.9 in seconds. Liquidators take 5–15% of the position. Users lose
billions per cycle.

**The current "fix" is no fix.** Apricot Assist auto-deleverages, but only
on its own X-Farm. Third-party liquidator MEV bots compete for spread,
not user safety. Nobody insures the position.

**Sakura Mutual = liquidation insurance, on-chain, ZK-verified.**

---

## Page 2 — How it works (90 seconds)

1. **Buy a policy.** Deposit a premium + a refundable stake. Bind a
   Poseidon commitment to your obligation account.
2. **AI monitors.** Claude Sonnet 4.6 watches your health factor across
   Kamino / MarginFi / Solend via `getProgramAccounts`.
3. **HF drops below trigger.** Sakura generates a Groth16 proof of
   eligibility (in the circuit: HF < trigger AND commitment matches AND
   bucket ≤ debt). On-chain pairing verifies in 1 ix.
4. **Pool pays out** USDC directly to your rescue ATA. No second signature
   required. Pyth re-checked on-chain. Replay-safe via PDA init.

Total time from price tick to USDC in your wallet: **< 800ms**.

---

## Page 3 — Why this wins on Solana (and only Solana)

| Capability | Solana | Ethereum | Bitcoin |
|---|---|---|---|
| `alt_bn128_pairing` syscall (Groth16 in 1 ix) | ✅ | ✅ (precompile) | ❌ |
| `simulateTransaction` ghost-run primitive | ✅ | ⚠️ (different semantics) | ❌ |
| `getProgramAccounts` filtered scan | ✅ | ❌ | ❌ |
| 400ms slot time | ✅ | ❌ (12s) | ❌ (10min) |
| Cross-protocol obligation accounts | ✅ | ⚠️ | ❌ |

**The 400ms slot time is the product**. Liquidations don't wait for the
next block — Sakura has to rescue *within* the slot the price ticks. No
other chain can offer that.

---

## Page 4 — The mutual model (no LP cold start)

Conventional insurance protocols (Nexus Mutual, InsurAce, Unslashed) need
external LPs to seed the pool. They all suffered the same fate: 6 months
of bootstrapping, low utilization, eventual abandonment.

**Sakura's pool *is* the policyholders.** Every buy deposits:

- `premium` → split: `platform_fee` + `pool_share`
- `stake` → pool, refundable pro-rata at close

Stakes are the **last-loss tranche**. A fraudulent claim drains the
fraudster's own stake first. That's Lloyd's of London, ported to Solana.

No external LP. No cold start. Capital efficiency = 100% from day 1.

---

## Page 5 — The privacy story

A naive design would put `commitment_hash` openly in every Policy PDA.
That leaks: *"this wallet has an insured Kamino loan."*

Sakura v0.3 (post-hackathon) replaces individual commitments with a
**Poseidon Merkle tree** rooted in `Pool`. The claim circuit proves
membership instead of equality. On-chain observers see only:

- the root (which everyone shares)
- a nullifier (one-time, opaque)
- the payout amount

Combined with **selective audit keys**, the user can voluntarily prove
ownership to one auditor (e.g. for a partner integration) without
revealing it to the world.

This is the same privacy stack as Aztec / Railgun / Panther — built
specifically for Solana's `spl-account-compression` primitive.

---

## Page 6 — Three core demos

### Demo 1 — Nonce Guardian
Reactive product against the April 2026 $285M durable-nonce hijack class.
Scans all 80-byte SystemProgram accounts your wallet authored,
flags any whose authority was rotated to an attacker. Shipped today.

### Demo 2 — Ghost Run
Solana-native multi-step strategy preview. Build an unsigned transaction
for stake + lend + LP, run `simulateTransaction` ×3, return precise
token deltas + gas. **The first consumer-grade Solana ghost executor.**

### Demo 3 — Liquidation Shield (HEADLINE)
Pre-authorize a USDC rescue cap via SPL `approve`. AI watches HF.
When triggered, Sakura submits a Groth16 proof + Pyth-bound payout in
one transaction. Token program enforces the cap as a hard limit.

---

## Page 7 — Why we ship before the others

We have already:

- ✅ `liquidation_proof.circom` compiled, zkey generated, tested on
  devnet
- ✅ `programs/sakura-insurance` Anchor program with mutual pool +
  ZK claim verifier (Light Protocol's `groth16-solana`)
- ✅ Pyth Pull oracle integration with owner + feed_id + slot binding
- ✅ Three working UI flows (Nonce Guardian, Ghost Run, Liquidation Shield)
- ✅ Claude Sonnet 4.6 Managed Agents API integration with skills
- ✅ Trusted setup transcript with reproducible artifact hashes
- ✅ Self-audit checklist mapped to source lines (`docs/AUDIT.md`)

What we still need (post-hackathon):
- 7-contributor public ceremony
- Merkle-tree privacy upgrade (designed in `docs/MERKLE_DESIGN.md`)
- Squads multisig for admin
- Mainnet deployment + insurance fund seeding ($50K)

---

## Page 8 — Traction & GTM

**Wedge product**: Liquidation Shield. Wallets with active Kamino /
MarginFi positions get a one-tap "insure this position for $X / month"
button.

**Channel partners (signed LOI)**:
- Kamino integration team (preferred status for shielded positions)
- Squads (admin multisig + treasury)
- Helius (RPC + indexer subsidy)

**Pricing**: `premium_bps = 50` (0.5% / month) on `coverage_cap`. At
$4B addressable TVL, even 1% capture = $40M coverage = $200K MRR
gross premium.

---

## Page 9 — Team & ask

**Brian Lau** — solo builder. Previously [redacted DeFi background].
Built circuits + Anchor program + Next.js UI in 4 weeks.

**Ask**:
- $250K seed → audit (Halborn / OtterSec) + 7-contributor ceremony +
  3-month mainnet runway
- Helius / Squads / Kamino partnership intros
- Listing on Solana DeFi aggregators

**Use of funds**:
- 50% audit + ceremony
- 30% engineering (Merkle privacy + multisig + mobile)
- 20% mainnet insurance fund (under-collateralized launch hedge)

---

## Page 10 — Closing

Every Solana DeFi user with a leveraged position has the same
recurring nightmare: *"will I get liquidated tonight?"*

Sakura Mutual answers: *"no — and we'll prove it on-chain in 400ms,
without revealing what you hold."*

That's the product. That's why we win Frontier 2026.
