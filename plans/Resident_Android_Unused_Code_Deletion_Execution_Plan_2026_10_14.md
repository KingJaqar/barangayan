# Resident Android unused-code deletion execution plan

**Created:** 2026-10-14, Asia/Manila  
**Workspace:** `C:/Users/User/barangayan`  
**Application:** `C:/Users/User/barangayan/apps/resident-android-mobile`  
**Status:** Source implementation complete, 2026-10-14. All named O01–O08, U01–U08/dependent code, 21 local style keys/dependent group, and F01 removed after renewed unused-source authorization and fresh qualification. Automated checks pass. Overall phase acceptance remains partially complete solely for full native/mobile-web smoke verification. See the continuation record below.

## Objective and controlling documents

Remove only qualified unused source code/files while preserving resident Android behavior, mobile-web compatibility, existing routes, build configuration, active tooling, stored data, and all unrelated work.

The controlling inventory is [the code and file bloat audit](C:/Users/User/barangayan/plans/Resident_Android_Code_and_File_Bloat_Audit_2026_10_14.md), especially its **section 0 strict deletion-only revision**. The earlier [in-memory safety evidence](C:/Users/User/barangayan/plans/evidence/resident-android-bloat-audit/strict-deletion-safety-2026-10-14.json) supports candidate selection but is not an authorization to delete or a substitute for a fresh baseline.

This plan does not start or resume the permanently cancelled Phase 8 Android usability audit in `C:/Users/User/barangayan/plans/Major_Web_AndroidMobile_Improvement_Plan.md`. The phases below use `DC` identifiers and contain no usability redesign, interaction-standard rollout, or general Android refactor.

## Current facts that determine the sequence

- The previous in-memory strict cleanup passed all 126 existing mobile tests in 14 files, with zero normal TypeScript diagnostics before and after.
- Scoped lint on 13 affected active files had the same 71 existing errors before and after; it did not introduce diagnostics and was not a clean lint pass.
- Android and web reachable module sets, external import sets, 56 route/layout roots, and retained top-level functions were unchanged in that simulation.
- All eight orphan paths and 12 of the 13 active-file candidates are present in the historical source index used by `C:/Users/User/barangayan/scripts/phase0-verify.cjs`. That verifier directly reads paths and checks their hashes.
- At plan creation, `C:/Users/User/barangayan/apps/resident-android-mobile/app.json` differed from the earlier evidence hash. Preserve that current change. Refresh the baseline; do not restore old configuration to make old evidence match.
- The audit's broad inventory includes items deliberately excluded from this execution plan. A large file or an absent ordinary import does not establish deletion eligibility.

## Phase order and tracking

| ID | Execution phase | Dependencies | Exit requirement | Current status |
| --- | --- | --- | --- | --- |
| DC-00 | Refresh and preserve the current baseline | Later instruction to execute cleanup | Current hashes, references, tests, diagnostics, routes, and rollback material recorded | Partially complete — automated baseline/recovery preserved; qualified journey baseline pending |
| DC-01 | Resolve historical tooling and qualify each candidate | DC-00 | Each selected removal has no active app/test/tool consumer, or is explicitly retained | Complete — all named removals qualified against active consumers; original bytes archived |
| DC-02 | Remove qualified unused declarations and their dependent dead code | DC-01 eligibility for each item | Exact declaration-only diff; no type/lint/structural regression | Complete — U01–U08 and listed dependent code removed |
| DC-03 | Remove qualified unused local style definitions | DC-01 and DC-02 | Only listed unused keys removed; remaining values/functions unchanged | Complete — 21 keys removed; dependent group removed in DC-02 |
| DC-04 | Delete qualified orphan files and optional duplicate boundary source | DC-01 through DC-03 | Exact qualified paths removed; active asset and dependency graphs preserved | Complete — O01–O08 and F01 absent; active assets/data intact |
| DC-05 | Verify the resulting application and builds | All selected removals complete | Current tests/types pass; no new lint failure; Android and web compatibility checks pass | Partially complete — automated checks/exports pass; smoke pending |
| DC-06 | Review, document retained items, and close the selected cleanup | DC-05 | Diff matches scope, original work preserved, evidence and remaining holds recorded | Partially complete — source scope/evidence complete; full runtime-qualified closure pending smoke |

Execution proceeds in this order. An unqualified candidate remains unchanged. It is valid to finish a qualified subset while recording held candidates, but not to claim that every audit finding was removed.

## Global scope restrictions

The only permissible application changes are deletion of qualified O01–O08 files, qualified U01–U08 declarations and their specifically listed dependent dead code, qualified local style keys, and separately qualified F01. Preserve all other source text except the minimal syntax adjustments required by those deletions.

Keep every route/layout file, redirect, guard, hook return/prop contract, current handler/effect, permission branch, package manifest, lockfile, native dependency, icon import form, Expo/Metro configuration, environment setting, backend file, migration, table, persisted record, queue, and generated/historical artifact.

Do not add replacement components, wrappers, feature flags, redirects, UI fixes, dependencies, or new test assertions that merely mirror a deletion. Use the existing relevant tests and structural comparisons. A newly discovered defect is a retained, separately documented finding rather than permission to fix it during cleanup.

## DC-00 — Refresh and preserve the current baseline

### Work

- [x] Read `C:/Users/User/barangayan/AGENTS.md` and the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing source.
- [x] Record the current Git revision, pre-existing modified/untracked files, and current app/shared configuration. Do not require a clean checkout or discard unrelated work.
- [x] Save hashes and exact before-content or a recoverable patch for each prospective deletion/edit. Include currently uncommitted content; Git HEAD alone is insufficient rollback material.
- [x] Refresh Android/web import reachability, dynamic imports, `require` calls, tests, script references, route roots, active asset paths, and native/build metadata references.
- [x] Refresh the hash map for affected files and protected inputs, including `app.json`, `app.config.js`, `metro.config.js`, `package.json`, `package-lock.json`, route/layout source, shared source, and active assets.
- [x] Run normal Android type checking and the existing mobile test suite using the existing test configuration. Record the actual current test count instead of assuming it remains 126.
- [x] Record scoped lint diagnostics on the eventual affected active files. Compare exact diagnostics, not only their total count.
- [ ] Record the current behavior of the narrow smoke-test journeys in DC-05 using controlled test state. Do not evaluate or redesign usability.
- [x] Store new baseline evidence under a new run directory such as `C:/Users/User/barangayan/plans/evidence/resident-android-bloat-audit/execution/<run-id>/dc-00/`. Do not overwrite the earlier evidence or reuse a populated run directory.

### Exit gate

Every selected input is recoverable, baseline results are known, and source hashes are stable. If another task changes an affected/protected file, refresh the applicable checks before editing it. Current configuration changes belong to the baseline and must survive cleanup.

## DC-01 — Resolve historical tooling and qualify each candidate

### Historical verifier decision

- [x] Inspect `C:/Users/User/barangayan/scripts/phase0-verify.cjs`, `C:/Users/User/barangayan/scripts/phase0-inventory.cjs`, and `C:/Users/User/barangayan/plans/evidence/phase0/source-index.json` without running scripts that overwrite their evidence.
- [x] Determine whether each reference is active runtime/build/test input, a current verification requirement, or a historical snapshot comparison. Search current scripts and CI callers as well as ordinary imports.
- [x] Record candidate-by-candidate eligibility. An indexed candidate cannot be treated as unreferenced by all tooling.
- [x] If the historical verifier must operate against the current checkout with its original path/hash expectations, retain affected indexed candidates. This plan does not authorize changing that verifier, rewriting its hashes, or weakening its assertions.
- [ ] If it is established to be an archival check for its original source state, document the matching preserved snapshot and its intended verification context. Do not fabricate a matching snapshot from the current working tree. The index records historical Git revision `fb49ecd937c8ceaa6263521f40f84fae05bfe621`; that revision alone is not proof that all indexed uncommitted bytes can be reproduced.
- [x] Do not rerun a historical inventory generator in place to redefine old evidence as current evidence.

### Source eligibility checks

For each candidate, confirm no runtime, dynamic, reflection, namespace, test, script, configuration, or active tooling consumer requires the deleted file/symbol/key. For a style key, confirm the private style object is not exported, enumerated, spread, aliased, passed wholesale, or accessed through unknown keys. For removed initializers, confirm passive literal data and plain spacing reads rather than effects, getters, or registrations.

### Exit gate

Produce an exact **eligible / retain / hold** list with evidence and expected effects. Resolve archival-tool compatibility explicitly; runtime graph equality does not resolve a file/hash verifier dependency. Candidates that fail the gate remain unchanged and do not enter later removal phases.

## DC-02 — Remove qualified unused declarations

Remove only eligible rows. Do not delete any containing active file.

| ID | Exact file path | Permitted declaration removal | Dependent removal in the same batch |
| --- | --- | --- | --- |
| U01 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/shimmer.tsx` | `ShimmerGroup` | Unused `View` import specifier and `styles.group`. Keep `Shimmer` and `styles.base`. |
| U02 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/skeleton.tsx` | `SkeletonGap` | Unused `View` import specifier. Keep `SkeletonBlock`, its effect, and spacing defaults. |
| U03 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/constants/payment.ts` | `PAYMENT_METHOD_OPTIONS` | `PaymentMethodOption` interface and unused type-only `PaymentMethod` import. Keep `PAYMENT_SETTLEMENT_READY` exactly as it is. |
| U04 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-theme-preference.tsx` | `normalizeHexColor` | No broader theme/provider/API change. Keep `isValidHexColor`, custom colors, and persistence. |
| U05 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/dialog.ts` | `notify` | Keep `confirmAction` and platform confirmation behavior. |
| U06 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/emergency-cache.ts` | `clearEmergencyCache` | Keep cache read/write, queue read/write/clear methods, and stored data. |
| U07 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/push-notifications.ts` | `getCachedExpoPushToken` | Keep cached token state, registration/unregistration, and notification gates. |
| U08 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/push-notifications.ts` | `addNotificationResponseListener` | Keep active notifications logic. Do not add or alter notification routing. |

### Verification and exit gate

- [x] Diff contains only selected declaration/type/import removals and the U01-dependent unused style. U01–U08 and the associated interface/imports/group are removed in the continuation; retained statements are text-identical.
- [x] All retained top-level functions, component output, handlers, effects, and active initializers are unchanged.
- [x] No route, public hook/prop contract, module side effect, or active import disappears.
- [x] Normal type checks and scoped lint introduce no new diagnostic relative to DC-00.
- [x] Record the actual removed rows and hashes; retain rows that are newly used or unqualified.

## DC-03 — Remove qualified unused local styles

The 21 keys below are the exact style-only candidate set. U01's dependent `group` style belongs to DC-02 and must not be counted twice.

| Exact file path | Permitted unused style keys |
| --- | --- |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx` | `centersList`, `centersToolbar`, `alertLinkPressable`, `alertLink` |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/index.tsx` | `verificationBanner`, `verificationText` |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx` | `pillsScroll` |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/family-content.tsx` | `memberRelation` |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/announcements-feed.tsx` | `empty` |
| `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx` | `passwordMatchIndicator`, `successModalBackdrop`, `successModalCard`, `successIcon`, `successModalTitle`, `successModalMessage`, `successModalActions`, `successModalActionButton`, `formError`, `submitActions`, `footerRow`, `footerText` |

### Verification and exit gate

- [x] Recheck exact key references and whole-object/dynamic access immediately before removal.
- [x] Delete only eligible property definitions; preserve their containing files, style objects, remaining key/value order, values, and imports still used elsewhere. All 21 listed keys are removed across both runs; no other style changed.
- [x] Preserve look-alike active styles such as `pillsScrollFloating` and `memberRelationRow`.
- [x] Confirm no component body, JSX, event handler, animation, effect, layout configuration, or spacing constant changed.
- [x] Normal type checks and scoped lint introduce no new diagnostic.
- [x] Compare Android/web route roots, reachable module sets, and external import sets to DC-00. Equality means identical members, not just equal counts.

## DC-04 — Delete qualified orphan files and optional duplicate boundary source

Delete only individually qualified exact paths; no directory-wide cleanup is allowed.

| ID | Exact full-file candidate path |
| --- | --- |
| O01 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/add-family-member-modal.tsx` |
| O02 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-family-members.ts` |
| O03 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/app-header.tsx` |
| O04 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/hint-row.tsx` |
| O05 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/settings-row.tsx` |
| O06 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/components/onboarding/onboarding-ambient-background.tsx` |
| O07 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-color-scheme.ts` |
| O08 | `C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-color-scheme.web.ts` |
| F01, separately qualified | `C:/Users/User/barangayan/apps/resident-android-mobile/SanMateo_Ampid1_GEOjson.geojson` |

### Work and verification

- [x] Recheck that O01–O08 are unreachable from both platform entry graphs and all active tooling consumers.
- [x] Recheck historical-tool eligibility from DC-01 for each selected file. Each affected original candidate is archived with verified bytes; the old source-integrity verifier remains an original-snapshot check, not a current CI/feature gate. Full original snapshot reconstruction is not claimed.
- [x] For F01, compare bytes/hash with `C:/Users/User/barangayan/apps/resident-android-mobile/assets/geojson/ampid1-boundary.json` and recheck readers/provenance requirements. Keep the active asset and `src/hooks/use-ampid1-boundary.ts` unchanged. The renewed authorized removal passed approval review; F01 is absent, both identical retained copies are present.
- [x] Confirm resolved absolute deletion targets are the exact named files inside the application directory. Use literal paths; no wildcard, recursive, generated-directory, or mixed-shell deletion.
- [x] Preserve all assets referenced only by active consumers; deleting an orphan component does not authorize deleting shared fonts, logo, or other dependencies it imported.
- [x] Preserve the active `household_members` table and scanner writer even if O02 is removed.
- [x] Confirm current route/layout files and graphs remain unchanged; preserve mobile-web platform implementations.

### Exit gate

Only qualified listed files are absent. Active asset hashes, current routes, reachable dependency sets, shared/backend source, package manifests, and all other protected files remain identical to the baseline. Record every retained/held file and its reason.

## DC-05 — Verify application and build behavior

### Automated verification

- [x] Run normal Android TypeScript checks against the resulting source.
- [x] Run the existing mobile suite from `C:/Users/User/barangayan/apps/resident-android-mobile/vitest.config.ts`; every test that passed on the current baseline must still pass. Do not edit assertions to manufacture a pass.
- [x] Run scoped lint on actually affected active files and compare exact baseline messages. Current baseline and final both have zero errors/warnings; historical 71-error result is stale.
- [x] Verify retained function bodies and remaining style definitions are unchanged; confirm no deleted initializer performed an effect.
- [x] Refresh route, module/asset, external import, and dynamic-load comparisons for Android and mobile web.
- [x] Check diff boundaries and protected hashes, including all pre-existing work. Do not let concurrent changes silently invalidate attribution.
- [x] Create a fresh Android export in a new evidence/output directory, preserving current build configuration and all earlier exports. No dependency installation, SDK upgrade, lockfile rewrite, or configuration adjustment is part of this plan.
- [ ] Verify supported mobile-web build/preview compatibility using the current configuration; no hosting/publication is required. Fresh web export passed; full browser interaction smoke is pending.

### Narrow regression smoke checks

Use the current native shell/device or an equivalent build with the new bundle, current settings, and controlled test accounts/data. Keep financial and write-path exercises on local/synthetic fixtures so verification does not change production records. Record baseline defects without fixing them in cleanup.

| Existing journey | Required unchanged result |
| --- | --- |
| Cold/warm startup, guest entry, login/recovery/setup restoration | Same route selection, guards, restoration behavior, and available actions |
| Home, Services, Maps, Health, Reports, Settings | Same navigation and visible rendering in the affected areas |
| Emergency Hub hotlines/guidelines and Centers/offline maps | Existing data/fallbacks, assets, permission behavior, and map actions still work |
| Family and QR guide/scanner | Current member management and scanner entry remain available; queue/storage and database behavior unchanged |
| Request/payment and receipts/data export | Current service branching, payment gating, dynamic PDF imports, and sharing behavior preserved |
| Profile, account settings, valid ID, birthday controls | Existing forms/guards and active birthday implementations unchanged |
| Reports and announcements | Same feeds, filters, loading/error presentation, and controls |
| Old placeholder/compatibility routes | Same registered paths and current behavior, including existing placeholder content/redirects |
| Mobile-web variants | Current tabs, splash, external-link consumers, and active styles still function |

These checks verify regressions after deletion. They do not constitute the cancelled Android usability audit and authorize no UI changes.

### Exit gate

All relevant fresh checks pass without a cleanup-attributable regression. A missing device, export failure, unsupported test environment, unexplained diagnostic, or source drift leaves the affected acceptance item pending. Do not label the cleanup fully runtime-qualified based only on the previous in-memory tests.

## DC-06 — Final scope review and closure

- [x] Compare the final diff with the eligible list from DC-01. Every application diff must be an allowed removal or its specifically listed dependent syntax cleanup.
- [x] Confirm route/layout files, APIs, dependencies, import forms, configuration, backend, queues, generated evidence, and unrelated user work remain preserved.
- [x] Confirm all historical-tool requirements were respected; report any held indexed candidate instead of presenting it as removed.
- [x] Record removed file IDs, removed declarations/types/imports/style keys, exact paths, before/after hashes, and actual source bytes removed.
- [x] Separate source bytes removed from measured fresh-bundle/APK changes; do not count 123 MB of retained generated output or 3.69 MB of excluded icon-font optimization as achieved savings.
- [x] Record baseline and final type/test/lint/export/smoke results, including pre-existing errors and unverified checks.
- [x] Update the audit and phase tracking with completed/held items. Preserve previous evidence and append the new run's record.
- [x] Deliver the exact reviewed diff and evidence. Do not commit, push, deploy, publish, or claim every broad bloat finding was eliminated as an unrequested follow-on action.

### Completion criteria

The selected qualified subset is complete only when it has been removed, current functionality/tooling requirements remain intact, required regression checks have passed, and the final diff is entirely within scope. A partial subset may be reported as complete for its exact scope while other candidates remain held; the report must make that distinction explicit.

## 2026-10-14 execution progress — DC-00 through DC-06

The user explicitly authorized execution in this session; the planning-only statements describe plan creation. Root `AGENTS.md` and `CLAUDE.md` apply; there is no instruction conflict. The cancelled Android usability phase was not resumed. All seven DC phases were initially **not started**, confirmed against the actual files and missing physical-cleanup evidence. The audit's sections 0–6 are findings; its section 16 links these DC execution phases.

Evidence: [execution report](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/REPORT.md), [candidate eligibility](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/dc-01/eligibility.json), [reviewed cleanup diff](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/dc-06/cleanup.diff), and [acceptance record](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/dc-06/results.json).

- **DC-00:** HEAD `2e5681cd329df2b70a0591895cc1e5656a55506c`; current dirty state and patch saved, 5,038 existing tracked/untracked files hashed, and 22 exact before-files saved. Current configuration changes were preserved. Version-matched Expo 57, React Native 0.86, React 19.2, installed TypeScript/ESLint and Vitest 3 documentation were read. Baseline TypeScript passed; all 126 tests in 14 files passed; scoped lint on the 13 prospective active files had **0 errors / 0 warnings**. This differs from the prior virtual audit's 71-error historical lint result. A qualified native journey baseline remains pending.
- **DC-01/DC-02:** `phase0-verify.cjs` is explicitly an archival evidence-integrity check, with no CI/package caller found. Its original-path/hash and original Git-diff assertions remain intact. Of 758 indexed inputs, 754 matching byte sequences could be recovered from current files or Git, including verified line-ending conversions. No matching original bytes were established for `apps/admin-web/next-env.d.ts`, `apps/admin-web/src/app/(admin)/staff/staff-table.tsx`, `apps/resident-web/next-env.d.ts`, and `supabase/tests/rls_isolation.test.sql`. A complete matching historical snapshot therefore cannot be certified. **Retain O01–O08, U01–U08 and their dependent code, plus the 9 indexed local style keys and U01-dependent `group`.** No declaration or orphan-file removal was executed; no verifier, historical hash or inventory was rewritten.
- **DC-03:** Removed exactly the 12 listed unused styles from `src/components/resident-details-form.tsx`, the only candidate active file absent from the historical index. Private style-object access, absent consumers and passive literal/plain `Spacing` values were rechecked. All retained statements/functions/component bodies, style definitions and style-use sets are text-identical. **1,084 source bytes / 50 lines removed.** No dependency added.
- **DC-04:** F01 remains present. Its 20,316 bytes are identical to the active boundary asset and the rollback copy, hash `c42c1efe1a9d2dd1357d64c197eaa6126ad4a982e29d9dbcef973f0587d13bb4`. The only external provenance reference found is migration 0024's historical source comment; the active asset/hook remain unchanged. **Automatic approval review rejected F01 deletion as unauthorized data deletion under the prompt's restriction. Explicit owner approval is required before removal.** No deletion was executed.
- **DC-05:** Final TypeScript passed; all 126 tests passed with zero unhandled test errors; scoped lint remained **0 errors / 0 warnings**. Android/web roots, resolved edges, reachable inputs, external imports, dynamic loads and active asset hashes are identical. This capture traverses the shared barrel explicitly: **56 roots, 271 Android and 272 web reachable modules/assets, 38 external specifiers**, rather than the earlier simulation's differently scoped 218/219 count. Equality was checked by exact members, not counts.
- **Exports:** Baseline Android export initially failed because Hermes could not write to redirected sandbox temp; both baseline and final passed with a run-local writable temp, preserving configuration. Android Hermes bundle: **8,085,813 → 8,085,529 bytes (−284)**, identical assets and warning-message set. Baseline web export passed. Final web bundling succeeded but artifact persistence hit sandbox `EPERM`; a new output directory outside the sandbox passed. Web entry: **5,307,827 → 5,307,039 bytes (−788)**; shared chunks including dynamic receipt/data-export helpers are unchanged. Failed-attempt logs remain preserved. These are bundle measurements, not APK savings.
- **Smoke:** ADB required execution outside the sandbox; two emulators were found. UI XML inspection returned a null root, so screenshots were captured. The first dedicated native preview reset the connection; the unrestricted retry had no inspector target, and device logs showed fallback to an older cached bundle on port 8083. **Neither visible screenshot nor guest-input attempt qualifies a fresh-bundle pass.** The two run-created preview servers and forwarding rules were stopped/removed; app data was not reset. All nine journey rows above, including supported mobile-web interactions, remain **pending manual verification**. Exact steps and evidence are in [native-smoke.json](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/dc-05/native-smoke.json).
- **DC-06:** Reviewed the actual deletion-only diff and compared the original 5,038-file snapshot: only the intended component source changed before updating these plan progress records. Routes, assets, shared/backend source, manifests, lockfile, configuration and unrelated user work were unchanged. No commits, pushes, deployments, migrations, external configuration changes, production writes or third-party messages were performed. Source cleanup and automated verification are complete for the exact 12-style subset; overall phases remain **partially complete** because the listed holds and runtime qualification remain.

- **Final preservation refresh:** A subsequent full comparison detected a concurrent edit to `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, after the earlier comparison. It was left intact; the raw preservation check flags it with exit 1. The only application change remains the intended style deletion, alongside these two selected plan updates. No other source/configuration/backend change was detected. Final TypeScript after the native preview also passed. [Final preservation record](evidence/resident-android-bloat-audit/execution/2026-10-14-083944-dc/dc-06/final-preservation.json).

## 2026-10-14 continuation — remaining confirmed-unused deletions

The user renewed execution: **“if deletion is fully safe, then do it. ensure the deleted code/files is completely unused”**, after the backend-safety and historical-verifier effects were explained. Fresh qualification found no active app/backend/test/build/CI consumer for the remaining named items. The historical verifier is explicitly an original-snapshot integrity check with no current CI/package caller; its script/index and all original evidence remain unchanged. Exact historical bytes for the 20 affected indexed candidates are archived in the first run; this run also saved 24 current before-files, including both plan documents. This preserves the candidate bytes without fabricating or certifying the four unavailable unrelated historical inputs. The known current-path/hash consequence for archival verification remains documented.

New evidence: [confirmed-unused cleanup report](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/REPORT.md), [qualification](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/dc-01/qualification.json), [exact cleanup diff](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/dc-06/cleanup.diff), and [47-check comparison](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/dc-06/comparison.json).

- **Baseline/qualification:** current dirty work and 5,042 inputs preserved/hashed, including the current `.env` hash without exposing its contents. TypeScript, 126 tests in 14 files, scoped lint (0 errors/warnings), Android and mobile-web exports all passed before editing. Resolved TypeScript symbols/aliases across 296 sources, checked namespace/star/outside-orphan consumers and private style access, searched active scripts/CI/other apps/backend, and simulated the exact removals with zero TypeScript diagnostics. Similarly named web helpers remain separate and unchanged.
- **DC-02:** all eight runtime exports and the named dependent interface/imports/group are removed. Cached-token state, push registration/unregistration/delivery/gates, confirmation behavior, theme persistence/validation, payment readiness, cache operations and queued check-ins remain intact. All retained statements/functions/import specifiers are text-identical after projecting only the allowed removals.
- **DC-03:** the remaining nine private unused style keys are removed. Together with the first run, all 21 local keys are absent; dependent `group` is counted separately in DC-02. Every remaining style definition is unchanged. Route files remain registered with identical component bodies, handlers and guards.
- **DC-04:** O01–O08 and F01 are individually deleted from their validated literal source paths, with exact before-bytes saved. The active boundary asset/hook and scanner's `household_members` writer are unchanged. The prior F01 approval rejection was resolved by the renewed authorization and verified identical active/rollback copies; the actual literal-path deletion was accepted by approval review. No backend/storage/queue record was deleted.
- **DC-05:** resulting TypeScript, all 126 existing tests and scoped lint passed. Fresh Android/web exports passed using the same already-documented output-only workarounds as baseline. No new Android warning message. Both platform root/reachable/external/dynamic sets and active asset hashes are identical: 56 roots, 271/272 reachable modules/assets and 38 external specifiers per platform. The only removed dependency edge is the unused runtime React Native import in Skeleton after deleting `View`; retained types do not generate an import, while React Native remains in the unchanged global graph. Web CSS/dynamic chunks remain byte-identical.
- **Measured cleanup:** this run removes 40,177 source/duplicate-asset bytes; cumulative **41,261 bytes** across the two runs. Nine full files, eight runtime exports/one dependent interface and 21 local styles/one dependent style are removed. Fresh this-run Hermes bundle **8,085,535 → 8,081,904 bytes (−3,631)**; web entry **5,307,039 → 5,305,154 bytes (−1,885)**. These are source/bundle measurements, not APK savings. No dependency added or removed; excluded fonts/native modules/generated output remain.
- **Preservation:** no unexpected active source, backend, shared, configuration, manifest, lockfile or `.env` change was found. The first whole-snapshot comparison flagged nine concurrent iOS documentation/ledger updates; their raw result is preserved and their contents were left intact. The resolved comparison separates those concurrent records from app/backend drift. No old verifier, index or expected hash was rewritten.
- **Manual runtime qualification:** a corrected localhost-only/offline-environment preview and cold development-client launch were attempted. Android reported “Intent does not match any activities” before any new bundle ran. The verified normal launcher activity was requested again; the temporary preview and its sole 8160 forwarding rule were removed, with no app-data reset/native installation. No native journey is marked passed. All nine native/mobile-web journey rows remain pending; exact SDK-shell, controlled-account, permission, error/empty, offline, QR, payment/PDF, profile/birthday and compatibility-route steps are in the new report. Native-shell/link correction is outside this deletion-only scope.

**Current phase outcome:** all specifically named source-deletion work is complete, with no source/approval hold remaining. DC-00's automated baseline, DC-01–DC-04 implementation, DC-05 automated checks and DC-06 source review are complete. Overall full phase acceptance remains **Partially complete solely for the required manual runtime journey baseline/smoke checks**. No commit, push, deployment, migration, external service configuration change or third-party message was performed; the cancelled Android usability phase was not resumed.

**Late concurrent-source refresh:** the final whole-snapshot check subsequently flagged external edits in iOS app/configuration files, web incident reports, the admin routing editor, the lockfile and shared evacuation-center facility enum. All were left intact. The raw whole-checkout preservation result is flagged rather than claimed unchanged; no unexpected Android cleanup-input change was found and all deletion targets retain the exact prepared hashes. Current mobile TypeScript, 126 tests and scoped lint passed on refresh. Android/web export rechecks against the current shared code are stored under `2026-10-14-095352-remaining/dc-06-refresh`. Earlier bundle savings describe the controlled earlier snapshot and are not attributed to concurrent edits. Scoped cleanup verification is distinct from whole-checkout drift; native/mobile-web full journey acceptance remains pending.

**Refresh closure:** both refreshed exports passed as well. All five current mobile checks pass; every prepared Android edit retains its exact hash, all nine deletion targets remain absent and the active boundary asset remains unchanged. [Final target check](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/dc-06/final-target-check.json), [final execution record](evidence/resident-android-bloat-audit/execution/2026-10-14-095352-remaining/dc-06/results.json). The raw whole-snapshot drift flag remains reported, with unrelated work preserved.

## Rollback and stop rules

Before every batch, verify the source hashes still match the approved current snapshot. Save a recoverable before-version that includes the user's uncommitted work.

If a batch causes a new type/lint/test/export/runtime failure, changes routing/rendering, exposes a required consumer, or breaks active tooling:

1. Stop further removal of the affected candidates.
2. Reverse only that cleanup batch using its saved pre-cleanup content/patch, after checking no other task has subsequently edited the same paths.
3. Re-run the failed check to establish that the regression was removed; preserve the failure evidence.
4. Mark the candidate held and record the consumer/effect. Do not fix the system by changing behavior, dependencies, tests, or historical hashes inside this cleanup.

Never use a whole-repository reset, a checkout-to-HEAD restore, a recursive directory deletion, or a rollback that discards changes belonging to the user or another task. If source drift prevents safe reversal, preserve both versions and resolve ownership rather than overwrite newer work.

## Findings intentionally left out of execution

The following remain in the audit for visibility but have no removal/refactor phase in this plan:

- R01–R07, their screen/layout configuration, placeholders, redirects, and alternate scan route.
- `qrcode.react`, `expo-task-manager`, developer modules, navigation dependencies, package manifests, and lockfiles.
- Broad Expo icon imports, direct Ionicons import conversion, and dependency-owned fonts.
- The 25 unconsumed hook return members, unused prop contracts, `onFitAll`, duplicate permission branches, QR history/synchronization logic, and persistent queues.
- Reset utility/command, README replacement, generated output folders, saved previews, and historical evidence.
- Shared/backend cleanup, migration changes, new features, UI fixes, and any part of the cancelled Android usability phase.

Creating these execution phases only records the future sequence. It does not start DC-00 or authorize physical deletion.
