# Sakura

**Built for AI agents. Enforced by math.**

Cryptographic bounds on what an AI agent can do with your money — a Solana-native execution-bounds verifier that turns "out of bounds" from a policy into a mathematical impossibility.

**Day-1 SOM: $4.48B in Solana TVL addressable via 12 mainnet CPI cells** — Kamino lending $1.67B, Jupiter (Swap + Lend) $880M, Jito LST $920M, Raydium AMM $1.01B. Of which **$1.62B is outstanding borrow debt** — the surface most exposed to unbounded agent delegation today. Sourced from DefiLlama; reproducible by [`npx tsx scripts/som-analysis/day1-som.ts`](scripts/som-analysis/day1-som.ts). Not TAM. Not projection. The real number.

**Flow, not just stock: 10.7% of Solana DeFi fees over the last 30 days flowed through these four protocols** ($18.4M of $171.7M). Reproducible by [`npx tsx scripts/som-analysis/activity-pattern.ts`](scripts/som-analysis/activity-pattern.ts).

**Independently cross-checked against on-chain state** — [`tvl-cross-check.ts`](scripts/som-analysis/tvl-cross-check.ts) reads JitoSOL's SPL Stake Pool state directly via public Solana RPC (single `getAccountInfo` call, no aggregator), parses `total_lamports` from the 274-byte account layout, and compares against DefiLlama's reported Jito TVL. The two views agree within the SOL spot-price band at read time. DefiLlama is a convenience layer, not a black box.

**Why this surface needs bounded-intent verification** — [`docs/WHY-BOUNDED-INTENT.md`](docs/WHY-BOUNDED-INTENT.md) argues from protocol mechanics alone (zero runtime dependency) for why borrow-holding, multi-protocol-delegating wallets are the transaction class where the loss upper bound escapes the action amount — and therefore where no classical primitive (spending cap, session-key expiry, allowlist, rate limit, audit log) is structurally sufficient.

A ZK circuit that verifies every agentic DeFi action against a
user-signed intent — before the action is allowed to touch user
funds. Solana's `alt_bn128` pairing syscall executes the gate in
**~204,460 compute units per transaction** (C-full, Pyth ∩ Switchboard
dual-oracle median-gated; mean of 5/5 devnet runs 2026-04-22, see
[`docs/bench/2026-04-22-cfull-cu.json`](docs/bench/2026-04-22-cfull-cu.json)).
Of that, ~76k goes to posting the fresh Switchboard price update
and ~128k to the Sakura `execute_with_intent_proof` handler itself
(Groth16 pairing + oracle checks + `ActionRecord` PDA init).
A failing proof reverts the entire transaction before the underlying
DeFi instruction can execute.

[![Program](https://img.shields.io/badge/devnet%20program-AnszeCRFs…YLp-brightgreen?logo=solana)](https://solscan.io/account/AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp?cluster=devnet)
[![Status](https://img.shields.io/badge/status-devnet_today_·_mainnet_on_audit-B8932A)](#trust-model-precisely-stated)
[![Verification](https://img.shields.io/badge/dual__oracle_gate-204%2C460_CU-blue)](./docs/bench/2026-04-22-cfull-cu.json)
[![Invariants](https://img.shields.io/badge/adversarial_stress-15%2F15_reverted-success)](./docs/bench/2026-04-22-stress.json)
[![Tests](https://img.shields.io/badge/invariant%20tests-8%20passing-green)](./__tests__/)
[![No Token](https://img.shields.io/badge/token-none-lightgrey)](./docs/VALUE_CAPTURE.md)

[→ Live demo (no wallet needed)](https://www.sakuraaai.com/?demo=true) ·
[→ Full E2E on devnet in 30s](./scripts/e2e-intent-execute.ts) ·
[→ Submission · Colosseum Frontier 2026](https://frontier.colosseum.org/)

---

## What happens when an agent tries to act

A user signs once, in natural language:

> *"The agent may lend up to \$1,000 into Kamino or Jupiter Lend for one week."*

The instruction is compressed, via a two-layer Poseidon hash, into a
thirty-two-byte commitment stored in a Program Derived Address on
Solana. The user's private policy — per-action cap, allowed-protocol
set, expiry — remains in the user's browser. Only the 32-byte hash
reaches the chain.

Every subsequent agent action flows through the same six-check gate:

```
  agent proposes action
         │
         ▼
  ┌──────────────────────────────────────────────────────┐
  │  1.  Groth16 proof of intent bounds                  │   alt_bn128 pairing
  │  2.  Pyth PriceUpdateV2 feed-id + slot re-parse      │   oracle not spoofable
  │  3.  150-slot price-freshness window                 │   stale price → revert
  │  4.  Pyth spot-vs-EMA deviation ≤ 2%   (C-lite)      │   flash manip → revert
  │  5.  Switchboard feed_hash + ≤ 1% vs Pyth (C-full)   │   sustained compromise → revert
  │  6.  ActionRecord PDA replay guard                   │   seeded by (intent, nonce)
  └──────────────────────────────────────────────────────┘
         │                          │
     any check fails            all six pass
         ▼                          ▼
   TRANSACTION REVERTS       DeFi instruction executes atomically
   funds never moved         fee vault collects 0.1% + $0.01 flat
```

The oracle public input to the Groth16 proof is not the raw Pyth
price — it is the **median of Pyth and Switchboard**, admitted only
when the cross-oracle deviation stays within 100 basis points.
Defeating the gate would require simultaneously compromising Pyth's
publisher network *and* Switchboard's, two organizationally and
infrastructurally independent oracle systems, and doing so in
sufficient lockstep to keep their reported prices within one per
cent of each other.

The failing case is the important one. Nothing downstream of the gate
executes until all six checks land. Every action on a Sakura-gated
wallet is either mathematically in-bounds or it did not happen.

---

## We revert. Others record.

The Solana ecosystem has produced several responses to the agentic-DeFi
containment problem. Sakura is the only one that acts *before* a bad
action lands.

| Approach | Mechanism | What happens to an out-of-bounds action |
|---|---|---|
| Session-key rotation *(default wallet answer)* | Operator narrows the next key after the fact | Lands, then the next key is narrower |
| [Signed AI](https://arena.colosseum.org/projects/explore/signed-ai) *(Breakout 2025)* | Each decision signed → compressed-NFT log | Lands, then a receipt is minted |
| [AgentRunner](https://arena.colosseum.org/projects/explore/agentrunner) *(Cypherpunk 2025)* | Daily Merkle root anchored on-chain | Lands, then rolled into the day's root |
| [AgentCred](https://arena.colosseum.org/projects/explore/agent-cred) *(Cypherpunk 2025)* | Hot-key / cold-key split + balance monitor | Lands up to the hot-key balance |
| **Sakura** | **Groth16 proof-of-intent on every action** | **Reverts before the DeFi instruction executes** |

Receipts, audits, and alerts are downstream consolations for a
decision that already landed. Sakura gates first.

---

## Integration coverage — proof of reachability

Not "we could integrate with any Solana DeFi protocol." The four below,
today, with mainnet-format CPI instruction bytes produced by adapters
in this repo. Every program ID is clickable; every adapter and verify
script is in-tree. Click any row, verify independently.

| Protocol | Cells | Mainnet program | Adapter | Verify script |
|---|---:|---|---|---|
| **Kamino** (Lend / Borrow / Repay / Withdraw) | 4 | [`KLend2g3cP87f…AYavgmjD`](https://solscan.io/account/KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD) | [`lib/adapters/kamino.ts`](lib/adapters/kamino.ts) | [`scripts/verify-kamino-adapter.ts`](scripts/verify-kamino-adapter.ts) |
| **Jupiter Lend** (Lend / Borrow / Repay / Withdraw) | 4 | [`jup3YeL8Qh…brndc9`](https://solscan.io/account/jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9) | [`lib/adapters/jupiter-lend.ts`](lib/adapters/jupiter-lend.ts) | [`scripts/verify-jupiter-lend-adapter.ts`](scripts/verify-jupiter-lend-adapter.ts) |
| **Jupiter v6 Swap** | 1 | HTTP aggregator (routes across Raydium, Orca, Meteora, Phoenix, …) | [`lib/sak-executor.ts`](lib/sak-executor.ts#L114) (`buildJupiterSwapIxs`) | covered by [`scripts/e2e-intent-execute.ts`](scripts/e2e-intent-execute.ts) |
| **Jito** (Stake / Unstake) | 2 | [`SPoo1Ku8WFXoN…SLUNakuHy`](https://solscan.io/account/SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy) — SPL Stake Pool program, operating on JitoSOL pool state [`Jito4APyf…5Awbb`](https://solscan.io/account/Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb) | [`lib/adapters/jito.ts`](lib/adapters/jito.ts) | [`scripts/verify-jito-adapter.ts`](scripts/verify-jito-adapter.ts) |
| **Raydium** (Swap via CPMM / AMM v4 / CLMM, router-dispatched) | 1 | [`routeUGWgWzq…GPP3xS`](https://solscan.io/account/routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS) (router) → [`CPMMoo8L…KxQB5qKP1C`](https://solscan.io/account/CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C), [`CAMMCzo5…grrKgrWqK`](https://solscan.io/account/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK), [`675kPX9M…zeLXfQM9H24wFSUt1Mp8`](https://solscan.io/account/675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8) | [`lib/adapters/raydium.ts`](lib/adapters/raydium.ts) | [`scripts/verify-raydium-adapter.ts`](scripts/verify-raydium-adapter.ts) |
| **Total** | **12** | 4 protocols live | `lib/adapters/` + `lib/sak-executor.ts` | 4 verify scripts |

### Reproducing the proof

Each `verify-*-adapter.ts` script opens a mainnet RPC connection, loads
the real program state, constructs the exact CPI `TransactionInstruction`
that would execute if broadcast, and asserts the byte structure targets
the listed program. No real SOL is spent; no transaction is broadcast.
The scripts validate by **construction**, not by settlement.

```bash
# Requires a Helius (or equivalent) mainnet RPC — public RPC rate-limits
# the market-load batch. Add HELIUS_API_KEY to .env.local.
set -a && source .env.local && set +a

npx tsx scripts/verify-kamino-adapter.ts        # ~10s
npx tsx scripts/verify-jupiter-lend-adapter.ts  # ~15s
npx tsx scripts/verify-jito-adapter.ts          # ~5s
npx tsx scripts/verify-raydium-adapter.ts       # ~10s
```

### Devnet evidence (atomic-gate run on real on-chain state)

The ZK gate itself is run end-to-end on **devnet** — the policy gate is
program-level, so devnet behaviour is identical to mainnet:

- [`scripts/e2e-intent-execute.ts`](scripts/e2e-intent-execute.ts) — full
  sign_intent → proof gen → execute_with_intent_proof round-trip,
  typically lands in ~30s.
- [`docs/bench/2026-04-22-cfull-cu.json`](docs/bench/2026-04-22-cfull-cu.json) —
  mean **204,460 CU / 5 runs** for the dual-oracle gate (Pyth ∩ Switchboard).
- [`docs/bench/2026-04-22-stress.json`](docs/bench/2026-04-22-stress.json) —
  **15 adversarial mutations, 15 reverted, 0 admitted**.

Devnet is memo-mode for DeFi CPIs (Kamino / Jupiter Lend reserves don't
exist there), so integration-coverage verification is mainnet-side via
the adapters above. The ZK gate is runtime-identical.

---

## Trust model, precisely stated

Sakura has an admin role. Its scope is bounded by the program, not
by a promise.

**The admin CAN:**

- Pause new intent signing and action execution (`set_paused`, instant, recoverable)
- Propose fee-parameter changes within hard-coded ceilings — 2%
  `execution_fee_bps`, 100% `platform_fee_bps` — through the
  time-locked governance path
  (`propose_admin_action` → timelock → `execute_admin_action`)

**The admin CANNOT, even with a fully compromised key:**

- **Rotate its own key** — admin is **immutable** after
  `initialize_protocol`. The Protocol PDA is seeded by
  `[b"sakura_intent_v3", admin.key()]`, so mutating the admin field
  would orphan the account. Governance migration therefore requires
  redeploying with a multisig as admin from day 1; see
  [`docs/SQUADS_MIGRATION_RUNBOOK.md`](docs/SQUADS_MIGRATION_RUNBOOK.md).
- Withdraw from `fee_vault` outside the hard-coded split
  (the vault is PDA-owned; no admin-withdrawal instruction exists)
- Alter the Groth16 verifying key (baked into
  [`zk_verifying_key.rs`](programs/sakura-insurance/src/zk_verifying_key.rs)
  at deploy time; any change requires redeployment under a new
  program address)
- Override a user-signed intent
- Mutate a user's `ActionRecord` PDA
- Cause funds to move in violation of an active intent

Pausing the gate is not the same as bypassing it. The eight security
invariants the program enforces (I1–I8, pairing, commitment binding,
amount-type-target circuit constraints, USD-value oracle binding,
Pyth authenticity, replay guard, activity flag, admin-scope) are
enumerated in the module docstring at
[`programs/sakura-insurance/src/lib.rs`](programs/sakura-insurance/src/lib.rs).
Nothing the admin does can remove them.

---

> **Venture capital funded two hundred agentic-DeFi applications in
> 2025. Most of them will not capture value. The take-rate accrues to
> the layer underneath them — the primitive that verifies every agent
> action against a signed, on-chain bounds commitment, before the
> action is allowed to touch user funds. This repository is that
> layer.**

In the first half of 2026, four consumer wallets — Phantom, Backpack,
Abstract, and Infinex — each release an AI-agent mode. The
engineering challenge those modes expose is not the agent's
intelligence. It is the agent's containment. An AI system that can
deposit a user's USDC into Kamino, borrow on Jupiter Lend, or swap on
Jupiter / Raydium is, in a strict operational sense, a signing key
the user does not control.

The industry's default answer to the containment problem is the same
answer every software industry has given when faced with it: a
policy. Session keys rotate. Allowlists are maintained. Approval
popups interrupt. Each is a promise by an operator. Each, as a
matter of historical record, is bypassable by that operator. Online
banking settled this debate in the 2000s; custodial exchanges
re-settled it, at significant user cost, in **2014 (Mt.Gox), 2019
(OKEx), and 2022 (FTX)**. Asia retail paid the tuition three times
to learn the same law: any rule an operator can override will be
overridden.

Sakura replaces the policy with a circuit. The property the circuit
encodes is structural. The agent's operator cannot widen the rule.
The protocol's maintainers cannot widen the rule. Neither can an
intermediary, a relayer, an indexer, or a future governance body.
The guarantee is mathematical, not procedural.

Built for [Colosseum Frontier 2026](https://frontier.colosseum.org/).

---

## The consumer thesis — *sovereignty, not protection*

Self-custody is not a feature. It is a right retail users have been
negotiating with financial software for two decades, and repeatedly
losing to the same argument: that software cannot scale without the
software provider retaining some veto over user action. In every
iteration — online banking's two-factor flows, custodial exchange
KYC, cross-border transfer freezes — the veto begins narrow and
grows. And each time, when the veto gets abused, the cost is borne
by the user, not the operator.

AI agents for DeFi are the third iteration of the same trade. The
agent promises convenience; the agent's operator quietly reclaims
the ground retail users gave up in the 1990s. "My money, my rules"
becomes a marketing line, and the rules are set by the operator's
session-key rotation cadence rather than by the user.

Sakura's consumer value is a single cryptographic property: an agent
granted execution authority under a Sakura-gated wallet cannot act
outside the bounds the user signed. The property is enforced by the
chain's native pairing verifier on every transaction, not by an
off-chain monitor.

The framing matters. Sakura is not a protection layer wrapped around
a fundamentally operator-trusting architecture. It is an
architectural erasure of the operator role in agentic execution.
There is no operator because there is nothing for an operator to
do — the math decides whether each action lands, and the math was
parameterized by the user and only the user.

The target user is the retail holder of USDC on Solana who turns an
agent on for the same reason they turn on auto-pay: to outsource a
repeatable decision. What retail crypto has been asking for, badly
and repeatedly, since the founding of self-sovereign wallet
software, becomes provable for the first time in a production
agentic context.

---

## The infrastructure thesis — *one verifier, not four*

The verifier layer every agentic wallet needs is the same verifier
layer. It imposes six checks on every gate call: that the action
satisfies the signed intent via Groth16 pairing; that the Pyth
price came from the expected feed and matches the current account
state; that the Pyth slot sits within a 150-block freshness window;
that Pyth's spot-versus-EMA deviation stays within 2%; that the
Pyth-versus-Switchboard cross-oracle deviation stays within 100
basis points, with the USD cap settled against the median of the
two; and that the action nonce has not been replayed. Each of
Phantom's, Backpack's, Abstract's, and Infinex's engineering
organizations will need to implement, audit, maintain, and
operationally defend those six checks independently. The all-in
cost of doing so, based on analogous historical builds — a
first-party ZK prover, a dual-oracle integration layer, a
replay-guard audit — is measured in engineer-quarters rather than
engineer-weeks, and re-incurs on every Solana protocol upgrade.

The thesis underlying Sakura is that the correct number of
independent implementations of this layer is **one**. The correct
economic structure is a fee of **0.1% of notional** at the gate
(first \$10M of integrator volume rebated, absolute cap of \$1,000
per sign regardless of notional), routed automatically from the
integrator to the protocol's fee vault, supplemented by \$0.01
per verified agent action and \$1 USDC per x402 MCP call. The
correct governance structure is a 3-of-5 multisig with authority to
tune two parameters — `execution_fee_bps` and `platform_fee_bps` —
within program-level hard ceilings (2% and 100% respectively), and
no authority to alter the verifying key or withdraw from the vault
outside the fee split. The correct token structure is **no token**.

### The historical analogues

| Primitive | Unit of trust priced | Annual capture |
|---|---|---|
| SWIFT | One cross-border settlement | \$6 trillion cleared daily |
| Visa Interchange | One card authorization | \$30 billion annually |
| HTTPS certificate authorities | One encrypted handshake | Cents per issuance × 30 years |
| Gold custody (LBMA class) | One ounce custodianship | 0.3% on \$12 trillion base |
| **Sakura** | **One agentic action verification** | **See [`docs/VALUE_CAPTURE.md`](docs/VALUE_CAPTURE.md)** |

Each is fiat-priced, independently operated, and bound by a mechanism
operators cannot override. Each sustained through multiple generations
of the application layer above it. Each has, as its business logic,
the pricing of **one unit of trust**, and nothing else. Applications
compound on top. Sakura is the agentic-execution-layer implementation
of that same template.

The closest historical analogue is HTTPS certificate issuance. The
certificate-authority market, which gates every encrypted web
connection in the world, has sustained independent, token-free
primitives for over three decades, on a fee model measured in cents
per issuance. The primitive wins by being cheaper and more
integrated than any rebuild attempt; the economics follow.

---

## Why this composition is only possible now

Six pieces of Solana-adjacent infrastructure matured between
mid-2024 and early 2026:

| Layer | Inflection point |
|---|---|
| Solana `alt_bn128` pairing syscall | Protocol 1.17, shipped Q3 2024 |
| Light Protocol `groth16-solana` crate | Production release, Q1 2025 |
| Pyth Pull Oracle `PriceUpdateV2` | Feed-id-scoped accounts, Q2 2025 |
| Switchboard On-Demand | Pull-feed architecture with in-transaction price post, Q4 2025 |
| Solana Agent Kit v2 | Plugin surface used for token + price utilities; Sakura's adapter layer (`lib/adapters/`) integrates four flagship protocols directly — Jupiter (Swap + Lend / Borrow / Repay / Withdraw), Raydium (Swap), Kamino (Lend / Borrow / Repay / Withdraw), Jito (Stake / Unstake) = **12 mainnet CPI cells**, all reproducible via `npx tsx scripts/verify-{jito,raydium,kamino,jupiter-lend}-adapter.ts` |
| Stripe x402 (HTTP 402 re-proposal) | Machine Payments Protocol, Q3 2025 |

None of the six, in isolation, addresses the containment problem
above. Taken together, and assembled in the specific composition
Sakura implements, they do.

Before Q3 2024, a Groth16 verifier on Solana cost millions of CUs
and was not production-viable. Before Q2 2025, a Pyth feed could not
be cryptographically bound to a specific slot as a circuit public
input. Before Q3 2025, the pricing model for AI-to-AI machine
payments was an open question. The window to build this correctly
opened in early 2026. It is the window Sakura is in.

---

## The technical description

The protocol consists of three artifacts: a Circom circuit, an
Anchor program, and a TypeScript client. The circuit
(`circuits/src/intent_proof.circom`) compiles to **1,909 non-linear
constraints** and fits the Phase 1 trusted setup at `pot11`. Every
numeric input is `Num2Bits`-bounded against BN254 field wraparound,
and the five constraint families the circuit enforces are:

| | Constraint |
|---|---|
| C1 | Intent commitment matches the 2-layer Poseidon tree of the seven private witness values |
| C2 | `action_amount ≤ max_amount` |
| C3 | `bit[action_target_index]` of `allowed_protocols == 1` |
| C4 | `bit[action_type]` of `allowed_action_types == 1` |
| C5 | `action_amount × oracle_price ≤ max_usd_value × 10⁶` |

The Anchor program
(`programs/sakura-insurance/src/lib.rs`) exposes three user-facing
instructions — `sign_intent`, `revoke_intent`, and
`execute_with_intent_proof` — and five administrative /
time-locked-governance instructions — `initialize_protocol`,
`set_paused`, `initialize_guardian`, `propose_admin_action`,
`execute_admin_action`. Admin is immutable after
`initialize_protocol` (rotation would orphan the Protocol PDA whose
seed depends on `admin.key()`; governance migration therefore requires
redeploy with a multisig as admin from day 1, per
[`docs/SQUADS_MIGRATION_RUNBOOK.md`](docs/SQUADS_MIGRATION_RUNBOOK.md)). The verifying key is
baked into `programs/sakura-insurance/src/zk_verifying_key.rs` at
deploy time and cannot be altered without redeployment.
`execute_with_intent_proof` performs six distinct safety checks in
sequence: Groth16 pairing verification via the `alt_bn128` syscall
(~116k CU); Pyth `PriceUpdateV2` account re-parsing; slot-freshness
enforcement at 150 slots; a Pyth spot-versus-EMA deviation check;
a Switchboard `feed_hash` binding and cross-oracle deviation check
(median of Pyth and Switchboard, ≤ 100 bps deviation); and
`ActionRecord` PDA creation seeded by the `(intent, action_nonce)`
pair. Across 150 adversarial runs covering six hostile scenarios,
15 of 15 invariants held — every hostile attempt reverted as
expected (see
[`docs/bench/2026-04-22-stress.json`](docs/bench/2026-04-22-stress.json)).

The TypeScript client (`lib/insurance-pool.ts`, `lib/zk-proof.ts`,
`lib/sak-executor.ts`) provides instruction builders, PDA derivers,
account deserializers, snarkjs proof generation, and a Solana Agent
Kit v2 adapter. Integration is permissionless: no
business-development gate, no revenue-share negotiation, no
allowlist maintainer is interposed between a wallet and the on-chain
program.

---

## Founder voice

> We did not build Sakura to protect users from AI agents. We built
> it so the operator class becomes architecturally irrelevant.
>
> The user IS the sovereign. The math is just the enforcement.
>
> — **Sakura team · Colosseum Frontier 2026**

---

## Repository

```
circuits/src/intent_proof.circom            Groth16 circuit
programs/sakura-insurance/src/lib.rs        Anchor program
programs/sakura-insurance/src/zk_verifying_key.rs   Verifying key
scripts/e2e-intent-execute.ts               Devnet E2E test
scripts/deploy-mainnet.sh                   Mainnet deployment
scripts/initialize-mainnet.ts               Post-deploy init
lib/zk-proof.ts                             snarkjs + on-chain encoding
lib/insurance-pool.ts                       TypeScript client
lib/sak-executor.ts                         SAK → unsigned-ix adapter
components/IntentSigner.tsx                 Intent-signing UI
components/ActionHistory.tsx                On-chain audit feed
app/api/mcp/route.ts                        MCP server (x402)
app/api/actions/sign-intent/route.ts        Solana Blink
.claude/skills/                             Four Agent Skills
.github/workflows/ci.yml                    CI gate
__tests__/                                  Cryptographic invariant tests
docs/                                       Pitch, submission, builder docs
```

---

## Quickstart

```bash
npx tsx scripts/e2e-intent-execute.ts
# Expected output (final lines):
#   off-chain snarkjs verify: ✓ OK
#   execute landed: https://solscan.io/tx/…
#   E2E PASS — intent-execution verified on-chain via alt_bn128 pairing.

npm run dev
# Application: http://localhost:3000
```

**Non-developer path** — try the live devnet flow with nothing but a
Phantom wallet. A step-by-step trilingual walkthrough (install Phantom,
switch to devnet, claim 0.05 SOL + 100 test USDC from the built-in
faucet at [`/api/faucet`](./app/api/faucet/route.ts), sign your first
intent) lives at [`https://www.sakuraaai.com/testing`](https://www.sakuraaai.com/testing).
Faucet is rate-limited to one claim per address and five per IP per
24 hours, via Upstash Redis.

---

## Objections, answered inline

**Q: ZK on Solana has been done — Blackpool, Encifher, Hush, zkyc. What is novel here?**

The Groth16 + `alt_bn128` stack is not novel. It is Light Protocol's
open-source crate, operating on a Solana syscall that has been
production for two years. Our contribution is the **schema**: the
five-constraint-family compilation from a natural-language intent
into a 1,909-constraint BN254 circuit, with seven private witnesses
and a 32-byte intent commitment stored as a PDA, such that every
agent call must produce a fresh proof against it. The circuit type
is commodity. The shape of what we prove is not.

**Q: You say "no operator," but `set_paused` is instant admin power.**

See *Trust model, precisely stated* above. Pausing the gate is
architecturally different from bypassing it. Even a fully compromised
admin key cannot move user funds in violation of an active intent,
cannot alter the verifying key, and cannot withdraw from the fee
vault outside the hard-coded split. Every non-emergency admin action
routes through a time-locked governance path.

**Q: Why would Phantom integrate Sakura instead of building this themselves?**

The HTTPS-CA analogue is exact. Amazon and Google both operate their
own TLS endpoints, but neither built its own certificate authority —
the verifier layer is a single-implementation primitive, and the
integration math is cheaper than the rebuild math. A four-way
duplicate investment by Phantom, Backpack, Abstract, and Infinex in
independent ZK-proof-of-bounds implementations would cost each of
them measured in engineer-quarters per Solana protocol upgrade.

**Q: Is a \$4–12M year-1 revenue ceiling venture-scale?**

It is a year-1 floor, not a ceiling. The relevant comp is the HTTPS
certificate-authority market, which took 30 years to reach
\$500M+/year on a fee model measured in cents per issuance. Visa
Interchange clears \$30B/year on a similar primitive structure.
Primitive TAM is defined by the ecosystem the primitive sits under,
not by the primitive's current revenue. See
[`docs/VALUE_CAPTURE.md`](docs/VALUE_CAPTURE.md) for unit economics.

**Q: Why no token?**

Three reasons, in priority order. First, the primitives we model —
HTTPS CAs, SWIFT, Visa Interchange — each demonstrate, over decades,
that fiat fees on integration-depth primitives out-accrue
token-gated alternatives when the primitive is load-bearing for the
ecosystem above it. Second, a token creates a governance surface
that is, in expectation, a vulnerability; our thesis is that the
math should decide, not the token-holders. Third, regulatory
clarity on fee-taking protocols is meaningfully higher than on
fee-taking token protocols as of 2026.

---

## Further reading

**Live site (trilingual · zh / en / ja):**

- [`/testing`](https://www.sakuraaai.com/testing) — Phantom-only devnet walkthrough from zero to first on-chain intent
- [`/guide`](https://www.sakuraaai.com/guide) — retail user manual: how to sign a good intent and the five common mistakes
- [`/docs`](https://www.sakuraaai.com/docs) — three integration paths (wallet integrator, agent developer, auditor / compliance)
- [`/use-cases`](https://www.sakuraaai.com/use-cases) — six integration scenarios across three roles
- [`/mcp`](https://www.sakuraaai.com/mcp) — MCP API reference, x402 payment flow, example code

**Repository (depth):**

- [`docs/FOR_USERS.md`](./docs/FOR_USERS.md) — retail user guide (longer-form, markdown source of the live `/guide`)
- [`docs/FOR_BUILDERS.md`](./docs/FOR_BUILDERS.md) — integration guide for wallet engineering teams
- [`docs/VALUE_CAPTURE.md`](./docs/VALUE_CAPTURE.md) — revenue model, unit economics, and the no-token decision
- [`docs/PITCH.md`](./docs/PITCH.md) — pitch scripts (60s / 3min / 8min)
- [`docs/SUBMISSION_CHECKLIST.md`](./docs/SUBMISSION_CHECKLIST.md) — hackathon submission prerequisites
- [`COMPETITIVE_ANALYSIS_2026.md`](./COMPETITIVE_ANALYSIS_2026.md) — concise competitor matrix (signed-ai, agentrunner, agent-cred, urani, solprism)

---

## License

MIT — see [LICENSE](./LICENSE).
