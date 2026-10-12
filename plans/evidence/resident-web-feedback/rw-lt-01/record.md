# RW-LT-01 — Shared loading and motion primitives

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local"); no credentials, tokens, OTPs, or real resident records in this folder.

## 1. Preconditions and inputs

- RW-LT-00 complete ([baseline-record.md](../rw-lt-00/baseline-record.md)). Re-read repository `AGENTS.md`, `apps/resident-web/AGENTS.md`, the full plan, the Expo v57 reference (SDK 57 / RN 0.86 / React 19.2.3; nothing applies to the Next.js resident web), and the installed Next.js 16.3.0 `use-client.md` and `loading.md` guides.
- Verified installed versions: framer-motion 12.43.0 (`MotionConfig reducedMotion`), tw-animate-css 1.4.0 (layered `@utility`, no reduced-motion handling of its own), sonner 1.7.4 (untouched this phase), @supabase/postgrest-js 2.112.1.
- Working tree: unrelated admin-web, Android, migration, and other-plan changes were left untouched. No backend, migration, admin-web, Android, or iOS change. No new dependency.

## 2. Changes

| File | Change |
|---|---|
| `src/lib/motion.ts` (new) | Motion tokens (120 ms hint, 200 ms reveal, 30/150 ms stagger for the first 6 items, 10 s slow threshold), drawer 240/180 ms and dialog 180/140 ms tween transitions, `staggerDelayMs`, `preferredScrollBehavior` |
| `src/app/globals.css` | `--motion-*` tokens, theme-aware `--skeleton` (light/dark), `rw-hint`/`rw-hint-out` (120 ms decorative delay), `rw-spinner` (800 ms), `rw-skeleton` (1.6 s low-contrast pulse), `rw-reveal`; reduced-motion block: static skeletons/spinners, no reveal movement, legacy `animate-pulse/spin/ping/bounce` and `.shimmer` disabled, tw-animate enter/exit transforms neutralized (opacity only), instant `scroll-behavior` |
| `src/components/ui/loading.tsx` (new, server-compatible) | `Spinner` (decorative, aria-hidden, inherits color), `Skeleton` (aria-hidden, optional pulse), `PendingHint` (display-only for an existing pending flag) |
| `src/components/shared/loading-status.tsx` (new, client) | `LoadingStatus` (persistent `role=status` region; text enters immediately, visual after 120 ms; "Taking longer than usual." after 10 s) and `useTakingLonger` (timer cleared on unmount) |
| `src/components/shared/page-skeleton.tsx` (new) | `PageSkeleton` home/list/form/detail/settings/map compositions using destination geometry; map viewport steady; label placed after the shapes so headings don't shift |
| `src/components/shared/fade-in.tsx` | Rewritten as CSS (`rw-reveal`), no client boundary; `index` gives bounded stagger; items ≥ 6 render steady. It had no consumers before this phase |
| `src/components/shared/motion-provider.tsx` (new) + `src/app/layout.tsx` | `MotionConfig reducedMotion="user"` around the existing tree (children stay server-rendered) |
| `src/components/ui/button.tsx` | `loadingLabel` (reserves the wider label, one accessible name, spinner mounted only while loading); without it, content keeps its place and name and cross-fades to a centered spinner after 120 ms; `aria-busy`; asChild Slot branch unchanged |
| `src/components/shell/bottom-tab-bar.tsx`, `src/components/emergency/horizontal-center-picker.tsx` | `behavior: 'smooth'` → `preferredScrollBehavior()` (instant under reduced motion); nothing else |
| Pilot list: `announcements-feed.tsx` | Skeleton primitive, `LoadingStatus "Loading announcements…"` after the `aria-busy` region, bounded FadeIn per card |
| Pilot form submit: `login/page.tsx` | `loadingLabel="Logging in…"` only |
| Pilot drawer: `request-drawer.tsx` | Skeleton primitive, `LoadingStatus "Loading request…"`, `aria-busy`, tween drawer tokens instead of the spring |

No hook, query, payload, Realtime subscription, toast, redirect, or business rule changed. The pilots stay owned by their feature phases (RW-LT-04 announcements and login, RW-LT-06 drawer; RW-LT-03 completes pilot read-state).

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck (`tsc --noEmit`) | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint (`eslint`) | **Pass**: 0 errors; the same 2 inherited warnings as RW-LT-00 (location-verification files) | [checks/lint.txt](checks/lint.txt) |
| Production build (not a required RW-LT-01 gate; used for browser verification) | **Pass** (exit 0), 49 routes; tsconfig restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-01:verify run-1`: 13 scenarios against the production build, Chrome | **13 pass, 0 fail, 0 error** | [run-1/results.json](run-1/results.json), [screens](run-1/screens/) |
| RW-LT-00 baseline journeys rerun (shared Button/CSS consumers) | **20/20 executed, 0 errors**; all 56 route statuses/destinations identical | [baseline-regression/results.json](baseline-regression/results.json) |
| Inventory reconciliation | **Pass**: every entry assigned to one phase; 122 client modules (+1 net) | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

### Scenario results (run-1)

| Scenario | Observed |
|---|---|
| list-fast-read-no-flash | Content 87 ms after the filter click (30 ms shaped read); no skeleton, spinner, or label ever visible |
| list-slow-read-2s | `aria-busy` and "Loading announcements…" in the live region on the first sample; decoration invisible for the first 90 ms; 9+ skeleton shapes and the label visible while pending; settles to no status/busy; revealed cards fully opaque within 400 ms; stagger delays ≤ 150 ms |
| list-slow-read-dark | Theme-aware skeleton in dark mode (`color(srgb 0.155 …)`) |
| list-over-10s-taking-longer | No slow text at 9 s; "Loading announcements… Taking longer than usual." at 10.6 s with the region still busy and no failure wording; settles on success |
| list-timer-cleanup | Read settles at 1.5 s; 10.5 s later there is no slow message, skeleton, or busy region |
| list-returned-error / list-thrown-failure | Pending visuals released into the existing inline error; Retry recovers. A thrown failure is retried 3 times by postgrest-js (4 attempts, ~9 s) before the error is returned. That is library behavior, unchanged here; the slow hint covers it |
| reduced-motion-static | 0 infinite animations; skeletons still delayed then static; content fully visible immediately with no reveal animation; legacy pulse/spin/shimmer disabled; `scroll-behavior: auto`; Framer drawer opens in place (left 928 at 30 ms = settled) |
| form-submit-login-label | Disabled, `aria-busy`, and "Logging in…" immediately; exactly one accessible name; spinner hidden before 120 ms and visible after; width/height unchanged; Enter + click → 1 sign-in request; released with "Log In" after the failure; the real local sign-in reaches the existing destination (`/onboarding` for a first login in a fresh browser) |
| text-button-no-label-spinner | Forgot-password (browser-fulfilled failure, no email sent): disabled/busy immediately, size stable, name "Send Reset Code" kept, no spinner flash before 120 ms, spinner after; released on failure and stays on the form |
| aschild-navigation-buttons | `Button asChild` renders `<a data-slot=button>` and navigates to `/register` |
| drawer-pilot | Tween entrance settles at ~292 ms after the click (including input latency), no overshoot; label + busy while pending; settles to real content with no status; exit 211 ms |
| mobile-360-no-overflow | No horizontal overflow while loading at 360 px |

### Baseline comparison (RW-LT-00 → after RW-LT-01)

- Data requests are unchanged: REST, Auth, and Functions counts are identical in every scenario. Page loads fetch one extra script chunk for the new shared modules; there are no new loading-related network requests.
- Fast read: decorative skeleton samples went from 1 to 0. Slow read: `aria-busy` was never set before and is set now.
- Reduced motion: no infinite animations. The RW-LT-00 probe counts every running animation, so it reports 16 at the first sample (zero-length 120 ms reveal delays) and 0 from ~450 ms on. Its legacy `animate-pulse` probe returns null because the feed no longer uses that class.
- D-03 drawer probe: the RW-LT-00 probe reports `reproduced=false` only because it looks for `.animate-pulse`. The RW-LT-01 drawer scenario confirms **D-03 still reproduces** (failed read → skeleton persists). It is owned by RW-LT-03/06.
- The other defect reproductions (D-01, D-02, D-07, D-08, D-12, D-14) and D-04's login misclassification are unchanged, as expected; their phases own them.

## 4. Exit gate

| Criterion | Result |
|---|---|
| Under-120 ms operations avoid decorative flash | Met (list-fast-read; button scenarios: no spinner before 120 ms) |
| Delayed operations show truthful feedback | Met (label/busy immediate; skeleton after the delay; slow hint at 10 s without failure wording) |
| Settled failures release pending visuals | Met for the primitives and the list/form pilots (returned + thrown failures). The pilot drawer still has D-03 (a null record is treated as pending). That is a read-contract defect assigned to RW-LT-03's read-state pilot, not a primitive failure |
| Reduced motion is static | Met (CSS + Framer; legacy placeholders included) |
| Button labels don't shift controls or duplicate accessible names | Met (stable dimensions; one name with `loadingLabel`; name kept without it) |
| Text, icon, form-submit, and asChild navigation buttons functional | Text, form-submit, and asChild verified at runtime. **Icon:** no `Button size="icon"` consumer exists in resident-web, so it is verified statically only: `loadingLabel` is ignored for icon size, and the no-label branch keeps content and name |

Phase status: **Complete**. Every RW-LT-01 task and deliverable is implemented, and the exit gate is met except the items recorded in section 5.

## 5. Not verified / carried forward

- `PageSkeleton` and `PendingHint` have no consumer yet; they are verified by typecheck and build only. RW-LT-03 consumes them in route fallbacks and `useLinkStatus` hints and must verify them at runtime.
- Announcements Realtime refresh still swaps content for skeletons (D-06), so the card entrance replays on a Realtime refresh until RW-LT-04 keeps content during refresh. Local Realtime is unavailable (WebSocket 503), so this is static-only.
- Dialog/drawer motion tokens are applied only to the pilot drawer. Other dialogs and drawers adopt them in their feature phases (RW-LT-05 onward).
- Only Chrome (Playwright) was used. Firefox, Safari/iOS web, a manual screen reader, and 200% zoom are not verified for this phase; RW-LT-09 qualifies them. Live-region behavior was checked through the DOM only, which the plan says is not sufficient on its own.
- Production readiness is not claimed. Broader qualification remains pending under RW-LT-09.
