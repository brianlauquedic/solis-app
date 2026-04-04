# Solis — Solana AI Financial Advisor

> **Colosseum Frontier Hackathon 2026** · DeFi + AI Track · April 6 – May 11

Solis is a Solana-native AI financial advisor that helps retail users analyze risk, discover yield opportunities, and execute DeFi strategies — all in natural language, with every AI recommendation verifiable on-chain.

---

## What It Does

| Feature | Details |
|---------|---------|
| **🏥 Wallet Health Report** | Scans holdings, flags high-risk tokens via GoPlus Security, surfaces idle yield opportunities |
| **🔍 Token Safety Analysis** | Security score (0–100) across 5 risk dimensions: mint authority, holder concentration, liquidity, honeypot detection, LP lock |
| **💬 AI DeFi Assistant** | Claude-powered natural language advisor — ask in Chinese, get actionable recommendations with live APY |
| **⛓ One-Click Execution** | In-app swap (Jupiter), stake (Marinade/Jito), and lend (Kamino) — no redirect to external sites |
| **🔐 Verifiable AI Reasoning** | Every AI recommendation hashed (SHA-256) and writable to Solana Memo — publicly auditable at `/verify` |

---

## Why Solis

**The problem:** 90%+ of Solana retail users leave yield on the table because DeFi UX is fragmented — checking prices on Birdeye, yields on DeFiLlama, executing on multiple protocol frontends, with no safety net against rug pulls.

**Solis solves this in one place:**
1. Connect wallet → instant portfolio health check
2. Ask "what should I do with my SOL?" → get AI recommendations with live APY data
3. Execute in one click with Phantom — 0.3% platform fee collected transparently

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 16+ App Router             │
├────────────┬────────────┬────────────┬───────────────┤
│  Health    │  Token     │  DeFi AI   │   /verify     │
│  Report    │  Analysis  │  Assistant │   (proof)     │
└────────────┴────────────┴────────────┴───────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         /api/wallet  /api/token  /api/defi-chat
         /api/yield   /api/swap   /api/stake
                      /api/lend
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Helius RPC        GoPlus Security   Claude API
   Jupiter Price     Jupiter Token     (haiku-4-5)
   Marinade API      Kamino API
   Jito (via Jup)    Raydium API
```

**Solana AI Ecosystem integrations:**
- **Solana Agent Kit** (`solana-agent-kit`) — on-chain action primitives
- **Solana MCP** (`.mcp.json` → `mcp.solana.com/mcp`) — model context protocol
- **Solana Memo Program** — on-chain verifiable reasoning proofs
- **Jupiter v6 API** — optimal swap routing with 0.3% platform fee
- **Verifiable Compute** — SHA-256 reasoning hash written to chain

---

## Monetization (Implemented)

| Stream | Mechanism | Status |
|--------|-----------|--------|
| **Execution Fee** | 0.3% on every Jupiter swap via `platformFeeBps=30` | ✅ Live |
| **Protocol Referral** | Marinade / Kamino referral codes (env config) | ✅ Wired |
| **Subscription** | Premium AI analysis tier | 🔜 Planned |

---

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Blockchain:** `@solana/web3.js`, Phantom wallet, Solana Agent Kit
- **AI:** Anthropic Claude API (`claude-haiku-4-5`) + rule-based fallback
- **Data:** Helius RPC, GoPlus Security, Jupiter Price/Swap API, Marinade API, Kamino API, Raydium API
- **Verification:** SHA-256 commit-reveal, Solana Memo Program

---

## Local Development

```bash
git clone <repo>
cd quedic-app
npm install

# Configure environment
cp .env.example .env.local
# Add: ANTHROPIC_API_KEY, HELIUS_API_KEY, NEXT_PUBLIC_HELIUS_RPC
# Optional: MARINADE_REFERRAL_CODE, KAMINO_REFERRAL_CODE

npm run dev
# Open http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI responses |
| `HELIUS_API_KEY` | Yes | Helius RPC for wallet/token data |
| `NEXT_PUBLIC_HELIUS_RPC` | Yes | Public RPC URL for frontend |
| `MARINADE_REFERRAL_CODE` | No | Marinade referral code (~0.1% reward) |
| `KAMINO_REFERRAL_CODE` | No | Kamino referral code |

---

## Key API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/wallet` | GET | Fetch wallet holdings, prices, total USD |
| `/api/token` | GET | Token security analysis (GoPlus + Jupiter) |
| `/api/yield` | GET | Live APY from Marinade, Jito, Kamino, Solend, Raydium |
| `/api/defi-chat` | POST | AI chat (Claude + rule fallback) with reasoning hash |
| `/api/swap` | GET/POST | Jupiter swap quote + build VersionedTransaction |
| `/api/stake` | GET/POST | Marinade/Jito stake preview + transaction |
| `/api/lend` | GET/POST | Kamino USDC deposit preview + transaction |

---

## Verifiable AI Reasoning

Every AI recommendation generates a SHA-256 hash of:
- User message + AI response
- Wallet context (total USD)
- Inference engine used (`claude-haiku-4-5` or `rule-based`)
- Unix timestamp

Users can write this hash to Solana via a one-click Memo transaction. Anyone can verify the original reasoning at `/verify`.

This implements [Solana's Verifiable Compute](https://solana.com/ai) narrative — transparent, auditable AI reasoning on-chain.

---

## Hackathon Alignment

| Criteria | Implementation |
|----------|---------------|
| **Most Agentic** | One-click swap/stake/lend via Phantom — no external redirects |
| **Real Product** | Live APIs, real transactions, 0.3% fee collected on execution |
| **On-chain Action** | Swap, stake, lend, Memo write — all signed on-chain |
| **Verifiable Compute** | SHA-256 reasoning hash writable to Solana Memo |
| **Business Model** | Platform fee + referral revenue, no token dependency |
| **MVP** | Fully runnable, not a prototype — connect any Solana wallet |

---

## Project Structure

```
app/
  page.tsx              # Main dashboard (wallet connect + tabs)
  verify/page.tsx       # Verifiable reasoning proof explorer
  api/
    wallet/route.ts     # Portfolio data (Helius + Jupiter prices)
    token/route.ts      # Token security (GoPlus + DAS)
    yield/route.ts      # Live APY aggregation
    defi-chat/route.ts  # AI chat + reasoning hash generation
    swap/route.ts       # Jupiter swap with platform fee
    stake/route.ts      # Marinade / Jito staking
    lend/route.ts       # Kamino USDC lending

components/
  WalletConnect.tsx     # Phantom + manual address entry
  HealthReport.tsx      # Portfolio health dashboard
  TokenAnalysis.tsx     # Security analysis + on-chain proof
  DefiAssistant.tsx     # AI chat + action cards
  SwapModal.tsx         # Jupiter swap execution modal
  StakeModal.tsx        # Marinade/Jito stake modal
  LendModal.tsx         # Kamino lend modal

lib/
  proof-store.ts        # Local SHA-256 proof storage
```

---

Built for **Colosseum Frontier Hackathon 2026** (April 6 – May 11)
Track: DeFi + AI · Agentic Economy
