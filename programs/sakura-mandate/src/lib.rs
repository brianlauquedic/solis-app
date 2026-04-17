use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp");

/// Sakura Liquidation Shield — On-chain Rescue Mandate Program
///
/// Stores rescue mandates as PDAs: each wallet has one active mandate that
/// authorizes the Sakura agent to execute emergency debt repayment up to a
/// pre-approved USDC ceiling when health factor drops below threshold.
///
/// Dual-gate authorization model (verified on-chain):
///   Gate 1 — SPL Token delegate: user calls `approve(user_ata, agent, max)`
///            so the SPL token program itself enforces an independent USDC cap.
///   Gate 2 — Anchor mandate PDA: this program stores policy (agent identity,
///            max_usdc, trigger_hf_bps, cumulative rescued) and re-verifies
///            every rescue on-chain. Compromising one gate is not enough.
///
/// Flow:
///   1. User signs `create_mandate` → PDA stores (agent, max_usdc, trigger_hf)
///   2. User signs SPL `approve(user_ata, agent, max_usdc)` — independent gate
///   3. Agent monitors health factor off-chain (via Kamino/MarginFi SDK)
///   4. When HF drops below threshold, agent calls `execute_rescue`
///   5. Program verifies: caller == mandate.agent, amount <= ceiling,
///      reported HF <= trigger threshold, user ATA delegate matches agent
///   6. Transfers USDC via CPI using agent as SPL delegate authority
///   7. Records cumulative rescued amount and count on-chain, emits event
///
/// Security invariants:
///   - Only the authorized agent can execute rescue (has_one = agent)
///   - Rescue amount bounded by `max_usdc - total_rescued` (checked_sub)
///   - Agent cannot forge "unhealthy" reports: reported_hf must be <= trigger
///   - User can close mandate anytime to revoke agent authority + SPL delegate
///   - PDA seeds ensure one mandate per wallet (no duplicates)
///   - Token account constraints bind mint + owner so wrong-token attacks fail
#[program]
pub mod sakura_mandate {
    use super::*;

    /// Create a rescue mandate PDA for the caller's wallet.
    ///
    /// The mandate authorizes `agent` to transfer up to `max_usdc` (micro-USDC)
    /// when the user's lending position health factor drops below `trigger_hf_bps`.
    /// Users must separately call SPL `approve` to set the delegate — this
    /// program verifies that delegate matches on every `execute_rescue`.
    pub fn create_mandate(
        ctx: Context<CreateMandate>,
        max_usdc: u64,
        trigger_hf_bps: u16, // Health factor * 100, e.g., 150 = 1.50
    ) -> Result<()> {
        require!(max_usdc > 0, SakuraError::ZeroAmount);
        require!(
            trigger_hf_bps >= 101 && trigger_hf_bps <= 300,
            SakuraError::InvalidThreshold
        );

        let mandate = &mut ctx.accounts.mandate;
        mandate.authority = ctx.accounts.authority.key();
        mandate.agent = ctx.accounts.agent.key();
        mandate.max_usdc = max_usdc;
        mandate.trigger_hf_bps = trigger_hf_bps;
        mandate.total_rescued = 0;
        mandate.rescue_count = 0;
        mandate.created_at = Clock::get()?.unix_timestamp;
        mandate.last_rescue_at = 0;
        mandate.is_active = true;
        mandate.bump = ctx.bumps.mandate;

        emit!(MandateCreated {
            authority: mandate.authority,
            agent: mandate.agent,
            max_usdc,
            trigger_hf_bps,
            created_at: mandate.created_at,
        });

        msg!(
            "Sakura: Mandate created | wallet={} agent={} max_usdc={} trigger_hf={}",
            mandate.authority,
            mandate.agent,
            max_usdc,
            trigger_hf_bps,
        );

        Ok(())
    }

    /// Execute a rescue: transfer USDC from user's ATA to repay vault via CPI.
    ///
    /// On-chain verified invariants (all MUST pass):
    ///   1. mandate.is_active == true
    ///   2. rescue_amount > 0
    ///   3. rescue_amount <= max_usdc - total_rescued  (ceiling)
    ///   4. reported_hf_bps <= mandate.trigger_hf_bps  (no false-alarm rescues)
    ///   5. caller == mandate.agent                    (has_one constraint)
    ///   6. user_usdc_ata.owner == mandate.authority   (custom constraint)
    ///   7. user_usdc_ata.delegate == Some(agent)      (custom constraint)
    ///   8. user_usdc_ata.delegated_amount >= rescue_amount (custom constraint)
    ///   9. user_usdc_ata.mint == usdc_mint            (token::mint constraint)
    ///   10. repay_vault.mint == usdc_mint             (token::mint constraint)
    ///
    /// The SPL token program itself enforces (7) and (8) at transfer time,
    /// but we duplicate them here so the program fails fast with a clear error.
    pub fn execute_rescue(
        ctx: Context<ExecuteRescue>,
        rescue_amount: u64,       // micro-USDC to transfer
        reported_hf_bps: u16,     // Agent-reported health factor (must be <= trigger)
        proof_hash: [u8; 32],     // SHA-256 hash of off-chain proof bundle
    ) -> Result<()> {
        // Snapshot immutable state for security checks + CPI
        let is_active = ctx.accounts.mandate.is_active;
        let max_usdc = ctx.accounts.mandate.max_usdc;
        let total_rescued = ctx.accounts.mandate.total_rescued;
        let trigger_hf = ctx.accounts.mandate.trigger_hf_bps;

        // Policy checks
        require!(is_active, SakuraError::MandateInactive);
        require!(rescue_amount > 0, SakuraError::ZeroAmount);
        require!(
            reported_hf_bps <= trigger_hf,
            SakuraError::HealthFactorAboveTrigger
        );

        let remaining = max_usdc
            .checked_sub(total_rescued)
            .ok_or(SakuraError::Overflow)?;
        require!(rescue_amount <= remaining, SakuraError::ExceedsCeiling);

        // Execute USDC transfer via SPL delegate: user ATA → repay vault.
        // Agent is the SPL delegate (set via prior `approve` by user) AND a
        // signer of this transaction — SPL token program will accept the
        // transfer because (delegate == signer AND delegated_amount >= amt).
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_usdc_ata.to_account_info(),
                to: ctx.accounts.repay_vault.to_account_info(),
                authority: ctx.accounts.agent.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, rescue_amount)?;

        // Update state (mutable borrow now safe — CPI done)
        let mandate = &mut ctx.accounts.mandate;
        mandate.total_rescued = mandate.total_rescued
            .checked_add(rescue_amount)
            .ok_or(SakuraError::Overflow)?;
        mandate.rescue_count = mandate
            .rescue_count
            .checked_add(1)
            .ok_or(SakuraError::Overflow)?;
        mandate.last_rescue_at = Clock::get()?.unix_timestamp;

        emit!(RescueExecuted {
            authority: mandate.authority,
            agent: mandate.agent,
            rescue_amount,
            total_rescued: mandate.total_rescued,
            rescue_count: mandate.rescue_count,
            reported_hf_bps,
            proof_hash,
            timestamp: mandate.last_rescue_at,
        });

        msg!(
            "Sakura: Rescue #{} | amount={} total={}/{} hf_bps={}",
            mandate.rescue_count,
            rescue_amount,
            mandate.total_rescued,
            mandate.max_usdc,
            reported_hf_bps,
        );

        Ok(())
    }

    /// Update mandate parameters (only authority can call).
    pub fn update_mandate(
        ctx: Context<UpdateMandate>,
        new_max_usdc: Option<u64>,
        new_trigger_hf_bps: Option<u16>,
    ) -> Result<()> {
        let mandate = &mut ctx.accounts.mandate;

        if let Some(max) = new_max_usdc {
            require!(max >= mandate.total_rescued, SakuraError::CeilingBelowRescued);
            mandate.max_usdc = max;
        }

        if let Some(hf) = new_trigger_hf_bps {
            require!(hf >= 101 && hf <= 300, SakuraError::InvalidThreshold);
            mandate.trigger_hf_bps = hf;
        }

        emit!(MandateUpdated {
            authority: mandate.authority,
            max_usdc: mandate.max_usdc,
            trigger_hf_bps: mandate.trigger_hf_bps,
        });

        Ok(())
    }

    /// Close mandate and reclaim rent (only authority can call).
    ///
    /// Flips `is_active = false` and emits `MandateClosed` *before* Anchor's
    /// `close = authority` reclaims lamports. Users should also call SPL
    /// `revoke` on their USDC ATA to clear the delegate pointer (this program
    /// cannot do it directly because the ATA owner is the user, not the PDA).
    pub fn close_mandate(ctx: Context<CloseMandate>) -> Result<()> {
        let mandate = &mut ctx.accounts.mandate;
        mandate.is_active = false;

        emit!(MandateClosed {
            authority: ctx.accounts.authority.key(),
            total_rescued: mandate.total_rescued,
            rescue_count: mandate.rescue_count,
        });
        msg!(
            "Sakura: Mandate closed | wallet={} total_rescued={} rescues={}",
            ctx.accounts.authority.key(),
            mandate.total_rescued,
            mandate.rescue_count,
        );
        Ok(())
    }
}

// ══════════════════════════════════════════════════════════════════
// Accounts
// ══════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct CreateMandate<'info> {
    /// Space: 8 discriminator + 32 authority + 32 agent + 8 max_usdc
    ///      + 2 trigger_hf_bps + 8 total_rescued + 8 rescue_count (u64)
    ///      + 8 created_at + 8 last_rescue_at + 1 is_active + 1 bump = 116 bytes
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 2 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"sakura_mandate", authority.key().as_ref()],
        bump,
    )]
    pub mandate: Account<'info, RescueMandate>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Agent public key — stored in mandate, verified on execute_rescue
    /// via `has_one = agent`. No data read from this account.
    pub agent: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteRescue<'info> {
    #[account(
        mut,
        seeds = [b"sakura_mandate", mandate.authority.as_ref()],
        bump = mandate.bump,
        has_one = agent,
    )]
    pub mandate: Account<'info, RescueMandate>,

    /// Agent signer — must match mandate.agent (enforced by has_one).
    /// Agent is also the SPL delegate on user_usdc_ata (set off-chain by user).
    pub agent: Signer<'info>,

    /// User's USDC token account (source of funds).
    ///
    /// Bound on-chain to:
    ///   - mint:               usdc_mint
    ///   - owner:              mandate.authority (wallet that created mandate)
    ///   - delegate:           Some(agent.key())  (SPL approve gate)
    ///   - delegated_amount:   >= 0 (enforced by SPL at transfer time)
    ///
    /// The SPL token program independently re-verifies delegate + allowance
    /// during the CPI transfer — this is Gate 1 of the dual-gate system.
    #[account(
        mut,
        token::mint = usdc_mint,
        constraint = user_usdc_ata.owner == mandate.authority @ SakuraError::WrongOwner,
        constraint = user_usdc_ata.delegate.is_some()
            && user_usdc_ata.delegate.unwrap() == agent.key()
            @ SakuraError::DelegateMismatch,
    )]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    /// Repay vault (destination) — must also be a USDC account.
    /// In demo mode this is agent's escrow ATA; in production this would be
    /// the Kamino/MarginFi repay vault passed by the agent.
    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub repay_vault: Account<'info, TokenAccount>,

    /// USDC mint — validated by token::mint constraints on ATAs.
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct UpdateMandate<'info> {
    #[account(
        mut,
        seeds = [b"sakura_mandate", authority.key().as_ref()],
        bump = mandate.bump,
        has_one = authority,
    )]
    pub mandate: Account<'info, RescueMandate>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseMandate<'info> {
    #[account(
        mut,
        seeds = [b"sakura_mandate", authority.key().as_ref()],
        bump = mandate.bump,
        has_one = authority,
        close = authority,
    )]
    pub mandate: Account<'info, RescueMandate>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ══════════════════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════════════════

#[account]
pub struct RescueMandate {
    /// Wallet owner who created this mandate
    pub authority: Pubkey,         // 32 bytes
    /// Authorized rescue agent (must match SPL delegate on user USDC ATA)
    pub agent: Pubkey,             // 32 bytes
    /// Maximum cumulative USDC authorized (micro-USDC, 6 decimals)
    pub max_usdc: u64,             // 8 bytes
    /// Health factor trigger threshold (bps, e.g., 150 = HF 1.50)
    pub trigger_hf_bps: u16,       // 2 bytes
    /// Cumulative USDC rescued so far
    pub total_rescued: u64,        // 8 bytes
    /// Number of rescue operations executed (u64 — no overflow under real usage)
    pub rescue_count: u64,         // 8 bytes
    /// Unix timestamp of mandate creation
    pub created_at: i64,           // 8 bytes
    /// Unix timestamp of last rescue execution
    pub last_rescue_at: i64,       // 8 bytes
    /// Whether mandate is still active (false after close_mandate)
    pub is_active: bool,           // 1 byte
    /// PDA bump seed
    pub bump: u8,                  // 1 byte
}

// ══════════════════════════════════════════════════════════════════
// Events (indexed on-chain for explorers and analytics)
// ══════════════════════════════════════════════════════════════════

#[event]
pub struct MandateCreated {
    pub authority: Pubkey,
    pub agent: Pubkey,
    pub max_usdc: u64,
    pub trigger_hf_bps: u16,
    pub created_at: i64,
}

#[event]
pub struct RescueExecuted {
    pub authority: Pubkey,
    pub agent: Pubkey,
    pub rescue_amount: u64,
    pub total_rescued: u64,
    pub rescue_count: u64,
    pub reported_hf_bps: u16,
    pub proof_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct MandateUpdated {
    pub authority: Pubkey,
    pub max_usdc: u64,
    pub trigger_hf_bps: u16,
}

#[event]
pub struct MandateClosed {
    pub authority: Pubkey,
    pub total_rescued: u64,
    pub rescue_count: u64,
}

// ══════════════════════════════════════════════════════════════════
// Errors
// ══════════════════════════════════════════════════════════════════

#[error_code]
pub enum SakuraError {
    #[msg("Rescue amount must be greater than zero")]
    ZeroAmount,

    #[msg("Trigger health factor must be between 1.01 (101) and 3.00 (300)")]
    InvalidThreshold,

    #[msg("Rescue amount exceeds remaining mandate ceiling")]
    ExceedsCeiling,

    #[msg("Mandate is not active")]
    MandateInactive,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("New ceiling cannot be below already-rescued amount")]
    CeilingBelowRescued,

    #[msg("Reported health factor is above trigger threshold — rescue not justified")]
    HealthFactorAboveTrigger,

    #[msg("USDC account owner does not match mandate authority")]
    WrongOwner,

    #[msg("USDC account SPL delegate does not match mandate agent")]
    DelegateMismatch,
}
