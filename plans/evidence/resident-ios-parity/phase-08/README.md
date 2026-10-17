# Phase 8 — Document forms, supporting evidence, review and authoritative submission (`P08`)

**Status (2026-10-15):** Partially complete. T01–T07 are Verified (non-device scope, OD-06/OD-07); T08's real-backend, device and live runs are Skipped. Nothing was committed, deployed or applied remotely, and no screen was run.

This is resident iOS Phase 8. It is unrelated to the permanently cancelled Android usability Phase 8 in `Major_Web_AndroidMobile_Improvement_Plan.md`; never start or revive that Android work here.

**Entry dependencies:** Phase 2, Phase 3, Phase 4, Phase 5, Phase 7. Phases 3–5 and 7 are Partially complete; their open exits are carried as blockers (see the plan's Phase 8 progress note). Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/services engineer + backend/verification. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** All required application forms/uploads/review and committed submission references; no partial-port form path.

**Tasks:** P08-T01, P08-T02, P08-T03, P08-T04, P08-T05, P08-T06, P08-T07, P08-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P08` (and `supporting_phases` for contributions).

## Evidence

- [P08_2026-10-15_implementation-and-verification.md](P08_2026-10-15_implementation-and-verification.md) — entry check, requirement classification, decisions P08-D01…D09, baseline vs final, acceptance status, pending manual verification, out-of-scope findings.

Repository artifacts: `apps/resident-ios-mobile/src/features/services/request-*.ts|tsx`, `src/app/services/request/[id].tsx`, `src/app/request/received.tsx`, `packages/shared/src/lib/resident-submission.ts`, `tests/request-submission.test.ts`.
