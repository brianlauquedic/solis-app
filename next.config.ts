import type { NextConfig } from "next";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

const nextConfig: NextConfig = {
  // Externalize heavy server-side Solana packages that use Node.js-only APIs
  serverExternalPackages: [
    "jito-ts",
    "@drift-labs/sdk",
    "@drift-labs/vaults-sdk",
    "@solana-developers/helpers",
    "@mercurial-finance/dynamic-amm-sdk",
    "@meteora-ag/dlmm",
    "@voltr/vault-sdk",
    "flash-sdk",
    "@cks-systems/manifest-sdk",
    "snarkjs",
  ],

  // Ensure Vercel's function bundler (nft tracer) includes the ZK prover
  // artifacts for any route that generates Groth16 proofs server-side.
  // Without this, /public/zk/*.wasm and *.zkey are served as static assets
  // but NOT copied into the function bundle, so `fs.readFile("public/zk/...")`
  // crashes at runtime with ENOENT.
  outputFileTracingIncludes: {
    "/api/insurance/claim-with-repay": ["public/zk/**/*"],
    "/api/_zk-diag": ["public/zk/**/*"],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            // Vercel preview deployments use *.vercel.app; production uses NEXT_PUBLIC_APP_URL
            value: ALLOWED_ORIGINS[0] ?? "https://*.vercel.app",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, X-Wallet-Address, X-Device-ID, X-Payment, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
