# Phase 20 — implementation and verification record (2026-10-21)

Requirements: P20-T01…T09, G01–G22, C.3–C.6, OD-06/OD-07/OD-14/OD-18, PR-01/02/03/06/07/08/09/13/17. Owner and reviewer: KingJaqar (OD-01). **Source:** uncommitted on base `187a2ab3`. **Native build:** none (OD-06). **Backend:** repository `0001`–`0136`; hosted `0134`. **Environment:** local workspace and a disposable database clone (dropped); public Apple/Expo documentation read through a fetch tool; no hosted write, deployment, commit, account creation or submission. **Device/OS:** none.

## 1. How the phase was run

Git baseline (tracked patch, untracked list and a workspace archive saved outside the repository, 625 changed paths, nothing reverted) → ripgrep and direct config/introspection discovery → existing indexes reused (`candidate.json`, ledgers, Phase 19 record, prerequisite and decision registers) → one scoped Repomix 1.18.1 packet (12 files, 9,677 tokens, security check clean; selectors: iOS `app.config.ts`, `eas.json`, `package.json`, `check-release.cjs`, `release-checklist.md`, `release-gates.ts`, `config.ts`, `config.test.ts`, the Phase 0 prerequisite register, `freeze.mjs`, the Phase 20 and evidence READMEs; no omissions) read in bounded entries → original-source verification of every finding (introspected Info.plist/entitlements, native sources of dependencies, migrations `0135`/`0136`, `worker.ts`, screens that read gates).

**Entry check.** Phase 19 is Partially complete, not Verified; its open exits (seven closed gates, undeployed `0135`/`0136` and functions, PR-06, PR-13, device/live/staging evidence) are carried as blockers exactly as Phases 4–19 carried theirs. Phase 20 therefore prepares and reports; it cannot approve gates or release.

**Instruction conflicts.** `AGENTS.md` is empty in the working tree (its 11 lines are deleted against HEAD, a change that predates Phase 19; left alone). `CLAUDE.md` only imports it, so there was no repository instruction to reconcile; the Expo v57 documentation rule from the request was followed: `ios.privacyManifests`, `ios.icon`, `ios.config.usesNonExemptEncryption`, `aps-environment` and the app-config reference were read in the v57 docs before any config reasoning. No Expo/React Native app code changed.

## 2. What changed

| Requirement | Files | Behavior |
|---|---|---|
| T01 | `apps/resident-ios-mobile/scripts/check-release.cjs`, `tests/config.test.ts` | The release diagnostic now also requires `EXPO_PUBLIC_ENVIRONMENT`, rejects a placeholder/malformed bundle identifier and URL scheme, a non-`production` environment and a non-HTTPS Supabase URL; 3 new tests (728 total) |
| T01 | `phase-20/inspect-candidate.mjs` → `inspection-results.json`, `P20-T01_check-release.txt` | Rerunnable inspection of the generated configuration, EAS profiles, source endpoints and the exported bundle (26 checks) |
| T02 | `phase-20/privacy-scan.mjs` → `privacy-scan-results.json` | Dependency privacy-manifest and required-reason lead scan (32 packages) |
| T06 | `phase-20/rollback-0135-0136.sql`, `rollback-rehearsal.sh`, `rollback-rehearsal-result.txt` | Backend rollback for the two pending migrations with an unfinished-deletion guard, rehearsed end to end on a clone |
| All | `apps/resident-ios-mobile/docs/release-checklist.md` | Rewritten: the old checklist referenced migrations `0093`/`0094` and a pre-OD-06 flow |
| All | `P20-T01`, `T02`, `T03`, `T05`, `T06`, `T09` records, this record, `phase-20/README.md` | Evidence |
| T09 | `phase-19/candidate.json` | Refreshed by `freeze.mjs` (workspace content hash `b16a6871…` → `2f4b72fb…`; lockfile and migrations unchanged) |
| Bookkeeping | `execution-ledger.csv`, plan header/§4.2/Phase 20 note | Phase 20 rows and status |

**No new dependencies.** No migration, Edge Function, shared-package, Android or web change. No app-config change: the privacy-manifest and icon changes were deliberately not made (§3, P20-F05/F06).

## 3. Findings

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| P20-F01 | Bundle identifier is the placeholder `com.placeholder.appid` | High for release | Open — needs the approved App ID (PR-02); the release diagnostic now rejects it |
| P20-F02 | URL scheme is a placeholder | Medium | Open — PR-03 skipped (OD-07) |
| P20-F03 | `aps-environment` is `development` in the generated entitlements | Low | Documented by Expo (Xcode switches it in a release archive); not observable without a signed archive |
| P20-F04 | `ITSAppUsesNonExemptEncryption` undeclared | Low | Owner's legal declaration; analysis suggests exempt (T02 §6) |
| P20-F05 | No App Store icon; the preserved logo is RGBA with transparent corners | High for release | Open — artwork needs owner approval (T02 §8); no icon was generated or wired |
| P20-F06 | No app-level `privacyManifests` | Medium | Open — Apple's allowed data-type identifiers could not be read from any page the tool returned, so none were guessed; labels drafted for App Store Connect |
| P20-F07 | The release checklist was stale (migrations `0093`/`0094`, signed-build flow) | Low (documentation) | **Fixed** |
| P20-F08 | Dev-client Info.plist keys (`NSBonjourServices`, `NSLocalNetworkUsageDescription`) in the generated plist | Low | Informational: the native module is Debug-only; the other defaults are Expo's |
| P20-F09 | **Account deletion is not reachable in the app** while `accountDeletion` is closed (the Settings row is hidden); `0136`, the v2 function and Apple revocation are undeployed | High for store review (Guideline 5.1.1(v)) | Open — needs the owner's deployment approval and PR-06; carried to the owner question below |
| P20-F10 | The first rollback script drafted for `0135`/`0136` failed on a real clone: it dropped a function still used by the inbox table's check constraint, leaving 20 functions, 6 tables, 5 triggers | Medium (caught before use) | **Fixed** (tables dropped first); the rehearsal now passes and verifies zero leftovers |
| P20-F11 | `expo-sharing` reads `UserDefaults(suiteName:)` for its share-into feature and ships no privacy manifest | Low–Medium | Pending macOS/Linux prebuild and the Xcode privacy report (T02 §3) |
| P20-F12 | The first bundle secret scan flagged `sb_secret_` — the configuration guard's own rejection prefix, adjacent to another string in the Hermes string table | — | **Fixed** in the scanner (a key needs a digit and 28+ key characters); no secret is in the bundle |
| P20-F13 | The release diagnostic accepted placeholder identifiers and a non-production environment | Low | **Fixed** with tests |

No Critical defect. High items: P20-F01, F05, F09 (all release-only; none is fixable without owner input) plus the standing P19-F03 (no crash reporter, accepted by OD-18).

## 4. Tasks

| Task | Status | Result / remaining work |
|---|---|---|
| P20-T01 | Partially complete | Profiles, generated configuration and exported bundle inspected; diagnostic hardened. Signed-candidate inspection Skipped (OD-06). Open: F01–F06 |
| P20-T02 | Partially complete | Dated rules snapshot, applicability, dependency scan, label draft, age/encryption analysis, asset review. Blocking: F09, PR-06, PR-17, icon. Pending macOS: manifest/privacy report |
| P20-T03 | Partially complete | Gap list, environment needs and note template. Not publishable: no reviewer account, QR, review environment or URLs (owner actions) |
| P20-T04 | Skipped (OD-06) → Pending device (OD-14) | TestFlight needs a signed build |
| P20-T05 | Partially complete | Register and recommendations for all 22 gates and 14 feature gates; no gate approved in this phase (owner's decision) |
| P20-T06 | Partially complete | Owners (single person), proposed thresholds (not instrumented), response and kill-switch matrix, rehearsed backend rollback. No remote client kill switch exists |
| P20-T07 | Skipped (OD-06) | Needs a signed binary; OTA stays disabled |
| P20-T08 | Skipped (OD-06) | Needs a released binary |
| P20-T09 | Verified (non-device scope, OD-06) as a report | C.6 evaluated item by item: 1 met by the record, 1 met for implementation, 5 partial, 1 pending device, 9 not met. The conversion itself is not complete |

## 5. Acceptance (phase exit)

"All mandatory gates/checklists and same-candidate functional/design/device/backend/operating evidence pass; release approval/store status is recorded truthfully and no required feature remains unimplemented or permanently gated." — **Not met.** Seven required feature gates are closed; no device, live or hosted-staging evidence exists; G17, G20, G21 and G22 are not ready or not met; no release approval exists. Store/distribution status is recorded truthfully as none.

## 6. Pending manual verification (exact steps)

1. **macOS/Linux, Xcode 26:** `npx expo prebuild --platform ios` in `apps/resident-ios-mobile`; read the generated `PrivacyInfo.xcprivacy`; add `ios.privacyManifests` reasons for any category not covered (notably app-group `UserDefaults` for `expo-sharing`); archive and run Xcode's "Generate Privacy Report". Needs a new owner decision revoking OD-06 for builds.
2. **Owner:** approve or supply an opaque 1024×1024 icon; create the review environment, reviewer account and QR; publish privacy and support URLs; answer export-compliance and age-rating questions in App Store Connect; decide deployment of `0135`/`0136` and the functions.
3. After deployment approval: rerun `phase-19/audit.mjs`, the pgTAP suites against the deployed state, and `phase-20/inspect-candidate.mjs`; only then reconsider `completeExport`, `accountDeletion` and `remotePush`.

## 7. Out-of-scope issues noticed (not fixed)

Shared `tsc` 5 errors; resident-web 1 failing test; admin-web 1 failing test (P19-F07); SDK 57 patch drift (P01-D04); an unrelated concurrent session's files under `tmp/` and Android settings edits in the working tree.

## 8. Owner question

Deploying `0135`/`0136`, the v2 `export-my-data`/`delete-my-account` functions and `send-notifications` is the single action that would unblock the most (G10, G11, G13, store Guideline 5.1.1(v)); it is outside what this phase may do. See the closing message for the options.
