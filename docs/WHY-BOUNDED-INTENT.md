# Which transactions most need boundary verification?

Dovey Wan's review of Sakura asked, among three specific questions,
"哪类交易最需要这种边界验证？" — which transaction types most need this
bounded-intent verification?

This document answers that question from **protocol mechanics alone** —
no chain-data required. The companion artifact,
[`scripts/backtest-rescues.ts`](../scripts/backtest-rescues.ts), provides
the empirical confirmation from real Kamino mainnet liquidations.

---

## The four Solana DeFi surface classes Sakura gates

All twelve CPI cells Sakura's verifier can mediate (see [Integration
Coverage Proof](../README.md#integration-coverage--proof-of-reachability))
fall into four structural surface classes. Each has a distinctly
different risk profile under agent delegation:

| Surface | Our CPI cells | Duration | Loss upper bound (per unbounded delegation) |
|---|---|---|---|
| **Swap** | Jupiter v6 Swap, Raydium AMM | ~seconds | amount swapped × slippage |
| **Stake** | Jito JitoSOL stake / unstake | days–weeks (lockup) | staked amount × (validator slashing ∨ LST depeg) |
| **Lend supply** | Kamino supply, Jupiter Lend supply | continuous | principal × bad-debt event probability |
| **Lend borrow** | Kamino borrow, Jupiter Lend borrow | continuous | **collateral × time × volatility — no natural ceiling within the action amount** |

The first three surfaces are **bounded by the action amount itself.** A
swap of $X can lose at most $X × (slippage + MEV). A stake of $X can
lose at most $X × (depeg + slashing). A lend-supply of $X can lose at
most $X × (bad-debt). In each case, a simple **per-action spending cap**
is sufficient protection — and this is precisely the protection that
session-key wallets, allowlists, and rate-limiters provide today.

The fourth surface — **borrow against collateral** — is structurally
different. An action that borrows $X against $Y of collateral can, after
a market move, cause the liquidation of **the entire $Y** (plus
liquidation penalty, typically 3–7%). The loss is bounded not by the
action amount $X, but by $Y, the collateral — a magnitude orders
greater. Agent session keys that approve borrow actions therefore
effectively authorize access to the entire collateral base, not to the
stated borrow amount.

---

## Why multi-protocol delegation is where the pain concentrates

A session key or OAuth-style approval is a single trust decision. Its
blast radius scales with how many distinct surface classes it unlocks:

1. **Single-surface delegation** — e.g., "agent may swap up to $500" —
   loss is capped at $500 × slippage. Bounded-intent ZK is overkill
   here; a classical spending cap works fine.
2. **Multi-surface delegation** — e.g., "agent may swap OR lend OR
   borrow" — the agent picks the surface with the highest leverage at
   decision time. If borrow is in the set, the upper-bound collapses
   from "amount per action" to "collateral × time × volatility" as
   above.
3. **Multi-protocol delegation** — e.g., "agent may rebalance across
   Kamino and Jupiter Lend" — the agent can *move position between
   protocols*. This is where the most dangerous pattern lives:
   withdraw-from-A → the withdraw completes, the deposit-to-B fails or
   is manipulated, and the funds end up in attacker-controlled
   destination. Single-protocol session keys can be rate-limited or
   health-checked by the protocol itself; multi-protocol session keys
   cannot be policed at any protocol's boundary.

On the four Solana DeFi protocols Sakura integrates, the
**borrow-holding, multi-protocol-delegating wallet** is the population
where the agent risk is highest. Per
[`scripts/som-analysis/output/day1-som-2026-04-23.md`](../scripts/som-analysis/output/day1-som-2026-04-23.md),
the total outstanding borrow debt across Kamino + Jupiter Lend is
**\$1.62B** (as of 2026-04-24, sourced from DefiLlama). **Every dollar of
this is exposed to unbounded agent delegation today** if the user
approves a session key that includes a borrow action.

---

## Why only bounded-intent ZK verification solves it

Five existing primitives compete for this role. Each fails a specific
structural test that ZK-bounded intent passes:

| Primitive | What it checks | Fails when |
|---|---|---|
| Spending cap (per-action) | \$X per action ≤ user-set limit | Agent submits N actions × \$X = N × \$X total; collateral-based liquidation is not bounded by per-action cap |
| Session-key expiry | Key is valid until time T | Market moves faster than T; or agent is attacker-controlled within T |
| Allowlist of protocol programs | Agent may only call programs in the set | The set *itself* is the attack surface; any program in the set can liquidate via borrow mechanics |
| Rate limit (per-protocol) | N actions per window on protocol P | Agent routes across P1, P2, P3 within the window |
| Audit log / session receipt | Every action writes a verifiable record | Action already executed; the record is a post-mortem |
| **Bounded-intent ZK (Sakura)** | **Every action satisfies a Groth16 proof that it lies within a user-signed commitment over seven private values (amount cap, USD cap, protocol bitmap, action bitmap, nonce, wallet, intent text) — enforced atomically at instruction composition** | **By construction: a failing proof reverts the transaction before the DeFi instruction is allowed to touch user funds.** |

The distinguishing property: **the check is cryptographic, not
advisory.** There is no "trusted middleware" layer that an attacker can
compromise to bypass it — the verifier is a Solana program, the
verifying key is baked in, the trusted setup is complete, and the proof
composition is atomic with the action it gates.

---

## The direct answer to Dovey's question

**Which transactions most need bounded-intent verification?**

The transactions where the loss upper bound is not capped by the action
amount — specifically, **borrow actions on Kamino or Jupiter Lend taken
by agents whose session keys also authorize swap or stake across other
protocols.** \$1.62B of outstanding Solana borrow debt sits on this
surface today.

**Which transactions do not?**

Single-action swaps under user-set caps. Single-protocol stakes into
known LSTs. Lend-supply-only flows. For these, a spending cap and an
allowlist already work — Sakura's primitive is available but not
required. We do not recommend users enable bounded-intent gating for
these unless they also want the audit property.

This is the honest Dovey-grade answer: the primitive earns its
complexity only on the borrow-exposed, multi-protocol-delegating
surface. That surface is where it is structurally necessary and where
no other primitive is structurally sufficient.

---

## Empirical backing

Logical reasoning above; real-world evidence in
[`scripts/backtest-rescues.ts`](../scripts/backtest-rescues.ts), which
replays actual Kamino mainnet liquidations from the last thirty days,
extracts per-event dollar losses from on-chain token balance diffs, and
classifies each by "would a Sakura user-authorized rescue mandate at
\$5k / \$10k / \$50k have prevented this?" Output lands in
[`docs/BACKTEST-RESCUES.md`](BACKTEST-RESCUES.md) when run.

Run locally:

```bash
# Public mainnet RPC works (slow, rate-limited); Helius key makes it faster.
npx tsx scripts/backtest-rescues.ts --window-days 30 --max-events 300
```

The backtest numbers anchor the abstract claim in this document to real
dollars that real users lost last month — the same users Sakura is
built to serve.
