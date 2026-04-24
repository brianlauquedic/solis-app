# SOM Analysis — Day-1 Serviceable Obtainable Market

Grounded evidence replacing the TAM slide. Every number here points to a
reproducible public data source so evaluators can verify without trusting us.

Layered by **dependency self-containment** — the most self-built artefact
first, the most externally-dependent last. If every third-party API in
this folder disappeared tomorrow, Layers 0 and 1 alone still answer
Dovey's three questions with real numbers.

## Why this exists

Dovey Wan (Primitive Ventures) reviewed Sakura in 2026-04 and said:

> "技术方向是成立的, 就是有点太 meta & surface level. TAM 对于 startup 来说都
> 是假的, SOM 才是真的. Hackathon 还是做点 grounded 的用例比较合适 ——
> 譬如可触达的 integration targets, 每类 integration 的使用频次, 哪类交易最
> 需要这种边界验证 etc."

This folder is the response.

## What "Day-1 SOM" means

**Not** "the total \$100B DeFi market we could theoretically serve." That's TAM,
and it's fake.

**Yes** "the exact wallets, on the exact 4 Solana protocols we already have
mainnet CPI adapters for, holding assets we can actually gate with our ZK
verifier today."

## The 4 integrated protocols

| Protocol    | Category           | CPI cells | Adapter                          |
|-------------|--------------------|-----------|----------------------------------|
| Kamino      | Lending            | 4         | [`lib/adapters/kamino.ts`](../../lib/adapters/kamino.ts) |
| Jupiter     | Swap + Lend        | 5         | [`lib/adapters/jupiter-lend.ts`](../../lib/adapters/jupiter-lend.ts) |
| Jito        | LST                | 2         | [`lib/adapters/jito.ts`](../../lib/adapters/jito.ts) |
| Raydium     | AMM (direct swap)  | 1         | [`lib/adapters/raydium.ts`](../../lib/adapters/raydium.ts) |
| **Total**   |                    | **12**    |                                  |

## Four layers of evidence

### Layer 0 · Pure logic (zero runtime dependencies)

**[`docs/WHY-BOUNDED-INTENT.md`](../../docs/WHY-BOUNDED-INTENT.md)** — a
single-page argument from protocol mechanics for why borrow-holding,
multi-protocol-delegating wallets are the transaction class most in need
of bounded-intent verification. No API calls. No data. Just reasoning
from how Solana DeFi primitives compose.

The reasoning is what makes the numbers mean something. This is the
layer that survives any possible API outage.

### Layer 1 · On-chain direct (Solana RPC only — any provider)

These scripts read Solana mainnet directly and do their own parsing.
They depend only on an RPC endpoint as a transport — which is
swappable across dozens of public providers since the data is the
public chain itself. No third-party aggregator in the loop.

```bash
# Cross-check: on-chain JitoSOL stake pool state vs DefiLlama's TVL.
# Proves DefiLlama's numbers are derivable from chain state we can
# read ourselves. ~1 RPC call, ~2 seconds.
npx tsx scripts/som-analysis/tvl-cross-check.ts

# Historical loss quantification: replays real Kamino mainnet
# liquidations from the last 30 days, extracts per-event dollar loss
# from on-chain token balance diffs, classifies by "would a Sakura
# authorization at $5k / $10k / $50k have prevented this?"
BACKTEST_RPC=https://solana-rpc.publicnode.com \
  npx tsx scripts/backtest-rescues.ts --window-days 30 --max-events 300
```

Outputs:

- [`output/tvl-cross-check-YYYY-MM-DD.{json,md}`](output/) — methodology
  + derived SOL/USD from chain vs. DefiLlama, side-by-side.
- [`docs/BACKTEST-RESCUES.{json,md}`](../../docs/) — per-tier preventable
  losses across real 30-day liquidation sample.

### Layer 2 · DefiLlama convenience (open-methodology aggregator)

```bash
# Static stock: reachable TVL + borrow exposure per protocol.
npx tsx scripts/som-analysis/day1-som.ts

# Flow: share of Solana DeFi fee activity captured by our 4 protocols.
npx tsx scripts/som-analysis/activity-pattern.ts
```

Outputs land in `output/{kind}-YYYY-MM-DD.{json,md}`. No API keys
required.

Why DefiLlama and not a closed vendor:

- DefiLlama is an **open-methodology aggregator** — their protocol
  adapters are public source code, anyone can run their own instance
  and reproduce the numbers.
- Layer 1's `tvl-cross-check.ts` validates that DefiLlama's Jito TVL
  agrees with on-chain state, which means their methodology is
  verifiable rather than taken on faith. Extend the cross-check to
  other protocols by reading reserve PDAs + oracle prices — same
  code pattern.
- The numbers refresh every ~5 min on DefiLlama's side. Re-running
  the script produces fresh state without any indexing on our side.

Latest runs (2026-04-24):

- `day1-som` — **\$4.48B** addressable Solana TVL; **\$1.62B** live borrow debt.
- `activity-pattern` — **10.7%** of Solana DeFi 30-day fees flowed through
  the 4 integrated protocols (\$18.43M / \$171.72M).

### Layer 3 · Optional deeper wallet analysis

**Wallet-level overlap**, which answers "what share of agentic wallets
cross-delegate" at the wallet dimension, requires a tx-signature-level
indexer. Two entrypoints, in descending self-containment:

| Tool | Self-containment | File |
|---|---|---|
| **publicnode RPC (zero-key)** + our own indexing | **High** — no API key, no signup | [`agentic-wallets-publicnode.ts`](agentic-wallets-publicnode.ts) |
| Helius RPC (free, 50k credits/day) + our own indexing | Medium — Helius is hosted, our indexer is self-written | [`agentic-wallets-helius.ts`](agentic-wallets-helius.ts) |
| Dune SQL saved queries | Low — relies on Dune's compute + schema | [`queries/agentic-wallet-candidates.sql`](queries/agentic-wallet-candidates.sql), [`queries/borrow-long-horizon-share.sql`](queries/borrow-long-horizon-share.sql) |

```bash
# Default zero-key path: no API key, no signup, runs anywhere.
npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts

# Deeper scan (requires own paid RPC key)
OVERLAP_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \
  MAX_SIGS_PER_FAMILY=20000 \
  npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts
```

**Honest reading of the zero-key variant**: at publicnode's ~800 sigs/
family cap, Jupiter's sample window is measured in *seconds* of wall-
clock time, so the measured multi-protocol intersection is dominated by
non-overlapping time windows, not a population estimate. The script's
value at the zero-key cap is **proof every family is reachable from any
machine with no credentials**; the population-level "which txs most need
boundary verification" answer stays on protocol mechanics (Layer 0) and
borrow-exposed dollar count ($1.62B on Kamino + Jupiter Lend, Layer 2).

All three entrypoints are **optional** for closing the Dovey loop —
Layers 0+1+2 already answer her three questions. Layer 3 is for
evaluators who want to poke the wallet dimension with their own keys.

The Dune queries are all public-forked saved queries:

- [query 7364956](https://dune.com/queries/7364956) — 7-day version
- [query 7365317](https://dune.com/queries/7365317) — 1-day version
- [query 7365365](https://dune.com/queries/7365365) — 5 % sample
- [query 7366327](https://dune.com/queries/7366327) — decoded-namespaces version

**Honest finding from free-tier Dune**: every variant of the
wallet-overlap query times out at the platform's 2-minute free-tier
cap. Solana's on-chain activity volume is too high for Dune free-tier
medium-engine scans over `solana.instruction_calls`, even on a single
day or with 5% sampling. Analyst tier (\$400/mo) unblocks this; so
does Helius + our own `agentic-wallets-helius.ts`.

## Summary of what closes the Dovey loop

| Dovey's question | Answered by | Layer |
|---|---|---|
| "Don't write TAM" | `ceilingBody` rewrite + [Integration Coverage table](../../README.md#integration-coverage--proof-of-reachability) | 0 (logic) |
| "SOM 才是真的" | `day1-som.ts` → \$4.48B, cross-checked on-chain | 2 verified by 1 |
| Reachable integration targets | [README Integration Coverage](../../README.md#integration-coverage--proof-of-reachability) — 4 clickable Solscan programs | 0 |
| Usage frequency per integration type | `activity-pattern.ts` → 10.7 % of Solana DeFi fees | 2 |
| Which txs most need boundary verification | [`docs/WHY-BOUNDED-INTENT.md`](../../docs/WHY-BOUNDED-INTENT.md) reasoning + `backtest-rescues.ts` empirical | 0 + 1 |

Five of five answered from Layers 0+1+2. Layer 3 is optional depth.
