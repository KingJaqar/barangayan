# Phases 2–3 execution evidence

Execution dates: 2026-10-16–17 (Asia/Manila). **Implementation is complete; both phases remain partially complete pending manual integration/accessibility verification.** AUTH-02/AUTH-21 callback delivery and READ-01–05 definitive success are implemented and locally verified. No application-code blocker remains. No production-readiness claim is made.

## Continuation — 2026-10-17

The user requested completion after the result-contract blockers were reported. This continuation includes the narrow callback/result-confirmation changes described in the chat: two existing callback responses receive a short-lived UI receipt, and the five existing explicit read writes request affected-row representation. This is a limited exception to the original frontend-only boundary. Existing auth/business operations, redirect destinations, payloads, ownership filters, conflict keys, write/request counts, RLS/schema and remote configuration remain unchanged. No new dependency, public application function, product source file, route or UI control was added.

- **Callbacks:** existing Google/email handlers generate a 120-second, destination-path-scoped cookie with a random ID, account ID, timestamp and controlled result kind. Existing session-feedback consumes it before asynchronous welcome work, removes it before delivery and suppresses invalid/expired/other-account receipts. Reload stays quiet; a later real callback has a new ID. Synchronous delivery waits one cancellable microtask for the unchanged host to subscribe. Email change success requires the existing synchronized result to establish the changed address; unproven completion stays information. The cookie grants no auth or business permission and contains no email/name/token.
- **Read proof:** the installed SDK adds return=representation on the same write. Single announcement actions validate expected ID; bulk validates the entire requested ID set; report actions validate expected ID, resolved status and read timestamp/null state. Empty/mismatched/incomplete rows cannot produce success. A returned report-read timestamp must be a string; an omitted field falls back to information. Existing quiet count refresh failure cannot negate the confirmed write.
- **Verification:** continuation baseline typecheck/build passed, lint had two existing location warnings, tests had 148 passes and the existing pricing failure. Final typecheck/build pass; lint has the same two warnings and no errors; tests have 157 passes and the same unrelated failure. The combined 33-scenario browser suite and existing 14-scenario auth suite pass with no runtime/console errors or warnings. No live provider, email, deletion or hosted database was contacted. Actual callback handlers run over local HTTP; read writes use the installed Supabase/PostgREST builder with synthetic fetch replies.
- **Review:** ten continuation application files were compared with the pre-edit snapshot. Business calls/arguments are unchanged after normalizing timestamp/list aliases; the intentional query additions are the five return projections. The shared host/adapter/CSS remain unchanged. Light/wide recovery dialog and dark/narrow captures were inspected; no clipping or design change was observed. The build's temporary tsconfig includes were restored.

Current evidence: [checks.json](checks.json), [combined browser results](browser-results.json), [auth-only results](../phase-2/browser-results.json), [completion source review](completion-source-review.json). The auth-only fixture's older callback limitation describes that fixture's omitted handlers; the combined suite now verifies those handlers. Earlier notes below describe the initial frontend-only pass wherever explicitly historical.

| Acceptance criterion | Status |
|---|---|
| Safe confirmed/rejected/uncertain outcomes, one per attempt; distinct auth operations; reset privacy | Met in local tests/fixtures |
| Callback destination delivery, repeat attempt, reload silence, expired/other-account suppression | Met: actual handlers + client owners, local HTTP/Chrome; receipt expiry also unit tested |
| Both recovery variants, structured redirect propagation, logout/navigation/account-change handling | Met in component/redirect-boundary fixture; real recovery-cookie/Server Action transport pending manual verification |
| Preference storage preservation, truthful guest/account wording, custom-color consolidation and rapid selection | Met in StrictMode browser fixture |
| All five read successes, failed/empty/mismatched writes, no extra write, quiet refresh, repeat deduplication | Met using installed SDK with synthetic HTTP replies; hosted persistence/RLS pending manual verification |
| Shared toast appearance, inspected light/dark/narrow/dialog layout and recorded console/runtime behavior | Met for recorded browser captures/checks; spoken screen-reader behavior pending manual verification |


## Orientation and initial classification

Read the complete plan, root AGENTS.md/CLAUDE.md, resident-web AGENTS.md/CLAUDE.md, the Phase 1 owner ledger, and the actual handlers, callers, adapter, host and session handoff. No additional applicable ancestor/deeper instructions were found. No repository-instruction conflict affects Phases 2–3; the cancelled Android phase remains untouched. No Expo/React Native file was edited.

Required references: [Expo v57](https://docs.expo.dev/versions/v57.0.0/); installed Next.js 16.3.0 server/client, Server Actions, error handling, redirect and useRouter guides; installed React/Supabase/Sonner contracts; [React useRef](https://react.dev/reference/react/useRef); [Supabase update](https://supabase.com/docs/reference/javascript/update) and [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp); tagged [Supabase JS 2.112.1 source](https://github.com/supabase/supabase-js/blob/v2.112.1/packages/core/auth-js/src/GoTrueClient.ts). Online Supabase references are rolling; installed 2.112.1 types/source were authoritative. Supabase changelog was retrieved after its Markdown reader/sandbox-network failures; listed breaking changes do not affect this client feedback wiring. React resolves to the 19.2 line; no new dependency/API was introduced.

Phase 1 prerequisites were confirmed in code, not inferred from its checkboxes: one root Toaster, four-severity adapter with bounded IDs/session invalidation, explicit-login receipt, intentional-sign-out tracking and ordinary guest-session logout handoff. Existing login/logout, recovery and email tests were run.

| Selected requirement | Initial state | Result |
|---|---|---|
| Phase 2 AUTH-01–22 | Partially done: baseline failure/success coverage varies; missing catalog notifications | All rows wired; current callback evidence above |
| Phase 2 adapter/session handoff | Partially done: normal login/logout existed, alternate paths did not use it | Existing helper extended for combined success/navigation-warning copy; no parallel helper/framework |
| Phase 2 reset privacy/redirects | Privacy already done; Settings redirect was caught as an ordinary failure | Enumeration-safe public success retained; structured Next redirect rethrown |
| Phase 2 combined recovery/logout | Not started | One combined standalone outcome; dialog update and later deliberate logout remain distinct |
| Phase 2 distinct auth operations | Partially done | Login/link/reauth/recovery/deletion outcomes remain separate |
| Phase 3 PREF-01–05 / READ-01–05 | Partially done: some direct error toasts; no success/storage-result coverage | Feasible feedback wired; unproven saves use information/warning |
| Phase 3 returned errors/results | Partially done: individual read errors discarded | Typed local result reaches explicit owners; rejected writes do not trigger refresh |
| Phase 3 observable storage | Not started | Existing setters return persistence results while retaining applied memory state |
| Phase 3 custom action/stale responses | Not started | Single terminal owner; latest selection wins; no storage side effects in React updater |
| Phase 3 quiet bookkeeping | Already quiet | Still quiet; no notifications in shared count refresh hooks |

The working tree already contained extensive user changes, including the untracked plan and session helper. Snapshots under `tmp/toast-phases23/` distinguish this task's starting sources. Concurrent onboarding removal, configuration/layout edits and a final recovery-handoff refinement were observed and preserved. The last refinement captures a guest attempt before awaiting navigation, so a later account change invalidates its result; the affected browser/tests/lint/build were rechecked. Transient generated-validator errors referring to the removed page later cleared; the subsequent normal typecheck passed. No user change was reverted or reformatted.

## Action ownership and result ledger

Paths are relative to `apps/resident-web/src/`. “Fixture” means actual client components/adapter/host in Chrome with synthetic service responses, not live external completion. Unexercised variants remain explicitly identified.

| ID | Existing client owner and signal | Implemented result / evidence |
|---|---|---|
| AUTH-01 | `components/auth/google-button.tsx`, returned error/missing URL/throw | Safe startup error; link variant keeps separate copy and never queues welcome. Fixture startup rejection |
| AUTH-02 | `app/auth/error/page.tsx` / existing callback route + session-feedback | Verified local handler/destination error receipt, consumption, quiet reload and later callback; inline guidance retained without duplicate live alert |
| AUTH-03 | `app/(auth)/register/register-form.tsx`, error-free signup with session | Account-created toast and original modal. Fixture normal and failed-local-signout cases; correlated across intentional signup session transition |
| AUTH-04 | Same form, no returned session | Unsupported-confirmation warning and original inline guidance. Fixture |
| AUTH-05 | `app/(auth)/forgot-password/page.tsx`, no reset-send error | Enumeration-safe success before existing navigation. Fixture, including reload without replay |
| AUTH-06 | `app/(auth)/verify-otp/verify-otp-form.tsx`, public verify result/user | Success under the recovery session, not login welcome; obsolete-account guard. Fixture |
| AUTH-07 | `settings/change-password/forgot-password-dialog.tsx`, typed eligibility | Explicit Check again reports success/unverified/error; automatic opening stays quiet. Fixture success/unverified |
| AUTH-08 | Same dialog, send/resend typed result or throw | Success, confirmed error, or uncertain send warning. Fixture send success/connection; resend shares owner, source checked |
| AUTH-09 | Same dialog, verify typed result or throw | Verified success; invalid/rejected, connection and other safe guidance remain distinct. Fixture success; remaining variants source reviewed |
| AUTH-10 | Same dialog, update typed result or throw | Password-updated success or rejection/uncertainty. Fixture success; remaining variants source reviewed |
| AUTH-11 | Dialog `continueToLogin`; reset form `finishSignOut`; existing `signOutBrowser` result | Guest-session logout/combined update success; logout failure differs from post-logout navigation warning. Fixtures; no unexpected-session duplicate |
| AUTH-12 | Verify form Settings branch; read-only server action redirects on verified result | Returned errors handled, structured redirect announces once and is rethrown. Returned-success fixture is synthetic; **real server-action redirect delivery remains pending manual verification** |
| AUTH-13 | Same form Settings resend typed result | Existing success preserved; returned errors and lost-response warning added. Source reviewed; live dormant route pending |
| AUTH-14 | `app/(auth)/reset-password/reset-password-form.tsx`, Settings typed update then local signout/finish | One combined outcome, logout retry, uncertainty and safe failure copy. Fixture combined success/logout failure/navigation failure; live dormant route pending |
| AUTH-15 | `settings/email-verification/verification-form.tsx`, existing shared helper status/controlled errors | Sent/pending, already verified, confirmed rejection or conservative uncertainty. Fixture uncertain send; shared-helper tests/source confirm status contract |
| AUTH-16 | Same form, verified vs pending status | Verified success only for verified result; invalid code distinct from connection failure. Fixture verified/invalid |
| AUTH-17 | Same form `syncEmail`, existing server action `ok` | Confirmed profile-email sync success/error. Existing action tests pass; client source reviewed; live interaction pending |
| AUTH-18 | `settings/email-verification/change-email-form.tsx` / existing `lib/auth/email-change.ts` | Normalized Auth request success; safe rejection vs uncertainty metadata preserved locally. Fixture success and focused provenance tests |
| AUTH-19 | Same send handler, capture resend before state changes | Resent success / rejection / uncertainty. Fixture success; error variants share tested provenance mapping |
| AUTH-20 | Same form `checkConfirmation`, existing owned sync response | Changed / pending / no completed change / error. Fixture first three; source/error contract checked |
| AUTH-21 | Existing callback response + destination NotificationSession/session-feedback | Verified confirmed change, pending, safe error, quiet reload and other-account suppression; unit test covers conservative unproven completion |
| AUTH-22 | `settings/delete-account/delete-account-form.tsx`, reauth then function result | Password/rate/ownership/rejection errors; transport/timeout/server uncertainty; existing success migrated to adapter/handoff. Synthetic rejection/success only; no real deletion |
| PREF-01 | `settings/theme/theme-form.tsx` + theme controller | Guest device success only after storage; account no-row result uses specified information fallback. Fixture storage success/failure, returned rejection, rapid selection, account switch and same-account unmount |
| PREF-02 | Same form + accent controller | Same persistence rules for accent. Fixture guest success; shared result handling/source checked |
| PREF-03 | Same form + font controller | Same persistence rules for font. Fixture guest success; shared result handling/source checked |
| PREF-04 | Same form custom-add callback + accent controller | One terminal toast for add/select; local partial failure warns. StrictMode fixtures verify storage failure and original two account writes |
| PREF-05 | Same form custom-remove callback + accent controller | Confirmed local removal or in-memory-only warning. StrictMode fixtures |
| READ-01 | `app/(resident)/announcements/announcements-feed.tsx` → `hooks/use-unread-counts.tsx` | Verified bulk success from complete returned ID set; one write; rejection/uncertainty/information branches retained |
| READ-02 | `components/reports/announcement-card.tsx` → hook | Returned rejection/transport uncertainty/no-row information; no-op quiet. Fixture rejection, double activation, confirmed success despite refresh failure, and empty/mismatched-row information |
| READ-03 | Same card → delete helper | Same result handling for unread; fixture later intentional unread success not suppressed |
| READ-04 | `components/reports/incident-card.tsx` → update helper | Same explicit result handling, resolved-only guard. Fixture thrown failure and confirmed read success; actual SDK request/ownership filters checked |
| READ-05 | Same card → update helper | Same safe unread result handling and guard. Fixture confirmed unread success; hosted persistence remains manual |

## Boundary decisions and cleanup

- Initial pass: AUTH-02/AUTH-21 were deferred by the original frontend-only response boundary. The continuation exception and current verified delivery are documented above; no extra route/request was added.
- Account preferences retain the permitted information fallback for account writes without row proof. READ-01–05 now use returned rows for definitive success; absent/mismatched proof retains `Read-status update sent. Refresh to confirm.` Existing filters/payloads/request counts remain unchanged.
- Custom add already initiated two accent updates: add callback and subsequent selection. Both writes and their order remain; only ownership of local selection and terminal feedback moved into the existing add callback. No duplicate accent-saved/color-added pair remains.
- Theme/controller storage operations now report success synchronously. The previous `addCustomColor` boolean and storage writes inside React state updaters were replaced with bounded current-list bookkeeping and existing setters. Invalid, duplicate and limit branches still do not add a color.
- Direct Sonner calls were replaced in the touched ThemeForm, announcements bulk handler and DeleteAccountForm. Static references/callers of custom-color and read helpers were searched; existing context/provider exports and routes remain. No source file was deleted. Dormant `markResolvedRead` was left quiet and unchanged.
- `notifyLoggedOut` remains the existing handoff, extended to return its guest attempt for deferred recovery navigation; its existing callers still select the single terminal severity. No new public application function or new product source file was introduced. Minimal private result/attempt bookkeeping stays with the existing owners. Local Auth listeners perform no request and unsubscribe; no new polling/retry/timer framework was added.
- The shared host, adapter design, CSS, root mounting and duration constants were not edited. New test-only fixture files follow the repository's existing esbuild/Playwright pattern: the ID-specific fixture cannot exercise these auth/preferences/read owners without replacing its separate scenario. No new dependency was installed.
- Initial-pass AST comparison covered 20 client files. Continuation review adds explicit return projections and two callback UI receipts; payload/filter/business-call comparisons still match. Custom add retains two writes; rapid read activation is one write. Database, remote service, deployment and other-platform files remain untouched by this execution.

## Verification and remaining manual steps

Baseline: typecheck passed; lint exited 0 with two existing location-verification warnings; Vitest had 142 passed and the existing search-pricing failure at `tests/search.test.ts:74`; isolated Next 16.3.0 Turbopack production build passed. Initial test startup used an incorrect config/root combination and hit Windows esbuild directory access; correcting the config location and allowing the necessary file access ran the tests. No unchanged failing command was looped.

Final logs and results are listed in `checks.json` and `browser-results.json`. Browser assertions use real client components, real adapter/host, React StrictMode and intercepted/synthetic outcomes. Runtime errors, console errors and warnings are recorded separately and must be empty for a passing report. Images include light/dark, narrow/wide and an open recovery dialog; they are layout evidence, not a screen-reader certification. Capture waits for the existing entry animation rather than interpreting an in-flight animation frame as clipping.

An expanded fixture exposed a deletion toast lost across sign-out, a registration completion lost when local sign-out failed, and test expectations that needed the catalog's navigation warning. Those causes were corrected and the scenarios retained as regressions. Test fixture render-time mutations were moved to effects to resolve the new lint errors. No production suppression was added.

Manual verification still required:

1. In an owner-approved test environment, open `/login`, start Google sign-in and cancel/deny it. At `/auth/error`, expect one safe error; reload/back must not replay it. Start a new attempt and verify it may notify again. Complete a separate successful login and confirm one ordinary welcome. Link Google from the existing Profile flow and confirm it does not generate a login welcome. No provider was contacted here.
2. At `/settings/email-verification`, send/resend a verification code, reject an invalid code, then verify a valid one; check single safe outcomes and retained guidance. Request a different test email. Follow the first-inbox confirmation and expect pending information while Auth still reports a pending email; complete the second confirmation and expect changed-email success only when the synchronized address proves the change. Reload the destination: no replay. An expired link must produce one error with guidance. Use `/forgot-password` with a test address and confirm enumeration-safe send feedback and the normal code/reset flow; no real email was sent here.
3. At `/settings/change-password`, open Forgot password, send a code (which creates the existing recovery intent), and exercise the dialog flow. For the standalone variant, start a fresh code-send intent, then navigate directly to `/verify-otp?source=settings` in the same session. Verify the code and observe the real Server Action redirect to `/reset-password?source=settings`; update the test password and continue to login. Expect one result per deliberate operation, one combined standalone update/logout result, no unexpected-session duplicate, and quiet reload/back. These dormant routes gained no new entry point; no intent cookie should be fabricated or guard bypassed.
4. Use a screen reader on the existing registration/recovery dialogs and email/code forms: one toast summary, readable inline guidance, correct title/focus and field associations. Repeat with keyboard-only input and check the toast close control without losing the form/dialog context. Browser DOM/live-region assertions do not certify spoken announcements.
5. With two test accounts in the hosted test environment, mark an announcement and resolved report read/unread, then bulk-read remaining announcements. Refresh or open a second tab to confirm persistence/counts. Exercise a missing or inaccessible record; confirm error/information rather than false success. Confirm own-row RLS and account-switch suppression without altering policies. Also change an account appearance preference, reload and confirm the accurate success/fallback behavior. No hosted database or real account was changed by these tests.

Out of scope: the existing search-pricing test mismatch, two location-verification lint warnings, concurrent onboarding removal, all later toast phases and cancelled Android work. No commit, push, deployment, remote migration, external configuration, real deletion or third-party message was performed.
