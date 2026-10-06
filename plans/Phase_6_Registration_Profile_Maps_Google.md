# Phase 6 — Registration, profile, maps and Google

Verdict: **partially complete**. Phase 6 code and local verification are delivered. The user reports Google signup working, but real Google provider and installed Android development/signed-release checks were not verified by this agent. The exact exit gate remains open; those checks are not claimed as passed.

## Current status and evidence — 2026-10-06

New Google residents must immediately have a minimal `profiles` row linked to their Auth user, with available names/email and server-assigned resident role/tenant. Remaining details may be deferred while browsing; document requests, health registrations and report submissions require completion. Completion and administrator ID verification remain separate. Existing saved profiles must remain unchanged, including during repeated sign-ins and concurrent retries.

The user separately authorized applying repository migration **0104** to the hosted Barangayan project (`pwjbucnyqexiepoinoke`) after the missing-RPC error. The migration succeeded. Expected profile-repair failures on public web navigation now produce **Retry account setup**, preserve the authenticated browsing session, and expose an accurate pending state. Successful retry restores the saved profile view; protected action guards remain enforced. These web recovery changes are local and have not been deployed to Vercel.

| Acceptance condition | Current evidence / remaining verification |
|---|---|
| Minimal Google profile provisioning, safe retry permissions and preservation | **Verified locally and installed on the hosted project.** Hosted RPC/private operation/identity trigger and authenticated-only entry point verified; all **18 existing profiles** retained the same contents. Anonymous Data API execution returned **401 / 42501**. No production test users were created. See [hosted checks](evidence/web-auth-errors-2026-10-04/hosted-verification.json) and [anonymous request](evidence/web-auth-errors-2026-10-04/hosted-anonymous-api.json). Actual Google new-user provisioning still requires a normal provider sign-in. |
| Public browsing during setup failure, accurate pending state, retry recovery and completion gate | **11 SSR/browser recovery assertions passed**, using actual Next/SDK code with synthetic loopback Auth/API transport. Retry clears the notice, saved names prefill completion, report completion retains its safe destination, theme/accent/font apply, and no React script/hydration/runtime errors were observed. See [browser results](evidence/web-auth-errors-2026-10-04/browser.json). This transport fixture does not prove Google consent or database authorization. |
| Shared contracts and affected consumers | Latest **197 shared tests**, shared/resident-web/Android typechecks and resident-web production build passed. Resident-web lint passed with two warnings in unchanged location-verification files. **9 Android callback unit checks passed** with isolated doubles. See [error-fix report](Web_Auth_Error_Fix_2026_10_04.md); earlier Android export and full SQL/API/history checks below remain supporting evidence, not rerun results for this follow-up. |
| Concurrency, tenant boundaries, incomplete fields and separate ID approval | Earlier minimal-profile implementation passed **396 SQL regression assertions**, the expanded **42-case** focused SQL suite, **34 actual local Auth/REST/RPC checks**, and **11 local browser/database checks**. Empty/historical migration replay through 0104 passed. These suites are listed separately below and must not be added together as one test count. |
| Hosted security/performance findings | Advisors returned warnings involving existing functions, indexes and policies; no finding named the new Google profile functions. This is not a clean advisor verdict, and no pre-change hosted advisor baseline establishes whether every notice was pre-existing. Details and remediation links are in the error-fix report. |
| Real provider and installed Android exit gate | **Open.** Real Google consent, new/repeat-account persistence, identity linking, development/signed-release callbacks, failure and restart behavior remain unverified by this agent. The user's report of working Google signup is retained as a report, not an agent-run check. |

The connector originally recorded migration-history version **20261004082819**, name **0104_google_minimal_resident_profiles**. An earlier automatic approval rejection left that discrepancy unresolved. On **2026-10-06**, the user explicitly authorized its repair. The stored migration SQL and all six installed function bodies matched repository 0104. A guarded transaction changed only that entry's version to **0104**, preserving its SQL and other metadata. All unrelated history, the 19 current profile rows, function definitions/permissions and identity trigger remained identical. The CLI migration list now aligns through 0104; a push dry run with vault updates skipped passed and listed only 0105/0106 as pending. No migration SQL was replayed and no application release occurred. See [repair evidence](evidence/migration-history-repair-2026-10-06.json). Preserve repository numbering and the staged Phase 7 release order.

## Minimal Google profile fix — 2026-10-04

The current status above includes the subsequent hosted migration and web recovery fix. The evidence in this section records the initial minimal-profile implementation before that follow-up; earlier test counts and no-hosted-change statements describe their original verification scope. Real Google and installed Android release verification remain open.

The user subsequently reported Google signup working but skipped-completion accounts missing from `profiles`. This revision implements immediate minimal persistence and supersedes earlier statements that skip leaves no profile row. The hosted provider success is user-reported; these checks used isolated local Auth and synthetic Google identities rather than Google consent.

**Verified cause:** the existing `auth.users` signup trigger runs only when `raw_user_meta_data` contains `barangay_id` (0095), while the Google callback previously saved no profile until completion. The isolated baseline reproduced a Google identity with zero profile rows (`google-minimal-database/missing-profile-baseline.log`, transaction rolled back). `profiles.id` already uniquely references the Auth user, its tenant and `full_name` are required, and demographic/name/email fields permit incomplete values. Existing RLS and 0103 submission guards were inspected and retained.

Migration **0104_google_minimal_resident_profiles.sql** adds an AFTER INSERT trigger on Auth-managed Google identities. It derives the user ID and email from Auth, names from the actual Google identity, resident role and tenant from the sole enabled registration locality. City/province come from that existing tenant configuration; no personal address, birth date, contact number, coordinates or ID evidence is fabricated. Names are editable suggestions, using structured fields first and display-name fallback; mononyms retain a missing surname. If no name is supplied, `full_name` uses an empty string to satisfy the existing NOT NULL schema while first/last names remain NULL. It does not mark completion or approve ID evidence.

The no-argument authenticated `ensure_google_resident_profile()` RPC repairs earlier missing rows on web/native callbacks and session startup. Auth-managed identity is checked in the database; editable provider claims, anonymous callers and caller-supplied identity/tenant/role payloads cannot provision an account. An advisory transaction lock shared with completion and the existing primary key prevent duplicate rows and overwrites during concurrent retries/completion. Existing profiles are returned unchanged; deleted profiles are rejected. Missing/ambiguous registration configuration fails explicitly. Google metadata cannot inject signup GPS into bootstrap or completion, while the existing coordinate/locality protections remain enforced for password signup and explicit location operations.

| Requirement / gate | Implementation and observed evidence |
|---|---|
| Immediate minimal Auth-linked row; available names/email; missing details remain incomplete | Auth identity trigger and shared helper. New SQL suite **42 assertions passed**, covering name variants, no invented fields, immediate visibility and independent completion/ID state (`google-minimal-database/focused-tests.json`, `google_minimal_profiles.test.sql.log`). |
| Browsing and document/health/report restrictions; tenant and authorization boundaries | Existing policies/0103 write guards retained. **11 SQL suites / 396 assertions passed** before adding three additional health-RPC checks; the expanded 42-case suite then passed. Actual Auth/REST/RPC suite **34 checks passed**, including all three denied submissions, correct health RPC after completion, foreign-account/anonymous/forged metadata denial (`google-minimal-database/tests.json`, `google-minimal-http/results.json`). |
| Existing saved fields and historical data retained | Seven local tables, including **22 profiles**, retained all original rows/values. Final complete migration sequence through 0104 passed on an empty database and representative historical database, with field-by-field reconciliation (`google-minimal-database/reconciliation.json`; empty replay in `google-minimal-replay/results.json`; successful historical replay in `google-minimal-history-authenticated/results.json`, `before.json`, `after.json`). Native Postgres lacks pg_cron; that regression passed on the full Docker stack. |
| Repeated sign-ins, retries and concurrent callback/completion | Actual API test raced eight provisioning retries against completion and produced exactly one row with completed values intact. **9 Android callback unit checks passed** using the real module/shared helper and isolated Auth/browser/storage doubles, including consumed-code retry, concurrency, session-read failure, expiry and cancellation (`google-minimal-native-unit/results.json`). Installed-device behavior remains manual. |
| Web startup repair, skip/session retention and name prefill | **11 browser/database checks passed**, repairing a missing row, displaying saved names, gating the report route, prefilling completion, retaining the row/session on skip and reload, and observing no browser errors (`google-minimal-browser/results.json`, screenshots). Browser login used an actual local Auth session with a synthetic linked identity, not real Google consent. |
| Shared contracts and consumer compilation | Baseline **188 shared tests**, shared/web/Android types and both app lints passed (`google-minimal-baseline/results.json`). Final **196 shared tests**, same types/lint, resident-web production build and Android Hermes export passed (`google-minimal-final/results.json`, `google-minimal-web-build.log`, `google-minimal-platform/results.json`). Final generated web type cleanup is recorded in `google-minimal-final-types.log`. |
| Security advisors | Local database advisors exited 0, with seven search-path warnings in untouched legacy public functions and no errors/new-function warnings (`google-minimal-database/advisors.json`). This is not a clean-warning verdict or a hosted advisor check. |
| Hosted and installed-platform exit gate | At the initial implementation checkpoint, hosted migration/provider and installed-platform checks were unverified. **Subsequently, the authorized hosted 0104 installation and permissions/data checks passed**, as recorded above. Real Google consent/new-account/repeat-account/linking and installed Android development/release/restart checks remain unverified. No app deployment was performed. |

Failures remain recorded rather than counted as passes: the initial SQL prototype imported malformed Google GPS during completion and failed three assertions; its targeted guard correction passed regressions and full replay. Early API fixtures omitted Auth identity timestamps, then used a direct health INSERT where the established operation requires `register_for_drive`; corrected fixtures use the actual Auth schema and RPC and retain bypass-denial checks. Browser failures were stale text locators, corrected against the inspected UI. The native unit harness initially compared objects from different VM realms; property assertions now verify the same payload. Historical replay initially reused cluster-role bootstrap statements across databases; per-database role inspection fixed that test infrastructure. Local connections were initially sandbox-denied, then a password prompt timed out; approved loopback access and explicit test-only credentials with noninteractive clients completed replay. Earlier unrelated root-lint and iOS dependency failures remain recorded below and were not rerun for this focused change.

Task-created API fixtures were removed (`google-minimal-http/cleanup.json`); the task preview and disposable native PostgreSQL cluster were stopped. The pre-existing Supabase container stack was retained.

### Apply and manually verify this fix

1. Before an authorized release to another environment, back up your intended test/staging database and confirm its applied migration history and installed objects. Apply only missing repository migrations in ascending order, including **0102**, **0103**, then **0104**. The hosted Barangayan project already has 0104 installed under the connector history version documented above; do not replay it because of that version mismatch. Do not renumber migrations or execute only fragments of 0104. Tracking reconciliation requires the separately requested authorization.
2. Confirm exactly one row in `public.barangay_localities` has `resident_registration_enabled = true`, with the intended tenant and existing city/province configuration. Zero or multiple enabled rows deliberately prevent new minimal-profile provisioning. Preserve existing tenant records; do not guess a barangay UUID. The new trigger/function installation requires the normal privileged migration connection, not a public client key.
3. Release the updated shared package/resident web and rebuild/install the Android app against that same Supabase project. No new Google Console credential, scope or redirect is required by this fix; retain the already configured browser OAuth provider setup below. Keep the client secret/service-role key out of public web/mobile variables.
4. Sign up with a new Google account and choose Skip. In Supabase, confirm `profiles.id` equals its Auth Users UUID, available names/email are saved, tenant/role are correct, and resident details, `profile_completed_at` and approved ID reference remain incomplete/unapproved. Reload or restart and repeat sign-in: exactly one row should remain.
5. Open an older Google account that has no profile in the updated app, or sign out/in. Session startup repairs its missing row. Existing complete/saved profiles must remain unchanged. No bulk backfill or invented details is required.
6. Verify public browsing and each document/health/report completion gate, then complete the required fields and confirm the intended service resumes. Verify administrator ID approval is still separate. In an isolated test environment, verify a setup outage preserves public web browsing with an accurate retry notice, disables Retry while pending, and clears the notice after recovery without a rendering failure. Test network failure/retry, simultaneous callbacks, account changes and Android development/signed-release warm/cold starts before closing the Phase 6 exit gate. Never remove production RPCs or triggers to create a failure fixture.

Grounding: inspected [Supabase Auth 2.197.0 OAuth implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/api/external.go) inserts the Google identity after the Auth user and before returning the OAuth session; [Supabase user-data guidance](https://supabase.com/docs/guides/auth/managing-user-data) describes Auth-linked profiles and warns that failing triggers can block signup. Exact Expo 57 documentation and installed Next 16.3.0 authentication documentation were read before consumer changes.

## Historical deferred-completion decision — 2026-10-04

The user explicitly chose deferred completion. This superseded the original mandatory-at-sign-in behavior and its earlier UI evidence below. Migration **0103** follows **0102**; no existing migration was renumbered. The current minimal-profile and recovery sections above are authoritative for the later persistence and hosted-status changes.

- Google signup/login keeps the authenticated session and permits Home, announcements, maps, document guidance, health information and other public browsing without inventing resident details. The later minimal-profile fix above supersedes the earlier decision to delay creation of the profile row.
- Home and Settings expose profile completion. Completion is password-free and has **Skip for now**, which returns to browsing without logout.
- Document request, health registration and report submission require the existing required resident fields. Web route guards and Android action gates handle direct links; a database trigger rejects bypasses through direct REST/RPC calls. Unknown profile state blocks these actions while public browsing remains available.
- Completing required fields returns to a validated internal destination. Existing complete users proceed directly. Administrator ID verification remains independently required for the services that already require approved ID evidence.
- Migration 0103 adds only read policies for profile-less authenticated users in the sole enabled registration tenant and submission guards. Existing incomplete profiles use their existing tenant policies. Foreign/deleted data and ambiguous configuration remain blocked. No historical data is rewritten.

Revised verification results are recorded below. Original evidence remains historical and must not be used to claim the revised exit gate is complete. Real Google provider and signed native build tests remain unverified.

## Historical deferred-completion verification evidence

All evidence paths below are under `plans/evidence/phase6/`. These checks describe the deferred-completion revision before minimal-profile persistence and the hosted follow-up. They used synthetic accounts and isolated local databases, not the hosted production project.

| Revised requirement / check | Observed result |
|---|---|
| Baseline and preservation | Before this revision, 163 shared tests, shared/web/Android types and application lint passed (`flexible-baseline/results.json`). Existing unrelated edits were preserved. |
| Action classification and safe completion destinations | **177 shared tests passed**, including public routes versus gated action routes and unsafe return rejection (`flexible-final/shared-tests.log`). |
| Types and lint | Shared, resident-web and Android types passed; resident-web and Android lint passed (`flexible-final/results.json`). Final modal edit passed web types/lint (`flexible-modal-final/results.json`). Admin types passed after generated-cache correction (`flexible-final/admin-full-regenerated-types.log`). |
| Production compilation | Resident-web production build passed (`flexible-web-build.log`); Android Hermes export passed (`flexible-platform/results.json`). Native export does not prove installed development/release behavior. |
| Database enforcement and tenant boundaries | **10 SQL suites / 357 assertions passed** on the isolated Supabase Docker stack (`flexible-local/tests.json`), including 18 new deferred-completion checks. Missing and partial profiles can browse; all three submission bypasses are denied; foreign/deleted records and ambiguous locality remain blocked; completing a profile does not approve ID evidence. |
| Actual Auth/REST/RPC operations | **40 assertions passed** (`http-flexible/results.json`), including public guidance, pre-completion document/report/health denial, concurrent completion, forged identity/tenant rejection, successful health/report operations after completion, and separate ID approval. PKCE URL construction is verified; real Google success is not simulated. |
| Migrations and historical compatibility | Migration 0103 preserved rows and original values in the local container (`flexible-local/reconciliation.json`). Final full sequence through 0103 replayed in disposable empty and representative-history databases (`flexible-portable-final/results.json`, `before.json`, `after.json`). Native Postgres lacks pg_cron; that regression passed on the Docker stack. |
| Incomplete-account web browsing and skip | Actual synthetic-account login reached Home with a completion reminder (`flexible-home.png`). Report completion offered Skip for now; skipping returned to Home and retained Log out and announcements. Document catalog/details remained readable. |
| Direct links and document modal | Incomplete-account report and health registration links redirected to completion with their internal destinations retained. Request This Document in the public modal did the same (`flexible-report-gate.png`, `flexible-document-gate.png`). |
| Completion and existing complete-account behavior | Required-field completion returned to `/reports/new` and displayed its form (`flexible-completed-report.png`). Visiting login afterward went directly to Home without a completion reminder (`flexible-complete-home.png`). Checked browser error list was empty. Date entry used native DOM setter/events; date-picker interaction remains manual. |
| Google/native development and signed-release exit gate | **Unverified**. Real provider consent/callback/linking and revised native browsing/skip/action gates need the user's configured environment and installed builds. Original Expo Go map evidence does not verify the revised native authentication journey. |

Earlier successful-submission SQL fixtures intentionally omitted required demographic fields. The new guard correctly rejected those fixtures; their synthetic resident personas now contain valid completed details. Assertions and authorization checks were retained. The initial fixture failure is preserved in `flexible-local/agency_sla.incomplete-fixture-failure.log`.

Final review reproduced a tab-only required address passing the new database guard (`flexible-local/whitespace-bypass-failure.log`). The final unpublished migration trims whitespace before checking required names and addresses; the new regression and all SQL suites passed afterward. Final migration replay and historical reconciliation also passed. Disposable databases were removed (`flexible-cleanup.log`); the task browser/preview were closed and the pre-existing Supabase stack was retained.

The additional admin check initially failed because `.next/dev/types/routes.d.ts` contained a malformed trailing fragment. Regenerating the build types alone left a stale dev validator referring to the removed fragment. The complete stale dev-types directory and corrupt fragment were preserved in `flexible-final/`, then Next generated valid route types and the unchanged admin source passed. This is an observed generated-artifact failure, not a proven pre-existing source failure. A sandboxed portable-database connection was denied; the same verified loopback fixture was accessible with approved elevation (`flexible-portable/database.log`, `flexible-portable-elevated/results.json`).

The deferred-completion implementation and local web/database gate checks passed. **Phase 6 remains partially complete** because real Google and Android development/signed-release journeys, failures and restart checks remain unverified. Earlier unrelated root-lint and iOS dependency failures below remain recorded; they were not rerun for this revision. During this earlier revision, no hosted migration, deployment or production data modification was performed; the later authorized hosted 0104 application is recorded in the current status above.

## Acceptance checklist

Historical Google name prefill update: web and Android completion forms share a name helper.
It uses structured given/family names first, then editable suggestions from
`full_name` or `name`, preserving nonblank saved names and names already typed
while the form loads. A display name alone has no guaranteed first/last structure;
the resident confirms the suggestion. Email addresses are not parsed into names,
and missing details remain blank. At that checkpoint, names were persisted only
when completion was submitted and skipping left no profile row; this behavior
was superseded by migration 0104's immediate minimal-profile persistence.

The preceding name-prefill evidence describes the earlier implementation. The minimal-profile fix above now persists available names/email immediately; skipping still does not complete resident details or approve ID verification.

All **188 shared tests passed**, including 11 name-prefill cases covering structured,
full, multiword, partial, missing and malformed metadata, saved names and whitespace
(`google-name-prefill/shared-tests.log`). Shared/web/Android types and web/Android
lint passed (`google-name-prefill/results.json`). Resident-web production build
passed (`google-name-prefill-web-build.log`); Android export passed
(`google-name-prefill-platform/results.json`). These tests verify name mapping and
consumer compilation, not real Google metadata delivery or provider success. No
new migration or manual provider setup is required for this prefill update.
Final web types passed after removing only the task build's generated preview
includes and regenerating default route types (`google-name-prefill-final-types.log`).
Name fields are optional provider claims; source:
[Google OpenID Connect claims](https://developers.google.com/identity/openid-connect/openid-connect).

Google button visual update: both platforms use the official locally bundled
multicolor G asset, Google Sans Medium (5 KB English-label subset, bundled with
its license), white outlined pill, centered label, and a stable loading indicator.
Login says **Sign in with Google** and registration says **Sign up with Google**.
Web registration keeps Google below Create Account; login adds space between the
password and Google buttons. OAuth/linking handlers and completion rules are unchanged.

Web and Android types/lint passed (`evidence/phase6/google-design-types/results.json`),
final web spacing lint passed, resident-web production build passed
(`google-design-web-verified-build.log`), and Android export passed
(`google-design-export/results.json`). Final web types passed after restoring
build-generated preview entries (`google-design-final-types.log`). Desktop login/signup
and 390px web signup were inspected; the logo loaded and the narrow layout had no
horizontal overflow. Actual Expo Go login rendered the logo and accessible button
label (`google-design-native-login.png`, `.xml`); native signup likewise rendered
its branded button (`google-design-native-signup.png`, `.xml`). The native preview
reported unavailable registration locality/boundary, so no signup submission was
tested in this visual check. This is UI verification, not proof
of Google provider success or the native custom callback. The preview initially
failed to download before Metro was ready; the ready preview subsequently loaded.
Automatic approval review briefly could not run due to an account usage limit;
checks resumed after the user requested continuation.

The final web preview exposed a Next image-sizing warning: Google's supplied PNG
is 200×204 rather than square. The image now declares those intrinsic dimensions
and displays at 18px width with automatic height. A new browser session rendered
it without that warning. The final visual-only preview used an explicit synthetic
key and loopback URL because the local test stack had become unavailable; no
authentication attempt was made. Google provider verification remains manual.

| Assigned requirement / exit-gate scenario | Implementation | Verification / evidence |
|---|---|---|
| Fixed registration address from configuration | Shared `registrationLocality`, both registration forms, existing Phase 2 locality triggers | New SQL signup tests and actual Auth/REST signup; web read-only City/Province controls |
| Profile Province and protected City/Barangay | Existing Phase 2 profile controls retained; profile completion reuses fixed locality | SQL locality tampering tests; earlier locality regression suite |
| Advisory registration map, boundary/legend/controls | Existing Leaflet/Android WebView maps, advisory option; separate GPS and confirmed home state | Shared polygon tests; SQL classification tests; browser/native checks below |
| Denied GPS, timeout, boundary/network failure and recovery | Permission messages, bounded GPS requests, map retry and locality retry; optional location | Browser/native presentation checks; server null-boundary case |
| Protected Settings picker | Default constrained map mode retained, GPS/save guards added, server coordinate and boundary enforcement | SQL edges/holes/outside cases; actual REST outside bypass denied |
| Google registration/login buttons | Supabase `signInWithOAuth`, existing clients; PKCE on Android and web | Actual provider URL construction; real Google journey is manual |
| Web callback and cookie session | `/auth/callback`, code exchange with server cookie client, safe internal return path, no-store response | Shared redirect tests, failed callback checks, production build; successful Google cookie exchange is manual |
| Android browser callback, warm/cold start, replay/expiry/cancel | `barangayan://auth/callback`, persistent PKCE verifier/start time, serialized exchange, dedicated unguarded callback route | Callback parser tests, expired Auth exchange; real device browser warm/cold/cancel is manual |
| Immediate minimal profile and idempotent repair | 0104 Auth identity trigger, no-argument authenticated RPC, server tenant/role assignment and shared provisioning/completion lock | Minimal-profile SQL/API/browser and hosted installation/preservation evidence above; actual hosted Google provisioning remains manual |
| Public web setup-outage recovery | Typed safe error, explicit pending status and Retry account setup with loading feedback; protected guards retained | 11 SSR/browser recovery assertions above; released Vercel behavior remains manual |
| Deferred completion without password | Authenticated public browsing, Home/Settings completion entry, skip action, safe intended-service return; UI and server submission gates | Deferred-completion and minimal-profile SQL/API/browser evidence above; real Google/native release remains manual |
| Existing user preservation/linking | Supabase automatic verified-email linking; explicit `linkIdentity` buttons on Profile; no profile/ID replacement on OAuth | Historical reconciliation; real Google identity linking is manual |
| Environment instructions | Setup procedure below | User will configure and run provider/build checks |

## Grounding and prerequisite findings

Read the entire unified plan and root/application instructions before editing. Installed versions inspected: Next.js 16.3.0, Expo 57.0.10, React Native 0.86.2. Read installed Next authentication, cookies and route-handler documentation, and exact SDK 57 reference/WebBrowser/Linking/Location docs.

The repository already contained migrations 0095–0101 and extensive uncommitted earlier-phase implementation. These were preserved. Phase 6 adds migration `0102_phase6_registration_maps_auth.sql`; no pushed migration was renumbered. The existing completion RPC derives authenticated identity and tenant, serializes duplicate completion and leaves approved IDs/history intact. Phase 6 extends it with a transactionally recorded optional GPS/home payload.

Actual prerequisite schema was inspected on the isolated WSL Supabase container: the current catalog supports `general` services, existing foundational operations are installed, and pg_cron exists. Its migration-history table records only through 0099 even though the actual catalog includes later follow-ups; this local history discrepancy is not a claim of production migration state. Full repository migration replay proves order independently.

## Original implementation evidence (before the deferred-completion decision)

Evidence paths are relative to this plan directory. Failed attempts remain recorded and are not counted as passes.

| Check | Actual result / evidence |
|---|---|
| Before-change baseline | Shared tests (142), shared/web/Android types, web/Android lint passed: `evidence/phase6/baseline/results.json`. Existing uncommitted changes were recorded and preserved. |
| Final shared tests | **163 passed**, including strict completion, safe redirects, callback validation, polygon edges/holes, and Auth timeout/cancellation: `source-final/shared-tests.log`. |
| Types and application lint | Shared, resident-web, Android types and web/Android lint passed: `source-final/results.json`. Admin types/build passed: `final-checks/results.json`; admin lint passed: `platform-final/results.json`. Final changed web auth/map files passed focused lint: `web-final-focused-lint.log`. All these paths are under `evidence/phase6/`. |
| Production compilation | Final resident-web build passed with fresh `.next-phase6-release` output: `web-fresh-final-build.log`. Final Android Hermes export passed: `platform-final/android-export.log`. Export does not prove an installed development/release binary. |
| Migration compatibility | Entire migration sequence through 0102 replayed on disposable loopback `phase6_empty` and representative `phase6_existing`; original values immediately before 0102 reconciled exactly: `portable-regression/results.json`, `before.json`, `after.json`. |
| Actual container database | Inspected synthetic WSL Supabase stack; 0102 preserved original rows/values: `local/reconciliation.json`. All **9 SQL suites / 339 assertions passed**, including 23 Phase 6 checks and earlier RLS/locality/ID/catalog/charter/SLA checks: `local/tests.json`. Portable native Postgres lacks pg_cron, so the SLA suite ran on the actual Linux Supabase container. |
| Real APIs | **31 actual local Auth/REST assertions passed**: `http/results.json`. Password signup/login/logout/wrong password, metadata-free completion, concurrency, identity/tenant injection, cross-account writes, Settings bypass, ID separation, expired-code rejection and actual Google PKCE S256 URL construction. Synthetic metadata-free identities are not Google logins. |
| Web UI | Password signup succeeded (`web-signup-success.png`). Incomplete-account password login reached prefilled mandatory completion without password (`web-completion.png`); submission reached resident home, and fresh page navigation retained its cookie session and displayed Ampid 1 (`web-completed-home.png`). Date input used native DOM setter/events because automated date fill did not change it; native date-picker interaction remains manual. |
| Web failure/map UI | Outside home pin selected and confirmed; denied GPS displayed recovery while registration stayed advisory (`web-map-confirmed.png`). Provider-cancellation callback with an external `next` stayed on the internal error page, including with an existing authenticated session (`web-callback-error.png`). Checked final pages had an empty browser error list. |
| Android UI | Expo Go emulator displayed fixed locality, Google button, map outline/fill and controls (`native-address.xml`, `native-map.png`, `native-map-controls.xml`). Home selection and confirmation displayed inside/confirmed (`native-confirmed.xml`). Expo Go cannot prove the custom callback scheme. |
| iOS compatibility | 8 existing tests passed. Types failed for missing installed `expo-crypto` and `expo-secure-store`, matching Phase 0 evidence (`evidence/phase0/initial/ios-types.log`); current reproduction: `evidence/phase6/platform-final/ios-types.log`. No iOS source/dependency changes made. |
| Root lint | Failed: 93,345 errors / 32,954 warnings. Scans unrelated `.kilo` worktrees/generated outputs and cannot resolve platform aliases/Deno imports. Same failure categories recorded in Phase 0; totals differ as outputs change. Full current log: `platform-final/root-lint.log.gz`. No lint rules weakened. |

Existing-output web builds failed with a Turbopack CSS worker exiting before connection, both sandboxed and elevated. After two attempts, a fresh task-specific output passed. An output/environment issue is an inference; the precise cause and pre-existing status are unproven. An early introduced misplaced client directive was corrected before the passing build. Windows-to-WSL loopback refused local Auth connections; the inspected private WSL address passed. Android preview initially listened only on IPv6 loopback; correcting the listener and using task-only ADB reverse loaded the UI.

The original exit gate was: “Password and Google flows work on web and Android development/release builds, including failures, restart, and incomplete profiles.”

| Exit-gate component | Supported verdict |
|---|---|
| Web password signup/login, wrong-password failure, incomplete-profile completion and cookie persistence on fresh navigation | **Passed locally**; full browser process restart remains manual. |
| Web Google failure callback, safe redirects, completion API and PKCE construction | **Passed locally**; real provider success/cookie exchange remains **unverified**. |
| Android registration UI/map and compilation | **Passed locally**; development/release authentication is **unverified**. |
| Android development password/Google flows, warm/cold callback, failures/restart/completion | **Unverified**; no configured provider/native development binary supplied. |
| Signed Android release password/Google flows and all failure/restart/completion cases | **Unverified**; no signed test APK supplied. |
| Existing-user Google linking with unchanged identity/history | Supported linking APIs implemented; migration reconciliation passed; actual linking **unverified**. |

Database/container tests prove server enforcement and compatibility on synthetic local resources. They do not prove hosted Google settings, consent, actual linking, certified boundary provenance, real GPS, custom-scheme callbacks, or signed release behavior. The user explicitly elected to perform provider/build testing; do not mark the phase or release gate complete without that evidence. During the original implementation checkpoint, no deployment, publication, hosted migration or production-data modification was performed. Task browser/previews and emulator forwarding were closed; the two disposable Phase 6 databases were removed from the verified loopback server (`evidence/phase6/cleanup.log`). The pre-existing Supabase stack was retained. The subsequent hosted 0104 application is documented above.

## Manual Google setup — do this before your real sign-in tests

Use a separate test/staging Supabase project first. Do not run test resets, fixtures or synthetic-user scripts against production.

1. In Google Cloud Console, create/select the project that will own Barangayan authentication. Open Google Auth Platform and configure Branding: application name, support email and developer contact. Supply your owned website/homepage, privacy policy and terms URLs as required for publication, and verify any required authorized domains.
2. Configure Audience. Choose the audience appropriate to your application. While testing an External application, leave it in Testing and add the Google accounts you will use as test users. Before public release, satisfy Google's production branding/audience/verification requirements shown in that project.
3. Configure Data Access for sign-in only: `openid`, email and profile scopes. No Drive, Gmail or other Google API permissions are required by this implementation.
4. Create an OAuth client with application type **Web application**. Use this same Web client for web and browser-based Android OAuth. Add each resident-web origin under Authorized JavaScript origins, e.g. your actual local origin `http://localhost:3000`, your staging HTTPS origin and production HTTPS origin. Origins contain no path. If you use a different local host/port, register that exact origin.
5. In Supabase's Google provider settings, copy the exact provider callback URL. Add that URL to Google's Authorized redirect URIs. For a normal hosted project it has the form `https://<project-ref>.supabase.co/auth/v1/callback`. The Google redirect is the **Supabase provider callback**, not the app's `/auth/callback` or the Android scheme. Custom domains/self-hosted deployments must use the exact URL Supabase supplies.
6. Copy the Google client ID and client secret into Supabase's Google provider settings, enable Google, and save. The secret belongs only in Supabase/provider configuration; never put it in a `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variable or commit it.
7. In Supabase Auth URL configuration, set Site URL to the appropriate resident-web URL for that environment. Add exact application redirect entries: `http://localhost:3000/auth/callback` for your actual local origin, `https://<staging-host>/auth/callback`, `https://<production-host>/auth/callback`, and `barangayan://auth/callback`. Add a `127.0.0.1` or other local-port callback only if you actually use it. Keep allowlists environment-specific. The web callback may append a safe `next` query; verify the saved allowlist accepts the callback emitted by your environment.
8. To use **Link Google to this account** for a signed-in existing user with a different Google email, enable Supabase manual identity linking in that environment. Repository local configuration now has `auth.enable_manual_linking = true`; a local Auth service must restart to read configuration changes. Existing verified-email identities also use Supabase's supported automatic linking. Never manually copy profile rows or assign a second user ID to merge accounts. If Supabase reports a conflicting identity, keep the original account and resolve the conflict through its supported account flow.
9. Configure resident web in `apps/resident-web/.env.local` with that environment's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Configure Android in `apps/resident-android-mobile/.env` with matching `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; its existing `.env.example` documents these. Public/publishable/anon credentials are client credentials; never substitute the service-role key. Restart Next/Expo after changing environment values. A mobile build embeds these public values, so rebuild it for the intended environment.
10. For an environment that lacks the changes, apply only missing repository migrations in their existing sequence through **0104**, first to test/staging during an authorized release. Inspect installed objects and migration history first. The hosted Barangayan project already has 0104 installed and its history aligned to repository version 0104 by the separately authorized 2026-10-06 repair; do not replay it. Only 0105/0106 remain pending in the verified hosted migration list, and their staged Phase 7 release is separate. Confirm exactly one locality is enabled for resident registration and Ampid 1 has its configured display name, San Mateo city and Rizal province. Keep boundary provenance; obtain barangay confirmation before calling the trace officially certified.
11. The existing immediate password-signup flow expects **Confirm email disabled** in Supabase. If it is enabled, signup reports that email confirmation is required; Phase 6 does not implement an email-confirmation callback journey. Keep this setting consistent with the current password flow while testing. Google users may defer resident fields while browsing, but must complete them before the protected actions. Administrator ID verification remains independently required where applicable.
12. Test web at the registered origin. New Google users should reach the resident home and be allowed to browse general information. They may open **Complete your resident profile** from Home or Settings, with available Google name/email prefilled and no password fields, or choose **Skip for now**. Before a document request, health registration or report submission, require completion and then return to the safe intended service. Confirm completion uses the same authenticated user ID. Existing complete users should return to their resident journey, with historical requests and ID approval preserved.

## Android build and callback setup

The repository already declares `expo.scheme = "barangayan"`. It currently does not declare an Android application package or EAS profiles; choose your own stable application ID and signing configuration rather than using an invented identifier.

1. In `apps/resident-android-mobile/app.json`, set `expo.android.package` to the Android package you own/use. Retain the `barangayan` scheme. Ensure the test Android browser and Google account are available.
2. Install/configure the Android Studio SDK/toolchain for local builds. From `apps/resident-android-mobile`, use `npx expo run:android` (add `--device` for a USB device). Expo generates native directories if absent and builds the app. A native development build can be used without adding `expo-dev-client`; start Metro with `npx expo start --dev-client` to target that build. If you prefer the Expo development-client launcher, install `expo-dev-client` with `npx expo install expo-dev-client` and rebuild. It is not required by the Google API code added here.
3. Use a native development build for the custom callback. **Expo Go is insufficient to verify the `barangayan://auth/callback` scheme.** Metro/export success alone is not callback proof. Rebuild after changing package, scheme or native configuration. Do not use a clean prebuild over hand-maintained native changes without preserving them.
4. For a signed release test, configure your own EAS project/signing credentials and an Android APK profile (`android.buildType = "apk"`) following Expo's APK guide, or your existing native signing workflow. Build/install that signed APK for the intended Supabase environment. A production AAB is intended for store delivery and cannot be installed directly like an APK. No cloud build, upload or publication was performed by this task.
5. With the installed native binary, open `barangayan://auth/callback?error=access_denied` using an Android deep-link launcher/ADB. It should resolve to Barangayan and show a recoverable sign-in message. This checks scheme registration only; then perform the real Google browser flow.
6. Check both warm and cold app returns. Begin Google sign-in, background/terminate the app while the browser is open, then finish consent. PKCE/start state persists in app storage; callbacks older than ten minutes require starting again. The same device/install must finish the flow. A duplicate/replayed code must not create another profile or session.
7. Test consent cancellation, repeated taps, provider failure, offline start/exchange, a missing/expired code, relaunch/session persistence, and logout/account switching. Then repeat on the signed release APK. Verify Google sign-in does not display “Valid ID Verified” until an administrator reviews the ID.

Native Android OAuth credentials and SHA signing fingerprints are not required by this **Web OAuth client/browser** approach. They would be a separate setup if native Google sign-in is adopted later.

## Manual exit-gate checklist

- [ ] Real Google new-user signup on web, public browsing/skip, submission-only completion gates, safe intended-service return, and persistent cookie session.
- [ ] After the normal web release, confirm new/older Google accounts retain exactly one minimal profile with available names/email, existing complete users retain their fields, and the released web shows recoverable setup retry behavior. Test deliberately induced outages only in an isolated environment.
- [ ] Real Google existing verified-email automatic linking; explicit manual linking while signed in; unchanged user ID/history/approved evidence.
- [ ] Web cancellation, network/provider errors, code expiry/replay, safe `next`, logout and different-account sign-in.
- [ ] Native Android development-build Google warm/cold callbacks, cancellation/retries/restart, incomplete-account public browsing/skip, and action-only completion gates.
- [ ] The same password/Google journeys on a signed Android release APK.
- [ ] Real GPS denied/timeout and map-network recovery on the intended device/browser; home pin stays distinct from GPS and registration remains advisory.
- [ ] Barangay confirmation of boundary provenance before any official-certification wording.

Separate release-tracking prerequisite: **complete on 2026-10-06 after explicit user authorization**. The connector/repository discrepancy was repaired by changing only the recorded version to 0104, with metadata, current profiles, functions/permissions, trigger and unrelated history preserved. The migration list and push dry run passed; [repair evidence](evidence/migration-history-repair-2026-10-06.json) records the checks. This does not replace the provider/platform checks above or authorize the pending Phase 7 release.

## Documentation sources

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), [WebBrowser](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/), [Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/), [Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/).
- Next.js 16.3.0 installed docs: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `03-api-reference/04-functions/cookies.md`, `03-api-reference/03-file-conventions/route.md`.
- [Supabase Google OAuth/PKCE](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [SSR cookie clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
- [Google OAuth client configuration](https://support.google.com/cloud/answer/15549257), [Expo native development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Android APK builds](https://docs.expo.dev/build-reference/apk/).
