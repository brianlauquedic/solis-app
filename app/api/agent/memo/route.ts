import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const RPC_URL =
  process.env.HELIUS_RPC_URL ??
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

// Max memo payload length (Solana memo program limit is 566 bytes for a single tx)
const MAX_MEMO_BYTES = 560;

function getPlatformKeypair(): Keypair | null {
  const raw = process.env.SOLIS_AGENT_PRIVATE_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let memoPayload: string;
  try {
    const body = await req.json();
    memoPayload = body.memoPayload as string;
    if (!memoPayload || typeof memoPayload !== "string") {
      return NextResponse.json({ error: "memoPayload required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  // [SECURITY FIX] Truncate to byte-safe length to prevent oversized tx
  const encoded = new TextEncoder().encode(memoPayload);
  const safeMemo = encoded.length > MAX_MEMO_BYTES
    ? new TextDecoder().decode(encoded.slice(0, MAX_MEMO_BYTES))
    : memoPayload;

  const keypair = getPlatformKeypair();
  if (!keypair) {
    // No platform key configured — fall back to client-side Phantom signing
    return NextResponse.json(
      { error: "no_platform_key", message: "SOLIS_AGENT_PRIVATE_KEY not configured" },
      { status: 501 }
    );
  }

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: keypair.publicKey,
    }).add(
      new TransactionInstruction({
        keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(safeMemo, "utf-8"),
      })
    );

    tx.sign(keypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    return NextResponse.json({
      txSignature: signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      memoPayload: safeMemo,
    });
  } catch (e: unknown) {
    // [SECURITY FIX] Never expose raw error messages — log server-side only
    const msg = e instanceof Error ? e.message : "transaction failed";
    console.error("[agent/memo] tx error:", msg);
    return NextResponse.json({ error: "memo_write_failed" }, { status: 500 });
  }
}
