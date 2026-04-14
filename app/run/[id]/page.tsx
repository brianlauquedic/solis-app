"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { StoredRun } from "@/lib/run-store";
import { useLang } from "@/contexts/LanguageContext";

// ── Inline i18n for standalone report page (no app context available) ──
type RunLang = "zh" | "en" | "ja";
const i18n: Record<string, Record<RunLang, string>> = {
  loading:       { zh: "載入報告中…",       en: "Loading report…",      ja: "レポートを読み込み中…" },
  notFound:      { zh: "報告不存在",         en: "Report not found",     ja: "レポートが見つかりません" },
  notFoundDesc:  { zh: "此報告可能已過期（7天TTL）或不存在。", en: "This report may have expired (7-day TTL) or never existed.", ja: "このレポートは期限切れ（7日TTL）または存在しない可能性があります。" },
  tryGhostRun:   { zh: "試試 Ghost Run →",  en: "Try Ghost Run →",      ja: "Ghost Runを試す →" },
  proofTitle:    { zh: "⛩️ 模擬預承諾 · 鏈上憑證", en: "⛩️ PROOF-OF-SIMULATION · ONCHAIN COMMITMENT", ja: "⛩️ シミュレーション事前証明 · オンチェーン記録" },
  commitmentId:  { zh: "承諾 ID",           en: "Commitment ID",        ja: "コミットメント ID" },
  onchainTx:     { zh: "鏈上 TX",           en: "Onchain TX",           ja: "オンチェーン TX" },
  proofDesc:     { zh: "結果已在執行前 SHA-256 承諾並記錄於 Solana — 任何人均可在鏈上驗證結果為交易前所知。", en: "This simulation result was SHA-256 committed on Solana mainnet BEFORE any execution. Anyone can verify on Solscan that the outcome was known pre-trade.", ja: "このシミュレーション結果は実行前にSolanaメインネットへSHA-256コミット済み。取引前に結果が確定していたことをSolscanで誰でも検証できます。" },
  strategy:      { zh: "策略",             en: "STRATEGY",             ja: "ストラテジー" },
  simResults:    { zh: "模擬結果",          en: "SIMULATION RESULTS",   ja: "シミュレーション結果" },
  executable:    { zh: "✓ 可執行",          en: "✓ EXECUTABLE",         ja: "✓ 実行可能" },
  issues:        { zh: "⚠ 發現問題",        en: "⚠ ISSUES DETECTED",    ja: "⚠ 問題検出" },
  step:          { zh: "步驟",             en: "Step",                  ja: "ステップ" },
  output:        { zh: "產出",             en: "Output",               ja: "産出" },
  apy:           { zh: "APY",             en: "APY",                   ja: "APY" },
  gas:           { zh: "Gas",             en: "Gas",                   ja: "ガス" },
  totalGas:      { zh: "總 Gas",           en: "Total gas",            ja: "合計ガス" },
  aiAnalysis:    { zh: "AI 策略分析",      en: "AI ANALYSIS",           ja: "AI分析" },
  shareX:        { zh: "𝕏 分享到 X",       en: "𝕏 Share on X",         ja: "𝕏 Xでシェア" },
  copyLink:      { zh: "📋 複製連結",       en: "📋 Copy Link",          ja: "📋 リンクをコピー" },
  trySakura:     { zh: "🌸 免費試用 Sakura →", en: "🌸 Try Sakura Free →", ja: "🌸 Sakuraを無料で試す →" },
  footer:        { zh: "SAKURA · AI 安全層 · SOLANA · sakuraaai.com", en: "SAKURA · AI SECURITY LAYER · SOLANA · sakuraaai.com", ja: "SAKURA · AI セキュリティレイヤー · SOLANA · sakuraaai.com" },
  wallet:        { zh: "錢包",             en: "Wallet",               ja: "ウォレット" },
  date:          { zh: "日期",             en: "Date",                 ja: "日時" },
};
function t(key: string, lang: RunLang): string {
  return i18n[key]?.[lang] ?? i18n[key]?.en ?? key;
}

export default function RunPage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<StoredRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/run/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setRun(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Language: app language switcher takes priority, then run.lang fallback
  const { lang: appLang } = useLang();
  const lang: RunLang = appLang as RunLang;

  const shareUrl = `https://www.sakuraaai.com/run/${id}`;
  const twitterText = run ? encodeURIComponent(
    `👻 Ghost Run Report — Solana DeFi Strategy Pre-Simulated\n` +
    `Commitment: ${run.commitmentId ?? "N/A"}\n` +
    `⛩️ SHA-256 pre-committed on Solana mainnet\n` +
    `www.sakuraaai.com/run/${id}\n` +
    `@sakuraaijp #GhostRun #Solana`
  ) : "";

  if (loading) return (
    <main style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#475569", fontSize: 14, fontFamily: "monospace" }}>{t("loading", lang)}</div>
    </main>
  );

  if (notFound || !run) return (
    <main style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👻</div>
        <div style={{ color: "#EF4444", fontSize: 16, marginBottom: 8 }}>{t("notFound", lang)}</div>
        <div style={{ color: "#475569", fontSize: 12 }}>{t("notFoundDesc", lang)}</div>
        <a href="/?demo=true" style={{ display: "inline-block", marginTop: 20, color: "#8B5CF6", fontSize: 13 }}>{t("tryGhostRun", lang)}</a>
      </div>
    </main>
  );

  const result = run.result as { steps?: Array<{step: {inputAmount: number; inputToken: string; outputToken: string}; outputAmount: number; estimatedApy: number | null; gasSol: number; success: boolean}>; canExecute?: boolean; totalGasSol?: number; warnings?: string[] };
  const steps = result?.steps ?? [];
  const formattedDate = new Date(run.ts).toLocaleString(
    lang === "zh" ? "zh-TW" : lang === "ja" ? "ja-JP" : "en-US",
    { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }
  );

  return (
    <main style={{ background: "#0A0A0F", minHeight: "100vh" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>👻</span>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#8B5CF6", fontWeight: 700, marginBottom: 2, fontFamily: "monospace" }}>
                {t("proofTitle", lang)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9" }}>
                Pre-Execution Report
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#334155", fontFamily: "monospace" }}>
            {formattedDate} UTC · {t("wallet", lang)}: {run.walletShort}... · ID: {id}
          </div>
        </div>

        {/* Strategy */}
        <div style={{ background: "#13131A", border: "1px solid #1E1E2E", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 700, letterSpacing: 2, marginBottom: 8, fontFamily: "monospace" }}>{t("strategy", lang)}</div>
          <div style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.6 }}>{run.strategy}</div>
        </div>

        {/* Simulation results */}
        <div style={{ background: "#080B14", border: "1px solid #1E3A5F", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#60A5FA", fontWeight: 700, letterSpacing: 2, marginBottom: 12, fontFamily: "monospace" }}>
            {t("simResults", lang)} · {result.canExecute ? t("executable", lang) : t("issues", lang)}
          </div>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < steps.length - 1 ? "1px solid #1E1E2E" : "none"
            }}>
              <div>
                <div style={{ fontSize: 13, color: s.success ? "#10B981" : "#EF4444", fontWeight: 600 }}>
                  {s.success ? "✓" : "✗"} {t("step", lang)} {i + 1}: {s.step.inputAmount} {s.step.inputToken} → {s.step.outputToken}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  {t("output", lang)}: {s.outputAmount.toFixed(4)} {s.step.outputToken}
                  {s.estimatedApy != null ? ` · ${t("apy", lang)} ${s.estimatedApy.toFixed(1)}%` : ""}
                  {` · ${t("gas", lang)} ${s.gasSol.toFixed(6)} SOL`}
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1E1E2E", fontSize: 11, color: "#475569" }}>
            {t("totalGas", lang)}: {result.totalGasSol?.toFixed(6) ?? "—"} SOL
            {result.warnings?.length ? ` · ⚠ ${result.warnings.join("; ")}` : ""}
          </div>
        </div>

        {/* Commitment proof */}
        {run.commitmentId && (
          <div style={{ background: "#0A0A0F", border: "1px solid #8B5CF630", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 700, letterSpacing: 2, marginBottom: 12, fontFamily: "monospace" }}>
              {t("proofTitle", lang)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#475569" }}>{t("commitmentId", lang)}</span>
                <span style={{ color: "#8B5CF6", fontFamily: "monospace" }}>{run.commitmentId}</span>
              </div>
              {run.commitmentMemoSig && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#475569" }}>{t("onchainTx", lang)}</span>
                  <a
                    href={`https://solscan.io/tx/${run.commitmentMemoSig}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "#60A5FA", fontFamily: "monospace", textDecoration: "none" }}
                  >
                    {run.commitmentMemoSig.slice(0, 20)}… →
                  </a>
                </div>
              )}
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4, lineHeight: 1.6 }}>
                {t("proofDesc", lang)}
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {run.aiAnalysis && (
          <div style={{ background: "#13131A", border: "1px solid #1E1E2E", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700, letterSpacing: 2, marginBottom: 10, fontFamily: "monospace" }}>{t("aiAnalysis", lang)}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{run.aiAnalysis}</div>
          </div>
        )}

        {/* Share + CTA */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${twitterText}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", background: "#1A1A2E", border: "1px solid #8B5CF640",
              borderRadius: 8, color: "#E2E8F0", textDecoration: "none", fontSize: 13, fontWeight: 600
            }}
          >
            {t("shareX", lang)}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", background: "#13131A", border: "1px solid #1E1E2E",
              borderRadius: 8, color: copied ? "#10B981" : "#94A3B8", cursor: "pointer", fontSize: 13
            }}
          >
            {copied ? "✓" : t("copyLink", lang)}
          </button>
          <a
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", background: "linear-gradient(135deg, #8B5CF620, #6D28D920)",
              border: "1px solid #8B5CF640", borderRadius: 8, color: "#8B5CF6",
              textDecoration: "none", fontSize: 13, fontWeight: 600
            }}
          >
            {t("trySakura", lang)}
          </a>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 11, color: "#1E293B", textAlign: "center", fontFamily: "monospace" }}>
          {t("footer", lang)}
        </div>
      </div>
    </main>
  );
}
