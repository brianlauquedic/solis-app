# Incident library — what bounded-intent verification would have changed

A catalog of real Solana wallet / agent / bot exploits from 2024–2026.
For each: the attack vector, the dollar loss, and an **honest**
counter-factual analysis of whether Sakura's bounded-intent ZK
primitive would have prevented, bounded, or been orthogonal to the
loss.

This document complements [`docs/WHY-BOUNDED-INTENT.md`](WHY-BOUNDED-INTENT.md)
(which argues the protocol-mechanics case for the primitive) by
grounding the argument in observed harm. It is also deliberately
self-critical: **Sakura is not a silver bullet**, and the counter-
factual column is honest about which incidents are in-scope vs. out
of scope.

## How to read "Sakura counter-factual"

Three classes:

1. **Prevented by non-custodial model** — incident required the
   user to hand over their private key. Sakura's architecture never
   asks for that: the agent operates via the user-signed intent, not
   the user's key. Adopting the Sakura pattern means the attack
   surface doesn't exist.
2. **Bounded by per-action caps** — incident could still happen but
   the user-signed `max_amount` + `max_usd_value` clip the maximum
   single-action loss. Instead of "entire wallet," the loss is
   capped at the intent bound (typically $500–$5k per action).
3. **Out of scope** — attack happened at a layer Sakura does not
   guard (platform insiders, cross-chain bridge code, oracle
   manipulation of a protocol Sakura doesn't gate). Listed anyway
   for honest framing.

---

## 2025-01 · NoOnes cross-chain bridge · $7.9–8M

**Vector**: A vulnerability in NoOnes' Solana cross-chain bridge
enabled hot-wallet drainage through hundreds of small transactions,
affecting users across multiple chains.

**Sakura counter-factual**: **Out of scope.** Sakura gates
user-originated agent actions against the user's own intent bound.
NoOnes' attack was on the platform's hot wallet (custodial
infrastructure), not on user-owned wallets. Sakura does not inspect
bridge-contract code or custodial operator hot-wallet isolation.

Structural lesson: large custodial hot wallets concentrate risk that
non-custodial bounded-intent architectures avoid by construction.

Source: [Helius · Solana Hacks, Bugs, and Exploits (comprehensive history)](https://www.helius.dev/blog/solana-hacks)

---

## 2024-11 · DEXX memecoin platform · $30M across 900+ users

**Vector**: DEXX displayed users' private keys in plaintext on its
official server during `export_wallet` requests; an attacker
harvested them and drained 8,620+ Solana wallets holding a mix of SOL,
memecoin tokens, and LP positions.

**Sakura counter-factual**: **Prevented by non-custodial model.**
DEXX's model required users to surrender their private keys to a
centralized service to enable bot-driven trading. In the Sakura model,
the agent (bot) never sees the user's private key. Trading authority
is granted via a signed intent with a hash commitment on-chain; the
agent produces a ZK proof per action that the action fits the intent.
No server-side key storage = no key to leak.

Note: this requires the bot vendor to adopt the Sakura pattern. But
bots that do so can offer the same UX without the liability.

Sources:
- [Elliptic · Over $5.8 Million Drained in Solana Wallet Exploit (covers earlier drainer of same class)](https://www.elliptic.co/blog/analysis/over-5-8-million-drained-in-solana-wallet-exploit)
- [BraveNewCoin · DEXX Hack Investigation (8,612 wallet trace)](https://bravenewcoin.com/insights/dexx-hack-investigation-unveils-over-8600-solana-wallet-links-slowmist-report)
- [Helius · Solana Hacks history](https://www.helius.dev/blog/solana-hacks)

---

## 2024-11 · ChatGPT AI-poisoning single-user drain · $2,500

**Vector**: User asked ChatGPT for code to interact with a Solana
application. The model served a malicious API endpoint as part of its
generated code; the user pasted their private key into the "API" to
authenticate; the API was attacker-controlled and drained the wallet
of SOL + USDC within minutes.

**Sakura counter-factual**: **Prevented by non-custodial model.** The
root action was the user handing a private key to a code-generated
"API" — an interaction that does not exist in Sakura's pattern. An
LLM-generated Sakura integration would generate code that (a) prompts
the user's own wallet to sign an intent, (b) passes the agent a
bounded intent commitment, (c) the agent produces a proof per action.
At no point is the key pasted into any endpoint.

Structural lesson: as LLM-generated crypto code proliferates,
interaction patterns that never ask for a key are safer by
construction than patterns that sometimes do.

Source: [Cryptopolitan · First case of AI-poisoning attack on Solana wallet](https://www.cryptopolitan.com/solana-wallet-exploit-ai-poisoning-attack/)

---

## 2024-09 · Banana Gun Telegram oracle · $1.4M across 11 primary targets

**Vector**: An attacker exploited a Telegram message oracle inside
Banana Gun's bot infrastructure, intercepting manual wallet transfer
messages during live trading. 36 wallets affected in total.

**Sakura counter-factual**: **Bounded by per-action caps (partial).**
Banana Gun's bot users had granted the bot wide authority. A Sakura
user granting the same authority via a signed intent with `max_amount`
= $5,000 per action would have capped individual action losses at
$5k — the bot could still have been exploited, but the per-user
blast radius would have been the intent cap × however many actions the
attacker could chain before the user revoked the intent (typically
$20–50k, not the full wallet balance).

Caveat: if the attacker acts fast enough to drain multiple allowed
actions before the user notices and revokes, the bound is
`max_actions × max_per_action`, not a single cap. Sakura's per-action
nonce + ActionRecord PDA at least makes every action publicly
traceable on-chain, which is a detection speed-up vs. opaque bot
custody.

Sources:
- [Decrypt · Solana wallets drained, BONKbot denies link (related class)](https://decrypt.co/224127/solana-wallets-drained-523k-bonkbot-denies-link)
- [Helius · Solana Hacks history (Banana Gun entry)](https://www.helius.dev/blog/solana-hacks)

---

## 2024-03 · Solareum Telegram bot insider compromise · $520K–$1.4M across 300+ users

**Vector**: Private keys that users had imported into the Solareum
Telegram bot were accessed by an insider (allegedly a North Korean
developer hired by the team) via a third-party MongoDB connection URL
vulnerability. Approximately 2,808–6,045 SOL drained across 302+
users. Platform shut down within a week.

**Sakura counter-factual**: **Prevented by non-custodial model.**
Solareum's architecture required users to import their private keys
into the bot's server-side storage, where a compromised insider could
exfiltrate them in bulk. Sakura's model stores no keys server-side:
the agent receives a bounded intent with a hash commitment and a
per-action ZK proving witness; the user's private key never leaves the
browser or the wallet extension.

Same pattern as DEXX: different attacker, same root cause, same
prevention mechanism.

Sources:
- [CryptoTimes · Solareum Shuts Down Following $520K Exploit](https://www.cryptotimes.io/2024/04/02/solareum-shuts-down-following-520000-exploit-on-telegram/)
- [BitPinas · Solareum key points](https://bitpinas.com/feature/keypoints-2024-04-02/)

---

## 2024-05 · Pump.fun insider exploit · $1.9M across 1,882 wallets

**Vector**: A former Pump.fun employee retained privileged withdrawal
access after departure and combined it with a flash-loan price
manipulation to drain protocol user funds.

**Sakura counter-factual**: **Out of scope.** The attack was on
Pump.fun's internal privileged withdrawal path, not on user-agent
delegation. Sakura's primitive gates agent actions against the user's
intent bound; it does not guard the permissions surface inside a
platform's own operator tooling.

Structural lesson: even perfectly guarded user-side delegation
doesn't protect against backend compromise. The Sakura model narrows
the attack surface to the agent layer; platform-internal security is
still the platform's problem.

Sources:
- [Helius · Solana Hacks history (Pump.fun entry)](https://www.helius.dev/blog/solana-hacks)
- [Medium · Solana Security Incidents history (Lucrative Panda)](https://medium.com/@lucrativepanda/a-comprehensive-analysis-of-solanas-security-history-all-incidents-impacts-and-evolution-up-to-1b1564c7ddfe)

---

## Summary table

| Incident | Date | Loss | Victims | Counter-factual class |
|---|---|---:|---:|---|
| NoOnes bridge | 2025-01 | $7.9M | undisclosed | Out of scope (bridge/custodial) |
| DEXX | 2024-11 | $30M | 900+ | **Prevented — non-custodial** |
| ChatGPT AI-poisoning | 2024-11 | $2.5K | 1 | **Prevented — non-custodial** |
| Banana Gun | 2024-09 | $1.4M | 36 | **Bounded — per-action cap** |
| Solareum | 2024-03 | $1.4M | 300+ | **Prevented — non-custodial** |
| Pump.fun insider | 2024-05 | $1.9M | 1,882 | Out of scope (platform internals) |
| **Total 2024 (tracked)** | | **~$42M** | **~3,100+** | **~$33M preventable** |

## Patterns

Across these six incidents, the recurring failure mode is
**user surrendering private key to a trading bot / centralized
service** (DEXX, Solareum, ChatGPT-poisoning are all this class,
together > $30M in loss). The Sakura model is architecturally
incompatible with that failure mode — not because it patches a
vulnerability, but because it never creates the interaction surface
where the vulnerability lives.

The remaining two classes — bot-oracle interception (Banana Gun) and
platform-insider (Pump.fun, NoOnes) — are either partially bounded
(intent cap limits single-action drain) or architecturally orthogonal
(platform-internal security is the platform's problem, not the
agent-delegation layer's).

## Caveats

- Dollar loss figures are from primary-source security reports; where
  a range is cited (e.g. $520K–$1.4M for Solareum) the higher
  number reflects secondary-token value at post-exploit market price.
- "Prevented" in the counter-factual column means the architectural
  precondition for the attack does not exist in the Sakura model —
  not that Sakura retroactively would have saved any specific victim
  who had already signed up for a custodial bot.
- This library is a living document; incidents from 2026 Q1+ are
  pending research. If you're aware of an incident omitted here,
  open a PR to add it with primary-source links.

## Cross-references

- [`docs/WHY-BOUNDED-INTENT.md`](WHY-BOUNDED-INTENT.md) — protocol-
  mechanics argument for the primitive
- [`docs/VALUE_CAPTURE.md`](VALUE_CAPTURE.md) — revenue model that
  funds the primitive's maintenance
- [README Trust Model](../README.md#trust-model-precisely-stated) —
  what the admin can and cannot do (including why admin is immutable)
