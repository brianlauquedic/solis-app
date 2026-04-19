# Sakura, for the teams building the next agentic wallet

Every major Solana wallet is shipping an AI-agent mode this year.
Each one faces the same question: how do we give users a
non-dismissable answer to *"what prevents your agent from doing
something I did not approve?"* Sakura exists so you do not have to
answer it from first principles.

## What you get, in four bullets

- **A cryptographic proof, not a policy.** Every agent action your
  wallet routes through Sakura's gate is accompanied by a Groth16
  proof that the action fits inside the user's signed intent. The
  proof is verified on-chain by Solana's `alt_bn128` syscall. If the
  proof fails, the entire transaction reverts — the DeFi instruction
  your wallet built never runs.
- **Oracle binding built in.** Sakura cross-checks Pyth on-chain on
  every gate call. An agent cannot construct a proof against a
  stale price. You do not rebuild this.
- **An audit record your compliance team will ask for in 2026.** Every
  passing execution writes an `ActionRecord` PDA with a keccak
  fingerprint of the proof. The forensic trail exists whether your
  wallet adds it or not.
- **A shared trusted setup.** The `pot13` ceremony is done. The
  verifying key is baked into the program. New integrators inherit
  the security of the existing setup without rerunning Phase 2.

## The integration, end to end

```ts
import {
  buildSignIntentIx,
  buildExecuteWithIntentProofIx,
  deriveIntentPDA,
} from "@sakura/insurance-pool";
import {
  computeIntentCommitment,
  generateIntentProof,
  proofToOnchainBytes,
  pubkeyToFieldBytes,
} from "@sakura/zk-proof";
import {
  Connection,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

// ═══════════════════════════════════════════════════════════════════
// 1. Intent sign (once per policy window)
// ═══════════════════════════════════════════════════════════════════
//
// Your wallet's UI collects:
//   - natural-language intent text
//   - per-action amount cap
//   - per-action USD cap
//   - allowed-protocols bitmap (Kamino=0, MarginFi=1, Solend=2, …)
//   - allowed-actions bitmap (Borrow=0, Lend=1, Swap=2, Repay=3, …)
//   - expiry timestamp
//
// The user signs one transaction. The seven private values stay in
// the wallet's local storage; only the 32-byte Poseidon commitment
// goes on-chain.

const { bytesBE32: commitmentBytes } = await computeIntentCommitment(
  intentTextHashFromUI,
  pubkeyToFieldBytes(user.toBytes()),
  nonce,
  maxAmount,
  maxUsdValue,
  allowedProtocols,
  allowedActionTypes
);

await connection.sendTransaction(
  buildSignIntentIx({
    admin: SAKURA_ADMIN,
    user,
    intentCommitment: Buffer.from(commitmentBytes),
    expiresAt,
  })
);

// ═══════════════════════════════════════════════════════════════════
// 2. Agent action (every execution)
// ═══════════════════════════════════════════════════════════════════
//
// Your agent decides the action. Your wallet generates the proof.
// The gate instruction goes into the same atomic v0 tx as the
// DeFi instruction your wallet already builds.

const { proof, publicSignals } = await generateIntentProof(witness);
const { proofA, proofB, proofC } = proofToOnchainBytes(proof);

const tx = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
  .add(buildExecuteWithIntentProofIx({
    admin: SAKURA_ADMIN,
    user,
    payer: user,
    pythPriceAccount,
    actionNonce,
    actionType,
    actionAmount,
    actionTargetIndex,
    oraclePriceUsdMicro,
    oracleSlot,
    proofA,
    proofB,
    proofC,
  }))
  .add(yourDefiInstruction);      // Kamino deposit, Jupiter swap, etc.
```

That is the whole integration. The gate adds ~120,000 CU; a 400k CU
limit comfortably absorbs it. The DeFi instruction your wallet passes
in remains fully under your control.

## Integration surfaces, ranked by depth

| Depth | Mechanism | When to pick it |
|---|---|---|
| 1 line | MCP tool | For AI development environments (Claude Desktop, Cursor, VS Code) embedding the protocol read API |
| 1 transaction | Solana Blink | For one-click intent signing surfaced in social feeds, messaging, any Blink-aware client |
| 5 lines | TypeScript client (`@sakura/insurance-pool`) | For a first-party integration inside a wallet's existing agent execution path |
| Full fork | Anchor IDL + Rust crate | For custom compute-budget tuning or bundling the gate inside a larger program |

Every surface calls the same on-chain program. Switching depths later
does not require a user to re-sign their intent.

## Costs, at real numbers

| Operation | On-chain cost | Off-chain cost |
|---|---|---|
| `sign_intent` (once per policy window) | ~0.002 SOL (PDA rent, refundable on close) | Poseidon hash, ~50 ms |
| `execute_with_intent_proof` (per action) | ~0.000020 SOL (~$0.0001) | Groth16 proof generation, ~8 s in browser |
| ActionRecord rent (per action) | ~0.001 SOL (refundable) | — |
| Pyth price update (shared, every ~60s) | ~0.0001 SOL split across all users in the same window | — |

Total marginal cost to a wallet integrating Sakura: less than
one hundredth of a cent per agent action, plus the price of one
Pyth update amortized across that minute's action volume.

## What you do not get (yet)

- **Non-BN254 curves.** The circuit is BN254. If your agent's proof
  pipeline uses a different curve, adapt in front of Sakura.
- **Multi-user shared intents.** One intent, one wallet. Shared-fund
  or DAO-operated agents are possible via PDA-authored signers, but
  that is an application-level pattern, not built in.
- **Cross-chain bounds.** Sakura verifies on Solana. If your agent
  executes on multiple L1s, the Solana leg is bounded; the others
  are on you.
- **Fully trustless trusted setup.** The `pot13` ceremony used a
  Hermez-S3 phase 1 + a solo phase 2 with a public beacon. A
  multi-party Phase 2 is tracked for mainnet graduation and will
  require integrators to upgrade the verifying key together.

## Getting started

```bash
# Clone the reference repo
git clone https://github.com/brianlauquedic/sakura-app

# Run the E2E test against devnet
npx tsx scripts/e2e-intent-execute.ts

# See the end-to-end flow land on-chain
```

## Getting in touch for a partnership integration

If you are a Solana wallet team shipping an agent mode in 2026 and
want a walkthrough, a custom integration surface, or priority
proof-generation infrastructure, open an issue on the repo with the
tag `[integrator]` and a rough description of the use case. First-year
integrators pay zero protocol fee on the first $10M of notional
volume routed through the gate.
