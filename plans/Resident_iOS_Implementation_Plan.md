# Barangayan Resident iOS Implementation Plan — Revision 1.5

**Revision date:** October 12, 2026

**Target document:** `plans/Resident_iOS_Implementation_Plan.md`

**Revision status:** Full-parity implementation specification with 21 numbered execution phases and 162 task checkpoints, aligned with Design System Handoff Revision 2.1. **Execution status (updated 2026-10-16):** Phase 0 is Verified (baseline 2026-10-13; evidence in `plans/evidence/resident-ios-parity/`); Phase 1 is Verified (non-device scope; the P01-T02 callback scheme, PR-03, was skipped by OD-07 on 2026-10-15); Phase 2 is Verified (non-device scope, OD-06); Phase 3 is Partially complete (2026-10-14: implemented and verified on isolated database clones; hosted deployment pending owner approval); Phase 4 is Partially complete (2026-10-15: T01–T07 verified on non-device checks; the Phase 3 exit and PR-06 are open; live app and real-provider runs are Skipped by OD-07); Phase 5 is Partially complete (2026-10-15: T01, T02, T06 and T07 verified on non-device checks; household editing and ID submission implemented behind the closed `householdEditing`/`privateIdUploads` gates; address detection pending PR-10; the Phase 3 exit and live runs stay open/Skipped by OD-07); Phase 6 is Partially complete (2026-10-15: T01–T05 verified on non-device checks; T06 partial, T07 device/live items Skipped; Phase 3–5 open exits carried); Phase 7 is Verified (non-device scope, OD-06/OD-07) (2026-10-15: T01–T06 verified on non-device checks, the Logs segment landed with P09-T05; Phase 3–6 open exits carried; live runs Skipped by OD-07); Phase 8 is Partially complete (2026-10-15: T01–T07 verified on non-device checks; T08 real-backend/device/live runs Skipped by OD-06/OD-07; Phase 3–5 open exits carried); Phase 9 is Partially complete (2026-10-15: T01–T06 and T08 verified on non-device checks; T07 staff-lifecycle run Skipped by OD-07; Phase 7–8 open exits carried); Phase 10 is Partially complete (2026-10-16: T01–T03 and T05–T07 verified on non-device checks; T04 settlement/webhook evidence open with the owner approval of OD-09 recorded; T08 live journeys Skipped by OD-07; `qrph` and `pickup` opened in code by OD-09; Phase 3, 8 and 9 open exits carried); Phase 11 is Verified (non-device scope, OD-06/OD-07) (2026-10-16: T01–T07 verified on non-device checks; live runs, device badge/VoiceOver and execution of the read-state embed on the hosted API Skipped; Phase 3, 4 and 6 open exits carried; `publicIncidents` stays closed); Phase 12 is Partially complete (2026-10-16: T01, T03 and T04 verified on non-device checks; T02, T05, T06 and T08 partial; T07 blocked on the G12 moderation policy, PR-13; `publicIncidents` and `mapProviders` stay closed; live runs Skipped by OD-07; Phase 3, 4 and 6 open exits carried); Phase 13 is Partially complete (2026-10-16: T01–T05 and T07 verified on non-device checks; T06 and T08 partial; `emergencyContent` opened by OD-10, which waives the named-DRRM-owner requirement and accepts the Android content; `mapProviders` and `publicIncidents` stay closed; live runs Skipped by OD-07; Phase 3, 4, 6 and 12 open exits carried); Phase 14 is Partially complete (2026-10-16: T01–T07 verified on non-device checks; `routeService` opened by OD-11, which approves sending the starting point to the barangay's own route service and keeps Android's offline routing pack out of iOS scope for now; T08 live/device runs Skipped by OD-06/OD-07; Phase 3, 4, 6, 12 and 13 open exits carried); Phase 15 is Partially complete (2026-10-16: T01–T06 verified on non-device checks; `evacuationCheckin` and `householdQr` opened by OD-12, which also approves on-device household QR generation; T07 partial; camera, Photos, share-sheet, live and device runs Skipped by OD-06/OD-07; Phase 3, 4, 5, 13 and 14 open exits carried); Phase 16 is Partially complete (2026-10-16: T01–T06 verified on non-device checks; `medicalRegistration` opened by OD-13, which leaves G16's two-tenant tests, G01 and G17 open; T07 partial; live, race and device runs Skipped or open; Phase 3, 4, 5, 6 and 11 open exits carried); Phase 17 is Partially complete (2026-10-21: T01 and T03–T07 verified on non-device checks; T02 and T08 partial; migration 0135 applied to the hosted project on 2026-10-21 (P20-D01) and the send-notifications function prepared and tested on a database clone but not deployed; `remotePush` stays closed; sender operator/alerts (PR-07) and device/APNs runs open; Phase 3, 4, 9, 10, 11, 12, 15 and 16 open exits carried); Phase 18 is Partially complete (2026-10-21: T01, T02, T03 and T06 verified on non-device checks with the web localhost guest reads; T04, T05, T07 and T08 partial; export v2 and account deletion v2 built and tested on a database clone and against a real PostgREST but the function changes are not deployed (migrations 0135 and 0136 were applied to the hosted project on 2026-10-21, P20-D01); `completeExport` and `accountDeletion` stay closed; the retention matrix is approved (PR-14, OD-16) but Apple revocation (PR-06) and device runs are open; Phase 4–6, 9–17 open exits carried); Phase 19 is Partially complete (2026-10-21: whole-app audit tooling, 725 iOS tests, 826 database assertions and 7 concurrency checks on a database clone, public-bundle secret scan and source-candidate freeze pass on non-device scope; T08 Skipped for the reporter (OD-18: the owner dropped crash reporting); seven feature gates still closed; device, live and hosted-staging evidence Pending/Skipped); Phase 20 is Partially complete (2026-10-21: release-preparation package, runbooks and the truthful final report done on non-device evidence — 728 iOS tests, generated-configuration and bundle inspection, privacy-manifest scan, App Store rules snapshot, gate sign-off register, backend rollback of 0135/0136 rehearsed on a clone and both migrations then applied to the hosted project on 2026-10-21 (functions, secrets and gates untouched); T04, T07 and T08 Skipped (OD-06); the exit is not met: seven required feature gates closed, no device/live/staging evidence, no gate approved in the phase, no release, TestFlight build, submission or rollout exists, and the conversion is NOT complete). **Anonymous push-token release approved (OD-15, 2026-10-21).** **Testing policy (OD-14, 2026-10-21):** localhost web is used for what it can show and a physical iOS device for the rest; neither blocks a phase, and unrun items are recorded as Pending web/Pending device. Named owner and approver for every role: KingJaqar. No app capability, build or release approval is certified complete. **Amended 2026-10-14 by owner decision OD-06 (§1): no signed builds in any phase** — signed-build, physical-device, TestFlight and App Store work is Skipped; phases are verified on non-device evidence; the end state is a code-complete, non-device-verified conversion, not a store release.

**Reading guide:** §4 is the Phase 0–Phase 20 execution roadmap, dependencies, initialized status ledger and detailed task checklists; §§1–5 define scope and delivery; §6 gives binding detailed requirements and corrections; Appendix A lists every breakdown checkpoint; Appendix B maps contracts/routes/modals/assets; Appendix C defines tests, gates and evidence.

**Objective:** Deliver a production-ready iPhone application with complete functional parity against the current resident Android application, plus the iOS adaptations specified below.

## 1. Authority, scope, and completion standard

This plan is the controlling specification for functional scope, Android parity, data/backend contracts, approved corrective equivalents, implementation sequencing and release evidence. [Resident_iOS_UI_UX_Design_System_Handoff.md](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:1) is the **main design-system reference** for the resident iOS application. Read and apply both documents together; neither is a substitute for the other.

### Main design-system reference and responsibility split

| Responsibility | Primary authority | Required use |
|---|---|---|
| Visual language, colors/theme, typography/font adaptations, spacing, shape, icons/assets, layout and content hierarchy | Design System Handoff Revision 2.1, §§1, 5–7 and 11 | Use its semantic tokens and component rules throughout the app; do not introduce an independent Android-derived or screen-specific design system. |
| iOS navigation presentation, interaction/gesture/modal behavior, accessibility, motion, feedback and visual acceptance | Design System Handoff §§1, 4, 6–9, 11–12 | Apply native behavior while preserving all required outcomes, including six destinations/More and every appearance preference. |
| Features/fields/options, source corrections, record identity, authorization, data truth, SDK feasibility, rollout and release gates | This plan §§1–6 and Appendices A–C | No design simplification may remove a working feature, invent a status/fee/success, bypass a gate or mark a pilot as a full conversion. |
| Existing Android feature discovery and authoritative data semantics | Android source, shared contracts and verified deployed backend | Revalidate the baseline and discrepancies; source presence alone is not acceptance evidence. |

Every resident iOS execution phase must read the relevant handoff sections before designing or changing UI. Reuse qualified existing iOS primitives/adapters with the handoff tokens; do not add a second component/state framework. Phase 0 records paired revisions and maps all A01–A52 requirements to handoff D01–D21 / DX01–DX52 and concrete execution tasks. Phase 1 qualifies the native shell/tokens/navigation; Phase 6 completes appearance/interaction variants. Phases 19–20 verify complete screen/modal/font/theme/accessibility evidence under G22 against this handoff, not an improvised visual baseline.

**Conflict/change rule:** explicit approved product decisions and safety/platform constraints must be reflected consistently in both documents. Functional/backend constraints fail closed, but do not authorize dropping required design or parity outcomes. If implementation cannot satisfy a design rule, record the affected A/D/T/G identifiers, propose a compatible equivalent, and resolve/update both documents before acceptance; do not silently choose whichever document is easier. New working-feature exclusions or product-direction changes require explicit user approval.

Replace the September 27 baseline with a dated inventory of the current commit, relevant uncommitted changes, dependency lockfile, Android routes, iOS implementation, shared contracts, migrations, and available evidence. Preserve previous findings and results as historical records. Revalidate each finding before carrying it forward as a current defect.

At the Phase 0 baseline (2026-10-13) the repository and the hosted project both contained migrations through `0113`. Concurrent uncommitted work has since added `0114`–`0118`, so the next unused prefix was `0119` as of 2026-10-14. **As of 2026-10-16** the repository holds `0001`–`0128` and the hosted project reports `0001`–`0127` (`0128_admin_personal_profile_editing` is not recorded as applied), so the next unused prefix is `0129`; Phases 8 and 9 added no migration. New migrations must use the next unused sequential four-digit prefix after the highest repository prefix at implementation time. Never reuse a pending number, renumber pushed migrations, or assume that locally present migrations are deployed.

### Confirmed product decisions

- Complete every working Android resident capability or provide an explicitly documented equivalent.
- Preserve six destinations: **Home / Services / Maps / Health / Reports / Settings**.
- Use native iOS tab presentation with **More** overflow when required by the system.
- Retain email/password and Google authentication; add **Sign in with Apple**.
- Require operational remote notifications for conversion completion.
- Retain iPhone portrait scope and iOS 16.4+.
- Launch in English, with strings extracted for future Tagalog localization.
- Preserve appearance preferences, information pages, report corroboration, read-state controls, and receipt/QR exports.
- Keep online, resident-only emergency check-in and self-only medical registration as explicit corrections to defective Android behavior.

An internal pilot may ship fewer enabled capabilities. It must be described as a pilot, list its limitations, and cannot close the full-conversion milestone.

The cancelled Android usability phase remains cancelled. This plan authorizes iOS work and necessary compatible shared/backend changes; it does not authorize restoring that phase or changing the restored Android UI.

### Completion definition

Conversion is complete only when every parity requirement has:

1. A working iOS implementation or an approved equivalent.
2. Passing behavior, authorization, failure-recovery, accessibility, and native-device evidence. *(OD-06: native-device evidence is Skipped; behavior, authorization, recovery and accessibility are proven with the non-device evidence defined below.)*
3. Production configuration and operating ownership.
4. Evidence identifying the exact app build, source revision, backend contract, and environment. *(OD-06: no app build exists; evidence identifies source revision, lockfile, generated configuration, backend contract and environment.)*

A disabled gate, route placeholder, successful JavaScript export, or passing typecheck does not establish feature completion. Under OD-06 an export or typecheck alone still does not; each feature also needs its automated behavior, integration and authorization evidence.

### Owner decision OD-06 — no signed builds for the whole plan (2026-10-14)

User instruction, 2026-10-14: "skip sign builds for the whole plan". Binding interpretation (recorded as decision-register OD-06); it overrides every signed-build, physical-device, TestFlight and App Store requirement elsewhere in this plan, its appendices and the paired handoff:

1. **No signed binary in any phase.** No signed development, registered-device, staging or App Store build, no Apple signing/provisioning, no TestFlight, no App Store submission or staged store rollout. OD-04 (signed build deferred) is superseded.
2. **Skipped, not passed.** Every task step, exit condition, evidence item, F01–F12 cell or gate condition that can only be met with a signed build or a physical-device run is marked **Skipped (OD-06)**. Skipped is neither Blocked nor passed: it never counts as evidence, and each phase's progress note lists what it skipped so the work can be resumed.
3. **Non-device verification standard.** Phases and tasks are verified with: source review; iOS typecheck and lint; automated controller/schema/adapter/component/route tests; `expo export --platform ios`; `expo config --type introspect` (generated Info.plist, plugins, permissions, requested entitlements); backend/RLS/storage integration tests and hosted read-only checks; Android/web regressions for shared changes. Such a status is written **Verified (non-device scope, OD-06)**.
4. **Scope is unchanged.** Every native capability — Sign in with Apple, remote push/APNs, camera/QR, foreground location, Photos save, PDF/share, maps/WebView, Keychain — is still fully implemented with its configuration, plugins and server contracts. Behavior only a signed binary can show (Keychain on device, APNs delivery, on-device Apple credential exchange, permission prompts, native More overflow, VoiceOver/Dynamic Type on device, performance) is recorded as *implemented, not device-qualified*.
5. **Unsigned simulator builds** are not prohibited but are not required (this host has no macOS). If one becomes available, its results are additional evidence only and do not replace the standard in item 3.
6. **Prerequisites.** PR-02 (Apple team/App ID/capabilities/provisioning), PR-04 (EAS project/build profiles), PR-05 (Xcode host and device matrix) and the APNs-key/Expo-credential part of PR-07 are no longer required. PR-06 (Supabase Apple provider) and PR-07's server sender/outbox/on-call ownership stay open because implementation and backend tests need them. PR-03 (scheme/OAuth callback) and PR-18 (tenant configuration) were skipped by OD-07 (2026-10-15, below).
7. **Gates.** G02 and G14 are Skipped (OD-06) in full. G13, G18, G21 and G22 keep their non-device conditions; their signed-binary/device conditions are Skipped. A gate approved under OD-06 is a non-device-scope approval, never a release approval.
8. **End state.** Phase 19 plus the non-build Phase 20 tasks yield a **code-complete, non-device-verified conversion**. The final report must state that no signed build, device qualification, TestFlight or App Store release exists and must not call the app production-ready, released or device-qualified. Resuming signed builds needs a new owner decision revoking OD-06; every Skipped (OD-06) item then reopens.
9. **P01-D04** (shared SDK 57 patch drift) no longer blocks any phase; it stays recorded for any future native build.

### Owner decision OD-07 — skip PR-03 and PR-18 (2026-10-15)

User instruction, 2026-10-15: "skip PR-03 and PR-18, update the plan accordingly". Binding interpretation (recorded as decision-register OD-07):

1. **PR-03** (iOS URL scheme, OAuth callback allowlist, universal-link decision) and **PR-18** (iOS tenant ID and environment configuration) are **not supplied and no longer gate any phase**. They are Skipped, not passed: a skipped item never counts as evidence.
2. **Phase 1.** The callback-scheme part of P01-T02 is Skipped (OD-07). Every other Phase 1 task is Verified (non-device scope) or Skipped (OD-06), so Phase 1 is **Verified (non-device scope, OD-06/OD-07)**. P01-D05 (alias collision if `barangayan` were chosen) stays open and reopens only if a scheme is chosen later.
3. **Browser OAuth.** Google sign-in/sign-up/link and the `/auth/callback` route stay implemented and fail closed: with no configured scheme the app reports "not available in this build". No approved callback URL exists, so none is claimed.
4. **No live app run.** Without PR-18 the app shows its "unavailable" screen, so **no screen of the app has been or can be exercised against a backend** in this plan. Every verification statement that needs a running app, real Google/Apple exchange, or a screen interaction is Skipped (OD-07). Phases are verified on source review, typecheck, lint, automated controller/adapter/schema/route tests, `expo export`, `expo config --type introspect`, and backend tests on clones or hosted read-only checks (the OD-06 non-device standard).
5. **Gates.** G18 real-provider evidence for Google is Skipped; Apple real-provider evidence additionally needs PR-06 and a signed binary (already Skipped by OD-06). A gate approved under OD-07 is a non-device, non-live approval, never a release approval.
6. **Final report.** The end state must state that the app was never launched against a backend, that no real-provider exchange occurred, and that Google browser sign-in has no approved callback. It must not call any flow working in the live app.
7. **Reversible.** Supplying PR-03 and PR-18 later reopens every item skipped here; the owner-attended steps in each phase record then apply.

### Owner decision OD-08 — Phase 5 dependencies approved, RD01 stays deferred (2026-10-15)

User instruction, 2026-10-15: "approve all three dependencies and keep RD01 deferred then update the plan". Binding interpretation (recorded as decision-register OD-08):

1. **Dependencies approved for Phase 5** (and reusable by later phases that need the same capability, such as P12 concern photos and P13–P15 maps, without a second approval):
   - `expo-image-picker` for avatar and ID photo selection (Photos library and camera, least-privilege access, purpose strings added only when the feature ships).
   - `expo-image-manipulator` for HEIC/HEIF conversion to a permitted format before validating final bytes (fulfils OD-05 / P02-D02).
   - `react-native-webview` with a bundled, pinned Leaflet for the manual location pin (P05-T06; plan §3 Maps row: pinned Leaflet, restricted navigation/resources, validated bridge, list/manual fallback).
2. **Version discipline.** `react-native-webview` is declared at `13.16.1` and Leaflet at `1.9.4`, the versions already resolved for Android. `expo-image-picker` and `expo-image-manipulator` are not in the root lockfile today; they are installed with the SDK 57 tooling at the versions it selects, and the lockfile may gain only those packages and the iOS workspace declarations. No resolved version of an existing package may change (P01-D04 patch drift stays untouched).
3. **RD01 stays deferred (OD-03 unchanged).** The post-baseline Android Valid ID wizard (`settings/valid-id.tsx`) is not imported. Phase 5 follows the committed front/back ID contract (`id_submissions`, `publish_id_submission`, B05). When that Android work is committed, the ledger delta is added and any working capability becomes required scope then.
4. **Entry.** The Phase 3 exit (hosted stray history row, `delete-my-account` deploy, hosted invariant run) and Phase 4's open items are still open and are carried as recorded blockers, exactly as for Phase 4; OD-07 still applies, so Phase 5 is verified on the non-device, non-live standard and T08's live two-device/stale-editor/signed-URL runs are Skipped.
5. **Not authorized.** Commits, pushes, deployments, remote migrations and secret handling stay outside this decision.

### Owner decision OD-09 — Phase 10 dependencies approved, `qrph` and `pickup` to be opened (2026-10-16; opened in code after Phase 10 was built and tested)

User instruction, 2026-10-16: "i approve expo-media-library, expo-print and expo-sharing, and qrph and pickup should stay open since it is fully functional in the resident android … update the plan accordingly, dont start phase 10". Binding interpretation (recorded as decision-register OD-09):

1. **Dependencies approved for Phase 10** (and reusable by later phases that need the same capability, such as the center QR save/share in P15, without a second approval):
   - `expo-media-library` for saving the QR PH image to Photos (add-only access; the purpose string is added only when the feature ships).
   - `expo-print` for generating the PDF receipt from committed payment data, with local images inlined as data for iOS printing.
   - `expo-sharing` for the native share sheet of the receipt PDF.
2. **Version discipline.** The three packages are already resolved in the root lockfile for Android (`expo-media-library` 57.0.3, `expo-print` 57.0.1, `expo-sharing` 57.0.13). They are declared in the iOS workspace with the versions SDK 57 tooling selects; the lockfile may gain only the iOS workspace declarations and no resolved version of an existing package may change (P01-D04 patch drift stays untouched). They are not installed yet: installation is the first dependency step of Phase 10.
3. **`qrph` and `pickup` are to be opened.** The owner's instruction is read as: the two feature gates in `releaseGates` are to be set to `true` once their Phase 10 flows are implemented and tested, on the owner's stated basis that both flows are fully functional in the resident Android app. The flags stay `false` in code until then; this decision changes no code.
4. **What this does and does not establish.**
   - It is an owner approval of G05 and G06 for the **non-device, non-live** scope only, the same kind of approval OD-07 describes, and never a release approval.
   - The evidence for it is the owner's statement about Android. It is not iOS or backend evidence: plan C.3 states that Android's `PAYMENT_SETTLEMENT_READY` configuration is not iOS evidence, and no settlement record, webhook signature/replay run, or staff collection record has been gathered by this plan (PR-08 and PR-09 stay recorded as open facts, not as passed).
   - The hosted project was re-read read-only on 2026-10-16: `create-payment-source` v20, `check-payment-status` v16, `cancel-payment` v11, `refund-payment` v13 and `paymongo-webhook` v16 are ACTIVE (the webhook has `verify_jwt = false`, as expected for a provider webhook; its signature checking was not inspected).
   - It is a deliberate exception to the "open each only after all linked conditions pass" rule in C.3: the other gates listed for these flags (G01, G17, G19, G20 for `qrph`; G01, G17 for `pickup`) are not claimed as satisfied.
5. **Phase 10 scope is unchanged.** P10-T04 (processor/settlement qualification) remains an evidence and operations task with no iOS code, and P10-T08 (end-to-end journeys) stays Skipped (OD-07). The phase's exit still requires G05/G06 evidence; under this decision it records the owner approval and lists what is Skipped.
6. **Not authorized.** Commits, pushes, deployments, remote migrations, Edge Function or processor configuration changes, secret handling and real payments stay outside this decision, as does starting Phase 10 itself.

### Owner decision OD-10 — PR-12 waived, Android emergency content accepted, `emergencyContent` opened (2026-10-16)

User instruction, 2026-10-16, after being asked for a named DRRM owner, review date and escalation contacts: "we dont need that actually, just copy the same DRRM in the android resident, update the plan accordingly". Binding interpretation (recorded as decision-register OD-10):

1. **PR-12 is waived.** No named DRRM owner, review date or escalation contacts are required for the emergency guidelines, hotlines and alerts. The content the iOS app shows is what the resident Android app shows: the barangay's `emergency_information` guidelines and hotlines, emergency-category announcements, and Android's bundled fallback guidelines and national hotlines (911, Red Cross 143), accepted as is.
2. **`emergencyContent` is opened** in `release-gates.ts` for the non-device, non-live scope, on the owner's stated basis that this is the Android behavior. It is a non-device approval, never a release approval.
3. **What is not waived.** The content still comes only from the tenant tables and the bundled fallback; no emergency number is invented; the screens still label the fallback and any saved copy by age, and state that the app does not monitor emergencies or guarantee alerts. G07's map-processor portion (PR-10, `mapProviders`) and G12 incident visibility (PR-13, `publicIncidents`) are separate and stay closed. The hosted content was observed to look like sample data; the owner's decision accepts the Android behavior, not the accuracy of that sample text.
4. **Phase 13.** P13-T07's named-owner, review-date and escalation-contact conditions are met by this waiver; its "no invented number, no monitoring promise" conditions are verified in code. P13-T03's "approved seed fallback" is the accepted Android fallback.
5. **Not authorized.** Commits, pushes, deployments, remote migrations, and editing or publishing the hosted emergency content.

### Owner decision OD-11 — `routeService` opened, Android offline routing pack kept out of iOS scope (2026-10-16)

User instruction, 2026-10-16: "Approve routeService: iOS may send the chosen starting point to the barangay's own evacuation-route function, as the resident web app does. Open the gate, update the plan and ledger, and close P14-T04. Keep the Android offline routing pack out of iOS scope for now." Binding interpretation (recorded as decision-register OD-11):

1. **`routeService` is opened** in `release-gates.ts` for the non-device, non-live scope. The iOS app may POST the resident's chosen starting point (device fix or placed spot), the selected center id and the street choice to `/functions/v1/evacuation-route` of the barangay's own Supabase project. No third-party routing processor is introduced.
2. **P14-T04 is closed** on the owner's approval, the attribution the service returns with every answer, and the evidence in the Phase 14 record (hosted v9 ACTIVE; test requests returned parseable answers). It is not a production or release approval: the unmet conditions of G07 (tiles and geocoding under `mapProviders`, device and live evidence) and G17 stay open.
3. **OD-03 stays deferred for the offline part.** Android's bundled routing pack, conditions store and local road marking are not iOS scope for now; P14-T07 is closed with that decision. Reopening it needs a new owner decision, after which the capability joins the ledger.
4. **Not authorized.** Commits, pushes, deployments, Edge Function or service configuration changes, and tile or geocoding processors.

### Owner decision OD-12 — `evacuationCheckin` and `householdQr` opened, on-device household QR approved (2026-10-16)

User instruction, 2026-10-16: "Open both evacuationCheckin and householdQr for the non-device, non-live scope, approve the on-device household QR generation (G15), record it as an owner decision, and update the plan and ledger." Binding interpretation (recorded as decision-register OD-12):

1. **Both gates are opened** in `release-gates.ts` for the non-device, non-live scope: the resident may check in by scanning a validated center QR code, with only the server's receipt counting as attendance (`check_in_to_evacuation_center`), and the Family section shows the household QR code.
2. **G15 is approved for the local equivalent.** The household code is generated on the device from the signed-in account id (`{ "type": "household", "profileId": <id> }`); no identifier is sent to a QR service and nothing is cached. `generate-household-qr` is unchanged and still serves Android and web (it still sends the UUID to `api.qrserver.com`).
3. **What this does not establish.** It is a non-device, non-live approval, never a release approval. G03 (household mirror evidence; `householdEditing` stays closed), G01, G17 and G19 are not thereby satisfied. No hosted check-in was made, no device camera/Photos/share run exists, and no staff-side scanner for the household code exists in the repository, so the household guidance says staff use the code and mark household attendance themselves.
4. **Not authorized.** Commits, pushes, deployments, remote migrations, Edge Function changes and writing hosted attendance.

### Owner decision OD-13 — `medicalRegistration` opened (2026-10-16)

User instruction, 2026-10-16: "Open medicalRegistration for the non-device, non-live scope, record it as an owner decision (OD-13), update the plan and ledger, and close P16-T02 to T04 accordingly. G16 two-tenant tests, G01 and G17 stay open." Binding interpretation (recorded as decision-register OD-13):

1. **`medicalRegistration` is opened** in `release-gates.ts` for the non-device, non-live scope: a signed-in resident may register themselves for an active, open drive of their barangay through `register_for_drive`, and only the server's applicant number counts.
2. **P16-T02 to T04 are closed** on that approval and the Phase 16 evidence (tests with the gate open, read-only hosted contract check). The household picker stays out (§6.5 self-only correction).
3. **What this does not establish.** It is a non-device, non-live approval of G09, never a release approval. G16 (second-tenant, role and negative post-state tests — the hosted project has one barangay), G01, G17, the live capacity/duplicate races and the device runs are not thereby satisfied. The registration RPC was not called.
4. **Not authorized.** Commits, pushes, deployments, remote migrations, Edge Function changes and writing hosted registrations.

### Owner decision OD-14 — localhost web for what it can test, a physical iOS device for the rest, neither blocks a phase (2026-10-21)

User instruction, 2026-10-21: "we should just use localhost on web for testing what we can and require a ios physical device for other testing that couldn't be tested on localhost, but don't make the testing a blocker so we can proceed to the next phase, update the plan". Binding interpretation (recorded as decision-register OD-14):

1. **Two test environments.** (a) **Localhost web** is the primary environment for everything the iOS app's JavaScript can show in a browser: routing and navigation logic, lists, filters, forms and validation, data reads and writes against a **local or cloned** database (never writes to the hosted project), error and empty states, and realtime signals. (b) A **physical iOS device** is required for what a browser cannot show: SwiftUI-backed controls (`@expo/ui`), the system tab bar and More overflow, Keychain, camera and QR scanning, Photos, the share sheet, WebView maps, location prompts, Sign in with Apple, remote push, VoiceOver, Dynamic Type, system sheets and gestures, and performance.
2. **Never a blocker.** No phase's status, exit or start waits on a web or device run. A phase is still marked from the evidence it has; anything that needs a run that has not happened is recorded as **Pending web (OD-14)** or **Pending device (OD-14)** with exact steps, and the next phase proceeds. Items already marked *Skipped (OD-06/OD-07)* because they need a signed build or a physical device are re-labelled **Pending device (OD-14)** when they are next touched; they stay open and never count as passed.
3. **Evidence classes.** A web localhost run is additional evidence labelled **Verified (web localhost)**. It never replaces the non-device standard of OD-06 item 3 and never proves a native behavior: a screen that rendered in a browser is not VoiceOver, Dynamic Type, Keychain, camera, push or layout evidence for iPhone. Gate approvals stay owner decisions (OD-09…OD-13); a web run does not open or close a gate.
4. **What is not yet in place (so nothing is claimed).** The iOS workspace has no web target today: it declares neither `react-native-web`, `react-dom` nor a `web` entry in `app.config.ts`, and its shared components use `@expo/ui` SwiftUI controls with no web equivalent. Enabling web is therefore a dependency and fallback task that **needs your separate approval of the packages** before it starts. The app also still needs the tenant and environment values skipped by OD-07 (PR-18) before any screen shows data; they are an input to this decision, not something it supplies.
5. **OD-06 and OD-07 are unchanged.** No signed build, TestFlight or App Store work is authorised. A physical-device run needs a development build, so it needs a new owner decision revoking OD-06 for that purpose when a device becomes available; until then every device item stays *Pending device*. The final report must still say that no device qualification exists.
6. **Not authorized.** Committing, deploying, remote migrations and writing hosted data.

**Update 2026-10-21 — web target set up (owner approved the packages and the setup).**

- **Packages (approved):** `react-dom` 19.2.3, `react-native-web` ~0.21.0 and `@expo/metro-runtime` ~57.0.8 are declared in the iOS workspace. All three were already resolved in the root lockfile for other workspaces, so the lockfile gained only the three workspace declarations and no resolved version changed.
- **Configuration:** `app.config.ts` adds `web` to `platforms` and `web: { bundler: 'metro', output: 'single' }`; `npm run start:web` runs `expo start --web`; `.claude/launch.json` defines the `resident-ios-web` preview on port 8083. The tenant and environment values for a local run live in the git-ignored `.env.development.local` (`EXPO_PUBLIC_BARANGAY_ID` = the Ampid I barangay id, `EXPO_PUBLIC_ENVIRONMENT=development`); the public URL and key come from the existing `.env`.
- **Web-only stand-ins (no iOS bundle uses them):** `metro.config.js` resolves modules with no browser implementation (`expo-media-library`, `expo-apple-authentication`, `react-native-webview`, `@expo/ui/swift-ui`) to `web/native-only.js`, whose calls fail with a clear "needs a physical iOS device" message and whose components render that notice; `expo-secure-store` resolves to `web/secure-store.js`, a localStorage stand-in with none of the Keychain's protection. The one app-code change is a guard in `features/appearance/provider.tsx`: `Appearance.setColorScheme` does not exist in react-native-web, so the browser's own scheme applies there.
- **Result (2026-10-21):** the app starts on `http://localhost:8083` and reaches the account-choice and guest Home screens. The Phase 16 Health screens were exercised as a guest against the hosted project's public data (read-only, no sign-in, nothing written): the calendar with its event dot, day selection, drive detail (closed registration for a past date, sign-in prompt), and the List view with its empty state all rendered correctly. Classed **Verified (web localhost)** for those reads only.
- **Known web limits:** the native tab bar renders as an overlapping top strip on narrow widths; SwiftUI-backed controls, camera, Keychain, Photos, share, maps, Apple sign-in and push do not work and show the notice or fail clearly; the Docker-based local database was not running, so signed-in flows (registration, history) were not exercised on web and stay **Pending web (OD-14)** until a local or cloned database is started (the web config rejects non-HTTPS URLs, so a local HTTP stack also needs a small development-only localhost allowance first). All device-only items stay **Pending device (OD-14)**.
- **Checks after the change:** typecheck 0, lint 0, tests 572/572, `expo export --platform ios` 0 and `expo export --platform web` 0.

### Owner decision OD-15 — anonymous push-token release approved (2026-10-21)

User instruction, 2026-10-21: "Add a narrow anonymous release_push_token (possession of the token is the proof) to migration 0135, update the Phase 3 anonymous-allowlist test, rerun the pgTAP suites and update the Phase 17 record." Binding interpretation (recorded as decision-register OD-15, evidence decision P17-D08):

1. **`release_push_token(token)` is callable without a session** (anonymous, authenticated and service_role). Holding a well-formed Expo push token is the proof. It only deletes that push address, answers the same whether or not the token existed, and refuses a malformed or missing token. Migration `0135` was edited in place because it is not applied to any remote database.
2. **Why.** A device that signs out offline has no session to remove its token with; without this its previous account's generic alerts keep reaching it. The app now retries a pending removal on every open and foreground, signed in or not; a later registration of the same device replaces the retry marker, so a token another account has taken over is never released.
3. **Guard change.** The Phase 3 test that pins the anonymous-executable security-definer routines lists `release_push_token` as the single addition, with the reason in its assertion text; a Phase 17 assertion confirms no other notification routine is anonymous-executable. Every other anonymous restriction is unchanged.
4. **Not authorized.** Committing, deploying, applying `0135` to the hosted project, Edge Function deployment or secrets, and opening `remotePush`.

### Owner decisions OD-17 and OD-18 — hosted crash reporter chosen, built, then dropped by the owner (2026-10-21)

User instruction, 2026-10-21, answering the Phase 19 question: "Use a hosted crash reporter such as Sentry for iOS (option a). Ask me before adding the dependency, and plan PII scrubbing and source-map upload." Binding interpretation (recorded as decision-register OD-17):

1. **Approach.** The iOS app will report crashes and errors to a hosted reporter (Sentry is the working choice). This resolves the P19-T08 / G20 question of which approach to use.
2. **Approved the same day.** User instruction, 2026-10-21: "Approved: add @sentry/react-native to the iOS workspace and implement the plan. No user identifier. The Sentry org/project/region and DSN will follow; code must no-op without a DSN." Built as `@sentry/react-native` 8.31.0 (34 packages added to the lockfile, no resolved version changed). **Still not authorized:** creating a Sentry account or project, and creating, reading or handling the auth token; these stay owner actions. The plan and implementation record are in `phase-19/P19-T08_2026-10-21_crash-reporting-plan.md`.
3. **Constraints carried into the plan.** No user identifier, IP, screenshots, view hierarchy, replay or tracing by default; one tested scrubber for events, breadcrumbs and URLs that drops an event on failure; source maps uploaded from CI only with the token in a secret; native symbolication stays Skipped (OD-06). The processor must be disclosed in the privacy policy and App Privacy labels (P18-T07, P20-T02).
4. **Status effect (superseded by OD-18 below).** P19-T08 moved from Blocked to Partially complete while the reporter was built but dormant.

**OD-18 (same day) — no crash reporter at all.** User instruction, 2026-10-21, after asking whether a Sentry project was necessary: "how about just never do sentry project at all, we dont need it". Binding interpretation (recorded as decision-register OD-18): the hosted-reporter approach of OD-17 is **withdrawn**. The code, configuration, scripts, tests and dependency added under OD-17 were **removed** (the dependency was uninstalled; the lockfile is package-for-package identical to its pre-OD-17 state; typecheck, lint, 725 iOS tests, both exports and the generated configuration are back to their pre-OD-17 results). No crash/error reporter exists in the iOS app and none is planned. Consequences the owner has accepted by this decision: a production crash or unhandled error is invisible to the project unless a resident reports it; there is no release-tagged crash or error telemetry from the app; the crash-diagnostics condition of G20 ("symbolicated/redacted crash data, build identifiers… alert thresholds") is **not met by design** and G20 cannot be approved as written; P19-T08 is closed as **Skipped (OD-18)** for the reporter part. Apple's own crash reports for TestFlight/App Store builds exist without any SDK but need a signed build, which OD-06 skips, and were not examined. Reversible: a new owner decision can reopen it; the withdrawn plan is kept in `phase-19/P19-T08_2026-10-21_crash-reporting-plan.md` as history.

## 2. Traceability, navigation, and resident workflows

The following three appendices are included in this revision and are binding implementation deliverables:

- **Parity ledger:** all 52 breakdown sections and all 1,218 source bullet checkpoints, with Android/iOS/test traceability.
- **Contract catalogue:** every table, RPC, Edge Function, storage bucket, realtime subscription, and shared schema consumed by those workflows.
- **Acceptance catalogue:** test identifiers linked to parity rows, phases, release gates, and evidence.

Each parity row records the Android source locator, implementation state, iOS destination, disposition, dependency, acceptance test, and owner. Distinguish working, partial, defective, placeholder, obsolete, and unreachable Android behavior.

### Navigation contract

Declare all six destinations statically. Preserve nested stack state, list position, search/filter state, authorized deep-link restoration, and appropriate tab-reselection behavior.

Qualify six destinations and native More overflow in an early signed SDK 57 build *(Skipped — OD-06; the navigation contract is verified by route/configuration tests and export)*. Test direct links into overflow destinations, Settings navigation, return paths, accessibility, state restoration, and foreground/background transitions. Failure of this qualification blocks the navigation milestone; it must not silently trigger a different tab architecture.

Native tabs expose one system badge per destination. Preserve Android’s three independent Reports signals inside the Reports hub as labeled counters:

- Active reports.
- Unread resolved reports.
- Unread announcements.

The Reports badge represents unread resolved reports plus unread announcements; active reports remain a separate operational count. Preserve access to these signals when Reports is inside More through the Home summary and Reports hub.

The handoff’s current navigation contract matches this plan: six destinations with native More overflow. Apply its tokens, component behavior, safe-area, accessibility and content rules; the historical five-destination recommendation is not the target architecture.

Use distinct announcement and incident detail routes. Do not overload a detail route with different record types. Record explicit mappings for existing iOS and Android links, including obsolete links; ambiguous or malformed destinations receive a safe fallback.

### Required parity inventory

| Area | Required iOS behavior |
|---|---|
| Onboarding | Welcome, value proposition, personalization, authentication choice, public browsing, and returning-user routing. |
| Account setup | Email OTP, profile completion, password creation, interruption/restart recovery, server-owned setup status, Google optional setup, Apple equivalent setup, and authorized continuation. |
| Home | Quick actions, recent requests, latest announcements, attention items, activity, and notification entry. Remove decorative search unless it performs a defined search. |
| Services | Catalogue/detail, requirements, drafts, application/review, attachments, receipt, request filters/history, activity logs, tracking, cancellation, payment, pickup, QR save, and PDF receipt share. |
| Reports | Existing report/active/resolved/announcement views, filters, URL state, detailed announcements, individual/bulk read actions, concern creation, location details, photos, corroboration, and withdrawal. |
| Maps/emergency | Incident/center discovery, search/filter, current location, accessible list equivalence, emergency guidelines/hotlines/alerts, center details, household content, QR guidance/display/scan, and authoritative check-in. |
| Health | Drive calendar/list/detail, month/date/type filters, availability/eligibility, self-registration, actual prior-dose data, registration history, and detail/status. |
| Settings | Profile/avatar, household, ID type/front/back images, email/location verification, password management, notification preferences, appearance/font preferences, export/deletion, Help, Terms/Privacy, About, version, login/logout. |

Map every reachable modal: birthday and field selectors, household editor/QR, camera permission, scanner, QR display, announcement, image viewer, location picker, appearance picker, deletion confirmation, and result dialogs. Specify presentation, dismissal, dirty-state behavior, focus return, and durable-result replacement.

Do not port dead health-registration modals or placeholder hotline/guide screens. Preserve their useful outcomes through the implemented emergency and health journeys.

### Authentication and account management

Adopt the current shared account-setup semantics rather than the obsolete registration flow.

- Email signup requires verified OTP, committed profile completion, and confirmed password creation.
- Google and Apple signup allow the same optional profile/password progression; service actions still enforce required profile completion.
- Preserve email-verification warnings and separate email, residency, location, and ID verification meanings.
- Handle existing passwords, passwordless provider accounts, unknown legacy password provenance, linked identities, recovery, and fresh same-account confirmation for sensitive actions.
- Bind OAuth attempts, callbacks, pending destinations, and mutations to the current account and attempt. Reject replayed, expired, unsolicited, malformed, or wrong-account callbacks.
- Never authorize using user-editable metadata or treat a client reauthentication flag as server proof.

Use Google’s browser OAuth/PKCE flow with the approved iOS callback. Use native `expo-apple-authentication` with nonce/state validation and Supabase token exchange. Handle private relay email, missing names on subsequent login, cancellation, credential revocation, and Apple token revocation during deletion. Follow [SDK 57 AppleAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/) and [Supabase Apple authentication](https://supabase.com/docs/guides/auth/social-login/auth-apple).

The existing setup response has strict schema validation. Introduce a versioned provider-aware contract for iOS; preserve the existing response shape and semantics for Android/web. Do not add Apple enum values or response properties to a strict legacy contract without compatibility protection.

### Documents, concerns, and sensitive workflows

Retain the plan’s authoritative drafts, review, receipt, status, cancellation, reconciliation, and tenant safeguards.

Add the omitted parity details:

- Service activity logs must describe real events. Do not fabricate an audit trail from current status.
- Concerns retain waste-zone selection where applicable, address, specific-area details, photo viewing, confirmation count, and server-authoritative corroboration.
- Preserve existing title/description constraints and five-photo limit.
- Request ID images remain limited to 5 MiB and concern photos to 10 MiB each unless a compatible server-approved policy changes those limits.
- Retain JPEG/PNG/WebP; convert supported HEIC selections to a permitted format before validating final bytes.
- Payment QR images can be saved to Photos; authoritative paid receipts can be generated and shared as PDF.
- Profile requirements enumerate every current field, avatar, ID image, verification state, household field, and conflict behavior.

Offline check-in queues, bulk household attendance updates, and household medical selection that never reaches the server are recorded as defective Android behavior. The iOS replacement must explain online confirmation and self-registration accurately.

## 3. Architecture, backend contracts, and native configuration

Keep the separate iOS workspace and reuse shared domain contracts. Preserve existing endpoints and identifiers wherever compatible. Extend focused data/platform adapters and existing UI primitives; avoid a parallel state or component framework.

### Contract catalogue and compatibility

For every operation, specify:

- Authentication, role, ownership, tenant, active/deleted-state predicates.
- Input/output schema and stable public error classification.
- Idempotency, replay, concurrent-write, timeout, and reconciliation behavior.
- Pagination, search/sort, cache scope, freshness, and realtime invalidation.
- Storage linkage, retention/deletion effect, audit event, and deployed version.

Cover existing document/payment, incident/read-state, household/check-in, health, information, notification, and account-setup operations. Preserve administrator-only fields and current resident-safe projections.

Use conditional writes for concurrent profile/household editing. A stale editor receives the latest version and an explicit reload/reapply path; it must not overwrite another actor silently.

Enforce invariants at the database/API boundary. Privileged functions must validate caller identity and authorization, restrict execution grants, use a controlled search path, and reject cross-tenant inputs without side effects.

### Pagination, persistence, and uploads

Use incremental stable pagination for resident lists. Do not load every page before displaying content. Preserve stable ordering and deduplicate realtime updates; refresh or cursor invalidation handles changed/deleted rows.

Scope private caches, drafts, upload references, and request ownership to environment, tenant, account, and schema version. Keep credentials and sensitive persisted drafts protected. Failed or unavailable protected storage must not fall back to plaintext.

Public emergency caches include tenant, content version, fetched time, and freshness. Expired operational facts must not appear current.

Uploads use staged ownership and authoritative linkage, actual-byte validation, normalized filenames, EXIF/location metadata removal, signed access where required, and observable orphan cleanup. Identity material cannot be publicly accessible or included in logs, previews, diagnostics, or shared temporary directories.

### Required notification architecture

Use a server-backed inbox and durable delivery outbox. Send remote notifications through Expo Push Service/APNs from an authenticated server worker; client realtime subscriptions are refresh signals, not background delivery infrastructure.

Require:

- Event deduplication and transactional event/outbox creation.
- Retry/backoff, provider receipt processing, invalid-token removal, and operational alerts.
- Current-owner token registration, account-switch handling, opt-out, and offline-logout recovery.
- Preferences applied at send time.
- Generic notification previews and validated versioned destinations.
- Cold/warm tap handling, replay suppression, and deleted/unauthorized-record fallback.
- Preservation of announcement/resolved-report read semantics independently of inbox read state.

No critical-alert entitlement, emergency delivery guarantee, background-location task, or silent-background requirement is introduced. OS permission denial must not block ordinary app use. Follow [SDK 57 Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).

### Native capability matrix

Record package/version, plugin, Info.plist key, entitlement, permission timing, fallback, rebuild requirement, and device test for each capability.

| Capability | Required configuration and behavior |
|---|---|
| Navigation | SDK 57 Router compatibility; six native destinations/More qualification; safe areas and reselect behavior. |
| Credentials | SecureStore/Keychain; chunking/native-error tests; uninstall/reinstall policy; logout tombstone and cleanup. |
| Apple login | Apple plugin, `ios.usesAppleSignIn`, App ID capability, provisioning, nonce validation, credential lifecycle. |
| Camera | Specific camera purpose string, QR scanning, one active preview, cancellation and manual alternative. |
| Location | Foreground-only purpose string; approximate/denied/stale location and manual entry. |
| Photos/Files | Least-privilege picker access; limited-library/iCloud cases; copied-file lifetime and cancellation. |
| Saving images | SDK 57 MediaLibrary `Asset.create()` or explicitly qualified legacy import; Photos save permission. |
| PDF/share | Cache output, base64 inline local images for iOS printing, share/cancel cleanup. |
| Maps | Bundled pinned Leaflet, restricted navigation/resources, validated bridge, attribution and list fallback. |
| Push | Notification plugin, EAS project/APNs credentials, token lifecycle, signed release delivery tests *(EAS/APNs credentials and signed delivery tests Skipped — OD-06; plugin, token lifecycle, sender/outbox and server tests remain)*. |

Read the exact [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and each package’s versioned page before implementation. Qualify the root lockfile and generated native configuration without upgrading unrelated workspaces. Under OD-06 the device-test column is Skipped; each capability is qualified by generated configuration (`expo config --type introspect`), plugin options and automated tests.

## 4. Numbered execution phases — build the complete resident iOS app

### 4.1 Execution contract, ordering and completion rules

The roadmap now contains **21 execution phases: Phase 0 through Phase 20**. These are specifically the **resident iOS implementation phases in this document**. Resident iOS **Phase 8 builds document forms/submission**; it is unrelated to the permanently cancelled Android usability Phase 8 in `Major_Web_AndroidMobile_Improvement_Plan.md`. Do not start or revive that Android work.

This section replaces the earlier nine broad roadmap stages with buildable, verifiable work packages. It does not authorize starting application/backend implementation during this planning update. The embedded execution ledger is initialized below. Phase 0 is Verified (2026-10-14); all Phase 1–20 tasks are **Planned / unchecked**, not certified complete. Existing code must be inspected, reused and qualified rather than blindly rebuilt.

**Required outcome:** the same working resident capabilities as Android, expressed through the main iOS Design System Handoff, plus the explicitly approved native/provider/production additions and §6.8 corrective equivalents. A list of screens, successful export, disabled feature gate, mock backend or limited pilot is insufficient. Full conversion requires Phase 19 whole-app parity **and** Phase 20 production/device/operating sign-off.

Every phase must:

1. Read its A/B/R/T/F/G requirements and the main handoff's D/DX/visual/accessibility rules before implementation; all individual fields/options/checkpoints remain mandatory even when a task summarizes them.
2. Satisfy its entry dependencies and required credentials/policy/contracts. Missing authority or facts create a named blocker; do not guess or quietly omit functionality.
3. Implement UI, data/API integration, native behavior, state/persistence, loading/empty/error/offline/recovery, authorization and lifecycle together—not a disconnected component.
4. Test happy path and all applicable F01–F12 failures, including negative post-state, signed-device capabilities and resident/staff workflows where relevant. Signed-device parts are Skipped under OD-06 (§1) and listed in the phase note.
5. Record task/requirement implementation locators, current source/build/backend/environment, sanitized artifacts and named review before closing an exit.
6. Reopen affected evidence after a contract/build/design/source change. Earlier subsystem completion does not certify later integrations or final release readiness.

**Coverage ownership:** Appendix A assigns each feature to concrete numbered phases; C.1 assigns matching acceptance families; C.3 assigns gate contributions. Split journeys (for example Family CRUD/household QR, request/payment cancellation, Maps/location and logout/token cleanup) require **all** listed phase contributions. An earlier phase may close its assigned subsystem tasks, but the shared A/T family cannot be finally verified until remaining contributions and Phase 19 regression pass.

Order follows dependencies, not a permission to skip a number. After common foundations, independent domains may proceed when their dependencies/contracts are ready; close each applicable exit before its dependent feature is accepted. Phase 0 records staging/production external owners early. Phase 3 backend work can be prepared once Phase 0 contracts are fixed, but its exit includes Phase 2 adapter contracts and real deployment evidence. A blocked payment/provider/native credential does not justify deleting that phase or calling a pilot complete.

No new arbitrary framework is prescribed. Reuse the current iOS workspace, qualified primitives/platform adapters and shared domain contracts, with compatible additive backend changes where genuinely necessary. Preserve unrelated edits and Android/web contracts; do not alter restored Android UI.

### 4.2 Phase overview and initialized execution ledger

Stable internal phase identifiers are `P00`–`P20`; task identifiers are `P00-T01`, etc. User-facing labels are **Phase 0**, **Phase 1**, and so on. Identifiers support evidence references; they are not a second roadmap.

| Execution phase | Entry dependencies | Working deliverable / exit focus | Lead owner role | Status |
|---|---|---|---|---|
| Phase 0 — Baseline, scope freeze and execution control | None; planning/source access | Owned baseline, complete requirement/route/modal/contract/design map, initialized evidence index and prerequisite register; no hidden missing feature. | Product/engineering lead + QA + design | Verified 2026-10-14 (baseline 2026-10-13); named owner/approver for all roles: KingJaqar; owned follow-ups PR-20 (post-baseline Android delta/DRRM scope) and PR-21 (remaining captures) — see Phase 0 progress note |
| Phase 1 — Expo SDK 57 native foundation and six-destination navigation | Phase 0 | Signed SDK 57 development build, six native destinations/stacks and qualified component/native capability baseline. | iOS lead + Apple/EAS owner + design | Verified (non-device scope, OD-06/OD-07) 2026-10-15 — T01/T03–T05 Verified (non-device scope); T06/T07 Skipped (OD-06); P01-T02 callback scheme (PR-03) Skipped (OD-07) — see Phase 1 progress note |
| Phase 2 — Typed data layer, protected persistence and lifecycle recovery | Phase 1 | Reusable typed data/platform adapters, protected persistence, upload/cache/list/lifecycle primitives and automated boundary tests. | iOS/data engineer + security | Verified (non-device scope, OD-06) 2026-10-14 — device proofs Skipped; split contributions owned by P03/P05/P12/P13 — see Phase 2 progress note |
| Phase 3 — Backend compatibility, authorization and domain safeguards | Phase 0, Phase 2 | Deployed/tested compatible contract baseline and security safeguards, with exact migration/function/schema evidence and owned later operational gates. | Backend/security lead + domain owners | Partially complete 2026-10-14 — migrations 0121–0124 and the `delete-my-account` freshness check implemented and verified on isolated clones (non-device scope, OD-06); migrations present on hosted since 2026-10-15; function deploy, stray history row and hosted invariant run pending — see Phase 3 progress note |
| Phase 4 — Authentication, guest access, setup, recovery and session management | Phase 1, Phase 2, Phase 3 | Working email/Google/Apple + setup/verification/password/recovery/guest/session/logout flows. | iOS/auth engineer + backend/security | Partially complete 2026-10-15 — T01–T07 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 49 new tests, export); Phase 3 exit and PR-06 open; T08 and every live app/real-provider run Skipped (OD-07) — see Phase 4 progress note |
| Phase 5 — Profile, household, avatar, ID evidence and location verification | Phase 2, Phase 3, Phase 4 | Complete Settings profile/household/birthday/avatar/ID/location workflows and authoritative approved-ID readiness. | iOS/profile engineer + verification/backend owners | Partially complete 2026-10-15 — T01/T02/T06/T07 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 38 new tests, export, generated configuration); T03/T04/T05 implemented and logic-verified behind closed gates G03/G04; address detection pending PR-10; Phase 3 exit and Phase 4 open items carried as blockers; T08 live runs Skipped (OD-07) — see Phase 5 progress note |
| Phase 6 — Appearance preferences, introduction and interaction completion | Phase 1, Phase 2, Phase 4, Phase 5 | Working full appearance/preferences, source introduction and accessible shared interaction system. | iOS/design/accessibility engineer | Partially complete 2026-10-15 — T01–T05 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 29 new tests, export); T06 partial (shared controls without a Phase 6 consumer close in their owner phases); T07 contrast automated, device/live items Skipped; Phase 3–5 open exits carried — see Phase 6 progress note |
| Phase 7 — Services catalogue, guidelines and charter detail | Phase 2, Phase 3, Phase 4, Phase 5, Phase 6 | Complete discoverable catalogue/detail/charter/guideline routes ready for real submissions. | iOS/services engineer + catalogue owner | Verified (non-device scope, OD-06/OD-07) 2026-10-15 — T01–T06 verified (typecheck, lint, 17 new tests, export, read-only hosted contract check); the Logs segment landed with P09-T05; Phase 3–6 open exits carried; live runs Skipped (OD-07) — see Phase 7 progress note |
| Phase 8 — Document forms, supporting evidence, review and authoritative submission | Phase 2, Phase 3, Phase 4, Phase 5, Phase 7 | All required application forms/uploads/review and committed submission references; no partial-port form path. | iOS/services engineer + backend/verification | Partially complete 2026-10-15 — T01–T07 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 27 new tests, export, read-only hosted contract check); T08 real-backend/device/live runs Skipped (OD-06/OD-07); Phase 3–5 open exits carried — see Phase 8 progress note |
| Phase 9 — Request lists, detailed tracking, processing clocks, logs and request cancellation | Phase 7, Phase 8 | Complete requests/logs/detail/tracking/request-cancellation journeys through fulfillment states. | iOS/services engineer + SLA/operations owner | Partially complete 2026-10-15 — T01–T06 and T08 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 24 new tests, export, read-only hosted contract check); T07 staff-lifecycle run Skipped (OD-07); Phase 7–8 open exits carried — see Phase 9 progress note |
| Phase 10 — Fee assessment, pickup, QR PH settlement, payment cancellation and receipts | Phase 3, Phase 8, Phase 9 | Operating pickup and QR PH with authoritative paid receipts/QR save/PDF share and fault recovery. | Payments/backend + iOS/services + barangay operations | Partially complete 2026-10-16 — T01–T03 and T05–T07 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 62 new tests, export, generated configuration, read-only hosted contract check); T04 evidence task: owner approval recorded (OD-09), settlement/webhook evidence open; T08 Skipped (OD-07); `qrph`/`pickup` opened by OD-09; Phase 3, 8 and 9 open exits carried — see Phase 10 progress note |
| Phase 11 — Reports hub, announcements, read states and counters | Phase 2, Phase 3, Phase 4, Phase 6 | Working four-view Reports/announcement/read-state/count system with reusable Home/inbox-safe contracts. | iOS/reports engineer + content/moderation | Verified (non-device scope, OD-06/OD-07) 2026-10-16 — T01–T07 verified (typecheck, lint, 33 new tests, export, read-only hosted contract check; sources rebuilt 2026-10-16 after the first implementation was found missing from the working tree — see the Phase 11 progress note); live runs, device badge/VoiceOver and hosted embed execution Skipped; Phase 3, 4 and 6 open exits carried; `publicIncidents` stays closed — see Phase 11 progress note |
| Phase 12 — Concern forms, photos, location, detail, corroboration and withdrawal | Phase 2, Phase 3, Phase 4, Phase 6, Phase 11 | Full resident concern creation/detail/photos/location/corroboration/withdrawal and moderated visibility. | iOS/reports engineer + backend/moderation | Partially complete 2026-10-16 — T01/T03/T04 Verified (non-device scope, OD-06/OD-07: typecheck, lint, 43 new tests, export, read-only hosted contract check); T02/T05/T06/T08 partial (map processors and other residents' reports/corroboration stay behind the closed `mapProviders`/`publicIncidents` gates); T07 blocked on the G12 moderation policy (PR-13); live runs Skipped; Phase 3, 4 and 6 open exits carried — see Phase 12 progress note |
| Phase 13 — Maps discovery and emergency guidelines, hotlines and alerts | Phase 2, Phase 3, Phase 4, Phase 6, Phase 11, Phase 12 | Working Maps discovery and complete emergency guidelines/hotlines/alerts/hub navigation. | iOS/maps/emergency engineer + DRRM/content/privacy | Partially complete 2026-10-16 — T01–T05 and T07 Verified (non-device scope, OD-06/OD-07/OD-10: typecheck, lint, 50 new tests, export, browser run of the map page, read-only hosted contract check); T06/T08 partial; `emergencyContent` opened by OD-10 (PR-12 waived); `mapProviders` and `publicIncidents` stay closed; live runs Skipped; Phase 3, 4, 6 and 12 open exits carried — see Phase 13 progress note |
| Phase 14 — Evacuation centers, device location, route guidance and DRRM interactions | Phase 2, Phase 3, Phase 13 | Complete center/location/route/DRRM journey with approved processor and explicit estimate/freshness semantics. | iOS/location engineer + DRRM/privacy/provider owner | Partially complete 2026-10-16 — T01–T07 Verified (non-device scope, OD-06/OD-07/OD-11: typecheck, lint, 51 new tests, export, browser run of the map page, read-only hosted contract check, test requests to the first-party route function); `routeService` opened by OD-11; Android offline routing pack out of scope for now; T08 live/device runs Skipped; Phase 3, 4, 6, 12 and 13 open exits carried — see Phase 14 progress note |
| Phase 15 — QR guide, center QR exports, household QR and online emergency check-in | Phase 3, Phase 4, Phase 5, Phase 13, Phase 14 | Working QR guide/scanner/center show-share-save/household display and truthful online resident-only check-in. | iOS/QR engineer + DRRM/backend/privacy | Partially complete 2026-10-16 — T01–T06 Verified (non-device scope, OD-06/OD-07/OD-12: typecheck, lint, 35 new tests, export, generated configuration, QR output decoded by a real reader, read-only hosted contract check); `evacuationCheckin` and `householdQr` opened by OD-12; T07 partial; camera/Photos/share/live/device runs Skipped (OD-06/OD-07); Phase 3, 4, 5, 13 and 14 open exits carried — see Phase 15 progress note |
| Phase 16 — Health calendar, drive discovery, self-registration and registration history | Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 11 | Fully usable health calendar/drives/self-registration/history with confirmed applicant results. | iOS/health engineer + health/backend/privacy | Partially complete 2026-10-16 — T01–T06 Verified (non-device scope, OD-06/OD-07/OD-13: typecheck, lint, 39 new tests, export, read-only hosted check); `medicalRegistration` opened by OD-13; T07 partial; two-tenant (G16)/live/race/device runs Skipped or open; Phase 3, 4, 5, 6 and 11 open exits carried — see Phase 16 progress note |
| Phase 17 — Server inbox, durable remote push and notification preferences | Phase 1, Phase 2, Phase 3, Phase 4, Phase 9, Phase 10, Phase 11, Phase 12, Phase 15, Phase 16 | Operating server-backed inbox/outbox/push/preferences/tap routing with receipt monitoring and accountable ownership. | Notification/backend operations + iOS + privacy | Partially complete 2026-10-21 — T01 and T03–T07 Verified (non-device scope, OD-06/OD-07/OD-14: typecheck, lint, 80 new tests, 121 database assertions on a clone, export, generated configuration, sender run against the real database functions); T02 and T08 partial; migration 0135 applied to hosted 2026-10-21 (P20-D01), send-notifications not deployed; `remotePush` stays closed; PR-07 operator/alerts and device/APNs runs open; Phase 3, 4, 9, 10, 11, 12, 15 and 16 open exits carried — see Phase 17 progress note |
| Phase 18 — Actionable Home, information pages, complete exports and account privacy | Phase 4, Phase 5, Phase 6, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17 | Fully actionable Home and complete information/privacy/export/deletion/logout surface with real linked workflows. | iOS/information engineer + privacy/backend/content/support | Partially complete 2026-10-21 — T01, T02, T03 and T06 Verified (non-device scope, OD-06/OD-07/OD-14: typecheck, lint, 67 new client tests, 17 new function tests, export, generated configuration, web localhost guest run); T04/T05 built and tested on a database clone and a real PostgREST; migrations 0135/0136 applied to hosted 2026-10-21 (P20-D01) but the export/delete function changes are not deployed; `completeExport`/`accountDeletion` closed; T07/T08 partial; PR-06 Apple revocation and device runs open (PR-14 matrix approved, OD-16); Phase 4–6 and 9–17 open exits carried — see Phase 18 progress note |
| Phase 19 — Whole-app parity, accessibility, resilience and production-candidate verification | Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17, Phase 18 | Complete signed candidate and exhaustive functional/design/security/lifecycle evidence with closed parity gaps. | QA lead + iOS/backend/security/design/accessibility | Partially complete 2026-10-21 — audit tooling, 725 iOS tests, 826 database assertions and 7/7 concurrency on a clone, secret scan of both exports and the source-candidate freeze pass (non-device scope, OD-06/OD-14); T01–T07 and T09 partial, T08 Skipped for the reporter (OD-18); exit not met: seven feature gates closed, 949 checkpoints at family-level evidence, device/live/staging evidence Pending/Skipped — see Phase 19 progress note |
| Phase 20 — TestFlight, App Store preparation, rollout and final conversion sign-off | Phase 19 | Approved immutable release, TestFlight/store/distribution records, operational runbooks and final complete-conversion evidence. | Release/Apple/EAS owner + QA/product/privacy/operations | Partially complete 2026-10-21 — T01–T03, T05, T06 Partially complete, T09 Verified (non-device scope, OD-06) as a report that states the conversion is not complete; T04, T07, T08 Skipped (OD-06); exit not met: seven required feature gates closed, no device/live/staging evidence, no gate approved in the phase, no release/TestFlight/submission/rollout — see Phase 20 progress note |

Maintain the embedded ledger during execution with task status, named owner, start/finish date, blocking issue, implementation commit, native build, backend/environment, evidence locator and approver. Detailed artifacts belong under `plans/evidence/resident-ios-parity/phase-00/` through `phase-20/`, with the index initialized by Phase 0. Phase 0 created the index, all 21 phase directories and the machine-readable `execution-ledger.csv` on 2026-10-13; `phase-00/build-ledgers.mjs` regenerates and verifies the ledgers. No code changes, builds or later-phase approvals are claimed.

Allowed states: Planned, In progress, Blocked (reason/owner/next prerequisite), Implemented–unverified, Verified (exit evidence), Reopened, and — from 2026-10-14 — Verified (non-device scope, OD-06) and Skipped (OD-06) for work that needs a signed build or physical device. Set Verified only when every task/exit and split-family contribution assigned to that phase has passed. An unrelated historical “Phase 1” artifact is not evidence for this roadmap merely because its number matches.

### 4.3 Detailed execution checklists

All phase checkboxes start unchecked. Phase 0 assigned KingJaqar as named engineer/reviewer for every phase until a role is delegated (decision-register OD-01). Each task inherits §§1–3/5–6 and Appendices A–C; validation/native/accessibility/backend requirements cannot be deferred out of the completed feature merely because they are not repeated in a bullet.

#### Phase 0 — Baseline, scope freeze and execution control

**Objective:** Turn the source-backed parity specification into an owned, testable execution baseline before changing code.

**Entry:** Current plan/handoff/source available; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** Product/engineering lead + QA + design.

**Traceability:** A01–A52 inventory; A52 disposition; handoff D01–D21 / DX01–DX52; G01/G17 planning prerequisites; all gates inventoried. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P00-T01** Read this full plan, the main Design System Handoff and the supplied Android breakdown; inspect current Android/shared/iOS source and relevant dirty changes. Freeze dated commit/hash/dependency/deployment inventories; preserve unrelated work and the restored Android UI.
- [x] **P00-T02** Create the execution/evidence index under plans/evidence/resident-ios-parity/; initialize per-phase/task status, owner, dependency, blocker, commit/build/environment, result and artifact fields. Keep historical evidence distinct; nothing is marked complete solely because code already exists.
- [x] **P00-T03** Assign every A01–A52 bullet checkpoint, R01–R54 route/layout and B.3 modal/native outcome to a primary implementation phase plus supporting phases, D/DX/T/F/G identifiers and a named owner. Audit all existing iOS placeholders/gates against this inventory.
- [x] **P00-T04** Confirm the recorded product decisions: six destinations/native More, email/Google/Apple, required remote push, all appearance/export/read/corroboration capabilities and the explicit self-only health/online resident-only check-in corrections. Do not reopen a limited release scope by assumption.
- [x] **P00-T05** Record authoritative service/verification/moderation/privacy/retention/map/health/payment rules and external Apple/EAS/provider/support/DRRM owners. Mark unavailable facts as owned prerequisites with required evidence; do not fabricate decisions or require unrelated feature work.
- [x] **P00-T06** Establish sanitized two-tenant/role fixtures and Android behavior captures; record working/partial/defective/unreachable/unused states and every §6.8 corrective disposition. Recheck whether separately scoped weather routing is actually Android-wired before importing it.
- [x] **P00-T07** Approve typed route/record identity and backward-link mappings, versioned API boundaries and the initial design-state inventory. Establish acceptance severity, candidate/evidence naming and change-impact/reopening rules.

**Required working deliverable:** Owned baseline, complete requirement/route/modal/contract/design map, initialized evidence index and prerequisite register; no hidden missing feature.

**Exit — not just code present:** All 1,218 source checkpoints and 54 route/layout entries have ownership/disposition and primary delivery assignment; unresolved external facts are explicit blockers for the affected later phase, not invented approvals.

**Verification/evidence:** T52 plus inventory completeness; baseline hashes, current-source observations and decision register. Paired revisions, full field/state/modal annotations and DX coverage; no reduced mockup scope.

**Progress and status — 2026-10-13, updated 2026-10-14 (Phase 0: Verified).** Evidence: [phase-00/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-00/README.md); index: [resident-ios-parity/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/README.md). No application source, configuration, dependency, migration, database or deployment was changed.

Ownership decision (user, 2026-10-13, option A): **KingJaqar** is the named owner and approver for every Phase 0–20 lead role, every G01–G22 approval role and every open prerequisite until a role is delegated (decision-register OD-01). The Phase 0 route/API/design-state/severity/naming/reopening rules are approved (OD-02). Naming an owner does not satisfy any gate's evidence requirement.

| Task | Status | Result / remaining work |
|---|---|---|
| P00-T01 | Verified | Baseline frozen: HEAD `2e5681c`, breakdown SHA-256 matches §6.1, lockfile/SDK 57 versions (expo 57.0.10, RN 0.86.2, React 19.2.3), 60 pre-existing dirty entries preserved. Hosted project (read-only): migrations `0001`–`0113` applied, 9 Edge Functions active. |
| P00-T02 | Verified | Evidence index, `execution-ledger.csv` (21 phases + 162 tasks with owner/status/blocker/commit/build/environment/evidence/approver fields) and `phase-00`…`phase-20` directories. |
| P00-T03 | Verified | `parity-ledger.csv` assigns all 1,218 checkpoints (primary + supporting phase, D/DX/T/F/G, B contract, Android state, §6.8 disposition, iOS baseline state/locator, owner role, named owner KingJaqar); `route-ledger.csv` R01–R54 + 10 iOS-only/alias routes; `modal-ledger.csv` 16 families. `build-ledgers.mjs` verifies counts with 0 failures, 0 wording drift and 0 rows without a named owner. |
| P00-T04 | Verified | PD-01–PD-11 recorded verbatim and consistent with handoff Rev 2.1. |
| P00-T05 | Verified | `prerequisite-register.md` PR-00–PR-21 (Apple/EAS/APNs, scheme/OAuth, staging environment, Xcode/device host, QR PH settlement, map/QR processors, DRRM/moderation/privacy/catalogue/support owners, iOS dev config, fonts, post-baseline delta, remaining captures). PR-00 and PR-16 resolved; the rest are owned by KingJaqar and stay open as blockers for their later phases/gates. |
| P00-T06 | Verified (2026-10-14) | Existing two-tenant pgTAP fixtures inventoried; every §6.8 anchor re-checked. Owner-supplied `contexts/Barangayan Resident Android — Screens.pdf` (195 pages) indexed page-by-page in `android-captures/captures.json` (32 of 44 screen routes; 12 also in dark mode) with 15 observations; capture gaps owned as PR-21. Weather routing recheck: not wired at baseline commit `2e5681c`, but **wired in the uncommitted 2026-10-14 working tree** (offline route card, public `/emergency-centers`) → PR-20. |
| P00-T07 | Verified | Approved 2026-10-13 by KingJaqar: typed routes/aliases, versioned API boundaries (`contract-boundaries.md`), design-state inventory, severity/naming/reopening rules. |

Verification run 2026-10-13: iOS `typecheck` exit 0, `lint` exit 0, `test` 8/8 passed (baseline and final identical); ESLint on the new evidence scripts exit 0; ledger builder 0 failures. 2026-10-14: captures indexed (every page mapped once), ledger builder rerun with 0 failures after recording the two new Android route files as untriaged deltas RD01/RD02, ESLint on the builder exit 0. All Phase 0 exit criteria are met for the frozen baseline.

Discrepancies recorded: (1) AGENTS.md says the last pushed migration is `0094`, but the hosted project has `0001`–`0113`; the AGENTS.md numbering rule still governs. The next unused prefix was `0114` at baseline, but concurrent DRRM routing work added `0114_routing_rate_limits.sql` during this session, so recheck the highest repository prefix immediately before writing any migration (`0114`–`0118` now exist as untracked files, so currently `0119`). (2) §1's "migrations through `0112`" is stale; `0113_routing_conditions.sql` (uncommitted user work) exists and is applied on the hosted project. (3) §6.5/§6.8 cite the fabricated prior dose at `health/register.tsx:390`; it is now at line 394. (4) The current iOS shell has five tabs, routes announcements through `/reports/[id]`, signs up through user metadata without OTP and inserts `service_requests` directly; these are recorded as `defective-baseline`/route conflicts for Phases 1, 4, 8 and 11–12, not as progress. (5) Post-baseline Android changes (uncommitted, found 2026-10-14): new `settings/valid-id.tsx` (front-photo-only ID wizard) and `emergency-centers.tsx` (public Centers/offline routes), offline routing, `osrm.ts` deleted. Under §4.4/§6.1 they need an additive ledger delta once committed, The user decided on 2026-10-14 to defer them until that Android work is committed; the delta is added then (decision-register OD-03, PR-20). (6) Android capture defects not to port: facility chips print icon names (`evacuation-center-card.tsx:113`), blank household QR, empty email in the recovery-code step, URL-encoded login email, low dark-mode contrast on announcement cards.

#### Phase 1 — Expo SDK 57 native foundation and six-destination navigation

**Objective:** Produce a real signed iPhone build and the required native shell, not only a JavaScript export.

**Entry:** Phase 0 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS lead + Apple/EAS owner + design.

**Traceability:** A01; shared A50/A51; handoff D01; G02/G14/G22 foundation evidence; final approval later. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P01-T01** Read exact SDK 57 package/configuration docs and qualify the existing workspace/root lockfile, supported Node/Xcode/React Native/React baseline and iOS 16.4+ deployment target. Install/pin only required compatible packages; do not upgrade unrelated workspaces.
- [ ] **P01-T02** Configure approved bundle ID, callback schemes, EAS project, development/simulator/device profiles and signing/provisioning. Preserve staging/production isolation; no invented credentials or secret values in public configuration. *(Signing parts Skipped — OD-06; callback scheme Skipped — OD-07)*
- [x] **P01-T03** Implement Home/Services/Maps/Health/Reports/Settings as six statically declared native destinations with qualified system More overflow. Build their nested stacks, correct titles/headers/safe areas and supplemental toolbar shortcuts.
- [x] **P01-T04** Implement bootstrap splash/font readiness, session-restoration waiting/retry/error boundaries and public/private route guards; create typed incident-vs-announcement destinations/aliases without guessing record type.
- [x] **P01-T05** Implement handoff semantic tokens and reusable accessible primitives: buttons/fields/selectors/cards/status/empty/error/skeleton/sheets/keyboard/focus. Extend existing primitives, not a second design/component/state framework.
- [ ] **P01-T06** Spike each required native capability in a signed development build: Keychain, Apple/browser callback, camera/QR, foreground/reduced location, image/document picker, Photos save, PDF/share, WebView/map bridge and push token/configuration. Dispose resources and record failures; a spike is not a finished feature. *(Skipped — OD-06)*
- [ ] **P01-T07** Test More entry/direct links/back/reselection/restoration on compact/large iPhones and supported iOS. If the approved navigation cannot be qualified, record a blocker and resolve it explicitly; do not silently switch to a custom bar. *(Skipped — OD-06)*

**Required working deliverable:** Signed SDK 57 development build, six native destinations/stacks and qualified component/native capability baseline. *(OD-06: the signed build is Skipped; deliverable is the six-destination shell, typed routes, tokens/primitives and qualified generated configuration.)*

**Exit — not just code present:** Native shell, permission/plugin/configuration proofs and route identity/More tests pass on device; feature placeholders remain visibly incomplete and cannot count as parity. *(OD-06: on-device proofs Skipped; exit uses route/configuration tests, export and `expo config --type introspect`.)*

**Verification/evidence:** T01; R01–R54 infrastructure; F01/F08/F12; signed build/configuration and native-spike records. Handoff §§1/4–9; tokens and native six-destination interaction proof.

**Progress and status — 2026-10-14, amended by OD-06 and OD-07 (Phase 1: Verified, non-device scope).** Evidence: [phase-01/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-01/README.md), record [P01_2026-10-14_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-01/P01_2026-10-14_implementation-and-verification.md). Source: uncommitted on base `2e5681c`. Under OD-06 (§1) no signed build is made; T01 and T03–T05 are Verified (non-device scope) on the checks below, T06/T07 are Skipped, and no checkpoint is device-qualified.

| Task | Status | Result / remaining work |
|---|---|---|
| P01-T01 | Verified (non-device scope, OD-06) | SDK 57 docs read; installed expo 57.0.10 / RN 0.86.2 / React 19.2.3 / screens 4.26.2 recorded; `ios.deploymentTarget` pinned to 16.4; ATS hardened (no arbitrary loads); `expo-dev-client` added (additive lockfile change only). Xcode 26.4+ qualification Skipped (OD-06, PR-05 not required); P01-D04 on the pre-existing SDK patch drift stays recorded but non-blocking (`expo` 57.0.10 vs ~57.0.28 and six others), which is shared with Android and was not upgraded. |
| P01-T02 | Skipped (OD-07 callback scheme; OD-06 signing parts) | `eas.json` simulator/development/device/staging/production profiles with per-profile `EXPO_PUBLIC_ENVIRONMENT`, no OTA channel. Bundle ID, EAS project and signing/provisioning Skipped (OD-06; PR-02/PR-04 not required). The approved URL scheme/OAuth callback (PR-03) was skipped by OD-07 on 2026-10-15; Phase 4's Google browser flow therefore fails closed with "not available in this build". |
| P01-T03 | Verified (non-device scope, OD-06) | Six static native destinations (Settings moved into the tab group), outline/filled SF Symbols, nested titled stacks, supplemental Settings toolbar link, Reports badge = unread resolved + unread announcements with three labeled counters in Reports kept live by a tab-level provider. Device More qualification Skipped (OD-06). |
| P01-T04 | Verified (non-device scope, OD-06) | Splash held until the first session decision (3 s lift to in-app progress), "Retry session restoration"/"Sign out on this device", all root routes declared under the recovery guard, one `RequireResident` private-route guard, typed `/reports/announcements/[announcementId]` and `/reports/incidents/[incidentId]`, aliases `/reports/[id]`→announcement and `/profile`→`/settings/profile`. Account-setup and OAuth-callback routing were completed in Phase 4; PR-18 was skipped by OD-07, so no runtime start is claimed. |
| P01-T05 | Verified (non-device scope, OD-06) | Handoff tokens (`src/lib/theme.ts`) and extended primitives in `src/components/ui.tsx` (button variants, field with required/error/password visibility, selector + page sheet, status badge, skeleton, empty/error/not-found, destructive confirmation, discard guard, VoiceOver announcements). Device accessibility proof Skipped (OD-06). |
| P01-T06 | Skipped (OD-06) | Capability matrix prepared ([P01-T06 record](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-01/P01-T06_2026-10-14_native-capability-matrix.md)); native spikes need a signed build and are Skipped (OD-06). |
| P01-T07 | Skipped (OD-06) | 16-step device protocol ([P01-T07 record](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-01/P01-T07_2026-10-14_device-qualification-protocol.md)); needs a signed build and devices — Skipped (OD-06). |

Verification run 2026-10-14 (iOS workspace): baseline typecheck 0 / lint 0 / tests 8/8 / `expo export --platform ios` 0; final typecheck 0 / lint 0 (no warnings) / tests 13/13 (new route-contract and relative-time tests) / export 0; `expo config --type introspect` shows ATS hardened and deployment target 16.4; read-only HEAD checks confirm the four report-count query shapes (HTTP 200; misspelled-embed control HTTP 400); `check:release` and `expo install --check` fail exactly as at baseline (missing owner-supplied identity/config, closed gates, pre-existing patch drift).

Decisions recorded in the evidence record: P01-D01 feature-owned root routes keep their paths until their owning phases move them to canonical routes; P01-D02 tokenized button replaces the SwiftUI button (label colour/contrast); P01-D03 private routes show an in-place sign-in state, pending destinations arrive in Phase 4; P01-D04 shared SDK patch drift needs owner approval; P01-D05 `/reports/[id]` alias collides with Android incident links if PR-03 picks the `barangayan` scheme; P01-D06 native tab reselect pops to root, dirty forms rely on the discard guard (device check T07 step 6). Plan discrepancy: Appendix B.2 lists `/emergency` and the request/health routes under destination stacks; they remain root-stack screens until P08/P09/P13/P16 (P01-D01).

*(Superseded by OD-06 the same day; kept for history.)* **Owner decision 2026-10-14 (decision-register OD-04, choice "C"):** the signed development build is deferred; no build route (EAS cloud vs Mac/Xcode) is chosen yet. Phase 1 stays In progress with its exit Blocked on PR-02/PR-03/PR-04/PR-05/PR-18, and P01-T06/T07 wait for that build. Phase 2 tasks that need no signed build or device may proceed before the Phase 1 exit; Phase 2 device and native-storage proofs stay blocked behind the same build. Neither phase can be marked Verified without its device evidence. P01-D04 (shared SDK patch drift) remains open.

**Owner decision OD-06 (2026-10-14, supersedes OD-04):** no signed builds for the whole plan (§1). Phase 1 statuses above were re-marked on the existing non-device evidence (rechecked 2026-10-14: iOS typecheck 0, lint 0, tests 74/74). Skipped for Phase 1: the signed development build, Xcode qualification, native capability spikes (T06), on-device More/deep-link/restoration/accessibility qualification (T07), bundle ID/EAS/provisioning. Phase 1 becomes Verified (non-device scope) once PR-03 supplies the approved scheme/callback for P01-T02. *(Superseded by OD-07, 2026-10-15: PR-03 was skipped, P01-T02's callback part is Skipped, and Phase 1 is Verified (non-device scope, OD-06/OD-07).)*

#### Phase 2 — Typed data layer, protected persistence and lifecycle recovery

**Objective:** Provide reusable data/state/device adapters so every feature handles real data, interruption and account isolation consistently.

**Entry:** Phase 1 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/data engineer + security.

**Traceability:** A51 primary; shared all A-sections; handoff D01/D03/D06/D11/D12/D19/D20; G19 infrastructure; G01/G04 security prerequisites. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P02-T01** Inventory current iOS runtime/API/resource/shared helpers; implement focused typed adapters for B01–B24 and stable public error classification. Validate responses, nullability and identifiers; distinguish network/HTTP/schema/empty/authorization/unknown-commit outcomes.
- [x] **P02-T02** Implement request cancellation/timeouts, owner/tenant/environment/schema keys, stale-response rejection and single-flight mutation boundaries. No automatic retries for an uncertain write unless its authoritative idempotency/reconciliation contract permits them.
- [x] **P02-T03** Implement incremental stable pagination, search/filter cancellation/debouncing, tie-break ordering, realtime deduplication/coalesced refresh and subscription cleanup. Establish consistent loading/true-empty/filtered-empty/stale/offline/error states.
- [x] **P02-T04** Qualify protected credential/draft storage, large-value/native errors, reinstall/Keychain policy and cleanup tombstone. Keep secrets out of ordinary storage; failed protection never falls back to plaintext. Clear or quarantine prior-account drafts/uploads/cache on logout/switch.
- [x] **P02-T05** Build staged upload/file/image adapters: actual byte/MIME validation, HEIC normalization/metadata stripping where required, document cache/iCloud lifetime, immutable owned paths, signed-preview expiry, progress/remove/retry and orphan cleanup references.
- [x] **P02-T06** Port the shared foreground device-location controller through a compatible iOS adapter with reduced-accuracy/last-known confirmation, cancel/Settings actions and background/late-subscription disposal. Feature-specific map/profile journeys close in their owning phases.
- [x] **P02-T07** Implement scoped public-emergency cache version/fetched-time/freshness and secure private read/draft policy. Do not introduce a general offline mutation/attendance queue or background delivery guarantee.
- [x] **P02-T08** Create controller/schema/adapter tests and fault fixtures for account races, process restart, offline cleanup, pagination above row limits and unknown outcomes. Server enforcement closes in Phase 3; mocks do not prove it.

**Required working deliverable:** Reusable typed data/platform adapters, protected persistence, upload/cache/list/lifecycle primitives and automated boundary tests.

**Exit — not just code present:** Client/controller fault tests pass; sensitive state is owner-bound and recoverable without plaintext/false success. Existing server integrations are recorded, with enforcement prerequisites explicitly assigned to Phase 3.

**Verification/evidence:** T51 and shared T50; F02–F08/F11; adapter/persistence tests and signed storage/file proofs *(signed storage/file proofs Skipped — OD-06)*. Consistent recovery/freshness/partial-result primitives for all D-families.

**Progress and status — 2026-10-14, amended by OD-06 (Phase 2: Verified, non-device scope).** Evidence: [phase-02/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-02/README.md), record [P02_2026-10-14_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-02/P02_2026-10-14_implementation-and-verification.md). Source: uncommitted on base `2e5681c`. Started before the Phase 1 exit under owner decision OD-04 (signed build deferred; non-device Phase 2 work allowed). Under OD-06 (§1) every device/native proof is Skipped; all eight tasks are Verified (non-device scope) on the checks below, with split contributions owned by later phases as listed.

| Task | Status | Result / remaining work |
|---|---|---|
| P02-T01 | Verified (non-device scope, OD-06) — Phase 2 contribution | `src/data/outcome.ts` stable failure kinds (incl. `unknown-commit`), `boundary.ts` strict parsing (empty vs absent vs schema vs HTTP/authorization vs cancelled), `schemas.ts` explicit resident-safe columns; `resident-api.ts` rewritten for B06, B07 reads/cancel, B12, B13, B16, B21 (+ B23 storage and B24 realtime primitives). Remaining B01–B03, B05, B08–B11, B14, B15, B17–B20, B22 adapters arrive with their owning phases (inventory in the record); server enforcement is P03. |
| P02-T02 | Verified (non-device scope, OD-06) | Abortable reads with stale-reply rejection, environment/tenant/account scope keys, `createSingleFlight` (committed/failed/unknown/busy, no automatic retry) used by request cancellation and mark-as-read. Device lifecycle proof Skipped (OD-06). |
| P02-T03 | Verified (non-device scope, OD-06) | `PagedList` (25-row pages, generation-tagged reads, id de-duplication, stale-visible rows, no load-more loop), `usePagedResource`, 300 ms debounced server-side search, coalesced realtime refresh with unique channels and cleanup, rewritten `ResourceList` (loading/error/stale/true-empty/no-results/load-more). Six list screens moved to incremental pages. Realtime on device Skipped (OD-06); escaped-wildcard search semantics against real tenant data are checked in Phase 3 integration. |
| P02-T04 | Verified (non-device scope, OD-06) | Keychain-only `protected-drafts.ts` (scope + schema bound, index-before-write, reported cleanup failures, no plaintext fallback), purge tombstone, purge on fresh install/account switch/logout in `runtime.tsx`. Keychain native-error, locked-device, reinstall and offline-logout device proofs Skipped (OD-06); fake-Keychain fault tests pass. |
| P02-T05 | Verified (non-device scope, OD-06) — Phase 2 contribution | Actual-byte type/size validation per bucket, metadata removal (JPEG/PNG/WebP), safe names, owned immutable paths, identical-bytes upload reconciliation, owner-only HTTPS signed previews with early refresh, staged-reference ledger and cleanup, Files picker adapter. Split contributions: HEIC conversion with the Photos picker in P05/P12 (P02-D02, OD-05); server-side orphan cleanup for `request-attachments`/`id-documents` in P03-T07 (P02-D10). Files/iCloud device proof Skipped (OD-06). |
| P02-T06 | Verified (non-device scope, OD-06) | Shared `describeDeviceLocation` gains an additive `ios` platform (Android/web output unchanged); iOS adapter maps `ios.accuracy: 'reduced'`; `useDeviceLocation` pauses in background, re-checks on return, cancels on unmount; When In Use purpose string only. Device permission/reduced accuracy/Allow Once proof Skipped (OD-06). |
| P02-T07 | Verified (non-device scope, OD-06) — Phase 2 contribution | `public-cache.ts` envelope (environment, tenant, key, contract version, fetch time; fresh/stale/expired), `usePublicResource` (labelled cached copy, server replacement, save-failure notice); emergency screen uses it behind the closed gate. Private reads stay in memory; no offline mutation queue. Split contributions: bundled fallback content (A51-018 stays open until approved content arrives in P13 under G07); server content version for `emergency_information` in P03/P13. |
| P02-T08 | Verified (non-device scope, OD-06) | 61 new iOS tests (74 total) incl. real supabase-js query-builder tests against a scripted transport; 1 new shared test. Mocks do not prove server enforcement (P03). |

Verification run 2026-10-14 (iOS workspace): baseline typecheck 0 / lint 0 / tests 13/13 / `expo export --platform ios` 0 / shared tests 419/419; final typecheck 0 / lint 0 (no warnings) / tests 74/74 / export 0 (1,481 modules) / shared tests 420/420; Android and resident-web `tsc --noEmit` clean after the shared type change; `expo config --type introspect` adds only `NSLocationWhenInUseUsageDescription`; read-only hosted HEAD checks return HTTP 200 for all nine new column projections and quoted search filters (bad-column control HTTP 400); `check:release` and `expo install --check` fail as at baseline, the latter now also listing `expo-file-system`/`expo-location` patch drift (hoisted, shared with Android — joins P01-D04).

Dependencies: `expo-file-system ~57.0.2` and `expo-location ~57.0.8` declared in the iOS workspace (required for T05/T06; both already in the root lockfile for Android, no resolved version changed; the lockfile only gains the iOS workspace declarations). No migration was added.

Decisions recorded in the evidence record: P02-D01 malformed detail links show not-found without a query; P02-D02 no HEIC conversion yet — the Files picker cannot select HEIC and HEIF bytes are refused with an explanation; conversion needs `expo-image-manipulator` with the Photos picker in P05/P12 (owner approved 2026-10-14, decision-register OD-05); P02-D03 metadata removal by container editing with Orientation preserved; P02-D04 cache freshness (emergency content 24 h stale / 30 d expired, centers 30 min / 24 h) for owner/DRRM review; P02-D05 server-side search (drive search also matches location); P02-D06 resident information excludes emergency sections server-side; P02-D07 emergency screen reads `emergency_information` (B13); P02-D08 unused `household`/`registrations` adapters removed; P02-D09 postgrest-js retries idempotent reads only (3×, 1/2/4 s), never writes; P02-D10 client orphan cleanup only where storage policies allow deletion.

**Owner decision OD-06 (2026-10-14, supersedes OD-04):** no signed builds for the whole plan (§1). Phase 2 re-marked Verified (non-device scope) on the evidence above, rechecked 2026-10-14 (iOS typecheck 0, lint 0, tests 74/74). Skipped for Phase 2: Keychain/reinstall/locked-device/offline-logout device proofs, Files/iCloud picker, on-device location permissions, realtime on device. Plan discrepancy: Phase 2's entry names Phase 1, whose exit still waits only on PR-03 (callback scheme), which no Phase 2 deliverable uses.

#### Phase 3 — Backend compatibility, authorization and domain safeguards

**Objective:** Make the authoritative backend safely support the full iOS workflows while remaining compatible with Android/web.

**Entry:** Phase 0, Phase 2 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** Backend/security lead + domain owners.

**Traceability:** Backend prerequisites for all A-sections; handoff D03/D06/D08/D13/D14/D16/D19/D20 state contracts; G01/G03/G04/G08/G16/G18/G19 prerequisite enforcement. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P03-T01** Reconcile local and deployed migrations/functions/schema/grants/storage policies and relevant historical findings. Implement only missing safeguards/contracts, with next-unused sequential NNNN migration prefixes; never renumber pushed files or assume repository presence means deployment.
- [ ] **P03-T02** Verify role/owner/tenant/active/deleted enforcement on all B operations/tables/views/storage. Privileged functions require controlled search path/grants and caller validation; deny cross-tenant/nonresident/stale-deleted requests with no post-state side effects.
- [ ] **P03-T03** Qualify versioned Apple-aware setup/auth continuation without breaking strict existing email/Google/legacy response shapes. Enforce fresh same-account proof for sensitive operations at the server boundary, not editable metadata/client flags.
- [ ] **P03-T04** Qualify profile/household versioned edits, canonical mirror/stable IDs/attendance preservation, immutable ID publication/approval/signed access, profile-email verification invalidation and trusted locality boundaries.
- [x] **P03-T05** Qualify legacy/charter submission schemas, UUID idempotency/payload binding, attachment ownership, eligibility/review, fee assessment/payment-method/pickup and both SLA/cancellation contracts. Administrative assessment/collection/review/SLA controls remain inaccessible to residents.
- [ ] **P03-T06** Qualify concern creation/confirmation/withdraw/read states, medical role/tenant/active/capacity/duplicate/prior-dose rules and resident-only active-center check-in. Add focused compatible operations if needed; do not copy defective Android queues or household booking.
- [x] **P03-T07** Design and stage required durable inbox/outbox/event/token and complete export/deletion/retention contracts so Phases 17/18 can implement them. Existing source endpoints are not sufficient proof; document versions, event/cleanup linkage and operating owners.
- [ ] **P03-T08** Run sanitized two-tenant/role/ownership/concurrency/storage/negative-post-state tests, migration upgrade/recovery rehearsal and Android/web contract regressions. Validate current Supabase docs before actual backend implementation; review advisors where available.

**Required working deliverable:** Deployed/tested compatible contract baseline and security safeguards, with exact migration/function/schema evidence and owned later operational gates.

**Exit — not just code present:** Feature prerequisite invariants pass against the target staging schema; later payment/provider/push/export/deletion operational gates remain open until their complete feature phases pass. No destructive production migration is inferred from this plan update.

**Verification/evidence:** B01–B24 boundary tests; F02/F03/F09–F11; Android/web compatibility and negative post-state evidence. Approved truthful field/status/error/retention contracts; no UI guesses or admin-only data.

**Progress and status — 2026-10-14 (Phase 3: Partially complete).** Evidence: [phase-03/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-03/README.md), record [P03_2026-10-14_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-03/P03_2026-10-14_implementation-and-verification.md), staged contracts [P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-03/P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md). Source: uncommitted on base `2e5681c`. Every write ran on disposable clones of the local development database (hosted-equivalent through `0118`); the hosted project was read only. **Nothing was applied to the hosted project and no Edge Function was deployed.**

| Task | Status | Result / remaining work |
|---|---|---|
| P03-T01 | Verified (non-device scope, OD-06) | Catalog fingerprint comparison of 553 objects (functions with grants, policies, triggers, constraints, buckets). Hosted differs from the repository in three places: the hosted-only policy "residents can create a payment on their own request" (0017 drops it; a resident can insert a forged `paid` payment; fixed by `0121`), the missing `0115` household archive guard and a different `evacuation_centers_entrance_position_check` (both from uncommitted migration files edited after being applied; owned by that session). Storage policy and bucket settings match. |
| P03-T02 | Implemented; verified on rehearsal clone | New incident write guard, announcement-read guard, deleted-account checks on corroborate/withdraw/push token, anonymous execute revoked on 9 resident-facing routines and 8 trigger functions (20 → 3 anonymous security-definer routines, 3 intentional), hosted payments policy drop. Hosted deployment pending. |
| P03-T03 | Implemented; verified on rehearsal clone | `0122` additive Apple origin, `ensure_apple_resident_profile`, `get_resident_account_setup_status_v2`; v1 shape unchanged. Account deletion now requires Auth `amr` freshness in the RPC and, before any Storage deletion, in `delete-my-account`. Hosted Apple provider (PR-06) and Auth password-change freshness remain hosted settings; the callback allowlist (PR-03) was skipped by OD-07. |
| P03-T04 | Implemented; verified on rehearsal clone | `0123` `save_resident_household_if_unchanged` (stale `PT409`, validation, attendance/archive preserved, role default fix). Existing profile conflict, email invalidation and ID publication suites re-run green. |
| P03-T05 | Verified on rehearsal clone | 28 new assertions on owner/tenant/administrator boundaries and no-side-effect rejection for payment method, pickup payment (idempotent, server amount), cancellation and SLA tracking; existing 114-assertion submission suite and charter/SLA suites green. No schema change needed. |
| P03-T06 | Implemented; verified on rehearsal clone | `check_in_to_evacuation_center` online receipt (idempotent 10 min); `register_for_drive` input rules (age 0–130, prior dose ≤ today, conditions, closed drive `P0005`, duplicate before capacity). |
| P03-T07 | Designed and staged | Inbox/outbox/event/token, export v2, deletion state machine and retention matrix specified for Phases 17/18; token ownership delivered; `0124` orphan discovery delivered (closes P02-D10 discovery). |
| P03-T08 | Verified on rehearsal clone; staging-schema run pending | `0118`→`0124` upgrade with legacy data, atomic-rollback recovery, drifted-database rehearsal, 7/7 parallel-session concurrency checks, 204 new pgTAP assertions, 1,055 existing-plus-new assertions across 29 files (only pre-existing/other-session failures: `admin_profile_and_association`, `agency_sla` cron, `flood_shadow_runs` without its own migration). |

Migration numbering: the highest repository prefix when work started was `0119`; another session added `0120_flood_shadow_runs` mid-phase, so this phase uses `0121`–`0124` (AGENTS.md rule). AGENTS.md still names `0094` as the last pushed migration; hosted has `0118`.

**Update 2026-10-15:** the hosted migration history now lists `0121`–`0124` (pushed outside this session); read-only security advisors confirm the revocations (anonymous-executable security-definer routines 20 → 3). This session also applied the `0121` SQL once through the Supabase tool, leaving a stray history row `20261015003812` that still needs removal. Still open: that row, deploying the `delete-my-account` freshness check (hosted is version 1), the invariant run against the hosted schema, hosted Auth settings. The status stays Partially complete.

Decisions P03-D01…D10 are recorded in the evidence record. Exit conditions still open: owner approval to apply `0121`–`0124` and deploy the function; a named staging project or an explicit statement that the hosted project is the staging schema (PR-01); hosted Auth settings; PR-07/PR-13/PR-14 decisions for the staged contracts. Phase 3 does not become Verified until the invariants are re-run against the hosted schema after deployment.

#### Phase 4 — Authentication, guest access, setup, recovery and session management

**Objective:** Deliver every resident entry/account/session workflow, including Google and Apple, before private feature execution.

**Entry:** Phase 1, Phase 2, Phase 3 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/auth engineer + backend/security.

**Traceability:** A03–A07, A40, A42, A47; handoff D02/D03/D17/D20; G01/G18; logout token integration finalized in 17/18. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P04-T01** Implement account-choice root, preserved public guest browsing and action-specific login prompts/authorized return destinations. Keep session/setup restoration out of arbitrary onboarding routes and reject malformed/foreign private deep links.
- [x] **P04-T02** Implement email signup/OTP send/verify/resend/cooldown/expiry/existing-account handling, trusted locality/resident details/map completion and mandatory password creation using server-owned setup status.
- [x] **P04-T03** Implement email/password login and Google browser PKCE/callback; add native Apple nonce/state/token exchange, private relay/missing repeat name, cancellation and credential revocation. Retain existing providers and linking/same-account safeguards.
- [x] **P04-T04** Implement optional provider profile/password progression and service-required complete-profile remediation. Handle interrupted restart, stale status, conflict, timeout/uncertain committed step and first/returning provider flows.
- [x] **P04-T05** Implement forgot/reset/new/change password modes, code/deadline/visibility/confirmation traits and fresh provider/password proof for sensitive actions. No secret persistence or legacy/passwordless dead end.
- [x] **P04-T06** Implement Settings email verification send/verify/status/invalidation, password controls and linked identity/account confirmation journeys without treating profile email as authentication identity automatically.
- [x] **P04-T07** Implement secure refresh/foreground profile revalidation, expiry/deleted/nonresident session denial, logout notice/stack reset, scoped cleanup and offline tombstone. Integrate later token/preference/private-file cleanup as those capabilities arrive.
- [ ] **P04-T08** Run real-provider and owned-callback interruption/replay/wrong-account tests, protected-route/guest coverage and process/background/reinstall scenarios in the signed candidate *(signed-candidate/device runs Skipped — OD-06; live app and real-provider runs Skipped — OD-07; provider/callback/replay/wrong-account logic is tested at the adapter and backend level)*.

**Required working deliverable:** Working email/Google/Apple + setup/verification/password/recovery/guest/session/logout flows.

**Exit — not just code present:** All linked source checkpoints and provider/sensitive-action/route tests pass; required service actions cannot bypass missing committed setup and no second account inherits pending secrets/state.

**Verification/evidence:** T03–T07/T40/T42/T47; F01–F04/F07/F11/F12; G18 real-provider evidence. D02/D03/D17/D20, accessible native input/OTP/password/provider and interruption states.

**Progress and status — 2026-10-15 (Phase 4: Partially complete).** Evidence: [phase-04/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-04/README.md), record [P04_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-04/P04_2026-10-15_implementation-and-verification.md). Source: uncommitted on base `2e5681c`. An earlier owner note of 2026-10-15 said not to start Phase 4 before its entry exits; the owner then explicitly requested implementation the same day, which is recorded as the controlling instruction. The owner then skipped PR-03 and PR-18 (OD-07, §1). The Phase 3 exit remains open and is carried as a blocker below, not as passed. Nothing was committed, deployed, or applied to a remote database.

| Task | Status | Result / remaining work |
|---|---|---|
| P04-T01 | Verified (non-device scope, OD-06/OD-07) | Account-choice root, in-memory guest, allowlisted pending destination (path + UUIDs only), setup enforcement, aliases. No live app run exists (PR-18 skipped, OD-07). |
| P04-T02 | Verified (non-device scope, OD-06/OD-07) | Email OTP register, server-owned details/password steps, conditional profile save, uncertain-password check. GPS-only registration location; manual home pin deferred to Phase 5 (P04-D03). |
| P04-T03 | Verified (non-device scope, OD-06/OD-07); Google browser flow Skipped (OD-07) | Email login, Google PKCE state machine (fails closed without a scheme), native Apple (nonce, revocation, relay email, cancel). Real-provider runs Skipped; Apple also needs PR-06 and a signed binary (OD-06). |
| P04-T04 | Verified (non-device scope, OD-06/OD-07) | Optional provider details/password, `/complete-profile` remediation with allowlisted return, status refresh policy. |
| P04-T05 | Verified (non-device scope, OD-06/OD-07) | Recovery (email/code/new password), Settings change/manage/create/recover-only modes, fresh Google/Apple confirmation. Apple `amr` method unconfirmed (P04-D07). |
| P04-T06 | Verified (non-device scope, OD-06/OD-07) | Settings email verification, status rows, Google link. Link needs hosted Manual Linking. |
| P04-T07 | Verified (non-device scope, OD-06/OD-07) | Profile-less resident tolerated, deleted/staff/foreign-tenant denial with notice, ended-session notice, hint cleanup, logout notice. |
| P04-T08 | Skipped (OD-06, OD-07) | Adapter-level replay, wrong-account, expired and crash-reconciliation tests pass. Real-provider, owned-callback, live app and signed-candidate runs are Skipped. |

Verification run 2026-10-15 (iOS workspace): baseline typecheck 0 / lint 0 / tests 74/74; final typecheck 0 / lint 0 / tests 123/123 / `expo export --platform ios` 0; `expo config --type introspect` shows the `com.apple.developer.applesignin` entitlement and the URL scheme; shared tests 477/477; Android and resident-web `tsc --noEmit` 0 after the additive shared type change; hosted `list_migrations` (read-only) confirms `0122`. T01–T07 are ticked on the non-device standard only (OD-06/OD-07): the screens were never rendered or driven, and no flow ran against a backend. The record's section 6 lists the owner-attended steps that apply if PR-03/PR-18 are supplied later.

Dependencies added to the iOS workspace: `expo-apple-authentication ~57.0.2` (new; native Sign in with Apple), `expo-web-browser ~57.0.2` and `expo-linking ~57.0.4` (already resolved for Android; no resolved version changed). No migration was added.

Decisions P04-D01…D10 are in the evidence record. Key ones: OTP and reset-password are steps inside register and recovery with redirect aliases (D01); iOS has its own strict v2 setup-status schema (D02); registration location is GPS only until Phase 5 (D03); Apple linking is not offered because Android parity is Google-only (D05).

Gates:

| Gate | State | Needed to open |
|---|---|---|
| Phase 3 exit | Partially complete: migrations `0121`–`0124` are on the hosted project; open are the stray migration-history row `20261015003812`, the `delete-my-account` freshness deploy (hosted is version 1), and the invariant run against the hosted schema | Owner approval of production SQL/deploy actions, then Phase 3 re-marked Verified |
| Phase 1 exit | Verified (non-device scope, OD-06/OD-07); callback scheme Skipped | None; reopens only if PR-03 is supplied |
| PR-03 | Skipped (OD-07) | Google browser sign-in stays unavailable in the app |
| PR-18 | Skipped (OD-07) | No live app run; every runtime verification statement is Skipped |
| PR-06 | Open: Apple provider on hosted, server-held secrets, Apple token revocation path | Owner configures the hosted provider; Apple end-to-end also needs a signed binary (Skipped, OD-06) |

Phase 4 becomes Verified (non-device scope, OD-06/OD-07) when the Phase 3 exit is Verified; PR-06 affects only provider-side evidence that is already Skipped.

#### Phase 5 — Profile, household, avatar, ID evidence and location verification

**Objective:** Deliver complete resident identity/household management and verified evidence prerequisites for service requests.

**Entry:** Phase 2, Phase 3, Phase 4 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/profile engineer + verification/backend owners.

**Traceability:** A27 non-QR CRUD; A37–A39, A41; handoff D13/D16/D17; G03/G04 plus profile/location privacy proof. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P05-T01** Implement every source profile display/edit field, locked locality/address semantics, conditional employment/occupation, phone/email/name/suffix/sex/date validation, avatar selection/upload and account-link entry controls.
- [x] **P05-T02** Implement accessible birthday month/year/day picker, apply/cancel/unsaved behavior and leap/future-date constraints; preserve age/date-only semantics and keyboard/focus recovery.
- [ ] **P05-T03** Implement the reachable shared profile/Family household editor with all relationships/roles/count/initials/add/edit/remove/details, stable IDs, mirror and conditional stale-edit reload/reapply. Preserve administrative attendance and do not build a second store from unused hooks. *(Implemented and logic-verified 2026-10-15; `householdEditing` gate closed pending G03 — stays unchecked.)*
- [ ] **P05-T04** Implement all ID type/front/back pick/replace/remove/preview controls, image-only 5 MiB limits and immutable evidence publication, pending/verified/rejected/revoked/approved-version status and remediation. *(Implemented and logic-verified 2026-10-15; `privateIdUploads` gate closed pending G04 — stays unchecked.)*
- [ ] **P05-T05** Implement private expiring front/back previews and publication recovery. Distinguish demographic save, avatar upload and ID publication; report partial save when only some committed operations succeed. *(Previews and recovery verified non-device; publication is behind the closed `privateIdUploads` gate — stays unchecked.)*
- [ ] **P05-T06** Implement location verification GPS/manual map pin, boundary/address/confirm/save and review status using the Phase 2 foreground adapter. Saving coordinates is not proof of residency; retain manual/error/denied/reduced-location alternatives. *(Verified non-device except address detection, pending PR-10 / `mapProviders` — stays unchecked.)*
- [ ] **P05-T07** Refresh authoritative profile/approval state after edits and before sensitive/service gates. Scope temporary files/caches, orphan references and logout cleanup to current owner. *(Phase 5 surfaces verified non-device; the pre-service-gate refresh lands with Phase 8 — stays unchecked.)*
- [ ] **P05-T08** Run stale-editor/two-device/mirror/ID replacement/revocation/signed-URL/file/permission tests and all guest/owner/tenant/role failures. *(Automated stale-editor, replacement and ownership tests pass; two-device, signed-URL, file and permission runs Skipped — OD-07.)*

**Required working deliverable:** Complete Settings profile/household/birthday/avatar/ID/location workflows and authoritative approved-ID readiness.

**Exit — not just code present:** T37–T39/T41 and household CRUD portions of T27 pass; no false verification/partial-save success, ID disclosure or attendance corruption. Household QR closes in Phase 15.

**Verification/evidence:** T27/T37–T39/T41; F02–F04/F06–F08/F12; G03/G04 deployed + device proof. All source selectors/options and D13/D16/D17 states, accessible sheets and explicit private previews.

**Progress and status — 2026-10-15 (Phase 5: Partially complete).** Evidence: [phase-05/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-05/README.md), record [P05_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-05/P05_2026-10-15_implementation-and-verification.md). Source: uncommitted on base `4540e6d`. Owner decision OD-08 approved `expo-image-picker`, `expo-image-manipulator` and `react-native-webview` with bundled Leaflet, and kept RD01 deferred. The Phase 3 exit and Phase 4 open items remain open and are carried as blockers. Nothing was committed, deployed or applied to a remote database; no migration was added. No screen was run (OD-07).

| Task | Status | Result / remaining work |
|---|---|---|
| P05-T01 | Verified (non-device scope, OD-06/OD-07) | Every profile field with live validation, locked locality, conditional occupation, avatar upload (separate save) and one conditional `updated_at` save (P05-D01); profile email edit resets verification via `0109` (P05-D02). |
| P05-T02 | Verified (non-device scope, OD-06/OD-07) | Month/year/day sheet with apply/cancel, leap-year/future/1900 rules; also used by registration details. Large-text and focus return pending device check. |
| P05-T03 | Implemented; logic-verified; gate closed | Staged whole-list save through `save_resident_household_if_unchanged` with stale-list refusal and reload. `householdEditing` stays closed (G03 needs the hosted invariant run). |
| P05-T04 | Implemented; logic-verified; gate closed | 16 ID types, front/back, HEIC conversion, immutable version publication, idempotent retry. `privateIdUploads` stays closed (G04). |
| P05-T05 | Verified (non-device scope) for previews and status; publication behind closed gate | Fresh newest-version status (unknown never approved), expiring signed previews, separate demographic/avatar/ID outcomes. |
| P05-T06 | Verified (non-device scope) except A41-010 | Bundled-Leaflet pin with boundary refusal, accessible nudge buttons, GPS adapter states, typed address, server-set verification time; registration home pin added. Address detection and tiles wait for PR-10 (P05-D03). |
| P05-T07 | Verified (non-device scope) for Phase 5 surfaces | Refresh after writes, fresh ID state, temporary-file deletion, owner-scoped staged references purged on logout; service-gate refresh lands with Phase 8. |
| P05-T08 | Skipped (OD-07) for live runs | 38 automated tests cover stale editor, replacement, ownership, lost-reply and conversion logic; two-device, signed-URL, file and permission runs need a live app. |

Verification run 2026-10-15 (iOS workspace): baseline typecheck 0 / lint 0 / tests 123/123; final typecheck 0 / lint 0 / tests 161/161 / `expo export --platform ios` 0; `expo config --type introspect` shows `NSCameraUsageDescription` only (no photo-library or microphone strings); `expo install --check` lists only the pre-existing patch drift; Android `tsc` shows three pre-existing `external-link.tsx` errors that are identical with the shared type change reverted; web `tsc` 0; `check:release` fails as at baseline.

Dependencies added to the iOS workspace: `expo-image-picker ~57.0.20` and `expo-image-manipulator ~57.0.21` (new; lockfile gains them and `expo-image-loader`), `react-native-webview 13.16.1` and dev dependency `leaflet 1.9.4` (already resolved for Android; no resolved version changed). Shared: one additive RPC type. No migration.

Decisions P05-D01…D08 are in the evidence record. Key ones: edits are one conditional direct update because the completion RPC rewrites `email` from Auth and fails without a configured locality (D01); address detection and map tiles remain behind `mapProviders` (D03); both ID sides are required and photos stay in memory until submit (D04); `householdEditing` and `privateIdUploads` stay closed (D06).

Gates:

| Gate | State | Needed to open |
|---|---|---|
| Phase 3 exit | Partially complete (stray history row, `delete-my-account` deploy, hosted invariant run) | Owner approval of production SQL/deploy actions, then re-marked Verified |
| `householdEditing` (G01, G03, G17, G19, G22) | Closed | Hosted mirror/guard/stale-edit invariants and device proof |
| `privateIdUploads` (G01, G04, G17, G19) | Closed | Hosted storage/version/signed-access invariants and device proof |
| `mapProviders` (G02, G07, G17, G21, G22) / PR-10 | Closed | Approved tile and geocoding processors with attribution and disclosure |
| PR-03, PR-18 | Skipped (OD-07) | No live app run; owner-attended steps in the record section 7 |

Phase 5 becomes Verified (non-device scope, OD-06/OD-07) when the Phase 3 exit passes, G03/G04 are approved so the two gates can open, and PR-10 is resolved or A41-010 is explicitly accepted as a corrective equivalent.

#### Phase 6 — Appearance preferences, introduction and interaction completion

**Objective:** Preserve resident personalization and introduction without sacrificing native accessibility or full option coverage.

**Entry:** Phase 1, Phase 2, Phase 4, Phase 5 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/design/accessibility engineer.

**Traceability:** A02, A43; shared A50; handoff D01/D02/D18; G22 appearance/interaction evidence. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P06-T01** Implement Welcome/value proposition/personalization/completion and intentional first-run/Help entry; account choice remains signed-out root and returning residents retain their intended task.
- [x] **P06-T02** Implement persisted Light/Dark/System behavior, presets and accent selection with handoff semantic tokens applied throughout navigation/components. Keep semantic danger/warning/success/info meanings distinct.
- [x] **P06-T03** Implement hue slider, saturation/brightness square, preview/select/checkmark/saved count, invalid/duplicate validation, maximum ten custom colors, selected-color removal/confirmation/cancel and accessible non-long-press equivalents.
- [x] **P06-T04** Implement all ten mobile font IDs/chip previews/selections using qualified iOS families/fallbacks; retain IDs, no invented bundled Inter or unlicensed downloads. Dynamic Type/semantic sizes remain usable for every face/weight.
- [x] **P06-T05** Implement guest-session preference behavior, current-account initial load, persistence error rollback/unsaved indication and relaunch/account-switch cleanup; no silent failure or cross-account accent/font reuse.
- [ ] **P06-T06** Complete shared selectors/accordions/search-clear/refresh/segmented control/modal/photo/feedback interactions from A50 as reused by features. Large-text layouts expose the entire option set rather than deleting chips. *(Partially complete 2026-10-15: font-aware type roles, radio groups with checkmarks, native sheets with dirty-swipe protection, discard/destructive confirmations and announced errors are in place; counter, progress/countdown, search-clear, segmented control, accordion, toast and photo viewer have no Phase 6 consumer and close in Phases 7, 9–12 and 18 per the hand-off table in the Phase 6 progress note — stays unchecked.)*
- [ ] **P06-T07** Verify contrast/default/custom themes, font fallback/weights, compact/large phones, VoiceOver/color-picker actions, keyboard, Reduce Motion/Transparency and dirty dismissal. *(Contrast, ten font IDs and the ten-color limit are automated; device and live items Skipped — OD-06/OD-07; stays unchecked.)*

**Required working deliverable:** Working full appearance/preferences, source introduction and accessible shared interaction system.

**Exit — not just code present:** Every A02/A43 option and applicable A50 control passes; all ten font choices and ten-color limit are evidenced. Feature-specific controls continue to close in their owner phases.

**Verification/evidence:** T02/T43/T50; F04/F07/F12; G22 variant evidence. Handoff §§5–9 and D18 are the main tokens/font/color/control contract.

**Progress and status — 2026-10-15 (Phase 6: Partially complete).** Evidence: [phase-06/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-06/README.md), record [P06_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-06/P06_2026-10-15_implementation-and-verification.md). Source: uncommitted on base `e860743`. No migration, shared-package change or new dependency; nothing was committed, deployed or applied remotely; no screen was run (OD-07). The Phase 3 exit and the Phase 4/5 open items are carried as blockers and do not gate this phase's code.

| Task | Status | Result / remaining work |
|---|---|---|
| P06-T01 | Verified (non-device scope, OD-06/OD-07) | Welcome, value proposition, personalization and completion routes with three-step progress, Skip, native back and Reduce-Motion-aware fade; entries from account choice (prominent until first seen), Help and Settings; the signed-out root is unchanged. |
| P06-T02 | Verified (non-device scope, OD-06/OD-07) | System/Light/Dark through `Appearance.setColorScheme`; accent-derived action tokens with ≥ 4.5:1 guarantees; fixed status colors; navigation theme from the same palette. |
| P06-T03 | Verified (non-device scope, OD-06/OD-07) | Hue slider, saturation/brightness square, sliders and hex field; preview, checkmark, saved count, invalid/duplicate/preset/limit messages, ten-color cap, confirmed removal, no long-press needed, dirty-discard protection. |
| P06-T04 | Verified (non-device scope, OD-06/OD-07) | All ten IDs as a full list with previews; qualified iOS families and explicit system fallbacks; no bundled or downloaded faces. |
| P06-T05 | Verified (non-device scope, OD-06/OD-07) | Optimistic ordered writes with visible rollback, session-only guest/no-profile state, per-account rebuild. |
| P06-T06 | Partially complete | See the task note; remaining controls close with their consumers. |
| P06-T07 | Partially complete | Contrast/fonts/limit/rollback automated; device and live checks Skipped (OD-06/OD-07). |

Verification run 2026-10-15 (iOS workspace): baseline typecheck 0 / lint 0 / tests 161/161; final typecheck 0 / lint 0 / tests 190/190 (29 new) / `expo export --platform ios` 0. Config, lockfile and shared package unchanged; Android and web not re-run (nothing they import changed).

Decisions P06-D01…D08 are in the evidence record. Key ones: the stored default accent renders with the handoff tokens (D01); System is offered although Android's UI lacks it (D02); removing the color in use returns to the default accent (D03); gradients use the typed `experimental_backgroundImage` style and degrade to a flat hue (D05); a preference write bumps `updated_at`, which the Phase 5 reconcile already tolerates (D06).

Phase 6 becomes Verified (non-device scope, OD-06/OD-07) when the remaining shared controls land with their consumers (or their owner phases accept them) and T07's device items are explicitly skipped or run.

Deferred shared controls (P06-T06) and the phase that builds each with its first consumer, so none is lost between phases:

| Control (A50 / T06) | Owner phase and task | Reason it is not built in Phase 6 |
|---|---|---|
| Search field with clear action, debounced, domain-specific hint (A50, A09-005/006, A52-001/002) | **Phase 7 / P07-T01** (first consumer); reused by Phases 11, 13, 14, 18 | No Phase 6 screen searches. The Phase 2 debounced/cancelling list reads already exist. **Built in Phase 7 (2026-10-15):** `SearchField` in `src/components/ui.tsx`. |
| Segmented control that becomes a menu/list at accessibility text sizes (A50-024) | Phase 11 / P11-T01 (four-view Reports hub) | First screen with 2–4 short peers. **Built in Phase 7 (2026-10-15):** `Segmented` in `src/components/ui.tsx` (stacks as full-width rows above 1.3× font scale); Services is its first consumer; Phase 11 reuses it. |
| Progress bar, countdown timer (A50-008/009) | Phase 9 / P09 (processing clocks), Phase 10 / P10 (QR attempt expiry) | Needs real timestamps and payment-attempt data. |
| Character counter, photo viewer, transient message/toast (A50-005/017) | Phase 12 / P12 (concern description limit, photos) | First consumer is the concern form and photo detail. |
| Accordion (A50, Terms/Privacy, Help) | Phase 18 / P18-T03 | First consumer is the information pages. |

Each owner phase adds the control to `src/components/ui.tsx` with its feature, using `useColors()` and `useType()` (never `typeScale` directly, so the font preference applies).

#### Phase 7 — Services catalogue, guidelines and charter detail

**Objective:** Build a fully usable service discovery/detail surface that drives the correct authoritative form.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 5, Phase 6 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/services engineer + catalogue owner.

**Entry status — 2026-10-15.** Phase 2 is Verified; Phases 3, 4, 5 and 6 are Partially complete, so the formal entry exits are **not** all met. As for Phases 4–6 they are carried as recorded blockers, and Phase 7 starts only on the owner's explicit go-ahead. What Phase 7 actually depends on: (a) the catalogue read contract B06 (`document_types`, active, non-deleted, tenant-scoped; schema-validated in `resident-api.ts`) — hosted state must be re-checked read-only at start, because the Phase 3 hosted invariant run is still open; (b) Phase 6 `useColors()`/`useType()` and the search field built in P07-T01; (c) G04 (required-ID gate) for P07-T04, which is closed, so approved-ID remediation is built and tested but its live gate stays closed. Nothing in Phase 7 needs a migration unless the read-only check finds contract drift. PR-03/PR-18 stay Skipped (OD-07): no screen can be run live, so Phase 7 is verified on the non-device standard.

**Traceability:** A09–A10; handoff D05; G17 catalogue scope; G04 required-ID gate. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P07-T01** Implement Services Documents/Requests/Logs navigation and functional scoped catalogue text search/filter with complete active/nondeleted tenant catalogue and explicit no-results/error/guest states. *(2026-10-15: Documents/Requests segments, search, states and guest boundary Verified (non-device scope); the Logs segment is built with its content in P09-T05 — stays unchecked.)* *(2026-10-15: the Logs segment landed with P09-T05 and is Verified (non-device scope); checked.)*
- [x] **P07-T02** Implement legacy and contract-version-2 business/indigency/first-time-job-seeker/certified-true-copy/general cards/details with server-authored fee/pricing/processing labels; do not hard-code mockup amounts or times.
- [x] **P07-T03** Render all eleven charter fields and configured purposes/requirements/appearance rules as readable content; show missing metadata as unspecified and preserve all legacy guidelines/requirements.
- [x] **P07-T04** Implement Apply/help/verification/profile/approved-ID remediation and safe route restoration; inactive/deleted/foreign service links do not open a misleading form.
- [x] **P07-T05** Wire realtime catalogue invalidation, refresh, stable pagination/caches and retained query/list position. Extract service labels/strings and preserve PHP/date formatting.
- [x] **P07-T06** Test each service kind/rule configuration, long/absent charter content, catalogue search/availability changes and guest/public versus private action boundaries.

**Required working deliverable:** Complete discoverable catalogue/detail/charter/guideline routes ready for real submissions.

**Exit — not just code present:** Assigned A09–A10 discovery/detail and design D05 contributions pass against current catalogue fixtures/configuration; no inert search or invented operational data. Apply/form and Requests/Logs contributions finish in Phases 8/9 before those whole A/T families are finally verified.

**Verification/evidence:** T09/T10; F01/F02/F04/F05/F12; catalogue owner/configuration evidence. D05, readable eleven-field hierarchy, proper price/target semantics and full search/option coverage.

**Progress and status — 2026-10-15 (Phase 7: Partially complete).** Evidence: [phase-07/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-07/README.md), record [P07_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-07/P07_2026-10-15_implementation-and-verification.md). Started on the owner's explicit go-ahead of 2026-10-15 (entry status above). Source: uncommitted on base `e860743`. No migration, shared-package change or new dependency; nothing was committed, deployed or applied remotely; no screen was run (OD-07). The Phase 3 exit and the Phase 4–6 open items are carried as blockers and do not gate this phase's code.

| Task | Status | Result / remaining work |
|---|---|---|
| P07-T01 | Verified (non-device scope, OD-06/OD-07) — Logs segment landed 2026-10-15 with P09-T05 | Documents and Requests segments (Requests only for a signed-in resident; not rendered for a guest), functional debounced server-side search over name and description with explicit clear, loading/empty/no-results/error/stale states, ID/profile readiness card (Verify now, Retry verification check). **Closed 2026-10-15:** the Logs segment — it has no data or view until P09-T05 builds truthful latest-activity Logs, and a segment without that content would be a stub. |
| P07-T02 | Verified (non-device scope, OD-06/OD-07) | Legacy and contract-version-2 cards/details for all five service kinds; fee label from `pricing_mode` and the stored `fee_centavos` (assessment, per-page, fixed, zero, unknown mode), processing label from `processing_target_minutes` or the shared hour buckets; no hard-coded amounts or times. |
| P07-T03 | Verified (non-device scope, OD-06/OD-07) | All eleven charter fields as titled sections in contract order, missing/blank fields as "Not specified by your barangay", configured purposes (with explanation-required marker), requirement rules, legacy requirements and the originals note. |
| P07-T04 | Verified (non-device scope, OD-06/OD-07) | One pure `applyState`: unavailable → guest → profile incomplete → ID not approved (missing/pending/failed/unconfirmed) → ready; sign-in and profile completion return to the same service (`/services` and `/services/<uuid>` added to the pending-destination allowlist); inactive, deleted, foreign or malformed links show "Service unavailable". The approved-ID gate (G04) stays closed, so the ID screen's upload remains gated. |
| P07-T05 | Verified (non-device scope, OD-06/OD-07) | List re-reads on realtime `document_types` signals, foreground and pull-to-refresh with stable id-tie-broken pagination; the detail re-reads on a signal for its own row; the search term lives above the list so it survives opening a detail and returning. Labels are centralized in `SERVICE_COPY`; amounts use `formatCentavosAsPHP`. |
| P07-T06 | Verified (non-device scope, OD-06/OD-07) | 17 new tests: row contract, every service kind/pricing mode/rule configuration, absent and malformed charter content, unsupported version, apply boundaries, route restoration. Component-level behavior (realtime wiring, scroll position) is not exercised: there is no renderer in this workspace and no screen can be run (OD-07). |

Verification run 2026-10-15 (iOS workspace): baseline typecheck 0 / lint 0 / tests 190/190; final typecheck 0 / lint 0 / tests 207/207 (17 new) / `expo export --platform ios` 0. Hosted contract re-checked read-only before editing (information schema, policies, aggregate counts only): `document_types` has every contract-version-2 column; 4 active catalogue rows, all version 2, none with a missing charter or purposes. Config, lockfile and shared package unchanged; Android and web not re-run (nothing they import changed).

Decisions P07-D01…D06 are in the evidence record. Key ones: the Segmented control and SearchField (hand-off table owners Phases 11 and 7) were built here because Services is their first consumer (D01); a version-2 row that fails the strict shared contract is shown but not requestable instead of failing the page (D02); an unknown contract version is unsupported, never treated as legacy (D03); additional notes are always expanded, not collapsible, so no rule is hidden (D04).

Phase 7 becomes Verified (non-device scope, OD-06/OD-07) when P07-T01's Logs segment lands with P09-T05; the Apply/form and Requests/Logs contributions to A09–A11 finish in Phases 8 and 9 as the exit already states. **Update 2026-10-15:** the Logs segment landed with P09-T05 (Phase 9), so this condition is met and Phase 7 is Verified (non-device scope, OD-06/OD-07); the Phase 3–6 open exits stay carried and live runs stay Skipped (OD-07).

#### Phase 8 — Document forms, supporting evidence, review and authoritative submission

**Objective:** Deliver every legacy/charter application path end-to-end with real uploaded evidence and a committed reference.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 5, Phase 7 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/services engineer + backend/verification.

**Traceability:** A11; handoff D06; G04/G17 submission; G19 protected draft/reconciliation. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P08-T01** Implement legacy and charter forms with approved ID submission/type/version and private front/back previews. Enforce fresh profile/verified approval and legacy-only evidence policy; pending/revoked/replaced approval cannot be reused silently.
- [x] **P08-T02** Implement stable purpose/explanation/notes and every conditional business/address/DTI, HOA/renter/lessor, certified-copy reference/copies and personal-appearance acknowledgment field with shared schema limits.
- [x] **P08-T03** Implement purpose/renter/service changes that clear incompatible fields/files; validate required rules before upload where possible. Supporting files permit JPEG/PNG/WebP/PDF up to 5 MiB each, ten maximum/unique paths; ID remains image-only.
- [x] **P08-T04** Implement owned immutable staged uploads, actual-byte/conversion validation, per-file progress/retry/remove/cancel/iCloud handling and private signed preview/orphan references using the shared submission/upload helpers.
- [x] **P08-T05** Implement protected account/tenant/environment/version-scoped drafts, resume/discard/edit review, exact entered/evidence/fee-condition/privacy summary and dirty-navigation handling.
- [x] **P08-T06** Use ResidentSubmissionAttempt/submit_service_request for both paths; bind UUID key/owner/exact payload, prevent duplicate activation and reconcile lost/uncertain reply before editing/retrying or generating a new key. No direct client insert alternate.
- [x] **P08-T07** Implement durable submitted receipt/reference/detail navigation and explicit validation/authorization/unknown-outcome recovery. Submitted is not paid, approved or released.
- [ ] **P08-T08** Test every service kind/requirement combination, approval race, PDF/image limits, interrupted/partial uploads, process termination, double submit and lost commit reply against the real backend. *(2026-10-15: unit-level matrix passed; real-backend, device and process-termination runs Skipped — OD-06/OD-07; stays unchecked.)*

**Required working deliverable:** All required application forms/uploads/review and committed submission references; no partial-port form path.

**Exit — not just code present:** Assigned A11 form/upload/review/submission and contract-version branches pass positive/negative/idempotency/device tests; receipt identifies the committed owned request. Required detail/payment continuation finishes in Phases 9–10 before the whole A11/T11 family is finally verified. This is resident iOS Phase 8, not the cancelled Android usability phase.

**Verification/evidence:** T11; F02–F07/F12; deployed submission/evidence linkage + signed file-device tests. D06 precise evidence/version/file states and persistent received/not-paid result.

**Progress and status — 2026-10-15 (Phase 8: Partially complete).** Evidence: [phase-08/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-08/README.md), record [P08_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-08/P08_2026-10-15_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 3–5 were Partially complete, so the formal entry exits were not all met; Phase 7 was Partially complete only for its Logs segment, which Phase 9 delivered the same day (Phase 7 is now Verified, non-device scope). As for Phases 4–7 the open exits are carried as blockers and the work was started on the owner's explicit request of 2026-10-15. No migration, dependency or configuration change; the only shared-package change is additive (`ResidentSubmissionAttempt` accepts an optional key). Nothing was committed, deployed or applied remotely; no screen was run (OD-07). No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found.

| Task | Status | Result / remaining work |
|---|---|---|
| P08-T01 | Verified (non-device scope, OD-06/OD-07) | One form for legacy and charter services behind the Phase 7 readiness gate (profile complete, approved ID); approved ID type/version and private front/back previews through signed URLs; refresh verification; `createRequest` (direct insert) removed. The optional legacy ID photo follows the closed G04 gate. |
| P08-T02 | Verified (non-device scope, OD-06/OD-07) | Purpose + conditional explanation (1,000, counter), notes, business name/address/DTI, HOA/renter/lessor, certified-copy reference/copies/total pages, personal-appearance acknowledgment; validation by the shared `submissionSchemaForCatalog`. |
| P08-T03 | Verified (non-device scope, OD-06/OD-07) | Purpose change clears the explanation; renter off removes the lessor file; unused slots are pruned before send; required rules validated before any upload; files via the Phase 2 picker/validator (JPG/PNG/WebP/PDF ≤ 5 MiB, bytes-sniffed). |
| P08-T04 | Verified (non-device scope, OD-06/OD-07) | Owned immutable paths, `upsert: false`, identical-bytes reconciliation, staged-before-upload/linked-after-commit references, per-file waiting/uploading/uploaded/failed states, retry sends only missing files. Server orphan sweep is migration `0124`'s. |
| P08-T05 | Verified (non-device scope, OD-06/OD-07) | Keychain-bound draft per tenant/account/environment/service/schema version, restored before the form shows, cleared on commit and logout purge; review step lists exactly what will be sent plus fee basis and privacy note; discard guard for unsaved files. File bytes are not persisted (P08-D02). |
| P08-T06 | Verified (non-device scope, OD-06/OD-07) | `ResidentSubmissionAttempt`/`submit_service_request` only; the unconfirmed payload and key are persisted before the call, so a restart retries the same operation; locked form after an uncertain reply; single-flight activation; fresh key only after `idempotency_conflict`. |
| P08-T07 | Verified (non-device scope, OD-06/OD-07) | `/request/received` reads the committed request back (reference, status, date) and says received, not paid/approved/released; links to the request, My requests, Services. Payment continuation is Phase 10 (gated). |
| P08-T08 | Partially complete | 26 new tests (all service kinds and rule combinations, renter cleanup, count/limit validation, interrupted/lost-reply uploads, key reuse, edited-payload refusal, resume with persisted key, definite vs unknown, other-account stale attempt, draft isolation). Real-backend, approval-race, device file/iCloud and process-termination runs Skipped (OD-06/OD-07). |

Verification run 2026-10-15 (iOS workspace): baseline typecheck 0 / lint 0 / tests 207/207; final typecheck 0 / lint 0 / tests 234/234 / `expo export --platform ios` 0; shared `resident-submission` tests 11/11; Android `tsc` shows three pre-existing TS2859 errors in `external-link.tsx` only. Hosted project re-checked read-only before and after the work (migrations through `0127`; `submit_service_request` has the legacy and charter branches; four active version-2 services, none legacy).

Route deviations from the Phase 0 route ledger (kept frozen as the baseline record): IR05 `/services/request/[documentId]/review` was built as a review step inside the form screen, so there is no separate review route; IR06 `/services/requests/[requestId]/receipt` was built as `/request/received?id=<requestId>`. Phase 9 adds `?segment=logs` beside IR10 `?segment=requests`. Appendix B.2 and the route ledger were not edited; a later re-baseline should record these names.

Decisions P08-D01…D09 are in the evidence record. Phase 8 stays Partially complete while P08-T08 is open; the detail/payment continuation of A11 finishes in Phases 9–10 as the exit states.

#### Phase 9 — Request lists, detailed tracking, processing clocks, logs and request cancellation

**Objective:** Make submitted requests trackable through their whole lifecycle, with truthful history and both timing models.

**Entry:** Phase 7, Phase 8 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/services engineer + SLA/operations owner.

**Traceability:** A12–A14 request portion; A18; handoff D07/D08; G17/G19 tracking; G06 fulfillment integration prepared. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P09-T01** Implement personal requests/counts/card metadata and every status/date/document filter with stable incremental pagination, query/position restoration, refresh and realtime reconciliation.
- [x] **P09-T02** Implement request detail/status history, purpose/supporting details/approved evidence, review messages, authoritative payment relationship and eligible next actions through all request states.
- [x] **P09-T03** Implement both legacy_hours and agency_minutes_v1 tracking using shared calculations and service_request_sla_tracking. Label snapshotted target, agency time, resident wait, turnaround, wait/pause reasons/history and all SLA states.
- [x] **P09-T04** Project current clocks only from server evaluation + monotonic foreground time; stop hidden timers, refetch on focus/resume/uncertainty and avoid current-catalogue target/fee substituting for historical snapshots.
- [x] **P09-T05** Implement Logs as truthful latest request activity, or an authoritative resident-safe event stream if full audit history is promised; never synthesize an imaginary history from current status.
- [x] **P09-T06** Implement eligible cancel_own_service_request confirmation, reason/failure/unknown-response reconciliation and concurrency with staff/payment state. Payment-attempt cancellation closes in Phase 10.
- [ ] **P09-T07** Exercise resident→staff accept/pause/resume/ready/release/cancel lifecycle using actual authorized existing staff workflows; do not add resident administrative controls. *(2026-10-15: the lifecycle is covered at unit level by the clock projection tests; the staff-to-resident run needs a live backend and is Skipped — OD-07; stays unchecked.)*
- [x] **P09-T08** Test multiple pages/statuses, historical amounts/targets, clock skew/background catch-up, pause/resume/history and denied/foreign/deleted request/cancellation races.

**Required working deliverable:** Complete requests/logs/detail/tracking/request-cancellation journeys through fulfillment states.

**Exit — not just code present:** Assigned A12/A13/A18 tracking/activity and request-cancellation A14 contributions pass; both timing models and staff-to-resident lifecycle effects have evidence. Financial cancellation/paid receipt remains Phase 10.

**Verification/evidence:** T12/T13/T14 request tests/T18; F01–F05/F09/F12; SLA/operation chronology proof. D07/D08 distinct request status, assessment and clocks with truthful activity/history.

**Progress and status — 2026-10-15 (Phase 9: Partially complete).** Evidence: [phase-09/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-09/README.md), record [P09_2026-10-15_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-09/P09_2026-10-15_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phase 7 was Partially complete only for its Logs segment, which this phase delivers (P09-T05), and Phase 8 is Partially complete (T08 live runs Skipped), so the formal entry exits were not all met; as for earlier phases their open exits are carried as blockers and the work was started on the owner's request of 2026-10-15. No migration, dependency, configuration or shared-package change. Nothing was committed, deployed or applied remotely; no screen was run (OD-07).

| Task | Status | Result / remaining work |
|---|---|---|
| P09-T01 | Verified (non-device scope, OD-06/OD-07) | Own requests with server-side All/Active/Pickup/History and the Active sub-filters (reset on group change), exact per-group counts from head queries, document name/reference/date/status cards, stable id-tied incremental pages, realtime re-reads. Android has no date or document filter (A12-008…018 list none), so none was added (P09-D01). |
| P09-T02 | Verified (non-device scope, OD-06/OD-07) | Detail from the request's own snapshots: status, payment method/status, fee line and basis, billable pages, purpose, explanation, submitted details, barangay review message, approved ID version and submitted file list, notes, four-stage history with times and staff notes, cancellation record. Payment actions stay Phase 10 (gated). |
| P09-T03 | Verified (non-device scope, OD-06/OD-07) | `agency_minutes_v1` from `service_request_sla_tracking` with the shared `calculateAgencySla`; `legacy_hours` with the shared progress/estimate and a "previous timing model" label. |
| P09-T04 | Verified (non-device scope, OD-06/OD-07) | Server evaluation instant + monotonic (`performance.now`) foreground elapsed time; refetch on focus, foreground, every 15 s and on a changed row; no timers while unfocused or backgrounded, and none once released or cancelled. |
| P09-T05 | Verified (non-device scope, OD-06/OD-07) | Logs segment: latest state of each own request by last update, labelled as a summary and not a full history. Closes P07-T01. |
| P09-T06 | Verified (non-device scope, OD-06/OD-07) | Eligible-only action, confirmation sheet with an optional reason (500), single-flight, lost-reply reconciliation with a status read, re-read after every outcome; hidden once delivery advanced or payment cleared; a pending QR attempt is cancelled first (Phase 10). |
| P09-T07 | Skipped (OD-07) | Resident→staff accept/pause/resume/ready/release/cancel needs a live backend and the admin app. |
| P09-T08 | Verified (non-device scope, OD-06/OD-07) | 24 new tests: filters and server restrictions, counts, history parsing, stages, cancellation eligibility, version-2 vs legacy amounts and historical snapshots, clock projection (acceptance, pauses open/closed, ready, release, pre-processing, negative elapsed). Hook and screen behavior (foreground catch-up, realtime) is not rendered: there is no renderer here. |

Verification run 2026-10-15 (iOS workspace): baseline (end of Phase 8) typecheck 0 / lint 0 / tests 234/234; final typecheck 0 / lint 0 / tests 258/258 / `expo export --platform ios` 0. Hosted project re-checked read-only: every selected column of `service_requests`, `payments`, `request_attachments`, `service_request_pauses` exists; `service_request_sla_tracking` is executable by authenticated and not anon; 5 agency-timed and 69 legacy-timed requests exist. `service_request_pauses` is **not** in the realtime publication, so the screen does not subscribe to it (P09-D05).

Decisions P09-D01…D07 are in the evidence record. Phase 9 stays Partially complete while P09-T07 is Skipped; fee assessment, payment cancellation and receipts finish in Phase 10 as the exit states.

#### Phase 10 — Fee assessment, pickup, QR PH settlement, payment cancellation and receipts

**Objective:** Complete the real financial/fulfillment journey—not merely payment placeholders or disabled source flags.

**Entry:** Phase 3, Phase 8, Phase 9 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** Payments/backend + iOS/services + barangay operations.

**Entry status — 2026-10-16.** Phase 3 is Partially complete, Phase 8 is Partially complete (T08 live runs Skipped) and Phase 9 is Partially complete (T07 Skipped), so the formal entry exits were **not** all met; they are carried as recorded blockers, as for Phases 4–9, and the work was started on the owner's explicit request of 2026-10-16. The assessment below was the pre-implementation plan; the result is in the progress note after the task list.

| Task | What can be built under OD-06/OD-07 | Limit |
|---|---|---|
| P10-T01 | Assessment/payment screen over the Phase 9 `feeLine`, `requestFee` and request snapshots | Phase 9 already shows the fee states on the request. |
| P10-T02 | Method selection, `set_service_request_payment_method`, `start_pickup_payment`, pickup instructions | `pickup` is to be opened by OD-09 once built and tested; PR-09 (staff collection evidence) stays an open fact. |
| P10-T03, T05 | QR PH creation/status/cancel client with countdown, reconciliation and focused polling | `qrph` is to be opened by OD-09 once built and tested; PR-08 (processor qualification evidence) stays an open fact. |
| P10-T04 | No iOS code; evidence task | Server functions are deployed (OD-09 item 4); webhook signature/replay/idempotency behavior and the operating owner are not evidenced by this plan. Records the owner approval and the gap. |
| P10-T06, T07 | QR image Photos save, committed paid receipt, PDF generation and native share | Dependencies approved by OD-09; declared in the iOS workspace on 2026-10-16. |
| P10-T08 | Not runnable | Needs a live backend, staff and processor (OD-07). |

**Owner decisions recorded 2026-10-16 (OD-09, §1):** `expo-media-library`, `expo-print` and `expo-sharing` are approved for the iOS workspace (declared 2026-10-16), and the `qrph` and `pickup` gates are to be opened once their flows are implemented and tested, on the owner's statement that both are fully functional in the resident Android app. That statement is not iOS or backend evidence: processor/settlement and staff-collection evidence (PR-08, PR-09) stay recorded as open facts, and P10-T04/T08 stay an evidence task and Skipped. Expected outcome under OD-06/OD-07: Partially complete, with G05/G06 recorded as an owner approval of non-device, non-live scope.


**Traceability:** A14 payment portion; A15–A17; handoff D08; G05/G06 operational completion. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P10-T01** Implement pending/assessed/waived/free/paid states, fee basis and authoritative historical centavos via shared requestFee; pending assessment has no payable amount, version 2 never falls back to today's catalogue fee.
- [x] **P10-T02** Implement method selection/set_service_request_payment_method/start_pickup_payment and pickup instructions/status, with authorized staff collection/reconciliation evidence; residents cannot assess or collect their own payments.
- [x] **P10-T03** Implement create-payment-source/check-payment-status QR PH states, returned IDs/amount/expiry/QR image, countdown, generation/retry/cancel and active-attempt/already-paid reconciliation. Send trusted IDs, not authoritative client fees.
- [ ] **P10-T04** Complete qualified processor/settlement configuration, server secret/signature/webhook/replay/idempotency/reservation/partial-provider/database behavior; preserve refund/collection privileges and operational support ownership. *(2026-10-16: no iOS code; owner approval recorded by OD-09; webhook/replay/settlement evidence and the operating owner are not evidenced; stays unchecked.)*
- [x] **P10-T05** Implement payment-attempt cancellation confirmation/reconciliation distinct from request cancellation. Poll/subscribe only appropriately focused/foregrounded, protect against late cancelled polls and refresh on return.
- [x] **P10-T06** Implement QR image Photos save with correct permission/size/lifetime/error states and committed paid receipt fields/reference/amount/date/method. Route parameters are lookup hints, not payment proof.
- [x] **P10-T07** Implement authoritative PDF receipt generation/native share, iOS local-image data, actual signed file/cancel/temp cleanup and paid-reopen behavior without duplicate payment/receipt claims.
- [ ] **P10-T08** Run full resident/staff/processor end-to-end assessment→pickup or QR→settled/released journeys, concurrent attempts, lost reply, expiry, cancellation/settlement race, duplicate webhook and paid reopen against the qualified environment. *(2026-10-16: unit-level fault matrix passed; the live resident/staff/processor run is Skipped — OD-07; stays unchecked.)*

**Required working deliverable:** Operating pickup and QR PH with authoritative paid receipts/QR save/PDF share and fault recovery.

**Exit — not just code present:** A14 financial/A15–A17 pass and G05/G06 approvals exist. An unavailable settlement credential may block this phase, but a permanently disabled payment gate cannot satisfy full conversion.

**Verification/evidence:** T14–T17; F02/F03/F06/F07/F09/F12; processor receipts/webhooks/staff reconciliation + device exports. D08 honest assessed/free/waived/pending labels, payment attempt vs service processing and durable receipt.

**Progress and status — 2026-10-16 (Phase 10: Partially complete).** Evidence: [phase-10/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-10/README.md), record [P10_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-10/P10_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 3, 8 and 9 were Partially complete, so the formal entry exits were not all met; their open exits are carried as blockers and the work was started on the owner's request of 2026-10-16. Dependencies: `expo-media-library`, `expo-print`, `expo-sharing` declared in the iOS workspace (OD-09; already resolved in the lockfile, no resolved version changed). No migration, Edge Function, shared-package or Android/web change. Nothing was committed, deployed or applied remotely; no screen was run and no real payment was made (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found. The fee model in force is migrations `0125`/`0126` (automatic fees: `legacy`, `assessed`, `waived`, `pickup_due`, `page_count_required`; resident `set_service_request_pages`), which the "assessment" wording of this phase maps to; residents still never assess or collect.

| Task | Status | Result / remaining work |
|---|---|---|
| P10-T01 | Verified (non-device scope, OD-06/OD-07) | `assess()` over the request's own fields and ledger: paid, waived, free, assessed, pickup-due (tax code), page-count-required and pending; pending has no peso value and no payable amount; version 2 never uses today's catalogue fee; legacy keeps its snapshot; basis and billable pages shown. |
| P10-T02 | Verified (non-device scope, OD-06/OD-07) | Payment/pickup screens: `set_service_request_payment_method` then `start_pickup_payment` as one single-flight action (nothing is recorded by opening the screen), page count through `set_service_request_pages`, pickup instructions and recorded state, lost replies reconciled by reads. Staff collection evidence (PR-09) stays an open fact. |
| P10-T03 | Verified (non-device scope, OD-06/OD-07) | `create-payment-source` / `check-payment-status` client with identifier-only requests, strict parsing, QR image validation (data URI, bare base64, https), server-expiry countdown, resume of the open QR, already-paid reconciliation, check-failure pause, expiry grace, lost creation reply reconciled from the stored attempt. |
| P10-T04 | Partially complete | No iOS code. Owner approval of G05/G06 recorded (OD-09); webhook signature/replay/idempotency, reservation concurrency, partial-provider behavior, settlement and the operating owner are not evidenced by this plan. |
| P10-T05 | Verified (non-device scope, OD-06/OD-07) | `cancel-payment` separate from request cancellation, with confirmation, a settlement race reported as paid, a lost reply reconciled and an unreadable result reported as unconfirmed; polling and realtime only while focused and foregrounded; late polls dropped by epoch. Offered from the QR screen and the request detail. |
| P10-T06 | Verified (non-device scope, OD-06/OD-07) | Add-only Photos save of the QR image (permission on action, denial/blocked/failed copy, signature and size check, temporary file removed); receipt read from the committed paid payment with its request reference. |
| P10-T07 | Verified (non-device scope, OD-06/OD-07) | PDF receipt (`expo-print`, text only) and share sheet (`expo-sharing`), neutral closed-sheet result, unavailable and failure copy, both files removed; reopened paid requests link to the receipt; route parameters are only a lookup hint. |
| P10-T08 | Skipped (OD-07) | Live resident/staff/processor journeys, concurrent attempts, duplicate webhook and paid reopen against a qualified environment. |

Gates: `qrph` and `pickup` are `true` in `release-gates.ts` by OD-09, for the non-device, non-live scope only. G05/G06 are **not** claimed as passed by evidence; G01, G17, G19 and G20 are unmet and `check:release` still fails on every other closed gate and on missing release configuration. Residents see QR and pickup actions that no iOS run has exercised against a processor.

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 258/258; final typecheck 0 / lint 0 / tests 321/321 (62 payments, 1 gate) / `expo export --platform ios` 0 (1665 modules); `expo config --type introspect` shows `NSPhotoLibraryAddUsageDescription` only. Hosted project re-checked read-only (`payments` columns, four payment RPCs, resident read policy exist). Android and web were not touched.

Decisions P10-D01…D12 are in the evidence record. Phase 10 stays Partially complete while P10-T04 is open and P10-T08 is Skipped; the exit's G05/G06 conditions are recorded as the owner approval and the list above.

#### Phase 11 — Reports hub, announcements, read states and counters

**Objective:** Preserve all four Reports views and content-read semantics before adding concern mutations and global inbox.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 6 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/reports engineer + content/moderation.

**Entry status — 2026-10-16 (pre-implementation assessment; the result is in the progress note after the task list).** Phase 2 is Verified (non-device scope); Phase 3 is Partially complete (hosted function deploy, stray history row and hosted invariant run open); Phase 4 is Partially complete (Phase 3 exit and PR-06 open); Phase 6 is Partially complete (T06 partial, T07 device/live items Skipped). The formal entry exits are therefore **not** all met; they are carried as recorded blockers, as for Phases 4–10, and the work was started on the owner's request of 2026-10-16.

| Aspect | Assessment |
|---|---|
| Scope | The four Reports views, announcement detail, individual and bulk read/unread, and the three independent counters (T01–T07). Concern creation, incident detail, corroboration and withdrawal are Phase 12; incident detail stays visibly pending (P11-T03). |
| Existing iOS baseline to qualify, not rebuild | Announcement list/detail routes, the `reportCounts` read and counts provider, typed `reports/incidents/[incidentId]` placeholder, `markAnnouncementRead` upsert. Phase 11 completes filters, state restoration, read/unread undo, bulk reads and the labeled counters. |
| Dependencies | None expected: realtime, pagination, count and mutation primitives from Phase 2 and the Phase 9–10 patterns cover it. Any new package needs the owner's approval first. |
| Gates | `publicIncidents` (G01, G12, G17, G21) **stays closed** in Phase 11: only announcements and the resident's own reports are shown, so no public incident projection is opened. PR-13 (public concern visibility and moderation policy/staffing) stays an open fact and does not block this phase; it gates `publicIncidents` and Phase 12–13 behavior. |
| Contracts to confirm read-only before coding | `announcements`, `announcement_reads`, `incidents.resolved_read_at` columns and RLS (B12), and the resident-owned incident projection (B11). |
| Expected standard | Typecheck, lint, new tests (read/undo/mark-all bounds, more than one page, late account replies, guest/logout reset, independent counts), `expo export --platform ios` and a read-only hosted contract check, as for Phases 8–10. Expected outcome under OD-06/OD-07: Verified (non-device scope) or Partially complete, with live runs Skipped. |
| Not authorized | Commits, pushes, deployments, remote migrations and secret handling. |

**Traceability:** A32, A35–A36; handoff D15/D04/D19 count contracts; G17/G19 Reports/read parity; G12 content policy. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P11-T01** Implement Announcements/My reports/Active/Resolved views and every source status/category/date/search filter, URL/segment/list-position restoration and guest visibility/action boundaries. *(2026-10-16: Verified non-device; Android lists no date or search filter, so none was added — P11-D01.)*
- [x] **P11-T02** Implement announcement cards/content/images/official metadata and dedicated announcement detail/modal; preserve source individual/bulk read/unread and refresh controls without incident-route ambiguity. *(2026-10-16: Verified non-device; detail is the typed announcement route, not a modal — P11-D04.)*
- [x] **P11-T03** Implement own/active/resolved incident list cards and typed detail links using resident-safe projections; unfinished detail/mutation functionality remains visibly pending until Phase 12, not a fake working action. *(2026-10-16: Verified non-device; incident detail and the create action stay pending until Phase 12 — P11-D11.)*
- [x] **P11-T04** Implement active-report, unread-resolved and unread-announcement counts independently; the native Reports badge aggregates only unread resolved + unread announcements. Expose labeled counters and a reusable Home summary contract. *(2026-10-16: Verified non-device; Home wiring is Phase 18.)*
- [x] **P11-T05** Implement snapshot-bounded bulk reads across pages, authorized ownership/tenant state, optimistic rollback and concurrent new-arrival rules. Inbox read state will remain independent in Phase 17. *(2026-10-16: Verified non-device.)*
- [x] **P11-T06** Wire stable pagination/realtime invalidation, deduplication, filters, changed/deleted rows and explicit loading/filtered-empty/offline/error states; preserve announcement modal/image/focus and safe missing-link handling. *(2026-10-16: Verified non-device; rendered states Skipped — OD-07.)*
- [x] **P11-T07** Test read/undo/mark-all bounds, more-than-one-page data, late account replies, guest/logout reset, More links and native badge accessibility. *(2026-10-16: logic, adapter and rollback tests passed; the More-overflow link and badge accessibility on a device are Skipped — OD-06/OD-07.)*

**Required working deliverable:** Working four-view Reports/announcement/read-state/count system with reusable Home/inbox-safe contracts.

**Exit — not just code present:** Assigned A32 list/view, A35–A36 controls and typed announcement routes pass; A32 incident-detail contributions and A33–A34 cannot be counted before Phase 12.

**Verification/evidence:** T32/T35/T36; F01/F02/F03/F05/F07/F11/F12; exact independent counts and rollback proof. D15 labeled views/counts, announcement modal/detail, content reads distinct from later inbox.

**Progress and status — 2026-10-16 (Phase 11: Verified, non-device scope, OD-06/OD-07).** Evidence: [phase-11/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-11/README.md), record [P11_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-11/P11_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 3, 4 and 6 were Partially complete, so the formal entry exits were not all met; their open exits are carried as blockers and the work was started on the owner's request of 2026-10-16. No migration, dependency, configuration, Edge Function, shared-package or Android/web change. Nothing was committed, deployed or applied remotely; no screen was run (OD-06, OD-07). `publicIncidents` stays closed: only announcements and the resident's own reports are read. No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found. **Second implementation pass (2026-10-16):** the first pass's new files were found missing from the working tree (typecheck failed, 4 × TS2307) and were rebuilt against the surviving data-layer changes; the figures in this section are from the rebuilt tree. Plan discrepancies recorded: A35 asks for "category/date/search filters" but the Android source has category chips only (P11-D01); A35 asks for a detail "modal/detail" and the typed route was chosen (P11-D04); the incidents SELECT policy is barangay-wide, so own-report lists depend on the client `reporter_id` filter until a resident-safe projection exists (`publicIncidents` stays closed).

| Task | Status | Result / remaining work |
|---|---|---|
| P11-T01 | Verified (non-device scope, OD-06/OD-07) | Four views (Incidents, Active, Resolved, Announcements) selected by the `segment` route parameter (Android `tab` and `incident-reports` accepted) and written back; status filters (All/Submitted/In Progress/Resolved/Withdrawn/Unresolved) and category filters (All/General/Emergency/Health/Events) applied server-side and reset on view change; guests reach announcements only and see a sign-in explanation for the incident views. No date or search filter exists in the Android source, so none was added (P11-D01). |
| P11-T02 | Verified (non-device scope, OD-06/OD-07) | Announcement cards (category icon/label, relative and absolute time, preview, unread state, one read/unread toggle), typed detail route with image (https only), individual and bulk read/unread, pull-to-refresh. |
| P11-T03 | Verified (non-device scope, OD-06/OD-07) | Own/active/resolved report cards (title, category, status, date, validated photo thumbnail, resolved unread state) linking to the typed incident route; incident detail and "Report an issue" remain visibly pending until Phase 12. |
| P11-T04 | Verified (non-device scope, OD-06/OD-07) | Active, unread resolved and unread announcements are separate exact server counts; the system badge is unread resolved + unread announcements only (99+ cap); labeled counters in the hub; `report-signals.ts` is the reusable Home summary/bell contract. |
| P11-T05 | Verified (non-device scope, OD-06/OD-07) | Bulk marking acts on a snapshot of ids taken at tap time, in chunks of 100, stopping at the first failure and reporting `n of m`; later arrivals stay unread; resolved bulk skips rows that changed; optimistic marks roll back on a failed or unconfirmed write; a zero-row resolved update is a failure. |
| P11-T06 | Verified (non-device scope, OD-06/OD-07) | Stable id-tied pages, realtime on own incidents, tenant announcements and own reads, foreground/focus reload, stale/error/empty/no-result states; malformed or deleted announcement links show an unavailable state. |
| P11-T07 | Verified (non-device scope, OD-06/OD-07) | 33 new tests (`tests/reports.test.ts`): view/filter resolution and server restrictions, independent counts and badge, read/unread/mark-all bounds over more than one page, partial failure, rollback, single-flight, disposal after account change, guest and unauthenticated writes, media-location validation. More-overflow links and native badge accessibility on a device are Skipped. |

Verification run 2026-10-16 (iOS workspace, second implementation pass): the working tree was first found with the Phase 11 files missing (`data/report-filters.ts`, `data/report-signals.ts`, `features/reports/*`, `tests/reports*.test.ts` and the evidence record were absent although tracked files imported them), so baseline typecheck failed with 4 TS2307 errors, lint 0, tests 321/321. After rebuilding: typecheck 0 / lint 0 / tests 354/354 (33 in `tests/reports.test.ts`) / `expo export --platform ios` 0. The first pass's test counts (41 new, 362 total) were not reproducible and are superseded by these. Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only on 2026-10-16: every selected `announcements`/`announcement_reads`/`incidents` column, the `announcement_reads` foreign keys to `announcements` and `profiles`, the own-row `announcement_reads` policy, the `residents mark own resolved incident read` update policy, the realtime publication of all three tables and the public `incident-photos` bucket exist. The announcement read-state embed was not executed on the hosted API (no resident session; OD-07).

Decisions P11-D01…D14 are in the evidence record. Out-of-scope observation: the 0085 resident update policy checks rows only (`with check (reporter_id = auth.uid())`), so a resident calling the API directly can change any column of their own resolved report; closing it needs a migration (`0129` or later) and is not part of this phase.

#### Phase 12 — Concern forms, photos, location, detail, corroboration and withdrawal

**Objective:** Complete every resident concern workflow and community confirmation with real server outcomes.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 6, Phase 11 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/reports engineer + backend/moderation.

**Traceability:** A33–A34; completion of A32 concern detail links; handoff D15/D11 location-picker equivalent; G12/G17/G19; approved picker tile/geocoding prerequisites. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P12-T01** Implement all current categories/title/description limits, category-specific waste zone, address/specific-area text and coordinate/location picker/manual/GPS alternatives using shared schemas. *(2026-10-16: Verified non-device; no silent default location — P12-D04)*
- [ ] **P12-T02** Qualify the allowlisted tile/geocoding/map bridge for this picker and its foreground-location adapter independently of the later evacuation routing feature. Preserve typed/manual fallback, boundary/finite-coordinate validation and processor privacy/attribution. *(2026-10-16: partial — picker, bundled Leaflet bridge, boundary checks and foreground location verified; tile/geocoding processors stay closed behind `mapProviders` (PR-10))*
- [x] **P12-T03** Implement up to five concern photos, JPEG/PNG/WebP/final HEIC conversion, 10 MiB actual-byte limit per image and source remove/view/selection controls; protect upload linkage and collect partial-upload orphans. *(2026-10-16: Verified non-device; real upload and device photo cases Skipped)*
- [x] **P12-T04** Implement protected concern draft/review/visibility/privacy/non-emergency warning, submit progress/reconciliation and durable received detail. Prevent duplicate creation on double tap/ambiguous response with an authoritative compatible attempt contract. *(2026-10-16: Verified non-device; client-chosen incident id is the idempotency key, no migration — P12-D01)*
- [ ] **P12-T05** Implement full typed incident detail with description/address/specific area/photos/status and resident-safe reporter information, confirmation count/viewer state and server-authoritative corroboration/deduplication. *(2026-10-16: partial — own-report detail verified; other residents' reports behind the closed `publicIncidents` gate — P12-D02)*
- [ ] **P12-T06** Implement eligible withdrawal/confirmation/cancel/reason/error/unknown-outcome handling and unavailable/foreign/deleted report recovery; do not invent staff status/history/permissions. *(2026-10-16: partial — withdrawal verified; confirmation implemented behind the closed gate)*
- [ ] **P12-T07** Implement approved public visibility and applicable content report/filter/block/operator escalation controls under G12 without replacing source report/corroboration functionality. Staff/moderation ownership must be operational. *(2026-10-16: Blocked — no content report/block contract and no approved policy or moderation owner (PR-13))*
- [ ] **P12-T08** Run category/zone/location/photo combinations, partial uploads, confirmation/withdrawal races, account/tenant/role failures, photo viewer/modals and report lifecycle updates returning to all four views. *(2026-10-16: partial — automated combinations and races pass; live and device runs Skipped)*

**Required working deliverable:** Full resident concern creation/detail/photos/location/corroboration/withdrawal and moderated visibility.

**Exit — not just code present:** All A33–A34 and linked A32 detail actions pass against deployed contracts, with G12 operating proof and no false submit/confirmation/withdrawal.

**Verification/evidence:** T32–T34; F01–F08/F12; upload/create/confirm/withdraw post-state and moderation records. D15 complete source fields/photo/modal interactions, privacy/visibility and non-emergency guidance.

**Progress and status — 2026-10-16 (Phase 12: Partially complete, non-device scope, OD-06/OD-07).** Evidence: [phase-12/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-12/README.md), record [P12_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-12/P12_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 3, 4 and 6 were Partially complete, so the formal entry exits were not all met; their open exits are carried as blockers and the work was started on the owner's request of 2026-10-16. No migration, dependency, configuration, Edge Function, shared-package, Android/web change or gate change; nothing was committed, deployed or applied remotely; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found.

| Task | Status | Result / remaining work |
|---|---|---|
| P12-T01 | Verified (non-device scope, OD-06/OD-07) | Report form at `reports/new`: category from the barangay's categories, collection zone for trash-related categories (tap again to clear), title 3–100, description 1,000, address 300, specific area 300 with counters, validation through the shared `incidentReportSchema`, pin inside the boundary by map tap/drag, accessible nudge buttons or the device location (permission on action), completed-profile check. No silent default pin (P12-D04). |
| P12-T02 | Partially complete | The Phase 5 picker is reused: bundled Leaflet with a CSP that blocks all network, validated bridge messages, boundary and finite-coordinate checks, foreground-only location controller. Tiles and automatic address detection stay closed behind `mapProviders` (PR-10), so the address is typed. |
| P12-T03 | Verified (non-device scope, OD-06/OD-07) | Up to five photos from the library (multi-select) or camera, HEIC/oversize re-encoded to a permitted type, 10 MiB final-byte limit, metadata removed, thumbnails with view and remove, per-photo failures reported without dropping the rest, uploads to immutable owned paths with staged references and cleanup. |
| P12-T04 | Verified (non-device scope, OD-06/OD-07) | Emergency and visibility notices before sending; protected draft of the answers, pin and any unconfirmed attempt; upload progress; the concern id chosen by the app is the idempotency key (P12-D01); lost replies reconciled with the resident's own row; locked resend/check/discard for an unknown outcome; the received detail is the durable result. |
| P12-T05 | Partially complete | Typed detail (own reports): photos with paging, dots and full-screen viewer, title, status, category, description, dates, address/coordinates/specific area, read-only map with recenter, status trail without invented times, confirmation count, realtime refresh, unavailable/malformed-link state. Another resident's report is read only when `publicIncidents` opens (G12). |
| P12-T06 | Partially complete | Withdrawal with confirmation, explained unavailability (status, 24-hour window), reconciliation and refusal copy. Confirmation of another resident's report (own/duplicate/terminal rules, count update, already-confirmed state) is implemented and tested but unreachable while `publicIncidents` is closed. |
| P12-T07 | Blocked | No content report/filter/block contract exists in the schema or shared package and PR-13 (approved visibility, escalation, retention, moderation owner) is not supplied; nothing was built that only looks like a control. |
| P12-T08 | Partially complete | 43 automated tests cover the category/zone/location/photo combinations, partial upload, definite and lost-reply outcomes, confirmation/withdrawal single flight and failures, account scoping and draft isolation. Live, two-device and device runs are Skipped. |

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 354/354; final typecheck 0 / lint 0 / tests 397/397 (43 new in `tests/concerns.test.ts`) / `expo export --platform ios` 0. Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only: the incident, category, zone and confirmation columns, `confirm_incident`/`withdraw_incident` (authenticated only, 0121 checks), the write-guard and completed-profile triggers, resident policies, realtime publication and the `incident-photos` bucket limits exist. The insert, RPCs and uploads were not executed against the hosted API (no resident session; OD-07).

Decisions P12-D01…D11 are in the evidence record. Plan discrepancies: A33-021 asks for an initial location from boundary information and the iOS form deliberately starts without a pin (P12-D04); A34-016 "recorded resolution information" has no source column, so only the resolved status is shown (P12-D08); P12-T04 asks for an "authoritative compatible attempt contract" and the existing insert accepts a client-chosen id, so no migration was needed. Out-of-scope observations (not fixed): the 0025 policy still lets a resident soft-delete their own open report through the API for 24 hours (the app uses `withdraw_incident` only); the resolved-report update policy is row-scoped only (recorded in Phase 11); `incident-photos` is a public bucket by design. **Owner decision OD-11 (2026-10-16)** approved sending the starting point to the first-party route service and kept the offline routing pack out of scope; nothing is awaiting the owner except the live and device runs that OD-06/OD-07 skip.

#### Phase 13 — Maps discovery and emergency guidelines, hotlines and alerts

**Objective:** Build the real Maps and emergency information surfaces, preserving all current browse/filter/content behavior.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 6, Phase 11, Phase 12 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/maps/emergency engineer + DRRM/content/privacy.

**Entry status — 2026-10-16 (pre-implementation assessment; the result is in the progress note after the task list).** Phases 2 and 11 are Verified (non-device scope). Phases 3, 4 and 6 are Partially complete (hosted function deploy, stray history row and hosted invariant run; PR-06; Phase 6 T06 partial). Phase 12 is Partially complete (T07 blocked on PR-13; T02/T05/T06/T08 partial). The formal entry exits are therefore **not** all met; as for Phases 4–12 they are carried as recorded blockers, and the work was started on the owner's request of 2026-10-16.

| Aspect | Assessment |
|---|---|
| Scope | Maps discovery (incident/center layers, boundary, search, category chips, list equivalent), Emergency Hub sections and aliases, guidelines/hotlines content with cache and fallback, emergency-category alerts with period/custom filters (T01–T08). Center details, device location and routing are Phase 14; QR/check-in is Phase 15. |
| Existing iOS baseline to qualify, not rebuild | `emergency.tsx` and `(tabs)/maps` are gate-closed placeholders; the Phase 5/12 pin picker (bundled Leaflet, CSP without network, validated bridge, boundary checks), `public-cache.ts`/`use-public-resource.ts` (tenant/version/fetched-time cache), `emergencyInformation` and `centers` reads, and the Phase 11 announcement filter and read-state primitives. |
| Dependencies | None expected: no new package is needed for discovery (`react-native-webview` and Leaflet were approved by OD-08). Any new package needs the owner's approval first. |
| Gates | `mapProviders` (G07, PR-10: tile, geocoding and routing processors, attribution and transfer disclosure) stays closed, so the map shows the bundled boundary and markers without tiles. `emergencyContent` (G07, PR-12: named DRRM owner, review date, escalation contacts) was assessed as staying closed, with content from the tenant tables and a bundled seed fallback with visible stale/offline labels and no invented emergency number; the owner then waived PR-12 and opened it (OD-10, 2026-10-16), and the content source and labels are unchanged. `publicIncidents` (G01, G12, PR-13) stays closed, so the incident layer shows only the resident's own reports until the policy is supplied. |
| Contracts to confirm read-only before coding | `emergency_information`, `emergency_qr_content`, `evacuation_centers` (B13); announcements with category `emergency` (B12); `incidents` projections and `incident_categories` (B11); `site_content` hotline fallbacks (B21). |
| Expected standard | Typecheck, lint, new tests (layer/chip/search/hub combinations, filter boundaries at local midnight/month/year, cache freshness and fallback, invalid hotline numbers, guest limits), `expo export --platform ios` and a read-only hosted contract check, as for Phases 8–12. Expected outcome under OD-06/OD-07: Partially complete (G07 and G12 content/processor portions open), with live runs Skipped. |
| Not authorized | Commits, pushes, deployments, remote migrations, secret handling, processor configuration, and publishing emergency content or hotline numbers. |

**Traceability:** A19 discovery; A20–A22, A28; handoff D09/D10/D15; G07 content/map processor portions; G12 incident visibility. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P13-T01** Implement incident/center layers, tenant boundary/markers, working scoped search/category chips, selected marker/list equivalence and accessible DRRM panel foundation; an extra filter button must work or be omitted while real filtering remains. *(2026-10-16: Verified non-device; the filter button is omitted, real filtering stays — P13-D05; the layer shows the resident's own reports until `publicIncidents` opens — P13-D04)*
- [x] **P13-T02** Implement all Emergency Hub sections/entry/return paths: Guidelines, Hotlines, Centers, Family, QR and Alerts. Link to working owned feature routes; never count unopened QR/health/route placeholders as ready. *(2026-10-16: Verified non-device; Family and QR say they are not available yet and are not counted ready — P13-D03)*
- [x] **P13-T03** Implement expandable configured guidelines/QR content and validated multi-number hotline/dialer actions, with approved seed fallback, tenant/version/fetched-time cache and obvious stale/offline operational facts. *(2026-10-16: Verified non-device; the bundled fallback is Android's, accepted by OD-10; QR guidance content is the Phase 15 QR guide, A25)*
- [x] **P13-T04** Implement emergency-category announcements, all/today/week/month/year and custom name/day/year filters/count/detail/read semantics, pagination and local-date boundary handling. *(2026-10-16: Verified non-device; month/day without a year are matched on the device from a bounded snapshot — P13-D06)*
- [x] **P13-T05** Replace standalone placeholder hotline/guide/obsolete duplicate links with deliberate working hub-section aliases; preserve their actual outcomes rather than copying dead screens. *(2026-10-16: Verified non-device)*
- [ ] **P13-T06** Qualify pinned Leaflet/WebView resources/bridge/navigation restrictions, tile/geocoding transfers/attribution/privacy and approved public incident projections. Do not adopt alpha Maps APIs or unrestricted remote scripts by default. *(2026-10-16: partial — bundled Leaflet, no-network policy, bridge validation and navigation restrictions verified; tile/geocoding processors (PR-10) and public incident projection (PR-13) not supplied)*
- [x] **P13-T07** Publish approved hotline/guideline/alert content with named DRRM owner/review date and verified escalation contacts; no invented emergency number, guaranteed app monitoring or real-time safety promise. *(2026-10-16: Verified non-device; named owner, review date and escalation contacts waived by OD-10, content mirrors Android; no invented number or monitoring promise)*
- [ ] **P13-T08** Test every layer/chip/search/hub/filter combination, offline/fallback/removed content, invalid contacts, processor outage, accessible map/list and guest restrictions. Full center/location/routing closes in Phase 14. *(2026-10-16: partial — automated and browser-page runs pass; live, device, VoiceOver and processor-outage runs Skipped)*

**Required working deliverable:** Working Maps discovery and complete emergency guidelines/hotlines/alerts/hub navigation.

**Exit — not just code present:** Assigned A19 discovery and A20–A22/A28 content/navigation contributions pass; G07 processor/content portions are evidenced. Center details/route and QR/check-in must still close Phases 14/15 before full emergency parity.

**Verification/evidence:** T19 discovery/T20–T22/T28; F01/F02/F05/F07/F08/F12; content/processor approval and device map/list proof. D09/D10 full filters and accessible hub/list/freshness/permission states.

**Progress and status — 2026-10-16 (Phase 13: Partially complete, non-device scope, OD-06/OD-07/OD-10).** Evidence: [phase-13/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-13/README.md), record [P13_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-13/P13_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 3, 4, 6 and 12 were Partially complete, so the formal entry exits were not all met; their open exits are carried as blockers and the work was started on the owner's request of 2026-10-16. No migration, dependency, configuration, Edge Function, shared-package or Android/web change; `emergencyContent` was opened after the owner's OD-10 waiver (the only gate change); nothing was committed, deployed or applied remotely; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found.

| Task | Status | Result / remaining work |
|---|---|---|
| P13-T01 | Verified (non-device scope, OD-06/OD-07) | Maps tab: Incidents/Evacuation layers, boundary and markers coloured by category, scoped search, multi-select category chips (second tap clears), selected place with a matching list, resident marker, locate/recenter/barangay view, the shared six-action location card, collapsible and draggable DRRM panel (tap is the accessible action). Own reports only until `publicIncidents` opens; no tiles until `mapProviders` opens. |
| P13-T02 | Verified (non-device scope, OD-06/OD-07) | Emergency hub: Guidelines, Hotlines, Centers, Family, QR, Alerts selected by the `section` route parameter (Android `tab` values accepted), written back so returns agree. Family and QR require an account and are labelled not available until Phases 14–15. |
| P13-T03 | Verified (non-device scope, OD-06/OD-07/OD-10) | Expandable guidelines, validated per-number hotline calls through the iOS dialer (no auto-dial), tenant/version/fetched-time cache with fresh/stale/expired labels, and the labelled bundled fallback, which is Android's own and accepted by OD-10. QR guidance content is the Phase 15 QR guide (A25). |
| P13-T04 | Verified (non-device scope, OD-06/OD-07) | Emergency alerts with All/Today/Last Week/Month/Year, custom month/day/year, exact "Showing X of Y", pagination, per-alert read state and the typed announcement route; local-calendar edges tested. |
| P13-T05 | Verified (non-device scope, OD-06/OD-07) | `maps/hotline-directory` and `maps/preparedness-guide` redirect to the hub's Hotlines and Guidelines sections. |
| P13-T06 | Partially complete | Pinned Leaflet page extended with markers, resident location and fit; no-network CSP, validated bridge, locked navigation and escaped inputs verified, and the page script was run in a browser. Tile/geocoding processors and attribution (PR-10) and an approved public incident projection (PR-13) are not supplied. |
| P13-T07 | Verified (non-device scope, OD-06/OD-07/OD-10) | The named DRRM owner, review date and escalation contacts are waived by OD-10; the screens mirror the Android content, invent no number and promise no monitoring. The hosted content looks like sample data; editing or publishing it is not part of this phase. |
| P13-T08 | Partially complete | 49 new automated tests plus the browser run; live, device, VoiceOver, Dynamic Type and processor-outage runs are Skipped. |

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 397/397; final typecheck 0 / lint 0 / tests 447/447 (31 in `tests/emergency.test.ts`, 19 in `tests/maps.test.ts`; `tests/config.test.ts` now lists `emergencyContent` among the owner-opened gates) / `expo export --platform ios` 0. Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only: the selected `emergency_information`, `evacuation_centers`, `incidents` and `announcements` columns, the anon and authenticated select policies for those tables, and the shape of the published content exist as parsed. No content was written or published.

Decisions P13-D01…D12 are in the evidence record. Plan discrepancies: A20 lists five Android sub-sections and P13-T02 names six, so the hub has six with Android aliases (P13-D03); P13-T03 asks for an "approved" seed fallback and no approver exists, so the owner accepted Android's fallback as is (OD-10, P13-D02); P13-T03 also lists QR content, which Appendix A assigns to Phase 15 (A25); the Android alert month filter ignored an unknown month while counting it as active, and iOS flags it instead (P13-D06). Out-of-scope observations (not fixed): the `announcements` and `emergency_information` anon policies have no tenant predicate; hosted emergency content looks like sample data. **Open question for the owner:** approve tile/geocoding processors and attribution (PR-10) so `mapProviders` can open and P13-T06 can close; P13-T08 closes only with live and device runs, which OD-07 and OD-06 skip.

#### Phase 14 — Evacuation centers, device location, route guidance and DRRM interactions

**Objective:** Deliver complete center discovery and the working Android location/routing outcomes with truthful iOS equivalents.

**Entry:** Phase 2, Phase 3, Phase 13 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/location engineer + DRRM/privacy/provider owner.

**Traceability:** A23–A24; A19 full center/DRRM integration; handoff D09/D11; G07 completed map/route suitability/freshness. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P14-T01** Implement active center directory/search/nearest toggle, selected center/card/detail/list/map, facilities/capacity/occupancy and current location/distance/travel-time states; do not display unknown values as zero/fresh facts. *(2026-10-16: Verified non-device; unknown capacity, distance and availability are labelled, never zero; straight-line figures are labelled estimates)*
- [x] **P14-T02** Complete the iOS foreground location-controller UI: locate/retry/cancel/confirm/reject/Settings, full/reduced permission, Allow Once recheck, last-known fix and manual origin. Preserve source slow/timeout/accuracy/age behavior and explicit insufficient-fix confirmation. *(2026-10-16: Verified non-device; the shared controller and six-action card are reused, a placed starting point is the manual origin; device prompts Skipped)*
- [x] **P14-T03** Implement DRRM panel/center-picker interactions and source map fit/pan/zoom/current-origin/selection behavior with accessible actions/list alternatives; preserve state when returning from center detail. *(2026-10-16: Verified non-device; the selected center lives in the `center` route parameter)*
- [x] **P14-T04** Integrate a qualified production walking-route provider with approved privacy/attribution/operating evidence; the public demo /foot URL is not proof of pedestrian suitability. Keep current-source route outcome without safety claims. *(2026-10-16: Verified non-device; the barangay's first-party `evacuation-route` service is integrated through the shared client and parsed against its live response, and the owner approved sending the starting point to it and opened `routeService` — OD-11, P14-D01, P14-D02)*
- [x] **P14-T05** Implement abort/late-response/origin-revision guards, old-geometry clearing on center/origin changes, route timeout/error and unmistakably labeled straight-line/distance/time fallback plus manual/external-navigation alternatives. *(2026-10-16: Verified non-device with a stubbed service; no straight line is ever drawn as a route — P14-D03)*
- [x] **P14-T06** Cancel watchers/route work when backgrounded/disposed or origin is rejected; refetch operational center facts on return and do not persist precise location unnecessarily. *(2026-10-16: Verified non-device; the starting point is held in memory only)*
- [x] **P14-T07** Revalidate separate weather/BFS routing scope at freeze; port only a newly working Android capability if scope is explicitly added, without starting the unrelated cancelled Android phase. *(2026-10-16: Verified non-device; revalidated — Android's offline evacuation routing is committed (OD-03's condition is met) and the owner kept the offline pack, conditions store and road marking out of iOS scope for now (OD-11); the connected route web ships is built)*
- [ ] **P14-T08** Test denied/reduced/stale/unknown fix, 10-second slow/45-second timeout, background/late callback, nearest sorting, deleted/full/stale center, provider failure and compact/large accessible DRRM controls. *(2026-10-16: partial — 51 automated tests and a browser run of the map page pass; live, device, VoiceOver, Dynamic Type and real provider-outage runs Skipped)*

**Required working deliverable:** Complete center/location/route/DRRM journey with approved processor and explicit estimate/freshness semantics.

**Exit — not just code present:** All A23–A24 and full A19 map/center integrations pass signed-device/backend/provider tests *(signed-device part Skipped — OD-06)*, and G07 is approved for actual production usage—not inferred from a helper.

**Verification/evidence:** T19/T23/T24; F01/F02/F05/F07/F08/F12; location/controller/provider/fallback evidence. D09/D11 six-action location state card, accessible center/sheet/list and no route safety guarantee.

**Progress and status — 2026-10-16 (Phase 14: Partially complete, non-device scope, OD-06/OD-07).** Evidence: [phase-14/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-14/README.md), record [P14_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-14/P14_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phase 3 is Partially complete and Phase 13 is Partially complete, so the formal entry exits were not all met; their open exits are carried as blockers and the work was started on the owner's request of 2026-10-16. No migration, dependency, Expo configuration, Edge Function, shared-package or Android/web change; one release gate (`routeService`) was added and opened by OD-11; nothing was committed, deployed or applied remotely; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict with this phase was found.

| Task | Status | Result / remaining work |
|---|---|---|
| P14-T01 | Verified (non-device scope, OD-06/OD-07) | Centers section of the Emergency hub: List/Map, name search, nearest-first toggle, center cards and detail (address, verified mark, availability, occupancy bar with percentage or FULL, facility tags, call action, when occupancy last changed), centers without a pin kept in the list, loading/error/empty/no-match states, offline copy with age labels. |
| P14-T02 | Verified (non-device scope, OD-06/OD-07) | Phase 2/13 controller and six-action card reused; automatic acquisition on entry never prompts; a spot placed on the boundary-checked map overrides the device fix until a new fix is accepted; both are in memory only. |
| P14-T03 | Verified (non-device scope, OD-06/OD-07) | Horizontal center picker, marker and list selection, focus on the selection, "Show all centers" refit, selection restored from the `center` parameter (the Maps tab links the selected center into it); DRRM panel unchanged from Phase 13. |
| P14-T04 | Verified (non-device scope, OD-06/OD-07/OD-11) | Route client = the shared `requestConnectedRoute` against the barangay's `evacuation-route` function, as the resident web app does; test requests returned answers the shared parser accepted, with the ODbL attribution shown on the card. The owner approved sending the starting point to it and `routeService` is open (OD-11). Not a release approval: tiles/geocoding (`mapProviders`), device and live evidence stay open. |
| P14-T05 | Verified (non-device scope, OD-06/OD-07) | Controller guards (one request, abort on change/hide/background, discard of late and earlier-revision answers, newest conditions revision only), old geometry cleared at once, timeout/error/rate-limit wording, stop after five failures with "Try again", labelled estimates, "No open walking route" for an unreachable center, Apple Maps and manual alternatives, no safety claim. |
| P14-T06 | Verified (non-device scope, OD-06/OD-07) | Route work stops when the screen is hidden, the app backgrounds or the screen unmounts; the shared controller pauses the location watcher; the center list is re-read on focus and foreground; the starting point is never written to storage or logs. |
| P14-T07 | Verified (non-device scope, OD-06/OD-07/OD-11) | Revalidated: the offline routing work is committed (`063c94d`, `e860743`; `osrm.ts` deleted), so OD-03's condition is met. Android bundles a routing pack, a conditions store and local road marking; web ships the connected route only. iOS builds the connected route; the owner kept the rest out of scope for now (OD-11). |
| P14-T08 | Partially complete | 51 new automated tests (center model, origin, route controller, wording, iOS permission mapping through the shared controller) plus a browser run of the route drawing; live, device, VoiceOver, Dynamic Type and real provider-outage runs are Skipped. |

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 447/447; final typecheck 0 / lint 0 / tests 498/498 (29 in `tests/centers.test.ts`, 22 in `tests/center-route.test.ts`; `tests/maps.test.ts` updated for the new columns and the straight-line wording) / `expo export --platform ios` 0. Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only (final run after opening `routeService`: typecheck 0 / lint 0 / tests 498/498 / export 0): the four new `evacuation_centers` columns and the anon/authenticated select policy exist; the hosted center ids equal the ids the route service returns; `evacuation-route` v9 is ACTIVE. Two synthetic-origin requests were sent to that function (no resident data).

Decisions P14-D01…D11 are in the evidence record. Plan discrepancies (reconciled in §6.4, A24, A52-012 and B22 on 2026-10-16): T04 and §6.4 described the public OSRM `foot` helper, which was deleted in `063c94d` — Android and web now use the first-party route service; A24-022 is implemented as labelled estimates in lists and never as a drawn route, matching Android's current rule; Android searches centers by name only in the map view and iOS searches in both. Out-of-scope observations (not fixed): the `evacuation_centers` anon policy has no tenant predicate; `evacuation-route` runs with `verify_jwt = false`; Android's route refresh retries without a limit and its center card drops unknown facility keys. **Open question for the owner:** approve sending the resident's chosen starting point to the barangay's `evacuation-route` function (as the resident web app already does) so `routeService` can open and P14-T04 can close; and say whether Android's offline routing pack, conditions store and road marking become iOS scope (P14-T07).

#### Phase 15 — QR guide, center QR exports, household QR and online emergency check-in

**Objective:** Complete every reachable QR outcome while correcting unsafe offline/bulk attendance behavior.

**Entry:** Phase 3, Phase 4, Phase 5, Phase 13, Phase 14 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/QR engineer + DRRM/backend/privacy.

**Traceability:** A25–A27 including household QR; handoff D12/D13; G08/G15 plus G03 mirror preservation. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P15-T01** Implement current QR guide/permission explanation and scanner entry with guest/action guard, one camera preview, denial/Settings/manual-help alternatives and camera/lifecycle disposal. *(2026-10-16: Verified non-device; `evacuationCheckin` opened by OD-12; guide with offline copy and fallback, guest sign-in path, camera explanation/denied/Settings, one preview, disposal on close/background; device camera run Skipped)*
- [x] **P15-T02** Validate typed QR schema, selected actual active center, caller resident role and tenant; debounce duplicate scan and use authoritative online check-in/reconciliation. Do not count queued/offline data as attendance or bulk-mark household members. *(2026-10-16: Verified non-device (OD-12); six local rejections before any request, one request per scan, authoritative RPC receipt, reconciliation of a lost reply, no queue, no household update)*
- [x] **P15-T03** Implement durable server-confirmed check-in feedback, current attendance reads and clear offline/no-confirmation/foreign/malformed/deleted-center/unknown-response recovery. *(2026-10-16: Verified non-device (OD-12); confirmed / not recorded / not confirmed states, own recent check-ins read from the server, stable refusal codes; live check-in Skipped)*
- [x] **P15-T04** Implement center QR first/selected center/name/schema, selector/display, raw encoded-content native share and QR-image capture/Photos save with exact local-file/permission/cancel/error cleanup. *(2026-10-16: Verified non-device; Show QR with selector, schema-valid payload, PNG decoded by a real reader, raw-text share with neutral cancel, Photos save with cleanup; device share/Photos prompts Skipped)*
- [x] **P15-T05** Implement authenticated household QR display/enlarged modal/placeholder/cache and shared Family entry. It is a different payload/process from center QR; qualify external UUID processor/disclosure or local generation and protected owner cache. *(2026-10-16: Verified non-device; `householdQr` opened by OD-12, which approves the local equivalent (G15); generated on the device from the account id, so no processor and no cache — P15-D01)*
- [x] **P15-T06** Correct household-QR guidance to the actual authorized staff/use process; do not promise this resident scanner registers every family member. Preserve Family/profile mirror IDs and staff attendance on edits. *(2026-10-16: Verified non-device; guidance says staff use the code and mark household attendance, the resident scanner does not check the family in; iOS never writes household attendance)*
- [ ] **P15-T07** Test generation/schema/read failures, guest/wrong tenant/role, duplicate/lost committed scan, denied camera/Photos, share cancel, stale center/QR and next-account cache isolation. *(2026-10-16: partial — 35 automated tests pass; camera, Photos, share sheet, live and next-account device runs Skipped)*

**Required working deliverable:** Working QR guide/scanner/center show-share-save/household display and truthful online resident-only check-in.

**Exit — not just code present:** All A25–A27 and G08/G15 pass; household CRUD remains integrated from Phase 5, and §6.8 online/resident-only corrections are explicitly evidenced.

**Verification/evidence:** T25–T27; F01–F03/F06–F08/F10/F12; server check-in and signed camera/capture/share/Photos proofs. D12/D13 center-vs-household payload/meaning and explicit confirmed/not-confirmed states.

**Progress and status — 2026-10-16 (Phase 15: Partially complete, non-device scope, OD-06/OD-07/OD-12).** Evidence: [phase-15/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-15/README.md), record [P15_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-15/P15_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. **Update 2026-10-16 (OD-12):** the owner opened `evacuationCheckin` and `householdQr` and approved the on-device household code, so T01–T03, T05 and T06 are now Verified (non-device scope); the gate tests were updated (`tests/config.test.ts` lists both among the owner-opened gates). Entry: Phases 3, 4, 5, 13 and 14 are Partially complete or Verified; their open exits are carried as blockers. Two dependencies were added because the phase cannot be built without them: `expo-camera ~57.0.3` (scanner) and `qrcode 1.5.4` (QR encoder), both already resolved in the root lockfile, so only the iOS workspace declarations were added. One additive type entry was added to the shared database augmentation (the check-in RPC). No migration, Edge Function, host change or Android UI change; nothing was committed, deployed or applied remotely; the check-in RPC was not called; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict was found.

| Task | Status | Result / remaining work |
|---|---|---|
| P15-T01 | Verified (non-device scope, OD-06/OD-07/OD-12) | QR section of the Emergency hub: guide (tenant content, offline copy, built-in fallback labelled), Scan QR for signed-in residents (guests get a sign-in path), camera explanation, denied/Settings path, one preview only while open, foreground, permitted and scanning, manual-help wording. Scan QR is enabled since OD-12 opened `evacuationCheckin` (with the gate closed it is disabled with an explanation). |
| P15-T02 | Verified (non-device scope, OD-06/OD-07/OD-12) | `parseCenterScan` (size, JSON, schema, household code, barangay) before any request; one request per scan; the RPC is authoritative for resident role, tenant and active center; no queue, no household update. |
| P15-T03 | Verified (non-device scope, OD-06/OD-07/OD-12) | Confirmed / not recorded / not confirmed states; a lost reply is reconciled from the resident's own stored check-ins and is otherwise "not counted as attendance yet"; own recent check-ins read from the server; refusals map to stable codes with wording. |
| P15-T04 | Verified (non-device scope, OD-06/OD-07) | Show QR sheet (ungated: public data, nothing sent): default first center, selector, fallback when the chosen center disappears, schema-valid payload, PNG decoded by a real reader, raw-text share (closed sheet is neutral), Photos save through the Phase 10 add-only flow with cleanup. |
| P15-T05 | Verified (non-device scope, OD-06/OD-07/OD-12) | Family section: household QR card with enlarged sheet, labelled placeholders and the shared Phase 5 household list; the code is generated on the device from the signed-in account id, so no QR service receives the id and there is no cache (P15-D01). |
| P15-T06 | Verified (non-device scope, OD-06/OD-07) | Guidance corrected: staff use the code and mark household attendance themselves; scanning it in the app does not check the family in; DRRM shortcut wording no longer says check-in; iOS never writes household attendance. |
| P15-T07 | Partially complete | 35 automated tests; camera, Photos, share sheet, live check-in and next-account device runs are Skipped. |

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 498/498; final typecheck 0 / lint 0 / tests 533/533 (35 in `tests/qr.test.ts`) / `expo export --platform ios` 0 (run twice). `expo config --type introspect`: one `NSCameraUsageDescription` naming photos and QR scanning, no microphone key, Photos add-only string updated. A scratch test (deleted) decoded the generated center and household PNGs with `zxing-wasm`. Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only: `check_in_to_evacuation_center` exists and is executable by `authenticated` only, check-in and QR-content tables, policies and published rows match the parsed shapes. Android `tsc` shows 3 errors in untouched `external-link.tsx`; web `tsc` 0; shared `tsc` shows 5 errors in `id-evidence.ts`/`service-catalog.test.ts` (no pre-edit baseline was run for Android and shared, so these are recorded as unrelated, not as proven pre-existing).

Decisions P15-D01…D09 are in the evidence record. Plan discrepancies: P15-T05 allows a processor disclosure or a protected owner cache; a local, uncached code needs neither; A25-023/024 (household update after check-in) is Android's defective bulk behavior and is replaced, not ported (§6.8); A25-025 and A26-017 are a "Done" button and the system page-sheet slide. Out-of-scope observations (not fixed): hosted QR guidance tells residents to screenshot a center code and scan it from their own phone, and the check-in does not verify presence at the center; Android still queues failed check-ins, bulk-updates `household_members.is_checked_in` and calls `generate-household-qr`, which sends the profile UUID to `api.qrserver.com`. The phase exit ("All A25–A27 and G08/G15 pass") is met only for the non-device scope approved by OD-12; the device camera/Photos/share runs, a live check-in and G03 evidence remain open or Skipped (OD-06/OD-07).

#### Phase 16 — Health calendar, drive discovery, self-registration and registration history

**Objective:** Deliver all working resident medical-drive workflows with accurate applicant/dose/consent semantics.

**Entry:** Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 11 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/health engineer + health/backend/privacy.

**Traceability:** A29–A31; handoff D14; G09/G16. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P16-T01** Implement calendar/list toggle, month/day chooser/event dots, all configured drive-type categories and date/type filtering, detail/eligibility/stock/availability and register entry. *(2026-10-16: Verified non-device; calendar/list, month and year sheet, dots, 11 categories + All, day and month results, search, detail, stock/availability; device/VoiceOver/live Skipped)*
- [x] **P16-T02** Implement the reachable full-screen self-registration flow, applicant summary/avatar/age/address/profile-edit return, manually supplied age when needed, PWD and all comorbidity options with None-exclusive behavior. *(2026-10-16: Verified non-device (OD-13 opened the medicalRegistration gate); applicant card, manual age 0–130, PWD, five conditions + None-exclusive, dose, consent; no household picker (self-only correction))*
- [x] **P16-T03** Implement actual supplied prior-dose date or authoritative null for the selected dose/eligibility contract; never port the hard-coded historical date. Consent/privacy copy and checkbox remain required. *(2026-10-16: Verified non-device (OD-13 opened the medicalRegistration gate); first dose sends no date, 2nd dose/booster need a real past date, nothing invented)*
- [x] **P16-T04** Apply shared limits and server resident/tenant/active/expiry/capacity/duplicate checks; use the returned applicant number and accurate error/result. Household booking selection that never reaches the server is replaced with the approved self-only correction. *(2026-10-16: Verified non-device (OD-13 opened the medicalRegistration gate); refusals mapped, applicant number from the server only, lost reply reconciled once against this attempt, write never retried)*
- [x] **P16-T05** Implement My registrations/status tabs/count/detail/schedule/timeline including cancelled history, stable pagination/refresh/realtime and safe removed-drive handling. Do not add an unsupported self-cancel action or copy the dead older modal. *(2026-10-16: Verified non-device; status chips with counts, paginated newest-first list, detail sheet, schedule, timeline incl. cancelled, removed-drive handling, focus refresh + realtime; no cancel action; live/device Skipped)*
- [x] **P16-T06** Keep administrator-only medical weighting/prioritization out of resident projections/logs; protect medical drafts/state/cache and logout cleanup. *(2026-10-16: Verified non-device; history selects no health answers or priority score; form is memory-only; reads drop with the session scope)*
- [ ] **P16-T07** Run stock/capacity/duplicate races, age 0/130, actual/null prior dose, consent, None/conditions, inactive/foreign drive and registration/result-schema failures plus month/year/date boundaries. *(2026-10-16: partial — 39 automated tests pass; database races, inactive/foreign drive and two-tenant runs and all device/live runs open or Skipped)*

**Required working deliverable:** Fully usable health calendar/drives/self-registration/history with confirmed applicant results.

**Exit — not just code present:** All A29–A31 and G09/G16 pass on the deployed schema and signed app; no fabricated medical data or false household booking is presented.

**Verification/evidence:** T29–T31; F01–F05/F07/F10/F12; role/tenant/capacity/medical result evidence. D14 full calendar/filter/applicant/eligibility/history controls and accurate corrective self-only copy.

**Progress and status — 2026-10-16 (Phase 16: Partially complete, non-device scope, OD-06/OD-07).** Evidence: [phase-16/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-16/README.md), record [P16_2026-10-16_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-16/P16_2026-10-16_implementation-and-verification.md). Source: uncommitted on base `e860743`. Entry: Phases 2, 3, 4, 5, 6 and 11 are Partially complete or Verified; their open exits are carried as blockers. No dependency, migration, Edge Function, shared-package, host or Android/web change; nothing was committed, deployed or applied remotely; no registration was written to the hosted project; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict was found. **`medicalRegistration` (G01, G09, G16, G17) was built closed and is open since OD-13 (2026-10-16)**, for the non-device, non-live scope: the G16 two-tenant negative test cannot run on the hosted project (one barangay), and G01, G17 and the live/device runs stay open. With the gate closed the registration form shows the "not available" screen; browsing, detail and history never depended on it.

| Task | Status | Result / remaining work |
|---|---|---|
| P16-T01 | Verified (non-device scope, OD-06/OD-07) | Health hub with Drives / My registrations (route `segment`), Calendar / List, month grid with Sunday-first weeks, month and year sheet, up to three category dots per day with the drive count in each day's accessibility label, 11 categories plus All as scrolling chips, selected-day and whole-month results, upcoming list with title/category/place/date search, cards and detail with eligibility, stock bar plus words, availability and the Register entry, loading/empty/error/stale states, reload on foreground and focus, realtime on the barangay's drives. |
| P16-T02 | Verified (non-device scope, OD-06/OD-07/OD-13) | Full-screen self-registration (gate opened by OD-13): applicant card (avatar or initials, name, age from the date of birth or a typed 0–130, address, Edit in Profile), PWD, Hypertension/Diabetes/Immunocompromised/Pregnant/Allergy with None exclusive, dose history, privacy copy and consent, discard guard. No household picker. |
| P16-T03 | Verified (non-device scope, OD-06/OD-07/OD-13) | 1st dose sends no previous-dose date; 2nd dose and booster need a real chosen date that has happened; Android's `2025-01-01` placeholder is not ported. |
| P16-T04 | Verified (non-device scope, OD-06/OD-07/OD-13) | Shared `driveRegistrationSchema` limits before any request; P0002/P0003/P0004/P0005/22023 and incomplete profile have their own wording; applicant number and status come only from the validated server result; a lost reply is read back once and accepted only if created during the attempt; the write is never repeated. |
| P16-T05 | Verified (non-device scope, OD-06/OD-07) | Status chips with counts, 25-row pages ordered `created_at desc, id`, cards, detail sheet (applicant number, status meaning, dates, drive schedule and eligibility, timeline), cancelled ends at Cancelled, a drive that is not listed (or belongs to another barangay) reads as not listed, no cancel action. |
| P16-T06 | Verified (non-device scope, OD-06/OD-07) | History and summary select no age, PWD, conditions, prior dose or priority score; the result schema strips unknown fields; the form keeps its answers in memory only and says so. |
| P16-T07 | Partially complete | 39 automated tests (boundaries, age 0/130/131, dose, None, consent, refusals, lost replies, query shapes, schema failures); database races, inactive/foreign-drive refusals with a second tenant, realtime and all device/live runs open or Skipped. |

Verification run 2026-10-16 (iOS workspace): baseline typecheck 0 / lint 0 / tests 533/533; final typecheck 0 / lint 0 / tests 572/572 (39 in `tests/health.test.ts`) / `expo export --platform ios` 0 (run twice). Hosted project (`pwjbucnyqexiepoinoke`) re-checked read-only: both tables, their policies, triggers, realtime publication and `register_for_drive` (authenticated only; body contains the invalid-age, already-registered and closed-drive rules) match what the code reads and calls.

Decisions P16-D01…D11 are in the evidence record. Plan discrepancies: A29-018 category arrows are a scrolling chip row; the household picker (A30-002/003/005) is not built (§6.5 correction); the old modal (A52-010) is not copied; the list view shows upcoming drives only (past drives are in the calendar). Out-of-scope observations (not fixed): `medical_drives_public_read` has no tenant predicate; `drive_registrations_own_cancel` lets a resident cancel their own pending registration through the API although no app action exists; the shared generated types omit `drive_registrations.deleted_at`; Android sends a placeholder prior dose and no household identity. **Update 2026-10-16 (OD-13):** the owner opened `medicalRegistration` for the non-device, non-live scope. `release-gates.ts` is `true`, `tests/config.test.ts` lists it among the owner-opened gates and `tests/health.test.ts` asserts it is open while `householdEditing` stays closed, so T02–T04 are Verified (non-device scope). Re-run after the change: typecheck 0, lint 0, tests 572/572, `expo export --platform ios` 0. The phase exit ("A29–A31 and G09/G16 pass on the deployed schema and signed app") is met only for the non-device scope: G16 two-tenant tests, G01, G17, T07's race runs and the device/live runs remain open.

#### Phase 17 — Server inbox, durable remote push and notification preferences

**Objective:** Provide reliable operating remote notifications and guarded destinations for the full app, not foreground realtime alone.

**Entry:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 9, Phase 10, Phase 11, Phase 12, Phase 15, Phase 16 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** Notification/backend operations + iOS + privacy.

**Traceability:** A44; A36/A47/A51 notification integration; handoff D19/D04/D15/D20; G13/G20; G18 account binding. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P17-T01** Complete deployed event/inbox/outbox schemas, transactional event creation/deduplication, versioned typed destination contracts and resident-safe inbox reads/preferences. *(2026-10-21: Verified non-device; migration 0135 on a database clone, 115 pgTAP assertions; not applied to hosted)*
- [ ] **P17-T02** Implement authenticated server sender with Expo Push/APNs credentials, backoff/retries, provider receipts, invalid-token removal, replay suppression, observability and named operational alerts/support owner. *(2026-10-21: partial — sender, retries, receipts, dead-token removal, purge and health counts built and tested; not deployed or scheduled, Expo access token/worker secret unset, PR-07 operator and alert thresholds not named)*
- [x] **P17-T03** Implement current-account/environment/device token registration/rotation/removal, persisted opt-in applied at send time, OS permission/Settings state, opt-out rollback/unsaved feedback and offline logout cleanup/retry tombstone. *(2026-10-21: Verified non-device; real prompt/token round trip Pending device (OD-14); offline-logout gap with no later sign-in is the D08 owner question)*
- [x] **P17-T04** Implement accessible inbox/list/detail/individual/bulk read controls and independent content-read semantics; preserve announcement-only Home bell and the three Reports signals with a separate named inbox count/entry. *(2026-10-21: Verified non-device; screens Pending web/device (OD-14); the Home bell is Phase 18, so the inbox has its own entry and count)*
- [x] **P17-T05** Connect cold/warm/foreground/background/terminated notification responses, validate route/record/version/current account, refetch authorization/data and handle deleted/expired/malformed/duplicate destinations without leaking content. *(2026-10-21: Verified non-device; taps resolve against the resident's own inbox row; cold/warm/foreground runs Pending device)*
- [x] **P17-T06** Use generic privacy-safe previews and meaningful permission timing. Keep ordinary app use available on denial and SMS visibly unavailable unless separately approved operational consent/backend exists; no emergency delivery guarantee/critical entitlement. *(2026-10-21: Verified non-device; generic text, prompt only from Settings, SMS shown unavailable, no background mode)*
- [x] **P17-T07** Integrate service/payment/incident/announcement/medical/check-in events according to the approved event contract and current active preferences; realtime remains a refresh path, not background delivery infrastructure. *(2026-10-21: Verified non-device; no check-in event by design, D02)*
- [ ] **P17-T08** Test delivery/receipts/retry/provider failure, denial/Settings changes, all token/account/opt-out/logout races and every eligible typed notification destination on the exact signed candidate *(signed-candidate/APNs delivery Skipped — OD-06; sender/outbox/receipt processing, token lifecycle and destination routing are tested server-side and in automated client tests)*. *(2026-10-21: partial — 77 client/worker tests, 115 database assertions and a run against the real database functions pass; signed-candidate/APNs, device, two-device and concurrent-worker runs not performed)*

**Required working deliverable:** Operating server-backed inbox/outbox/push/preferences/tap routing with receipt monitoring and accountable ownership.

**Exit — not just code present:** A44 and G13/G20 notification requirements pass; no unresolved sender/APNs/tap/token gap, and content read states remain independent. A disabled remotePush flag cannot close full conversion.

**Verification/evidence:** T44 plus T36/T47/T51 integration; F01–F03/F07/F11/F12; physical-device/APNs receipt *(Skipped — OD-06)* and sender monitoring evidence. D19 honest permission/delivery/preference/read meanings and private-preview-safe destinations.

**Progress and status — 2026-10-21 (Phase 17: Partially complete, non-device scope, OD-06/OD-07/OD-14).** Evidence: [phase-17/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-17/README.md), record [P17_2026-10-21_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-17/P17_2026-10-21_implementation-and-verification.md). Source: uncommitted on base `187a2ab3`. Entry: Phases 1–4, 9–12, 15 and 16 are Partially complete or Verified; their open exits are carried as blockers. One dependency was added because tokens, permission and notification responses cannot be done without it: `expo-notifications ~57.0.11` (already resolved in the root lockfile for Android, so only the iOS workspace declaration was added). Backend additions: migration `0135_resident_notifications.sql` (next prefix after `0134`) and the `send-notifications` Edge Function; **neither is applied or deployed** (hosted is at `0134`, read-only check), no secret was set, no push was sent and nothing was committed. **`remotePush` was built closed and stays closed**: opening it is an owner decision after the deployment steps in the record. With it closed Home and Settings show no entry, the routes show the unavailable screen and no token, count or listener starts. `AGENTS.md` is empty in the working tree (an uncommitted deletion, not part of this phase); `CLAUDE.md` only imports it, so no repository instruction conflicts with the plan, and its former rules (SDK 57 docs, sequential migration numbers) were followed.

| Task | Status | Result / remaining work |
|---|---|---|
| P17-T01 | Verified (non-device scope, OD-06/OD-07/OD-14) | Private events/outbox/deliveries, resident inbox (own rows; `read_at` is the only writable column), per-kind preferences, trigger-created events with per-recipient dedupe, versioned `{v,kind,id}` destinations, generic server-written text. |
| P17-T02 | Partially complete | Sender logic and Edge Function built and tested (claim with send-time preferences, 100-message batches, backoff to five attempts, tickets, receipts after 15 minutes, dead-token removal, purge, health counts). Not deployed or scheduled; PR-07 operator/on-call and alert thresholds open. |
| P17-T03 | Verified (non-device scope, OD-06/OD-07/OD-14) | Registration on eligible session start, foreground and token change; release on opt-out and logout with a retry marker; saved switch separate from device state; rollback with unsaved feedback. Real prompt/token round trip Pending device. |
| P17-T04 | Verified (non-device scope, OD-06/OD-07/OD-14) | Inbox All/Unread, detail sheet, single and snapshot-bounded bulk read, own unread count entries on Home and Settings; announcement and resolved-report read state and the three Reports signals untouched. The Home bell is Phase 18. |
| P17-T05 | Verified (non-device scope, OD-06/OD-07/OD-14) | Tap handler resolves the payload against the resident's own inbox row; malformed, purged, other-account, mismatched and unreachable taps land in the inbox with a reason; each response handled once. Cold/warm/foreground runs Pending device. |
| P17-T06 | Verified (non-device scope, OD-06/OD-07/OD-14) | Generic text; the iPhone prompt only from the Settings switch; denial explained and never blocking; SMS shown unavailable; no critical alerts, silent push or background mode (generated configuration checked). |
| P17-T07 | Verified (non-device scope, OD-06/OD-07/OD-14) | Request status and payment, incident status, announcement, new medical drive and registration status events; no check-in event by design (the resident's own action, confirmed in-app). |
| P17-T08 | Partially complete | 80 new client/worker tests and 121 new database assertions plus a run of the sender against the real database functions; signed-candidate/APNs, device, two-device, concurrent-worker and hosted runs not performed. |

Verification run 2026-10-21: iOS baseline typecheck 0 / lint 0 / tests 572/572; final typecheck 0 / lint 0 / tests 652/652 / `expo export --platform ios` 0; generated configuration has the `aps-environment` entitlement and no `UIBackgroundModes`; pgTAP `resident_ios_phase17_notifications.test.sql` 121/121 on a database clone, with the Phase 3 backend, requests, tenant-guard, RLS-isolation, automatic-payment and household tests passing on the same clone; guest Home and the closed-gate screens render on web localhost without console errors (**Verified (web localhost)**, closed state only); resident-web, admin-web and Android `tsc` 0, shared `tsc` unchanged at its 5 existing errors.

Decisions P17-D01…D16 are in the record. The ones that differ from P03-T07's sketch: the outbox row is per inbox entry with one delivery ticket per token (D01); kinds add `medical_drive` and drop `emergency_alert` (D02); a notification failure never rolls back the source change (D05); the sender is gated by a shared secret because gateway JWT verification would admit any resident (D07); token removal is anonymous-callable by possession (D08). **D08 (owner-approved as OD-15, 2026-10-21):** `release_push_token` is callable without a session (possession of the token is the proof; it only deletes that address and answers the same whether or not it existed), so an offline logout is completed on the next app open, signed in or not; the one-line allowlist change in the Phase 3 anonymous-routine test names it and its reason, and the Phase 3 backend suite (86) still passes. **Pending device (OD-14):** prompt, token, banner, lock-screen alert, cold/background/foreground taps, wrong-account and signed-out taps, offline logout, two accounts on one iPhone, VoiceOver and Dynamic Type. **Pending web (OD-14):** inbox and settings with the gate opened locally against a database clone. The phase exit ("A44 and G13/G20 pass; no unresolved sender/APNs/tap/token gap") is **not** met: the sender is undeployed and unowned, and APNs/device evidence does not exist.

#### Phase 18 — Actionable Home, information pages, complete exports and account privacy

**Objective:** Finish the full Home/Settings/information/privacy experience and tie every completed domain into real resident next actions.

**Entry:** Phase 4, Phase 5, Phase 6, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** iOS/information engineer + privacy/backend/content/support.

**Traceability:** A08, A45–A49; completed Settings/Home integration; handoff D04/D20/D21; G10/G11/G12/G20/G21 content/privacy prerequisites. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [x] **P18-T01** Implement final Home greeting/profile warnings/attention/quick actions/recent requests/latest announcements/actual activity; every card/action targets a working authorized flow. Preserve announcement bell and distinct inbox plus all three labeled Reports counts accessible through More. *(2026-10-21: Verified non-device; Home built with every card opening a working flow, TODAY stamp, three labeled Reports counts, announcement-only bell and the separate inbox entry; guest rendering Verified (web localhost); signed-in rendering Pending web/device (OD-14))*
- [x] **P18-T02** Implement genuinely defined authorized Home search if shown, no-results/filter/clear/loading/cancel behavior and safe guest/public/stale/error states; no decorative field or invented activity/next action. *(2026-10-21: Verified by omission, decision P18-D01: no authorized Home search source is defined, so no search field is shown and A08-012 is intentionally not built; no decorative field)*
- [x] **P18-T03** Complete seven Help categories/articles/search if displayed/support actions, Terms/Privacy accordions, About mission/vision/history/contacts/developer cards/logo and actual binary version/build with approved dated publisher content. *(2026-10-21: Verified non-device and web localhost with hosted public content; seven Help choices filtered on the server, article rich text, Terms and Privacy accordions with publisher and date, About with logo, mission, vision, history, contacts, team and the binary version/build (`expo-application`); version shows only on a device build; approval of the published text is a content-owner step)*
- [ ] **P18-T04** Complete Download My Data PDF/JSON chooser/cooldown/progress/error/share and approved versioned full account/profile/household/service/incident/health/check-in/device/preference/read-state inventory. Page all required data and reject falsely complete partial sections. *(2026-10-21: partial — chooser, single flight, cooldown, progress, errors, share, temporary-file removal and the complete-only v2 contract built; v2 verified on a database clone and against a real PostgREST with paging; `export-my-data` v2 and migration 0135 not deployed, `completeExport` closed; native PDF/JSON/share Pending device)*
- [ ] **P18-T05** Complete authoritative delete/retain/anonymize matrix, fresh same-account password/provider confirmation, Apple revocation, idempotent observable auth/storage/session cleanup/retry and truthful terminal deletion/retention copy; old JWTs cannot continue protected operations. *(2026-10-21: partial — migration 0136 (state, idempotent matrix) with 56 pgTAP assertions, function v2 with 17 tests, client flow with fresh proof, final confirmation and truthful outcomes built; retention matrix approved (PR-14, OD-16), Apple revocation never run against Apple (PR-06), not deployed, `accountDeletion` closed; unexpired-token read gap needs an owner decision (P18-D13))*
- [x] **P18-T06** Integrate logout/account switch with every now-built private cache/draft/upload/token/image/QR/export/recovery/provider operation. Protect temporary export/receipt/identity files and verify process interruption/offline/reinstall cleanup. *(2026-10-21: Verified non-device; one private cache folder for exports, receipts and QR images, emptied with the SDK photo/PDF cache folders at logout, launch and account change; Apple code cleared; process-kill, offline and reinstall runs Pending device)*
- [ ] **P18-T07** Finalize approved hotline/legal/privacy/support/moderation/processor disclosures, extracted English/accessibility strings, asset/font licenses/fallbacks, PHP formatting and date-only/timezone boundaries without inventing a completed Tagalog translation. *(2026-10-21: partial — English strings extracted for Home, information and privacy, PHP and date-only formatting tested, links validated; approved hotline/legal/support/moderation/processor disclosure wording is owner/content work and no processor disclosure text was authored)*
- [ ] **P18-T08** Test complete export above row limits, required-section failure/native PDF/JSON sharing, provider/deletion/cleanup lost reply, account switch/private-file isolation and every Home/Settings/information return path. *(2026-10-21: partial — above-limit paging, failed required section, lost deletion reply, retry convergence, cleanup, account-switch purge and every Home/Settings/information link are tested; native PDF/JSON sharing, real Apple revocation, hosted and device runs not performed)*

**Required working deliverable:** Fully actionable Home and complete information/privacy/export/deletion/logout surface with real linked workflows.

**Exit — not just code present:** A08/A45–A49 and G10/G11 pass end-to-end; all source Settings actions and Home entries are working/accurate, no partial export or ban-only permanent-delete claim.

**Verification/evidence:** T08/T45–T49; F01–F07/F11/F12; complete export/delete post-state and native share proofs. D04/D20/D21 full Home/Settings hierarchy, truthful privacy/support/retention and protected-file states.

**Progress and status — 2026-10-21 (Phase 18: Partially complete, non-device scope, OD-06/OD-07/OD-14).** Evidence: [phase-18/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-18/README.md), record [P18_2026-10-21_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-18/P18_2026-10-21_implementation-and-verification.md). Source: uncommitted on base `187a2ab3`. Entry: Phases 4–6 and 9–17 are Partially complete or Verified; their open exits are carried as blockers. AGENTS.md is empty in the working tree, so there was no repository instruction to reconcile with the plan. One dependency was added because the binary version and build cannot be read without it: `expo-application ~57.0.2` (already resolved in the root lockfile, so only the iOS workspace declaration was added; no config plugin, generated configuration unchanged). Backend additions: migration `0136_account_deletion_state.sql` (next prefix after `0135`), `export-my-data` v2 and `delete-my-account` v2 as additive request versions (Android and web keep v1).

| Task | Status | Result / remaining work |
|---|---|---|
| P18-T01 | Verified (non-device scope, OD-06/OD-07/OD-14) | Home: identity, profile banner, bell with its own count, four quick actions, latest three requests, three labeled Reports counts, latest announcement with TODAY, inbox entry behind `remotePush`; refresh on focus, foreground and realtime. Guest run Verified (web localhost); signed-in rendering Pending web/device. |
| P18-T02 | Verified by omission (P18-D01) | No Home search: no authorized source is defined, and the plan allows omission. A08-012 intentionally not built. |
| P18-T03 | Verified (non-device scope, OD-06/OD-07/OD-14) | Seven Help choices (server-side filter), article rich text, Terms and Privacy accordions with publisher and date, About with version/build, contacts and team; links limited to https, mail and telephone. Real hosted content rendered on web. Content approval is a content-owner step. |
| P18-T04 | Partially complete | Client, v2 function and contract complete and tested (real PostgREST run with paging; staff identities, tokens and paths excluded); not deployed (needs migration 0135 first); `completeExport` closed; native PDF/JSON/share Pending device. |
| P18-T05 | Partially complete | Migration 0136 and function v2 verified on a clone (56 assertions; soft delete checked on a local GoTrue); Apple revocation unverified (PR-06); matrix approved 2026-10-21 (PR-14, OD-16); not deployed; `accountDeletion` closed. |
| P18-T06 | Verified (non-device scope, OD-06/OD-07/OD-14) | Private temporary-file folder purged at logout, launch and account change; receipts and QR images moved into it; Apple code cleared at logout. Device runs Pending. |
| P18-T07 | Partially complete | Strings extracted and formatting tested; approved disclosure wording and processor disclosure are owner/content work. |
| P18-T08 | Partially complete | 67 client tests, 17 function tests and 56 database assertions; native sharing, real Apple revocation, hosted and device runs not performed. |

Verification run 2026-10-21: iOS baseline typecheck 0 / lint 0 / tests 652/652; final typecheck 0 / lint 0 / tests 719/719 / `expo export --platform ios` 0 / `expo export --platform web` 0; generated configuration unchanged; `delete-my-account` function tests 32/32; pgTAP `resident_ios_phase18_account_deletion.test.sql` 56/56 on a database clone with the Phase 3 backend (86), requests (28), tenant-guard (7), RLS-isolation (17) and Phase 17 notification (121) suites passing on the same clone; export run against a real PostgREST on the clone; guest Home, Help, Terms and Privacy, About and Settings render on web localhost without a console error (**Verified (web localhost)**, guest reads only); resident-web, admin-web and Android `tsc` 0, shared `tsc` unchanged at its 5 existing errors.

Decisions P18-D01…D15 are in the record. The ones that differ from the plan's sketch: no Home search (D01); the old Resident information screen was replaced by Terms and Privacy and About (D04); the approved retention matrix (OD-16) keeps ID submissions that a version 2 request depends on as tombstones and leaves the immutable submission payload alone (D09); the sign-in is soft-deleted after sessions are revoked (D10); an unexpired token can still read de-identified retained rows (D13, owner decision). **Update 2026-10-21 (OD-16):** the owner approved the retain/de-identify/erase matrix as written (PR-14) and asked for the published Privacy Policy to stop promising five years of retention after closure. The replacement wording is recorded in `phase-18/P18-T05_2026-10-21_privacy-policy-retention-wording.md` and was **applied** to the hosted `site_content` row on 2026-10-21 after the owner's explicit permission for that single write (verified by a read). **Update 2026-10-21 (Phase 20, P20-D01): migrations 0135 and 0136 were applied to the hosted project at the owner's instruction; the function deployments below remain open.** **Open (owner):** approve deployment of both functions (migrations 0135 and 0136 are now applied); provide the Apple key material (PR-06); then open `completeExport` and `accountDeletion`. The phase exit ("A08/A45–A49 and G10/G11 pass end-to-end; no partial export or ban-only permanent-delete claim") is **not** met: export and deletion are undeployed and unproven end to end, and device evidence does not exist.

#### Phase 19 — Whole-app parity, accessibility, resilience and production-candidate verification

**Objective:** Prove the complete app works as a system and matches Android outcomes with approved iOS-native/corrective differences.

**Entry:** Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17, Phase 18 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** QA lead + iOS/backend/security/design/accessibility.

**Traceability:** All A01–A52/R01–R54/B.3 outcomes; handoff All D01–D21/DX01–DX52; G17/G19/G20/G22 and revalidation of feature gates. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [ ] **P19-T01** Audit the final implementation against every one of the 1,218 source checkpoints, all 54 route/layout entries, modal/native outcomes, fields/options/statuses and §6.8 dispositions. Close no working capability as intentionally excluded without explicit user approval.
- [ ] **P19-T02** Execute T01–T52 and applicable F01–F12 across every completed workflow and cold/warm/More/deep-link/interrupted return path, resident/guest/provider/tenant/account role and same-candidate backend contract.
- [ ] **P19-T03** Run actual resident→staff→resident service assessment/processing/payment/pickup/fulfillment, concern confirmation/withdraw/moderation, drive registration/capacity, center/check-in, read-state and notification journeys; mocks cannot replace them. *(OD-06: running them through the iOS app is Skipped; the same journeys run against the staging backend with the iOS adapters and admin/staff operations.)*
- [ ] **P19-T04** Run offline/stale/cache/pagination/concurrent/unknown-commit/upload/cleanup/process termination/upgrade/reinstall and account-switch scenarios; verify no duplicate effects, hidden required data, sensitive leaks or falsely complete partial outcomes.
- [ ] **P19-T05** Perform visual/interaction comparison against current Android and the main handoff for every screen/modal/theme/custom accent/mobile font/device size; document intentional native differences and exact A/D/DX coverage. *(OD-06: device-size/rendered-screen comparison Skipped; source/token/component review remains.)*
- [ ] **P19-T06** Qualify VoiceOver/Full Keyboard Access/largest Dynamic Type/contrast/non-color states/Reduce Motion/Transparency/keyboard/back/gesture/focus; test low-memory/long-list/image and the handoff's measured performance targets. *(OD-06: on-device assistive-technology and performance runs Skipped; accessibility props/labels/roles, contrast tokens and list virtualization are checked in code and tests.)*
- [ ] **P19-T07** Run clean workspace CI: SDK/config/dependency validation, iOS typecheck/lint/tests/export/release diagnostic, shared/controller tests, backend/RLS/storage integration and Android/web regressions for shared changes. Check public-bundle secrets and sanitized diagnostics.
- [ ] **P19-T08** Qualify symbolicated native/JS crash handling *(native symbolication Skipped — OD-06)*, redaction/release identifiers and mutation/upload/payment/push alert dashboards/runbooks; diagnose faults using sanitized fixtures.
- [ ] **P19-T09** Freeze a candidate commit/lockfile/native configuration/build/backend versions *(OD-06: source candidate — commit, lockfile, generated configuration and backend versions; no build)*, close Critical/High defects and document lower-risk ownership. Any later binary/contract change reopens impacted tests/gates; a source-only checker is not release approval.

**Required working deliverable:** Complete signed candidate and exhaustive functional/design/security/lifecycle evidence with closed parity gaps. *(OD-06: complete source candidate with non-device evidence; no signed candidate.)*

**Exit — not just code present:** All working/approved-corrective A/R/modal outcomes pass and G17/G19/G20/G22 are ready for final same-candidate approval; no disabled required feature, placeholder, ambiguous authority or unresolved Critical/High blocker remains.

**Verification/evidence:** All T/F families + G17/G19/G20/G22; current-source Android comparisons, physical devices *(Skipped — OD-06)* and deployed integration evidence. All D/DX families with source/implementation/artifact mappings, not only happy-path screenshots.

**Progress and status — 2026-10-21 (Phase 19: Partially complete, non-device scope, OD-06/OD-07/OD-14).** Evidence: [phase-19/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-19/README.md), record [P19_2026-10-21_audit-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-19/P19_2026-10-21_audit-and-verification.md). Source: uncommitted on base `187a2ab3`; identity in `phase-19/candidate.json`. Entry: Phases 3–18 are Partially complete or Verified; their open exits are carried as blockers exactly as in Phases 4–18. `AGENTS.md` is empty in the working tree, so there was no repository instruction to reconcile with the plan. A crash-reporter dependency was added and then removed the same day (OD-17, OD-18); the lockfile and the iOS workspace declarations are unchanged from before it. No dependency, migration, Edge Function or shared-package change; nothing was committed, deployed or applied remotely, and no hosted data was written.

| Task | Status | Result / remaining work |
|---|---|---|
| P19-T01 | Partially complete | `audit.mjs` (rerunnable) joins all 1,218 checkpoints to phase, ledger status, closed gates and tests, resolves R01–R54 + IR01–IR10 (64) and M01–M16 (16/16) to existing files, maps all 52 sections and 14 gates, and finds no orphaned route file. 949 checkpoints rest on family-level evidence (A 15, B 254, C 949, D 0); per-checkpoint behavioral review was not performed. No capability excluded. |
| P19-T02 | Partially complete | 725 iOS, 527 shared, 260 Android and 136 Edge Function tests pass; new `whole-app.test.ts` covers route integrity incl. notification destinations. Cold/warm/More/interrupted paths and role runs Pending device (OD-14). |
| P19-T03 | Partially complete | On a disposable clone with migrations 0118–0136: 826 pgTAP assertions in 22 files pass and the parallel-session proof passes 7/7. Hosted-staging journeys with the iOS adapters, PayMongo settlement and staff screens end to end not run (no staging; hosted writes not authorized). |
| P19-T04 | Partially complete | Existing offline/cache/concurrency/upload/cleanup tests reviewed against §4.5; logout and account-switch seams reviewed in source. Termination, reinstall and real offline Pending device (OD-14). |
| P19-T05 | Partially complete | Theme-token test added; swatch checkmark contrast defect fixed (P19-F01). Rendered comparison, device sizes and PR-21 captures Skipped (OD-06). |
| P19-T06 | Partially complete | Roles/names/labels on every pressable and text field enforced by test; contrast, windowing and cleanup reviewed. VoiceOver, Dynamic Type, Reduce Motion and performance Pending device (OD-14). |
| P19-T07 | Partially complete | iOS typecheck/lint/tests/exports, Edge Function tests, database suites and secret scan of both exports clean; SDK patch drift recorded (P01-D04). Pre-existing, untouched failures: shared `tsc` (5 errors), resident-web (1 test), admin-web (1 test). |
| P19-T08 | Skipped for the reporter (OD-18) | The owner first chose a hosted reporter (OD-17), which was built and tested, then dropped crash reporting entirely (OD-18) and the work was removed. No crash/error reporter, symbolication or release-tagged telemetry exists. The crash-diagnostics condition of G20 is unmet by design; dashboards, thresholds and runbooks for mutations, uploads, payments and push remain PR-07 and P20-T06 work. The existing root error boundary and typed, resident-safe failure copy are the only handling. |
| P19-T09 | Partially complete | Source candidate frozen in `candidate.json` (uncommitted; no build; no `ios-rc-*` name). Critical: none. High: P19-F03. |

Verification run 2026-10-21: iOS baseline typecheck 0 / lint 0 / tests 719/719 / export ios 0 / export web 0; final typecheck 0 / lint 0 / tests 725/725 (a crash reporter built under OD-17 raised this to 741 and was removed under OD-18) / export ios 0 / export web 0; generated configuration identical to baseline; shared `tsc` unchanged at its 5 existing errors, shared tests 527/527, resident-web, admin-web and Android `tsc` 0, Android tests 260/260, Edge Function tests 136/136; pgTAP 826/826 and concurrency 7/7 on the clone (dropped afterwards). The phase exit is **not** met: seven required feature gates are closed (`householdEditing`, `privateIdUploads`, `mapProviders`, `publicIncidents`, `completeExport`, `accountDeletion`, `remotePush`), P19-F03 is open, G17 lacks per-checkpoint mapping, and device, live and hosted-staging evidence does not exist.

Findings P19-F01…F09 are in the record. Fixed: the white-on-accent swatch checkmark (F01) and the stale Phase 10 rows of the execution ledger (F02). **Open (owner):** approve deployment of migrations 0135 and 0136, the two function changes and `send-notifications`; supply Apple key material (PR-06); supply a staging project if hosted journeys are wanted. Phase 20 must not describe the app as production-ready, released or device-qualified.

#### Phase 20 — TestFlight, App Store preparation, rollout and final conversion sign-off

**Objective:** Turn the fully verified candidate into an owned, supportable production iOS release.

**OD-06 (2026-10-14):** no signed build, TestFlight, store submission or staged rollout is made. P20-T01's signed-candidate inspection, P20-T04, P20-T07 and P20-T08 are Skipped; P20-T02/T03 prepare compliance and reviewer material without submitting; P20-T05 approves gates in non-device scope only; P20-T06 and P20-T09 remain in full. The phase ends with release-preparation material and a truthful final report, not a release.

**Entry:** Phase 19 exits/required contracts pass; required phase-specific credentials, approved policy and authoritative environment facts are recorded. **Lead:** Release/Apple/EAS owner + QA/product/privacy/operations.

**Traceability:** All parity plus distribution/compliance/operating readiness; handoff All families; reviewer/onboarding/support/disclosure polish; G01–G22 final approval; especially G14/G21. All related B contracts/R routes/B.3 modals and applicable F tests are inherited.

**Execution tasks:**

- [ ] **P20-T01** Finalize explicit development/staging/App Store environment profiles and inspect the exact signed candidate for bundle/scheme/version/build, permissions/Info.plist, Apple/APNs capabilities/entitlements/provisioning, trusted endpoints and no bundled secrets. *(OD-06: signed-candidate inspection Skipped; inspect the generated configuration and exported bundle for scheme, permissions, requested entitlements, endpoints and bundled secrets instead)*
- [ ] **P20-T02** Verify then-current App Store rules, privacy manifests/required-reason APIs/App Privacy labels, account deletion/Apple login/UGC applicability, processor/legal/support URLs, age/encryption/export compliance and licensed assets/icons/splash/screenshots.
- [ ] **P20-T03** Publish reviewer account/instructions, sample safe QR, payment/verification/health content and reachable backend; do not require an unavailable administrator or undocumented external step to assess core flows.
- [ ] **P20-T04** Run TestFlight on the final candidate with residents/staff across supported iPhones/iOS; execute core and failure journeys, native permissions/Apple/Google/push/payment/export/deletion, accessibility and real operations. Resolve material findings and rerun impacted Phase 19 evidence. *(Skipped — OD-06)*
- [ ] **P20-T05** Approve all G01–G22 and applicable feature-gate openings with named domain owners and exact same-candidate artifacts. Required payment/push/map/check-in/health/privacy functionality cannot stay disabled while claiming conversion complete.
- [ ] **P20-T06** Finalize on-call/support/moderation/DRRM/health/payment/notification owners, monitoring thresholds, privacy/security incident response and backend-compatible rollback/kill-switch procedures. Rehearse rollback and account/private-data protection.
- [ ] **P20-T07** Submit the approved signed binary/store artifacts and manage review findings without silently weakening scope or safeguards; record store/distribution state accurately. Keep OTA disabled for the first production release. *(Skipped — OD-06)*
- [ ] **P20-T08** Use a staged rollout and observe named payment/push/crash/mutation/support indicators with a documented response/rollback decision. Identify release build/backend and approved native/corrective differences. *(Skipped — OD-06)*
- [x] **P20-T09** Complete the final C.6 checklist and produce a truthful full-conversion report: shipped/verified outcomes, owners/evidence/known approved residual risks and distribution state. Internal pilot or pending required gates cannot be labeled the completed production conversion.

**Required working deliverable:** Approved immutable release, TestFlight/store/distribution records, operational runbooks and final complete-conversion evidence. *(OD-06: release, TestFlight and store records Skipped; deliverable is the release-preparation package, runbooks and the truthful code-complete, non-device-verified conversion report.)*

**Exit — not just code present:** All mandatory gates/checklists and same-candidate functional/design/device/backend/operating evidence pass; release approval/store status is recorded truthfully and no required feature remains unimplemented or permanently gated.

**Verification/evidence:** All G01–G22 (G02/G14 and device conditions Skipped — OD-06); TestFlight/store/signing *(Skipped — OD-06)*/privacy/operational artifacts and final candidate audit. Final G22 design approval and complete reviewer/support/disclosure/asset/accessibility evidence.

**Progress and status — 2026-10-21 (Phase 20: Partially complete, non-device scope, OD-06/OD-07/OD-14/OD-18).** Evidence: [phase-20/README.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-20/README.md), record [P20_2026-10-21_implementation-and-verification.md](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-20/P20_2026-10-21_implementation-and-verification.md). Source: uncommitted on base `187a2ab3`; identity refreshed in `phase-19/candidate.json`. Entry: Phase 19 is Partially complete; its open exits are carried as blockers. `AGENTS.md` is still empty in the working tree, so there was no repository instruction to reconcile with the plan; the Expo v57 documentation rule from the execution request was followed for the config properties used. Changes: the release diagnostic `scripts/check-release.cjs` now rejects placeholder identifiers and a non-production environment (3 new tests), `docs/release-checklist.md` was rewritten (it was stale), and evidence tooling was added under `phase-20/`. No dependency, migration, Edge Function, shared-package, Android or web change; no app configuration change; nothing was committed, deployed or applied remotely, no hosted data was written, no account was created and nothing was submitted.

| Task | Status | Result / remaining work |
|---|---|---|
| P20-T01 | Partially complete | Five EAS profiles verified; generated configuration and the exported bundle inspected by the rerunnable `inspect-candidate.mjs` (26 checks pass; no secret in the bundle; permissions, entitlements and endpoints as expected). Signed-candidate inspection Skipped (OD-06). Open: placeholder bundle identifier and URL scheme (PR-02/PR-03), no icon (the logo is RGBA), no privacy collected-data list, encryption declaration (owner's). |
| P20-T02 | Partially complete | Dated Apple/Expo rules snapshot, applicability table, dependency privacy-manifest scan (6 manifests, `expo-sharing` to review), App Privacy draft, age/encryption analysis, asset review. **Blocking store submission:** account deletion is not reachable in the app (`accountDeletion` closed, `0136`/function undeployed), Apple login not operable (PR-06), no public privacy/support URL (PR-17), no opaque icon. Pending macOS/Linux: app-level privacy manifest, Xcode privacy report; no screenshots. |
| P20-T03 | Partially complete | Gap list, review-environment requirements and a note template. Not publishable: no reviewer account, sample QR, review environment or URLs; the only backend is the production project (PR-01). |
| P20-T04 | Skipped (OD-06) | Pending device (OD-14). |
| P20-T05 | Partially complete | Register for all 22 gates and 14 feature gates with evidence, unmet conditions and recommendations. **No gate was approved in this phase** (owner decision); G02/G14 Skipped; G19 is the only gate ready for a non-device sign-off; G17, G20, G21, G22 are not ready or not met. |
| P20-T06 | Partially complete | Owners (one person, no backup/contacts), proposed monitoring thresholds (not instrumented), incident and kill-switch matrix (the client has no remote kill switch), and the backend rollback of `0135`/`0136` rehearsed on a disposable clone: baseline suites identical before and after (394 assertions), 0 leftover objects, unfinished-deletion guard refuses, roll-forward clean. The rehearsal caught and fixed a defect in the first rollback draft. |
| P20-T07 | Skipped (OD-06) | Needs a signed binary; OTA stays disabled. |
| P20-T08 | Skipped (OD-06) | Needs a released binary. |
| P20-T09 | Verified (non-device scope, OD-06) as a report | C.6 evaluated item by item (9 not met, 5 partial, 1 pending device, 2 met). The report states the conversion is **not** complete and that no signed build, device qualification, TestFlight, store submission or rollout exists. |

Verification run 2026-10-21: iOS baseline typecheck 0 / lint 0 / tests 725/725 / export ios 0; final typecheck 0 (after fixing one error a new test introduced) / lint 0 / tests 728/728 / export ios 0 / export web 0; generated configuration byte-identical to baseline; `audit.mjs` exit 0; `inspect-candidate.mjs` 26 checks pass; `check:release` exit 1 as designed (7 missing variables, 7 closed gates); rollback rehearsal PASS. Shared, Android, web, Edge Function and database suites were not rerun (no change in their sources). **The phase exit is not met**; Phase 20 must not be described as a release, production-ready or device-qualified. Open (owner): approve deployment of `0135`/`0136`, the v2 functions and `send-notifications` (unblocks G10, G11, G13 and the store's account-deletion rule); supply Apple identifiers and PR-06 key material; supply an approved opaque icon, privacy/support URLs and a review environment; decide the closed gates.

**Hosted migrations applied — 2026-10-21 (owner instruction).** Migrations `0135` and `0136` were applied, in that order, to the hosted project `pwjbucnyqexiepoinoke` and verified read-only: 6 of 6 tables, 5 of 5 triggers, 20 of 20 functions, row-level security on, only `release_push_token` executable by `anon` (OD-15), sender functions not callable by clients, zero rows in the new tables, existing data unchanged. They are tracked in the hosted history as timestamp versions `20261021094448` and `20261021094513`; the repository files keep their `0135`/`0136` names and the next unused prefix is `0137`. **No Edge Function was deployed, no secret set, no gate opened, nothing committed.** The triggers now write inbox/outbox rows on staff changes, but nothing is sent (`send-notifications` undeployed, `remotePush` closed). Record: [P20-D01](/C:/Users/User/barangayan/plans/evidence/resident-ios-parity/phase-20/P20-D01_2026-10-21_hosted-migrations-0135-0136.md). The earlier statements in this section and in Phases 3, 17, 18 and 19 that `0135`/`0136` are not applied describe the state before this deployment; the function deployments, secrets, PR-06 and the gates remain open.

### 4.4 Whole-app closure and change-impact audit

Before Phase 19/20 sign-off, the execution owner produces a coverage report that joins every A-checkpoint to phase/task, Android state, iOS implementation, D/DX design, B/R contract/route, T/F test and G approval. There must be no orphaned requirement, unassigned working outcome, permanent required-feature placeholder or evidence based solely on filenames/mock responses.

The report rechecks Android/shared source at freeze and adds any new working capabilities to the ledger/phases before completion. Retain historical findings, but resolve current obsolete/partial/corrective cases explicitly. Update the handoff crosswalk and phase/test/gate assignments when scope or integration changes; do not renumber already-recorded stable task identifiers just to hide an unfinished item.

All applicable feature gates must have approval for the exact release candidate. They may protect staging/pilots while work is incomplete, but cannot be left closed for required capabilities while declaring the app fully functional. All 22 G-gates remain binding; repeated references in phases indicate evidence contributions, not multiple independent approvals. Final owner approval is in Phase 20 after Phase 19 revalidation.

A phase specification is not evidence of execution and cannot guarantee external provider/store approval. Where credentials, lawful policy, hardware or operating ownership are missing, record the concrete blocker and continue only safe independent work. Final completeness is demonstrated by the working signed app and its deployed backend/device/operating evidence—not asserted by this plan.

### 4.5 Mandatory cross-phase tests

- Route/More navigation, nested return paths, deep links, obsolete links, interrupted sheets, dirty dismissal, state restoration.
- Email OTP, cooldown/expiry, setup restart, Google/Apple first and returning login, linking, private relay, missing name, cancellation, wrong account, revoked credentials, recovery and passwordless actions.
- Double submit, lost responses, session expiry, stale authorization, cross-tenant IDs, concurrency, replay, deleted/inactive records and negative post-state.
- Upload cancellation, unknown size/MIME, HEIC conversion, oversized final bytes, unavailable iCloud files, partial uploads, expired signed URLs and orphan cleanup.
- Payment expiry, duplicate webhook, failed database/provider step, concurrent creation, cancellation races, paid reopen and receipt provenance.
- Read/unread rollback, mark-all bounds, three independent report counts, corroboration deduplication and withdrawal eligibility.
- Cache tenant/account separation, offline logout, reinstall, stale data, process termination and interrupted cleanup.
- Push foreground/background/terminated delivery, denial, Settings changes, opt-out, token rotation, account switching and expired destinations.
- Export above API row limits; required-section failure; deletion retries, retained data, Apple revocation and previously issued JWT rejection.
- VoiceOver, largest Dynamic Type, Full Keyboard Access, motion/transparency, monochrome status, contrast, compact/large iPhones and native More.
- Upgrade from an earlier iOS pilot and continued compatibility of Android/web shared contracts.

Evidence records identify source revision, build, backend versions, environment/tenant, device/OS, test, expected/observed result, artifact, date, owner and issue disposition. Earlier evidence transfers only after an explicit impact assessment.

## 5. Release gates, operating prerequisites, and final checklist

Appendix C.3 defines G01–G16 with their historical meanings and additive G17–G22 for complete parity, provider/account lifecycle, lists/persistence, diagnostics, App Store compliance and accessibility/visual parity. Its explicit feature-flag mapping is mandatory. Keep diagnostic preflight distinct from release approval.

Require development/simulator, registered-device, staging and App Store build profiles. Build with SDK 57’s supported Node/Xcode baseline; inspect the generated production binary for bundle ID, schemes, capabilities, environment, permissions and secrets. *(OD-06: builds and binary inspection Skipped; the existing `eas.json` profiles are kept unused, and generated configuration plus the exported bundle are inspected instead.)*

Add explicit release artifacts:

- Privacy manifests, required-reason API/dependency review and App Privacy disclosures.
- Discoverable account deletion, retention copy and privacy-policy/support URLs.
- Apple authentication and revocation evidence.
- Public-content moderation/filter/report/block applicability and operating ownership.
- Age rating, encryption/export compliance, icon/splash/assets/licenses and screenshots.
- Reviewer account, sample QR, payment instructions and accessible backend.
- Symbolicated native/JavaScript crash diagnostics, redaction rules, release identifiers and alerts.
- Operational dashboards for failed mutations, uploads, payments and notification delivery.
- TestFlight results, staged rollout *(both Skipped — OD-06)*, feature kill switches, backend-compatible rollback and support runbook.

Keep OTA updates disabled for the first production release. Changes ship through signed binaries until a separately approved runtime-version and rollback policy exists.

External facts remain explicit prerequisites rather than invented defaults: Apple/EAS ownership, identifiers, provider credentials, payment settlement, service verification rules, lawful retention, map processors, published support details and moderation staffing. Assign each prerequisite an owner and required evidence; missing evidence blocks the applicable gate.

### Final completion checklist

- [ ] Every current Android route, workflow, modal, preference and integration is represented; all Phase 0–Phase 20 execution exits and their assigned task contributions are verified.
- [ ] Six destinations and native More behavior pass signed-device qualification. *(Skipped — OD-06; route/configuration tests replace it.)*
- [ ] Email, Google and Apple authentication and account management pass.
- [ ] Services, payments, Reports/corroboration, Maps/emergency, Health and Settings pass complete journeys.
- [ ] Appearance, information content, read-state controls, logs and exports are preserved.
- [ ] Inbox and reliable remote notification delivery operate with named ownership.
- [ ] Backend authorization, concurrency, pagination, storage and privacy tests pass.
- [ ] All deployed migrations and contract versions are recorded.
- [ ] All temporary/private state is protected and cleaned correctly.
- [ ] The main Design System Handoff is applied consistently; A/D/DX traceability and accessibility, visual behavior and performance pass supported-device testing *(device testing Skipped — OD-06)*.
- [ ] App Store, signing, provisioning, privacy and reviewer artifacts are complete. *(Signing/provisioning/submission Skipped — OD-06; privacy and reviewer material prepared.)*
- [ ] The exact production candidate passes CI, physical-device testing and TestFlight. *(OD-06: the source candidate passes CI; physical-device testing and TestFlight Skipped.)*
- [ ] Every parity row and release gate has evidence or an explicitly approved correction for defective Android behavior.
- [ ] Remaining issues contain no unresolved Critical/High release blocker.
- [ ] Rollback, incident response and resident support have accountable owners.
- [ ] The completion statement identifies the final build and describes any approved behavioral differences accurately. *(OD-06: it identifies the final source revision and states that no signed build, device qualification, TestFlight or App Store release exists.)*

## 6. Binding detailed parity requirements and corrections

These requirements close gaps in the high-level area table. They are mandatory implementation work, not claims that the existing iOS shell already satisfies them.

### 6.1 Source baseline and scope control

The full [Android breakdown](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1) was read, including its source-only verification warning and incomplete-feature section. This revision records all 52 sections and all 1,218 bullet checkpoints in Appendix A, with a delivery phase, iOS adaptation, Android implementation anchor, source line and test family.

Baseline inspected on October 12, 2026: repository HEAD `2e5681cd329df2b70a0591895cc1e5656a55506c`; breakdown SHA-256 `4C7671C930564467C1C4F44944E6F52B9C43529B88B82F2750295CCBF68BEFC8`. Relevant Android and shared implementations were traced; this is not a signed-device or deployed-backend qualification. Unrelated, in-progress shared routing-pack/weather changes were present and are not evidence of an Android-wired capability. Preserve those changes and the cancelled Android usability work boundary.

Phase 0 must freeze a new implementation baseline, record any working-tree delta and revalidate deployment/device facts. A later Android feature must be added to the ledger before conversion sign-off. Phase 0 froze the baseline on 2026-10-13 (`phase-00/baseline.json`; HEAD and breakdown hash unchanged from the values above). On 2026-10-14 the capture review found uncommitted post-baseline Android changes (new routes `settings/valid-id.tsx` and `emergency-centers.tsx`, offline evacuation routing, deleted `osrm.ts`). By user decision OD-03 they are deferred: recorded as untriaged delta rows RD01/RD02 and added to the ledger once that Android work is committed. The breakdown is a discovery aid, not a substitute for source tracing; source/backend inconsistencies become named blockers with corrective requirements.

**Scope rule:** all working resident outcomes are required. An iOS-native equivalent may change presentation, not remove a capability, field, preference, validation, status, native action or recovery path. An intentionally excluded *working* capability requires new explicit user approval; engineering cannot approve it away. Dead code and defective outcomes use the correction register below and remain visible in traceability.

### 6.2 Services: complete charter, submission, assessment and fulfillment

Use the current [shared service schemas](/C:/Users/User/barangayan/packages/shared/src/schemas/service-foundations.ts:4), [submission attempt helper](/C:/Users/User/barangayan/packages/shared/src/lib/resident-submission.ts:1), [charter form](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:87) and [payment screen](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:15), not the earlier direct-insert iOS assumptions.

- Preserve legacy catalogue requests alongside contract-version-2 services: business, indigency, first-time job seeker, certified true copy and general. Do not assume every service has the same form or fixed fee.
- Display all charter fields: office/division, classification, transaction type, who may avail, checklist of requirements, where to secure requirements, client steps, agency actions, fees, processing time and responsible person. Display absent configured values honestly.
- Use stable purpose codes and labels, conditional explanation (maximum 1,000 characters), requester notes (maximum 1,000), and current allowed-purpose metadata. Changing purpose clears irrelevant explanation.
- Business requests retain business name/address and DTI requirement; residency certificates retain HOA requirements, renter selection and conditional lessor endorsement; switching off renter removes incompatible lessor evidence. Certified copies retain record reference and positive copy count (shared limit 1–1,000); pricing/page estimates are informational until server assessment.
- Preserve personal-appearance acknowledgment where required, and server eligibility/requirements/personal-appearance review states. A checkbox is not proof that physical attendance occurred.
- Read `approved_id_submission_id` and the verified immutable `id_submissions` version. Show type/version and private front/back previews; do not submit a pending, rejected, revoked or stale approval as valid evidence. Legacy ID upload remains only where the authoritative legacy contract permits it.
- Supporting attachments accept JPEG, PNG, WebP **and PDF**, maximum 5 MiB each, with the shared maximum of ten attachments and unique owned paths. ID photos remain image-only; concern photos retain their separate 10 MiB/five-photo limits. Validate final converted bytes and business rules before uploads where possible.
- Use `ResidentSubmissionAttempt` / `submit_service_request` for both charter and legacy workflows. Preserve the UUID idempotency key, owner and exact payload after an uncertain response; do not create a new key or silently edit/retry a possibly committed attempt. Reconcile the authoritative request ID/reference before navigating to success. No direct client insert as an alternate submission path.
- Upload supporting evidence to owned immutable `request-attachments` paths with `upsert: false`; retry may reuse a path only when the helper confirms identical stored bytes. Scope staged references to account/tenant/environment and collect unlinked orphans observably.
- Preserve requests, logs, details, status histories, review messages, attachments, fee basis and eligible cancellation. A submitted-result receipt and a **paid** receipt are different records and labels.
- Respect fixed, assessment and per-page pricing. For version 2, pending assessment has **no payable amount**; waived/free is zero; assessed uses committed centavos. Reuse [requestFee](/C:/Users/User/barangayan/packages/shared/src/lib/service-catalog.ts:103): recorded ledger amount wins; version 2 never falls back to today's catalogue fee. Preserve legitimate legacy fallback separately.
- Retain `set_service_request_payment_method`, `start_pickup_payment`, QR PH creation/status/cancellation and paid-reopen reconciliation. Fee assessment, staff collection/review and SLA transitions remain administrative operations, never new resident controls.
- Poll assessment/payment only while appropriately foregrounded/focused, dispose timers/subscriptions, and refresh on return. Method selection, request cancellation and payment settlement races must reconcile against the server.
- Generate receipt PDFs from the committed paid payment joined to the request/reference. Never trust a route-supplied amount/status. Save QR images to Photos and share PDFs with explicit success/cancel/error behavior.

### 6.3 Both processing-time models and truthful history

[Request tracking](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx:80) branches by timing model. Keep `legacy_hours` tracking and `agency_minutes_v1`; do not replace either with a generic countdown.

For agency timing, call `service_request_sla_tracking` and reuse [agency SLA calculations](/C:/Users/User/barangayan/packages/shared/src/lib/agency-sla.ts:1). Render pre-processing/running/paused/ready/released/cancelled, snapshotted target, agency time, resident waiting time, total turnaround, pause/wait reason and interval history. Use server evaluation time plus a monotonic foreground projection; refetch on foreground, clock/origin uncertainty and relevant server changes. The Android component refreshes at 15 seconds and projects each second; implementation may reduce unnecessary work without altering displayed semantics. Never run a hidden continuous timer as background truth.

The Android Logs view currently derives latest activity from request records rather than providing a complete event stream ([LogsList](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/logs-list.tsx:23)). Preserve that usable view; do not invent events or market it as a complete audit trail. If the iOS design promises full event history, provide an authoritative resident-safe event contract and test chronology/provenance.

### 6.4 Emergency, maps, location and QR distinctions

- Preserve working search, category chips, incident/center layers, boundary, center details, nearest ordering and DRRM sheet. The standalone map filter icon has no current handler; retain actual chips and implement a purposeful filter sheet if an extra filter button is displayed.
- Keep guidelines, hotlines, centers, family, QR guidance and alerts as distinct emergency sections. Alerts retain all/today/week/month/year plus custom name/day/year filtering and counts. Use tenant-aware dates and stable pagination.
- Preserve center facilities, capacity/occupancy, location/distance/travel estimates and center selection. Unknown origin, stale operational facts and provider failure must be visible, not zero-distance or apparently fresh results.
- Port the [device-location controller](/C:/Users/User/barangayan/packages/shared/src/lib/device-location.ts:1) and [six-action location card](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/location-status-card.tsx:25). Current source thresholds are 2-minute maximum automatic fix age, 50-meter accuracy, 10-second slow indication and 45-second timeout. Last-known, reduced/approximate or insufficient fixes require explicit confirmation; cancellation/background disposal invalidates late callbacks.
- Add an iOS-specific adapter: SDK 57 permission responses use `ios.accuracy` (`full`/`reduced`), not Android's coarse flag. Extend shared platform descriptions compatibly; do not modify Android UI. Handle denied, cannot-ask-again, Allow Once, return from Settings, no fix, unavailable services and manually selected origins. Allow Once is not distinguishable from normal When In Use permission in the documented response; recheck availability on return.
- The current [OSRM helper](/C:/Users/User/barangayan/packages/shared/src/lib/osrm.ts:1) uses a public demo endpoint with a `foot` URL and falls back to estimates. That URL is **not evidence of pedestrian suitability or emergency safety**. Approve a production routing/tile/geocoding processor, attribution, transfer disclosure and genuinely supported walking profile. Mark route outages and straight-line estimates unmistakably, clear old geometry after center/origin changes, and offer external navigation/list alternatives without asserting safety. **Reconciled 2026-10-16 (OD-11):** `osrm.ts` was deleted in commit `063c94d`. Android and web route through the barangay's own `evacuation-route` Edge Function (hosted v9, ACTIVE), which returns the ODbL attribution with every answer and computes walking routes on the area's road graph. iOS uses that service through the shared connected-route client; the owner approved sending the starting point to it and opened `routeService`. No third-party routing processor is used. Tiles and geocoding remain separate processors behind `mapProviders` (PR-10). A route that cannot be computed is explained in words and never drawn as a straight line; list distances without a route are labelled straight-line estimates.
- Keep three QR meanings separate: center QR display/share/save; authenticated household QR generation/display; and camera scan of a validated center QR for check-in. Never use a household QR as a center credential.
- Online check-in is resident-only and requires an authoritative committed response. Do not copy Android's queue-all-errors/clear-on-failure behavior or bulk-mark every household member checked in. If offline, keep scan data only as non-confirmed temporary state with retry guidance; it must not count toward attendance. Resolve ambiguous replies before retry.
- The reachable Family screen edits `profiles.household_members` through `useProfileHouseholdMembers`; source describes a trigger mirror to canonical `household_members`. Preserve that shared profile/Family journey, names/relationships/roles, IDs, counts, CRUD and guest restrictions. Verify the deployed mirror and preserve administrative attendance fields; do not invent a second independently editable household store. The older `useFamilyMembers`/`AddFamilyMemberModal` files have no discovered screen caller and are not additional working UI parity. Resident edits cannot forge or erase attendance.
- Weather-based routing and BFS/Dijkstra were not wired in the Android screens at the 2026-10-13 baseline; they remain a separately approved roadmap. This plan does not import that work or cancel it. On 2026-10-14 uncommitted Android work wired offline evacuation routing (Centers/Map route card, public `/emergency-centers`). Per user decision OD-03 it was deferred until committed. **Reconciled 2026-10-16:** it is committed (`063c94d`, `e860743`) and Phase 14 revalidated it (P14-T07): Android bundles a routing pack with an on-device router, a conditions snapshot store, the resident's own blocked roads and a connected route over them, while the resident web app ships the connected route only. Owner decision OD-11 builds the connected route on iOS and keeps the offline pack, conditions store and local road marking out of iOS scope for now; reopening them needs a new owner decision, after which they join the ledger.

### 6.5 Health, reports and read-state details

- Preserve medical calendar/list modes, event dots, month/day chooser, drive-type categories, selected-day/type filtering, stock/eligibility information, full-screen registration and registration-history status/detail/timeline.
- Use real supplied prior-dose dates or null according to eligibility. Never port Android's hard-coded `2025-01-01` prior dose for second/booster registration ([register.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:394)).
- The Android applicant selector can show household members, but `register_for_drive` does not receive that selected identity ([RPC call](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:443)). The approved iOS correction is self-only registration, accurate applicant labels and no false household booking. Household medical booking would require explicit product approval and a new authoritative identity/consent/eligibility contract; it cannot be declared complete by merely copying the picker.
- Preserve age 0–130 validation, PWD choice, mutually exclusive None/comorbidities, required consent and server duplicate/capacity/drive-state checks. Use the returned applicant number; never fabricate it. Keep resident-safe projections and exclude administrator-only prioritization/medical fields.
- Keep Reports' four views, all source filters and URL restoration. Incident details and announcement details must use different typed identifiers/routes.
- Keep concern title/description limits, category-specific waste zone, address/specific-area text, location picker, selected coordinates, photo reorder/remove/preview where implemented, submission feedback, corroboration count/viewer state and eligible withdrawal. Follow the shared schemas; backend rules must match client validation.
- Preserve individual and bulk resolved-report and announcement read/unread actions with rollback/error recovery. Mark-all acts on a defined authorized snapshot across pages, not merely the visible first page; newly arriving rows are not silently marked.
- Active report count is not unread count. Preserve the source's three independent signals. Inbox read status is a fourth independent concept; opening an inbox entry may navigate to/mark its related content only under the explicit content-read rule.

### 6.6 Profile, household, appearance, information and exports

Every profile/setup/household field and selector in Appendix A must remain available with equivalent validation. This includes names/middle/suffix, sex, date of birth, phone, address/locality, employment-dependent occupation, email, avatar, ID type/front/back and verification status. Keep locked locality fields locked where authoritative setup rules require it. Profile email is not automatically the authentication email. A successful demographic save followed by failed ID publication must report **partial save**, not total success or total failure.

Preserve birthday month/year/day selection and unsaved-vs-saved behavior. Use immutable ID publication versions and private previews, not public identity URLs. Approved/replaced/pending/failed/revoked status and remediation must match fresh server state.

Preserve `theme_preference`, `accent_color`, `custom_accent_colors` (maximum ten) and `font_preference`; guest choices are session-only. Keep current preset/custom color create/select/delete/preview controls, visible validation, contrast-safe foregrounds and fixed semantic danger/warning colors. Failed persistence is visibly rolled back or shown as unsaved, never quietly lost.

The Android mobile font picker has ten stable IDs ([font mapping](/C:/Users/User/barangayan/apps/resident-android-mobile/src/constants/fonts.ts:10)). Preserve those IDs and selection meaning:

| Persisted mobile font ID | iOS equivalent / fallback requirement |
|---|---|
| `system`, `inter` | System font, matching existing native fallback; do not claim bundled Inter exists. |
| `arial`, `helvetica`, `verdana` | Qualified available Arial / Helvetica Neue / Verdana family. |
| `segoe-ui`, `tahoma` | Explicit system fallback, matching the source's iOS mapping. |
| `trebuchet-ms`, `georgia`, `times-new-roman` | Qualified available Trebuchet MS / Georgia / Times New Roman. |

Verify availability and weights on supported iOS builds; gracefully fall back. Do not download unlicensed faces or add web-only Garamond/Courier New as mandatory mobile parity. All choices must support Dynamic Type, accessible labels and untruncated critical content.

Retain Help's seven categories and article detail/rich text; separate Terms/Privacy, About mission/vision/history/contact/developer cards, bundled branding and configured content. Use actual binary version/build. All content, hotline fallbacks and support details need an accountable publisher and reviewed date.

Data export preserves PDF/JSON chooser, cooldown/progress/errors and native sharing. Define account/profile, household representations, service requests/history/payments where applicable, concerns, medical registrations, check-ins, device metadata and relevant preference/read-state coverage in an approved versioned inventory. The existing endpoint is a baseline, not proof of completeness. Page every required section, validate the result and refuse a falsely complete partial export. Avoid raw tokens, private storage URLs, unnecessary medical exposure and retained temporary files.

Deletion needs a written retain/anonymize/delete matrix, linked-identity handling, Apple revocation, idempotent retry and post-deletion access denial. A long ban plus anonymization alone is not permanent auth deletion. Copy must describe retained lawful records accurately. Logout must remove local private data and token ownership despite offline conditions and cannot allow a second account to inherit an unfinished sensitive operation.

### 6.7 SDK 57-native qualification and production controls

The exact [SDK 57 index](https://docs.expo.dev/versions/v57.0.0/) specifies React Native 0.86, React 19.2.3, Node 22.13.x minimum, iOS 16.4+ and Xcode 26.4+. Resolve compatible dependencies using SDK 57 tooling, pin the qualified lockfile, and verify generated native configuration. Do not mix remembered APIs from earlier Expo releases.

| Integration | Versioned authority and required qualification |
|---|---|
| Six native tabs and More | [SDK 57 Native tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/). The documented module is `expo-router/unstable-native-tabs`; prove the approved six-destination/More design in a signed build, including overflow links, badge behavior and Settings stack. |
| Document uploads | [SDK 57 DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/). Use `copyToCacheDirectory: true` when immediate file-system access is required; handle cancellation/iCloud materialization and validate actual bytes. |
| File operations | [SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/). Prefer current `File`/`Directory`/`Paths`; use a legacy import only after explicit qualification. Do not import deprecated throwing methods from the new main module. |
| QR image save | [SDK 57 MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/). Qualify `Asset.create(localUri)`, save permission and failure/cancel cleanup; do not request broad library read merely to save a QR. |
| PDF and native share | [SDK 57 Print](https://docs.expo.dev/versions/v57.0.0/sdk/print/), [Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/). Inline local image data for iOS HTML printing; use cache output and safe lifetime/cleanup after sharing. |
| Device location | [SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/). Foreground-only `locationWhenInUsePermission`; reduced accuracy and Allow Once semantics; no background-location entitlement added by this plan. |
| Camera and images | [SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/). Qualify scanner permission/preview ownership, least-privilege selection, HEIC conversion and final-size/metadata handling. |
| Credentials and auth | [SDK 57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/), [AppleAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/), [AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/), [WebBrowser](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/). Test Keychain storage failures/reinstall, Google callbacks and Apple nonce/revocation. |
| Notifications | [SDK 57 Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/). Package/plugin, APNs/EAS ownership, rebuilt signed binary, sender/outbox and response listeners must all exist; foreground realtime alone is insufficient. *(APNs/EAS credentials and the signed binary Skipped — OD-06)* |
| Maps and captures | [SDK 57 WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/), [ViewShot](https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/). Pin WebView/Leaflet/QR/capture dependencies, validate bridge payloads, limit resources/navigation and prove actual QR output. Do not switch to the alpha Expo Maps API just because it is listed. |
| Fonts and app identity | [SDK 57 Font](https://docs.expo.dev/versions/v57.0.0/sdk/font/), [Application](https://docs.expo.dev/versions/v57.0.0/sdk/application/), [app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/). Inspect icon/splash/font resources, bundle ID, schemes, version/build and configured permissions in the compiled binary. |

Audit applicable generated Info.plist entries: camera purpose; When In Use location purpose; Photos access/add purpose only where needed; permitted URL schemes queried; supported orientations; HTTPS/ATS policy; app identity. Apple sign-in and APNs require capabilities, matching entitlements, signing/provisioning and release credentials. Universal links require domain ownership/associated-domains/AASA evidence if adopted; otherwise test the explicit custom-scheme contract. Avoid blanket ATS exceptions and unnecessary camera microphone, background location or unrelated permissions. Document picker/iCloud container capabilities are required only if the chosen enabled configuration needs them.

Do not assume App Store compliance from Expo compatibility. At release freeze the owner must verify then-current App Store rules, privacy manifests/required-reason APIs, privacy labels, deletion and provider-login rules, user-generated-content safeguards, review information and signing requirements. Record compliance evidence and sources; this document does not claim a store approval.

No analytics provider is mandated by Android parity. Inventory actual existing diagnostics; add production crash/error redaction and operational monitoring without logging identity photos, health fields, OTPs, passwords, auth tokens, precise coordinates or export contents. Analytics/tracking requires an explicit lawful purpose, consent/disclosure review and no invented tracking requirement.

### 6.8 Explicit partial, defective and platform-adaptation register

These are not exclusions of working capabilities. This register controls interpretation of corresponding source checkpoints.

| Checkpoints / evidence | Android state | Binding iOS disposition |
|---|---|---|
| A52-001 / A52-002 | Home/Services search inputs are unwired. | Implement defined functional search in Services and Home if shown; specify searchable sources, authorization, debouncing, cancellation and no-results. Do not ship a decorative typeable input. |
| A52-003 | Map filter icon is inert; chips work. | Preserve working chips; connect a filter sheet or omit the redundant inert icon with functional filtering retained. |
| A44-018 / A52-004 | SMS switch is local-only, not operational opt-in. | Keep a clearly disabled/unavailable SMS preference explanation unless an explicitly approved consent/provider backend is built. Do not claim delivery or store fake consent. This does not relax remote-push completion. |
| A52-005 | QR PH is settlement-config conditional. | Complete/qualify real settlement for full conversion; honest gating is permissible only for a labeled limited pilot, not final parity sign-off. |
| A52-006 / A52-007 | Standalone Maps hotline/guide routes are placeholders. | Redirect to implemented Emergency Hub sections, preserving links and all real hotline/guideline functions. |
| A51-027 / A52-008; use-qr-checkins.ts | Failed check-ins are queued; automatic sync caller absent and failed entries can be discarded. | Approved correction: online resident-only check-in, no false success, authoritative reconciliation and explicit offline guidance. An offline attendance queue is not required by working parity. |
| A52-009 | Notification-response helper has no connected screen-opening caller. | Implement validated cold/warm notification navigation and deduplication under G13. |
| A30-002 / A30-005 and related applicant controls; health/register.tsx:443 | Household choice is not sent to registration RPC. | Approved self-only correction; keep useful profile/applicant display/edit controls for self. Household-specific selectable registration is not falsely marked fulfilled; ledger records **corrective equivalent**, not identical parity. |
| Health prior-dose controls; health/register.tsx:394 | Second/booster dose uses a fabricated historical date. | Require actual supplied prior-dose date or authoritative null; no fabricated medical data. |
| A52-010 | Old health registration modal is unreachable. | Use the reachable full-screen registration flow; no duplicate dead modal needed. |
| A52-011 | Intro routes exist but signed-out root enters account choice. | Preserve account-choice root; retain introductory screens through an intentional first-run/Help entry and documented returning-user behavior. |
| A52-012 | Weather/BFS/Dijkstra not connected to Android screens at the 2026-10-13 baseline; wired in uncommitted work on 2026-10-14. | No current parity claim or automatic import of separate routing roadmap. Deferred by OD-03 until committed; committed `063c94d`/`e860743` and revalidated by P14-T07 (2026-10-16). OD-11: connected route built on iOS; the offline pack, conditions store and local road marking stay out of iOS scope for now. |
| Android capture defects (2026-10-14 review) | Facility chips print icon names (`evacuation-center-card.tsx:113`); blank household QR; empty email in recovery-code step; URL-encoded login email; low dark-mode contrast on announcement cards. | Do not port. iOS renders icons with labels, proves QR output (P15-T05), validates/decodes link parameters (P04), and passes G22 contrast. |
| A51 Android picker/content permission checkpoints | Android-specific URI handling. | Native iOS picker/cache/security-scoped lifetime equivalent, not Android API calls. |
| A01/A50 Android back/dialog/gallery conventions | Platform-specific presentation. | iOS back/swipe/sheets/share/Photos equivalents with the same resident outcome, dirty-state protection and accessible focus. |
| A18 service logs; logs-list.tsx:23 | Latest request activity is derived, not a full audit stream. | Preserve truthful latest-activity view; require real events before promising a complete audit history. |

No item in this table is an implemented iOS outcome merely because the correction is written down. Each needs the linked implementation/test evidence. New functional exclusions or broader household medical/check-in semantics require explicit user approval.

## Appendix A — Exhaustive Android-to-iOS parity ledger

This ledger imports **all 52 sections and 1,218 bullet checkpoints** from the supplied breakdown. Bullet checkpoints include group headings and individual options; they are not a claim of 1,218 independent features. Source wording is retained so no small control disappears during conversion. These are **unverified iOS acceptance checkpoints**, not completion claims. A checkbox may close only with its iOS implementation locator, disposition, owner, and passing evidence recorded in Appendix C. For Android-specific mechanisms, apply the stated iOS equivalent. For defective, unreachable or conditional behavior, apply §6.8 rather than recreating the defect. No working capability is silently excluded.

Source-level implementation is not proof of live-backend or device behavior. Each section must be rechecked at implementation freeze; new Android/shared changes require an additive ledger delta, never a silent narrowing of scope.

### A01 — App startup and navigation

**Source:** [breakdown §1, line 5](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:5); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/_layout.tsx:27).

**Delivery:** Phase 1; supporting Phases 2, 4, 19–20; Root and six tab destinations. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Reproduce session-gated startup, retry/error routing, splash/font readiness and guest/private route guards. Replace Android Back behavior with iOS back/swipe and native More while retaining destination and stack state.

**Acceptance family T01:** Cold start, failed restoration, signed-out/private deep link, tab/More re-entry, account switch and background resume. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (36):**

- [ ] **A01-001** Display the Barangayan splash screen. *(source L7)*
- [ ] **A01-002** Animate the splash screen while the app initializes. *(source L8)*
- [ ] **A01-003** Load the app’s bundled fonts. *(source L9)*
- [ ] **A01-004** Restore the previous sign-in session. *(source L10)*
- [ ] **A01-005** Wait for session restoration before choosing the destination screen. *(source L11)*
- [ ] **A01-006** Show an error when session restoration fails. *(source L12)*
- [ ] **A01-007** Provide a **Retry session restoration** button. *(source L13)*
- [ ] **A01-008** Choose the starting screen based on: *(source L14)*
- [ ] **A01-009** Signed-in status. *(source L15)*
- [ ] **A01-010** Guest mode. *(source L16)*
- [ ] **A01-011** Account setup progress. *(source L17)*
- [ ] **A01-012** Password recovery state. *(source L18)*
- [ ] **A01-013** Incoming authentication callback. *(source L19)*
- [ ] **A01-014** Handle Google authentication links, including links received during a cold start. *(source L20)*
- [ ] **A01-015** Route residents to unfinished account setup when required. *(source L21)*
- [ ] **A01-016** Provide six bottom navigation tabs: *(source L22)*
- [ ] **A01-017** Home. *(source L23)*
- [ ] **A01-018** Services. *(source L24)*
- [ ] **A01-019** Maps. *(source L25)*
- [ ] **A01-020** Health. *(source L26)*
- [ ] **A01-021** Reports. *(source L27)*
- [ ] **A01-022** Settings. *(source L28)*
- [ ] **A01-023** Display a label and icon for each tab. *(source L29)*
- [ ] **A01-024** Highlight the selected tab. *(source L30)*
- [ ] **A01-025** Change selected icons from outline to filled versions. *(source L31)*
- [ ] **A01-026** Animate the selected tab’s highlight and icon. *(source L32)*
- [ ] **A01-027** Provide pressed-state feedback. *(source L33)*
- [ ] **A01-028** Display three separate Reports badges: *(source L34)*
- [ ] **A01-029** Active incident count. *(source L35)*
- [ ] **A01-030** Unread resolved incident count. *(source L36)*
- [ ] **A01-031** Unread announcement count. *(source L37)*
- [ ] **A01-032** Hide count badges when their count is zero. *(source L38)*
- [ ] **A01-033** Keep those counts updating while the resident uses other tabs. *(source L39)*
- [ ] **A01-034** Provide back navigation on detail and form screens. *(source L40)*
- [ ] **A01-035** Support screen-specific links that open a particular subsection. *(source L41)*
- [ ] **A01-036** Account for Android status bars and bottom safe areas. *(source L42)*

### A02 — Introductory and onboarding screens

**Source:** [breakdown §2, line 46](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:46); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/welcome.tsx:7).

**Delivery:** Phase 6; Welcome → value proposition → personalization → completion. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain every introductory screen and preference/control. Explicitly offer a first-run/Help entry without changing the signed-out account-choice default or trapping returning residents.

**Acceptance family T02:** First install, skip/back, interrupted introduction, reduced motion and returning resident. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (14):**

- [ ] **A02-001** Welcome screen with Barangayan branding. *(source L50)*
- [ ] **A02-002** Introduction to the app’s benefits. *(source L51)*
- [ ] **A02-003** Feature explanation cards. *(source L52)*
- [ ] **A02-004** Appearance personalization screen. *(source L53)*
- [ ] **A02-005** Three-step progress indicators. *(source L54)*
- [ ] **A02-006** **Continue** buttons. *(source L55)*
- [ ] **A02-007** **Get started** button on the last introductory step. *(source L56)*
- [ ] **A02-008** Light-mode selection. *(source L57)*
- [ ] **A02-009** Dark-mode selection. *(source L58)*
- [ ] **A02-010** Preset accent-color selection. *(source L59)*
- [ ] **A02-011** Immediate appearance previews. *(source L60)*
- [ ] **A02-012** Confirmation messages when appearance or accent color changes. *(source L61)*
- [ ] **A02-013** Animated screen content. *(source L62)*
- [ ] **A02-014** Scrollable content for smaller screens. *(source L63)*

### A03 — Account choice and guest browsing

**Source:** [breakdown §3, line 65](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:65); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/auth-choice.tsx:18).

**Delivery:** Phase 4; supporting Phase 1; Authentication choice and guest browsing. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep guest public viewing and action-specific login prompts; restore the authorized intended action only after setup. Guest state must never create an authenticated mutation.

**Acceptance family T03:** All public destinations and gated actions, sign-in return, cancelled sign-in and forbidden guest links. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (11):**

- [ ] **A03-001** Choose **Create an Account**. *(source L67)*
- [ ] **A03-002** Choose **I’m a Resident, Log In**. *(source L68)*
- [ ] **A03-003** Enter guest browsing through the guest controls. *(source L69)*
- [ ] **A03-004** Browse public information without a resident session. *(source L70)*
- [ ] **A03-005** Display guest-specific login prompts. *(source L71)*
- [ ] **A03-006** Replace personal account information with guest content. *(source L72)*
- [ ] **A03-007** Prompt guests to sign in before accessing personal requests or activity. *(source L73)*
- [ ] **A03-008** Require an account for emergency QR functions. *(source L74)*
- [ ] **A03-009** Require sign-in for medical-drive registration. *(source L75)*
- [ ] **A03-010** Route guests to login from protected actions. *(source L76)*
- [ ] **A03-011** Allow guests to access appearance preferences and public help information. *(source L77)*

### A04 — Email registration

**Source:** [breakdown §4, line 79](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:79); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/register.tsx:17).

**Delivery:** Phase 4; Email registration and OTP. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve current validation, locality selection, verification, resend deadlines and existing-account handling. No client-only assertion that OTP was accepted.

**Acceptance family T04:** Valid/invalid email, expiry, cooldown, duplicate tap, uncertain send/verify outcome, process restart and locality failure. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (23):**

- [ ] **A04-001** Enter an email address. *(source L81)*
- [ ] **A04-002** Use an email-appropriate keyboard. *(source L82)*
- [ ] **A04-003** Disable automatic capitalization for email entry. *(source L83)*
- [ ] **A04-004** Validate registration input. *(source L84)*
- [ ] **A04-005** Request an email confirmation code. *(source L85)*
- [ ] **A04-006** Display the code-entry step. *(source L86)*
- [ ] **A04-007** Enter a six-digit code. *(source L87)*
- [ ] **A04-008** Remove nonnumeric characters from code input. *(source L88)*
- [ ] **A04-009** Limit input to six digits. *(source L89)*
- [ ] **A04-010** Support operating-system code autofill. *(source L90)*
- [ ] **A04-011** Disable verification until six digits are entered. *(source L91)*
- [ ] **A04-012** Verify the code and continue account creation. *(source L92)*
- [ ] **A04-013** Display request and verification errors. *(source L93)*
- [ ] **A04-014** Resend a confirmation code. *(source L94)*
- [ ] **A04-015** Display the resend cooldown. *(source L95)*
- [ ] **A04-016** Disable resend while the cooldown is active. *(source L96)*
- [ ] **A04-017** Preserve cooldown timing through the supporting registration logic. *(source L97)*
- [ ] **A04-018** Change the email address and return to the email step. *(source L98)*
- [ ] **A04-019** Open login for an existing account. *(source L99)*
- [ ] **A04-020** Continue registration with Google. *(source L100)*
- [ ] **A04-021** Show loading feedback. *(source L101)*
- [ ] **A04-022** Disable conflicting actions while a request is running. *(source L102)*
- [ ] **A04-023** Prevent overlapping authentication requests. *(source L103)*

### A05 — Login and Google authentication

**Source:** [breakdown §5, line 105](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:105); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/login.tsx:26).

**Delivery:** Phase 4; Email/password, Google and Apple sign-in. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve Google and password flows and errors; add Apple without sacrificing either existing provider. Bind callbacks and provider reauthentication to the same current account.

**Acceptance family T05:** New/returning provider, cancellation, wrong account, callback replay, offline login and account setup return. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (17):**

- [ ] **A05-001** Sign in with email and password. *(source L107)*
- [ ] **A05-002** Mask password characters. *(source L108)*
- [ ] **A05-003** Show or hide the password. *(source L109)*
- [ ] **A05-004** Submit the login form. *(source L110)*
- [ ] **A05-005** Display readable login errors. *(source L111)*
- [ ] **A05-006** Show loading feedback during sign-in. *(source L112)*
- [ ] **A05-007** Open password recovery. *(source L113)*
- [ ] **A05-008** Open registration from login. *(source L114)*
- [ ] **A05-009** Sign in with Google. *(source L115)*
- [ ] **A05-010** Process the Google browser callback. *(source L116)*
- [ ] **A05-011** Handle cancelled, incomplete, or failed Google authentication. *(source L117)*
- [ ] **A05-012** Establish or load the resident profile after Google authentication. *(source L118)*
- [ ] **A05-013** Prefill supported name information from Google. *(source L119)*
- [ ] **A05-014** Distinguish Google signup from Google sign-in. *(source L120)*
- [ ] **A05-015** Link Google to an existing account through the available profile control. *(source L121)*
- [ ] **A05-016** Use Google identity confirmation for supported sensitive actions. *(source L122)*
- [ ] **A05-017** Prevent earlier authentication responses from changing a newer account/session flow. *(source L123)*

### A06 — Resident account setup

**Source:** [breakdown §6, line 125](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:125); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/account-setup.tsx:12).

**Delivery:** Phase 4; Resident setup and complete-profile entry. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Use server setup status for mandatory email setup and optional provider progression. Preserve detail/map steps, save/skip rules, conflict/retry and interrupted progress; never infer readiness from local form state.

**Acceptance family T06:** Every setup state, mandatory/optional steps, locality loading, stale status, conflict, partial/unknown commit and foreground refresh. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (36):**

- [ ] **A06-001** Check whether resident profile setup is complete. *(source L127)*
- [ ] **A06-002** Check whether the account has a password. *(source L128)*
- [ ] **A06-003** Determine the next setup step. *(source L129)*
- [ ] **A06-004** Collect: *(source L130)*
- [ ] **A06-005** First name. *(source L131)*
- [ ] **A06-006** Last name. *(source L132)*
- [ ] **A06-007** Optional middle name. *(source L133)*
- [ ] **A06-008** Optional suffix. *(source L134)*
- [ ] **A06-009** Sex. *(source L135)*
- [ ] **A06-010** Date of birth. *(source L136)*
- [ ] **A06-011** Mobile number. *(source L137)*
- [ ] **A06-012** House number. *(source L138)*
- [ ] **A06-013** Street. *(source L139)*
- [ ] **A06-014** Employment status. *(source L140)*
- [ ] **A06-015** Optional occupation, where applicable. *(source L141)*
- [ ] **A06-016** Display account email and assigned locality information. *(source L142)*
- [ ] **A06-017** Display barangay, city, and province information. *(source L143)*
- [ ] **A06-018** Mark required fields. *(source L144)*
- [ ] **A06-019** Validate names and mobile numbers. *(source L145)*
- [ ] **A06-020** Display field-level errors and success feedback. *(source L146)*
- [ ] **A06-021** Select sex and employment through choice controls. *(source L147)*
- [ ] **A06-022** Open the birthday calendar. *(source L148)*
- [ ] **A06-023** Confirm personal details. *(source L149)*
- [ ] **A06-024** Proceed to password creation when required. *(source L150)*
- [ ] **A06-025** Allow **Skip for now** in optional setup flows. *(source L151)*
- [ ] **A06-026** Allow sign-out from setup. *(source L152)*
- [ ] **A06-027** Refresh account setup status. *(source L153)*
- [ ] **A06-028** Retry failed setup-status checks. *(source L154)*
- [ ] **A06-029** Reload the current profile when it changed elsewhere. *(source L155)*
- [ ] **A06-030** Detect conflicting or uncertain profile saves. *(source L156)*
- [ ] **A06-031** Require review of current data before another save after a conflict. *(source L157)*
- [ ] **A06-032** Preserve password draft state within the owned setup flow. *(source L158)*
- [ ] **A06-033** Offer **Check whether this password was saved** after an uncertain password request. *(source L159)*
- [ ] **A06-034** Offer password recovery when needed. *(source L160)*
- [ ] **A06-035** Prevent leaving or starting conflicting actions while a setup request is finishing. *(source L161)*
- [ ] **A06-036** Return to the originally requested service after profile completion. *(source L162)*

### A07 — Password creation and recovery

**Source:** [breakdown §7, line 166](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:166); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx:14).

**Delivery:** Phase 4; Password creation, OTP recovery and reset. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain password validation, confirmation, visibility and recovery code/deadline controls. Distinguish new-password setup, changing a password and recovery; clear secrets on dismissal/logout.

**Acceptance family T07:** Passwordless/legacy/provider accounts, expired/replayed recovery, double submit, same-account proof and restart. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (26):**

- [ ] **A07-001** Create a password. *(source L168)*
- [ ] **A07-002** Confirm the password. *(source L169)*
- [ ] **A07-003** Show or hide each password field independently. *(source L170)*
- [ ] **A07-004** Display password requirements. *(source L171)*
- [ ] **A07-005** Check that confirmation matches. *(source L172)*
- [ ] **A07-006** Validate requirements including: *(source L173)*
- [ ] **A07-007** At least eight characters. *(source L174)*
- [ ] **A07-008** An uppercase letter. *(source L175)*
- [ ] **A07-009** A number. *(source L176)*
- [ ] **A07-010** A special character. *(source L177)*
- [ ] **A07-011** Request a password-reset email code. *(source L178)*
- [ ] **A07-012** Enter the recovery email. *(source L179)*
- [ ] **A07-013** Display email and request errors. *(source L180)*
- [ ] **A07-014** Enter the recovery code. *(source L181)*
- [ ] **A07-015** Verify the recovery code. *(source L182)*
- [ ] **A07-016** Resend the recovery code. *(source L183)*
- [ ] **A07-017** Display resend timing. *(source L184)*
- [ ] **A07-018** Open the new-password screen after verification. *(source L185)*
- [ ] **A07-019** Enter and confirm a new password. *(source L186)*
- [ ] **A07-020** Show live requirement indicators. *(source L187)*
- [ ] **A07-021** Update the password. *(source L188)*
- [ ] **A07-022** Show update success or failure. *(source L189)*
- [ ] **A07-023** Restart password recovery when necessary. *(source L190)*
- [ ] **A07-024** Cancel recovery and return to the appropriate account screen. *(source L191)*
- [ ] **A07-025** Preserve a limited recovery-flow hint across app restarts. *(source L192)*
- [ ] **A07-026** Prevent overlapping recovery requests. *(source L193)*

### A08 — Home dashboard

**Source:** [breakdown §8, line 195](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:195); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/index.tsx:55).

**Delivery:** Phase 18; Home. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep all quick actions, request/news cards, dynamic name and verification/profile prompts. Make search genuinely work or omit the nonfunctional affordance; keep the bell’s existing announcement destination as well as the new inbox entry.

**Acceptance family T08:** Guest/signed-in, empty/error/stale data, each quick action/card, unread counts and overflow access. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (28):**

- [ ] **A08-001** Display Barangayan branding. *(source L197)*
- [ ] **A08-002** Display the signed-in resident’s name. *(source L198)*
- [ ] **A08-003** Display the resident’s avatar. *(source L199)*
- [ ] **A08-004** Use a fallback avatar when no image is available. *(source L200)*
- [ ] **A08-005** Display the resident’s barangay. *(source L201)*
- [ ] **A08-006** Show a login entry for guests. *(source L202)*
- [ ] **A08-007** Display the profile-completion banner when applicable. *(source L203)*
- [ ] **A08-008** Open profile completion from the banner. *(source L204)*
- [ ] **A08-009** Display the announcement notification bell. *(source L205)*
- [ ] **A08-010** Display the unread announcement count. *(source L206)*
- [ ] **A08-011** Open the Announcements subsection when the bell is tapped. *(source L207)*
- [ ] **A08-012** Display a typeable search box — **currently no search behavior is connected here**. *(source L208)*
- [ ] **A08-013** Provide quick actions: *(source L209)*
- [ ] **A08-014** Request Document. *(source L210)*
- [ ] **A08-015** Report Issue. *(source L211)*
- [ ] **A08-016** Emergency Info. *(source L212)*
- [ ] **A08-017** Medical Info. *(source L213)*
- [ ] **A08-018** Display up to three recent personal service requests. *(source L214)*
- [ ] **A08-019** Display each request’s document name. *(source L215)*
- [ ] **A08-020** Display its reference number. *(source L216)*
- [ ] **A08-021** Display its status badge. *(source L217)*
- [ ] **A08-022** Open request tracking by tapping a request. *(source L218)*
- [ ] **A08-023** Provide **View All** for requests. *(source L219)*
- [ ] **A08-024** Show an empty-request message. *(source L220)*
- [ ] **A08-025** Show a guest prompt for personal requests. *(source L221)*
- [ ] **A08-026** Display the latest announcement preview. *(source L222)*
- [ ] **A08-027** Format same-day announcement timestamps with **TODAY**. *(source L223)*
- [ ] **A08-028** Open the announcements area from the preview/action. *(source L224)*

### A09 — Services catalog

**Source:** [breakdown §9, line 226](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:226); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/index.tsx:40).

**Delivery:** Phase 7; Requests/Logs integration Phase 9; Services: Documents / Requests / Logs. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve catalogue segments/cards, fee/time wording and active filtering. Provide functional text search with documented fields and no-results state; do not copy the disconnected Android search.

**Acceptance family T09:** All segments, search/filter combinations, refresh, empty/no-results, pagination and inactive/deleted catalogue entry. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (21):**

- [ ] **A09-001** Switch between: *(source L228)*
- [ ] **A09-002** Documents. *(source L229)*
- [ ] **A09-003** Requests. *(source L230)*
- [ ] **A09-004** Logs. *(source L231)*
- [ ] **A09-005** Update the search placeholder for the selected subsection. *(source L232)*
- [ ] **A09-006** Display a typeable search box — **currently not connected to filtering**. *(source L233)*
- [ ] **A09-007** Load active, nondeleted document types. *(source L234)*
- [ ] **A09-008** Display available document cards. *(source L235)*
- [ ] **A09-009** Display document names. *(source L236)*
- [ ] **A09-010** Display document icons. *(source L237)*
- [ ] **A09-011** Display prices or fee labels. *(source L238)*
- [ ] **A09-012** Display processing information where supplied. *(source L239)*
- [ ] **A09-013** Open a document’s details. *(source L240)*
- [ ] **A09-014** Display catalog loading state. *(source L241)*
- [ ] **A09-015** Display an empty catalog message. *(source L242)*
- [ ] **A09-016** Display catalog-loading errors. *(source L243)*
- [ ] **A09-017** Retry loading the catalog. *(source L244)*
- [ ] **A09-018** Display ID-verification status. *(source L245)*
- [ ] **A09-019** Open the profile’s ID section using **Verify Now**. *(source L246)*
- [ ] **A09-020** Retry a failed verification check. *(source L247)*
- [ ] **A09-021** Provide a shortcut back to the Documents subsection. *(source L248)*

### A10 — Document requirements and guidelines

**Source:** [breakdown §10, line 252](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:252); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/[documentId].tsx:80).

**Delivery:** Phase 7; Apply/form integration Phase 8; Service detail and charter. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Render legacy requirements and all eleven charter fields, purpose/rule metadata, pricing mode and processing target. Missing configured values are explicit, never invented.

**Acceptance family T10:** Every service kind, incomplete charter, inactive/deleted item, approved-ID gate and Apply/back. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (25):**

- [ ] **A10-001** Display the document name. *(source L254)*
- [ ] **A10-002** Display the description. *(source L255)*
- [ ] **A10-003** Display the fee or pricing rule. *(source L256)*
- [ ] **A10-004** Display the requirements list. *(source L257)*
- [ ] **A10-005** Display estimated processing time. *(source L258)*
- [ ] **A10-006** Expand or collapse additional notes. *(source L259)*
- [ ] **A10-007** Display guidance about original documents and barangay-hall verification. *(source L260)*
- [ ] **A10-008** For services using the newer charter contract, display: *(source L261)*
- [ ] **A10-009** Office/division. *(source L262)*
- [ ] **A10-010** Classification. *(source L263)*
- [ ] **A10-011** Transaction type. *(source L264)*
- [ ] **A10-012** Who may avail. *(source L265)*
- [ ] **A10-013** Checklist of requirements. *(source L266)*
- [ ] **A10-014** Where to secure requirements. *(source L267)*
- [ ] **A10-015** Client steps. *(source L268)*
- [ ] **A10-016** Agency actions. *(source L269)*
- [ ] **A10-017** Fees to be paid. *(source L270)*
- [ ] **A10-018** Processing time. *(source L271)*
- [ ] **A10-019** Person responsible. *(source L272)*
- [ ] **A10-020** Select **Request This Document**. *(source L273)*
- [ ] **A10-021** Show **Log In to Request** for guests. *(source L274)*
- [ ] **A10-022** Display document-loading skeletons. *(source L275)*
- [ ] **A10-023** Display a document-not-found state. *(source L276)*
- [ ] **A10-024** Retry failed detail loading. *(source L277)*
- [ ] **A10-025** Return to Services. *(source L278)*

### A11 — Document request forms

**Source:** [breakdown §11, line 280](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:280); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:87).

**Delivery:** Phase 8; detail/payment continuation Phases 9–10; Service application → review → authoritative result. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Implement both current charter and legacy submission paths through the shared idempotent operation. Include approved ID version, all conditional fields/files, purpose explanation and appearance acknowledgment; retain attempt identity across ambiguous replies.

**Acceptance family T11:** All service kinds and rule combinations, rejected/unapproved ID, PDF/image limits, renter toggle cleanup, interrupted uploads and lost submit response. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (45):**

- [ ] **A11-001** Check profile completion before opening protected submission forms. *(source L282)*
- [ ] **A11-002** Display resident name and mobile number. *(source L283)*
- [ ] **A11-003** Open Profile to correct resident information. *(source L284)*
- [ ] **A11-004** Display the service name and pricing information. *(source L285)*
- [ ] **A11-005** Support both newer charter-based forms and the legacy request form. *(source L286)*
- [ ] **A11-006** Require a verified profile ID before submission. *(source L290)*
- [ ] **A11-007** Display the approved ID type and version. *(source L291)*
- [ ] **A11-008** Preview approved front and back ID images. *(source L292)*
- [ ] **A11-009** Refresh ID-verification status. *(source L293)*
- [ ] **A11-010** Choose a configured request purpose. *(source L294)*
- [ ] **A11-011** Cancel purpose selection. *(source L295)*
- [ ] **A11-012** Enter a purpose explanation when required. *(source L296)*
- [ ] **A11-013** Display an explanation character counter. *(source L297)*
- [ ] **A11-014** Enter optional additional notes. *(source L298)*
- [ ] **A11-015** Enter business name for business services. *(source L299)*
- [ ] **A11-016** Enter establishment address. *(source L300)*
- [ ] **A11-017** Attach DTI registration where applicable. *(source L301)*
- [ ] **A11-018** Attach HOA certification where applicable. *(source L302)*
- [ ] **A11-019** Select **I am a renter**. *(source L303)*
- [ ] **A11-020** Attach lessor endorsement when applicable. *(source L304)*
- [ ] **A11-021** Remove the lessor attachment when renter status is switched off. *(source L305)*
- [ ] **A11-022** Enter a record/document reference for certified true copies. *(source L306)*
- [ ] **A11-023** Enter the number of copies. *(source L307)*
- [ ] **A11-024** Display the page-based fee explanation. *(source L308)*
- [ ] **A11-025** Acknowledge required personal appearance. *(source L309)*
- [ ] **A11-026** Choose supporting documents. *(source L310)*
- [ ] **A11-027** Display selected filenames. *(source L311)*
- [ ] **A11-028** Replace selected supporting files. *(source L312)*
- [ ] **A11-029** Remove selected supporting files. *(source L313)*
- [ ] **A11-030** Accept JPG, PNG, WEBP, or PDF supporting documents. *(source L314)*
- [ ] **A11-031** Enforce the supporting-file size limit of 5 MB. *(source L315)*
- [ ] **A11-032** Validate service-specific requirements. *(source L316)*
- [ ] **A11-033** Display submission errors. *(source L317)*
- [ ] **A11-034** Disable submission while required verification is missing. *(source L318)*
- [ ] **A11-035** Show submission progress. *(source L319)*
- [ ] **A11-036** Prevent duplicate submissions with request-attempt keys. *(source L320)*
- [ ] **A11-037** Open the assessment/payment screen after successful submission. *(source L321)*
- [ ] **A11-038** Enter purpose/notes. *(source L325)*
- [ ] **A11-039** Display resident-information chips. *(source L326)*
- [ ] **A11-040** Choose an ID image. *(source L327)*
- [ ] **A11-041** Preview the selected image. *(source L328)*
- [ ] **A11-042** Upload it again to replace the selection. *(source L329)*
- [ ] **A11-043** Validate the file type and 5 MB size limit. *(source L330)*
- [ ] **A11-044** Upload evidence before creating the request. *(source L331)*
- [ ] **A11-045** Continue to payment after submission. *(source L332)*

### A12 — Personal request list

**Source:** [breakdown §12, line 336](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:336); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/requests-list.tsx:100).

**Delivery:** Phase 9; Personal Requests list. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep own requests, counts, status/date/document filters, list/card data and detail navigation. Use stable incremental pagination and separate true empty, filtered empty, load error and offline cache.

**Acceptance family T12:** All statuses, duplicate realtime rows, changed/deleted rows, filter restoration and more-than-one-page data. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (24):**

- [ ] **A12-001** Load the resident’s own service requests. *(source L338)*
- [ ] **A12-002** Display request cards. *(source L339)*
- [ ] **A12-003** Display document names. *(source L340)*
- [ ] **A12-004** Display reference numbers. *(source L341)*
- [ ] **A12-005** Display dates. *(source L342)*
- [ ] **A12-006** Display status labels and colors. *(source L343)*
- [ ] **A12-007** Open a request’s tracking screen. *(source L344)*
- [ ] **A12-008** Filter by: *(source L345)*
- [ ] **A12-009** All. *(source L346)*
- [ ] **A12-010** Active. *(source L347)*
- [ ] **A12-011** Pickup. *(source L348)*
- [ ] **A12-012** History. *(source L349)*
- [ ] **A12-013** Further filter Active requests by: *(source L350)*
- [ ] **A12-014** All. *(source L351)*
- [ ] **A12-015** Pending Payment. *(source L352)*
- [ ] **A12-016** Paid. *(source L353)*
- [ ] **A12-017** Processing. *(source L354)*
- [ ] **A12-018** Reset relevant subfilters when switching filter groups. *(source L355)*
- [ ] **A12-019** Display loading state. *(source L356)*
- [ ] **A12-020** Display a no-results message for the selected filter. *(source L357)*
- [ ] **A12-021** Display request-loading errors. *(source L358)*
- [ ] **A12-022** Retry loading requests. *(source L359)*
- [ ] **A12-023** Refresh the list through its data-update subscriptions. *(source L360)*
- [ ] **A12-024** Show a guest login prompt. *(source L361)*

### A13 — Request tracking and processing time

**Source:** [breakdown §13, line 363](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:363); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx:80).

**Delivery:** Phase 9; payment continuation Phase 10; Request detail, legacy tracking and agency SLA. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain full status/payment/purpose/supporting details and both timing models. Display server-based agency/resident-wait/turnaround clocks and actual pause history; never calculate fee/SLA truth from the current catalogue alone.

**Acceptance family T13:** Every request/timing state, pause/resume, server clock skew, foreground catch-up, historical price and missing/foreign request. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (35):**

- [ ] **A13-001** Display the request reference number. *(source L365)*
- [ ] **A13-002** Display payment method. *(source L366)*
- [ ] **A13-003** Show **Not yet selected** before a method is chosen. *(source L367)*
- [ ] **A13-004** Display payment status: *(source L368)*
- [ ] **A13-005** Pending. *(source L369)*
- [ ] **A13-006** Paid. *(source L370)*
- [ ] **A13-007** Waived. *(source L371)*
- [ ] **A13-008** Refunded. *(source L372)*
- [ ] **A13-009** Display the assessed total amount due. *(source L373)*
- [ ] **A13-010** Display **Awaiting fee assessment** when the fee is not final. *(source L374)*
- [ ] **A13-011** Display **No payment required** for zero-fee requests. *(source L375)*
- [ ] **A13-012** Display submitted purpose. *(source L376)*
- [ ] **A13-013** Display purpose explanation. *(source L377)*
- [ ] **A13-014** Display submitted service-specific details. *(source L378)*
- [ ] **A13-015** Display requester notes. *(source L379)*
- [ ] **A13-016** Display status history. *(source L380)*
- [ ] **A13-017** Display timestamps for recorded status changes. *(source L381)*
- [ ] **A13-018** Display staff notes attached to status history. *(source L382)*
- [ ] **A13-019** Highlight the current stage. *(source L383)*
- [ ] **A13-020** Display pending future stages. *(source L384)*
- [ ] **A13-021** Display cancellation information. *(source L385)*
- [ ] **A13-022** Update tracking information when request data changes. *(source L386)*
- [ ] **A13-023** Display agency processing time against the target. *(source L390)*
- [ ] **A13-024** Display resident waiting time. *(source L391)*
- [ ] **A13-025** Display total turnaround time. *(source L392)*
- [ ] **A13-026** Display processing-clock status. *(source L393)*
- [ ] **A13-027** Display the reason a request is waiting on the resident. *(source L394)*
- [ ] **A13-028** Display pause and resume records. *(source L395)*
- [ ] **A13-029** Refresh the processing snapshot automatically. *(source L396)*
- [ ] **A13-030** Update the displayed elapsed time every second. *(source L397)*
- [ ] **A13-031** Retry when the processing clock cannot be loaded. *(source L398)*
- [ ] **A13-032** Retain the original processing estimate. *(source L402)*
- [ ] **A13-033** Display estimated completion. *(source L403)*
- [ ] **A13-034** Display a progress percentage and progress bar. *(source L404)*
- [ ] **A13-035** Identify the previous timing model. *(source L405)*

### A14 — Request and payment cancellation

**Source:** [breakdown §14, line 407](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:407); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx:80).

**Delivery:** Phases 9–10; Request/payment cancellation confirmation. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve distinct cancellation operations, eligibility and final confirmation. Reconcile a timeout or payment race before reporting cancellation; no unsupported automatic retry.

**Acceptance family T14:** Eligible/ineligible states, concurrent settlement, duplicate confirm, denied ownership and lost cancellation response. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (11):**

- [ ] **A14-001** Cancel an eligible unpaid request. *(source L409)*
- [ ] **A14-002** Ask for confirmation before cancellation. *(source L410)*
- [ ] **A14-003** Display cancellation progress. *(source L411)*
- [ ] **A14-004** Display success feedback. *(source L412)*
- [ ] **A14-005** Display cancellation failures. *(source L413)*
- [ ] **A14-006** Hide request cancellation when delivery has advanced beyond the eligible state or payment has cleared. *(source L414)*
- [ ] **A14-007** Cancel an outstanding QR payment attempt separately from the request. *(source L415)*
- [ ] **A14-008** Ask for confirmation before cancelling payment. *(source L416)*
- [ ] **A14-009** Handle a payment that completed while cancellation was being attempted. *(source L417)*
- [ ] **A14-010** Allow another payment attempt after eligible payment cancellation. *(source L418)*
- [ ] **A14-011** Show the appropriate cancellation action based on the outstanding payment state. *(source L419)*

### A15 — Payment selection and assessment

**Source:** [breakdown §15, line 421](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:421); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:15).

**Delivery:** Phase 10; Assessment and payment-method selection. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain pending assessment, assessed, waived, free and paid cases, fee basis and authoritative amount. Use existing payment-method/pickup operations; residents cannot assess fees or collect payments.

**Acceptance family T15:** All assessment states, zero/null/positive amount, historical payment, refresh and provider availability. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (14):**

- [ ] **A15-001** Load the request’s fee assessment. *(source L423)*
- [ ] **A15-002** Display the assessment and payment eligibility. *(source L424)*
- [ ] **A15-003** Refresh the assessment. *(source L425)*
- [ ] **A15-004** Retry assessment loading. *(source L426)*
- [ ] **A15-005** Choose **Pay at Pickup**. *(source L427)*
- [ ] **A15-006** Choose **Pay with QR PH**, when enabled. *(source L428)*
- [ ] **A15-007** Save the selected payment method. *(source L429)*
- [ ] **A15-008** Start the pickup-payment workflow. *(source L430)*
- [ ] **A15-009** Continue an existing payment workflow. *(source L431)*
- [ ] **A15-010** Open the resident’s request. *(source L432)*
- [ ] **A15-011** Return to Services. *(source L433)*
- [ ] **A15-012** Display errors from payment-method selection or payment initiation. *(source L434)*
- [ ] **A15-013** Prevent simultaneous payment actions. *(source L435)*
- [ ] **A15-014** Handle requests that do not require payment. *(source L436)*

### A16 — QR PH payment

**Source:** [breakdown §16, line 438](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:438); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/qrph/[requestId].tsx:77).

**Delivery:** Phase 10; QR PH payment. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain source creation, countdown, QR preview/save, status checks, retry/cancel and paid redirection. It remains gated until real settlement evidence passes; that gate cannot be a permanent excuse for an incomplete conversion.

**Acceptance family T16:** Paid reopen, expiry, concurrency, minimum amount, provider error, webhook replay, polling pause/resume and Photos denial. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (20):**

- [ ] **A16-001** Create a QR payment source. *(source L442)*
- [ ] **A16-002** Display QR-generation/loading feedback. *(source L443)*
- [ ] **A16-003** Display the payment QR image. *(source L444)*
- [ ] **A16-004** Display payment amount and relevant request information. *(source L445)*
- [ ] **A16-005** Display the QR expiry countdown. *(source L446)*
- [ ] **A16-006** Continue an existing unexpired QR payment. *(source L447)*
- [ ] **A16-007** Preserve the existing payment’s QR and expiry when continuing. *(source L448)*
- [ ] **A16-008** Handle expired payment attempts. *(source L449)*
- [ ] **A16-009** Monitor payment status. *(source L450)*
- [ ] **A16-010** Show confirmed-payment success feedback. *(source L451)*
- [ ] **A16-011** Open the payment-success screen. *(source L452)*
- [ ] **A16-012** Cancel a pending payment. *(source L453)*
- [ ] **A16-013** Save the QR image to the Android photo gallery. *(source L454)*
- [ ] **A16-014** Request media-library permission. *(source L455)*
- [ ] **A16-015** Explain permission denial. *(source L456)*
- [ ] **A16-016** Show saving progress. *(source L457)*
- [ ] **A16-017** Confirm successful image saving. *(source L458)*
- [ ] **A16-018** Display saving failures. *(source L459)*
- [ ] **A16-019** Display payment and connection failures. *(source L460)*
- [ ] **A16-020** Stop inappropriate payment actions for completed, cancelled, or already-paid requests. *(source L461)*

### A17 — Payment success and receipts

**Source:** [breakdown §17, line 463](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:463); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/success.tsx:21).

**Delivery:** Phase 10; Paid receipt and PDF share. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Load receipt fields from committed payment/request records, not navigation parameters. Keep reference/amount/date/method and share/save results with secure temporary-file cleanup.

**Acceptance family T17:** Forged amount parameters, missing/unpaid payment, receipt regeneration, iOS local images, share cancel and cleanup. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (18):**

- [ ] **A17-001** Load the confirmed payment receipt. *(source L465)*
- [ ] **A17-002** Display payment-success information. *(source L466)*
- [ ] **A17-003** Display reference number. *(source L467)*
- [ ] **A17-004** Display payment date and time. *(source L468)*
- [ ] **A17-005** Display payment method. *(source L469)*
- [ ] **A17-006** Display document fee. *(source L470)*
- [ ] **A17-007** Display transaction reference where available. *(source L471)*
- [ ] **A17-008** Format money in Philippine pesos. *(source L472)*
- [ ] **A17-009** Select **Track My Request**. *(source L473)*
- [ ] **A17-010** Select **Download Receipt**. *(source L474)*
- [ ] **A17-011** Generate a PDF receipt. *(source L475)*
- [ ] **A17-012** Open the Android sharing/saving interface. *(source L476)*
- [ ] **A17-013** Display a file-location message when sharing is unavailable. *(source L477)*
- [ ] **A17-014** Show receipt-generation progress. *(source L478)*
- [ ] **A17-015** Display receipt-download errors. *(source L479)*
- [ ] **A17-016** Retry loading the receipt. *(source L480)*
- [ ] **A17-017** Return to the request. *(source L481)*
- [ ] **A17-018** Return to Home. *(source L482)*

### A18 — Service activity logs

**Source:** [breakdown §18, line 484](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:484); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/logs-list.tsx:28).

**Delivery:** Phase 9; Service activity logs. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain the log view and resident-visible request events. Where Android derives display from request records rather than an event stream, label that limitation and obtain a real history contract before calling it a complete audit log.

**Acceptance family T18:** Multi-page events, chronology, actor-safe projection, retry and empty log. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (9):**

- [ ] **A18-001** Display the resident’s service-request activity. *(source L486)*
- [ ] **A18-002** Display document/request information. *(source L487)*
- [ ] **A18-003** Display dates. *(source L488)*
- [ ] **A18-004** Display applicable amounts. *(source L489)*
- [ ] **A18-005** Display loading state. *(source L490)*
- [ ] **A18-006** Display an empty-activity message. *(source L491)*
- [ ] **A18-007** Display activity-loading errors. *(source L492)*
- [ ] **A18-008** Retry loading activity. *(source L493)*
- [ ] **A18-009** Show a login prompt for guests. *(source L494)*

### A19 — Maps

**Source:** [breakdown §19, line 496](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:496); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx:67).

**Delivery:** Phases 13–14; Maps and accessible directory/list. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve incident/center layers, boundary, markers, search, working category chips and draggable DRRM panel. Make the unused filter button purposeful or remove it with chips retained.

**Acceptance family T19:** Every layer/category combination, search, marker/list equivalence, pan/zoom, WebView unavailable and accessibility. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (33):**

- [ ] **A19-001** Display an interactive map. *(source L498)*
- [ ] **A19-002** Load OpenStreetMap tiles. *(source L499)*
- [ ] **A19-003** Pan the map. *(source L500)*
- [ ] **A19-004** Zoom using map controls and gestures. *(source L501)*
- [ ] **A19-005** Display the barangay boundary. *(source L502)*
- [ ] **A19-006** Fit the map to the boundary. *(source L503)*
- [ ] **A19-007** Use Ampid I as the fallback map focus. *(source L504)*
- [ ] **A19-008** Switch between incident and evacuation-center map data. *(source L505)*
- [ ] **A19-009** Display incident markers. *(source L506)*
- [ ] **A19-010** Display evacuation-center markers. *(source L507)*
- [ ] **A19-011** Color incident markers by category. *(source L508)*
- [ ] **A19-012** Filter incidents using category chips. *(source L509)*
- [ ] **A19-013** Select multiple category filters. *(source L510)*
- [ ] **A19-014** Clear a category by tapping its selected chip again. *(source L511)*
- [ ] **A19-015** Search map records through the connected map search field. *(source L512)*
- [ ] **A19-016** Display a marker’s label when tapped. *(source L513)*
- [ ] **A19-017** Display the resident’s current-location marker. *(source L514)*
- [ ] **A19-018** Request foreground location permission. *(source L515)*
- [ ] **A19-019** Locate the device. *(source L516)*
- [ ] **A19-020** Recenter the map on the device location. *(source L517)*
- [ ] **A19-021** Reset the map to the barangay view. *(source L518)*
- [ ] **A19-022** Display a location-permission tooltip. *(source L519)*
- [ ] **A19-023** Dismiss the tooltip. *(source L520)*
- [ ] **A19-024** Recheck permission when the app returns to the foreground. *(source L521)*
- [ ] **A19-025** Show map-data loading and error states. *(source L522)*
- [ ] **A19-026** Retry loading map data. *(source L523)*
- [ ] **A19-027** Display a collapsible DRRM shortcut panel. *(source L524)*
- [ ] **A19-028** Expand/collapse the panel by tapping. *(source L525)*
- [ ] **A19-029** Drag the panel to expand/collapse it. *(source L526)*
- [ ] **A19-030** Animate panel movement and its chevron. *(source L527)*
- [ ] **A19-031** Open emergency hub information. *(source L528)*
- [ ] **A19-032** Open evacuation centers. *(source L529)*
- [ ] **A19-033** Open family information. *(source L530)*

### A20 — Emergency information navigation

**Source:** [breakdown §20, line 536](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:536); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx:102).

**Delivery:** Phase 13; center/QR navigation integration Phases 14–15; Emergency information hub. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep Guidelines, Hotlines, Centers, Family, QR actions and Alerts with their existing entry/return paths. Redirect obsolete duplicates to the working hub, not placeholder screens.

**Acceptance family T20:** Every section, guest restrictions, deep links, sheet dismissal and preserved selected section. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (11):**

- [ ] **A20-001** Open Emergency Info from Home. *(source L538)*
- [ ] **A20-002** Open it from the Maps shortcuts. *(source L539)*
- [ ] **A20-003** Switch between five subsections: *(source L540)*
- [ ] **A20-004** Hub. *(source L541)*
- [ ] **A20-005** Centers. *(source L542)*
- [ ] **A20-006** Scan. *(source L543)*
- [ ] **A20-007** Family. *(source L544)*
- [ ] **A20-008** Alerts. *(source L545)*
- [ ] **A20-009** Open a particular subsection through a navigation link. *(source L546)*
- [ ] **A20-010** Animate the selected subsection indicator. *(source L547)*
- [ ] **A20-011** Return to the previous screen. *(source L548)*

### A21 — Emergency hub and preparedness

**Source:** [breakdown §21, line 550](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:550); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-emergency-guidelines.ts:13).

**Delivery:** Phase 13; Emergency guidelines/preparedness. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain expandable rich content, bundled fallback and refresh. Scope caches by tenant/version and visibly distinguish stale/offline guidance; publish operator-approved emergency content.

**Acceptance family T21:** Loading/error/fallback, missing images, expansion state, content update and screen-reader headings. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (13):**

- [ ] **A21-001** Display disaster-preparedness guidelines. *(source L552)*
- [ ] **A21-002** Expand guideline sections. *(source L553)*
- [ ] **A21-003** Collapse guideline sections. *(source L554)*
- [ ] **A21-004** Display guideline icons and content. *(source L555)*
- [ ] **A21-005** Display cached emergency information. *(source L556)*
- [ ] **A21-006** Provide bundled fallback guidelines when live content is unavailable. *(source L557)*
- [ ] **A21-007** Include fallback earthquake information for: *(source L558)*
- [ ] **A21-008** Before an earthquake. *(source L559)*
- [ ] **A21-009** During an earthquake. *(source L560)*
- [ ] **A21-010** After an earthquake. *(source L561)*
- [ ] **A21-011** Display offline-availability labels. *(source L562)*
- [ ] **A21-012** Display loading placeholders. *(source L563)*
- [ ] **A21-013** Display no-guidelines states. *(source L564)*

### A22 — Emergency hotlines

**Source:** [breakdown §22, line 566](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:566); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/hotline-row.tsx:21).

**Delivery:** Phase 13; Emergency hotline directory and dialer. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve names/icons/multiple numbers and call actions via the iOS dialer. Validate configured numbers, avoid auto-dial, and do not invent operational contacts.

**Acceptance family T22:** Multiple numbers, invalid/missing number, cannot-open dialer, cancellation and offline approved directory. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (10):**

- [ ] **A22-001** Display hotline organizations. *(source L568)*
- [ ] **A22-002** Display configured contact labels/numbers. *(source L569)*
- [ ] **A22-003** Display category icons. *(source L570)*
- [ ] **A22-004** Open the phone dialer from a hotline’s call button. *(source L571)*
- [ ] **A22-005** Call the first configured number for that hotline row. *(source L572)*
- [ ] **A22-006** Load cached hotline information. *(source L573)*
- [ ] **A22-007** Provide bundled fallback hotline information. *(source L574)*
- [ ] **A22-008** Display offline-availability labels. *(source L575)*
- [ ] **A22-009** Display loading state. *(source L576)*
- [ ] **A22-010** Display a no-hotlines state. *(source L577)*

### A23 — Evacuation-center directory

**Source:** [breakdown §23, line 579](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:579); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx:102).

**Delivery:** Phase 14; Evacuation centers and center details. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain center search, nearest toggle, facilities/capacity/occupancy, selected center, map/list detail and route estimates. Center operational state must be fresh and accessibility cannot depend on markers alone.

**Acceptance family T23:** Active/deleted/full/empty centers, unknown origin, center changes, nearest ordering and stale occupancy. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (37):**

- [ ] **A23-001** Load evacuation centers. *(source L581)*
- [ ] **A23-002** Display centers as a list. *(source L582)*
- [ ] **A23-003** Display centers on a map. *(source L583)*
- [ ] **A23-004** Switch between List and Map. *(source L584)*
- [ ] **A23-005** Display: *(source L585)*
- [ ] **A23-006** Center name. *(source L586)*
- [ ] **A23-007** Address. *(source L587)*
- [ ] **A23-008** Distance, when location is available. *(source L588)*
- [ ] **A23-009** Estimated travel time. *(source L589)*
- [ ] **A23-010** Current occupancy. *(source L590)*
- [ ] **A23-011** Capacity. *(source L591)*
- [ ] **A23-012** Occupancy percentage. *(source L592)*
- [ ] **A23-013** Full-capacity status. *(source L593)*
- [ ] **A23-014** Verification indicator where supplied. *(source L594)*
- [ ] **A23-015** Display occupancy progress bars. *(source L595)*
- [ ] **A23-016** Change occupancy colors for normal, high, and full occupancy. *(source L596)*
- [ ] **A23-017** Display configured facility tags such as: *(source L597)*
- [ ] **A23-018** Medical desk. *(source L598)*
- [ ] **A23-019** Pet friendly. *(source L599)*
- [ ] **A23-020** Generator. *(source L600)*
- [ ] **A23-021** Catering. *(source L601)*
- [ ] **A23-022** Children. *(source L602)*
- [ ] **A23-023** Toilets. *(source L603)*
- [ ] **A23-024** Internet. *(source L604)*
- [ ] **A23-025** Toggle nearest-first ordering. *(source L605)*
- [ ] **A23-026** Search centers by name in the map view. *(source L606)*
- [ ] **A23-027** Clear the center search. *(source L607)*
- [ ] **A23-028** Select a center marker. *(source L608)*
- [ ] **A23-029** Select a center through the horizontal center picker. *(source L609)*
- [ ] **A23-030** Focus the map on the selected center. *(source L610)*
- [ ] **A23-031** Open its compact detail card. *(source L611)*
- [ ] **A23-032** Close center details. *(source L612)*
- [ ] **A23-033** Return to showing all centers. *(source L613)*
- [ ] **A23-034** Reset the center map. *(source L614)*
- [ ] **A23-035** Display loading, error, and no-results states. *(source L615)*
- [ ] **A23-036** Retry center loading. *(source L616)*
- [ ] **A23-037** Load previously cached center records. *(source L617)*

### A24 — Device location and evacuation routing

**Source:** [breakdown §24, line 619](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:619); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-device-location.ts:58).

**Delivery:** Phase 14; Location status controls and evacuation route. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve locate/retry/cancel/confirm/reject/Settings actions and explicit confirmation of last-known/approximate fixes. Extend the adapter for iOS reduced accuracy; clear obsolete routes on origin/center changes. Require an approved genuinely suitable route provider (2026-10-16, OD-11: the barangay's own `evacuation-route` service, as on web); label straight-line estimates and never draw one as a route.

**Acceptance family T24:** Denied/reduced/Allow Once/full accuracy, stale fix, 10-second slow state, 45-second timeout, late callback, background cancellation and provider failure. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (24):**

- [ ] **A24-001** Obtain a current location for center distance/routing. *(source L621)*
- [ ] **A24-002** Automatically acquire location when permission is already granted and Centers is active. *(source L622)*
- [ ] **A24-003** Show acquisition progress. *(source L623)*
- [ ] **A24-004** Display location accuracy information. *(source L624)*
- [ ] **A24-005** Distinguish approximate and precise permission. *(source L625)*
- [ ] **A24-006** Detect disabled location services. *(source L626)*
- [ ] **A24-007** Handle denied permission. *(source L627)*
- [ ] **A24-008** Offer **Open settings** when needed. *(source L628)*
- [ ] **A24-009** Retry acquiring location. *(source L629)*
- [ ] **A24-010** Stop an active acquisition. *(source L630)*
- [ ] **A24-011** Present a pending location for confirmation when required. *(source L631)*
- [ ] **A24-012** Accept **Use this location**. *(source L632)*
- [ ] **A24-013** Discard a pending location. *(source L633)*
- [ ] **A24-014** Consider a last-known device location through the location controller. *(source L634)*
- [ ] **A24-015** Pause acquisition when the app backgrounds. *(source L635)*
- [ ] **A24-016** Recheck permission/services when the app returns. *(source L636)*
- [ ] **A24-017** Keep center-routing coordinates in memory. *(source L637)*
- [ ] **A24-018** Calculate straight-line distance estimates. *(source L638)*
- [ ] **A24-019** Request a road-following walking route to a selected center. *(source L639)*
- [ ] **A24-020** Draw the route on the map. *(source L640)*
- [ ] **A24-021** Display road-route distance and estimated walking time. *(source L641)*
- [ ] **A24-022** Use estimated distance/time when a road route is unavailable. *(source L642)*
- [ ] **A24-023** Label estimated values. *(source L643)*
- [ ] **A24-024** Clear/recalculate routing when the location or selected center changes. *(source L644)*

### A25 — Emergency QR guide and scanner

**Source:** [breakdown §25, line 648](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:648); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/qr-scanner-overlay.tsx:18).

**Delivery:** Phase 15; QR guide, permission, scanner and online check-in. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep guide/scanner feedback and validate schema, tenant, actual active center and resident identity. Only confirmed server success produces checked-in state; replace broken offline queue/bulk-household updates with the approved resident-only online correction.

**Acceptance family T25:** Malformed/foreign/deleted-center QR, denial, duplicate scan, camera disposal, offline/no-confirmation and lost response reconciliation. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (28):**

- [ ] **A25-001** Display why QR check-in is used. *(source L650)*
- [ ] **A25-002** Display check-in instructions. *(source L651)*
- [ ] **A25-003** Display numbered guide steps. *(source L652)*
- [ ] **A25-004** Load cached QR-guide content. *(source L653)*
- [ ] **A25-005** Display an offline indicator when applicable. *(source L654)*
- [ ] **A25-006** Select **Scan QR**. *(source L655)*
- [ ] **A25-007** Check camera permission. *(source L656)*
- [ ] **A25-008** Display a camera-permission explanation. *(source L657)*
- [ ] **A25-009** Request camera access. *(source L658)*
- [ ] **A25-010** Provide the permission-recovery/settings path where needed. *(source L659)*
- [ ] **A25-011** Open the rear camera. *(source L660)*
- [ ] **A25-012** Scan QR codes only. *(source L661)*
- [ ] **A25-013** Display the scanning frame. *(source L662)*
- [ ] **A25-014** Display positioning instructions. *(source L663)*
- [ ] **A25-015** Close the scanner. *(source L664)*
- [ ] **A25-016** Show processing feedback. *(source L665)*
- [ ] **A25-017** Prevent processing the same scan repeatedly while a request is active. *(source L666)*
- [ ] **A25-018** Reject empty QR contents. *(source L667)*
- [ ] **A25-019** Reject malformed JSON. *(source L668)*
- [ ] **A25-020** Validate the evacuation-center QR format. *(source L669)*
- [ ] **A25-021** Reject codes belonging to another barangay. *(source L670)*
- [ ] **A25-022** Record evacuation-center check-in. *(source L671)*
- [ ] **A25-023** Attempt to update household check-in status. *(source L672)*
- [ ] **A25-024** Show a warning if household updating fails after check-in succeeds. *(source L673)*
- [ ] **A25-025** Display successful check-in confirmation. *(source L674)*
- [ ] **A25-026** Close the scanner after acknowledgement. *(source L675)*
- [ ] **A25-027** Display failed-check-in errors. *(source L676)*
- [ ] **A25-028** Allow another scan after an error. *(source L677)*

### A26 — Showing and sharing evacuation-center QR codes

**Source:** [breakdown §26, line 679](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:679); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/qr-show-modal.tsx:39).

**Delivery:** Phase 15; Center QR selector, display, share and Photos save. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep first/selected center, center-name and encoded schema, raw-content sharing and QR-image saving using iOS share/Photos flows. Center QR and household QR are different capabilities.

**Acceptance family T26:** No center, changed/deleted center, bad schema, share cancellation, capture failure and denied Photos save. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (17):**

- [ ] **A26-001** Select **Show QR**. *(source L681)*
- [ ] **A26-002** Load selectable evacuation centers. *(source L682)*
- [ ] **A26-003** Select a center through the center picker. *(source L683)*
- [ ] **A26-004** Default to the first available center when no selection exists. *(source L684)*
- [ ] **A26-005** Generate the selected center’s check-in QR payload. *(source L685)*
- [ ] **A26-006** Validate the payload before rendering. *(source L686)*
- [ ] **A26-007** Display the QR code. *(source L687)*
- [ ] **A26-008** Display selected-center information. *(source L688)*
- [ ] **A26-009** Share the QR payload through Android’s share interface. *(source L689)*
- [ ] **A26-010** Save the rendered QR image to the photo gallery. *(source L690)*
- [ ] **A26-011** Request media-library access. *(source L691)*
- [ ] **A26-012** Display download progress. *(source L692)*
- [ ] **A26-013** Display download success/failure. *(source L693)*
- [ ] **A26-014** Close the center picker. *(source L694)*
- [ ] **A26-015** Close the QR modal. *(source L695)*
- [ ] **A26-016** Dismiss supported modals by tapping outside. *(source L696)*
- [ ] **A26-017** Animate the QR sheet opening and closing. *(source L697)*

### A27 — Family and household information

**Source:** [breakdown §27, line 699](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:699); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/family-content.tsx:23).

**Delivery:** Phases 5 and 15; Family management and household QR. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve the reachable Family/profile household JSON editor, its canonical-table mirror, all fields, add/edit/remove/details, expanded household QR and shared state. Verify mirror/ID/attendance invariants; do not invent a separate CRUD screen from an unused hook.

**Acceptance family T27:** Owner/tenant boundaries, duplicate/foreign IDs, concurrency, attendance preservation, image failure and QR processor disclosure. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (36):**

- [ ] **A27-001** Display a household/family heading. *(source L701)*
- [ ] **A27-002** Display the household QR image. *(source L702)*
- [ ] **A27-003** Request the QR image using the resident’s authenticated session. *(source L703)*
- [ ] **A27-004** Cache the displayed QR image. *(source L704)*
- [ ] **A27-005** Show a QR placeholder when necessary. *(source L705)*
- [ ] **A27-006** Open **Show My Code** in a larger modal. *(source L706)*
- [ ] **A27-007** Display guidance for presenting the household QR at evacuation centers. *(source L707)*
- [ ] **A27-008** Display family members. *(source L708)*
- [ ] **A27-009** Display the total member count. *(source L709)*
- [ ] **A27-010** Display member names. *(source L710)*
- [ ] **A27-011** Display member initials. *(source L711)*
- [ ] **A27-012** Display relationship. *(source L712)*
- [ ] **A27-013** Display role. *(source L713)*
- [ ] **A27-014** Add a family member. *(source L714)*
- [ ] **A27-015** Edit a family member. *(source L715)*
- [ ] **A27-016** Remove a family member. *(source L716)*
- [ ] **A27-017** Enter a member name. *(source L717)*
- [ ] **A27-018** Choose relationships: *(source L718)*
- [ ] **A27-019** Spouse. *(source L719)*
- [ ] **A27-020** Child. *(source L720)*
- [ ] **A27-021** Parent. *(source L721)*
- [ ] **A27-022** Sibling. *(source L722)*
- [ ] **A27-023** Grandparent. *(source L723)*
- [ ] **A27-024** Grandchild. *(source L724)*
- [ ] **A27-025** Other. *(source L725)*
- [ ] **A27-026** Choose roles: *(source L726)*
- [ ] **A27-027** Head of Family. *(source L727)*
- [ ] **A27-028** Student. *(source L728)*
- [ ] **A27-029** Employed. *(source L729)*
- [ ] **A27-030** Unemployed. *(source L730)*
- [ ] **A27-031** Retired. *(source L731)*
- [ ] **A27-032** Minor. *(source L732)*
- [ ] **A27-033** Validate member input. *(source L733)*
- [ ] **A27-034** Show member-save progress and errors. *(source L734)*
- [ ] **A27-035** Display empty-family and loading states. *(source L735)*
- [ ] **A27-036** Share the profile household-member data used elsewhere in the app. *(source L736)*

### A28 — Emergency alerts

**Source:** [breakdown §28, line 738](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:738); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-emergency-announcements.ts:12).

**Delivery:** Phase 13; Emergency alerts. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep emergency-category list, period filters, custom name/day/year filters, count and detailed announcement opening. Apply tenant scope, local-date rules and individual announcement read semantics.

**Acceptance family T28:** Today/week/month/year/custom edges, no results, invalid day/year, multiple pages and deleted announcement. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (22):**

- [ ] **A28-001** Load emergency announcements. *(source L740)*
- [ ] **A28-002** Display alert title and content. *(source L741)*
- [ ] **A28-003** Display alert date and time. *(source L742)*
- [ ] **A28-004** Display alert count. *(source L743)*
- [ ] **A28-005** Filter by: *(source L744)*
- [ ] **A28-006** All. *(source L745)*
- [ ] **A28-007** Today. *(source L746)*
- [ ] **A28-008** Last Week. *(source L747)*
- [ ] **A28-009** Last Month. *(source L748)*
- [ ] **A28-010** Last Year. *(source L749)*
- [ ] **A28-011** Expand/collapse custom date filters. *(source L750)*
- [ ] **A28-012** Filter by month name. *(source L751)*
- [ ] **A28-013** Filter by day. *(source L752)*
- [ ] **A28-014** Filter by year. *(source L753)*
- [ ] **A28-015** Restrict month input to letters. *(source L754)*
- [ ] **A28-016** Restrict day/year inputs to numbers. *(source L755)*
- [ ] **A28-017** Display input guidance/validation tooltips. *(source L756)*
- [ ] **A28-018** Display the number of active custom filters. *(source L757)*
- [ ] **A28-019** Display **Showing X of Y alerts**. *(source L758)*
- [ ] **A28-020** Display no-matching-alerts states. *(source L759)*
- [ ] **A28-021** Display loading/error states. *(source L760)*
- [ ] **A28-022** Retry loading emergency alerts. *(source L761)*

### A29 — Health and medical-drive browsing

**Source:** [breakdown §29, line 763](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:763); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/index.tsx:2209).

**Delivery:** Phase 16; Medical calendar, drives, detail and registrations. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve calendar/list toggle, month chooser, day/event dots, all configured drive types, selected-day/type filters, drive detail, availability and registration entry. Do not migrate the unreachable older registration modal.

**Acceptance family T29:** Month/year boundaries, multiple same-day drives, full/inactive/expired drive, filters, empty/no-results and detail back. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (44):**

- [ ] **A29-001** Switch between: *(source L765)*
- [ ] **A29-002** Active Medical Drives. *(source L766)*
- [ ] **A29-003** My Registrations. *(source L767)*
- [ ] **A29-004** Display a medical-drive calendar. *(source L768)*
- [ ] **A29-005** Highlight the selected date. *(source L769)*
- [ ] **A29-006** Indicate today. *(source L770)*
- [ ] **A29-007** Display colored event indicators. *(source L771)*
- [ ] **A29-008** Move to the previous month. *(source L772)*
- [ ] **A29-009** Move to the next month. *(source L773)*
- [ ] **A29-010** Open the month/year picker. *(source L774)*
- [ ] **A29-011** Jump to a chosen month and year. *(source L775)*
- [ ] **A29-012** Select a day. *(source L776)*
- [ ] **A29-013** Switch from month-wide results to day-specific results by selecting a date. *(source L777)*
- [ ] **A29-014** Display all drives for the selected month. *(source L778)*
- [ ] **A29-015** Exit month-wide viewing. *(source L779)*
- [ ] **A29-016** Filter by drive category. *(source L780)*
- [ ] **A29-017** Scroll categories horizontally. *(source L781)*
- [ ] **A29-018** Use category navigation arrows. *(source L782)*
- [ ] **A29-019** Support these drive categories: *(source L783)*
- [ ] **A29-020** Vaccination. *(source L784)*
- [ ] **A29-021** Maternal Care. *(source L785)*
- [ ] **A29-022** Blood Drive. *(source L786)*
- [ ] **A29-023** Medicine Distribution. *(source L787)*
- [ ] **A29-024** Dental Care. *(source L788)*
- [ ] **A29-025** Optical Care. *(source L789)*
- [ ] **A29-026** Emergency Kit. *(source L790)*
- [ ] **A29-027** Medical Screening. *(source L791)*
- [ ] **A29-028** Medical Consultation. *(source L792)*
- [ ] **A29-029** Minor Surgical Drive. *(source L793)*
- [ ] **A29-030** Others. *(source L794)*
- [ ] **A29-031** Display drive title. *(source L795)*
- [ ] **A29-032** Display category and category color. *(source L796)*
- [ ] **A29-033** Display date. *(source L797)*
- [ ] **A29-034** Display start/end time. *(source L798)*
- [ ] **A29-035** Display location. *(source L799)*
- [ ] **A29-036** Display eligibility information. *(source L800)*
- [ ] **A29-037** Display stock/slot label and units. *(source L801)*
- [ ] **A29-038** Display remaining stock/slots. *(source L802)*
- [ ] **A29-039** Display stock/capacity progress. *(source L803)*
- [ ] **A29-040** Display registration availability. *(source L804)*
- [ ] **A29-041** Open the applicant registration form. *(source L805)*
- [ ] **A29-042** Display empty and loading states. *(source L806)*
- [ ] **A29-043** Refresh medical-drive data when the screen regains focus. *(source L807)*
- [ ] **A29-044** Update drive/registration data through live subscriptions. *(source L808)*

### A30 — Medical-drive registration

**Source:** [breakdown §30, line 810](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:810); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:282).

**Delivery:** Phase 16; Full-screen self medical registration. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep actual age/PWD/comorbidity/dose inputs, consent, stock/eligibility messaging and committed applicant number. Correct the household picker not sent to the server and fabricated prior-dose date; self only until a separately approved household contract exists.

**Acceptance family T30:** Age 0/130, None-exclusive conditions, actual/null dose date, duplicate/capacity race, expiry, consent and authoritative error/result. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (36):**

- [ ] **A30-001** Select the resident as applicant. *(source L812)*
- [ ] **A30-002** Select an existing household member as applicant. *(source L813)*
- [ ] **A30-003** Open/close the applicant picker. *(source L814)*
- [ ] **A30-004** Display applicant name. *(source L815)*
- [ ] **A30-005** Display applicant relationship and role for household members. *(source L816)*
- [ ] **A30-006** Display applicant avatar or initials. *(source L817)*
- [ ] **A30-007** Calculate resident age from date of birth. *(source L818)*
- [ ] **A30-008** Request age manually when needed. *(source L819)*
- [ ] **A30-009** Display the resident’s address. *(source L820)*
- [ ] **A30-010** Open Profile to edit household/applicant information. *(source L821)*
- [ ] **A30-011** Display drive details. *(source L822)*
- [ ] **A30-012** Display remaining stock/slots. *(source L823)*
- [ ] **A30-013** Select PWD status. *(source L824)*
- [ ] **A30-014** Select multiple eligibility/comorbidity options: *(source L825)*
- [ ] **A30-015** Hypertension. *(source L826)*
- [ ] **A30-016** Diabetes. *(source L827)*
- [ ] **A30-017** Immunocompromised. *(source L828)*
- [ ] **A30-018** Pregnant. *(source L829)*
- [ ] **A30-019** Allergy. *(source L830)*
- [ ] **A30-020** None. *(source L831)*
- [ ] **A30-021** Treat **None** separately from selected conditions. *(source L832)*
- [ ] **A30-022** Select dose history: *(source L833)*
- [ ] **A30-023** 1st Dose. *(source L834)*
- [ ] **A30-024** 2nd Dose. *(source L835)*
- [ ] **A30-025** Booster. *(source L836)*
- [ ] **A30-026** Display the data-privacy explanation. *(source L837)*
- [ ] **A30-027** Select the consent checkbox. *(source L838)*
- [ ] **A30-028** Require consent before submission. *(source L839)*
- [ ] **A30-029** Validate age. *(source L840)*
- [ ] **A30-030** Require sign-in. *(source L841)*
- [ ] **A30-031** Disable submission when stock is exhausted. *(source L842)*
- [ ] **A30-032** Show submission progress. *(source L843)*
- [ ] **A30-033** Display registration errors. *(source L844)*
- [ ] **A30-034** Submit the registration. *(source L845)*
- [ ] **A30-035** Display the confirmed applicant number. *(source L846)*
- [ ] **A30-036** Present successful registration feedback. *(source L847)*

### A31 — My medical registrations

**Source:** [breakdown §31, line 849](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:849); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-medical-drives.ts:59).

**Delivery:** Phase 16; My medical registrations and detail. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve status tabs, summary/count, applicant number, drive details, schedule and status timeline including cancelled. Do not add an unsupported self-cancellation button.

**Acceptance family T31:** All statuses including cancelled, stale stock/detail, tenant-safe history, pagination and reopened detail. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (20):**

- [ ] **A31-001** Load the resident’s registrations. *(source L851)*
- [ ] **A31-002** Display registration cards. *(source L852)*
- [ ] **A31-003** Display related drive information. *(source L853)*
- [ ] **A31-004** Display applicant number. *(source L854)*
- [ ] **A31-005** Display status badge. *(source L855)*
- [ ] **A31-006** Filter by: *(source L856)*
- [ ] **A31-007** All. *(source L857)*
- [ ] **A31-008** Pending. *(source L858)*
- [ ] **A31-009** Confirmed. *(source L859)*
- [ ] **A31-010** Attended. *(source L860)*
- [ ] **A31-011** Cancelled. *(source L861)*
- [ ] **A31-012** Open a registration detail sheet. *(source L862)*
- [ ] **A31-013** Display registration information and dates. *(source L863)*
- [ ] **A31-014** Display related drive schedule and location. *(source L864)*
- [ ] **A31-015** Display a status timeline. *(source L865)*
- [ ] **A31-016** Highlight the current status. *(source L866)*
- [ ] **A31-017** Use the appropriate timeline for cancelled registrations. *(source L867)*
- [ ] **A31-018** Close the detail sheet. *(source L868)*
- [ ] **A31-019** Display loading and no-registration states. *(source L869)*
- [ ] **A31-020** Update registrations when staff changes their status. *(source L870)*

### A32 — Reports navigation and lists

**Source:** [breakdown §32, line 876](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:876); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/index.tsx:73).

**Delivery:** Phases 11–12; Reports: announcements / own / active / resolved. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep all current segments, status/category/time/search filters, query state, cards, counts and create action. Separate incident and announcement record types throughout links and notifications.

**Acceptance family T32:** Every segment/filter combination, refresh, pagination, empty/no-results, navigation return and guest boundaries. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (30):**

- [ ] **A32-001** Switch between: *(source L878)*
- [ ] **A32-002** Incidents. *(source L879)*
- [ ] **A32-003** Active. *(source L880)*
- [ ] **A32-004** Resolved. *(source L881)*
- [ ] **A32-005** Announcements. *(source L882)*
- [ ] **A32-006** Display the corresponding subsection heading. *(source L883)*
- [ ] **A32-007** Keep subsection selection synchronized with navigation parameters. *(source L884)*
- [ ] **A32-008** Reset category/status filters when switching subsections. *(source L885)*
- [ ] **A32-009** Display the resident’s own incident reports. *(source L886)*
- [ ] **A32-010** Display active reports separately. *(source L887)*
- [ ] **A32-011** Display resolved reports separately. *(source L888)*
- [ ] **A32-012** Filter incidents by: *(source L889)*
- [ ] **A32-013** All. *(source L890)*
- [ ] **A32-014** Submitted. *(source L891)*
- [ ] **A32-015** In Progress. *(source L892)*
- [ ] **A32-016** Resolved. *(source L893)*
- [ ] **A32-017** Withdrawn. *(source L894)*
- [ ] **A32-018** Unresolved. *(source L895)*
- [ ] **A32-019** Display incident preview cards. *(source L896)*
- [ ] **A32-020** Display incident title. *(source L897)*
- [ ] **A32-021** Display category. *(source L898)*
- [ ] **A32-022** Display status. *(source L899)*
- [ ] **A32-023** Display relevant dates. *(source L900)*
- [ ] **A32-024** Display available photo previews. *(source L901)*
- [ ] **A32-025** Open incident details. *(source L902)*
- [ ] **A32-026** Provide a floating **Report Issue** action. *(source L903)*
- [ ] **A32-027** Display loading skeletons. *(source L904)*
- [ ] **A32-028** Display empty-list states. *(source L905)*
- [ ] **A32-029** Refresh personal incidents on screen focus. *(source L906)*
- [ ] **A32-030** Refresh after incident changes. *(source L907)*

### A33 — New incident report

**Source:** [breakdown §33, line 909](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:909); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:189).

**Delivery:** Phase 12; Concern form, review and submission result. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain all current categories and constraints, waste zone, address/specific area, coordinates/picker, up to five photos and feedback. Upload only validated final bytes; reconcile ambiguous mutation outcome without duplicate concerns.

**Acceptance family T33:** Each category, required zone/location, 10 MiB limit, HEIC, photo remove/view, partial upload, double submit and retry. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (36):**

- [ ] **A33-001** Require an account and completed resident profile. *(source L911)*
- [ ] **A33-002** Select an incident category. *(source L912)*
- [ ] **A33-003** Use categories configured for the barangay. *(source L913)*
- [ ] **A33-004** Show category selection feedback. *(source L914)*
- [ ] **A33-005** Select a waste-management zone for applicable trash-related categories. *(source L915)*
- [ ] **A33-006** Clear a selected zone by tapping it again. *(source L916)*
- [ ] **A33-007** Enter the incident title. *(source L917)*
- [ ] **A33-008** Limit title input to 100 characters. *(source L918)*
- [ ] **A33-009** Display the title character counter. *(source L919)*
- [ ] **A33-010** Enter an optional description. *(source L920)*
- [ ] **A33-011** Limit description input to 1,000 characters. *(source L921)*
- [ ] **A33-012** Display the description character counter. *(source L922)*
- [ ] **A33-013** Add photo evidence. *(source L923)*
- [ ] **A33-014** Attach up to five photos. *(source L924)*
- [ ] **A33-015** Accept JPG, PNG, and WEBP. *(source L925)*
- [ ] **A33-016** Enforce the 10 MB per-photo limit. *(source L926)*
- [ ] **A33-017** Display the current photo count. *(source L927)*
- [ ] **A33-018** Display photo thumbnails. *(source L928)*
- [ ] **A33-019** Remove individual photos. *(source L929)*
- [ ] **A33-020** Show a limit-reached message. *(source L930)*
- [ ] **A33-021** Establish an initial location from available location/boundary information. *(source L931)*
- [ ] **A33-022** Open the map location picker. *(source L932)*
- [ ] **A33-023** Move the report pin. *(source L933)*
- [ ] **A33-024** Reject pin choices outside the configured boundary. *(source L934)*
- [ ] **A33-025** Detect an address from coordinates. *(source L935)*
- [ ] **A33-026** Correct the detected address manually. *(source L936)*
- [ ] **A33-027** Confirm **Use This Location**. *(source L937)*
- [ ] **A33-028** Cancel location selection. *(source L938)*
- [ ] **A33-029** Enter specific area details or landmarks. *(source L939)*
- [ ] **A33-030** Validate title, category, location, and other input. *(source L940)*
- [ ] **A33-031** Upload photos before creating the incident. *(source L941)*
- [ ] **A33-032** Remove freshly uploaded photos if the incident insert fails. *(source L942)*
- [ ] **A33-033** Display upload/submission errors. *(source L943)*
- [ ] **A33-034** Show submission progress. *(source L944)*
- [ ] **A33-035** Display successful submission feedback. *(source L945)*
- [ ] **A33-036** Return to Reports after dismissing success feedback. *(source L946)*

### A34 — Incident details and community confirmation

**Source:** [breakdown §34, line 948](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:948); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/[incidentId].tsx:431).

**Delivery:** Phase 12; Incident detail, community confirmation and withdrawal. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain description/location/photos/status/reporter-safe information, confirmation counts and viewer states. Use confirm/withdraw operations with server-authoritative eligibility and deduplication.

**Acceptance family T34:** Own/other report, already confirmed, withdrawn/resolved/deleted, concurrent confirms, foreign tenant and lost response. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (31):**

- [ ] **A34-001** Display incident title. *(source L950)*
- [ ] **A34-002** Display incident status. *(source L951)*
- [ ] **A34-003** Display category. *(source L952)*
- [ ] **A34-004** Display description. *(source L953)*
- [ ] **A34-005** Display report date/time. *(source L954)*
- [ ] **A34-006** Display reported location/address. *(source L955)*
- [ ] **A34-007** Display specific area information. *(source L956)*
- [ ] **A34-008** Display incident photos. *(source L957)*
- [ ] **A34-009** Navigate photos with previous/next controls. *(source L958)*
- [ ] **A34-010** Select a photo using pagination dots. *(source L959)*
- [ ] **A34-011** Open a full-screen photo preview. *(source L960)*
- [ ] **A34-012** Close the full-screen preview. *(source L961)*
- [ ] **A34-013** Display the incident location on a map. *(source L962)*
- [ ] **A34-014** Recenter that map. *(source L963)*
- [ ] **A34-015** Display the status timeline. *(source L964)*
- [ ] **A34-016** Display recorded resolution information where available. *(source L965)*
- [ ] **A34-017** Display the confirmation count. *(source L966)*
- [ ] **A34-018** Confirm another resident’s eligible report. *(source L967)*
- [ ] **A34-019** Prevent confirming one’s own report. *(source L968)*
- [ ] **A34-020** Prevent duplicate confirmation. *(source L969)*
- [ ] **A34-021** Prevent confirmation of terminal-status reports. *(source L970)*
- [ ] **A34-022** Display already-confirmed feedback. *(source L971)*
- [ ] **A34-023** Update the confirmation count after confirmation. *(source L972)*
- [ ] **A34-024** Withdraw the resident’s own report when: *(source L973)*
- [ ] **A34-025** Its status is still Submitted/open. *(source L974)*
- [ ] **A34-026** It is within the 24-hour withdrawal window. *(source L975)*
- [ ] **A34-027** Ask for confirmation before withdrawal. *(source L976)*
- [ ] **A34-028** Explain withdrawal unavailability where applicable. *(source L977)*
- [ ] **A34-029** Preserve the incident with Withdrawn status. *(source L978)*
- [ ] **A34-030** Display withdrawal success/failure. *(source L979)*
- [ ] **A34-031** Update incident details when staff changes the report. *(source L980)*

### A35 — Announcements

**Source:** [breakdown §35, line 984](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:984); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/announcements-feed.tsx:129).

**Delivery:** Phase 11; Announcement feed and dedicated detail/modal. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain category/date/search filters, card/image/author metadata, modal/detail, individual and bulk read/unread controls and refresh. Snapshot bulk scope explicitly across pagination.

**Acceptance family T35:** Read/unread rollback, new arrival during mark-all, expired image, malformed/deleted link and filter restoration. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (26):**

- [ ] **A35-001** Load published announcements. *(source L986)*
- [ ] **A35-002** Display announcement cards. *(source L987)*
- [ ] **A35-003** Display title. *(source L988)*
- [ ] **A35-004** Display category. *(source L989)*
- [ ] **A35-005** Display category color/icon. *(source L990)*
- [ ] **A35-006** Display publication date/time. *(source L991)*
- [ ] **A35-007** Display relative-time wording. *(source L992)*
- [ ] **A35-008** Display a shortened content preview. *(source L993)*
- [ ] **A35-009** Filter by: *(source L994)*
- [ ] **A35-010** All. *(source L995)*
- [ ] **A35-011** General. *(source L996)*
- [ ] **A35-012** Emergency. *(source L997)*
- [ ] **A35-013** Health. *(source L998)*
- [ ] **A35-014** Events. *(source L999)*
- [ ] **A35-015** Open an announcement detail modal. *(source L1000)*
- [ ] **A35-016** Display full content. *(source L1001)*
- [ ] **A35-017** Display available announcement imagery. *(source L1002)*
- [ ] **A35-018** Close the modal. *(source L1003)*
- [ ] **A35-019** Dismiss it through the supported backdrop/close controls. *(source L1004)*
- [ ] **A35-020** Mark an announcement as read. *(source L1005)*
- [ ] **A35-021** Mark it as unread again. *(source L1006)*
- [ ] **A35-022** Mark all announcements as read. *(source L1007)*
- [ ] **A35-023** Display unread visual indicators. *(source L1008)*
- [ ] **A35-024** Update the Home bell and Reports badges after read-state changes. *(source L1009)*
- [ ] **A35-025** Receive new announcement updates through the data subscription. *(source L1010)*
- [ ] **A35-026** Display loading and empty-category states. *(source L1011)*

### A36 — Resolved-report read states and counters

**Source:** [breakdown §36, line 1013](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1013); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-unread-counts.tsx:54).

**Delivery:** Phase 11; integration Phases 17–18; Report and announcement counters. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve active reports separately from unread resolved and unread announcements. Use one aggregate system badge plus three labeled internal counters; maintain individual/bulk read controls and tenant-safe realtime.

**Acceptance family T36:** Read/undo, concurrent update, guest/logout reset, account switch, offline rollback, More and aggregate accuracy. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (9):**

- [ ] **A36-001** Mark one resolved report as read. *(source L1015)*
- [ ] **A36-002** Mark it unread again. *(source L1016)*
- [ ] **A36-003** Mark all resolved reports as read. *(source L1017)*
- [ ] **A36-004** Display unread indicators on applicable report cards. *(source L1018)*
- [ ] **A36-005** Update the unread resolved count. *(source L1019)*
- [ ] **A36-006** Keep active-report counts separate from unread counts. *(source L1020)*
- [ ] **A36-007** Count Submitted/open and In Progress reports as active. *(source L1021)*
- [ ] **A36-008** Update counts as reports change status. *(source L1022)*
- [ ] **A36-009** Clear resident-specific counters when there is no signed-in user. *(source L1023)*

### A37 — Profile viewing and editing

**Source:** [breakdown §37, line 1025](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1025); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:869).

**Delivery:** Phase 5; Profile, account linking and edit/save. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep every displayed/editable field, avatar, verification indicators, provider link controls and household editor. Separate demographic save, avatar upload and ID publication outcomes; avoid silently replacing auth email when only profile email changes.

**Acceptance family T37:** All fields/conditional occupation, invalid/future date, address locality, linked identities, partial save, stale editor and account switch. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (38):**

- [ ] **A37-001** Display the resident’s profile. *(source L1027)*
- [ ] **A37-002** Display the resident’s avatar. *(source L1028)*
- [ ] **A37-003** Display initials when no avatar is available. *(source L1029)*
- [ ] **A37-004** Upload or replace the avatar. *(source L1030)*
- [ ] **A37-005** Display avatar-upload progress. *(source L1031)*
- [ ] **A37-006** Display avatar-upload errors. *(source L1032)*
- [ ] **A37-007** Propagate avatar changes to other screens. *(source L1033)*
- [ ] **A37-008** Edit: *(source L1034)*
- [ ] **A37-009** First name. *(source L1035)*
- [ ] **A37-010** Last name. *(source L1036)*
- [ ] **A37-011** Middle name. *(source L1037)*
- [ ] **A37-012** Suffix. *(source L1038)*
- [ ] **A37-013** Sex. *(source L1039)*
- [ ] **A37-014** Profile email. *(source L1040)*
- [ ] **A37-015** House number. *(source L1041)*
- [ ] **A37-016** Street. *(source L1042)*
- [ ] **A37-017** Mobile number. *(source L1043)*
- [ ] **A37-018** Employment status. *(source L1044)*
- [ ] **A37-019** Occupation, where applicable. *(source L1045)*
- [ ] **A37-020** Date of birth. *(source L1046)*
- [ ] **A37-021** Display the assigned barangay as read-only. *(source L1047)*
- [ ] **A37-022** Display province as read-only. *(source L1048)*
- [ ] **A37-023** Display city as read-only for configured locality records; allow editing in the legacy case. *(source L1049)*
- [ ] **A37-024** Open sex selection. *(source L1050)*
- [ ] **A37-025** Open employment-status selection. *(source L1051)*
- [ ] **A37-026** Highlight the selected choice. *(source L1052)*
- [ ] **A37-027** Clear occupation when the new employment status does not use it. *(source L1053)*
- [ ] **A37-028** Add, edit, and remove household members. *(source L1054)*
- [ ] **A37-029** Track changes before saving. *(source L1055)*
- [ ] **A37-030** Validate required fields. *(source L1056)*
- [ ] **A37-031** Validate email formatting. *(source L1057)*
- [ ] **A37-032** Validate Philippine mobile-number formatting. *(source L1058)*
- [ ] **A37-033** Restrict mobile input to the supported length. *(source L1059)*
- [ ] **A37-034** Display per-field error/success indicators. *(source L1060)*
- [ ] **A37-035** Save profile changes. *(source L1061)*
- [ ] **A37-036** Show saving progress. *(source L1062)*
- [ ] **A37-037** Display save-result toasts. *(source L1063)*
- [ ] **A37-038** Display profile loading and guest states. *(source L1064)*

### A38 — Birthday calendar

**Source:** [breakdown §38, line 1068](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1068); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/birthday-calendar-modal.tsx:38).

**Delivery:** Phase 5; Birthday picker. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain month/year navigation, selected day, apply/cancel, date constraints and draft-vs-saved separation in an accessible iOS sheet/date control.

**Acceptance family T38:** Leap year, month length, future date, no date, cancel, large text and focus return. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (12):**

- [ ] **A38-001** Open the shared birthday picker. *(source L1070)*
- [ ] **A38-002** Display a calendar grid. *(source L1071)*
- [ ] **A38-003** Highlight the selected birthday. *(source L1072)*
- [ ] **A38-004** Navigate months. *(source L1073)*
- [ ] **A38-005** Jump through month/year selection. *(source L1074)*
- [ ] **A38-006** Prevent choosing future dates. *(source L1075)*
- [ ] **A38-007** Limit the earliest supported year to 1900. *(source L1076)*
- [ ] **A38-008** Start from the existing birthday. *(source L1077)*
- [ ] **A38-009** Use an adult-age fallback when no birthday exists. *(source L1078)*
- [ ] **A38-010** Save the selected date. *(source L1079)*
- [ ] **A38-011** Close/cancel the picker. *(source L1080)*
- [ ] **A38-012** Preserve dates using local calendar values to avoid timezone day shifts. *(source L1081)*

### A39 — Profile ID verification

**Source:** [breakdown §39, line 1083](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1083); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:869).

**Delivery:** Phase 5; ID type, front/back selection, preview and review state. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain all ID types, both sides, replaced/removed selection and verification states. Publish immutable evidence versions with approved/pending/rejected/revoked distinctions; keep 5 MiB limits and private expiring previews.

**Acceptance family T39:** Missing side, invalid type/MIME, changed evidence, revoked approval, expired preview and partial publication. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (35):**

- [ ] **A39-001** Display ID-verification status: *(source L1085)*
- [ ] **A39-002** Pending. *(source L1086)*
- [ ] **A39-003** Verified. *(source L1087)*
- [ ] **A39-004** Verification failed. *(source L1088)*
- [ ] **A39-005** Select ID type. *(source L1089)*
- [ ] **A39-006** Choose from: *(source L1090)*
- [ ] **A39-007** PhilSys. *(source L1091)*
- [ ] **A39-008** Digital PhilSys. *(source L1092)*
- [ ] **A39-009** Driver’s License. *(source L1093)*
- [ ] **A39-010** Passport. *(source L1094)*
- [ ] **A39-011** SSS ID. *(source L1095)*
- [ ] **A39-012** Voter’s ID. *(source L1096)*
- [ ] **A39-013** PhilHealth ID. *(source L1097)*
- [ ] **A39-014** PRC ID. *(source L1098)*
- [ ] **A39-015** UMID. *(source L1099)*
- [ ] **A39-016** Postal ID. *(source L1100)*
- [ ] **A39-017** Senior Citizen ID. *(source L1101)*
- [ ] **A39-018** PWD ID. *(source L1102)*
- [ ] **A39-019** GSIS ID. *(source L1103)*
- [ ] **A39-020** TIN ID. *(source L1104)*
- [ ] **A39-021** Barangay ID. *(source L1105)*
- [ ] **A39-022** Other. *(source L1106)*
- [ ] **A39-023** Enter the exact ID name when selecting Other. *(source L1107)*
- [ ] **A39-024** Upload the front side. *(source L1108)*
- [ ] **A39-025** Upload the back side. *(source L1109)*
- [ ] **A39-026** Preview uploaded ID images. *(source L1110)*
- [ ] **A39-027** Replace uploaded images. *(source L1111)*
- [ ] **A39-028** Validate image type and size. *(source L1112)*
- [ ] **A39-029** Display upload progress. *(source L1113)*
- [ ] **A39-030** Display upload failure. *(source L1114)*
- [ ] **A39-031** Submit ID evidence for staff review through the profile-save flow. *(source L1115)*
- [ ] **A39-032** Display verification feedback. *(source L1116)*
- [ ] **A39-033** Open the ID section directly from service verification prompts. *(source L1117)*
- [ ] **A39-034** Use the approved ID for applicable document requests. *(source L1118)*
- [ ] **A39-035** Avoid trusting cached approval when fresh verification cannot be confirmed. *(source L1119)*

### A40 — Email verification in Settings

**Source:** [breakdown §40, line 1123](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1123); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx:17).

**Delivery:** Phase 4; Email verification and status. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain send/code/resend/cooldown/success/retry and latest email status. Treat profile-email verification separately from auth login identity; account/profile email changes invalidate stale verification where server rules require.

**Acceptance family T40:** Changed email, old OTP, expiry, throttling, wrong account and interrupted verify. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (16):**

- [ ] **A40-001** Display the account’s email-verification state. *(source L1125)*
- [ ] **A40-002** Display Verified feedback. *(source L1126)*
- [ ] **A40-003** Send a verification code. *(source L1127)*
- [ ] **A40-004** Enter a six-digit code. *(source L1128)*
- [ ] **A40-005** Restrict code input to digits. *(source L1129)*
- [ ] **A40-006** Support code autofill. *(source L1130)*
- [ ] **A40-007** Disable verification for incomplete codes. *(source L1131)*
- [ ] **A40-008** Verify the email. *(source L1132)*
- [ ] **A40-009** Resend a code. *(source L1133)*
- [ ] **A40-010** Display resend cooldown. *(source L1134)*
- [ ] **A40-011** Disable resend during cooldown. *(source L1135)*
- [ ] **A40-012** Display loading state. *(source L1136)*
- [ ] **A40-013** Display errors and success feedback. *(source L1137)*
- [ ] **A40-014** Refresh profile information after verification. *(source L1138)*
- [ ] **A40-015** Retry failed profile/status loading. *(source L1139)*
- [ ] **A40-016** Check account/profile email consistency through the verification flow. *(source L1140)*

### A41 — Location verification

**Source:** [breakdown §41, line 1142](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1142); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx:40).

**Delivery:** Phase 5; Location map, current position and address confirmation. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain GPS/manual pin, boundary validation, address input, confirmation/save and status. Saving coordinates is not itself proof of verified residency; honor authoritative review state and iOS permission states.

**Acceptance family T41:** Outside boundary, missing boundary, approximate/stale GPS, manual pin, reverse-geocode failure, save conflict and retry. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (16):**

- [ ] **A41-001** Display a map for the resident’s saved location. *(source L1144)*
- [ ] **A41-002** Display the barangay boundary. *(source L1145)*
- [ ] **A41-003** Load an existing saved pin where available. *(source L1146)*
- [ ] **A41-004** Detect the device’s current location. *(source L1147)*
- [ ] **A41-005** Request foreground location permission. *(source L1148)*
- [ ] **A41-006** Handle denied permission. *(source L1149)*
- [ ] **A41-007** Handle unavailable location. *(source L1150)*
- [ ] **A41-008** Allow manual pin placement/movement. *(source L1151)*
- [ ] **A41-009** Reject locations outside the boundary. *(source L1152)*
- [ ] **A41-010** Detect an address from the selected position. *(source L1153)*
- [ ] **A41-011** Allow correction of the address. *(source L1154)*
- [ ] **A41-012** Save the selected location. *(source L1155)*
- [ ] **A41-013** Display **Location Saved** feedback. *(source L1156)*
- [ ] **A41-014** Display save failures. *(source L1157)*
- [ ] **A41-015** Display verified-location status in Settings. *(source L1158)*
- [ ] **A41-016** Show a login prompt for guests. *(source L1159)*

### A42 — Password management in Settings

**Source:** [breakdown §42, line 1161](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1161); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:104).

**Delivery:** Phase 4; Settings password management. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve current/new/confirm password fields and show/hide states, plus provider reauthentication for passwordless accounts. Require fresh same-account server proof for sensitive writes.

**Acceptance family T42:** Wrong current password, unknown legacy state, linked providers, expired proof, duplicate save and credential cleanup. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (16):**

- [ ] **A42-001** Display password-management status. *(source L1163)*
- [ ] **A42-002** Distinguish accounts with a password from accounts needing a first password. *(source L1164)*
- [ ] **A42-003** Enter current password. *(source L1165)*
- [ ] **A42-004** Enter new password. *(source L1166)*
- [ ] **A42-005** Confirm the new password. *(source L1167)*
- [ ] **A42-006** Show/hide password fields. *(source L1168)*
- [ ] **A42-007** Validate requirements and matching confirmation. *(source L1169)*
- [ ] **A42-008** Verify the current password. *(source L1170)*
- [ ] **A42-009** Update the password. *(source L1171)*
- [ ] **A42-010** Display success/error popups. *(source L1172)*
- [ ] **A42-011** Recover the password by email. *(source L1173)*
- [ ] **A42-012** Retry failed account-status checks. *(source L1174)*
- [ ] **A42-013** Confirm identity with Google before setting a first password where required. *(source L1175)*
- [ ] **A42-014** Set a first password for an eligible Google account. *(source L1176)*
- [ ] **A42-015** Display confirmation that email/password login is now available. *(source L1177)*
- [ ] **A42-016** Cancel or return from password management. *(source L1178)*

### A43 — Appearance preferences

**Source:** [breakdown §43, line 1180](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1180); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-theme-preference.tsx:9).

**Delivery:** Phase 6; Appearance: theme, accents and fonts. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Retain profile-persisted preferences and guest-session behavior, light/dark/system, presets/custom colors (maximum ten), preview/select/delete and every font ID. Specify lawful iOS font equivalents/fallbacks and Dynamic Type; optimistic failure must be visible/rolled back.

**Acceptance family T43:** All theme/font IDs, malformed/custom color, tenth/eleventh color, deleting selected color, relaunch/account switch and contrast. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (35):**

- [ ] **A43-001** Select Light theme. *(source L1182)*
- [ ] **A43-002** Select Dark theme. *(source L1183)*
- [ ] **A43-003** Apply the theme throughout the app. *(source L1184)*
- [ ] **A43-004** Apply it to navigation styling. *(source L1185)*
- [ ] **A43-005** Select from preset accent colors. *(source L1186)*
- [ ] **A43-006** Show a checkmark on the active color. *(source L1187)*
- [ ] **A43-007** Scroll the color row. *(source L1188)*
- [ ] **A43-008** Open the custom-color modal. *(source L1189)*
- [ ] **A43-009** Choose hue using a slider. *(source L1190)*
- [ ] **A43-010** Choose saturation/brightness using the color square. *(source L1191)*
- [ ] **A43-011** Preview the chosen color. *(source L1192)*
- [ ] **A43-012** Save a custom color. *(source L1193)*
- [ ] **A43-013** Apply a newly saved color. *(source L1194)*
- [ ] **A43-014** Reject invalid or duplicate custom colors. *(source L1195)*
- [ ] **A43-015** Save up to ten custom colors. *(source L1196)*
- [ ] **A43-016** Display the saved-color count. *(source L1197)*
- [ ] **A43-017** Long-press a custom color to remove it. *(source L1198)*
- [ ] **A43-018** Confirm custom-color removal. *(source L1199)*
- [ ] **A43-019** Cancel removal or color selection. *(source L1200)*
- [ ] **A43-020** Persist supported resident appearance preferences. *(source L1201)*
- [ ] **A43-021** Select a font style. *(source L1202)*
- [ ] **A43-022** Preview each font in its selection chip. *(source L1203)*
- [ ] **A43-023** Highlight the selected font. *(source L1204)*
- [ ] **A43-024** Support ten font choices: *(source L1205)*
- [ ] **A43-025** System. *(source L1206)*
- [ ] **A43-026** Inter. *(source L1207)*
- [ ] **A43-027** Arial. *(source L1208)*
- [ ] **A43-028** Helvetica. *(source L1209)*
- [ ] **A43-029** Segoe UI. *(source L1210)*
- [ ] **A43-030** Verdana. *(source L1211)*
- [ ] **A43-031** Tahoma. *(source L1212)*
- [ ] **A43-032** Trebuchet MS. *(source L1213)*
- [ ] **A43-033** Georgia. *(source L1214)*
- [ ] **A43-034** Times New Roman. *(source L1215)*
- [ ] **A43-035** Persist the selected font preference. *(source L1216)*

### A44 — Notifications

**Source:** [breakdown §44, line 1220](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1220); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-notification-preferences.tsx:24).

**Delivery:** Phase 17; Preferences, inbox and remote push. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve push preference controls and source SMS preference visibility, but never present the local-only SMS switch as operational consent. Implement reliable remote delivery and connect tap routing; inbox, announcement and resolved-report read states remain distinct.

**Acceptance family T44:** Permission denial/settings change, opt-out, token rotation, offline logout, cold/warm tap, invalid destination and delivery receipts. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (18):**

- [ ] **A44-001** Turn push notifications on/off. *(source L1222)*
- [ ] **A44-002** Save the resident’s push preference. *(source L1223)*
- [ ] **A44-003** Request notification permission. *(source L1224)*
- [ ] **A44-004** Register the device’s push token. *(source L1225)*
- [ ] **A44-005** Refresh/register the token when an eligible session starts. *(source L1226)*
- [ ] **A44-006** Remove the registered token when push is switched off. *(source L1227)*
- [ ] **A44-007** Present notifications from subscribed events for: *(source L1228)*
- [ ] **A44-008** New announcements. *(source L1229)*
- [ ] **A44-009** New medical drives. *(source L1230)*
- [ ] **A44-010** Medical registration updates. *(source L1231)*
- [ ] **A44-011** Incident updates. *(source L1232)*
- [ ] **A44-012** Service-request updates. *(source L1233)*
- [ ] **A44-013** Build event-specific notification titles and messages. *(source L1234)*
- [ ] **A44-014** Respect the push opt-in for the app’s notification subscriptions. *(source L1235)*
- [ ] **A44-015** Handle permission denial or registration failure. *(source L1236)*
- [ ] **A44-016** Avoid unsupported notification registration in Expo Go. *(source L1237)*
- [ ] **A44-017** Require a suitable native build and physical device for the token-registration path. *(source L1238)*
- [ ] **A44-018** Display an SMS preference switch. *(source L1239)*

### A45 — Download My Data

**Source:** [breakdown §45, line 1243](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1243); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/index.tsx:53).

**Delivery:** Phase 18; Download My Data: PDF / JSON. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve format chooser, cooldown, progress, error/success and native share. Export a validated complete versioned inventory with full pagination and household coverage; no partial required-section export labeled complete.

**Acceptance family T45:** Above server row limit, failing section, unavailable network, share cancellation, sensitive-file cleanup and cooldown. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (20):**

- [ ] **A45-001** Open an export-format chooser. *(source L1245)*
- [ ] **A45-002** Choose readable PDF. *(source L1246)*
- [ ] **A45-003** Choose raw JSON. *(source L1247)*
- [ ] **A45-004** Cancel before generating the export. *(source L1248)*
- [ ] **A45-005** Request the resident’s data export. *(source L1249)*
- [ ] **A45-006** Display export-preparation progress. *(source L1250)*
- [ ] **A45-007** Prevent another export while one is running. *(source L1251)*
- [ ] **A45-008** Generate a readable PDF from the returned data. *(source L1252)*
- [ ] **A45-009** Generate a JSON file. *(source L1253)*
- [ ] **A45-010** Open Android’s save/share interface. *(source L1254)*
- [ ] **A45-011** Display success/file information where supported. *(source L1255)*
- [ ] **A45-012** Display export errors. *(source L1256)*
- [ ] **A45-013** Render returned sections such as: *(source L1257)*
- [ ] **A45-014** Account. *(source L1258)*
- [ ] **A45-015** Profile. *(source L1259)*
- [ ] **A45-016** Service requests. *(source L1260)*
- [ ] **A45-017** Incident reports. *(source L1261)*
- [ ] **A45-018** Medical-drive registrations. *(source L1262)*
- [ ] **A45-019** Evacuation-center check-ins. *(source L1263)*
- [ ] **A45-020** Registered devices. *(source L1264)*

### A46 — Delete My Account

**Source:** [breakdown §46, line 1266](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1266); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/delete-account-modal.tsx:27).

**Delivery:** Phase 18; Delete account and confirmation. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve accessible warning/confirmation, password/provider confirmation and progress/error handling. Implement truthful deletion/retention and Apple revocation; Android’s ban/anonymization alone must not be described as complete permanent deletion.

**Acceptance family T46:** Fresh same-account proof, cancel, invalid proof, lost reply, retries, retained obligations, storage cleanup and old JWT denial. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (12):**

- [ ] **A46-001** Open the account-deletion workflow. *(source L1268)*
- [ ] **A46-002** Check the account’s current authentication/setup status. *(source L1269)*
- [ ] **A46-003** Display the permanent-deletion explanation. *(source L1270)*
- [ ] **A46-004** Cancel deletion. *(source L1271)*
- [ ] **A46-005** Require password re-entry for the applicable password-account flow. *(source L1272)*
- [ ] **A46-006** Confirm identity with Google for the applicable Google-account flow. *(source L1273)*
- [ ] **A46-007** Require a final explicit deletion confirmation after Google confirmation. *(source L1274)*
- [ ] **A46-008** Submit the account-deletion request. *(source L1275)*
- [ ] **A46-009** Disable conflicting actions during confirmation/deletion. *(source L1276)*
- [ ] **A46-010** Display deletion progress. *(source L1277)*
- [ ] **A46-011** Display deletion failure. *(source L1278)*
- [ ] **A46-012** Clear the session through the completed deletion/logout flow. *(source L1279)*

### A47 — Logout and session cleanup

**Source:** [breakdown §47, line 1281](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1281); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-auth.tsx:37).

**Delivery:** Phase 4; integration Phases 17–19; Logout and account switch. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve logout notice, route reset and cleanup of profile/drafts/preferences/pending OTP/OAuth/recovery/uploads/subscriptions. Use a cleanup tombstone when offline/error prevents remote token removal or protected-store cleanup.

**Acceptance family T47:** Offline logout, uncertain Keychain failure, process kill, reinstall, revoked session and next account isolation. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (12):**

- [ ] **A47-001** Select Logout. *(source L1283)*
- [ ] **A47-002** Display logging-out progress. *(source L1284)*
- [ ] **A47-003** Sign out the current local session. *(source L1285)*
- [ ] **A47-004** Exit guest/session-related state appropriately. *(source L1286)*
- [ ] **A47-005** Clear account-setup hints. *(source L1287)*
- [ ] **A47-006** Clear recovery hints. *(source L1288)*
- [ ] **A47-007** Clear stored Google authentication-flow data. *(source L1289)*
- [ ] **A47-008** Remove resident-specific cached profile data. *(source L1290)*
- [ ] **A47-009** Return to the signed-out flow. *(source L1291)*
- [ ] **A47-010** Display logout feedback. *(source L1292)*
- [ ] **A47-011** Display an error if sign-out cannot be confirmed. *(source L1293)*
- [ ] **A47-012** Require session-restoration recovery before another sign-in when sign-out status is uncertain. *(source L1294)*

### A48 — Help Center

**Source:** [breakdown §48, line 1298](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1298); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/help/index.tsx:194).

**Delivery:** Phase 18; Help categories, article and support. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Keep all seven category choices, article content/rich rendering, expansion/navigation and approved support actions. Search, if shown, must work across paginated articles.

**Acceptance family T48:** Every category, empty/error, missing article, allowed external link, support unavailable and accessibility. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (20):**

- [ ] **A48-001** Open the Help Center. *(source L1300)*
- [ ] **A48-002** Load FAQ/help articles. *(source L1301)*
- [ ] **A48-003** Filter by: *(source L1302)*
- [ ] **A48-004** All. *(source L1303)*
- [ ] **A48-005** General. *(source L1304)*
- [ ] **A48-006** Services. *(source L1305)*
- [ ] **A48-007** Emergency. *(source L1306)*
- [ ] **A48-008** Health. *(source L1307)*
- [ ] **A48-009** Billing. *(source L1308)*
- [ ] **A48-010** Account. *(source L1309)*
- [ ] **A48-011** Display article preview cards. *(source L1310)*
- [ ] **A48-012** Open an article. *(source L1311)*
- [ ] **A48-013** Display article content with Markdown formatting. *(source L1312)*
- [ ] **A48-014** Return to the article list. *(source L1313)*
- [ ] **A48-015** Display loading skeletons. *(source L1314)*
- [ ] **A48-016** Display an empty-category message. *(source L1315)*
- [ ] **A48-017** Display an article-not-found message. *(source L1316)*
- [ ] **A48-018** Display article-loading errors. *(source L1317)*
- [ ] **A48-019** Retry help-list loading. *(source L1318)*
- [ ] **A48-020** Display retry feedback. *(source L1319)*

### A49 — Terms, privacy, About Us, and app information

**Source:** [breakdown §49, line 1321](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1321); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/terms-privacy.tsx:67).

**Delivery:** Phase 18; Terms, Privacy, About and app version. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve separate legal/content sections, collapsible rich text, mission/vision/history, contacts, developer cards and brand images. Use runtime binary version/build and approved dated published content.

**Acceptance family T49:** All sections, unavailable remote content, invalid external links, long text, license attribution and version identity. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (15):**

- [ ] **A49-001** Open Terms & Privacy Policy. *(source L1323)*
- [ ] **A49-002** Load published policy content. *(source L1324)*
- [ ] **A49-003** Expand/collapse Terms. *(source L1325)*
- [ ] **A49-004** Expand/collapse Privacy Policy. *(source L1326)*
- [ ] **A49-005** Read formatted policy content. *(source L1327)*
- [ ] **A49-006** Display policy-loading states. *(source L1328)*
- [ ] **A49-007** Open About Us. *(source L1329)*
- [ ] **A49-008** Display configured barangay/app information. *(source L1330)*
- [ ] **A49-009** Display Mission. *(source L1331)*
- [ ] **A49-010** Display Vision. *(source L1332)*
- [ ] **A49-011** Display History. *(source L1333)*
- [ ] **A49-012** Display Contact information. *(source L1334)*
- [ ] **A49-013** Display Development Team information. *(source L1335)*
- [ ] **A49-014** Display About-page loading states. *(source L1336)*
- [ ] **A49-015** Display the configured app version in Settings. *(source L1337)*

### A50 — Small shared interactions

**Source:** [breakdown §50, line 1339](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1339); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/text-field.tsx:26).

**Delivery:** Phases 1, 6 and 19; feature-phase controls throughout; Shared controls and all modal interaction standards. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Preserve useful input, selection, validation, refresh, accordion, segmented control, photo viewer and feedback behavior. Apply iOS keyboard/safe-area/back/swipe conventions, accessible focus and announced validation; no copied Android-only APIs.

**Acceptance family T50:** Every control/modal, dirty dismissal, keyboard, no-results/error distinctions, largest text, VoiceOver and reduced motion. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (38):**

- [ ] **A50-001** Required-field markers. *(source L1343)*
- [ ] **A50-002** Placeholder text. *(source L1344)*
- [ ] **A50-003** Context-appropriate keyboards. *(source L1345)*
- [ ] **A50-004** Password visibility controls. *(source L1346)*
- [ ] **A50-005** Character counters. *(source L1347)*
- [ ] **A50-006** Selected-choice checkmarks. *(source L1348)*
- [ ] **A50-007** Status badges and icons. *(source L1349)*
- [ ] **A50-008** Progress bars. *(source L1350)*
- [ ] **A50-009** Countdown timers. *(source L1351)*
- [ ] **A50-010** Loading spinners. *(source L1352)*
- [ ] **A50-011** Skeleton placeholders. *(source L1353)*
- [ ] **A50-012** Shimmer effects. *(source L1354)*
- [ ] **A50-013** Empty-state messages. *(source L1355)*
- [ ] **A50-014** Not-found messages. *(source L1356)*
- [ ] **A50-015** Retry buttons. *(source L1357)*
- [ ] **A50-016** Inline errors. *(source L1358)*
- [ ] **A50-017** Success toasts. *(source L1359)*
- [ ] **A50-018** Success/error popups. *(source L1360)*
- [ ] **A50-019** Destructive-action confirmations. *(source L1361)*
- [ ] **A50-020** Disabled controls during active requests. *(source L1362)*
- [ ] **A50-021** Press feedback. *(source L1363)*
- [ ] **A50-022** Fade-in animations. *(source L1364)*
- [ ] **A50-023** Sliding modal sheets. *(source L1365)*
- [ ] **A50-024** Animated subsection indicators. *(source L1366)*
- [ ] **A50-025** Scrollable choice rows. *(source L1367)*
- [ ] **A50-026** Modal close buttons. *(source L1368)*
- [ ] **A50-027** Backdrop dismissal where enabled. *(source L1369)*
- [ ] **A50-028** Android back handling for supported modals and guarded flows. *(source L1370)*
- [ ] **A50-029** Enlarged touch areas on selected controls. *(source L1371)*
- [ ] **A50-030** Accessibility button labels. *(source L1372)*
- [ ] **A50-031** Selected/disabled accessibility states. *(source L1373)*
- [ ] **A50-032** Screen-reader announcements for supported status/error changes. *(source L1374)*
- [ ] **A50-033** Image placeholders and initials. *(source L1375)*
- [ ] **A50-034** Philippine peso formatting. *(source L1376)*
- [ ] **A50-035** Date/time formatting. *(source L1377)*
- [ ] **A50-036** Relative announcement timestamps. *(source L1378)*
- [ ] **A50-037** File-picker cancellation handling. *(source L1379)*
- [ ] **A50-038** Human-readable filenames when Android supplies opaque file identifiers. *(source L1380)*

### A51 — Automatic and supporting functions

**Source:** [breakdown §51, line 1382](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1382); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-profile.ts:22).

**Delivery:** Phase 2; feature integration Phases 4–19; Automatic lifecycle/data/device behavior. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Port session/profile refresh, owner-bound async guards, realtime cleanup, caches, idempotency, uploads, previews, QR/PDF and exports. Replace Android content-URI/gallery handling with version-qualified iOS file/Photos behavior; broken check-in queue is not success.

**Acceptance family T51:** Lifecycle/account race, interrupted storage/cleanup, stale cache, unsupported native capability and reconnect reconciliation. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (27):**

- [ ] **A51-001** Restore and maintain authentication state. *(source L1384)*
- [ ] **A51-002** Refresh the shared resident profile. *(source L1385)*
- [ ] **A51-003** Refresh profile information when the app returns to the foreground. *(source L1386)*
- [ ] **A51-004** Cache resident demographic information by account. *(source L1387)*
- [ ] **A51-005** Clear cached identity information during logout. *(source L1388)*
- [ ] **A51-006** Keep verification-sensitive decisions dependent on fresh status. *(source L1389)*
- [ ] **A51-007** Subscribe to relevant data changes. *(source L1390)*
- [ ] **A51-008** Refresh subscribed lists and counters after changes. *(source L1391)*
- [ ] **A51-009** Remove subscriptions when their screen/provider is disposed. *(source L1392)*
- [ ] **A51-010** Guard against responses belonging to an earlier account or request. *(source L1393)*
- [ ] **A51-011** Prevent concurrent authentication/setup operations. *(source L1394)*
- [ ] **A51-012** Detect uncertain network outcomes in supported setup flows. *(source L1395)*
- [ ] **A51-013** Protect supported service submissions from accidental duplicates. *(source L1396)*
- [ ] **A51-014** Cache emergency guidelines. *(source L1397)*
- [ ] **A51-015** Cache emergency hotlines. *(source L1398)*
- [ ] **A51-016** Cache QR-guide content. *(source L1399)*
- [ ] **A51-017** Cache evacuation-center records. *(source L1400)*
- [ ] **A51-018** Use bundled emergency-content fallback data. *(source L1401)*
- [ ] **A51-019** Upload resident images and supporting documents. *(source L1402)*
- [ ] **A51-020** Read files chosen through Android’s system picker. *(source L1403)*
- [ ] **A51-021** Handle Android content-file permissions. *(source L1404)*
- [ ] **A51-022** Generate private ID preview URLs. *(source L1405)*
- [ ] **A51-023** Generate QR images. *(source L1406)*
- [ ] **A51-024** Capture QR images for gallery saving. *(source L1407)*
- [ ] **A51-025** Generate receipt PDFs. *(source L1408)*
- [ ] **A51-026** Generate personal-data export PDFs. *(source L1409)*
- [ ] **A51-027** Queue failed evacuation check-in attempts locally. *(source L1410)*

### A52 — Present in the source, but incomplete, conditional, or not connected

**Source:** [breakdown §52, line 1412](/C:/Users/User/barangayan/contexts/Resident_Android_Features&Functions_BreakdownList.md:1412); [Android implementation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/preparedness-guide.tsx:5).

**Delivery:** Phase 0; corrective/partial resolutions throughout Phases 1–20; Partial/dead-source disposition register. **Disposition:** required functional/native equivalent, except explicit corrections in §6.8. **iOS status:** not assessed as complete by this document revision. **Owner:** responsible numbered-phase engineer(s); name assigned in Phase 0.

**Binding iOS requirement:** Resolve every listed incomplete item explicitly under §6.8. Working outcomes are required; an unused file, disabled switch or helper without a caller is not acceptance evidence. Future weather/BFS work remains separately scoped.

**Acceptance family T52:** Each partial-source item has a documented active equivalent, honest unavailable state or approved corrective disposition and evidence. Also apply the shared fault/accessibility matrix in Appendix C.

**Source checkpoints (12):**

- [ ] **A52-001** **Home search:** typeable input; no connected search. *(source L1416)*
- [ ] **A52-002** **Services search:** typeable input; no connected filtering/search. *(source L1417)*
- [ ] **A52-003** **Map filter icon:** visible button; no separate action connected. The category chips do work. *(source L1418)*
- [ ] **A52-004** **SMS notifications:** local switch state; no completed persisted SMS opt-in flow shown. *(source L1419)*
- [ ] **A52-005** **QR PH settlement:** conditional on the payment configuration flag. *(source L1420)*
- [ ] **A52-006** **Standalone Maps hotline-directory route:** placeholder screen. Working hotlines are in Emergency Hub. *(source L1421)*
- [ ] **A52-007** **Standalone Maps preparedness-guide route:** placeholder screen. Working guidelines are in Emergency Hub. *(source L1422)*
- [ ] **A52-008** **Offline check-in synchronization:** a queue and synchronization function exist, but I found no caller connecting that synchronization function to automatic reconnect behavior. *(source L1423)*
- [ ] **A52-009** **Notification-tap routing:** a notification-response helper exists, but I found no connected caller that opens the relevant screen from a notification tap. *(source L1424)*
- [ ] **A52-010** **Older health registration modal:** remains in the source; the current Register action opens the full-screen applicant form. *(source L1425)*
- [ ] **A52-011** **Onboarding screens:** implemented routes, but the current signed-out root entry uses account choice rather than starting at Welcome. *(source L1426)*
- [ ] **A52-012** **Weather-based evacuation guidance and BFS/Dijkstra routing:** not wired into the current Android screens inspected. Current center routing uses the road-route helper and distance estimates. *(source L1427; 2026-10-16: the helper was replaced by the first-party route service and, on Android, an offline routing pack — see §6.4 and OD-11)*

## Appendix B — Contract, route, modal and asset catalogue

### B.1 Authoritative integration baseline

The following are **source-discovered contracts**, not a statement that each is deployed, secure or production-qualified. For every row, Phases 0 and 3 must record exact input/output schema (including nullable fields), deployed version, grants/RLS, owner/tenant/role predicates, error codes, read/write effect, idempotency, pagination, cache key/freshness, realtime invalidation and retention. Use strict response validation at boundaries. Unknown/missing response fields fail safely; HTTP failure, network failure, timeout/unknown commit and valid empty data are different outcomes.

| ID / parity | Existing integration and evidence | Binding iOS handling |
|---|---|---|
| B01 / A01–A07, A42, A47 | Supabase Auth and [Android auth provider](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-auth.tsx:37), Google flow/recovery helpers. | Email/password, signup/OTP, Google PKCE, recovery/update, refresh/logout; role/deleted-profile check, callback ownership and protected persistence. Apple token exchange is additive work, not an existing Android capability. |
| B02 / A04–A07 | [get_resident_account_setup_status](/C:/Users/User/barangayan/packages/shared/src/lib/resident-account-setup.ts:62); [ensure_google_resident_profile and registration locality](/C:/Users/User/barangayan/packages/shared/src/lib/resident-auth.ts:24); `barangay_localities`, `barangays`; `complete_resident_profile`. | Server-owned setup progression and trusted locality/boundary. Version Apple-aware response separately from strict legacy schemas. Never select an arbitrary first tenant or infer authorization from metadata. |
| B03 / A06, A37–A41, A43–A44 | `profiles`, locality join; [useProfile](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-profile.ts:22), profile/appearance/preference writes. | Enumerate field-level writable/read-only/verification fields. Conditional versioned edits, invalidated verification, partial-save reporting, fresh sensitive gates, preference rollback and account-bound cache. |
| B04 / A27, A37 | `profiles.household_members`, canonical `household_members`, mirror/guard migrations; [JSON editor](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-profile-household-members.ts:39). | Shared Family/profile state; stable UUIDs, no duplicates/foreign IDs, conditional whole-list update, mirror parity and preserved staff attendance. Unused direct-table helper is not a new resident screen. |
| B05 / A10–A11, A39 | `id_submissions`, `profiles.approved_id_submission_id`, `publish_id_submission`; [shared operations](/C:/Users/User/barangayan/packages/shared/src/lib/service-foundations.ts:16). | Immutable owned evidence publication, correct verified/rejected/revoked/pending version and expiring private previews. Admin ID review is not resident-callable functionality. |
| B06 / A09–A11 | `document_types`, charter/pricing/purpose/requirement rules; [service schemas](/C:/Users/User/barangayan/packages/shared/src/schemas/service-foundations.ts:17). | Active/nondeleted tenant catalogue and all conditional rules; preserve legacy/version-2 paths, searchable projection, strict parse and realtime refresh. |
| B07 / A11–A14, A18 | `submit_service_request`, `service_requests`, request relationships/history; [resident submission](/C:/Users/User/barangayan/packages/shared/src/lib/resident-submission.ts:1); `cancel_own_service_request`. | UUID idempotency/payload binding, committed ID/reference, ownership/tenant checks, reviewed snapshots and cancel reconciliation. No unsafe direct-insert bypass. |
| B08 / A13 | `service_request_sla_tracking`; [agency SLA component](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/agency-sla-status.tsx:7), shared timing schemas/calculations. | Parse authoritative intervals/state/target/evaluated time; preserve both timing models, foreground projection and readable pause history. Staff accept/pause/resume/ready/release operations remain privileged. |
| B09 / A15–A17 | `payments`; `set_service_request_payment_method`, `start_pickup_payment`; [payment screen](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:67). | Committed centavos/assessment basis, free/waived/pending/paid distinctions and method reconciliation. No resident fee-assessment/collection mutation. |
| B10 / A14, A16–A17 | `create-payment-source`, `check-payment-status`, `cancel-payment`; [source hook](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-paymongo-source.ts:30); server `paymongo-webhook` and refund operations. | Send request/payment IDs, not trusted client amounts. Validate source IDs/QR URL/expiry/fees/status. Treat already-paid separately, reuse active attempt, handle partial failure, signed webhook/replay and provider/database races. Privileged refunds never originate from a new resident button. |
| B11 / A19, A32–A34 | `incidents`, `incident_categories`, `waste_zones`, `incident_confirmations`; `confirm_incident`, `withdraw_incident`; [detail operations](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/[incidentId].tsx:513). | Tenant-safe public/own projections, immutable owned creation, validated location/photos, confirmation deduplication, eligible withdrawal and moderation controls. |
| B12 / A08, A28, A32, A35–A36 | `announcements`, `announcement_reads`, `incidents.resolved_read_at`; [unread provider](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-unread-counts.tsx:54). | Distinct counts, owner-safe read/unread, snapshot-bounded bulk actions, date/category filters and pagination. Client filters do not replace RLS or tenant checks. |
| B13 / A20–A26 | `emergency_information`, `emergency_qr_content`, `evacuation_centers`; emergency hooks and bundled seed content. | Approved tenant public projection/cache, version/freshness labels, active-center and occupancy handling, structured guideline/hotline/QR content. |
| B14 / A25 | `evacuation_center_checkins`; [Android check-in helper](/C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-qr-checkins.ts:23). | Current client insert is not enough: verify resident/tenant/active-center server guards, uniqueness/retry and authoritative receipt. Online-only correction; no client bulk household attendance. |
| B15 / A27 | Authenticated GET `/functions/v1/generate-household-qr?profileId=...`; [server function](/C:/Users/User/barangayan/supabase/functions/generate-household-qr/index.ts:14). | JWT ownership and deleted-state validation; PNG response and cache isolation. Existing server sends profile UUID to `api.qrserver.com`: approve/disclose processor or qualify local generation. Do not log tokens or retain another account's cached QR. |
| B16 / A29–A31 | `medical_drives`, `drive_registrations`, `register_for_drive`; [registration RPC](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:443) and shared result schema. | Resident-only self registration, active same-tenant drive, actual age/PWD/conditions/prior-dose/consent, capacity/duplicate checks, authoritative applicant number and resident-safe history. |
| B17 / A40 | `verify-resident-email`; [shared verification client](/C:/Users/User/barangayan/packages/shared/src/lib/resident-email-verification.ts:22). | Current-profile-email binding, send/verify response validation, cooldown/expiry, status invalidation and uncertain-result recovery. |
| B18 / A44, A51 | `upsert_push_token`, `push_tokens`, profile opt-in; [registration](/C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/push-notifications.ts:95); foreground realtime notification templates. | iOS device/environment/owner registration, removal/retry and consent. Durable inbox/outbox/sender/receipt processor is new required architecture; current realtime/local notification code is not remote-delivery proof. |
| B19 / A45 | `export-my-data`; [export function](/C:/Users/User/barangayan/supabase/functions/export-my-data/index.ts:57), `last_data_export_at`, PDF formatter. | Complete versioned account inventory with per-section errors and pagination; PDF/JSON and cooldown only after server truth. Token/device secrets excluded; see G10. |
| B20 / A46–A47 | `delete-my-account`, `request_own_account_deletion`; [function](/C:/Users/User/barangayan/supabase/functions/delete-my-account/index.ts:87), storage cleanup helper. | Fresh same-account server proof, explicit retention inventory, auth/provider revocation, idempotent cleanup/audit and terminal truthful outcome; old access tokens cannot continue using protected operations. |
| B21 / A48–A49 | `faq_articles`, `site_content`, `about_us`, `developer_profiles`; corresponding hooks. | Active/approved scoped content, Markdown/link validation, fallback/version/publisher, full Help categories and About/legal sections. |
| B22 / A19, A24, A33, A41 | Bundled boundary, Leaflet/WebView tiles, [Nominatim reverse geocoder](/C:/Users/User/barangayan/packages/shared/src/lib/geocode.ts:15), OSRM route helper (baseline; deleted in `063c94d`, replaced by the first-party `evacuation-route` function and shared connected-route client — OD-11). | Processor approval, attribution, traffic/rate-limit policy, validated finite coordinates/bridge, abort/timeout and typed manual/fallback path. No unrestricted CDN navigation or assertion of emergency safety. |
| B23 / A11, A33, A37, A39 | Storage: `request-attachments`, `id-documents`, `incident-photos`, `profile-photos`; [upload helper](/C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/supporting-upload.ts:1) and image upload paths. | Actual-byte/MIME limits, owner/tenant paths, immutable evidence, signed identity access, privacy-reviewed public avatar/incident access, orphan/retention cleanup and iCloud/file lifetime. No new public ID bucket. |
| B24 / A08–A51 | Realtime listeners on catalogue, requests/payments, incidents/announcements/read-state, drives/registrations and profile-related data where present. | Record exact subscription filters from source, unique channel lifecycle, owner/tenant guard, coalesced refetch and pagination reconciliation. Unsubscribe on disposal/account change; no background delivery assumption. |

Keep `review_id_submission`, `assess_service_request_fee`, `review_service_request`, `transition_service_request_sla`, `collect_pickup_payment` and other admin-only operations out of resident controls and grants. A shared exported helper is not authorization to invoke it from iOS.

For every B-row mutation, test forbidden anonymous/nonresident/cross-tenant/deleted/inactive cases and verify **no post-state side effects**. Source-present migrations 0093/0094 and subsequent foundations/setup fixes must be reconciled with actual deployment; migration filenames or historical local logs do not establish production readiness.

### B.2 Route and deep-link mapping

The table below inventories every Android app route/layout file discovered at this baseline. Layout entries are infrastructure, not extra screens. iOS destinations describe the required final route contract; a destination named here is **not** asserted to exist already. Existing iOS paths may be retained or deliberately aliased after Phase 0 typed-route review, but every Android resident outcome and incoming-link meaning must map once.

Preserve record-type separation: Android `/reports/[incidentId]` means incident detail, while the current iOS `/reports/[id]` renders an announcement. Introduce distinct typed incident/announcement destinations; never redirect by guessing UUID record type. Record existing-link aliases and safe obsolete/malformed handling. Payment success parameters are hints for lookup, not proof of payment.

| Route ID | Android source file | Required iOS destination / disposition |
|---|---|---|
| R01 | [_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/_layout.tsx:27) | Root providers, protected bootstrap and auth/setup restoration |
| R02 | [(app)/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/_layout.tsx:1) | Six native destinations with More overflow |
| R03 | [(app)/health/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/_layout.tsx:1) | Nested health stack; iOS header/back/safe-area |
| R04 | [(app)/health/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/index.tsx:2209) | /health |
| R05 | [(app)/health/register.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:282) | /health/register |
| R06 | [(app)/home/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/_layout.tsx:1) | Nested home stack; iOS header/back/safe-area |
| R07 | [(app)/home/emergency-info/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/_layout.tsx:1) | Nested home/emergency-info stack; iOS header/back/safe-area |
| R08 | [(app)/home/emergency-info/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx:102) | /emergency; preserve Home/emergency entry and all section state |
| R09 | [(app)/home/emergency-info/qr-guide.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/qr-guide.tsx:1) | /emergency/qr-guide; obsolete duplicate aliases converge here |
| R10 | [(app)/home/emergency-info/scan.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/scan.tsx:1) | /emergency/scan; guest gate then camera/online check-in |
| R11 | [(app)/home/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/index.tsx:55) | /home |
| R12 | [(app)/index/emergency-info/qr-guide.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/index/emergency-info/qr-guide.tsx:1) | /emergency/qr-guide; obsolete duplicate aliases converge here |
| R13 | [(app)/maps/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/_layout.tsx:1) | Nested maps stack; iOS header/back/safe-area |
| R14 | [(app)/maps/hotline-directory.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/hotline-directory.tsx:1) | /emergency?section=hotlines; replace placeholder |
| R15 | [(app)/maps/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx:67) | /maps |
| R16 | [(app)/maps/preparedness-guide.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/preparedness-guide.tsx:5) | /emergency?section=guidelines; replace placeholder |
| R17 | [(app)/reports/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/_layout.tsx:1) | Nested reports stack; iOS header/back/safe-area |
| R18 | [(app)/reports/[incidentId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/[incidentId].tsx:431) | /reports/incidents/[incidentId]; dedicated incident type, not current iOS announcement detail |
| R19 | [(app)/reports/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/index.tsx:73) | /reports |
| R20 | [(app)/reports/new.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:189) | /reports/new |
| R21 | [(app)/services/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/_layout.tsx:1) | Nested services stack; iOS header/back/safe-area |
| R22 | [(app)/services/[documentId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/[documentId].tsx:80) | /services/[documentId] |
| R23 | [(app)/services/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/index.tsx:40) | /services |
| R24 | [(app)/services/payment/[requestId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/[requestId].tsx:1) | /services/payment/[requestId]; shared assessment/method view |
| R25 | [(app)/services/payment/pickup/[requestId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/pickup/[requestId].tsx:1) | /services/payment/pickup/[requestId]; authoritative assessment/pickup view |
| R26 | [(app)/services/payment/qrph/[requestId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/qrph/[requestId].tsx:77) | /services/payment/qrph/[requestId] |
| R27 | [(app)/services/payment/success.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/success.tsx:21) | /services/payment/success; committed paid-record lookup |
| R28 | [(app)/services/request/[documentId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/request/[documentId].tsx:1) | /services/request/[documentId] |
| R29 | [(app)/services/requests/[requestId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx:80) | /services/requests/[requestId] |
| R30 | [(app)/settings/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/_layout.tsx:1) | Nested settings stack; iOS header/back/safe-area |
| R31 | [(app)/settings/about.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/about.tsx:1) | /settings/about |
| R32 | [(app)/settings/change-password.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:104) | /settings/change-password |
| R33 | [(app)/settings/email-verification.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx:17) | /settings/email-verification |
| R34 | [(app)/settings/help/[articleId].tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/help/[articleId].tsx:1) | /settings/help/[articleId] |
| R35 | [(app)/settings/help/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/help/index.tsx:194) | /settings/help |
| R36 | [(app)/settings/index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/index.tsx:53) | /settings |
| R37 | [(app)/settings/location-verification.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx:40) | /settings/location-verification |
| R38 | [(app)/settings/profile.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:869) | /settings/profile |
| R39 | [(app)/settings/terms-privacy.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/terms-privacy.tsx:67) | /settings/terms-privacy |
| R40 | [(auth)/_layout.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/_layout.tsx:1) | Authentication/onboarding stack |
| R41 | [(auth)/auth-choice.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/auth-choice.tsx:18) | /auth/choice; alias current /auth entry intentionally |
| R42 | [(auth)/completion.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/completion.tsx:1) | /onboarding/completion; intentional introductory entry |
| R43 | [(auth)/forgot-password.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx:14) | /auth/recovery |
| R44 | [(auth)/login.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/login.tsx:26) | /auth/login |
| R45 | [(auth)/otp.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/otp.tsx:1) | /auth/otp (owned registration attempt) |
| R46 | [(auth)/personalization.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/personalization.tsx:1) | /onboarding/personalization; intentional introductory entry |
| R47 | [(auth)/register.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/register.tsx:17) | /auth/register; preserve current /register alias |
| R48 | [(auth)/reset-password.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/reset-password.tsx:1) | /auth/reset-password (validated recovery only) |
| R49 | [(auth)/value-prop.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/value-prop.tsx:1) | /onboarding/value-prop; intentional introductory entry |
| R50 | [(auth)/welcome.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/welcome.tsx:7) | /onboarding/welcome; intentional introductory entry |
| R51 | [account-setup.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/account-setup.tsx:12) | /account-setup |
| R52 | [auth/callback.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/auth/callback.tsx:1) | Validated /auth/callback; same-account OAuth/recovery/reauth continuation |
| R53 | [complete-profile.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/complete-profile.tsx:1) | /complete-profile; service-required setup and safe authorized return |
| R54 | [index.tsx](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/index.tsx:1) | Root redirect only: restored setup/session → authorized destination, otherwise account choice |

Additional required iOS-only route contracts: typed announcement detail, server inbox/detail entry, native Apple callback/continuation where applicable, document review/submission receipt, download/export result and source-compatible aliases for the current iOS shell. Final typed route strings/parameters and universal/custom-scheme destinations must be fixed in Phase 0 and validated in Phases 1 and 4. Do not claim these additions are Android file routes.

Phase 0 (approved 2026-10-13) fixed them as IR01–IR10 in `plans/evidence/resident-ios-parity/phase-00/route-ledger.csv`, with alias and fallback rules in `phase-00/decision-register.md` §3. The custom scheme value (prerequisite PR-03) was skipped by OD-07 on 2026-10-15; no scheme is chosen. Post-baseline Android routes `settings/valid-id.tsx` (RD01) and `emergency-centers.tsx` (RD02) are deferred untriaged deltas (OD-03), not R-rows yet.

For each deep-link class, test valid/missing/malformed ID; signed out; setup incomplete; wrong role/tenant; inactive/deleted target; warm/cold launch; duplicate delivery; account switch; More destination; cancel authentication; and safe back fallback. Retain only a versioned non-sensitive allowlisted pending destination, not arbitrary URLs, tokens or serialized personal records.

### B.3 Modal, overlay and result inventory

All checkpoint controls remain binding even if iOS combines their presentation. Do not convert a successful committed mutation into a dismissible message that loses its reference/status.

| Modal/control family | Required iOS presentation and behavior | Acceptance |
|---|---|---|
| Onboarding feedback, OTP/setup/password inputs | Native stack/sheets and accessible inline feedback; secret fields never persisted in UI restoration. | T02–T07 |
| Purpose selector, legacy ID selector, application review | Accessible sheet/picker; draft retained on cancel, irreversible submit explicit; authoritative receipt on commit. | T10–T11 |
| Request/payment cancellation, pickup/QR/payment success | Distinct confirmation and committed result; dirty/back protection; payment result loaded from server. | T14–T17 |
| DRRM draggable panel, center details, center picker | Accessible selectable list/sheet alternative and supported detents; map not sole control. | T19, T23–T24 |
| QR permission explanation, camera scanner, center QR display/share/save | Permission only on action, one preview, correct encoded type, lifecycle disposal and native share/Photos outcome. | T25–T26 |
| Family add/edit/remove and enlarged household QR | Same profile household fields/IDs, explicit destructive confirmation, protected cache and accurate staff-check-in guidance. | T27 |
| Emergency alert filters/detail | Period/custom selectors and dedicated announcement detail, filter state retained. | T28, T35 |
| Health month/date/type chooser and drive/detail/status presentation | Calendar/list parity and full-screen reachable registration; no port of dead old registration modal. | T29–T31 |
| Incident location picker, photo viewer, feedback and corroboration/withdraw confirmation | Manual GPS fallback, image paging/close/accessible description, authoritative eligibility and error recovery. | T33–T34 |
| Announcement modal and bulk read/unread controls | Distinct from incident, image/content scroll, individually traceable/bounded read changes and focus return. | T35–T36 |
| Profile field selectors, household editor, birthday calendar, ID type/front/back/image preview | Current values and validation preserved; explicit draft/save/cancel, partial ID publication and expiring preview errors. | T37–T41 |
| Password show/hide, provider confirmation | Native secure controls and fresh same-account verification; no secret restoration/logging. | T42 |
| Appearance color hue/saturation/value picker, preview/font chips, long-press delete | Preserve every control/ten-color limit; also provide accessible actions that do not require long-press/drag. | T43 |
| Export PDF/JSON chooser, share sheet, delete-account warning/confirmation, logout notice | Progress/cancel/failure semantics, complete export only, truthful terminal deletion and cleanup. | T45–T47 |
| Legal/help accordions and content links | Semantic headings, expansion state, allowlisted external navigation, native browser/dialer as appropriate. | T48–T49 |
| Generic loading/skeleton, toast/result, errors and empty states | Announced nonblocking feedback, skeleton not infinite error mask, filtered empty distinct from unavailable/offline data. | T50–T51 |

For every family record close button, swipe/back/outside-tap policy, unsaved-change handling, keyboard dismissal, backdrop/scroll/safe area, presentation depth, focus return, VoiceOver order and Reduce Motion. iOS gestures must not discard a pending committed attempt or leave the camera/location watcher active.

### B.4 Assets, visual parity and localization

Inventory and license-check [Android assets](/C:/Users/User/barangayan/apps/resident-android-mobile/assets/fonts/README.md:1), logo/splash, Google mark, bundled fonts/licenses, boundary GeoJSON, document/category/emergency icons, seed content and remote images. Preserve meaningful imagery/branding and source field/card/status hierarchy while applying the main [iOS Design System Handoff](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:1) and native system behavior. Use SF Symbols or qualified equivalents where appropriate; do not require exact Android icon/ripple/shadow rendering.

Bundle the approved logo and required fonts/boundary/fallback assets; verify offline loading, image dimensions/orientation, missing/corrupt asset handling, dark/light rendering and cache scope. Emergency geometry must match the selected authoritative tenant boundary; a hard-coded Ampid I asset is not proof of arbitrary-tenant support.

Extract strings, interpolations, accessibility labels and error/status text; retain English launch coverage. Keep PHP centavos/currency, phone formatting and date-only birthday/medical semantics intact. Record timezone for period filters and timestamps; test midnight/month/year boundaries and avoid UTC date-only shifts. Tagalog remains future-ready, not a claimed completed translation.

Visual verification pairs current Android journey captures with iOS candidate captures, explaining approved native differences. Test compact/large supported iPhones, longest content, keyboard, Dynamic Type, light/dark/custom themes and every mobile font preference. No route may pass only because a short default-language screenshot fits.

## Appendix C — Acceptance catalogue, release gates and execution evidence

### C.1 Feature test families

T01–T52 correspond one-to-one with Appendix A sections. A family passes only when **every checkpoint** is accounted for and tested under its stated iOS requirement, not when one happy-path screenshot exists. Grouping/options checkpoints can share a parameterized test, but retain their individual evidence mapping. Every source record is unchecked in this revision because implementation evidence has not been established by this document update.

| Family | Required ledger range | Phase | Required result |
|---|---|---|---|
| T01 — App startup and navigation | A01-001 through A01-036 | Phase 1; supporting Phases 2, 4, 19–20 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T02 — Introductory and onboarding screens | A02-001 through A02-014 | Phase 6 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T03 — Account choice and guest browsing | A03-001 through A03-011 | Phase 4; supporting Phase 1 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T04 — Email registration | A04-001 through A04-023 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T05 — Login and Google authentication | A05-001 through A05-017 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T06 — Resident account setup | A06-001 through A06-036 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T07 — Password creation and recovery | A07-001 through A07-026 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T08 — Home dashboard | A08-001 through A08-028 | Phase 18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T09 — Services catalog | A09-001 through A09-021 | Phase 7; Requests/Logs integration Phase 9 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T10 — Document requirements and guidelines | A10-001 through A10-025 | Phase 7; Apply/form integration Phase 8 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T11 — Document request forms | A11-001 through A11-045 | Phase 8; detail/payment continuation Phases 9–10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T12 — Personal request list | A12-001 through A12-024 | Phase 9 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T13 — Request tracking and processing time | A13-001 through A13-035 | Phase 9; payment continuation Phase 10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T14 — Request and payment cancellation | A14-001 through A14-011 | Phases 9–10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T15 — Payment selection and assessment | A15-001 through A15-014 | Phase 10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T16 — QR PH payment | A16-001 through A16-020 | Phase 10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T17 — Payment success and receipts | A17-001 through A17-018 | Phase 10 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T18 — Service activity logs | A18-001 through A18-009 | Phase 9 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T19 — Maps | A19-001 through A19-033 | Phases 13–14 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T20 — Emergency information navigation | A20-001 through A20-011 | Phase 13; center/QR navigation integration Phases 14–15 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T21 — Emergency hub and preparedness | A21-001 through A21-013 | Phase 13 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T22 — Emergency hotlines | A22-001 through A22-010 | Phase 13 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T23 — Evacuation-center directory | A23-001 through A23-037 | Phase 14 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T24 — Device location and evacuation routing | A24-001 through A24-024 | Phase 14 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T25 — Emergency QR guide and scanner | A25-001 through A25-028 | Phase 15 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T26 — Showing and sharing evacuation-center QR codes | A26-001 through A26-017 | Phase 15 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T27 — Family and household information | A27-001 through A27-036 | Phases 5 and 15 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T28 — Emergency alerts | A28-001 through A28-022 | Phase 13 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T29 — Health and medical-drive browsing | A29-001 through A29-044 | Phase 16 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T30 — Medical-drive registration | A30-001 through A30-036 | Phase 16 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T31 — My medical registrations | A31-001 through A31-020 | Phase 16 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T32 — Reports navigation and lists | A32-001 through A32-030 | Phases 11–12 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T33 — New incident report | A33-001 through A33-036 | Phase 12 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T34 — Incident details and community confirmation | A34-001 through A34-031 | Phase 12 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T35 — Announcements | A35-001 through A35-026 | Phase 11 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T36 — Resolved-report read states and counters | A36-001 through A36-009 | Phase 11; integration Phases 17–18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T37 — Profile viewing and editing | A37-001 through A37-038 | Phase 5 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T38 — Birthday calendar | A38-001 through A38-012 | Phase 5 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T39 — Profile ID verification | A39-001 through A39-035 | Phase 5 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T40 — Email verification in Settings | A40-001 through A40-016 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T41 — Location verification | A41-001 through A41-016 | Phase 5 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T42 — Password management in Settings | A42-001 through A42-016 | Phase 4 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T43 — Appearance preferences | A43-001 through A43-035 | Phase 6 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T44 — Notifications | A44-001 through A44-018 | Phase 17 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T45 — Download My Data | A45-001 through A45-020 | Phase 18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T46 — Delete My Account | A46-001 through A46-012 | Phase 18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T47 — Logout and session cleanup | A47-001 through A47-012 | Phase 4; integration Phases 17–19 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T48 — Help Center | A48-001 through A48-020 | Phase 18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T49 — Terms, privacy, About Us, and app information | A49-001 through A49-015 | Phase 18 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T50 — Small shared interactions | A50-001 through A50-038 | Phases 1, 6 and 19; feature-phase controls throughout | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T51 — Automatic and supporting functions | A51-001 through A51-027 | Phase 2; feature integration Phases 4–19 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |
| T52 — Present in the source, but incomplete, conditional, or not connected | A52-001 through A52-012 | Phase 0; corrective/partial resolutions throughout Phases 1–20 | All source controls/outcomes covered; adaptation/correction and positive/negative evidence recorded. |

### C.2 Cross-cutting fault and device matrix

| ID | Apply to | Required evidence / expected result |
|---|---|---|
| F01 | Every route/modal/native action | Guest vs resident, root/cold/warm link, setup incomplete, More overflow, invalid/foreign/deleted ID, cancel/back/swipe and focus return. No unauthorized content or loop. |
| F02 | Every protected read/write | Two tenants, owner/other resident/admin/anonymous/deleted/nonresident, stale token/role and old account's delayed reply; denied requests leave no mutation or leaked content. |
| F03 | Every mutation | Rapid double tap, two devices, retry, lost reply, timeout after commit, expired session and process termination. At most intended committed effect; reconcile rather than fabricate success or blindly retry. |
| F04 | Every input/form | All source options, required/conditional fields, trimmed boundaries/maxima, invalid/future date, invalid number/coordinates, hidden-field cleanup, keyboard and accessible error focus. |
| F05 | Lists/search/filter/read controls | Multiple pages above row caps, stable tie-break sorting, new/deleted/updated rows, realtime dedupe, concurrent bulk-read snapshot, true empty vs filtered empty vs error and state restoration. |
| F06 | Storage/files/images | JPEG/PNG/WebP/PDF as applicable, HEIC normalization, actual bytes over limit, forged MIME, iCloud unavailable, cancel/replacement, partial upload, expired signed URL, private preview isolation and orphan cleanup. |
| F07 | Persistence/session | Offline, expired cache, background/kill/reinstall, account/tenant/environment switch, Keychain unavailable and interrupted logout cleanup. No plaintext fallback or cross-account restored state. |
| F08 | Camera/location/maps/QR | Denied/restricted/limited/reduced permission, Settings return, Allow Once, unknown/stale fix, late callback, camera unmount, malformed QR, processor timeout and clearly marked fallback. |
| F09 | Payments/SLA | Pending/assessed/waived/free, authoritative historical amounts, two timing models, clock skew, paused/resident-wait periods, provider/DB split failure, duplicate webhook, cancellation/settlement race and correct paid reopen. |
| F10 | Health/emergency | Stock/capacity race, inactive/expired/foreign drive/center, actual dose data, duplicate registration/check-in and honest no-confirmation offline state. Household picker cannot book the wrong person. |
| F11 | Notifications/account privacy | Foreground/background/terminated delivery/taps, denial/opt-out/token rotation/account switch, malformed old destination, generic preview, complete export and truthful deletion/revoked Apple/old JWT denial. |
| F12 | Every resident journey | Supported minimum/current iOS on compact/large iPhones; VoiceOver, largest supported Dynamic Type, Full Keyboard Access, Reduce Motion/Transparency, theme/contrast/status labels, fonts and offline asset/content fallback. *(On-device runs Skipped — OD-06; accessibility props, tokens, fonts and fallbacks are checked in code and tests.)* |

Test automation must cover shared/controller/schema/adapter logic, backend/RLS/storage integration, iOS component/route behavior and signed-device end-to-end journeys *(Skipped — OD-06)*. Mocked unit tests cannot close native permission, APNs, provider settlement or live authorization gates; under OD-06 the native-permission and APNs parts stay *implemented, not device-qualified*, while settlement and authorization still need live backend evidence.

### C.3 Concrete release gates

G01–G16 retain the historical gate meanings, strengthened for full conversion; G13 is now mandatory. G17–G22 are additive. No gate is approved by this document revision. Name each owner in Phase 0 and record exact same-candidate evidence before approval.

| Gate | Scope | Approval owner role | Pass condition | Delivery |
|---|---|---|---|---|
| G01 | Tenant/environment | Backend owner | Explicit environment/tenant, trusted locality, public key ownership, auth callback allowlist and server authorization; no first-row tenant default. | Phases 0, 3–4 and 20 |
| G02 | Native compatibility | iOS lead | Signed SDK 57 build qualifies six tabs/More, Keychain, WebView, camera/location/Photos/files/QR/PDF, exact lockfile and generated permissions. **Skipped (OD-06).** | Phases 1, 19–20 |
| G03 | Household integrity | Backend owner | Applied mirror/guards, legacy audit, stable IDs, owner/admin/tenant permissions, attendance preservation and stale-edit conflict tests. | Phases 3, 5, 15 and 19–20 |
| G04 | Private IDs/evidence | Security/backend owner | Owner/same-tenant authorized review access, anonymous/foreign denial, immutable versions, private signed profile/request previews, size/MIME and cleanup tests. | Phases 3, 5, 8 and 19–20 |
| G05 | QR PH settlement | Payments owner | Production processor approval plus amount authority, reservation/concurrency, partial failure, lost reply, expiry/cancel races, webhook/replay, paid reopen and correct receipt. | Phases 10 and 19–20 |
| G06 | Pickup fulfillment | Barangay operations/payments owner | Existing resident RPC and reads plus staff collection/reconciliation; no client-only paid state or duplicate pickup. | Phases 10 and 19–20 |
| G07 | Maps/emergency content | DRRM/content/privacy owners | Approved processors/attribution/disclosures, actual walking-profile suitability, freshness/fallback disclaimers, tenant boundary and published operational content. | Phases 12–14 and 19–20 |
| G08 | Emergency check-in | DRRM/backend owner | Resident/check-in/actual active center tenant equality, role/ownership/duplicate guards and online authoritative receipt; no false bulk attendance. | Phases 3, 15 and 19–20 |
| G09 | Medical registration truth | Health/iOS owners | Self-only UI, actual/null prior-dose data, age/consent/conditions/capacity and validated authoritative applicant/error outcomes. | Phases 16 and 19–20 |
| G10 | Complete export | Privacy/backend owner | Approved versioned inventory, both household representations as appropriate, pagination above limits, required-section failures, PDF/JSON validation and no partial-complete sharing. | Phases 3, 18 and 19–20 |
| G11 | Deletion/retention | Privacy/backend owner | Approved retention matrix, same-account fresh proof, auth/session/provider/Apple lifecycle, storage cleanup, idempotent observable retries and old-token denial. | Phases 3–4, 18 and 19–20 |
| G12 | Moderation | Barangay moderation owner | Approved public concern visibility, applicable filtering/report/block safeguards, operator contact, escalation and retention; not merely a UI report button. | Phases 11–13, 18 and 19–20 |
| G13 | Remote push | Backend/notification operations owner | Required, not optional: rebuilt signed binary, APNs/EAS credentials *(both Skipped — OD-06)*, durable event/inbox/outbox, sender/receipts/retries, opt-out/token lifecycle, privacy-safe previews and guarded cold/warm taps. | Phases 17 and 19–20 |
| G14 | Distribution | Apple/EAS account owner | Bundle/scheme/App IDs, credentials/capabilities/signing/provisioning, environment build profiles, exact binary identity and TestFlight approval. **Skipped (OD-06).** | Phases 0–1 and 20 |
| G15 | Household QR processor | Privacy/DRRM owner | Existing external QR identifier transfer approved/disclosed or qualified local equivalent; protected authenticated access/cache, correct schema and accurate presentation copy. | Phases 5, 15 and 19–20 |
| G16 | Medical authorization | Backend/security owner | Deployed resident-role, same-tenant active-drive and capacity/duplicate enforcement with two-tenant/role/negative post-state tests. | Phases 3, 16 and 19–20 |
| G17 | Exhaustive feature parity | Product owner + QA lead | All A01–A52 / 1,218 checkpoints and R01–R54 accounted for; each working capability passes, corrective equivalents explicit, no hidden unavailable release slice. | Phase 0 inventory; every feature phase; Phases 19–20 final approval |
| G18 | Provider/account lifecycle | Auth/security owner | Email/Google/Apple, strict compatible setup versioning, interruption/recovery/linking, private relay, revoked credentials and fresh same-account sensitive proof pass. | Phases 3–4, 18 and 19–20 |
| G19 | Lists/persistence/offline | iOS/backend owners | Incremental stable pagination, scoped protected caches/drafts, loading/empty/error/offline distinctions, account races, subscription cleanup and reconciliation tests. | Phase 2 foundation; all feature phases; Phases 19–20 final approval |
| G20 | Diagnostics/operations | Operations/security owner | Symbolicated/redacted crash data, build identifiers, upload/mutation/payment/push monitors, dashboards, alert thresholds and rollback/support runbooks tested. | Phases 10, 17–20 |
| G21 | Store/privacy compliance | Release/privacy owner | Then-current App Store review, privacy manifests/reasons/labels, UGC applicability, deletion/login requirements, published URLs, licenses, age/encryption and reviewer artifacts verified. | Phases 0, 3, 18 and 20 |
| G22 | Accessibility/visual/platform parity | Design/accessibility/QA owners | Main Design System Handoff tokens/components and DX01–DX52 coverage, every route/modal, More, keyboard/gestures, VoiceOver/Dynamic Type/reduced motion/contrast, all fonts/themes, supported iPhone sizes and content extremes pass. | Phases 1 and 6 foundation; all feature phases; Phases 19–20 final approval |

The existing [iOS release gates](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/lib/release-gates.ts:2) were all false at the Phase 0 baseline; the owner has since opened some for the non-device, non-live scope (OD-09 to OD-12, listed in the note below the table). They intentionally prevent unavailable operations; they do **not** prove functionality. Map them to evidence, and open each only after all linked conditions pass:

| Current feature gate | Required release gates |
|---|---|
| `householdEditing` | G01, G03, G17, G19, G22 |
| `privateIdUploads` | G01, G04, G17, G19 |
| `qrph` | G01, G05, G17, G19, G20 |
| `pickup` | G01, G06, G17 |
| `mapProviders` | G02, G07, G17, G21, G22 |
| `routeService` | G01, G07, G17, G22 |
| `emergencyContent` | G07, G17 |
| `evacuationCheckin` | G01, G08, G17, G19 |
| `householdQr` | G03, G15, G17 |
| `publicIncidents` | G01, G12, G17, G21 |
| `medicalRegistration` | G01, G09, G16, G17 |
| `completeExport` | G10, G17, G19 |
| `accountDeletion` | G11, G18, G21 |
| `remotePush` | G02, G13, G17, G20, G21 |

These mappings are cumulative minimums, not exemptions from remaining applicable gates. **Exception recorded by OD-09 (2026-10-16):** the owner has decided that `qrph` and `pickup` are to be opened for the non-device, non-live scope on the basis of their operation in the resident Android app; the unmet gates in the rows above are not thereby satisfied. The two flags were set to `true` in code on 2026-10-16 after the Phase 10 flows were implemented and tested. **Exception recorded by OD-11 (2026-10-16):** the owner approved sending the resident's starting point to the barangay's own `evacuation-route` function, so `routeService` was set to `true` for the non-device, non-live scope; G07's remaining conditions and G17 are not thereby satisfied. **Exception recorded by OD-12 (2026-10-16):** the owner opened `evacuationCheckin` and `householdQr` for the non-device, non-live scope and approved the on-device household code; G08's device and live evidence, G03, G01, G17 and G19 are not thereby satisfied. **Exception recorded by OD-13 (2026-10-16):** the owner opened `medicalRegistration` for the non-device, non-live scope; G16's two-tenant negative tests, G01 and G17 are not thereby satisfied. **Exception recorded by OD-10 (2026-10-16):** the owner waived PR-12 and accepted the Android emergency content, so `emergencyContent` was set to `true` for the non-device, non-live scope; G07's map-processor portion and G17 are not thereby satisfied. Global G14/G18/G21/G22 and full G17 are needed for production release. Android's `PAYMENT_SETTLEMENT_READY` configuration is not iOS or backend settlement evidence.

### C.4 CI, environments and immutable release candidate

Use the repository's existing npm workspaces/lockfile. The current iOS scripts are `typecheck`, `lint`, `test`, `export:ios` and `check:release` in `@barangayan/resident-ios`. Required implementation CI must run those scripts, SDK dependency/configuration validation, shared tests, backend integration/security tests and proportionate Android/web regression checks for compatible shared changes. JavaScript export and diagnostic preflight are only partial checks, not native/release approval.

Create explicit simulator/development-device/staging/App Store build profiles and environment separation *(profiles exist in `eas.json` but no build runs — OD-06)*. Inventory current `EXPO_PUBLIC_SUPABASE_URL`, public client key, `EXPO_PUBLIC_BARANGAY_ID`, `EXPO_PUBLIC_ENVIRONMENT`, `IOS_URL_SCHEME`, `IOS_BUNDLE_IDENTIFIER` and `EAS_PROJECT_ID`; public-prefixed values are not secret storage. Apple/provider/PayMongo/server credentials stay server/build-secret managed, never in the bundle or evidence output.

Production pipeline must record Node/Xcode/SDK and dependency/native build versions; frozen lockfile; source SHA; applied migration/function/schema versions; generated configuration; signed binary checksum/build number *(Skipped — OD-06)*; dSYM/source-map handling; secret/redaction checks; and release approval. Device/APNs tests are Skipped (OD-06); settlement tests must run against that candidate's backend environment. Onboarding/account data and sensitive exports must not be included in CI screenshots/logs without sanitized fixtures.

Qualify upgrade from any earlier iOS pilot, Keychain/cache schema changes, preserved server accounts/preferences and Android/web compatibility. The iOS app is a separate platform install: no claim of automatic Android local-file/session migration. Server data/preferences should remain accessible to the same authorized account. Block release on incompatible shared response/enum changes or unresolved data migration.

*(OD-06: TestFlight and the staged App Store rollout below are Skipped; resident/staff fulfillment is exercised against the staging backend instead.)* TestFlight staging must exercise resident/staff fulfillment and operational support, not just launch. Use a staged App Store rollout, rollback/kill-switch runbook and server-contract-compatible rollback; keep required capabilities clearly unavailable during an incident and never turn off gates merely to satisfy a checker. OTA remains disabled for the first production release.

### C.5 Evidence record and no-false-completion policy

Each checkpoint/group record must contain:

- Requirement ID(s), source line/commit/hash, Android state (working/partial/defective/obsolete/unreachable/unused), final iOS disposition and implementation file/line.
- Numbered execution phase, stable P00–P20 / Pnn-Tnn task identifiers, named owner, dependency/blocker/status and phase exit/reopening evidence.
- Paired plan/handoff revisions, applicable D01–D21 design family and DX01–DX52 mapping, tokens/components and screenshot/interaction/accessibility comparison evidence.
- Named engineering/product/operations owner, related B/R/T/F/G IDs and blocking issue/dependency.
- Exact build/source/backend versions, environment/tenant, device/OS, fixture identity, test/date and expected/observed result.
- Sanitized artifact/automated-test locator, reviewer, pass/fail/block reason and corrective-equivalent approval when relevant.
- Lifecycle/offline/security/accessibility evidence where applicable; no secrets or sensitive resident payloads in artifacts.

An owner may mark a checkpoint `implemented-unverified`, `verified`, `blocked` or `corrective-equivalent-verified`. “Not applicable” needs a source-state explanation; it cannot suppress a working feature. Grouping headings/options may map to one exhaustive parameterized test. Unresolved external credentials/policy stay **blocked**, not assumed.

The embedded Phase 0–Phase 20 execution ledger/checklists are initialized in §4. Phase 0 is Verified (2026-10-14); Phases 1–20 remain Planned/unchecked. Phase 0 created the evidence index and per-phase directories under `plans/evidence/resident-ios-parity/` and indexed the owner-supplied Android captures (`phase-00/android-captures/`); later-phase approvals and executed results are not claimed. Retain historical evidence separately and explicitly assess whether it transfers to the current candidate.

### C.6 Final full-conversion sign-off checklist

- [ ] All 52 feature sections, 1,218 source checkpoints, 54 route/layout entries and reachable modal families have disposition/phase/task/implementation/test records; every Phase 0–Phase 20 exit is verified.
- [ ] No working Android capability, selector option, validation, count, preference, native export or return path is omitted.
- [ ] Every partial/dead/defective source item has the explicit §6.8 iOS disposition; self-only health and online resident-only check-in are truthful and tested.
- [ ] Six destinations/More and incident-vs-announcement routes/deep links pass; current iOS aliases are deliberate and safe.
- [ ] Both legacy and charter services, approved ID versions, conditional PDF/image evidence, idempotent submission, fee assessment, both timing models, cancellation, pickup/QR PH and authoritative receipts pass.
- [ ] Maps/emergency content, filters, location confirmation/accuracy controls, center/household QR distinctions, Family CRUD and medical calendar/history pass.
- [ ] Reports/corroboration/withdrawal and individual/bulk read states preserve all three counters; Home bell meaning and separate inbox entry are clear.
- [ ] Full profile/household/verification/password controls, ten mobile font IDs, theme/custom-color controls, Help/legal/About/version and complete PDF/JSON exports pass.
- [ ] Email/Google/Apple and all setup/recovery/session/logout/deletion states are secure, compatible and tested.
- [ ] All contract/RLS/storage/role/tenant/capacity/concurrency/negative-post-state tests pass for the deployed environment.
- [ ] Complete lists, protected drafts/caches, stale/offline labels, interrupted cleanup, native permissions and orphan/temp-file cleanup pass.
- [ ] Reliable remote push/inbox/outbox/receipt monitoring and cold/warm guarded taps are operational; SMS is not misrepresented.
- [ ] Asset/license/string/date/currency audits, visual comparisons and accessibility evidence pass on supported iPhones/iOS.
- [ ] G01–G22 and all applicable feature gates are approved with named owners and the same immutable candidate evidence.
- [ ] Clean CI, native signing/provisioning/privacy manifests/store disclosures/reviewer artifacts, TestFlight and migration/deployment records are complete. *(Signing/provisioning/TestFlight Skipped — OD-06.)*
- [ ] No unresolved Critical/High issue; all lower risks, lawful retention, moderation/support/on-call/rollback duties have explicit owners.
- [ ] Final statement identifies the released build/backend and all approved corrective/native differences; an incomplete pilot is not called a full conversion.
