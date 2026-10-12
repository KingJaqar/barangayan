# RW-LT-02 — Toast host, ownership, and notification adapter

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local"); no credentials, tokens, OTPs, or real resident records in this folder. Every Auth failure used here is fulfilled in the browser, so no reset email, SMS, OAuth, or payment call was made.

## 1. Preconditions and inputs

- RW-LT-01 is complete ([record](../rw-lt-01/record.md)). I re-read the repository `AGENTS.md`, `apps/resident-web/AGENTS.md`, the full plan, and the Expo v57 reference (nothing in it applies to the Next.js resident web). Nothing in this phase uses a Next.js API beyond `usePathname` and existing `'use client'` boundaries.
- I verified the installed APIs instead of assuming them:
  - **sonner 1.7.4.** It supports `offset`/`mobileOffset` objects, `visibleToasts`, `closeButton`, `pauseWhenPageIsHidden`, `containerAriaLabel`, and toast updates by `id`. Its timer pauses on hover (expanded) and on hidden pages, but not on keyboard focus. It honors reduced motion itself. The live region is `section[aria-live=polite]`, and the 20 px close button defaults to the top-left corner.
  - **Radix.** The dismissable layer is v1.1.19. It dispatches cancelable `dismissableLayer.pointerDownOutside`/`focusOutside` events on the target element and dismisses only if `!defaultPrevented`. A modal dialog sets `pointer-events: none` on `<body>`.
  - **aria-hidden 1.2.6.** It does not hide `[aria-live]` elements.
- Working tree: unrelated admin-web, Android, migration, and other-plan changes were left untouched. There is no backend change, migration, admin-web/Android/iOS edit, or new dependency.

## 2. Changes

| File | Change |
|---|---|
| `src/lib/notify.ts` (new) | Notification adapter. Provides `notify.success/error/warning/info(title, { description, id, keepOnSessionChange })` with 4/4/6/8 s durations. `beginAttempt(action)` gives a distinct ID per deliberate attempt; `eventId(...parts)` gives a deterministic, session-scoped ID for observed events (later payment use). An ID yields at most one toast. Bookkeeping is bounded (200). `setNotificationSession` dismisses this adapter's toasts and forgets issued IDs when the account changes, so a previous account's pending outcomes never notify. `keepOnSessionChange` is reserved for outcomes of the sign-out/deletion action itself. The adapter has no fetch, mutation, retry, listener, or error interception. |
| `src/components/ui/sonner.tsx` | Refines the single host. Top-center placement; resident pages sit 12 px below the measured header (`ResizeObserver` on `[data-toast-anchor]`, re-queried per route); auth pages use 16 px plus the safe-area top. Also: 16 px safe-area side gutters (desktop and mobile), 400 px width, 3 visible toasts, close button, active theme from the theme controller, and `var(--font-app)`. Sonner's `pauseWhenPageIsHidden` is on, and keyboard focus inside an adapter toast holds its timer. Capture-phase listeners cancel only *toast-originated* Radix outside events, so clicking or focusing a toast never closes an open dialog. All listeners are removed on unmount. |
| `src/app/globals.css` | Toast rules: semantic icon colors (light/dark tokens that do not depend on the accent), a readable description color, wrapping for long text, and `pointer-events: auto` for visible toasts under a modal body lock. The dismiss control is 28 px with a 14 px glyph and a 44 px hit area, positioned inside the toast, with a focus ring. |
| `src/components/shared/notification-session.tsx` (new) + `app/(resident)/layout.tsx`, `app/(auth)/layout.tsx` | `<NotificationSession userId>` passes each layout's existing server auth result to the adapter. It makes no new request, and auth/redirect logic is unchanged. |
| `src/components/shell/resident-shell.tsx` | Header marked `data-toast-anchor`; no other change. |
| Pilot form: `app/(auth)/login/page.tsx` | The direct `toast.error('Login failed — check your email and password.')` is replaced by `notify.error('Login failed', { id: beginAttempt('login'), description: 'Check your email and password.' })`. The inline "Incorrect email or password." stays as persistent guidance and is not a live region, so the outcome is announced once. Sonner is no longer imported. |
| Pilot list and drawer (`announcements-feed.tsx`, `request-drawer.tsx`) | No change. These are reads, and the policy (first load, error, retry, refresh) is local feedback with no toast. Verified at runtime. |
| `scripts/resident-web-feedback-regression.cjs` | Adds `rw-lt-02:build`, `rw-lt-02:unit`, and `rw-lt-02:verify <run>`. The inventory reconciliation now allows `lib/notify.ts` as the second permitted Sonner importer. |

Direct Sonner calls in the other 20 files are preserved until their feature phases migrate them; the same single host renders them.

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck (`tsc --noEmit`) | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint (`eslint`) | **Pass**: 0 errors; the same 2 inherited warnings (location-verification files) | [checks/lint.txt](checks/lint.txt) |
| Production build (required at RW-LT-02) | **Pass** (exit 0), 49 routes; tsconfig restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-02:unit`: adapter rules | **8/8 pass** | [unit-results.json](unit-results.json) |
| `rw-lt-02:verify run-1`: 10 browser scenarios, production build, Chrome | **10 pass, 0 fail, 0 error** | [run-1/results.json](run-1/results.json), [screens](run-1/screens/) |
| RW-LT-01 primitives rerun (login pilot and CSS changed) | **13/13 pass** | [../rw-lt-01/rerun-after-rw-lt-02/results.json](../rw-lt-01/rerun-after-rw-lt-02/results.json) |
| RW-LT-00 baseline journeys rerun | **20/20 executed, 0 errors.** REST/Auth/Functions/Storage counts, all route statuses and destinations, and every defect `reproduced` flag are identical to the RW-LT-01 rerun | [baseline-regression/results.json](baseline-regression/results.json) |
| Inventory reconciliation | **Pass**: 22 Sonner importers (login removed, adapter added), 123 client modules (+1 `NotificationSession`), every entry assigned | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

An earlier trial browser run (deleted, superseded by run-1) failed one check, "focus not stolen", because of a test artifact. The scenario's forced click on the *disabled* submit button moved focus to `<body>` before any toast appeared. The check now runs on a keyboard-only second attempt and passes. After a cosmetic dismiss-glyph change (12 → 14 px), I rebuilt and reran every check above against that build.

### Adapter unit results

| Test | Observed |
|---|---|
| durations-by-kind | success 4000, info 4000, warning 6000, error 8000 ms; description passed through |
| repeated-callback-same-attempt | Three outcomes reported for one attempt → 1 toast; the later calls return `null` |
| deliberate-second-attempt-notifies | Two attempts with identical text → 2 toasts with distinct IDs; calls without an ID are never suppressed |
| event-id-overlapping-observers | The same `eventId('payment', id, 'paid')` from two observers → 1 toast; a different payment/state notifies |
| session-change-clears-and-suppresses | The first report adopts the session without dismissing anything. A change dismisses the previous session's adapter toasts and suppresses its pending attempts. A re-report of the same account is a no-op. `keepOnSessionChange` survives. Event IDs carry the account |
| bounded-bookkeeping | Tracked IDs are capped at 200 |
| focus-hold-and-release | Hold → same toast updated with `Infinity` once; release → full duration once; closed toasts leave bookkeeping |
| ownership-sonner-imports | The login pilot no longer imports Sonner; the adapter has no fetch/Supabase/listener/interception; the read pilots contain no toast |

### Browser results (run-1)

| Scenario | Observed |
|---|---|
| auth-toast-outcome-placement-duration | **Activation and placement:** Enter plus a forced click → 1 sign-in request and 1 toast, "Login failed / Check your email and password.", type error. Top 16 px, centered, 400 px wide; light theme; app font. **Announcement and dismiss:** one polite live region contains the outcome; the inline message is not a live region; focus stays in the password field. Dismiss control is 28 × 28 px, named "Close toast", with a 44 px hit area on all four sides. **Duration:** a second deliberate attempt → a second toast. Both self-dismiss at 8012 / 8023 ms |
| pause-hover-focus-hidden-keyboard | Hovered for 10 s → still shown; dismissed 7.6 s after the pointer left. Keyboard focus on the close button for 10 s → still shown; dismissed 8.0 s after blur. Enter on the close button dismisses. Simulated hidden page for 10 s → still shown; no extra toasts on return; dismissed 7.7 s later |
| session-change-clears-previous-toast | A failed-login toast, then a successful login → `/onboarding` (existing destination); the guest failure toast is gone on arrival |
| resident-header-clearance-1440 / -360 / -dark | Header bottom 58 px → toast top 70 px at every width. Centered at 400 px on desktop; 16 px gutters at 360 px. `data-theme=dark` in dark mode. No overflow. Points beside and below the toast hit page content, and the switch beneath stays operable |
| toast-over-radix-dialog | QR "Show QR" dialog → Share (clipboard branch) → "Copied to clipboard." The dialog stays open and focus stays inside it. The live region is not `aria-hidden`/inert. The toast is on top of the overlay and clickable. Dismissing the toast leaves the dialog open. Escape and overlay clicks still close the dialog |
| reduced-motion-toast | Toast transition `0s`, opacity 1 at once, no running toast animations |
| long-text-320 | Long provider message wraps (223 px tall) inside 16 px gutters (16–304 px); the dismiss control stays inside; no horizontal overflow |
| read-pilots-stay-quiet | Announcements read error, Retry, and request-drawer load → 0 toasts |

## 4. Exit gate

| Criterion | Result |
|---|---|
| One operation yields at most one terminal toast | **Met.** The adapter dedups per attempt/event ID (unit tests); repeated activation → 1 request and 1 toast in the browser; a deliberate second attempt still notifies |
| Critical guidance persists in the page | **Met for the pilot.** The login inline message remains after the toast disappears; read errors stay inline. Feature-specific persistence (payments, uploads) is verified in later phases |
| No duplicate live announcements | **Met (DOM-level).** Exactly one live region contains the login outcome. Manual screen-reader confirmation is pending (see section 5) |
| No focus stealing | **Met.** Focus stays in the field on the page and inside the dialog under a modal |
| Host placement does not block underlying controls | **Met.** No intercepting container beside or below the toast; controls beneath stay operable |
| Production build passes or inherited failures are distinguished | **Met.** Build passes; the only lint findings are the 2 inherited warnings |
| Deliverables: one host, adapter, pilot outcome integrations, verified policy | **Met.** Login migrated to the adapter; the list and drawer pilots verified as quiet reads by policy |

Phase status: **Complete**. Every RW-LT-02 task and deliverable is implemented, and the exit gate is met, subject to the coverage limits in section 5.

## 5. Not verified / carried forward

- **Screen reader and browsers.** No manual screen-reader pass was done. Announcements and the duplicate-announcement check are verified through the DOM (the live region exists, is not hidden, and is the only region with the text). The plan says DOM checks alone are insufficient, so this remains pending for RW-LT-09. Only Chrome (Playwright, headless) was used; Firefox, Safari/iOS web, and 200% zoom are pending for RW-LT-09.
- **Keyboard inside modals.** While a Radix modal is open, its focus trap keeps keyboard focus inside the dialog, as WAI modal semantics require. Toasts therefore cannot be reached by keyboard until the dialog closes; they remain announced, pointer/touch dismissible, and auto-dismissing.
- **Simulated hidden tab.** The hidden-tab check overrides `document.hidden`/`visibilityState` and dispatches `visibilitychange`; it does not background a real tab.
- **Focus pause scope.** Keyboard-focus pausing applies only to adapter toasts. Direct Sonner calls get hover/hidden pausing until their phase migrates them.
- **Inherited library leak (sonner 1.7.4).** Each toast's visibility hook adds its `visibilitychange` listener to `document` but removes it from `window`, so one small listener leaks per toast shown. It is bounded by the number of toasts. It is not fixed here, because that would require patching or upgrading the dependency, which the plan's reuse-existing-dependencies rule excludes. Recorded for RW-LT-09.
- **Account changes in other tabs.** The session key comes from layout renders. A sign-out in another tab clears this tab's adapter bookkeeping on its next navigation or refresh, not instantly.
- **Login defects owned by RW-LT-04.** D-04 (network failure reported as wrong credentials) still reproduces, now with the new toast wording. The login profile-load failure path is inline-only, with no toast.
- **Production readiness** is not claimed. Broader qualification remains pending under RW-LT-09.
