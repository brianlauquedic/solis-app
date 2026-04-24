# Trust Hardening · Combined Deploy Playbook

**Status:** code shipped, deploy pending user execution
**Owner:** Brian (requires access to current devnet upgrade authority keypair)
**Scope:** A (Squads migration) + B (time-lock + guardian) + C-lite (Pyth EMA sanity)
**Estimated wall-clock:** 2 hours focused + 24h cool-down window for B's first propose/execute cycle

---

## What shipped in this PR

- `programs/sakura-insurance/src/lib.rs` — added ~250 lines:
  - Constants: `ADMIN_ACTION_DELAY_SLOTS`, `MAX_PYTH_EMA_DEVIATION_BPS`, `ADMIN_ACTION_SET_PAUSED`, `ADMIN_ACTION_UPDATE_FEES`
  - Inline C-lite EMA deviation check inside `execute_with_intent_proof`
  - 4 new instructions: `initialize_guardian`, `propose_admin_action`, `execute_admin_action`, `cancel_admin_action`
  - 4 new account structs + 2 new state structs (`Guardian`, `PendingAdminAction`) + 4 new events + 6 new errors
- `lib/insurance-pool.ts` — added ~180 lines:
  - 4 new IX discriminators
  - 2 new PDA derivers (`deriveGuardianPDA`, `derivePendingAdminActionPDA`)
  - 4 new builders + 2 payload encoders (`encodeSetPausedPayload`, `encodeUpdateFeesPayload`)
- `docs/SQUADS_MIGRATION_RUNBOOK.md` — step-by-step Squads setup (A)
- `docs/DUAL_ORACLE_SPEC.md` — Switchboard integration spec (C-full, deferred 1 cycle)

**What this PR does NOT do:**
- Deploy the program upgrade to devnet (requires the user's upgrade-authority keypair)
- Create Squads vault on devnet (manual Web UI step)
- Run `anchor build` locally to confirm compilation (user must do this before deploy)
- Change the `IntentProtocol` PDA seeds — rotating admin still orphans the account (documented bug,
  intentionally deferred to a separate migration to minimize the size of this upgrade)

---

## Pre-deploy checklist

- [ ] Pull latest `main` on the dev machine (`git pull origin main`)
- [ ] Run `anchor build` — if any compile error, stop and report. Common issues to watch for:
  - `ctx.bumps.pending` vs `*ctx.bumps.get("pending")` depending on Anchor version
  - `try_borrow_data()?` return type
  - Missing `#[derive(Accounts)]` on new structs
- [ ] Confirm the new program size is within BPF limit (`ls -la target/deploy/sakura_insurance.so` —
  typical sakura-insurance is ~350KB, expect ~400–420KB after additions. Hard limit is ~1MB.)
- [ ] Check existing IDL generation via `anchor idl build --out-ts` if you use the generated client

---

## Deploy order (critical — follow sequentially)

### Step 1 · Transfer program upgrade authority to Squads (~10 min)

Execute `docs/SQUADS_MIGRATION_RUNBOOK.md` Steps 1–2 ONLY:
- Create Squads 3-of-5 vault via https://v4.squads.so (devnet)
- Copy the vault PDA address → save as `SQUADS_VAULT`
- Run:
  ```bash
  solana program set-upgrade-authority \
    AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp \
    --new-upgrade-authority <SQUADS_VAULT> \
    -u devnet
  ```

**Verification:** `solana program show AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp -u devnet` reports
`Upgrade Authority: <SQUADS_VAULT>`.

**Note on admin rotation:** `rotate_admin` has been **removed** from the program entirely
because mutating `protocol.admin` orphans the Protocol PDA (seed depends on `admin.key()`).
Admin is immutable after `initialize_protocol`; governance migration to a multisig = redeploy
the program with the multisig as admin from day 1, then pause the old protocol PDA via
`set_paused`. The `IntentProtocol` admin for the existing devnet deploy therefore stays as the
current EOA keypair until the mainnet redeploy.

### Step 2 · Deploy the new program bytecode via Squads (~30 min)

Now that Squads owns upgrade authority, you can't `anchor deploy` directly anymore. Route through
Squads:

1. Build locally: `anchor build`
2. Upload the new `.so` as a Squads proposal. Use `@sqds/cli`:
   ```bash
   npm install -g @sqds/cli
   sqds program upload \
     --keypair ~/.config/solana/id.json \
     --multisig <SQUADS_VAULT> \
     --program AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp \
     --buffer target/deploy/sakura_insurance.so \
     --url devnet
   ```
3. Open the Squads web app, find the pending "Upgrade program" proposal, get 3 signers to approve.
4. Execute the proposal (anyone can click execute once threshold is met).

**Verification:** Run `anchor idl init` or fetch the on-chain IDL and confirm it now includes
`initialize_guardian`, `propose_admin_action`, `execute_admin_action`, `cancel_admin_action`.

### Step 3 · Register a guardian (~10 min)

A one-time call by the current IntentProtocol admin (still your EOA at this stage):

```typescript
// scripts/init-guardian.ts (create)
import { Keypair, Connection, Transaction, sendAndConfirmTransaction, PublicKey } from "@solana/web3.js";
import * as fs from "fs"; import * as os from "os"; import * as path from "path";
import { buildInitializeGuardianIx } from "../lib/insurance-pool";

const admin = Keypair.fromSecretKey(new Uint8Array(
  JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))
));
const guardianPubkey = new PublicKey(process.argv[2]);
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const ix = buildInitializeGuardianIx({ admin: admin.publicKey, guardian: guardianPubkey });
const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin]);
console.log("guardian registered:", guardianPubkey.toBase58(), "sig:", sig);
```

Run: `npx tsx scripts/init-guardian.ts <GUARDIAN_PUBKEY>`

**Pick a guardian key different from admin.** Recommended: an independent advisor OR a separate
hot wallet you hold on a different machine. The point is that compromising admin should NOT also
compromise guardian.

**Verification:** Fetch the Guardian PDA via `curl` and confirm the `guardian` field matches the
Pubkey you passed.

### Step 4 · Test the propose / execute / cancel flow (end-to-end ~26 hours)

Test **both** the happy path and the cancel path on devnet:

**Happy path:**
1. As admin, `propose_admin_action(action_id=1, action_type=SET_PAUSED, payload=encodeSetPausedPayload(false))`
2. Record the tx signature — wait ~24h (216,000 slots)
3. As admin, `execute_admin_action(action_id=1)` — should succeed
4. Confirm `IntentProtocol.paused == false` (no-op since it was already false, but tests the flow)

**Cancel path:**
1. As admin, `propose_admin_action(action_id=2, action_type=SET_PAUSED, payload=encodeSetPausedPayload(true))`
2. As GUARDIAN (not admin), immediately `cancel_admin_action(action_id=2)` — should succeed
3. Confirm trying to `execute_admin_action(action_id=2)` later returns `ActionCancelled` error

This ensures the time-lock AND the guardian veto are both working before you rely on them for
real emergency operations.

### Step 5 · Run the CU benchmark against new program (~10 min)

C-lite adds ~2k CU for the EMA deviation check. Confirm the measurement:

```bash
export SOLANA_KEYPAIR=$HOME/.config/solana/id.json
npm run bench:verify-cu
```

Expected new measured CU: was ~130k analytical → now ~132–135k measured (adding ~2–5k for EMA
arithmetic). If it's significantly higher (e.g. >200k) investigate before updating the deck.

Write results to `docs/bench-results.md` and update deck slide 12 with the real number.

### Step 6 · Publish the trust surface disclosure (~5 min)

Create `docs/TRUST_SURFACE.md` as specified in `SQUADS_MIGRATION_RUNBOOK.md` Step 4. Include:
- Current Squads vault address + 5 signer Pubkeys
- Current guardian Pubkey
- Known remaining risk: IntentProtocol PDA seed bug (admin rotation requires PDA migration, not yet done)
- Public proposal history link (Squads web app)

---

## Rollback plan (if something breaks after Step 2)

Squads owns the upgrade authority. Rolling back:

1. Run `anchor build` on the PREVIOUS commit (pre-this-PR)
2. `sqds program upload` to Squads as a new proposal targeting the old `.so`
3. 3 signers approve — executes the downgrade

**Do NOT** try to bypass Squads by temporarily transferring upgrade authority back to an EOA.
That would defeat the entire point of this hardening.

---

## Known issues / future work

1. **IntentProtocol PDA seed bug (documented in `SQUADS_MIGRATION_RUNBOOK.md` ⚠️ section)** —
   `seeds = [b"sakura_intent_v3", admin.key()]` means rotating admin orphans the protocol
   account. Fix requires a separate PDA-seed migration, new `InitializeProtocolV2` instruction,
   and state copy. Deferred to a dedicated upgrade.
2. **Switchboard integration (C-full)** — spec in `docs/DUAL_ORACLE_SPEC.md`. 3-day effort.
   Prerequisites: this upgrade stable on devnet for ≥1 week first.
3. **Admin rotation via time-locked flow** — deliberately NOT supported. `rotate_admin` was
   removed from the program because the Protocol PDA seed is `[b"sakura_intent_v3", admin.key()]`;
   mutating admin orphans the account. Governance migration = redeploy with multisig admin,
   sunset old protocol via `set_paused`. See SQUADS_MIGRATION_RUNBOOK.md for the procedure.
4. **Hardware wallet support for Squads signers** — recommended but not blocking. Ledger Solana
   app supports Squads v4 natively.

---

## Verification summary · what "done" looks like

- [ ] `solana program show` reports Upgrade Authority = Squads vault
- [ ] On-chain IDL includes all 4 new instructions
- [ ] `Guardian` PDA exists on-chain at the expected address with a non-EOA-admin guardian Pubkey
- [ ] End-to-end propose → 24h wait → execute works for SetPaused
- [ ] End-to-end propose → guardian cancel works and execute is blocked
- [ ] `npm run bench:verify-cu` shows measured CU ≤200k
- [ ] `docs/TRUST_SURFACE.md` published listing signers + guardian
- [ ] Deck slide 8 (Moat) updated with "Admin trust surface = 3-of-5 Squads + 24h timelock + guardian veto"
- [ ] Deck slide 12 (Traction) updated with measured CU number

At this point the public posture moves from "we say it's secure" to
"you can independently verify on Solscan that admin moves require 3 independent signers
+ a 24h public cooling period + a separate veto key, and oracle manipulation is
mathematically caught by in-program EMA check". That's the trust-chain-length
improvement the article-driven analysis identified.
