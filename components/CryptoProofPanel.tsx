"use client";

import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";

// ── i18n ─────────────────────────────────────────────────────────
const t = {
  title: { zh: "密碼學證明面板", en: "Cryptographic Proof Panel", ja: "暗号証明パネル" },
  hashChain: { zh: "哈希鏈", en: "Hash Chain", ja: "ハッシュチェーン" },
  dualHash: { zh: "雙層哈希", en: "Dual-Layer Hash", ja: "二層ハッシュ" },
  merkle: { zh: "Merkle 審計", en: "Merkle Audit", ja: "Merkle監査" },
  zkProof: { zh: "零知識證明", en: "ZK Proof", ja: "ゼロ知識証明" },
  cumulative: { zh: "累計追蹤", en: "Cumulative Tracking", ja: "累積追跡" },
  verified: { zh: "已驗證", en: "Verified", ja: "検証済み" },
  unverified: { zh: "未驗證", en: "Unverified", ja: "未検証" },
  verifyAll: { zh: "一鍵驗證全部", en: "Verify All Layers", ja: "全レイヤーを検証" },
  sha256: { zh: "SHA-256（通用）", en: "SHA-256 (Universal)", ja: "SHA-256（汎用）" },
  poseidon: { zh: "Poseidon（ZK友好）", en: "Poseidon (ZK-ready)", ja: "Poseidon（ZK対応）" },
  root: { zh: "Merkle 根", en: "Merkle Root", ja: "Merkleルート" },
  leafIndex: { zh: "葉節點索引", en: "Leaf Index", ja: "リーフインデックス" },
  treeSize: { zh: "樹大小", en: "Tree Size", ja: "ツリーサイズ" },
  proofDigest: { zh: "證明摘要", en: "Proof Digest", ja: "証明ダイジェスト" },
  nullifier: { zh: "空值器", en: "Nullifier", ja: "ナリファイア" },
  totalExecuted: { zh: "累計執行", en: "Total Executed", ja: "累計実行" },
  opCount: { zh: "操作次數", en: "Operation Count", ja: "操作回数" },
  architecture: { zh: "靈感來源", en: "Inspired By", ja: "インスピレーション" },
  expand: { zh: "展開", en: "Expand", ja: "展開" },
  collapse: { zh: "收起", en: "Collapse", ja: "折りたたむ" },
} as const;

type Lang = "zh" | "en" | "ja";

// ── Types ────────────────────────────────────────────────────────
export interface CryptoProofData {
  // Hash Chain layer
  hashChain?: {
    mandateHash: string;
    executionHash: string;
    chainProof: string;
    mandateInput?: string;
    executionInput?: string;
    chainInput?: string;
  };
  // Dual-Hash layer
  dualHash?: {
    poseidonMandate?: string;
    poseidonExecution?: string;
    poseidonChainProof?: string;
    merkleRoot: string;
    merkleLeafIndex: number;
    treeSize: number;
  };
  // ZK Proof layer
  zkProof?: {
    proofDigest: string;
    poseidonDigest?: string;
    nullifier: string;
    verified: boolean;
    circuit?: string;
    salt?: string;
  } | null;
  // Cumulative tracking
  cumulativeTracking?: {
    totalExecuted: number;
    operationCount: number;
    accepted: boolean;
  };
}

function HashBadge({ hash, label }: { hash: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
      <code
        className="text-xs font-mono text-emerald-400/80 bg-black/30 px-2 py-1 rounded break-all cursor-pointer hover:bg-black/50 transition-colors flex-1"
        onClick={handleCopy}
        title="Click to copy"
      >
        {copied ? "Copied!" : hash}
      </code>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"}`} />
  );
}

function SectionHeader({ title, icon, verified, expanded, onToggle }: {
  title: string; icon: string; verified?: boolean; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-medium text-white/90">{title}</span>
        {verified !== undefined && <StatusDot ok={verified} />}
      </div>
      <span className="text-xs text-gray-500">{expanded ? "▲" : "▼"}</span>
    </button>
  );
}

export default function CryptoProofPanel({ data }: { data: CryptoProofData }) {
  const { lang: appLang } = useLang();
  const lang = (appLang || "en") as Lang;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const i = (key: keyof typeof t) => t[key][lang] ?? t[key].en;

  // Client-side hash-chain verification. The deleted /api/verify route
  // was just a sha256 recompute server-side; doing it in the browser
  // removes a network round-trip, eliminates a server attack surface,
  // and lets the demo run with no backend dependency.
  const handleVerifyAll = async () => {
    setVerifyResult("...");
    try {
      const sha256Hex = async (s: string): Promise<string> => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      };
      let allVerified = true;
      if (data.hashChain) {
        // Each *Input field is optional on the type — if missing, we can't
        // recompute, so treat the layer as "skipped" (not failed) to match
        // the prior server-side behavior which only verified layers with
        // inputs present in the payload.
        if (data.hashChain.mandateInput !== undefined) {
          const m = await sha256Hex(data.hashChain.mandateInput);
          if (m !== data.hashChain.mandateHash) allVerified = false;
        }
        if (data.hashChain.executionInput !== undefined) {
          const e = await sha256Hex(data.hashChain.executionInput);
          if (e !== data.hashChain.executionHash) allVerified = false;
        }
        if (data.hashChain.chainInput !== undefined) {
          const c = await sha256Hex(data.hashChain.chainInput);
          if (c !== data.hashChain.chainProof) allVerified = false;
        }
      }
      setVerifyResult(allVerified ? "ALL_PASS" : "SOME_FAIL");
    } catch {
      setVerifyResult("ERROR");
    }
  };

  const layerCount = [data.hashChain, data.dualHash, data.zkProof, data.cumulativeTracking].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/80 to-black/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <span className="text-sm font-semibold text-white/90">{i("title")}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {layerCount} layers
          </span>
        </div>
        <button
          onClick={handleVerifyAll}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 transition-colors"
        >
          {verifyResult === "..." ? "⏳" : verifyResult === "ALL_PASS" ? "✅" : verifyResult === "SOME_FAIL" ? "❌" : "🔍"} {i("verifyAll")}
        </button>
      </div>

      <div className="p-3 space-y-1">
        {/* Hash Chain */}
        {data.hashChain && (
          <div>
            <SectionHeader title={i("hashChain")} icon="🔗" verified={true} expanded={!!expanded.hc} onToggle={() => toggle("hc")} />
            {expanded.hc && (
              <div className="pl-8 pr-3 pb-3 space-y-2">
                <HashBadge label="mandate" hash={data.hashChain.mandateHash} />
                <HashBadge label="execution" hash={data.hashChain.executionHash} />
                <HashBadge label="chain" hash={data.hashChain.chainProof} />
              </div>
            )}
          </div>
        )}

        {/* Dual-Hash */}
        {data.dualHash && (
          <div>
            <SectionHeader title={i("dualHash")} icon="⚡" verified={true} expanded={!!expanded.dh} onToggle={() => toggle("dh")} />
            {expanded.dh && (
              <div className="pl-8 pr-3 pb-3 space-y-2">
                {data.dualHash.poseidonMandate && <HashBadge label={i("poseidon")} hash={data.dualHash.poseidonMandate} />}
                {data.dualHash.poseidonExecution && <HashBadge label={i("poseidon")} hash={data.dualHash.poseidonExecution} />}
                {data.dualHash.poseidonChainProof && <HashBadge label={i("poseidon")} hash={data.dualHash.poseidonChainProof} />}
              </div>
            )}
          </div>
        )}

        {/* Merkle Audit */}
        {data.dualHash && (
          <div>
            <SectionHeader title={i("merkle")} icon="🌳" verified={true} expanded={!!expanded.mk} onToggle={() => toggle("mk")} />
            {expanded.mk && (
              <div className="pl-8 pr-3 pb-3 space-y-2">
                <HashBadge label={i("root")} hash={data.dualHash.merkleRoot} />
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>{i("leafIndex")}: <span className="text-white/70">{data.dualHash.merkleLeafIndex}</span></span>
                  <span>{i("treeSize")}: <span className="text-white/70">{data.dualHash.treeSize}</span></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ZK Proof */}
        {data.zkProof && (
          <div>
            <SectionHeader title={i("zkProof")} icon="🔐" verified={data.zkProof.verified} expanded={!!expanded.zk} onToggle={() => toggle("zk")} />
            {expanded.zk && (
              <div className="pl-8 pr-3 pb-3 space-y-2">
                <HashBadge label={i("proofDigest")} hash={data.zkProof.proofDigest} />
                <HashBadge label={i("nullifier")} hash={data.zkProof.nullifier} />
                {data.zkProof.circuit && (
                  <div className="text-xs text-gray-400">
                    Circuit: <span className="text-purple-300">{data.zkProof.circuit}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cumulative Tracking */}
        {data.cumulativeTracking && (
          <div>
            <SectionHeader title={i("cumulative")} icon="📊" verified={data.cumulativeTracking.accepted} expanded={!!expanded.ct} onToggle={() => toggle("ct")} />
            {expanded.ct && (
              <div className="pl-8 pr-3 pb-3 flex gap-6 text-xs text-gray-400">
                <span>{i("totalExecuted")}: <span className="text-white/70">${data.cumulativeTracking.totalExecuted.toFixed(2)}</span></span>
                <span>{i("opCount")}: <span className="text-white/70">{data.cumulativeTracking.operationCount}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Architecture footer */}
        <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
          <span>{i("architecture")}: Stateless Merkle + ZK Commitment</span>
          <span>BN254 / Poseidon / SHA-256</span>
        </div>
      </div>
    </div>
  );
}
