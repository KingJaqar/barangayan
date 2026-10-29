# Phase 5 context supplement and verification — 2026-10-28

Extends the [phase-0](../phase-0-2026-10-28/context-index.md) … [phase-4](../phase-4-2026-10-28/context-index.md) supplements. Shared rules: plan §3. Raw logs, packet and pre-edit status (private, not committed): `tmp/resident-notifications-phase5-20261028/` (`logs/`, `before/`, `context.xml`, `selectors.txt`).

## Checklist
| Item | Record |
|---|---|
| Scope | Integrated regression (I2), performance/request-cost audit, dead-code ledger, defects the journeys expose. No DB schema, worker, hosted service, gate or device change. |
| Prerequisites | Phases 1–4 Verified in the plan; re-proved in code and by running: 0145/0146 apply on a fresh clone and their pgTAP/concurrency/I1 suites pass again; hub data layer, parser, tap handler, push registration exist and their fixtures pass. |
| Context inputs | Direct reads of the plan, phases 0–4 evidence, the data layer/hook/provider sources, the I1 script and the worker types. One scoped Repomix 1.18.1 packet (`context.xml`, 6 files, 43,602 chars, ~10.7k tokens, security clean, `--include` honoured, no omissions; sha256 `ded9f7c8bfd318d7…`) read in bounded chunks: `use-notification-hub.ts` (lines 18–105, complete) and `use-unread-counts.tsx` (618–817 of 886; the remainder was read from source). The other four entries were read from original source earlier this session. Packet token estimate is tool metadata, not usage. Repowise not used. |
| Instructions | Root `AGENTS.md` empty; nested ones cover only admin-web/resident-web. No conflict with the plan. |
| Git baseline | HEAD `9fe8add1`; 631 status entries at entry (user/concurrent work, saved to `before/status.txt` + `unstaged.patch`). Concurrent sessions edited `home/index.tsx`, `app-tabs.tsx`, `home-request.*`, `home-presentation-ui.mjs`, `use-id-resubmit-limit.ts`, `id-resubmit-limit.*` during this phase — not mine, untouched. Owned changes only: see Files. |
| Database identity | Clone `notif_p5_20261028` = `notif_p2_20261028` (0145+0146) + repository migrations 0147, 0148, 0149 (concurrent plans) applied with `ON_ERROR_STOP`; gate `false,false` at start and end. Migration hashes: 0145 `3880306b98c1`, 0146 `086138861e46`, 0147 `bc403112b8ee`, 0148 `2f44fce11113`, 0149 `818a85fa83fe`; worker `beef23fa2b56`. |

## Baseline (entry, single runs; logs `logs/B*.log`)
tsc 0 · lint 0 errors / 1 pre-existing warning (Health `useState`) · vitest 35 files / 384 tests · `notification-hub-ui`, `notification-tap-ui`, `reports-announcements-ui`, `services-lists-ui`, `request-tracking-navigation`, `tracking-payment-ui`, `services-tab-stability`, `settings-profile-ui` pass · `resident-shell-lifecycle` **failed** (waiting for the DRRM tab: `app-tabs.tsx` and the fixture were being edited by another session; it passed on the next run once that work settled) · `root-navigation-isolation` failed to launch (no `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; passes with installed Chrome, phase-4 recipe).

## Findings and decisions
| ID | Finding / decision |
|---|---|
| F41 | **Defect (real API):** `use-unread-counts` read `announcements`/`announcement_reads` ids with one unranged select each. PostgREST caps a response at `max-rows` (1,000; local and hosted default), so for a resident with more than 1,000 announcements the per-row unread set was truncated: rows beyond it rendered as read, and opening them never marked them read (`announcements.tsx:80` checks that set). Counts (server RPC) stayed right, so card/header and row state disagreed. Proved by the I2 journey (raw query returns exactly 1,000 of 1,060). |
| D39 | `loadUnreadAnnouncementIds(ownerId)` (data layer) reads both lists in `id`-ordered ranges with an exact count until complete (`from = rows already read`, so a smaller server cap still terminates); the provider calls it instead of its inline queries. ≤1,000 rows is still one request per list. |
| F42 | **Amplification:** Realtime reports one event per changed row; a bulk read of N rows made the hub hook and the unread provider each refetch N times (the resource owner restarts its request on every invalidation). Pre-existing for announcement reads, widened by the hub's bulk Account/System read. |
| D40 | `lib/burst.ts` `coalesce(action, 300 ms)`: the first event of a burst schedules one run, the rest are absorbed; cancelled on cleanup. Applied to the hub hook's channel and the provider's announcements/reads/inbox listeners. Explicit user actions (`markInboxRead`, `markHubScopeRead`) still refetch immediately. Incident-count listener untouched (outside this plan). |
| F43 | Local PostgREST holds a JWKS (EC verify key + legacy `oct` key), so HS256 test tokens are signed with the `oct` key; the script derives it in-process and prints nothing. |
| D41 | I2 harness: the app's own `notification-hub-data.ts` + `notification-hub.ts` bundled unchanged by esbuild, with only `@/lib/supabase` replaced by a supabase-js client on an isolated PostgREST container (`notif_p5_rest`, `public.ecr.aws/supabase/postgrest:v14.5`, CLI env with the DB URI swapped, port 58410) and locally signed resident JWTs; the Edge sender's `runWorker` runs with service_role over the same PostgREST; only Expo is simulated. The React screen/hook stay covered by the fixture (a JS mirror), not by this harness. |
| Observation | Two read owners subscribe to the same tables while the screen is open (hub list: 1 channel/3 listeners; provider counts: 4 channels) — Phase 3 design (D29), fixture-asserted at 7 channels with no accumulation across card cycles. Left as is: merging them would change verified phase-3 ownership; each now refetches once per burst. |

## Dead-code and deletion ledger
| Item | Evidence | Result |
|---|---|---|
| Replaced paths from phases 3–4 (`announcements-feed.tsx`, `use-announcements.ts`, `announcementTemplate`, `incidentTemplate`, `serviceRequestTemplate`, `getExpoPushToken` export, `markAnnouncementsRead`) | `rg` over apps/packages/supabase/scripts (excluding node_modules/dist/repomix dumps/iOS): no import, route, config or migration reference. Remaining name hits: `getExpoPushTokenAsync` (Expo API), resident-web's own `use-announcements.ts` family (different app), one stale comment | Already deleted; confirmed unreferenced; tsc 0 and bundle export exit 0 |
| Stale comment in `use-incidents.ts` naming the deleted `use-announcements.ts` | tracked file, unchanged by the user | Re-pointed to `use-notification-hub.ts` |
| Exports with no importer: `ACCOUNT_SCREENS`, `NOTICE_ACTIONS` (`notification-hub.ts`), `readRecord` (`push-registration.ts`) | per-name `rg` of src/tests: only in-file uses | `export` removed (values kept, used in-file). Type-only exports and the test-used `inboxFilter`/`inboxSource` kept |
| Health branches, `notification-templates.ts` (Health), token utilities | still referenced (D13/D38) | Retained |
No file was deleted this phase; nothing needs restoring.

## Files (owned this phase) and identity (SHA-256, first 12)
Changed: `src/lib/notification-hub-data.ts` `3c13830082f1` (+`loadUnreadAnnouncementIds`), `src/hooks/use-unread-counts.tsx` `74f52ed4a32b` (D39/D40), `src/hooks/use-notification-hub.ts` `47fb10e26273` (D40), `src/lib/notification-hub.ts` `2bb1fbccf7a7` and `src/lib/push-registration.ts` `84b0dcac0779` (unexport), `src/hooks/use-incidents.ts` `2cda1452cebd` (comment), `tests/notification-hub-ui.mjs` `ce0dbb685f52` (mock `range()`, 700-event burst scenario).
New: `src/lib/burst.ts` `d30be28e949d` + `burst.test.ts` `fc618518f69a` (3 tests), `tests/notification-hub-i2.mjs` `3b929be1a691`. No dependency added.

## Verification
| Check | Result |
|---|---|
| `NOTIF_TEST_DB=notif_p5_20261028 … node tests/notification-hub-i2.mjs` (J1–J8) | exit 0, 8/8 journeys (below). First run failed only on the harness (HS256 vs the local JWKS, F43); no product change needed to pass |
| pgTAP on `notif_p5` (15 suites) | hub 162/162; producers 125/125; phase17 121/121; status_editor 61/61; phase18 56/56; front_id 26/26; account_setup 31/31 (0147 present); apple_account_setup 37/37; email_verification 13/13; automatic_document_payments 65/65; admin_incident_withdrawal 23/23; rls_isolation 17/17; editable_document_fees 40/40; `service_foundations` 108/115 and `admin_request_row_workflows` 42/43 = the identical pre-existing failures (D19) |
| `notification_hub_concurrency.mjs` / `notification_transport_i1.mjs` on `notif_p5` | 3/3 / 8/8 |
| Android `npx tsc --noEmit` | 0 errors (entry and final) |
| Android `npx expo lint` | 0 errors, 1 warning = the pre-existing Health one |
| Android `npx vitest run` | final 37 files / 391 tests pass (entry baseline 35 / 384; +3 in `burst.test.ts`, +4 in another session's new `id-resubmit-limit.test.ts`) |
| `notification-hub-ui` (now incl. 100×7 row-event burst → one refetch per owner: ≤5 summaries, ≤2 inbox pages, ≤1 reads query), `notification-tap-ui`, `settings-profile-ui`, `resident-shell-lifecycle`, `services-tab-stability`, `root-navigation-isolation` (Chrome), `services-lists-ui`, `request-tracking-navigation`, `tracking-payment-ui`, `home-presentation-ui`, `resident-search-session/submit/lifecycle/history-ui` | pass |
| `reports-announcements-ui` | pass in the entry run and on rerun; failed once at the 5 s "Large report 49" virtualized wait right after the coalescer edit and passed on rerun with no code change — the same 1,003-row timing flake recorded in phase 3 (`large-failure.json` shows the list rendered and no coalesced channel involved) |
| `health-presentation-ui` | fails at "Next month" — identical to phase-0 baseline B11 (pre-existing) |
| `resident-search-explore` | fails waiting for the "See all My reports" tab (line 496). Not in any prior baseline (search fixtures could not launch before). It mocks `use-unread-counts` entirely and loads none of this phase's modules except the two unexported constants — classified **unrelated, not baseline-proven**; owner of the search work should triage |
| `CI=1 npx expo export --platform android` | exit 0, one 8,492,132-byte hbc bundle (phase 3/4 recorded 8.5 MB) |
| iOS `tsc` 0; iOS worker+parser vitest 86/86; `packages/shared` vitest pass; `resident-web` tsc 0 | pass |

## I2 journeys (real PostgREST + RLS + worker; counts are asserted, not sampled)
J1 staff profile edit + incident transition + operator notice → events/outbox → worker (service_role over PostgREST): notice reaches exactly the 2 residents of its barangay, 3 alerts for the device holder, every transported payload accepted by the Android parser, 2nd run delivers nothing. J2 owner / same-barangay peer / foreign barangay / guest: summary, page, chip scope, open-target allowlist, notice re-read; foreign and peer see nothing of the owner's rows; guests get no summary, page or bulk. J3 seven read/unread flips and two foreign write attempts: events, outbox, inbox and the incident row's hash unchanged; foreign writes are no-ops. J4 60 announcements (30 tied at one microsecond timestamp) paged by the real keyset filter = SQL order, deleted/foreign excluded, category scope, mirror converges on read and on explicit unread. J5 1,060 announcements and 1,100 events: exact counts, complete paging (690 Account / 413 System rows) in SQL order across fully tied `created_at`, ≤25 rows/page, unread ids 1,060. J6 chip bulk marks only its chip; bulk with 6 concurrent arrivals satisfies unread = before + arrivals − marked; an explicit repeat marks exactly the late arrivals; a further repeat marks 0 and rewrites no row; All/All → 0 unread incl. mirrors and 1,060 read markers; incident unchanged; another resident untouched. J7 invalid chip, unreachable API, delayed + abandoned request, failed write: readable failures, no partial state, next request fine. J8 opening All = 6 requests, an older page = 1 request.

## Measurements (no phase-0 baseline exists → no speed/size comparison claimed)
Requests: open All 6 (summary, announcements page, account page + count, system page + count); open one Account/System view 3; each older page 1; per-row queries 0. Wall time on this machine (Docker Desktop, 1,060 + 1,100 + 6 rows): open All ~1.0 s, older page ~0.4 s, 690-row Account paging 29 requests ~1.2 s, unread-id read of 1,060 announcements 3 requests ~0.16 s. Bundle 8,492,132 bytes. Realtime channels with the screen mounted: 7, constant across five card cycles (fixture).

## Limits (not claimed)
The screen/hook run against a JS mirror in the fixture, not against the I2 stack; real Realtime delivery (event-per-row, the F42 premise) was not exercised — the coalescer is verified at unit and fixture level only. No MuMu/physical run (R08, R12, R16), no hosted DB/worker/deployment, no rollback/interrupted-fan-out rehearsal (R18) — phase 6. The `resident-search-explore` failure above is open.

## R-gate mapping (automated/integration portions; native, physical and rehearsal parts stay I3)
| Gate | Evidence this phase | Status |
|---|---|---|
| R01 | `notification-hub-ui` (cards/chips/no "What's New") re-run green | met (fixture); native capture → I3 |
| R02 | I2 J4/J5: tied timestamps, 1,060 announcements, 1,100 events, SQL-equal order, counts = rows | met |
| R03 | producers pgTAP 125/125 + I1 8/8 re-run on `notif_p5` (coverage ledger unchanged since phase 2) | met |
| R04 | I2 J6 + concurrency 3/3 | met |
| R05 | I2 J3/J4 (7 flips, mirror both ways, repeat rewrites no row) | met |
| R06 | I2 J3/J6: incident row hash unchanged; Reports acknowledgment not touched (own screen/fixture) | met |
| R07 | producers pgTAP (dedupe/occurrence), I1 (one alert path, provider retries ≤5×3) | met; provider delivery uncertainty → I3 |
| R08 | `notification-tap-ui` re-run, owner-checked fetch beyond loaded pages (hub-ui deep links) | met (simulated); physical tap → I3 |
| R09 | I2 J2 (peer, foreign barangay, guest), hub pgTAP 162/162, rls_isolation 17/17 | met |
| R10 | I1 transport + iOS worker/parser 86/86 | met |
| R11 | I2 J7 + hub-ui fault scenarios | met (fixture/API); offline/reconnect native → I3 |
| R13 | I2 J3/J6 quiescence; `burst` tests + 700-event fixture burst; tap listener cleanup; F42 fixed | met (Realtime delivery itself not exercised) |
| R14 | ≤25 rows/page, 6 requests to open All, 1 per page, 0 per-row queries, 7 channels constant; no dependency added | met; no baseline → no size/speed claim |
| R15 | regression table above | met, with the two classified exceptions (Health pre-existing; search-explore unrelated, not baseline-proven) |
| R17 | deletion ledger; tsc 0, lint 0 errors, vitest 391/391, export exit 0 | met |
| R12, R16, R18 | not attempted | I3 |
