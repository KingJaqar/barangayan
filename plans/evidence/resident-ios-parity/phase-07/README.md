# Phase 7 — Services catalogue, guidelines and charter detail (`P07`)

**Status (2026-10-15):** Partially complete. T02–T06 are Verified (non-device scope, OD-06/OD-07); T01 is verified for Documents/Requests and its Logs segment closes with P09-T05. No screen was run and nothing was committed, deployed or applied remotely.

**Entry dependencies:** Phase 2, Phase 3, Phase 4, Phase 5, Phase 6 (the Phase 3–6 exits are open and carried as blockers; started on the owner's explicit go-ahead, 2026-10-15). Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/services engineer + catalogue owner. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Complete discoverable catalogue/detail/charter/guideline routes ready for real submissions.

**Tasks:** P07-T01, P07-T02, P07-T03, P07-T04, P07-T05, P07-T06 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P07` (and `supporting_phases` for contributions).

## Evidence

- [P07_2026-10-15_implementation-and-verification.md](P07_2026-10-15_implementation-and-verification.md) — entry check, requirement classification, decisions P07-D01…D08, baseline vs final checks, acceptance status, pending manual verification, out-of-scope findings.

Repository artifacts: `apps/resident-ios-mobile/src/features/services/`, `src/app/(tabs)/services/`, `src/app/requests.tsx`, `src/components/ui.tsx` (`SearchField`, `Segmented`), `src/data/schemas.ts`, `src/auth/pending-destination.ts`, `tests/services.test.ts`.
