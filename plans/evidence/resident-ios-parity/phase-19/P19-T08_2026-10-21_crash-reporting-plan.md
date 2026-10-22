# P19-T08 — hosted crash reporter (Sentry): WITHDRAWN (OD-18), kept as history (2026-10-21)

**Withdrawn 2026-10-21 (OD-18).** After this was built and verified, the owner asked whether a Sentry project was necessary and decided "never do sentry project at all, we dont need it". Everything below §5 was removed from the repository: the source and test files, the Metro and Expo plugin wiring, the scripts, the ignore entry and the `@sentry/react-native` dependency (lockfile package-for-package identical to before; iOS typecheck 0, lint 0, tests 725/725, both exports pass, generated configuration identical to the pre-reporter result). Nothing was ever sent to Sentry; no account, project, DSN or token ever existed. Read the rest as the record of what was planned and built, not as current state.

**Update 2026-10-21 — approved and implemented.** The owner approved adding `@sentry/react-native` with no user identifier, the Sentry organization/project/region and DSN to follow, and code that does nothing without a DSN (OD-17). See §5 for what was built and verified; §1–§4 are the plan it followed.

Requirements: G20, A51, F11, P19-T08, P20-T06. Owner decision: option (a) of the Phase 19 record §9, given 2026-10-21 and recorded as **OD-17** — use a hosted crash reporter such as Sentry; **ask before adding the dependency**; plan PII scrubbing and source-map upload first. This file is that plan. **No package, configuration or code was changed.** Source: uncommitted on base `187a2ab3`.

## 1. What was checked

- No Sentry package is in the root lockfile or any workspace, so adding it is a new dependency with new transitive packages.
- Sentry's Expo guide ([docs.sentry.io](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)): install with `npx expo install @sentry/react-native`; replace the Metro config with `getSentryExpoConfig(__dirname)` (assigns Debug IDs to bundles and source maps); add the `@sentry/react-native/expo` config plugin with `organization`, `project`, `url`; keep `SENTRY_AUTH_TOKEN` in a git-ignored `.env.local` or an EAS secret; release builds upload source maps and, through an Xcode phase, dSYMs during the native build; source maps do not work on web.
- Expo's own v57 Sentry page does not exist (404), so Sentry's guide is the only documentation used. Re-read it at install time and pin whatever it says for SDK 57 then.
- A web search found `@sentry/react-native` 8.25.0 as the newest release seen, with a fix for iOS on React Native ≥ 0.86 (logs and spans silently dropped). I could not confirm the current npm "latest", so the exact version is chosen from npm at install time.
- Scrubbing options named by Sentry's sensitive-data page: `beforeSend`, `beforeSendTransaction`, `beforeBreadcrumb`, `sendDefaultPii`, `Sentry.setUser`, and server-side scrubbing in the Sentry UI. Option names for screenshots and view hierarchy were not on that page and must be confirmed in the SDK reference.
- Constraint from OD-06: no native build exists, so the Xcode source-map and dSYM upload steps and native symbolication cannot be exercised. Only JavaScript crashes can be symbolicated before a build exists.

## 2. Proposed design (nothing built yet)

**Dependency and tooling.** `@sentry/react-native` in the iOS workspace only. Metro: compose `getSentryExpoConfig` with the existing `metro.config.js` (it already resolves web stand-ins; the wrapper must keep that resolver). `app.config.ts`: add the Sentry plugin with organization/project/url read from environment (no secret). The generated configuration will change (new plugin); record it, as with every earlier dependency.

**Runtime module `src/lib/diagnostics.ts`.**
- Initializes only when `EXPO_PUBLIC_SENTRY_DSN` is set (a DSN is public by design) and never on web; without it every call is a no-op, so tests and localhost runs send nothing.
- `release` = app version + build number from `expo-application` (already a dependency), `environment` from the existing configuration, `tenant` as a tag (the barangay id is not personal data).
- Tracing, profiling, session replay, screenshots, view hierarchy and user feedback **off**. Crash and error capture plus crash-free-session counts **on**.
- `ErrorBoundary` in `src/app/_layout.tsx` reports the caught error through the scrubber and keeps its current resident copy.

**PII scrubbing (the part that must be right before any event leaves the device).**
1. `sendDefaultPii: false`; no `setUser` and no IP; the account id is never attached. (Recommendation: no user identifier at all. Crash-free sessions and issue counts do not need one.)
2. A single pure function `scrubEvent(event)` used by `beforeSend`, `beforeSendTransaction` and `beforeBreadcrumb`, with these rules:
   - drop `user`, `request.cookies`, `request.headers`, `request.data`, `contexts.device.name`, and every `extra`/`contexts` key not on a short allowlist;
   - strip query strings and fragments from every URL (signed storage URLs and OAuth callbacks carry tokens);
   - in exception messages, breadcrumbs and stack-frame variables replace JWT-shaped strings, e-mail addresses, Philippine mobile and landline numbers, UUIDs (record identifiers), signed-URL tokens, Supabase storage paths (they contain account ids), coordinates, and any 6-digit one-time code with fixed tokens;
   - keep route templates (`/request/[id]`), never route parameters;
   - drop console, fetch and XHR breadcrumbs entirely, keeping only navigation (template only), app state and tap labels already chosen by the app;
   - on any scrubber error, drop the event rather than send it.
3. Never captured by design: ID photos, avatars, health registration data, exact coordinates, request payloads, export contents. The scrubber has no path for them because the app does not pass them as exception context; a test asserts that an error carrying each is reduced to fixed tokens.
4. Server side (Sentry project settings, owner action): enable "Prevent storing IP addresses", default data scrubbers and sensitive-field scrubbing, shortest retention offered, restricted membership, and a deliberate region choice (EU or US) because crash data leaves the Philippines.
5. Tests (sanitized fixtures only): scrubber unit tests per rule above, a fixture event with a JWT, an e-mail, a Philippine number, a signed URL, a coordinate pair and a record UUID that must come out clean, no-op without a DSN, no-op on web, and a source scan that no `setUser` or `sendDefaultPii: true` exists.

**Source maps and symbolication.**
- Release builds: Hermes bytecode with Debug IDs from `getSentryExpoConfig`; maps are uploaded by the plugin's build phases, never shipped inside the app. Requires a native build: **Skipped (OD-06)**; the configuration is prepared and the first signed build exercises it.
- Until then, for the exported bundle (`expo export`) a manual upload step after export with Sentry's CLI/uploader (exact command to be confirmed in the docs at implementation time) lets a JavaScript crash from any run symbolicate; run it in CI only.
- `SENTRY_AUTH_TOKEN` lives only in a CI/EAS secret or a git-ignored local file. I will not create, read or print it; the owner supplies it.
- dSYM/native crash symbolication: **Skipped (OD-06)**, recorded as Pending device.

**Release identifiers and alerts.** Release and build in every event feed `candidate.json`. Alert rules to create in Sentry (owner action, thresholds to be named under PR-07/P20-T06): new issue in a release, crash-free sessions below a threshold, spike in one issue. Mutation, upload, payment and push dashboards stay server-side (notification sender counters from Phase 17 exist; the rest belongs to P20-T06).

**Compliance.** The privacy policy and the processor disclosure must name the crash-data processor and what is collected (owner/content work, tied to P18-T07). App Privacy labels: crash and performance data, not linked to identity, not used for tracking (P20-T02). Confirm the SDK's bundled privacy manifest at install time. A data-processing agreement with the processor is an owner step.

## 3. Cost of doing it

New package plus transitive packages in the lockfile (no existing resolved version may change, per the OD-08/OD-09 rule); a Metro and `app.config.ts` change; about one new module and one test file; a small `ErrorBoundary` edit. Expo is currently 57.0.10 while a changelog entry says 57.0.17 and later carry React Native 0.86.3 and a Hermes memory fix: that upgrade is **not** part of this change (P01-D04 stays) and needs its own decision.

## 4. What I need before starting

1. Approval to add `@sentry/react-native` to the iOS workspace (lockfile gains only that package and its transitive dependencies).
2. A Sentry organization, project and data region chosen by the owner, and the public DSN as `EXPO_PUBLIC_SENTRY_DSN`. The auth token stays with the owner.
3. Confirmation that no user identifier is attached (recommended), or an explicit alternative.

When approved I will implement §2, run the full iOS checks, add the tests, update this record, and move P19-T08 from Blocked to Partially complete. Native symbolication, a real captured crash, alert rules and the server-side settings stay owner/device steps and will be listed as Pending.

## 5. Implementation record (2026-10-21)

Source: uncommitted on base `187a2ab3`; candidate identity refreshed in `candidate.json` (iOS workspace 343 files).

**Dependency.** `@sentry/react-native` **8.31.0**, exact, in `apps/resident-ios-mobile/package.json`. The root lockfile gained **34 packages** (`@sentry/*` at 10.76.2, `@sentry/cli` 3.8.0 and its platform binaries, `@sentry/expo-upload-sourcemaps` 8.31.0, `dotenv`, `undici`, `proxy-from-env`, and a nested older `@sentry/cli` 2.58.6 for the bundler plugin); **no existing resolved version changed and none was removed** (compared package by package against the pre-install lockfile). Version choice: the installed Expo 57.0.10 lists `~7.11.0` as its bundled pin for this library, but 8.x is the line Sentry reports tested on React Native 0.86 and 8.25+ carries the iOS fix for RN ≥ 0.86, so 8.31.0 (npm latest on 2026-10-21) was used. `expo install --check` will therefore report this one package as differing from Expo's pin; that is intentional and recorded here. No `expo install` was run, so no other package moved.

**Files.**
- `src/lib/scrub.ts` — the pure allowlist scrubber (`scrubEvent`, `scrubBreadcrumb`, `scrubText`, `scrubUrl`).
- `src/lib/diagnostics-core.ts` — `diagnosticsOptions()`: returns `null` without a valid https DSN; otherwise the reporter settings.
- `src/lib/diagnostics.ios.ts` — the iOS adapter (`initDiagnostics`, `reportError`); never throws; release `barangayan-resident-ios@<version>+<build>` and `dist` = the binary's build number, read from `expo-application`.
- `src/lib/diagnostics.ts` — the no-op used by the web test target (Metro prefers `.ios.ts` on iOS), so the SDK is not in the web bundle.
- `src/app/_layout.tsx` — `initDiagnostics()` at module scope (before the first render) and the root `ErrorBoundary` reports its error, keeping its resident copy.
- `metro.config.js` — `getSentryExpoConfig` (Debug IDs on bundles and maps) in place of `getDefaultConfig`; the web stand-in resolver chains onto it unchanged.
- `app.config.ts` — the `@sentry/react-native/expo` plugin with organization/project/url from `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_URL` (not secret), `useNativeInit: false`, and no token.
- `package.json` scripts `export:ios:maps` and `upload:sourcemaps`; `.gitignore` gains `.env.sentry-build-plugin`.

**Behavior as built.** Nothing starts and nothing is sent unless `EXPO_PUBLIC_SENTRY_DSN` is a well-formed https DSN and the tenant configuration is valid. Settings: `sendDefaultPii` false; screenshots, view hierarchy, accessibility identifiers, failed-request capture, performance/interaction tracing, native frames and stall tracking off; no tracing, replay or profiling rate set; every transaction dropped; sessions and native crash handling on; 30 breadcrumbs at most, and only `navigation` and `app.lifecycle` survive; the only tag is the tenant (barangay id); no `setUser`, context or extra data anywhere. A report is rebuilt from an allowlist (release, dist, environment, level, exception type/message/frames without source or variables, scrubbed breadcrumbs, a few OS/device/app fields, SDK name/version, debug metadata for symbolication) and is dropped if the scrubber fails.

**Found while testing.** The first run of the fixtures showed the scrubber reading the release string `barangayan-resident-ios@1.0.0+7` as an e-mail address. Release, dist and environment (values the app generates) are now passed through unscrubbed and capped at 200 characters; a test pins it.

**Verification 2026-10-21 (iOS workspace).** Typecheck 0; lint 0; tests **741/741** in 36 files (was 725/725 in 34: `diagnostics.test.ts` 12 and `diagnostics-ios.test.ts` 4 added), covering each scrubbing rule on fixtures with a JWT, e-mail, Philippine mobile and landline numbers, record UUID, signed storage URL, coordinates, a six-digit code, a password field and a device name; the allowlist (user, request, extra, server name, source lines and frame variables all absent); breadcrumb filtering; fail-closed on a throwing event; no initialization or capture without a DSN, with an invalid DSN, or with an invalid tenant; one initialization with the right release/dist/environment/tenant and no user; a thrown reporter fault never reaching the app; and source scans that the SDK is imported only by the adapter and its typed options, that no `setUser`, `setContext`, `setExtra`, `addBreadcrumb`, `captureMessage` or `sendDefaultPii: true` exists, and that the auth token is not in the app configuration. `expo export --platform ios --source-maps` 0: the map carries a Debug ID, the bundle contains the SDK, the scrubber and the iOS adapter, and the no-op adapter is absent. `expo export --platform web` 0, with no SDK in the web bundle (only the harmless Debug-ID snippet that Sentry's Metro helper injects). The generated configuration differs from the earlier baseline only by the added plugin entry (Info.plist keys and entitlements unchanged). The bundle holds no auth-token string or key-shaped secret. Android, resident-web and admin-web `tsc` 0; shared `tsc` unchanged at its 5 existing errors. Running `sentry-expo-upload-sourcemaps` without an organization stops with a clear message and sends nothing.

**Not done, and why (Pending).**
- No Sentry organization, project or DSN exists yet, so **no event has ever been sent or received**; the reporter is dormant. **Pending owner:** create the project in the chosen region, set `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (and `SENTRY_URL` for a non-default region) in the build environment.
- Server-side settings (prevent storing IP addresses, default and sensitive-field scrubbing, shortest retention, restricted members), alert rules and their thresholds, the data-processing agreement, and the privacy-policy/App Privacy disclosures remain **owner actions** (PR-07, P18-T07, P20-T02, P20-T06).
- `SENTRY_AUTH_TOKEN` was neither created nor read. The source-map upload step (`npm run export:ios:maps` then `npm run upload:sourcemaps`) has not been run against Sentry.
- A real JavaScript crash symbolicated in Sentry, and a real native crash with symbols (dSYM upload through the Xcode phase the plugin adds), need the DSN, the token and a native build: **Pending / Skipped (OD-06)**. Early native crashes before JavaScript starts are not captured because native initialization is off.
- No privacy-manifest check of the SDK was done (needs the native project; P20-T02).
