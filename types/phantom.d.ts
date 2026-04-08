// Global wallet type declarations (Phantom + OKX)
export interface SolanaWalletProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (
    transaction: unknown,
    options?: { skipPreflight?: boolean }
  ) => Promise<{ signature: string }>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
    okxwallet?: {
      solana?: SolanaWalletProvider;
    };
  }
}

export {};
