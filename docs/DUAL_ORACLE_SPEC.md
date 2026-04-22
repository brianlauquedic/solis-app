# C · Dual Oracle Spec (Pyth + Switchboard)

**Status:** **code shipped 2026-04-22** · `anchor deploy` + e2e verification pending
**Shipped commits:** `1540dca` (Rust-side), `4bd3b54` (TS-side), `7cc4592` (real devnet constants)
**Current state:**
  · Rust `execute_with_intent_proof` enforces Pyth ∩ Switchboard ≤ 1% deviation, median-to-circuit (`cargo check` clean)
  · TS client `buildExecuteWithIntentProofIx` extended with `switchboardPriceAccount`
  · Helper `lib/switchboard-post.ts` (buildSwitchboardUpdateIxs + crossOracleMedian)
  · Real devnet constants populated: `SWITCHBOARD_PROGRAM_ID = Aio4gaXj…ji2`, feed hash `b756d471…a4cb` (read from on-chain feed `GgGV…KB`)
  · e2e + bench scripts integrated with median computation

**Remaining:** `anchor build && anchor deploy --provider.cluster devnet`, one successful e2e run, then rerun `bench-verify-cu` to measure post-C-full CU (expected ~145–215k vs C-lite ~126k).

**Mainnet migration:** requires `SWITCHBOARD_PROGRAM_ID` swap (devnet `Aio4gaXj…ji2` → mainnet `SBond…YLp`), populating `SWITCHBOARD_SOL_USD_MAINNET` pubkey + corresponding feed hash, then redeploy via Squads time-locked admin path per `docs/SQUADS_MIGRATION_RUNBOOK.md`.

---

## Why this spec exists

C-lite (shipped in the same PR as this doc) adds a spot-vs-EMA deviation
check inside `execute_with_intent_proof` using the SAME Pyth account's
`price` and `ema_price` fields. That catches **flash oracle manipulation**
(publisher reports an extreme spot while EMA hasn't caught up) but does
NOT defend against a sustained Pyth publisher-network compromise — if
enough Pyth publishers collude or get breached, both `price` and
`ema_price` move together and the spot/EMA check passes.

C-full defends the deeper scenario by requiring a SECOND, independent
oracle source (Switchboard On-Demand) to agree with Pyth within a 1%
band. An attacker would then need to simultaneously compromise the
Pyth publisher network AND the Switchboard publisher network — two
organizationally and infrastructurally independent systems — which
dramatically raises the attack cost.

Reference: the Kelp DAO rsETH × LayerZero incident (2026-04) cost
$290M precisely because the cross-chain verification relied on a
single DVN (`1/1 DVN config`). The same structural lesson applies to
oracles.

---

## Current state (C-lite, shipped today)

```rust
// programs/sakura-insurance/src/lib.rs (execute_with_intent_proof, inline)
let ema_abs = ema_price_i64 as u64;
let diff = ... /* |price - ema| */ ...;
let deviation_bps = diff * 10_000 / max(price, ema);
require!(deviation_bps <= MAX_PYTH_EMA_DEVIATION_BPS, OracleSpotEmaDeviation);
// MAX_PYTH_EMA_DEVIATION_BPS = 200 (2%)
```
Catches flash manipulation. 100% Pyth-internal.

---

## Target state (C-full)

### New constants in `lib.rs`

```rust
/// Switchboard On-Demand program ID (mainnet + devnet).
pub const SWITCHBOARD_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");

/// Switchboard feed hash for SOL/USD (canonical pull feed).
/// Source: https://ondemand.switchboard.xyz/solana/mainnet/feed/SOL_USD
/// TODO: populate with the 32-byte feed hash after confirming against
/// Switchboard's public registry at implementation time.
pub const EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD: [u8; 32] = [/* ... */];

/// Maximum allowed divergence between Pyth and Switchboard in bps.
/// 100 = 1%. Tighter than the Pyth spot-vs-EMA (2%) check because we're
/// comparing two independent publishers aggregated over similar time windows.
pub const MAX_CROSS_ORACLE_DEVIATION_BPS: u64 = 100;
```

### Extend `ExecuteWithIntentProof` accounts struct

```rust
#[derive(Accounts)]
#[instruction(action_nonce: u64)]
pub struct ExecuteWithIntentProof<'info> {
    // ... existing fields ...

    /// CHECK: owner + layout validated by handler against
    /// SWITCHBOARD_PROGRAM_ID and EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD.
    pub switchboard_price_account: UncheckedAccount<'info>,

    // ... existing trailing fields ...
}
```

### Parse + deviation check

```rust
// After existing Pyth parse block — add Switchboard parse block

let sb_acct = &ctx.accounts.switchboard_price_account;
require!(
    sb_acct.owner == &SWITCHBOARD_PROGRAM_ID,
    IntentErr::SwitchboardAccountInvalid
);
let sb_data = sb_acct.try_borrow_data()?;
// Switchboard On-Demand PullFeedAccountData layout:
//   - 8 bytes anchor discriminator
//   - 32 bytes feed_hash
//   - 32 bytes authority
//   - ... various timestamp + conf fields ...
//   - i128 LE result (price) at a known offset
//   - i32 LE exponent at a known offset
// Exact offsets: refer to @switchboard-xyz/on-demand-solana crate docs
// at implementation time.

let sb_feed_hash = &sb_data[8..40];
require!(
    sb_feed_hash == EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD.as_slice(),
    IntentErr::SwitchboardFeedIdMismatch
);

let (sb_price_i128, sb_exponent) = parse_switchboard_result(&sb_data)?;
// Scale to micro-USD same as Pyth
let sb_price_micro: u64 = scale_to_micro(sb_price_i128, sb_exponent)?;

// Deviation check
let diff = if price_micro > sb_price_micro {
    price_micro - sb_price_micro
} else {
    sb_price_micro - price_micro
};
let max_side = core::cmp::max(price_micro, sb_price_micro);
let dev_bps = diff
    .checked_mul(10_000).ok_or(IntentErr::Overflow)?
    .checked_div(max_side.max(1)).unwrap_or(0);
require!(
    dev_bps <= MAX_CROSS_ORACLE_DEVIATION_BPS,
    IntentErr::CrossOracleDeviation
);

// Use median of Pyth + Switchboard for the circuit public input
let effective_price_micro = (price_micro + sb_price_micro) / 2;
```

### Protocol changes

- `oracle_price_usd_micro` public input passed by caller must now equal
  `effective_price_micro` (the median). The circuit still constrains
  `action_amount × oracle_price_usd_micro ≤ max_usd × 1e6` (C5).
- Client-side: prover reads BOTH Pyth and Switchboard, computes median
  off-chain, passes median as `oracle_price_usd_micro` witness.

### New error codes

```rust
#[msg("Switchboard account owner invalid")]        SwitchboardAccountInvalid,
#[msg("Switchboard feed_hash mismatch")]            SwitchboardFeedIdMismatch,
#[msg("Pyth vs Switchboard deviation exceeds 1%")]  CrossOracleDeviation,
```

---

## Cost analysis

### On-chain CU budget impact

| Operation | Estimated CU |
|---|---|
| Switchboard account load | ~3,000 |
| Feed hash validation | ~500 |
| Result deserialization + scaling | ~10,000 |
| Deviation arithmetic | ~2,000 |
| **Total added** | **~15,500** |

Current measured (pending C-lite ship): execute_with_intent_proof ≈ 130–200k CU.
With C-full: ~145–215k CU. **Still under 1.4M per-tx cap by 6×.**

### Client-side latency impact

Pre-posting Switchboard update adds one extra round-trip per transaction:
- Fetch signed price from Switchboard Crossbar (~200ms)
- Post PullFeedAccountData (~400ms tx confirm)

Net: +600ms per action execution. Acceptable for agentic DeFi where action
latencies are typically 2–5 seconds end-to-end anyway.

### Integration dependencies

- `@switchboard-xyz/on-demand` npm package (client-side Switchboard posting)
- Switchboard's Crossbar service (HTTP) for signed price fetches — analogous
  to Pyth's Hermes. **Same availability profile as Hermes**: backend-independent,
  client only needs it at execute time.

---

## Threat model: what C-full adds vs what it doesn't

### What C-full defends against

| Threat | C-lite alone | With C-full |
|---|---|---|
| Single publisher pushes extreme spot | ✓ (EMA catches) | ✓ (EMA + cross-oracle) |
| Flash loan manipulating Pyth | ✓ | ✓ |
| 10–20 Pyth publishers collude | ✗ | ✓ (Switchboard disagrees) |
| Pyth Hermes service poisoned | ✗ (bad data lands with matching EMA) | ✓ (Switchboard disagrees) |
| State actor compromises Pyth's publisher infrastructure | ✗ | ✓ (needs to also compromise Switchboard) |

### What C-full does NOT defend against

- **Both Pyth and Switchboard compromised simultaneously** — catastrophic
  case but requires two organizationally/infrastructurally independent
  breaches in a coordinated window. Cost bound: same-state-actor attack
  budget × 2.
- **Coordinated market manipulation moving real SOL/USD 1%+ in seconds** —
  Sakura reverts; this is not a bug, it's intended. A 1% SOL/USD move
  in a second is a circuit breaker signal, not a normal operation.
- **Switchboard's internal consensus failure** (e.g., Switchboard
  publisher set becomes non-Byzantine-tolerant) — independent of Pyth;
  we revert rather than accept single-oracle values.

---

## Implementation plan · 3 working days

### Day 1 · Rust changes
- Add constants (SWITCHBOARD_PROGRAM_ID, feed hash, MAX_CROSS_ORACLE_DEVIATION_BPS)
- Research current Switchboard On-Demand account layout from `@switchboard-xyz/on-demand` repo
- Write `parse_switchboard_result(data) -> (i128, i32)`
- Wire into `execute_with_intent_proof`
- Add 3 new error variants
- Compile + `anchor build` (no deploy yet)

### Day 2 · TS client + scripts
- Extend `buildExecuteWithIntentProofIx` params with `switchboardPriceAccount`
- Add `postSwitchboardUpdate()` helper (parallel to Pyth Hermes post)
- Update `scripts/e2e-intent-execute.ts` to post BOTH Pyth and Switchboard
- Update `scripts/bench-verify-cu.ts` similarly
- Write deviation-rejection test case (mock one of the prices to 5% off)

### Day 3 · Integration testing on devnet
- Deploy via Squads multisig (routed through the time-locked flow from B)
- Run `npm run bench:verify-cu` and capture new measured CU (~145–215k expected)
- Update deck slide 6 "Architecture" with "dual-oracle Pyth ∩ Switchboard · ≤1% deviation"
- Update deck slide 8 "Moat" comp table with "Oracle single-point failure: Sakura = 双源 · 多数对比 = 单源"

---

## Dependencies before this can ship

1. **A · Squads multisig migration done** (so the B deploy can go through 3-of-5)
2. **B · Time-lock program upgrade done** (so the C-full deploy can also go through time-lock — each oracle change is a 24h-delayed admin action)
3. **C-lite observed stable on devnet for 1 week** — we want to confirm the EMA check doesn't false-positive under normal market volatility before layering on cross-oracle check

If all three prerequisites are met, C-full can be shipped in 3 working days.

---

## Out of scope (further future)

- **Triple oracle (Pyth + Switchboard + Chainlink CCIP-on-Solana)** —
  overkill for SOL/USD where two independent sources are already sufficient.
  Revisit when we add long-tail assets where Chainlink may be the only
  reliable source.
- **Median of N oracles with configurable tolerance per feed** — an
  abstract framework rather than a specific integration. Wait until
  we have ≥3 active oracles before building the framework.
- **Oracle-failure automatic pause** — if both Pyth and Switchboard
  diverge, current design reverts the transaction. A more aggressive
  policy would be "auto-set_paused via time-locked action if divergence
  persists > N minutes". Good v1.5 feature but not blocking.
