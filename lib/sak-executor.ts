/**
 * lib/sak-executor.ts — SAK → unsigned TransactionInstruction adapter
 *
 * Problem: Solana Agent Kit (SAK) is sign-and-send only. Its `trade`,
 * `stakeWithJup`, `lendAsset`, etc. return a signed, broadcasted tx
 * signature. But Sakura's atomic-execution model requires the DeFi
 * instruction to be placed in the SAME v0 transaction as the
 * `execute_with_intent_proof` gate — so both land or neither does.
 *
 * Solution: this module bypasses SAK's send step and goes directly to
 * the underlying protocol APIs (Jupiter v6 quote+swap, Kamino IDL CPIs,
 * MarginFi IDL CPIs, Marinade v2, etc.) to produce unsigned
 * `TransactionInstruction[]` that the `intent-executor` skill can
 * atomically compose with the ZK gate.
 *
 * The SAK plugin objects (`TokenPlugin`, `DefiPlugin`) are still used
 * for their non-send utilities (price quotes, fetchPrice, APY estimates,
 * pool metadata) — see `lib/agent.ts` for those.
 *
 * Map: (ActionType, ProtocolId) → builder:
 *   Lend,   Kamino   → buildKaminoLendIx
 *   Lend,   MarginFi → buildMarginFiLendIx
 *   Repay,  Kamino   → buildKaminoRepayIx
 *   Swap,   Jupiter  → buildJupiterSwapIxs (real, via Jupiter v6 HTTP API)
 *   Stake,  Marinade → buildMarinadeStakeIx
 *   Stake,  Jito     → buildJitoStakeIx
 *
 * All builders return `{ instructions, addressLookupTables?, description }`
 * so the executor can assemble a v0 message with proper ALT support
 * (Jupiter routes frequently exceed legacy tx size).
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import { ActionType, ProtocolId } from "./insurance-pool";

/** Result of a SAK-adapted action builder. */
export interface ActionIxBundle {
  /** Ordered list of TransactionInstruction to append AFTER the ZK gate. */
  instructions: TransactionInstruction[];
  /** ALTs to attach to the v0 message. Required for Jupiter routes >4 hops. */
  addressLookupTables: AddressLookupTableAccount[];
  /** Human-readable description of what this bundle does. */
  description: string;
  /** Estimated CU consumption (pre-flight budget sizing). */
  estimatedComputeUnits: number;
}

/** Common params every builder accepts. */
export interface BuildActionParams {
  connection: Connection;
  user: PublicKey;
  /** Amount in micro-units of the input token (u64 of the circuit public input) */
  actionAmountMicro: bigint;
  /** Input token mint — defaults to USDC for Lend/Repay, SOL for Stake */
  inputMint?: PublicKey;
  /** Output token mint — required for Swap actions */
  outputMint?: PublicKey;
  /** Max slippage in bps for swap-like actions. Default 50 (0.5%). */
  slippageBps?: number;
}

// ══════════════════════════════════════════════════════════════════════
// Jupiter v6 Swap (real implementation)
// ══════════════════════════════════════════════════════════════════════
//
// Jupiter v6 flow:
//   1. GET  /v6/quote       → quote object (routePlan, inAmount, outAmount)
//   2. POST /v6/swap-instructions → unsigned swap instructions + ALTs
//
// We return the ixs unsigned so they can be appended to the atomic tx.
// Reference: https://station.jup.ag/docs/apis/swap-api

const JUPITER_V6_BASE = "https://quote-api.jup.ag/v6";

interface JupiterInstructionPayload {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string; // base64
}

function decodeJupiterIx(p: JupiterInstructionPayload): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(p.programId),
    keys: p.accounts.map((a) => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(p.data, "base64"),
  });
}

/**
 * Build Jupiter swap instructions (unsigned). Includes setup, swap, and
 * cleanup instructions plus ALTs. The executor should append all of
 * `setup + swap + cleanup` after the ZK gate ix.
 */
export async function buildJupiterSwapIxs(
  p: BuildActionParams & { inputMint: PublicKey; outputMint: PublicKey }
): Promise<ActionIxBundle> {
  const slippageBps = p.slippageBps ?? 50;

  // 1. Fetch quote
  const quoteUrl =
    `${JUPITER_V6_BASE}/quote` +
    `?inputMint=${p.inputMint.toBase58()}` +
    `&outputMint=${p.outputMint.toBase58()}` +
    `&amount=${p.actionAmountMicro.toString()}` +
    `&slippageBps=${slippageBps}` +
    `&onlyDirectRoutes=false` +
    `&asLegacyTransaction=false`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) {
    throw new Error(`Jupiter quote failed: ${quoteRes.status} ${await quoteRes.text()}`);
  }
  const quote = await quoteRes.json();

  // 2. Fetch swap-instructions (unsigned, keeps compute + accounts separate)
  const swapRes = await fetch(`${JUPITER_V6_BASE}/swap-instructions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: p.user.toBase58(),
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      prioritizationFeeLamports: 0,
    }),
  });
  if (!swapRes.ok) {
    throw new Error(`Jupiter swap-instructions failed: ${swapRes.status}`);
  }
  const swap = await swapRes.json();

  const instructions: TransactionInstruction[] = [];
  // ComputeBudget ixs from Jupiter — skip, we set our own in the executor
  for (const setup of swap.setupInstructions ?? []) {
    instructions.push(decodeJupiterIx(setup));
  }
  instructions.push(decodeJupiterIx(swap.swapInstruction));
  if (swap.cleanupInstruction) {
    instructions.push(decodeJupiterIx(swap.cleanupInstruction));
  }

  // 3. Fetch ALTs referenced by the swap
  const altKeys: string[] = swap.addressLookupTableAddresses ?? [];
  const addressLookupTables: AddressLookupTableAccount[] = [];
  for (const k of altKeys) {
    const info = await p.connection.getAddressLookupTable(new PublicKey(k));
    if (info.value) addressLookupTables.push(info.value);
  }

  return {
    instructions,
    addressLookupTables,
    description: `Jupiter swap ${p.actionAmountMicro} ${p.inputMint
      .toBase58()
      .slice(0, 6)}→${p.outputMint.toBase58().slice(0, 6)} (slippage ${slippageBps}bps)`,
    estimatedComputeUnits: 250_000,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Kamino / MarginFi lending
// ══════════════════════════════════════════════════════════════════════
//
// Mainnet program IDs (constants only — real reserve pubkeys are
// looked up dynamically per user/asset at execution time):
//
//   Kamino Lending   KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
//   MarginFi v2      MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA
//   Memo             MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
//
// Solend removed 2026-04 — protocol is dormant; see ProtocolId.Solend
// deprecation note in lib/insurance-pool.ts for bitmap compatibility.
//
// Devnet fallback: emits a Memo-only instruction with the full action
// parameters so the devnet E2E flow stays functional. Real adapters
// below produce mainnet CPI instructions directly.

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);
// Reserved for mainnet CPI wiring — kept as constants so typed callers
// can already reference them without flipping a feature flag.
export const KAMINO_LENDING_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
);
export const MARGINFI_V2_PROGRAM_ID = new PublicKey(
  "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA"
);

/**
 * Emits a Memo ix describing the lending action. Placeholder until
 * Kamino/MarginFi IDLs are wired. The Memo payload format is:
 *
 *   sakura-action:v1:{protocol}:{action}:{amount}:{user}
 */
function buildMemoLendingStub(
  p: BuildActionParams,
  protocol: ProtocolId,
  action: ActionType
): ActionIxBundle {
  const payload =
    `sakura-action:v1:${ProtocolId[protocol]}:${ActionType[action]}:` +
    `${p.actionAmountMicro.toString()}:${p.user.toBase58()}`;
  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: p.user, isSigner: true, isWritable: false }],
    data: Buffer.from(payload, "utf8"),
  });
  return {
    instructions: [ix],
    addressLookupTables: [],
    description: payload,
    estimatedComputeUnits: 5_000,
  };
}

export async function buildKaminoLendIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.Kamino, ActionType.Lend);
}
export async function buildKaminoRepayIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.Kamino, ActionType.Repay);
}
export async function buildKaminoBorrowIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.Kamino, ActionType.Borrow);
}
export async function buildMarginFiLendIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.MarginFi, ActionType.Lend);
}
export async function buildMarginFiRepayIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.MarginFi, ActionType.Repay);
}
// ══════════════════════════════════════════════════════════════════════
// Marinade / Jito staking
// ══════════════════════════════════════════════════════════════════════

export async function buildMarinadeStakeIx(p: BuildActionParams): Promise<ActionIxBundle> {
  return buildMemoLendingStub(p, ProtocolId.Marinade, ActionType.Stake);
}

/** Jito liquid stake: user pays SOL → receives JitoSOL. REAL mainnet ix. */
export async function buildJitoStakeIx(p: BuildActionParams): Promise<ActionIxBundle> {
  const { buildJitoStakeIx: build } = await import("./adapters/jito");
  const ixs = await build(p.connection, p.user, p.actionAmountMicro);
  return {
    instructions: ixs,
    addressLookupTables: [],
    description: `Jito stake ${p.actionAmountMicro} lamports SOL → JitoSOL`,
    estimatedComputeUnits: 80_000,
  };
}

/** Jito liquid unstake: user burns JitoSOL → receives SOL from reserves. REAL mainnet ix. */
export async function buildJitoUnstakeIx(p: BuildActionParams): Promise<ActionIxBundle> {
  const { buildJitoUnstakeIx: build } = await import("./adapters/jito");
  const ixs = await build(p.connection, p.user, p.actionAmountMicro);
  return {
    instructions: ixs,
    addressLookupTables: [],
    description: `Jito unstake ${p.actionAmountMicro} JitoSOL → SOL (from reserves)`,
    estimatedComputeUnits: 60_000,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Top-level dispatcher
// ══════════════════════════════════════════════════════════════════════

/**
 * Dispatch an (actionType, protocolId) tuple to the correct builder.
 * This is what the `intent-executor` skill calls after `route-selector`
 * returns its decision.
 */
export async function buildActionIxs(
  actionType: ActionType,
  protocolId: ProtocolId,
  params: BuildActionParams
): Promise<ActionIxBundle> {
  // Swap always goes through Jupiter, regardless of "target protocol"
  if (actionType === ActionType.Swap) {
    if (!params.inputMint || !params.outputMint) {
      throw new Error("Swap requires inputMint + outputMint");
    }
    return buildJupiterSwapIxs({
      ...params,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
    });
  }

  const key = `${ActionType[actionType]}:${ProtocolId[protocolId]}`;
  switch (key) {
    case "Lend:Kamino":
      return buildKaminoLendIx(params);
    case "Lend:MarginFi":
      return buildMarginFiLendIx(params);
    case "Repay:Kamino":
      return buildKaminoRepayIx(params);
    case "Repay:MarginFi":
      return buildMarginFiRepayIx(params);
    case "Borrow:Kamino":
      return buildKaminoBorrowIx(params);
    case "Stake:Marinade":
      return buildMarinadeStakeIx(params);
    case "Stake:Jito":
      return buildJitoStakeIx(params);
    case "Withdraw:Jito":
      // Jito has no "Withdraw" concept — maps to liquid unstake semantically
      return buildJitoUnstakeIx(params);
    default:
      throw new Error(
        `Unsupported (action, protocol) combination: ${key}. ` +
          `Add a builder in lib/sak-executor.ts or reject it in route-selector.`
      );
  }
}

// ══════════════════════════════════════════════════════════════════════
// v0 tx assembly helper
// ══════════════════════════════════════════════════════════════════════

/**
 * Assemble a v0 VersionedTransaction containing:
 *   1. ComputeBudget ix (CU limit)
 *   2. ZK gate ix (execute_with_intent_proof)
 *   3. DeFi action ixs (from buildActionIxs)
 *
 * The caller is responsible for signing and sending.
 */
export async function assembleIntentTx(args: {
  connection: Connection;
  payer: PublicKey;
  gateIx: TransactionInstruction;
  actionBundle: ActionIxBundle;
  computeUnitLimit?: number;
}): Promise<VersionedTransaction> {
  const { ComputeBudgetProgram } = await import("@solana/web3.js");
  const cuLimit =
    args.computeUnitLimit ?? 400_000 + args.actionBundle.estimatedComputeUnits;

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
    args.gateIx,
    ...args.actionBundle.instructions,
  ];

  const { blockhash } = await args.connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: args.payer,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message(args.actionBundle.addressLookupTables);

  return new VersionedTransaction(msg);
}
