# Phase 4 automated integration and security checks — 2026-10-11

Status: **Passed.** Candidate: working tree over `a75ee345224ed7f93d57b3e0c4de24e7540ba82c` (Phase 0–3 work uncommitted and preserved) plus the Phase 4 changes listed below. Backend for every check here: the **disposable local Docker stack** (no production request, send, migration or fault injection). No migration, Edge Function, shared package code, hosted Auth setting or template changed in Phase 4; the next unused migration prefix remains `0110`. Logs: [`logs/phase4/`](logs/phase4/).

## Environment and tool versions

| Item | Version / identity |
| --- | --- |
| Node / npm | 24.13.1 / 11.8.0 |
| Docker | 29.8.1 |
| Supabase CLI (installed JS wrapper) | 2.118.0 (`node node_modules/supabase/dist/supabase.js`) |
| Local Auth / PostgreSQL | GoTrue `v2.197.0` (same version as hosted) / PostgreSQL 17.6 (`17.6.1.155` image) |
| Local Edge runtime / mail capture | supabase-edge-runtime 1.76.2 (Deno 2.1.4) / Mailpit 1.30.2 |
| Expo / React Native / TypeScript | 57.0.10 / 0.86.2 / 6.0.3 |
| supabase-js / Vitest / esbuild | 2.112.1 / 3.2.7 / 0.28.1 |

The exact Expo v57 documentation (SDK index and WebBrowser) was re-read. CLI subcommand flags (`db reset --version`, `migration up --local`, `test db`) were discovered with `--help` before use.

## Phase 4 changes

| Area | Change |
| --- | --- |
| Android Phase 3 behavior → testable helpers (behavior-preserving) | `setup-refresh.ts` (`isBackgroundRefresh`, `refreshFailureOutcome`) now used by `use-auth.tsx`; `setup-navigation.ts` gains `reauthReturnTarget`/`callbackNavigation`, used by `auth/callback.tsx`; `sensitive-auth.ts` gains `deletionConfirmation`, used by Settings `index.tsx`. Logic moved verbatim; no UI, copy or routing change. |
| New Android tests | `setup-refresh.test.ts` (3), callback-return cases in `setup-navigation.test.ts` (+5), `deletionConfirmation` in `sensitive-auth.test.ts` (+1), and `google-auth.test.ts` (6) which drives the **real** `google-auth.ts` adapter over in-memory storage/browser/Auth: single-use final deletion dialog, cancel leaves nothing unlocked, wrong account signed out before provisioning, purpose/session preconditions, consumed sign-up checkpoint preserved, stale Google session expired. Android suite 42 → **57 tests / 8 files**. A mutation check (reverting `back()` to `replace`) made the callback test fail, then the file was restored. |
| New local integration suite | `supabase/tests/resident_registration_phase4.auth.mjs` — real Auth sends captured by local Mailpit (codes recovered from Auth's `sha224(email+code)` link token because the local default template omits the code; the hosted template shows it), real REST/RPC calls. |
| New upgrade rehearsal | `supabase/tests/resident_registration_upgrade.rehearsal.mjs` — replay to 0106, representative pre-feature accounts via the real Admin API, `migration up --local` for 0107–0109, verification, then full fresh replay restore. |

## Commands and results (final candidate)

All commands ran from the repository root unless noted. "Baseline" rows ran before any Phase 4 edit.

| ID | Command | Result |
| --- | --- | --- |
| P4-BASE | Shared tests, Android Vitest, Android `tsc` on the unmodified Phase 3 candidate | 239/24, 42/6, exit 0 — `baseline-*.log`. No baseline failure. |
| P4-SHARED | `npm run test --workspace=@barangayan/shared -- --reporter=dot` | **239 tests / 24 files passed** — `shared-tests.log`. |
| P4-ANDROID-TESTS | `node ../../node_modules/vitest/vitest.mjs run --config vitest.config.ts` (in `apps/resident-android-mobile`) | **57 tests / 8 files passed** — `android-tests.log`. |
| P4-TYPES | `node node_modules/typescript/bin/tsc --project apps/resident-android-mobile/tsconfig.json --noEmit` | exit 0 — `android-types.log`. |
| P4-LINT | `npm run lint --workspace=@barangayan/mobile` | **0 errors**; the 2 pre-existing `health/register.tsx` duplicate-import warnings — `android-lint.log`. |
| P4-EXPORT | `npx expo export --platform android --output-dir .expo/phase4-export --clear --max-workers 2` (workspace TEMP/TMP) | Hermes export passed: `entry-b3d742ecced102fa2d9d76a3f3cf92a8.hbc`, 7,233,526 bytes, SHA-256 `209A5AB2437B619A0D43DDCA3B50321B234FBDC27250C9A043F284B3208704AB`. Packaging check only, not a signed-device pass. Output removed afterwards. |
| P4-REPLAY | `node node_modules/supabase/dist/supabase.js db reset --local --no-seed --yes` | Fresh replay through 0109, exit 0 — `fresh-replay.log`; repeated by P4-UPG-7. |
| P4-DB | `node node_modules/supabase/dist/supabase.js test db --local` | **504 assertions / 15 files, PASS** (after the rehearsal's restore) — `database-suite.log`. |
| P4-AUTH-1 | `node supabase/tests/resident_account_setup.auth.mjs` | 14 PASS lines, exit 0. |
| P4-AUTH-2 | `node supabase/tests/resident_registration_android.auth.mjs` | 4 PASS lines, exit 0. |
| P4-AUTH-3 | `node supabase/tests/resident_email_verification.auth.mjs` (local `functions serve`) | PASS, exit 0. |
| P4-AUTH-4 | `node supabase/tests/resident_sensitive_actions.auth.mjs` (local `functions serve`) | SA-1…SA-3 PASS, exit 0. |
| P4-AUTH-5 | `node supabase/tests/resident_registration_phase4.auth.mjs` | 9 PASS lines, exit 0 (see below). |
| P4-UPG | `node supabase/tests/resident_registration_upgrade.rehearsal.mjs` | P4-UPG-1…7 PASS, exit 0 — `upgrade-rehearsal.log`. |
| P4-ADVISORS | `node node_modules/supabase/dist/supabase.js db advisors --local --type security --level warn --fail-on error` | exit 0; 7 WARN `function_search_path_mutable` on pre-existing unrelated functions (`track_service_request_status`, `guard_request_completion`, `set_barangay_officials_updated_at`, `sync_service_request_payment_status`, `set_faq_articles_updated_at`, `set_updated_at`, `set_updated_at_column`) — same set as Phase 2; **none introduced**. |
| P4-WEB | `node node_modules/typescript/bin/tsc --project apps/resident-web/tsconfig.json --noEmit` | exit 0 — `web-types.log`. Phase 4 changed no shared/server code reaching the web Settings verification, so its production build was **not affected** and not re-run; its server path is re-exercised by P4-AUTH-3. |
| P4-DIFF | `git diff --check`; secret-pattern scan of `logs/phase4/` | exit 0; no JWT/secret-like strings. |

`.env.phase1.local` was regenerated from `supabase status --output json` for P4-AUTH-1/4 and **deleted afterwards**. The owned `functions serve` was stopped and the edge-runtime container returned to its original stopped state.

## New integration results (P4-AUTH-5)

| ID | Real request(s) | Result |
| --- | --- | --- |
| P4-OTP-1 / P4-ABUSE-1 | `signInWithOtp` for a new email-origin account, then an immediate resend | Captured six-digit code; lifecycle `email_otp/false/absent`. Resend inside `max_frequency` → **HTTP 429 `over_email_send_rate_limit`**, mapped to wait/retry, and **no email sent**. |
| P4-OTP-2 | `verifyOtp` with `12345`, `1234567`, `abcdef`, empty, and a wrong six-digit code; anonymous status RPC | All rejected without a session; wrong code maps to correct-code/resend guidance; anonymous status denied. |
| P4-OTP-3 | Resend after the interval; verify previous, latest, then replay latest | **Previous code rejected**; latest verifies the same user with status `{email_otp, false, false, false}`; **consumed code replay rejected**; verification writes no password. |
| P4-OTP-4 | Fresh send, Auth send timestamps backdated 2 h, verify | **`otp_expired`**, mapped to request-a-new-code. |
| P4-DB-1 | Real-JWT REST `incidents`/`service_requests` inserts and the app's `register_for_drive` RPC | Rejected with **no profile** and with a **partial profile** (`resident_profile_completion_required`); zero rows written; the same requests **succeed after** `complete_resident_profile` (positive control). Direct `drive_registrations` inserts are always rejected (no resident insert policy). |
| P4-EMAIL-1 | OTP sign-in (with a forged `email_otp` marker) for an existing completed account with a chosen password | Same user and profile; origin stays `legacy`; status unchanged `{legacy, true, true, false}`; credential hash unchanged; one Auth user; chosen password works, superseded one rejected. |
| P4-INV-1 | The admin-web staff-invite route's Auth/DB calls (`inviteUserByEmail`, `profiles` upsert as admin, `barangay_officials` upsert), invite acceptance by token hash, `updateUser`, and the route's `deleteUser` rollback | Invite → `legacy/false/absent`; acceptance + password → `legacy/true/auth_password_write`; password login works; staff role kept; **staff status RPC fails closed**; rollback leaves **no Auth user or lifecycle row**. |
| P4-ABUSE-2 | 35 guessed codes | Every guess rejected (403) without a session. The local GoTrue has `GOTRUE_RATE_LIMIT_VERIFY=30` but **no `GOTRUE_RATE_LIMIT_HEADER`**, and GoTrue enforces per-IP limits only with that header, so **verification throttling cannot be proven locally** → Phase 5 hosted check. |

## Migration replay and backfill (P4-REPLAY, P4-UPG)

- **Fresh database:** full replay through 0109 and the 504-assertion suite pass (P4-REPLAY, P4-DB). Phase 1–2 SQL upgrade/replay fixtures stay in that suite.
- **Representative existing database (new):** replay to `0106` (0107–0109 pending, no lifecycle table) → 8 pre-feature Auth users created through the real Admin API: a completed resident (finished through the pre-feature `complete_resident_profile`, with a verified email badge), a partial resident, a no-profile account, a Google-only account (no hash, as OAuth creates; its minimal profile came from the existing pre-feature trigger), a linked password+Google account, staff, a deleted profile and a pending staff invitation → `migration up --local` applied 0107, 0108, 0109 without error.
- **Backfill:** one record per Auth user (`absent:2, unknown_initial_hash:6`). A present hash maps to unknown and an absent one to false. **No account is assumed to have a chosen password, and every credential hash is unchanged.**
- **After upgrade:** existing password logins work. Status is `legacy` + `passwordSet: null` (never "not set") for hashed accounts and `false` for Google-only. Google comes from identities. Staff and deleted accounts fail closed, and the no-profile account invents no state. The pre-feature completion (`profileComplete: true`) and the verified badge are preserved.
- **Observer/replay:** a real post-upgrade password write records `true/auth_password_write`; **re-executing the exact 0107 backfill statement changes nothing**; 0109 clears the badge only on an email change. The local database is then restored by a full fresh replay.

## Phase 4 catalogue coverage (section 3.6)

Level: **U** unit (Vitest), **S** SQL/pgTAP, **I** real local Auth/REST/Edge integration, **L** live device/hosted only. "P4" marks evidence added in this phase; other references are existing suites re-run on the final candidate above.

| Group | Case | Level → evidence | Status |
| --- | --- | --- | --- |
| OTP | New account; correct code; generated hash not a chosen password | I: AUTH-1, AUTH-2, P4-OTP-1/3 | Passed |
| OTP | Existing account | I: P4-EMAIL-1 | Passed |
| OTP | Invalid, malformed, leading-zero | I: P4-OTP-2; U: shared six-digit string schema (leading zeros), email-verification client | Passed |
| OTP | Expired, consumed, previous-after-resend | I: P4-OTP-3/4 | Passed |
| OTP | Resend cooldown deadline/background/restart | U: `setup-request.test.ts` (deadline, resume, corrupt/future values) | Passed (unit); live UI → Phase 5 |
| OTP | Backend send limit (per-account interval) | I: P4-ABUSE-1 | Passed |
| OTP | Verification-attempt throttling; hourly SMTP quota; SMTP rejection; delayed inbox; new/returning hosted template | — | **Live-only (Phase 5)**: per-IP limit not enforced locally (see P4-ABUSE-2); quota/SMTP/delivery/template need hosted Brevo |
| OTP | Offline send/verify | U: shared `residentSetupFailure` network mapping, request watchdog | Unit passed; live → Phase 5 |
| EMAIL | Required profile/password; optional fields; parity with SQL | S + I: AUTH-1 (18 parity fixtures), AUTH-2 | Passed |
| EMAIL | Restart before/after verification/details/password | U: `setup-navigation`, shared routing; I: AUTH-2 restored session/status | Passed (logic); live restart → Phase 5 |
| EMAIL | Existing password preservation | I: AUTH-1, P4-EMAIL-1, P4-UPG-4/5 | Passed |
| EMAIL | Missing/ambiguous locality | S: `deferred_profile_completion`, `registration_maps_auth` | Passed |
| EMAIL | Guest/deep-link attempts to skip mandatory setup | U: `setup-navigation.test.ts`, P4 `callbackNavigation` (reauth cannot reopen Settings for unfinished email setup) | Passed |
| EMAIL | Back navigation, map failure, keyboard | — | Live-only (Phase 5) |
| GOOGLE | Sign-up/sign-in/link/reauth intent, duplicate/warm/cold callback, consumed-code provisioning retry, crash reconciliation, stale/unrequested/malformed attempt, wrong account, account switch | U: `google-auth-flow.test.ts` (20), P4 `google-auth.test.ts` (6) | Passed (adapter level) |
| GOOGLE | Linked email account, Google identity from Auth identities, link/unlink preserves origin/password | I: AUTH-1; I: P4-UPG-5 | Passed |
| GOOGLE | Names missing/invalid suggestions | U: shared `residentNamePrefill`/details schema tests | Passed |
| GOOGLE | Real external browser, cancel/provider error, cold process death, signed callback | — | Live-only (Phase 5) |
| SETTINGS | Independent warnings; no false state while loading/error; true/false/null modes | U: `sensitive-auth.test.ts`, P4 `setup-refresh.test.ts` | Passed |
| SETTINGS | Background refresh keeps Settings mounted; forbidden/expired never keep access | U: P4 `setup-refresh.test.ts` | Passed |
| SETTINGS | Fresh same-user Google first password; cancel/expiry/account switch; single-use deletion confirmation | U: `sensitive-auth.test.ts`, P4 `google-auth.test.ts` | Passed |
| SETTINGS | Deletion confirmation method per status | U: P4 `deletionConfirmation` | Passed |
| SETTINGS | Existing-password change, recovery, old/new credential | I: AUTH-1 | Passed |
| SETTINGS | Direct `updateUser`/`delete-my-account` server behavior | I: AUTH-4 (SA-2/SA-3) | Passed / documented (application-enforced freshness only) |
| SETTINGS | Email verification (shared server path used by Android and web) | U: shared (15); I: AUTH-3 | Passed |
| SETTINGS | Wrong/rate-limited current password in UI; passwordless deletion live; Manage Password screen | — | Live-only (Phase 5; rate-limit message mapping is in-screen) |
| RACE | Double taps / one in-flight mutation; late result after timeout/unmount; write boundary | U: `setup-request.test.ts` | Passed |
| RACE | Late result after account switch | U: `google-auth-flow` (provisioning after switch), shared email-verification client | Passed |
| RACE | Concurrent same-user completion/callback; stale snapshot | I: AUTH-1, AUTH-2 (one commit, one conflict, HTTP 409) | Passed |
| RACE | Lost response after committed save; token refresh during setup | I: AUTH-2 (snapshot reconcile), AUTH-1 (refresh does not invent state); SA-1 | Passed |
| RACE | Legacy unknown provenance | I: AUTH-1, P4-UPG-5; U: modes | Passed |
| RACE | Sign-out during status request; process death while browser/save pending | U (partial): ownership tickets in `setup-request`; installed-SDK local sign-out (`auth-cleanup.test.ts`) | Hook-level and process death → Live-only (Phase 5) |
| DB | Anonymous/cross-user/private-table access; metadata forgery; tenant/role/deleted | S: `resident_account_setup`, `rls_isolation`, `google_minimal_profiles`; I: AUTH-1 REST | Passed |
| DB | Real temporary/chosen provenance; observer rollback; concurrent provisioning | I: AUTH-1; S | Passed |
| DB | Migration/backfill replay (fresh + representative existing) | S, P4-UPG | Passed |
| DB | Direct incomplete-profile submissions (SQL and real REST/RPC) | S: `deferred_profile_completion`; I: P4-DB-1 | Passed |
| DB | Earlier JWT after deletion | I: AUTH-1, AUTH-4 (SA-3c) | Passed |
| DB | Staff invitation / existing clients | I: P4-INV-1; S: `catalog_staff_workflows`, `rls_isolation` | Passed |
| DEVICE | All | — | Live-only (Phase 5) |

## Findings

1. **Not introduced; carried forward: no server-enforced fresh authentication.** Direct `updateUser` and `delete-my-account` accept a non-reauthenticated session (SA-2/SA-3, re-run here). Hosted Secure password change and Require current password are off. Fresh Google authentication is enforced by the application only. This is the existing server behavior that Phase 3 documented as an owner decision. It is **not** a Phase 4 regression and was not changed. Before any Phase 6 readiness claim it needs an explicit owner decision (accept, or enable/implement server enforcement with its own negative direct-request tests).
2. **The local stack cannot prove per-IP verification throttling** (P4-ABUSE-2). The local GoTrue has no client-IP rate-limit header. The per-account send interval is enforced locally (P4-ABUSE-1). A bounded hosted check, or a staging check if one becomes available, belongs to Phase 5 and needs authorization; it must not exhaust production limits.
3. **Pre-existing, outside this feature:** the local Admin `deleteUser` returns 500 for a resident who has submissions (foreign keys). Resident deletion uses the anonymizing `delete-my-account`, so this does not affect the feature. One synthetic local fixture stayed in the disposable database.
4. **The local default magic-link email omits the six-digit code**, unlike the hosted template. Hosted template selection and code display stay Phase 5 delivery checks (the Phase 0 evidence remains historical).
5. The 7 advisor warnings and the 2 lint warnings are pre-existing and unrelated.

## Remaining live-only acceptance cases for Phase 5

Run these on the release candidate and the intended backend with real devices, inboxes and accounts. They are listed as acceptance-matrix rows or section 3.6 cases.

- **OTP:** hosted new- and returning-account template code display; Gmail and Outlook delivery, placement and arrival time across two sessions with resend; hourly/daily quota and SMTP rejection handling (without exhausting production); hosted verification-attempt throttling; live resend countdown across background and restart; offline send/verify on the device.
- **EMAIL:** native restart at each step; Back retaining entries; keyboard behavior; map/GPS failure; guest/deep-link bypass on the device; password login after email registration.
- **GOOGLE:** real external browser sign-up/sign-in, cancel and provider error, warm/cold/process-death callbacks on the signed candidate; returning Google login; email/password login after Google first-password setup ("Google set password").
- **SETTINGS:** unknown-legacy Manage Password screen; existing-password change, including wrong and rate-limited current password; password-based deletion; passwordless Google deletion on the candidate; status-unavailable retry on the device.
- **RACE:** sign-out during a status request; process death while the browser or a save is pending; dropped response on the device network.
- **DEVICE-\*:** signed build install/upgrade; minimum supported and current Android; a physical device on Wi-Fi and mobile data; large text and small screens; TalkBack speech on changed screens (physical device only, not LDPlayer); no crash, deadlock or indefinite loading.
- **Phase 4 refactor on device:** the behavior-preserving helper extraction in `use-auth.tsx`, `auth/callback.tsx` and Settings is covered by types, lint, unit tests and export, but has not been exercised on LDPlayer. Retest the Settings reauthentication return, the deletion dialog and the background refresh on the Phase 5 candidate.
