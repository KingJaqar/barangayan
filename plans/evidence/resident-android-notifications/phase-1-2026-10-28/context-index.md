# Phase 1 context supplement — 2026-10-28

Extends the [phase-0 supplement](../phase-0-2026-10-28/context-index.md); only new or changed facts are listed. Shared rules stay in the [plan](../../../Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md) §3.

## Phase checklist

| Item | Record |
|---|---|
| Scope | Additive schema/registry/read/query/System contracts; new emission off; no UI, worker, producer or hosted change. |
| Prerequisites | Phase 0 Verified (ledger, D17–D19, clone `notif_p0_20261028` at 0144) — confirmed by reading its evidence and re-running the phase17 suite on the clone (121/121). |
| Context inputs | Phase-0 packet entries for 0135/0118/0109/0122/send-notifications/shared types/phase17 test (unchanged: 0135 sha `c4cd5186…`, worker sha `3c0362de…`, iOS model sha `34a2598e…`, shared types sha `7428359b…` before edit). Supplement packet below. |
| Acceptance gates | R02–R06/R09 + database/parser portions of R10/R13 (plan §5 phase 1). |

## W1–W6 record

| Step | Result |
|---|---|
| W1 Git | HEAD `9fe8add1` unchanged; status 560 entries (was 545 in phase 0 — concurrent user/session work, untouched). Status, unstaged patch, empty staged patch, pre-edit copies of the two edited tracked files (`service-foundations.ts`, this plan) and their SHA-256 saved under `tmp/resident-notifications-phase1-20261028/before/`. Owned files: see Identity. |
| W2 ripgrep | Callers of `notification_inbox`/`announcement_reads`/destination parsers located: Android uses only `announcement_reads` (`use-unread-counts.tsx`, `use-announcements.ts`); iOS uses inbox + `parseDestination` (`features/notifications/model.ts`); worker `parseClaimed` accepts v1 only (`worker.ts:53–65`). Repowise not used. |
| W3 Reader | Reused phase-0 findings F16–F24 (sources unchanged). |
| W4 Repomix | 1.18.1 (global, same pin). Supplement `tmp/resident-notifications-phase1-20261028/phase1-supplement.xml` sha `8aa18b64…`, 5 files (0080, 0121, worker.ts, use-unread-counts.tsx, iOS model.ts), XML/parsable, no compression, security clean, no omissions, 994 lines / 59,023 chars (tool estimate 14,460 tokens). |
| W5 XML read | Bounded chunks: lines 175–294 (use-unread-counts write paths) and 510–576 (worker run loop); other entries already read from originals this session (0080 lines 10–40, 0121 lines 160–200, worker 1–140, model.ts full). |
| W6 Original source | Effective policies/constraints/grants read from the clone (`pg_policies`, `pg_constraint`, `has_schema_privilege`). Supabase changelog + "Securing your API" docs read before schema work. |

## New findings

| ID | Finding | Impact |
|---|---|---|
| F25 | 0135's `valid_notification_destination` returns NULL (CHECK passes) for objects missing `v`/`kind`, e.g. `{"a":1,"b":2,"c":3}`. Only definer emitters write the inbox, so it was not resident-exploitable. | 0145 coalesces every branch to false (pgTAP case). |
| F26 | `service_role` has **no** usage on `barangayan_private`; `anon` has none either; `authenticated` has usage. | Operator/due/reconcile functions follow 0135's `security definer` + explicit revoke/grant pattern; resident functions run as invoker. |
| F27 | Supabase default privileges grant `anon`/`service_role` EXECUTE on new public functions directly; `revoke … from public` alone left guests able to call the hub reads (caught by pgTAP #7). | Explicit `revoke … from public,anon,service_role` on resident functions. |
| F28 | The inbox CHECK executes `valid_notification_destination` as the writing role, so residents need EXECUTE on it for every `read_at` update (incl. existing iOS writes). An initial revoke broke bulk read (caught by pgTAP). | 0145 keeps 0135's privileges on that function. |
| F29 | A deleted profile still sees its barangay's announcements through the existing residents policy (`current_barangay_id()` ignores `deleted_at`). | Recorded only (out of scope); summary reports no read state for such accounts. |
| F30 | Guests cannot reach private helpers; they have no read state. | Summary is `authenticated`-only; guest views keep the public announcement list (plan §2.2 unchanged). |

## Contracts delivered (migration 0145)

- Gate `barangayan_private.notification_hub_settings` (`emission_enabled`, `v2_alerts_enabled`, `announcement_reads_reconciled_at`), both switches off; owner SQL flips them at rollout.
- Kinds `account_profile|account_verification|account_security|system_service|system_update|system_policy`; subjects `account|notice`; payload version 1|2. Destinations v1 unchanged; v2 `{v:2,kind:'notice',id}` / `{v:2,kind:'account',screen∈settings|profile|valid_id|email_verification|change_password}`.
- `barangayan_private.emit_notification_v2(…, p_destination, p_alert)` — history-only when `p_alert=false`; v2 outbox rows only when `v2_alerts_enabled` (old worker rejects v≠1, `worker.ts:60`).
- Resident: `notification_hub_summary(view, filter)`, `notification_inbox_page(source, view, filter, before_created_at, before_id, limit≤50, default 25)`, `notification_mark_scope_read(view, filter)` (single-statement snapshot, per-resident advisory lock).
- Bridge triggers `z_sync_announcement_read_to_inbox` / `z_sync_inbox_read_to_announcement` (+ mirror index); `barangayan.read_bridge='off'` used only by restore.
- Service role: `notification_reconcile_announcement_reads(limit≤100)` with ledger `barangayan_private.notification_read_restore`; `notification_restore_announcement_reads(batch)` (revision-checked).
- `public.system_notices` (RLS: published + own/all barangay; column grant hides `created_by`/fan-out fields) and service-role `system_notice_create|publish|revise|resolve|cancel`, `notification_publish_due_notices(limit≤100)` (bounded resumable fan-out, supersedes unsent older-revision alerts, expiry stops delivery, no-op while gate off).
- Android `src/lib/notification-hub.ts` (views/chips, kind→chip/source registry, v1/v2 destination parser); shared types `SystemNoticeRow`, hub RPC signatures.

## Identity (owned files, final)

| File | SHA-256 |
|---|---|
| `supabase/migrations/0145_notification_hub_contracts.sql` (new) | `3880306b98c1eedb1dc864e022a9825e8f78395dce053513dfc094c4ad7d859b` |
| `supabase/tests/resident_android_notification_hub.test.sql` (new) | `be05d3f6e34811adb5dfcc7492b8a7ed3e0bea2b60b6d5b57a947e70d08b0f7e` |
| `supabase/tests/notification_hub_concurrency.mjs` (new) | `334d17e4ed3b14bc9e76de0c0653133cfaed98ab9a5d20fc42e0e4df1d62abde` |
| `apps/resident-android-mobile/src/lib/notification-hub.ts` (new) | `416ea4b31fc7a0d319ca2ff3e10c040c7b2b8f4f6f8b8c1ab17c779c65ab86e8` |
| `apps/resident-android-mobile/src/lib/notification-hub.test.ts` (new) | `b2aa00a16572ce5d23dc73639ad14ca7a5519551bf9bf2bb20eedaab47ca1889` |
| `packages/shared/src/types/service-foundations.ts` (+21 lines) | `3651927e8344b2a18d32a79150835ce4bd846acc87ec2c0ab4f1518b9ec08e95` |
| `apps/resident-ios-mobile/tests/notifications.test.ts` (+7 lines, compatibility case) | `26535ac866cf9906f93d6f9ed586e053494d9eb1aace1fb5a25f710ffe7123dc` |

## Recovery record

- Pre-reconciliation snapshot of the clone's `announcement_reads` (3 rows) and inbox read state (0 rows) saved outside the repository (session scratchpad; `tmp/` is not git-ignored). Committed reconciliation on the clone: `0 added / 0 marked / 0 remaining`, boundary recorded, markers byte-identical to the snapshot.
- Revision-checked restore rehearsed in pgTAP §8: 2 restored, 1 skipped (resident's later unread kept), second run `0/1`, bridge re-enabled.
- 0145 re-applied to the migrated clone without error (idempotent DDL).
- Clones: `notif_p0_20261028` untouched (phase-0 baseline); `notif_p1_20261028` = p0 + 0145, task-owned, retained for phase 2.

## Checks

See [baseline-and-verification.md](baseline-and-verification.md).
