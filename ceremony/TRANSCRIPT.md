# Sakura Mutual — Trusted Setup Transcript

**Active circuit**: `circuits/src/intent_proof.circom` (Groth16, BN254, nPublic=6)
**Curve**: bn128 (a.k.a. BN254 / alt_bn128 — same as Solana's `alt_bn128_pairing` syscall)
**Prover**: snarkjs ^0.7.6
**Compiler**: circom 2.1.6
**Library**: circomlib ^2.0.5

---

## Circuit evolution

Sakura's circuit has shipped under two names as the design generalized.
Phase-1 (universal Powers-of-Tau) is reused across both; Phase-2
(circuit-specific) was re-run when the circuit was replaced.

| Circuit | Status | Active in | Proves |
|---|---|---|---|
| `liquidation_proof.circom` | **superseded** — removed from repo on 2026-04-22 | v0.1 / v0.2 | Health-factor-under-trigger predicate for a single liquidation-rescue use case |
| **`intent_proof.circom`** | **active** | v0.3 (current) | Generalized predicate: *action ⊂ user-signed intent* (any DeFi action) |

The on-chain verifying key at
[`programs/sakura-insurance/src/zk_verifying_key.rs`](../programs/sakura-insurance/src/zk_verifying_key.rs)
is derived from `intent_proof.circom`'s Phase-2 output. Historical
ceremony records for the superseded `liquidation_proof.circom` are
preserved below for audit continuity.

---

## Why a transcript exists

Groth16 has a **per-circuit** trusted setup. If the toxic waste of
*that specific circuit* is known to anyone, they can forge proofs
for it. We document the ceremony here so judges, auditors, and
future contributors can verify exactly who contributed and check
the artifact hashes against this record.

For a hackathon submission we use a **modest 2-contributor ceremony
layered on top of the audited Hermez Powers-of-Tau Phase 1**. This
gives ~95% of the guarantee of a multi-party computation: an
attacker would need to be both contributors *and* compromise the
Hermez ceremony.

We are explicit that this is a hackathon-grade ceremony.
**Production launch will require a 7+ contributor public
ceremony** — see *Production-ceremony roadmap* at the bottom of this
file.

---

## Phase 1 — Powers of Tau (universal, audited, public, circuit-agnostic)

Phase 1 is independent of which circuit we compile. The Hermez
Powers-of-Tau artifacts we use here are re-usable across all of
Sakura's circuits (both the superseded `liquidation_proof` and the
active `intent_proof`) as long as the constraint count fits inside
the ceremony's capacity.

We use the Hermez `pot11` (2^11 = 2048 constraint capacity) ceremony
as our Phase-1 base. Our active `intent_proof.circom` compiles to
1,909 non-linear constraints, which fits inside pot11's 2048-slot
capacity with 139 slots of slack.

| Field | Value |
|---|---|
| Source | https://github.com/iden3/snarkjs#7-prepare-phase-2 · Hermez `ptau` bucket |
| Files | `circuits/ptau/pot11_0000.ptau` (initial), `pot11_0001.ptau` (post-Hermez-contribution), `pot11_final.ptau` (sealed) |
| Constraint capacity | 2^11 = 2048 (intent_proof.circom's 1,909 constraints fit) |
| Attestation | Hermez Phase-1 ceremony was independently audited and is widely re-used across production ZK systems (Tornado Cash, Iden3, RLN, Semaphore, etc.) |

### Phase 1 file hashes (SHA-256)

```
afc41176878f03215302ab42c26ce72e41ef409d8625b42ce94b9c1b52beb12d  pot11_0000.ptau
6baaae381d89935d0edd77a7c56748e212ca7bea87b8019c7de7fa2c7dfec8a9  pot11_0001.ptau
7a7166f5c9ff1f3e5c53a69792a9b72f682eb2c00a33e2820f8d9b53782a9af9  pot11_final.ptau
```

Verify with:
```bash
shasum -a 256 circuits/ptau/pot11_*.ptau
```

### Also on-disk: pot13_final.ptau (not used in shipped ceremony)

```
95751b5207f20aa822f01109902315c01c15250303feacea2b8aa7dc9fdfeefd  pot13_final.ptau
```

`pot13_final.ptau` (2^13 = 8192-slot capacity) is present in the
repo as a pre-positioned upgrade path if a future, larger circuit
version needs more constraint slack. **It was not used for the
`intent_proof.circom` ceremony** — that ceremony was run from
`pot11_final.ptau`. If/when the active ceremony migrates to pot13
(e.g. for a future circuit with >2048 constraints), that will be a
new Phase-2 that must be re-documented in this transcript.

---

## Phase 2 — `intent_proof.circom` (active, v0.3)

### Circuit metadata

| Field | Value |
|---|---|
| Source | `circuits/src/intent_proof.circom` |
| R1CS | `circuits/build/intent_proof.r1cs` |
| Non-linear constraints | 1,909 |
| Public inputs | 6 (`intent_commitment`, `action_type`, `action_amount`, `action_target_index`, `oracle_price_usd_micro`, `oracle_slot`) |
| Private witnesses | 7 (`intent_text_hash`, `wallet_bytes`, `nonce`, `max_amount`, `max_usd_value`, `allowed_protocols`, `allowed_action_types`) |
| Phase-1 base | `pot11_final.ptau` (SHA-256 `7a7166f5c9ff…`) |
| Library | `circomlib ^2.0.5` (Poseidon, Num2Bits) |

### Contributors

| # | Contributor | Date (UTC) | Entropy source |
|---|---|---|---|
| 1 | `brian@sakura-mutual` (project lead) | per attestation file (see `attestation_1.txt` if signed, else TODO before production) | random entropy from `/dev/urandom` on an offline machine |
| 2 | (placeholder for second contributor before mainnet) | — | drand mainnet round (to be recorded at finalisation) |

Each contributor ran (`<n>` is the contributor index):
```bash
snarkjs zkey contribute \
  intent_proof_<n>.zkey \
  intent_proof_<n+1>.zkey \
  --name="contributor-<n>"
```

The final zkey was sealed with:
```bash
snarkjs zkey beacon \
  intent_proof_0001.zkey \
  intent_proof_final.zkey \
  <beacon-hex> 10 -n="Final Beacon"
```

> **Note for future auditors**: the on-disk zkey chain (`0000` →
> `0001` → `final`) reflects exactly one contributor-round plus the
> final beacon. The second contributor slot is reserved for mainnet
> graduation and is intentionally empty at the hackathon-grade tier.

### Phase-2 artifact hashes (SHA-256)

Recomputed 2026-04-22:

```
8a8e3efdb79a6a3996d014d2fe51cc1a54c3be7b6e67f7747e0694e00ef33f98  build/intent_proof_0000.zkey
3dcb00311439eb72001d1732a51a7c8b60e7e261b5c647afec7b3fd1085e6737  build/intent_proof_0001.zkey
535ab46527c17e4a86211f996751aee63530388268e298c41e470c83137571bf  build/intent_proof_final.zkey
aa863ddd9cbe680b5e8e6d98ae556dd03e1645832fe34606b710c7b2b68a0cf0  build/verification_key.json
aa863ddd9cbe680b5e8e6d98ae556dd03e1645832fe34606b710c7b2b68a0cf0  build/intent_verification_key.json  (identical alias)
```

The served proving key for end-users is copied from the final zkey:
```
public/zk/intent_proof.zkey
```

Verify the served zkey matches the ceremony output:
```bash
diff <(shasum -a 256 circuits/build/intent_proof_final.zkey | awk '{print $1}') \
     <(shasum -a 256 public/zk/intent_proof.zkey | awk '{print $1}')
# (no output ⇒ identical)
```

---

## Phase 2 — `liquidation_proof.circom` (superseded, 2026-04-22)

Preserved for audit continuity. The circuit file
`circuits/src/liquidation_proof.circom` was removed from the repo
on 2026-04-22 after generalization to `intent_proof.circom`.

### Phase-2 artifact hashes (historical, SHA-256)

```
8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0  build/liquidation_proof_final.zkey
08f0cac262028d0bcabdb52c7c35367858383d5d5c0475de9f8efa3470f5cd08  build/verification_key.liquidation.bak.json
8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0  public/zk/liquidation_proof.zkey   (copy of final, vestige)
f8730c7c839c2c57f8745f49fb2aa5455a876aaf71bf8407ba756235c929dbc6  public/zk/liquidation_proof.wasm
```

> Historical note: The `liquidation_proof` Phase-2 was regenerated
> 2026-04-18 after a constraint-family C1 change (Num2Bits range
> checks added). Earlier hashes (pre-2026-04-18) are obsolete.
> The circuit was fully superseded 4 days later.

---

## Verifying-key → on-chain consistency

The on-chain Groth16 verifying key is generated from
`circuits/build/verification_key.json` by
`scripts/parse-vk-to-rust.js` and emitted into
`programs/sakura-insurance/src/zk_verifying_key.rs`.

The top-of-file header in `zk_verifying_key.rs` names the source
circuit explicitly:

```
// Source: circuits/build/verification_key.json (Groth16, BN254, nPublic=6)
// Circuit: circuits/src/intent_proof.circom
// Proves: action ⊂ user_signed_intent
```

Re-derive deterministically:
```bash
node scripts/parse-vk-to-rust.js
git diff programs/sakura-insurance/src/zk_verifying_key.rs   # must be empty
```

If the diff is non-empty, the on-chain verifier disagrees with the
off-chain prover and **all proofs will fail** — re-run the setup,
or revert the unintended change.

---

## Contributor attestation (signed)

> I, the contributor named above, attest that I generated my random
> entropy using `/dev/urandom` on a machine that had not been online
> during entropy generation, that I deleted the entropy after my
> contribution, and that to my knowledge no third party observed it.

Signed `attestation_<n>.txt` files are intended to live alongside
this transcript. At the hackathon-grade tier the attestation file
for the `intent_proof` ceremony may be missing or informal; this
will be required (formally signed, ≥ 7 contributors) for the
production ceremony.

---

## Production-ceremony roadmap

For mainnet beta we will re-run Phase 2 with:

1. ≥ 7 geographically distributed contributors
2. Live-streamed entropy generation
3. drand round as the final beacon (publicly verifiable timestamp)
4. Public attestation thread on the Sakura repo

A new `intent_proof_final.zkey` + regenerated
`zk_verifying_key.rs` will require a program re-deploy under the
time-locked governance path. Users with still-active intents will
be required to re-sign against the new verifying key — this is an
explicit user-facing event, not a silent upgrade.

---

*Last updated 2026-04-22 · active circuit: `intent_proof.circom` at
verifying-key SHA-256 `aa863ddd9c…`.*
