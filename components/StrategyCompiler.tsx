"use client";

import { useState } from "react";
import type { CompileResult, Strategy } from "@/lib/strategy-compiler";
import { summarizeStrategy } from "@/lib/strategy-compiler";

const EXAMPLES = [
  "每週五把我 50% USDC 存入 Kamino",
  "每天早上 9 點把 30% SOL 質押到 Marinade",
  "當 Kamino APY 比 Marinade 高 2% 時，把 $100 USDC 從 Marinade 移到 Kamino",
  "手動執行：把 $50 USDC 換成 SOL，然後全部質押",
];

export default function StrategyCompiler() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Strategy[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("sakura_strategies") ?? "[]"); }
    catch { return []; }
  });

  async function compile() {
    const text = input.trim();
    if (!text) { setError("請輸入策略描述"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/strategy/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: CompileResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "編譯失敗");
    } finally {
      setLoading(false);
    }
  }

  function saveStrategy() {
    if (!result) return;
    const updated = [result.strategy, ...saved.filter(s => s.id !== result.strategy.id)];
    setSaved(updated);
    localStorage.setItem("sakura_strategies", JSON.stringify(updated));
  }

  function deleteStrategy(id: string) {
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated);
    localStorage.setItem("sakura_strategies", JSON.stringify(updated));
  }

  const triggerLabel: Record<string, string> = {
    manual: "手動觸發",
    cron: "定時執行",
    apy_threshold: "APY 條件",
  };

  const actionLabel: Record<string, string> = {
    lend: "存入借貸",
    stake: "質押",
    swap: "兌換",
    unstake: "解除質押",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
            NL STRATEGY COMPILER
          </span>
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 300, color: "var(--text-primary)",
          fontFamily: "var(--font-heading)", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          ⚙️ 自然語言策略編譯器
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 560 }}>
          用中文描述你的 DeFi 策略 → Claude AI 自動解析成結構化策略 → 一鍵上鏈留證。
          世界首個面向普通用戶的 DeFi 策略自然語言編譯器。
        </p>
      </div>

      {/* Input */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid var(--accent)",
        borderRadius: 10, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          用自然語言描述你的策略
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="例如：每週五把我 50% USDC 存入 Kamino"
          rows={3}
          style={{
            width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", fontSize: 13,
            color: "var(--text-primary)", fontFamily: "var(--font-body)",
            outline: "none", resize: "vertical", boxSizing: "border-box",
            lineHeight: 1.7,
          }}
        />

        {/* Example prompts */}
        <div style={{ marginTop: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>
            範例：
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                style={{
                  fontSize: 11, color: "var(--text-secondary)",
                  background: "var(--bg-base)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {ex.slice(0, 20)}…
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={compile}
          disabled={loading || !input.trim()}
          style={{
            width: "100%",
            background: loading || !input.trim() ? "var(--border)" : "var(--accent)",
            border: "none", borderRadius: 8, padding: "11px 24px",
            fontSize: 13, fontWeight: 500, color: "#fff",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {loading ? "AI 編譯中…" : "✦ 編譯策略"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          fontSize: 13, color: "#FF4444",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Compiled result */}
      {result && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--green)",
          borderRadius: 10, padding: "20px 22px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
          }}>
            <div style={{
              fontSize: 11, color: "var(--green)", letterSpacing: "0.12em",
              fontFamily: "var(--font-mono)", fontWeight: 600,
            }}>
              ✓ 編譯成功 (置信度 {Math.round(result.confidence * 100)}%)
            </div>
            <button
              onClick={saveStrategy}
              style={{
                fontSize: 12, color: "var(--accent)",
                background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
                borderRadius: 6, padding: "5px 12px", cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              + 儲存策略
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
              {result.strategy.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {result.strategy.description}
            </div>
          </div>

          {/* Trigger */}
          <div style={{
            background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
              TRIGGER
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
              {triggerLabel[result.strategy.trigger.type] ?? result.strategy.trigger.type}
              {result.strategy.trigger.schedule && (
                <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)" }}>
                  {result.strategy.trigger.schedule}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{
            background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
              ACTIONS ({result.strategy.actions.length})
            </div>
            {result.strategy.actions.map((action, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                padding: "6px 10px", background: "var(--bg-card)", borderRadius: 6,
                border: "1px solid var(--border)",
              }}>
                <span style={{
                  fontSize: 11, background: "var(--accent-soft)", color: "var(--accent)",
                  border: "1px solid var(--accent-mid)", borderRadius: 4,
                  padding: "2px 7px", fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
                }}>
                  {actionLabel[action.type] ?? action.type}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
                  {action.amountUsd ? `$${action.amountUsd}` : action.amountPct ? `${action.amountPct}%` : ""}
                  {action.token ? ` ${action.token}` : ""}
                  {action.protocol ? ` → ${action.protocol}` : ""}
                </span>
              </div>
            ))}
          </div>

          {/* Safety */}
          <div style={{
            background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "12px 14px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
              SAFETY
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 16 }}>
              <span>最大金額：${result.strategy.safety.maxAmountUsd}</span>
              <span>需要確認：{result.strategy.safety.requireApproval ? "是" : "否"}</span>
              <span>最大滑點：{result.strategy.safety.maxSlippagePct}%</span>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{
              background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)",
              borderRadius: 6, padding: "10px 14px",
            }}>
              <div style={{ fontSize: 11, color: "#FFD700", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                ⚡ 編譯提示
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  • {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved strategies */}
      {saved.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 12, fontFamily: "var(--font-mono)",
          }}>
            已儲存策略 ({saved.length})
          </div>
          {saved.map(strategy => (
            <div key={strategy.id} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "14px 16px", marginBottom: 8,
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
                  {strategy.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {summarizeStrategy(strategy)}
                </div>
              </div>
              <button
                onClick={() => deleteStrategy(strategy.id)}
                style={{
                  fontSize: 12, color: "var(--text-muted)",
                  background: "none", border: "none", cursor: "pointer", padding: "0 0 0 12px",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
