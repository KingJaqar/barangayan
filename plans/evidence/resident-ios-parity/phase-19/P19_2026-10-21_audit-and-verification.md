# Phase 19 — whole-app audit and verification record (2026-10-21)

Requirements: A01–A52 (1,218 checkpoints), R01–R54 + IR01–IR10 + RD01/RD02, M01–M16, T01–T52, F01–F12, G17/G19/G20/G22 and the other gates as listed, handoff D01–D21 / DX01–DX52. Tasks P19-T01…T09. Owner and reviewer: KingJaqar (OD-01).

**Source revision:** uncommitted on base `187a2ab3` (`candidate.json` has the content hashes). **Native build:** none (OD-06). **Backend:** repository migrations `0001`–`0136`; hosted `pwjbucnyqexiepoinoke` at `0134` (read-only list, 2026-10-21); Edge Functions as in `candidate.json`. **Environment:** disposable clone of the local development database (`p19_final`, dropped after the run), isolated Edge Function unit tests, localhost tooling; no hosted write, no deployment, no commit. **Device/OS:** none (OD-06, OD-14).

## 1. How the phase was run

Git baseline (patch and content hashes of every tracked and untracked input, saved outside the repository) → ripgrep and TypeScript-AST discovery over the live tree → existing phase indexes reused (execution ledger, parity/route/modal ledgers, Phase 17/18 records) → scoped reads of the files each audit question needed (`app.config.ts`, `release-gates.ts`, `runtime.tsx`, the route tree, `theme.ts`/`palette.ts`/`color-math.ts`, the tests list) → original-source verification of every finding. Repomix 1.18.1 is installed and was verified, but no packet was generated: the audit questions were answered by deterministic scripts that read the working tree directly, which is a smaller and more exact input than a compressed XML copy of the same files. Nothing in this record depends on a stale packet.

`AGENTS.md` is empty in the working tree (the working copy deletes its 11 lines against HEAD, a change that predates this phase and was left alone). `CLAUDE.md` only imports it. There was therefore no repository instruction to reconcile with the plan.

**Entry.** The plan requires the exits of Phases 1–18. They are Verified (non-device) or Partially complete as recorded in the plan; the open exits (hosted deployment of `0135`/`0136` and two Edge Functions, seven closed feature gates, PR-06, PR-13, device and live runs) are carried as blockers exactly as Phases 4–18 carried theirs. The phase therefore audits and qualifies; it cannot close the gates.

## 2. Baseline versus final

| Check | Baseline | Final |
|---|---|---|
| iOS `tsc --noEmit` | 0 errors | 0 errors |
| iOS `eslint .` | 0 problems | 0 problems |
| iOS `vitest run` | 33 files, 719/719 | 34 files, 725/725 (`tests/whole-app.test.ts`, 6 new) |
| `expo export --platform ios` | 0 | 0 |
| `expo export --platform web` | 0 | 0 |
| `expo config --type introspect` | — | identical to baseline (the generated configuration did not change) |
| shared `tsc` | 5 existing errors (`FileReader` ×2, `service-catalog.test.ts` ×3) | unchanged (not touched) |
| shared `vitest` | 34 files, 527/527 | not rerun (no shared change) |
| resident-web / admin-web / Android `tsc` | 0 / 0 / 0 | not rerun (no change) |
| Android `vitest` | 25 files, 260/260 | not rerun (no change) |
| Edge Function unit tests (`--dir supabase/functions`) | 8 files, 136/136 | not rerun (no change) |

## 3. Findings

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| P19-F01 | A fixed white checkmark was drawn on every accent swatch (Appearance presets, saved custom colors, introduction accent picker). On a light custom or preset color (for example `#FDE047`) the mark is invisible, which breaks the "follows the user's accent" requirement and G22 contrast. | Medium | **Fixed.** `readableForeground()` (`src/lib/color-math.ts`) returns the better of white or black by WCAG contrast; the three sites use it. Tested for every preset and two edge colors. |
| P19-F02 | The execution ledger still showed Phase 10 and its eight tasks as `Planned` although the plan records Phase 10 as Partially complete (T01–T03, T05–T07 verified, T04 partial, T08 skipped). | Low (documentation) | **Fixed** in `execution-ledger.csv` (see §8). |
| P19-F03 | The app has no crash or error reporter, no symbolicated crash path and does not report a release identifier. The only handling is the router `ErrorBoundary` ("Something went wrong. Your action has not been confirmed."). | High for G20 | **Closed by owner decision, not by a fix (OD-18).** The owner chose a hosted reporter (OD-17), which was built and verified, then decided against any crash reporter and had it removed. Accepted: production crashes are invisible unless a resident reports them and the crash-diagnostics condition of G20 is unmet by design. |
| P19-F04 | The generated `Info.plist`/entitlements carry placeholders and development values: bundle identifier `com.placeholder.appid` (PR-02), URL scheme `com.placeholder.appid` (PR-03, skipped by OD-07), `aps-environment: development`, plus the Expo dev-launcher local-network strings (`NSBonjourServices`, `NSLocalNetworkUsageDescription`) because `expo-dev-client` is a dependency. ATS forbids arbitrary loads (local networking allowed). | Medium, release-only | **Open, carried to P20-T01** (inspect the signed candidate). Not changed: it needs Apple identifiers the plan does not supply. |
| P19-F05 | `expo install --check` lists 13 packages behind the SDK 57 patch set (including `expo` 57.0.10 vs 57.0.30 and `react-native` 0.86.2 vs 0.86.3). | Low | **Recorded (P01-D04).** Upgrading changes resolved versions, which OD-08/OD-09 forbid without a new decision. Output: `P19-T07_expo-install-check.txt`. |
| P19-F06 | `check:release` fails as designed: six release variables are missing and seven gates are closed (`householdEditing`, `privateIdUploads`, `mapProviders`, `publicIncidents`, `completeExport`, `accountDeletion`, `remotePush`). Output: `P19-T07_check-release.txt`. | — | **Expected.** A source-only checker is not release approval. |
| P19-F07 | Two other workspaces have failing unit tests that this phase did not touch: resident-web `tests/search.test.ts` ("shows current charter pricing…" expects "₱10 per confirmed billable page…", the code prints "₱10.00 per page…") and admin-web `tests/table-browse/record-lifecycle.test.ts` ("keeps versioned request snapshots…" expects two editable request fields, the editor now exposes seven after migration `0133`). | Low (out of scope) | **Pre-existing, not fixed.** Listed under out-of-scope issues. |
| P19-F08 | Route shape differences from the plan's B.2 table, all converged on purpose: `/emergency/qr-guide` and `/emergency/scan` are `/emergency?section=qr`; `/inbox` is `/notifications`; no `/inbox/[entryId]`; no `/services/request/[id]/review` path (an in-screen review step); `/health/register/[id]` carries the id in the path instead of `?driveId=`. Android path-shaped links cannot arrive anyway because no URL scheme exists (OD-07). | Low | **Recorded** in `coverage-report.md`; no change. |
| P19-F09 | WebView map pins, the boundary outline and the route line use fixed colors (`#0D6B59`, `CENTER_COLOR`, kind colors) rather than the resident's accent. They are semantic map colors (kind, center, user location) rendered inside Leaflet, not surfaces of the app theme. | Low | **Observation**, not changed. |

No Critical defect was found. The only High item (P19-F03) is a missing capability that the owner has chosen not to build (OD-18).

## 4. Tasks

### P19-T01 — audit against the checkpoints, routes, modals and dispositions

Tool: `audit.mjs` (rerunnable, exits 1 on any unresolved route, modal, locator or drifted total). Result 2026-10-21, exit 0:

- **1,218 / 1,218 checkpoints** joined to an owning phase and its ledger status, the closed feature gates of its section, its Android state, its §6.8 disposition, its D/DX/T/F/G/B mapping and the tests that name it (`checkpoint-coverage.csv`, 1,218 rows). Every one of the 52 sections maps to existing implementation files.
- **Routes:** R01–R54 + IR01–IR10 = 64 resolved to an existing iOS file whose content matches the outcome; RD01/RD02 are the two deferred untriaged deltas (OD-03). Every iOS route file is a ledger row or a documented legacy alias; none is orphaned. Every internal route string in the source resolves to a route file (also enforced by `tests/whole-app.test.ts`).
- **Modals:** M01–M16, 16/16, each mapped to existing implementing files.
- **Gates:** 7 open by owner decision (`qrph`, `pickup`, `routeService`, `emergencyContent`, `evacuationCheckin`, `householdQr`, `medicalRegistration`; OD-09…OD-13) and 7 closed; the audit maps every gate to the sections it governs and fails if a gate has no mapping.
- **Evidence strength (not a behavior verdict):** class A 15 (a test names the checkpoint, its phase is verified, no gate of its section is closed), class B 254 (named by a test, but the phase is partial or a gate is closed), class C 949 (only a test of the same section or T-family), class D 0. **949 checkpoints rest on family-level evidence; per-checkpoint evidence mapping, which C.1 requires, is not complete.** That is the gap that keeps G17 unready.
- No working capability was excluded. The two deferred deltas stay deferred by OD-03.

**Status: Partially complete.** The structural audit is complete and repeatable. A per-checkpoint behavioral review of all 1,218 rows was not performed in this phase; behavior remains evidenced by each phase's tests and records.

### P19-T02 — T01–T52 and F01–F12 across workflows

Automated coverage run today: 725 iOS tests (34 files) across every feature family, shared 527, Android 260, Edge Functions 136, and the database suites in T03. New in this phase: route integrity over every navigation target including the five notification destinations (F01), accessibility semantics (F12), theme-token discipline (F12/G22). The 4.5 cross-phase matrix is mapped in §6. Cold, warm, More-overflow, interrupted-sheet and state-restoration paths, Allow Once, camera and keyboard behavior need a device: **Pending device (OD-14)** with the steps in §9.

**Status: Partially complete.**

### P19-T03 — resident→staff→resident journeys

Mocks were not used for the database half. On a disposable clone of the development database with migrations `0118`–`0136` applied (all 19 exit 0) the pgTAP suites ran with real security-definer functions, roles and RLS: **826 assertions in 22 files, 0 failures** (`resident_account_setup` 30, `resident_apple_account_setup` 37, `resident_directory_admin_visibility` 21, `resident_email_verification` 13, `resident_front_id_submission` 26, `resident_household_conditional` 22, `resident_ios_phase17_notifications` 121, `resident_ios_phase18_account_deletion` 56, `resident_ios_phase3_backend` 86, `resident_ios_phase3_requests` 28, `resident_ios_phase3_storage` 24, `resident_ios_tenant_write_guards` 7, `resident_profile_conflict` 16, `rls_isolation` 17, `service_foundations` 115, `trusted_evidence_locality` 11, `unreferenced_upload_objects` 7, `google_minimal_profiles` 42, `registration_maps_auth` 23, `deferred_profile_completion` 18, `document_charter_forms` 41, `automatic_document_payments` 65). The parallel-session proof `resident_ios_phase3_concurrency.mjs` passed **7/7** (one attendance row from parallel check-ins, exactly three registrations accepted with unique applicant numbers, one corroboration, one token owner, one household save wins and one conflicts).

Not run, and why: the iOS adapters against the **hosted staging** backend (the plan records no staging project; the only known project, `pwjbucnyqexiepoinoke`, holds the barangay's real data, and writing to it is not authorized); real PayMongo settlement and webhook replay (P10-T04, PR-08/PR-09); staff-side screens in admin-web driven end to end; the `*.auth.mjs`/`*.hosted.mjs` scripts (they need a running GoTrue or the hosted project). These are **Pending web/Pending device (OD-14)** or Skipped (OD-07).

**Status: Partially complete.**

### P19-T04 — offline, stale, concurrency, upload, cleanup, upgrade, account switch

Covered by existing automated tests, reviewed again against the 4.5 list (§6), plus the concurrency run above. Source review of the account-switch and logout seams: sign-out releases the push token first, revokes locally, clears the Keychain session and auth hints, Apple code, protected drafts and the private temporary folder, and any session that ends without the app's own logout is reported once; a new account purges the previous account's drafts and files; launch purges leftover files; a fresh install clears Keychain drafts (`src/lib/runtime.tsx`). Process termination, reinstall, upgrade from an earlier pilot (none exists) and real offline behavior are **Pending device (OD-14)**.

**Status: Partially complete.**

### P19-T05 — visual and interaction comparison

Source/token/component review done: a new test fails the build if a screen or component uses a literal color outside six fixed surfaces (QR quiet zones, camera, photo viewer, picker gradient) and the swatch checkmark defect was fixed (P19-F01). Typography flows from `useType()` with the resident's font family. Static scan of all 154 `.tsx` files in `src`: every pressable has a role and a name, every text field a label, every `Image` is either labelled, decorative inside a labelled container, or marked as not inverted. Rendered comparison against the Android captures on supported iPhone sizes, every theme/font combination and PR-21's remaining captures: **Skipped (OD-06) / Pending device (OD-14)**.

**Status: Partially complete.**

### P19-T06 — accessibility and performance

Verified in code and tests: a role and a name on every pressable and a label on every text field (`whole-app.test.ts`, which fails the build otherwise), the shared 44-point control size (`layout.controlMin`), contrast of every preset accent in both schemes (`appearance.test.ts`), `FlatList` windowing with incremental paging in the shared `ResourceList`, and a matching cleanup for every `setInterval`, `AppState`/`AccessibilityInfo` listener and realtime channel found by search in `src` (the timeouts without a clear are single-shot, abortable requests). VoiceOver, Full Keyboard Access, largest Dynamic Type, Reduce Motion/Transparency, low-memory and the handoff's measured targets: **Skipped (OD-06) / Pending device (OD-14)**.

**Status: Partially complete.**

### P19-T07 — clean workspace CI

Results in §2 and §3. SDK/config validation: generated configuration unchanged and listed in P19-F04; `expo install --check` (P19-F05). **Public-bundle secret scan** of the final `expo export` output (iOS Hermes bundle and the web bundle): no service-role marker, no `sb_secret_` key (the only hit is the configuration guard's own rejection string), no private-key block, no PayMongo secret, no Apple key material; the only JWT-shaped string is the Supabase **anon** key (`role: anon`), which is public by design. Sanitized diagnostics: no `console.*`, `debugger`, `@ts-ignore`, `eslint-disable`, `any` or TODO in `src` (one line in the generated Leaflet asset only). Backend: §T03. Android/web regression: `tsc` 0 for all three; Android 260/260; resident-web and admin-web each have one pre-existing failing test (P19-F07).

**Status: Partially complete** — the iOS workspace, Edge Functions and database are clean; "clean workspace CI" is not literally true while P19-F07 and the five shared `tsc` errors exist, and none is caused by the iOS work.

### P19-T08 — crash handling, redaction, alerting

**Update 2026-10-21 (OD-17, then OD-18):** a hosted crash reporter was built and tested as the owner first approved, then the owner decided against crash reporting altogether and it was removed (see `P19-T08_2026-10-21_crash-reporting-plan.md`, withdrawn, kept as history). Nothing was ever sent anywhere. The original finding follows.

What exists and was reviewed: the root `ErrorBoundary`, typed failure classification with resident-safe copy (`outcome.test.ts`), the notification sender's receipt handling (Phase 17 record and `notification-worker.test.ts`), and no console output at all in `src`, so nothing sensitive is logged. What does not exist: a crash reporter, source-map/dSYM upload, release identifiers in telemetry, and mutation/upload/payment/push dashboards and thresholds (those are operating artifacts owned by PR-07 and P20-T06). **Owner decision needed:** see §9.

**Status: Skipped for the reporter (OD-18).** Redaction/identifier and symbolication parts do not apply without a reporter; dashboards, thresholds and runbooks for failed mutations, uploads, payments and push remain PR-07 and P20-T06 work.

### P19-T09 — candidate freeze

`candidate.json` (from `freeze.mjs`) records the base commit, content hashes of the iOS workspace (343 files at the time of this record; refreshed after the removal, see `candidate.json`), shared package, migrations, Edge Functions and tests, the lockfile hash, repository and hosted migration state, hosted function versions and the toolchain. It is a **source candidate**: uncommitted (committing is not authorized), no build, no `ios-rc-*` name. Critical/High defects: none open except P19-F03 (blocked) and the carried feature-gate/provider blockers. Lower-risk items have the owner KingJaqar. Any later source or contract change makes `candidate.json` stale and reopens the affected rows.

**Status: Partially complete.**

## 5. Gates (non-device scope; no gate was opened or closed by this phase)

| Gate | State after Phase 19 |
|---|---|
| G17 | Not ready: structure complete and repeatable, 949 checkpoints rest on family-level evidence, seven feature gates closed, device and live evidence absent. |
| G19 | Automated evidence strong (pagination, scoped caches, drafts, cleanup, reconciliation tests; concurrency 7/7); device and offline runs Pending. |
| G20 | Not ready, and its crash-diagnostics condition is unmet by design (OD-18: no crash reporter). Dashboards, alert thresholds and runbooks for mutations, uploads, payments and push do not exist either (PR-07, P20-T06). |
| G22 | Token, contrast, semantics and theme-discipline evidence in code and tests; rendered, VoiceOver and device-size evidence Skipped/Pending. |
| G01, G03–G12, G13, G15, G16, G18, G21 | Unchanged from the owning phase records. |

## 6. 4.5 cross-phase mandatory tests — where each is covered

| Bullet | Automated evidence | Open |
|---|---|---|
| Route/More navigation, return paths, deep links, restoration | `navigation.test`, `routes-p18.test`, `whole-app.test` (route integrity), `auth-recovery` (pending-destination allowlist), `notifications` (tap routing) | More overflow, interrupted sheets, state restoration: Pending device. Deep links: no scheme (OD-07). |
| Email OTP … recovery | `auth-recovery`, `auth-setup`, `auth-provider`, pgTAP `resident_account_setup`/`apple_account_setup` | Real Google/Apple exchange: Skipped (OD-07, PR-06). |
| Double submit, lost reply, expiry, cross-tenant, replay | `outcome` (single flight), `request-submission`, `payments`, `health`, `concerns`, pgTAP `rls_isolation`/`phase3_*`, concurrency 7/7 | — |
| Upload cancellation, MIME, HEIC, size, iCloud, orphans | `files`, `profile` (photo preparation), `concerns`, pgTAP `unreferenced_upload_objects`/`phase3_storage` | iCloud-unavailable and HEIC on device: Pending device. |
| Payment expiry, webhook, races, reopen | `payments` (62) | Webhook replay and settlement: P10-T04 open, Skipped (OD-07). |
| Read/unread, bulk bounds, counters, withdrawal | `reports`, `concerns` | — |
| Cache separation, offline logout, reinstall, termination | `persistence`, `secure-storage`, `notifications` (token retry), `privacy` (temporary files) | Reinstall/termination on device: Pending device. |
| Push delivery, denial, rotation, switching | `notifications` (62), `notification-worker` (18), pgTAP phase 17 (121) | Delivery, denial and Settings changes: Pending device; `remotePush` closed. |
| Export above limits, deletion retries, revocation | `privacy`, `export-function`, `delete-v2.test`, pgTAP phase 18 (56) | Apple revocation PR-06; not deployed. |
| VoiceOver … compact/large iPhones | `whole-app` (semantics), `appearance` (contrast) | On-device: Skipped (OD-06). |
| Upgrade from an earlier iOS pilot | none exists | n/a |

## 7. Acceptance of the phase exit

"All working/approved-corrective A/R/modal outcomes pass and G17/G19/G20/G22 are ready for final same-candidate approval; no disabled required feature, placeholder, ambiguous authority or unresolved Critical/High blocker remains." — **Not met.** Seven required feature gates are closed (`householdEditing`, `privateIdUploads`, `mapProviders`, `publicIncidents`, `completeExport`, `accountDeletion`, `remotePush`); P19-F03 (no crash reporting, by owner decision) leaves G20 unmet; G17's per-checkpoint mapping is incomplete; device, live and hosted evidence does not exist.

## 8. Plan and ledger edits made by this phase

- `plans/Resident_iOS_Implementation_Plan.md`: Phase 19 progress note and task table, status in the §4.2 overview, the header line and the execution-status sentence (Phase 19 Partially complete). No requirement text changed.
- `execution-ledger.csv`: P19 phase and T01–T09 rows updated; P10 phase and T01–T08 rows corrected from `Planned` to the statuses the plan already recorded (P19-F02).
- `phase-19/README.md`: status and evidence index.

**Update 2026-10-21 (OD-18):** the owner dropped crash reporting entirely ("never do sentry project at all, we dont need it"). P19-T08 is Skipped for the reporter part. The question below is answered.

## 9. Pending steps and the one owner question

**Pending device (OD-14)**, in order: (1) a development build on an iPhone with the tenant values; (2) cold/warm launch, More overflow, background/kill/relaunch on each destination; (3) VoiceOver pass over Home → Services → request → payment → Reports → Settings; (4) Dynamic Type at the largest size and Reduce Motion/Transparency on the same path; (5) camera/QR, Photos save, share sheet, location prompts (including Allow Once) and Sign in with Apple; (6) airplane-mode logout then relaunch; (7) reinstall; (8) a 200-row list scroll and a low-memory warning.

**Owner question (blocks P19-T08 and G20).** Which crash and diagnostics approach should the iOS app use? Options: (a) **a hosted crash reporter** such as Sentry (new dependency, an external processor receiving crash data, source-map upload in the build — recommended, because it gives symbolicated JavaScript crashes and release identifiers with the least code, and PII scrubbing can be configured before any release); (b) **first-party only**: write sanitized client error events to a Supabase table through an authenticated insert and alert from the existing notification sender (no third party, but no native symbolication); (c) **defer** G20 and record the app as not production-ready. I did not add any of them.

## 10. Out-of-scope observations (not fixed)

- P19-F07: the resident-web and admin-web test expectations that no longer match their code.
- The five existing shared `tsc` errors (`FileReader`, `service-catalog.test.ts`).
- `AGENTS.md` is empty in the working tree while HEAD holds 11 lines.
- `tmp/valid-id-phase4/before/...` contains an old copy of Edge Function tests that a repository-wide `vitest` picks up and fails on; run with `--dir supabase/functions`.
- The local development database still lacks migrations `0118`–`0136` (it is at `0117`); the previous leftover databases `p03_final` and `admin_profile_test_b2f5f22dfd` were not created by this phase and were not touched.
