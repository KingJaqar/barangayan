# Phase 5 — Incidents, Health and Applicants

Completed 2026-10-12, Asia/Manila. Integration was implemented in an earlier Codex session; this record adds the outstanding acceptance groups, final static checks, scope review and cleanup. Phase 6 and production release remain unstarted.

The three routes use the Phase 2 authoritative adapters and Phase 1 controls. Incident Reports defaults to Submitted (`incidents.created_at`) descending with Open selected; Health defaults to Date created (`medical_drives.created_at`) descending with Upcoming selected and keeps Drive date as a separate sort; Medical Applicants defaults to Registered (`drive_registrations.created_at`) descending with All selected. All is first on Incident and Health. Registration counts are complete aggregates, applicant resident names participate in the parent query before paging, and scores remain administrator-only with inner-score membership. No migration or dependency was added; the highest repository migration remains `0112`.

| Evidence | Executed result |
| --- | --- |
| `acceptance-browsing.json` | Chrome defaults, five sizes, exact ranges/empty state, date labels, keyboard scrolling/Tab escape, resizing, narrow layout, beyond-cap trimmed search; all **50** sort/direction combinations match database order; complete unchanged concatenations have no gaps/duplicates (attempts 1–3 retained as failures) |
| `acceptance-matrix.json` | Firefox 153.0 and WebKit 26.5 integrated browsing on all three routes |
| `acceptance-flows.json` | Combined filters with independent complete summaries; Health Today ⊂ Upcoming and category combination; >1,000-registration and zero-registration aggregates; missing-score exclusion, missing-profile retention, global resident-name order; separate table/summary/option failures with query-preserving Retry; delayed rapid controls, Back debounce cancellation, one invalid-page correction, 23 rows at size 100 |
| `acceptance-actions.json`, first three groups | Real incident/drive creation, guided incident statuses, drive active edit and removal with audits; failed inline drafts block navigation, keep identity and retry/persist/audit on all routes; complete beyond-cap resident and own-tenant drive lookups, real registration RPC with score, status change and cancellation |
| `acceptance-actions-rerun.json` | Native detail dialogs show Submitted / Date created / Registered at from `created_at`, retain failed modal drafts, revalidate after save and restore focus on Escape |
| `acceptance-realtime.json` | Three actual events per route: zero refreshes while editing, one after cancel; selected details revalidate off-page, distinguish read errors and confirmed unavailability; ten mount cycles keep one channel and one table Resize/MutationObserver |
| `acceptance-timing.json` | Warm control-to-committed-result p95: Incidents **634.54ms**, Health **690.44ms**, Applicants **745.99ms** (ten samples each, loopback/unthrottled development preview, ~1,500 rows per route) |
| `route-permissions.json`, `security.json` | 12 route cases (anon/resident/removed admin/foreign admin) and 18 query cases, including zero exposed protected scores |
| `browser-results.json` | 11 shared fixture groups on each of Chrome 154.0.8037.99, Firefox 153.0 and WebKit 26.5; Edge not installed |
| `unit-tests-final.log`, `lint-final.log`, `typecheck.log`, `build-final.log` | 68 tests, full admin lint, typecheck and webpack production build pass on the final source |
| `scope.json`, `runtime-cleanup.json`, `runtime-request-log.json` | Scope and cleanup; see below |

## Pre-existing defect found (not introduced or fixed here)

Administrators cannot remove incidents. The only `incidents` SELECT policy reachable by administrators (`residents read own barangay incidents`, migrations 0022/0025) requires `deleted_at IS NULL`. Because the soft-delete UPDATE filters by `id`, PostgreSQL requires the new row to satisfy a SELECT policy, so the update fails with `42501 new row violates row-level security policy` with or without `RETURNING`. The removal query is byte-identical to `HEAD`. The UI surfaces the error, keeps the row and writes no delete audit; the actions test asserts exactly that. The same gap withholds the Realtime event for an incident soft-deleted elsewhere; the selected detail revalidates on the next committed query instead (asserted in `acceptance-realtime.json`). Medical drives are unaffected because `admins read all medical drives` has no deletion filter. Fixing it needs an RLS policy migration, which this plan does not authorize without the owner's decision.

## Shared observation for Phase 6

On every integrated route (including Phases 3–4) the shared table first renders with `table-layout: auto` and switches to measured `fixed` layout after hydration, widening columns (for example Incident Reports 1,787 → 2,257px, Requests 1,360 → 1,480px; `debug-width.mjs`). Layout is stable afterwards and every action remains reachable, but early pointer targets can move once. Acceptance waits for the settled layout. This is shared Phase 1 behavior, left unchanged.

## Corrections, attempts and diagnostics

Failed attempts remain intact (`*-attempt*.json/log`). Corrections were to test code only: a hard-coded second-drive count replaced by a database comparison; label-wrapped form controls located by visible label text; uppercase dialog labels compared by `textContent`; the post-save dialog assertion waits for revalidation; the Incident needle also matches its reporter name, so the off-page patch clears the reporter; and the RLS behaviours above. `debug-*.mjs` and `debug-remove.png` are diagnostics. `codemods/` holds the one-off Codex patch scripts formerly left in the ignored `dist/` directory; they are already applied and retained as provenance only.

## Scope and cleanup

`scope.json` reports `passed: false` only because of 121 concurrent resident-web loading/toast files and evidence belonging to the separate Resident Web plan; they were not modified by this work. No admin source outside the Phase 5 allowance, resident Android UI, shared package or migration changed. The four task-owned containers, network and private credentials were removed (`runtime-cleanup.json`); the owned preview and proxy were stopped. The ignored source snapshot `dist/admin-table-phase5-preview` remains for repeat checks. No source/hosted database write, migration application or deployment occurred.

Hosted acceptance/advisors, native Safari/Edge, physical inputs/OS scrollbar settings, native zoom, manual screen readers, other network profiles and 100k deep pages remain Phase 6 verification. No production-readiness claim is made.
