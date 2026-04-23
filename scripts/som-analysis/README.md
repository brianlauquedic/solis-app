# SOM Analysis — Day-1 Serviceable Obtainable Market

Grounded evidence replacing the TAM slide. Every number here points to a
reproducible public data source so evaluators can verify without trusting us.

## Why this exists

Dovey Wan (Primitive Ventures) reviewed Sakura in 2026-04 and said:

> "技术方向是成立的, 就是有点太 meta & surface level. TAM 对于 startup 来说都
> 是假的, SOM 才是真的. Hackathon 还是做点 grounded 的用例比较合适 ——
> 譬如可触达的 integration targets, 每类 integration 的使用频次, 哪类交易最
> 需要这种边界验证 etc."

This folder is the response.

## What "Day-1 SOM" means

**Not** "the total $100B DeFi market we could theoretically serve." That's TAM,
and it's fake.

**Yes** "the exact wallets, on the exact 4 Solana protocols we already have
mainnet CPI adapters for, holding assets we can actually gate with our ZK
verifier today."

## The 4 integrated protocols (see `components/ArchitectureDiagram.tsx`)

| Protocol    | Category           | CPI cells | Adapter                          |
|-------------|--------------------|-----------|----------------------------------|
| Kamino      | Lending            | 4         | `lib/adapters/kamino.ts`         |
| Jupiter     | Swap + Lend        | 5         | `lib/adapters/jupiter-lend.ts`   |
| Jito        | LST                | 2         | `lib/adapters/jito.ts`           |
| Raydium     | AMM (direct swap)  | 1         | `lib/adapters/raydium.ts`        |
| **Total**   |                    | **12**    |                                  |

## Running the analysis

Two layers, different data sources, both reproducible.

### Layer 1 · DefiLlama (no key — runs in this sandbox)

```bash
# Static stock: reachable TVL + borrow exposure per protocol
npx tsx scripts/som-analysis/day1-som.ts

# Flow: share of Solana DeFi fee activity captured by the 4 protocols
npx tsx scripts/som-analysis/activity-pattern.ts
```

Outputs land in `output/{kind}-YYYY-MM-DD.{json,md}`. No API keys, no
projections. Every number traces back to a DefiLlama endpoint cited in
the JSON's `sources` field.

Latest runs (2026-04-24):

- `day1-som` — **$4.48B** addressable Solana TVL; **$1.62B** live borrow debt.
- `activity-pattern` — **10.7%** of Solana DeFi 30-day fees flowed through
  the 4 integrated protocols ($18.43M / $171.72M).

### Layer 2 · Dune SQL (wallet-level — evaluator-run)

DefiLlama gives protocol-level aggregates; wallet-level patterns need
decoded-tx data. The SQL in [`queries/`](queries/) is pre-written for
Dune's free-tier web UI at https://dune.com/queries — paste into the
editor, run against Solana, and get real numbers within seconds.

| Query | Answers |
|---|---|
| [`agentic-wallet-candidates.sql`](queries/agentic-wallet-candidates.sql) | How many wallets touched ≥ 2 of our 4 integrated protocols in 30 days? The population for whom bounded-intent ZK is value-creating. |
| [`borrow-long-horizon-share.sql`](queries/borrow-long-horizon-share.sql) | Of wallets that lend/borrow on Kamino or Jupiter Lend, what % also swap or stake? Stress-tests the "multi-delegation concentration" thesis — includes an honest pass/fail threshold. |

The queries document both the intent and the fallback behaviour if
Dune's Solana schema has drifted by the time an evaluator runs them.
