# Resident iOS evidence-based review

## 1. Overall assessment and readiness verdict

### Baseline

| Item | Verified baseline |
|---|---|
| Branch / commit | `main` at `d5f512a649e839fb066d07f6476b753399ed892c` |
| Implementation plan | [C:\Users\User\barangayan\plans\Resident_iOS_Implementation_Plan.md](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1), 711 lines, SHA-256 `2F7926CB072032B0B9B18C32A3D5CAC747BC7F3BF8614C209A2E2C709D15254D` |
| Exact design handoff | [C:\Users\User\barangayan\plans\Resident_iOS_UI_UX_Design_System_Handoff.md](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:1), 476 lines, SHA-256 `6E64C2831423A64A4E95FF78C65356C843208968B963E37CBB994B93784A62B9` |
| Repository instructions | Root [AGENTS.md](/C:/Users/User/barangayan/AGENTS.md:1); no additional instructions under the iOS, shared, Supabase, plans, or CI paths |
| Working tree | Materially dirty. The plan is modified; the handoff, complete iOS application, migrations 0093/0094, and their tenant test are untracked. Several Android, admin, CI, payment, and root dependency files are also modified. |
| Provenance limitation | The entire iOS application and handoff have no committed revision. Historical checks therefore cannot be tied to an immutable implementation/design commit. |
| Git limitation | Git could not read the user-level global ignore file, but repository status and history were available. |

Both required documents were read completely. The similarly themed PDF was also found at `C:\Users\User\barangayan\design references\resident mobile app frontend design\barangayan resident mobile app screens.pdf`; it is illustrative evidence, not the controlling iOS specification.

:codex-file-citation{path="C:\Users\User\barangayan\design references\resident mobile app frontend design\barangayan resident mobile app screens.pdf" purpose="source"}

### Authority and scope

Authority is sufficiently clear at a high level:

- The handoff explicitly says it **supplements rather than replaces** the plan and that plan gates G01–G16 govern feasibility ([handoff lines 461–473](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:461)).
- The handoff’s consolidated token table explicitly calls itself authoritative for resident iOS visual tokens ([handoff line 210](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:210)).
- Backend authorization, operational policy, environment, and release gates therefore come from the plan and server contracts; resident IA, component behavior, tokens, content hierarchy, and accessibility acceptance come from the handoff.
- The supplied PDF validates broad screen families, civic terminology, green branding, and status-history intent. The handoff correctly says it does not establish fixed fees, timelines, public-incident policy, or native usability ([handoff lines 49–56](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:49)).

Material product decisions nevertheless remain open, especially service verification, attachment policy, concern visibility/moderation, deletion retention, export inventory, notification inbox contracts, map/content ownership, and household check-in semantics.

### Assessment

| Area | Verdict |
|---|---|
| Combined plan and handoff quality | **Strong as a risk inventory and intended-experience specification, but not yet delivery-sufficient.** The handoff closes many design ambiguities. The plan identifies substantial backend and release dependencies. However, some required flows depend on undecided policies/contracts, and the execution ledger does not reliably distinguish historical progress from current accepted state. |
| Implementation completeness | **Partial.** Auth/session foundations, tenant-scoped reads, catalog/announcement/health shells, request creation/tracking, and fail-closed feature flags exist. Required document-request review/uploads/drafts, concerns, map, check-in, payments, export, deletion, notification center, and much of the specified Home experience remain absent or gated. |
| Design and resident-experience conformance | **Not established and source-level nonconformities are confirmed.** Navigation labels, toolbar actions, token values, control heights, request flow, status copy, cancellation confirmation, and Home/Updates hierarchy differ from explicit handoff requirements. No rendered/device/assistive-technology evidence exists. |
| Production release readiness | **BLOCKED.** The release check directly fails, all 13 feature gates are false, production configuration is absent, migrations 0093/0094 are untracked and unexecuted, no EAS profile exists, and no signed build, TestFlight, device, accessibility, payment, or deployed-backend evidence exists. |

The SDK baseline itself is correctly understood: Expo SDK 57 targets React Native 0.86, React 19.2.3, Node 22.13.x minimum, iOS 16.4+, and Xcode 26.4+ ([Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)). Local declarations align with RN/React/Node, but `expo-router` is `57.0.10` while the exact SDK 57 Native Tabs page recommends `~57.0.23`; the plan’s historical `expo install --check` also failed. The Native Tabs API being used is documented, but this exact dependency set still needs clean-install and native-build qualification ([Expo Router Native Tabs v57](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/)).

## 2. Prioritized findings

### F1 — Required document-request safeguards are bypassed

- **Severity/classification:** High — Confirmed defect
- **Release blocker:** Yes; blocks the plan’s document-request launch acceptance and private-upload gate G04.
- **Evidence:** The active form accepts only optional notes, inserts a real `service_requests` row immediately, and routes to the receipt ([request form lines 18–28](</C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/services/request/[id].tsx:18>)). It has no verification gate, profile summary, attachment lifecycle, saved draft, review screen, privacy/conditions summary, or discard recovery.
- **Requirement:** The plan requires a supported document ID, upload linkage, and useful validation ([plan lines 231–243](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:231)). The handoff requires verification remediation, per-file upload handling, review, and server-only receipt semantics ([handoff lines 154–164](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:154)).
- **Impact:** A resident can receive a durable reference for a request that has not passed the experience’s stated evidence/review process. Staff may receive incomplete requests, and the UI implies the intended request contract is satisfied.
- **Recommendation:** Keep catalog reads, the current request schema, UUID reconciliation, and route structure. Gate submission until Phase 0 defines which services require verification/attachments; implement account-scoped drafts, attachment states, review, and an authoritative receipt without introducing a second request model.
- **Closure:** Staging evidence shows required and optional document cases; invalid/oversized/failed uploads remain recoverable; double activation creates at most one request; timeout reconciles before retry; receipt appears only for an authoritative row.
- **Responsibility gap:** Product/operations, privacy, backend, and iOS roles are suggested; no assigned owners are recorded.

### F2 — Service requests do not enforce document-type tenancy at the authoritative layer

- **Severity/classification:** High — Confirmed defect
- **Release blocker:** Yes; tenant isolation and data-integrity protection are mandatory.
- **Evidence:** `service_requests.document_type_id` is a plain foreign key. Resident insert policy checks only that the resident owns the row and that `barangay_id` equals the caller’s barangay ([migration 0002 lines 42–77](/C:/Users/User/barangayan/supabase/migrations/0002_document_types_and_service_requests.sql:42)). Exhaustive migration search found no later trigger or constraint requiring the referenced document type to belong to the same barangay or remain active.
- **Impact:** An authenticated resident who obtains another tenant’s document-type UUID can create an own-tenant request referring to that foreign catalog item. Client filtering in `resident-api.ts` is not an authorization boundary.
- **Recommendation:** Add one table-boundary invariant—preferably a narrow trigger/constraint or authoritative creation RPC—that verifies resident, request barangay, active/non-deleted document type, and document-type barangay agree. Preserve existing callers and request IDs.
- **Closure:** Two-tenant database tests demonstrate rejection of foreign, inactive, deleted, and forged IDs without creating a request/history/payment row; a valid own-tenant request succeeds.
- **Responsibility gap:** Backend/database owner.

### F3 — Account deletion does not meet the plan’s release prerequisite

- **Severity/classification:** High — Confirmed defect
- **Release blocker:** Yes; the plan explicitly makes deletion an external release prerequisite.
- **Evidence:** The RPC anonymizes selected profile columns but retains the profile/auth relationship ([migration 0074 lines 31–69](/C:/Users/User/barangayan/supabase/migrations/0074_account_deletion.sql:31)). The edge function performs best-effort storage deletion, suppresses cleanup failures, then applies a roughly 100-year auth ban rather than deleting the auth account ([delete function lines 58–120](/C:/Users/User/barangayan/supabase/functions/delete-my-account/index.ts:58)).
- **Requirement:** The plan requires established retention, complete or monitored cleanup, auth-account handling, and an idempotent truthful result ([plan lines 321–332](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:321)).
- **Impact:** The UI cannot truthfully report complete deletion. Orphaned identity files can remain with no reported recovery path.
- **Recommendation:** First approve lawful retention and deletion inventory. Extend the existing endpoint rather than creating a competing API; make retained data explicit, make cleanup retryable/observable, and make completion status reflect all required steps.
- **Closure:** Deployed tests cover no-record, existing-record, partial-cleanup, repeated-call, and interrupted-ban/auth-removal cases; a retained/deleted data audit matches the approved inventory.
- **Responsibility gap:** Privacy/legal policy, backend, operations.

### F4 — Export can return partial data as a successful complete export

- **Severity/classification:** High — Confirmed defect
- **Release blocker:** Yes if export remains launch scope; otherwise the export gate must stay closed and the action unavailable.
- **Evidence:** Six queries run concurrently, but individual query errors are not checked; failed results become empty arrays. Collections are not paginated and canonical household attendance is absent ([export function lines 57–108](/C:/Users/User/barangayan/supabase/functions/export-my-data/index.ts:57)).
- **Requirement:** The plan explicitly requires per-section error propagation, pagination, an approved dataset inventory, and no sharing of a partial export as complete ([plan lines 281–291](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:281)).
- **Impact:** A resident can receive a syntactically valid but incomplete privacy export without warning.
- **Recommendation:** Agree the inventory, return a versioned schema, paginate every unbounded collection, and fail or explicitly mark the response incomplete if a required section fails.
- **Closure:** Fixtures above the API row limit reconcile exact counts/representative fields; a forced failure in each required section cannot yield a “complete” export or shareable file.
- **Responsibility gap:** Privacy and backend owners.

### F5 — Much of the stated launch experience remains absent or intentionally unavailable

- **Severity/classification:** High — Confirmed defect against the stated launch scope
- **Release blocker:** Conditional: yes if the plan’s current launch matrix is retained; otherwise Phase 0 must formally narrow the release.
- **Evidence:** Updates contains announcements only ([reports screen](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/reports/index.tsx:5)); Home lacks required attention, activity, and notification-center sections ([Home](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/home/index.tsx:9)). Concerns, map providers, check-in, payments/receipts, household/ID flows, export, deletion, and notifications are incomplete or gate-disabled. The plan itself acknowledges these limitations ([plan lines 706–711](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:706)).
- **Impact:** The application is a partial shell, not the resident service experience described by either document.
- **Recommendation:** Do not open gates merely to satisfy a checklist. Either retain and complete the launch capabilities through the roadmap below or approve a narrower release with corresponding plan, handoff, navigation, listing, and acceptance criteria.
- **Closure:** Every retained launch flow has working, loading, empty, denied, failure, retry, cancellation, and recovery evidence; excluded capabilities are removed from promises and remain inaccessible.
- **Responsibility gap:** Product owner must define the actual release slice.

### F6 — Backend safety corrections exist only as untracked, unexecuted source

- **Severity/classification:** High — Verification gap
- **Release blocker:** Yes for household editing, private IDs, QR Ph, medical registration, and evacuation check-in.
- **Evidence:** Migrations 0093 and 0094 are untracked. Migration 0094 adds resident/tenant/active-record guards ([0094 lines 5–70](/C:/Users/User/barangayan/supabase/migrations/0094_resident_ios_tenant_write_guards.sql:5)); its seven pgTAP assertions have not run ([tenant test lines 1–54](/C:/Users/User/barangayan/supabase/tests/resident_ios_tenant_write_guards.test.sql:1)). Migration 0093 similarly contains source-level household, private-ID, and payment reservation corrections but no deployment evidence.
- **Impact:** Source presence does not establish that any target environment enforces these protections.
- **Recommendation:** Review migration ordering/legacy compatibility, commit against a known baseline, apply to an isolated test/staging environment, and run direct authenticated two-tenant tests plus existing regression tests.
- **Closure:** Applied migration versions, environment identity, test output, and rollback/recovery result are retained; negative tests prove no mutation on rejection.
- **Responsibility gap:** Backend/deployment owner and staging access.

### F7 — Production and native readiness evidence is absent

- **Severity/classification:** High — Verification gap
- **Release blocker:** Yes; this is the decisive readiness blocker.
- **Evidence:** The current release check fails for six missing values and all 13 closed gates. No `eas.json` exists. The release checklist is entirely unchecked ([release checklist](/C:/Users/User/barangayan/apps/resident-ios-mobile/docs/release-checklist.md:1)). No clean install, current test run, signed development build, TestFlight candidate, physical-device run, or remote CI result was established.
- **Expo-specific evidence:** Native Tabs are documented for SDK 57, but the local Router patch is behind the exact page’s recommended patch. Remote notifications require installation, configuration/credentials, and a new native binary; the current app has neither the package nor config plugin ([Expo Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)).
- **Impact:** Configuration, native linking, Keychain behavior, signing, permissions, lifecycle, performance, and production backend compatibility are unknown.
- **Recommendation:** Keep all gates closed. Qualify an immutable candidate through clean CI, native development build, staging, representative devices, then TestFlight.
- **Closure:** The exact candidate commit/build number has passing CI, release preflight, migration evidence, signed configuration, device matrix, and TestFlight results with applicable gates approved.
- **Responsibility gap:** Release/Apple/EAS, QA, backend, privacy, and product roles.

### F8 — Authoritative design tokens and navigation are not implemented

- **Severity/classification:** Medium — Confirmed defect
- **Release blocker:** Yes for design-handoff acceptance; not because every visual deviation is inherently blocking.
- **Evidence:** The app uses different light/dark canvas, text, primary, danger, and border colors; cards omit the required border; buttons are 44 rather than 50 points; fields are 48 rather than 50 points; typography has only two undeclared styles ([UI primitives lines 6–48](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/components/ui.tsx:6)). Tabs are `Home / Services / Maps / Health / Reports` ([tab layout lines 3–8](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/_layout.tsx:3)), while the handoff explicitly requires `Home / Services / Map / Health / Updates`, notification entry, and profile/avatar placement ([handoff lines 19–36](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:19)).
- **Requirement:** Authoritative tokens are at handoff lines 208–284; shared component rules are at lines 294–328.
- **Impact:** The visual language, IA, accessibility sizing, and navigation meaning diverge before feature screens are built, increasing duplicate rework.
- **Recommendation:** Replace the values in the existing primitives with one token module; extend existing `Body`, `Card`, `Action`, `Field`, and `ResidentStack` rather than introducing a parallel component library.
- **Closure:** Source snapshots verify exact tokens and variants; rendered compact/large, light/dark, and largest-text checks show no clipping or unreachable actions.
- **Responsibility gap:** Design approval and iOS implementation.

### F9 — Request status, operational copy, and cancellation behavior conflict with the handoff

- **Severity/classification:** Medium — Confirmed defect
- **Release blocker:** Yes for document-flow acceptance.
- **Evidence:** Shared labels expose “Submitted (Pending Payment),” “Submitted (Paid),” and “Processing” ([status mapping lines 23–29](/C:/Users/User/barangayan/packages/shared/src/lib/request-status.ts:23)), not the required “Received - payment needed,” “Received,” and “In review.” Request detail has no timeline and cancels immediately without confirmation ([request detail lines 19–27](</C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/request/[id].tsx:19>)). Document detail hard-codes original-document and estimate instructions ([document detail line 15](</C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/services/[id].tsx:15>)), contrary to the server-authored-facts rule.
- **Impact:** Residents may confuse receipt with approval, see unverified operating instructions, or cancel accidentally.
- **Recommendation:** Retain shared state derivation but add an approved iOS presentation mapping unless all consumers approve a shared copy change. Render server history and instructions; require a named destructive confirmation; let the backend remain authoritative about cancellation.
- **Closure:** Every persisted state produces the specified label/next action; monochrome and VoiceOver checks communicate state; cancellation requires confirmation and handles stale server rejection without claiming success.
- **Responsibility gap:** Product copy/operations and iOS.

### F10 — Production authentication and deep-link behavior is unresolved

- **Severity/classification:** Medium — Verification gap
- **Release blocker:** Yes for registration/recovery acceptance.
- **Evidence:** Local Supabase config disables email confirmations, but deployed behavior is unknown. Registration throws a terminal “contact your barangay” error whenever signup returns no session ([register screen line 78](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/features/auth/register-screen.tsx:78)). The bundle scheme is conditional and currently absent.
- **Impact:** If production enables confirmation, new residents cannot finish the documented flow. Recovery/deep-link return behavior is likewise unproved.
- **Recommendation:** Decide production confirmation policy and callback contract, configure the approved scheme, and implement the matching same-account continuation behavior.
- **Closure:** Staging and production-like tests cover confirmed/unconfirmed signup, expired/used link, OTP recovery, app-not-running deep link, wrong-account draft, and unauthorized destination.
- **Responsibility gap:** Auth/backend configuration, product, iOS, and release roles.

### F11 — Rendered, accessibility, and physical-device conformance is unverified

- **Severity/classification:** Medium — Verification gap
- **Release blocker:** Yes because both documents make these checks acceptance evidence.
- **Evidence:** No current screenshots, UI automation, simulator, VoiceOver, Dynamic Type, Reduce Motion, keyboard, contrast, or physical-device results were available. Source can establish labels and dimensions only partially; it cannot establish actual focus order, clipping, layout, native control behavior, or assistive usability.
- **Requirement:** Handoff pass/fail criteria are explicit at lines 419–432 and performance targets at lines 402–413.
- **Recommendation:** Validate representative states—not only happy paths—on compact, standard, and large iPhones, both appearances, largest accessibility text, VoiceOver, Reduced Motion/Transparency, denied permissions, and interrupted connectivity.
- **Closure:** Evidence is tied to build number, device/OS, screen/state, expected result, outcome, and issue disposition.
- **Responsibility gap:** QA/accessibility, design, and iOS roles.

### F12 — The living implementation record is stale and internally misleading

- **Severity/classification:** Medium — Documentation inconsistency
- **Release blocker:** No by itself; it undermines reliable gate decisions.
- **Evidence:** Baseline lines 484–490 describe an earlier tree in which iOS contained only `.gitkeep`; the current app and handoff are untracked and later concurrent files differ ([plan lines 480–490](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:480)). Every numbered phase is still “in progress,” including phases whose principal implementation is absent. Historical pass/fail commands are recorded, but their outputs are not independently retained and the reviewed source has no immutable revision.
- **Impact:** A reader can mistake historical checks or source creation for current acceptance.
- **Recommendation:** Preserve the historical baseline but add a dated current snapshot with commit/worktree hashes. Give each phase one current status and link every accepted gate to evidence for the same revision/environment.
- **Closure:** No phase is “implemented,” “verified,” or “release verified” unless all applicable checkboxes and evidence links refer to the same candidate.
- **Responsibility gap:** Plan maintainer/release coordinator.

## 3. Cross-document and implementation discrepancies

| Flow or shared requirement | Plan reference | Handoff reference | Implementation | Evidence/status | Findings |
|---|---|---|---|---|---|
| Five-tab IA and settings | Assumption still says Maps/Reports ([line 535](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:535)) | Explicit Map/Updates and toolbar actions ([lines 19–36](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:19)) | [(tabs)/_layout.tsx](</C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/_layout.tsx:3>) and [resident-stack.tsx](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/components/resident-stack.tsx:3) | Handoff intentionally refines the shell; source still implements old labels and text Settings action everywhere | F8, F12 |
| Visual/accessibility foundation | iOS behavior at [lines 171–182](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:171) | Authoritative tokens/components at [208–328](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:208) | [ui.tsx](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/components/ui.tsx:6) | Several exact source mismatches; rendered behavior unverified | F8, F11 |
| Auth/session | Phase 3 and G01/G02 | Journey rules [145–153](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:145) | [runtime.tsx](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/lib/runtime.tsx:29), auth feature screens | Secure-storage/session logic exists; only eight narrow historical tests; production confirmation/deep links unverified | F7, F10, F11 |
| Home | Launch shell | Home hierarchy [336](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:336) | [home/index.tsx](/C:/Users/User/barangayan/apps/resident-ios-mobile/src/app/(tabs)/home/index.tsx:9) | Welcome and static destinations only | F5 |
| Document request | Contract [231–243](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:231); Phase 5 | Journey [154–165](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:154); screens [339–343](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:339) | Request form/detail/API plus migration 0002 | Real insert exists; review, drafts, verification and attachment lifecycle absent; backend document tenancy unenforced | F1, F2, F9 |
| Payments/pickup/receipt | G05/G06, plan Phase 5 | Payment remains separate and authoritative | Only placeholders/gates in iOS; payment function modified elsewhere | Planned work open; no settlement/deployed evidence | F5–F7 |
| Updates/concerns | Plan Phase 6 | Updates combines News/My concerns [346–349](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:346) | Reports tab lists announcements only | Confirmed incomplete, not incorrectly reported complete | F5, F8 |
| Maps/emergency/check-in | G07/G08; Phase 7 | Accessible map/list and online-confirmed check-in | Gated unavailable routes; unexecuted 0094 | Server correction present only in source; no device/provider/content evidence | F5–F7, F11 |
| Health/profile/household/ID | G03/G04/G09/G16 | Verification remediation and self-only health | Read-only health/catalog/profile shell; editing/upload/registration gated | 0093/0094 unexecuted; product concurrency/verification policy unresolved | F5, F6 |
| Notifications | G13, foreground first | In-app center is primary; push optional [200–206](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:200) | No inbox, package, plugin, or sender | In-app center is a required design flow; remote push may remain deferred | F5, F7 |
| Export/deletion | G10/G11 | Profile/privacy screen and trustworthy outcomes | Existing backend functions; iOS gates false | Confirmed backend deficiencies; correctly not enabled | F3, F4 |
| Release qualification | G01–G16 and Phase 10 | Phase 6 pilot/release [440–448](/C:/Users/User/barangayan/plans/Resident_iOS_UI_UX_Design_System_Handoff.md:440) | Checklist and failing preflight; no EAS profile | Production readiness blocked | F7, F11, F12 |

The important distinction is that many gaps are correctly recorded as open work. The inaccurate element is the ease with which the all-“in progress” ledger and historical pass rows can be read as current completion evidence. No phase is currently release-verified.

## 4. Detailed execution roadmap

### Dependency sequence

`Phase 0 decisions` → parallel `Phase 1 backend invariants`, `Phase 2 privacy contracts`, and `Phase 3 foundation/auth` → `Phase 4 documents/payments`, `Phase 5 Updates/concerns`, `Phase 6 maps/emergency`, `Phase 7 health/profile` → `Phase 8 release qualification`.

Phases 0–4 and 8 are release-blocking for any resident release containing document services. Phases 5–7 are release-blocking only for capabilities retained in the approved launch scope. Remote push, reliable offline check-in, household medical registration, SMS delivery, iPad-native layouts, HealthKit, and appointment booking remain excluded or optional.

### Phase 0 — Freeze authority, scope, and operational contracts

1. **Objective/traceability:** Produce one revision-bound release scope and decision record resolving F5, F10, and F12; close handoff Phase 0.
2. **Entry:** Current plan/handoff hashes, target tenant/environment, and representatives for product, operations, privacy, backend, design, and release.
3. **Scope:** Decisions only. Include launch capabilities, service verification/attachment/fee/pickup rules, draft retention, concern visibility/moderation, household check-in semantics, export inventory, deletion retention, inbox/push scope, auth confirmation, map providers, emergency content, support route, and device/OS matrix. Exclude implementation.
4. **Steps:** Reconcile each decision with G01–G16; label PDF examples nonbinding; record server-authoritative fields; define what remains gated; state whether Maps/Health/concerns ship in the first release.
5. **Reuse/complexity:** Update the existing plan ledger/decision table rather than creating competing product documents. A proposed evidence index may link artifacts but must not redefine requirements.
6. **Defect prevention:** Every decision records effective date, approver role, impacted gate, compatibility implications, and rollback/default behavior. Unanswered decisions remain fail-closed.
7. **Verification:** Cross-review every launch row against the handoff screen list and repository capability; ensure each has acceptance evidence and no placeholder policy.
8. **Exit:** No retained launch flow depends on invented fee, timeline, verification, visibility, retention, delivery, or notification behavior.
9. **Responsibility:** Product/operations/privacy/backend/design/release roles; do not infer individuals.

### Phase 1 — Enforce backend tenancy and write invariants

1. **Objective/traceability:** Close F2 and the enforcing-layer portion of F6 for requests, household/ID, medical, check-in, and QR Ph.
2. **Entry:** Phase 0 policies; isolated database/staging access; ordered migration inventory; test principals for two barangays.
3. **Scope:** Migrations 0093/0094, proposed narrow service-request document-tenancy migration, existing payment reservation function, and relevant RLS/storage policies. Exclude broad schema modernization.
4. **Steps:** Review legacy impact; add request/document tenant-active invariant; apply migrations in order; verify SECURITY DEFINER authorization; test ID object owner/same-tenant admin/cross-tenant admin/anonymous access; validate payment concurrency and partial-failure recovery.
5. **Reuse/complexity:** Extend existing triggers/RPCs and pgTAP conventions. Preserve current RPC signatures and canonical household trigger ownership. Add no new service layer unless a table invariant cannot cover all callers.
6. **Defect prevention:** Transactions protect request/history creation; rejected writes mutate nothing; payment reservation remains unique/idempotent; retained household IDs preserve attendance; migration rollback/backout is rehearsed before production.
7. **Verification:** Direct authenticated SQL/RPC tests for valid, foreign, inactive, deleted, duplicate, replay, concurrent, and forged inputs; run all existing Supabase tests and verify post-failure state.
8. **Exit:** Applied migration versions and passing two-tenant results exist for the exact staging schema; G03/G04/G05/G08/G16 remain closed until their complete integration evidence also passes.
9. **Responsibility:** Backend/database and payment roles; deployment owner for environment evidence.

### Phase 2 — Make export and deletion outcomes truthful

1. **Objective/traceability:** Close F3 and F4 and satisfy G10/G11.
2. **Entry:** Approved export inventory and deletion/retention decision from Phase 0; staging data with retained and erasable records.
3. **Scope:** Existing `export-my-data`, `delete-my-account`, deletion RPC, storage cleanup, and iOS result adapters. Exclude unrelated privacy infrastructure.
4. **Steps:** Version export schema; paginate required collections; propagate section errors; include approved household data; validate before sharing. For deletion, enumerate data/storage/auth steps, preserve lawful retained records in de-identified form, make failed cleanup retryable/observable, and return an idempotent state.
5. **Reuse/complexity:** Preserve endpoint names and compatibility where possible. Do not introduce a second export or deletion path.
6. **Defect prevention:** Never convert query failure to empty success; no file share until schema validation; deletion retries converge; local session/artifacts clear even when remote completion is pending.
7. **Verification:** Above-limit fixtures, forced failure per section, repeated export/deletion, interrupted storage cleanup, existing transactions, and a before/after retained-data audit.
8. **Exit:** Privacy owner approves the inventory; complete versus incomplete outcomes are machine-distinguishable and correctly presented; deployed audit matches policy.
9. **Responsibility:** Privacy/backend/operations, with iOS for local cleanup and presentation.

### Phase 3 — Implement one design foundation, navigation, Home shell, and production auth contract

1. **Objective/traceability:** Close F8, F10, and source-level portions of F11.
2. **Entry:** Phase 0 scope/copy; SDK 57 dependency decision; approved app identity, scheme, and auth callback contract.
3. **Scope:** Existing `ui.tsx`, `resident-stack.tsx`, tab layout, Home, app config, auth/runtime, and tests. Proposed new artifact: one token module only. Exclude feature-specific redesign.
4. **Steps:** Encode authoritative colors/type/spacing/radii; add needed component variants/states; rename Map/Updates; add notification/profile toolbar entry points; implement Home’s empty/attention/activity structure; configure confirmation/deep links; correct lifecycle/session recovery where testing exposes defects.
5. **Reuse/complexity:** Extend the current primitives and Router structure. Keep native tabs/stacks and existing secure-storage adapter. Do not add a general state framework or competing component library.
6. **Defect prevention:** Account-scoped drafts/caches; logout invalidates in-flight work; no raw backend errors; controls retain context while loading; largest text remains content-driven; native compatibility changes stay confined to the iOS workspace.
7. **Verification:** Token/unit snapshots, route/auth tests, rapid activation, logout/account-switch/reinstall scenarios, signup confirmation/recovery deep links, rendered compact/large light/dark/Accessibility XXL, VoiceOver order, keyboard, Reduce Motion.
8. **Exit:** Exact token/IA checks pass; auth journeys complete against staging; one signed development build launches on supported iPhones; no essential content clips or becomes unreachable.
9. **Responsibility:** iOS/design/accessibility, auth backend, release configuration.

### Phase 4 — Complete the authoritative document and payment lifecycle

1. **Objective/traceability:** Close F1 and F9; deliver catalog → request → receipt/status → pickup/payment under G04–G06.
2. **Entry:** Phases 0, 1, and 3; verified service catalog; attachment rules; private storage evidence; payment/pickup operating contract.
3. **Scope:** Existing services routes, resident API, shared validation/status derivation, request-ID upload bucket, cancellation/payment RPCs, and payment functions. Exclude new status values and unsupported delivery.
4. **Steps:** Add search; show only server fields that exist; add verification remediation; implement account-scoped draft and profile summary; validate/upload/retry/remove attachments; add review; reconcile ambiguous submission; render mandated status copy/timeline; confirm cancellation; add pickup; enable QR Ph/receipt only after gate evidence.
5. **Reuse/complexity:** Reuse request schema, UUID reconciliation, status derivation, existing RPCs/functions, and UI primitives. Use an iOS presentation mapping unless a coordinated shared-copy change is approved.
6. **Defect prevention:** One request per activation; uploaded-but-unlinked files are cleaned or recoverable; no optimistic receipt/payment; paid reopen creates no new intent; stale cancellation is rejected truthfully; receipt reloads authoritative amount/status.
7. **Verification:** Required/optional attachment fixtures, invalid bytes/MIME/size, interrupted uploads, double tap, lost response, server rejection, every state mapping, cancellation race, pickup reconciliation, QR expiry/replay/concurrency/webhook partial failure, file cleanup.
8. **Exit:** One end-to-end request reaches each supported state with correct next action. Pickup passes G06. QR Ph and paid receipts remain unavailable unless every G05 scenario passes.
9. **Responsibility:** Product/operations, backend/storage/payment, iOS, QA/privacy.

### Phase 5 — Build Updates, concerns, notification center, and actionable Home state

1. **Objective/traceability:** Close the Updates/Home portions of F5 while preserving push as optional.
2. **Entry:** Phases 0, 1, and 3; approved concern visibility/moderation/retention; inbox/read-state contract.
3. **Scope:** Existing announcements reads, incident contracts/storage/RPCs, Updates tab, notification center, Home attention/recent activity. Remote push is conditional.
4. **Steps:** Implement News/My concerns segmentation, non-emergency warning, form/draft/location/attachments/review, receipt/tracking/withdrawal, inbox read state, guarded refetching destinations, and Home attention aggregation.
5. **Reuse/complexity:** Reuse announcement/incident schemas, categories, withdrawal RPC, upload constraints, and current resources. Do not infer public visibility or add a social feed.
6. **Defect prevention:** Partial uploads do not produce receipt; push payload is routing-only; deleted/unauthorized destinations remain explainable; sensitive previews use generic copy; read state changes only after successful destination rendering.
7. **Verification:** Denied location, manual landmark, upload interruption, ambiguous submit, unauthorized/deleted target, session expiry, withdrawal denial, moderation state, monochrome/VoiceOver status, and generic-preview audit.
8. **Exit:** In-app notification center works without push. Concern release passes the approved policy and no-false-success scenarios. Remote push stays off unless sender/APNs/preferences/routing pass exact SDK 57 requirements.
9. **Responsibility:** Product/operations/moderation/privacy, backend, iOS; notification owner only if push launches.

### Phase 6 — Maps, emergency content, QR, and online-confirmed check-in

1. **Objective/traceability:** Close the relevant F5/F6 scope under G07/G08/G15.
2. **Entry:** Phases 0, 1, and 3; provider and data-transfer approval; verified emergency content owner; resident-only check-in semantics.
3. **Scope:** Accessible map/list, approved providers, emergency content, evacuation centers, scan/manual route, household QR disclosure. Exclude safety-guaranteed routing and offline queue.
4. **Steps:** Implement list-first recovery, provider outage/freshness states, camera-on-entry only, QR schema validation, duplicate-scan latch, authoritative center lookup and check-in, manual alternative, and artifact cleanup.
5. **Reuse/complexity:** Reuse existing geographic utilities, map bridge schema, migration 0094, emergency tables, and household QR endpoint. Retain the corrected text-only popup handling.
6. **Defect prevention:** QR barangay claims never authorize; rejected scans do not mutate household state; no household bulk attendance; provider routes do not imply safety; cached content is tenant/version scoped.
7. **Verification:** Forged/cross-tenant/inactive/deleted/malformed/oversized QR, rapid repeat, timeout/reconciliation, denied camera/location, provider outage, accessible list equivalence, physical scan and save/share cleanup.
8. **Exit:** Same-tenant online check-in is server-confirmed on a physical device; every rejection leaves state unchanged; approved content/provider disclosures are visible.
9. **Responsibility:** Backend, emergency operations/content owner, maps/privacy, iOS/QA.

### Phase 7 — Health, profile, household, IDs, help, and settings

1. **Objective/traceability:** Complete remaining authenticated identity/health scope without inventing household medical authorization.
2. **Entry:** Phases 0, 1, and 3; verified 0093/0094; verification/reviewer/appeal rules; content/support ownership.
3. **Scope:** Profile and verification states, household edits, private IDs/avatar, location verification, self-only medical registration, preferences/help. Exclude household medical applicants and HealthKit.
4. **Steps:** Expose exact verification remedy; preserve canonical IDs/attendance; add conflict handling; implement private upload lifecycle; collect actual/null prior-dose date; show server score/status; complete help/contact availability.
5. **Reuse/complexity:** Reuse profile fields, shared schemas, household trigger/RPCs, private bucket, medical RPC, and existing settings routes. No duplicate household store.
6. **Defect prevention:** Foreign/duplicate IDs fail; concurrent edits do not silently erase attendance; private files never enter public previews/logs; medical registration is signed-in resident only; no fabricated dates.
7. **Verification:** Resident/admin concurrent edits, retained attendance, cross-tenant ID access, HEIC/Files bytes and cleanup, denied location/Photos, duplicate/capacity/ineligible medical responses, screen-reader verification states.
8. **Exit:** G03/G04/G09/G16 evidence is complete for enabled features; unresolved household applicant or check-in semantics remain excluded and accurately described.
9. **Responsibility:** Product/backend/privacy/health operations/iOS.

### Phase 8 — Qualify one immutable production candidate

1. **Objective/traceability:** Close F7, F11, and F12 and establish—not assume—release readiness.
2. **Entry:** All retained-scope phases complete; all applicable gates have environment-specific evidence; Apple/EAS/Mac/device/test access.
3. **Scope:** Clean checkout, supported dependency patches, CI, native config, EAS profiles, signed build, staging/prod configuration validation, accessibility/performance/device matrix, TestFlight, rollback/support evidence.
4. **Steps:** Commit a candidate; clean lock-preserving install; run lint/type/unit/shared/database/integration checks; resolve exact SDK 57 compatibility warnings; create signed build; test devices/states; run TestFlight pilot; validate privacy metadata, assets, permissions, diagnostics, and backend rollback.
5. **Reuse/complexity:** Use the existing CI job, release checker, checklist, plan ledger, and platform diagnostics. Add no unrelated observability or infrastructure requirements.
6. **Defect prevention:** Environment name/tenant/bundle/scheme are asserted at build/startup; secrets remain outside source; migrations have rollback/recovery; diagnostics omit PII; the tested binary is the submitted binary.
7. **Verification:** Record command outputs, commit, build number, migration versions, tenant, devices/OS, representative state screenshots, VoiceOver results, fault-injection outcomes, performance traces, TestFlight findings, and approval roles.
8. **Exit:** Release check is zero; all applicable checklist items and gates are evidenced; no Critical/High blocker remains; known residual risks and rollback/support ownership are documented. Only then can readiness be “supported.”
9. **Responsibility:** Release/Apple/EAS, QA/accessibility, product/design/privacy/backend/operations.

## 5. Genuinely unresolved questions

1. **What is the exact first-release capability set?** The current launch matrix includes nearly every resident domain, while most are gated. This determines which roadmap phases are mandatory before release and which navigation promises are valid.

2. **Which document services require identity/location verification, what attachments are required, and what are the remediation/appeal rules?** This blocks a concrete request-form schema and verification gate.

3. **What are the approved attachment type, byte, metadata, malware-screening, and retention rules?** This blocks implementation and acceptance of document and concern uploads.

4. **What concern data may be public, anonymous, mapped, retained, escalated, or withdrawn, and what moderation/operator contact is available?** This blocks concern submission and public incident scope.

5. **Does evacuation check-in represent only the signed-in resident, all household members, or a selected subset?** The current plan safely defaults to resident-only; any broader behavior requires a new approved contract.

6. **How should concurrent resident/admin household edits be resolved?** “Last writer wins” is not approved and can discard identity changes even after attendance preservation is fixed.

7. **What is the required personal-data export inventory and the lawful retention/deletion matrix?** This determines what “complete export” and “delete account” mean.

8. **What server-side inbox/read-state contract supports the required notification center, and is remote push part of launch?** In-app updates can proceed first; remote delivery additionally needs a sender, APNs, preferences, and routing ownership.

9. **Which map/geocoding/routing processors and emergency content sources are approved?** This blocks provider configuration, disclosure, attribution, freshness policy, and content acceptance.

10. **Will production authentication require email confirmation, and what URL scheme/callbacks are approved?** This blocks registration/recovery completion and app identity configuration.

## 6. Verification coverage and limits

### Performed during this review

- Read both required Markdown documents completely and recorded their exact paths, sizes, and hashes.
- Read the applicable root instruction file and confirmed no nested iOS/Supabase/shared/plan instruction file applies.
- Recorded branch, commit, working-tree status, uncommitted changes, and document history.
- Inspected the full iOS application inventory, configuration, release gates/checklist, UI primitives, navigation, auth/session code, request/catalog/status flows, announcement/health/profile/settings surfaces, tests, and dependency declarations.
- Inspected material Supabase migrations, RLS/storage policies, payment/request contracts, export/deletion functions, tenant guards, and pgTAP source.
- Searched all migrations for a later service-request/document-type tenant invariant; none was found.
- Inspected the 62-page supplied resident-screen PDF through existing rendered pages and its metadata.
- Read the exact Expo SDK 57 baseline, Native Tabs, and Notifications documentation. The versioned SecureStore page returned an internal retrieval error during this pass, so local configuration and historical plan statements do not by themselves certify native SecureStore behavior.
- Ran `git diff --check`; it reported line-ending warnings but no whitespace error.
- Ran the repository’s read-only release preflight. It failed for:
  - `IOS_BUNDLE_IDENTIFIER`
  - `IOS_URL_SCHEME`
  - `EAS_PROJECT_ID`
  - Supabase URL, anon key, and barangay ID
  - all 13 release gates.

### Historical evidence only

The plan records historical passes for eight iOS tests, iOS typecheck/lint, 93 shared tests, and an Expo production export. It also records a failed dependency compatibility check. Those results were **not rerun** in this review and are not tied to an immutable candidate; they establish prior local activity, not current release readiness.

### Not performed

No dependency installation, source modification, database migration, database/RLS test, application launch, native build, EAS build, simulator run, screenshot generation, automated UI test, payment call, deployment, signed build, TestFlight upload, physical-device test, VoiceOver session, visual comparison, or accessibility audit was performed.

### Outstanding evidence

- Clean install and current lint/type/unit/shared/export results for a committed candidate.
- Applied migration and two-tenant/storage/payment tests against identified environments.
- Current deployed auth, catalog, payment, provider, and retention configuration.
- Rendered representative screens/states on compact, standard, and large iPhones.
- Light/dark, largest Dynamic Type, VoiceOver, focus, keyboard, Reduce Motion/Transparency, contrast, and touch-target validation.
- Physical Keychain, logout/account-switch, camera, location, Photos/Files, QR, sharing, foreground/background, and permission-recovery tests.
- Fault-injected request/upload/payment/export/deletion/reconnect evidence.
- Signed production-mode build, exact SDK 57 native compatibility, TestFlight pilot, operational diagnostics, rollback, support, and final approval evidence.

The strongest conclusion supported by current evidence is therefore: **the repository contains a promising but uncommitted partial implementation; the intended experience is well specified in visual and interaction terms but still depends on material product/backend decisions; multiple explicit source-level defects remain; and production release is blocked.**

- Turn the roadmap into tracked tickets
- Prepare a documentation correction plan
- Deep-review the document request contract