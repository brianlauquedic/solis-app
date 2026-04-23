-- scripts/som-analysis/queries/agentic-wallet-candidates.sql
--
-- Dune SQL · Solana · free tier web UI at https://dune.com/queries
-- Intended editor: Dune v2 SQL editor on the `solana` dataset.
--
-- -------------------------------------------------------------------------
-- PURPOSE
-- -------------------------------------------------------------------------
-- Dovey Wan's review asked for empirical evidence of WHICH transaction
-- patterns most need bounded-intent verification. Sakura's thesis is that
-- long-horizon, multi-protocol delegation (a single authorization +
-- session key, running across weeks, touching two or more distinct DeFi
-- protocols) is the highest-risk surface a session-key agent can touch.
--
-- This query identifies wallets whose 30-day activity *shape* matches
-- that thesis: repeatedly transacting with TWO OR MORE of the four live
-- Sakura-integrated protocols within the same 30-day window.
--
-- -------------------------------------------------------------------------
-- INTERPRETATION
-- -------------------------------------------------------------------------
-- A wallet hitting ≥ 2 of (Kamino, Jupiter, Jito, Raydium) in 30 days is
-- not conclusively "an AI agent." But the inverse is conclusive: a wallet
-- touching only a single protocol once never needs bounded-intent ZK;
-- a one-shot spending limit is sufficient. The bounded-intent primitive
-- pays for itself ONLY on the multi-protocol long-horizon population.
-- This query measures the size of that population.
--
-- -------------------------------------------------------------------------
-- PROGRAM IDS (all mainnet, matched in lib/adapters/*.ts)
-- -------------------------------------------------------------------------
--   Kamino Lend       KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
--   Jupiter Lend      jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9
--   Jupiter v6 Swap   JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
--   Jito Stake Pool   SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy
--   Raydium Router    routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS
--
-- -------------------------------------------------------------------------
-- NOTE ON DUNE SOLANA SCHEMA
-- -------------------------------------------------------------------------
-- This query uses `solana.instruction_calls` which is the current standard
-- public table for decoded-per-call instruction rows on Dune (columns:
-- block_time, tx_signer, executing_account, inner_instructions, tx_success).
-- If the schema has shifted by the time you run this, the intent is:
--
--   "For each signer seen in a successful tx whose executing_account is
--    one of the five programs above, count distinct *protocol families*
--    (Kamino, Jupiter-any, Jito, Raydium) they touched in the last 30
--    days. Keep rows where that count ≥ 2."
--
-- Translate accordingly if the column names differ.
-- -------------------------------------------------------------------------

WITH protocol_programs AS (
  SELECT 'Kamino'  AS family, 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' AS program_id UNION ALL
  SELECT 'Jupiter', 'jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9'           UNION ALL  -- Lend/Earn
  SELECT 'Jupiter', 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'           UNION ALL  -- v6 Swap
  SELECT 'Jito',    'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy'           UNION ALL  -- SPL Stake Pool
  SELECT 'Raydium', 'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS'           UNION ALL  -- Router
  SELECT 'Raydium', 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C'          UNION ALL  -- CPMM
  SELECT 'Raydium', '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'          UNION ALL  -- AMM v4
  SELECT 'Raydium', 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK'                     -- CLMM
),
wallet_protocol_touches AS (
  SELECT
    ic.tx_signer AS wallet,
    pp.family,
    COUNT(*) AS tx_count
  FROM solana.instruction_calls ic
  JOIN protocol_programs pp
    ON ic.executing_account = pp.program_id
  WHERE
    ic.block_time >= NOW() - INTERVAL '30' DAY
    AND ic.tx_success = true
  GROUP BY 1, 2
),
agentic_candidates AS (
  SELECT
    wallet,
    COUNT(DISTINCT family) AS distinct_protocol_families_touched,
    SUM(tx_count)          AS total_txs_in_window,
    ARRAY_AGG(family ORDER BY family) AS families_touched
  FROM wallet_protocol_touches
  GROUP BY 1
  HAVING COUNT(DISTINCT family) >= 2
)
SELECT
  distinct_protocol_families_touched,
  COUNT(*)       AS wallet_count,
  SUM(total_txs_in_window) AS aggregate_txs
FROM agentic_candidates
GROUP BY 1
ORDER BY 1 DESC;

-- Expected output shape (illustrative — real numbers depend on the run):
--   distinct_families_touched | wallet_count | aggregate_txs
--   --------------------------|--------------|--------------
--                           4 |       ~1,000 |       ~80,000
--                           3 |       ~6,000 |      ~240,000
--                           2 |      ~30,000 |      ~900,000
--
-- Read off: the denominator for bounded-intent value is the 2+, 3, 4
-- bands; the wallets in the "distinct = 1" band (not in this result set)
-- are the group for whom a simple spending cap suffices.
