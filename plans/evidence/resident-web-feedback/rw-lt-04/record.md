# RW-LT-04 — Authentication, public home, and announcements

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local") and one disposable synthetic recovery account that the run creates and removes. No credentials, tokens, OTPs, or real resident records are in this folder (scanned: no JWT, key, or generated-password strings). Auth refusals and transport failures, OAuth initiation, sign-up success, and profile-completion failures are fulfilled in the browser, so no reset email, SMS, OAuth round trip, or real sign-up was made.

## 1. Preconditions and inputs

- RW-LT-03 is complete ([record](../rw-lt-03/record.md)). I re-read the repository `AGENTS.md` (Android Phase 8 stays cancelled and untouched; sequential migrations), `apps/resident-web/AGENTS.md`, and the full plan.
- Expo v57 docs (https://docs.expo.dev/versions/v57.0.0/) were read: SDK 57 / React Native 0.86 / React 19.2.3. Nothing in them applies to the Next.js resident web, and no Expo code is touched.
- Installed Next.js 16.3.0 guides read: mutating data (Server Function pending state, redirect), `redirect` (call outside try/catch), forms. I verified in the installed `@supabase/auth-js` 2.112.1 source:
  - `signOut()` removes the local session before it returns a failed revoke, except when the failure is an expired-token refresh.
  - auth-js wraps **5xx** answers as `AuthRetryableFetchError` (status > 0), so only status 0 means "no answer".
  - `onAuthStateChange` is local (no request) and the browser client is a singleton.
- Working tree: unrelated admin-web, Android, migration, and other-plan changes were left untouched. No backend change, migration, admin-web/Android/iOS edit, or new dependency was needed; no backend exception was recorded.

## 2. Changes (apps/resident-web/src)

| File | Change |
|---|---|
| `lib/auth/auth-feedback.ts` (new) | `authFailureKind()` classifies an Auth result as connection / rate-limit / service / session / rejected from the error type, status, and code (never message text). `profileCompletionFailure()` maps the fixed `complete_resident_profile` tokens. `AUTH_MESSAGES` holds the shared plain copy. |
| `lib/auth/sign-out.ts` (new), `hooks/use-sign-out.ts` (new) | `signOutBrowser(scope?)` returns `signed-out`, `local-only` (revoke not confirmed but this browser's session is gone), or `failed` (session still stored). `useSignOut(scope?)` is the one logout flow: ref guard, pending, preferences reset and `/login` only after the browser is signed out, one error on failure, one kept warning when the revoke was unconfirmed. Scopes are unchanged (default `global`; complete-profile keeps `local`). |
| `components/shell/resident-shell.tsx`, `settings/settings-sidebar.tsx`, `settings/layout.tsx` | Header and settings logout use `useSignOut`: `aria-busy`, 120 ms spinner, polite "Logging out…" status, "Taking longer than usual" after 10 s, name kept below `lg`. The settings server action was removed (it ignored the result and could not show an error). |
| `components/shared/notification-session.tsx` | While an account is signed in, a local `onAuthStateChange` listener shows one "You've been logged out" notice for a `SIGNED_OUT` this tab did not start. It also clears the previous account's toasts. Routing is unchanged. |
| `components/shared/loading-status.tsx` | Adds `PendingText` (swaps to a slow label after 10 s; mounted only while pending). |
| `app/(auth)/login/page.tsx` | Result classification (D-04: network failure is no longer "Incorrect email or password."), synchronous activation guard, thrown-failure handling, profile-check failure keeps the session with a retry, `?next=` copy. Destinations are unchanged. |
| `app/(auth)/forgot-password`, `verify-otp`, `reset-password` pages | Awaited, guarded, mapped outcomes; a lost response is "couldn't confirm" (check email first / the change may have applied), never a definite failure and never retried. First-invalid-field focus, `aria-invalid`/`aria-describedby`, an accessible name for the code input, a link to request a new code when the reset session has ended. No raw provider text. |
| `app/(auth)/register/register-form.tsx` | Registration/profile-completion outcomes mapped (existing email, weak password, rate-limit, unconfirmed sign-up, RPC tokens). Focus moves to the first invalid field with no toast. Locality and saved-details reads are separate effects with their own retry. Sign-out and Skip are disabled while saving. The local sign-out after sign-up no longer hides a created account. |
| `components/auth/google-button.tsx` | Shared Spinner. Pending is released when the page is restored from the back/forward cache. It never claims sign-in. |
| `app/(auth)/onboarding/page.tsx` | Accent toast removed (D-12); profile-name read failures stay quiet. |
| `app/(resident)/home/page.tsx`, `components/shared/read-failure.tsx` (new) | Each server read error is kept. A failed read shows a retryable notice (`router.refresh()`, read-only) instead of "No requests/reports yet" (D-07). |
| `components/reports/announcement-modal.tsx` | Radix modal dialog with the shared drawer timing (240/180 ms tween, no spring), focus trap, Escape/backdrop close, focus returned to the opening card, named by the title, inert while exiting. Props only. |
| `app/(resident)/settings/delete-account/delete-account-form.tsx` | Same sign-out call, routed through `signOutBrowser` so the session watcher does not double-announce. |
| `scripts/resident-web-feedback-regression.cjs` | Adds `rw-lt-04:build` and `rw-lt-04:verify <run>`. Two earlier scenarios were re-pointed because forgot-password's behavior intentionally changed (see section 5). |

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint | **Pass**: 0 errors; the same 2 inherited warnings | [checks/lint.txt](checks/lint.txt) |
| Production build | **Pass** (exit 0) on the final source; `tsconfig.json` restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-04:verify run-1`: 18 scenarios, 75 checks, production build, Chrome | **18 pass, 0 fail, 0 error** | [run-1/results.json](run-1/results.json), [screens](run-1/screens/) |
| RW-LT-01 primitives rerun | **13/13 pass** | [../rw-lt-01/rerun-after-rw-lt-04/results.json](../rw-lt-01/rerun-after-rw-lt-04/results.json) |
| RW-LT-02 toast host rerun + adapter unit rules | **10/10 pass**; unit **8/8** | [../rw-lt-02/rerun-after-rw-lt-04/results.json](../rw-lt-02/rerun-after-rw-lt-04/results.json), [../rw-lt-02/unit-results.json](../rw-lt-02/unit-results.json) |
| RW-LT-03 navigation/read-state rerun | **15/15 pass** | [../rw-lt-03/rerun-after-rw-lt-04/results.json](../rw-lt-03/rerun-after-rw-lt-04/results.json) |
| RW-LT-00 baseline journeys rerun | **20/20 executed, 0 errors** | [baseline-regression/results.json](baseline-regression/results.json) |
| Inventory reconciliation | **Pass** (every entry assigned to one phase) | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

The first runs of `rw-lt-04:verify` failed on 6 scenarios. Four of those were product findings, and I fixed them before the final run:

1. auth-js reports a 5xx as a "retryable fetch error", so a service outage was labelled "couldn't reach the server". `authFailureKind` now checks the status.
2. The announcement dialog never returned focus (no Radix trigger exists). It now remembers and restores the opener.
3. The Google button check ran against the already-navigating document; the scenario now samples inside the page.
4. After a failed header logout I had used `getSession()` to decide the outcome, which retries a refresh for ~25 s. It now reads the stored cookie.

The remaining failures were scenario artifacts (instant-abort handlers racing a second activation, Playwright's stability wait under the fake clock). They are corrected in the script.

### Scenario results (run-1)

| Scenario | Observed |
|---|---|
| login-failure-classification | Aborted request → "couldn't reach the server" (not wrong credentials); invalid credentials → the existing generic message; 429 → rate-limit copy; 500 → service copy. Each: 1 request, 1 toast, controls usable, no raw provider text. |
| login-activation-and-destinations | Enter + click + `requestSubmit` while slow → 1 request, 1 toast, disabled + `aria-busy` + "Logging in…" immediately. A profile-check failure keeps the session on `/login` with a retry; the retry reaches `/onboarding`. |
| login-destinations-preserved | First login → `/onboarding`; onboarded + `?next=/reports` → `/reports`; incomplete profile → `/home`, and `/complete-profile?next=%2Freports%2Fnew` for `?next=/reports/new`. |
| google-oauth-initiation | Pending (disabled, busy, "Connecting to Google…"), no toast before leaving. Back/forward cache restore releases the button; no sign-in claim. |
| forgot-password-outcomes | Lost response → one **warning** "couldn't confirm the code was sent"; 429 → one error. 1 request each. Confirmed send → `/verify-otp?email=…` with no success toast, and the next screen states where the code went. |
| recovery-code-and-reset | Real local Auth with a disposable account. Expired code and lost response map correctly (1 request each). Resend lost response → warning, retry stays possible; confirmed resend → "New code sent" and the cooldown restarts. Real OTP → `/reset-password`. Invalid input → inline errors, focus on the first invalid field, no toast, no request. Lost update response → warning with inputs kept. Retry → one "Password updated" on `/home` (2 PUTs total), and the new password signs in. |
| register-outcomes | Empty submit → inline errors, focus on First Name, no request. Lost sign-up response → unconfirmed warning + "try logging in" guidance, 1 request (no retry), inputs kept. Existing email → field error with focus. Confirmed sign-up → existing success dialog, one local sign-out, no toast, `?email=` destination preserved. |
| complete-profile-outcomes | Lost response → unconfirmed warning; `invalid_profile_fields` → mapped copy and error toast. 1 request each, inputs kept, no raw token. Sign out → "Signing out…" and one `scope=local` request to `/login`. |
| logout-header-outcomes | With an expired token and an unreachable refresh: still pending past 10 s with "Taking longer than usual" announced and no failure claimed, then one "Couldn't log out" error; same page, preferences kept, button usable. |
| logout-local-only-warning | Unconfirmed revoke → button pending immediately, repeated click ignored (1 request), `/login` with one warning that survives the session change; preferences reset. |
| logout-success-header-and-sidebar | Header and settings sidebar: 1 logout request, `/login`, preferences reset, no toast; gated routes still go to `/login?next=…`. At 360 px the sidebar control keeps its name and does not overflow. |
| session-ended-other-tab | Logging out in tab B → tab A shows exactly one "You've been logged out" info and stays put; tab B shows none. The next navigation follows the existing guest redirect. |
| onboarding-quiet-appearance | Accent and theme picks preview immediately (pressed state, stored value) with zero toasts. Continue → `/home`. |
| home-read-failures | With local REST stopped: the guest announcement and the resident requests/reports show retryable notices, not "No … yet", and no toast. Retry is pending, settles back, 0 writes. After REST returns, Try again restores the real content. |
| announcements-quiet-updates | 5 rounds of Realtime announcement/read events (15 frames delivered by the stand-in) → 0 toasts, same 3 cards, no skeleton. |
| announcement-detail-dialog (1440 and 360 reduced motion) | Named by the title, focus inside, Tab trapped, no fetch on open, slide observed (1440) or no transform (reduced motion), Escape closes with inert controls during exit, focus returns to the card, backdrop closes, no toast. |
| auth-static-and-narrow | `/auth/error` copy and links unchanged; `/login?authError` notice kept; at 320 px the toast stays within the gutters and nothing overflows. |

## 4. Exit gate

| Criterion | Result |
|---|---|
| Guest browsing still works | **Met.** Guest home, announcements, and gated redirects pass (baseline rerun 20/20, RW-LT-03 rerun 15/15). |
| Normal and profile-completion-required residents follow existing destinations | **Met.** `login-destinations-preserved`; the baseline `profile-completion-required` scenario is unchanged. |
| Invalid inputs remain inline | **Met.** Register, reset-password: inline errors, first-invalid focus, no toast. |
| Failed login/OTP/logout restores usable controls | **Met.** Every failure path releases pending (login, forgot, verify, resend, reset, register, complete, logout). |
| OAuth initiation does not announce success | **Met.** No toast before leaving; pending is released on return. |
| Automatic announcement/unread updates produce no toast burst | **Met.** 10 events → 0 toasts. |
| Local auth regressions pass; provider coverage recorded honestly | **Met locally; live provider coverage pending** (section 5). |
| Typecheck/lint/build | **Met.** Build passes; lint has only the 2 inherited warnings. |

Phase status: **Complete.** Every RW-LT-04 task, deliverable, required verification, and exit-gate criterion is met, subject to the limits below.

## 5. Not verified / carried forward

- **Providers.** Google OAuth consent/callback, SMS and email OTP delivery, and Brevo were not exercised (sandbox/manual evidence required). `/auth/callback` is unchanged and was only checked for its redirect behavior in earlier phases.
- **Realtime.** Local Realtime is still unavailable; the quiet-update scenario uses the in-browser protocol stand-in.
- **Streamed hard-load fallbacks, screen reader, browsers.** Still pending for RW-LT-09: no manual screen-reader pass (DOM-level `role=status`/`role=alert` checks only), Chrome-only, no Firefox/Safari/iOS web, no 200% zoom pass.
- **Slow `/home` when REST is down.** The local gateway retries a stopped REST container for ~5 s per read, and the page waits for 3 serial server reads. With REST down, `/home` took tens of seconds to render. That is gateway/server behavior outside this phase's frontend scope, so I recorded it and did not change query structure.
- **Logout across devices.** When the server revoke is unconfirmed, other devices may remain signed in. The warning says so; the scope (`global`) was deliberately not changed.
- **Earlier-phase scenarios changed.** Forgot-password stopped showing raw provider text and a no-label spinner button, so RW-LT-01 `text-button-no-label-spinner` now probes the registration "Detect My Location" button, and RW-LT-02 `long-text-320` uses the rate-limit toast. Both reruns pass.
- **Remaining defects owned elsewhere.** D-04 for the payment-method step (RW-LT-06), report submit/withdraw (RW-LT-07), and location save (RW-LT-08); D-07 elsewhere; D-12 for the notification toggle and profile validation toast (RW-LT-08).
- **Production readiness** is not claimed. Broader qualification remains pending under RW-LT-09, and nothing was deployed.
