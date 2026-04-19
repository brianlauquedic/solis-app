# Sakura Mutual — Technical Whitepaper (v0.2)

**Author**: Sakura Mutual core
**Date**: 2026-04-18
**Audience**: Solana protocol engineers, ZK auditors, hackathon judges
**Length target**: ~8 pages

---

## 1. Abstract

Sakura Mutual is a Solana program implementing on-chain mutual
liquidation insurance for borrowers across Kamino, MarginFi, Solend,
and Drift. Policyholders are also underwriters — premiums and stakes
flow into a single USDC pool; claims are paid from that same pool.
Eligibility for a claim is proved on-chain via a Groth16 SNARK over
BN254 (verified through Solana's `alt_bn128_pairing` syscall), binding
the proof to (a) a specific obligation account, (b) a Pyth-published
oracle price, and (c) the strict inequality `collateral × price <
trigger × debt / 10^4`. This document specifies the cryptographic
construction, the Anchor state machine, the economic invariants, and
the privacy roadmap.

---

## 2. Threat model

### 2.1 Adversary capabilities

- Submit arbitrary instructions to the program.
- Construct adversarial Pyth `PriceUpdateV2` accounts (must be ruled
  out by owner + feed_id checks).
- Generate Groth16 proofs for any inputs they hold the witness for.
- Front-run / sandwich claim transactions (Jito, Helius staked-RPC).

### 2.2 Adversary cannot

- Forge a Groth16 proof without knowing the witness (assumes Discrete
  Log + Knowledge of Exponent in BN254).
- Substitute a Pyth account owned by a different program (account-owner
  check at handler entry).
- Replay a proof (`ClaimRecord` PDA `init` per `(policy, claim_nonce)`).
- Drain the pool beyond their own coverage cap (per-user max + per-claim
  bucket cap).

### 2.3 Trusted parties

- **The trusted setup transcript signers** (currently 2; will be ≥7
  before mainnet beta — see `ceremony/TRANSCRIPT.md`).
- **The Pyth Network publishers**, transitively trusted via the on-chain
  receiver program — same trust assumption as every Pyth integrator.
- **The program upgrade authority** (initially deployer key, will move
  to Squads multisig + 24h timelock for v0.3).

---

## 3. Cryptographic construction

### 3.1 Curve and prover

- **Curve**: BN254 (a.k.a. alt_bn128). Same curve as Ethereum's
  precompiles and Solana's `alt_bn128_pairing` syscall.
- **Proving system**: Groth16. Selected for: (a) constant-size proof
  (192 bytes), (b) constant-time verifier (1 pairing), (c) on-chain
  support via `groth16-solana` (Light Protocol fork).
- **Hash inside circuit**: Poseidon (arity 3) — significantly cheaper in
  R1CS than SHA-256.

### 3.2 Liquidation eligibility circuit

`circuits/src/liquidation_proof.circom`. Statement:

> I know `(collateralAmount, debtUsdMicro, obligationPubkey,
> walletPubkey, nonce)` such that:
>
> 1. `Poseidon(obligationPubkey, walletPubkey, nonce) == policyCommitment`
> 2. `collateralAmount × oraclePriceUsdMicro × 10000 < triggerHfBps × debtUsdMicro × 10^6`
> 3. `rescueAmountBucket × 10^8 ≤ debtUsdMicro`

Public inputs (5):
- `policyCommitment`
- `triggerHfBps`
- `rescueAmountBucket`
- `oraclePriceUsdMicro`
- `oracleSlot`

Private witness (5):
- `collateralAmount`, `debtUsdMicro`, `obligationPubkey`, `walletPubkey`, `nonce`.

### 3.3 Range checks (defense against field wrap-around)

All numeric private inputs participating in multiplications, and all
commitment-preimage inputs to Poseidon, are bounded by `Num2Bits(N)`:

| Signal | Bits |
|---|---|
| `collateralAmount` | 40 |
| `debtUsdMicro` | 64 |
| `oraclePriceUsdMicro` | 40 |
| `triggerHfBps` | 16 |
| `rescueAmountBucket` | 32 |
| `oracleSlot` | 64 |
| `obligationPubkey`, `walletPubkey` | 248 (31-byte slices) |
| `nonce` | 64 |

Without these constraints, a malicious prover could submit field
elements ≥ 2^254 that wrap modulo the BN254 prime and trivially satisfy
the scaled inequality. Adding `Num2Bits` is the standard remediation
(see `iden3/circomlib` README's "common pitfalls" section).

### 3.4 Bit-budget verification

Post-range-check:
- LHS = collateral(≤2^40) × price(≤2^40) × 10^4(≤2^14) ≤ 2^94
- RHS = trigger(≤2^16) × debt(≤2^64) × 10^6(≤2^20) ≤ 2^100
- `LessThan(128)` covers both with margin.
- `bucket_scaled = bucket(≤2^32) × 10^8(≤2^27) ≤ 2^59 < 2^96`. `LessEqThan(96)` covers.

### 3.5 Trusted setup

Two phases (see `ceremony/TRANSCRIPT.md`):
- **Phase 1** = Hermez `pot11` (audited, public, widely re-used).
- **Phase 2** = circuit-specific contributions from project lead (and
  one more before mainnet) + drand-beacon finalization.

Artifact hashes (SHA-256) are pinned in the transcript so anyone can
reproduce.

---

## 4. On-chain verification

### 4.1 Verifier instantiation

`programs/sakura-insurance/src/lib.rs::claim_payout_with_zk_proof`:

```rust
let mut verifier = Groth16Verifier::new(
    &proof_a,         // 64B  G1, prepared-alpha negated
    &proof_b,         // 128B G2, c0/c1 swapped for ark-bn254
    &proof_c,         // 64B  G1
    &public_inputs,   // [5; [u8;32]] big-endian
    &VERIFYINGKEY,    // generated from circuits/build/verification_key.json
)?;
verifier.verify()?;
```

The verifying key bytes live in `programs/sakura-insurance/src/zk_verifying_key.rs`,
generated by `scripts/parse-vk-to-rust.js` (`alpha_g1` is negated for the
prepared-alpha pairing convention used by `groth16-solana`).

### 4.2 Public-input encoding

| Idx | Field | Encoding |
|---|---|---|
| 0 | `policy_commitment` | as-is from `policy.commitment_hash` |
| 1 | `trigger_hf_bps` | `[0u8; 30] || u16.be` |
| 2 | `rescue_amount_bucket` | `[0u8; 28] || u32.be` |
| 3 | `oracle_price_usd_micro` | `[0u8; 24] || u64.be` |
| 4 | `oracle_slot` | `[0u8; 24] || u64.be` |

This must match the BE32 layout produced by `parse-vk-to-rust.js`'s
`fieldToBE32`.

### 4.3 Pyth oracle binding

To make `oracle_price_usd_micro` non-attacker-controlled, the handler:

1. Asserts `pyth_price_account.owner == PYTH_RECEIVER_PROGRAM_ID`.
2. Parses `PriceUpdateV2` layout inline, extracts `feed_id`, asserts
   `feed_id == EXPECTED_FEED_ID_SOL_USD` (32-byte hardcoded).
3. Extracts `posted_slot`, asserts `posted_slot == oracle_slot`.
4. Recomputes `price × 10^(6 + exponent)` and asserts within ±1 of
   `oracle_price_usd_micro`.
5. Asserts `current_slot - oracle_slot ≤ 150` (≈ 60s freshness).

Without these five checks, the public input `oracle_price_usd_micro`
is forgeable and the in-circuit HF inequality is meaningless.

---

## 5. Economic model

### 5.1 Mutual pool semantics

Every `buy_policy` deposits:

- `premium` → split via `platform_fee_bps` into `(platform_fee, pool_share)`
- `stake`   → 100% to pool, refundable pro-rata at `close_policy`

`pool_share + stake` accumulate in `pool_vault` (a PDA-owned
`TokenAccount`). All claims pay from this single vault.

### 5.2 Last-loss tranche

`close_policy` refund:

```
stake_refund = min(
    nominal_stake × (vault_balance / total_stakes),
    nominal_stake
)
```

If claims have drained the pool below `total_stakes`, departing users
take a haircut proportional to the pool's deficit. This makes stake the
junior loss-absorbing layer — exactly the Lloyd's of London convention,
ported to Solana primitives.

### 5.3 Anti-adverse-selection

| Mechanism | Where |
|---|---|
| Waiting period (default 24h) | `lib.rs:398-404` |
| Min stake multiplier | `lib.rs:153-157` |
| Per-user coverage cap | `lib.rs:138-141` |
| Per-claim bucket cap | `lib.rs:427-431` |
| Coverage cap monotonic on renewal | `lib.rs:228-231` |

### 5.4 Premium math

`premium_bps` is interpreted as bps-per-month-of-coverage. So a
`coverage_cap_usdc = $50,000` policy at `premium_bps = 50` requires:

```
min_premium_month = 50_000 × 50 / 10_000 = $250 / month
```

Funded duration is `(premium / min_premium_month) × 30 days`, accumulated
into `policy.paid_through_unix`.

---

## 6. State diagram

```
                            ┌─────────────┐
                            │   uninit    │
                            └──────┬──────┘
                                   │ buy_policy
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │                    active                        │
        │ ◀── buy_policy (renew/top-up) ─────────────┐     │
        │                                            │     │
        │       claim_payout_with_zk_proof ──────────┘     │
        │       (multiple times, capped at coverage_cap)   │
        └──────┬─────────────────────────────────┬─────────┘
               │ close_policy                    │
               ▼                                 │
        ┌──────────────┐                         │
        │   closed     │ ◀───────────────────────┘
        └──────────────┘
```

A `Policy` PDA exists permanently (Anchor `init_if_needed`); `is_active`
is the lifecycle flag. `coverage_outstanding` and `total_stakes` on the
`Pool` are kept in sync with the active set.

---

## 7. Off-chain architecture

### 7.1 AI orchestration

Claude Sonnet 4.6 via the Managed Agents API (`lib/managed-agent.ts`)
drives four skills:

1. `nonce-guardian` — durable-nonce hijack scanner
2. `ghost-run` — multi-step strategy `simulateTransaction` previewer
3. `liquidation-shield` — health-factor monitor + rescue trigger
4. `mutual-claim` — buy / claim / close UX guidance

Skill files live at `.claude/skills/<id>/SKILL.md`. The wrapper attaches
them as needed and pins the model to `claude-sonnet-4-6` per project
mandate.

### 7.2 Proof generation

`lib/zk-proof.ts` runs snarkjs `groth16.fullProve` against the wasm
witness generator + zkey, then `proofToOnchainBytes` repackages the
proof into the `(proof_a, proof_b, proof_c)` BE encoding (negating
`a.y` for prepared-alpha).

Server-side artifact paths resolve via `path.join(process.cwd(),
"public", "zk", …)` so they survive Vercel Fluid Compute's working-
directory semantics. `next.config.ts::outputFileTracingIncludes` ensures
the artifacts are bundled into the function.

### 7.3 Pyth pricing in the monitor

The HF computation uses Jupiter Price API as a near-real-time SOL/USD
source for monitoring (cheap, no on-chain cost). The on-chain claim
ALSO re-checks Pyth — Jupiter is monitoring-only, never used as the
source of truth for payouts.

---

## 8. Privacy roadmap

v0.2 leaks per-policy `commitment_hash` openly. v0.3 replaces this with
a `spl-account-compression` Poseidon Merkle tree rooted in `Pool` —
claim circuit proves membership instead of equality. Combined with
selective-disclosure audit keys (see `docs/MERKLE_DESIGN.md` and
`docs/AUDIT_KEY.md`), the user gets:

- Default privacy: nobody can link wallet → policy → claim.
- Voluntary disclosure: prove ownership to one auditor without
  revealing other policies.
- Time-bounded revocation: short-lived disclosures self-expire.

---

## 9. Limitations & honest disclosures

- **Hackathon-grade trusted setup**: 2 contributors, not the 7+ a
  production protocol needs.
- **Single oracle**: SOL/USD only in v0.2. Multi-asset support requires
  per-asset feed_id constants + per-asset bucket caps.
- **Single chain**: Solana only. We chose this deliberately —
  `alt_bn128_pairing` + `simulateTransaction` + 400ms slots make Solana
  uniquely suited.
- **Admin singleton**: v0.2 admin is a single key. Squads multisig
  migration is a v0.3 deliverable.
- **No upgrade timelock yet** — production launch must add this.

These are explicit in `docs/AUDIT.md` with timestamps.

---

## 10. References

- snarkjs ^0.7.6 — https://github.com/iden3/snarkjs
- circomlib ^2.0.5 — https://github.com/iden3/circomlib
- groth16-solana — https://github.com/Lightprotocol/groth16-solana
- spl-account-compression — https://docs.solana.com/developing/runtime-facilities/programs#spl-account-compression
- Pyth Pull Oracle on Solana — https://docs.pyth.network/price-feeds/contract-addresses/solana
- Jito Labs / Helius — for staked RPC + bundle relay (optional)
- Lloyd's of London mutual model — historical inspiration
