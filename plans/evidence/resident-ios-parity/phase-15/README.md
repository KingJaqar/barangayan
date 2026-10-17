# Phase 15 — QR guide, center QR exports, household QR and online emergency check-in (`P15`)

**Status (2026-10-16):** Partially complete (non-device scope, OD-06/OD-07/OD-12). T01–T06 verified on non-device checks (typecheck, lint, 35 new tests, export, generated configuration, QR output decoded by a real reader, read-only hosted contract check); `evacuationCheckin` (G08) and `householdQr` (G15) opened by owner decision OD-12, which also approves on-device household QR generation; T07 partial; camera, Photos, share-sheet, live and device runs Skipped. Phase 3, 4, 5, 13 and 14 open exits carried. See `P15_2026-10-16_implementation-and-verification.md`.

**Entry dependencies:** Phase 3, Phase 4, Phase 5, Phase 13, Phase 14. These are Partially complete or Verified as recorded in the plan; their open exits are carried as blockers. Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/QR engineer + DRRM/backend/privacy. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Working QR guide/scanner/center show-share-save/household display and truthful online resident-only check-in.

**Tasks:** P15-T01, P15-T02, P15-T03, P15-T04, P15-T05, P15-T06, P15-T07 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P15` (and `supporting_phases` for contributions).

## Evidence

- [P15_2026-10-16_implementation-and-verification.md](P15_2026-10-16_implementation-and-verification.md) — implementation, decisions P15-D01…D09, baseline versus final, acceptance and open items.

Add further records named `<task-id>_<yyyy-mm-dd>_<slug>.<ext>` following `../README.md`.
