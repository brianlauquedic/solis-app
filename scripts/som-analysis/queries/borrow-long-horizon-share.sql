-- scripts/som-analysis/queries/borrow-long-horizon-share.sql
--
-- Dune SQL · Solana · free tier web UI at https://dune.com/queries
--
-- -------------------------------------------------------------------------
-- PURPOSE
-- -------------------------------------------------------------------------
-- Sakura's pitch anchors the "pain pattern" claim on Kamino + Jupiter-Lend
-- outstanding borrow debt ($1.62B, per day1-som.ts / DefiLlama, 2026-04).
-- That framing is only load-bearing if a meaningful fraction of that
-- borrow exposure is created by wallets who ALSO delegate to swap/stake
-- agents — i.e. the wallets for whom a session-key agent unified across
-- lend + swap + stake surfaces is the real risk.
--
-- This query measures the overlap: of wallets that hold an active
-- borrow position on Kamino or Jupiter Lend, what share also transact
-- via Jupiter Swap, Raydium, or Jito inside the same 30-day window?
--
-- -------------------------------------------------------------------------
-- THESIS WE'RE STRESS-TESTING
-- -------------------------------------------------------------------------
-- If the overlap is HIGH (say > 40%): the long-horizon delegation risk is
-- real and concentrated — bounded-intent ZK has a sharp wedge.
--
-- If the overlap is LOW (< 10%): most borrowers do not combine with
-- swap/stake, so the "agent session-key drains the borrow position in
-- one market turn" narrative overstates the threat; session-key lifetime
-- caps are probably sufficient and bounded-intent ZK is over-engineered
-- for actual observed behaviour. THIS IS A RESULT WE WANT TO KNOW.
--
-- -------------------------------------------------------------------------
-- NOTE ON DUNE SOLANA SCHEMA
-- -------------------------------------------------------------------------
-- Uses the same `solana.instruction_calls` assumption as
-- `agentic-wallet-candidates.sql`. "Active borrow" is approximated as
-- "signer seen calling the lending program within 30d" — a genuine
-- outstanding-debt check requires per-obligation account state (Kamino
-- Obligation PDA discriminator 168,206,141,234,110,247,14,234 — see
-- app/api/safety-pulse/route.ts prior to its deletion in commit afcda4e
-- for the original obligation-scan code). A precise variant of this
-- query would join on parsed Kamino/Jupiter-Lend obligation state.
-- -------------------------------------------------------------------------

WITH
lending_programs AS (
  SELECT 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' AS program_id UNION ALL
  SELECT 'jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9'
),
non_lending_programs AS (
  SELECT 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' AS program_id UNION ALL  -- Jupiter Swap
  SELECT 'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS'                UNION ALL  -- Raydium Router
  SELECT 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C'                UNION ALL  -- Raydium CPMM
  SELECT '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'                UNION ALL  -- Raydium AMM v4
  SELECT 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'                UNION ALL  -- Raydium CLMM
  SELECT 'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy'                           -- Jito
),
lending_wallets AS (
  SELECT DISTINCT tx_signer AS wallet
  FROM solana.instruction_calls
  WHERE block_time >= NOW() - INTERVAL '30' DAY
    AND tx_success = true
    AND executing_account IN (SELECT program_id FROM lending_programs)
),
non_lending_wallets AS (
  SELECT DISTINCT tx_signer AS wallet
  FROM solana.instruction_calls
  WHERE block_time >= NOW() - INTERVAL '30' DAY
    AND tx_success = true
    AND executing_account IN (SELECT program_id FROM non_lending_programs)
)
SELECT
  (SELECT COUNT(*) FROM lending_wallets) AS lending_wallet_count,
  (SELECT COUNT(*) FROM non_lending_wallets) AS swap_stake_wallet_count,
  (
    SELECT COUNT(*)
    FROM lending_wallets lw
    JOIN non_lending_wallets nw USING (wallet)
  ) AS overlap_wallet_count,
  CAST(
    (SELECT COUNT(*) FROM lending_wallets lw JOIN non_lending_wallets nw USING (wallet))
    AS DOUBLE
  )
  / NULLIF((SELECT COUNT(*) FROM lending_wallets), 0) * 100
    AS pct_of_lenders_also_swap_or_stake;

-- Read the output as:
--   lending_wallet_count       : how big is the borrow-facing population
--   swap_stake_wallet_count    : how big is the swap/stake/LST population
--   overlap_wallet_count       : wallets in BOTH (our agentic target)
--   pct_of_lenders_also_swap_* : share of lenders who multi-delegate
--
-- Sakura's risk narrative is LOAD-BEARING if pct >= 40%.
-- It is PARTIALLY load-bearing if pct in [15%, 40%).
-- It is WEAK if pct < 15% — honest finding; update the pitch.
