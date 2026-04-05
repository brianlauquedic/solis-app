"use client";

import { useState, useEffect } from "react";
import type { AgentType, AgentConfig } from "@/app/api/agent-factory/parse/route";

// ── Types ────────────────────────────────────────────────────────
interface SavedAgent extends AgentConfig {
  id: string;
  enabled: boolean;
  createdAt: number;
}

const STORAGE_KEY = "sakura_agents";
const ICONS: Record<AgentType, string> = {
  price_alert:      "🔔",
  auto_trade:       "📈",
  scheduled_report: "📊",
  smart_copy:       "🐋",
};
const TYPE_LABELS: Record<AgentType, string> = {
  price_alert:      "價格警報",
  auto_trade:       "自動交易",
  scheduled_report: "定時報告",
  smart_copy:       "聰明錢跟單",
};

function loadAgents(): SavedAgent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedAgent[];
  } catch { return []; }
}
function saveAgents(agents: SavedAgent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

// ── Template cards ────────────────────────────────────────────────
const TEMPLATES: { icon: string; label: string; example: string; type: AgentType }[] = [
  { icon: "🔔", label: "價格警報",    example: "SOL 跌到 $140 提醒我",       type: "price_alert" },
  { icon: "📈", label: "自動交易",    example: "WIF > $0.20 自動買 $50",      type: "auto_trade" },
  { icon: "📊", label: "定時報告",    example: "每天早9點生成市場報告",       type: "scheduled_report" },
  { icon: "🐋", label: "聰明錢跟單",  example: "聰明錢共識 ⭐⭐⭐ 以上通知", type: "smart_copy" },
];

// ── Main Component ────────────────────────────────────────────────
export default function AgentFactory() {
  const [agents, setAgents]           = useState<SavedAgent[]>([]);
  const [input, setInput]             = useState("");
  const [parsing, setParsing]         = useState(false);
  const [parsed, setParsed]           = useState<(AgentConfig & { error?: string }) | null>(null);
  const [parseError, setParseError]   = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);

  useEffect(() => { setAgents(loadAgents()); }, []);

  async function handleParse() {
    if (!input.trim() || parsing) return;
    setParsing(true); setParsed(null); setParseError(null); setSaved(false);
    try {
      const res = await fetch("/api/agent-factory/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: input }),
      });
      const data = await res.json() as AgentConfig & { error?: string };
      if (data.error || !data.type) {
        setParseError(data.error ?? "解析失敗，請重新描述");
      } else {
        setParsed(data);
      }
    } catch {
      setParseError("網絡錯誤，請重試");
    } finally {
      setParsing(false);
    }
  }

  function handleConfirm() {
    if (!parsed || !parsed.type) return;
    const newAgent: SavedAgent = {
      ...parsed,
      id: crypto.randomUUID(),
      enabled: true,
      createdAt: Date.now(),
    };
    const updated = [newAgent, ...agents];
    setAgents(updated);
    saveAgents(updated);
    setParsed(null);
    setInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleToggle(id: string) {
    const updated = agents.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    setAgents(updated);
    saveAgents(updated);
  }

  function handleDelete(id: string) {
    const updated = agents.filter(a => a.id !== id);
    setAgents(updated);
    saveAgents(updated);
  }

  function useTemplate(example: string) {
    setInput(example);
    setParsed(null);
    setParseError(null);
  }

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 20px 24px",
      marginTop: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--accent-soft)", border: "1px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>🏭</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
            Agent Workshop
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            用自然語言創建自動化 Agent
          </div>
        </div>
      </div>

      {/* Template chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TEMPLATES.map(t => (
          <button
            key={t.type}
            onClick={() => useTemplate(t.example)}
            style={{
              background: "var(--bg-card-2)", border: "1px solid var(--border)",
              borderRadius: 20, padding: "5px 12px", cursor: "pointer",
              fontSize: 11, color: "var(--text-secondary)",
              display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget.style.borderColor = "var(--accent)"); (e.currentTarget.style.color = "var(--text-primary)"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "var(--border)"); (e.currentTarget.style.color = "var(--text-secondary)"); }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
          placeholder='例："SOL 跌到 $140 提醒我" 或 "每天早9點報告"'
          style={{
            flex: 1, background: "var(--bg-card-2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)",
            fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={handleParse}
          disabled={!input.trim() || parsing}
          style={{
            background: input.trim() && !parsing ? "var(--accent)" : "var(--bg-card-2)",
            border: "none", borderRadius: 8, padding: "0 18px",
            color: input.trim() && !parsing ? "#fff" : "var(--text-muted)",
            fontSize: 13, fontWeight: 600, cursor: input.trim() && !parsing ? "pointer" : "not-allowed",
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}
        >
          {parsing ? "解析中…" : "AI 解析"}
        </button>
      </div>

      {/* Parse error */}
      {parseError && (
        <div style={{
          background: "rgba(168,41,58,0.10)", border: "1px solid rgba(168,41,58,0.30)",
          borderRadius: 8, padding: "10px 14px", fontSize: 12,
          color: "var(--red)", marginBottom: 12,
        }}>
          ⚠ {parseError}
        </div>
      )}

      {/* Parsed result confirmation */}
      {parsed && parsed.type && (
        <div style={{
          background: "var(--accent-soft)", border: "1px solid var(--accent)",
          borderRadius: 10, padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>{ICONS[parsed.type]}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {parsed.displayName}
              </div>
              <div style={{ fontSize: 11, color: "var(--accent)" }}>
                {TYPE_LABELS[parsed.type]}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
            {parsed.confirmText}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleConfirm}
              style={{
                background: "var(--accent)", border: "none", borderRadius: 8,
                padding: "8px 20px", color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✓ 確認創建
            </button>
            <button
              onClick={() => setParsed(null)}
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 16px",
                color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {saved && (
        <div style={{
          background: "rgba(61,122,92,0.15)", border: "1px solid var(--green)",
          borderRadius: 8, padding: "10px 14px", fontSize: 12,
          color: "var(--green)", marginBottom: 12,
        }}>
          ✓ Agent 已創建並啟用
        </div>
      )}

      {/* Agent list */}
      {agents.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10, marginTop: 4 }}>
            我的 Agent（{agents.filter(a => a.enabled).length}/{agents.length} 啟用中）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {agents.map(agent => (
              <div
                key={agent.id}
                style={{
                  background: "var(--bg-card-2)", border: `1px solid ${agent.enabled ? "var(--border-light)" : "var(--border)"}`,
                  borderRadius: 8, padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                  opacity: agent.enabled ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 18 }}>{ICONS[agent.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {agent.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                    {TYPE_LABELS[agent.type]} · {new Date(agent.createdAt).toLocaleDateString("zh-TW")}
                  </div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(agent.id)}
                  title={agent.enabled ? "暫停" : "啟用"}
                  style={{
                    background: agent.enabled ? "var(--green)" : "var(--bg-card)",
                    border: `1px solid ${agent.enabled ? "var(--green)" : "var(--border)"}`,
                    borderRadius: 20, padding: "3px 10px",
                    color: agent.enabled ? "#fff" : "var(--text-secondary)",
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {agent.enabled ? "啟用" : "暫停"}
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(agent.id)}
                  title="刪除"
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: 14, padding: "2px 4px",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.color = "var(--red)"); }}
                  onMouseLeave={e => { (e.currentTarget.style.color = "var(--text-muted)"); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && !parsed && !parseError && (
        <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: 12 }}>
          尚無 Agent — 輸入描述即可創建你的第一個 Agent
        </div>
      )}
    </div>
  );
}
