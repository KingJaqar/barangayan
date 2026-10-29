# Phase 0 baseline checks — 2026-10-28

Source identity: HEAD `9fe8add1` + working copy hashed in [source-manifest.json](source-manifest.json). Full logs: `C:/Users/User/barangayan/tmp/resident-notifications-phase0-20261028/logs/` (private, not committed). Each command ran once; no rerun. Node v24.13.1; deadlines per plan §6.2 (300 s targeted, 600 s suite).

| # | Command (cwd) | Exit | Result | Classification |
|---|---|---|---|---|
| B01 | `npx tsc --noEmit` (`apps/resident-android-mobile`) | 0 | 0 errors | Baseline green |
| B02 | `npx expo lint` (`apps/resident-android-mobile`) | 0 | 0 errors, 1 warning: `src/components/health/health-presentation.tsx:2:10 'useState' unused` | Pre-existing warning (Health; outside this plan) |
| B03 | `npx vitest run` (`apps/resident-android-mobile`) | 0 | 32 files / 335 tests passed | Baseline green |
| B04 | `node tests/services-lists-ui.mjs` | 0 | passed | Baseline green |
| B05 | `node tests/request-tracking-navigation.mjs` | 0 | passed | Baseline green |
| B06 | `node tests/tracking-payment-ui.mjs` | 0 | passed, `errors: []` | Baseline green |
| B07 | `node tests/resident-shell-lifecycle.mjs` | 0 | passed | Baseline green |
| B08 | `node tests/services-tab-stability.mjs` | 0 | passed | Baseline green |
| B09 | `node tests/reports-announcements-ui.mjs` | 1 | `AssertionError` at `tests/reports-announcements-ui.mjs:95` — fixture expects picker durations 280/200; committed `src/hooks/use-report-modal-motion.ts:16–17` emits `duration+60`/`duration-60` (340/220) and scrim 200. Checks after line 95 (announcement screen lines 96–113) did **not** run. | **Pre-existing** fixture drift at HEAD (test and hook unchanged in working copy). Blocks the announcement-screen assertions; phase 3 must update this fixture when the screen changes and record the correction, not weaken it. |
| B10 | `HISTORY_ONLY=1 node tests/reports-announcements-ui.mjs` | 0 | 1003-row report badge check passed; 2 known react-native-web deprecation warnings (listed as baseline warnings in the fixture) | Baseline green for history scope |
| B11 | `npm run test:navigation` (`apps/resident-android-mobile`) | 1 | 11 pass; 4 fail: `root-navigation-isolation` (esbuild: fixture `react-native` mock lacks `Platform` for `src/constants/theme.ts:9`), `health-presentation-ui` (timeout waiting for "Next month"), `maps-presentation-ui` (deepEqual at `:121`), `reports-announcements-ui` (= B09) | **Pre-existing**, unrelated to notifications (Health/Maps/root mock); logs under `logs/navigation/` |
| B12 | `npx vitest run tests/notification-worker.test.ts tests/notifications.test.ts` (`apps/resident-ios-mobile`) | 0 | 2 files / 80 tests passed (worker contract + iOS inbox/destination parser) | Baseline green; this is the worker test entry point (U02) |
| B13 | Disposable clone `notif_p0_20261028` in `supabase_db_barangayan`: `pg_dump -Fc` of `postgres` → `pg_restore --no-owner --role=postgres` (50 expected errors: `cron` schema, default privileges, secrets) → `psql -v ON_ERROR_STOP=1` migrations 0118…0144 | 0 per file | 27/27 migrations applied | Local dev DB itself is at 0117 and was **not** modified |
| B14 | pgTAP `psql -At -f` on the clone (13 suites) | 0 | `resident_ios_phase17_notifications` 121/121; `admin_request_status_editor` 61/61; `resident_ios_phase18_account_deletion` 56/56; `resident_front_id_submission` 26/26; `resident_account_setup` 30/30; `resident_apple_account_setup` 37/37; `resident_email_verification` 13/13; `automatic_document_payments` 65/65; `admin_incident_withdrawal` 23/23; `rls_isolation` 17/17; `editable_document_fees` 40/40; `service_foundations` 108/115; `admin_request_row_workflows` 42/43 | 11 suites green. **Pre-existing** failures: `service_foundations` #41, #59–61, #76–77, #79 (fee now `pickup_due`/`confirmed_request_amount_required` after 0125/0142 fee model) and `admin_request_row_workflows` #30 (versioned acceptance of unreviewed request no longer raises). Fee/acceptance model drift, not notifications. |

Not run in phase 0 (with reason): Android bundle/export (no runtime change yet; phase 3/4 gate); Deno-native worker run (worker logic is covered by B12; Edge runtime replica recipe exists for phase 2 I1); MuMu/physical (phase 6, U05); hosted DB/functions (not authorized; hosted migration/deploy state unverified).

Cleanup state: the clone `notif_p0_20261028`, `/tmp/notif_p0.dump`, `/tmp/notif_p0_mig/` and `/tmp/notif_p0_tests/` inside `supabase_db_barangayan` are task-owned and retained for reuse as the phase-1 rehearsal baseline. Docker Desktop was started for this run.
