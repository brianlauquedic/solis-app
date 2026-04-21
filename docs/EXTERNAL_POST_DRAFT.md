# External-Reference Post · Drafts

> Purpose: Produce **one external URL** we can cite in README / submission
> that proves "someone outside the team has engaged with this work."
> Zero-to-one is the only jump that matters at submission time;
> one-to-N is linear.
>
> Three drafts below, ordered from safest (technical, invites
> correction) to boldest (positioning, invites debate). Pick the one
> that matches your temperament. All are written to be posted under
> your own account, not as marketing.

---

## Draft 1 · Solana Stack Exchange question (safest)

**Venue**: https://solana.stackexchange.com — `zk` + `compute-units`
tags. A technical question gets a technical answer; the URL becomes
permanent external engagement.

**Title**: `Measured compute-unit cost of a single Groth16 pairing via alt_bn128 syscall — is 126k CU the correct ballpark?`

**Body** (copy-paste ready):

```
I'm benchmarking `alt_bn128_pairing` (introduced in Protocol 1.17) for a
Groth16 verifier on Solana. Using the Light Protocol `groth16-solana`
crate against a 1,909-constraint circuit compiled at `pot13`, I
consistently measure ~126,221 CUs per `verify_proof` call on devnet
(5/5 runs, log excerpt below).

Two questions for anyone who has done similar measurements:

1. Is 126k CU in line with what others are observing for single-pair
   Groth16 checks on BN254? I've seen secondhand estimates ranging from
   80k to 200k in different public write-ups and I'd like to triangulate.

2. Does the CU cost scale meaningfully with the number of *public inputs*
   (mine has 12), or is the dominant cost the single pairing check itself?

Context: the verifier sits inside an Anchor instruction that also does
Pyth `PriceUpdateV2` re-parsing and PDA init. Total instruction-level
CU is ~180k, of which ~126k is the pairing alone.

Sample bench output (truncated):
```
run 1: 126,221 CUs
run 2: 126,221 CUs
run 3: 126,221 CUs
run 4: 126,221 CUs
run 5: 126,221 CUs
```

Full artifact with sample input + witness + proof:
https://github.com/<your-username>/sakura/blob/main/docs/bench/2026-04-21-cu.json

Not a bug report — just looking to sanity-check the number against
what experienced ZK-on-Solana folks are seeing.
```

**Why this works**: asks a narrow, verifiable question; has a
concrete artifact (the bench JSON); invites domain experts to engage
without any marketing pretense. A single up-vote or comment from
someone like `mergen` (Light Protocol) or any Solana Foundation
engineer creates a permanent citable URL.

**What to avoid**: don't mention "Sakura," "agent," "containment," or
anything product-flavored. The post should read as a pure
infrastructure question. The project context can live in the GitHub
link for those who click through.

---

## Draft 2 · Solana Tech forum / Discord technical post (medium)

**Venue**: Solana Tech Discord `#dev` channel, or the
`solana-developers` GitHub Discussions (https://github.com/solana-developers/solana-community-discussions/discussions).

**Title**: `Pattern: binding a Pyth PriceUpdateV2 account to a ZK-circuit public input, on-chain`

**Body**:

```
Sharing a pattern for anyone building agentic-execution systems that
need a price-gated on-chain check.

Problem: your Anchor program receives (a) a ZK proof whose witness
references a token price, and (b) a Pyth `PriceUpdateV2` account.
You want the on-chain program to refuse the proof unless the price
the witness used is the price currently held in the Pyth account —
i.e., the witness price can't be a stale or hand-picked value.

Approach:

1. Require the proof's public inputs to include the exact `price`
   and `feed_id` the witness used.
2. On-chain, re-parse the Pyth account and check three things:
   - `account.owner == PYTH_RECEIVER_PROGRAM_ID`
   - `price_update.price_message.feed_id == public_input.feed_id`
   - `price_update.price_message.price == public_input.price`
3. Enforce a freshness window: `Clock.slot - price_update.posted_slot < 150`.

This binds the proof to a specific oracle observation at a specific
slot window. An attacker who controls the prover cannot substitute
a different price without breaking the proof; an attacker who
controls the Pyth feed is a separate (and pre-existing) threat model.

Caveats I'd welcome pushback on:

- The 150-slot window is my pick (~60s at 400ms slots). Is there a
  community-accepted threshold for "price is fresh"?
- Pyth account deserialization cost is non-trivial in CUs. Worth
  profiling if you're tight.

Full reference implementation (Anchor, Rust) at:
https://github.com/<your-username>/sakura/blob/main/programs/sakura-insurance/src/lib.rs
(search for `execute_with_intent_proof`)

Interested to hear if anyone has a tighter pattern or a known
gotcha I'm missing.
```

**Why this works**: shares a genuinely useful engineering pattern
that other Solana builders can reuse. Invites the class of
engagement — correction, suggestion, "we did it this other way" —
that produces citable external replies.

---

## Draft 3 · Positioning post on X / Farcaster (boldest)

**Venue**: X (formerly Twitter) or Farcaster, under your own
identity. Tag nobody. Let reach happen organically.

**Thread** (6 posts):

```
1/ 200+ AI-agent DeFi apps will ship on Solana in 2026.

   Each one will need the same four checks before the agent can
   touch user funds:

   — proof that the action matches the user's signed intent
   — proof the oracle price is fresh
   — proof the action hasn't been replayed
   — revert on any failure

   The correct number of independent implementations of this layer
   is one.

2/ The comparable primitive, historically, is HTTPS certificate
   issuance.

   Google and Amazon operate their own TLS endpoints. Neither
   built its own certificate authority. The CA market has accrued
   fiat fees for 30 years on a token-free, operator-overridable-by-
   nobody model.

   An AI-agent bounds verifier on Solana is the same category of
   thing.

3/ The three things that had to exist for this to be buildable in
   production on Solana:

   — alt_bn128 pairing syscall (Protocol 1.17, Q3 2024)
   — Pyth PriceUpdateV2 feed-id-bound accounts (Q2 2025)
   — Light Protocol's groth16-solana crate (Q1 2025)

   The composition window opened ~9 months ago.

4/ Four existing published answers to the same problem on Solana:

   — session-key rotation (default wallet pattern)
   — Signed AI: cNFT audit receipts (lands, then mints receipt)
   — AgentRunner: daily Merkle root anchored on-chain (lands, then
     rolled in)
   — AgentCred: hot/cold key balance split (lands up to hot balance)

   All four are audit / recovery layers. None of them revert a bad
   action.

5/ The action that reverts is the point. An audit trail for a drained
   deposit is not a protection — it's a receipt.

   This is the architectural gap. A ZK gate upstream of the agent's
   signing authority, proving on every action that the action fits
   inside a user-signed commitment, reverting the transaction before
   the underlying DeFi instruction can execute.

6/ We built that gate. 1,909 Circom constraints, 126,221 CUs per
   verification on alt_bn128, a 32-byte Poseidon commitment stored
   as a PDA. Devnet live. No token. MIT.

   Submission for Colosseum Frontier 2026.

   Code: github.com/<your-username>/sakura
```

**Why this works**: stakes a position rather than asks a question.
Produces engagement (quote-tweets, disagreements, "actually X does
this") that is harder to get from a forum post. Risk: invites
criticism as well as endorsement.

**When to use**: after you've posted Draft 1 or Draft 2 and have at
least one technical reply. A positioning post with no technical
scaffolding looks promotional; with scaffolding underneath, it
reads as confident.

---

## Recommended sequence

1. **Day 1**: post Draft 1 on Solana Stack Exchange. Monitor for 24h.
2. **Day 2**: post Draft 2 on Solana Tech Discord `#dev` **or** the
   solana-developers GitHub Discussions. These two venues have
   non-overlapping audiences — pick the one where you have an
   existing account.
3. **Day 3**: if Drafts 1+2 have produced any technical engagement,
   post Draft 3. The technical posts become the citations underneath
   the positioning thread.

At submission, the README `## Further reading` section adds one line:

```
- [Technical discussion on alt_bn128 CU measurement](link-to-draft-1-URL)
```

That is the zero-to-one jump. Everything after is linear.
