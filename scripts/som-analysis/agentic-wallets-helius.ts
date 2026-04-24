/**
 * scripts/som-analysis/agentic-wallets-helius.ts
 *
 * Wallet-level overlap analysis via Helius RPC direct indexing.
 *
 * This is the primary path for Dovey Wan's "which txs most need boundary
 * verification" question after Dune free-tier hit its 2-min query cap
 * on every Solana wallet-level analysis we tried (documented in
 * scripts/som-analysis/README.md).
 *
 * Flow:
 *   1. For each of 4 protocol families, enumerate recent tx signatures
 *      via getSignaturesForAddress (paginated, 1000 per page).
 *   2. Batch-fetch parsed transactions via getParsedTransactions (100 per
 *      call) to extract the fee-paying signer of each tx.
 *   3. Aggregate per-family Set<signer> + compute cross-family overlap.
 *   4. Write JSON + Markdown snapshot to output/.
 *
 * Representative-program choice:
 *   One program per family is scanned (Kamino Lend, Jupiter v6 Swap,
 *   Jito SPL Stake Pool, Raydium Router). For Raydium the router is a
 *   strict superset — sub-program callers (CPMM / AMM v4 / CLMM) all
 *   flow through it. For Jupiter the v6 aggregator covers 90%+ of
 *   Jupiter volume; Jupiter Lend users are a small subset that would
 *   nudge the overlap marginally upward if included.
 *
 * Env:
 *   HELIUS_API_KEY            required  (source .env.local first)
 *   MAX_SIGS_PER_FAMILY       optional  default 5000
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/som-analysis/agentic-wallets-helius.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, PublicKey } from "@solana/web3.js";
import { getConnection } from "../../lib/rpc";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");

const MAX_SIGS_PER_FAMILY = Number(process.env.MAX_SIGS_PER_FAMILY) || 5000;

// Primary program per family. Each ID is the same one listed in the
// README Integration Coverage Proof table and in
// scripts/som-analysis/queries/agentic-wallet-candidates.sql.
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
  signers: Set<string>; // in-memory only; not serialized
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

    // Batch fetch parsed txs for successful signatures to extract signer.
    // getParsedTransactions takes up to 100 sigs per call.
    const sigs = page.filter((s) => s.err === null).map((s) => s.signature);
    for (let i = 0; i < sigs.length; i += 100) {
      const batch = sigs.slice(i, i + 100);
      const txs = await conn.getParsedTransactions(batch, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      for (const tx of txs) {
        if (!tx) continue;
        // Fee payer = first accountKey marked signer. Works for both
        // legacy and v0 messages via jsonParsed encoding.
        const primary = tx.transaction.message.accountKeys.find(
          (k) => k.signer
        );
        if (primary) {
          signers.add(primary.pubkey.toString());
          signaturesWithSigner++;
        }
      }
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
    await sleep(100); // polite spacing between pages
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
  // For each wallet, accumulate the set of families it appears in.
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

  return `# Agentic-Wallet Overlap — ${date}

Wallet-level overlap across the four Sakura-integrated Solana protocols,
computed directly from Solana mainnet via Helius RPC. Sibling to
[\`day1-som.ts\`](../day1-som.ts) (stock) and
[\`activity-pattern.ts\`](../activity-pattern.ts) (flow); this script
provides the wallet dimension.

## Headline

- **${overlap.totalUniqueWallets.toLocaleString()}** unique wallets sampled across the four representative programs.
- **${multi.toLocaleString()}** wallets (${multiPct.toFixed(1)}%) touched ≥ 2 protocol families — the population for whom bounded-intent ZK is value-creating.
- **${overlap.allFour.toLocaleString()}** wallets touched all four families.

> The multi-protocol share is the concrete answer to Dovey's "which
> transactions most need boundary verification" — single-protocol users
> can be served by a simple spending cap; multi-protocol users, who
> traverse lend + swap + stake in one signed mandate, are where an
> agent with a session key can do asymmetric damage.

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

Connection acquisition is via [\`lib/rpc.ts\`](../../../lib/rpc.ts)'s
\`getConnection()\` with automatic Helius → backup → public failover.

Caveats we are upfront about:

- A 5,000-sig cap means Jupiter's effective window is measured in hours,
  not days. The signer Set still captures "recent Jupiter active users,"
  but is not a 7-day complete census. Paid RPC tiers (or a weekend-long
  full scan on free tier) can extend this.
- Fee payer is an approximation of "user." A small fraction of txs are
  paid by a separate relayer; those appear as the relayer's wallet, not
  the intent-signer's. For our overlap measure this is noise, not bias.
- Raydium's router is a strict superset of CPMM / AMM v4 / CLMM users;
  for overlap purposes this is what we want (we want anyone-who-swapped-via-Raydium).

## Reproduce

\`\`\`bash
# Prereq: HELIUS_API_KEY in .env.local
# Free tier at https://helius.dev — 50k credits/day, plenty for this run.

set -a && source .env.local && set +a
npx tsx scripts/som-analysis/agentic-wallets-helius.ts

# Optional: scan deeper
MAX_SIGS_PER_FAMILY=20000 npx tsx scripts/som-analysis/agentic-wallets-helius.ts
\`\`\`

---

_Generated by \`scripts/som-analysis/agentic-wallets-helius.ts\` at ${new Date().toISOString()}_
`;
}

async function main(): Promise<void> {
  if (!process.env.HELIUS_API_KEY) {
    console.error(
      "❌ HELIUS_API_KEY required. Sign up free at https://helius.dev (no credit card),\n" +
        "   then add to .env.local and re-run: set -a && source .env.local && set +a"
    );
    process.exit(1);
  }

  console.log("Agentic-wallet overlap via Helius RPC\n");
  console.log(`  Max sigs per family: ${MAX_SIGS_PER_FAMILY}`);
  console.log(`  Connection: lib/rpc.ts getConnection (Helius → backup → public)`);

  const conn = await getConnection("confirmed");

  const scans: FamilyScan[] = [];
  for (const family of FAMILIES) {
    scans.push(await scanFamily(conn, family));
  }

  console.log("\nComputing overlap matrix...");
  const overlap = computeOverlap(scans);

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, `agentic-wallets-helius-${date}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
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

  const mdPath = join(OUT_DIR, `agentic-wallets-helius-${date}.md`);
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
