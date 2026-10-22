# Phase 19 — Whole-app parity, accessibility, resilience and production-candidate verification (`P19`)

**Status (2026-10-21):** Partially complete (non-device scope, OD-06/OD-07/OD-14). Audit tooling, 725 iOS tests, 826 database assertions and 7 concurrency checks on a database clone, a secret scan of both exports and the source-candidate freeze pass. P19-T08: the owner dropped crash reporting (OD-18); the hosted reporter built under OD-17 was removed. The exit is not met: seven required feature gates stay closed, 949 of 1,218 checkpoints rest on family-level evidence, and device, live and hosted-staging evidence is Pending/Skipped. Phases 3–18 open exits carried. See `P19_2026-10-21_audit-and-verification.md`.

**OD-06 (2026-10-14):** no signed builds for the whole plan. This phase produces a source candidate (commit, lockfile, generated configuration, backend versions) with non-device evidence; physical-device, assistive-technology-on-device, performance and native-symbolication evidence is Skipped (OD-06) or Pending device (OD-14). See plan §1.

**Entry dependencies:** Phase 1–18 (plan §4.2). Their open exits are carried as blockers; phase-specific prerequisites are in `../phase-00/prerequisite-register.md`.

**Lead owner role:** QA lead + iOS/backend/security/design/accessibility. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Complete signed candidate and exhaustive functional/design/security/lifecycle evidence with closed parity gaps. *(OD-06: complete source candidate with non-device evidence; no signed candidate.)*

**Tasks:** P19-T01 … P19-T09 — see plan §4.3 and `../execution-ledger.csv`.

## Evidence

- [P19_2026-10-21_audit-and-verification.md](P19_2026-10-21_audit-and-verification.md) — how the phase was run, baseline versus final, findings P19-F01…F09, every task, gates, the §4.5 cross-phase matrix, pending device steps and the one owner question.
- [P19-T08_2026-10-21_crash-reporting-plan.md](P19-T08_2026-10-21_crash-reporting-plan.md) — **withdrawn** crash reporter plan (OD-17, superseded by OD-18): kept as history of what was planned, built, verified and then removed.
- `audit.mjs` → `audit-results.json`, `checkpoint-coverage.csv` (1,218 rows), `coverage-report.md` (sections, 64 routes, 16 modal families). Rerun after any source, test, ledger or gate change: `node plans/evidence/resident-ios-parity/phase-19/audit.mjs` (exits 1 on any unresolved route, modal, locator or drifted total).
- `freeze.mjs` → `candidate.json` — identity of the source candidate (base commit, content hashes, lockfile, migration and hosted function state). Stale after any later source or contract change.
- `P19-T07_expo-install-check.txt`, `P19-T07_check-release.txt` — SDK patch drift and the release diagnostic (fails by design).
- Automated regression added to the iOS workspace: `tests/whole-app.test.ts` (route integrity, accessibility semantics, theme-token discipline).
