# Phase 0 — Baseline, scope freeze and execution control (`P00`) — 2026-10-13

**Status: Verified (exit 2026-10-14) for the 2026-10-13 baseline.** The owner supplied the Android captures on 2026-10-14 (`android-captures/`). Owned follow-ups that do not block Phase 0: PR-20 (triage of post-baseline Android changes, including whether DRRM offline routing joins iOS scope) and PR-21 (remaining captures before P19-T05). All inventory, mapping, register and index work is done and machine-checked. On 2026-10-13 the user chose option A: `KingJaqar` is the named owner and approver for every role (decision-register OD-01), and the Phase 0 route/API/design-state/severity/naming/reopening rules are approved (OD-02). No application source, configuration, dependency, migration, database or deployment was changed. The restored Android UI and all pre-existing uncommitted work were left untouched.

## Baseline (P00-T01)

| Item | Value |
|---|---|
| HEAD | `2e5681cd329df2b70a0591895cc1e5656a55506c` (2026-10-12 19:37 +08:00), branch `main` — matches plan §6.1 |
| Working tree | 60 pre-existing dirty entries (user's shared/admin routing-pack, `0113_routing_conditions`, plan/handoff revisions, seed). Listed in `baseline-status.txt`; the extra entries are this task's own recording files. |
| Breakdown SHA-256 | `4C7671C9…68BEFC8` — matches plan §6.1; 1,218 bullet lines |
| Plan / handoff (pre-edit) | Rev 1.5 `E329DA0C…4DD2C98E`; Rev 2.1 `3A635FAC…6CF9C3BB` |
| Lockfile | `package-lock.json` `35C8D678…62034F891` (full value in `baseline.json`) |
| Toolchain | Node `v24.13.1` (plan minimum 22.13.x), npm `11.8.0`; Windows 11, no Xcode (PR-05) |
| iOS SDK baseline | expo `57.0.10`, expo-router `57.0.10`, react `19.2.3`, react-native `0.86.2`, @expo/ui `57.0.9`, expo-secure-store `57.0.4`, supabase-js `2.112.1` — matches plan §6.7 SDK 57 baseline |
| Migrations | Repository `0001`–`0113` (111 files; `0016`, `0028` historically absent). Hosted project has the same 111 applied. Next unused prefix **`0114`** at capture; concurrent DRRM routing work then added `0114_routing_rate_limits.sql` (not this task), so it is `0115` at Phase 0 close — recheck before writing any migration. |
| Edge Functions | 9 in repository, 9 active on hosted project (versions in `hosted-inventory.json`) |
| Routes | 54 Android route/layout files (= R01–R54); 31 iOS route/layout files |
| iOS release gates | All 13 `false` (`apps/resident-ios-mobile/src/lib/release-gates.ts`) |

After capture, a concurrent session added untracked DRRM routing work (`0114_routing_rate_limits.sql`, `supabase/functions/evacuation-route/`, `packages/shared/src/lib/evacuation-route-service.ts`, `plans/evidence/resident-drrm-routing/r5-route-service/`, root `baseline_and_tsc.log`). It is not part of this baseline and was not touched. A grep at the end of 2026-10-13 still found no Android wiring. **On 2026-10-14 the capture review found that the concurrent work now modifies the Android app itself** (15 modified files; new routes `settings/valid-id.tsx` and `emergency-centers.tsx`; offline routing; migrations `0115`–`0118`; `osrm.ts` deleted). The ledger records the two routes as untriaged deltas RD01/RD02 and the triage as PR-20. The frozen baseline itself is unchanged.

Artifacts: `inventory.mjs` → `baseline.json`, `baseline-status.txt` (re-running overwrites them; keep these as the frozen 2026-10-13 baseline and write a new dated copy for later freezes). `hosted-inventory.json` records the read-only Supabase connector calls (`list_projects`, `list_migrations`, `list_edge_functions`); no SQL or writes.

## Task results

| Task | Status | Evidence |
|---|---|---|
| P00-T01 | Verified | Plan (all sections), handoff (all sections) and breakdown (headings, notes, all 1,218 bullets via verbatim comparison) read; Android/shared/iOS source and dirty changes inspected; baseline frozen as above. |
| P00-T02 | Verified | `../README.md` index, `../execution-ledger.csv` (21 phases + 162 tasks, 16 fields), `../phase-01/`…`../phase-20/`. Historical evidence kept separate; nothing marked complete because code exists. |
| P00-T03 | Verified | `parity-ledger.csv` assigns all 1,218 checkpoints a primary phase, supporting phases, P19/P20 final verification, D families, DX, T, F, G, B contracts, Android state, §6.8 disposition, iOS baseline state/locator, owner role and named owner (`KingJaqar`). `route-ledger.csv` covers R01–R54 plus IR01–IR10; `modal-ledger.csv` covers all 16 B.3 families. iOS placeholder/gate audit: `section-summary.md`. `ledger-check.json`: 0 failures, 0 rows without a named owner. |
| P00-T04 | Verified | `decision-register.md` §1: PD-01–PD-11 recorded verbatim from plan §1/§6.8 and checked consistent with handoff §0–§2. No limited scope reopened. |
| P00-T05 | Verified | `prerequisite-register.md`: PR-00 resolved; PR-01–PR-19 are owned prerequisites (owner `KingJaqar`) with current evidence, required evidence and blocked phase/gate; established authoritative facts listed. The prerequisites themselves stay open and block their later phases/gates. |
| P00-T06 | Verified (2026-10-14) | `fixtures-and-captures.md`: existing two-tenant pgTAP fixtures inventoried; every §6.8 anchor re-checked in source. `android-captures/`: all 195 owner-supplied pages indexed to routes/states (32 of 44 screens, 12 in dark mode) with 15 observations, two confirmed in source (raw icon-name facility chips at `evacuation-center-card.tsx:113`; offline route card wired). Weather routing recheck: wired in the uncommitted working tree, not at the baseline commit → PR-20. Capture gaps → PR-21. |
| P00-T07 | Verified | Approved 2026-10-13 (OD-02): typed route/backward-link rules (`decision-register.md` §3, `route-ledger.csv`), versioned API boundaries (`contract-boundaries.md`), initial design-state inventory (`design-state-inventory.md`), severity/naming/reopening rules (`decision-register.md` §4–§6). |

## Exit criteria

| Criterion | Result |
|---|---|
| All 1,218 checkpoints and 54 route/layout entries have disposition and primary delivery assignment | **Met** — `build-ledgers.mjs` fails on any unassigned row; 0 failures. |
| …and ownership | **Met** — named owner `KingJaqar` on every checkpoint, route, modal, phase and task row (OD-01). |
| Unresolved external facts are explicit blockers, not invented approvals | **Met** — PR-01–PR-15, PR-17–PR-21. |
| T52 plus inventory completeness | **Met** — all 12 A52 items have a §6.8 disposition and owning phase; counts 52/1,218/54/16/21/162/52 DX/24 B verified; zero wording drift against the breakdown. |
| Baseline hashes, current-source observations, decision register | **Met** — `baseline.json`, `hosted-inventory.json`, `decision-register.md`. |
| Paired revisions, field/state/modal annotations and DX coverage | **Met for Phase 0** — paired revisions recorded; DX01–DX52 mapped on every row; per-family state inventory approved. Per-route/modal variant annotations are completed by each owning phase. |
| Android behavior captures | **Met** — 195 owner-supplied pages indexed and reviewed (`android-captures/`); gaps owned as PR-21. |

## Key findings carried to later phases

- **Navigation:** the iOS shell has five native tabs; Settings is a separate root stack. Phase 1 must deliver six destinations with More (A01, R02).
- **Route identity conflict:** iOS `/reports/[id]` renders announcements; Android `/reports/[incidentId]` is incident detail. Proposed split: R18 and IR01.
- **Defective iOS baselines (must be replaced, not extended):** metadata-based `auth.signUp` registration without OTP (`register-screen.tsx:67`, A04) and direct `service_requests` insert (`resident-api.ts:40`, A11) instead of `submit_service_request`.
- **Pagination:** the iOS `pages()` helper loads every page before rendering; incremental pagination is required (P02-T03).
- **Household:** the unused iOS `household()` adapter reads the canonical table; the reachable contract is the profile JSON editor (P05).
- **Configuration:** the local iOS `.env` lacks tenant ID and environment, so the app would show its "unavailable" screen (PR-18).
- **Instruction conflict:** AGENTS.md's "last pushed migration is 0094" is stale (hosted is at `0113`); the numbering rule still applies (concurrent work has claimed `0114`–`0118`, so the next prefix is `0119` on 2026-10-14; recheck at write time).
- **Captured Android defects not to copy:** facility chips printing icon names, blank household QR, empty email in the recovery-code step and URL-encoded email on login, mid-word tile wrapping, low dark-mode contrast on announcement cards (`android-captures/README.md` O2–O7).

## Reproduce

```bash
node plans/evidence/resident-ios-parity/phase-00/build-ledgers.mjs
npm run typecheck --workspace=@barangayan/resident-ios
npm run lint --workspace=@barangayan/resident-ios
npm run test --workspace=@barangayan/resident-ios
```

Results: `check-results.json` (baseline and final both: typecheck 0, lint 0, tests 8/8; ledger builder 0 failures). `inventory.mjs` is the baseline recorder; run it only when freezing a new baseline.
