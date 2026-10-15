# Resident Android cleanup execution — 2026-10-14

**Overall status: Partially complete.** The exact 12-style subset is implemented and passes automated verification. Historical-indexed removals, F01 removal, and full native/mobile-web journey qualification remain held or pending.

## Changed

Only application change: removed these unused private style definitions from `apps/resident-android-mobile/src/components/resident-details-form.tsx`:

`passwordMatchIndicator`, `successModalBackdrop`, `successModalCard`, `successIcon`, `successModalTitle`, `successModalMessage`, `successModalActions`, `successModalActionButton`, `formError`, `submitActions`, `footerRow`, `footerText`.

No component body, JSX, handler, effect, import, remaining style value, route, contract, dependency, configuration, stored data, queue or backend was changed. No dependency was added. Both selected plans' status/checklists and dated progress notes were updated. Exact reviewed application diff: [cleanup.diff](dc-06/cleanup.diff).

Removed **1,084 source bytes / 50 lines**. Fresh Android Hermes bundle: **8,085,813 → 8,085,529 bytes (−284)**. Fresh web entry: **5,307,827 → 5,307,039 bytes (−788)**. These measurements are distinct; neither is an APK measurement. Saved exports/fonts and all earlier evidence were preserved.

## Verified

| Check | Baseline | Final | Verdict |
| --- | --- | --- | --- |
| Normal Android TypeScript, current strict project | Pass | Pass | No new errors |
| Existing mobile Vitest configuration | 126 tests / 14 files pass | 126 tests / 14 files pass | No failures or unhandled errors |
| Scoped ESLint, all 13 prospective active files | 0 errors / 0 warnings | 0 errors / 0 warnings | Exact diagnostic equality; historical 71-error record is stale |
| Android export with same run-local temp workaround | Pass | Pass | First baseline attempt had sandbox Hermes temp write denial; preserved failure log |
| Mobile-web export, existing `single` output | Pass | Pass after unrestricted local retry | First final attempt bundled successfully then hit sandbox `EPERM` while writing output; preserved failure log |
| Android export warning messages | Existing dependency/compiler/environment warnings | Identical set | No new warning message |
| Route/layout roots | 56 | Identical 56 members | Pass |
| Android reachable modules/assets | 271 | Identical members and resolved edges | Pass |
| Web reachable modules/assets | 272 | Identical members and resolved edges | Pass |
| External import specifiers | 38 per platform | Identical members | Pass |
| Nonliteral dynamic loads | None | None | Pass; active literal PDF/notification loads preserved |
| All retained statements/functions, remaining style text/use sets | Baseline capture | Exact equality | Pass |
| Active asset hashes | Baseline capture | Exact equality | Pass |
| Pre-existing tracked/untracked files | 5,038 hashed | Intended component and selected plan records changed; a concurrent routing-plan edit also detected | Concurrent documentation preserved; no other app/config/shared/backend drift |
| Native/mobile-web full smoke matrix | Qualified fresh-bundle baseline unavailable | Not qualified | Pending manual verification |

Graph counts differ from the old simulation's 218/219 because this run explicitly traverses the shared barrel. Baseline/final use the same traversal and compare exact members/edges. No app source change accounts for that capture-scope difference.

Baseline/recovery: [dc-00](dc-00). Exact structural/preservation comparison: [comparison.json](dc-05/comparison.json). Measured bundles: [Android](dc-05/android-bundle-comparison.json), [web](dc-05/web-bundle-comparison.json). Machine acceptance record: [results.json](dc-06/results.json).

The earlier pre-documentation hash comparison found only the intended component change. A final 5,038-file comparison after the native preview and selected plan updates also detected a concurrent edit to `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`. That file was not edited or restored by this cleanup. The raw preservation runner exits 1 to flag that drift; it is a concurrent documentation finding, not an application/test/build regression. The only changed application file remains the intended component. A final TypeScript check after the preview also passed. [Final preservation record](dc-06/final-preservation.json).

## Acceptance criteria and phases

| Criterion | Status | Scope / remaining work |
| --- | --- | --- |
| Current source recovery, configuration, hashes and automated baseline | Met for automated baseline | Exact before-files and original diff preserved; qualified journey baseline pending |
| Every candidate has a runtime/tooling eligibility decision | Met | [eligibility.json](dc-01/eligibility.json); indexed candidates explicitly held |
| Exact declaration-only batch with unchanged retained behavior | Met for empty eligible subset | No eligible declaration; all U01–U08 retained |
| Exact eligible private style removal; other values/functions preserved | Met for 12-style subset | Nine indexed local keys and U01-dependent `group` held |
| Qualified orphan/duplicate full-file deletions completed | Not met | All O01–O08 and F01 present |
| No additional type/lint/test/build diagnostics caused by cleanup | Met for automated checks | Native console/runtime acceptance still pending |
| Nine required regression journey rows, including mobile web | Pending manual verification | See exact steps below; screenshots do not qualify a fresh-bundle result |
| Reviewed scope, protected work, measurements, honest evidence | Met for partial execution | Full closure remains pending held removals and smoke |

| Phase | Status |
| --- | --- |
| DC-00 | Partially complete: automated baseline and recovery saved; qualified journey baseline pending |
| DC-01 | Complete: exact eligibility/hold decisions recorded |
| DC-02 | Complete for qualified subset: no eligible declaration; all eight exports held |
| DC-03 | Complete for qualified subset: 12 styles removed and verified |
| DC-04 | Blocked: indexed orphans held; F01 automatic approval rejection |
| DC-05 | Partially complete: automated checks and exports pass; full smoke pending |
| DC-06 | Partially complete: reviewed diff/records delivered; full closure pending |

## Remaining holds

**Historical verifier:** `scripts/phase0-verify.cjs` explicitly describes itself as an archival evidence-integrity check, not a release gate; CI/package scripts do not call it. It nevertheless reads exact historical indexed paths/hashes and asserts the original checkout's Git-diff boundary. The plan forbids rewriting it or weakening the index. Of 758 original indexed inputs, exact matching bytes were recovered for 754, including verified line-ending reconstruction. The four unmatched inputs are:

- `apps/admin-web/next-env.d.ts`
- `apps/admin-web/src/app/(admin)/staff/staff-table.tsx`
- `apps/resident-web/next-env.d.ts`
- `supabase/tests/rls_isolation.test.sql`

A complete matching historical checkout therefore cannot be certified. All 20 affected indexed candidate files remain unchanged. Exact matching historical bytes for those 20 candidates are separately preserved in [historical-candidate-bytes](dc-01/historical-candidate-bytes), alongside each current before-file. This is a **candidate-only archive**, not a complete snapshot or passing historical verifier. O01–O08, U01–U08 and dependent code, nine indexed style keys, and dependent `group` remain held until the owner resolves that compatibility requirement. No historical generator/verifier was rerun in place, and all old hashes/evidence remain intact.

**F01:** Automatic approval review rejected deletion of `apps/resident-android-mobile/SanMateo_Ampid1_GEOjson.geojson` because the prompt excludes data deletion. The original, active identical boundary asset, and exact rollback copy remain present. Each is 20,316 bytes with SHA-256 `c42c1efe1a9d2dd1357d64c197eaa6126ad4a982e29d9dbcef973f0587d13bb4`. No executable reader was found for F01; migration 0024 records historical provenance. Explicit owner approval is required before removal. [Decision and hashes](dc-04/result.json).

## Pending manual verification

The device probe found two emulators outside the sandbox. The native development app accepted the test links, but the dedicated sandbox preview reset its connection; the unrestricted preview had no inspector target, and app logs showed cached assets from older port 8083. Screenshots of startup/auth choice and a guest-input attempt are saved; **they do not establish that the cleanup bundle executed**. No native flow is marked passed. Both run-created preview servers and only their 8143/8144 forwarding rules were stopped/removed; no app data was reset, no native build installed, and the original login route was requested again.

1. Load the saved `dc-05/android-export-temp` output in a matching SDK 57 native shell, or use a dedicated local Metro server and confirm its inspector sees the emulator and its assets/bundle use that instance. Do not accept cached port 8083 fallback.
2. On controlled local/synthetic accounts, compare cold/warm startup, guest/login/recovery/setup restoration and all six main areas against the preserved pre-cleanup source; record screenshots and console/device logs.
3. Check Emergency Hub hotlines/guidelines, Centers/offline maps, allow/deny location/camera, family/QR guide/scanner and queued check-in recovery without changing production records.
4. Check request/payment branching and gating, synthetic empty/error cases, receipt/data export/sharing, profile/account settings, valid ID and both birthday controls.
5. Open every placeholder/compatibility route and check its unchanged registration, content, redirects and auth guard.
6. Serve `dc-05/web-export-unrestricted` with SPA fallback and compare mobile-web tabs, splash, external links, feeds/filters, dynamic PDF flows and the same guest/authenticated/error journeys against `dc-00/web-export`.

See [native-smoke.json](dc-05/native-smoke.json) for attempts and exact limits. Existing ReactHost/EGL warnings occurred while the older cached app was active and are not evidence for or against the cleanup bundle. No UI/native-shell/backend correction is authorized by this cleanup.

## Scope and discrepancies

The referenced audit delegates phases to the separate DC execution plan; its main sections 0–6 are findings, not execution phases. Root `AGENTS.md`/`CLAUDE.md` were read; no instruction conflict was found. Version-matched framework/tooling documentation is recorded in [docs.json](dc-00/docs.json). Earlier planning-only statements and simulated results remain historical.

Excluded findings were preserved: compatibility routes, dependencies/lockfile, icon import/font optimization, 25 hook return fields, prop contracts, duplicate callbacks/permission branches, persisted queues, reset tooling, generated outputs, shared/backend/migrations, and the cancelled Android usability phase. No commit, push, deployment, migration application, external service configuration change, production write or third-party message was performed.
