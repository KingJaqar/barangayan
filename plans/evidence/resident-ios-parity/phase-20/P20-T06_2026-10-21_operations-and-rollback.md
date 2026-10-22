# P20-T06 — owners, monitoring, incident response, kill switches and rollback (2026-10-21)

Requirements: P20-T06, G20, G13 (operations), G11, PR-07, PR-09, PR-13, C.4 (rollback/kill-switch), plan §5. Owner and reviewer: KingJaqar (OD-01). **Nothing described here is instrumented, scheduled or deployed**: it is the procedure the owner adopts, plus the one part that could be rehearsed without a build (the backend rollback of the two pending migrations).

## 1. Owners

OD-01 names **KingJaqar** for every role, so each duty below has an accountable person, but the register does not supply contact details, a second person, working hours or an escalation path. A single owner for every role is itself a continuity risk (no cover for absence); recorded, not resolved.

| Duty | Accountable | Backup | Verified contact |
|---|---|---|---|
| On-call (app/back end) | KingJaqar | none named | not recorded |
| Resident support | KingJaqar | none named | not recorded (PR-17: no support URL/contact) |
| Moderation (concern reports) | KingJaqar | none named | policy not approved (PR-13); `publicIncidents` closed |
| DRRM / emergency content | KingJaqar | none named | PR-12 waived by OD-10: content is the Android content as is |
| Health (medical drives) | KingJaqar | none named | not recorded |
| Payments (QR PH, pickup, reconciliation) | KingJaqar | none named | PR-08/PR-09 evidence not gathered |
| Notifications (sender, receipts) | KingJaqar | none named | PR-07: no operator for `send-notifications` yet |
| Privacy / security incidents | KingJaqar | none named | not recorded |

## 2. Monitoring indicators and proposed thresholds

Status of every row: **proposed, not instrumented**. No dashboard, alert, log drain or scheduled check exists for this app. G20 stays unmet (also by OD-18: no crash reporter, so a crash is invisible unless a resident reports it).

| Indicator | Where it can be read today | Proposed warn / page threshold |
|---|---|---|
| Notification backlog | `public.notification_worker_health()` (after `0135` is deployed): `pending_total`, `oldest_pending_seconds` | oldest pending > 900 s warn; > 3,600 s page |
| Dead notifications | same: `dead_last_24h` | > 10 warn; > 50 page |
| Push provider errors / missing receipts | same: `ticket_errors_last_24h`, `unreceipted_over_1h` | any `unreceipted_over_1h` for two consecutive hours warn |
| Failed mutations (RPC/Edge) | Supabase API and Edge Function logs (not queried in this phase) | write-RPC 5xx > 5 % over 15 min warn; > 20 % page |
| Uploads | Storage errors in logs; unreferenced objects (`unreferenced_upload_objects` cleanup, migration 0124) | > 5 failed uploads per hour warn; orphan growth reviewed weekly |
| Payments | PayMongo dashboard; `create-payment-source`/`check-payment-status`/`paymongo-webhook` logs | any webhook signature failure or a paid source with no committed payment: page; sources open past expiry: daily review |
| Account deletion | `account_deletion_requests` rows not `completed` (after `0136` deploys) | any `needs_attention` row: same-day review |
| Support | resident messages to the configured contact | unanswered > 2 working days: warn |
| Crashes/errors | none | not available by owner decision (OD-18) |

## 3. Severity and first response

| Severity | Examples | First actions (in order) |
|---|---|---|
| Sev 1 | Private data exposed; payment charged with no record or paid without a receipt; wrong-tenant data visible; deletion erased the wrong records | Contain first: apply the relevant kill switch (§5), then preserve logs, then assess scope, then owner decision on notification and communication |
| Sev 2 | Push backlog, check-in or registration failing, uploads failing for many residents | Apply the narrowest switch; tell residents through the barangay's own channels; fix forward or roll back |
| Sev 3 | Single-resident failures, copy or display defects | Support queue; fix in the next build |

**Privacy/security incident response.** Contain (revoke or rotate the affected server secret or token; disable the affected function), preserve (export the relevant logs before retention expires), assess (which residents, which fields, since when), decide notification with the owner and legal counsel (the barangay is subject to Philippine data-privacy law; confirm the breach-notification duties and timelines with counsel — not asserted here), record the outcome in the execution ledger. Never paste resident data, tokens or keys into chat, tickets or evidence files.

## 4. What the app does while something is switched off

The iOS adapters classify a failed call as a typed failure and show resident-safe copy instead of a success; an uncertain write is never shown as done (Phase 2/19 records; `outcome.test.ts`). Required capabilities are therefore visibly unavailable during an incident, not hidden. Do not close a feature gate merely to make a checker pass (plan C.4).

## 5. Kill switches and rollback

| Capability | Fastest lever | Needs a new binary? | Effect | Rehearsed? |
|---|---|---|---|---|
| Any feature gate | Edit `release-gates.ts`, ship a new build | **Yes.** The gates are build-time constants and OTA is off for the first release, so there is no remote kill switch in the client | — | No (no build exists, OD-06) |
| New QR PH payments | Undeploy/disable `create-payment-source` | No | New QR sources fail with the app's failure copy; pickup and existing paid requests continue | No |
| Provider callbacks | Never disable `paymongo-webhook` casually: pending payments would not settle | No | — | No |
| Remote push | Stop calling/undeploy `send-notifications` | No | The inbox keeps recording; alerts to phones stop. Rows older than a day are skipped at send time, so a long pause does not release stale alerts on resume | No |
| Complete export / account deletion (once deployed) | Undeploy the v2 function code or redeploy the previous version | No | The app shows the failure/unavailable copy | No |
| Evacuation route | Undeploy `evacuation-route` | No | Route cards report the service unavailable | No |
| Database objects of `0135`/`0136` | `rollback-0135-0136.sql` (below) | No | Removes notification history/preferences and the deletion-state table; v1 contracts used by Android and web are untouched | **Yes, on a clone** |

**Order for a backend rollback (database last):** stop callers (sender, v2 functions) → redeploy v1 `export-my-data` and `delete-my-account` code from `HEAD` (the v2 sources are uncommitted today) → run `rollback-0135-0136.sql` (refuses while any deletion is unfinished) → verify Android/web flows. Hosted is at migration `0134`; `0135`/`0136` are not applied there, so nothing needs rolling back until a deployment is approved.

**Binary rollback:** there is no binary. When one exists, App Store distribution cannot revert users to an older build; the remedy is a new build (a corrective submission) or pausing the staged rollout (Skipped, OD-06). Keep the previous build's contracts supported on the backend for that reason (C.4).

### Rehearsal result (2026-10-21, disposable clone, nothing hosted touched)

`bash plans/evidence/resident-ios-parity/phase-20/rollback-rehearsal.sh` clones the local dev database (migration `0117`), applies repository migrations `0118`–`0134` (the hosted state), then:

| Stage | Result |
|---|---|
| A. Baseline suites at the hosted state (15 suites) | 394 assertions ok, 0 failing |
| B. Forward `0135`/`0136`: their four suites (`phase17_notifications` 121, `phase18_account_deletion` 56, `phase3_backend` 86, `service_foundations` 115) | 378 ok, 0 failing; the 15 baseline suites still 394 ok |
| C. Rollback | applied; **0 leftover functions, tables or triggers**; the 15 baseline suites 394 ok again (identical to A); `request_own_account_deletion` (the v1 RPC), `push_tokens` and `upsert_push_token` still present |
| C2. Rollback with an unfinished deletion row | **refused** with `rollback_refused`; the state table intact |
| D. Roll forward again after the rollback | `0135`/`0136` re-apply cleanly; the four suites 378 ok |

The first run **found a defect in the rollback**: dropping `valid_notification_destination` failed because the inbox table's check constraint uses it (20 functions, 6 tables, 5 triggers left behind). The script now drops the tables before the functions and the rehearsal passes; the first two failed runs were not kept as evidence. Full output: `rollback-rehearsal-result.txt`.

### Account and private-data protection

Rehearsed on the clone: (1) the rollback cannot destroy deletion-resume state (C2); (2) the tenant, RLS, storage, ID-evidence, account-setup and payment suites that guard private data pass unchanged after the rollback; (3) the rollback touches no resident data table other than the notification tables and the deletion-state table. Not rehearsed: restoring records after an erroneous deletion (impossible by design), Apple token revocation (PR-06), and anything on a device or the hosted project.

## 6. Status

**P20-T06: Partially complete.** Done: owners recorded, indicators and thresholds proposed, response and kill-switch matrix written, backend rollback written and rehearsed (found and fixed one defect). Open: contact details and a backup person; instrumenting any monitor or alert (PR-07, G20); the server-side levers were not exercised; the client has no remote kill switch; binary rollback and staged rollout are Skipped (OD-06).
