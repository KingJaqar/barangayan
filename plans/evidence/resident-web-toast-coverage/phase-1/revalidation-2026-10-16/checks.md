# Checks run in this revalidation

2026-10-16, Asia/Manila. The audit authored documentation/evidence only. Baseline checks ran before these evidence edits. Final app checks were justified by the **material concurrent source changes**, rather than rerunning an unchanged failure without a new reason. No failing application code was patched by this audit.

| Check / actual command | Baseline result | Final recheck |
|---|---|---|
| `npm run typecheck --workspace=@barangayan/resident-web` | **Pass**, exit 0 | **Pass**, exit 0 |
| `npm run lint --workspace=@barangayan/resident-web` | **Pass with existing warnings**, exit 0, zero errors, two warnings | **Same**, zero errors/two same warnings |
| From `apps/resident-web`: `..\..\node_modules\.bin\vitest.cmd run --config vitest.config.ts` | Sandboxed startup failed before tests: esbuild could not read required ancestor directory. Permission-review attempt timed out; permitted retry ran: **142 passed, 1 failed**, 12 passing files/1 failing | Permitted run after concurrent source changes: **142 passed, same 1 failed**, 12 passing files/1 failing; no new suite failure |
| `npm run build --workspace=@barangayan/resident-web` | **Failed before application changes by this audit**: Next 16.3.0 Turbopack local CSS processing worker exited before connection | No final production build claimed. After reading panic evidence, one permitted baseline retry reproduced the same failure. Stopped this approach; no server/config workaround |
| AST inventory of notification imports/calls | Initial 292 modules/115 calls, including dynamic dispatch/helpers | Stable checkpoint 289 modules/185 calls; exact file/line data in TSVs |
| Evidence integrity / scope review | Existing uncommitted work and older evidence identified and preserved | See [verification.json](verification.json): 84/84 unique catalog rows, paths/links verified or explicitly documented removed, selected-phase-only plan diff, and checkpoint drift report |

The existing lint warnings are:

- `src/app/(resident)/settings/location-verification/location-verification-form.tsx:94`: missing `boundary` effect dependency.
- `src/app/(resident)/settings/location-verification/location-verification-map.tsx:102`: unused existing eslint-disable directive.

The existing test failure is `tests/search.test.ts:74`, “shows current charter pricing and processing guidance instead of a misleading flat fee.” Expected `₱10 per confirmed billable page · assessed by staff · 30 minutes of agency processing`; received `₱10.00 per page · 30 minutes of agency processing`. It failed before and after the revalidation. Search pricing is outside Phase 1; it was not changed to make the suite pass.

Baseline/final tests include **six session-feedback**, **six sign-out**, **29 settings-recovery**, **19 email-change**, **15 valid-ID**, **25 require-user**, and other resident-web tests. All those files passed. The auth and email tests use mocks and do not exercise all newly observed client toast branches. They establish the existing tested contracts, not external mail/Google delivery or production readiness.

Our baseline build error was `TurbopackInternalError` for the generated Google local-font CSS module, caused by “creating new process / node process exited before we could connect to it with exit code: 0.” The permitted run produced the same signature. This is a pre-existing/tooling build failure observed by this audit, not a verified root-cause diagnosis. Do not describe it as fixed or definitively caused by sandbox permissions. An independently written earlier Phase 1 note reports a passing isolated build; it was preserved and is not counted as our successful build. A successful final production build remains necessary before a later readiness claim.

Detailed command outputs are retained under `tmp/toast-phase1-audit-20261016/` as baseline-typecheck.txt, baseline-lint.txt, baseline-tests.txt (startup), baseline-tests-permitted.txt, baseline-build.txt, baseline-build-permitted.txt, final-typecheck.txt, final-lint.txt, and final-tests.txt. No secrets or resident data were printed. No build output was deployed.

## Source and diff review

The initial status showed extensive unrelated tracked/untracked edits. Initial fingerprints covered 449 source/config/test files. Later comparison detected external changes; these were not reverted. The checkpoint copy/fingerprint at 20:05:17 showed no changes **during capture**, with 28 differences from baseline, including three removed onboarding-related files. The application source written by this audit is **none**. A source checkpoint and a final drift report are distinguished from a guarantee that no other process will edit the workspace later.

Only this revalidation evidence folder, the selected Phase 1 progress note, and task-specific temporary audit scripts/logs were authored by this audit. Existing sibling Phase 1 evidence and the concurrent completion note were preserved. The plan comparison excludes only Phase 1's body/status row and confirms other phase text was not changed by our note. No code/file deletion, production migration, network mutation, commit, push, deployment or external message was performed.

No new tests were added for a documentation-only change. No browser/server was started; there was no modified UI to screenshot. The following remain **pending manual verification in their implementing phases**: open the existing host in light/dark and narrow/wide layouts; verify focus/hover/reduced-motion/dialog coexistence and screen-reader announcement ownership; exercise explicit action success/error/uncertainty/cancel/account-switch paths while watching browser/server console. Use fixtures for deletion/payments; never create chargeable transactions or delete real accounts for copy verification.

## Phase 1 exit criteria

| Criterion | Status |
|---|---|
| Repository instructions and required versioned framework orientation | **Met**; no app framework code written |
| Existing work and baseline login/logout preserved by this audit | **Met**; no application edits authored, concurrent changes preserved, contract tests pass |
| Static/dynamic/helper notification inventory | **Met**; checkpoint AST inventory stored |
| All catalog actions have source ownership/result or precise reachability/boundary limitation | **Met**; 84 rows plus current-source correction supplement |
| Result/identity/inline-live/navigation ownership recorded | **Met**; per-row ledger and checkpoint corrections |
| Quiet decisions explicit | **Met**; six QUIET rows and quiet success/cancel branches recorded |
| Client/server boundary and no-extra-request feasibility recorded | **Met**; callback, persistence, receipt and server-refresh limits visible |
| Replacement callers and baseline/check evidence retained | **Met**; no scoped replacement/removal in this phase; cross-app consumer recorded |

Phase 1 is complete because its exit explicitly permits documented limits. Missing later-phase toast behavior, unavailable onboarding, browser-only acceptance, the existing test failure, and our unsuccessful baseline build remain visible. The full toast plan and production readiness are not complete.
