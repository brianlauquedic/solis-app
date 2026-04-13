import { ImageResponse } from "next/og";
import { getRun } from "@/lib/run-store";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const alt = "Ghost Run · Proof-of-Simulation Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id).catch(() => null);

  const strategy = run?.strategy?.slice(0, 72) ?? "Solana DeFi Strategy";
  const commitmentId = run?.commitmentId ?? "GR-XXXXXXXX";
  const ts = run ? new Date(run.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  // Read WaBijin logo from public folder and encode as base64 data URL
  let logoDataUrl: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-bijin.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch { /* fallback to emoji */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0A0A14 0%, #0F0A1E 50%, #0A0F1A 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -120, right: -80,
          width: 480, height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          display: "flex",
        }} />

        {/* Top: Logo + badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* WaBijin avatar */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              overflow: "hidden", flexShrink: 0,
              border: "2px solid rgba(139,92,246,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, #1E1340, #0F0A1E)",
            }}>
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} width={56} height={56} alt="Sakura" style={{ objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 30 }}>🌸</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", letterSpacing: 1 }}>
                Sakura
              </span>
              <span style={{ fontSize: 11, color: "#475569", letterSpacing: 3 }}>
                AI SECURITY LAYER · SOLANA
              </span>
            </div>
          </div>
          <div style={{
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: 8, padding: "7px 18px",
            fontSize: 13, fontWeight: 700, color: "#8B5CF6", letterSpacing: 2,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            👻 GHOST RUN REPORT
          </div>
        </div>

        {/* Middle: Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#8B5CF6",
            letterSpacing: 3, display: "flex", alignItems: "center", gap: 6,
          }}>
            ⛩️ PROOF-OF-SIMULATION · ONCHAIN COMMITMENT
          </div>

          <div style={{
            fontSize: strategy.length > 50 ? 26 : 32,
            fontWeight: 700, color: "#F1F5F9", lineHeight: 1.35,
            maxWidth: 860,
          }}>
            {strategy}{run?.strategy && run.strategy.length > 72 ? "…" : ""}
          </div>

          <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>COMMITMENT ID</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: "#A78BFA", fontFamily: "monospace" }}>
                {commitmentId}
              </span>
            </div>
            {ts && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>DATE</span>
                <span style={{ fontSize: 15, color: "#64748B" }}>{ts}</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>STATUS</span>
              <span style={{ fontSize: 15, color: "#10B981", fontWeight: 600 }}>✓ Pre-execution verified</span>
            </div>
          </div>
        </div>

        {/* Bottom: Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: "1px solid #1E293B", paddingTop: 18,
        }}>
          <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace" }}>
            sakuraaai.com/run/{id}
          </span>
          <span style={{ fontSize: 12, color: "#1E293B" }}>
            SHA-256 committed on Solana mainnet before execution
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
