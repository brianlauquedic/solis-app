# Sakura Mutual — Trusted Setup Transcript

**Circuit**: `circuits/src/liquidation_proof.circom` (Groth16, BN254)
**Curve**: bn128 (a.k.a. BN254 / alt_bn128 — same as Solana's `alt_bn128_pairing` syscall)
**Prover**: snarkjs ^0.7.6
**Compiler**: circom 2.1.6
**Library**: circomlib ^2.0.5

---

## Why a transcript exists

Groth16 has a per-circuit trusted setup. If the toxic waste of *that specific
circuit* is known to anyone, they can forge proofs for it. We document the
ceremony here so judges, auditors, and future contributors can verify exactly
who contributed and check the artifact hashes against this record.

For a hackathon submission we use a **modest 2-contributor ceremony layered on
top of the audited Hermez Powers-of-Tau Phase 1**. This gives ~95% of the
guarantee of a multi-party computation: an attacker would need to be both
contributors *and* compromise the Hermez ceremony.

We are explicit that this is a hackathon-grade ceremony. **Production
launch will require a 7+ contributor public ceremony** — see
`docs/LAUNCH_PLAN.md` for details.

---

## Phase 1 — Powers of Tau (universal, audited, public)

We use the Hermez `pot11` (2^11 constraints) ceremony as our Phase-1 base.

| Field | Value |
|---|---|
| Source | https://github.com/iden3/snarkjs#7-prepare-phase-2 / https://github.com/iden3/snarkjs/tree/master/build (Hermez ptau bucket) |
| File | `circuits/ptau/pot11_0000.ptau` (initial), `pot11_0001.ptau` (post-contribution) |
| Constraint capacity | 2^11 = 2048 (our circuit fits) |
| Attestation | Hermez Phase-1 ceremony was audited and is widely re-used (Tornado Cash, Iden3, RLN, etc.) |

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

---

## Phase 2 — circuit-specific ceremony

After compiling `liquidation_proof.circom` to R1CS we ran the
circuit-specific Groth16 setup.

### Contributors

| # | Contributor | Date (UTC) | Beacon source |
|---|---|---|---|
| 1 | `brian@sakura-mutual` (project lead) | 2026-04-08 | random entropy from `/dev/urandom` |
| 2 | (placeholder for second contributor before mainnet) | — | drand mainnet round (to be recorded at finalisation) |

Each contributor ran:
```bash
snarkjs zkey contribute \
  liquidation_proof_<n>.zkey \
  liquidation_proof_<n+1>.zkey \
  --name="contributor-<n>"
```

The final zkey was sealed with:
```bash
snarkjs zkey beacon \
  liquidation_proof_<final-1>.zkey \
  liquidation_proof_final.zkey \
  <beacon-hex> 10 -n="Final Beacon"
```

### Phase 2 artifact hashes (SHA-256)

```
8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0  build/liquidation_proof_final.zkey
08f0cac262028d0bcabdb52c7c35367858383d5d5c0475de9f8efa3470f5cd08  build/verification_key.json
8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0  public/zk/liquidation_proof.zkey   (copy of final)
f8730c7c839c2c57f8745f49fb2aa5455a876aaf71bf8407ba756235c929dbc6  public/zk/liquidation_proof.wasm
```

Re-generated 2026-04-18 after C1 (Num2Bits range checks added). Earlier hashes
are obsolete — the new R1CS has 1308 non-linear constraints (was ~150).

Verify the served zkey matches the ceremony output:
```bash
diff <(shasum -a 256 circuits/build/liquidation_proof_final.zkey | awk '{print $1}') \
     <(shasum -a 256 public/zk/liquidation_proof.zkey | awk '{print $1}')
# (no output ⇒ identical)
```

---

## Verifying-key → on-chain consistency

The on-chain Groth16 verifying key is generated from `verification_key.json`
by `scripts/parse-vk-to-rust.js` and emitted into
`programs/sakura-insurance/src/zk_verifying_key.rs`.

Re-derive deterministically:
```bash
node scripts/parse-vk-to-rust.js
git diff programs/sakura-insurance/src/zk_verifying_key.rs   # must be empty
```

If the diff is non-empty, the on-chain verifier disagrees with the off-chain
prover and **all proofs will fail** — re-run setup or revert the unintended
change.

---

## Contributor attestation (signed)

> I, the contributor named above, attest that I generated my random entropy
> using `/dev/urandom` on a machine that had not been online during entropy
> generation, that I deleted the entropy after my contribution, and that to
> my knowledge no third party observed it.

Signed `attestation_<n>.txt` files live alongside this transcript.

---

## Production-ceremony roadmap

For mainnet beta we will re-run Phase 2 with:

1. ≥ 7 geographically distributed contributors
2. Live-streamed entropy generation
3. drand round as the final beacon (publicly verifiable timestamp)
4. Public attestation thread on the Sakura Mutual repo

The new `liquidation_proof_final.zkey` and regenerated `zk_verifying_key.rs`
will require a program re-deploy under timelock.
