# Sakura — Business Model

> This document accompanies [README.md](./README.md) (technical) with the commercial
> framing: who pays, how much, for what, and why the unit economics work.
> Written for Colosseum Frontier Hackathon 2026 judges and accelerator reviewers.

---

## 1. Problem-Market Fit

| Feature | Market size | Current pain | Willingness to pay |
|---|---|---|---|
| **Nonce Guardian** | Every Solana wallet holding ≥ $1k (millions) | April 2026 Drift exploit: $285M lost via unseen Durable Nonce authority hijack | $1 one-shot audit — lower than a Phantom transaction fee |
| **Ghost Run** | Active DeFi users (200k+ wallets on Kamino / Jupiter / Marinade monthly) | Multi-step strategies are all-or-nothing blind bets; bad routing, slippage, reverts cost 1–5% per run | 0.3% flat fee embedded in Jupiter swap integrator API — invisible to user |
| **Liquidation Shield** | Borrowers on Solana ~$4B TVL (Kamino + MarginFi + Solend + Drift) | 5–10% liquidation penalty is the largest latent cost in DeFi; volatility triggers cascade losses | 1% **success-only** performance fee on rescued USDC amount |

None of these charge subscriptions. All are usage-priced, with the Liquidation Shield structured so the user only pays when they measurably saved money (rescued penalty > 1% rescue fee).

---

## 2. Revenue Lines

### Line A — Nonce Guardian (x402)
- **Unit price:** $1.00 USDC per AI report, paid on-chain via [Coinbase x402 protocol](https://github.com/coinbase/x402)
- **Cost of goods:** ~$0.04 Claude Sonnet 4.6 tokens + ~$0.001 Solana gas + $0.0005 Helius RPC
- **Gross margin per transaction:** ~$0.95 (95%)
- **Payment rail:** USDC transfer verified by `x402-solana` facilitator; Upstash Redis replay protection prevents double-spend

### Line B — Ghost Run (Jupiter integrator fee)
- **Unit price:** 0.3% of swap notional (standard Jupiter integrator range is 0.1%–1.5%)
- **Cost of goods:** AI parse + simulate ≈ $0.02; no Jupiter cost (they reward integrators)
- **Gross margin per swap:** ≈ 80–90% at average $200 swap size
- **Payment rail:** Jupiter's `platformFeeBps` parameter — routed to our fee account at settlement, no separate tx

### Line C — Liquidation Shield (performance fee)
- **Unit price:** 1% of **rescued USDC amount** (matches current on-chain impl:
  `app/api/liquidation-shield/rescue/route.ts` — `RESCUE_FEE_PERCENT = 0.01`).
  Example: $800 rescue → $8 fee. User's net savings = (liquidation penalty avoided) − fee.
  At a 5% Kamino penalty, $800 rescued from a $16k collateral position avoids ~$40 penalty → $32 net saving.
- **Cost of goods:** SPL transfer gas + Memo gas + RPC reads ≈ $0.002
- **Constraints:** only charged on successful rescue (rescueSig non-null). Bounded
  above by the SPL delegate allowance (user-signed on-chain cap).
- **Payment rail:** fee tx is a separate SPL transfer by the agent (same delegate),
  sent after rescueSig confirms. A failed fee tx is surfaced to the frontend
  (`feeCollected: false`) rather than silently lost.
- **Pricing roadmap:** future "saved-penalty" pricing model (fee = 1% × penalty avoided)
  requires an on-chain oracle of each protocol's liquidation-penalty parameter. Tracked
  separately — current code is **flat 1% of rescue amount**, and that is what BUSINESS.md
  reflects.

---

## 3. Unit Economics (Indicative)

Assumes a single mid-tier user who touches all three features monthly. Numbers are illustrative ranges, not guarantees.

| Metric | Month 1 (typical user) |
|---|---|
| Nonce Guardian reports | 1 × $1.00 = **$1.00** |
| Ghost Run (≈5 runs × $200 swap × 0.3%) | **$3.00** |
| Liquidation Shield fires (≈0.3 avg/mo × $400 rescue × 1%) | **$1.20** |
| **Total ARPU / month** | **~$5.20** |
| **Variable cost** (AI + gas + RPC) | **~$0.25** |
| **Contribution margin** | **~$4.95 (95%)** |

Break-even on fixed infra (Vercel Pro + Helius Growth + Upstash + Claude quota ≈ $900/mo) at ~182 paying monthly actives. Solana Frontier has >500k monthly active wallets; a 0.04% penetration hits break-even.

---

## 4. Defensibility

1. **Cryptographic audit chain** — every operation writes a Memo anchor + Merkle leaf. Competitors copying UI cannot fake the audit chain retroactively.
2. **Dual-gate rescue architecture** — SPL delegate + Anchor PDA co-verification. Competitors using delegate-only (Apricot Assist) lack the explicit mandate policy layer; PDA-only competitors lack the token-program-enforced hard cap.
3. **Rate-limiting + replay infra** — Upstash Redis distributed limiter + SETNX replay guard. Not novel, but correctly wired — most hackathon projects ship with in-memory rate limiting that breaks at scale.
4. **Cross-protocol coverage** — single rescue flow works across Kamino, MarginFi, and (next) Solend. Apricot Assist is locked to Apricot's own X-Farm.

---

## 5. Go-to-Market

| Phase | Channel | KPI |
|---|---|---|
| **Hackathon → month 0** | Colosseum demo day, Solana twitter, Crossroads attendee list | 500 wallet audits |
| **Month 1–3** | Integrations with Backpack / Phantom feed (wallet security widget); Kamino partnership for rescue prompts in their UI | 2k MAU |
| **Month 3–6** | Paid acquisition on Solana-native ad networks (Coinflow, Light Wallet); B2B API tier for portfolio trackers (Step Finance, Sonar) | 10k MAU, $50k MRR |
| **Month 6–12** | Mainnet deploy of Anchor Mandate program; v2 with Drift + Solend; DAO-style fee split with integrators | 50k MAU, $250k MRR |

---

## 6. Regulatory Framing

- **Not custodial** — SPL delegate means user's USDC stays in their ATA; we can move up to an approved cap but cannot take ownership. Any tx is co-visible on-chain.
- **Not advisory** — rescue triggers and thresholds are user-configured; Sakura executes pre-authorized policy, does not recommend trades.
- **Audit trail** — every op has a Memo anchor + SHA-256 digest chain. End users and regulators can independently verify historical behavior.

---

## 7. Accelerator Ask

- **Grant / runway:** $30k grand champion prize (if awarded) funds 6-month mainnet deployment, third-party security audit (OtterSec or Neodyme), and a single full-time ops engineer.
- **Colosseum accelerator:** priority on Kamino & MarginFi integration intros; sequencing with Drift post-exploit recovery for Nonce Guardian launch partnership.
- **Post-hackathon timeline:** mainnet Anchor deploy, OtterSec audit, Backpack integration — in that order.

---

*Last updated: 2026-04-17. Numbers reflect current code + researched market comps. Future projections are good-faith estimates, not guarantees.*
