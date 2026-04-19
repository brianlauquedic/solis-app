# How Sakura captures value without a token

Sakura is infrastructure. Infrastructure that becomes a standard earns
revenue. The harder question, once the decision to not issue a token
is made, is *where* the revenue accrues and *how* that accrual defends
the primitive's long-term position. This document is the plain answer.

## The decision, and the reason

Sakura does not and will not have a token. The reason is architectural,
not ideological: a primitive with a token acquires a political
economy that the underlying math does not need and cannot afford. The
Solana SSL-equivalent — HTTPS certificate issuance — works because
certificate authorities collect fiat fees, not because there is a
token rewarding holders for certificate generation. Sakura is built
the same way.

The consequence is that every revenue path below is *already* live in
the on-chain program. Nothing is contingent on a future governance
process.

## The fee structure, as shipped

| Parameter | Value | Ceiling | Governance |
|---|---|---|---|
| `execution_fee_bps` | 10 (0.1%) | 200 (2%) | Admin multisig |
| `platform_fee_bps` | 1,500 (15% of exec fee) | 10,000 (100%) | Admin multisig |

Every time the ZK gate authorizes a DeFi instruction, 0.1% of the
action's notional value is routed from the user's payer account to
the protocol's fee vault. 15% of that fee is siphoned to a platform
treasury — a USDC token account held by the admin multisig. The
remaining 85% remains in the protocol fee vault and funds ceremony
maintenance, proof-generation infrastructure, and integrator support.

At mainnet-scale numbers: $100M of agentic DeFi execution per month
generates $100,000 of gross protocol revenue per month, $15,000 of
which accrues to the platform treasury. That is the baseline.

## The four accrual paths

### 1. The notional fee (baseline)

The headline revenue path. As more wallets integrate Sakura, more
agentic executions pass through the gate, more notional fee is
collected. The growth function is a function of (a) how much retail
capital routes through agent modes, (b) how many wallets adopt
Sakura versus building bespoke gates, and (c) how aggressively
integrators negotiate rebates.

### 2. Enterprise SLAs for proof-generation infrastructure

snarkjs proof generation takes ~8 seconds in a browser. For a retail
user signing an intent once a week and executing twice, this is fine.
For a wallet fronting tens of thousands of agentic transactions per
hour, it is not. Enterprise integrators will want priority
proof-generation infrastructure with (a) sub-two-second proof latency
via GPU-accelerated snarkjs or a Rust prover, (b) a 99.9% SLA, and
(c) a support contract.

This is priced off-protocol. It is the highest-margin revenue line
because it is consumed by the largest integrators. It is also the
line that most cleanly maps to Stripe's "you get the API for free;
you pay for the guarantees" model.

### 3. x402 / MCP toll on developer infrastructure

Sakura's MCP server at `/api/mcp` exposes three read-only tools (see
`app/api/mcp/route.ts`). Each tool call is gated by x402 — the caller
pays $1 USDC on-chain per call. This is the developer-facing revenue
surface: AI-agent frameworks, backtesting infrastructure, tooling
vendors that query Sakura programmatically pay per query in USDC
with no credit card, no account, no OAuth. The economics are small
per call but the call volume from the broader agent-tooling ecosystem
is significant once integration is routine.

### 4. MEV bundle routing (future, architecturally possible)

The v0 transaction that carries the ZK gate plus the DeFi instruction
is a natural MEV bundle. A future extension can route bundles through
the protocol's own Jito relay, collecting a priority-fee rebate. This
is not shipped but the architecture does not prevent it.

## How the primitive defends its position

The non-token model creates a specific defensibility pattern, familiar
from certificate authorities and Stripe: the primitive defends its
position *not* through token network effects but through integration
depth.

- **Trusted setup**: a fork would need to re-run a Phase 2 ceremony,
  involve a credible set of participants, and re-key every integrator.
  Expensive and coordination-heavy, not impossible.
- **Integrator switching costs**: a wallet that has shipped against
  Sakura's client libraries, compiled its UI against the commitment
  layout, and accumulated an on-chain audit trail under Sakura's
  program ID has real switching costs even if the fork is cheaper.
- **Composability with the ecosystem**: Sakura's gate lands inside
  the same atomic transaction as Jupiter, Kamino, MarginFi CPIs.
  Every DEX aggregator that adds Sakura support becomes a marginal
  strengthening of Sakura's role as the default gate.

No single path is a permanent moat. The combination is how real
infrastructure wins and holds.

## Bilateral rebates for the first wave

For integrators shipping in the next six months, Sakura offers a
bilateral rebate agreement: the first $10M of notional volume routed
through the gate from a given wallet is fee-free; the next $40M is at
50% of the posted rate. The mechanics are operational (off-program
rebate payout), not a program change. This is modeled after Stripe
Atlas's 2015 launch terms and has the same goal: remove every reason
not to integrate during the window when defaults are being set.

## Treasury governance

The platform treasury is a USDC associated-token-account held by the
admin multisig. The multisig is 3-of-5 at mainnet graduation — team
members plus two independent signers (TBD, one crypto-native
foundation, one Solana-DeFi veteran). The multisig is authorized to:

- Adjust `execution_fee_bps` within the 2% ceiling
- Adjust `platform_fee_bps` within the 100% ceiling
- Pause the protocol (`set_paused`) in emergencies
- Rotate admin (`rotate_admin`) on signer key compromise

The multisig is not authorized to:

- Change the program's verifying key
- Withdraw from the protocol fee vault outside the `platform_fee_bps`
  split
- Execute on behalf of a user without a valid proof

These constraints are enforced by the Anchor program, not by multisig
policy.

---

## The bottom line

Sakura earns the right to exist by being the cheapest, safest, and
most integration-ready gate on Solana. It earns its revenue by
charging 0.1% of the notional it enables — roughly 50 times less than
a single Kamino liquidation fee, and roughly the same as a single
Jupiter routing tip. It defends its position through integration
depth, not through token rewards. If the volume is there in 2026, the
economics work; if the volume is not, the treasury stays small and
the primitive remains useful anyway.

Infrastructure at its best is the boring thing every builder uses and
no user remembers. That is the aspiration. The token-less fee model is
what makes the aspiration financially sustainable.
