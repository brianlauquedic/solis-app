"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WalletCtx {
  walletAddress: string | null;
  shortAddr: string | null;
  phantomLoading: boolean;
  phantomAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  showLanding: boolean;
  setShowLanding: (v: boolean) => void;
}

const WalletContext = createContext<WalletCtx>({
  walletAddress: null,
  shortAddr: null,
  phantomLoading: false,
  phantomAvailable: false,
  connect: async () => {},
  disconnect: () => {},
  showLanding: false,
  setShowLanding: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [phantomLoading, setPhantomLoading] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sakura_wallet");
    if (saved) setWalletAddress(saved);
  }, []);

  useEffect(() => {
    // Check immediately, then retry at 300ms and 1500ms (slow extension load)
    const check = () => setPhantomAvailable(!!window.solana?.isPhantom);
    check();
    const t1 = setTimeout(check, 300);
    const t2 = setTimeout(check, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  async function connect() {
    if (!window.solana?.isPhantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    setPhantomLoading(true);
    try {
      const resp = await window.solana.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      localStorage.setItem("sakura_wallet", addr);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      // Only alert on non-user-rejection errors
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("cancelled")) {
        console.error("[Sakura] wallet connect error:", err);
      }
    } finally {
      setPhantomLoading(false);
    }
  }

  function disconnect() {
    setWalletAddress(null);
    localStorage.removeItem("sakura_wallet");
    window.solana?.disconnect?.();
  }

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <WalletContext.Provider value={{ walletAddress, shortAddr, phantomLoading, phantomAvailable, connect, disconnect, showLanding, setShowLanding }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
