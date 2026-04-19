# Sakura Mutual — Reproducible Build

This document is what a hackathon judge or auditor needs to rebuild the
on-chain verifier byte-for-byte from `circuits/src/liquidation_proof.circom`.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 24 LTS | `nvm install 24` |
| Rust | 1.79+ | `rustup default 1.79` |
| Solana CLI | 1.18+ | `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"` |
| Anchor | 0.31 | `avm install 0.31.0 && avm use 0.31.0` |
| circom | 2.1.6 | https://docs.circom.io/getting-started/installation/ |
| snarkjs | 0.7.6 | `npm i -g snarkjs@0.7.6` |

---

## Step 1 — Compile the circuit

```bash
cd circuits
circom src/liquidation_proof.circom \
  --r1cs --wasm --sym \
  -o build/ \
  -l ../node_modules
```

Outputs:
- `build/liquidation_proof.r1cs`
- `build/liquidation_proof.sym`
- `build/liquidation_proof_js/liquidation_proof.wasm`

---

## Step 2 — Phase 1 (Powers of Tau)

We re-use the audited Hermez `pot11` ceremony. To verify locally:

```bash
shasum -a 256 ptau/pot11_final.ptau
# Expected:
# 7a7166f5c9ff1f3e5c53a69792a9b72f682eb2c00a33e2820f8d9b53782a9af9  ptau/pot11_final.ptau
```

Provenance documented in [`../ceremony/TRANSCRIPT.md`](../ceremony/TRANSCRIPT.md).

---

## Step 3 — Phase 2 (circuit-specific setup)

```bash
# Initial zkey
snarkjs groth16 setup \
  build/liquidation_proof.r1cs \
  ptau/pot11_final.ptau \
  build/liquidation_proof_0000.zkey

# Contributor 1
snarkjs zkey contribute \
  build/liquidation_proof_0000.zkey \
  build/liquidation_proof_0001.zkey \
  --name="contributor-1" \
  -e="$(head -c 32 /dev/urandom | base64)"

# Beacon (replace with drand round at finalization)
snarkjs zkey beacon \
  build/liquidation_proof_0001.zkey \
  build/liquidation_proof_final.zkey \
  0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 \
  10 -n="Final Beacon"

# Export verification key
snarkjs zkey export verificationkey \
  build/liquidation_proof_final.zkey \
  build/verification_key.json
```

Verify hashes against `ceremony/TRANSCRIPT.md`.

---

## Step 4 — Generate the on-chain verifying key

```bash
cd ..
node scripts/parse-vk-to-rust.js
```

This writes `programs/sakura-insurance/src/zk_verifying_key.rs`. The file
is **deterministic** given the same `verification_key.json`. After
running, `git diff` should be empty if you started from the committed
state.

---

## Step 5 — Copy artifacts for the web app

```bash
cp circuits/build/liquidation_proof_js/liquidation_proof.wasm public/zk/
cp circuits/build/liquidation_proof_final.zkey public/zk/liquidation_proof.zkey
cp circuits/build/verification_key.json public/zk/verification_key.json

shasum -a 256 public/zk/*
# Verify against ceremony/TRANSCRIPT.md
```

---

## Step 6 — Build & deploy the Anchor program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

The program ID `A91n9X4MxLaeV9NF1K3jC2yet5VhKjTj48wgWQCA7wka` is hardcoded
in `declare_id!`. To deploy under a fresh ID:

```bash
solana-keygen new -o target/deploy/sakura_insurance-keypair.json --no-bip39-passphrase
solana address -k target/deploy/sakura_insurance-keypair.json
# Update declare_id!() in lib.rs to match
anchor build && anchor deploy
```

---

## Step 7 — Web app

```bash
cp .env.example .env.local
# Fill:
#   ANTHROPIC_API_KEY=sk-ant-...
#   HELIUS_API_KEY=...
#   NEXT_PUBLIC_APP_URL=http://localhost:3000
npm install
npm run dev
```

Open http://localhost:3000.

---

## Verification matrix

| Artifact | SHA-256 (committed) |
|---|---|
| `circuits/build/liquidation_proof_final.zkey` | `8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0` |
| `circuits/build/verification_key.json` | `08f0cac262028d0bcabdb52c7c35367858383d5d5c0475de9f8efa3470f5cd08` |
| `circuits/ptau/pot11_final.ptau` | `7a7166f5c9ff1f3e5c53a69792a9b72f682eb2c00a33e2820f8d9b53782a9af9` |
| `public/zk/liquidation_proof.wasm` | `f8730c7c839c2c57f8745f49fb2aa5455a876aaf71bf8407ba756235c929dbc6` |
| `public/zk/liquidation_proof.zkey` | `8d97eb57113d8eeccf7b67bae2c98a7885712931108d07c51ebfa8071a2265f0` |

If any hash differs, the on-chain verifier and off-chain prover will
disagree and **all proofs will fail**. Re-run from Step 1.

---

## Note on the C1 circuit fix (2026-04-18)

After the Tier-0 audit, `liquidation_proof.circom` gained `Num2Bits`
range checks on every witness signal. **You must re-run Steps 1–5 after
pulling the latest commit** — the old zkey will not match the new R1CS.
The new artifact hashes are pinned above and in
`ceremony/TRANSCRIPT.md`.
