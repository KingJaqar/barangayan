# Phase 0 baseline

Captured 2026-10-08, Asia/Manila. Commit: `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`.
Status: **Passed** for baseline capture; this is not a release qualification.

## Instructions and scope

Read root `AGENTS.md` and the entire execution plan before editing. No nested Android/shared/Supabase instructions were found; the app-specific instructions in the two web apps are outside this implementation scope. Read the exact [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and [SDK 57 WebBrowser reference](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/). SDK 57 targets React Native 0.86 and requires Node 22.13.x or newer. Supabase Auth, SMTP, rate-limit, password-security and breaking-change documentation was reviewed (links in the environment and capacity records).

Only Phase 0 evidence, Magic Link template configuration and the explicitly authorized SMTP sender correction are implemented. After the initial provider rejection and unsaved template state were corrected, the new/returning/resend retest emails arrived and all three codes verified; each session was signed out locally. No Android UI, shared runtime, database migration, web/iOS implementation, signed build, or app/database deployment is part of this diff. The cancelled Android usability Phase 8 remains excluded.

## Working tree

Initial `git status --short`: one unstaged modified file, `plans/Resident_Registration_Brevo_Supabase_OTP_Execution_Plan.md`. `git diff --cached --stat` was empty. No untracked files were initially reported. The pre-existing plan diff contained 163 additions and 4 deletions; its design/contracts were retained.

During execution, `plans/Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md` appeared as an unrelated untracked file. It was left untouched. Historical Android asset/configuration/map changes mentioned in the plan are not current uncommitted changes; the refreshed tree takes precedence. No reset, staging, or commit was performed.

## Toolchain and build prerequisites

| Item | Observed |
| --- | --- |
| Node / npm | 24.13.1 / 11.8.0 |
| Android Expo / React Native | 57.0.10 / 0.86.2 |
| React / TypeScript | 19.2.3 / 6.0.3 |
| Android supabase-js / auth-js | 2.112.1 / 2.112.1 |
| WebBrowser | 57.0.2 |
| EAS CLI | 20.1.0 installed; account check failed DNS resolution for api.expo.dev |
| Supabase CLI | Go binary 2.118.0; wrapper fails attempting a restricted telemetry write outside the workspace. Go binary `--help` was inspected. |
| Java / adb | JDK 25.0.2 installed; adb executable present. This does not establish Gradle/JDK compatibility or a connected device. |
| Android SDK platforms | 34, 35, 36, 36.1; build tools 35.0.0, 36.0.0, 36.1.0 |
| Native/EAS configuration | No Android native directory, Gradle files, `eas.json`, `expo.android.package`, or EAS project ID in this app. |
| Identity | Expo name/slug `barangayan`, app version 1.0.0, scheme `barangayan`; native package/signing/distribution identity unresolved. |

The existing Android script starts Metro with `expo start --android`; it does not build a signed binary. Earlier registration documentation describes `expo run:android` as a proposed native route, with required package configuration first. It is not evidence of an existing reproducible signed release route. Obtain the current installed/distributed package ID, signing-key ownership, distribution channel and EAS account/project or native build recipe before phase 6. Do not invent or change identity during baseline work.

## Checks before runtime changes

Commands ran from the repository root unless otherwise noted. Logs are under `logs/`.

| Check | Exact command | Result |
| --- | --- | --- |
| Shared tests | `npm run test --workspace=@barangayan/shared` | Exit 0; 21 files, 202 tests passed. `logs/shared-tests.log` |
| Android lint | `npm run lint --workspace=@barangayan/mobile` | Exit 0; 0 errors, 2 existing duplicate-import warnings in health/register.tsx. `logs/android-lint.log` |
| Android typecheck | `node node_modules/typescript/bin/tsc --noEmit --project apps/resident-android-mobile/tsconfig.json` | Exit 0. `logs/android-types.log` |
| Android export, first attempt | From Android app: `node ../../node_modules/expo/bin/cli export --platform android --output-dir dist-phase0-otp` | Exit 1: Hermes could not write its output in sandbox TEMP. `logs/android-export.log` |
| Android export, recheck | Same command, with process-local TEMP and TMP set to the absolute app `.expo/phase0-otp-tmp` directory | Exit 0; 2,468 modules, Android Hermes bundle exported. `logs/android-export-recheck.log` |

The export was moved to the existing ignored `apps/resident-android-mobile/dist/phase0-otp` directory after verification. Hermes artifact: `entry-03c02c13d4673a4b18753e655582272f.hbc`; SHA-256 `13945A82F7EABA56795A39872F8886EFD4A683926D0960CE034C2EAAB5D385F0`. Compiler global warnings remain in the logs; no application changes were needed. Export is a packaging baseline, not an installed native or signed-device pass.

## Existing functionality and missing later-phase work

Android registration calls password `signUp`, uses `isRegistering`, and signs out after success. Recovery uses `resetPasswordForEmail` plus recovery OTP verification; it must retain its separate template and routing. Google uses external WebBrowser, PKCE, a ten-minute pending-attempt timestamp, shared strict callback parsing, and duplicate exchange protection; callback currently redirects to `/` without setup intent. Shared profile/locality validation and Google minimal provisioning already exist. Settings changes verify current password in the client before `updateUser`; this does not establish server-required fresh authentication.

There is no email-registration `signInWithOtp` call, lifecycle status contract/RPC, or authoritative password provenance yet. These are phase 1–3 deliverables and were not added during phase 0. Highest repository migration prefix is 0106, so a future new migration starts at 0107.
