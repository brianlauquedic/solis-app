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

## Step 3 · Rotate IntentProtocol admin (~15 min)

The `IntentProtocol` PDA's `admin` field is currently the same EOA. We need to call `rotate_admin(new_admin: Pubkey = <SQUADS_VAULT>)`.

**Option A · Using the existing CLI keypair (while it still has admin)**

```bash
# Build a one-shot TS call
cat > /tmp/rotate.ts <<'TS'
import { Connection, Keypair, Transaction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs"; import * as os from "os"; import * as path from "path";
import { buildRotateAdminIx } from "./lib/insurance-pool";

const secret = new Uint8Array(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")));
const admin = Keypair.fromSecretKey(secret);
const newAdmin = new PublicKey(process.argv[2]);
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const ix = buildRotateAdminIx({ admin: admin.publicKey, newAdmin });
const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin]);
console.log("rotated →", newAdmin.toBase58(), "sig:", sig);
TS
```

Then run:
```bash
npx tsx /tmp/rotate.ts <SQUADS_VAULT>
```

(Note: `buildRotateAdminIx` must be added to `lib/insurance-pool.ts` — it may not exist yet. Check before running.)

**Option B · Using Squads itself (safer, recommended)**

Via Squads web app: create a custom transaction proposal that calls `sakura-insurance::rotate_admin(new_admin)`. This proves the Squads vault-signing flow works end-to-end before you critically depend on it.

---

## Step 4 · Publish the trust surface doc (~10 min)

Create `docs/TRUST_SURFACE.md` with the new governance architecture. Minimum content:

```markdown
# Sakura · Trust Surface (public disclosure)

## On-chain privileges

| Role | Who holds it | How it changes |
|---|---|---|
| `sakura-insurance` upgrade authority | Squads vault `<SQUADS_VAULT>` · 3-of-5 | Squads proposal |
| `IntentProtocol.admin` | same Squads vault | Squads proposal → `rotate_admin` |

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

## ⚠️ Known issue: IntentProtocol PDA address changes when admin changes

The PDA seeds include `protocol.admin.as_ref()`. If admin changes from EOA to Squads vault, the PDA address changes. This means:
- The OLD IntentProtocol PDA (`Ab3ZwupehsPz9fhPhmjwfzrn3XPypdrNj9wvwb6bt96M`) becomes orphaned
- A NEW IntentProtocol PDA must be initialized at a different address with Squads as admin
- Total state migration issue: all existing `Intent` PDAs reference the old protocol; they still work because Intent seeds don't depend on protocol's admin, but readers must know which Protocol PDA is "current"

**Options to resolve:**

**Resolution A (simplest):** Just call `rotate_admin` — the field updates but the PDA address stays the same (because Anchor derives the PDA at account resolution time using the CURRENT admin field, not a fixed seed). Wait, no — seeds are static at derivation time. The account's `admin` field changes but its PDA address is fixed.

Let me re-read: `seeds = [b"sakura_intent_v3", protocol.admin.as_ref()]` in `AdminOnly` means Anchor re-derives the PDA each call using the CURRENT admin value stored in the account it's reading. That's actually circular — Anchor can't find the account because the PDA depends on a field inside the account. In practice, this seed style means the account **must always resolve to the PDA that matches its current admin**. If you call `rotate_admin` and change admin, the account's PDA address no longer matches its seeds → subsequent calls fail.

**This is a design bug in the current program**, separate from the single-EOA issue. It means `rotate_admin` is actually broken — you can call it once, but the resulting account becomes orphaned because its PDA no longer self-consistently derives.

See `docs/TRUST_HARDENING_DEPLOY.md` for the fix: remove admin from the PDA seed, migrate to a fixed seed `["sakura_intent_v3"]` (singleton protocol PDA).

**Recommended order:**
1. Complete Steps 1–2 first (transfer upgrade authority — no code change needed)
2. Ship plan B (time-lock) as a program upgrade that also fixes the PDA seed design
3. Then `rotate_admin` to Squads vault via the new time-locked flow

---

## Out of scope (explicitly deferred)

- Hardware wallet integration (Ledger/Trezor) for each signer — recommended but not blocking
- Gnosis-Safe-style threshold recovery if signers lose keys (requires Squads feature that may not be available)
- Transferring admin on mainnet (devnet only for now; mainnet follows same steps after audit)
- Publishing signer identities externally before testnet verification
