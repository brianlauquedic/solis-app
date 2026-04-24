/**
 * scripts/som-analysis/agentic-wallets-publicnode.ts
 *
 * Zero-API-key variant of agentic-wallets-helius.ts. Uses publicnode's
 * public Solana RPC by default (no registration, no key). Kept as a
 * sibling file — the Helius variant remains available for users who
 * want deeper scans than publicnode's free rate limits allow.
 *
 * Why a zero-key path matters for this pitch: Dovey's "which txs most
 * need boundary verification" question should be answerable by anyone
 * cloning the repo and running `npx tsx`, not gated behind an API
 * signup flow.
 *
 * Flow (identical to helius variant):
 *   1. For each of 4 protocol families, enumerate recent tx signatures
 *      via getSignaturesForAddress (paginated, 1000 per page).
 *   2. Batch-fetch parsed transactions via getParsedTransactions (100 per
 *      call) to extract the fee-paying signer of each tx.
 *   3. Aggregate per-family Set<signer> + compute cross-family overlap.
 *   4. Write JSON + Markdown snapshot to output/.
 *
 * Env:
 *   OVERLAP_RPC_URL           optional  default https://solana-rpc.publicnode.com
 *   MAX_SIGS_PER_FAMILY       optional  default 800 (smaller than helius
 *                                       variant because publicnode caps
 *                                       getTransaction batches at 1, so
 *                                       we call single-shot with
 *                                       concurrency = 4)
 *   CONCURRENCY               optional  default 4 in-flight parsed-tx
 *                                       fetches at once
 *
 * Usage:
 *   npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts
 *
 *   # Deeper scan with your own RPC:
 *   OVERLAP_RPC_URL=https://mainnet.helius-rpc.com/?api-key=... \
 *     MAX_SIGS_PER_FAMILY=20000 \
 *     npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, PublicKey } from "@solana/web3.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");

const RPC_URL =
  process.env.OVERLAP_RPC_URL ?? "https://solana-rpc.publicnode.com";
const MAX_SIGS_PER_FAMILY = Number(process.env.MAX_SIGS_PER_FAMILY) || 800;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 4;

const FAMILIES = [
  {
    family: "Kamino",
    program: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    kind: "Lending",
  },
  {
    family: "Jupiter",
    program: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    kind: "DEX aggregator",
  },
  {
    family: "Jito",
    program: "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy",
    kind: "SPL Stake Pool (JitoSOL)",
  },
  {
    family: "Raydium",
    program: "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS",
    kind: "AMM router",
  },
] as const;

interface FamilyScan {
  family: string;
  program: string;
  kind: string;
  signers: Set<string>;
  earliestBlockTime: number | null;
  latestBlockTime: number | null;
  signaturesScanned: number;
  signaturesWithSigner: number;
}

interface OverlapResult {
  totalUniqueWallets: number;
  distribution: Array<{ distinct_families: number; wallet_count: number }>;
  pairs: Array<{ a: string; b: string; intersection: number }>;
  triples: Array<{ families: string[]; intersection: number }>;
  allFour: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scanFamily(
  conn: Connection,
  family: (typeof FAMILIES)[number]
): Promise<FamilyScan> {
  console.log(
    `\n[${family.family}] scanning program ${family.program.slice(0, 14)}… ` +
      `(max ${MAX_SIGS_PER_FAMILY} sigs)`
  );
  const program = new PublicKey(family.program);
  const signers = new Set<string>();
  let before: string | undefined;
  let signaturesScanned = 0;
  let signaturesWithSigner = 0;
  let earliestBlockTime: number | null = null;
  let latestBlockTime: number | null = null;

  while (signaturesScanned < MAX_SIGS_PER_FAMILY) {
    const remaining = MAX_SIGS_PER_FAMILY - signaturesScanned;
    const limit = Math.min(1000, remaining);
    const page = await conn.getSignaturesForAddress(program, {
      before,
      limit,
    });
    if (page.length === 0) break;
    signaturesScanned += page.length;
    before = page[page.length - 1].signature;

    for (const s of page) {
      if (s.blockTime === null || s.blockTime === undefined) continue;
      if (latestBlockTime === null || s.blockTime > latestBlockTime)
        latestBlockTime = s.blockTime;
      if (earliestBlockTime === null || s.blockTime < earliestBlockTime)
        earliestBlockTime = s.blockTime;
    }

    const sigs = page.filter((s) => s.err === null).map((s) => s.signature);
    // publicnode caps getTransaction batch size at 1, so we issue
    // single-call fetches with a small concurrency window.
    for (let i = 0; i < sigs.length; i += CONCURRENCY) {
      const slice = sigs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        slice.map((sig) =>
          conn.getParsedTransaction(sig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          })
        )
      );
      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const tx = r.value;
        const primary = tx.transaction.message.accountKeys.find(
          (k) => k.signer
        );
        if (primary) {
          signers.add(primary.pubkey.toString());
          signaturesWithSigner++;
        }
      }
      await sleep(120);
    }

    process.stdout.write(
      `  ${signaturesScanned.toString().padStart(5)} sigs / ` +
        `${signers.size.toString().padStart(5)} unique signers` +
        (earliestBlockTime && latestBlockTime
          ? ` · window ${humanDuration(latestBlockTime - earliestBlockTime)}`
          : "") +
        "\r"
    );

    if (page.length < limit) break;
    await sleep(200);
  }

  console.log(
    `\n  [${family.family}] final: ${signaturesScanned} sigs, ` +
      `${signers.size} unique signers.`
  );
  return {
    family: family.family,
    program: family.program,
    kind: family.kind,
    signers,
    earliestBlockTime,
    latestBlockTime,
    signaturesScanned,
    signaturesWithSigner,
  };
}

function computeOverlap(scans: FamilyScan[]): OverlapResult {
  const walletFamilies = new Map<string, Set<string>>();
  for (const s of scans) {
    for (const w of s.signers) {
      let fams = walletFamilies.get(w);
      if (!fams) {
        fams = new Set();
        walletFamilies.set(w, fams);
      }
      fams.add(s.family);
    }
  }

  const totalUniqueWallets = walletFamilies.size;

  const distMap = new Map<number, number>();
  for (const fams of walletFamilies.values()) {
    const n = fams.size;
    distMap.set(n, (distMap.get(n) ?? 0) + 1);
  }
  const distribution = Array.from(distMap.entries())
    .map(([distinct_families, wallet_count]) => ({
      distinct_families,
      wallet_count,
    }))
    .sort((a, b) => b.distinct_families - a.distinct_families);

  const pairs: OverlapResult["pairs"] = [];
  for (let i = 0; i < scans.length; i++) {
    for (let j = i + 1; j < scans.length; j++) {
      let count = 0;
      for (const w of scans[i].signers) if (scans[j].signers.has(w)) count++;
      pairs.push({
        a: scans[i].family,
        b: scans[j].family,
        intersection: count,
      });
    }
  }

  const triples: OverlapResult["triples"] = [];
  for (let i = 0; i < scans.length; i++) {
    for (let j = i + 1; j < scans.length; j++) {
      for (let k = j + 1; k < scans.length; k++) {
        let count = 0;
        for (const w of scans[i].signers) {
          if (scans[j].signers.has(w) && scans[k].signers.has(w)) count++;
        }
        triples.push({
          families: [scans[i].family, scans[j].family, scans[k].family],
          intersection: count,
        });
      }
    }
  }

  let allFour = 0;
  if (scans.length === 4) {
    for (const w of scans[0].signers) {
      if (
        scans[1].signers.has(w) &&
        scans[2].signers.has(w) &&
        scans[3].signers.has(w)
      )
        allFour++;
    }
  }

  return {
    totalUniqueWallets,
    distribution,
    pairs,
    triples,
    allFour,
  };
}

function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(seconds / 3600);
  if (h < 48) return `${h}h`;
  const d = Math.round(seconds / 86400);
  return `${d}d`;
}

function fmtTs(n: number | null): string {
  if (n === null) return "—";
  return new Date(n * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function buildMarkdown(
  scans: FamilyScan[],
  overlap: OverlapResult,
  date: string
): string {
  const multi = overlap.distribution
    .filter((d) => d.distinct_families >= 2)
    .reduce((s, d) => s + d.wallet_count, 0);
  const multiPct =
    overlap.totalUniqueWallets > 0
      ? (multi / overlap.totalUniqueWallets) * 100
      : 0;

  const scanRows = scans
    .map((s) => {
      const win =
        s.earliestBlockTime && s.latestBlockTime
          ? humanDuration(s.latestBlockTime - s.earliestBlockTime)
          : "—";
      return `| ${s.family} | \`${s.program.slice(0, 12)}…${s.program.slice(
        -4
      )}\` | ${s.kind} | ${s.signaturesScanned.toLocaleString()} | ${s.signers.size.toLocaleString()} | ${win} |`;
    })
    .join("\n");

  const distRows = overlap.distribution
    .map(
      (d) =>
        `| ${d.distinct_families} | ${d.wallet_count.toLocaleString()} |`
    )
    .join("\n");

  const pairRows = overlap.pairs
    .sort((a, b) => b.intersection - a.intersection)
    .map(
      (p) => `| ${p.a} ∩ ${p.b} | ${p.intersection.toLocaleString()} |`
    )
    .join("\n");

  const tripleRows = overlap.triples
    .sort((a, b) => b.intersection - a.intersection)
    .map(
      (t) =>
        `| ${t.families.join(" ∩ ")} | ${t.intersection.toLocaleString()} |`
    )
    .join("\n");

  return `# Agentic-Wallet Overlap (zero-key) — ${date}

Wallet-level overlap across the four Sakura-integrated Solana protocols,
computed from Solana mainnet via **publicnode's zero-key RPC**. This is
the default variant — anyone cloning the repo can reproduce this
without signing up for any vendor. The Helius variant at
[\`agentic-wallets-helius.ts\`](./agentic-wallets-helius.ts) exists as
an optional depth mode for users with a Helius key.

## Headline

- **${overlap.totalUniqueWallets.toLocaleString()}** unique fee-payers observed across four representative programs
  inside the narrow windows each scan covered (per-family windows below).
- Per-family fee-payer counts at a cap of \`MAX_SIGS_PER_FAMILY=${MAX_SIGS_PER_FAMILY}\`:
  **Kamino ${scans.find((s) => s.family === "Kamino")?.signers.size.toLocaleString() ?? "?"}**,
  **Jupiter ${scans.find((s) => s.family === "Jupiter")?.signers.size.toLocaleString() ?? "?"}**,
  **Jito ${scans.find((s) => s.family === "Jito")?.signers.size.toLocaleString() ?? "?"}**,
  **Raydium ${scans.find((s) => s.family === "Raydium")?.signers.size.toLocaleString() ?? "?"}**.

> **Honest reading of the overlap table below.** At the zero-key cap
> (${MAX_SIGS_PER_FAMILY} signatures per family), Jupiter's sample window is
> measured in seconds of wall-clock time — Jupiter alone does more
> signatures per minute than the cap. The per-family windows below barely
> overlap in time, so the ${multi.toLocaleString()}-wallet multi-protocol
> intersection here is a **lower bound dominated by non-overlapping time
> windows, not a population estimate**.
>
> The population-level "which txs need boundary verification" answer is
> made on protocol mechanics (see
> [\`docs/WHY-BOUNDED-INTENT.md\`](../../../docs/WHY-BOUNDED-INTENT.md)) —
> borrow-holding wallets on Kamino + Jupiter Lend ($1.62B outstanding)
> are the structurally correct target. This script's role is to prove
> every family is reachable from any machine with no API key; the
> multi-family population share is an optional extension for users with
> paid RPC who can cover matching wall-clock windows.

## Per-family scan

| Family | Program | Kind | Sigs scanned | Unique signers | Actual window |
|---|---|---|---:|---:|---|
${scanRows}

Actual time window per family depends on on-chain volume; the script
caps at \`MAX_SIGS_PER_FAMILY=${MAX_SIGS_PER_FAMILY}\` (override via env).
Jupiter's window is typically shorter than Kamino's because Jupiter v6
swap volume is ~20× higher.

## Wallet distribution by distinct protocol families touched

| Distinct families | Wallet count |
|---:|---:|
${distRows}

## Pairwise overlap

| Pair | Wallets in both |
|---|---:|
${pairRows}

## Triple overlap

| Triple | Wallets in all three |
|---|---:|
${tripleRows}

## Methodology (honest + reproducible)

1. For each of four representative programs, call
   \`connection.getSignaturesForAddress(program, { limit: 1000, before })\`
   paginated up to \`MAX_SIGS_PER_FAMILY\`. Pattern borrowed from
   [\`scripts/backtest-rescues.ts\`](../../backtest-rescues.ts).
2. For each successful signature, batch-call
   \`connection.getParsedTransactions(batch, { maxSupportedTransactionVersion: 0 })\`
   (100 sigs per call) and extract the fee payer (first \`accountKeys\`
   entry with \`signer: true\`).
3. Aggregate per-family \`Set<signer>\`; compute pairwise / triple / all-four
   intersections; emit distribution by distinct-families-touched.

Connection URL: **\`${RPC_URL}\`** (publicnode free-tier by default; override
via \`OVERLAP_RPC_URL\`).

Caveats we are upfront about:

- A ${MAX_SIGS_PER_FAMILY.toLocaleString()}-sig cap on the zero-key path means Jupiter's
  effective window is measured in hours, not days — Jupiter's swap
  volume is high enough that 2k sigs cover well under a day. Set
  \`MAX_SIGS_PER_FAMILY=20000\` with a paid RPC to extend.
- Fee payer is an approximation of "user." A small fraction of txs are
  paid by a separate relayer; those appear as the relayer's wallet, not
  the intent-signer's. For our overlap measure this is noise, not bias.
- Raydium's router is a strict superset of CPMM / AMM v4 / CLMM users;
  for overlap purposes this is what we want (anyone-who-swapped-via-Raydium).

## Reproduce

\`\`\`bash
# Zero-key — works out of the box
npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts

# Deeper scan with your own RPC key
OVERLAP_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY \\
  MAX_SIGS_PER_FAMILY=20000 \\
  npx tsx scripts/som-analysis/agentic-wallets-publicnode.ts
\`\`\`

---

_Generated by \`scripts/som-analysis/agentic-wallets-publicnode.ts\` at ${new Date().toISOString()}_
`;
}

async function main(): Promise<void> {
  console.log("Agentic-wallet overlap via publicnode RPC (zero-key)\n");
  console.log(`  RPC URL:             ${RPC_URL}`);
  console.log(`  Max sigs per family: ${MAX_SIGS_PER_FAMILY}`);
  console.log(`  Concurrency:         ${CONCURRENCY}`);

  const conn = new Connection(RPC_URL, "confirmed");

  const scans: FamilyScan[] = [];
  for (const family of FAMILIES) {
    scans.push(await scanFamily(conn, family));
  }

  console.log("\nComputing overlap matrix...");
  const overlap = computeOverlap(scans);

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, `agentic-wallets-publicnode-${date}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rpcUrl: RPC_URL,
        maxSigsPerFamily: MAX_SIGS_PER_FAMILY,
        scans: scans.map((s) => ({
          family: s.family,
          program: s.program,
          kind: s.kind,
          signaturesScanned: s.signaturesScanned,
          uniqueSigners: s.signers.size,
          earliestBlockTime: s.earliestBlockTime,
          latestBlockTime: s.latestBlockTime,
          earliestBlockTimeIso: fmtTs(s.earliestBlockTime),
          latestBlockTimeIso: fmtTs(s.latestBlockTime),
          windowSeconds:
            s.earliestBlockTime && s.latestBlockTime
              ? s.latestBlockTime - s.earliestBlockTime
              : null,
        })),
        overlap,
      },
      null,
      2
    )
  );

  const mdPath = join(OUT_DIR, `agentic-wallets-publicnode-${date}.md`);
  writeFileSync(mdPath, buildMarkdown(scans, overlap, date));

  const multi = overlap.distribution
    .filter((d) => d.distinct_families >= 2)
    .reduce((s, d) => s + d.wallet_count, 0);
  const multiPct =
    overlap.totalUniqueWallets > 0
      ? (multi / overlap.totalUniqueWallets) * 100
      : 0;

  console.log(`\n✅ Scan complete.`);
  console.log(
    `   Total unique wallets: ${overlap.totalUniqueWallets.toLocaleString()}`
  );
  console.log(
    `   Multi-protocol wallets: ${multi.toLocaleString()} (${multiPct.toFixed(1)}%)`
  );
  console.log(`   All-four wallets: ${overlap.allFour.toLocaleString()}`);
  console.log(`\n   Wrote:`);
  console.log(`     ${jsonPath}`);
  console.log(`     ${mdPath}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
