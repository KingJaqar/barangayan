# Phase 0 context supplement — 2026-10-28

Extends the [planning context index](../planning-2026-10-27/context-index.md); only changed or new facts are listed. Shared rules stay in the [plan](../../../Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md) §3.

## W1–W6 record

| Step | Result |
|---|---|
| W1 Git | HEAD `9fe8add1` unchanged. Baseline status (545 entries), relevant unstaged patch (113,597 B) and empty staged patch saved under `tmp/resident-notifications-phase0-20261028/before/`. 15/17 planning identities unchanged; `requests-list.tsx` and `disclosure-motion.ts` changed (concurrent user work, preserved). During the run another session added `tmp/verification-*.xml/png` (8 files); not touched. No product file edited in phase 0. |
| W2 ripgrep | Producer writers, triggers, routes, harness, scheduler and policy sources located (see ledger). Repowise not used (no index established). |
| W3 Reader | Planning packet entries for unchanged files reused (F01–F03, F05–F15 stand). F04 invalidated (below). |
| W4 Repomix | 1.18.1 (global `repomix`, same version as npx cache). 8 selectors, XML, parsable, no compression, git sort off, security clean, no omissions. [Packet](context.xml) / [manifest](packet-manifest.json). |
| W5 XML read | 7 bounded chunks (each ≤200 lines, ≤12,000 chars) covered all entries except the phase17 test bodies, which were recorded as an explicit partial read (inventory only) and executed in full instead. |
| W6 Original source | Effective SQL definitions taken from the migrated clone (`pg_get_functiondef`, `pg_trigger`, `pg_policies`, `pg_constraint`), resolving later redefinitions (0125/0126/0139/0142/0144) that file-level reads would miss. |

## New / changed findings

| ID | Finding | Impact |
|---|---|---|
| F04′ | **Supersedes F04/D12 wording.** `requests-list.tsx:183–232` (sha `9f4a1616…`) now uses Reanimated shared values: `useRequestMotion` (160 ms `withTiming`, reduced-motion snap, `cancelAnimation` cleanup), section height = measured content height × progress, separate opacity/translate appearance. `disclosure-motion.ts` (sha `6d93a1cd…`) is now documented as Health calendar motion only. | Phase 3 reuses the Requests shared-value pattern, not RN `Animated` + `disclosureMotion`. Runtime correctness still unverified. |
| F16 | `emit_notification` always creates an outbox row; no history-only path (0135:124–146). | Phase 1 contract: no-alert history variant (D18). |
| F17 | `review_service_request` is disabled (`request_review_removed`); resident-action state is the SLA pause with a required resident-wait reason. | A32 maps to pause start; A37 to resume (D17). |
| F18 | `id_repair_required=true` is written only by the 0096 legacy import; publication clears it. | A12 = transition trigger + one bounded activation reconciliation (D17). |
| F19 | Resident can read own `id_submissions` (incl. `rejection_reason`) under RLS "owner and tenant administrator read ID versions"; Android `valid-id.tsx` shows no review reason today. | A09/A10 need reason display in phase 3 (authorized, existing data). |
| F20 | Password observer keeps `password_set` true/false/**null** on `resident_account_lifecycle`; first-set is knowable only from `old.password_set=false`. | A18 vs A19/A20 split per D16. |
| F21 | `payments.status` ∈ pending/paid/failed/expired/cancelled/refunded; `refund_status` ∈ none/pending/processing/refunding/refunded/failed; writers are service-role Edge Functions (refund-payment, paymongo-webhook, check-payment-status). | A43/A44 producers on `payments`; webhook actor = null uid (alert-eligible). |
| F22 | Announcements: anon reads every non-deleted announcement (no barangay or `published_at` filter); residents read their barangay; `announcement_reads` is owner-ALL with `guard_announcement_read` (tenant + identity immutability). Inbox `read_at` is a separate column-level grant (0135:80–84). | U04 resolved; G10 future-publication visibility is an observation for phase 1 (no change authorized here). |
| F23 | Sender is an Edge Function gated by `NOTIFICATION_WORKER_SECRET` (`send-notifications/index.ts:1–20`, `config.toml` `verify_jwt=false`); no scheduler for it exists in any migration (only 0077/0099 `cron.schedule`). Hosted apply/deploy state of 0135 is unverified (memory: not applied as of 2026-10-21). | U03 resolved for design: due System notices are published by an RPC the existing worker calls before `notification_worker_claim`; operator publishing is service-role-only SQL/RPC. Hosted activation stays a separate owner action. |
| F24 | Android has `expo-notifications ~57.0.11`, `expo-constants ~57.0.9`, `expo-linking`; app `com.barangayan.resident` v1.0.0 / versionCode 6; no verified store listing URL. | Y08 notice is informational without an external link. |

## U-item status

| ID | Status | Resolution / remaining |
|---|---|---|
| U01 | **Resolved for phase 1** | Every enabled writer, actor rule and committed state is mapped in the [coverage ledger](coverage-ledger.md); discrepancies A12/A32 decided (D17). |
| U02 | **Resolved** | Harness = disposable clone recipe (B13) + `psql -At -f` pgTAP; worker/parser = iOS Vitest (B12); Android = tsc/lint/vitest/UI fixtures (B01–B11). Edge runtime replica recipe (memory `isolated-local-db-testing`) for phase 2 I1. |
| U03 | **Resolved for design; hosted pending** | See F23. No scheduler is added; hosted scheduler/secret configuration needs owner action at rollout (§8.2). |
| U04 | **Resolved for design** | See F22. Bridge = minimal owner-scoped trigger pair on `announcement_reads` ↔ inbox `kind='announcement'` row with equality short-circuit; reconciliation boundary recorded at activation. |
| U05 | Deferred to phase 6 | Unchanged. |
| U06 | Superseded by F04′ | — |

## Phase-1 concrete inputs

- **Rehearsal target:** clone `notif_p0_20261028` (already at 0144). New migration numbering starts at **0145** (repository convention `NNNN_snake_case.sql`; never edit 0135 or earlier).
- **Commands:** `docker exec supabase_db_barangayan psql -U postgres -d <clone> -v ON_ERROR_STOP=1 -f <migration>`; pgTAP `psql -At -f supabase/tests/<suite>.test.sql` (count `ok`/`not ok`); iOS `npx vitest run tests/notification-worker.test.ts tests/notifications.test.ts`; Android `npx tsc --noEmit`, `npx expo lint`, `npx vitest run`.
- **Permissions to prove in pgTAP:** resident may change only own read state (inbox column grant + new bulk/individual RPCs, `security invoker` where RLS suffices); System publish/revise/resolve executable by `service_role` only; `anon` sees no private inbox; foreign resident/tenant writes affect 0 rows; reads emit 0 events.
- **Recovery:** before any read reconciliation, snapshot `(resident_id, announcement_id, read_at)` and inbox `(id, read_at)` into a private task table in the clone; rehearse restore that skips rows whose `read_at` changed after the snapshot. No hosted data is touched.
- **Decisions added to plan:** D17 (A12/A32/A37 mapping), D18 (no-alert history path), D19 (pre-existing fixture/suite failures are baseline, not regressions).
