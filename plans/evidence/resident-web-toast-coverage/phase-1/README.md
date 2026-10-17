# Phase 1 — source ownership and frontend feasibility

Audit date: 2026-10-16 (Asia/Manila). Phase status: **Complete**. This phase produces the audit/evidence required before Phase 2; it does not implement notification wiring. Phases 2–8 were not started. Catalog implementation remains not started except existing baseline coverage and intentionally quiet branches.

## Scope, instructions, and baseline

Read root `AGENTS.md`, root `CLAUDE.md` (delegates to AGENTS), resident-web `AGENTS.md`, and resident-web `CLAUDE.md` (delegates to AGENTS). The resident instructions require installed Next.js documentation. No deeper instruction files were found under resident-web, plans, or shared. Ancestor instruction-file checks found no additional files. No conflict with the selected phase was found. The Supabase skill became available during execution and was read: its migration-generation guidance cannot override the repository's sequential numbering, but no migration is needed or authorized here.

The plan itself and substantial resident-web/admin/iOS/shared/database changes were already uncommitted. The selected plan was untracked. No existing application changes were reverted or rewritten. No application source, dependencies, server file, database, service setting, or other platform was changed in Phase 1. The build's temporary tsconfig additions were restored byte-for-byte from its pre-build contents; the existing includes were preserved.

Framework references read:

- [Expo SDK v57](https://docs.expo.dev/versions/v57.0.0/), required by root instructions. This phase edits no Expo/React Native code.
- Installed Next.js **16.3.0**: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `03-api-reference/04-functions/redirect.md`. Server action redirects throw and must not be treated as ordinary caught failures.
- React resolves to **19.2.8** inside resident-web (the root copy is 19.2.3); [React versions](https://react.dev/versions) identifies the 19.2 documentation line. No React implementation was written.
- Supabase JS **2.112.1**, SSR **0.12.4**: installed client/shared contracts, [update reference](https://supabase.com/docs/reference/javascript/update), [signUp reference](https://supabase.com/docs/reference/javascript/auth-signup). These online references are rolling docs; the installed source/contracts remain authoritative for this audit. Changelog retrieval was unavailable: web reader rejected Markdown content type and shell retrieval was blocked by network policy. No Supabase implementation depended on unavailable changelog content.
- Sonner **1.7.4**: installed `node_modules/sonner/package.json` and `dist/index.js`, plus the resident host/adapter. The host provides the polite live region. No new library API was introduced.

Phase 1 has no prior execution-phase dependency. The actual prerequisite infrastructure exists: root `app/layout.tsx` mounts one `Toaster`; auth and resident layouts mount `NotificationSession`; `notify.ts` supplies four severities, per-attempt/event suppression, account cleanup, bounded ID sets (200), and 4/6/8-second durations. The host remains top-center, header-anchored, themed, closable, with three visible toasts, focus/hover handling, and dialog coexistence. This is source verification, not a fresh visual or assistive-technology pass.

`session-feedback.ts` consumes a five-minute tab-local explicit-login receipt before the name read; `NotificationSession` supplies the confirmed account; `use-sign-out.ts` issues ordinary logout under the guest session before `/login`. Header/profile menu, Settings sidebar, and complete-profile use that hook. Google identity linking (`GoogleButton link`) does not queue a welcome. Recovery and deletion have separate sign-out paths and must stay distinct. The six existing session-feedback tests passed, including once-only welcome, reload handoff, account mismatch, expiry, delayed-account suppression, and logout persistence; six sign-out tests also passed. Live Google/login/logout browser flows were not exercised.

## Initial requirement classification

| Phase 1 requirement | Before this execution | Final evidence |
|---|---|---|
| Instructions/versioned documentation | Not started for this phase | Sources above read |
| Working-tree preservation/login/logout baseline | Partially done: architecture existed; no current audit | Working tree inspected; source and existing tests checked; no application edits |
| Static/dynamic notification inventory | Partially done: starting map only | `notification-calls.tsv`, `notification-imports.tsv` |
| Reachability/entry variants | Partially done: catalog's earlier audit | Every catalog row below mapped, including dormant/blocked paths |
| Result/identity/terminal/inline/navigation owners | Not started as an execution ledger | `action-ledger.md` and retry inventory below |
| Quiet decisions | Partially done: proposed copy | Explicit source decisions below |
| Frontend/server classification and feasibility | Partially done: boundaries specified | Boundaries and limitations below |
| Replacement callers and comparison evidence | Not started | Replacement register, existing check logs, unchanged-source check |

## Verification performed

| Check | Actual result |
|---|---|
| `npm run typecheck --workspace=@barangayan/resident-web` | **Pass**, tsc exit 0; `typecheck.txt` |
| `npm run lint --workspace=@barangayan/resident-web` | **Pass with pre-existing warnings**, ESLint exit 0, zero errors. `location-verification-form.tsx:94`: missing `boundary` effect dependency; `location-verification-map.tsx:102`: unused lint directive. `lint.txt` |
| `npx vitest run --root apps/resident-web --config vitest.config.ts` in sandbox | **Environment failure before tests**, esbuild parent-directory access denied; `tests-sandbox-startup.txt` |
| Same test suite outside sandbox after inspecting startup cause | **Pre-existing test failure**, 142 passed / 1 failed, 12 files passed / 1 failed. `tests/search.test.ts:74` expects the older staff-assessed pricing label, but receives `₱10.00 per page · 30 minutes of agency processing`. `tests.txt` |
| `npm run build --workspace=@barangayan/resident-web` with `BARANGAYAN_PREVIEW_DIST_DIR=../../tmp/toast-phase1-build`, telemetry disabled | **Pass**, Next.js 16.3.0 Turbopack production build, compilation/typecheck/page generation/route output completed, exit 0. `build.txt`. No webpack fallback or deployment |
| TypeScript AST inventory over all resident-web `src` TS/TSX | 107 notification/adapter calls: 73 `notify` calls, 32 direct feature Sonner calls, 2 adapter Sonner calls (render/dismiss); 58 matching notification/feedback imports. Four dynamic call sites captured, including adapter `toast[entry.kind]`; `notification-calls.tsv` includes exact file/line/callee/arguments |
| Final source/diff/ledger checks | See `audit-validation.json`: every catalog ID appears exactly once, source-owner paths resolve, resident-web source hashes unchanged, only Phase 1 progress/status and its dated note changed in the plan |

These are baseline checks for an evidence-only phase. They were not rerun unchanged after Markdown/TSV edits because no application implementation changed. No new test, dependency, fixture, runtime loop, or notification was added. Runtime/console, camera/location, screen-reader, theme/dialog screenshots, and real external integrations remain **pending manual verification in their implementation phases**; no live flow is labelled passed here. For later browser verification, use local fixture outcomes for destructive/payment paths, open the listed entry points, activate one explicit action, inspect toast count and persistent guidance, then repeat with rejection/uncertainty, account switch, refresh/back, and automatic updates while observing console/server logs. Phase 1 needs source feasibility evidence, not execution of future toast behavior.

## Ownership and editable boundary

All source paths in the ledgers are relative to `apps/resident-web/src/` unless prefixed otherwise. An owner is an existing code location for future wiring, not a proposed new component/API. Each row records source reachability; it does not certify that a live account/service exercised the flow.

- **Editable later:** existing `'use client'` forms/components, browser hooks, `lib/notify.ts`, frontend `lib/auth/session-feedback.ts`, frontend `lib/auth/email-change.ts`, controllers/local storage, and their local result handling/tests. Preserve all existing requests, payloads, filters, counts, timings, guards and subscriptions.
- **Inspection-only:** server pages/layouts, `app/auth/callback/route.ts`, `app/auth/email-change/route.ts`, `settings/email-verification/actions.ts`, `lib/auth/settings-recovery.ts`, server Supabase/auth helpers, API/route handlers, shared package implementations, Supabase functions/migrations/configuration. Importing an existing server action from a client does not make the action editable.
- No additional request or backend capability is needed for ordinary feasible rows. Existing responses can be forwarded locally without changing business operations. Where they cannot establish an outcome, the limitations below take precedence over catalog success copy.
- Existing frontend files already span the needed owners; no new application source file or abstraction is justified by this audit. The evidence files are documentation, not application features.

## Frontend limits and discrepancies

1. **AUTH-02:** `/auth/error` is an existing server-only page, outside the auth route-group layout. Its callback always redirects to a bare static path with no per-attempt marker; it also serves identity-link failures. There is no existing client outcome owner on that page. `queueLoginNotification()` is a login-only receipt and cannot prove callback failure or identify identity linking. Under inspection-only server-page/route rules, automatic once-only callback-error delivery is blocked; retain its inline alert. Do not convert the server page, add a route/client wrapper, or reuse a static URL as an event identity.
2. **AUTH-21:** callback success redirects to the ordinary email-verification URL; failure adds only `emailChangeError=1`. The existing client receives current email/profile/pending-email state but no callback result or attempt marker, and the error flag is rendered only in the server page. Ordinary visits/reloads can have identical props. Current state alone cannot safely prove a fresh callback, completed change, or repeat attempt. Automatic success/pending/error handoff is blocked under current contracts; explicit AUTH-20 remains feasible. Do not add a confirmation fetch or edit server props/routes.
3. **AUTH-12–14:** standalone Settings recovery pages exist, but no current UI link/action was found that navigates to `/verify-otp?source=settings`; the active Settings flow is the dialog. These routes require a matching existing HttpOnly recovery intent. Treat as dormant compatibility/deep-link variants, **not browser-verified** and not permission to add an entry point. AUTH-12 success is a server-action redirect, not a returned `ok` result; a receipt at the existing client submit/destination can own navigation once proven, without catching `NEXT_REDIRECT` as an error. A direct stale page/cookie is not a success signal.
4. **AUTH-03/04:** `signUp` without error but without a session goes to the unsupported-confirmation message; `signUpSucceeded` is set only with a session, then local sign-out is awaited but its returned outcome is ignored. Registration success copy must not invent confirmed logout. The modal already exists and remains intact.
5. **Public recovery differs from Settings:** successful public password update currently stays authenticated and routes `/home`; only Settings update calls recovery sign-out. Preserve this contract; do not add public logout to achieve catalog wording. Normal `Password updated` is already covered outside AUTH-14's Settings branch.
6. **PREF-01–03:** plain `profiles.update(...).eq('id', userId)` has no returned row/count. No-error response cannot establish that a row changed. Use the plan's information fallback, “Preference applied. We couldn't confirm it was saved to your account.” Account-saved success is blocked without a forbidden query/contract change. Guest storage success is available only after making existing local storage results observable. Custom-color addition returns a mutable boolean set inside a React updater, and the form's add callback does not call `setAccent`; do not claim selection/persistence that the current action did not establish. Resolve local presentation/result bookkeeping in Phase 3 without changing database operations.
7. **READ-01–05:** individual helpers discard returned write errors; bulk checks errors. All are plain row writes with no affected-row confirmation. Surface existing returned/thrown results and suppress obsolete/session/no-op outcomes. Do not add confirmation reads or change predicates. If a resolved write with no row evidence cannot establish the required state, document that limitation instead of asserting success. `markResolvedRead` has no actual feature caller; do not add UI for it.
8. **HEALTH-01:** the client hook wraps returned RPC errors as `new Error(qErr.message)`, discarding structure, then parses returned applicant data after existing refreshes. Preserve the original failure metadata in local frontend result handling for rejection vs uncertainty; never display arbitrary error messages in a toast. Do not repeat registration to confirm. The applicant dropdown's selected household member is not sent in this RPC; notification work must not fix or imply different registration ownership.
9. **ID-04:** OCR suggestions plus warnings establish returned text, not correctness/completeness of all printed fields. Optional absent fields can legitimately be blank. Do not classify every blank optional field as OCR failure; use existing parsed suggestions/warnings conservatively and preserve manual review. Shared extraction/publish behavior is inspection-only.
10. **PAY-03/04:** normal method selection gates QR PH unless `NEXT_PUBLIC_QRPH_SETTLEMENT_READY === 'true'`. Source audit found the existing direct QR route mounts `RequestPaymentJourney(initialStep='qrph')`; the gate is in method selection, not a new global gate. Do not enable QR PH, change payment capability, or exercise chargeable flows. Existing pending/paid status is available; current setup error state collapses thrown/returned failures, so preserve error origin locally before choosing uncertainty. A paid result does not itself prove receipt-read readiness: `SuccessStep` separately reads a paid row and can be missing/error. “Your receipt is ready” must wait for that existing read, without new polling/fetches. Deduplicate across all owners by owned payment ID and keep historical paid pages quiet.
11. **EM-03:** controller discard clears only the pending fix and preserves a previously confirmed origin. Copy must describe discarding the candidate; do not clear a valid prior origin for the toast. EM-04 has more result statuses than success/no-route (ambiguous attachment, outside coverage, unavailable center, unmapped restrictions, invalid origin); retain their exact persistent guidance and never relabel them service failure.
12. **REFRESH-01:** existing client reads can retain explicit-attempt provenance locally. Server `router.refresh()` and same-route anchors expose no success/failure result promise. `ReadFailure`, `ProfileSetupNotice`, and the Valid ID server failure link cannot truthfully infer failure from transition completion, disappearance, or a timer. Keep inline guidance; mark terminal generic toast delivery blocked where no current explicit result exists. Health list/drawer error states have no current Retry control; do not add one. Informational/map pages with no explicit retry likewise grant no new-control authorization.

## Replacement register

No code/file was replaced or removed in Phase 1. Later scoped replacement candidates and actual consumers:

| Candidate | Existing caller/current owner | Required handling |
|---|---|---|
| Unmounted-only service success branch | `ResidentServiceForm.submit`; used by `document-request-modal/request-form-step.tsx` and standalone `services/requests/new/[documentId]/new-request-form.tsx` | One success owner for mounted/unmounted; remove superseded conditional notification in Phase 5, preserve callback/navigation |
| Direct Sonner branches in touched feature handlers | Announcements bulk read, delete-account, theme form, location verification, export | Migrate only touched handler outcomes to adapter; remove replaced direct import only after its remaining calls move |
| Quiet-success comments | Forgot-password send, public verify, payment-method save, locate-button success | Update only when corresponding phase wires the newly cataloged outcome; these earlier comments do not override this plan |
| Duplicate automatic announcements | Google inline `role=alert`; recovery dialog alert/description; standalone reset `role=status`; email forms `role=status`; ID error/status/aside regions; pickup status; payment dialog; location/route status cards; inline read errors | Assign scoped toast announcement ownership while preserving field associations, title/focus, persistent detail and unrelated alerts; no global semantics removal |
| Local storage swallowed results | Theme/accent/font controller setters; custom-color add/remove; `markOnboardingComplete` | Existing theme form/onboarding/reset-preference consumers remain; expose only local outcome to deliberate action, never toast from reset/hydration |
| Read helper swallowed errors | Explicit announcement/report card controls; announcements bulk button | Report result to explicit caller; keep automatic/no-caller bookkeeping quiet |

Static imports/call sites, dynamic Next imports, route entry conventions, existing tests and package consumers were inspected before identifying these candidates. None is a deletion authorization. `notifyHouseholdOutcome` remains owned by profile/family handlers; `completeCheckIn` by scanner/upload; `service-feedback.ts` classifies service/payment errors; the adapter's dynamic rendering remains shared. No broad migration of the other direct Sonner calls is in Phase 1.

## Explicit read-retry inventory (REFRESH-01)

These are actual controls found in current source. Specific catalog owners win over generic REFRESH-01; automatic reads remain quiet. No errors/empty states are converted into new controls.

| Existing client owner/control | Existing result and identity | Decision for later phase |
|---|---|---|
| `app/(resident)/announcements/announcements-feed.tsx` error/stale Try again | `useAnnouncements.refetch`, barangay/category + generation, error/ready state | Explicit retry failure only; bulk read owned by READ-01 |
| `app/(resident)/reports/my-reports-tabs.tsx` Try again | `useMyIncidents`, report-status selection and current read | Explicit list failure; tabs/sort quiet |
| `components/reports/new-report-drawer.tsx` Retry loading form | Existing guarded auth/profile/categories/zones/boundary reads, active mount and retry counter | Explicit failure; redirects and absent/inaccessible data remain accurate |
| `components/services/document-request-modal/document-request-modal.tsx` Retry loading service | `ServiceRead` ready/unavailable/error, document ID + active effect | Notify only error, never unavailable; account check is SERVICE-01 |
| `app/(resident)/services/requests/request-drawer.tsx` Retry | `DrawerRead` ready/unavailable/error, request ID + effect cancellation | Notify only failed explicit read |
| `components/services/request-payment-journey.tsx` Try again | `useScopedRead` identity/generation and error; same refetch used by 10-second/focus background updates | Explicit-only provenance required; source/pay mutations belong PAY rows |
| `components/services/document-request-modal/success-step.tsx` Retry receipt | ready/missing/error, request ID + active effect/retry counter | Error only; missing receipt is not read failure or payment rejection |
| `components/services/agency-sla-status.tsx` noncompact Retry | RPC result, request ID/retry counter/active/abort; 15-second auto refresh | First explicit read outcome only; clock ticks/polls quiet |
| `components/services/resident-service-form.tsx` approval Retry and `ResidentIdGate` retry | `useResidentEvidence.refresh`, generation/current auth + approved submission, error/profile/evidence | SERVICE-04 owns approval, no generic duplicate |
| `app/(resident)/settings/valid-id/valid-id-flow.tsx` status Try again | `useSettingsIdStatus.refresh`, owner/generation/status error | Explicit status-read failure generic; submit/upload/OCR retries owned by ID rows |
| `app/(auth)/register/register-form.tsx` Retry locality / Reload saved details | Separate effects + active flags and separate attempt counters | Explicit read failure only; validation/registration owned by AUTH/VALID rows |
| `app/(resident)/settings/profile/profile-form.tsx`, `components/emergency/family-content.tsx` Try again | Existing household hook refetch/result identity | Explicit read failure only; household write helper unchanged |
| `app/(resident)/settings/help/help-center-client.tsx` Retry | Existing help-article hook result/error | Explicit failure, local article filters quiet |
| `components/maps/directory-content.tsx`, `components/emergency/hub-content.tsx` guideline/hotline Try again | Existing hotlines/guidelines scoped reads, tenant identity + generation | Explicit failure; empty data and local directory search quiet |
| `components/emergency/alerts-content.tsx`, `scan-content.tsx`, `centers-content.tsx` Try again | Existing scoped alert/QR-content/centers reads | Explicit content failures; automatic refresh quiet |
| `components/emergency/qr-show-dialog.tsx` centers Try again | `onRetryCenters` from `scan-content` centers hook | Read failure generic, not native-share/camera outcome |
| `components/search/search-results.tsx` / `search-input.tsx` Try again / same-query submit | Existing search request identity and retry counter; top-level error vs partial groups | SEARCH-01 owns explicit failure; partial suggestions/aborts quiet |
| Registration map, recovery eligibility, household QR, scanner restart, connected route | Existing specific result signals | LOC-03, AUTH-07, EM-06, EM-07, EM-04 respectively; no generic duplicate |
| `components/shared/read-failure.tsx` Try again | `router.refresh()` transition only; callers are server home, announcement/drive/service details, catalog, activity, request list/details and payment route pages | Terminal result blocked under current frontend-only contract; preserve inline recovery |
| `components/auth/profile-setup-notice.tsx` Retry account setup | `router.refresh()` transition only | Same boundary; never interpret it as a confirmed profile write |
| `app/(resident)/settings/valid-id/page.tsx` Try again anchor | Same-route navigation; no attempt result passed to client | Same boundary; no automatic mount toast |
| Health active drives / registrations / register drawer; map informational pages | Existing loading/error states, no explicit Retry found | No new button/workflow. Initial reads/filter-driven changes quiet |

## Phase 1 acceptance

- **Met:** every catalog ID has an existing owner/result signal, explicit quiet decision, or precise frontend limitation (`action-ledger.md`; machine-checked ID coverage).
- **Met:** current source, variants, result metadata, identity/lifecycle, inline announcements, navigation, editable boundary and replacement callers recorded.
- **Met:** existing checks run and actual failures/warnings retained; application and shared toast styling unchanged.
- **Met:** no server/backend/other-platform changes and no Phase 2–8 implementation.
- **Pending manual verification, later phases:** runtime behavior of future notifications, browser console/network counts, screen-reader duplicate-announcement handling, visual host behavior, real external outcomes. These are not claimed as Phase 1 behavior passes.

Future implementation limitations do not block completion of the Phase 1 audit: its exit explicitly permits precise frontend-boundary findings. They do block claiming all catalog notifications or production readiness complete. No user input is needed to finish this selected phase.
