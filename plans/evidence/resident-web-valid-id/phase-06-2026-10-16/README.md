# Phase 6 execution — 2026-10-16 (Asia/Manila)

**Status: Complete.** Implementation, current local acceptance and authorized hosted acceptance are verified. The completion note below supersedes earlier pending-manual statements. Earlier execution history remains intact. Phase 7 and overall release are not marked complete.

## Scope and changes

The execution began with the dedicated route, four-step flow, Settings status provider, sidebar placement, Profile uploader removal and initial verification-link changes already present as uncommitted work. Those changes were preserved. Inspected their implementations and the shared publication/schema/storage/migration/staff/service contracts rather than relying on plan checkboxes. Earlier Phase 4/5 hosted reports were read as historical evidence; their live results were not rerun or claimed as new passes.

- `apps/resident-web/src/components/services/resident-service-form.tsx`: separate personal-profile editing from ID verification. `Edit in Profile` again opens `/settings/profile`; `Verify Now` opens `/settings/valid-id`. Preserve the older admin resident portal's explicit `/resident/profile#upload-valid-id` destination and matching shared wording. Web prompts use Settings/Valid ID wording without changing shared/mobile copy.
- `apps/resident-web/tests/valid-id-browser.mjs` and `valid-id-fixture.jsx`: extend the existing actual-component verifier with real Supabase SDK requests intercepted at the HTTP boundary, the actual household hook, visible notifications, retained Profile validation/save/birthday, avatar failure/retry, household failed add/retry/edit/remove, distinct service links/copy, legacy attachments, front-only/two-sided previews, initial and later old-fragment handoffs, loading badges and coalesced status refreshes. No request reaches a real backend/provider in these fixtures.
- `apps/resident-web/tests/valid-id-profile-cutover.test.ts`: verify the actual server page's selected fields and retained Google account-link control, while isolating its auth/data/component boundaries.
- Only Phase 6 progress/status and this dated evidence were updated in the plan. No dependency or migration was added.

Read root/resident-web AGENTS.md and CLAUDE.md, plus admin instructions when checking the shared form consumer. No applicable instruction conflict was found. Read the exact Expo v57 reference before code, bundled Next 16.3 layouts/server-client/Link/router guidance, installed React 19.2.8 hook implementation, Supabase 2.112.1 signatures and update/upload documentation, and Playwright 1.62.1 API guidance. The newly available Supabase skill/changelog was also read during follow-up; no relevant JS API breaking change affected the existing calls. Android/React Native code was not changed and cancelled Android work was not resumed.

## Requirement classification and acceptance

| Phase 6 requirement | At follow-up start | Verified result |
| --- | --- | --- |
| Valid ID immediately after Profile in desktop/compact navigation | Done | **Met locally.** Same shared navigation rows at 360/768/1440px; source/order assertions and inspected screenshots. |
| Verified only for matching approved/current evidence; warnings/loading/error accessible | Done; loading/coalescing coverage incomplete | **Met locally.** Loading immediately removes verified, mismatched/revoked/pending/failed/repair states warn, failed reads expose unavailable text and explicit recovery. |
| Status updates without manual reload | Done | **Met locally.** Actual Settings provider handles synthetic Realtime/focus, fresh staff states and post-submission refresh. |
| One Settings subscription/read owner | Done | **Met locally.** One channel across sidebar/flow/navigation; a simultaneous focus/Realtime burst causes one active read plus one coalesced follow-up. |
| Remove embedded Profile ID UI/state/helpers/query fields | Done | **Met.** Read Profile page/form and final dependency searches; no old uploader or ID-only fields remain. Ordinary calendar/avatar/household/account linking retained. |
| Update ID links and search old fragments | Partially done: default cutover also misdirected personal-profile editing | **Met locally after fix.** Both ID entry points use Valid ID; personal editing uses Profile; older portal overrides remain valid. |
| Correct affected prompt text without unrelated-client changes | Partially done: shared form's older portal consumer received Settings wording | **Met locally after fix.** Web defaults and legacy portal destination/copy checked separately. Shared messages unchanged. |
| One-way old bookmark; normal Profile navigation; existing guard behavior | Component handoff done; plan guard description stale | **Met locally; hosted signed-in flow pending manual verification.** Complete/incomplete component fixtures handle initial and later fragments without cycles; existing `requireUser` tests verify incomplete Settings access and required completion outside Settings. Actual production guests keep Login return paths. |
| Legacy attachments/two-sided evidence/front-only previews preserved | Done; regression coverage incomplete | **Met locally; hosted regression pending manual verification.** Real service evidence hook decodes one/two private fixture images; separate legacy attachment input accepts its own file. Shared compatibility tests pass. |
| Dependency cleanup | Done | **Met.** Removed action/components have no production/test/script/config consumers. Remaining resident-web old-fragment source is the deliberate Profile handoff. Shared historical wording and older portal anchor are still used by other clients. |
| Gate: every ID entry opens new route; no Profile uploader; normal editing works | Implementation mostly done; retained writes unverified | **Met locally; pending manual verification against hosted Auth/Storage/RLS.** Profile/avatar/household writes are exercised through actual components/hooks/SDK with fixture responses, not hosted writes. |

## Actual verification

| Check | Baseline | Final |
| --- | --- | --- |
| `npm run typecheck --workspace=@barangayan/resident-web` | Pass | Pass, including after removing only this execution's generated config includes. |
| `npm run lint --workspace=@barangayan/resident-web` | 0 errors, two location-verification warnings | Same two warnings, no new issues. |
| `npx vitest run --root apps/resident-web --config vitest.config.ts` | 109 pass / 1 pre-existing search-label failure | 124 pass / same failure at `tests/search.test.ts:74`. The increase includes concurrent auth/session/role tests plus this execution's new Profile-page test. |
| New Profile-page cutover test | Absent | 1 pass alone and in full suite. |
| Shared ID evidence, service foundations and resident submission suites | 33 pass | 33 pass. Shared production source unchanged by this execution. |
| Webpack production build via package build script, isolated `BARANGAYAN_PREVIEW_DIST_DIR` | Restricted build failed with Windows generated-directory EPERM; permitted local build passed | Permitted local build passed, including TypeScript and `/settings/valid-id` route output. |
| `node apps/resident-web/tests/valid-id-browser.mjs` | 21 scenario groups pass | 30 groups pass in Chrome 155.0.8059.80, Asia/Manila, including two concurrent role-compatibility groups. 22 intentional fixture HTTP/aborted-response console errors, zero warnings/unexpected runtime errors. |
| Actual production-server guest verifier | Existing runner inspected | Pass in Chrome 155.0.8059.80: fixed Valid ID Login return destination; old Profile bookmark retains Profile Login return destination. Zero errors/warnings; server log clean. |
| Browser runner syntax and incremental diff whitespace | Not applicable | Pass. |
| Hosted retained Profile/avatar/household writes, signed-in old links and approval/service regression | Not run | **Pending manual verification**, requiring owner authorization for synthetic hosted mutations. |

Browser reports are [browser-report.json](browser-report.json) and [guest-report.json](guest-report.json). Settings screenshots: [compact](settings-compact.png), [desktop](settings-desktop.png). The browser run checks 360/768/1440px, dark mode and 200% CSS zoom. Inspected compact/desktop screenshots directly. Fake canvas video is not a physical-camera pass. Fixture error counts are explicitly separated from unexpected console/runtime failures.

Intermediate verifier corrections: the household error assertion initially expected different wording; read the real feedback helper and corrected it. The subsequent complete runs passed. Restricted browser access to localhost was denied; a permitted browser then found the earlier separately started server unavailable. A single bounded verifier subsequently started the production server, ran read-only guest checks and stopped it successfully. Port 3226 was confirmed closed. Default Turbopack was not rerun because the documented baseline limitation and this phase's verified production path use Webpack; no default-build pass is claimed.

Logs, before-edit snapshots and the bounded local server helper are under `tmp/valid-id-phase6/`. Removed only the two generated include pairs under that directory. Concurrent `.next-session-isolation` includes and account/session/role source/tests were preserved; the final tsconfig consequently differs from its initial snapshot for those concurrent additions. Self-reviewed the incremental service/form/test diff and dependency searches. No production debug code, unused dependency, extra subscription, new persistence or background retry was added.

## Plan discrepancies and remaining attended checks

The global plan summary still describes an unimplemented feature, and older Phase 6 text says incomplete Profile must redirect through setup. Actual uncommitted `requireUser` now permits existing incomplete profiles throughout Settings, while still guarding resident-service actions. This policy predated this execution and was not introduced, reverted or expanded for fragment compatibility. Concurrent owner work also added existing-admin eligibility to the ID route/provider and matching tests; it was preserved, not attributed to Phase 6. Global and other-phase progress was left untouched as instructed.

No known Phase 6 implementation defect remains. Before calling its remaining hosted criteria verified:

1. Obtain explicit authorization and owner-designated synthetic resident/staff accounts in the target backend; do not re-enable the disabled Phase 5 accounts or use real residents without authorization.
2. Sign in as a complete resident. Open `/settings/profile` normally, change/save personal/employment/address data, change the ordinary birthday, upload a non-sensitive avatar and add/edit/remove a synthetic household member. Confirm persisted values after reopening and that ID approval/current evidence is unchanged. Exercise a rejected write while preserving edits. Check Google linking is present without initiating third-party account linking.
3. Open `/settings/profile#upload-valid-id` as complete and incomplete residents. Verify the actual server guard and single client handoff match the current Settings policy, with no redirect loop. Normal Profile navigation must stay on Profile; guests must still pass through Login.
4. In narrow/wide Settings, observe pending/failed/repair/verified/current-version states and a status-read failure. Approval should refresh the badge without a manual reload; unavailable/loading must never show a retained check. Use controlled browser fixtures for failure injection rather than changing external configuration.
5. Review one authorized front-only submission and a retained legacy two-sided submission through the existing staff/service UI. Verify both private previews and service reuse. Check `Verify Now` enters Valid ID and `Edit in Profile` enters Profile. Preserve separate legacy service attachments; do not pay, delete data, deploy or change configuration.

Physical camera, live OCR, broader release and payment checks belong to other phases and were not started here. Historical Phase 5 hosted approval/service evidence is preserved but does not substitute for rerunning the pending Phase 6 regression on the current workspace.

## Authorized hosted completion — 2026-10-16 (Asia/Manila)

**All Phase 6 acceptance criteria met.** The owner explicitly authorized the remaining hosted synthetic tests and cleanup. Current local production builds of both apps used actual hosted Auth, Storage, publication/review/service operations and RLS in project `pwjbucnyqexiepoinoke`. Chrome 155.0.8059.80; Asia/Manila; complete resident 1280×1000, incomplete resident 390×844, reviewer 1440×1000. The retained synthetic Phase 5 tenant/zero-fee service was reused; three new synthetic accounts used `example.invalid` addresses and passwords held only in memory. No real person/ID, payment, deployment, remote migration, commit or push.

| Acceptance criterion | Result |
| --- | --- |
| Valid ID directly after Profile in desktop/compact navigation | **Met:** current source, 360/768/1440px components and actual compact signed-in navigation. |
| Current approval only; accessible loading/unverified/error/repair feedback | **Met:** current component cases plus actual hosted pending/verified transitions. |
| Fresh status without manual reload; one shared Settings owner | **Met:** current subscription/coalescing checks and real staff approval → resident focus refresh. |
| Profile uploader/state/helpers/query-field/action removal | **Met:** final production/test/script searches; actual Profile has retained controls and Google linking. |
| Both ID verification links/copy; distinct personal Profile destination | **Met:** current component tests and actual service Profile link; legacy portal overrides retained. |
| One-way bookmarks and existing server guards | **Met:** actual complete/incomplete Profile/bookmark behavior; real production guest Login returns; no guard change. |
| Legacy attachments/two-sided contracts/front-only previews | **Met:** 33 shared compatibility tests/current browser attachment checks; hosted front-only request plus two-sided staff/service previews; both versions retained. |
| Dependency cleanup and ordinary editing | **Met:** no removed-code consumers; hosted personal/address/employment/birthday/avatar/household persistence after reopening, with unchanged ID approval and rejected-save draft preservation. |
| Overall Phase 6 gate | **Met:** new ID entry points, no Profile uploader, working retained edits. |

Current hosted sequence: real logins → complete/incomplete old bookmarks → front-only manual publication with a deliberately lost committed response → same-ID recovery → actual staff private preview/approval → fresh resident badge → retained Profile/avatar/household edits → front-only zero-fee service request → caller-authorized legacy-compatible two-sided publication → actual staff preview/approval → two private service previews. The compatibility submission omitted confirmed details and retained its back photo; it is a new synthetic sample of the historical two-sided contract, not a real resident's historical ID. The prior front-only version remains unchanged. Household add/edit/remove touched only the newly created synthetic member. No payment was initiated; the actual front-only service verifier read zero payment rows.

| Current verification | Actual result |
| --- | --- |
| Resident typecheck | **Passed** before and after removing this execution's generated type includes. |
| Resident lint | **Passed with pre-existing warnings:** zero errors, same two location-verification warnings. |
| Full web Vitest | **Pre-existing failure:** baseline/final 138 passed, one unchanged search-pricing assertion at `tests/search.test.ts:74`. Restricted final esbuild config read failed; permitted final run completed with the same result. |
| Shared ID/service-foundation/submission tests | **Passed:** 33 tests in this session before hosted completion; unchanged source did not require repeating them. |
| Current actual-component/SDK browser | **Passed:** 30 groups, zero unexpected runtime errors/warnings; 22 intentional injected network failures. [Current report](revalidation-browser-report.json). |
| Resident production Webpack build | **Passed:** exit 0, TypeScript and `/settings/valid-id` output. Restricted baseline generated-folder EPERM recorded separately. |
| Admin production Webpack build | **Passed:** exit 0, TypeScript; transient socket retries before compilation. Initial wrong workspace invocation corrected after reading package name `@barangayan/web`. |
| Real production guest checks | **Passed:** both Login return paths, no console errors/warnings. [Current guest report](revalidation-guest-report.json). |
| Current hosted checks | **Passed:** seven scenario groups; [report](hosted-browser-report.json), [final pre-cleanup readback](hosted-final-state.json). |
| Incremental config/source cleanup | Generated type includes removed; no app config diff from this execution. Existing app/shared changes preserved; no new production source change/dependency/migration was necessary. |

Hosted console review: no page/runtime errors; two expected console errors from the intentional lost publication response and rejected Profile-write fixture. There are 25 unused preload warnings for existing resident/admin stylesheets and admin logo. All ten resident CSS assets match the pre-hosted baseline byte-for-byte ([comparison](css-baseline-comparison.json)); admin preload warnings and the resident destination-stream-closed diagnostic were already recorded in Phase 5. The current resident server recorded six such diagnostics during verifier navigation; admin server log is clean. This is not claimed to be a warning-free run. No application source changed in this follow-up and no unrelated warning fixes/suppression were added.

Cleanup calls succeeded: global test-session signout, new reviewer role removal and all three new login bans. Test profiles, two evidence versions, avatar and the single zero-payment request are retained. Existing disabled Phase 5 accounts were not modified or re-enabled. The controller and both local apps stopped; ports 3236/3237/3238 were checked closed. An optional independent cleanup readback was not run because automatic approval review rejected additional service-role-key retrieval; no workaround or indirect execution was used. Successful cleanup API responses are the evidence for those actions, distinguished from independent readback. JSON/Markdown evidence was scanned for JWTs, secret-key patterns and signed URL tokens and contains none; private evidence paths were removed from the final summary.

Synthetic identifiers: resident `27a3cf31-a7a1-4eec-9dbf-e68e42c9ea19`, reviewer `606ace67-818f-44ad-8abe-1298ef130ec2`, incomplete resident `de41d01e-2b2d-4e30-8ec9-a1908e4f1495`; front-only version `80508c07-2296-42fc-a3ee-de36b23ee164`, two-sided version `b0f7ad9d-13da-472f-b8ef-edb28aee5ecf`, request `2707d24d-dade-4aee-b9fa-4ed8ffdd7ea2`.

Visually inspected [retained Profile](hosted-retained-profile.png) and [two-sided service](hosted-two-sided-service.png). Additional evidence: [complete bookmark](hosted-complete-bookmark.png), [incomplete compact bookmark](hosted-incomplete-bookmark.png), [front-only review](hosted-review.png), [fresh verified status](hosted-verified.png), [two-sided staff review](hosted-two-sided-review.png). The service-destination screenshot is not used as proof of payment readiness; actual request creation/persistence is proven separately.

Local reproducer/helpers and full build/test/server logs are under `tmp/valid-id-phase6-current/`; these helpers are temporary verification code. No new production implementation defect was found. The global/Phase 1 plan summaries remain stale and unchanged under selected-phase-only editing. Earlier guard notes are historical; actual complete/incomplete guards are verified on the current code. Physical camera, live OCR, payment completion and wider release remain in their separate phases, with **no remaining Phase 6 acceptance blocker**.
