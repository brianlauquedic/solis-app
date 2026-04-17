# Sakura Mandate — Anchor Program Tests

## TypeScript client tests (already running via Vitest)

Client-side instruction encoding, PDA derivation, state deserialization, and layout round-trips are covered in:

- `__tests__/mandate-program.test.ts` — 30+ tests covering:
  - PDA derivation determinism + off-curve check
  - All 4 instruction discriminators (SHA-256-derived)
  - Create/update/close instruction byte layouts
  - `execute_rescue` account ordering (7 accounts) + `proof_hash` length enforcement
  - State deserialization for new 116-byte layout (u64 `rescue_count`, no overflow at 256)
  - USDC ↔ micro-USDC round-trip
  - `formatMandateState` API shape

Run with:

```bash
npm test -- --run __tests__/mandate-program.test.ts
```

## Rust program tests (require `anchor test`)

The on-chain program can be integration-tested against a local validator:

```bash
anchor build      # compiles sakura_mandate.so
anchor test       # spins up local validator + runs TS integration tests
```

Suggested integration test plan (to be written when Anchor CLI is available):

1. **Create mandate** — authority signs, PDA initialized with correct fields, event emitted
2. **Reject invalid threshold** — `trigger_hf_bps = 100` (out of 101..300) returns `InvalidThreshold`
3. **Reject zero amount** — `max_usdc = 0` returns `ZeroAmount`
4. **Execute rescue happy path** — SPL approve + Anchor CPI transfer succeed, counter increments
5. **Reject wrong agent** — signer != `mandate.agent` returns `has_one` violation
6. **Reject exceeding ceiling** — `rescue_amount > max_usdc - total_rescued` returns `ExceedsCeiling`
7. **Reject HF above trigger** — `reported_hf_bps > mandate.trigger_hf_bps` returns `HealthFactorAboveTrigger`
8. **Reject wrong ATA owner** — passes ATA owned by different wallet → `WrongOwner`
9. **Reject missing SPL delegate** — user hasn't called `approve` → `DelegateMismatch`
10. **Close mandate** — `is_active` flips to false, `MandateClosed` event emitted, rent reclaimed

## Security audit checklist (manual review)

- [x] `has_one = agent` on `ExecuteRescue` — only mandate's designated agent can call
- [x] `checked_sub` / `checked_add` on all arithmetic — no silent overflow
- [x] `rescue_count: u64` — no overflow at 256 (was bug in pre-fix v1)
- [x] `reported_hf_bps <= trigger_hf_bps` verified on-chain — agent cannot forge panic
- [x] `token::mint` constraint on both source + destination — wrong-token attack blocked
- [x] `user_usdc_ata.owner == mandate.authority` — agent can't redirect to attacker ATA
- [x] `user_usdc_ata.delegate == Some(agent)` — SPL delegate gate enforced pre-CPI
- [x] `close_mandate` flips `is_active = false` before Anchor closes the account
- [x] PDA seeds = `[b"sakura_mandate", authority.key().as_ref()]` — one mandate per wallet
- [x] `CpiContext::new` (not `new_with_signer`) — agent signer of outer tx drives SPL transfer
