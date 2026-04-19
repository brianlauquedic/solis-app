// TEMP diagnostic endpoint — verifies ZK artifacts are bundled in lambda.
// Mirrors outputFileTracingIncludes for /api/insurance/claim-with-repay
// and /api/liquidation-shield/rescue. Remove after verification.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Force the bundler to trace these files into THIS function too.
const _bundleHints = [
  "public/zk/liquidation_proof.wasm",
  "public/zk/liquidation_proof.zkey",
  "public/zk/verification_key.json",
];

export async function GET() {
  const results: Array<{ file: string; exists: boolean; size?: number; error?: string }> = [];
  for (const rel of _bundleHints) {
    const full = path.join(process.cwd(), rel);
    try {
      const stat = await fs.stat(full);
      results.push({ file: rel, exists: true, size: stat.size });
    } catch (e) {
      results.push({ file: rel, exists: false, error: String(e) });
    }
  }
  return NextResponse.json({ cwd: process.cwd(), results });
}
