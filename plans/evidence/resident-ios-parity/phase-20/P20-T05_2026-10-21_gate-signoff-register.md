# P20-T05 — G01–G22 and feature-gate sign-off register (2026-10-21)

Requirements: P20-T05, plan C.3, §4.4, OD-06 item 7. **Source:** uncommitted on base `187a2ab3`; evidence identity in `../phase-19/candidate.json`. **Named approver for every gate:** KingJaqar (OD-01). **Native build:** none.

## How to read this register

- A gate approval is an **owner decision** (plan C.3; the register is the evidence packet for it). This task did **not** approve, open or close any gate: no owner decision to do so was given in Phase 20, and a gate cannot be approved by the engineer who prepared the evidence. The "Owner sign-off" column is empty on purpose.
- "Ready for non-device sign-off" means every condition that can be met without a signed build, device or live provider is met, so the owner could approve the non-device scope (OD-06 item 7). It is never a release approval.
- Gates already decided by the owner (OD-09…OD-13) keep their recorded scope, including the conditions those decisions say were not satisfied.

## 1. The 22 release gates

| Gate | Owner role | State | Evidence in hand | Unmet / pending | Recommendation |
|---|---|---|---|---|---|
| G01 Tenant/environment | Backend | **Not approvable** | Explicit tenant + HTTPS config schema (tested); RLS/tenant suites; 826 pgTAP assertions on a clone | PR-18 (tenant/environment values) and PR-03 (callback allowlist) skipped by OD-07; PR-01: one hosted project, no staging; no auth allowlist check | Needs the owner's review environment or a decision to accept production-only |
| G02 Native compatibility | iOS lead | **Skipped (OD-06)** → Pending device (OD-14) | `expo config` / export checks | Signed SDK 57 build on devices | Reopens if OD-06 is revoked |
| G03 Household integrity | Backend | Not approvable | Mirror contract and tests on clones (migration 0123 on hosted per Phase 3 record) | `householdEditing` closed; legacy audit/staff attendance evidence; stale-edit device runs | Decide the gate after the household review |
| G04 Private IDs/evidence | Security/backend | Not approvable | Storage/RLS suites (24 + 26 assertions), immutable versions | `privateIdUploads` closed; signed-URL and cleanup runs | As above |
| G05 QR PH settlement | Payments | **Open by OD-09 (non-device scope)** | 62 payment tests; hosted payment functions ACTIVE (read-only) | PR-08: settlement records, webhook signature/replay, reconciliation owner not evidenced | Keep OD-09 scope; do not describe as production-approved |
| G06 Pickup fulfillment | Operations/payments | **Open by OD-09 (non-device scope)** | Resident RPC and read tests | PR-09: staff collection/reconciliation procedure not evidenced | As above |
| G07 Maps/emergency content | DRRM/content/privacy | Partly decided | `emergencyContent` open (OD-10), `routeService` open (OD-11) | `mapProviders` closed (PR-10: tile/geocoding processors, attribution, disclosure) | Decide `mapProviders` or ship without street tiles |
| G08 Emergency check-in | DRRM/backend | **Open by OD-12 (non-device scope)** | Contract tests; concurrency 7/7 (one attendance row from parallel check-ins) | Device camera run, live hosted run | Keep OD-12 scope |
| G09 Medical registration | Health/iOS | **Open by OD-13 (non-device scope)** | 39 client tests; capacity/uniqueness proof (3 accepted, unique applicant numbers) | Two-tenant tests (G16), device/live runs | Keep OD-13 scope |
| G10 Complete export | Privacy/backend | Not approvable | v2 contract, 14 required sections, tested on a clone and a real PostgREST | `0136`/function changes not deployed; `completeExport` closed; PDF/JSON device validation | Needs deployment approval |
| G11 Deletion/retention | Privacy/backend | Not approvable | Retention matrix approved (OD-16); 56 pgTAP + 17 function tests; **rollback rehearsed (T06)** | Not deployed; PR-06 Apple revocation; `accountDeletion` closed; in-app run | Needs deployment approval and PR-06 |
| G12 Moderation | Moderation owner | Not approvable | Own-reports only while closed | PR-13: visibility policy, filter/report/block, operator contact, retention | Policy first |
| G13 Remote push | Notification ops | Not approvable | Outbox/inbox/sender tested on a clone (121 assertions, 18 worker tests); rollback rehearsed | `0135` and `send-notifications` not deployed; PR-07 operator/alerts; APNs/device (Skipped OD-06) | Needs deployment approval and an operator |
| G14 Distribution | Apple/EAS | **Skipped (OD-06)** | Profiles verified (T01) | Apple team, App ID, provisioning, TestFlight | Reopens if OD-06 is revoked |
| G15 Household QR processor | Privacy/DRRM | **Approved by owner (OD-12), local equivalent** | On-device generation; no identifier leaves the device | G03, G01, G17, G19 not thereby met | Already decided |
| G16 Medical authorization | Backend/security | Not approvable | Role/tenant/capacity assertions on clones | Hosted project has one barangay: no second-tenant hosted test | Needs a review barangay |
| G17 Exhaustive parity | Product + QA | **Not ready** | 1,218/1,218 mapped; 949 on family-level evidence only; routes 64/64, modals 16/16 | Per-checkpoint evidence; seven required gates closed; device/live evidence | Do not approve |
| G18 Provider/account lifecycle | Auth/security | Not approvable | Email/Google/Apple controllers and 67 assertions on clones | PR-03/PR-06; no real provider exchange (OD-07) | Needs PR-06 and a run |
| G19 Lists/persistence/offline | iOS/backend | **Ready for non-device sign-off** | Pagination, scoped caches, drafts, cleanup, reconciliation tests; concurrency 7/7 | Offline/termination/reinstall device runs | Owner may approve non-device scope; final needs device |
| G20 Diagnostics/operations | Operations/security | **Not met (OD-18)** | Runbook, thresholds and rollback rehearsal (T06) | No crash reporter by owner decision; thresholds are proposals, nothing is instrumented | Cannot be approved as written |
| G21 Store/privacy compliance | Release/privacy | **Not met** | T02 record | In-app deletion not reachable; Apple login not operable; public privacy/support URLs; icon; reviewer package; age/encryption answers | Cannot be approved |
| G22 Accessibility/visual | Design/a11y/QA | Not ready | Token, contrast, semantics, theme-discipline tests | Rendered comparison, VoiceOver, Dynamic Type, device sizes | Cannot be approved |

**Result:** of 22 gates, none was newly approved; five carry earlier owner approvals for the non-device scope (G05, G06, G08, G09, G15) and G07 is partly decided (OD-10, OD-11); G02 and G14 are Skipped (OD-06); G19 is the only gate ready for a non-device sign-off; the rest are not approvable today for the reasons shown.

## 2. Feature gates in `release-gates.ts` (state on 2026-10-21)

| Feature gate | Value | How it got there | Linked gates still unmet (cumulative minimums, plan C.3) |
|---|---|---|---|
| `qrph` | open | OD-09 | G01, G17, G19-device, G20 |
| `pickup` | open | OD-09 | G01, G17 |
| `routeService` | open | OD-11 | G01, G07 (tiles/geocoding), G17, G22 |
| `emergencyContent` | open | OD-10 | G07 (map processors), G17 |
| `evacuationCheckin` | open | OD-12 | G01, G17, G19-device |
| `householdQr` | open | OD-12 | G03, G17 |
| `medicalRegistration` | open | OD-13 | G01, G16, G17 |
| `householdEditing` | **closed** | — | G01, G03, G17, G19, G22 |
| `privateIdUploads` | **closed** | — | G01, G04, G17, G19 |
| `mapProviders` | **closed** | — | G02, G07, G17, G21, G22 |
| `publicIncidents` | **closed** | — | G01, G12, G17, G21 |
| `completeExport` | **closed** | — | G10, G17, G19 |
| `accountDeletion` | **closed** | — | G11, G18, G21 |
| `remotePush` | **closed** | — | G02, G13, G17, G20, G21 |

Rule applied (plan C.3, §4.4): no gate was opened or closed to satisfy a checker. The release diagnostic `check:release` exits 1 on the seven closed gates by design (`../phase-19/P19-T07_check-release.txt`; the Phase 20 output is in the main record).

## 3. Required functionality that is still closed

The plan says required payment, push, map, check-in, health and privacy functionality cannot stay disabled while the conversion is called complete. Seven required capabilities are closed (`householdEditing`, `privateIdUploads`, `mapProviders`, `publicIncidents`, `completeExport`, `accountDeletion`, `remotePush`). **The conversion therefore cannot be called complete** (P20-T09).

## 4. Status

**P20-T05: Partially complete.** The register, evidence mapping and recommendation per gate are done. Gate approvals are the owner's; none was given in this phase. Next owner decisions that would change the picture most: deploy `0135`/`0136` and the functions (unblocks G10, G11, G13), PR-06 (G11, G18), a review environment (G01, G16, T03), PR-13 and PR-10 policy decisions (G12, G07).
