# Sakura Rescue Backtest — Kamino Mainnet Liquidations

Generated: 2026-04-24T02:12:50.473Z
RPC: `https://solana-rpc.publicnode.com`
Window: last 30 days
Signatures scanned: 5000
Liquidation txs found: 0

## Aggregate Losses

|                              | USD                              |
|------------------------------|----------------------------------|
| Total user loss              | $0       |
| Average per liquidation      | $0         |
| Median per liquidation       | $0      |
| Largest single loss          | $0   |

## If Users Had Sakura Mandates

| Mandate cap | Preventable | % | USD saved |
|-------------|-------------|---|-----------|
| $5,000 | 0 / 0 | 0.0% | $0 |
| $10,000 | 0 / 0 | 0.0% | $0 |
| $50,000 | 0 / 0 | 0.0% | $0 |

## Sample liquidations (first 25)

| Slot | Δt | Debt repaid | Collateral seized | User loss | Tx |
|------|-----|-------------|-------------------|-----------|----|


## Caveats

- Historical Kamino obligation state is not retrievable from public RPC, so pre-liquidation health factor is not directly observed.
- Collateral-seized USD value is approximated as debt_repaid × 1.05 (Kamino's typical 3-7% liquidation bonus).
- Only USDC-denominated liquidations are scanned; cross-collateral liquidations without a USDC leg are skipped.
- The 'preventable' classifier is a capacity test: if user had pre-authorized >= debt_repaid USDC in Sakura mandate, they could have been rescued. It does not model agent monitoring latency or network congestion.

> Reproduce: `tsx scripts/backtest-rescues.ts --window-days 30 --max-events 0`
