# Sakura · Competitive Matrix

> Dated 2026-04-21. Supersedes the v0.2 product-feature analysis.
> Project data from Colosseum Copilot (builder projects corpus,
> 5,400+ Solana submissions). URLs use the `arena.colosseum.org/projects/explore/<slug>`
> pattern. "As of" qualifier: our knowledge is bounded by the Copilot corpus;
> absence of evidence is not evidence of absence.

---

## The containment problem, four published answers

The problem Sakura solves is: *how do you constrain what an AI agent
can do with a user's money, in a way the agent's operator cannot
override?*

Four Solana projects (outside Sakura) have published a response to
some form of this problem between 2025-04 and 2025-09. None gates
the action before it lands.

| Project | Hackathon | Approach | Does a bad action land? | Closest conceptual match to Sakura |
|---|---|---|---|---|
| [Signed AI](https://arena.colosseum.org/projects/explore/signed-ai) | Breakout 2025-04 | Every decision signed by the agent; action + signature recorded as a compressed NFT on-chain for later audit | **Yes**. Receipt is minted *after* the action executes. | Same domain; opposite stance (audit, not gate) |
| [AgentRunner](https://arena.colosseum.org/projects/explore/agentrunner) | Cypherpunk 2025-09 | Agent marketplace + per-step x402 micropayments; receipts roll into a daily Merkle root anchored on-chain | **Yes**. Merkle root is *daily* and *post-hoc*. | Closest x402 + audit overlap; no cryptographic gating of individual actions |
| [AgentCred](https://arena.colosseum.org/projects/explore/agent-cred) | Cypherpunk 2025-09 | Hot-key / cold-key split (hot key holds operating balance; cold key holds the rest) with real-time balance monitoring | **Yes, up to the hot-key balance.** Policy is economic, not cryptographic. | The "policy instead of primitive" anti-pattern Sakura replaces |
| [Intentauri](https://arena.colosseum.org/projects/explore/intentauri) | Cypherpunk 2025-09 | Intent-based transaction execution platform (sparse public description) | Undetermined from public materials | Shares "intent" vocabulary; no published enforcement mechanism |

### Why preventive beats detective, when user funds are the unit of loss

Receipts, audits, and balance monitors are valuable for *after-the-fact*
accountability. They answer "who did what." They do not answer "can
this be stopped?" For agents that sign transactions with authority
over a user's funds, the class of loss (principal of the deposit) is
not recoverable by audit alone — the auditee and the counterparty
are the same opaque agent stack. Sakura's differentiation is not the
circuit primitive itself (Groth16 on `alt_bn128` is a commodity since
Protocol 1.17, Q3 2024). It is the decision to put the verifier
*upstream* of the signer, not downstream.

---

## Intent-layer adjacents

These projects use "intent" language but operate at a different layer
than Sakura. They are not competitors; they are potential integrators.

| Project | Hackathon / accelerator status | What it does | Why it is not a Sakura competitor |
|---|---|---|---|
| [URANI](https://arena.colosseum.org/projects/explore/urani) | Renaissance 2024-03 · **Colosseum Accelerator Cohort 1** · \$250K pre-seed | Intent-based swap aggregator with MEV protection | Operates at the *DEX aggregation* layer, not the *agent-execution* layer. An intent-based swap could itself be a Sakura-gated action. |
| [Intentauri](https://arena.colosseum.org/projects/explore/intentauri) | Cypherpunk 2025-09 | Intent-based transaction execution platform | No published bounds-enforcement mechanism. Sakura could underlie an Intentauri-style UX. |

---

## x402 + MCP adjacents (payment layer)

Sakura ships an MCP endpoint at `/api/mcp` with x402 pricing ($1 per
call). Several projects compete in the x402-payment-layer space
itself; none compete with Sakura's gate.

| Project | Hackathon | Positioning relative to Sakura |
|---|---|---|
| [Latinum Agentic Commerce](https://arena.colosseum.org/projects/explore/latinum-agentic-commerce) | Breakout 2025-04 (AI track) | Payment middleware + MCP-compatible wallet for agent-to-service payments. **Complementary**: a Latinum-enabled agent paying for an MCP tool could still be Sakura-gated on its DeFi side. |
| [MCPay](https://arena.colosseum.org/projects/explore/mcpay) | Cypherpunk 2025-09 (Stablecoin track · Accelerator Cohort 4) | Monetize MCP tools via x402. **Complementary**: same layer as Latinum, not overlapping with the Sakura gate. |
| [Tedix](https://arena.colosseum.org/projects/explore/tedix-ai-commerce-powered-by-solana) · [SolAIBot](https://arena.colosseum.org/projects/explore/solaibot) | Cypherpunk 2025-09 | Agent-to-service x402 payment infrastructure. Same layer; complementary. |

**Implication**: the x402 revenue path in Sakura's economics is
genuinely crowded at the tool-monetization layer. It is not a
differentiator by itself; Sakura's differentiation is upstream, at
the gate. The MCP endpoint exists as a developer surface, not as a
core revenue moat.

---

## ZK-on-Solana precedent (circuit primitive, different use case)

The Groth16 + `alt_bn128` composition is well-established on Solana.
Sakura's technical novelty is the *schema* (what is being proved),
not the *stack* (the proof system).

| Project | Hackathon | Use of ZK |
|---|---|---|
| [Blackpool](https://arena.colosseum.org/projects/explore/blackpool) | Radar 2024-09 | Privacy-preserving, MEV-resistant DEX |
| [Encifher](https://arena.colosseum.org/projects/explore/encifher) | Breakout 2025-04 | Privacy layer for DeFi strategy execution |
| [Cloak](https://arena.colosseum.org/projects/explore/cloak-or-solana-privacy-layer) | Cypherpunk 2025-09 | Anonymous-payment mixer layer |
| [Hush](https://arena.colosseum.org/projects/explore/hush) | Breakout 2025-04 | Anonymous token transfers |
| [zkyc](https://arena.colosseum.org/projects/explore/zkyc) | Radar 2024-09 | One-time identity verification |

All operate in the **privacy** use-case. Sakura's use case — binding
an execution action to a user-signed policy via a Poseidon-tree
commitment — has no overlap beyond the shared proof system.

---

## Hardware / consumer-wallet adjacents (potential integrators)

| Project | Hackathon / accelerator | Relationship to Sakura |
|---|---|---|
| [Unruggable](https://arena.colosseum.org/projects/explore/unruggable-3) | Cypherpunk 2025-09 · Total Winner · Cohort 4 | Solana-native hardware wallet. **Integration candidate**: a hardware-wallet user running an AI agent is exactly Sakura's target surface. |
| [Backpack / Phantom / Abstract / Infinex](https://vercel.com) | — (shipping in 2026H1 per public roadmaps) | Consumer wallets releasing AI-agent modes. Sakura's core integration thesis. |

---

## Verifiable-AI cousin (Sakura AI Agent Hackathon)

One project from the February 2026 Colosseum AI Agent Hackathon
deserves a named callout:

- **SOLPRISM** (agent-submitted project, Mereum framework) — uses a
  commit-reveal scheme to make AI *reasoning* verifiable on-chain.
  Overlaps with the *provability* frame of Sakura, but operates on
  *reasoning* (what the model thought) rather than *action bounds*
  (what the agent is allowed to do with funds). If SOLPRISM re-enters
  Frontier, its overlap is in narrative, not mechanism.

---

## Where Sakura fits, in one paragraph

The Solana builder corpus contains, as of 2026-04-21, four published
responses to the AI-agent containment problem. None of them gate the
action cryptographically before it executes. Sakura is the first to
do so at the protocol level, using a production-viable Groth16
verifier that has only existed on Solana since 2024-Q3 and a Pyth
pull-oracle binding that has only existed since 2025-Q2. The circuit
primitive is shared with the privacy-layer projects (Blackpool,
Encifher, Hush, Cloak); the *schema* — a 1,909-constraint compilation
from a natural-language intent into a 32-byte Poseidon commitment
that every agent action must prove against — is not shared with any
project the corpus returns.

---

## Methodology

- **Source**: Colosseum Copilot `search/projects` across five queries
  spanning "zero-knowledge proof intent DeFi agent bounds verifier",
  "agentic wallet containment session key AI DeFi safety",
  "intent based execution agent policy" (accelerator-only filter),
  "Groth16 zero knowledge proof Solana verifier" (winners-only
  filter), and "MCP server x402 HTTP 402 machine payments AI agent
  Solana".
- **Verification**: each project cited here had its full metadata
  retrieved via `/projects/by-slug/:slug` — hackathon, track,
  accelerator status, and description are from the original
  submission rather than summary.
- **Boundary**: Copilot covers 5,400+ Solana Colosseum submissions.
  It does not cover GitHub, Devpost, ETHGlobal, Ethereum-ecosystem
  projects, or pre-Colosseum Solana work. Competitive coverage
  outside this corpus requires separate research.
