# Phase 5 execution — 2026-10-16 (Asia/Manila)

Status: **Phase 5 complete**, including authorized hosted publication, staff approval and front-only service creation. The original local execution below made no hosted writes; the later hosted completion is recorded at the end. No deployment, new dependency, migration, external service setting change, payment, data deletion, commit or push.

## Delivered changes

- `apps/resident-web/src/app/(resident)/settings/valid-id/valid-id-flow.tsx`: retain confirmed submission ID and identify when newer current evidence replaces it. Success survives status failure; status continues to describe the current evidence.
- `apps/resident-web/tests/valid-id-browser.mjs`: exercise late commits after not-found, failed/mismatched owned reads, newer current evidence, early staff decisions, definitive rejections/corrections, actual transport timeout and different immutable-byte retry refusal. Fixtures emulate migration 0118's stable-ID return without restoring older evidence as current.
- `supabase/tests/resident_front_id_submission.test.sql`: two additional assertions verify old-ID replay does not replace newer evidence.
- `scripts/valid-id-database.cjs`: update expected ID assertion count from 24 to 26.
- Selected Phase 5 progress records requirement classification, results and remaining hosted gate. Other phases and stale global summaries are preserved.

## Results and reproduction

| Check | Baseline | Final |
| --- | --- | --- |
| `npm run typecheck --workspace=@barangayan/resident-web` | Pass | Pass, including clean restored config. |
| `npm run lint --workspace=@barangayan/resident-web` | 0 errors, 2 existing location warnings | Same. |
| `npx vitest run --root apps/resident-web --config vitest.config.ts` | 84 pass / 1 pre-existing pricing-label failure at search.test.ts:74 | Same; 17 focused Valid ID tests pass. |
| `npm run test --workspace=@barangayan/shared -- src/lib/id-evidence.test.ts src/schemas/service-foundations.test.ts src/lib/resident-submission.test.ts` | 33 pass (recorded across two invocations) | 33 pass. |
| `npm run build --workspace=@barangayan/resident-web` | Default Turbopack stalled, stopped | Not repeated unchanged. |
| `npm run build --workspace=@barangayan/resident-web -- --webpack` with separate `BARANGAYAN_PREVIEW_DIST_DIR` | Restricted generated-directory EPERM; unrestricted local build passed | Unrestricted local build passed, Valid ID route included. |
| `node apps/resident-web/tests/valid-id-browser.mjs` with `VALID_ID_TEST_OUTPUT` | 15 scenario groups pass | 21 groups pass, Chrome 155.0.8059.80. |
| `node tmp/valid-id-phase5-db.cjs` | 24 ID assertions pass | 26 ID assertions pass; 37 total including 11 prerequisite fixture assertions. |
| `node --check` for changed browser/SQL runners | Not needed before code changes | Both pass. |

The disposable database runner adapts the existing `scripts/document-payment-flow-database.cjs` harness. It uses the cached PostgreSQL 17.6.1.155 image in the existing local WSL test runtime, `--network none`, a fresh ephemeral cluster, all 126 migration files through `0128_admin_personal_profile_editing.sql`, and the repository's minimal Auth/Storage SQL bootstrap. The real publication/review/service functions and row policies execute against synthetic records. No hosted connection string or resident account is used. Containers were confirmed absent afterward. This does not verify hosted Auth/Storage HTTP or browser-to-hosted persistence.

The browser run uses actual components and `publishIdEvidence`, with synthetic Auth/Storage/OCR/RPC replies. It verifies exact review/optional blank display; no back path; stable snapshot and immutable bytes; double clicks; not-found followed by late commit; read failure/mismatch; current-version replacement; staff decisions; status failure after success; definitive rejection and corrected new attempt; timeout with later committed recovery; and the existing account/photo/camera/wheel/layout coverage. All 17 captured console errors are the explicitly injected 400/409/429/503 or aborted network responses. There are no unexpected runtime errors or warnings. The final run includes 360/768/1440px, dark mode and 200% CSS zoom. A simulated camera is not a physical-camera pass.

An intermediate new immutable-byte test returned to its own fixture before the failed action settled. It was corrected to wait for the enabled Retry control before restoring fixture bytes; the final complete run passes. The earlier regression draft included a server route-refresh expectation, which was removed after inspecting the existing fresh service-evidence reader and the risk of losing success on a failed server read. No route-refresh implementation remains.

Local command logs, before-edit snapshots and the reproducer are under `tmp/valid-id-phase5/` and `tmp/valid-id-phase5-db.cjs`. Persistent evidence alongside this file contains the final browser report, synthetic current-version screenshot, SQL result summary and SQL log. The original tsconfig bytes were restored and SHA-256 matched the before-edit copy. The incremental diff and whitespace checks were reviewed; unrelated concurrent changes remain intact.

## Read-only hosted readiness

Project `pwjbucnyqexiepoinoke`, matching the local link: migration 0118 applied; back path nullable; confirmed details present; evidence bucket private; submission RLS enabled; publication compares immutable details and returns the same ID on replay; service submission checks back evidence only when present. All checks returned true. No resident records, ID contents or credentials were read.

## Original hosted acceptance steps — now completed below

1. Obtain authorization for test writes and designated resident/staff accounts in the intended test environment.
2. Through the actual Valid ID route, upload a non-sensitive synthetic front image, manually correct the four fields, review and submit. Optional blanks must persist as empty strings; exactly one new version/front file must correspond to the reviewed details. Profile fields must be unchanged. Manual entry requires no OCR call.
3. Through the existing staff UI, inspect the single front photo and confirmed details, approve that version, and verify the resident's fresh matching current/approved badge. Submission alone must remain pending; failure to refresh status must retain confirmed success.
4. Create an authorized test service request that uses this approved front-only evidence. Do not initiate payment. Record actual browser console/network and server results. Do not delete test data or alter shared external configuration without separate authorization.

These steps were pending after the local execution and are now verified below. Physical-camera checks and broader Phase 6/7 release acceptance remain outside this Phase 5 execution.

## Authorized hosted completion — 2026-10-16 (Asia/Manila)

**Passed.** Actual local production builds of both apps used hosted Auth, private Storage, publication/review/service RPCs and RLS in project `pwjbucnyqexiepoinoke`. Chrome 155.0.8059.80; resident 1280×1000, reviewer 1440×1000; Asia/Manila. The admin production Webpack build, including TypeScript, passed. No app/shared source changed in this follow-up, so the recorded local checks above were not needlessly repeated. Admin tsconfig matches its before-run SHA-256; resident config was untouched.

| Hosted check | Actual result |
| --- | --- |
| Synthetic setup and real password login | Passed using one isolated synthetic tenant and zero-fee service; no real residents or IDs. Normal first-login onboarding completed. |
| Review/publication | Passed: corrected manual name, three optional blanks, original PNG persisted byte-for-byte, no back path, all four detail keys, personal Profile fields unchanged. No OCR/provider call. |
| Lost response/double click/recovery | Passed: the real RPC committed, its response was deliberately dropped, and two immediate Submit clicks still caused one publication. Explicit Retry read the owned same-ID row; one version persisted. |
| Staff approval | Passed through actual directory/drawer, decoded one private front image, reviewed corrected details and approved through the staff-session RPC. Reviewer ID/time persisted. |
| Resident/service refresh | Passed: pending became verified with matching current/approved IDs; real service form read and previewed the approved front image with no back image. |
| Service request | Passed: actual form/RPC created one v2 request linked to the same approved submission. Final hosted readback confirms submitted/pending and zero payment records. |
| Security and cleanup | Passed: no administrative credential reached browser requests; no direct OCR.space/Google call; all six test logins disabled and all reviewer roles removed with explicit owner approval. Test records retained; local ports 3216/3217/3218 closed. |

Synthetic evidence identifiers:

- Tenant: `96b411fc-f8c8-4d5b-b8d8-b91f5529e2b7`.
- Front-only submission: `47af5664-12b9-4a5c-979e-af75b41fb572`.
- Service request: `49a01dda-9a6a-475c-8e46-2900a0f37e8c`.

Persistent evidence: [browser report](hosted-browser-report.json), [final read-only state](hosted-final-state.json), [review](hosted-review.png), [confirmed pending state](hosted-pending.png), [staff approval](hosted-staff-approval.png) and [fresh verified badge](hosted-verified.png). The [service destination snapshot](hosted-service-received.png) shows its loading state, not final payment-screen readiness. Actual request creation is proven separately by the successful RPC and persisted request. No payment workflow was exercised.

The browser report records one expected `ERR_CONNECTION_FAILED` from intentionally dropping the committed response, no page/runtime errors, and the exact asset-preload warnings. Resident CSS files match the saved before-change build byte-for-byte; corresponding warnings were previously reproduced on that baseline. Admin CSS warnings reproduced in an independent fresh tab of the unchanged production build. Five unused-preload warnings for the existing admin header logo did not reproduce in that fresh-tab check; their source is unchanged by Phase 5, and this limitation is explicitly retained. No warning suppression or unrelated header fix was added. Resident server logs contain three cancelled-stream diagnostics when test browsers were terminated. The report does not claim a warning-free browser/server run.

Two setup attempts stopped at normal onboarding or development-server reloads. A later staff test used the wrong table role, then checked the image before its asynchronous signed-URL load completed. The verifier was corrected to use the visible pending-status entry and wait for image decoding. Stable production builds were used to finish. The successful publication was retained and reused across the resumed approval/service checks; no duplicate submission or request was created. Historical attempt failures remain in the report.

Automatic review initially rejected account disabling/role removal and later test-password rotation. The owner explicitly approved each operation before it ran. Only the two active synthetic passwords were rotated; the four disabled accounts stayed disabled. Completed-run sessions were signed out globally, all six logins are now disabled, and no reviewer privilege remains. The isolated test tenant, service, six profiles, front evidence and one request remain for owner review; deletion was not performed.

Local reproducer/helpers and logs are under `tmp/valid-id-phase5/hosted/`; credential values were held only in memory. Evidence was scanned for token/key/password values and contains none. There is no remaining Phase 5 blocker. All eight implementation criteria and the hosted gate are **met**; other phases, physical-camera coverage, broader release checks and the stale global plan summaries remain outside this selected-phase completion.
