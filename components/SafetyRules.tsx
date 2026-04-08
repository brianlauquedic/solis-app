"use client";

import { useState, useEffect } from "react";
import type { SafetyRule } from "@/lib/safety-rules";
import { DEFAULT_RULES, generateRuleId, validateAction } from "@/lib/safety-rules";
import type { StrategyAction } from "@/lib/strategy-compiler";

const STORAGE_KEY = "sakura_safety_rules";

const EXAMPLES = [
  "每次最多動 $100 USDC，只能去 Kamino 和 Marinade",
  "禁止使用任何未知協議，每天最多 $500",
  "只能操作 USDC 和 SOL，每次都要我手動確認",
  "每筆交易不超過 $50，只允許質押操作",
];

function loadRules(): SafetyRule[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as SafetyRule[];
  } catch { /* ok */ }
  // First time: initialize with defaults
  const defaults: SafetyRule[] = DEFAULT_RULES.map(r => ({
    ...r,
    id: generateRuleId(),
    createdAt: Date.now(),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

const ruleTypeLabel: Record<string, string> = {
  max_per_tx: "單筆上限",
  max_per_day: "每日上限",
  whitelist_protocols: "允許協議",
  blacklist_protocols: "禁止協議",
  whitelist_tokens: "允許代幣",
  require_approval: "需要確認",
};

const ruleTypeColor: Record<string, string> = {
  max_per_tx: "var(--gold)",
  max_per_day: "var(--gold)",
  whitelist_protocols: "var(--green)",
  blacklist_protocols: "#FF4444",
  whitelist_tokens: "var(--accent)",
  require_approval: "#FF8C00",
};

function formatRuleValue(rule: SafetyRule): string {
  if (typeof rule.value === "number") return `$${rule.value} USD`;
  if (Array.isArray(rule.value)) {
    if (rule.value.length === 0) return "是";
    return rule.value.join(", ");
  }
  return String(rule.value);
}

export default function SafetyRules() {
  const [rules, setRules] = useState<SafetyRule[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testAction, setTestAction] = useState<string>('{"type":"lend","protocol":"kamino","token":"USDC","amountUsd":150}');
  const [testResult, setTestResult] = useState<{ allowed: boolean; reason?: string; warnings: string[] } | null>(null);

  useEffect(() => {
    setRules(loadRules());
  }, []);

  function saveRules(updated: SafetyRule[]) {
    setRules(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function compile() {
    const text = input.trim();
    if (!text) { setError("請輸入安全規則描述"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/safety-rules/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: { rules: SafetyRule[] } = await res.json();
      // Merge new rules (avoid duplicates by type)
      const existing = rules.filter(r => !data.rules.find(nr => nr.type === r.type));
      saveRules([...data.rules, ...existing]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "編譯失敗");
    } finally {
      setLoading(false);
    }
  }

  function toggleRule(id: string) {
    saveRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function deleteRule(id: string) {
    saveRules(rules.filter(r => r.id !== id));
  }

  function runTest() {
    try {
      const action = JSON.parse(testAction) as StrategyAction;
      const result = validateAction(action, rules);
      setTestResult(result);
    } catch {
      setTestResult({ allowed: false, reason: "無效的 JSON 動作格式", warnings: [] });
    }
  }

  function resetToDefaults() {
    const defaults: SafetyRule[] = DEFAULT_RULES.map(r => ({
      ...r,
      id: generateRuleId(),
      createdAt: Date.now(),
    }));
    saveRules(defaults);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,140,0,0.1)", border: "1px solid rgba(255,140,0,0.3)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF8C00", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#FF8C00", fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
            NL SAFETY RULES
          </span>
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 300, color: "var(--text-primary)",
          fontFamily: "var(--font-heading)", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          🔒 自然語言 AI 安全邊界
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 560 }}>
          用中文設定 AI Agent 的行為邊界 → 自動編譯成執行規則 → 每次 AI 操作前自動驗證。
          讓 AI 只能在你劃定的安全圈內行動。
        </p>
      </div>

      {/* Input */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid #FF8C00",
        borderRadius: 10, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          用自然語言設定安全規則
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="例如：每次最多動 $100 USDC，只能去 Kamino 和 Marinade"
            style={{
              flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13,
              color: "var(--text-primary)", fontFamily: "var(--font-body)",
              outline: "none",
            }}
            onKeyDown={e => e.key === "Enter" && compile()}
          />
          <button
            onClick={compile}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "var(--border)" : "#FF8C00",
              border: "none", borderRadius: 8, padding: "10px 20px",
              fontSize: 13, fontWeight: 500, color: "#fff",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "編譯中…" : "添加規則"}
          </button>
        </div>

        {/* Examples */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                style={{
                  fontSize: 11, color: "var(--text-secondary)",
                  background: "var(--bg-base)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "3px 9px", cursor: "pointer",
                }}
              >
                {ex.slice(0, 18)}…
              </button>
            ))}
          </div>
        </div>
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

      {/* Active rules */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em",
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
          }}>
            安全規則 ({rules.filter(r => r.enabled).length}/{rules.length} 啟用)
          </div>
          <button
            onClick={resetToDefaults}
            style={{
              fontSize: 11, color: "var(--text-muted)",
              background: "none", border: "1px solid var(--border)",
              borderRadius: 4, padding: "3px 10px", cursor: "pointer",
            }}
          >
            重置為預設
          </button>
        </div>

        {rules.length === 0 && (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "20px", textAlign: "center",
            fontSize: 13, color: "var(--text-muted)",
          }}>
            尚無安全規則。請添加規則或點擊「重置為預設」載入預設規則。
          </div>
        )}

        {rules.map(rule => (
          <div key={rule.id} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderLeft: `3px solid ${rule.enabled ? ruleTypeColor[rule.type] ?? "var(--border)" : "var(--border)"}`,
            borderRadius: 8, padding: "12px 16px", marginBottom: 8,
            opacity: rule.enabled ? 1 : 0.5,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, letterSpacing: "0.06em",
                  color: ruleTypeColor[rule.type] ?? "var(--text-muted)",
                  background: `${ruleTypeColor[rule.type] ?? "var(--border)"}18`,
                  border: `1px solid ${ruleTypeColor[rule.type] ?? "var(--border)"}35`,
                  borderRadius: 3, padding: "2px 7px", fontFamily: "var(--font-mono)",
                }}>
                  {ruleTypeLabel[rule.type] ?? rule.type}
                </span>
                <span style={{
                  fontSize: 12, color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {formatRuleValue(rule)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {rule.description}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
              {/* Toggle */}
              <button
                onClick={() => toggleRule(rule.id)}
                title={rule.enabled ? "停用" : "啟用"}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: "none",
                  background: rule.enabled ? "#FF8C00" : "var(--border)",
                  cursor: "pointer", position: "relative", flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: rule.enabled ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }} />
              </button>
              {/* Delete */}
              <button
                onClick={() => deleteRule(rule.id)}
                style={{
                  fontSize: 14, color: "var(--text-muted)",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Test validator */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid var(--accent)",
        borderRadius: 10, padding: "20px 22px",
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 500 }}>
          🧪 規則驗證器 — 測試某個操作是否符合規則
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input
            value={testAction}
            onChange={e => setTestAction(e.target.value)}
            style={{
              flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 12px", fontSize: 12,
              color: "var(--text-primary)", fontFamily: "var(--font-mono)",
              outline: "none",
            }}
          />
          <button
            onClick={runTest}
            style={{
              background: "var(--accent)", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 12, color: "#fff",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            驗證
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
          快速測試：
          {[
            ['{"type":"lend","protocol":"kamino","token":"USDC","amountUsd":50}', '$50 Kamino'],
            ['{"type":"lend","protocol":"unknown","token":"USDC","amountUsd":200}', '$200 未知協議'],
          ].map(([val, label]) => (
            <button
              key={label}
              onClick={() => setTestAction(val)}
              style={{
                marginLeft: 8, fontSize: 11, color: "var(--accent)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                textDecoration: "underline",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {testResult && (
          <div style={{
            background: testResult.allowed ? "rgba(52,199,89,0.08)" : "rgba(255,68,68,0.08)",
            border: `1px solid ${testResult.allowed ? "rgba(52,199,89,0.25)" : "rgba(255,68,68,0.25)"}`,
            borderRadius: 8, padding: "12px 16px",
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: testResult.allowed ? "var(--green)" : "#FF4444",
              marginBottom: testResult.reason || testResult.warnings.length > 0 ? 8 : 0,
            }}>
              {testResult.allowed ? "✅ 操作允許" : "🚫 操作被攔截"}
            </div>
            {testResult.reason && (
              <div style={{ fontSize: 12, color: "#FF4444", marginBottom: 6 }}>
                原因：{testResult.reason}
              </div>
            )}
            {testResult.warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: "#FFD700" }}>
                ⚡ {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
