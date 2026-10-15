# Confirmed-unused Android cleanup — 2026-10-14 continuation

**Source implementation complete.** All specifically permitted O01–O08 files, U01–U08 exports and their dependent code, 21 unused local style keys plus dependent `group`, and F01 are now removed across this run and the earlier 12-style run. Full native/mobile-web journey acceptance remains **pending manual verification**; no full-runtime-safety claim is made.

## Qualification and preserved behavior

The user renewed the instruction to delete only fully safe, completely unused source after discussion of backend safety and historical-verifier effects. Before this batch, current root instructions and phase requirements were read, the current dirty workspace/configuration preserved, exact before-files saved, and fresh baseline checks run. No code was removed because of age, size, a similarly named symbol in another app, or an ordinary text search alone.

- Resolved TypeScript symbols and aliases across **296 source files**; the eight runtime exports have **no consumer**. The associated `PaymentMethodOption` type is consumed only by the removed options constant.
- Checked namespace/star consumers and imports from outside the orphan group, plus Android/web reachability and nonliteral dynamic loading. All eight orphan files are outside both runtime graphs; no active caller was found.
- Rechecked private style access, absent key consumers and passive literal/plain `Spacing` initializers. `group` was consumed only by the unused `ShimmerGroup` removed in the same batch.
- Simulated the exact removal before changing current source: **zero TypeScript diagnostics**. The on-disk batch is byte-identical to those deletion-only prepared files.
- Rechecked active CI/scripts, backend and other applications. Web family/payment helpers are separate files and remain unchanged. Backend references to F01 are historical provenance comments, not executable readers. The active boundary asset retains identical bytes.

Exact eligibility and proposed hashes: [qualification.json](dc-01/qualification.json). Exact reviewed application patch against current pre-cleanup bytes: [cleanup.diff](dc-06/cleanup.diff). Every retained top-level statement/function/component body, remaining import specifier and style value was compared: [retained-statements.json](dc-06/retained-statements.json).

## Removed

| ID | Exact relative path / declaration |
| --- | --- |
| O01 | `apps/resident-android-mobile/src/components/add-family-member-modal.tsx` |
| O02 | `apps/resident-android-mobile/src/hooks/use-family-members.ts` |
| O03 | `apps/resident-android-mobile/src/components/app-header.tsx` |
| O04 | `apps/resident-android-mobile/src/components/hint-row.tsx` |
| O05 | `apps/resident-android-mobile/src/components/settings-row.tsx` |
| O06 | `apps/resident-android-mobile/src/components/onboarding/onboarding-ambient-background.tsx` |
| O07 | `apps/resident-android-mobile/src/hooks/use-color-scheme.ts` |
| O08 | `apps/resident-android-mobile/src/hooks/use-color-scheme.web.ts` |
| U01 | `src/components/reports/shimmer.tsx`: `ShimmerGroup`, its `View` specifier and `group` style |
| U02 | `src/components/services/skeleton.tsx`: `SkeletonGap` and its `View` specifier |
| U03 | `src/constants/payment.ts`: `PAYMENT_METHOD_OPTIONS`, `PaymentMethodOption`, type-only `PaymentMethod` import |
| U04 | `src/hooks/use-theme-preference.tsx`: `normalizeHexColor` |
| U05 | `src/lib/dialog.ts`: `notify` |
| U06 | `src/lib/emergency-cache.ts`: `clearEmergencyCache` |
| U07–U08 | `src/lib/push-notifications.ts`: `getCachedExpoPushToken`, `addNotificationResponseListener` |
| F01 | `apps/resident-android-mobile/SanMateo_Ampid1_GEOjson.geojson` |

Remaining nine local style keys removed: Emergency Hub `centersList`, `centersToolbar`, `alertLinkPressable`, `alertLink`; Home `verificationBanner`, `verificationText`; Maps `pillsScroll`; family content `memberRelation`; announcements `empty`. The preceding run already removed the 12 listed resident-details styles. The dependent `group` is counted separately from the 21 local keys.

This batch removed **40,177 source/duplicate-asset bytes**; cumulative cleanup **41,261 bytes**. Nine full files removed, eight unused runtime exports plus one associated interface removed, 21 local styles plus one dependent style removed. No dependency was added or removed. The saved copies are rollback/evidence, not active application inputs.

Kept: all 56 route/layout paths, component output and handlers, public hook/prop contracts in retained files, loading/error and permission handling, authentication/tenant guards, payment readiness flag, cache and queued check-ins, active household/scanner writers, push-token registration/unregistration and notification delivery, native modules, manifests/lockfile/configuration, fonts/licenses/images/boundary asset, generated outputs and shared/backend/migrations/data. No data-clearing function was executed.

## Verification

| Check | Fresh baseline | Final | Result |
| --- | --- | --- | --- |
| Android TypeScript, current strict project | Pass | Pass | Zero diagnostics |
| Existing mobile suite | 126 tests / 14 files pass | 126 tests / 14 files pass | Same tests, success and exit 0 |
| Scoped ESLint on 13 prospective active files | 0 errors / warnings | 0 errors / warnings | Exact diagnostic equality |
| Android export, run-local writable temp | Pass | Pass | No new warning messages |
| Mobile-web export, same unrestricted output-only workaround | Pass | Pass | Retained CSS/dynamic chunks byte-identical |
| Routes/layout roots | 56 | Identical members | Pass |
| Android/web reachable module/asset sets | 271 / 272 | Identical members | Pass |
| External specifiers | 38 / 38 | Identical members | Pass |
| Nonliteral dynamic loads | None | None | Pass |
| Retained statements/functions and remaining styles | Baseline bytes | Identical retained text | Pass |
| Active asset hashes | Baseline bytes | Identical | Pass |
| Protected source/configuration/backend/env | 5,042 inputs hashed | No unexpected active-input change | Pass; concurrent iOS documentation recorded separately |
| Historical verifier, generator and original index | Baseline hashes | Identical | Preserved, not run against current checkout |
| Narrow native/mobile-web journey matrix | Not fully qualified | Not fully qualified | Pending manual verification |

The only removed dependency edge is `skeleton.tsx`'s unused runtime `react-native` import after removing `View`; its remaining imported types do not generate runtime imports. Global external/reachable sets remain identical, and React Native remains loaded by active consumers. [47-check structural/preservation comparison](dc-06/comparison.json).

Fresh measured Android Hermes bundle: **8,085,535 → 8,081,904 bytes (−3,631)**. Web entry: **5,307,039 → 5,305,154 bytes (−1,885)**. Android asset metadata and other web chunks are identical. These are this run's measurements, not APK savings or a sum across differently generated Hermes outputs. [Metrics](dc-06/metrics.json).

The first full hash comparison flagged nine concurrent iOS documentation/ledger updates. Those files were not edited, restored or deleted by this cleanup. The raw failing comparison is preserved in [comparison-initial.json](dc-06/comparison-initial.json). The resolved comparison distinguishes unrelated concurrent documentation from active app/configuration/backend drift; it does not rewrite historical hashes or conceal source drift.

**Late concurrent-source refresh:** a subsequent final snapshot also flagged new external edits in iOS app/configuration files, web incident reports, an admin routing editor, the lockfile, and the shared evacuation-center facility enum. The shared change expands valid facility codes; this cleanup did not author it. These files were preserved. The raw whole-snapshot preservation check is therefore **flagged**, not a clean immutable-checkout pass. All deletion targets still match their exact prepared bytes and no unexpected Android input change was found. Mobile typecheck, the 126-test suite and scoped lint were refreshed against the current shared code and passed; fresh export rechecks are recorded under `dc-06-refresh`. The original measured bundle deltas above describe the earlier controlled snapshot, before these late external edits, and are not reassigned to later bundles. Scoped deletion/retained-code checks remain passing; full-checkout drift is reported separately in [comparison.json](dc-06/comparison.json) and the final machine record.

The refreshed **Android and web exports also passed**, completing all five current compatibility rechecks. The final target check confirms every prepared edited file still has its exact expected hash, all nine deleted paths are absent, and the active boundary asset has its original hash. [Final target check](dc-06/final-target-check.json), [final execution record](dc-06/results.json). No failed whole-snapshot check is relabeled as a passing immutable-checkout check.

## Historical tooling and authorization

The old `phase0-verify.cjs` explicitly describes an archival integrity check and asserts its original checkout's exact source hashes and Git-diff boundary. It is not called by current CI/package quality scripts, and that original context already differs from today's checkout. Its script, index and existing evidence remain unchanged. Exact matching historical bytes for all 20 affected indexed candidates remain in the [preceding run's candidate archive](../2026-10-14-083944-dc/dc-01/historical-candidate-bytes); current pre-removal bytes remain in this run's `dc-00/before`.

**Decision:** the renewed conditional deletion instruction was evaluated against active application/backend/test/build consumers, while preserving the historical bytes for archival use. The historical checker is not a current-checkout feature gate. This does not certify a full original 758-input checkout or a passing historical-verifier replay; four unrelated original inputs remain unqualified, as recorded previously. Deleting current source paths changes that archival check's current-path/hash expectations, not any active backend function. That distinction was explained before the user renewed deletion authorization.

The earlier F01 automatic review rejection is resolved: this user-authorized literal-path removal was accepted after fresh comparison against both the active identical asset and exact rollback bytes. F01's SHA-256 is `c42c1efe1a9d2dd1357d64c197eaa6126ad4a982e29d9dbcef973f0587d13bb4`; both retained copies are present. [Removal record](dc-04/boundary-removal.json). No database/storage/queue record was deleted.

## Acceptance and phase status

| Criterion | Status |
| --- | --- |
| Stable current automated baseline and exact recoverable before-bytes | Met; full journey baseline pending |
| Every selected source/symbol/style has no active required consumer | Met |
| Only exact permitted declaration/type/import/style/file deletions | Met |
| Retained statements, style values, contracts, route registration, data and protected inputs preserved | Met |
| No additional type/lint/test/build failure or export warning | Met |
| All nine fresh-bundle native/mobile-web journeys exercised with logs | Pending manual verification |
| Exact diff, measurements, concurrent work, archival limitation and rollback documented | Met |

DC-01 through DC-04 are **Complete** for the full named source-deletion scope. DC-00's automated baseline is complete but its full journey baseline remains pending. DC-05 automated verification is complete; full smoke remains pending. DC-06 source review/evidence is complete; full runtime-qualified closure remains pending. Overall execution-plan status: **Partially complete solely for manual runtime qualification**; no source-deletion or approval hold remains.

## Pending manual steps and out-of-scope issues

A new localhost preview used the installed SDK's documented `EXPO_OFFLINE` environment setting and a cold launch. Android reported **“Intent does not match any activities”** for the development-client link, before any fresh bundle executed. The normal launcher activity exists and was requested again. The temporary preview process and its sole 8160 forwarding rule were removed; no app data was cleared or native shell installed/modified. No fresh native journey is marked passed.

1. Use a matching SDK 57 native shell with a working registered development-client link, or package the saved `dc-05/android-export-temp` bundle. Confirm the actual bundle/inspector target belongs to this source, not cached port 8083.
2. With controlled local/synthetic accounts, compare cold/warm startup, guest/login/recovery/setup restoration and Home/Services/Maps/Health/Reports/Settings against the saved baseline export and before-source; capture console/device logs.
3. Exercise Emergency Hub hotlines/guidelines, Centers/offline maps, location/camera allow/deny, family/QR guide/scanner and queued recovery without production writes.
4. Exercise synthetic request/payment errors and gating, receipt/data export/sharing, profile/account settings, valid ID and both birthday controls; verify loading/empty/error cases.
5. Open all compatibility/placeholder paths and verify unchanged content, redirects and guards.
6. Serve `dc-05/web-export-unrestricted` with SPA fallback and compare tabs, splash, external-link consumers, feeds/filters, dynamic PDF flows and the same guest/authenticated/error journeys with `dc-00/web-export-unrestricted`.

Native-shell/link compatibility, original historical snapshot recovery, broader dormant hook/API/queue work, route retirement, dependency/font optimization and generated-output cleanup remain outside this deletion-only scope. The cancelled Android usability phase was not resumed. No commit, push, deployment, migration application, external-service configuration change or third-party message was performed.
