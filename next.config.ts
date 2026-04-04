import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize heavy server-side Solana packages that use Node.js-only APIs
  // (jito-ts, @drift-labs/sdk, @solana-developers/helpers use rpc-websockets/node-fetch)
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
  ],
};

export default nextConfig;
