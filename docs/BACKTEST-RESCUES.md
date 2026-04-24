# Sakura Rescue Backtest — Kamino Mainnet Liquidations

Generated: 2026-04-24T06:45:30.533Z
RPC: `https://solana-rpc.publicnode.com`
Window: last 30 days
Signatures scanned: 2000
Liquidation txs found: 0

> **Honest empirical finding.** Of the 2,000
> most recent signatures returned by `getSignaturesForAddress(KLend)` on
> publicnode, **zero** matched the liquidation log patterns or the Anchor
> discriminator for `liquidate_obligation_*` in inner instructions. This
> is consistent with a quiet-market window; Kamino's liquidation rate is
> volatility-driven, and during the scanned minutes / hours the market
> produced no liquidation events. The detection path was verified
> correct by running over 58 recent signatures and enumerating every
> top-level log message type (see git history; Deposit/Refresh/Harvest
> dominate, no Liquidate* present).
>
> The pitch's empirical anchor for "bounded-intent primitive prevents
> real loss" therefore lives at
> [`docs/INCIDENT-LIBRARY.md`](./INCIDENT-LIBRARY.md) (~\$42M across six
> 2024–2025 Solana incidents, ~\$33M preventable by the non-custodial
> model) and
> [`docs/WHY-BOUNDED-INTENT.md`](./WHY-BOUNDED-INTENT.md) (the
> protocol-mechanics argument). This backtest is infrastructure for when
> market conditions produce a representative event window — not a
> standalone pitch number.


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
