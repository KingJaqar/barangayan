# P04 — Authentication, guest access, setup, recovery and session management: implementation and verification (2026-10-15)

Source: uncommitted on base `2e5681c`, in the resident iOS workspace (`apps/resident-ios-mobile`). Standard: non-device scope under OD-06 (no signed build, no simulator, no real-provider run). Nothing was committed, pushed, deployed, or applied to a remote database in this session.

## 1. Authorization and entry

The plan recorded an owner decision (2026-10-15) not to start Phase 4 until its entry exits were met. On 2026-10-15 the owner then explicitly asked for Phase 4 to be implemented through completion, which this record treats as the owner's later and controlling instruction. The entry exits are **still open** and are therefore carried as blockers, not as passed:

| Entry item | State on 2026-10-15 (re-read this session) |
|---|---|
| Phase 3 exit | Partially complete. Hosted migration history lists `0121`–`0124` (read-only `list_migrations`); the stray row `20261015003812` is still present; `delete-my-account` freshness deploy and the hosted invariant run are not done. |
| Phase 1 exit | In progress: PR-03 (URL scheme / OAuth callback allowlist) open. |
| PR-06 | Open: Apple provider on hosted not confirmed. |
| PR-18 | Open: the iOS `.env` has no `EXPO_PUBLIC_BARANGAY_ID` / `EXPO_PUBLIC_ENVIRONMENT`, so the app cannot start and no flow could be exercised end to end. |

## 2. Dependencies

Added to `apps/resident-ios-mobile/package.json` (root `package-lock.json` gains only these declarations and `expo-apple-authentication@57.0.2`; no resolved version of any existing package changed):

| Package | Why |
|---|---|
| `expo-apple-authentication ~57.0.2` | Native Sign in with Apple (plan §2/§3). New package. |
| `expo-web-browser ~57.0.2` | `openAuthSessionAsync` for the Google browser flow. Already resolved for Android at 57.0.2. |
| `expo-linking ~57.0.4` | Callback scheme and `useLinkingURL`. Already resolved at 57.0.5 for Android. |

`expo install` first tried to move `expo-linking` and `expo-web-browser` to newer patches (also changing Android's resolved versions); that was reverted and the ranges were pinned to the already-resolved versions (P01-D04 patch drift stays untouched). `app.config.ts` gains `ios.usesAppleSignIn`, and the `expo-apple-authentication` and `expo-web-browser` plugins. `expo config --type introspect` (with a test scheme) shows the `com.apple.developer.applesignin` entitlement and the custom URL scheme.

SDK 57 docs read before writing code: AppleAuthentication, WebBrowser, Linking, Crypto, and the existing Router/Location pages from earlier phases. Notable facts used: `addRevokeListener` (not `addRevokedListener`); `getCredentialStateAsync` always throws on the Simulator; the name is returned only on first authorization; `openAuthSessionAsync` returns the redirect URL itself on iOS and a `Linking` listener must not be added for it.

## 3. What changed, by requirement

Shared (additive, type-only): `packages/shared/src/types/resident-account-setup.database.ts` declares `get_resident_account_setup_status_v2` and `ensure_apple_resident_profile` (migration `0122`). Android and web typecheck unchanged.

| Task | Implementation |
|---|---|
| P04-T01 account choice, guests, return | `/auth/choice` account-choice root (alias `/auth`); `/` decides recovery / restored session / guest / choice. Guest is in-memory only. `RequireResident` links to account choice and remembers an **allowlisted** destination (`src/auth/pending-destination.ts`: path + validated UUIDs only; query, hash and foreign values dropped). The authorized return is taken only after setup allows the app. `SetupEnforcer` keeps a signed-in resident inside `/account-setup` while required setup is outstanding (only emergency information, complete-profile and recovery are reachable). |
| P04-T02 email signup / OTP / details / password | `/auth/register` (email → six-digit code, 60 s resend deadline persisted, change email, existing-account handling by OTP sign-in). Session then continues into `/account-setup`: server-owned `get_resident_account_setup_status_v2` decides details → password; details use `registrationLocality`, `residentDetailsStepSchema` and `complete_resident_profile_if_unchanged` (conflict `PT409`, uncertain-save review, reload). Password step: first-password creation with the "check whether this password was saved" path through an independent non-persisting client. |
| P04-T03 login, Google PKCE, Apple | `/auth/login`; Google browser flow with a state machine (`provider-flow.ts`) bound to an attempt record (non-secret, 10-minute lifetime), one exchange per credential, wrong-account discard, crash reconciliation, provisioning through `ensure_google_resident_profile`. Native Apple: SHA-256 nonce (raw to Supabase, digest to Apple), `signInWithIdToken`, `ensure_apple_resident_profile`, cancellation and missing-name handling, credential-revocation listener plus foreground state check that ends the session. Supabase client now uses `flowType: 'pkce'` with native entropy/SHA-256 (`native-pkce-crypto.ts`). |
| P04-T04 provider progression, remediation | Intent `provider_signup`/`provider_details_saved` offer optional details then optional password (Skip for now). Service actions (`/services/request`, `/requests`, `/health/register`, `/reports/new`) route to `/complete-profile?next=…` while the profile is incomplete, then back to the allowlisted path. Status refresh keeps a confirmed status through a transient background failure and never through forbidden/ended sessions. |
| P04-T05 recovery and password | `/auth/recovery` (email → code → new password) on a `RecoveryFlow` that only writes a password for the exact verified session; 45 s resend; recovery hint expires after one hour; aliases `/recovery`, `/auth/reset-password`, `/auth/otp`, `/register`. Settings `change-password` has four modes from server state (change / manage unknown history / create with provider / recover only); first password from Settings requires a fresh same-account Google or Apple confirmation (5-minute window, single use, rechecked immediately before the write). |
| P04-T06 Settings email verification, linked identities | `/settings/email-verification` on the shared `residentEmailVerification` (send/verify/resend 60 s/status, profile-email match). Settings shows password/profile status rows, sign-in methods and a "Link Google account" action. |
| P04-T07 session safety | Runtime tolerates a signed-in resident with no profile row yet, denies deleted/staff/foreign-tenant profiles by logging out with an explanation, reports a session that ended without a user logout, shows one-time logged-out/ended/denied feedback, clears auth hints (attempt record, intent, resend deadline, recovery expiry) on logout/fresh install, and bumps the auth-flow scope on logout. |
| P04-T08 | Logic-level only (section 5). Real-provider, owned-callback and device runs: Skipped (OD-06) or blocked by PR-03/PR-06/PR-18. |

New files: `src/auth/*` (pure modules: request gate, setup status/routing, provider flow, fresh authentication, callback URL, Apple nonce, recovery flow, pending destination, login errors, hints; RN glue: `providers.ts`, `auth-flow.tsx`, `native-pkce-crypto.ts`), `src/features/auth/*` screens, `src/app/auth/*`, `src/app/account-setup.tsx`, `src/app/complete-profile.tsx`, `src/lib/use-latest.ts`; rewritten: login/register/recovery screens, Settings index and change-password, `runtime.tsx`, root layout and index.

## 4. Decisions and plan discrepancies

- **P04-D01** Routes follow route-ledger R41–R53: `/auth/choice`, `/auth/login`, `/auth/register`, `/auth/recovery`, `/auth/callback`, `/account-setup`, `/complete-profile`. The OTP and reset-password steps are **steps inside** register and recovery (not separate screens); `/auth/otp` and `/auth/reset-password` are redirect aliases. Rationale: a verified recovery session remounts the tree, so the verified state lives in the flow (`AuthFlowProvider`), not in a route.
- **P04-D02** The iOS account-setup status is its own strict v2 schema in the iOS workspace, because the shared `residentAccountSetupStatusSchema` is `.strict()` and v1-only (plan §2). Origin `apple` and `hasAppleIdentity` are modelled; any other value fails closed.
- **P04-D03** Registration location check is **GPS only** (shared foreground device-location controller, permission on tap, boundary check with `isPointInPolygon`). Manual home-pin placement on a map needs WebView/Leaflet and belongs to Phase 5 (A41 location verification). The check is optional in the contract (`location` is optional), so setup is not blocked. A06 has no separate map checkpoint, so no checkpoint is lost; the Android "home pin" input is deferred, not dropped.
- **P04-D04** Birthday uses the existing native compact date picker; the birthday calendar checkpoint (A38) belongs to Phase 5.
- **P04-D05** Apple linking to an existing account is not offered: Android has no equivalent (A05-015 is Google only) and `signInWithIdToken` does not link. Apple identity creation and sign-in are supported; Settings shows Apple as a sign-in method when present.
- **P04-D06** Apple name is stored through `updateUser({ data: { given_name, family_name } })` after a first authorization, as an editable suggestion only (`residentNamePrefill`); it never establishes residency.
- **P04-D07** Fresh-authentication check: Google requires an `oauth` `amr` entry after the attempt started (as Android). Apple's `amr` method for an identity-token exchange could not be confirmed offline, so any Auth-issued `amr` timestamp newer than the completed Apple attempt is accepted client-side. The server's own `has_recent_authentication` (migration `0121`) is the authority and also accepts any method. Confirm the actual `amr` method on a real Apple sign-in.
- **P04-D08** The `Stack.Protected` recovery guard now leaves `auth/recovery` (and aliases `recovery`, `auth/reset-password`) reachable; `tests/navigation.test.ts` was updated accordingly and also asserts the reverse (nothing else escapes the guard).
- **P04-D09** Plan discrepancy: Phase 4's recorded entry (Phase 3 and Phase 1 exits) is not met; see section 1. AGENTS.md has no conflict with this phase.
- **P04-D10** `SetupEnforcer` sends a signed-in resident to `/account-setup` while the status is loading. A cold start therefore passes through the "Getting things ready" state exactly like Android; an offline cold start with a stored session shows the retry/sign-out state, not public content.

## 5. Verification run (2026-10-15, iOS workspace)

| Check | Baseline (before edits) | Final |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| `eslint .` (includes the repository's React Compiler rules) | 0 problems | 0 problems |
| `vitest run` | 9 files / 74 tests | 12 files / 123 tests (49 new: setup routing/status, provider flow incl. wrong-account/replay/crash, callback validation, Apple nonce, fresh-authentication, recovery flow, request gate, pending destination, login errors; navigation test updated) |
| `expo export --platform ios` (test env values) | 0 | 0 (bundle builds, 4 MB hbc) |
| `expo config --type introspect` | n/a | applesignin entitlement and URL scheme present |
| Shared `vitest run` | 420/420 at Phase 2 | 477/477 (shared tree also has other sessions' uncommitted work) |
| Android `tsc --noEmit`, resident-web `tsc --noEmit` | 0 | 0 |
| Hosted read-only | n/a | `list_migrations` shows `0122` (v2 status, `ensure_apple_resident_profile`) |

Not run: any on-device or simulator run, any real Supabase/Google/Apple exchange, any screen interaction (the app cannot start without PR-18), hosted RPC call of the v2 function.

## 6. Pending manual verification (owner-attended)

1. Supply PR-18 (tenant ID, environment) and PR-03 (`IOS_URL_SCHEME`; add `<scheme>://auth/callback` to the Supabase redirect allowlist; check P01-D05 if `barangayan` is chosen).
2. Enable the Apple provider on hosted (PR-06) with the matching service/bundle identifiers, and Manual Linking if "Link Google account" is to work.
3. Email signup: register with a fresh address → code → details → password → Home; kill the app after the code step and after details, relaunch, confirm resumption from server status.
4. Google: sign up and sign in; cancel the browser; replay the callback link; start from account A and answer with account B (expect rejection and sign-out of B).
5. Apple: first sign-in (name present), second sign-in (name absent), private relay email, cancel, revoke from iOS Settings and return to the app (expect sign-out with notice).
6. Recovery: from signed-out and from Settings; expired and replayed code; background and relaunch mid-flow.
7. Settings: change password (wrong current), manage password (legacy account), first password for a Google/Apple account (confirm within 5 minutes, expire after 5 minutes), email verification.
8. Logout online and offline; relaunch; log in as a second account and confirm nothing of the first persists; staff, deleted and other-tenant accounts are refused with the explanation.

## 7. Out-of-scope issues noticed (not fixed)

- Hosted still has the stray history row `20261015003812` and `delete-my-account` version 1 (Phase 3).
- `apps/resident-ios-mobile/.env` has Android payment keys and lacks the iOS tenant values (PR-18).
- Profile, household and location-verification screens remain Phase 5; the existing profile screen was not changed.
- Existing `(tabs)/home` and `services/[id]` links still point at `/auth` (now an alias redirect); harmless, left for the screens' owning phases.
