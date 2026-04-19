pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

/*
 * Sakura Mutual — Liquidation Eligibility Proof (v2.1, oracle-bound, range-checked)
 *
 * Proves knowledge of a position (collateral_amount, debt_amount, position
 * account pubkey, user wallet, nonce) such that:
 *
 *   (1) Poseidon(position_account, user_wallet, nonce) == policy_commitment
 *       Binds the proof to the specific obligation account committed at
 *       buy_policy time. User cannot substitute a different position.
 *
 *   (2) collateral_amount * oracle_price_usd_micro * 10000
 *         < trigger_hf_bps * debt_usd_micro * 1_000_000
 *       Health factor = (collateral_amount * price) / debt.
 *       HF < trigger_hf_bps / 10000 ⇔ above inequality (strict, scaled).
 *
 *   (3) rescue_amount_bucket * 100_000_000 <= debt_usd_micro
 *       Rescue amount (buckets of 100 USDC) cannot exceed outstanding debt.
 *
 * RANGE CHECKS (v2.1): All witness values used in multiplications or as
 * LessThan/LessEqThan inputs are explicitly bit-bounded via Num2Bits. This
 * prevents a malicious prover from choosing field elements (mod BN254 p ≈
 * 2^254) that wrap around and spuriously satisfy the scaled inequality.
 *
 * Public inputs (verified on-chain):
 *   - policy_commitment          (binds to Policy.commitment_hash)
 *   - trigger_hf_bps             (e.g. 10500 ⇒ HF < 1.05)
 *   - rescue_amount_bucket       (buckets of 100 USDC)
 *   - oracle_price_usd_micro     (Pyth SOL/USD price, micro-USD; chain verifies
 *                                 this matches Pyth account at oracle_slot)
 *   - oracle_slot                (Pyth publish slot; chain verifies freshness
 *                                 within last ~150 slots)
 *
 * Private witness:
 *   - collateral_amount          (raw token amount, e.g. lamports of SOL)
 *   - debt_usd_micro             (USDC debt, micro-USD)
 *   - position_account_bytes     (Kamino/MarginFi obligation pubkey, 31B)
 *   - user_wallet_bytes          (Solana Pubkey, 31B)
 *   - nonce                      (anti-replay, fresh per policy)
 *
 * Bit-budget (post-range-check):
 *   LHS = collateral(≤40) * price(≤40) * 10000(≤14) ≤ 2^94
 *   RHS = trigger(≤16) * debt(≤64) * 1e6(≤20)       ≤ 2^100
 *   LessThan(128) covers both with margin.
 *   bucket_scaled = bucket(≤32) * 1e8(≤27)           ≤ 2^59
 *   debt(≤64)                                         < 2^96
 *   LessEqThan(96) covers.
 *
 * Groth16 verification on-chain via Solana's alt_bn128_pairing syscall
 * inside the `groth16-solana` crate.
 */
template LiquidationProof() {
    // Public inputs
    signal input policy_commitment;
    signal input trigger_hf_bps;
    signal input rescue_amount_bucket;
    signal input oracle_price_usd_micro;
    signal input oracle_slot;

    // Private witness
    signal input collateral_amount;
    signal input debt_usd_micro;
    signal input position_account_bytes;
    signal input user_wallet_bytes;
    signal input nonce;

    // ------------------------------------------------------------------
    // RANGE CHECKS — force witness values into declared bit-widths so no
    // field wraparound can forge an inequality. Num2Bits(N) constrains the
    // input to lie in [0, 2^N). Without these, a malicious prover can feed
    // large field elements and wrap modulo p ≈ 2^254.
    // ------------------------------------------------------------------

    // Public numeric inputs (defense-in-depth; on-chain relayer also caps).
    component rb_trigger = Num2Bits(16);
    rb_trigger.in <== trigger_hf_bps;

    component rb_bucket = Num2Bits(32);
    rb_bucket.in <== rescue_amount_bucket;

    component rb_price = Num2Bits(40);
    rb_price.in <== oracle_price_usd_micro;

    component rb_slot = Num2Bits(64);
    rb_slot.in <== oracle_slot;

    // Private numeric inputs used in multiplications.
    component rb_collat = Num2Bits(40);
    rb_collat.in <== collateral_amount;

    component rb_debt = Num2Bits(64);
    rb_debt.in <== debt_usd_micro;

    // Private Poseidon preimage inputs — 31-byte (248-bit) pubkey slices
    // and a 64-bit nonce. Binding them to bit widths prevents a prover
    // from substituting giant field elements that collide after Poseidon.
    component rb_pos = Num2Bits(248);
    rb_pos.in <== position_account_bytes;

    component rb_wallet = Num2Bits(248);
    rb_wallet.in <== user_wallet_bytes;

    component rb_nonce = Num2Bits(64);
    rb_nonce.in <== nonce;

    // (1) Commitment binding: tie proof to a specific obligation account
    // committed at policy purchase time. Substituting a different position
    // breaks the Poseidon equality.
    component h = Poseidon(3);
    h.inputs[0] <== position_account_bytes;
    h.inputs[1] <== user_wallet_bytes;
    h.inputs[2] <== nonce;
    h.out === policy_commitment;

    // (2) Health factor below trigger (scaled).
    //   HF = (collateral_amount * oracle_price) / debt
    //   HF < trigger / 10000  ⇔
    //   collateral_amount * oracle_price * 10000 < trigger * debt * 1_000_000
    //
    // The *1_000_000 on the RHS converts oracle_price (micro-USD) into a
    // common scale with debt_usd_micro (already micro-USD). The oracle_price
    // is scaled to 1e6 granularity (e.g. $123.456789 → 123_456_789).
    signal lhs;
    signal ckp;  // intermediate to keep Circom quadratic
    ckp <== collateral_amount * oracle_price_usd_micro;
    lhs <== ckp * 10000;

    signal rhs;
    signal trd;
    trd <== trigger_hf_bps * debt_usd_micro;
    rhs <== trd * 1000000;

    component lt = LessThan(128);
    lt.in[0] <== lhs;
    lt.in[1] <== rhs;
    lt.out === 1;

    // (3) Rescue bucket bound:
    //   rescue_amount_bucket * 100 USDC ≤ debt (in USDC, micro-scale)
    //   ⇔ rescue_amount_bucket * 100_000_000 ≤ debt_usd_micro
    signal bucket_scaled;
    bucket_scaled <== rescue_amount_bucket * 100000000;
    component le = LessEqThan(96);
    le.in[0] <== bucket_scaled;
    le.in[1] <== debt_usd_micro;
    le.out === 1;

    // Bind oracle_slot into the proof algebraically so the verifier cannot
    // be tricked by replaying an old proof with a stale slot — slot is a
    // public input, so it's committed to by the Groth16 IC linear combination.
    //
    // Same for oracle_price — being public, it's part of the pairing-verified
    // input vector. No extra constraint needed inside the circuit.
    //
    // Chain-side: the verifier program re-reads Pyth at `oracle_slot` and
    // checks oracle_price_usd_micro matches, and slot is within freshness
    // window. See claim_payout_with_zk_proof in sakura-insurance.
}

component main {
    public [
        policy_commitment,
        trigger_hf_bps,
        rescue_amount_bucket,
        oracle_price_usd_micro,
        oracle_slot
    ]
} = LiquidationProof();
