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
  proof is verified on-chain by Solana's `alt_bn128` syscall
  (Protocol 1.17). If the proof fails, the entire transaction
  reverts — the DeFi instruction your wallet built never runs.
- **Oracle binding built in.** Sakura cross-checks Pyth `PriceUpdateV2`
  on-chain on every gate call: feed-id, posted slot, and a 150-slot
  freshness window. An agent cannot construct a proof against a
  stale or spoofed price. You do not rebuild this.
- **An audit record your compliance team will ask for in 2026.** Every
  passing execution writes an `ActionRecord` PDA with a keccak
  fingerprint of the proof. The forensic trail exists whether your
  wallet adds it or not.
- **A shared trusted setup.** The Phase-1 ceremony reuses Hermez
  Powers-of-Tau (`pot11`, 2048-slot capacity — our 1,909-constraint
  circuit fits). Phase-2 is a hackathon-grade 2-contributor
  ceremony; see [`ceremony/TRANSCRIPT.md`](../ceremony/TRANSCRIPT.md)
  for contributor attestation, beacon source, and SHA-256 file
  hashes. A 7+ contributor public Phase-2 is tracked for production
  launch.

## Consuming Sakura from your own repo

Sakura's TypeScript client is **not yet published to npm**; the
`"sakura-app"` package is marked `private: true` in `package.json`.
Until we publish (tracked for post-audit, pre-mainnet), integrators
pick one of three paths:

| Path | Mechanism | When to pick it |
|---|---|---|
| **Submodule** | `git submodule add https://github.com/brianlauquedic/sakura-app sakura` | You want version-pinned updates without vendoring |
| **Copy** | Vendor `lib/insurance-pool.ts`, `lib/zk-proof.ts`, `lib/sak-executor.ts` (and their two runtime deps: `circomlibjs`, `snarkjs`) into your repo | You want to freeze a specific revision and iterate independently |
| **Wait** | `npm install @sakura/insurance-pool @sakura/zk-proof` (post-audit) | You want semver + typed releases and can wait ~weeks |

All three paths call the same on-chain program ID:
`AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp` on devnet (set
`NEXT_PUBLIC_INSURANCE_PROGRAM_ID` to override for a private
deployment).

Examples below use the **submodule** path (`./sakura/lib/*`) because
it is the most reproducible for a reader copy-pasting into a fresh
project.

## The integration, end to end

```ts
import {
  SAKURA_INSURANCE_PROGRAM_ID,
  ActionType,
  ProtocolId,
  USDC_MINT_DEVNET,
  PYTH_SOL_USD_DEVNET,
  buildProtocolsBitmap,
  buildActionTypesBitmap,
  buildSignIntentIx,
  buildExecuteWithIntentProofIx,
  deriveIntentPDA,
  deriveProtocolPDA,
  deriveFeeVaultPDA,
} from "./sakura/lib/insurance-pool";
import {
  computeIntentCommitment,
  generateIntentProof,
  proofToOnchainBytes,
  pubkeyToFieldBytes,
  type IntentWitness,
} from "./sakura/lib/zk-proof";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

// The admin pubkey of the Sakura protocol deployment you are
// pointing at. For the canonical devnet deployment, read this from
// your env — see `.env.example` in the repo:
const SAKURA_ADMIN = new PublicKey(
  process.env.NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN!
);

// ═══════════════════════════════════════════════════════════════════
// 0. One-time PDA + ATA derivation (reuse across both instructions)
// ═══════════════════════════════════════════════════════════════════

const [protocolPDA] = deriveProtocolPDA(SAKURA_ADMIN);
const [feeVaultPDA] = deriveFeeVaultPDA(protocolPDA);
// USDC_MINT_MAINNET for mainnet-beta deployments:
const userUsdcAta = getAssociatedTokenAddressSync(USDC_MINT_DEVNET, user);

// ═══════════════════════════════════════════════════════════════════
// 1. Intent sign  (once per policy window, e.g. once a week)
// ═══════════════════════════════════════════════════════════════════
//
// Your wallet's UI collects seven values from the user:
//   - natural-language intent text  (free text, hashed to a field element)
//   - per-action amount cap         (in micro-units of the token, e.g. USDC*10⁶)
//   - per-action USD cap            (in micro-USD)
//   - allowed-protocols bitmap      (ProtocolId enum: Kamino=0, MarginFi=1, …)
//   - allowed-actions bitmap        (ActionType enum: Borrow=0, Lend=1, Swap=2, …)
//   - intent nonce                  (any bigint, typically monotonic)
//   - expiry timestamp              (unix seconds)
//
// The user signs one transaction. The seven private values stay in
// your wallet's local state; only the 32-byte Poseidon commitment
// reaches the chain.

// Intent-text → field element via Poseidon. IMPORTANT: this must
// reproduce the exact algorithm used in the reference implementation
// at `lib/sakura-mcp-tools.ts` (three-input Poseidon with the byte
// offset as the third input). Any variation — even a cosmetic one —
// produces a different `intentTextHash`, which will cause every
// subsequent proof to fail on-chain.
async function hashIntentText(text: string): Promise<bigint> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const textBytes = Buffer.from(text, "utf8");
  let acc = 0n;
  for (let i = 0; i < textBytes.length; i += 31) {
    const chunk = textBytes.subarray(i, Math.min(i + 31, textBytes.length));
    let v = 0n;
    for (let j = 0; j < chunk.length; j++) v = (v << 8n) | BigInt(chunk[j]);
    const h = poseidon([acc, v, BigInt(i)]);
    acc = BigInt(poseidon.F.toString(h));
  }
  return acc;
}

const intentTextHash = await hashIntentText(
  "The agent may lend up to $1,000 into Kamino or MarginFi for one week."
);

const { bytesBE32: commitmentBytes } = await computeIntentCommitment(
  intentTextHash,
  pubkeyToFieldBytes(user.toBytes()),
  nonce,                     // bigint
  maxAmount,                 // bigint, micro-units
  maxUsdValue,               // bigint, micro-USD
  buildProtocolsBitmap([ProtocolId.Kamino, ProtocolId.MarginFi]),
  buildActionTypesBitmap([ActionType.Lend])
);

const signTx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: user,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [
      buildSignIntentIx({
        admin: SAKURA_ADMIN,
        user,
        userUsdcAta,
        feeVault: feeVaultPDA,
        intentCommitment: Buffer.from(commitmentBytes),
        expiresAt,             // bigint, unix seconds
        feeMicro: feeFromMaxUsdValue(maxUsdValue),  // 0.1% of max_usd_value, capped at 1e9 ($1000)
      }),
    ],
  }).compileToV0Message()
);
// Hand signTx to the user's wallet → sendRawTransaction

// ═══════════════════════════════════════════════════════════════════
// 2. Agent action  (every execution within the policy window)
// ═══════════════════════════════════════════════════════════════════
//
// Your agent decides the action. Your wallet generates the proof
// off-chain (snarkjs, browser-side — see the latency note below).
// The gate instruction goes into the same atomic v0 transaction as
// the DeFi instruction your wallet already builds.

// The `IntentWitness` carries BOTH the public inputs (what the
// circuit proves ABOUT) and the private witnesses (the seven secret
// bounds values). The circuit itself enforces that the private
// values hash to the `intentCommitment` the user signed earlier.
const witness: IntentWitness = {
  // Public inputs (checked on-chain against program arguments):
  intentCommitment: BigInt(
    "0x" + Buffer.from(commitmentBytes).toString("hex")
  ),
  actionType: ActionType.Lend,
  actionAmount,
  actionTargetIndex: ProtocolId.Kamino,
  oraclePriceUsdMicro,
  oracleSlot,
  // Private witnesses (never leave your wallet's memory):
  maxAmount,
  maxUsdValue,
  allowedProtocols: BigInt(
    buildProtocolsBitmap([ProtocolId.Kamino, ProtocolId.MarginFi])
  ),
  allowedActionTypes: BigInt(
    buildActionTypesBitmap([ActionType.Lend])
  ),
  walletBytes: pubkeyToFieldBytes(user.toBytes()),
  nonce,
  intentTextHash,
};

const { proof, publicSignals } = await generateIntentProof(witness);
const { proofA, proofB, proofC } = proofToOnchainBytes(proof);

const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: user,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      buildExecuteWithIntentProofIx({
        admin: SAKURA_ADMIN,
        user,
        payer: user,
        payerUsdcAta: userUsdcAta,     // payer == user in this example
        feeVault: feeVaultPDA,
        pythPriceAccount: PYTH_SOL_USD_DEVNET,   // or your tracked feed
        actionNonce,
        actionType: ActionType.Lend,
        actionAmount,
        actionTargetIndex: ProtocolId.Kamino,
        oraclePriceUsdMicro,
        oracleSlot,
        proofA,
        proofB,
        proofC,
      }),
      yourDefiInstruction,       // Kamino deposit, Jupiter swap, Marinade stake
    ],
  }).compileToV0Message()
);
// Hand tx to the user's wallet → sendRawTransaction. The two
// instructions (gate + DeFi) land or revert atomically.
```

That is the whole integration. The gate adds ~126,221 CU for the
pairing plus ~60,000 CU for Pyth re-parse + PDA init; a 400k CU
limit comfortably absorbs it and leaves room for a realistic DeFi
instruction. The DeFi instruction your wallet passes in remains
fully under your control.

### Proof-generation latency — what to budget for

Proof generation runs off-chain in the user's browser via snarkjs.
Specific latency depends on (a) device CPU, (b) first-run vs.
cached state (the `.wasm` + `.zkey` are ~1.5 MB and must be fetched
once), and (c) whether the tab is foregrounded (mobile Safari and
background Chrome throttle JS heavily).

We do not publish device-specific numbers from this repo — they
drift with every browser release. **Measure on your target devices
before locking your UX.** Two universal patterns apply regardless
of the numbers you observe:

- **Push proof generation into a Web Worker** so the main thread
  stays responsive to user input and the browser does not flag the
  tab as unresponsive.
- **Budget for a several-second window** between the agent's
  decision and the signed transaction, with a user-visible
  "preparing proof…" indicator and a cancel path (recommended
  ceiling: 30 seconds; beyond that, surface the option to retry).

First-time load adds the `.wasm` + `.zkey` fetch; cache these at
your service-worker layer so subsequent proofs are CPU-bound only.

## Integration surfaces, ranked by depth

| Depth | Mechanism | What ships | When to pick it |
|---|---|---|---|
| **1 line** | MCP tool | `/api/mcp/[transport]` endpoint, `@modelcontextprotocol/sdk` compatible | For AI development environments (Claude Desktop, Cursor, VS Code) embedding the read-side API |
| **1 transaction** | Solana Blink | `/api/actions/sign-intent` | For one-click intent signing surfaced in X/Discord/messaging, any Blink-aware client |
| **5 lines** | TypeScript client | `lib/insurance-pool.ts` + `lib/zk-proof.ts` (see above) | For a first-party integration inside a wallet's existing agent execution path |
| **Full fork** | Anchor IDL + Rust crate | `programs/sakura-insurance/` | For custom compute-budget tuning or bundling the gate inside a larger program |

Every surface calls the same on-chain program. Switching depths
later does not require a user to re-sign their intent.

## Costs, at real numbers

| Operation | On-chain cost | Off-chain cost |
|---|---|---|
| `sign_intent` (once per policy window) | ~0.002 SOL PDA rent (refundable on close) + 0.1% × `max_usd_value` protocol fee (capped at $1) | Poseidon hash, ~50 ms |
| `execute_with_intent_proof` (per action) | ~0.000020 SOL + `$0.01` flat protocol fee (`EXECUTE_ACTION_FEE_MICRO = 10_000`) | Groth16 proof gen — see latency note above |
| `ActionRecord` PDA rent (per action) | ~0.001 SOL (refundable) | — |
| Pyth `PriceUpdateV2` post (shared, ~once per 60s) | ~0.0001 SOL, amortized across that window's volume | — |

Full revenue model and the reasoning behind these specific numbers
lives in [`docs/VALUE_CAPTURE.md`](./VALUE_CAPTURE.md). For
first-year integrators the protocol-fee line is **zero on the first
$10M of notional** routed through the gate (see "Partnership
integration" below).

## What you do not get (yet)

- **Non-BN254 curves.** The circuit is BN254. If your agent's proof
  pipeline uses a different curve, adapt in front of Sakura.
- **Multi-user shared intents.** One intent, one wallet. Shared-fund
  or DAO-operated agents are possible via PDA-authored signers, but
  that is an application-level pattern, not built in.
- **Cross-chain bounds.** Sakura verifies on Solana. If your agent
  executes on multiple L1s, the Solana leg is bounded; the others
  are on you.
- **Fully trustless trusted setup.** The current ceremony is
  hackathon-grade: Hermez Phase-1 reuse + a 2-contributor Phase-2
  with `/dev/urandom` and a drand beacon. The `ceremony/TRANSCRIPT.md`
  file calls this out explicitly. Production launch will migrate to
  a 7+ contributor public Phase-2 ceremony and a fresh verifying
  key — integrators will need to point at the new program ID and
  users with still-active intents will need to re-sign.
- **Native mobile (yet).** The web integration path works on mobile
  Safari/Chrome with known caveats. See
  [`docs/MWA_INTEGRATION_SPEC.md`](./MWA_INTEGRATION_SPEC.md) for
  the Mobile Wallet Adapter plan.

## Verifying-key upgrade policy

The `alt_bn128`-verified key is baked into
[`programs/sakura-insurance/src/zk_verifying_key.rs`](../programs/sakura-insurance/src/zk_verifying_key.rs)
at deploy time. Any change to the circuit (new constraint, new
witness shape, ceremony rotation) requires a program **redeployment
under a new program address**, not an upgradeable in-place swap.

The guarantee this produces for integrators: **the verifier
against which your user's intent was signed can never be mutated
by the Sakura team**. The cost: at circuit upgrade, integrators
must point their code at the new program ID (one-line env change)
and users with still-active intents must re-sign to the new
verifying key.

Upgrade cadence target: **at most once every 6 months**, and
never inside an active hackathon / contest window. Breaking
upgrades are published 30 days in advance on the repo's GitHub
Releases page and pinned in the README.

## Getting started

```bash
# 1. Clone + install
git clone https://github.com/brianlauquedic/sakura-app
cd sakura-app
npm install

# 2. Env (copies the template; edit values with your devnet keys)
cp .env.example .env.local
# Minimum keys for the E2E script:
#   NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN  (server-side counterpart: SAKURA_PROTOCOL_ADMIN)
#   NEXT_PUBLIC_INSURANCE_PROGRAM_ID   (default is the devnet canonical)
#   HELIUS_API_KEY                     (or any devnet-capable RPC endpoint)
#   SAKURA_AGENT_PRIVATE_KEY           (JSON array keypair for the agent signer)

# 3. Fund a devnet wallet (one-time)
solana-keygen new --outfile ~/.config/solana/devnet.json
solana airdrop 2 --url devnet

# 4. Run the full end-to-end
npx tsx scripts/e2e-intent-execute.ts
# Expected final lines:
#   off-chain snarkjs verify: ✓ OK
#   execute landed: https://solscan.io/tx/…?cluster=devnet
#   E2E PASS — intent-execution verified on-chain via alt_bn128 pairing.

# 5. Local app (optional)
npm run dev
# http://localhost:3000
```

If any step fails, open an issue tagged `[getting-started]` with
the failing step's stderr. The repo's CI runs this exact sequence
nightly, so step 4 should pass on `main` at any given time.

## Getting in touch for a partnership integration

If you are a Solana wallet team shipping agent mode in 2026 and
want:

- a guided integration walkthrough on your stack,
- a custom integration surface (e.g. a Rust-only path for a native
  wallet),
- priority access to GPU-backed proof generation,
- or the first-year zero-fee tier on the first **\$10M of notional**,

**open an issue tagged `[integrator]`** at
https://github.com/brianlauquedic/sakura-app/issues with:

1. The wallet/app name and its agent-mode status
2. A one-paragraph description of the integration use case
3. A point-of-contact channel (GitHub handle, Telegram, or email)

We aim to reply within a business week. Priority goes to teams with
a deployed agent-mode product or a concrete integration timeline,
in the order issues are filed.

---

*Last reviewed: 2026-04-22 · Devnet program
`AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp` · Circuit revision:
see [`ceremony/TRANSCRIPT.md`](../ceremony/TRANSCRIPT.md) for
Phase-1 / Phase-2 attestation and verifying-key hashes. CU
benchmark at [`docs/bench/2026-04-21-cu.json`](./bench/2026-04-21-cu.json).*
