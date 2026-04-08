"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { addToWatchlist, getWatchlist, removeFromWatchlist, saveLastPrice, WatchedToken } from "@/lib/watchlist";
import { saveProof } from "@/lib/proof-store";
import { payWithPhantom } from "@/lib/x402";
import { useLang } from "@/contexts/LanguageContext";
import { TranslationKey } from "@/lib/i18n";
import { getDeviceId } from "@/lib/device-id";

// ── Types ────────────────────────────────────────────────────────
interface Decision {
  verdict: "buy" | "caution" | "avoid";
  label: string;
  reason: string;
  suggestion: string;
}

interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  logoURI: string | null;
  price: number | null;
  securityScore: number;
  risks: string[];
  positives: string[];
  holderCount: number | null;
  top10HolderPct: string | null;
  mintable: boolean;
  freezable: boolean;
  isHoneypot: boolean;
  decision: Decision;
  walletRiskyPct: number;
  walletTotalUSD?: number;
}

interface SimulationResult {
  canSell: boolean;
  isHoneypot: boolean;
  priceImpactPct: number | null;
  reason: string;
}

interface AIAnalysis {
  reasoning: string;
  decision: string;
  aiAvailable: boolean;
  timestamp: number;
  reasoningHash: string;
  memoPayload: string;
  simulation?: SimulationResult;
  proofData: {
    mint: string;
    securityScore: number;
    decision: string;
    timestamp: number;
    hashAlgo: string;
  };
}

interface Props {
  walletAddress: string;
  isDayMode?: boolean;
}

// ── Hot tokens for quick analysis ────────────────────────────────
const HOT_TOKENS = [
  { label: "JUP",  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",   tag: "DeFi",   tagColor: "#06B6D4" },
  { label: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",   tag: "Meme",   tagColor: "#F59E0B" },
  { label: "WIF",  mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",   tag: "Meme",   tagColor: "#F59E0B" },
  { label: "PYTH", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",   tag: "Oracle", tagColor: "#8B5CF6" },
  { label: "RAY",  mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",   tag: "DeFi",   tagColor: "#06B6D4" },
  { label: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",   tag: "Stable", tagColor: "#10B981" },
  { label: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",   tag: "Staked", tagColor: "#8B5CF6" },
  { label: "POPCAT", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", tag: "Meme",   tagColor: "#F59E0B" },
];

// ── Verdict config ───────────────────────────────────────────────
const VC = {
  buy:     { color: "#10B981", bg: "rgba(61,122,92,0.12)",    border: "#10B981", icon: "✅", glow: "#10B98140" },
  caution: { color: "#F59E0B", bg: "rgba(184,131,42,0.12)",  border: "#F59E0B", icon: "⚠️", glow: "#F59E0B40" },
  avoid:   { color: "#EF4444", bg: "rgba(168,41,58,0.12)",   border: "#EF4444", icon: "🚨", glow: "#EF444440" },
};

// ── Score Arc ────────────────────────────────────────────────────
function ScoreArc({ score }: { score: number }) {
  const { t } = useLang();
  const color = score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  const label = score >= 70 ? t("healthy") : score >= 45 ? t("risk") : t("highRisk");
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        border: `5px solid ${color}`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: `var(--bg-base)`, boxShadow: `0 0 20px ${color}40`,
        margin: "0 auto 8px",
      }}>
        <span style={{ fontSize: 30, fontWeight: 900, color }}>{score}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>/ 100</span>
      </div>
      <span style={{
        fontSize: 11, color, background: `${color}20`,
        border: `1px solid ${color}40`, borderRadius: 20, padding: "2px 10px",
      }}>{label}</span>
    </div>
  );
}

// ── On-chain Proof Panel ─────────────────────────────────────────
// ── On-chain Memo writer ─────────────────────────────────────────
// Tries server-side platform keypair first; falls back to Phantom.
type MemoStatus = "idle" | "paying" | "sending" | "success" | "error" | "no_wallet";

// Fee wallet for proof writing ($0.1 USDC per write)
const PROOF_WRITE_FEE_WALLET = "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

async function writeMemoOnChain(memoText: string): Promise<{ sig: string } | { error: string }> {
  // 1. Try server-side platform keypair (no Phantom popup)
  try {
    const res = await fetch("/api/agent/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoPayload: memoText }),
    });
    const data = await res.json();
    if (res.ok && data.txSignature) return { sig: data.txSignature };
    if (data.error !== "no_platform_key") {
      return { error: data.error ?? "server error" };
    }
  } catch {
    // network error — fall through to Phantom
  }

  // 2. Fallback: Phantom client-side signing
  if (!window.solana?.isPhantom) return { error: "no_wallet" };

  const { Connection, Transaction, TransactionInstruction, PublicKey } = await import("@solana/web3.js");

  const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  const connection = new Connection(
    "/api/rpc",
    "confirmed"
  );

  try {
    await window.solana.connect({ onlyIfTrusted: true });
    const pubkey = window.solana.publicKey;
    if (!pubkey) return { error: "walletNotConnected" };

    const senderPubkey = new PublicKey(pubkey.toString());
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubkey,
    }).add(
      new TransactionInstruction({
        keys: [{ pubkey: senderPubkey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoText, "utf-8"),
      })
    );

    const { signature } = await window.solana.signAndSendTransaction(tx);
    return { sig: signature };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "txRejected";
    return { error: msg };
  }
}

function ProofPanel({ ai }: { ai: AIAnalysis }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [memoStatus, setMemoStatus] = useState<MemoStatus>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string>("");
  const date = new Date(ai.timestamp).toLocaleString();

  function copyMemo() {
    navigator.clipboard.writeText(ai.memoPayload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleWriteOnChain() {
    setMemoStatus("paying");
    setMemoError("");

    // $0.1 USDC payment gate for on-chain proof writing
    const payResult = await payWithPhantom({
      recipient: PROOF_WRITE_FEE_WALLET,
      amount: 0.10,
      currency: "USDC",
      network: "solana-mainnet",
      description: "Sakura 链上证明写入 0.10 USDC",
    });
    if ("error" in payResult) {
      if (payResult.error === "no_wallet") {
        setMemoStatus("no_wallet");
      } else {
        setMemoStatus("error");
        setMemoError(payResult.error);
      }
      return;
    }

    setMemoStatus("sending");
    const result = await writeMemoOnChain(ai.memoPayload);
    if ("sig" in result) {
      setTxSig(result.sig);
      setMemoStatus("success");
    } else {
      if (result.error === "no_wallet") setMemoStatus("no_wallet");
      else { setMemoStatus("error"); setMemoError(result.error); }
    }
  }

  return (
    <div style={{
      background: `var(--bg-base)`,
      border: "1px solid var(--border)",
      borderRadius: 16, padding: 20, marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, background: "var(--bg-card-2)", color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 4, padding: "2px 8px", fontWeight: 700, letterSpacing: 1,
          }}>ON-CHAIN PROOF</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {ai.aiAvailable ? "⚙️ Claude AI" : "⚙️ Rule Engine"} · {date}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/verify" target="_blank" rel="noopener noreferrer" style={{
            fontSize: 11, color: "#60A5FA", textDecoration: "none",
            background: "#1E3A5F20", border: "1px solid var(--border)",
            borderRadius: 6, padding: "2px 8px",
          }}>{t("verifyProof")} →</a>
          <button onClick={() => setExpanded(v => !v)} style={{
            background: "none", border: "none", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
          }}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* simulateTransaction result */}
      {ai.simulation && (
        <div style={{
          background: ai.simulation.isHoneypot ? "#EF444415" : "#10B98115",
          border: `1px solid ${ai.simulation.isHoneypot ? "#EF444430" : "#10B98130"}`,
          borderRadius: 10, padding: "8px 14px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>{ai.simulation.isHoneypot ? "🚨" : "✅"}</span>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: ai.simulation.isHoneypot ? "#EF4444" : "#10B981",
            }}>
              {ai.simulation.isHoneypot ? t("simulationFailed") : t("simulationPassed")}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 8 }}>
              {ai.simulation.reason}
              {ai.simulation.priceImpactPct !== null && ` ${t("sellImpact", { pct: ai.simulation.priceImpactPct.toFixed(2) })}`}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>simulateTx</span>
        </div>
      )}

      {/* Hash display */}
      <div style={{
        background: `var(--bg-base)`, borderRadius: 10, padding: "10px 14px",
        marginBottom: 12, display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>SHA-256</span>
        <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: "#60A5FA", wordBreak: "break-all" }}>
          {ai.reasoningHash}
        </span>
      </div>

      {/* Memo row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: `var(--bg-base)`, borderRadius: 10, padding: "10px 14px",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Memo</span>
        <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>
          {ai.memoPayload}
        </span>
        <button onClick={copyMemo} style={{
          background: copied ? "rgba(61,122,92,0.12)" : "var(--bg-card-2)",
          border: `1px solid ${copied ? "rgba(61,122,92,0.4)" : "var(--border)"}`,
          borderRadius: 6, padding: "4px 10px",
          fontSize: 11, color: copied ? "#10B981" : "#60A5FA",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          {copied ? t("copied") : "🌿"}
        </button>
      </div>

      {/* ── Write to chain button ── */}
      {memoStatus === "success" && txSig ? (
        <div style={{
          background: "#10B98115", border: "1px solid #10B98140",
          borderRadius: 10, padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          marginBottom: expanded ? 12 : 0,
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#10B981", fontWeight: 700, marginBottom: 4 }}>
              ✅ {t("writtenOnchain")}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>
              {txSig.slice(0, 20)}...{txSig.slice(-8)}
            </div>
          </div>
          <a
            href={`https://solscan.io/tx/${txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11, color: "var(--text-secondary)", textDecoration: "none",
              background: "var(--bg-card-2)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "6px 12px", whiteSpace: "nowrap",
            }}
          >
            {t("solscanView")} →
          </a>
        </div>
      ) : (
        <div style={{ marginBottom: expanded ? 12 : 0 }}>
          <button
            onClick={handleWriteOnChain}
            disabled={memoStatus === "paying" || memoStatus === "sending"}
            style={{
              width: "100%", padding: "11px",
              background: (memoStatus === "paying" || memoStatus === "sending")
                ? `var(--bg-card)`
                : "var(--accent)",
              border: "1px solid var(--border)",
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              color: (memoStatus === "paying" || memoStatus === "sending") ? "var(--text-secondary)" : "#60A5FA",
              cursor: (memoStatus === "paying" || memoStatus === "sending") ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {memoStatus === "paying" ? (
              <>{t("payingUSDC")}</>
            ) : memoStatus === "sending" ? (
              <>🌿 {t("writingOnchain")}</>
            ) : (
              <>⛩️ {t("writeOnchain")} · 0.10 USDC</>
            )}
          </button>
          {memoStatus === "no_wallet" && (
            <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 6, textAlign: "center" }}>
              ⚠️ {t("noPhantom")}
            </div>
          )}
          {memoStatus === "error" && (
            <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6, textAlign: "center" }}>
              ❌ {memoError}
            </div>
          )}
        </div>
      )}

      {/* Expanded proof data */}
      {expanded && (
        <div style={{
          background: `var(--bg-base)`, borderRadius: 10, padding: "12px 14px",
          fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", lineHeight: 1.8,
        }}>
          <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>// {t("aiReasoningHash")}</div>
          <div><span style={{ color: "#8B5CF6" }}>mint</span>: {ai.proofData.mint}</div>
          <div><span style={{ color: "#8B5CF6" }}>securityScore</span>: {ai.proofData.securityScore}</div>
          <div><span style={{ color: "#8B5CF6" }}>decision</span>: &quot;{ai.proofData.decision}&quot;</div>
          <div><span style={{ color: "#8B5CF6" }}>timestamp</span>: {ai.proofData.timestamp}</div>
          <div><span style={{ color: "#8B5CF6" }}>hashAlgo</span>: &quot;{ai.proofData.hashAlgo}&quot;</div>
          <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 10 }}>
            // {t("onchainMemoNote")}
          </div>
        </div>
      )}
    </div>
  );
}

// ── API string localisation helpers ─────────────────────────────
function localizeCheckText(text: string, t: (key: TranslationKey) => string): string {
  const checkMap: Record<string, string> = {
    "无增发权限，供应量固定": t("checkNoMint"),
    "無增發權限，供應量固定": t("checkNoMint"),
    "无冻结权限": t("checkNoFreeze"),
    "無凍結權限": t("checkNoFreeze"),
    "创建者持仓比例低": t("checkLowDev"),
    "創建者持倉比例低": t("checkLowDev"),
  };
  return checkMap[text] ?? text;
}

function localizeVerdict(verdict: string, t: (key: TranslationKey) => string): string {
  const verdictMap: Record<string, string> = {
    "可以買入": t("verdictBuy"),
    "可以考虑": t("verdictConsider"),
    "可以考慮": t("verdictConsider"),
    "謹慎考慮": t("verdictCaution"),
    "谨慎考虑": t("verdictCaution"),
    "建議迴避": t("verdictAvoid"),
    "建议回避": t("verdictAvoid"),
  };
  return verdictMap[verdict] ?? verdict;
}

// ── Main Component ───────────────────────────────────────────────
export default function TokenAnalysis({ walletAddress, isDayMode = false }: Props) {
  const { t, lang } = useLang();
  const [mintInput, setMintInput] = useState("");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [aiData, setAiData] = useState<AIAnalysis | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");
  const [watchlist, setWatchlist] = useState<WatchedToken[]>([]);
  const [premiumData, setPremiumData] = useState<{ aiDeepAnalysis: string; analysisHash: string; memoPayload: string; demoMode: boolean } | null>(null);
  const [premiumStatus, setPremiumStatus] = useState<"idle" | "paying" | "loading" | "done" | "error">("idle");
  const [premiumError, setPremiumError] = useState("");
  const [analyzeQuota, setAnalyzeQuota] = useState<{ remaining: number; used: number } | null>(null);
  const [analyzePaymentSig, setAnalyzePaymentSig] = useState<string | null>(null);

  useEffect(() => {
    setWatchlist(getWatchlist());
    // Back-fill null prices using DexScreener for cached entries
    const list = getWatchlist();
    const nullPriceTokens = list.filter(t => t.price === null);
    for (const token of nullPriceTokens) {
      fetch(`https://api.jup.ag/price/v2?ids=${token.mint}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: { data?: Record<string, { price?: string }> } | null) => {
          const p = d?.data?.[token.mint]?.price;
          if (p) { saveLastPrice(token.mint, parseFloat(p)); setWatchlist(getWatchlist()); return; }
          // fallback DexScreener
          return fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`)
            .then(r => r.ok ? r.json() : null)
            .then((ds: { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> } | null) => {
              const pairs = (ds?.pairs ?? [])
                .filter(pair => pair.priceUsd && parseFloat(pair.priceUsd) > 0)
                .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
              const best = pairs[0]?.priceUsd;
              if (best) { saveLastPrice(token.mint, parseFloat(best)); setWatchlist(getWatchlist()); }
            });
        })
        .catch(() => {});
    }
  }, []);

  // Fetch quota status on mount
  useEffect(() => {
    const deviceId = getDeviceId();
    fetch(`/api/quota?features=analyze`, {
      headers: {
        "X-Device-ID": deviceId,
        "X-Wallet-Address": walletAddress ?? "",
      },
    })
      .then(r => r.json())
      .then(d => { if (d.analyze) setAnalyzeQuota(d.analyze); })
      .catch(() => {});
  }, [walletAddress]);

  function isValidMint(addr: string) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
  }

  async function handleAnalyze() {
    const mint = mintInput.trim();
    if (!walletAddress) { setError("請先連接錢包才能使用安全分析功能"); return; }
    if (!mint) { setError(t("enterAddressError")); return; }
    if (!isValidMint(mint)) { setError(t("invalidAddress")); return; }

    setError("");
    setTokenData(null);
    setAiData(null);
    setPremiumData(null);
    setPremiumStatus("idle");
    setPremiumError("");

    // ── Step 1: Fetch on-chain data ──────────────────────────────
    setLoadingToken(true);
    let td: TokenData;
    try {
      const res = await fetch(`/api/token?mint=${mint}&wallet=${walletAddress}&lang=${lang}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      td = json;
      setTokenData(td);
      // Auto-save to watchlist
      addToWatchlist({
        mint: td.mint, symbol: td.symbol, name: td.name,
        logoURI: td.logoURI, securityScore: td.securityScore,
        verdict: td.decision.verdict, price: td.price,
        checkedAt: Date.now(),
      });
      setWatchlist(getWatchlist());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("scanning"));
      setLoadingToken(false);
      return;
    } finally {
      setLoadingToken(false);
    }

    // ── Step 2: Fetch AI analysis (non-blocking) ─────────────────
    setLoadingAI(true);
    try {
      const deviceId = getDeviceId();
      const analyzeBody = JSON.stringify({
        mint: td.mint, symbol: td.symbol, name: td.name,
        price: td.price, securityScore: td.securityScore,
        risks: td.risks, positives: td.positives,
        holderCount: td.holderCount, top10HolderPct: td.top10HolderPct,
        mintable: td.mintable, freezable: td.freezable,
        isHoneypot: td.isHoneypot, walletRiskyPct: td.walletRiskyPct,
        walletTotalUSD: td.walletTotalUSD ?? 0,
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Device-ID": deviceId,
        "X-Wallet-Address": walletAddress ?? "",
      };
      if (analyzePaymentSig) headers["X-PAYMENT"] = analyzePaymentSig;

      let res = await fetch("/api/analyze", { method: "POST", headers, body: analyzeBody });

      // 402: subscription exhausted (Basic/Pro with tier field) OR x402 per-use payment
      if (res.status === 402 && !analyzePaymentSig) {
        const challenge = await res.json();
        if (challenge.tier) {
          // Basic/Pro subscription credits exhausted → show upgrade prompt, do NOT pay
          setError(challenge.message || t("agentFreeExhausted"));
          setAnalyzeQuota(q => q ? { ...q, remaining: 0 } : null);
          setLoadingToken(false);
          return;
        }
        // Free tier quota hit OR no credits → trigger $0.10 USDC per-use payment
        if (challenge.recipient) {
          if (challenge.recipient === "not-configured") {
            setError("支付功能尚未配置，請聯繫管理員");
            return;
          }
          const payResult = await payWithPhantom({
            recipient: challenge.recipient,
            amount: challenge.amount,
            currency: "USDC",
            network: "solana-mainnet",
            description: "Sakura 安全分析 0.10 USDC",
          });
          if ("error" in payResult) {
            setError(payResult.error === "user_rejected" || payResult.error.includes("rejected")
              ? "已取消支付"
              : `支付失敗: ${payResult.error}`);
            return;
          }
          setAnalyzePaymentSig(payResult.sig);
          res = await fetch("/api/analyze", {
            method: "POST",
            headers: { ...headers, "X-PAYMENT": payResult.sig },
            body: analyzeBody,
          });
        }
      }

      // Update local quota display (only on successful non-payment use)
      if (!analyzePaymentSig) {
        setAnalyzeQuota(q => q ? { ...q, remaining: Math.max(0, (q.remaining ?? 1) - 1), used: (q.used ?? 0) + 1 } : null);
      }

      const json = await res.json();
      if (!json.error) {
        setAiData(json);
        // Persist proof to localStorage for /verify page
        saveProof({
          hash: json.reasoningHash,
          memoPayload: json.memoPayload,
          mint: td.mint,
          symbol: td.symbol,
          securityScore: td.securityScore,
          decision: json.decision,
          reasoning: json.reasoning,
          timestamp: json.timestamp,
          aiAvailable: json.aiAvailable,
        });
      }
    } catch { /* AI is optional */ } finally {
      setLoadingAI(false);
    }
  }

  async function unlockPremium() {
    if (!tokenData) return;
    setPremiumStatus("paying");
    setPremiumError("");

    const mint = tokenData.mint;

    // Step 1: Hit the premium endpoint to get the 402 challenge
    const challengeRes = await fetch(`/api/token/premium?mint=${mint}`);
    if (challengeRes.status !== 402 && !challengeRes.ok) {
      setPremiumStatus("error");
      setPremiumError(t("scanning"));
      return;
    }

    let paymentSig = "demo-mode";

    if (challengeRes.status === 402) {
      const challenge = await challengeRes.json();

      // Demo mode: server has no fee wallet configured → skip payment
      if (challenge.recipient === "demo-mode") {
        paymentSig = "demo-mode";
      } else {
        // Real payment: call Phantom
        const payResult = await payWithPhantom(challenge);
        if ("error" in payResult) {
          if (payResult.error === "no_wallet") {
            // Demo fallback: show without real payment
            paymentSig = "demo-mode";
          } else {
            setPremiumStatus("error");
            setPremiumError(payResult.error);
            return;
          }
        } else {
          paymentSig = payResult.sig;
        }
      }
    }

    // Step 2: Fetch premium analysis with payment proof
    setPremiumStatus("loading");
    try {
      const res = await fetch(`/api/token/premium?mint=${mint}`, {
        headers: { "X-PAYMENT": paymentSig },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPremiumData(data);
      setPremiumStatus("done");
    } catch (e: unknown) {
      setPremiumStatus("error");
      setPremiumError(e instanceof Error ? e.message : t("analyzing"));
    }
  }

  const vc = tokenData ? VC[tokenData.decision.verdict] : null;

  return (
    <div className="token-grid" style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }}>

    {/* ── Left: main analysis ── */}
    <div>
      {/* ── Input Card ── */}
      <div style={{
        background: `var(--bg-card)`, border: "1px solid var(--border)",
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {t("tokenSecurityAnalysis")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
          {t("tokenAnalysisSubtitle")}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            value={mintInput}
            onChange={e => { setMintInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
            placeholder={t("tokenAddressPlaceholder")}
            style={{
              flex: 1, padding: "12px 16px",
              background: `var(--bg-base)`,
              border: `1px solid ${error ? "#EF4444" : `var(--border)`}`,
              borderRadius: 10, fontSize: 13, color: "var(--text-primary)",
              outline: "none", fontFamily: "monospace",
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loadingToken}
            style={{
              padding: "12px 24px",
              background: loadingToken
                ? `var(--border)`
                : "var(--accent)",
              border: "none", borderRadius: 10, fontSize: 14,
              fontWeight: 700, color: "#fff",
              cursor: loadingToken ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loadingToken ? t("analyzing") : t("analyzeBtn")}
          </button>
        </div>

        {/* Quota badge */}
        {analyzeQuota && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            {analyzeQuota.remaining > 0 ? (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: analyzeQuota.remaining >= 2 ? "#10B981" : "#F59E0B",
                background: analyzeQuota.remaining >= 2 ? "#10B98115" : "#F59E0B15",
                border: `1px solid ${analyzeQuota.remaining >= 2 ? "#10B98130" : "#F59E0B30"}`,
                borderRadius: 6, padding: "2px 8px",
              }}>
                {t("agentFreeRemaining", { n: analyzeQuota.remaining })}
              </span>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#8B5CF6",
                background: "#8B5CF615", border: "1px solid #8B5CF630",
                borderRadius: 6, padding: "2px 8px",
              }}>
                {t("agentFreeExhausted")}
              </span>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#EF4444", marginTop: 10 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Hot tokens grid */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>{t("hotTokens")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {HOT_TOKENS.map(({ label, mint, tag, tagColor }) => (
              <button key={mint}
                onClick={() => { setMintInput(mint); setError(""); }}
                style={{
                  background: `var(--bg-base)`, border: "1px solid var(--border)",
                  borderRadius: 8, padding: "6px 12px", fontSize: 12,
                  color: "var(--text-primary)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>{label}</span>
                <span style={{
                  fontSize: 9, color: tagColor,
                  background: `${tagColor}20`,
                  borderRadius: 4, padding: "1px 5px",
                }}>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loadingToken && (
        <div style={{
          background: `var(--bg-card)`, border: "1px solid var(--border)",
          borderRadius: 16, padding: "48px 0", textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔬</div>
          <div style={{ fontSize: 16, color: "#8B5CF6", marginBottom: 6 }}>
            {t("scanning")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            GoPlus · Jupiter · Helius
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {tokenData && vc && (
        <>
          {/* Token Header */}
          <div style={{
            background: `var(--bg-card)`, border: "1px solid var(--border)",
            borderRadius: 16, padding: 24, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 20,
          }}>
            {tokenData.logoURI ? (
              <img src={tokenData.logoURI} alt={tokenData.symbol}
                style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 900, color: "#fff",
              }}>
                {tokenData.symbol.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
                {tokenData.symbol}
                <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 8 }}>
                  {tokenData.name}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: "var(--text-muted)",
                fontFamily: "monospace", marginTop: 4,
              }}>
                {tokenData.mint}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {tokenData.price !== null ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                    ${tokenData.price < 0.0001
                      ? tokenData.price.toExponential(2)
                      : tokenData.price.toLocaleString(undefined, { maximumSignificantDigits: 5 })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>USD</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>价格暂无数据</div>
              )}
            </div>
          </div>

          {/* GMGN K-Line Chart — server-proxied, no iframe */}
          <GmgnKlineChart mint={tokenData.mint} symbol={tokenData.symbol} isDayMode={isDayMode} />

          {/* Score + Decision */}
          <div style={{
            display: "grid", gridTemplateColumns: "140px 1fr",
            gap: 16, marginBottom: 16,
          }}>
            <div style={{
              background: `var(--bg-card)`, border: "1px solid var(--border)",
              borderRadius: 16, padding: 20, textAlign: "center",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t("safetyScore")}</div>
              <ScoreArc score={tokenData.securityScore} />
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>GoPlus Security</div>
            </div>

            <div style={{
              background: vc.bg,
              border: `1px solid ${vc.border}`,
              borderRadius: 16, padding: 24,
              boxShadow: `0 0 24px ${vc.glow}`,
            }}>
              <div style={{
                fontSize: 11, color: "var(--text-secondary)", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {loadingAI ? (
                  <span style={{ color: "#8B5CF6" }}>⚙️ Claude AI {t("analyzing")}</span>
                ) : aiData?.aiAvailable ? (
                  <span style={{ color: "#8B5CF6" }}>⚙️ Claude AI</span>
                ) : (
                  <span>⚙️ Rule Engine</span>
                )}
              </div>

              <div style={{
                display: "flex", alignItems: "center",
                gap: 10, marginBottom: 14,
              }}>
                <span style={{ fontSize: 28 }}>{vc.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: vc.color }}>
                  {localizeVerdict(tokenData.decision.label, t)}
                </span>
              </div>

              {/* AI Reasoning */}
              <div style={{
                background: `var(--bg-base)`, borderRadius: 10,
                padding: "14px 16px", fontSize: 13,
                color: "var(--text-primary)", lineHeight: 1.7,
                minHeight: 60,
              }}>
                {loadingAI ? (
                  <span style={{ color: "var(--text-secondary)" }}>{t("thinking")}</span>
                ) : aiData?.reasoning ? (
                  aiData.reasoning
                ) : (
                  tokenData.decision.suggestion
                )}
              </div>

              {tokenData.walletRiskyPct > 0 && (
                <div style={{
                  marginTop: 10, fontSize: 11, color: "#F59E0B",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>⚠️</span>
                  <span>{t("risk")} {tokenData.walletRiskyPct.toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* On-chain Proof (Commit-Reveal) */}
          {aiData && <ProofPanel ai={aiData} />}

          {/* ── x402 Premium AI Deep Analysis ── */}
          {tokenData && premiumStatus !== "done" && (
            <div style={{
              background: "var(--bg-card-2)",
              border: "1px solid #8B5CF640",
              borderRadius: 16, padding: 20, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#8B5CF6", marginBottom: 4 }}>
                    {t("premiumTitle")}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {t("premiumSubtitle")}
                  </div>
                </div>
                <button
                  onClick={unlockPremium}
                  disabled={premiumStatus === "paying" || premiumStatus === "loading"}
                  style={{
                    padding: "10px 18px",
                    background: premiumStatus === "idle"
                      ? "var(--accent)"
                      : `var(--border)`,
                    border: "none", borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    color: premiumStatus === "idle" ? "#fff" : "var(--text-muted)",
                    cursor: premiumStatus === "idle" ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}
                >
                  {premiumStatus === "paying" ? t("payingInProgress2") :
                   premiumStatus === "loading" ? t("generatingReport") :
                   t("unlockDeepReport")}
                </button>
              </div>
              {premiumStatus === "error" && (
                <div style={{ fontSize: 11, color: "#EF4444", marginTop: 8 }}>
                  ❌ {premiumError}
                </div>
              )}
            </div>
          )}

          {/* Premium result */}
          {premiumStatus === "done" && premiumData && (
            <div style={{
              background: `var(--bg-base)`, border: "1px solid #8B5CF660",
              borderRadius: 16, padding: 20, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#8B5CF6", marginBottom: 12 }}>
                {premiumData.demoMode ? t("premiumReportDemo") : t("premiumReportPaid")}
              </div>
              <div style={{
                fontSize: 12, color: "var(--text-primary)", lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}>
                {premiumData.aiDeepAnalysis}
              </div>
              <div style={{
                marginTop: 12, fontSize: 10, color: "var(--text-muted)",
                fontFamily: "monospace",
              }}>
                分析哈希: {premiumData.memoPayload} · {premiumData.analysisHash.slice(0, 20)}...
              </div>
            </div>
          )}

          {/* Risk Details */}
          {(tokenData.risks.length > 0 || tokenData.positives.length > 0) && (
            <div style={{
              background: `var(--bg-card)`, border: "1px solid var(--border)",
              borderRadius: 16, padding: 24, marginBottom: 16,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: "var(--text-primary)", marginBottom: 16,
              }}>
                {t("contractRisk")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tokenData.risks.map((r, i) => (
                  <div key={i} style={{
                    background: "rgba(168,41,58,0.10)", border: "1px solid rgba(168,41,58,0.30)",
                    borderRadius: 8, padding: "10px 14px",
                    fontSize: 13, color: "var(--red)",
                  }}>{localizeCheckText(r, t)}</div>
                ))}
                {tokenData.positives.map((p, i) => (
                  <div key={i} style={{
                    background: "rgba(61,122,92,0.10)", border: "1px solid rgba(61,122,92,0.30)",
                    borderRadius: 8, padding: "10px 14px",
                    fontSize: 13, color: "var(--green)",
                  }}>{localizeCheckText(p, t)}</div>
                ))}
              </div>
            </div>
          )}

          {/* Holder Stats */}
          {(tokenData.holderCount !== null || tokenData.top10HolderPct !== null) && (
            <div style={{
              background: `var(--bg-card)`, border: "1px solid var(--border)",
              borderRadius: 16, padding: 24, marginBottom: 16,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: "var(--text-primary)", marginBottom: 16,
              }}>
                {t("holderDistribution")}
              </div>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                {tokenData.holderCount !== null && (
                  <Stat
                    value={tokenData.holderCount.toLocaleString()}
                    label={t("totalHolders")}
                    color="#8B5CF6"
                  />
                )}
                {tokenData.top10HolderPct !== null && (
                  <Stat
                    value={`${tokenData.top10HolderPct}%`}
                    label={t("top10HolderPct")}
                    color={parseFloat(tokenData.top10HolderPct) > 50 ? "#EF4444" : "#10B981"}
                  />
                )}
                <Stat
                  value={tokenData.mintable ? `⚠️` : `✅ ${t("noMint")}`}
                  label={t("mintAuth")}
                  color={tokenData.mintable ? "#EF4444" : "#10B981"}
                />
                <Stat
                  value={tokenData.freezable ? `⚠️` : `✅ ${t("noFreeze")}`}
                  label={t("freezeAuth")}
                  color={tokenData.freezable ? "#EF4444" : "#10B981"}
                />
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "12px 0",
          }}>
            ⚠️ {t("disclaimer")}
          </div>
        </>
      )}
    </div>{/* end left column */}

    {/* ── Right: Watchlist sidebar ── */}
    <div className="token-sidebar" style={{
      background: `var(--bg-card)`, border: "1px solid var(--border)",
      borderRadius: 16, padding: 16, position: "sticky", top: 80,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
        marginBottom: 12, display: "flex",
        alignItems: "center", justifyContent: "space-between",
      }}>
        <span>🌿 {t("aiRecommendations")}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{watchlist.length}/20</span>
      </div>

      {watchlist.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
          {t("tokenSecurityAnalysis")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {watchlist.map(t => {
            const vc2 = VC[t.verdict];
            const timeAgo = Math.round((Date.now() - t.checkedAt) / 60000);
            const timeStr = timeAgo < 60
              ? `${timeAgo}m`
              : `${Math.round(timeAgo / 60)}h`;
            return (
              <div key={t.mint} style={{
                background: `var(--bg-base)`, borderRadius: 10,
                padding: "10px 12px",
                border: `1px solid ${vc2.border}30`,
                cursor: "pointer",
              }}
                onClick={() => { setMintInput(t.mint); setError(""); }}
              >
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 4,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t.symbol}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 10, color: vc2.color,
                      background: `${vc2.color}15`,
                      borderRadius: 4, padding: "1px 5px",
                    }}>{t.securityScore}</span>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(t.mint); setWatchlist(getWatchlist()); }}
                      style={{
                        background: "none", border: "none",
                        fontSize: 12, color: "var(--text-muted)",
                        cursor: "pointer", padding: 0, lineHeight: 1,
                      }}
                    >×</button>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  {t.price !== null
                    ? `$${t.price < 0.001 ? t.price.toExponential(2) : t.price.toFixed(4)}`
                    : "—"
                  } · {timeStr}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    </div>/* end grid */
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
    </div>
  );
}

// ── GMGN Kline Chart (server-proxied, no iframe needed) ───────────
type Resolution = "5m" | "15m" | "1h" | "4h" | "1d";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ChartTheme = "dark" | "light";

const CHART_THEMES: Record<ChartTheme, {
  bg: string; text: string; grid: string; border: string; bgLabel: string;
}> = {
  dark: {
    bg:      "#0E0C0A",
    text:    "#8B7D72",
    grid:    "#1A1714",
    border:  "#2E2820",
    bgLabel: "#141210",
  },
  light: {
    bg:      "#FFFFFF",
    text:    "#374151",
    grid:    "#F3F4F6",
    border:  "#E5E7EB",
    bgLabel: "#F9FAFB",
  },
};

function GmgnKlineChart({ mint, symbol, isDayMode = false }: { mint: string; symbol: string; isDayMode?: boolean }) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef     = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<any>(null);
  const [resolution, setResolution] = useState<Resolution>("1h");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [candles, setCandles]       = useState<Candle[]>([]);
  // Auto-sync with page day/night mode — no manual toggle needed
  const chartTheme: ChartTheme = isDayMode ? "light" : "dark";

  const RESOLUTIONS: Resolution[] = ["5m", "15m", "1h", "4h", "1d"];

  const fetchCandles = useCallback(async (res: Resolution) => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/gmgn/kline?mint=${mint}&resolution=${res}&limit=150`);
      const json = await r.json();
      if (json.candles && json.candles.length > 0) {
        setCandles(json.candles);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mint]);

  // Initial fetch
  useEffect(() => { fetchCandles(resolution); }, [fetchCandles, resolution]);

  // Mount/update chart
  // Rebuild chart whenever candles OR theme changes — guarantees correct background
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const th = CHART_THEMES[chartTheme];

    // Always destroy and recreate so theme colors are applied cleanly
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    import("lightweight-charts").then(({ createChart, CandlestickSeries }) => {
      if (!containerRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: th.bg },
          textColor:  th.text,
        },
        grid: {
          vertLines:  { color: th.grid },
          horzLines:  { color: th.grid },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: th.border },
        timeScale: {
          borderColor:    th.border,
          timeVisible:    true,
          secondsVisible: false,
        },
        width:  containerRef.current.clientWidth,
        height: 320,
      });
      chartRef.current = chart;
      const series = chart.addSeries(CandlestickSeries, {
        upColor:        "#3D7A5C",
        downColor:      "#A8293A",
        borderUpColor:  "#3D7A5C",
        borderDownColor:"#A8293A",
        wickUpColor:    "#3D7A5C",
        wickDownColor:  "#A8293A",
      });
      seriesRef.current = series;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      series.setData(candles as any);
      chart.timeScale().fitContent();
    });

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [candles, chartTheme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ marginTop: 16, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div style={{
        padding: "8px 14px",
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
            📈 {t("klineGmgn")}
          </span>
          {/* Resolution switcher */}
          <div style={{ display: "flex", gap: 4 }}>
            {RESOLUTIONS.map(r => (
              <button
                key={r}
                onClick={() => setResolution(r)}
                style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${resolution === r ? "var(--accent)" : "var(--border)"}`,
                  background: resolution === r ? "var(--accent-soft)" : "transparent",
                  color: resolution === r ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, color: "var(--text-muted)", textDecoration: "none" }}>
            DexScreener →
          </a>
          <a href={`https://gmgn.ai/sol/token/${mint}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, color: "var(--accent)", textDecoration: "none" }}>
            GMGN →
          </a>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ background: CHART_THEMES[chartTheme].bg, position: "relative", minHeight: 320 }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: 8,
          }}>
            <div style={{ width: 24, height: 24, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("loadingGmgn")}</span>
          </div>
        )}
        {error && !loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", gap: 12,
          }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {t("noKlineData")}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={`https://gmgn.ai/sol/token/${mint}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                  background: "var(--accent)", color: "#fff", textDecoration: "none",
                }}>
                {t("viewOnGmgn")}
              </a>
              <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                  border: "1px solid var(--border)", color: "var(--text-secondary)", textDecoration: "none",
                }}>
                DexScreener
              </a>
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", display: error || loading ? "none" : "block" }} />
      </div>
    </div>
  );
}
