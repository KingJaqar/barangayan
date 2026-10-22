# Phase 17 — Server inbox, durable remote push and notification preferences (`P17`)

**Status (2026-10-21):** Partially complete (non-device scope, OD-06/OD-07/OD-14). T01 and T03–T07 verified on non-device checks; T02 and T08 partial; migration `0135` and the `send-notifications` function are **not** applied or deployed (owner approval); `remotePush` stays closed; sender operator and alert thresholds (PR-07) and every device/APNs run are open (Pending device). Phase 3, 4, 9, 10, 11, 12, 15 and 16 open exits carried. See `P17_2026-10-21_implementation-and-verification.md`.

**Entry dependencies:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 9, Phase 10, Phase 11, Phase 12, Phase 15, Phase 16. These are Partially complete or Verified as recorded in the plan; their open exits are carried as blockers. Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** Notification/backend operations + iOS + privacy. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Operating server-backed inbox/outbox/push/preferences/tap routing with receipt monitoring and accountable ownership.

**Tasks:** P17-T01, P17-T02, P17-T03, P17-T04, P17-T05, P17-T06, P17-T07, P17-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P17` (and `supporting_phases` for contributions).

## Evidence

- [P17_2026-10-21_implementation-and-verification.md](P17_2026-10-21_implementation-and-verification.md) — implementation, decisions P17-D01…D16, baseline versus final, acceptance, pending steps and out-of-scope observations.

Add further records named `<task-id>_<yyyy-mm-dd>_<slug>.<ext>` following `../README.md`.
