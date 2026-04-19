# Sakura

**Your agent. Your rules. Enforced by math.**

Every major Solana wallet is shipping an AI-agent mode this year —
Phantom, Backpack, Abstract, Infinex. Each will face the same
unavoidable question: *how do we prove to a user that the agent they
loaned execution authority to cannot go rogue?* The industry's
answers so far have been operational — session keys, allowlists,
compliance letters, "trust our infrastructure." Each of them is
bypassable. Sakura is not.

Sakura is the verifier layer every agentic wallet needs and none want
to build alone. A user writes one sentence in plain language —
*"the agent may lend up to $1,000 into Kamino or MarginFi for one
week"* — and that sentence becomes a 32-byte cryptographic commitment
on-chain. From that moment forward, any action the agent proposes
must produce a zero-knowledge proof that the action fits inside the
sentence. Solana's `alt_bn128` pairing verifies the proof in 116,000
compute units — about one hundredth of a cent per call. Proof passes,
the DeFi instruction lands atomically. Proof fails, the whole
transaction reverts. Exceeding the rule is not policed. It is
mathematically impossible.

Built for [Colosseum Frontier 2026](https://frontier.colosseum.org/).
Devnet-verified. Program
`AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp`. Run
`npx tsx scripts/e2e-intent-execute.ts` to watch an on-chain pairing
pass from your terminal in under thirty seconds.

---

## The consumer case

The last time retail users gave software this much control of their
money, the software was TradFi online banking. They learned, over
twenty years of social engineering and sanctions and frozen accounts,
what "policy-based access" is worth: exactly as much as the
institution behind it.

AI agents for DeFi are about to ask users for the same loan of
authority, at the same scale, with less recourse. The "agent
concierge" a user turns on so their USDC can chase the best lending
rate overnight is indistinguishable from a root shell if the agent's
allowlist gets compromised. The industry's default answer — "we rotate
session keys every fifteen minutes" — is a policy, and policies fail.

Sakura replaces the policy with a circuit. The user writes the rule in
natural language. The rule becomes a mathematical object on-chain.
Every execution is forced to prove it satisfies that object. The
agent's operator cannot widen the rule. Our servers cannot widen the
rule. No one can widen the rule. That is what self-custody means when
AI sits inside the loop.

It is the kind of guarantee the crypto-native retail user has been
asking for without being able to name. "My money, my rules" becomes,
for the first time in the agentic era, a theorem.

---

## The infrastructure case

There is a layer every wallet shipping an agent has to build, and
every one of them would prefer not to.

The layer checks four things on every agent action, before any DeFi
instruction is allowed to touch user funds:

1. Does this action fall within the bounds of the user's signed
   intent?
2. Is the oracle price the agent used still current, and did it come
   from Pyth?
3. Did the proof bind to a slot fresh enough that a stale snapshot
   cannot be replayed?
4. Has the (intent, action-nonce) pair been used before?

Phantom's answer will use Phantom's servers. Backpack's will use
Backpack's. Each answer is a bespoke rebuild of cryptography,
allowlist tooling, oracle adapters, and audit pipelines. Each one is
forkable, each one siloed, each one a distinct trust assumption for
the user to re-accept when they switch wallets.

Sakura ships that layer once, as a public primitive. A wallet
integrates it in roughly one line:

```ts
import {
  buildSignIntentIx,
  buildExecuteWithIntentProofIx,
} from "@sakura/insurance-pool";
import {
  computeIntentCommitment,
  generateIntentProof,
  proofToOnchainBytes,
} from "@sakura/zk-proof";

// Once per policy window
await connection.sendTransaction(
  buildSignIntentIx({ admin, user, intentCommitment, expiresAt })
);

// Every agentic action
const { proof } = await generateIntentProof(witness);
const { proofA, proofB, proofC } = proofToOnchainBytes(proof);

const tx = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
  .add(buildExecuteWithIntentProofIx({ ...args, proofA, proofB, proofC }))
  .add(yourDefiInstruction);         // runs only if the gate passes
```

The wallet picks the DeFi action. Sakura enforces the bound. The
integration is permissionless — there is no allowlist, no business
development gate, no revenue share negotiation required to start.

## How value accrues without a token

Sakura charges 0.1% of notional at the gate, with a maximum of 2%
hard-coded in the program. Of that fee, 15% is retained by a treasury
account governed by a multisig; the remainder stays with the pool
account funding the ceremony maintenance and integrator support.
Large integrators (Phantom, Backpack, enterprise agent platforms)
negotiate bilateral fee rebates against committed volume — the same
playbook Stripe used before charging every online merchant in 2015.
There is no token. The treasury is the single economic artifact that
captures the long tail of agentic execution on Solana.

This is deliberate. Tokens create political economies the primitive
cannot afford. The SSL ecosystem works because certificate authorities
charge fiat, not because Let's Encrypt pays dividends.

---

## How it works, technically

```
  Intent           Action                   On-chain verify              DeFi action
  ──────           ──────                   ───────────────              ──────────
  plain-language → Poseidon (7 → 1)      → alt_bn128 pairing          → Kamino /
  + 24h expiry     32-byte commitment       (116k CU, ~400ms)            MarginFi /
                   stored on-chain                                        Jupiter /
                                          + Pyth oracle check             Marinade
                                          + slot freshness guard          (atomic
                                          + ActionRecord write            composition)
```

### Circuit constraints

| | Constraint |
|---|---|
| C1 | Intent commitment matches the 2-layer Poseidon tree of the seven private witness values |
| C2 | `action_amount ≤ max_amount` |
| C3 | `bit[action_target_index]` of `allowed_protocols == 1` |
| C4 | `bit[action_type]` of `allowed_action_types == 1` |
| C5 | `action_amount × oracle_price ≤ max_usd_value × 10⁶` |

Every numeric input is `Num2Bits`-bounded against BN254 field
wraparound. The circuit compiles to 1,909 non-linear constraints and
fits the `pot13` trusted-setup ceremony.

### Oracle binding

`oracle_price_usd_micro` and `oracle_slot` are public inputs to the
proof. A malicious agent cannot forge a favorable price because the
on-chain verifier parses the Pyth `PriceUpdateV2` account directly,
requires `posted_slot == oracle_slot`, and confirms the scaled
micro-USD price matches within ±1 tolerance. Slot freshness is
enforced at `current_slot − oracle_slot ≤ 150` (~60 seconds). A proof
generated against a one-minute-old price cannot land.

### Audit trail

Every executed action writes an `ActionRecord` PDA seeded by
`(intent, action_nonce)`, preventing replay via Anchor's `init`
constraint. The record stores `keccak256(proof_a ‖ proof_c)` as a
forensic fingerprint — a byte-level identifier any party holding the
transaction hash can use to independently verify, on Solscan, what the
verifier accepted.

---

## Why this is only possible now

Five pieces of Solana infrastructure matured in the last eighteen
months:

| Layer | Role |
|---|---|
| `alt_bn128` pairing syscall | Economical BN254 verification on-chain |
| Light Protocol `groth16-solana` | Production-ready single-pairing verifier |
| Pyth Pull Oracle `PriceUpdateV2` | Slot-verifiable price accounts |
| Solana Agent Kit v2 | Plugin surface for Jupiter, Marinade, Kamino, MarginFi |
| Claude Sonnet 4.6 Agent Skills | Structured, composable decision pipelines |

Sakura is the first composition that treats these as one primitive.

---

## Repository layout

```
circuits/src/intent_proof.circom            Groth16 circuit
programs/sakura-insurance/src/lib.rs        Anchor program
programs/sakura-insurance/src/zk_verifying_key.rs   VK (auto-generated)
scripts/e2e-intent-execute.ts               Devnet E2E (passing)
scripts/deploy-mainnet.sh                   Gated mainnet deploy
scripts/initialize-mainnet.ts               Post-deploy init
lib/zk-proof.ts                             snarkjs + on-chain encoding
lib/insurance-pool.ts                       TypeScript client
lib/sak-executor.ts                         SAK → unsigned-ix adapter
components/IntentSigner.tsx                 Intent-signing UI
components/ActionHistory.tsx                On-chain audit feed
app/api/mcp/route.ts                        MCP server (3 intent tools)
app/api/actions/sign-intent/route.ts        Solana Blink
.claude/skills/                             Four Agent Skills
.github/workflows/ci.yml                    Typecheck + test CI
__tests__/                                  Cryptographic invariant tests
docs/                                       Pitch, demo, submission docs
```

---

## Quickstart

```bash
# Run the devnet end-to-end ZK test
npx tsx scripts/e2e-intent-execute.ts

# Start the local app
npm run dev
# visit http://localhost:3000
```

Expected output:

```
[5/6] Generating Groth16 proof…
  ✓ proof generated, public signals: 6
  off-chain snarkjs verify: ✓ OK
[6/6] Submitting execute_with_intent_proof…
  ✓ execute landed: https://solscan.io/tx/…
🎉 E2E PASS — intent-execution verified on-chain via alt_bn128 pairing.
```

---

## Our approach

We do not build a wallet. We do not pick which DeFi protocol an agent
targets. We enforce one property — that an agent cannot act outside
the user's signed instruction — and we enforce it the only way that
will hold up in 2026: with a circuit Solana verifies directly. The
primitive, the verifying key, the program are open from the first
block. If another team ships a better version, they inherit our
trusted setup and our integrators; if a wallet wants to embed it
deeper than any API, the source is there. The goal is not that Sakura
wins. The goal is that every Solana retail holder in the agentic era
has this property whether they know our name or not.

---

## License

MIT — see [LICENSE](./LICENSE).
