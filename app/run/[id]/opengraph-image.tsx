import { ImageResponse } from "next/og";
import { getRun } from "@/lib/run-store";

export const runtime = "nodejs";
export const alt = "Ghost Run · Proof-of-Simulation Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id).catch(() => null);

  const strategy = run?.strategy?.slice(0, 72) ?? "Solana DeFi Strategy";
  const commitmentId = run?.commitmentId ?? "GR-XXXXXXXX";
  const ts = run
    ? new Date(run.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: "linear-gradient(135deg, #0A0A14 0%, #0F0A1E 50%, #0A0F1A 100%)",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px",
          fontFamily: "sans-serif",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Purple glow top-right */}
        <div style={{
          position: "absolute", top: -120, right: -80,
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)",
          display: "flex",
        }} />
        {/* Pink glow bottom-left */}
        <div style={{
          position: "absolute", bottom: -80, left: -40,
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 65%)",
          display: "flex",
        }} />

        {/* ── TOP: Logo mark + title + badge ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Sakura logo mark — pure CSS, no external deps */}
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: "linear-gradient(135deg, #7C3AED, #4F1D96)",
              border: "1px solid rgba(139,92,246,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, flexShrink: 0,
            }}>
              🌸
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#F1F5F9", letterSpacing: "0.04em" }}>
                Sakura
              </span>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em" }}>
                AI SECURITY LAYER · SOLANA
              </span>
            </div>
          </div>

          {/* Badge */}
          <div style={{
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.35)",
            borderRadius: 10, padding: "9px 22px",
            fontSize: 14, fontWeight: 700, color: "#A78BFA", letterSpacing: "0.12em",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            👻 GHOST RUN REPORT
          </div>
        </div>

        {/* ── MIDDLE: Proof header + strategy + metadata ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 11, fontWeight: 700, color: "#8B5CF6", letterSpacing: "0.22em",
          }}>
            <span>⛩️</span>
            <span>PROOF-OF-SIMULATION  ·  ONCHAIN COMMITMENT</span>
          </div>

          <div style={{
            fontSize: strategy.length > 55 ? 26 : 32,
            fontWeight: 700, color: "#F1F5F9",
            lineHeight: 1.3, maxWidth: 900,
          }}>
            {strategy}{run?.strategy && run.strategy.length > 72 ? "…" : ""}
          </div>

          {/* Metadata row */}
          <div style={{ display: "flex", gap: 48, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", fontWeight: 600 }}>COMMITMENT ID</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#A78BFA", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                {commitmentId}
              </span>
            </div>
            {ts && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", fontWeight: 600 }}>DATE</span>
                <span style={{ fontSize: 16, color: "#475569" }}>{ts}</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", fontWeight: 600 }}>VERIFIED</span>
              <span style={{
                fontSize: 15, fontWeight: 700, color: "#10B981",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                ✓ Pre-execution
              </span>
            </div>
          </div>
        </div>

        {/* ── BOTTOM: URL + tagline ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: "1px solid #1E293B", paddingTop: 20,
        }}>
          <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace", letterSpacing: "0.04em" }}>
            sakuraaai.com/run/{id}
          </span>
          <span style={{ fontSize: 11, color: "#1E293B", letterSpacing: "0.06em" }}>
            SHA-256 committed on Solana mainnet before execution
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
