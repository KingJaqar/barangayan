# Resident web Valid ID execution evidence

Implementation and runtime checks: 2026-10-15, Asia/Manila. Final review and progress recording: 2026-10-16.

The local implementation of Phases 2–6 is delivered. Release is **partially complete**: the new OCR.space function is not deployed and no authorized resident/staff write flow has been performed. No production-readiness claim is made.

## Delivered behavior

- `/settings/valid-id` provides the four steps, front-only upload/camera, editable confirmed details, birthday wheels, exact review, immutable publication and unknown-outcome recovery. Drafts remain in memory and are invalidated on account changes.
- A single Settings provider owns account-scoped ID status, focus and Realtime refresh. Valid ID follows Profile in both navigation layouts. Profile's old ID section and unused signed-URL action were removed; service links and web-local verification messages use the new destination. The old fragment hands off only after Profile can mount.
- Optional OCR uses an isolated authenticated Edge Function, separate capped derivative, server-only key, resident limiter, provider validation and bounded cancellation. The original evidence is preserved. Manual submission never requires OCR. The existing parser has a separate conservative suggestion entry point; its original entry point preserves old-client behavior.
- No dependency, migration, Android change, commit, push, deployment, remote mutation or external configuration change was introduced. Existing unrelated iOS/shared changes were preserved.

## Actual checks

| Check | Result |
| --- | --- |
| Resident-web typecheck | Passed before implementation and after implementation. Final production build also completed its TypeScript stage. |
| Resident-web lint | Passed, zero new errors/warnings. The same two baseline location-verification warnings remain. |
| Full resident-web Vitest suite | Baseline: 67 passed, 1 failed. Final: 84 passed, the same 1 failed. `tests/search.test.ts:74` still expects the obsolete per-page pricing label. |
| New draft/transport/access tests | Passed: 17 tests in `valid-id.test.ts` and `valid-id-route.test.ts`. |
| New OCR handler and actual adapter wiring | Passed: 35 tests across 2 files. Includes caller authorization, MIME/container/path/byte limits, server limiter, provider HTTP/JSON/partial/empty/quota failures, missing key, a real transport abort at the 25-second bound, parser warnings and old-parser compatibility. All backend/provider replies are fixtures. |
| Existing shared compatibility suites | Passed: 33 tests across ID evidence, service foundations and resident submission. |
| Existing Google extraction suite | Passed: 10 tests. Its handler and entry point were not modified. |
| Edge source static TypeScript check | Passed using installed TypeScript, the installed SDK and a minimal temporary declaration of existing `Deno.env.get`/`Deno.serve` APIs. This is not a Deno runtime/deployment pass; no Deno CLI is installed. |
| Default production build | Baseline Turbopack compilation stalled and was interrupted. No default-bundler pass is claimed. |
| Webpack production build | Passed with `npm run build --workspace=@barangayan/resident-web -- --webpack`; `/settings/valid-id` appears in route output. A restricted-sandbox rerun hit Windows `EPERM` creating generated route directories; the final unrestricted local build passed. Generated tsconfig output includes were removed afterward. |
| Component/browser integration | Passed in Chrome 155.0.8059.79 using actual Settings/Profile/Valid ID components, actual shared publication and fixture transports. See `browser-report.json`. |
| Actual production-server guest navigation | Passed in Chrome 155.0.8059.79: fixed Valid ID Login return path, existing Profile fragment server guard, no console errors/warnings. See `guest-browser-report.json`. Server/browser were run outside the sandbox after sandbox networking denied localhost access; temporary servers were stopped. |
| Diff/dependency cleanup | Removed the old ID components/helpers/action and checked remaining references. No new package or lockfile changes. |

Browser coverage includes narrow/wide layouts (360/768/1440 pixels), dark mode, 200% CSS zoom, step preservation, synchronous duplicate navigation/submission, shared field validation, exact 5,242,880-byte evidence and one byte over, malformed/empty files, failed/cancelled/same-file replacements, WebP conversion and three-attempt encoding failure, camera denial/ignored permission/late stream cleanup and canvas-backed video capture, fast wheel confirmation of a leap day, Cancel/Escape/clear/focus restoration, edited/cleared-field protection, type/account/upload/OCR races, current/approved status mismatch, repair/failure badges, lost publication responses and same-ID reconciliation/retry.

The browser report intentionally lists browser network errors from injected 503/429/409 and lost-response scenarios. There were no unexpected runtime/page errors or warnings. These fixtures are not live OCR, real authentication, physical-camera or staff-review evidence. Screenshots contain only a synthetic test image.

Reproduce the component checks from the repository root:

```text
node apps/resident-web/tests/valid-id-browser.mjs
```

For the real-server guest check, start an existing local production build, set `VALID_ID_TEST_BASE_URL` to its localhost URL, and run `node apps/resident-web/tests/valid-id-guest-browser.mjs`.

Detailed command logs are in `tmp/valid-id-execution/`: `baseline-*`, `verified-typecheck.log`, `verified-lint.log`, `final-web-tests.log`, `final-shared-tests.log`, `final-existing-extraction-tests.log`, `adapter-tests-final.log`, `final-edge-typecheck.log`, `build-final.log`, `final-browser-verified.log`, `guest-browser-final.log` and runtime server logs.

## Read-only target readiness

The linked project `pwjbucnyqexiepoinoke` was inspected without changing resident data. Migration 0118 is applied (history currently extends through 0127). Confirmed-details storage exists, `back_path` is nullable, publication accepts confirmed details, ID storage remains private, submission RLS is enabled, service submission conditionally checks back evidence, and the extraction limiter is service-role-only. Database timezone is UTC. The existing Google function remains active with JWT verification; the new OCR.space function is absent from deployed functions.

The previously recorded saved secret name is not a key-validity test. No secret value was retrieved, displayed, copied or sent to a provider in this execution.

## Remaining acceptance and exact manual steps

| Release criterion | Status |
| --- | --- |
| Navigation/status | Pending manual verification of the incomplete-account legacy bookmark after required Profile setup. Automated navigation/badge and real guest checks pass. |
| Access/state | Met by server access tests, real guest routing and browser account-race fixtures; authorized resident sessions are part of the remaining live integration gate. |
| Photo/details | Pending manual verification on a physical camera and real caller-authorized Storage; all listed browser/file fixtures pass. |
| Details/review | Met in actual-component browser tests and shared validation fixtures. |
| Submission recovery | Met in actual-helper browser fixtures; actual persistence/approval is still the live integration gate. |
| Regression/cleanup | Pending manual verification of retained Profile/avatar/household writes, legacy two-sided approval previews and front-only approved service use. Source cleanup, rendered controls and compatibility tests pass. |
| Execution/quality | Met for the recorded local checks, with only the explicitly recorded baseline failure/warnings/build limitation. |
| OCR.space integration | Pending manual verification: deployment, configured key acceptance and real provider suggestions. Fixture error/fallback tests pass. |
| OCR races/compatibility | Met in browser/handler/adapter/shared compatibility tests. |
| Integration/release | Not met: authorized live resident submission, staff review and service-use evidence does not yet exist. |

1. Obtain owner authorization to deploy **only** `extract-resident-id-ocrspace` with gateway JWT verification enabled. Preserve the existing Google endpoint and external configuration. Verify the already-saved server secret through successful use, without revealing its value.
2. In owner-designated resident and staff accounts in the linked environment, start with a non-sensitive synthetic front image. Verify optional OCR success, then complete a separate manual submission with OCR unavailable through controlled fixtures rather than changing shared external configuration. Confirm immutable front-only evidence, all four trimmed detail keys, no Profile overwrite and the fresh current status.
3. Have the authorized staff account review that submission. Verify the resident's updated badge and a real front-only service request. Check retained two-sided evidence and Profile/avatar/household edits using designated test records only.
4. Repeat access with an existing incomplete resident Profile and a nonresident account. Open the old fragment with complete/incomplete accounts: Profile's existing setup guard runs before a fragment can be handled; do not bypass it or create a redirect loop.
5. On the intended physical camera/browser, test permission allow/deny/ignore, capture/cancel, navigation/logout while open and device indicator cleanup. Confirm keyboard/focus behavior with the intended accessibility tools. Validate the wheel around Manila midnight–07:59, when the shared UTC maximum is the preceding calendar day. Pure date-boundary tests already pass, but an actual boundary-clock wheel session was not performed.

No release checklist item requiring these live/manual results is marked passed on fixture evidence alone.
