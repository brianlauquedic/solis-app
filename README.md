# Sakura

**The bounds layer every agentic wallet will build. Built once, for all of them.**

---

> **Venture capital funded two hundred agentic-DeFi applications in
> 2025. Most of them will not capture value. The take-rate accrues to
> the layer underneath them — the primitive that verifies every agent
> action against a signed, on-chain bounds commitment, before the
> action is allowed to touch user funds. This repository is that
> layer.**

---

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

Sakura replaces the policy with a circuit. A user signs, once, a
natural-language instruction — for instance, *"the agent may lend up
to \$1,000 into Kamino or MarginFi for one week."* The instruction is
compressed, via a two-layer Poseidon hash, into a thirty-two-byte
commitment stored in a Program Derived Address on the Solana chain.
Every subsequent action the agent attempts must produce a Groth16
zero-knowledge proof establishing that the action falls inside the
commitment. Solana's `alt_bn128` pairing syscall, merged in protocol
version 1.17, verifies the proof in 126,221 compute units (measured
on devnet, 5 of 5 runs, 2026-04-21; see
[`docs/bench/2026-04-21-cu.json`](docs/bench/2026-04-21-cu.json)) —
roughly one hundredth of a cent per call. A failing proof reverts the
surrounding transaction before the underlying DeFi instruction is
allowed to touch user funds.

The property the circuit encodes is structural. The agent's operator
cannot widen the rule. The protocol's maintainers cannot widen the
rule. Neither can an intermediary, a relayer, an indexer, or a
future governance body. The guarantee is mathematical, not
procedural.

Built for [Colosseum Frontier 2026](https://frontier.colosseum.org/).
Devnet-verified at program
`AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp`. A full end-to-end
test — intent signing, proof generation, on-chain pairing
verification — runs in under thirty seconds from a developer
terminal: `npx tsx scripts/e2e-intent-execute.ts`.

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
off-chain monitor. The user's policy — per-action cap, allowed
protocol set, expiry — remains in the user's browser; only its hash
reaches the chain.

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
| **Sakura** | **One agentic action verification** | **See below** |

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

## The ceiling — *what the math says*

```
  $4B        Solana DeFi TVL reachable via agents
×   4        major wallet agent modes shipping in 2026
×   0.1%     routing fee, after first-$10M integrator rebate
─────
  ~$4–12M    year-1 routing-fee ARR ceiling
             (low end: 10% of TVL routes through agent rebalancing;
              high end: 30%, per Stripe MPP Q3 2025 forecast)

  + x402 per-API-call settlement at $1 USDC via /api/mcp
  + insurance-pool float on rebate reserves
  + future MEV-bundle routing via a dedicated Jito relay
  − (explicitly out of year-1 scope: L2 expansion, enterprise SLA tier)
```

The calculation does not depend on picking which of the 200 agent
apps survives. The calculation holds as long as the verifier layer
is called — independent of caller. That is the structural property
inherited from the primitives above: HTTPS does not know which
websites use it, SWIFT does not know whose bank originated the wire,
and Sakura does not know which agent triggered the gate.

Three additional revenue paths are architecturally in place and
shipped today:

| Path | Mechanism | Target customer |
|---|---|---|
| Enterprise SLA | Off-protocol sale of GPU-backed prover infrastructure, sub-2s latency, 99.9% uptime | Wallets routing > 10,000 actions/hour |
| MCP server tolls | `$1 USDC per call via HTTP 402` on `/api/mcp` | Tooling vendors, backtest frameworks, AI-agent platforms |
| MEV bundle routing | Priority-fee rebate via dedicated Jito relay (architecturally in place; not shipped) | Sophisticated agentic wallets seeking atomic-bundle guarantees |

The first mirrors Stripe's early enterprise pricing: the primitive is
free; the operational guarantees are not. The second monetizes the
developer surface the protocol exposes to third parties via the
[x402 Machine Payments Protocol](https://www.x402.org/) — Stripe's
2025 re-proposal of HTTP 402, now production-deployed on Solana.
The third is not yet shipped but is not precluded by the
architecture.

The token-free structure is deliberate. The certificate-authority
market, the global payments-interchange market, and the internet's
own name-service market each demonstrate, over decades, that fiat
fees on integration-depth primitives out-accrue token-gated
alternatives when the primitive is load-bearing for the ecosystem
above it. Sakura is designed to fit that category.

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
`execute_with_intent_proof` — and three administrative instructions
— `initialize_protocol`, `rotate_admin`, and `set_paused`. The
verifying key is baked into
`programs/sakura-insurance/src/zk_verifying_key.rs` at deploy time
and cannot be altered without redeployment. `execute_with_intent_proof`
performs four distinct safety checks in sequence: Groth16 pairing
verification via the `alt_bn128` syscall, Pyth `PriceUpdateV2` account
re-parsing, slot-freshness enforcement at 150 slots, and
`ActionRecord` PDA creation seeded by the `(intent, action_nonce)`
pair.

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

## Further reading

- [`docs/FOR_BUILDERS.md`](./docs/FOR_BUILDERS.md) — integration guide for wallet engineering teams
- [`docs/VALUE_CAPTURE.md`](./docs/VALUE_CAPTURE.md) — no-token economic model and treasury governance
- [`docs/PITCH.md`](./docs/PITCH.md) — pitch scripts (60s / 3min / 8min)
- [`docs/SUBMISSION_CHECKLIST.md`](./docs/SUBMISSION_CHECKLIST.md) — hackathon submission prerequisites

---

## License

MIT — see [LICENSE](./LICENSE).
