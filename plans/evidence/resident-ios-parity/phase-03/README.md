# Phase 3 — Backend compatibility, authorization and domain safeguards (`P03`)

**Status (2026-10-15):** Partially complete. All eight tasks are implemented or staged and were verified on isolated database clones under the non-device standard (OD-06). Migrations `0121`–`0124` are now present in the hosted migration history (pushed outside this session; read-only advisors confirm the revocations). Still open: removing one stray history row this session created, deploying the `delete-my-account` freshness check, running the invariants against the hosted schema, and the hosted Auth settings. See record section 7.

**Entry dependencies:** Phase 0 (Verified), Phase 2 (Verified, non-device scope).

**Lead owner role:** Backend/security lead + domain owners. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Deployed/tested compatible contract baseline and security safeguards, with exact migration/function/schema evidence and owned later operational gates.

| Task | Status | Blocker / next step |
|---|---|---|
| P03-T01 | Verified (non-device scope, OD-06) | Hosted drift recorded: payments insert policy (fixed in 0121), `0115` archive guard and entrance-position constraint (owner: the 0113/0115 session) |
| P03-T02 | Implemented; verified on rehearsal clone; applied to hosted | Hosted invariant run pending |
| P03-T03 | Implemented; verified on rehearsal clone; migrations applied to hosted | `delete-my-account` freshness check not deployed; Apple provider (PR-06), callback allowlist (PR-03) and Auth password-change freshness are hosted settings, open |
| P03-T04 | Implemented; verified on rehearsal clone; applied to hosted | Hosted invariant run pending |
| P03-T05 | Verified on rehearsal clone | No schema change required; payment Edge Function evidence is Phase 10 |
| P03-T06 | Implemented; verified on rehearsal clone; applied to hosted | Hosted invariant run pending |
| P03-T07 | Designed and staged | Consumed by Phases 17/18; PR-07/PR-13/PR-14 decisions |
| P03-T08 | Verified on rehearsal clone | Staging-schema run pending (PR-01: no staging project) |

## Evidence

- [P03_2026-10-14_implementation-and-verification.md](P03_2026-10-14_implementation-and-verification.md) — hosted reconciliation, gaps and fixes by task, baseline vs final checks, decisions P03-D01…D10, pending owner actions.
- [P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md](P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md) — staged inbox/outbox/token, export v2, deletion/retention and upload-cleanup contracts.

Repository artifacts: `supabase/migrations/0121`–`0124`, `supabase/tests/resident_ios_phase3_{backend,requests,storage}.test.sql`, `resident_apple_account_setup.test.sql`, `resident_household_conditional.test.sql`, `unreferenced_upload_objects.test.sql`, `resident_ios_phase3_concurrency.mjs`, `supabase/functions/delete-my-account/fresh-authentication.{ts,test.ts}`.
