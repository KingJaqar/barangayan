# Phase 5 — Profile, household, avatar, ID evidence and location verification (`P05`)

**Status (2026-10-15):** Partially complete. T01, T02, T06 (except address detection, pending PR-10) and T07 are Verified (non-device scope, OD-06/OD-07); T03 (household editing) and T04/T05 submission (ID evidence) are implemented and logic-verified but their release gates (`householdEditing`, `privateIdUploads`) stay closed pending G03/G04, which need the Phase 3 exit; T08 live runs are Skipped (OD-07). No screen was run and nothing was committed, deployed or applied remotely.

**Entry dependencies:** Phase 2, Phase 3, Phase 4. Started on the owner's explicit go-ahead while the Phase 3 and Phase 4 exits are open (decision-register OD-08). Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/profile engineer + verification/backend owners. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Complete Settings profile/household/birthday/avatar/ID/location workflows and authoritative approved-ID readiness.

**Tasks:** P05-T01, P05-T02, P05-T03, P05-T04, P05-T05, P05-T06, P05-T07, P05-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P05` (and `supporting_phases` for contributions).

## Evidence

- [P05_2026-10-15_implementation-and-verification.md](P05_2026-10-15_implementation-and-verification.md) — scope, dependencies, decisions P05-D01…D08, baseline vs final checks, acceptance status, pending manual verification, out-of-scope findings.

Repository artifacts: `apps/resident-ios-mobile/src/features/profile/`, `src/lib/image-prep.ts`, `image-source.ts`, `leaflet-assets.ts`, `tests/profile.test.ts`, `scripts/generate-leaflet-assets.mjs`.
