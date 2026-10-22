# Phase 20 — TestFlight, App Store preparation, rollout and final conversion sign-off (`P20`)

**Status (2026-10-21):** Partially complete (non-device scope, OD-06/OD-07/OD-14). The release-preparation package, runbooks and the truthful final report exist; **no release, TestFlight build, store submission or rollout exists** and none was attempted. The exit is **not met**: seven required feature gates are closed, no device/live/hosted-staging evidence exists, no gate was approved in this phase, and G17/G20/G21/G22 are not ready or not met. See `P20_2026-10-21_implementation-and-verification.md`.

**OD-06 (2026-10-14):** no signed builds for the whole plan. P20-T01's signed-candidate inspection, P20-T04 (TestFlight), P20-T07 (store submission) and P20-T08 (staged rollout) are Skipped (OD-06; Pending device under OD-14). P20-T02/T03 prepare compliance and reviewer material without submitting; P20-T05 prepares the gate register (approvals are the owner's); P20-T06 and P20-T09 remain in full. See plan §1.

**Entry dependencies:** Phase 19 (Partially complete; its open exits are carried). **Lead owner role:** Release/Apple/EAS owner + QA/product/privacy/operations. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** *(OD-06)* the release-preparation package, runbooks and the truthful code-complete, non-device-verified conversion report — not a release.

**Tasks:** P20-T01 … P20-T09 — see plan §4.3 and `../execution-ledger.csv`.

## Evidence

- [P20_2026-10-21_implementation-and-verification.md](P20_2026-10-21_implementation-and-verification.md) — how the phase was run, what changed, findings P20-F01…F13, task statuses, pending manual steps, the owner question.
- [P20-T01_…environment-profiles-and-candidate-inspection.md](P20-T01_2026-10-21_environment-profiles-and-candidate-inspection.md) with `inspect-candidate.mjs` → `inspection-results.json` and `P20-T01_check-release.txt`. Rerun: `node plans/evidence/resident-ios-parity/phase-20/inspect-candidate.mjs` after `npm run export:ios`.
- [P20-T02_…app-store-compliance.md](P20-T02_2026-10-21_app-store-compliance.md) with `privacy-scan.mjs` → `privacy-scan-results.json`.
- [P20-T03_…reviewer-package.md](P20-T03_2026-10-21_reviewer-package.md) — gap list and a note template; not publishable until the owner supplies the review environment.
- [P20-T05_…gate-signoff-register.md](P20-T05_2026-10-21_gate-signoff-register.md) — G01–G22 and the 14 feature gates; the sign-off column is the owner's.
- [P20-T06_…operations-and-rollback.md](P20-T06_2026-10-21_operations-and-rollback.md) with `rollback-0135-0136.sql` (never applied to hosted), `rollback-rehearsal.sh` and `rollback-rehearsal-result.txt` (clone run, PASS). Rerun: `bash plans/evidence/resident-ios-parity/phase-20/rollback-rehearsal.sh` (needs the local Supabase stack in Docker; clones into a throwaway database).
- [P20-T09_…final-conversion-report.md](P20-T09_2026-10-21_final-conversion-report.md) — the C.6 checklist and the statement that the conversion is not complete.

Source identity for this phase is `../phase-19/candidate.json` (refreshed 2026-10-21; stale after any later source or contract change).
