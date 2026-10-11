# Phase 5 — Live Android acceptance

Started 2026-10-11 (Asia/Manila). Status: **In progress / partially blocked**. No row below is marked Passed without an actual live result on the recorded candidate.

## Authorization and owner decisions (2026-10-11)

| Decision | Owner answer | Effect |
| --- | --- | --- |
| Physical device | "just use the LDplayer emulator". A Samsung A50 (`RZ8MC03Z10A`) was attached but booted into TWRP recovery; it was not touched. | LDPlayer 9 (Android 9/API 28, x86_64) is the only Phase 5 device. The plan's physical-device, minimum-OS (Android 7/API 24, Expo SDK 57 minimum) and current-OS (Android 16/API 36, SDK 57 target), mobile-data and TalkBack-speech rows are **not satisfied** by this choice and remain Blocked. The owner did not waive them. |
| Signed release candidate | First "Set up identity now"; then, superseding it: "no publishing yet on google play store, just do eas build for APK testing, no need for all of this" | Release identity `com.barangayan.resident`, versionCode 1, scheme `barangayan` (unchanged), set in `app.json`. The candidate is an **EAS Build internal-distribution APK** (`preview` profile) signed with the EAS-managed remote keystore. The local-keystore route was withdrawn and its artifacts removed: the release-shell script, the placeholder `~/.gradle/gradle.properties` (no password was ever written) and `.expo/p5rel`. No owner-held keystore exists. Play Store publishing and its upload-key/App Signing setup are deferred. |
| Production tests | "Yes, bounded" | Owned Gmail plus-addresses against project `pwjbucnyqexiepoinoke`, about 20–30 sends in total across two sessions, under 25/hour and the Brevo daily allowance. The **owner** enters account emails, OTP codes and passwords on the device. Claude prepares builds, drives non-credential navigation, captures redacted evidence and reads delivery metadata and server state read-only. |
| Outlook inbox | "Not available" | Outlook delivery rows are **Blocked** until an owned Outlook inbox exists. |

## Candidate

| Field | Value |
| --- | --- |
| Source | Working tree over `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`; application JS unchanged since Phase 4; Phase 5 changed only `app.json` identity and added the release-shell script (re-check 2026-10-11: shared 239/24, Android 57/8, Android types exit 0). |
| EAS project | `@alex123superman/barangayan`, project ID `3ff53b52-c50e-4bdb-811a-ccd94cd74f54`. Created with `npx eas-cli@24.12.1 init --non-interactive --force` using the EAS CLI session already signed in on this machine; it added `extra.eas.projectId` and `owner` to `app.json`. Push registration now receives a project ID; failures remain caught warnings, and push delivery is not qualified. |
| Build profile | `apps/resident-android-mobile/eas.json`: `preview` = `distribution: internal`, `environment: preview`, `android.buildType: apk`; `cli.appVersionSource: local` (versionCode from `app.json`). The development override in `app.config.js` is not active on EAS. |
| Build environment | EAS `preview` environment variables created from the gitignored `.env` without printing values: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_QRPH_SETTLEMENT_READY` (plaintext); `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY` (sensitive). All are public client values that are bundled into the app anyway. |
| Archive | The first upload failed: the 3.5 GB archive exceeded the 2.0 GB limit, because local tool worktrees and caches are hidden only by `.git/info/exclude`, which EAS ignores. A root `.easignore` repeats `.gitignore` and adds those folders plus non-build documents and plans. The retry uploaded 108 MB. |
| Signing | EAS remote credentials, generated on the first attempt: "Build Credentials TilEb_onyt (default)". |
| Release APK / certificate | EAS build `1993001d-abce-4ac3-aafb-51d493555d6b` **finished** at 18:06 (Asia/Manila) after about 22 minutes. APK 142,501,624 bytes, SHA-256 `B3D9D847E0FB3F0CF61B545EB2F6DBA817F63675EFAE86DA317620AB90778F2F`. `aapt2 dump badging`: package `com.barangayan.resident`, versionCode 1 / versionName 1.0.0, minSdk 24, targetSdk 36, ABIs arm64-v8a/armeabi-v7a/x86/x86_64, not debuggable. `apksigner verify --print-certs` passes; signer certificate SHA-256 `DBA37369ED3BC00A06C6B59A7C314B24A4EA55178079E38C6DD4B944DF528DD6` (EAS-generated, not the Android debug certificate). Downloaded to the session scratchpad only; not committed. |
| Backend | Production `pwjbucnyqexiepoinoke`. Read-only check 2026-10-11: latest migrations 0109/0108/0107/0106; `get_resident_account_setup_status` and `complete_resident_profile_if_unchanged` present; lifecycle records unknown 20 / true 6 / false 4 (18 unknown with an active profile). |
| Device | LDPlayer 9 instance 0, `emulator-5554`, Android 9/API 28, x86_64. |

## Fixture inventory (read-only, 2026-10-11)

| Fixture | State | Usable for |
| --- | --- | --- |
| `ampid1…` | Google origin, password set, profile complete | Returning Google login; email/password login after Google first-password setup (owner types password). |
| `enzona…` | Google origin, password set, profile complete | Existing chosen password + Google bypass. |
| `kingja…` | Legacy, Google-only, `password_set=false`, profile complete | Owner-offered legacy account; **not** an unknown-provenance fixture. |
| `cocoru…` | **Deleted and banned 2026-10-11 07:09 UTC.** The Phase 3 record lists it as "retained, passwordless"; actual state differs. | Not reusable. No passwordless Google fixture remains. |
| New owned Gmail plus-addresses on `barangayan.ampid1@gmail.com` | To be created by the owner during the session | New email resident, change email, resend, restart, templates. |
| Unknown-provenance legacy account | None known to be owned | Legacy Manage Password row is Blocked unless the owner identifies one they own. |
| Fresh unregistered Google account | Owner to supply | Google sign-up / skip / optional password / Settings first password / passwordless deletion. |

## Matrix

Status values: Not started, In progress, Passed, Failed, Blocked. "Owner" means the owner performs the credential step.

| ID | Scenario (plan §5 / §3.6) | Status | Notes |
| --- | --- | --- | --- |
| P5-DEV-1 | Signed release install, certificate, package, launch | In progress | Package, version, SDK levels and signature verified offline. LDPlayer install and launch wait on the owner's answer about disabling the development package (both claim `barangayan://`). |
| P5-DEV-2 | Upgrade over the installed APK (same EAS key, higher versionCode) retains session | Not started | Needs a second EAS build with versionCode 2; ask before spending the build. |
| P5-DEV-3 | Physical device, Wi-Fi + mobile data | **Blocked** | Owner chose LDPlayer only. |
| P5-DEV-4 | Minimum (API 24) and current (API 36) Android | **Blocked** | LDPlayer is API 28 only. |
| P5-DEV-5 | TalkBack speech on changed screens | **Blocked** | Physical device only (owner instruction: no TalkBack on LDPlayer). |
| P5-DEV-6 | Large text / small screen on changed screens; no crash/indefinite loading | Not started | LDPlayer font scale + resolution. |
| P5-OTP-1 | New email resident: real code, details, password, Home once, password login | Not started | Owner. |
| P5-OTP-2 | Invalid / malformed / expired code | Not started | Expired: reuse a session-1 code after hosted expiry (3,600 s). |
| P5-OTP-3 | Resend + 60 s countdown across background and restart | Not started | |
| P5-OTP-4 | Change email; old code rejected | Not started | |
| P5-OTP-5 | Hosted new and returning template code display | Not started | |
| P5-OTP-6 | Hosted verification-attempt throttling (bounded) | Not started | A few wrong codes only, without exhausting limits. |
| P5-OTP-7 | Offline send/verify | Not started | Needs an owner-approved app-only offline method; previous root rules were temporary and removed. |
| P5-EMAIL-1 | Restart at each step; Back retains entries; guest/deep-link bypass blocked | Not started | |
| P5-EMAIL-2 | Existing complete email account OTP → Home, credential preserved | Not started | |
| P5-GOOGLE-1 | Signed-candidate Google sign-up: warm, cold/process death, cancel | Not started | Fresh Google account. |
| P5-GOOGLE-2 | Skip details / save details + skip password / set password | Not started | |
| P5-GOOGLE-3 | Returning Google login; existing chosen password bypass | Not started | |
| P5-GOOGLE-4 | Email/password login after Google first-password setup | Not started | Owner types password. |
| P5-SET-1 | Settings warnings, Profile access, first password with fresh same-user Google | Not started | |
| P5-SET-2 | Existing-password change incl. wrong current password | Not started | Owner types passwords. |
| P5-SET-3 | Unknown-legacy Manage Password | **Blocked** | No owned unknown-provenance fixture. |
| P5-SET-4 | Passwordless Google deletion and password-based deletion on candidate | Not started | Each deletion needs separate owner approval. |
| P5-SET-5 | Status unavailable → retry/sign-out on device | Not started | |
| P5-SET-6 | Phase 4 helper extraction on device: reauth return, deletion dialog, background refresh | Not started | |
| P5-RACE-1 | Sign-out during status request; process death during browser/save; dropped response | Not started | |
| P5-MAIL-1 | Gmail delivery, two sessions, resend, placement, arrival time | Not started | See [delivery-results.md](delivery-results.md). |
| P5-MAIL-2 | Outlook delivery | **Blocked** | No owned Outlook inbox. |
| P5-CAP-1 | Quota assessment (Supabase 25/h, Brevo daily) | Not started | Read-only dashboard readback. |

## Run log — candidate 1 (EAS build `1993001d…`, versionCode 1), LDPlayer, 2026-10-11

Setup: installed with `adb install` (UID 10084, not debuggable). The development package `com.barangayan.resident.dev` was **disabled** with `pm disable-user` (data kept, re-enabled at the end) after `query-activities` showed both apps resolving `barangayan://auth/callback`. Afterwards only `com.barangayan.resident` resolves it. Screenshots are kept in the session scratchpad and not committed (some show owned account addresses).

| Check | Result |
| --- | --- |
| Launch | **Passed.** `am start -W`: status ok, 2.87 s, welcome screen, no crash buffer entries. |
| Registration email validation (empty, `not-an-email`) | **Passed.** "Enter a valid email address"; no send. |
| Google sign-up cancelled in Chrome | **Passed.** "Google sign-in cancelled. You can try again."; no account change. |
| Signed-out deep links to `/settings/profile`, `/settings/change-password`, `/settings/email-verification`, `/account-setup` (warm and cold) | **Passed.** Registration or welcome screen only; no account data. |
| Large text (font scale 1.3) + dark theme, registration screen | **Passed with a minor note.** Layout readable and scrollable; the dark-red error text has low contrast on the black background (not changed in this phase). Font scale 1.0 and night mode off restored and read back. |
| Returning Google sign-in, warm (`ampid1resident`, Google origin, password set) | **Passed** twice. Home, no repeated setup; Settings shows Change Password, no personal-details warning, independent Email/Location rows. |
| Logout | **Passed.** Limited guest Settings (Help, Terms, App Version, About, Login); account badge cleared. |
| **Google sign-in after process death (cold callback)** | **Failed, 3 of 3.** Each time the app was killed (`am kill`, pid gone) while the chooser was open, then the owned account was selected. Chrome delivered `barangayan://auth/callback?code=…` (redacted) and a new process started, but the app showed the signed-out welcome screen. Server: an auth code was issued but never exchanged (no new session; `last_sign_in_at` unchanged). The next Google attempt first resurfaced the stuck Chrome tab; closing it and retrying worked. |
| Deterministic reproduction without production | Background the app, `am kill`, then `am start -a VIEW -f 0x14000000 -d 'barangayan://auth/callback?code=p5-diagnostic-invalid'`. Cold: welcome screen (callback screen never shown). Warm (process alive): callback screen "Google sign-in could not be verified. Retry or start again." with Retry/Return to login. |

### Defect P5-D1 — cold Google callback dropped (fixed in candidate 2)

- **Cause:** `MainActivity` is `singleTask` (`launchMode=2`). After process death, Android recreates it in the existing task with its original launcher intent and delivers the callback through `onNewIntent`. On Android, Expo Router takes its initial URL from React Native's `getInitialURL`, which reads the original intent, so it starts at `/`. React Native's `url` event for that new intent is dropped because no React context exists yet. Only expo-linking keeps the URL (`ExpoLinkingModule.initialURL`, via its activity-lifecycle listener). The root navigator's existing hand-off to `/auth/callback` then raced with `index.tsx`'s `<Redirect>` to `/(auth)/auth-choice`, and the redirect won.
- **Why Phase 2 passed:** the Phase 2 standalone debug cold test passed on a different build (dev launcher excluded, debug variant). This release candidate shows the failure consistently. The Phase 2 result is not reused for this candidate.
- **Fix (application code only):**
  - `setup-navigation.ts`: new `isNativeAuthCallback`, `nativeCallbackPending` and `markNativeCallbackHandedOff` (process-wide hand-off record).
  - `_layout.tsx`: the root navigator uses these helpers instead of its local ref, with the same checks and the same `router.replace('/auth/callback')`.
  - `index.tsx`: renders nothing while a native callback is still waiting for hand-off, instead of redirecting to the entry screen.
  - Tests: two new cases in `setup-navigation.test.ts`.
  - Result: Android 59 tests / 8 files pass; types exit 0; lint 0 errors with the 2 baseline warnings.

## Run log — candidate 2 (EAS build `2611da45…`, versionCode 2), LDPlayer, 2026-10-11

APK SHA-256 `2DF04B50227FE3843EB9B72832337CD6805274AE729A07FCA6BAB5ADB9506CC3`, 142,507,708 bytes. Signer certificate SHA-256 `DBA37369…8DD6` (same EAS key as candidate 1). Contains the P5-D1 fix.

| Check | Result |
| --- | --- |
| Upgrade v1 → v2 while signed in (`adb install -r`) | **Passed.** Same UID 10084, `firstInstallTime` kept, versionCode 2; launch restored the signed-in Home without a new login. |
| Cold-delivered callback (deterministic reproduction) | **Passed.** The callback screen now appears ("Google sign-in expired. Please start again." because no attempt was pending), with Retry and Return to login. |
| Real cold Google sign-in (process killed with the chooser open, owned account selected) | **Passed for routing.** Home reached and the server recorded the PKCE login. **New defect P5-D2:** Home showed "Resident / Barangayan", Settings showed "—", and Push Notifications appeared off until the app was backgrounded and reopened. |
| Settings → Profile for a signed-in Google resident | **Passed.** Opens; Save stays disabled until a change is made. |

### Defect P5-D2 — first profile read after sign-in not retried (fixed in candidate 3)

- **Evidence (production edge logs, read-only):**
  - 10:47:10.225 UTC: the full `GET /rest/v1/profiles` returned **401** with an authenticated JWT (session `c45a…`), about 0.4 s after the PKCE token exchange.
  - 3 ms later, a `role,deleted_at` profile read with the same session returned 200.
  - The warm sign-in at 10:30:57 showed the same pattern on a different query (one 401 alongside a 200), and that path's own retry recovered.
  - This is a transient rejection of the first request of a just-issued session; the server-side cause is not determined.
- **Effect:** `ProfileProvider` reported a refresh error after the single failed read and never retried. The Push toggle reads its value from the profile, so it showed off as well. An AppState foreground refetch recovered both.
- **Fix:** plan §3.4 requires safe profile/status reads to retry with bounded backoff.
  - `setup-refresh.ts` gains `safeReadRetryDelay` (1 s, 3 s, then stop).
  - `use-profile.ts` retries a failed profile read under the same request ticket, so a newer refetch, sign-out or account switch cancels pending retries. The error and cache path after the final failure is unchanged.
  - One new test. Android 60 tests / 8 files pass; types exit 0; lint 0 errors with the 2 baseline warnings.
- **Unrelated observation:** at 10:49:09 UTC three `refresh_token_not_found` 400s came from a client with user agent `node`, not the Android app (`okhttp`). They are not attributed to this test.
