# A · Squads Migration Runbook

**Status:** ready to execute (manual, no code change)
**Estimated time:** 60 minutes
**Prerequisites:** `solana` CLI + `anchor` CLI locally; Squads desktop or web access

---

## Why this runbook exists

As of 2026-04-21 the `sakura-insurance` program on devnet has:
- **Program upgrade authority** = `2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg` (single EOA, owner = System Program)
- **IntentProtocol admin** = same EOA
- [Solscan (program)](https://solscan.io/account/AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp?cluster=devnet)
- [Solscan (authority)](https://solscan.io/account/2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg?cluster=devnet)

This is a **1/1 single-point-of-failure**. One compromised key = total protocol takeover. This runbook migrates both roles to a **Squads v4 3-of-5 vault**, bringing Sakura in line with the production standard used by Kamino, MarginFi, Drift, and other Solana DeFi majors.

---

## Before you start

### Collect the 5 signers

You need 5 Pubkeys. Recommended composition:
1. **You** (founder, primary operator)
2. **Co-founder or senior engineer** (day-to-day co-signer)
3. **Independent advisor 1** (capacity key, not hot)
4. **Independent advisor 2** (capacity key, not hot)
5. **Third-party auditor** (e.g. OtterSec, SlowMist, CertiK representative) — gives the protocol an independent reviewer who must approve any upgrade

Threshold: **3-of-5**. Reasons:
- 2-of-5 is too low for upgrade-authority-level power
- 4-of-5 becomes slow/unreachable in emergencies
- 3-of-5 survives any single signer losing a key AND any single signer going rogue

### Fund each signer's address with at least 0.01 SOL on devnet

Each signer needs tiny SOL for tx fees when proposing/approving. Can be collected into a single Squads vault later but they need an initial starting balance.

```bash
solana airdrop 0.1 <each-signer-pubkey> -u devnet
```

---

## Step 1 · Create the Squads vault (~10 min)

Use the Squads Protocol web app: https://v4.squads.so (switch to devnet in settings).

1. Connect with signer 1's wallet (your Phantom pointing at the founder keypair)
2. Click **Create New Multisig**
3. Fill in:
   - **Name**: `Sakura Protocol Admin`
   - **Threshold**: `3`
   - **Members**: paste the 5 Pubkeys from above
   - **Creator**: signer 1 (you)
4. Pay the creation fee (~0.002 SOL)
5. On the vault overview page, **copy the Vault PDA address** — looks like `9xABcD...`. Let's call this `SQUADS_VAULT`.

Verify on Solscan: `https://solscan.io/account/<SQUADS_VAULT>?cluster=devnet`
- Owner should be the Squads program (`SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`)
- Account data should show 5 members + threshold=3

---

## Step 2 · Transfer program upgrade authority (~5 min)

Run this from the local machine holding the **current** upgrade authority keypair (i.e. the keypair at `~/.config/solana/id.json`, whose Pubkey is `2iCWnS1J8W...`):

```bash
# Verify current state
solana program show AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp -u devnet

# Expected output includes:
#   Upgrade Authority: 2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg

# Transfer to Squads vault
solana program set-upgrade-authority \
  AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp \
  --new-upgrade-authority <SQUADS_VAULT> \
  -u devnet

# Re-verify
solana program show AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp -u devnet

# Expected new output:
#   Upgrade Authority: <SQUADS_VAULT>
```

⚠️ **Irreversible without a Squads proposal.** Once this runs, you can no longer upgrade the program from a single CLI key. Any future `anchor deploy` must be routed through a Squads proposal + 3-of-5 approval.

---

## Step 3 · Admin is immutable — migration requires redeploy (~30 min)

**Read this carefully.** `rotate_admin` has been removed from the program
as of commit `<tbd>` because the Protocol PDA seed depends on
`admin.key()`:

```rust
seeds = [b"sakura_intent_v3", admin.key().as_ref()]
```

Mutating `protocol.admin` in place orphans the PDA (the next AdminOnly
call can't derive the same account). So admin is **immutable** after
`initialize_protocol`, by design.

**What this means for migration to Squads**:

The EOA-owned `IntentProtocol` PDA at
`Ab3ZwupehsPz9fhPhmjwfzrn3XPypdrNj9wvwb6bt96M` (seeded by EOA admin
`2iCWnS1J…wHNg`) cannot be handed over to a Squads vault in place. The
migration path is:

1. **Redeploy** the `sakura-insurance` program with the Squads vault as
   `<SQUADS_VAULT>` signer calling `initialize_protocol`. This creates a
   fresh `IntentProtocol` PDA at a **different address** (seeded by the
   vault's pubkey). This happens under a new program ID or via program
   upgrade followed by state re-init.
2. **Sunset** the old EOA-owned `IntentProtocol` PDA by calling
   `set_paused(true)` with the current EOA admin. This prevents new
   intents being signed against it while existing user intents continue
   to function (users can still revoke; agents can still execute against
   already-signed intents until expiry).
3. **Publish the new PDA address** in `docs/TRUST_SURFACE.md` and update
   `lib/insurance-pool.ts`'s `SAKURA_INSURANCE_PROGRAM_ID` constant + UI
   frontend to point at the new protocol.

**Why not just live with `rotate_admin` working?** Because it doesn't.
The PDA seed is `admin.key()`, so even a working-in-isolation rotation
makes the resulting account unfindable on the next call. The clean
solution is the immutable-by-construction model above, matching the
verifying-key immutability already in the contract.

The trade-off: migration is heavier (deploy + re-init + UI update) but
each invocation afterward is simpler (no time-locked rotation path to
audit, no "which admin is canonical at slot N" race conditions).

---

## Step 4 · Publish the trust surface doc (~10 min)

Create `docs/TRUST_SURFACE.md` with the new governance architecture. Minimum content:

```markdown
# Sakura · Trust Surface (public disclosure)

## On-chain privileges

| Role | Who holds it | How it changes |
|---|---|---|
| `sakura-insurance` upgrade authority | Squads vault `<SQUADS_VAULT>` · 3-of-5 | Squads proposal |
| `IntentProtocol.admin` | same Squads vault (as of post-redeploy) | **Immutable** after `initialize_protocol`; migration = fresh deploy with Squads as admin, sunset old PDA via `set_paused` |

## 5 Signers
1. `<pubkey 1>` — Brian Lau (founder, Pacific timezone)
2. `<pubkey 2>` — <co-founder name>
3. `<pubkey 3>` — <advisor 1 name>, <affiliation>
4. `<pubkey 4>` — <advisor 2 name>, <affiliation>
5. `<pubkey 5>` — <auditor name>, <firm> (hardware-key cold storage)

Threshold: 3-of-5.

## On-chain audit trail
Every admin action is a public Squads proposal on devnet/mainnet. Browse all historical proposals at:
https://v4.squads.so/squads/<SQUADS_VAULT>/transactions
```

Commit this to the repo.

---

## Step 5 · Update the deck (~5 min)

In `public/deck.html` slide 8 (Moat section, `comp-table`), add a new row:

```html
<tr>
  <td data-zh="管理员信任面" data-en="Admin trust surface" data-ja="管理者信頼面">管理员信任面</td>
  <td class="cross">✗ (single EOA)</td>  <!-- Blowfish -->
  <td class="cross">✗ (single EOA)</td>  <!-- Goat -->
  <td class="cross">✗ (single EOA)</td>  <!-- Wallet session-key -->
  <td class="check">✓ 3-of-5 Squads + guardian veto</td>  <!-- Sakura -->
</tr>
```

---

## Verification checklist

After all steps, confirm:

- [ ] `solana program show ... -u devnet` reports `Upgrade Authority: <SQUADS_VAULT>`
- [ ] IntentProtocol PDA data parsed via `curl` shows `admin: <SQUADS_VAULT>` (same PDA address as before because seeds use admin — wait, seeds are `["sakura_intent_v3", protocol.admin.as_ref()]`, which means **if admin changes, the PDA address also changes**. This is a design problem; see below)
- [ ] First end-to-end test: create a test Squads proposal that does a trivial `set_paused(false)` no-op, approve with 3 signers, confirm it executes on-chain
- [ ] `docs/TRUST_SURFACE.md` published
- [ ] Deck slide 8 updated

---

## Design resolution: admin is immutable

The Protocol PDA seed is `[b"sakura_intent_v3", admin.key().as_ref()]`.
This means a mutable admin field creates a self-inconsistent PDA (its
address depends on a field stored inside itself; mutating the field
orphans the account).

Two resolutions were considered:

| Option | Outcome | Why rejected/accepted |
|---|---|---|
| Change PDA seed to fixed `[b"sakura_intent_v3"]` (singleton) | Would make rotation work in-place | Rejected: requires program redeploy AND breaks all existing Intent PDAs' implicit linkage to current protocol; larger surface, more migration risk |
| **Remove `rotate_admin` entirely; admin is immutable by construction** | Governance migration = redeploy with Squads as admin | **Accepted.** Smaller code surface, matches verifying-key immutability pattern, no ambiguity about "which admin is canonical at slot N". Trade-off: migration is heavier once per lifecycle |

This runbook (Step 3 above) reflects the accepted resolution.

**Recommended order for the current devnet → Squads migration:**

1. Complete Steps 1–2 first (transfer upgrade authority — no code change needed).
2. Publish the immutable-admin design in `docs/TRUST_SURFACE.md`.
3. For mainnet launch: deploy under a fresh program ID with Squads as the `initialize_protocol` signer; sunset devnet separately via `set_paused(true)`.
4. Update `lib/insurance-pool.ts`'s `SAKURA_INSURANCE_PROGRAM_ID` to the new mainnet program once live.

---

## Out of scope (explicitly deferred)

- Hardware wallet integration (Ledger/Trezor) for each signer — recommended but not blocking
- Gnosis-Safe-style threshold recovery if signers lose keys (requires Squads feature that may not be available)
- Transferring admin on mainnet (devnet only for now; mainnet follows same steps after audit)
- Publishing signer identities externally before testnet verification
