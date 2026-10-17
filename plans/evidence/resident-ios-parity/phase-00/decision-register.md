# Phase 0 decision register — 2026-10-13

Paired revisions: Implementation Plan **Rev 1.5** (pre-edit SHA-256 `E329DA0C…4DD2C98E`) and Design System Handoff **Rev 2.1** (`3A635FAC…6CF9C3BB`). Breakdown SHA-256 `4C7671C9…68BEFC8` matches plan §6.1. Full hashes: `baseline.json`.

Approval column: **Recorded** = taken verbatim from the user-authored plan, not reopened. **Approved** = Phase 0 engineering rule approved on 2026-10-13 by the named owner (see OD-01). Nothing here is an implementation or release approval.

## 0. Ownership decision

| ID | Decision | Source | Status |
|---|---|---|---|
| OD-01 | `KingJaqar` (repository owner) is the named owner and approver for every phase lead role (plan §4.2), every G01–G22 approval role (plan C.3) and every open prerequisite until a role is explicitly delegated. Delegation is recorded here and in `../execution-ledger.csv`. This assignment does not satisfy any gate's evidence requirement; it only names who approves it. | User choice "A", 2026-10-13 | Approved |
| OD-03 | Post-baseline Android changes (RD01 Valid ID wizard, RD02 public emergency Centers, offline evacuation routing) are **deferred**: not added to the iOS ledger while the Android work is uncommitted. When it is committed, add the ledger delta (B.2 rows, affected A19/A23/A24/A37–A39 checkpoints, §6.8 updates) and regenerate. Per plan §6.1/§4.4 they become iOS requirements if still working Android features at that point. Until then RD01/RD02 stay "Untriaged" rows. | User choice "A", 2026-10-14 | Approved |
| OD-04 | The signed SDK 57 development build is **deferred** (no build route chosen: EAS cloud vs Mac/Xcode). Phase 1 stays In progress with its exit Blocked on PR-02/PR-03/PR-04/PR-05/PR-18; P01-T06/T07 do not run until the owner chooses a build route and supplies the identity/config. Phase 2 tasks that need no signed build or device may proceed before the Phase 1 exit; Phase 2 device/native-storage proofs (e.g. P02-T04 Keychain, P02-T05/T06 signed-build file/location proofs) stay blocked behind the same build, and neither phase may be marked Verified without its device evidence. P01-D04 (shared SDK patch drift) stays open. | User choice "C", 2026-10-14 | Superseded by OD-06 (2026-10-14) |
| OD-06 | **No signed builds for the whole plan.** No signed development/device/staging/App Store build, Apple signing/provisioning, TestFlight, App Store submission or staged rollout in any phase. Work that only a signed build or physical device can prove is marked **Skipped (OD-06)** — never counted as evidence — and phases are verified on non-device evidence (source review, typecheck/lint, automated tests, `expo export --platform ios`, `expo config --type introspect`, backend/RLS/storage integration, hosted read-only checks, Android/web regressions) as **Verified (non-device scope, OD-06)**. Native capabilities stay in scope and are recorded as implemented, not device-qualified. PR-02/PR-04/PR-05 and the APNs-credential part of PR-07 are no longer required; G02/G14 are Skipped. End state: a code-complete, non-device-verified conversion; no production/released/device-qualified claim. Revoking it reopens every Skipped item. Full rule: plan §1 "Owner decision OD-06". Supersedes OD-04. | User instruction "skip sign builds for the whole plan", 2026-10-14 | Approved |
| OD-07 | **Skip PR-03 and PR-18.** The iOS URL scheme/OAuth callback allowlist (PR-03) and the iOS tenant ID/environment configuration (PR-18) are not supplied and gate no phase. Skipped, never passed: P01-T02's callback-scheme part is Skipped, Phase 1 is Verified (non-device scope, OD-06/OD-07), Google browser sign-in fails closed ("not available in this build"), and no screen of the app has been or can be run against a backend, so every live-app and real-provider verification statement is Skipped. The final report must say the app was never launched. Reversible: supplying PR-03/PR-18 reopens the skipped items. | User instruction "skip PR-03 and PR-18, update the plan accordingly", 2026-10-15 | Approved |
| OD-08 | **Phase 5 dependencies approved; RD01 stays deferred.** `expo-image-picker`, `expo-image-manipulator` (fulfils OD-05) and `react-native-webview` 13.16.1 with bundled Leaflet 1.9.4 may be added for Phase 5 and reused by later phases needing the same capability. Existing resolved versions must not change. The Android Valid ID wizard (RD01) is not imported (OD-03 unchanged). Phase 5 may start with the Phase 3 exit and Phase 4 open items carried as blockers; OD-07 still applies. | User instruction "approve all three dependencies and keep RD01 deferred then update the plan", 2026-10-15 | Approved |
| OD-10 | **PR-12 waived; Android emergency content accepted; `emergencyContent` opened.** No named DRRM owner, review date or escalation contacts are required for the emergency guidelines, hotlines and alerts. The iOS app mirrors the resident Android content (barangay `emergency_information`, emergency-category announcements, Android's bundled fallback guidelines and national hotlines), and the `emergencyContent` release gate is set to true for the non-device, non-live scope only. G07's map-processor portion (PR-10) and G12 (PR-13) are unaffected; the hosted content looks like sample data and is not edited or published by this decision. | User instruction 2026-10-16: "we dont need that actually, just copy the same DRRM in the android resident, update the plan accordingly" | Approved |
| OD-11 | **`routeService` opened; Android offline routing pack kept out of iOS scope.** iOS may POST the resident's chosen starting point (device fix or placed spot), the selected center id and the street choice to `/functions/v1/evacuation-route` of the barangay's own Supabase project, as the resident web app does; `routeService` is set to true for the non-device, non-live scope and P14-T04 is closed on that basis (tiles and geocoding under `mapProviders`, device and live evidence and G17 stay open). Android's bundled routing pack, conditions store and local road marking stay out of iOS scope for now (OD-03 stays deferred for the offline part); reopening needs a new owner decision. No third-party routing processor is introduced. Added to this register on 2026-10-16 during Phase 15; the decision itself is recorded in plan §1. | User instruction 2026-10-16: "Approve routeService: iOS may send the chosen starting point to the barangay's own evacuation-route function, as the resident web app does. Open the gate, update the plan and ledger, and close P14-T04. Keep the Android offline routing pack out of iOS scope for now." | Approved |
| OD-12 | **`evacuationCheckin` and `householdQr` opened; on-device household QR generation approved (G15).** The `evacuationCheckin` and `householdQr` release gates are set to true for the non-device, non-live scope only. The owner approves generating the household QR code on the device from the signed-in account id (payload `{ "type": "household", "profileId": <id> }`, no cache, no QR service), instead of calling `generate-household-qr`, which stays unchanged for Android and web. This is an owner approval of G08 and G15 for that scope; it is not a release approval and does not satisfy G03 (mirror evidence; `householdEditing` stays closed), G01, G17 or G19, and no hosted check-in, device camera/Photos/share run or staff-side household scanner exists as evidence (OD-06, OD-07). The check-in RPC was not called. | User instruction 2026-10-16: "Open both evacuationCheckin and householdQr for the non-device, non-live scope, approve the on-device household QR generation (G15), record it as an owner decision, and update the plan and ledger." | Approved |
| OD-09 | **Phase 10 dependencies approved; `qrph` and `pickup` to be opened.** `expo-media-library`, `expo-print` and `expo-sharing` are approved for the iOS workspace (already resolved in the root lockfile for Android; installed at the start of Phase 10). The `qrph` and `pickup` release gates are to be set to true once their Phase 10 flows are implemented and tested, on the owner's statement that both are fully functional in the resident Android app. This is an owner approval of G05/G06 for the non-device, non-live scope only: Android operation is not iOS or backend evidence, PR-08/PR-09 stay open facts, P10-T04 is an evidence task with no iOS code and P10-T08 stays Skipped (OD-07). Hosted Edge Functions re-read read-only 2026-10-16 (create-payment-source v20, check-payment-status v16, cancel-payment v11, refund-payment v13, paymongo-webhook v16, all ACTIVE). No code, dependency, migration or deployment was changed by the decision, and Phase 10 was not started. | User instruction 2026-10-16: "i approve expo-media-library, expo-print and expo-sharing, and qrph and pickup should stay open since it is fully functional in the resident android … update the plan accordingly, dont start phase 10" | Approved |
| OD-05 | HEIC/HEIF photos are **not converted in Phase 2** (P02-D02): the Files picker offers only JPEG/PNG/WebP/PDF and HEIF bytes are refused with an explanation. `expo-image-manipulator` conversion is added together with the Photos-library picker in its owning phase (P05 avatar/ID or P12 concern photos), which must then convert HEIC before validating final bytes. | User choice "A", 2026-10-14 | Approved |
| OD-02 | The Phase 0 engineering rules in §3–§6, `contract-boundaries.md` and `design-state-inventory.md` are approved as the starting contract for Phases 1–20. Later changes follow §6. | User choice "A", 2026-10-13 | Approved |

## 1. Product decisions (P00-T04)

| ID | Decision | Source | Status |
|---|---|---|---|
| PD-01 | Complete every working Android resident capability or a documented equivalent. A pilot cannot close full conversion. | Plan §1 | Recorded |
| PD-02 | Six destinations: Home / Services / Maps / Health / Reports / Settings, native iOS tabs with system More overflow. No custom bar fallback without explicit resolution. | Plan §1, §2; handoff §1 | Recorded |
| PD-03 | Retain email/password and Google; add Sign in with Apple. | Plan §1 | Recorded |
| PD-04 | Operational remote notifications (server inbox/outbox, APNs) are required for conversion completion. | Plan §1, §3; G13 | Recorded |
| PD-05 | iPhone portrait only, iOS 16.4+. | Plan §1 | Recorded |
| PD-06 | Launch in English with strings extracted for future Tagalog. | Plan §1 | Recorded |
| PD-07 | Preserve appearance preferences (theme, presets, ten custom colors, ten font IDs), information pages, report corroboration, read-state controls, receipt/QR exports. | Plan §1, §6.6 | Recorded |
| PD-08 | Online, resident-only emergency check-in (no offline attendance queue, no bulk household marking). | Plan §1, §6.4, §6.8 | Recorded corrective equivalent |
| PD-09 | Self-only medical registration; actual prior-dose date or null. Household booking needs a new approved contract. | Plan §1, §6.5, §6.8 | Recorded corrective equivalent |
| PD-10 | The cancelled Android usability phase stays cancelled; restored Android UI is not changed by this roadmap. | AGENTS.md; plan §1 | Recorded |
| PD-11 | Weather/BFS/Dijkstra routing is not Android-wired at baseline and is not imported (A52-012). Re-evaluate at freeze. | Plan §6.4; P00-T06 recheck | Recorded. **2026-10-14:** uncommitted concurrent work now wires offline routing into Android (captures p34–47; `offline-route-card.tsx`). Scope decision pending as PR-20; not imported until the user decides. |

## 2. Phase 0 engineering decisions

| ID | Decision | Reason |
|---|---|---|
| ED-01 | Each checkpoint's primary phase comes from its Appendix A "Delivery" line; split sections are split per checkpoint (`SPLITS` in `build-ledgers.mjs`). | Plan §4.1 requires split journeys to name every contributing phase. |
| ED-02 | A52 rows take the phase that implements the corrective outcome as primary; Phase 0 is listed as supporting because it holds the disposition record. | A52's "Delivery: Phase 0" covers disposition; the working equivalent lands in a feature phase. |
| ED-03 | Phase 3 owns no checkpoints as primary; it contributes through B01–B24. Every row lists P19/P20 as final verification. | Plan §4.2/§4.4. |
| ED-04 | Owner roles come from the §4.2 "Lead owner role" column; the named owner on every row is `KingJaqar` (OD-01). | The plan requires named people; the user assigned one. |
| ED-05 | Default Android state is `working-source` (traced in source, not device-verified). Non-working states are applied only where source or §6.8 shows it (63 checkpoints). | Breakdown disclaimer: source presence is not device evidence. |
| ED-06 | Existing iOS code is classified, never credited: `partial-unqualified` or `defective-baseline`. | P00-T02: nothing is complete because code exists. |

## 3. Typed route identity and backward links (P00-T07) — Approved 2026-10-13 (OD-02)

Full mapping: `route-ledger.csv` (R01–R54 + IR01–IR10). Rules:

1. **Record-type separation.** Incidents: `/reports/incidents/[incidentId]` (R18). Announcements: `/reports/announcements/[announcementId]` (IR01). The current iOS `/reports/[id]` renders an announcement, so it may only alias to IR01. Android `/reports/[incidentId]` links must map to R18. Never infer type from a UUID.
2. **Parameters.** Every `[id]` segment is validated with the existing `routeId()` UUID parser (`apps/resident-ios-mobile/src/data/resident-api.ts:7`). Accepted query contracts, matching Android source:
   - `/services?segment=documents|requests|logs` (Android `services/index.tsx:48`).
   - `/reports?tab=incident-reports|active|resolved|announcements` (Android `reports/index.tsx:74`).
   - `/emergency?tab=hub|centers|scan|family|alerts` (Android `emergency-info/index.tsx:104`) plus `section=guidelines|hotlines` for the R14/R16 placeholder replacements.
   - `/health/register?driveId=<uuid>` (Android `health/register.tsx:291`).
   - `/services/payment/success?requestId=<uuid>` — lookup hint only, never payment proof.
3. **Current iOS shell aliases** (kept so existing links resolve): `/profile`→`/settings/profile`, `/request/[id]`→`/services/requests/[requestId]`, `/requests`→`/services?segment=requests`, `/services/[id]`→`/services/[documentId]`, `/health/[id]`→`/health/drives/[driveId]`, `/health/register/[id]`→`/health/register?driveId=`, `/auth`→`/auth/choice`, `/register`→`/auth/register`, `/recovery`→`/auth/recovery`, `/settings/help/[id]`→`/settings/help/[articleId]`. Obsolete Android duplicates (R09/R12 QR guide, R14/R16 placeholders) converge on the working Emergency Hub routes.
4. **Fallback.** Missing, malformed, foreign, deleted or unauthorized targets open the owning destination root with an explanation. Private targets while signed out go to account choice and keep only an allowlisted pending destination `{ v: 1, route: <route id>, params: <validated ids> }` — never arbitrary URLs, tokens or personal records.
5. **URL scheme.** Android uses `barangayan` (`app.json`). iOS reads `IOS_URL_SCHEME`, currently unset. Choosing the iOS scheme, OAuth callback and any universal-link domain is an owner decision (PR-03). If `barangayan` is shared, Android path shapes above must resolve as aliases.

## 4. Acceptance severity — Approved 2026-10-13 (OD-02)

| Severity | Definition | Release effect |
|---|---|---|
| Critical | Cross-account/tenant data exposure, credential/identity/health leak, false paid/verified/checked-in/registered/submitted outcome, loss of a committed record, launch crash. | Blocks any candidate; reopens the affected phase. |
| High | A required working capability is missing, disabled or unrecoverable; wrong authoritative state shown; core-journey accessibility blocker (VoiceOver/Dynamic Type/keyboard). | Blocks release (plan C.6). |
| Medium | Degraded path with a working alternative; non-core accessibility defect; misleading copy that does not change authoritative truth. | Owner-approved disposition required before release. |
| Low | Cosmetic issue without functional, accessibility or truth impact. | Tracked. |

## 5. Naming — Approved 2026-10-13 (OD-02)

- Release candidate: `ios-rc-<marketing-version>-<build-number>`.
- Native build: `ios-<profile>-<version>(<build>)`, profiles `simulator`, `development`, `device`, `staging`, `production` (plan C.4).
- Evidence: `phase-NN/<task-id>_<yyyy-mm-dd>_<slug>.<ext>`.
- Defects: `IOS-<severity letter C/H/M/L>-<nnn>` with the affected A/R/T/G identifiers.

## 6. Change impact and reopening — Approved 2026-10-13 (OD-02)

| Change | Required action |
|---|---|
| Plan, handoff or breakdown hash changes | Rerun `build-ledgers.mjs`; diff ledgers; reopen changed rows. Breakdown changes are additive; never narrow scope. |
| Android route file added/removed | Generator fails until R-rows are updated; add ledger delta before sign-off. |
| Shared schema, RPC, migration or Edge Function version change | Reopen tasks whose `contracts` column includes the affected B-row; rerun Android/web regression for shared changes. |
| Native dependency, plugin, Info.plist or entitlement change | Reopen P01-T06/P01-T07 device evidence and the affected feature device proofs. |
| Design token or component change | Reopen G22 evidence for affected D-families. |
| Any binary change after candidate freeze | New candidate name; reopen impacted Phase 19 tests and gate approvals (plan §4.4). |

## 7. Repository instruction conflicts and plan discrepancies

| Item | Finding | Resolution |
|---|---|---|
| AGENTS.md migration note | AGENTS.md says the last pushed migration is `0094` and pending ones start at `0095`. The hosted project has `0001`–`0113` applied (`hosted-inventory.json`). | The repository's procedure wins: use the next unused prefix after the highest repository prefix. Highest was `0113` at baseline (next `0114`). Concurrent DRRM routing work then added `0114_routing_rate_limits.sql` (untracked, not this task), so the next unused prefix is now `0115`; always recheck immediately before writing a migration. The "last pushed" fact in AGENTS.md is stale; updating AGENTS.md is outside Phase 0 scope and left to the owner. |
| Plan §1 migration count | Plan says the repository contains migrations through `0112`. `0113_routing_conditions.sql` now exists (untracked user work) and is applied on the hosted project. | Recorded; see the row above for the current next prefix. |
| Plan anchor drift | Plan cites the fabricated prior dose at `health/register.tsx:390`; current source has it at line 394. The RPC call at line 443 matches. | Ledger uses `:394`. |
| Expo rule | AGENTS.md requires the SDK 57 versioned docs before code. | Consistent with plan §6.7. Phase 0 changed no Expo/React Native code. |
