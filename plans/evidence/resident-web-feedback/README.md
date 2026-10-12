# Resident web feedback evidence

Evidence for [Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md](../../Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md). All data is synthetic and local. No file here may contain passwords, session tokens, OTPs, API keys, or real resident records; the regression entrypoint redacts JWT-shaped strings and Supabase keys from console output before writing evidence.

## Phase index

| Phase | Status | Evidence |
|---|---|---|
| RW-LT-00 | Complete (2026-10-12) | [rw-lt-00/baseline-record.md](rw-lt-00/baseline-record.md), [coverage checklist](rw-lt-00/coverage.md) ([JSON source](rw-lt-00/coverage.json)), [inventory scan](rw-lt-00/inventory.json), [fixture instructions](rw-lt-00/fixtures.md), [browser baseline](rw-lt-00/baseline/results.json), [screenshots](rw-lt-00/baseline/screens/), [checks](rw-lt-00/checks/) |
| RW-LT-01 | Complete (2026-10-12) | [rw-lt-01/record.md](rw-lt-01/record.md), [scenario results](rw-lt-01/run-1/results.json), [screenshots](rw-lt-01/run-1/screens/), [baseline regression rerun](rw-lt-01/baseline-regression/results.json), [inventory scan](rw-lt-01/inventory.json), [checks](rw-lt-01/checks/), [coverage phase verification](rw-lt-00/coverage.md#phase-verification) |
| RW-LT-02 | Complete (2026-10-12) | [rw-lt-02/record.md](rw-lt-02/record.md), [adapter unit results](rw-lt-02/unit-results.json), [browser results](rw-lt-02/run-1/results.json), [screenshots](rw-lt-02/run-1/screens/), [baseline regression rerun](rw-lt-02/baseline-regression/results.json), [RW-LT-01 rerun](rw-lt-01/rerun-after-rw-lt-02/results.json), [inventory scan](rw-lt-02/inventory.json), [checks](rw-lt-02/checks/) |
| RW-LT-03 | Complete (2026-10-12) | [rw-lt-03/record.md](rw-lt-03/record.md), [scenario results](rw-lt-03/run-2/results.json) (primary; [run-1](rw-lt-03/run-1/results.json)), [screenshots](rw-lt-03/run-2/screens/), [baseline regression rerun](rw-lt-03/baseline-regression/results.json) + [comparison](rw-lt-03/baseline-regression/comparison.json), [RW-LT-02 rerun](rw-lt-02/rerun-after-rw-lt-03/results.json), [RW-LT-01 rerun](rw-lt-01/rerun-after-rw-lt-03/results.json), [inventory scan](rw-lt-03/inventory.json), [checks](rw-lt-03/checks/) |
| RW-LT-04 | Complete (2026-10-12) | [rw-lt-04/record.md](rw-lt-04/record.md), [scenario results](rw-lt-04/run-1/results.json), [screenshots](rw-lt-04/run-1/screens/), [baseline regression rerun](rw-lt-04/baseline-regression/results.json), [RW-LT-01 rerun](rw-lt-01/rerun-after-rw-lt-04/results.json), [RW-LT-02 rerun](rw-lt-02/rerun-after-rw-lt-04/results.json), [RW-LT-03 rerun](rw-lt-03/rerun-after-rw-lt-04/results.json), [inventory scan](rw-lt-04/inventory.json), [checks](rw-lt-04/checks/) |
| RW-LT-05 | Complete (2026-10-12) | [rw-lt-05/record.md](rw-lt-05/record.md), [scenario results](rw-lt-05/run-1/results.json), [screenshots](rw-lt-05/run-1/screens/), [adapter/QR unit results](rw-lt-05/unit-results.json), [baseline regression rerun](rw-lt-05/baseline-regression/results.json), [RW-LT-01 rerun](rw-lt-01/rerun-after-rw-lt-05/results.json), [RW-LT-02 rerun](rw-lt-02/rerun-after-rw-lt-05/results.json), [RW-LT-03 rerun](rw-lt-03/rerun-after-rw-lt-05/results.json), [RW-LT-04 rerun](rw-lt-04/rerun-after-rw-lt-05/results.json), [inventory scan](rw-lt-05/inventory.json), [checks](rw-lt-05/checks/) |
| RW-LT-06 | Complete (2026-10-12) | [rw-lt-06/record.md](rw-lt-06/record.md), [scenario results](rw-lt-06/run-2/results.json) (primary; [run-1](rw-lt-06/run-1/results.json)), [screenshots](rw-lt-06/run-2/screens/), [unit results](rw-lt-06/unit-results.json), [baseline regression rerun](rw-lt-06/baseline-regression/results.json), [RW-LT-01 rerun](rw-lt-01/rerun-after-rw-lt-06/results.json), [RW-LT-02 rerun](rw-lt-02/rerun-after-rw-lt-06/results.json), [RW-LT-03 rerun](rw-lt-03/rerun-after-rw-lt-06/results.json), [RW-LT-04 rerun](rw-lt-04/rerun-after-rw-lt-06/results.json), [RW-LT-05 rerun](rw-lt-05/rerun-after-rw-lt-06/results.json), [inventory scan](rw-lt-06/inventory.json), [checks](rw-lt-06/checks/) |
| RW-LT-07 – RW-LT-09 | Not started | — |

## Regression entrypoint

`scripts/resident-web-feedback-regression.cjs` groups scenarios by phase ID so each phase's checks run on their own:

```bash
node scripts/resident-web-feedback-regression.cjs rw-lt-00:inventory
```

| Command | Purpose |
|---|---|
| `rw-lt-00:inventory [rw-lt-NN]` | Scans `apps/resident-web/src` (pages, layouts, route handlers, loading/error boundaries, client modules, Sonner imports/calls, pending flags, refresh triggers, drawers/dialogs, motion users) and fails if any item is not assigned to exactly one phase in `coverage.json`. Regenerates the living `rw-lt-00/coverage.md` (including its phase-verification section); the optional argument writes the scan to that phase's folder so earlier snapshots are kept. |
| `rw-lt-00:fixtures seed\|cleanup\|status` | Synthetic local accounts and records (see [fixtures.md](rw-lt-00/fixtures.md)). |
| `rw-lt-00:build` | Production build into `apps/resident-web/.next-rw-feedback` against the loopback stack; restores the `tsconfig.json` include list that `next build` appends for a custom distDir. |
| `rw-lt-00:serve` | `next start` on `http://127.0.0.1:3127` (run in the background). |
| `rw-lt-00:baseline <run-name>` | Playwright (bundled runtime, Chrome channel) journeys and deterministic scenarios; writes `rw-lt-00/<run-name>/results.json` and `screens/`. Refuses to overwrite an existing run. |
| `rw-lt-01:build` | Same production build; log written to `rw-lt-01/checks/build.txt`. |
| `rw-lt-01:verify <run-name>` | Shared loading/motion primitive scenarios (fast/slow/over-10 s/failed reads, timer cleanup, reduced motion, button label/spinner/asChild, pilot drawer, 360 px); writes `rw-lt-01/<run-name>/results.json` with per-check `ok` flags. Status `pass` here means every check passed. |
| `rw-lt-02:build` | Same production build; log written to `rw-lt-02/checks/build.txt`. |
| `rw-lt-02:unit` | Notification adapter rules (`lib/notify.ts` transpiled in memory against a recording Sonner stand-in): durations, per-attempt/event dedup, deliberate repeat, session change, bounds, focus hold; writes `rw-lt-02/unit-results.json`. |
| `rw-lt-02:verify <run-name>` | Toast host scenarios (placement, duration, hover/focus/hidden pause, keyboard dismissal, session clearing, Radix dialog coexistence, reduced motion, 320 px long text, quiet read pilots); writes `rw-lt-02/<run-name>/results.json`. |
| `rw-lt-03:build` | Same production build; log written to `rw-lt-03/checks/build.txt`. |
| `rw-lt-03:verify <run-name>` | Route fallbacks, error boundaries, link hints, back/forward/deep links, modifier clicks, guest/auth redirects, and the pilot list/drawer read states. Navigation slowness is shaped by delaying only the browser's non-prefetch RSC request; Realtime refreshes use an in-browser protocol 2.0.0 stand-in (`mockRealtime`) while local Realtime is down. Writes `rw-lt-03/<run-name>/results.json`. |
| `rw-lt-04:build` | Same production build; log written to `rw-lt-04/checks/build.txt`. |
| `rw-lt-04:verify <run-name>` | Auth failure classification, activation guards, destinations, Google initiation, recovery journey against local Auth with a disposable account (OTP from the local admin API, never recorded), registration/profile completion outcomes, header/sidebar/complete-profile logout, session-ended notice, onboarding, home read failures (briefly stops the local REST container and restarts it), quiet announcements, announcement dialog, 320 px. Auth/provider failures are browser-fulfilled; writes `rw-lt-04/<run-name>/results.json`. |
| `rw-lt-05:build` | Same production build; log written to `rw-lt-05/checks/build.txt`. |
| `rw-lt-05:unit` | `lib/qr-checkin.ts` and `lib/household-feedback.ts` transpiled in memory against a recording notify stand-in: QR parsing rules, one terminal check-in outcome, household wording, ownership/contract assertions; writes `rw-lt-05/unit-results.json`. |
| `rw-lt-05:verify <run>` | Emergency hub/alerts/centers/scan/family/directory read states, location and route handling, QR upload check-in outcomes against the local database (household/check-in rows restored or removed), camera guidance and release (Chrome fake capture device), Show-QR clipboard/download, household QR states, family dialog contract in both consumers, map placeholders and locate control, dialog/reduced motion, 320 px. `RW_ONLY=id,id` limits the run to named scenarios. Writes `rw-lt-05/<run>/results.json`. |
| `rw-lt-06:build` | Same production build; log written to `rw-lt-06/checks/build.txt`. |
| `rw-lt-06:unit` | `lib/service-feedback.ts` classification/wording and the real `lib/notify.ts` against a recording Sonner stand-in (payment event dedup, session suppression), plus ownership/contract assertions; writes `rw-lt-06/unit-results.json`. |
| `rw-lt-06:verify <run>` | Catalog/modal read states and obsolete selection, account-check pending, request-form outcomes and upload stages against the local database, request list/drawer, tracking cancel outcomes, payment method / pickup (idempotency), QR PH journey (geometry, poll+Realtime overlap, paid-during-cancel, cancel failure, expiry/connectivity, creation failures), read-only receipt retry/revisit, journey refresh retention, server read failures (REST stopped; table reads denied with grants restored), route fallbacks, 320 px/reduced motion, account-change suppression. `RW_ONLY=id,id` limits the run. Synthetic rows are restored after every scenario. Writes `rw-lt-06/<run>/results.json`. |
| `rw-lt-07` … `rw-lt-09` | Exit 2 until the phase adds its scenarios. |

## Evidence format

Each browser run writes one `results.json`:

- `scenarios[]`: `{ id, phase, status, observations, requests, consoleErrors, note? }`.
- `status`: `pass` = the scenario executed and its observations were recorded; `untested` = a precondition was unavailable (reason in `note`); `error` = the scenario could not complete (screenshot `screens/<id>-error.png`). A `pass` is **not** a claim that the product behavior is correct: defect scenarios record `observations.reproduced = true` while the baseline defect is present, and the owning phase flips the expectation.
- `requests`: per-scenario counts by class (`document`, `rsc`, `script`, `rest`, `auth`, `functions`, `storage`, `other`); route sweeps also record per-route deltas in `observations.routes[].requests`. WebSocket (Realtime) traffic is not counted by the request event.
- Timelines (`observations.timeline`): DOM samples every 50–100 ms with skeleton (`.animate-pulse`) and spinner (`.animate-spin`) counts, running Web Animations, `aria-busy` elements, and content probes. These are the loading/motion traces used for before/after comparison.

### Deterministic network shaping

Scenarios shape only Supabase REST/Auth/Functions requests in the browser via Playwright routing, never the page document:

- `shape.delay(ms)` — slow response (e.g. 2 s announcements read, 2.5 s obsolete drive-date read).
- `shape.fail(status)` — returned error with a synthetic JSON body.
- `shape.abort()` — thrown network failure.
- Edge Function provider outcomes (QR PH create/poll/cancel) are fulfilled in the browser; no PayMongo call, payment row, or charge is created.

Later phases add scenarios to the same entrypoint under their own `rw-lt-NN:*` group and record results under `rw-lt-NN/`.
