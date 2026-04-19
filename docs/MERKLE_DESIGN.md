# Sakura Mutual — Poseidon Merkle Commitment Tree (v1 design)

**Status**: design + stub. Targeted for v0.3 mainnet launch (post-hackathon).
**Goal**: replace the per-policy `commitment_hash: [u8; 32]` with a Merkle
root over all active policies, so a claim ZK proof reveals neither which
policy was claimed nor which obligation address was insured.

---

## Why this matters

Today every `Policy` PDA stores `commitment_hash` openly. An on-chain
observer can:

1. List all `Policy` accounts (anyone can scan PDAs).
2. Read every `commitment_hash`.
3. Read each `claim_payout_with_zk_proof` event and recover which user
   claimed (because the proof's public input [0] equals that policy's
   `commitment_hash`).

This leaks: *"this wallet has an insured Kamino loan, and it just got
liquidated."* — exactly the metadata users want hidden.

A Merkle tree replaces individual commitments with one root the prover
proves membership in.

---

## Construction

### Tree
- **Hash**: Poseidon (arity 2) — same primitive as the leaf binding.
- **Depth**: 26 (≈ 67M policies — fits Solana's `spl-account-compression`
  concurrent Merkle tree which caps at 2^30).
- **Leaf**: `Poseidon(commitment_hash, leafSalt)` — leaf salt prevents
  cross-tree linkability if a user re-buys.
- **Storage**: `spl-account-compression` concurrent Merkle tree (Solana
  Light Protocol primitive — proven at Solana scale via cNFTs).

### State change

```rust
// Before
pub struct Policy {
    pub commitment_hash: [u8; 32],
    // ...
}

// After
pub struct Pool {
    pub policy_tree: Pubkey,    // ConcurrentMerkleTree account
    pub policy_root: [u8; 32],  // current root cached for quick verify
    pub leaf_count: u64,
    // ...
}
pub struct Policy {
    pub leaf_index: u64,        // index in tree
    pub leaf_salt: [u8; 32],    // private to user, kept off-chain
    pub nullifier: [u8; 32],    // posted on claim to prevent double-spend
    // commitment_hash REMOVED from on-chain state
}
```

### Buy flow

1. User computes `commitment = Poseidon(obligation, wallet, nonce)`.
2. User computes `leaf = Poseidon(commitment, leafSalt)`.
3. `buy_policy` CPIs `spl-account-compression::append(leaf)`.
4. `Policy.leaf_index` = pre-append `leaf_count`.
5. User stores `(commitment, leafSalt, leaf_index, merkleProof)` off-chain
   (encrypted in their wallet — this is the policy "card").

### Claim flow

The circuit changes from per-policy commitment binding to Merkle
membership:

```circom
template MutualClaim() {
    // Public
    signal input merkleRoot;
    signal input nullifier;            // = Poseidon(commitment, "nullifier")
    signal input triggerHfBps;
    signal input rescueAmountBucket;
    signal input oraclePrice;
    signal input oracleSlot;

    // Private
    signal input commitment;
    signal input leafSalt;
    signal input leafIndex;
    signal input merklePath[26];
    signal input merklePathIndices[26];
    // ...witness for HF inequality (unchanged)...

    // (1) Membership: Merkle path proves Poseidon(commitment, leafSalt) ∈ tree
    component leaf = Poseidon(2);
    leaf.inputs[0] <== commitment;
    leaf.inputs[1] <== leafSalt;

    component merkleVerifier = MerkleProof(26);
    merkleVerifier.leaf <== leaf.out;
    merkleVerifier.root <== merkleRoot;
    for (var i=0; i<26; i++) {
      merkleVerifier.path[i] <== merklePath[i];
      merkleVerifier.indices[i] <== merklePathIndices[i];
    }

    // (2) Nullifier binding: prevents double-claim per (commitment).
    component nf = Poseidon(2);
    nf.inputs[0] <== commitment;
    nf.inputs[1] <== 1234567890;       // domain separator
    nf.out === nullifier;

    // (3) HF + bucket inequalities — unchanged from v0.2.
}
```

On-chain handler:
- Loads `policy_root` from `Pool` and uses as public input `[0]`.
- Asserts `nullifier` not yet posted (PDA `[b"nullifier", nf.as_ref()]` init).
- Verifies Groth16 as before.
- Pays out to `rescue_destination_ata` (still owner-checked against
  policy.user — but we lose that linkability… see below).

---

## Open design questions

### Q1: How does the chain know the rescue ATA belongs to the right user?

We can't read `policy.user` because the policy PDA no longer reveals
which leaf you're claiming for. Options:

- **Stealth payouts**: derive a one-time stealth address from the
  commitment + a payout token. User scans for new ATAs.
- **Diversified anchor**: include `payoutAnchor = Poseidon(wallet,
  payoutSalt)` as a public input; require the rescue ATA to be derived
  from it. Same wallet always derives same anchor → on-chain check becomes
  ATA = `derive(anchor, payoutSalt)`.

We'll prototype option 2 in v0.3.

### Q2: How do users get their merkle path at claim time?

Three possibilities:
- Subscribe to leaf-append events and maintain locally (Light Protocol pattern).
- Use a Sakura indexer endpoint that returns `(path, indices)` on demand.
- Store the path encrypted in IPFS at policy buy-time, refresh on tree updates.

Indexer endpoint is simplest — privacy concern is the indexer learns the
leaf, but it doesn't learn the commitment preimage.

### Q3: Audit / regulatory disclosure

See `docs/AUDIT_KEY.md` for the selective-disclosure scheme that lets a
user voluntarily prove "this leaf belongs to me" to an auditor without
revealing their entire policy.

---

## Implementation stub (Rust)

```rust
// programs/sakura-insurance/src/merkle.rs (v0.3)

use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, Noop};

pub fn append_policy_leaf<'info>(
    ctx: &Context<'_, '_, '_, 'info, BuyPolicyV3<'info>>,
    leaf: [u8; 32],
) -> Result<()> {
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(),
        spl_account_compression::cpi::accounts::Modify {
            authority: ctx.accounts.pool.to_account_info(),
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            noop: ctx.accounts.log_wrapper.to_account_info(),
        },
        &[&[
            b"sakura_pool_v2",
            ctx.accounts.pool.admin.as_ref(),
            &[ctx.accounts.pool.bump],
        ]],
    );
    spl_account_compression::cpi::append(cpi_ctx, leaf)
}
```

(Stub only; not wired into v0.2.)
