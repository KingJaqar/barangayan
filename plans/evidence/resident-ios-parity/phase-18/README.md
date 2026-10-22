# Phase 18 — Actionable Home, information pages, complete exports and account privacy (`P18`)

**Status (2026-10-21):** Partially complete (non-device scope, OD-06/OD-07/OD-14). T01, T02, T03 and T06 verified on non-device checks (guest web localhost run included); T04, T05, T07 and T08 partial. Migration `0136`, the `export-my-data`/`delete-my-account` v2 changes and migration `0135` are **not** applied or deployed (owner approval); `completeExport` and `accountDeletion` stay closed; the retention matrix is approved (PR-14, OD-16) but Apple revocation (PR-06), the Privacy Policy wording update (applied to hosted 2026-10-21) and every device run are open. Phase 4–6 and 9–17 open exits carried. See `P18_2026-10-21_implementation-and-verification.md`.

**Entry dependencies:** Phase 4, Phase 5, Phase 6, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17. These are Partially complete or Verified as recorded in the plan; their open exits are carried as blockers. Phase-specific open prerequisites are listed in `../phase-00/prerequisite-register.md`.

**Lead owner role:** iOS/information engineer + privacy/backend/content/support. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Fully actionable Home and complete information/privacy/export/deletion/logout surface with real linked workflows.

**Tasks:** P18-T01, P18-T02, P18-T03, P18-T04, P18-T05, P18-T06, P18-T07, P18-T08 — see plan §4.3 and `../execution-ledger.csv`. Assigned checkpoints: filter `../phase-00/parity-ledger.csv` by `primary_phase = P18` (and `supporting_phases` for contributions).

## Evidence

- [P18_2026-10-21_implementation-and-verification.md](P18_2026-10-21_implementation-and-verification.md) — implementation, decisions P18-D01…D15, baseline versus final, acceptance, owner decisions and out-of-scope observations.
- [P18-T05_2026-10-21_privacy-policy-retention-wording.md](P18-T05_2026-10-21_privacy-policy-retention-wording.md) — the Data Retention wording published after the PR-14 approval, the previous text and the update that was run.

Add further records named `<task-id>_<yyyy-mm-dd>_<slug>.<ext>` following `../README.md`.
