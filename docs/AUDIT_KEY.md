# Sakura Mutual — Selective Disclosure / Audit Key (v1 design)

**Status**: design only. Targeted for v0.3 mainnet launch.
**Goal**: let a user *voluntarily* prove to a third party (auditor, tax
authority, lender, partner) that a specific Sakura policy belongs to
them, without revealing their entire policy history.

---

## Threat model

- **Default**: zero on-chain linkability between wallet → policy → claim
  (provided by the Merkle commitment tree, see `MERKLE_DESIGN.md`).
- **Voluntary disclosure**: user wants to prove ownership of policy `P`
  to verifier `V` for a one-off purpose (loan application, tax filing).
- **Adversary**: a verifier who, after disclosure, tries to extend the
  proof to claim ownership of *other* user policies, or replay the
  disclosure to prove the user has more policies than they do.

We require:
1. **Soundness**: only the true owner can produce a valid disclosure.
2. **Selectivity**: disclosing one policy reveals nothing about others.
3. **Non-extensibility**: the verifier cannot turn a disclosure for
   policy P into a disclosure for policy P'.
4. **Optional revocation**: the disclosure can be time-bounded.

---

## Construction

### Master audit key

At policy purchase the user generates an **audit master secret**:

```
auditMasterSecret  = HKDF-Expand(walletSig, "sakura-audit-master-v1")
auditMasterPubkey  = Ed25519.derive(auditMasterSecret)
```

`auditMasterPubkey` is published to a public registry (just a Memo on
chain). The master secret stays in the wallet's encrypted keystore.

### Per-policy audit token

For each policy the user keeps:

```
policyAuditToken  = HKDF-Expand(auditMasterSecret, "policy:" || leafIndex)
```

This is purely off-chain. It's deterministically re-derivable from the
master secret + leaf index.

### Disclosure proof (Schnorr-style ZK)

To prove ownership of policy `P` (leaf at index `i`, commitment `c`,
salt `s`) to verifier `V` over a one-shot challenge `chal`:

```
Public:   merkleRoot, leafIndex, auditMasterPubkey, chal, expiry
Private:  commitment c, leafSalt s, auditMasterSecret k

Circuit:
  // (1) Merkle membership of Poseidon(c, s) at index leafIndex.
  // (2) PoK of k such that Ed25519.derive(k) == auditMasterPubkey.
  // (3) Bind chal: hash(chal || expiry || leafIndex) committed in proof.
```

The verifier checks:
- Groth16 pairing valid.
- `merkleRoot` matches the on-chain `Pool.policy_root` (or a historical
  root in a window).
- `expiry > now`.
- `chal` is the challenge they issued in the last 5 min.

### Why this satisfies our requirements

| Property | Mechanism |
|---|---|
| Soundness | Only knowledge of `auditMasterSecret` produces a valid PoK. |
| Selectivity | Each disclosure binds exactly one `leafIndex`; other leaves' commitments and salts stay private. |
| Non-extensibility | The verifier's `chal` is committed in the proof. They cannot forge a disclosure for another leaf without re-running the prover (which requires the secret). |
| Revocation | `expiry` field — short-lived disclosures self-revoke. For long-lived audit relationships, the user can rotate `auditMasterSecret` and publish a new pubkey (old proofs verify against the old pubkey + are invalidated by an on-chain "revoked" flag). |

---

## Use cases

1. **DeFi underwriter wants to know if you're insured before lending.**
   You produce a disclosure proving "I own the active Sakura policy for
   obligation X with coverage cap ≥ $50K." The lender decreases your
   collateral requirement.

2. **Tax filing.** Year-end, you produce disclosures for every claim
   you collected so the claim payments can be classified as insurance
   recoveries (typically non-taxable) rather than ambiguous transfers.

3. **Partner protocol integration.** Drift, Kamino, MarginFi can offer
   "Sakura-insured" badges on positions when the user opts to disclose.

---

## Implementation stub (TypeScript)

```ts
// lib/audit-disclosure.ts (v0.3)

import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

export async function deriveAuditMasterSecret(
  walletSignature: Uint8Array
): Promise<Uint8Array> {
  return hkdf(sha256, walletSignature, undefined, "sakura-audit-master-v1", 32);
}

export async function deriveAuditMasterPubkey(
  secret: Uint8Array
): Promise<Uint8Array> {
  // ed25519.getPublicKey(secret) — using @noble/ed25519
  const ed = await import("@noble/ed25519");
  return ed.getPublicKey(secret);
}

export type DisclosureWitness = {
  commitment: bigint;
  leafSalt: bigint;
  auditMasterSecret: bigint;
  // public:
  merkleRoot: bigint;
  leafIndex: number;
  auditMasterPubkey: bigint;
  chal: bigint;
  expiry: bigint;
};

// Circuit at circuits/src/audit_disclosure.circom (TODO)
export async function generateDisclosureProof(
  w: DisclosureWitness
): Promise<{ proof: unknown; publicSignals: string[] }> {
  throw new Error("v0.3 stub — disclosure circuit not yet compiled");
}
```

---

## Open questions

- **Edge case**: user lost their master secret. They can prove via wallet
  signature that they own `walletSig` and re-derive — but only if their
  wallet keypair hasn't rotated. Mitigation: encrypt master secret to
  user's email-bound passkey via Lit Protocol or similar.
- **Aggregation**: one proof for "I own ≥ N policies"? Requires recursive
  Groth16 or Halo2 — out of scope for v0.3.
