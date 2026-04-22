use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use groth16_solana::groth16::Groth16Verifier;
// Switchboard On-Demand · C-full dual oracle integration.
// Verified against `switchboard-on-demand 0.3.8` by inspecting the
// installed crate source directly during implementation.
use switchboard_on_demand::PullFeedAccountData;

mod zk_verifying_key;
use zk_verifying_key::VERIFYINGKEY;

declare_id!("AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp");

// ════════════════════════════════════════════════════════════════════════════
// Oracle bindings (hardcoded — prevents attacker-supplied fake Pyth accounts)
// ════════════════════════════════════════════════════════════════════════════

/// Pyth Pull Oracle Receiver program ID (same across mainnet & devnet).
pub const PYTH_RECEIVER_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

/// Pyth SOL/USD price feed ID (32 bytes, big-endian).
/// SOL/USD = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
pub const EXPECTED_FEED_ID_SOL_USD: [u8; 32] = [
    0xef, 0x0d, 0x8b, 0x6f, 0xda, 0x2c, 0xeb, 0xa4,
    0x1d, 0xa1, 0x5d, 0x40, 0x95, 0xd1, 0xda, 0x39,
    0x2a, 0x0d, 0x2f, 0x8e, 0xd0, 0xc6, 0xc7, 0xbc,
    0x0f, 0x4c, 0xfa, 0xc8, 0xc2, 0x80, 0xb5, 0x6d,
];

// ════════════════════════════════════════════════════════════════════════════
// Protocol economics (v0.3 pricing — see docs/VALUE_CAPTURE.md)
// ════════════════════════════════════════════════════════════════════════════

/// Flat per-action fee paid at every `execute_with_intent_proof`.
/// $0.01 expressed in USDC micro-units (USDC has 6 decimals).
pub const EXECUTE_ACTION_FEE_MICRO: u64 = 10_000; // $0.01

/// Upper bound on a caller-declared sign/revoke fee. Prevents a client-side
/// bug or a malicious integrator from draining the user's USDC via a
/// pathologically large declared fee. $1,000 cap is well above the 0.1% of
/// any realistic intent cap ($1M intent × 0.1% = $1,000).
pub const MAX_DECLARED_FEE_MICRO: u64 = 1_000_000_000; // $1,000

// ════════════════════════════════════════════════════════════════════════════
// Trust hardening (added 2026-04) — time-lock + guardian + oracle sanity
// ════════════════════════════════════════════════════════════════════════════

/// Mandatory delay in slots between `propose_admin_action` and
/// `execute_admin_action`. 216,000 slots ≈ 24h at 2.5 slots/sec on mainnet.
/// Gives the community + guardian a window to detect and veto malicious
/// admin actions before they land on-chain.
pub const ADMIN_ACTION_DELAY_SLOTS: u64 = 216_000;

/// Maximum allowed divergence between Pyth `price` and `ema_price` in the
/// SAME PriceUpdateV2 account, expressed in basis points. 200 = 2%.
/// Above this, execute_with_intent_proof reverts with `OracleSpotEmaDeviation`
/// — catches flash oracle manipulation (the publisher reports an extreme spot
/// while the EMA — smoothed over ~30s — is unchanged).
///
/// Defense-in-depth only. A sustained compromise of the Pyth publisher
/// network would push both spot and EMA together and would not trip this
/// check. See docs/DUAL_ORACLE_SPEC.md for the Switchboard integration that
/// defends against publisher-network compromise.
pub const MAX_PYTH_EMA_DEVIATION_BPS: u64 = 200;

// ────────────────────────────────────────────────────────────────────────
// C-full · Dual oracle (Pyth + Switchboard) constants
// ────────────────────────────────────────────────────────────────────────

/// Switchboard On-Demand program ID — DEVNET build.
///
/// NOTE: Switchboard On-Demand uses different program IDs per cluster,
/// verified against `@switchboard-xyz/on-demand` SDK `utils/index.js`:
///   · devnet:  Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2
///   · mainnet: SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv
/// Since the on-chain binary is currently devnet-only, we hardcode the
/// devnet PID. Mainnet migration (per docs/SQUADS_MIGRATION_RUNBOOK.md)
/// will require swapping this constant and redeploying under a new
/// program address.
pub const SWITCHBOARD_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");

/// Expected Switchboard feed hash for the canonical SOL/USD pull feed.
///
/// Read from the on-chain `PullFeedAccountData` at devnet feed pubkey
/// `GgGVgSLWAyL9Xf4fGaAQQCkmWetBjX7PCNz8kTK97DKB` via getAccountInfo on
/// 2026-04-22. The `feed_hash` field is at byte offset 2120 of the
/// account data (not 8 — the account starts with 32 × 64-byte
/// `OracleSubmission` entries + a 32-byte authority + a 32-byte queue
/// BEFORE feed_hash):
///   762ca1132d9071c754becd314da6bd4e91ac1ed681a136d7a0c06afa5ab86127
///
/// NOTE: the feed_hash is derived from the feed's OracleJob config and
/// is stable across updates as long as the job spec doesn't change.
/// Mainnet migration must re-read this constant from the mainnet SOL/USD
/// feed (which will likely differ).
pub const EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD: [u8; 32] = [
    0x76, 0x2c, 0xa1, 0x13, 0x2d, 0x90, 0x71, 0xc7,
    0x54, 0xbe, 0xcd, 0x31, 0x4d, 0xa6, 0xbd, 0x4e,
    0x91, 0xac, 0x1e, 0xd6, 0x81, 0xa1, 0x36, 0xd7,
    0xa0, 0xc0, 0x6a, 0xfa, 0x5a, 0xb8, 0x61, 0x27,
];

/// Maximum allowed divergence between Pyth and Switchboard, in basis points.
/// 100 bps = 1%.
///
/// Tighter than C-lite's 200 bps (spot-vs-EMA): two *independent* oracles
/// aggregated over similar time windows should agree much more closely
/// than one oracle's own spot-vs-smoothed values. A >1% cross-oracle
/// divergence is a strong signal that one side is compromised or stale.
pub const MAX_CROSS_ORACLE_DEVIATION_BPS: u64 = 100;

/// Admin action type codes stored in `PendingAdminAction.action_type`.
pub const ADMIN_ACTION_SET_PAUSED:  u8 = 1;
pub const ADMIN_ACTION_UPDATE_FEES: u8 = 2;
// Intentionally NOT including RotateAdmin — the IntentProtocol PDA seed
// is derived from `admin.key()` (see `InitializeProtocol` at
// `seeds = [b"sakura_intent_v3", admin.key().as_ref()]`), so rotating
// admin would orphan the account. Fixing this requires a separate PDA
// migration documented in docs/TRUST_HARDENING_DEPLOY.md.

/// Sakura — The Agentic Consumer Protocol (v0.3)
///
/// An intent-execution protocol for Solana DeFi. Users sign an intent once
/// (natural language + structured policy bounds). AI agents (Claude Skills
/// via SAK) execute actions on the user's behalf, and every action is
/// gated by a Groth16 ZK proof that `action ⊆ user_signed_intent`.
///
/// Unlike the v0.2 mutual-insurance model which proved a single predicate
/// (HF < trigger) for a single use case (liquidation rescue), v0.3 proves
/// the general predicate for any DeFi action: lending, borrowing, repay,
/// swap, yield-rebalance, etc.
///
/// Program architecture:
///   IntentProtocol PDA  — global config (admin, fee params, paused flag)
///   Intent PDA          — user's signed intent (per-user, commitment-bound)
///   ActionRecord PDA    — per-action audit trail (seeded by intent+nonce)
///
/// Instruction set:
///   initialize_protocol       — admin setup (once per deployment)
///   rotate_admin              — admin key rotation
///   set_paused                — emergency stop
///   sign_intent               — user signs an intent, commits bounds
///   revoke_intent             — user revokes an active intent
///   execute_with_intent_proof — execute an action, ZK-gated on intent
///
/// Security invariants:
///   I1  ZK pairing check passes via Solana alt_bn128 syscall
///   I2  Poseidon-tree commitment binds intent to exact wallet, nonce, bounds
///   I3  action_amount, action_type, action_target_index are all constrained
///       by the circuit to be ⊂ intent's max_amount, allowed_types, allowed
///       protocols — enforced by circuit C2/C3/C4
///   I4  action USD value bounded by max_usd_value via oracle price (C5)
///   I5  Pyth account owner/feed_id/posted_slot verified on-chain
///   I6  ActionRecord PDA init prevents replay per (intent, action_nonce)
///   I7  Intent.is_active flag guards against using revoked intents
///   I8  Only admin may pause / rotate / adjust fee params
#[program]
pub mod sakura_insurance {
    use super::*;

    // ──────────────────────────────────────────────────────────────────
    // ADMIN
    // ──────────────────────────────────────────────────────────────────

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        execution_fee_bps: u16,    // bps per intent execution (e.g. 10 = 0.1%)
        platform_fee_bps: u16,     // bps of execution_fee that goes to treasury
    ) -> Result<()> {
        require!(execution_fee_bps <= 200, IntentErr::InvalidParam); // max 2%
        require!(platform_fee_bps <= 10_000, IntentErr::InvalidParam);

        let p = &mut ctx.accounts.protocol;
        p.admin = ctx.accounts.admin.key();
        p.usdc_mint = ctx.accounts.usdc_mint.key();
        p.fee_vault = ctx.accounts.fee_vault.key();
        p.platform_treasury = ctx.accounts.platform_treasury.key();
        p.execution_fee_bps = execution_fee_bps;
        p.platform_fee_bps = platform_fee_bps;
        p.total_intents_signed = 0;
        p.total_actions_executed = 0;
        p.paused = false;
        p.bump = ctx.bumps.protocol;

        emit!(ProtocolInitialized {
            admin: p.admin,
            execution_fee_bps,
            platform_fee_bps,
        });
        Ok(())
    }

    pub fn rotate_admin(ctx: Context<AdminOnly>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.protocol.admin = new_admin;
        emit!(AdminRotated { new_admin });
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.protocol.paused = paused;
        emit!(ProtocolPauseToggled { paused });
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────
    // USER — sign / revoke intent
    // ──────────────────────────────────────────────────────────────────

    /// Sign an intent. Creates an `Intent` PDA holding the Poseidon-tree
    /// commitment over (intent_text_hash, wallet, nonce, max_amount,
    /// max_usd_value, allowed_protocols, allowed_action_types).
    ///
    /// The commitment is what the ZK proof will open against. The user
    /// keeps the underlying bounds as private witness — the on-chain
    /// commitment reveals nothing about max_amount, etc.
    pub fn sign_intent(
        ctx: Context<SignIntent>,
        intent_commitment: [u8; 32],
        expires_at: i64,
        fee_micro: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol.paused, IntentErr::Paused);
        require!(intent_commitment != [0u8; 32], IntentErr::CommitmentMissing);
        require!(fee_micro > 0, IntentErr::InvalidParam);
        require!(fee_micro <= MAX_DECLARED_FEE_MICRO, IntentErr::InvalidParam);

        let now = Clock::get()?.unix_timestamp;
        require!(expires_at > now, IntentErr::AlreadyExpired);
        require!(
            expires_at - now <= 365 * 24 * 3_600,
            IntentErr::InvalidParam
        );

        // Fee transfer: user's USDC ATA → protocol fee vault.
        // Caller is expected to compute `fee_micro = 0.1% × max_usd_value`
        // (where max_usd_value is the user's private intent bound). The
        // program enforces upper ceiling only — the honor-system is
        // acceptable because the user is paying themselves; lying only
        // underpays the protocol, not the user.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_ata.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            fee_micro,
        )?;

        let intent = &mut ctx.accounts.intent;
        if intent.user == Pubkey::default() {
            // First-time signing
            intent.user = ctx.accounts.user.key();
            intent.signed_at = now;
            intent.actions_executed = 0;
        } else {
            // Rotating intent — same user must own existing PDA
            require!(intent.user == ctx.accounts.user.key(), IntentErr::WrongUser);
        }

        intent.intent_commitment = intent_commitment;
        intent.expires_at = expires_at;
        intent.is_active = true;
        intent.bump = ctx.bumps.intent;

        let protocol = &mut ctx.accounts.protocol;
        protocol.total_intents_signed = protocol
            .total_intents_signed
            .checked_add(1)
            .ok_or(IntentErr::Overflow)?;

        emit!(IntentSigned {
            user: intent.user,
            intent_commitment,
            expires_at,
            signed_at: now,
            fee_micro,
        });
        Ok(())
    }

    /// Revoke an active intent. After revocation, no more actions can be
    /// executed against this intent (Intent.is_active = false).
    ///
    /// A per-revocation fee is charged at the same rate as sign_intent
    /// (0.1% of the intent's max_usd_value, declared by the caller).
    /// The fee captures the operational cost of the revocation event and
    /// aligns the economics of opening and closing a policy.
    pub fn revoke_intent(
        ctx: Context<RevokeIntent>,
        fee_micro: u64,
    ) -> Result<()> {
        require!(fee_micro > 0, IntentErr::InvalidParam);
        require!(fee_micro <= MAX_DECLARED_FEE_MICRO, IntentErr::InvalidParam);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_ata.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            fee_micro,
        )?;

        let intent = &mut ctx.accounts.intent;
        require!(intent.is_active, IntentErr::IntentInactive);
        intent.is_active = false;

        emit!(IntentRevoked {
            user: intent.user,
            actions_executed: intent.actions_executed,
            fee_micro,
        });
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────
    // EXECUTE — ZK-verified intent-bounded action
    // ──────────────────────────────────────────────────────────────────

    /// Execute an action gated by a Groth16 proof of `action ⊂ intent`.
    ///
    /// The actual DeFi action (Kamino borrow, MarginFi repay, Jupiter swap,
    /// etc.) is performed by subsequent instructions in the same atomic v0
    /// transaction. This instruction's role is purely POLICY VERIFICATION:
    ///   1. Verify the ZK proof via alt_bn128 pairing
    ///   2. Verify the oracle price matches Pyth at the claimed slot
    ///   3. Write an ActionRecord for audit
    ///
    /// If this instruction fails, the whole atomic tx reverts and the
    /// DeFi action never happens.
    ///
    /// Public inputs to the ZK verifier (must match circom `public` list):
    ///   [0] intent_commitment      (policy.intent_commitment)
    ///   [1] action_type            (u8)
    ///   [2] action_amount          (u64 micro-units)
    ///   [3] action_target_index    (u8)
    ///   [4] oracle_price_usd_micro (u64)
    ///   [5] oracle_slot            (u64)
    #[allow(clippy::too_many_arguments)]
    pub fn execute_with_intent_proof(
        ctx: Context<ExecuteWithIntentProof>,
        action_nonce: u64,
        action_type: u8,
        action_amount: u64,
        action_target_index: u8,
        oracle_price_usd_micro: u64,
        oracle_slot: u64,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
    ) -> Result<()> {
        require!(!ctx.accounts.protocol.paused, IntentErr::Paused);

        let intent = &mut ctx.accounts.intent;
        require!(intent.is_active, IntentErr::IntentInactive);

        let now = Clock::get()?.unix_timestamp;
        require!(now <= intent.expires_at, IntentErr::IntentExpired);

        // ── Oracle freshness window: Pyth slot within last 150 (~60s) ──
        let current_slot = Clock::get()?.slot;
        require!(
            current_slot >= oracle_slot && current_slot - oracle_slot <= 150,
            IntentErr::OracleSlotStale
        );

        // ── Verify Pyth price matches what's on-chain at the claimed slot ──
        //
        // We parse the Pyth `PriceUpdateV2` account layout inline (same as
        // v0.2 claim path). This ensures oracle_price_usd_micro (which is a
        // public input to the ZK proof) cannot be forged — the on-chain
        // verifier cross-checks it against Pyth at oracle_slot.
        //
        // Layout (134 bytes for Full verification level):
        //    8  anchor_discriminator
        //   32  write_authority
        //    1  verification_level tag (0=Partial{+u8}, 1=Full)
        //   32  feed_id
        //    8  price (i64 LE)
        //    8  conf (u64 LE)
        //    4  exponent (i32 LE)
        //    8  publish_time
        //    8  prev_publish_time
        //    8  ema_price
        //    8  ema_conf
        //    8  posted_slot (u64 LE)
        let pyth_price_micro: u64 = {
            let acct = &ctx.accounts.pyth_price_account;

            // (a) Owner check — only real Pyth Receiver writes these accounts
            require!(
                acct.owner == &PYTH_RECEIVER_PROGRAM_ID,
                IntentErr::PythAccountInvalid
            );

            let data = acct.try_borrow_data()?;
            require!(
                data.len() >= 8 + 32 + 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8 + 8,
                IntentErr::PythAccountInvalid
            );

            let mut o: usize = 8 + 32;
            let tag = data[o];
            o += 1;
            // tag = 0 → Partial(num_signatures: u8)  (extra byte)
            // tag = 1 → Full                         (no payload)
            if tag == 0 {
                o += 1;
            } else if tag != 1 {
                return err!(IntentErr::PythAccountInvalid);
            }

            // (b) feed_id check — must be SOL/USD
            let feed_id_slice = &data[o..o + 32];
            require!(
                feed_id_slice == EXPECTED_FEED_ID_SOL_USD.as_slice(),
                IntentErr::PythFeedIdMismatch
            );
            o += 32;

            let price_i64 = i64::from_le_bytes(
                data[o..o + 8].try_into().map_err(|_| error!(IntentErr::PythAccountInvalid))?,
            );
            o += 8;
            o += 8; // conf
            let exponent = i32::from_le_bytes(
                data[o..o + 4].try_into().map_err(|_| error!(IntentErr::PythAccountInvalid))?,
            );
            o += 4;
            // publish_time (8) + prev_publish_time (8) — skip
            o += 16;
            // ema_price (i64 LE, 8) — READ for C-lite sanity check
            let ema_price_i64 = i64::from_le_bytes(
                data[o..o + 8].try_into().map_err(|_| error!(IntentErr::PythAccountInvalid))?,
            );
            o += 8;
            // ema_conf (8) — skip
            o += 8;
            let posted_slot = u64::from_le_bytes(
                data[o..o + 8].try_into().map_err(|_| error!(IntentErr::PythAccountInvalid))?,
            );

            // ── C-lite · spot-vs-EMA deviation sanity ──
            // Defense-in-depth against flash oracle manipulation: a publisher
            // that reports an extreme spot (while the ~30s EMA lags) gets
            // rejected. Does NOT defend against sustained publisher-network
            // compromise; see docs/DUAL_ORACLE_SPEC.md for that.
            require!(ema_price_i64 > 0, IntentErr::OraclePriceMismatch);
            let ema_abs = ema_price_i64 as u64;
            // spot vs ema deviation: |price - ema| * 10_000 / max(price, ema) ≤ MAX_BPS
            let diff = if price_i64 as u64 > ema_abs {
                (price_i64 as u64) - ema_abs
            } else {
                ema_abs - (price_i64 as u64)
            };
            let max_side = core::cmp::max(price_i64 as u64, ema_abs);
            let deviation_bps = diff
                .checked_mul(10_000)
                .ok_or(IntentErr::Overflow)?
                .checked_div(max_side.max(1))
                .unwrap_or(0);
            require!(
                deviation_bps <= MAX_PYTH_EMA_DEVIATION_BPS,
                IntentErr::OracleSpotEmaDeviation
            );

            require!(posted_slot == oracle_slot, IntentErr::OraclePriceMismatch);
            require!(price_i64 > 0, IntentErr::OraclePriceMismatch);
            let price_abs = price_i64 as u64;

            // Scale Pyth price → micro-USD. exp usually -8, target scale 1e6
            //   price_micro = price_abs × 10^(6 + exp)
            let adj: i32 = 6 + exponent;
            let computed_micro: u64 = if adj >= 0 {
                let mul = 10u64
                    .checked_pow(adj as u32)
                    .ok_or(IntentErr::Overflow)?;
                price_abs.checked_mul(mul).ok_or(IntentErr::Overflow)?
            } else {
                let div = 10u64
                    .checked_pow((-adj) as u32)
                    .ok_or(IntentErr::Overflow)?;
                price_abs / div
            };

            // Return the Pyth-side micro-USD price. The final equality check
            // against `oracle_price_usd_micro` is deferred until after the
            // Switchboard cross-check so that the public input is verified
            // as the MEDIAN of both oracles, not just Pyth alone.
            computed_micro
        };

        // ── C-full · Dual oracle cross-check: Pyth vs Switchboard ──
        //
        // Defense against sustained Pyth publisher-network compromise.
        // C-lite above catches flash manipulation (spot vs EMA inside the
        // Pyth account) but cannot defend against enough Pyth publishers
        // colluding or being breached — at that point both `price` and
        // `ema_price` move together. Switchboard On-Demand is an
        // independent publisher network, organizationally and
        // infrastructurally separate; a coordinated attack would need to
        // compromise BOTH networks simultaneously.
        //
        // See docs/DUAL_ORACLE_SPEC.md for the full threat model.
        let sb_price_micro: u64 = {
            let sb_acct = &ctx.accounts.switchboard_price_account;

            // (a) Owner check — only the Switchboard On-Demand program
            //     writes these accounts
            require!(
                sb_acct.owner == &SWITCHBOARD_PROGRAM_ID,
                IntentErr::SwitchboardAccountInvalid
            );

            let sb_data = sb_acct.try_borrow_data()?;

            // Parse via the `switchboard-on-demand` crate (v0.3.8).
            // Using the crate's own parser (vs manual byte offsets) keeps
            // this code resilient to SDK layout updates.
            let sb_feed = PullFeedAccountData::parse(sb_data)
                .map_err(|_| error!(IntentErr::SwitchboardAccountInvalid))?;

            // (b) feed_hash check — must be the canonical SOL/USD feed
            require!(
                sb_feed.feed_hash == EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD,
                IntentErr::SwitchboardFeedHashMismatch
            );

            // (c) Current aggregated value → micro-USD.
            // Uses `PullFeedAccountData::value(&Clock)` which returns
            // `Result<Decimal, OnDemandError>` — the Err arm fires when the
            // feed is stale relative to `max_staleness` configured on-chain,
            // which is exactly the semantic we want (reject stale values).
            let clock = Clock::get()?;
            let sb_value = sb_feed
                .value(&clock)
                .map_err(|_| error!(IntentErr::SwitchboardNoValue))?;
            decimal_to_micro(sb_value)?
        };

        // Cross-oracle deviation · Pyth and Switchboard must agree within 1%
        let cross_diff = if pyth_price_micro > sb_price_micro {
            pyth_price_micro - sb_price_micro
        } else {
            sb_price_micro - pyth_price_micro
        };
        let cross_max = core::cmp::max(pyth_price_micro, sb_price_micro);
        let cross_bps = cross_diff
            .checked_mul(10_000)
            .ok_or(IntentErr::Overflow)?
            .checked_div(cross_max.max(1))
            .unwrap_or(0);
        require!(
            cross_bps <= MAX_CROSS_ORACLE_DEVIATION_BPS,
            IntentErr::CrossOracleDeviation
        );

        // The circuit public input `oracle_price_usd_micro` must equal the
        // MEDIAN of Pyth and Switchboard (with exactly two oracles, median
        // = arithmetic mean). Client computes this median off-chain and
        // passes it as the public input; on-chain we verify equality with
        // ±1 micro-USD tolerance for rounding.
        let effective_price_micro = (pyth_price_micro + sb_price_micro) / 2;
        let final_diff = if effective_price_micro > oracle_price_usd_micro {
            effective_price_micro - oracle_price_usd_micro
        } else {
            oracle_price_usd_micro - effective_price_micro
        };
        require!(final_diff <= 1, IntentErr::OraclePriceMismatch);

        // ── Groth16 pairing verification via alt_bn128 syscall ──
        //
        // Public inputs MUST be in the exact order specified by the
        // circuit's `public` list in circuits/src/intent_proof.circom:
        //   [0] intent_commitment
        //   [1] action_type
        //   [2] action_amount
        //   [3] action_target_index
        //   [4] oracle_price_usd_micro
        //   [5] oracle_slot
        let pub0 = intent.intent_commitment;
        let mut pub1 = [0u8; 32];
        pub1[31] = action_type;
        let mut pub2 = [0u8; 32];
        pub2[24..32].copy_from_slice(&action_amount.to_be_bytes());
        let mut pub3 = [0u8; 32];
        pub3[31] = action_target_index;
        let mut pub4 = [0u8; 32];
        pub4[24..32].copy_from_slice(&oracle_price_usd_micro.to_be_bytes());
        let mut pub5 = [0u8; 32];
        pub5[24..32].copy_from_slice(&oracle_slot.to_be_bytes());
        let public_inputs = [pub0, pub1, pub2, pub3, pub4, pub5];

        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs,
            &VERIFYINGKEY,
        )
        .map_err(|_| error!(IntentErr::ZkProofMalformed))?;

        verifier
            .verify()
            .map_err(|_| error!(IntentErr::ZkProofInvalid))?;
        // ─────────────────────────────────────────────────────────────

        // ── Write ActionRecord for on-chain audit trail ──
        let record = &mut ctx.accounts.action_record;
        record.intent = intent.key();
        record.action_nonce = action_nonce;
        record.action_type = action_type;
        record.action_amount = action_amount;
        record.action_target_index = action_target_index;
        record.oracle_price_usd_micro = oracle_price_usd_micro;
        record.oracle_slot = oracle_slot;
        record.ts = now;
        // keccak256(proof_a || proof_c) as forensic fingerprint
        let mut fp_src = [0u8; 128];
        fp_src[..64].copy_from_slice(&proof_a);
        fp_src[64..].copy_from_slice(&proof_c);
        record.proof_fingerprint =
            anchor_lang::solana_program::keccak::hash(&fp_src).to_bytes();
        record.bump = ctx.bumps.action_record;

        intent.actions_executed = intent
            .actions_executed
            .checked_add(1)
            .ok_or(IntentErr::Overflow)?;

        let protocol = &mut ctx.accounts.protocol;
        protocol.total_actions_executed = protocol
            .total_actions_executed
            .checked_add(1)
            .ok_or(IntentErr::Overflow)?;

        // Flat execution fee: $0.01 per verified action.
        // Rationale: the gate's value is proportional to the number of
        // actions passing through it, not the notional size of each.
        // A flat fee eliminates the fork-bait at large notionals that
        // a percentage model would create. See docs/VALUE_CAPTURE.md.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_usdc_ata.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            EXECUTE_ACTION_FEE_MICRO,
        )?;

        emit!(ActionExecuted {
            intent: intent.key(),
            user: intent.user,
            action_type,
            action_amount,
            action_target_index,
            oracle_price_usd_micro,
            oracle_slot,
            action_nonce,
            actions_executed: intent.actions_executed,
            fee_micro: EXECUTE_ACTION_FEE_MICRO,
        });
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────
    // TRUST HARDENING — guardian registration + time-locked admin actions
    // ──────────────────────────────────────────────────────────────────

    /// One-time setup: register a guardian Pubkey who can veto any
    /// pending admin action within the delay window. Guardian should be
    /// held by a different principal than the admin keypair/multisig —
    /// otherwise the veto is cosmetic.
    pub fn initialize_guardian(
        ctx: Context<InitializeGuardian>,
        guardian: Pubkey,
    ) -> Result<()> {
        let g = &mut ctx.accounts.guardian_pda;
        g.protocol = ctx.accounts.protocol.key();
        g.guardian = guardian;
        g.bump = ctx.bumps.guardian_pda;
        emit!(GuardianInitialized { guardian });
        Ok(())
    }

    /// Admin proposes a sensitive action. Creates a `PendingAdminAction`
    /// PDA; the action can only be executed after ADMIN_ACTION_DELAY_SLOTS
    /// slots (~24h). The delay window gives the guardian + the wider
    /// community a chance to detect and cancel malicious proposals.
    pub fn propose_admin_action(
        ctx: Context<ProposeAdminAction>,
        action_id: u64,
        action_type: u8,
        payload: [u8; 32],
    ) -> Result<()> {
        require!(
            action_type == ADMIN_ACTION_SET_PAUSED
                || action_type == ADMIN_ACTION_UPDATE_FEES,
            IntentErr::InvalidActionType
        );
        let now_slot = Clock::get()?.slot;
        let p = &mut ctx.accounts.pending;
        p.protocol          = ctx.accounts.protocol.key();
        p.action_id         = action_id;
        p.action_type       = action_type;
        p.payload           = payload;
        p.proposed_at_slot  = now_slot;
        p.effective_slot    = now_slot
            .checked_add(ADMIN_ACTION_DELAY_SLOTS)
            .ok_or(IntentErr::Overflow)?;
        p.executed          = false;
        p.cancelled         = false;
        p.bump              = ctx.bumps.pending;
        emit!(AdminActionProposed {
            action_id,
            action_type,
            effective_slot: p.effective_slot,
        });
        Ok(())
    }

    /// Admin executes a previously-proposed action. Only succeeds after
    /// `effective_slot` is reached and neither `executed` nor `cancelled`
    /// flags are set.
    pub fn execute_admin_action(
        ctx: Context<ExecuteAdminAction>,
        action_id: u64,
    ) -> Result<()> {
        let now_slot = Clock::get()?.slot;
        let p = &mut ctx.accounts.pending;
        require!(!p.cancelled, IntentErr::ActionCancelled);
        require!(!p.executed,  IntentErr::ActionAlreadyExecuted);
        require!(now_slot >= p.effective_slot, IntentErr::ActionNotEffective);
        require!(p.action_id == action_id, IntentErr::InvalidParam);

        let protocol = &mut ctx.accounts.protocol;
        match p.action_type {
            ADMIN_ACTION_SET_PAUSED => {
                let new_paused = p.payload[0] != 0;
                protocol.paused = new_paused;
                emit!(ProtocolPauseToggled { paused: new_paused });
            }
            ADMIN_ACTION_UPDATE_FEES => {
                // payload layout: bytes [0..2] = execution_fee_bps (u16 LE),
                //                  bytes [2..4] = platform_fee_bps  (u16 LE)
                let exec_bps = u16::from_le_bytes(
                    p.payload[0..2].try_into().map_err(|_| error!(IntentErr::InvalidParam))?
                );
                let plat_bps = u16::from_le_bytes(
                    p.payload[2..4].try_into().map_err(|_| error!(IntentErr::InvalidParam))?
                );
                require!(exec_bps <= 200,    IntentErr::InvalidParam);
                require!(plat_bps <= 10_000, IntentErr::InvalidParam);
                protocol.execution_fee_bps = exec_bps;
                protocol.platform_fee_bps  = plat_bps;
            }
            _ => return err!(IntentErr::InvalidActionType),
        }
        p.executed = true;
        emit!(AdminActionExecuted { action_id });
        Ok(())
    }

    /// Guardian (and only guardian) cancels a pending admin action.
    /// Useful as an emergency brake if admin key is compromised and a
    /// malicious action is proposed — guardian stops it before the delay
    /// window elapses.
    pub fn cancel_admin_action(
        ctx: Context<CancelAdminAction>,
        action_id: u64,
    ) -> Result<()> {
        let p = &mut ctx.accounts.pending;
        require!(!p.executed,  IntentErr::ActionAlreadyExecuted);
        require!(!p.cancelled, IntentErr::ActionCancelled);
        require!(p.action_id == action_id, IntentErr::InvalidParam);
        p.cancelled = true;
        emit!(AdminActionCancelled { action_id });
        Ok(())
    }
}

// ══════════════════════════════════════════════════════════════════════════
// Accounts
// ══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + IntentProtocol::LEN,
        seeds = [b"sakura_intent_v3", admin.key().as_ref()],
        bump,
    )]
    pub protocol: Box<Account<'info, IntentProtocol>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = protocol,
        seeds = [b"sakura_fee_vault", protocol.key().as_ref()],
        bump,
    )]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    /// Platform treasury — receives platform fee cut
    #[account(mut, token::mint = usdc_mint)]
    pub platform_treasury: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, IntentProtocol>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SignIntent<'info> {
    #[account(
        mut,
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = fee_vault,
    )]
    pub protocol: Box<Account<'info, IntentProtocol>>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Intent::LEN,
        seeds = [b"sakura_intent_account", user.key().as_ref()],
        bump,
    )]
    pub intent: Box<Account<'info, Intent>>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's USDC ATA — source of the 0.1% sign fee.
    #[account(
        mut,
        token::mint = protocol.usdc_mint,
        token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// Protocol fee vault — destination of the sign fee.
    #[account(mut)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeIntent<'info> {
    #[account(
        mut,
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = fee_vault,
    )]
    pub protocol: Box<Account<'info, IntentProtocol>>,

    #[account(
        mut,
        seeds = [b"sakura_intent_account", user.key().as_ref()],
        bump = intent.bump,
        has_one = user,
    )]
    pub intent: Box<Account<'info, Intent>>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's USDC ATA — source of the 0.1% revoke fee.
    #[account(
        mut,
        token::mint = protocol.usdc_mint,
        token::authority = user,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(action_nonce: u64)]
pub struct ExecuteWithIntentProof<'info> {
    #[account(
        mut,
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = fee_vault,
    )]
    pub protocol: Box<Account<'info, IntentProtocol>>,

    #[account(
        mut,
        seeds = [b"sakura_intent_account", intent.user.as_ref()],
        bump = intent.bump,
    )]
    pub intent: Box<Account<'info, Intent>>,

    /// Payer sponsors rent for ActionRecord AND the flat execution fee.
    /// Does NOT gate execution — the ZK proof is the only authority source.
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + ActionRecord::LEN,
        seeds = [
            b"sakura_action",
            intent.key().as_ref(),
            &action_nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub action_record: Box<Account<'info, ActionRecord>>,

    /// Payer's USDC ATA — source of the flat $0.01 execution fee.
    #[account(
        mut,
        token::mint = protocol.usdc_mint,
        token::authority = payer,
    )]
    pub payer_usdc_ata: Box<Account<'info, TokenAccount>>,

    /// Protocol fee vault — destination of the execution fee.
    #[account(mut)]
    pub fee_vault: Box<Account<'info, TokenAccount>>,

    /// Pyth `PriceUpdateV2` account. Handler enforces:
    ///   • account.owner == PYTH_RECEIVER_PROGRAM_ID    (spoofing guard)
    ///   • price_message.feed_id == EXPECTED_FEED_ID_SOL_USD (wrong-asset guard)
    ///   • posted_slot == oracle_slot                   (replay guard)
    ///   • |price_i64 × 10^(6+exp) − pyth_price_micro| ≤ 1  (encoding guard)
    ///   • |price − ema_price| / max ≤ 2%   (C-lite spot-vs-EMA sanity)
    /// CHECK: owner + layout validated by handler
    pub pyth_price_account: UncheckedAccount<'info>,

    /// Switchboard On-Demand `PullFeedAccountData`. Handler enforces:
    ///   • account.owner == SWITCHBOARD_PROGRAM_ID         (spoofing guard)
    ///   • feed_hash == EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD
    ///   • |pyth_price_micro − sb_price_micro| / max ≤ 1%  (C-full cross-oracle)
    ///   • oracle_price_usd_micro ≈ (pyth + sb) / 2        (median forgery guard)
    /// CHECK: owner + layout validated by handler via PullFeedAccountData::parse
    pub switchboard_price_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ══════════════════════════════════════════════════════════════════════════
// Trust-hardening accounts (Guardian + time-locked admin actions)
// ══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct InitializeGuardian<'info> {
    #[account(
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, IntentProtocol>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Guardian::LEN,
        seeds = [b"sakura_guardian", protocol.key().as_ref()],
        bump,
    )]
    pub guardian_pda: Account<'info, Guardian>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_id: u64)]
pub struct ProposeAdminAction<'info> {
    #[account(
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, IntentProtocol>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PendingAdminAction::LEN,
        seeds = [b"sakura_pending", protocol.key().as_ref(), &action_id.to_le_bytes()],
        bump,
    )]
    pub pending: Account<'info, PendingAdminAction>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_id: u64)]
pub struct ExecuteAdminAction<'info> {
    #[account(
        mut,
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, IntentProtocol>,

    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sakura_pending", protocol.key().as_ref(), &action_id.to_le_bytes()],
        bump = pending.bump,
    )]
    pub pending: Account<'info, PendingAdminAction>,
}

#[derive(Accounts)]
#[instruction(action_id: u64)]
pub struct CancelAdminAction<'info> {
    #[account(
        seeds = [b"sakura_intent_v3", protocol.admin.as_ref()],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, IntentProtocol>,

    #[account(
        seeds = [b"sakura_guardian", protocol.key().as_ref()],
        bump = guardian_pda.bump,
        constraint = guardian_pda.guardian == guardian_signer.key() @ IntentErr::NotGuardian,
    )]
    pub guardian_pda: Account<'info, Guardian>,

    pub guardian_signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sakura_pending", protocol.key().as_ref(), &action_id.to_le_bytes()],
        bump = pending.bump,
    )]
    pub pending: Account<'info, PendingAdminAction>,
}

// ══════════════════════════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════════════════════════

#[account]
pub struct IntentProtocol {
    pub admin: Pubkey,                   // 32
    pub usdc_mint: Pubkey,               // 32
    pub fee_vault: Pubkey,               // 32
    pub platform_treasury: Pubkey,       // 32
    pub total_intents_signed: u64,       // 8
    pub total_actions_executed: u64,     // 8
    pub execution_fee_bps: u16,          // 2
    pub platform_fee_bps: u16,           // 2
    pub paused: bool,                    // 1
    pub bump: u8,                        // 1
}
impl IntentProtocol {
    pub const LEN: usize = 32 * 4 + 8 * 2 + 2 * 2 + 1 + 1;
}

#[account]
pub struct Intent {
    pub user: Pubkey,                    // 32
    pub intent_commitment: [u8; 32],     // 32  Poseidon-tree(text,wallet,nonce,bounds...)
    pub signed_at: i64,                  // 8
    pub expires_at: i64,                 // 8
    pub actions_executed: u64,           // 8
    pub is_active: bool,                 // 1
    pub bump: u8,                        // 1
}
impl Intent {
    pub const LEN: usize = 32 + 32 + 8 * 3 + 1 + 1;
}

#[account]
pub struct ActionRecord {
    pub intent: Pubkey,                  // 32
    pub action_nonce: u64,               // 8
    pub action_type: u8,                 // 1
    pub action_amount: u64,              // 8
    pub action_target_index: u8,         // 1
    pub oracle_price_usd_micro: u64,     // 8
    pub oracle_slot: u64,                // 8
    pub ts: i64,                         // 8
    pub proof_fingerprint: [u8; 32],     // 32
    pub bump: u8,                        // 1
}
impl ActionRecord {
    pub const LEN: usize = 32 + 8 + 1 + 8 + 1 + 8 + 8 + 8 + 32 + 1;
}

#[account]
pub struct Guardian {
    pub protocol: Pubkey,                // 32 — which protocol this guards
    pub guardian: Pubkey,                // 32 — the guardian keypair / vault
    pub bump: u8,                        // 1
}
impl Guardian {
    pub const LEN: usize = 32 + 32 + 1;
}

#[account]
pub struct PendingAdminAction {
    pub protocol: Pubkey,                // 32
    pub action_id: u64,                  // 8
    pub action_type: u8,                 // 1 (ADMIN_ACTION_*)
    pub payload: [u8; 32],               // 32 — action-specific data
    pub proposed_at_slot: u64,           // 8
    pub effective_slot: u64,             // 8
    pub executed: bool,                  // 1
    pub cancelled: bool,                 // 1
    pub bump: u8,                        // 1
}
impl PendingAdminAction {
    pub const LEN: usize = 32 + 8 + 1 + 32 + 8 + 8 + 1 + 1 + 1;
}

// ══════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════

#[event]
pub struct ProtocolInitialized {
    pub admin: Pubkey,
    pub execution_fee_bps: u16,
    pub platform_fee_bps: u16,
}

#[event]
pub struct AdminRotated {
    pub new_admin: Pubkey,
}

#[event]
pub struct ProtocolPauseToggled {
    pub paused: bool,
}

#[event]
pub struct IntentSigned {
    pub user: Pubkey,
    pub intent_commitment: [u8; 32],
    pub expires_at: i64,
    pub signed_at: i64,
    pub fee_micro: u64,
}

#[event]
pub struct IntentRevoked {
    pub user: Pubkey,
    pub actions_executed: u64,
    pub fee_micro: u64,
}

#[event]
pub struct ActionExecuted {
    pub intent: Pubkey,
    pub user: Pubkey,
    pub action_type: u8,
    pub action_amount: u64,
    pub action_target_index: u8,
    pub oracle_price_usd_micro: u64,
    pub oracle_slot: u64,
    pub action_nonce: u64,
    pub actions_executed: u64,
    pub fee_micro: u64,
}

#[event]
pub struct GuardianInitialized {
    pub guardian: Pubkey,
}

#[event]
pub struct AdminActionProposed {
    pub action_id: u64,
    pub action_type: u8,
    pub effective_slot: u64,
}

#[event]
pub struct AdminActionExecuted {
    pub action_id: u64,
}

#[event]
pub struct AdminActionCancelled {
    pub action_id: u64,
}

// ══════════════════════════════════════════════════════════════════════════
// Errors
// ══════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum IntentErr {
    #[msg("Invalid parameter")]                                 InvalidParam,
    #[msg("Protocol is paused")]                                Paused,
    #[msg("Arithmetic overflow")]                               Overflow,
    #[msg("Intent user mismatch")]                              WrongUser,
    #[msg("Intent is inactive / revoked")]                      IntentInactive,
    #[msg("Intent has expired")]                                IntentExpired,
    #[msg("Intent already expired")]                            AlreadyExpired,
    #[msg("Intent commitment must not be zero")]                CommitmentMissing,
    #[msg("Oracle slot too stale (>150 slots)")]                OracleSlotStale,
    #[msg("Groth16 proof malformed")]                           ZkProofMalformed,
    #[msg("Groth16 proof pairing check failed")]                ZkProofInvalid,
    #[msg("Pyth price account has invalid layout")]             PythAccountInvalid,
    #[msg("Pyth feed_id does not match expected SOL/USD feed")] PythFeedIdMismatch,
    #[msg("oracle_price / oracle_slot does not match Pyth")]    OraclePriceMismatch,
    #[msg("Token account owner mismatch")]                      WrongOwner,
    #[msg("Pyth spot vs EMA deviation exceeds 2%")]             OracleSpotEmaDeviation,
    // ── C-full · Dual oracle (Pyth + Switchboard) errors ──
    #[msg("Switchboard account owner is not the On-Demand program")]
    SwitchboardAccountInvalid,
    #[msg("Switchboard feed_hash does not match expected SOL/USD")]
    SwitchboardFeedHashMismatch,
    #[msg("Switchboard feed returned no current value")]
    SwitchboardNoValue,
    #[msg("Pyth vs Switchboard deviation exceeds 1%")]
    CrossOracleDeviation,
    #[msg("Guardian PDA already initialized")]                  GuardianAlreadyInit,
    #[msg("Caller is not the registered guardian")]             NotGuardian,
    #[msg("Admin action not yet effective (delay not reached)")] ActionNotEffective,
    #[msg("Admin action already executed")]                     ActionAlreadyExecuted,
    #[msg("Admin action cancelled")]                            ActionCancelled,
    #[msg("Unknown admin action_type")]                         InvalidActionType,
}

// ══════════════════════════════════════════════════════════════════════════
// Oracle helpers · C-full dual-oracle conversion
// ══════════════════════════════════════════════════════════════════════════

/// Convert a Switchboard On-Demand Decimal value to micro-USD (1e6 scaled).
///
/// Switchboard On-Demand v0.3.x returns `PullFeedAccountData::value()` as
/// `rust_decimal::Decimal` (re-exported at
/// `switchboard_on_demand::prelude::rust_decimal::Decimal`). A Decimal
/// encodes `mantissa × 10^(-scale)` where `mantissa: i128` and
/// `scale: u32` are accessed via methods (not fields).
///
/// We want: `micro_usd = value × 10^6 = mantissa × 10^(6 − scale)`.
fn decimal_to_micro(
    d: switchboard_on_demand::prelude::rust_decimal::Decimal,
) -> Result<u64> {
    let mantissa: i128 = d.mantissa();
    require!(mantissa > 0, IntentErr::OraclePriceMismatch);
    let mantissa_abs: u128 = mantissa as u128;
    let scale: i32 = d.scale() as i32;
    let adj: i32 = 6i32 - scale;

    let result: u128 = if adj >= 0 {
        let mul = 10u128
            .checked_pow(adj as u32)
            .ok_or(IntentErr::Overflow)?;
        mantissa_abs.checked_mul(mul).ok_or(IntentErr::Overflow)?
    } else {
        let div = 10u128
            .checked_pow((-adj) as u32)
            .ok_or(IntentErr::Overflow)?;
        mantissa_abs / div
    };

    require!(result <= u64::MAX as u128, IntentErr::Overflow);
    Ok(result as u64)
}
