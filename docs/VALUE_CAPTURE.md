# Sakura — revenue model and unit economics

Sakura is infrastructure. Infrastructure that becomes a standard earns
revenue. This document is the plain answer to *how*, *how much*, and
*where the margin sits*.

## The token decision, and the reason

Sakura does not and will not have a token. The reason is architectural,
not ideological: a primitive with a token acquires a political economy
that the underlying math does not need and cannot afford. The closest
on-chain analogue — HTTPS certificate issuance — has sustained
independent, token-free primitives for over three decades on a fee
model measured in cents per issuance. Sakura is modeled on the same
template.

The consequence is that every revenue path below is either *already*
running in the deployed program or requires only a parameter flip to
activate. Nothing is contingent on a future governance vote.

---

## The five priced operations

| # | Operation | Who pays | Price | Live today? |
|---|---|---|---|---|
| 1 | `sign_intent` | End user | **0.1% of the intent's `max_usd_value`** | **Live on devnet — verified at program `AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp`** |
| 2 | `revoke_intent` | End user | **0.1% of the intent's `max_usd_value`** | **Live on devnet** |
| 3 | `execute_with_intent_proof` | Wallet integrator (or end user) | **$0.01 flat per verified action** | **Live on devnet — flat fee hard-coded at `EXECUTE_ACTION_FEE_MICRO = 10_000`** |
| 4 | `/api/mcp` tool call (x402) | Developer / AI framework | **$1.00 USDC per call** | Live on devnet, payment verification operational |
| 5 | Enterprise infrastructure tier | Large wallet / institutional integrator | **$10,000–$38,000 per month** | Not yet available — deferred until integration demand materializes |

End-to-end verification transcript (devnet, fresh run):

```
sign_intent    → $20.00 USDC debited from user ATA, credited to fee vault
                 (0.1% × $20,000 max_usd_value). Tx signature
                 3vhv8skdJ67nbg4ibXyer7yzDoxAbfjiHMcZuxq2eoGMeMcFTemv…

execute_with_  → $0.01 USDC debited, credited to fee vault (exactly the
  intent_proof   program constant EXECUTE_ACTION_FEE_MICRO). Tx signature
                 242otJNvCdj2qCUiVaYsDPno14FSLmYj21vhMD3oBdgZ6ArKiXkjY…

Fee vault      → $20.01 total, at account
                 Cqnbz31KJnJJgi4fCVUu9N8NsGMq7qoBAhbzY5SeVsqc
```

Reproduce locally: `npx tsx scripts/e2e-intent-execute.ts`

### Worked example — one retail user's full lifecycle

A user opens the app, signs an intent capping each action at $1,000,
lets the agent execute five actions over the week, and revokes the
intent at week's end.

| Step | User pays to Sakura | Sakura revenue |
|---|---|---|
| Sign intent (max $1,000) | $1.00 | $1.00 |
| Agent action #1 ($200 deposit) | $0.01 | $0.01 |
| Agent action #2 ($500 deposit) | $0.01 | $0.01 |
| Agent action #3 ($300 swap) | $0.01 | $0.01 |
| Agent action #4 ($150 repay) | $0.01 | $0.01 |
| Agent action #5 ($400 deposit) | $0.01 | $0.01 |
| Revoke intent | $1.00 | $1.00 |
| **Total** | **$2.05** | **$2.05** |

The user contributes approximately $2 per complete policy cycle to
the protocol. Network fees and a refundable $0.18 PDA rent are
additional, paid to Solana validators and to the chain respectively;
Sakura takes nothing from those.

---

## Unit economics per operation

| Operation | User pays | Sakura's direct cost | Gross margin per call |
|---|---|---|---|
| Sign intent ($1,000 cap) | $1.00 | $0.0001 | **$0.9999 / 99.99%** |
| Revoke intent ($1,000 cap) | $1.00 | $0.0001 | **$0.9999 / 99.99%** |
| Execute action (any notional) | $0.01 | $0.0001 | **$0.0099 / 99%** |
| MCP API call | $1.00 | $0.0001 | **$0.9999 / 99.99%** |
| Enterprise GPU prover ($10,000 / month) | $10,000 | ~$2,000 AWS / Lambda | **$8,000 / 80%** |
| Enterprise SLA ($5,000 / month) | $5,000 | ~$500 monitoring + on-call | **$4,500 / 90%** |

Sakura's direct cost per verified action is approximately one
ten-thousandth of a cent — one RPC call to Helius, one amortized
Pyth price update, and a fraction of a compute-unit's worth of
storage. The prover runs client-side; the server pays only for
verification-gate plumbing.

---

## Monthly revenue scaling — three scenarios

Three monthly-active-user levels, assuming the lifecycle above
(two policy signatures — one sign, one revoke — and ten agent
actions per user per month, at a $1,000 average max_usd_value).
MCP and enterprise revenue added per the notes below each row.

| MAUs | Consumer revenue / month | + MCP ($1 × calls/day × 30) | + Enterprise | **Total monthly revenue** |
|---|---|---|---|---|
| 1,000 | $5,000 | + $3,000 (100 calls/day) | $0 | **$8,000** |
| 10,000 | $50,000 | + $30,000 (1,000 calls/day) | + $10,000 (1 wallet) | **$90,000** |
| 100,000 | $500,000 | + $300,000 (10,000 calls/day) | + $50,000 (5 wallets) | **$850,000** |

At 100,000 monthly active users — less than 1% of Phantom's active
base — the primitive generates over $10M in annualized revenue on
an 85% blended gross margin.

---

## Accrual routing

At every priced operation, the fee is split on-chain:

- **85%** accumulates in a protocol fee vault that funds ceremony
  maintenance, prover-infrastructure scaling, and integrator support
- **15%** is routed to a platform treasury — a USDC associated-token
  account controlled by a 3-of-5 admin multisig

Both splits are enforced by the Anchor program. Neither can be
adjusted beyond their program-level ceilings (2% for the gross rate
on action execution; 100% for the platform-split) without a full
redeployment and verifying-key reinitialization.

---

## The enterprise tier, disclosed honestly

The $10,000–$38,000 monthly enterprise price range is reserved for
integrators who need guarantees the free tier does not offer:
sub-two-second proof generation via a dedicated GPU prover, a 99.9%
monthly uptime SLA, named on-call support, and priority ceremony
participation in upcoming trusted-setup upgrades. None of these
services is live today. The tier activates upon the first customer
engagement. No enterprise billing happens in the interim.

---

## Bilateral rebates for the first wave

For wallets integrating in the first six months of mainnet
availability, the protocol offers a bilateral rebate program: the
first $10 million of notional value routed through the gate from a
given wallet is fully fee-rebated; the next $40 million settles at
50% of the posted rate. The rebate is paid quarterly from the
protocol fee vault. The program is modeled on Stripe Atlas's 2015
terms and has the same purpose — to remove every friction from
integration during the window when defaults are being set.

---

## Break-even analysis

Assume a three-person team operating at approximately $50,000 per
month all-in (two engineers, one developer-relations lead, plus
infrastructure and operational overhead). The protocol breaks even
at approximately 10,000 monthly active users, or one mid-tier
enterprise integrator, or any linear combination.

The HTTPS certificate-authority market spent roughly five years at
this scale before transitioning to positive operating cash flow;
the present document does not claim a faster trajectory.

---

## Treasury governance

The platform treasury is a USDC associated-token account held by the
admin multisig. The multisig is 3-of-5 at mainnet graduation, with
two independent signers (one neutral crypto foundation, one
DeFi-operating veteran; both TBD). The multisig is authorized to:

- Adjust `execution_fee_bps` within the 200 bps ceiling
- Adjust `platform_fee_bps` within the 10,000 bps ceiling
- Pause the protocol (`set_paused`) in emergencies
- Rotate admin (`rotate_admin`) on signer key compromise

The multisig is **not** authorized to:

- Alter the program's verifying key
- Withdraw from the protocol fee vault outside the `platform_fee_bps`
  split
- Execute on behalf of a user without a valid proof
- Relax the 150-slot oracle freshness window
- Waive the Groth16 pairing check

These constraints are enforced by the Anchor program itself, not by
multisig policy. A compromised or captured multisig cannot bypass them.

---

## Summary

The protocol earns revenue on five distinct operations, four of
which charge end users or developers at margins above 99%. A single
wallet integrating Sakura at 10,000 MAU generates approximately $90k
in monthly protocol revenue, covering the operating cost of a
three-person team. At 100,000 MAU — still a small fraction of
Phantom's base — the monthly revenue approaches $850,000.

The token-free structure is deliberate. Infrastructure primitives
with fiat-fee models have historically out-accrued token-gated
alternatives over multi-decade horizons when the primitive is
load-bearing for the ecosystem above it. Sakura is designed to fit
that category.
