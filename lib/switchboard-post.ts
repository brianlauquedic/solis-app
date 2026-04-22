/**
 * switchboard-post.ts — Client helper to post a fresh Switchboard
 * On-Demand price update and compute the median of Pyth + Switchboard
 * for passing to `execute_with_intent_proof` as the `oracle_price_usd_micro`
 * public input.
 *
 * ── Usage pattern ──────────────────────────────────────────────
 *
 *   // 1. Post Pyth first (existing Hermes flow)
 *   const { postedPythAccount, pyth, priceMicroPyth } =
 *     await postPythUpdate(conn, payer);
 *
 *   // 2. Fetch + post Switchboard
 *   const { updateIxs: sbIxs, lookupTables: sbLuts, priceMicro: sbMicro } =
 *     await buildSwitchboardUpdateIxs({
 *       feedPubkey: SWITCHBOARD_SOL_USD_DEVNET,
 *       payer: payer.publicKey,
 *     });
 *
 *   // 3. Compute median (client side) — must match on-chain median
 *   const medianMicro = crossOracleMedian(priceMicroPyth, sbMicro);
 *
 *   // 4. Bundle into one v0 tx with the Pyth post, the SB update, then
 *   //    the gate ix, then the DeFi ix.
 *   const executeIx = buildExecuteWithIntentProofIx({
 *     ...,
 *     pythPriceAccount: postedPythAccount,
 *     switchboardPriceAccount: SWITCHBOARD_SOL_USD_DEVNET,
 *     oraclePriceUsdMicro: medianMicro,
 *     ...
 *   });
 *   const messageV0 = new TransactionMessage({
 *     payerKey: payer.publicKey,
 *     recentBlockhash,
 *     instructions: [pythPostIx, ...sbIxs, executeIx, yourDefiIx],
 *   }).compileToV0Message(sbLuts);
 *
 * ── Env requirements ───────────────────────────────────────────
 *
 * The Switchboard SDK uses `AnchorUtils.loadProgramFromEnv()`, which
 * reads the same env vars as the `anchor` CLI:
 *   ANCHOR_PROVIDER_URL   e.g. https://api.devnet.solana.com
 *   ANCHOR_WALLET         e.g. /Users/<you>/.config/solana/devnet.json
 *
 * Scripts already set these; end-user apps must set them before calling
 * `buildSwitchboardUpdateIxs` on the client side.
 */

import {
  Connection,
  Keypair,
  type PublicKey,
  type TransactionInstruction,
  type AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  PullFeed,
  isMainnetConnection,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_MAINNET_PID,
} from "@switchboard-xyz/on-demand";
// Resolve anchor-30 from @switchboard-xyz/on-demand's transitive deps.
// Don't use AnchorUtils.loadProgramFromEnv: as of switchboard-on-demand
// 1.2.42, that helper calls `isMainnetConnection` WITHOUT awaiting the
// returned Promise, so `isMainnet` is always truthy and the mainnet PID
// is always selected — a bug that manifests on devnet as
// `AccountOwnedByWrongProgram (3007)`.
//
// We construct the Program ourselves with the correctly-awaited cluster
// check.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const anchor = require("@coral-xyz/anchor-30");

// Memoize the on-demand Program — loading it (fetch IDL) is a round-trip.
let _onDemandProgramPromise: Promise<unknown> | null = null;
async function getOnDemandProgram(): Promise<unknown> {
  if (_onDemandProgramPromise == null) {
    _onDemandProgramPromise = (async () => {
      const rpcUrl = process.env.ANCHOR_PROVIDER_URL;
      if (!rpcUrl) {
        throw new Error(
          "ANCHOR_PROVIDER_URL env var required for Switchboard update. " +
          "Set it to a Solana RPC endpoint (e.g. https://api.devnet.solana.com)."
        );
      }
      const connection = new Connection(rpcUrl, "confirmed");
      // Dummy signer — fetchUpdateIx doesn't sign anything, it just
      // builds an ix the caller signs in the parent tx.
      const dummy = Keypair.generate();
      const wallet = {
        publicKey: dummy.publicKey,
        signTransaction: async (tx: unknown) => tx,
        signAllTransactions: async (txs: unknown[]) => txs,
        payer: dummy,
      };
      const provider = new anchor.AnchorProvider(connection, wallet as never, {
        commitment: "confirmed",
      });

      // Correctly await the cluster check (patching around the SDK bug).
      const isMainnet = await isMainnetConnection(connection);
      const pid = isMainnet ? ON_DEMAND_MAINNET_PID : ON_DEMAND_DEVNET_PID;

      const idl = await anchor.Program.fetchIdl(pid, provider);
      if (!idl) {
        throw new Error(
          `Failed to fetch on-demand IDL at ${pid.toBase58()}. ` +
          `Cluster may not have the program deployed.`
        );
      }
      return new anchor.Program(idl, provider);
    })();
  }
  return _onDemandProgramPromise;
}

/**
 * Fetch a fresh Switchboard On-Demand price signature from the oracle
 * gateway and build the instruction(s) + LUTs needed to post it
 * on-chain.
 *
 * Returns:
 *   · `updateIxs`: include BEFORE `execute_with_intent_proof` in the
 *     same atomic v0 transaction. Typically 1 ix.
 *   · `lookupTables`: pass these to `compileToV0Message(lookupTables)`
 *     so the tx fits under the Solana account-lookup limit.
 *   · `priceMicro`: the off-chain aggregated SB price, scaled to
 *     micro-USD (1e6). Feed into `crossOracleMedian()`.
 *
 * Throws if all oracle responses are errors / null.
 */
export async function buildSwitchboardUpdateIxs(params: {
  feedPubkey: PublicKey;
  payer: PublicKey;
  /** Minimum number of oracle sigs to aggregate. 1 for dev / 3+ for prod. */
  numSignatures?: number;
}): Promise<{
  updateIxs: TransactionInstruction[];
  lookupTables: AddressLookupTableAccount[];
  priceMicro: bigint;
}> {
  // AnchorUtils.loadProgramFromEnv returns an anchor-30 Program. We
  // treat it as `unknown` on our side and only pass it straight into
  // the SDK's PullFeed constructor — no direct anchor-30 import on
  // Sakura's side to keep the dep graph small.
  const program = (await getOnDemandProgram()) as ConstructorParameters<
    typeof PullFeed
  >[0];

  const pullFeed = new PullFeed(program, params.feedPubkey);

  const [maybeIx, responses, _numSignatures, luts, _diagnostics] =
    await pullFeed.fetchUpdateIx(
      {
        numSignatures: params.numSignatures ?? 1,
      },
      undefined, // recentSlothashes (SDK fetches)
      undefined, // priceSignatures (SDK gathers)
      false,     // debug
      params.payer
    );

  if (!maybeIx) {
    throw new Error(
      "Switchboard fetchUpdateIx returned no ix. Likely all oracles " +
      "failed to respond — check network connection to the Switchboard " +
      "gateway / Crossbar, or try again."
    );
  }

  // Pick the first valid response. For stricter aggregation the caller
  // could median across responses, but fetchUpdateIx's on-chain ix
  // already aggregates under `numSignatures`, so one client-side value
  // suffices for passing to our Sakura handler.
  const validResponses = responses.filter(
    (r) => r.value != null && r.error === ""
  );
  if (validResponses.length === 0) {
    const errMsgs = responses.map((r) => r.error).filter(Boolean);
    throw new Error(
      "Switchboard fetchUpdateIx: no valid oracle responses. " +
      `Errors: ${JSON.stringify(errMsgs)}`
    );
  }

  const raw = validResponses[0].value!; // Big | null; just filtered non-null
  // big.js Big#toString returns the full precision decimal. Convert to
  // micro-USD by multiplying by 1e6 and flooring. Use Number() for the
  // final scale; SOL/USD prices are always <= ~$500 so this fits safely
  // in a JS number until we bigint-ify.
  const priceMicro = BigInt(Math.floor(Number(raw.toString()) * 1_000_000));

  return {
    updateIxs: [maybeIx],
    lookupTables: luts,
    priceMicro,
  };
}

/**
 * Compute the Pyth+Switchboard median (arithmetic mean with 2
 * oracles) in micro-USD. Mirrors the on-chain computation in
 * `execute_with_intent_proof` so the caller-passed
 * `oracle_price_usd_micro` matches within ±1.
 */
export function crossOracleMedian(pythMicro: bigint, sbMicro: bigint): bigint {
  return (pythMicro + sbMicro) / 2n;
}

/**
 * Pre-check helper: returns the basis-point deviation between the two
 * oracles. Use on the client side to fail fast before paying the gate
 * CUs if the oracles are already > 1% apart (which the on-chain check
 * will reject anyway).
 *
 *   const bps = crossOracleDeviationBps(pythMicro, sbMicro);
 *   if (bps > MAX_CROSS_ORACLE_DEVIATION_BPS) {
 *     throw new Error(`Oracle divergence ${bps} bps — skipping action`);
 *   }
 */
export function crossOracleDeviationBps(a: bigint, b: bigint): bigint {
  const diff = a > b ? a - b : b - a;
  const max = a > b ? a : b;
  if (max === 0n) return 0n;
  return (diff * 10_000n) / max;
}
