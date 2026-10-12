# RW-LT-00 baseline and preservation record

Phase: RW-LT-00 — Baseline, coverage, and verification setup. Recorded 2026-10-11/12 (Asia/Manila). No runtime application or backend change was made in this phase.

## 1. Instructions, documentation, and working tree

- Re-read: repository `AGENTS.md` (sequential migrations; cancelled Android Phase 8 — not touched), `apps/resident-web/AGENTS.md`, and the full plan.
- Expo v57 reference (https://docs.expo.dev/versions/v57.0.0/) read: SDK 57 / React Native 0.86 / React 19.2.3 / RN Web 0.21.0. It contains nothing that applies to the Next.js resident web; no Expo code is in scope.
- Installed Next.js 16.3.0 guides read (`node_modules/next/dist/docs`): `loading.md`, `error.md`, `use-link-status.md`, `catchError.md`, getting-started error handling, and linking/navigating. Contracts confirmed for later phases:
  - `error.js` receives `retry()` (re-fetch + re-render) and `reset()` (re-render only); it does not wrap the `layout.js` of its own segment.
  - `loading.js` does not cover runtime data read in the same segment's layout. Both `(resident)/layout.tsx` (`getOptionalUser`) and `(auth)/layout.tsx` (`getUser` + `headers()`) read runtime data, so group fallbacks must be placed below those layouts (RW-LT-03).
  - `useLinkStatus` must be a descendant of `<Link>`, is skipped for prefetched routes, reports `pending` only until history updates, and should be a fixed-size, always-rendered hint.
- Working tree: no resident-web changes existed before or after this phase (`git status` clean for `apps/resident-web`). Unrelated changes from other work (Android mobile files, admin-web table work, migrations `0110`/`0111`, other plans/evidence) were left untouched. No migration was added; none is needed.
- `next build` with a custom distDir appends its type globs to `apps/resident-web/tsconfig.json`; the first build did this, the edit was reverted with `git checkout`, and the `rw-lt-00:build` command now restores the file automatically.

## 2. Static checks (inherited state)

| Check | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` (apps/resident-web) | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint | `npx eslint` (apps/resident-web) | **Pass** with 2 inherited warnings (`location-verification-form.tsx:94` missing `boundary` dependency; `location-verification-map.tsx:102` unused disable directive) | [checks/lint.txt](checks/lint.txt) |
| Production build | `rw-lt-00:build` (Next 16.3.0 Turbopack, loopback env) | **Pass** (exit 0); 49 app routes + proxy | [checks/build.txt](checks/build.txt) |

## 3. Inventory and coverage

[coverage.md](coverage.md) (generated from [coverage.json](coverage.json); reconciliation passes in [inventory.json](inventory.json)):

- 49 pages (the plan's 48-page count was a baseline; one more page now exists), 7 layouts, 1 route handler, **0** `loading.tsx`, **0** `error.tsx`/`global-error.tsx`, 0 `not-found.tsx`, 0 templates.
- 121 client modules; 22 files import Sonner (21 callers + the host) with 77 toast call sites; 54 pending-style state flags; 30 refresh triggers (Realtime channels, intervals, focus listeners); 12 drawer/dialog modules; 13 Framer Motion users.
- 57 route entries, 23 shell/navigation/drawer/dialog entries, 85 async actions, 14 defects. Every entry is assigned to exactly one feature phase (RW-LT-03…08); the command fails on any unassigned or doubly assigned item.
- `app/(resident)/services/payment/qrph/[requestId]/qrph-payment.tsx` (`QrphPayment`) is **not used**: the QR route renders `RequestPaymentJourney → QrphStep`. Recorded as an unused module (RW-LT-06) rather than a migration target.

## 4. Runtime baseline (production build, Chrome headless)

Run: [baseline/results.json](baseline/results.json), screenshots in [baseline/screens/](baseline/screens/). Base `http://127.0.0.1:3127`, API `http://127.0.0.1:54321`. 20 scenarios executed, 0 errors, 0 untested.

| Scenario | Observed baseline | Classification |
|---|---|---|
| Guest route sweep (26 routes) | All 200; guest-gated screens show AuthGate; `/services/requests` → `/login`; 360 px home has no horizontal overflow | Pass |
| Resident route sweep (30 routes) | All 200 with real content; per-route timings 1.1–1.8 s and request deltas recorded | Pass |
| Empty resident | Requests, reports, household, registrations show their empty copy | Pass |
| Profile completion required | Login → `/home`; `/reports/new` → `/complete-profile` (existing destinations) | Pass |
| Inaccessible records | Other resident's request/incident → 404; receipt → "No confirmed payment receipt is available" | Pass |
| Slow read (announcements +2 s) | Skeleton at ~285 ms, content at ~2.4 s; `aria-busy` never set; no loading label | Baseline gap (RW-LT-01/04) |
| Fast read | Content ~330 ms after navigation start; skeleton visible in 1–2 samples (decorative flash, no 120 ms delay) | Baseline gap (RW-LT-01) |
| Returned read error | Inline error with the raw synthetic message + "Try again"; retry recovers | Pass (copy to refine) |
| Reduced motion | `animate-pulse` still runs (3 running animations under `prefers-reduced-motion: reduce`) | **Failure vs plan** (RW-LT-01) |
| Mocked QR PH paid poll | Fixed 256×256 QR in a 306 px box; paid poll advances to the receipt step, whose confirmed-receipt read correctly refuses (no paid row) with "Retry receipt"; no toast | Pass (truthful) |
| D-01 household false success | `Member added.` toast after a failed write | **Reproduced** |
| D-02 family dialog | Dialog closes after a failed save; inputs lost | **Reproduced** |
| D-03 drawer perpetual skeleton | 4 skeletons, no error/retry, 5 s after a failed read | **Reproduced** |
| D-07 false empty household | Failed read shows "No family members added yet." | **Reproduced** |
| D-08 obsolete drive date | Slower first date's drives appear under the later selected date | **Reproduced** |
| D-04 login network abort | Pending released, but reported as "Incorrect email or password." + credentials toast | **Reproduced (misclassification)**; stuck pending not reproduced for login |
| D-12 notification toggle | Toast "Email notifications disabled." for a setting that resets on reload | **Reproduced** |
| D-14 QR cancel failure | Mocked cancel 500: no message, no toast, still on QR step | **Reproduced** |

Console errors in the run are only Realtime WebSocket 503s (environment), and the intentional 404/500/aborted requests from the scenarios. Tokens are redacted from evidence (verified: no JWT/key/password strings in results).

## 5. Untested or blocked coverage (recorded, not claimed)

- **Realtime**: unavailable on the local stack (WebSocket 503). Realtime-triggered refresh behavior (D-06, quiet updates, payment Realtime + poll overlap) is static-only until a phase can run with Realtime; RW-LT-03/04/06 must reproduce it then or record it as pending.
- **Edge Functions**: local Edge runtime is not running; provider outcomes are mocked in the browser. Live PayMongo, Google OAuth, SMS/email OTP delivery are not locally verifiable (plan §7: sandbox/manual evidence required).
- **Browsers/assistive tech**: only Chrome (Playwright) was exercised. Firefox, Safari/iOS web, screen readers, 200% zoom, camera, clipboard denial, and popup blocking are untested at baseline.
- Remaining defects D-05, D-06, D-09, D-10, D-11, D-13 and the non-login parts of D-04 are static findings with file/line references; each owning phase must reproduce them before fixing.

## 6. Exit gate

| Criterion | Result |
|---|---|
| Every current route/action assigned | Met — reconciliation passes, one phase per entry |
| Local guest/resident read journeys reproducible | Met — fixture seed/cleanup cycle verified; guest and resident sweeps pass |
| Delayed/error/obsolete scenarios reproducible | Met — delay, returned error, abort, obsolete response, mocked provider scenarios in the entrypoint |
| Baseline distinguishes pass, failure, untested | Met — sections 2, 4, 5 |
| No runtime application or backend change | Met — no resident-web, shared, or backend file changed; tsconfig build side effect reverted |
