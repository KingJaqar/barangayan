# Phase 2 — authentication, email and recovery

**2026-10-17 continuation:** AUTH-02/AUTH-21 are now implemented and locally verified by the combined callback fixture. The older callback boundary statements below record the initial pass. Current implementation, scope exception and pending manual steps are in the [Phases 2–3 completion record](../phases-2-3/README.md). This auth-only fixture was rerun: all 14 scenarios pass with no runtime/console errors or warnings.

Execution: 2026-10-16, Asia/Manila. **Partially complete.** All feasible frontend paths have notification wiring and synthetic verification. AUTH-02 and AUTH-21 remain blocked/deferred by the plan's server-inspection-only boundary; live external integrations and assistive-technology verification are not claimed passed.

## Orientation and starting state

Read root AGENTS.md and CLAUDE.md, resident-web AGENTS.md and CLAUDE.md; no deeper applicable instructions were found. Ancestor AGENTS checks found none. No instruction conflict was found. The cancelled Android audit remains outside scope. Read the whole toast plan and Phase 1's README/action ledger. Confirmed Phase 1 prerequisites in code: one root Toaster; NotificationSession in the existing layouts; adapter attempt/event deduplication and session cleanup; explicit-login receipt and ordinary logout helper. Existing login, sign-out and recovery tests ran in this session.

The working tree already contained extensive user changes, including most AUTH notification wiring and the shared phases-2-3 fixture. The plan's “not started” descriptions were therefore stale. Source also changed concurrently during execution (including email-change tests, recovery identity guards and the combined-recovery helper test). These changes were preserved, not attributed to this patch. A pre-edit source snapshot and incremental review were saved in `tmp/toast-phase-2/`; no commit, push, deployment or remote mutation occurred.

Documentation inspected before edits:

- [Expo v57](https://docs.expo.dev/versions/v57.0.0/), as required by root instructions. No mobile code was edited.
- Installed Next **16.3.0** server/client component guide, redirect reference, `redirect-error`, AppRouter global redirect fallback and redirect boundary implementation. Structured redirects remain control flow and are rethrown.
- React **19.2.8** resolves within resident-web; [React's version policy](https://react.dev/versions) does not publish separate minor/patch documentation. Read the React 19 useEffect documentation; no new React API is used in production.
- Supabase Auth **2.112.1** installed errors/result contracts and official resetPasswordForEmail, verifyOtp and updateUser references. Online references are rolling; installed contracts were checked. Sonner **1.7.4** host/adapter implementation was inspected; no new direct Sonner API or style was introduced.
- Playwright **1.62.1** installed Clock types and [clock documentation](https://playwright.dev/docs/clock) for the new synthetic cooldown tests.

## Requirement comparison and result ownership

Paths here are relative to `apps/resident-web/src/`. “Verified” below means source review plus the listed **synthetic browser/component** scenarios, not successful live email, OAuth or deletion. The browser report is [browser-results.json](browser-results.json); the persistent test is `apps/resident-web/tests/auth-toast-browser.mjs` and its auth-only fixture. A separate fixture was necessary to cover all Phase 2 owners and redirect control flow without editing or depending on the concurrently changing phases-2-3 fixture.

| Requirement | Before editing | Final status and evidence |
|---|---|---|
| AUTH-01 Google startup | Done in existing user changes | Verified rejection/retry and distinct identity-link copy in GoogleButton.start; no login receipt for linking |
| AUTH-02 Google callback failure | Not started; Phase 1 boundary finding | **Blocked/deferred.** `app/auth/callback/route.ts` redirects to server-only `app/auth/error/page.tsx`. That destination has no feature client owner/result prop or attempt token and already owns an inline alert. No server page/route or shared host was rewritten to force a toast; preserve inline recovery. Direct/reloaded visits are not proof of a fresh attempt. A proper destination contract/announcement owner needs separately authorized work |
| AUTH-03 registration success | Done in existing user changes | Verified RegisterForm's actual signUp-success/local-sign-out result, guest outcome, modal, Login navigation and no reload replay |
| AUTH-04 unsupported email confirmation | Done in existing user changes | Verified no-session warning, retained inline recovery and no sign-out request |
| AUTH-05 public reset send | Done in existing user changes | Verified confirmed privacy-preserving copy, uncertain lost reply and reload silence; no account-existence claim |
| AUTH-06 public code verification | Done in existing user changes | Verified confirmed user result, reset destination and no login welcome |
| AUTH-07 explicit eligibility | Partially done | Verified opening stays quiet; explicit unverified warning and successful recheck. Existing eligibility request reused; scoped active/pending guard added |
| AUTH-08 dialog send/resend | Done in existing user changes | Verified send success and connection uncertainty; send/resend use the same source-owned result branch. Existing cooldown retained |
| AUTH-09 dialog verification | Partially done | Verified rejected code vs rate-limit guidance, confirmed success; service/session failures no longer mislabeled connection failures |
| AUTH-10 dialog password update | Partially done | Verified success, returned rejection, connection uncertainty and thrown uncertainty. Password update remains separate from a later deliberate logout |
| AUTH-11 recovery logout | Partially done | Verified later dialog logout, failure without unexpected-session info, guest persistence; standalone update/logout chain gives one combined outcome. Navigation failure after successful logout gives one guest warning, not a success/error pair |
| AUTH-12 standalone Settings verification | Partially done; dormant route variant | Verified component's structured redirect through fixture matching installed Next fallback; server action unchanged. **Live route entry pending manual verification**: existing recovery intent is required and current UI does not link to this variant |
| AUTH-13 standalone Settings resend | Done in existing user changes; dormant variant | Verified returned rejection and uncertainty after the real existing cooldown; live route limitation as AUTH-12 |
| AUTH-14 standalone Settings password update | Partially done; dormant variant | Verified returned rejection, uncertainty without sign-out, combined success/redirect and navigation-only warning; account switch suppresses pending update. Live route limitation as AUTH-12 |
| AUTH-15 email code send/resend | Done in existing user changes | Verified pending result success and thrown-send uncertainty; existing shared helper erases transport metadata, so unknown send failures remain conservative warnings |
| AUTH-16 email verification | Done in existing user changes | Verified verified result vs invalid-code rejection; no duplicate inline live status. Unknown/non-code failures keep generic verification error, not invalid-code copy |
| AUTH-17 use sign-in email | Done in existing user changes | Verified existing action `ok` result success and explicit failed-result error; no query/action changes |
| AUTH-18 email change request | Done in existing user changes | Verified owned updateUser response success; shared pre/post owner checks and exact payload unchanged |
| AUTH-19 resend confirmation | Done in existing user changes | Verified success, returned rejection and lost-response uncertainty; no false completed-change claim |
| AUTH-20 check confirmation | Done in existing user changes | Verified confirmed expected address success, pending information, no-completed-change information and thrown read failure; existing action result/ownership preserved |
| AUTH-21 email callback return | Not started; Phase 1 boundary finding | **Blocked/deferred.** `app/auth/email-change/route.ts` returns to the ordinary Settings page; confirmed/pending returns have no provenance/result token. `emailChangeError=1` is a static server-owned inline flag and is not passed into the client form. Neither ordinary navigation nor a verified current address proves a fresh callback attempt. Do not add a mount toast from that flag or invent success. Existing AUTH-20 provides explicit truthful recovery |
| AUTH-22 delete failure/success | Partially done | Verified reauthentication rejection prevents invoke; rate-limit/missing-email guards, confirmed HTTP rejection, server failure after possible partial work, thrown uncertainty and success all yield one safe result. No real deletion executed |
| Adapter/session handoff, privacy and redirects | Mostly done | Met for feasible paths. Existing helper now supports a guest warning after successful logout/navigation failure; consumes queued welcome. Ordinary logout/login behavior retained |
| Combined feedback and session deduplication | Partially done | Met in verified scenarios. Existing listener tracks the account it most recently observed, so repeated SIGNED_OUT or a changed layout snapshot cannot invent another old-account result |
| Distinct login/logout/reauth/deletion/linking | Mostly done | Source + helper/browser checks met. Reauthentication never queues welcome, deletion retains its own wording/global cleanup, linking remains distinct |

## Changes, replacements and scope

This execution edited the recovery dialog, standalone verification/reset form, deletion form, NotificationSession and existing session-feedback helper. It extended the existing logout helper to return its guest attempt without immediately presenting a toast when passed null. Recovery captures that attempt before waiting for navigation, then delivers success/warning against the same identity: legitimate unmount does not lose completion, but a new account invalidates it even if the old form is gone. It retained safe rate-limit/session guidance; made deletion server failures conservative and removed raw function error bodies from the handled inline paths. Existing account guards, mutations, ownership predicates, routes, timers and request payloads remain in place. Other AUTH wiring already existed and was verified rather than replaced.

Added two helper regression cases to `tests/session-feedback.test.ts` and the auth-only browser/fixture files. No production file, UI component, public application function, style, dependency, backend, shared package, migration, admin or mobile file was added/removed by this execution. `notifyLoggedOut` is the existing helper with narrowly scoped deferred-attempt support, not a parallel notification path. Its normal string/default callers retain immediate success presentation.

Removed the deletion form's `toEdgeFunctionError` and direct session-reset imports. Reference search confirmed `lib/edge-function-error.ts` is still used by Download Data, so it was retained. Existing toast adapter/host defaults and CSS are unchanged. Notification presentation adds no request, polling, subscription, retry scheduler or timer. Existing subscription cleanup remains intact. Final incremental diff was reviewed for security, stale-account outcomes, raw backend text, dead imports and scope.

Server/backend files inspected only: auth callback/error destination, email-change callback, email-verification page/actions, auth layouts, verify/reset route pages, Settings recovery server helper, delete-my-account function, shared registration schema/locality/profile and email-verification helpers. They were not edited by this execution.

## Verification on 2026-10-16

| Check | Baseline | Final observed result |
|---|---|---|
| `npm run typecheck --workspace=@barangayan/resident-web` | Pass | Pass, exit 0 |
| `npm run lint --workspace=@barangayan/resident-web` | Fail: 3 immutability errors in existing `tests/toast-coverage-fixture.jsx`; 2 location warnings | Pass, exit 0, with the same 2 location warnings. Concurrent user work fixed the original 3 fixture errors; this execution did not edit that fixture |
| ESLint on this execution's source/tests | Not applicable | Pass, exit 0; files listed in `tmp/toast-phase-2/scoped-lint.log` command history |
| `node ../../node_modules/vitest/vitest.mjs run` from resident-web | 142 pass, 1 fail | 148 pass, 1 fail. Same pre-existing `tests/search.test.ts:74` charter/pricing-copy mismatch. The higher total includes concurrent user tests, not just this patch; all 9 current session-feedback tests pass |
| Resident-web normal Turbopack production build | Pass | Pass, exit 0, Next 16.3.0. Used separate `.next-toast-phase2-baseline` / `.next-toast-phase2-final` output; each build's tsconfig modifications restored from its own pre-build bytes, without resetting other user config changes |
| `node apps/resident-web/tests/auth-toast-browser.mjs` | New focused test | Pass: 14 scenario groups on actual components/host with synthetic boundaries; no page errors, console errors or warnings |
| Visual review | No new baseline design | Viewed both retained PNGs: complete light/wide and dark/narrow toast with open recovery dialog. No production styling changed. This is fixture visual evidence, not a full production/device/accessibility audit |

First sandbox Vitest startup failed because esbuild could not traverse the workspace. A cause-based permission retry ran the suite. Browser fixture failures were corrected at their causes: a synthetic locality lacked the schema-required UUID; standalone redirects needed Next's documented global fallback as well as an error boundary; resend countdown required Clock.runFor after installation before navigation, not fastForward's single callback. Early screenshots captured an entrance animation and a class-only theme change; final capture waits for settled geometry and uses the actual theme controller. No production timing/style was changed to make tests pass. Final logs are under `tmp/toast-phase-2/`; concise durable results are above and in browser-results.json.

## Acceptance and remaining work

- **Met in source and synthetic verification:** result severity, single terminal outcome for feasible handlers, privacy, structured redirect handling, combined vs later logout, repeated session deduplication, account-change suppression, retained inline recovery, no new external requests/dependencies/styles. Actual live integration success is not inferred from fixtures.
- **Not met:** all AUTH-01–22 callback coverage and the unconditional Phase 2 exit. AUTH-02 and AUTH-21 require a safe destination owner/provenance/announcement contract that current client state does not provide. This execution cannot honestly mark the phase complete within the current boundary.
- **Pending manual verification:** using a disposable resident, exercise real Google login/startup/callback failure, registration, public reset, Settings dialog recovery, both-inbox email confirmation, and ordinary logout. Confirm messages against actual results and refresh/back once. For AUTH-12–14, an owner must provide an existing valid Settings recovery intent and explicitly open the dormant route; no new entry point was added. Use synthetic deletion checks here; no real account deletion is requested.
- **Pending manual verification:** with NVDA or another screen reader, send/verify/update in the recovery dialog and verify email; confirm one summary announcement, retained field focus/descriptions, and accessible toast close control. Recheck narrow/wide and light/dark in the actual app. The fixture's DOM checks cannot prove spoken output.
- **Out of scope:** existing search-copy failure, two location warnings, other working-tree changes, and later toast phases. The baseline phases-2-3 fixture lint errors were fixed by concurrent user work and no longer appear in the final lint run. No unrelated fix or readiness claim by this execution is included.

To unblock full callback coverage, the user must choose whether to keep AUTH-02/AUTH-21 deferred under the current frontend-only rule (recommended for this change) or authorize separate narrowly scoped server/destination contract work. No such authorization is assumed.
