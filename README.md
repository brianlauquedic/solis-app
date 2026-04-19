# Sakura

**A Solana-native verifier for bounded agentic execution.**

In the first half of 2026, four consumer wallets — Phantom, Backpack,
Abstract, and Infinex — will each release an AI-agent mode. The
engineering challenge these modes disclose is not the agent's
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
re-settled it, at significant user cost, in 2014, 2019, 2022, and
2024.

Sakura replaces the policy with a circuit. A user signs, once, a
natural-language instruction — for instance, *"the agent may lend up
to $1,000 into Kamino or MarginFi for one week."* The instruction is
compressed, via a two-layer Poseidon hash, into a thirty-two-byte
commitment stored in a Program Derived Address on the Solana chain.
Every subsequent action the agent attempts must produce a Groth16
zero-knowledge proof establishing that the action falls inside the
commitment. Solana's `alt_bn128` pairing syscall, merged in protocol
version 1.17, verifies the proof in 116,000 compute units — roughly
one hundredth of a cent per call. A failing proof reverts the
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

## The consumer thesis

Self-custody is not a feature. It is a right retail users have been
negotiating with financial software for two decades, and repeatedly
losing to the same argument: that software cannot scale without the
software provider holding some veto over user action. In every
iteration — online banking's two-factor flows, custodial exchange
KYC, cross-border transfer freezes — the veto begins narrow and
grows.

AI agents for DeFi are the third iteration of the same bargain. The
agent promises convenience; the agent's operator quietly reclaims
the ground retail users gave up in the 1990s. "My money, my rules"
becomes a marketing line, and the rules are set by the operator's
session-key rotation cadence rather than by the user.

Sakura's consumer value is a single cryptographic property: an agent
granted execution authority under a Sakura-gated wallet cannot act
outside the bounds the user signed. The property is enforced by the
chain's native pairing verifier on every transaction, not by an
off-chain monitor. The user's policy — the per-action cap, the
allowed protocol set, the expiry — remains in the user's browser;
only its hash reaches the chain. What retail crypto has been asking
for, badly and repeatedly, since the founding of self-sovereign
wallet software, becomes provable for the first time in a production
agentic context.

The target user is the retail holder of USDC on Solana who turns an
agent on for the same reason they turn on auto-pay: to outsource a
repeatable decision. The guarantee the product provides is that the
auto-pay cannot, through any combination of operator compromise,
session-key theft, or software update, exceed what the user signed.
Until Sakura, that guarantee did not exist in agentic DeFi.

---

## The infrastructure thesis

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
audit — is measured in engineer-quarters rather than
engineer-weeks, and scales with every protocol upgrade.

The thesis underlying Sakura is that the correct number of
independent implementations of this layer is one. The correct
economic structure is a fee of 0.1% of notional at the gate, routed
automatically from the integrator to the protocol's fee vault. The
correct governance structure is a three-of-five multisig with
authority to tune two parameters — `execution_fee_bps` and
`platform_fee_bps` — within program-level hard ceilings (2% and
100% respectively), and no authority to alter the verifying key or
withdraw from the vault outside the fee split. The correct token
structure is no token.

The cumulative effect, if the thesis holds, is that by the end of
2026 every agentic execution on Solana routes through a single
verifier, and the verifier charges less per action than the
underlying DeFi instruction pays in priority fees. The volume curve
funds ceremony maintenance and prover-infrastructure scaling. The
absence of a token removes the political-economy overhead that
historically erodes the neutrality of infrastructure protocols.

The closest historical analogue is HTTPS certificate issuance. The
certificate-authority market, which gates every encrypted web
connection in the world, has sustained independent, token-free
primitives for over three decades, on a fee model measured in cents
per issuance. The primitive wins by being cheaper and more
integrated than any rebuild attempt; the economics follow.

---

## How value accrues

Sakura collects 0.1% of notional value at every gate call. Fifteen
percent of that fee is routed to a platform treasury — a USDC
associated token account controlled by a 3-of-5 multisig — and the
remainder accumulates in a protocol fee vault that funds ceremony
maintenance, prover-infrastructure scaling, and integrator support.
Both fee parameters are tunable by the multisig within program-level
ceilings; neither can be raised above 2% without redeploying the
program.

At a realistic mainnet baseline of $100 million in monthly gated
notional — a figure reached by routing through a single mid-tier
wallet partner — the model generates $1.2 million in annualized
gross revenue, of which approximately $180,000 annualizes to the
platform treasury. The numbers scale linearly with volume; the
cost structure does not. If the protocol reaches the capture rate
that certificate authorities reach within their markets, the
addressable volume is large enough to sustain the primitive without
secondary revenue mechanisms.

Three additional revenue paths are architecturally in place:

| Path | Mechanism | Target customer |
|---|---|---|
| Enterprise SLA | Off-protocol sale of GPU-backed prover infrastructure, sub-2-second latency, 99.9% uptime | Wallets routing > 10,000 actions/hour |
| MCP server tolls | `$1 USDC per call via HTTP 402` on `/api/mcp` | Tooling vendors, backtest frameworks, AI-agent platforms |
| MEV bundle routing | Future: priority-fee rebate via dedicated Jito relay | Sophisticated agentic wallets seeking atomic-bundle guarantees |

The first path mirrors Stripe's early enterprise pricing: the
primitive is free; the operational guarantees are not. The second
monetizes the developer surface the protocol exposes to third
parties. The third is not yet shipped but is not precluded by the
architecture.

The token-free structure is deliberate. The certificate-authority
market, the global payments-interchange market, and the internet's
own name-service market each demonstrate, over decades, that fiat
fees on integration-depth primitives out-accrue token-gated
alternatives when the primitive is load-bearing for the ecosystem
above it. Sakura is designed to fit that category.

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
(`programs/sakura-insurance/src/lib.rs`) exposes three
user-facing instructions — `sign_intent`, `revoke_intent`, and
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
Kit v2 adapter. Integration is permissionless: no business-development
gate, no revenue-share negotiation, no allowlist maintainer is
interposed between a wallet and the on-chain program.

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

None of the five, in isolation, addresses the containment problem
above. Taken together, and assembled in the specific composition
Sakura implements, they do.

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
app/api/mcp/route.ts                        MCP server
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
