# Sakura

**Cryptographic bounds on what an AI agent can do with your money.**

A ZK circuit that verifies every agentic DeFi action against a
user-signed intent — before the action is allowed to touch user
funds. Solana's `alt_bn128` pairing syscall executes the verification
in **126,221 compute units** (measured on devnet, 5/5 runs,
2026-04-21; see
[`docs/bench/2026-04-21-cu.json`](docs/bench/2026-04-21-cu.json)),
roughly one hundredth of a cent per call. A failing proof reverts the
surrounding transaction before the underlying DeFi instruction can
execute.

[![Program](https://img.shields.io/badge/devnet%20program-AnszeCRFs…YLp-brightgreen?logo=solana)](https://solscan.io/account/AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp?cluster=devnet)
[![Verification](https://img.shields.io/badge/alt__bn128-126%2C221%20CU-blue)](./docs/bench/2026-04-21-cu.json)
[![Tests](https://img.shields.io/badge/invariant%20tests-8%20passing-green)](./__tests__/)
[![No Token](https://img.shields.io/badge/token-none-lightgrey)](./docs/VALUE_CAPTURE.md)

[→ Live demo (no wallet needed)](https://sakura.app/?demo=true) ·
[→ Full E2E on devnet in 30s](./scripts/e2e-intent-execute.ts) ·
[→ Submission · Colosseum Frontier 2026](https://frontier.colosseum.org/)

---

## What happens when an agent tries to act

A user signs once, in natural language:

> *"The agent may lend up to \$1,000 into Kamino or MarginFi for one week."*

The instruction is compressed, via a two-layer Poseidon hash, into a
thirty-two-byte commitment stored in a Program Derived Address on
Solana. The user's private policy — per-action cap, allowed-protocol
set, expiry — remains in the user's browser. Only the 32-byte hash
reaches the chain.

Every subsequent agent action flows through the same four-check gate:

```
  agent proposes action
         │
         ▼
  ┌─────────────────────────────────────────────────┐
  │  1.  Groth16 proof of intent bounds             │   alt_bn128 pairing, 126,221 CU
  │  2.  Pyth PriceUpdateV2 feed-id + slot re-parse │   oracle not spoofable
  │  3.  150-slot price-freshness window            │   stale price → revert
  │  4.  ActionRecord PDA replay guard              │   seeded by (intent, nonce)
  └─────────────────────────────────────────────────┘
         │                          │
     any check fails            all four pass
         ▼                          ▼
   TRANSACTION REVERTS       DeFi instruction executes atomically
   funds never moved         fee vault collects 0.1% + $0.01 flat
```

The failing case is the important one. Nothing downstream of the gate
executes until all four checks land. Every action on a Sakura-gated
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

## Trust model, precisely stated

Sakura has an admin role. Its scope is bounded by the program, not
by a promise.

**The admin CAN:**

- Pause new intent signing and action execution (`set_paused`, instant, recoverable)
- Rotate the admin key (`rotate_admin`, instant)
- Propose fee-parameter changes within hard-coded ceilings — 2%
  `execution_fee_bps`, 100% `platform_fee_bps` — through the
  time-locked governance path
  (`propose_admin_action` → timelock → `execute_admin_action`)

**The admin CANNOT, even with a fully compromised key:**

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
deposit a user's USDC into Kamino, borrow on MarginFi, or swap on
Jupiter is, in a strict operational sense, a signing key the user
does not control.

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

**The user IS the sovereign. The math is just the enforcement.**

The target user is the retail holder of USDC on Solana who turns an
agent on for the same reason they turn on auto-pay: to outsource a
repeatable decision. What retail crypto has been asking for, badly
and repeatedly, since the founding of self-sovereign wallet
software, becomes provable for the first time in a production
agentic context.

---

## The infrastructure thesis — *one verifier, not four*

The verifier layer every agentic wallet needs is the same verifier
layer. It checks four things on every gate call: that the action
satisfies the signed intent, that the oracle price came from Pyth
and matches the current account state, that the slot is within a
150-block freshness window, and that the action nonce has not been
replayed. Each of Phantom's, Backpack's, Abstract's, and Infinex's
engineering organizations will need to implement, audit, maintain,
and operationally defend those four checks independently. The
all-in cost of doing so, based on analogous historical builds — a
first-party ZK prover, a Pyth integration layer, a replay-guard
audit — is measured in engineer-quarters rather than engineer-weeks,
and re-incurs on every Solana protocol upgrade.

The thesis underlying Sakura is that the correct number of
independent implementations of this layer is **one**. The correct
economic structure is a fee of **0.1% of notional** at the gate,
routed automatically from the integrator to the protocol's fee
vault. The correct governance structure is a 3-of-5 multisig with
authority to tune two parameters — `execution_fee_bps` and
`platform_fee_bps` — within program-level hard ceilings (2% and
100% respectively), and no authority to alter the verifying key or
withdraw from the vault outside the fee split. The correct token
structure is **no token**.

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

Five pieces of Solana-adjacent infrastructure matured between
mid-2024 and early 2026:

| Layer | Inflection point |
|---|---|
| Solana `alt_bn128` pairing syscall | Protocol 1.17, shipped Q3 2024 |
| Light Protocol `groth16-solana` crate | Production release, Q1 2025 |
| Pyth Pull Oracle `PriceUpdateV2` | Feed-id-scoped accounts, Q2 2025 |
| Solana Agent Kit v2 | Plugin surface for Jupiter, Kamino, MarginFi, Marinade, Q4 2025 |
| Claude Sonnet 4.6 Agent Skills | Composable skill pipelines with structured output, Q1 2026 |
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
(`circuits/src/intent_proof.circom`) compiles to 1,909 non-linear
constraints and fits the Phase 1 trusted setup at `pot13`. Every
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
`execute_with_intent_proof` — and six administrative /
time-locked-governance instructions — `initialize_protocol`,
`rotate_admin`, `set_paused`, `initialize_guardian`,
`propose_admin_action`, `execute_admin_action`. The verifying key is
baked into `programs/sakura-insurance/src/zk_verifying_key.rs` at
deploy time and cannot be altered without redeployment.
`execute_with_intent_proof` performs four distinct safety checks in
sequence: Groth16 pairing verification via the `alt_bn128` syscall,
Pyth `PriceUpdateV2` account re-parsing, slot-freshness enforcement
at 150 slots, and `ActionRecord` PDA creation seeded by the
`(intent, action_nonce)` pair.

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

- [`docs/FOR_USERS.md`](./docs/FOR_USERS.md) — **retail user guide · 繁體中文** · how to sign a good intent without regretting it (the one thing a retail user actually does)
- [`docs/FOR_BUILDERS.md`](./docs/FOR_BUILDERS.md) — integration guide for wallet engineering teams
- [`docs/VALUE_CAPTURE.md`](./docs/VALUE_CAPTURE.md) — revenue model, unit economics, and the no-token decision
- [`docs/PITCH.md`](./docs/PITCH.md) — pitch scripts (60s / 3min / 8min)
- [`docs/SUBMISSION_CHECKLIST.md`](./docs/SUBMISSION_CHECKLIST.md) — hackathon submission prerequisites
- [`COMPETITIVE_ANALYSIS_2026.md`](./COMPETITIVE_ANALYSIS_2026.md) — concise competitor matrix (signed-ai, agentrunner, agent-cred, urani, solprism)

---

## License

MIT — see [LICENSE](./LICENSE).
