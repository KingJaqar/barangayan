# Phase 14 — Evacuation centers, device location, route guidance and DRRM interactions (`P14`)

**Status (2026-10-16):** Partially complete (non-device scope, OD-06/OD-07/OD-11). T01–T07 verified on non-device checks (typecheck, lint, 51 new tests, export, browser run of the map page, read-only hosted contract check, test requests to the barangay's own route function); `routeService` opened by OD-11; Android's offline routing pack kept out of scope for now; T08 live and device runs are Skipped. Phase 3, 4, 6, 12 and 13 open exits carried. See `P14_2026-10-16_implementation-and-verification.md`.

**Entry dependencies:** Phase 2, Phase 3, Phase 13. Phase 3 and Phase 13 are Partially complete; their open exits are carried as blockers. Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/location engineer + DRRM/privacy/provider owner. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Complete center/location/route/DRRM journey with approved processor and explicit estimate/freshness semantics.

**Tasks:** P14-T01, P14-T02, P14-T03, P14-T04, P14-T05, P14-T06, P14-T07, P14-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P14` (and `supporting_phases` for contributions).

## Evidence

- [P14_2026-10-16_implementation-and-verification.md](P14_2026-10-16_implementation-and-verification.md) — implementation, decisions P14-D01…D11, baseline versus final, acceptance and open items.

Add further records named `<task-id>_<yyyy-mm-dd>_<slug>.<ext>` following `../README.md`.
