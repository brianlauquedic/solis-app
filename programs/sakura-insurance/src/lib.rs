use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use groth16_solana::groth16::Groth16Verifier;

mod zk_verifying_key;
use zk_verifying_key::VERIFYINGKEY;

declare_id!("AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp");

// ════════════════════════════════════════════════════════════════════════════
// Oracle bindings (hardcoded — prevents attacker-supplied fake Pyth accounts)
// ════════════════════════════════════════════════════════════════════════════

/// Pyth Pull Oracle Receiver program ID (same across mainnet & devnet).
/// `pyth_price_account.owner` MUST equal this at claim time.
///
/// If Pyth rotates this program ID, update here and republish the program.
/// Reference: https://docs.pyth.network/price-feeds/contract-addresses/solana
pub const PYTH_RECEIVER_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

/// Pyth SOL/USD price feed ID (32 bytes, big-endian).
/// `price_message.feed_id` MUST equal this — otherwise an attacker could
/// present a cheaper asset's feed (e.g. a shitcoin that is $0.001) to spoof
/// a low price and trigger the health-factor inequality in the ZK circuit.
///
/// SOL/USD = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
/// Reference: https://pyth.network/developers/price-feed-ids (Solana → SOL/USD)
pub const EXPECTED_FEED_ID_SOL_USD: [u8; 32] = [
    0xef, 0x0d, 0x8b, 0x6f, 0xda, 0x2c, 0xeb, 0xa4,
    0x1d, 0xa1, 0x5d, 0x40, 0x95, 0xd1, 0xda, 0x39,
    0x2a, 0x0d, 0x2f, 0x8e, 0xd0, 0xc6, 0xc7, 0xbc,
    0x0f, 0x4c, 0xfa, 0xc8, 0xc2, 0x80, 0xb5, 0x6d,
];

/// Sakura Mutual — v0.2 (mutual-self-insurance, no external LP)
///
/// Users are BOTH policyholders AND underwriters. Buying a policy deposits:
///   • premium       → split: platform_fee_bps → treasury, remainder → pool
///   • stake (≥ min_stake_multiplier × premium) → pool, refundable at close
///
/// The pool's capital therefore grows with users, not with outside LPs. No
/// cold-start dependency on external liquidity. The stake mechanism gives
/// users skin-in-the-game against fraudulent claims (a bogus claim drains
/// their own stake alongside everyone else's).
///
/// Fraud prevention: every claim requires a Groth16 proof (circuit at
/// `circuits/src/liquidation_proof.circom`) that the caller knows a witness
/// binding to the committed obligation account with (collateral × price /
/// debt) < trigger. The oracle price is a PUBLIC input — the verifier cross-
/// checks it against Pyth at the same slot.
///
/// Security invariants (enforced on-chain):
///   I1  pool.total_stakes ≥ Σ policy.stake_usdc  (conservation)
///   I2  buy_policy requires stake ≥ min_stake_multiplier × premium
///   I3  buy_policy splits premium into platform_fee + pool_share
///   I4  close_policy refunds stake × (pool_vault / total_stakes) pro-rata
///       (pool may have lost value from claims — stake is last-loss tranche)
///   I5  claim_payout_with_zk_proof:
///         - ZK pairing check passes
///         - policy.commitment_hash matches proof's public input
///         - rescue_destination.owner == policy.user
///         - now ≥ policy.bought_at + waiting_period_sec (no just-in-time buys)
///         - new_total_claimed ≤ policy.coverage_cap_usdc
///         - amount ≤ rescue_bucket × 100 USDC
///         - oracle_slot within freshness window (caller provides Pyth
///           account; chain re-reads and verifies price matches proof)
///   I6  ClaimRecord PDA init prevents replay per (policy, nonce)
///   I7  max_coverage_per_user cap on buy_policy
///   I8  Only admin may pause / rotate agent / adjust parameters
///
/// Out of v0.2 scope (v1 roadmap):
///   - 2-of-3 admin multisig (use Squads externally for now)
///   - Dynamic premium pricing based on pool utilization
///   - Pyth CPI re-verification (wired via `pyth_price_account` but oracle
///     syscall/CPI integration deferred to v0.3 — see handler note)
#[program]
pub mod sakura_insurance {
    use super::*;

    // ──────────────────────────────────────────────────────────────────
    // ADMIN
    // ──────────────────────────────────────────────────────────────────

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        premium_bps: u16,                  // bps/month of coverage_cap
        platform_fee_bps: u16,             // bps of premium to treasury (e.g. 1500 = 15%)
        min_stake_multiplier: u16,         // stake ≥ this × premium (e.g. 500 = 5x)
        max_coverage_per_user_usdc: u64,   // per-user coverage cap (anti-concentration)
        waiting_period_sec: i64,           // seconds user must wait before claiming
    ) -> Result<()> {
        require!(premium_bps >= 1 && premium_bps <= 1_000, InsErr::InvalidParam);
        require!(platform_fee_bps <= 3_000, InsErr::InvalidParam); // max 30%
        require!(min_stake_multiplier >= 100, InsErr::InvalidParam); // min 1x
        require!(max_coverage_per_user_usdc > 0, InsErr::InvalidParam);
        require!(
            waiting_period_sec >= 0 && waiting_period_sec <= 30 * 24 * 3_600,
            InsErr::InvalidParam
        );

        let pool = &mut ctx.accounts.pool;
        pool.admin = ctx.accounts.admin.key();
        pool.admin_agent = ctx.accounts.admin_agent.key();
        pool.platform_treasury = ctx.accounts.platform_treasury.key();
        pool.usdc_mint = ctx.accounts.usdc_mint.key();
        pool.usdc_vault = ctx.accounts.usdc_vault.key();
        pool.total_stakes = 0;
        pool.coverage_outstanding = 0;
        pool.total_claims_paid = 0;
        pool.premium_bps = premium_bps;
        pool.platform_fee_bps = platform_fee_bps;
        pool.min_stake_multiplier = min_stake_multiplier;
        pool.max_coverage_per_user_usdc = max_coverage_per_user_usdc;
        pool.waiting_period_sec = waiting_period_sec;
        pool.paused = false;
        pool.bump = ctx.bumps.pool;

        emit!(PoolInitialized {
            admin: pool.admin,
            admin_agent: pool.admin_agent,
            premium_bps,
            platform_fee_bps,
            min_stake_multiplier,
            max_coverage_per_user_usdc,
            waiting_period_sec,
        });
        Ok(())
    }

    pub fn rotate_admin_agent(ctx: Context<AdminOnly>, new_agent: Pubkey) -> Result<()> {
        ctx.accounts.pool.admin_agent = new_agent;
        emit!(AdminAgentRotated { new_agent });
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.pool.paused = paused;
        emit!(PoolPauseToggled { paused });
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────
    // USER SIDE — buy / close
    // ──────────────────────────────────────────────────────────────────

    /// Buy (or renew) a mutual-insurance policy.
    ///
    /// Deposits:
    ///   • premium_amount_usdc  — split into platform_fee + pool share
    ///   • stake_amount_usdc    — refundable at close_policy (pro-rata)
    ///
    /// First-time: user must bind `commitment_hash` (Poseidon(obligation,
    /// wallet, nonce)) — this is what the ZK proof will later open against.
    pub fn buy_policy(
        ctx: Context<BuyPolicy>,
        premium_amount_usdc: u64,
        coverage_cap_usdc: u64,
        stake_amount_usdc: u64,
        commitment_hash: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.pool.paused, InsErr::Paused);
        require!(premium_amount_usdc > 0 && coverage_cap_usdc > 0, InsErr::ZeroAmount);
        require!(
            coverage_cap_usdc <= ctx.accounts.pool.max_coverage_per_user_usdc,
            InsErr::CoverageExceedsPerUserCap
        );
        require!(commitment_hash != [0u8; 32], InsErr::ZkCommitmentMissing);

        // Min-premium: at least one month at pool rate
        let premium_bps = ctx.accounts.pool.premium_bps as u128;
        let min_premium_month = ((coverage_cap_usdc as u128)
            .checked_mul(premium_bps)
            .ok_or(InsErr::Overflow)?
            / 10_000) as u64;
        require!(premium_amount_usdc >= min_premium_month, InsErr::PremiumTooLow);

        // Min-stake: stake ≥ min_multiplier/100 × premium
        let required_stake = ((premium_amount_usdc as u128)
            .checked_mul(ctx.accounts.pool.min_stake_multiplier as u128)
            .ok_or(InsErr::Overflow)?
            / 100) as u64;
        require!(stake_amount_usdc >= required_stake, InsErr::StakeBelowMinimum);

        // Split premium into platform_fee + pool_share
        let platform_fee = ((premium_amount_usdc as u128)
            .checked_mul(ctx.accounts.pool.platform_fee_bps as u128)
            .ok_or(InsErr::Overflow)?
            / 10_000) as u64;
        let pool_share = premium_amount_usdc
            .checked_sub(platform_fee)
            .ok_or(InsErr::Overflow)?;

        // Transfer pool_share + stake → pool_vault (single transfer)
        let vault_inflow = pool_share
            .checked_add(stake_amount_usdc)
            .ok_or(InsErr::Overflow)?;
        let cpi_vault = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_usdc_ata.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(cpi_vault, vault_inflow)?;

        // Transfer platform_fee → treasury
        if platform_fee > 0 {
            let cpi_fee = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_ata.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            );
            token::transfer(cpi_fee, platform_fee)?;
        }

        let now = Clock::get()?.unix_timestamp;
        let policy = &mut ctx.accounts.policy;

        let seconds_funded: i64 = (((premium_amount_usdc as u128) * 30 * 86_400)
            / (min_premium_month as u128).max(1)) as i64;

        if policy.user == Pubkey::default() {
            // ── New policy ──
            policy.user = ctx.accounts.user.key();
            policy.coverage_cap_usdc = coverage_cap_usdc;
            policy.paid_through_unix = now.checked_add(seconds_funded).ok_or(InsErr::Overflow)?;
            policy.bought_at_unix = now;
            policy.premium_paid_micro = premium_amount_usdc;
            policy.stake_usdc = stake_amount_usdc;
            policy.commitment_hash = commitment_hash;
            policy.total_claimed = 0;
            policy.rescue_count = 0;
            policy.is_active = true;
            policy.bump = ctx.bumps.policy;

            let pool = &mut ctx.accounts.pool;
            pool.coverage_outstanding = pool
                .coverage_outstanding
                .checked_add(coverage_cap_usdc)
                .ok_or(InsErr::Overflow)?;
            pool.total_stakes = pool
                .total_stakes
                .checked_add(stake_amount_usdc)
                .ok_or(InsErr::Overflow)?;
        } else {
            // ── Renewal / top-up ──
            require!(policy.user == ctx.accounts.user.key(), InsErr::WrongUser);
            require!(policy.is_active, InsErr::PolicyInactive);
            require!(
                coverage_cap_usdc >= policy.coverage_cap_usdc,
                InsErr::CoverageCapShrink
            );

            // Commitment rotation allowed on renewal (new nonce).
            policy.commitment_hash = commitment_hash;

            if coverage_cap_usdc > policy.coverage_cap_usdc {
                let delta = coverage_cap_usdc - policy.coverage_cap_usdc;
                let pool = &mut ctx.accounts.pool;
                pool.coverage_outstanding = pool
                    .coverage_outstanding
                    .checked_add(delta)
                    .ok_or(InsErr::Overflow)?;
                policy.coverage_cap_usdc = coverage_cap_usdc;
            }

            let base = policy.paid_through_unix.max(now);
            policy.paid_through_unix = base.checked_add(seconds_funded).ok_or(InsErr::Overflow)?;
            policy.premium_paid_micro = policy
                .premium_paid_micro
                .checked_add(premium_amount_usdc)
                .ok_or(InsErr::Overflow)?;
            policy.stake_usdc = policy
                .stake_usdc
                .checked_add(stake_amount_usdc)
                .ok_or(InsErr::Overflow)?;

            let pool = &mut ctx.accounts.pool;
            pool.total_stakes = pool
                .total_stakes
                .checked_add(stake_amount_usdc)
                .ok_or(InsErr::Overflow)?;
        }

        emit!(PolicyBought {
            user: policy.user,
            premium_amount_usdc,
            platform_fee,
            pool_share,
            stake_added: stake_amount_usdc,
            coverage_cap_usdc: policy.coverage_cap_usdc,
            paid_through: policy.paid_through_unix,
        });
        Ok(())
    }

    /// Close policy: deactivate, refund time-remaining premium, return stake
    /// pro-rata to current pool value. Stake is last-loss tranche — if claims
    /// have drained the pool, stake refund will be less than nominal.
    ///
    /// NOTE (intentional): no `pool.paused` guard here. If admin pauses to
    /// investigate, users MUST still be able to withdraw their stake — pausing
    /// close_policy would let admin trap user capital indefinitely. Pausing
    /// only blocks `buy_policy` and `claim_payout_with_zk_proof`.
    pub fn close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.is_active, InsErr::PolicyInactive);

        let now = Clock::get()?.unix_timestamp;
        let remaining_sec = (policy.paid_through_unix - now).max(0);
        let paid_for_sec: i64 = ((policy.premium_paid_micro as u128) * 30 * 86_400
            / ((policy.coverage_cap_usdc as u128)
                .checked_mul(ctx.accounts.pool.premium_bps as u128)
                .ok_or(InsErr::Overflow)?
                / 10_000)
                .max(1)) as i64;

        let premium_refund: u64 = if paid_for_sec > 0 {
            ((policy.premium_paid_micro as u128)
                .checked_mul(remaining_sec as u128)
                .ok_or(InsErr::Overflow)?
                / paid_for_sec as u128) as u64
        } else {
            0
        };

        // Stake refund: proportional to pool_vault / total_stakes
        // (so if the pool has paid out more than it received, stake is haircut)
        let pool = &ctx.accounts.pool;
        let vault_balance = ctx.accounts.pool_vault.amount;
        let stake_refund: u64 = if pool.total_stakes > 0 {
            ((policy.stake_usdc as u128)
                .checked_mul(vault_balance as u128)
                .ok_or(InsErr::Overflow)?
                / pool.total_stakes as u128) as u64
        } else {
            policy.stake_usdc
        };
        // Cap refund to nominal — surplus stays in pool for remaining users
        let stake_refund = stake_refund.min(policy.stake_usdc);

        let total_refund = premium_refund
            .checked_add(stake_refund)
            .ok_or(InsErr::Overflow)?;

        if total_refund > 0 {
            let admin = ctx.accounts.pool.admin;
            let bump = ctx.accounts.pool.bump;
            let seeds: &[&[u8]] = &[b"sakura_pool_v2", admin.as_ref(), &[bump]];
            let signer_seeds: &[&[&[u8]]] = &[seeds];
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_vault.to_account_info(),
                    to: ctx.accounts.user_usdc_ata.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            );
            token::transfer(cpi, total_refund)?;
        }

        let pool = &mut ctx.accounts.pool;
        pool.coverage_outstanding = pool.coverage_outstanding.saturating_sub(policy.coverage_cap_usdc);
        pool.total_stakes = pool.total_stakes.saturating_sub(policy.stake_usdc);
        policy.is_active = false;

        emit!(PolicyClosed {
            user: policy.user,
            premium_refund,
            stake_refund,
            total_claimed: policy.total_claimed,
            rescue_count: policy.rescue_count,
        });
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────
    // RESCUE CLAIM — ZK-verified, oracle-bound
    // ──────────────────────────────────────────────────────────────────

    /// Claim a rescue payout with an on-chain Groth16 proof.
    ///
    /// Proof proves (in-circuit):
    ///   Poseidon(obligation_account, user_wallet, nonce) == policy.commitment_hash
    ///   collateral_amount × oracle_price × 10000 < trigger_hf_bps × debt × 1e6
    ///   rescue_amount_bucket × 100e6 ≤ debt_usd_micro
    ///
    /// Oracle binding: `oracle_price_usd_micro` and `oracle_slot` are PUBLIC
    /// inputs. Chain verifier checks:
    ///   • oracle_slot within freshness window (last 150 slots)
    ///   • (v0.3) oracle_price matches Pyth account at oracle_slot
    ///
    /// Security on this path:
    ///   • Agent signature not required — math, not trust
    ///   • Rescue destination ATA must be owned by policy.user
    ///   • Waiting period enforced (anti just-in-time buy)
    ///   • Proof replay prevented by ClaimRecord PDA init
    pub fn claim_payout_with_zk_proof(
        ctx: Context<ClaimPayoutZk>,
        amount_usdc: u64,
        claim_nonce: u64,
        trigger_hf_bps: u16,
        rescue_amount_bucket: u32,
        oracle_price_usd_micro: u64,
        oracle_slot: u64,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
    ) -> Result<()> {
        require!(!ctx.accounts.pool.paused, InsErr::Paused);
        require!(amount_usdc > 0, InsErr::ZeroAmount);
        require!(
            trigger_hf_bps >= 10_000 && trigger_hf_bps <= 20_000,
            InsErr::ZkPublicInputOutOfRange
        );

        let policy = &mut ctx.accounts.policy;
        require!(policy.is_active, InsErr::PolicyInactive);
        require!(policy.commitment_hash != [0u8; 32], InsErr::ZkCommitmentMissing);

        let now = Clock::get()?.unix_timestamp;
        // Waiting period — block just-in-time adverse selection
        require!(
            now >= policy
                .bought_at_unix
                .checked_add(ctx.accounts.pool.waiting_period_sec)
                .ok_or(InsErr::Overflow)?,
            InsErr::WaitingPeriodNotElapsed
        );
        // 48h grace period after paid_through. Use checked_add to guard
        // against i64 overflow if paid_through_unix is pathologically large
        // (many renewals can push it far into the future).
        const GRACE_SEC: i64 = 48 * 3_600;
        let grace_deadline = policy
            .paid_through_unix
            .checked_add(GRACE_SEC)
            .ok_or(InsErr::Overflow)?;
        require!(now <= grace_deadline, InsErr::PolicyLapsed);

        let new_total = policy
            .total_claimed
            .checked_add(amount_usdc)
            .ok_or(InsErr::Overflow)?;
        require!(new_total <= policy.coverage_cap_usdc, InsErr::CoverageCapExceeded);

        require!(
            ctx.accounts.pool_vault.amount >= amount_usdc,
            InsErr::VaultInsufficient
        );

        // Critical fix: rescue destination must belong to the policy user.
        // Plugs the "agent redirects payout to attacker ATA" hole.
        require!(
            ctx.accounts.rescue_destination_ata.owner == policy.user,
            InsErr::RescueDestinationNotUser
        );

        // Bucket sanity: amount ≤ rescue_amount_bucket × 100 USDC
        let bucket_cap_micro = (rescue_amount_bucket as u64)
            .checked_mul(100_000_000)
            .ok_or(InsErr::Overflow)?;
        require!(amount_usdc <= bucket_cap_micro, InsErr::ZkBucketTooSmall);

        // Oracle freshness window: slot must be within last 150 slots (~60s)
        let current_slot = Clock::get()?.slot;
        require!(
            current_slot >= oracle_slot && current_slot - oracle_slot <= 150,
            InsErr::OracleSlotStale
        );

        // F1 fix: verify `oracle_price_usd_micro` matches what Pyth actually
        // published at `oracle_slot`. Without this, the `oracle_price` public
        // input is attacker-controlled and the HF comparison in the circuit
        // is meaningless.
        //
        // We parse the Pyth `PriceUpdateV2` account layout inline (vs pulling
        // in pyth-solana-receiver-sdk which adds ~120KB ELF). The layout is
        // stable — documented at
        // github.com/pyth-network/pyth-crosschain/price_update.rs:
        //
        //   8   anchor_discriminator
        //   32  write_authority
        //   1   verification_level (enum: Full=0 or Partial{num_signatures: u8}=1)
        //   (+1 if Partial)
        //   32  price_message.feed_id
        //    8  price_message.price           (i64 LE)
        //    8  price_message.conf            (u64 LE)
        //    4  price_message.exponent        (i32 LE, negative e.g. -8)
        //    8  price_message.publish_time    (i64 LE, unix)
        //    8  price_message.prev_publish_time
        //    8  price_message.ema_price
        //    8  price_message.ema_conf
        //    8  posted_slot                   (u64 LE)
        //
        // We compare: oracle_price_usd_micro == abs(price) * 10^(6 + exponent)
        // (exponent is typically -8 ⇒ divide by 1e8 then × 1e6 = ÷100)
        // and require posted_slot == oracle_slot.
        {
            let acct = &ctx.accounts.pyth_price_account;

            // (a) Owner check — only the real Pyth Receiver program may write
            // PriceUpdateV2 accounts. Without this, attacker can hand us a
            // program-owned account they control and forge any price.
            require!(
                acct.owner == &PYTH_RECEIVER_PROGRAM_ID,
                InsErr::PythAccountInvalid
            );

            let data = acct.try_borrow_data()?;
            // Min length for Full variant (no num_signatures payload after tag):
            //   8 disc + 32 write_authority + 1 tag + 32 feed_id + 8 price + 8 conf
            //   + 4 exp + 8 pub + 8 prev_pub + 8 ema_p + 8 ema_c + 8 posted_slot = 133
            // Live Pyth Full account = 134 bytes (1 trailing reserved byte).
            require!(data.len() >= 8 + 32 + 1 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8 + 8, InsErr::PythAccountInvalid);

            // Skip discriminator + write_authority
            let mut o: usize = 8 + 32;
            // verification_level: variant tag (1 byte).
            //   tag = 0 → Partial { num_signatures: u8 }  (extra 1 byte follows)
            //   tag = 1 → Full                            (no payload)
            // Verified against live devnet PriceUpdateV2 (account 7UVimffxr9...).
            let tag = data[o]; o += 1;
            if tag == 0 {
                // Partial(num_signatures: u8)
                o += 1;
            } else if tag != 1 {
                return err!(InsErr::PythAccountInvalid);
            }

            // (b) feed_id check — must be SOL/USD. Otherwise an attacker could
            // submit a different asset's Pyth account (e.g. a fake memecoin at
            // $0.001) to make the circuit's HF inequality trivially true.
            let feed_id_slice = &data[o..o + 32];
            require!(
                feed_id_slice == EXPECTED_FEED_ID_SOL_USD.as_slice(),
                InsErr::PythFeedIdMismatch
            );
            o += 32;

            let price_i64 = i64::from_le_bytes(
                data[o..o + 8].try_into().map_err(|_| error!(InsErr::PythAccountInvalid))?
            );
            o += 8;
            // conf
            o += 8;
            let exponent = i32::from_le_bytes(
                data[o..o + 4].try_into().map_err(|_| error!(InsErr::PythAccountInvalid))?
            );
            o += 4;
            // publish_time, prev_publish_time, ema_price, ema_conf (skip — 32 bytes)
            o += 32;
            let posted_slot = u64::from_le_bytes(
                data[o..o + 8].try_into().map_err(|_| error!(InsErr::PythAccountInvalid))?
            );

            // Slot must match the slot the proof was generated against.
            require!(posted_slot == oracle_slot, InsErr::OraclePriceMismatch);

            // Price sanity: Pyth price can be negative in degenerate cases —
            // reject those for a rescue-eligibility oracle.
            require!(price_i64 > 0, InsErr::OraclePriceMismatch);
            let price_abs = price_i64 as u64;

            // Convert Pyth scaled price to micro-USD (1e6 granularity).
            //   target_scale = 1e6
            //   pyth_scale   = 10^(-exponent)   (exponent is negative)
            //
            //   price_micro = price_abs * 10^(6 + exponent)
            //
            // exponent typically = -8 (SOL/USD), so (6 + -8) = -2 ⇒ divide by 100.
            let adj: i32 = 6 + exponent;
            let computed_micro: u64 = if adj >= 0 {
                let mul = 10u64
                    .checked_pow(adj as u32)
                    .ok_or(InsErr::Overflow)?;
                price_abs.checked_mul(mul).ok_or(InsErr::Overflow)?
            } else {
                let div = 10u64
                    .checked_pow((-adj) as u32)
                    .ok_or(InsErr::Overflow)?;
                price_abs / div
            };

            // Allow a tiny tolerance for rounding: ±1 micro-USD (Pyth integer
            // truncation + circuit-input quantization don't always agree on
            // last digit).
            let diff = if computed_micro > oracle_price_usd_micro {
                computed_micro - oracle_price_usd_micro
            } else {
                oracle_price_usd_micro - computed_micro
            };
            require!(diff <= 1, InsErr::OraclePriceMismatch);
        }

        // ── Groth16 pairing verification via Solana alt_bn128 syscalls ──
        // Public inputs (must match circuit's `public` list order):
        //   [0] policy_commitment
        //   [1] trigger_hf_bps
        //   [2] rescue_amount_bucket
        //   [3] oracle_price_usd_micro
        //   [4] oracle_slot
        let pub0 = policy.commitment_hash;
        let mut pub1 = [0u8; 32];
        pub1[30..32].copy_from_slice(&trigger_hf_bps.to_be_bytes());
        let mut pub2 = [0u8; 32];
        pub2[28..32].copy_from_slice(&rescue_amount_bucket.to_be_bytes());
        let mut pub3 = [0u8; 32];
        pub3[24..32].copy_from_slice(&oracle_price_usd_micro.to_be_bytes());
        let mut pub4 = [0u8; 32];
        pub4[24..32].copy_from_slice(&oracle_slot.to_be_bytes());
        let public_inputs = [pub0, pub1, pub2, pub3, pub4];

        let mut verifier = Groth16Verifier::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs,
            &VERIFYINGKEY,
        )
        .map_err(|_| error!(InsErr::ZkProofMalformed))?;

        verifier
            .verify()
            .map_err(|_| error!(InsErr::ZkProofInvalid))?;
        // ─────────────────────────────────────────────────────────────────

        // Transfer USDC from pool vault → user-owned rescue ATA
        let admin = ctx.accounts.pool.admin;
        let bump = ctx.accounts.pool.bump;
        let seeds: &[&[u8]] = &[b"sakura_pool_v2", admin.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.rescue_destination_ata.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi, amount_usdc)?;

        // Claim record — PDA init seeded by (policy, claim_nonce) is the
        // authoritative replay guard; a second call with the same nonce fails
        // at account init before this handler runs.
        //
        // We additionally persist a hash over (proof_a || proof_c) as a
        // forensic audit fingerprint of the exact pairing inputs that landed
        // this claim. NOT used for security decisions — purely for off-chain
        // reconstruction of which proof was accepted.
        let record = &mut ctx.accounts.claim_record;
        record.policy = policy.key();
        record.amount_usdc = amount_usdc;
        let mut fp_src = [0u8; 128];
        fp_src[..64].copy_from_slice(&proof_a);
        fp_src[64..].copy_from_slice(&proof_c);
        record.rescue_sig_hash = anchor_lang::solana_program::keccak::hash(&fp_src).to_bytes();
        record.claim_nonce = claim_nonce;
        record.ts = now;
        record.bump = ctx.bumps.claim_record;

        policy.total_claimed = new_total;
        policy.rescue_count = policy.rescue_count.checked_add(1).ok_or(InsErr::Overflow)?;

        let pool = &mut ctx.accounts.pool;
        pool.total_claims_paid = pool
            .total_claims_paid
            .checked_add(amount_usdc)
            .ok_or(InsErr::Overflow)?;

        emit!(ZkClaimPaid {
            user: policy.user,
            amount_usdc,
            total_claimed: new_total,
            rescue_count: policy.rescue_count,
            trigger_hf_bps,
            rescue_amount_bucket,
            oracle_price_usd_micro,
            oracle_slot,
            commitment_hash: policy.commitment_hash,
        });
        Ok(())
    }
}

// ══════════════════════════════════════════════════════════════════════════
// Accounts
// ══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Pool::LEN,
        seeds = [b"sakura_pool_v2", admin.key().as_ref()],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: agent pubkey (legacy path; deprecated by ZK path)
    pub admin_agent: UncheckedAccount<'info>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [b"sakura_vault", pool.key().as_ref()],
        bump,
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    /// Platform treasury — receives platform_fee_bps share of every premium.
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
        seeds = [b"sakura_pool_v2", pool.admin.as_ref()],
        bump = pool.bump,
        has_one = admin,
    )]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyPolicy<'info> {
    #[account(
        mut,
        seeds = [b"sakura_pool_v2", pool.admin.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Policy::LEN,
        seeds = [b"sakura_policy", user.key().as_ref()],
        bump,
    )]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = pool.usdc_mint,
        constraint = user_usdc_ata.owner == user.key() @ InsErr::WrongOwner,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.usdc_vault)]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.platform_treasury)]
    pub platform_treasury: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    #[account(
        mut,
        seeds = [b"sakura_pool_v2", pool.admin.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [b"sakura_policy", user.key().as_ref()],
        bump = policy.bump,
        has_one = user,
    )]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        token::mint = pool.usdc_mint,
        constraint = user_usdc_ata.owner == user.key() @ InsErr::WrongOwner,
    )]
    pub user_usdc_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.usdc_vault)]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(
    amount_usdc: u64,
    claim_nonce: u64,
)]
pub struct ClaimPayoutZk<'info> {
    #[account(
        mut,
        seeds = [b"sakura_pool_v2", pool.admin.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [b"sakura_policy", policy.user.as_ref()],
        bump = policy.bump,
    )]
    pub policy: Box<Account<'info, Policy>>,

    /// Payer sponsors rent for ClaimRecord. Does NOT gate the claim —
    /// ZK proof is the only authority source.
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + ClaimRecord::LEN,
        seeds = [b"sakura_claim", policy.key().as_ref(), &claim_nonce.to_le_bytes()],
        bump,
    )]
    pub claim_record: Box<Account<'info, ClaimRecord>>,

    #[account(mut, address = pool.usdc_vault)]
    pub pool_vault: Box<Account<'info, TokenAccount>>,

    /// Rescue destination — must be owned by policy.user (enforced in handler).
    #[account(mut, token::mint = pool.usdc_mint)]
    pub rescue_destination_ata: Box<Account<'info, TokenAccount>>,

    /// Pyth `PriceUpdateV2` account. Handler enforces:
    ///   • account.owner == PYTH_RECEIVER_PROGRAM_ID    (spoofing guard)
    ///   • price_message.feed_id == EXPECTED_FEED_ID_SOL_USD (wrong-asset guard)
    ///   • posted_slot == oracle_slot                   (replay guard)
    ///   • oracle_price_usd_micro ≈ price × 10^(6+exp)  (forgery guard)
    ///
    /// Without all four, the `oracle_price` public input to the ZK proof is
    /// attacker-controlled and the in-circuit HF comparison is meaningless.
    /// CHECK: owner + layout validated by handler
    pub pyth_price_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ══════════════════════════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════════════════════════

#[account]
pub struct Pool {
    pub admin: Pubkey,                      // 32
    pub admin_agent: Pubkey,                // 32
    pub platform_treasury: Pubkey,          // 32
    pub usdc_mint: Pubkey,                  // 32
    pub usdc_vault: Pubkey,                 // 32
    pub total_stakes: u64,                  // 8
    pub coverage_outstanding: u64,          // 8
    pub total_claims_paid: u64,             // 8
    pub premium_bps: u16,                   // 2
    pub platform_fee_bps: u16,              // 2
    pub min_stake_multiplier: u16,          // 2
    pub max_coverage_per_user_usdc: u64,    // 8
    pub waiting_period_sec: i64,            // 8
    pub paused: bool,                       // 1
    pub bump: u8,                           // 1
}
impl Pool {
    pub const LEN: usize = 32 * 5 + 8 * 3 + 2 * 3 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Policy {
    pub user: Pubkey,                 // 32
    pub coverage_cap_usdc: u64,       // 8
    pub premium_paid_micro: u64,      // 8
    pub stake_usdc: u64,              // 8
    pub paid_through_unix: i64,       // 8
    pub bought_at_unix: i64,          // 8 — anchors waiting_period_sec
    pub total_claimed: u64,           // 8
    pub rescue_count: u64,            // 8
    pub commitment_hash: [u8; 32],    // 32
    pub is_active: bool,              // 1
    pub bump: u8,                     // 1
}
impl Policy {
    pub const LEN: usize = 32 + 8 * 7 + 32 + 1 + 1;
}

#[account]
pub struct ClaimRecord {
    pub policy: Pubkey,               // 32
    pub amount_usdc: u64,             // 8
    pub rescue_sig_hash: [u8; 32],    // 32
    pub claim_nonce: u64,             // 8
    pub ts: i64,                      // 8
    pub bump: u8,                     // 1
}
impl ClaimRecord {
    pub const LEN: usize = 32 + 8 + 32 + 8 + 8 + 1;
}

// ══════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════

#[event] pub struct PoolInitialized {
    pub admin: Pubkey,
    pub admin_agent: Pubkey,
    pub premium_bps: u16,
    pub platform_fee_bps: u16,
    pub min_stake_multiplier: u16,
    pub max_coverage_per_user_usdc: u64,
    pub waiting_period_sec: i64,
}
#[event] pub struct AdminAgentRotated { pub new_agent: Pubkey }
#[event] pub struct PoolPauseToggled { pub paused: bool }
#[event] pub struct PolicyBought {
    pub user: Pubkey,
    pub premium_amount_usdc: u64,
    pub platform_fee: u64,
    pub pool_share: u64,
    pub stake_added: u64,
    pub coverage_cap_usdc: u64,
    pub paid_through: i64,
}
#[event] pub struct PolicyClosed {
    pub user: Pubkey,
    pub premium_refund: u64,
    pub stake_refund: u64,
    pub total_claimed: u64,
    pub rescue_count: u64,
}
#[event] pub struct ZkClaimPaid {
    pub user: Pubkey,
    pub amount_usdc: u64,
    pub total_claimed: u64,
    pub rescue_count: u64,
    pub trigger_hf_bps: u16,
    pub rescue_amount_bucket: u32,
    pub oracle_price_usd_micro: u64,
    pub oracle_slot: u64,
    pub commitment_hash: [u8; 32],
}

// ══════════════════════════════════════════════════════════════════════════
// Errors
// ══════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum InsErr {
    #[msg("Amount must be > 0")]                        ZeroAmount,
    #[msg("Invalid parameter")]                         InvalidParam,
    #[msg("Pool is paused")]                            Paused,
    #[msg("Arithmetic overflow")]                       Overflow,
    #[msg("Premium below monthly minimum")]             PremiumTooLow,
    #[msg("Stake below min_stake_multiplier × premium")] StakeBelowMinimum,
    #[msg("Coverage exceeds per-user cap")]             CoverageExceedsPerUserCap,
    #[msg("Policy authority mismatch")]                 WrongUser,
    #[msg("Policy is inactive")]                        PolicyInactive,
    #[msg("Coverage cap cannot shrink mid-policy")]     CoverageCapShrink,
    #[msg("Policy is lapsed beyond grace period")]      PolicyLapsed,
    #[msg("Coverage cap would be exceeded")]            CoverageCapExceeded,
    #[msg("Pool vault has insufficient USDC")]          VaultInsufficient,
    #[msg("Token account owner mismatch")]              WrongOwner,
    #[msg("Waiting period not yet elapsed")]            WaitingPeriodNotElapsed,
    #[msg("Oracle slot too stale (>150 slots)")]        OracleSlotStale,
    #[msg("Groth16 proof malformed")]                   ZkProofMalformed,
    #[msg("Groth16 proof pairing check failed")]        ZkProofInvalid,
    #[msg("Policy has no commitment registered")]       ZkCommitmentMissing,
    #[msg("Rescue destination ATA must be owned by policy user")] RescueDestinationNotUser,
    #[msg("trigger_hf_bps out of reasonable range [10000, 20000]")] ZkPublicInputOutOfRange,
    #[msg("amount_usdc exceeds rescue bucket cap")]     ZkBucketTooSmall,
    #[msg("Pyth price account has invalid layout")]     PythAccountInvalid,
    #[msg("oracle_price_usd_micro / oracle_slot does not match Pyth")] OraclePriceMismatch,
    #[msg("Pyth feed_id does not match expected SOL/USD feed")] PythFeedIdMismatch,
}
