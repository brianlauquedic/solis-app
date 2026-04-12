"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { SolanaWalletProvider } from "@/types/phantom";

export type WalletProviderType = "phantom" | "okx" | null;

interface WalletCtx {
  walletAddress: string | null;
  shortAddr: string | null;
  walletLoading: boolean;
  phantomAvailable: boolean;
  okxAvailable: boolean;
  activeProvider: WalletProviderType;
  connect: (preferredProvider?: WalletProviderType) => Promise<void>;
  disconnect: () => void;
  showLanding: boolean;
  setShowLanding: (v: boolean) => void;
  isDemo: boolean;
  setIsDemo: (v: boolean) => void;
  /** Returns the active Solana provider (Phantom or OKX) */
  getProvider: () => SolanaWalletProvider | null;
}

const WalletContext = createContext<WalletCtx>({
  walletAddress: null,
  shortAddr: null,
  walletLoading: false,
  phantomAvailable: false,
  okxAvailable: false,
  activeProvider: null,
  connect: async () => {},
  disconnect: () => {},
  showLanding: false,
  setShowLanding: () => {},
  isDemo: false,
  setIsDemo: () => {},
  getProvider: () => null,
});

/** Pick the best available provider. Phantom preferred, OKX as fallback. */
function detectProvider(): { provider: SolanaWalletProvider | null; type: WalletProviderType } {
  if (typeof window === "undefined") return { provider: null, type: null };
  if (window.solana?.isPhantom) return { provider: window.solana, type: "phantom" };
  if (window.okxwallet?.solana) return { provider: window.okxwallet.solana, type: "okx" };
  return { provider: null, type: null };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Read wallet from localStorage synchronously on first render to avoid
  // a null→value transition that causes a stale quota fetch without wallet header.
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sakura_wallet");
  });
  const [walletLoading, setWalletLoading] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [okxAvailable, setOkxAvailable] = useState(false);
  const [activeProvider, setActiveProvider] = useState<WalletProviderType>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem("sakura_wallet_provider") as WalletProviderType) ?? null;
  });
  const [showLanding, setShowLanding] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Check immediately, then retry at 300ms and 1500ms (slow extension load)
    const check = () => {
      setPhantomAvailable(!!window.solana?.isPhantom);
      setOkxAvailable(!!window.okxwallet?.solana);
    };
    check();
    const t1 = setTimeout(check, 300);
    const t2 = setTimeout(check, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function getProvider(): SolanaWalletProvider | null {
    if (typeof window === "undefined") return null;
    // Use saved preference first, then auto-detect
    if (activeProvider === "phantom" && window.solana?.isPhantom) return window.solana;
    if (activeProvider === "okx" && window.okxwallet?.solana) return window.okxwallet.solana;
    // Fallback: auto-detect
    return detectProvider().provider;
  }

  async function connect(preferredProvider?: WalletProviderType) {
    // Determine which provider to use
    let provider: SolanaWalletProvider | null = null;
    let providerType: WalletProviderType = null;

    if (preferredProvider === "phantom") {
      if (window.solana?.isPhantom) {
        provider = window.solana;
        providerType = "phantom";
      } else {
        window.open("https://phantom.app/", "_blank");
        return;
      }
    } else if (preferredProvider === "okx") {
      if (window.okxwallet?.solana) {
        provider = window.okxwallet.solana;
        providerType = "okx";
      } else {
        window.open("https://www.okx.com/web3", "_blank");
        return;
      }
    } else {
      // Auto-detect: Phantom preferred, OKX fallback
      const detected = detectProvider();
      if (!detected.provider) {
        // Neither available — open Phantom install page
        window.open("https://phantom.app/", "_blank");
        return;
      }
      provider = detected.provider;
      providerType = detected.type;
    }

    setWalletLoading(true);
    try {
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      setActiveProvider(providerType);
      localStorage.setItem("sakura_wallet", addr);
      localStorage.setItem("sakura_wallet_provider", providerType ?? "");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      // Only log non-user-rejection errors
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("cancelled")) {
        console.error("[Sakura] wallet connect error:", err);
      }
    } finally {
      setWalletLoading(false);
    }
  }

  function disconnect() {
    const provider = getProvider();
    setWalletAddress(null);
    setActiveProvider(null);
    localStorage.removeItem("sakura_wallet");
    localStorage.removeItem("sakura_wallet_provider");
    provider?.disconnect?.();
  }

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  // Keep backward compat: phantomLoading alias
  return (
    <WalletContext.Provider value={{
      walletAddress,
      shortAddr,
      walletLoading,
      phantomAvailable,
      okxAvailable,
      activeProvider,
      connect,
      disconnect,
      showLanding,
      setShowLanding,
      isDemo,
      setIsDemo,
      getProvider,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
