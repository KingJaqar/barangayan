# Phase 9 — implementation and verification record (2026-10-15)

Paired documents: `plans/Resident_iOS_Implementation_Plan.md` Revision 1.5 and `plans/Resident_iOS_UI_UX_Design_System_Handoff.md` Revision 2.1 (D07, D08).
Source revision: base `e860743` plus uncommitted work. Environment: Windows host, iOS workspace `apps/resident-ios-mobile`. No signed build, no app launch, no live backend run (OD-06, OD-07). Nothing committed, deployed or applied remotely.

## Scope

P09-T01…T08 (A12, A13, A14 request portion, A18; D07, D08). Fee assessment, payment cancellation, QR PH and receipts are Phase 10.

## Entry check

| Dependency | State found | Effect |
|---|---|---|
| Phase 7 | Partially complete (Logs segment open) | The Logs segment is built here and closes P07-T01. |
| Phase 8 | Partially complete | Submission and the received screen reused; `api.request` now returns the full detail row. |
| Hosted contract (read-only, 2026-10-15) | All 20 selected `service_requests` columns, `payments`, `request_attachments` and `service_request_pauses` columns exist; `service_request_sla_tracking` executable by `authenticated`, not `anon`; `cancel_own_service_request` executable by `authenticated`; 5 agency-timed and 69 legacy-timed requests; realtime publication lists `payments` and `service_requests` but **not** `service_request_pauses` | No migration needed; the pauses table is not subscribed (P09-D05). |

## Requirement classification (before editing)

| Requirement | Found | Action |
|---|---|---|
| Own request list | Done in baseline for all rows, status badge only, no filters or counts | Server-side filters, counts, date, reset rules. |
| Request detail | Baseline showed reference, status, notes, payment method as raw text | Rebuilt from the request's own snapshots. |
| Both timing models | Not started | Built (agency clock panel, previous-model panel). |
| Logs | Segment absent (P07-T01 open) | Built. |
| Cancellation | Baseline confirm alert, fixed note, reconciliation present | Confirmation sheet with reason; eligibility moved to a tested model. |
| Realtime | List only | Detail and counts subscribe. |

## Files

- `src/data/request-filters.ts` — filter model and the server restriction each describes.
- `src/data/resident-api.ts`, `src/data/schemas.ts` — `requests(filter)`, `requestCounts`, `activity`, full `request`, `requestAttachments`, `idVersion`, `slaTracking`, `cancelRequest(id, note)`.
- `src/features/services/request-tracking.ts` — pure: history, stages, cancellation, eligibility, fee line, labels, legacy progress, clock projection.
- `src/features/services/sla-clock.tsx` — focus/foreground-aware clock hook and the agency panel.
- `src/features/services/request-detail.tsx`, `src/app/request/[id].tsx` — tracking screen.
- `src/features/services/own-requests.tsx`, `own-logs.tsx`, `src/app/(tabs)/services/index.tsx` — filtered list, Logs, third segment.
- `tests/request-tracking.test.ts` (new, 19), `tests/resident-api.test.ts` (5 added).

No new dependency, migration, shared-package or configuration change.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| P09-D01 | No date or document filter; the list shows both fields and filters by status group. | The plan text says "status/date/document filters" but the Android source and A12-008…018 contain only status groups. Adding filters Android lacks would be unrequested scope; revisit if the owner wants them. |
| P09-D02 | Counts are four server head queries (All, Active, Pickup, History), re-read on a change signal. | Exact beyond the loaded pages; sub-filters carry no count (Android has none). |
| P09-D03 | The recorded amount is a paid payment, else a pending one; cancelled or expired attempts are ignored. | The shared helper takes "the recorded amount"; Android used the first payment, which could be a cancelled attempt. |
| P09-D04 | A legacy request with no hours snapshot uses the current catalogue target hours for its progress. | No historical target exists for version-1 rows (only a fee snapshot); the label says "previous timing model". |
| P09-D05 | `service_request_pauses` is not subscribed. | It is not in the realtime publication, and a binding on an unpublished table can fail the whole channel. Every pause also updates the request row, and the clock re-reads every 15 s. |
| P09-D06 | The clock uses `performance.now()` elapsed since the snapshot, never the device date. | A wrong or changed device clock must not move displayed times (T13 clock skew). |
| P09-D07 | Request cancellation is hidden, with an explanation, while a pending QR payment exists. | A14-007/011: the payment attempt is cancelled first, as its own operation (Phase 10). |

## Baseline versus final

| Check | Baseline (end of Phase 8) | Final |
|---|---|---|
| iOS `tsc --noEmit` | 0 errors | 0 errors |
| iOS `eslint .` | 0 problems | 0 problems |
| iOS `vitest run` | 234 / 234 | 258 / 258 (24 new) |
| `expo export --platform ios` | exit 0 | exit 0 |

A baseline test run started during the first edits failed one test only because the test file still called the old `requests()` signature; it is not a pre-existing failure.

## Acceptance status

| Criterion | Status |
|---|---|
| A12-001…007 own requests, cards, document, reference, date, status, open tracking | Met (non-device). |
| A12-008…018 filters and sub-filters, reset on group change | Met (non-device): server restrictions tested against the real query builder. |
| A12-019…023 loading, no-results, error, retry, refresh by subscription | Met (non-device). |
| A12-024 guest prompt | Met (existing `RequireResident`). |
| A13-001…011 reference, payment method/status, amount, awaiting assessment, no payment required | Met (non-device). |
| A13-012…015 purpose, explanation, details, notes | Met (non-device). |
| A13-016…022 history, times, staff notes, current/future stages, cancellation, live update | Met (non-device). |
| A13-023…031 agency time vs target, resident wait, turnaround, state, reason, pauses, refresh, tick, retry | Met (non-device). |
| A13-032…035 original estimate, estimated completion, progress, previous model label | Met (non-device). |
| A14-001…006 cancel eligible request, confirm, progress, success, failure, hide when ineligible | Met (non-device). |
| A14-007…011 payment-attempt cancellation | Not met here — Phase 10; only the "cancel the payment first" guard is built. |
| A18-001…009 activity, document, date, amount, loading, empty, error, retry, guest | Met (non-device). |
| T13 clock skew, foreground catch-up | Skew met (unit); foreground catch-up not exercised (no renderer). |

## Pending manual verification (Skipped — OD-06/OD-07)

On a signed build against a configured backend with a verified resident who has requests of both timing models: (1) switch every filter and sub-filter and confirm counts match the lists; (2) open an agency-timed request, watch the seconds advance, background the app for two minutes, return and confirm the values catch up without jumping backwards; (3) change the device date by a day and confirm no displayed time moves; (4) from the admin app accept, pause (with a reason), resume, mark ready and release the request and confirm each state, the pause history and the status history appear without a manual refresh; (5) cancel an eligible request with and without a reason, and put the device in airplane mode right after confirming; confirm the final state comes from a re-read; (6) open a request id belonging to another account and confirm "Request not found"; (7) Logs with more than one page; (8) VoiceOver and Accessibility XXL over the filter control, stage list and clock.

## Out-of-scope observations

1. `service_request_pauses` is absent from the realtime publication; if instant pause updates are wanted, that is a Phase 3 domain change.
2. The received screen (Phase 8) now loads the full detail row for a few fields; a smaller read can be split out if that matters.
3. Android's request cards use a hard-coded status palette; iOS uses the existing badge tones.
4. 69 of 74 hosted requests are on the previous timing model, so the previous-model panel is the common case.
