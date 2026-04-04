"use client";

import { useEffect, useState } from "react";
import { saveSnapshot, getHistory, PortfolioSnapshot } from "@/lib/portfolio-history";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useLang } from "@/contexts/LanguageContext";

interface Token {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  type: string;
  usdValue: number | null;
}

interface Breakdown {
  sol: number;
  stablecoin: number;
  defi: number;
  risky: number;
}

interface WalletData {
  address: string;
  solBalance: number;
  solPrice: number;
  solUSD: number;
  tokens: Token[];
  totalUSD: number;
  idleUSDC: number;
  riskyTokenCount: number;
  healthScore: number;
  breakdown: Breakdown;
}

interface Props {
  walletAddress: string;
  onDisconnect: () => void;
  onDataLoaded?: (snapshot: { solBalance: number; totalUSD: number; idleUSDC: number }) => void;
}

// ── Score Ring ───────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const { t } = useLang();
  const color = score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  const label = score >= 70 ? t("healthy") : score >= 45 ? t("needsAttention") : t("highRisk");
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 120, height: 120, borderRadius: "50%",
        border: `6px solid ${color}`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg-base)",
        boxShadow: `0 0 24px ${color}40`,
        margin: "0 auto 8px",
      }}>
        <AnimatedNumber value={score} duration={1000} style={{ fontSize: 36, fontWeight: 900, color }} />
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>/ 100</span>
      </div>
      <span style={{
        fontSize: 12, color,
        background: `${color}20`, border: `1px solid ${color}40`,
        borderRadius: 20, padding: "3px 10px",
      }}>{label}</span>
    </div>
  );
}

// ── Portfolio Bar Chart ──────────────────────────────────────────
function PortfolioBar({ breakdown, totalUSD }: { breakdown: Breakdown; totalUSD: number }) {
  const { t } = useLang();
  const segments = [
    { label: "SOL",          pct: breakdown.sol,        color: "#8B5CF6" },
    { label: t("stablecoin"), pct: breakdown.stablecoin, color: "#10B981" },
    { label: "DeFi",         pct: breakdown.defi,       color: "#06B6D4" },
    { label: t("highRisk"),  pct: breakdown.risky,      color: "#EF4444" },
  ].filter(s => s.pct > 0.5);

  if (totalUSD === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>{t("assetDistribution")}</div>
      {/* Bar */}
      <div style={{
        display: "flex", borderRadius: 6, overflow: "hidden",
        height: 10, marginBottom: 12, gap: 1,
      }}>
        {segments.map(s => (
          <div key={s.label} style={{
            width: `${s.pct}%`, background: s.color,
            transition: "width 0.6s ease",
          }} />
        ))}
        {/* remainder */}
        {segments.reduce((acc, s) => acc - s.pct, 100) > 0 && (
          <div style={{
            flex: 1, background: "var(--border)",
          }} />
        )}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {s.label} {s.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Token Row ────────────────────────────────────────────────────
function TokenRow({ token, totalUSD }: { token: Token; totalUSD: number }) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const riskColors: Record<string, string> = {
    stablecoin:   "#10B981",
    native:       "#8B5CF6",
    defi:         "#06B6D4",
    liquid_stake: "#06B6D4",
    meme:         "#F59E0B",
    unknown:      "#EF4444",
    bridge:       "var(--text-secondary)",
  };
  const typeLabels: Record<string, string> = {
    stablecoin:   t("stablecoin"),
    native:       t("native"),
    defi:         "DeFi",
    liquid_stake: t("staking"),
    meme:         "Meme",
    unknown:      t("unknown"),
    bridge:       t("crosschain"),
  };

  const color = riskColors[token.type] ?? "var(--text-secondary)";
  const icon = token.type === "unknown" ? "🚨"
    : token.type === "meme" ? "⚠️"
    : "✅";
  const pct = totalUSD > 0 && token.usdValue
    ? ((token.usdValue / totalUSD) * 100).toFixed(1)
    : null;

  const isRisky = token.type === "unknown" || token.type === "meme";

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
    <div
      style={{
        display: "flex", alignItems: "center",
        padding: "10px 0", gap: 10,
        cursor: isRisky ? "pointer" : "default",
      }}
      onClick={() => isRisky && setExpanded(v => !v)}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {token.symbol}
          </span>
          <span style={{
            fontSize: 10, color, background: `${color}20`,
            border: `1px solid ${color}40`,
            borderRadius: 4, padding: "1px 5px",
          }}>{typeLabels[token.type] ?? token.type}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{token.name}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, color }}>
          {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </div>
        {token.usdValue !== null ? (
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            ≈ ${token.usdValue.toFixed(2)}
            {pct && <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>({pct}%)</span>}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("noPriceData")}</div>
        )}
      </div>
      {isRisky && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{expanded ? "▲" : "▼"}</span>
      )}
    </div>

    {/* Inline expand for risky tokens */}
    {isRisky && expanded && (
      <div style={{
        margin: "0 0 8px 26px",
        background: "#1A0808", border: "1px solid #EF444430",
        borderRadius: 8, padding: "10px 14px", fontSize: 12,
      }}>
        <div style={{ color: "#FCA5A5", marginBottom: 8 }}>
          ⚠️ {t("highRisk")} ({token.type === "unknown" ? t("unknown") : "Meme"})
        </div>
        <a
          href={`https://solscan.io/token/${token.mint}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, color: "#8B5CF6", marginRight: 12,
            textDecoration: "none",
          }}
        >{t("viewOnSolscan")}</a>
        <a
          href={`https://rugcheck.xyz/tokens/${token.mint}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#06B6D4", textDecoration: "none" }}
        >{t("rugCheckDetect")}</a>
      </div>
    )}
    </div>
  );
}

// ── Share Modal ──────────────────────────────────────────────────
function ShareModal({ data, onClose }: { data: WalletData; onClose: () => void }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const short = `${data.address.slice(0, 6)}...${data.address.slice(-4)}`;
  const scoreLabel = data.healthScore >= 70 ? `${t("healthy")} ✅` : data.healthScore >= 45 ? `${t("needsAttention")} ⚠️` : `${t("highRisk")} 🚨`;

  const text = `📊 ${t("walletHealthReport")} via Sakura AI

🏥 Score: ${data.healthScore}/100 ${scoreLabel}
💰 ${t("totalAssets")}: $${data.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
🪙 SOL: ${data.solBalance.toFixed(3)} SOL ≈ $${data.solUSD.toFixed(0)}
📦 ${t("holdingTokens")}: ${data.tokens.length} ${t("tokens")}
⚠️ ${t("highRiskTokens")}: ${data.riskyTokenCount}

${short}

solis.app`;

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 20, padding: 32, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {t("shareTitle")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
          {t("shareHint")}
        </div>

        <div style={{
          background: "var(--bg-base)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 16, marginBottom: 16,
          fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8,
          whiteSpace: "pre-line",
        }}>
          {text}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleCopy} style={{
            flex: 1, padding: "12px",
            background: copied ? "var(--green)" : "var(--accent)",
            border: "none", borderRadius: 10, fontSize: 14,
            fontWeight: 700, color: "#fff", cursor: "pointer",
          }}>
            {copied ? t("copied") : t("copyText")}
          </button>
          <button onClick={onClose} style={{
            padding: "12px 20px",
            background: "var(--border)", border: "none",
            borderRadius: 10, fontSize: 14, color: "var(--text-secondary)", cursor: "pointer",
          }}>{t("close")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function HealthReport({ walletAddress, onDisconnect, onDataLoaded }: Props) {
  const { t } = useLang();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [marinadeAPY, setMarinadeAPY] = useState(7.2);
  const [kaminoAPY, setKaminoAPY] = useState(8.2);

  // Fetch live APY from yield API
  useEffect(() => {
    fetch("/api/yield")
      .then(r => r.json())
      .then(d => {
        if (!d.opportunities) return;
        const marinade = d.opportunities.find((o: { protocol: string; apy: number }) => o.protocol === "Marinade Finance");
        const kamino = d.opportunities.find((o: { protocol: string; apy: number }) => o.protocol === "Kamino Finance");
        if (marinade?.apy) setMarinadeAPY(marinade.apy);
        if (kamino?.apy) setKaminoAPY(kamino.apy);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/wallet?address=${walletAddress}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
        onDataLoaded?.({ solBalance: json.solBalance, totalUSD: json.totalUSD, idleUSDC: json.idleUSDC });
        const snap: PortfolioSnapshot = {
          address: walletAddress, totalUSD: json.totalUSD,
          solBalance: json.solBalance, healthScore: json.healthScore,
          tokenCount: json.tokens.length, savedAt: Date.now(),
        };
        saveSnapshot(snap);
        setHistory(getHistory(walletAddress));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("scanning"));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [walletAddress]);

  if (loading) return <SkeletonReport />;

  if (error) return (
    <div style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 16, color: "#EF4444", marginBottom: 8 }}>{error}</div>
      <button onClick={onDisconnect} style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        color: "var(--text-secondary)", padding: "10px 20px", borderRadius: 8,
        cursor: "pointer", fontSize: 14,
      }}>{t("retry")}</button>
    </div>
  );

  if (!data) return null;

  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const monthlyYield = data.idleUSDC * (kaminoAPY / 100) / 12;
  const annualYield = data.idleUSDC * (kaminoAPY / 100);

  return (
    <div>
      {showShare && <ShareModal data={data} onClose={() => setShowShare(false)} />}

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 32,
      }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{t("connectedWallet")}</div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: "#8B5CF6" }}>{shortAddr}</div>
        </div>
        <button onClick={onDisconnect} style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          color: "var(--text-secondary)", padding: "8px 16px", borderRadius: 8,
          cursor: "pointer", fontSize: 13,
        }}>{t("disconnect")}</button>
      </div>

      {/* Score + Total + Breakdown */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 32, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 40, marginBottom: 24 }}>
          <ScoreRing score={data.healthScore} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{t("walletHealthReport")}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--text-primary)", marginBottom: 4 }}>
              <AnimatedNumber value={data.totalUSD} prefix="$" duration={1200} />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {t("totalAssets")}
            </div>
            {/* Quick stats */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6" }}>
                  {data.solBalance.toFixed(3)} SOL
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>≈ ${data.solUSD.toFixed(0)}</div>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#06B6D4" }}>
                  {data.tokens.length} {t("tokens")}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t("holdingTokens")}</div>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: data.riskyTokenCount > 0 ? "#EF4444" : "#10B981",
                }}>
                  {data.riskyTokenCount} 個
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t("highRiskTokens")}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio bar */}
        {data.breakdown && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <PortfolioBar breakdown={data.breakdown} totalUSD={data.totalUSD} />
          </div>
        )}
      </div>

      {/* Score breakdown */}
      <ScoreBreakdown data={data} />

      {/* Opportunity alert — idle USDC */}
      {data.idleUSDC > 10 && (
        <div className="opportunity-alert" style={{
          background: "#0A2010", border: "1px solid #10B981",
          borderRadius: 12, padding: "16px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981", marginBottom: 4 }}>
              {t("idleYieldOpportunity")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              ${data.idleUSDC.toFixed(0)} USDC → Kamino Finance (APY {kaminoAPY.toFixed(1)}%) →{" "}
              <strong style={{ color: "#10B981" }}>${monthlyYield.toFixed(1)}/mo</strong> /{" "}
              <strong style={{ color: "#10B981" }}>${annualYield.toFixed(0)}/yr</strong>
            </div>
          </div>
          <a
            href="https://app.kamino.finance/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#10B981", border: "none", color: "#fff",
              padding: "10px 18px", borderRadius: 8, fontSize: 13,
              fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              marginLeft: 16, textDecoration: "none", display: "inline-block",
            }}
          >
            {t("viewPlan")}
          </a>
        </div>
      )}

      {/* SOL staking alert */}
      {data.solBalance > 0.5 && (
        <div className="opportunity-alert" style={{
          background: "#0A0818", border: "1px solid #8B5CF6",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#8B5CF6", marginBottom: 4 }}>
              {t("solStakingRecommendation")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {(data.solBalance * 0.6).toFixed(2)} SOL → Marinade Finance (APY {marinadeAPY.toFixed(1)}%) →{" "}
              <strong style={{ color: "#8B5CF6" }}>
                +${(data.solUSD * 0.6 * marinadeAPY / 100).toFixed(0)}/yr
              </strong>
            </div>
          </div>
          <a
            href="https://marinade.finance/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#8B5CF6", border: "none", color: "#fff",
              padding: "10px 18px", borderRadius: 8, fontSize: 13,
              fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              marginLeft: 16, textDecoration: "none", display: "inline-block",
            }}
          >
            {t("learnMore")}
          </a>
        </div>
      )}

      {/* Token list */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24, marginBottom: 20,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {t("positionDetails")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {data.tokens.length} {t("sortedByValue")}
            </div>
          </div>
          {data.riskyTokenCount > 0 && (
            <div style={{
              background: "#EF444420", border: "1px solid #EF444440",
              borderRadius: 8, padding: "4px 10px",
              fontSize: 11, color: "#EF4444",
            }}>
              🚨 {data.riskyTokenCount} {t("highRisk")}
            </div>
          )}
        </div>

        {/* SOL row */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "10px 0", borderBottom: "1px solid var(--border)", gap: 10,
        }}>
          <span style={{ fontSize: 15 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>SOL</span>
              <span style={{
                fontSize: 10, color: "#8B5CF6", background: "#8B5CF620",
                border: "1px solid #8B5CF640",
                borderRadius: 4, padding: "1px 5px",
              }}>{t("native")}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Solana</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#8B5CF6" }}>
              {data.solBalance.toFixed(4)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              ≈ ${data.solUSD.toFixed(2)}
              {data.totalUSD > 0 && (
                <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                  ({((data.solUSD / data.totalUSD) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {data.tokens.map((token, i) => (
          <TokenRow key={i} token={token} totalUSD={data.totalUSD} />
        ))}

        {data.tokens.length === 0 && (
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            textAlign: "center", padding: "20px 0",
          }}>
            {t("unknown")}
          </div>
        )}
      </div>

      {/* AI Recommendations */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          {t("aiRecommendations")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.solBalance > 0.5 && (
            <RecommendRow type={t("recommendation")} color="#8B5CF6">
              {(data.solBalance * 0.6).toFixed(2)} SOL → Marinade Finance (APY {marinadeAPY.toFixed(1)}%) → +${(data.solUSD * 0.6 * marinadeAPY / 100).toFixed(0)}/yr
            </RecommendRow>
          )}
          {data.idleUSDC > 10 && (
            <RecommendRow type={t("opportunity")} color="#10B981">
              ${data.idleUSDC.toFixed(0)} USDC → Kamino Finance, APY {kaminoAPY.toFixed(1)}%, +${monthlyYield.toFixed(1)}/mo
            </RecommendRow>
          )}
          {data.riskyTokenCount > 0 && (
            <RecommendRow type={t("risk")} color="#EF4444">
              {data.riskyTokenCount} {t("highRiskTokens")} — {t("rugCheckDetect")}
            </RecommendRow>
          )}
          {data.healthScore >= 70 && data.riskyTokenCount === 0 && (
            <RecommendRow type={t("good")} color="#10B981">
              {t("healthy")} ✅
            </RecommendRow>
          )}
        </div>
      </div>

      {/* Portfolio History */}
      {history.length > 1 && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            📈 {t("assetDistribution")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.slice(0, 5).map((snap, i) => {
              const prev = history[i + 1];
              const diff = prev ? snap.totalUSD - prev.totalUSD : 0;
              const diffPct = prev && prev.totalUSD > 0
                ? ((diff / prev.totalUSD) * 100).toFixed(1)
                : null;
              const date = new Date(snap.savedAt).toLocaleString("zh-CN", {
                month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={snap.savedAt} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: i === 0 ? "#0A0A0F" : "transparent",
                  borderRadius: 8,
                  border: i === 0 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {i === 0 ? "🔴 最新" : date}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    ${snap.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {diffPct && (
                    <div style={{
                      fontSize: 11,
                      color: diff >= 0 ? "#10B981" : "#EF4444",
                    }}>
                      {diff >= 0 ? "+" : ""}{diffPct}%
                    </div>
                  )}
                  <div style={{
                    fontSize: 10, color: "var(--text-secondary)",
                    background: "var(--border)", borderRadius: 4,
                    padding: "2px 6px",
                  }}>
                    健康 {snap.healthScore}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share button */}
      <div style={{ textAlign: "center", marginTop: 24, marginBottom: 8 }}>
        <button
          onClick={() => setShowShare(true)}
          style={{
            background: "var(--accent-soft)",
            border: "1px solid #8B5CF640",
            color: "#8B5CF6", padding: "12px 28px", borderRadius: 10,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          {t("shareReport")}
        </button>
      </div>
    </div>
  );
}

// ── Scanning text (needs lang context) ──────────────────────────
function ScanningText() {
  const { t } = useLang();
  return (
    <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-secondary)" }}>
      {t("scanning")}
    </div>
  );
}

// ── Skeleton Screen ──────────────────────────────────────────────
function Shimmer({ w, h, radius = 8 }: { w: string | number; h: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-2) 50%, var(--bg-card) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function SkeletonReport() {
  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Shimmer w={80} h={12} />
          <Shimmer w={160} h={16} />
        </div>
        <Shimmer w={80} h={34} radius={8} />
      </div>

      {/* Score card */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 32, marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 40, alignItems: "center", marginBottom: 24 }}>
          <Shimmer w={120} h={120} radius={60} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <Shimmer w={140} h={14} />
            <Shimmer w={200} h={40} />
            <div style={{ display: "flex", gap: 24 }}>
              <Shimmer w={80} h={32} />
              <Shimmer w={80} h={32} />
              <Shimmer w={80} h={32} />
            </div>
          </div>
        </div>
        <Shimmer w="100%" h={10} radius={5} />
      </div>

      {/* Alert */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "16px 20px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Shimmer w={180} h={14} />
          <Shimmer w={280} h={12} />
        </div>
        <Shimmer w={80} h={34} radius={8} />
      </div>

      {/* Token list */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Shimmer w={20} h={20} radius={10} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Shimmer w={80} h={14} />
                <Shimmer w={120} h={10} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <Shimmer w={60} h={14} />
                <Shimmer w={80} h={10} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ScanningText />
    </div>
  );
}

// ── Score Breakdown ──────────────────────────────────────────────
function ScoreBreakdown({ data }: { data: WalletData }) {
  const [open, setOpen] = useState(false);

  const factors = [
    {
      label: "SOL 餘額",
      delta: data.solBalance > 1 ? +10 : 0,
      desc: data.solBalance > 1
        ? `持有 ${data.solBalance.toFixed(2)} SOL，基礎分 +10`
        : `SOL 餘額較少（${data.solBalance.toFixed(3)}），未加分`,
      good: data.solBalance > 1,
    },
    {
      label: "高風險代幣",
      delta: data.riskyTokenCount > 3 ? -15 : data.riskyTokenCount > 1 ? -8 : 0,
      desc: data.riskyTokenCount > 3
        ? `持有 ${data.riskyTokenCount} 個高風險代幣，-15`
        : data.riskyTokenCount > 1
        ? `持有 ${data.riskyTokenCount} 個高風險代幣，-8`
        : "高風險代幣數量可控，不扣分",
      good: data.riskyTokenCount <= 1,
    },
    {
      label: "風險集中度",
      delta: data.breakdown?.risky > 50 ? -10 : 0,
      desc: data.breakdown?.risky > 50
        ? `高風險資產占 ${data.breakdown.risky.toFixed(0)}%，過度集中 -10`
        : "風險倉位比例健康，不扣分",
      good: (data.breakdown?.risky ?? 0) <= 50,
    },
    {
      label: "閒置 USDC",
      delta: data.idleUSDC > 100 ? -5 : 0,
      desc: data.idleUSDC > 100
        ? `$${data.idleUSDC.toFixed(0)} USDC 閒置未生息，-5`
        : "無大額閒置 USDC，不扣分",
      good: data.idleUSDC <= 100,
    },
    {
      label: "流動性質押",
      delta: data.tokens.some(t => t.type === "liquid_stake") ? +5 : 0,
      desc: data.tokens.some(t => t.type === "liquid_stake")
        ? "持有 mSOL/jitoSOL 等質押資產，+5"
        : "未使用流動性質押，错失額外收益",
      good: data.tokens.some(t => t.type === "liquid_stake"),
    },
  ];

  const base = 70;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 20, marginBottom: 20,
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", background: "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", padding: 0,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          📊 健康分數是怎麼算的？
        </div>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{open ? "收起 ▲" : "查看详情 ▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Base */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", background: "var(--bg-base)", borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>基礎分</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#8B5CF6" }}>+{base}</span>
          </div>

          {factors.map((f, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              padding: "8px 12px",
              background: f.delta > 0 ? "#0A2010" : f.delta < 0 ? "#1A0808" : "#0A0A0F",
              borderRadius: 8, gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{f.desc}</div>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                color: f.delta > 0 ? "#10B981" : f.delta < 0 ? "#EF4444" : "#475569",
              }}>
                {f.delta > 0 ? `+${f.delta}` : f.delta < 0 ? `${f.delta}` : "±0"}
              </span>
            </div>
          ))}

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px",
            background: "var(--accent-soft)",
            border: "1px solid #8B5CF630",
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>最終健康分</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#8B5CF6" }}>
              {data.healthScore}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendRow({
  type, color, children,
}: {
  type: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{
        background: `${color}20`, color,
        borderRadius: 6, padding: "2px 8px",
        fontSize: 11, whiteSpace: "nowrap",
      }}>{type}</span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{children}</span>
    </div>
  );
}
