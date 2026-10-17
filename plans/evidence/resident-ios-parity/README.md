# Resident iOS parity — execution and evidence index

Initialized 2026-10-13 by Phase 0 (P00-T02) of [Resident_iOS_Implementation_Plan.md](../../Resident_iOS_Implementation_Plan.md), paired with [Resident_iOS_UI_UX_Design_System_Handoff.md](../../Resident_iOS_UI_UX_Design_System_Handoff.md) Revision 2.1.

This index is the only evidence root for the resident iOS roadmap (Phase 0–Phase 20, `P00`–`P20`). Other directories under `plans/evidence/` (for example `phase0`…`phase9`, `admin-table-*`, `resident-registration-otp`, `resident-drrm-routing`) belong to other plans. They are **historical** for this roadmap and do not count as evidence for an identically numbered iOS phase. Transfer requires an explicit impact assessment recorded in the receiving phase directory.

The permanently cancelled Android usability phase (Phase 8 of `Major_Web_AndroidMobile_Improvement_Plan.md`) is outside this roadmap. Resident iOS Phase 8 builds document forms/submission and is unrelated.

## Layout

| Path | Contents |
|---|---|
| `execution-ledger.csv` | 21 phases + 162 tasks. Fields: status, lead role, named owner, start/finish, blocker, implementation commit, native build, backend/environment, evidence locator, approver. Generated, then maintained by phase owners. |
| `phase-00/` | Baseline, parity/route/modal ledgers, decision and prerequisite registers, contract boundaries, design-state inventory and the scripts that regenerate/verify them. Start with `phase-00/README.md`. |
| `phase-01/` … `phase-20/` | One directory per phase. Each holds its own README (status, evidence list) and artifacts. Empty until that phase starts. |

## Ledgers

| Ledger | Rows | Key |
|---|---:|---|
| `phase-00/parity-ledger.csv` | 1,218 | A01-001 … A52-012. Primary/supporting phase, design families, DX, T, F, G, B contracts, Android source state, §6.8 corrective disposition, iOS baseline state/locator, owner role, named owner, status, evidence. |
| `phase-00/route-ledger.csv` | 54 + 10 | R01–R54 (Android route/layout files) plus IR01–IR10 iOS-only/alias contracts. Current iOS shell path and its disposition. |
| `phase-00/modal-ledger.csv` | 16 | Plan B.3 modal/overlay families. |
| `phase-00/section-summary.md` | 52 | Per-section roll-up generated from the parity ledger. |

Regenerate and re-verify after any plan, handoff, breakdown or Android route change:

```bash
node plans/evidence/resident-ios-parity/phase-00/build-ledgers.mjs
```

It exits 1 if any checkpoint, route, modal family, phase or task is missing, miscounted or unassigned, and records wording drift against the breakdown in `phase-00/ledger-check.json`. Regeneration overwrites the generated columns. Once a phase starts, record status/evidence changes in that phase's directory and in `execution-ledger.csv`; the generator's `P00_STATUS` map is only the Phase 0 initial state.

## Status vocabulary

Phases and tasks: `Planned`, `In progress`, `Blocked` (with reason, owner and next prerequisite), `Implemented-unverified`, `Verified`, `Reopened` (plan §4.2).
Checkpoints: `Planned`, `implemented-unverified`, `verified`, `blocked`, `corrective-equivalent-verified` (plan C.5). "Not applicable" needs a source-state explanation and cannot suppress a working feature.

Android source state (`android_state` column): `working-source` (traced in source; not device-verified), `partial`, `defective`, `conditional`, `unconnected`, `inert-control`, `local-only`, `placeholder`, `unreachable`, `partial-reachability`, `not-wired`, `platform-specific`.

iOS baseline state (`ios_baseline_state`): `not-started`, `placeholder-gated`, `partial-unqualified` (code exists; not evidence), `defective-baseline` (code conflicts with a binding requirement and must be replaced), `n/a-disposition`.

## Evidence record and naming

Every evidence file follows plan C.5. Name artifacts `<task-id>_<yyyy-mm-dd>_<slug>.<ext>` inside the owning phase directory, for example `phase-05/P05-T03_2026-11-02_household-stale-edit.md`. Each record states:

- requirement IDs (A/R/B/T/F/G/D/DX) and task ID;
- source revision (commit SHA or `uncommitted (base <sha>)`), native build (`ios-<profile>-<version>(<build>)`), backend/environment and tenant fixture;
- device/OS where relevant, test or command, expected vs observed result, date, owner and reviewer;
- disposition (pass / fail / blocked / corrective-equivalent) and any reopened evidence.

Never store secrets, tokens, OTPs, passwords, identity images, health data, precise coordinates or export contents. Use sanitized fixtures only.

Release candidates are named `ios-rc-<marketing-version>-<build-number>`; evidence for a candidate must cite that exact name. See `phase-00/decision-register.md` for severity and reopening rules.
