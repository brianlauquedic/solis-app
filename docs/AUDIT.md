# Sakura Insurance — Self-Audit Checklist

Living checklist mapped to `programs/sakura-insurance/src/lib.rs`.
Format: **[ID]  Status  | Item  | Evidence (file:line)**.

---

## A. Account validation

- [x] **A1**  Pool PDA bound to admin    `lib.rs:683` (`seeds = [b"sakura_pool_v2", admin]`)
- [x] **A2**  Policy PDA bound to user    `lib.rs:692` / `:728` / `:765`
- [x] **A3**  ClaimRecord PDA bound to (policy, claim_nonce) — replay guard  `lib.rs:778-780`
- [x] **A4**  `pool_vault` enforced via `address = pool.usdc_vault`  `lib.rs:707, 745, 784`
- [x] **A5**  `platform_treasury` enforced via `address = pool.platform_treasury`  `lib.rs:710`
- [x] **A6**  `user_usdc_ata.owner == user`  `lib.rs:703, 740`
- [x] **A7**  `rescue_destination_ata.owner == policy.user` (handler check)  `lib.rs:421-425`
- [x] **A8**  Pyth account owner = `PYTH_RECEIVER_PROGRAM_ID`  `lib.rs:466-470` (post C2 fix)
- [x] **A9**  Pyth `feed_id == EXPECTED_FEED_ID_SOL_USD`  `lib.rs:482-487` (post C2 fix)
- [x] **A10** `has_one = admin` on AdminOnly  `lib.rs:673`
- [ ] **A11** Token-mint check on `rescue_destination_ata` matches `pool.usdc_mint` — currently only `token::mint = pool.usdc_mint` constraint, OK; ensure no SPL-2022 confusion → audit

## B. Arithmetic

- [x] **B1**  All `+` use `checked_add`  (premium split, paid_through, total_claimed, etc.)
- [x] **B2**  All `*` use `checked_mul`  (premium × bps, stake × multiplier)
- [x] **B3**  All `-` either checked or saturating (pool teardown uses `saturating_sub` deliberately)
- [x] **B4**  `u128` widening for bps math to avoid u64 overflow
- [x] **B5**  Pyth exponent math uses `checked_pow` and bounded exponent

## C. Authorization

- [x] **C1**  `initialize_pool` payer = admin → admin captured  `lib.rs:77`
- [x] **C2**  `set_paused` requires `AdminOnly`  `lib.rs:111`
- [x] **C3**  `rotate_admin_agent` requires `AdminOnly`  `lib.rs:105`
- [x] **C4**  `claim_payout_with_zk_proof` does NOT require any signer except `payer` (rent only) — ZK proof is the auth source
- [x] **C5**  `close_policy` requires `has_one = user`  `lib.rs:730`

## D. ZK verification

- [x] **D1**  Public-input order matches circuit `public []` list  `lib.rs:543-548`
- [x] **D2**  BE encoding consistent with `parse-vk-to-rust.js`  `lib.rs:549-557` + `parse-vk-to-rust.js:35-45`
- [x] **D3**  `Groth16Verifier::new` errors mapped to `ZkProofMalformed`  `lib.rs:567`
- [x] **D4**  `verifier.verify()` errors mapped to `ZkProofInvalid`  `lib.rs:569-571`
- [x] **D5**  `policy.commitment_hash` enforced as public input [0]  `lib.rs:549`
- [x] **D6**  Range checks on private witness signals (Num2Bits) — see C1 fix in circuit (`liquidation_proof.circom:81-110`)

## E. Oracle binding

- [x] **E1**  `oracle_slot` freshness window 150 slots  `lib.rs:434-438`
- [x] **E2**  `posted_slot == oracle_slot`  `lib.rs:504`
- [x] **E3**  `oracle_price_usd_micro ≈ price × 10^(6+exp)` with ±1 tolerance  `lib.rs:518-539`
- [x] **E4**  Pyth account owner check (post C2)
- [x] **E5**  Pyth feed_id check (post C2)
- [x] **E6**  Reject negative Pyth prices  `lib.rs:507-509`

## F. Economic invariants

- [x] **F1**  `stake ≥ min_stake_multiplier × premium`  `lib.rs:153-157`
- [x] **F2**  `coverage_cap ≤ pool.max_coverage_per_user_usdc`  `lib.rs:138-141`
- [x] **F3**  `total_claimed + amount ≤ coverage_cap`  `lib.rs:409-413`
- [x] **F4**  `bucket × 100 USDC ≥ amount` (bucket cap)  `lib.rs:427-431`
- [x] **F5**  Pool vault sufficiency check  `lib.rs:415-418`
- [x] **F6**  Stake refund pro-rata to vault balance  `lib.rs:301-314`
- [x] **F7**  Stake refund capped at nominal  `lib.rs:314`
- [x] **F8**  Coverage cap monotonic-increase on renewal  `lib.rs:228-231`

## G. Replay & timing

- [x] **G1**  `ClaimRecord` `init` per (policy, claim_nonce) prevents replay
- [x] **G2**  Waiting period from `bought_at_unix`  `lib.rs:398-404`
- [x] **G3**  48h grace after `paid_through_unix`  `lib.rs:406-407`
- [x] **G4**  Pyth slot freshness  (E1)
- [x] **G5**  Nonce baked into Poseidon commitment (circuit)

## H. Pause/upgrade

- [x] **H1**  Pause flag respected in `buy_policy`  `lib.rs:136`
- [x] **H2**  Pause flag respected in `claim_payout_with_zk_proof`  `lib.rs:385`
- [ ] **H3**  Upgrade authority documented and timelock plan written → see `docs/LAUNCH_PLAN.md` (TODO)

## I. Rust hygiene

- [x] **I1**  No `unwrap()` in handlers (all `.ok_or(InsErr::…)`)
- [x] **I2**  No `unsafe` blocks
- [x] **I3**  No floats
- [x] **I4**  All `error_code` variants documented with `#[msg]`

## Critical fix log

| Fix | Date | Reference |
|-----|------|-----------|
| C1 — Num2Bits range checks | 2026-04-18 | `circuits/src/liquidation_proof.circom:81-110` |
| C2 — Pyth owner + feed_id | 2026-04-18 | `lib.rs:11-30, 466-487` |
| C3 — outputFileTracingIncludes | 2026-04-18 | `next.config.ts:23-36` |
| C3b — cwd-safe ZK paths | 2026-04-18 | `lib/zk-proof.ts:147-165` |
| H1 — Jupiter price fetch | 2026-04-18 | `app/api/liquidation-shield/monitor/route.ts:339-368` |

## Known limitations

- 2-of-3 admin multisig deferred to v0.3 (use Squads externally for now).
- Production trusted-setup ceremony still pending (hackathon-grade in `ceremony/TRANSCRIPT.md`).
- Liquidator-rebate model not yet implemented — claims paid 1:1 with no MEV protection layer.
