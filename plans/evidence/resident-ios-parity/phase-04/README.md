# Phase 4 — Authentication, guest access, setup, recovery and session management (`P04`)

**Status (2026-10-15):** Partially complete. T01–T07 are implemented and verified on non-device checks (typecheck, lint, 49 new tests, export, generated configuration). T08 and every live-provider or device run are Skipped (OD-06) or blocked: Phase 3 exit, PR-03 (callback scheme), PR-06 (Apple provider) and PR-18 (tenant/environment) are open. See the record for owner-attended steps.

**Entry dependencies:** Phase 1, Phase 2, Phase 3. Started on the owner's explicit 2026-10-15 instruction while the Phase 3 and Phase 1 exits were open (see the record, section 1). Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/auth engineer + backend/security. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Working email/Google/Apple + setup/verification/password/recovery/guest/session/logout flows.

**Tasks:** P04-T01, P04-T02, P04-T03, P04-T04, P04-T05, P04-T06, P04-T07, P04-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P04` (and `supporting_phases` for contributions).

## Evidence

- [P04_2026-10-15_implementation-and-verification.md](P04_2026-10-15_implementation-and-verification.md) — scope, dependencies, decisions P04-D01…D10, baseline vs final checks, pending manual verification, out-of-scope findings.

Repository artifacts: `apps/resident-ios-mobile/src/auth/`, `src/features/auth/`, `src/app/auth/`, `tests/auth-*.test.ts`.
