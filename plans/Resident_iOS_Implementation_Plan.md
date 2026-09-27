# Barangayan Resident iOS Implementation Plan

Date: September 27, 2026  
Revision basis: [Resident iOS evidence-based review](Resident_iOS_evidence-based_review.md)  
UI/UX validation constraint: [Resident iOS UI/UX Design System Handoff](Resident_iOS_UI_UX_Design_System_Handoff.md)

## 1. Authority, scope, and readiness

The evidence-based review is the sole authority for this revision. The design-system handoff validates review-driven UI/UX changes but does not add scope independently. Repository and Expo SDK 57 documentation checks validate implementation details only.

This plan covers the separate iPhone-only Expo application at `apps/resident-ios-mobile`, the shared contracts it consumes, and only the narrow backend, CI, build, and release changes required for the retained resident iOS scope. It does not authorize unrelated work in the Android, web, or admin applications.

**Readiness verdict: BLOCKED.** The repository contains a promising but uncommitted partial implementation, not a delivery-ready resident application. Production release remains blocked by unresolved product and operating decisions, confirmed source defects, unexecuted backend safety migrations, absent production/native evidence, and all release gates being closed. No phase or gate may be called implemented, verified, or release-verified unless its acceptance evidence is tied to the same immutable candidate, environment, and build.

### Release-scope rule

Phase 0 must approve the exact first-release capability set. Until then, retain the currently stated capability matrix as intended scope but keep every incomplete or unverified capability fail-closed. Do not open a gate merely to match the matrix. If product approves a narrower release, update this plan, the handoff-facing navigation and promises, listings, and acceptance criteria together; excluded capabilities must remain inaccessible and must not be promised in release materials.

For any release containing document services, Phases 0-4 and 8 below are mandatory. Phases 5-7 are mandatory only for the capabilities retained in the approved release slice. Remote push, reliable offline check-in, household medical registration, operational SMS delivery, iPad-native layouts, HealthKit, Apple Calendar, appointment booking, and retired delivery concepts remain excluded or optional exactly as stated below.

### Current verified baseline

| Item | Current state | Consequence |
|---|---|---|
| Repository revision | `main` at `d5f512a649e839fb066d07f6476b753399ed892c`; working tree materially dirty | The complete iOS app, handoff, review, migrations 0093/0094, and tenant test are not tied to an immutable committed candidate. |
| iOS stack | Expo `57.0.10`, React Native `0.86.2`, React `19.2.3`, Router `57.0.10`, Node engine `>=22.13.0` | Expo SDK 57 documents RN 0.86, React 19.2.3, Node 22.13.x minimum, iOS 16.4+, and Xcode 26.4+. The exact Native Tabs page recommends Router `~57.0.23`; qualify a compatible patch without silently upgrading unrelated workspaces. |
| Native/build configuration | iPhone-only, portrait, conditional scheme/bundle ID/EAS project; no `eas.json` | Signed development, staging, production, TestFlight, and rollback evidence is absent. |
| Notifications | `expo-notifications` is not installed or configured; no sender is established | The in-app notification center is the required base flow. Remote push stays off unless its separate gate passes. SDK 57 requires installation, a config plugin, credentials, and a rebuilt binary for applicable native changes. |
| UI/navigation | Existing primitives and tab labels differ from the handoff; Home/Updates are incomplete | F8 and the Home/Updates portion of F5 are open. |
| Document requests | Current form immediately inserts from optional notes; no verification, draft, attachment, review, or authoritative receipt flow | F1 and F9 are open. |
| Backend safeguards | Migrations 0093/0094 and seven tenant assertions exist only as untracked, unexecuted source; no document-type tenant invariant exists | F2 and F6 are release blockers. |
| Privacy endpoints | Export can mask section failures/truncation; deletion can leave storage and retains/bans the auth identity | F3 and F4 are release blockers if their actions are offered. |
| Release preflight | Six configuration values are missing and all 13 source gates are false; release checklist is unchecked | F7 is the decisive readiness blocker. |

The exact versioned references used by this plan are [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo Router Native Tabs v57](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/), and [Expo Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/). Read the exact v57 page for each additional Expo package before implementation.

## 2. Product scope and information architecture

### Intended capability matrix pending Phase 0 approval

| Capability | Intended disposition | Gate or unresolved dependency |
|---|---|---|
| Guest access, sign-in, registration, recovery | Retain | G01 production auth confirmation/callback contract; G02 native session evidence |
| Profile, verification, household, private IDs | Retain only when enabled gates pass | G03/G04; verification/remediation rules; concurrent edit policy; 0093 deployment/tests |
| Document catalog and requests | Retain | F1/F2/F9; service verification/attachment rules; G04; authoritative request invariant |
| Pickup and QR Ph | Conditional within Services | G05/G06; settlement and operational contract evidence |
| News, concerns, Home activity | Retain only if approved release slice includes them | Concern visibility/moderation/retention policy; uploads; F5 |
| In-app notification center | Retain as the primary update channel | Server inbox/read-state contract |
| Remote push | Optional, off by default | G13; package/plugin, APNs/credentials, sender, preferences, token lifecycle, routing, rebuilt binary |
| Map, emergency content, check-in, household QR | Conditional | G07/G08/G15; provider/content approval; 0094 deployment/tests; resident-only semantics until changed by approved contract |
| Health self-registration | Conditional | G09/G16; self-only; 0094 deployment/two-tenant/role tests |
| Export and account deletion | Retain only after truthful backend outcomes | G10/G11; approved inventories and deployed tests |

### Required navigation and terminology

Use five native tabs: **Home / Services / Map / Health / Updates**. Settings/profile remains a stack reached through a toolbar avatar on Home and Updates and through direct remediation links from gated flows. The global notification center is a toolbar destination, not a sixth tab.

- **Home:** needs-attention items, quick actions, latest official announcements, and recent activity.
- **Services:** document catalog, local drafts, requests, status, payment/pickup, and service history.
- **Map:** evacuation centers and only policy-approved incident discovery, with an equivalent accessible list.
- **Health:** medical-drive discovery and signed-in-resident-only registration.
- **Updates:** News and My concerns, concern status, new-concern entry, and notification entry.

This replaces the stale `Maps`/`Reports` terminology in the former plan. It does not change persisted identifiers or backend state names.

### Server-authoritative and excluded behavior

A server acknowledgement is the sole basis for resident-facing received, paid, verified, approved, ready, completed, resolved, or checked-in claims. Fees, target times, fulfillment, pickup instructions, eligibility, and payment options appear only when supplied by authoritative data. Drafts are explicitly local and not sent.

Do not invent a persisted “needs information” request state, public incident visibility, fee, timeline, delivery promise, safe evacuation route, household attendance, household medical applicant, complete export, completed deletion, background alert, or SMS capability without the corresponding approved contract and gate evidence.

## 3. Architecture and repository decisions

### Application and reuse boundary

Keep `@barangayan/resident-ios` as a separate Expo Router workspace. Reuse `@barangayan/shared` types, schemas, category/role identifiers, monetary centavo representation, geographic utilities, QR payload shapes, and request-state derivation. Do not import application files from the Android workspace and do not create a second resident backend model.

Use the existing focused contexts/hooks and typed Supabase adapter. Do not add a general state framework or parallel component library. Extend the existing `Body`, `Card`, `Action`, `Field`, and `ResidentStack`; add one token module for the authoritative handoff values.

Preserve endpoint names and RPC signatures where practical. Prefer a table-boundary invariant, narrow trigger/constraint, or existing authoritative RPC extension over a new service layer. A new abstraction is allowed only when the invariant cannot cover all callers; record that as an assumption and compatibility decision before implementation.

### Proposed responsibility layout

| Location | Responsibility |
|---|---|
| `src/app` | Thin Router routes, five tab stacks, settings/profile stack, notification center, and modal routes |
| `src/features/*` | Auth, Home, profile, services, Updates/concerns, Map/emergency, health, settings, and their presentation/state orchestration |
| `src/data` | Typed queries, RPC/Edge Function adapters, normalization, reconciliation, and public error classification |
| `src/lib` | Configuration, secure session/runtime, account-scoped draft/cache keys, lifecycle, release gates |
| `src/platform` | File/image, camera, location, sharing/PDF, WebView map, and optional notification adapters |
| `src/components`, `src/theme` | Existing primitives extended through one authoritative token module |
| `tests`, `e2e/ios`, `docs` | Contract/state tests, device journeys, decisions, release checklist, and revision-bound evidence index |

### Configuration and dependency rules

- Retain iPhone portrait scope, `supportsTablet: false`, iOS 16.4+, and owner-provided bundle ID, URL scheme, EAS project, and environment identifiers.
- Keep service-role, PayMongo secret, APNs key, and signing secrets out of the bundle and source.
- Use Node 22.13.x or later in clean CI. Preserve the root lockfile and unrelated package resolutions.
- Resolve the Router patch difference through a clean SDK 57 compatibility check and signed native build. Do not treat an export bundle as native qualification.
- Add an iOS-only `eas.json` only during release work, with development/simulator, registered-device, staging, and App Store profiles as applicable.
- Do not add `expo-notifications` or its plugin merely to satisfy a checklist. Add it only if the approved push scope requires it, then rebuild and test the native binary per the v57 documentation.
- Use SecureStore through the existing adapter; preserve the tested chunking approach, qualify real Keychain size/reinstall behavior, and provide no plaintext fallback.
- Add camera, location, image/document picker, file, sharing/print, WebView, SVG/capture, or media-library packages only for retained flows and only after reading their exact SDK 57 pages.

## 4. UI/UX implementation contract

This section implements only review findings F1, F5, F8, F9, F10, and F11. The handoff values below constrain those changes; they do not create additional product scope.

### Authoritative tokens

Create one token module and replace conflicting values in existing primitives.

| Token group | Required values |
|---|---|
| Light colors | canvas `#F7F8F7`; surface/raised `#FFFFFF`; selected `#E8F4EF`; primary text `#171D1A`; secondary `#45534E`; tertiary `#61716B`; border `#CDD8D2`; primary `#0D6B59`; on-primary `#FFFFFF`; success `#147A3E`; warning `#8A5A00`; danger `#B42318`; info `#075BAA`; focus `#0A70D1` |
| Dark colors | canvas `#101614`; surface `#18201D`; raised `#202A26`; selected `#16382F`; primary text `#F3F7F4`; secondary `#B9C7C0`; tertiary `#8EA19A`; border `#3A4A43`; primary `#35C7A0`; on-primary `#06251D`; success `#5DDB8B`; warning `#FFD37A`; danger `#FF8B82`; info `#7FC4FF`; focus `#88C7FF` |
| Typography | SF Pro/system Dynamic Type styles: largeTitle 34/41 bold, title1 28/34 bold, title2 22/28 semibold, headline 17/22 semibold, body 17/23, callout 16/21, subheadline 15/20, footnote 13/18, caption 12/16 medium, mono reference 15/20 |
| Spacing/shape | spacing 4/8/12/16/20/24/32; margins 20 compact and 24 regular; rows >=56; targets >=44x44; buttons >=50 high; radii 8/12/16/24; 1-point semantic border; cards use border and no decorative shadow |

Cards, controls, fields, status rows, navigation, loading, empty/error states, and confirmations must use these tokens and component contracts. Body text is not truncated; titles wrap before truncation. At accessibility sizes, controls and cards grow/reflow rather than clip.

### Shared component and state requirements

- `Action` supports primary, secondary, destructive, disabled, pressed, and loading states, keeps its location while loading, and prevents repeat activation.
- `Field` is content-driven with label, helper/error, focused/invalid/disabled states, native traits, adjacent announced errors, and numeric-keyboard Done.
- `Card` uses the semantic surface, required border, radius, and content-driven height.
- Attachment rows expose name, size, and selecting/invalid/uploading/failed/complete/removing state independently, with retry/remove.
- Status always uses label plus icon or equivalent non-color cue.
- Every blocking empty/error/unavailable state provides an appropriate Retry, Back, Settings, or Help action and never exposes a raw backend error.
- Critical receipt, payment, verification, deletion, and submission outcomes remain on a durable screen; a transient message is insufficient.
- Destructive actions use a named confirmation. Request cancellation must show consequence, Cancel, and a named final action before contacting the server.

### Account-scoped drafts

Document and concern drafts persist after meaningful changes, backgrounding, and attachment selection. Scope each draft to authenticated account plus service/report type. Store form data, attachment metadata, and completed upload identifiers; do not persist unprotected identity-document copies. Resume offers **Resume** and **Discard**. Dirty back/dismiss requires confirmation. Logout/account switch removes private drafts and invalidates in-flight work; wrong-account deep links must never restore another account's draft.

## 5. Authoritative contracts and safeguards

### Document request creation and tenancy

Keep the current `service_requests` model, request IDs, route structure, shared validation, and UUID reconciliation. Do not introduce a second request model.

Before any request write is accepted:

1. Phase 0 identifies which services require profile, identity, or location verification; exact attachment requirements; allowed types/bytes; metadata/malware/retention policy; remediation/appeal rules; draft retention; fee/payment/pickup rules.
2. Catalog/detail displays only server-authored availability, requirements, fee, target, and fulfillment data that actually exist.
3. A verification gate explains the exact remediation and links to the relevant profile flow.
4. The form shows a read-only profile summary with an Edit profile link, validates fields locally, and manages every attachment independently.
5. Review displays exact entered data, attachments, requirements, fee/payment condition, and privacy/conditions before submission.
6. First activation disables duplicates and shows “Sending request…”. A timeout or lost response triggers authoritative reconciliation before retry.
7. A durable reference and “We received your request” appear only after the authoritative request row is confirmed. Payment remains a separate authoritative status/action.

Add one authoritative table-boundary invariant—prefer a narrow trigger/constraint or authoritative creation RPC—that verifies the authenticated resident owns the request, the request barangay matches the resident, and the referenced document type belongs to that barangay and is active and not deleted. Preserve callers and request IDs. The request/history creation path must be transactional; any rejection creates no request, history, payment, or orphaned linkage.

**Acceptance:** two-tenant tests reject foreign, inactive, deleted, and forged document-type IDs with no side effects; a valid own-tenant request succeeds. Required and optional attachment cases pass. Invalid/oversized/failed uploads remain recoverable. Uploaded-but-unlinked files are cleaned or recoverable. Two rapid activations create at most one request. A timeout reconciles before retry. The receipt appears only for an authoritative row.

### Request status, timeline, and cancellation

Retain persisted states and shared derivation. Unless every consumer approves changing shared copy, add an iOS presentation mapping:

| Source state | Resident label | Required presentation |
|---|---|---|
| Local draft | Draft - not sent | Resume or discard |
| `submitted` + unpaid | Received - payment needed | Request exists; payment may be required before processing |
| `submitted` + paid/waived | Received | Do not imply review has started |
| `in_progress` | In review | Render server history and next action |
| `ready_for_pickup` | Ready for pickup | Render only server-authored pickup instructions |
| `completed` | Completed | Fulfillment is recorded |
| `cancelled` | Cancelled | Show server reason/action when available |

Request detail renders authoritative history/timeline and instructions. Remove hard-coded original-document and processing-estimate claims. Cancellation requires a named destructive confirmation; the backend remains authoritative. A stale cancellation denial must refresh the request and explain the current state without claiming success.

**Acceptance:** every persisted state maps to the required label and next action; monochrome and VoiceOver checks convey state; timeline data matches the server; cancellation confirmation is required and stale rejection is truthful.

### Household, IDs, medical, check-in, and payments

- Apply and verify migrations 0093/0094 in order against an isolated test/staging environment before enabling dependent flows. Review legacy compatibility and migration rollback/recovery first.
- Preserve canonical household IDs and attendance for retained members. Reject foreign/duplicate IDs. Define concurrent resident/admin conflict handling; last-writer-wins is not approved by this plan.
- Private ID objects require owner and same-barangay authorized-admin access and must deny cross-barangay admin and anonymous access for profile and service-request paths.
- Medical registration is signed-in-resident-only, uses actual or null prior-dose date, and requires server enforcement of resident role and drive tenant/active state.
- Check-in is online, resident-only, and server-confirmed. Resolve the actual center; QR barangay claims do not authorize. Enforce resident/check-in/center tenant equality and active/non-deleted center. Do not bulk-mark household attendance.
- Pickup uses the existing payment-method RPC and authoritative reads; no resident payment insert.
- QR Ph stays disabled until paid reopening, concurrency/reservation, lost response, partial provider/database failure, expiry, cancellation, polling, webhook, duplicate, and replay tests pass. Payment success is never optimistic.

**Acceptance:** direct authenticated SQL/RPC tests cover valid, foreign, inactive, deleted, duplicate, replay, concurrent, and forged inputs; rejection mutates nothing. Applied migration versions, environment identity, complete test output, and rollback/recovery outcome are retained for the same staging schema.

### Export

Phase 0 must approve a versioned personal-data export inventory. Extend `export-my-data`; do not create a competing endpoint. Paginate every unbounded required collection, include approved household data, propagate each required section error, and return a machine-distinguishable failed/incomplete outcome. The iOS client validates the versioned schema before creating or sharing a temporary file and removes that file after share/cancel/logout.

**Acceptance:** fixtures above the configured API row limit reconcile exact counts and representative fields for every approved section. Forced failure of each required section cannot yield a “complete” result or shareable file. No code-only claim substitutes for privacy-owner inventory approval.

### Account deletion

Phase 0 must approve a lawful retention/deletion matrix covering auth identity, profile fields, household data, uploads, incidents, health, requests, payments, and other linked data. Extend `delete-my-account`; do not create a second deletion path. Make retained/de-identified data explicit, make storage and other cleanup retryable and observable, address auth-account removal rather than silently treating a long ban as deletion, and return an idempotent state that distinguishes pending/partial from complete. Local session, drafts, private caches, in-flight work, and temporary artifacts must clear even if remote cleanup is pending.

**Acceptance:** deployed tests cover no-record, existing-record, partial cleanup, repeated call, and interrupted ban/auth-removal cases. A retained/deleted data audit matches the approved inventory. The UI never reports completion while a required step is pending or failed.

### Authentication, deep links, and local data

Phase 0 must decide whether production requires email confirmation and must approve the bundle scheme, redirect allowlist, registration continuation, recovery callback, and same-account draft behavior. Implement the matching flow; do not treat a no-session signup as a terminal “contact your barangay” condition when confirmation is enabled.

Credentials use SecureStore/Keychain through the existing adapter. Token refresh follows app lifecycle with one listener. Logout is an immediate local transition even when remote revocation fails. Personal caches and drafts are account-scoped; stale responses from a prior account are discarded. Public emergency caches are tenant/version scoped and expose freshness.

**Acceptance:** staging and production-like tests cover confirmed and unconfirmed signup, expired/used confirmation link, OTP recovery, app-not-running deep link, session expiry, revoked session, offline logout/restart, account A to B switch, wrong-account draft, and unauthorized destination.

### Uploads, errors, and privacy

Validate actual bytes, MIME type, and configured size after any normalization. Use signed/authenticated access for identity documents. Clean temporary and orphaned files or retain an observable recovery record. Never log tokens, OTPs, signed URLs, private file contents, personal form data, location, health, or payment details.

Safe reads may use bounded retry. Ambiguous writes never retry blindly; query/reconcile first. Every retained flow must represent initial loading, empty, denied/prerequisite unavailable, content, refresh failure, retry, cancellation, and recovery. Safe refresh failure may retain current-account content but never prior-account private data.

## 6. Home, Updates, concerns, notifications, and Map

### Home and Updates

Home must implement, in order, needs-attention items, quick actions, latest announcements, and recent activity. Aggregation must use authoritative request/concern/notification data and must not visually promise gated actions. Updates contains **News** and **My concerns**, with action-needed items first, search/filter where supported, new-concern entry, and type-specific empty/error states.

### Concern flow

Concern release depends on Phase 0 approval of visibility, anonymity, moderation, escalation, retention, withdrawal, public/map exposure, operator contact, and attachment policy. Do not infer a public social feed.

The form keeps the non-emergency warning visible, supports category/title/optional description, approved attachments, and location permission recovery through typed landmark/manual pin. Draft/review/receipt rules mirror the authoritative document pattern. Submission timeout preserves the draft and does not claim receipt. Withdrawal uses a named confirmation and server authority.

**Acceptance:** denied location, manual landmark, invalid/partial/interrupted uploads, ambiguous submit, session expiry, withdrawal denial, moderation states, monochrome status, VoiceOver order, and public-visibility copy all pass against the approved policy.

### Notification center and optional push

Implement a server-backed in-app notification center before remote push. Read state is separate from the underlying record and changes only after a destination renders successfully. Each row remains understandable when its destination is deleted or unauthorized and offers a Home/Updates fallback. A push payload, if later enabled, is only a versioned route plus opaque identifier; the app validates authorization and refetches. Use generic previews by default.

Remote push remains off unless a sender, APNs credentials, event/preference/quiet-hours policy, token lifecycle, authorized routing, and device tests pass. Only then add the SDK 57 package/plugin and produce a new binary. Do not enable background execution without an approved requirement.

### Map and emergency

Reuse the existing geographic utilities and map bridge schema. Use an accessible list-first recovery path and an alternate map. Validate every bridge message/coordinate/identifier, restrict WebView navigation/resources, bundle pinned Leaflet assets, never inject credentials, and retain text-only popup creation for resident-controlled labels. Approved providers, disclosure, attribution, freshness, and emergency content ownership are Phase 0 decisions. Provider routes must not imply verified safety.

**Acceptance:** provider outage, denied/approximate/stale location, accessible list equivalence, hostile labels/messages, cached tenant/version separation, forged QR, physical scan, and save/share cleanup pass for the retained scope.

## 7. Ordered implementation roadmap

### Dependency sequence

`Phase 0 decisions` -> parallel `Phase 1 backend invariants`, `Phase 2 privacy contracts`, and `Phase 3 foundation/auth` -> `Phase 4 documents/payments`, `Phase 5 Updates/concerns`, `Phase 6 Map/emergency`, `Phase 7 health/profile` -> `Phase 8 release qualification`.

### Phase 0 - Freeze authority, scope, and operational contracts

**Traceability:** F5, F10, F12; High for F5, Medium for F10/F12.  
**Current status:** not started; several questions are recorded but no revision-bound approvals exist.

- Record the immutable candidate target, environment/tenant, first-release capabilities, and owner roles.
- Decide service verification, attachments, fee/pickup, draft retention, concern policy, check-in semantics, export inventory, deletion retention, inbox/push, auth confirmation/callback, map providers, emergency content, support route, and device/OS matrix.
- Reconcile each decision with G01-G16. Label PDF examples nonbinding. Record effective date, approver role, compatibility impact, and fail-closed default.

**Exit:** no retained flow depends on invented policy or operational copy; unanswered decisions remain explicitly unresolved and gated.

### Phase 1 - Enforce backend tenancy and write invariants

**Traceability:** F2, F6; High release blockers.  
**Current status:** source present but unverified; not implemented in any identified environment.

- Review ordering and legacy impact of 0093/0094; add the narrow document-request/document-type invariant.
- Apply in an isolated environment; verify SECURITY DEFINER authorization, storage access, household reconciliation, medical/check-in tenant rules, and payment reservation behavior.
- Run all existing regression tests plus direct authenticated two-tenant, role, forged-ID, concurrency, replay, and post-failure-state tests.

**Exit:** exact applied versions, environment identity, passing outputs, and rollback/recovery result are retained; G03/G04/G05/G08/G16 remain closed until full integration evidence passes.

### Phase 2 - Make export and deletion truthful

**Traceability:** F3, F4; High release blockers.  
**Current status:** confirmed defects; gated and not accepted.

- Implement the approved versioned export inventory, pagination, section-error propagation, household inclusion, and schema validation before share.
- Implement the approved deletion/retention inventory, explicit retained data, retryable/observable cleanup, auth handling, idempotent state, and truthful iOS presentation.

**Exit:** complete versus incomplete is machine-distinguishable; privacy owner approves inventories; deployed fault-injection and retained-data audits pass.

### Phase 3 - Implement the design foundation, navigation, Home shell, and production auth contract

**Traceability:** F8, F10, and source-level F11; Medium release blockers for applicable acceptance.  
**Current status:** partial source with confirmed nonconformities; not verified.

- Add one authoritative token module and extend existing primitives/stacks.
- Rename tabs to Map/Updates; add notification and profile/avatar entry; implement Home hierarchy and gated empty states.
- Resolve Router SDK 57 patch compatibility without unrelated upgrades.
- Configure the approved scheme/callback and implement confirmation/recovery continuation.
- Correct lifecycle/session behavior only where tests expose gaps; preserve current secure-storage adapter.

**Exit:** source token/IA snapshots pass; auth journeys pass against staging; compact/large light/dark/Accessibility XXL and VoiceOver checks pass; one signed development build launches on supported iPhones.

### Phase 4 - Complete the authoritative document and payment lifecycle

**Traceability:** F1, F2, F9 and document-related F5/F7; High for F1/F2/F5/F7, Medium for F9.  
**Current status:** partial unsafe request path; payment/pickup/receipt gated.

- Implement catalog search, verification remediation, profile summary, account-scoped drafts, attachments, review, duplicate prevention, reconciliation, authoritative receipt, required status mapping/timeline, cancellation confirmation, pickup, and conditionally QR Ph/receipts.
- Reuse current request schema, UUID reconciliation, status derivation, RPCs/functions, and primitives.

**Exit:** one end-to-end request reaches each supported state with correct next action. Required/optional upload and fault cases pass. Pickup passes G06. QR Ph and paid receipts remain unavailable until every G05 scenario passes.

### Phase 5 - Build Updates, concerns, notification center, and actionable Home state

**Traceability:** F5 plus F7/F11 where push/device evidence applies; High for F5/F7, Medium for F11.  
**Current status:** announcements shell only; concern, inbox, and Home aggregation absent.

- Implement News/My concerns, the concern draft/review/receipt lifecycle, server inbox/read state, guarded destinations, and Home attention/activity aggregation.
- Keep remote push conditional and separate from the in-app center.

**Exit:** the in-app notification center works without push; concern flow passes approved policy and no-false-success tests; excluded capabilities remain inaccessible.

### Phase 6 - Build Map, emergency content, QR, and online-confirmed check-in

**Traceability:** F5, F6, F7, F11; High for F5-F7, Medium for F11.  
**Current status:** gated placeholders/source-only guards; not verified.

- Implement accessible list/map, approved providers/content, camera-on-entry scanning, schema validation, duplicate latch, authoritative center lookup/check-in, manual alternative, household QR disclosure, and artifact cleanup.

**Exit:** same-tenant resident-only check-in is server-confirmed on a physical device; every rejection mutates nothing; content/provider disclosures are approved and visible.

### Phase 7 - Complete health, profile, household, IDs, help, and settings

**Traceability:** remaining F5/F6 scope. High.  
**Current status:** read-only shells and gated actions; not accepted.

- Implement exact verification remedy, household conflict behavior, canonical ID/attendance preservation, private-upload lifecycle, self-only medical registration with actual/null dose date, authoritative server results, and verified help/contact availability.

**Exit:** G03/G04/G09/G16 evidence passes for enabled features; unresolved household applicant or broader check-in semantics remain excluded.

### Phase 8 - Qualify one immutable production candidate

**Traceability:** F7, F11, F12; High for F7, Medium for F11/F12.  
**Current status:** not started; no candidate, EAS profile, signed build, device result, or TestFlight evidence.

- Commit/freeze a candidate; run a clean lock-preserving install and current lint/type/unit/shared/database/integration/export checks.
- Resolve SDK 57 compatibility warnings; create signed development and production candidates; validate exact environments, migrations, permissions, privacy metadata, assets, diagnostics, rollback, and support ownership.
- Test representative devices and states, then the exact candidate in TestFlight.

**Exit:** release preflight is zero; all applicable checklist items and G01-G16 evidence point to the same commit/build/environment; no Critical/High blocker remains; residual risks and rollback/support ownership are documented.

## 8. Verification and acceptance evidence

### Required evidence layers

| Layer | Evidence |
|---|---|
| Logic/component | Status presentation, UUID reconciliation, account scoping, draft cleanup, upload state, export schema, error classification, duplicate prevention, accessible labels/states |
| Database/backend | Two-tenant/role SQL/RPC/storage tests, migration versions, negative post-state, payment fault/concurrency tests, export/deletion fault injection |
| Simulator/rendered | Compact/standard/large screens; light/dark; largest Dynamic Type; Full Keyboard Access; deep links; loading/empty/denied/failure/retry/cancel/recovery |
| Physical device | Keychain/reinstall/account switch, camera/QR, location, Photos/Files, sharing, lifecycle, permissions, optional notification delivery |
| Release candidate | Exact commit/build/environment, clean CI, signed configuration, migration inventory, performance traces, TestFlight results, approvals, rollback/support evidence |

### Accessibility and performance acceptance

- VoiceOver order follows the visual/logical task order; every control has a unique name, role, state, and needed hint; focus returns predictably.
- Largest Accessibility Dynamic Type has no clipped, overlapping, or unreachable essential UI. Tab labels remain visible; peer segments fall back to a menu/list when necessary.
- Every target is at least 44x44 points; buttons are at least 50 points and may grow to two lines.
- Status is understandable in monochrome and through VoiceOver. Approved token pairings pass contrast. Reduce Motion/Transparency have nonessential-motion/opaque alternatives.
- Errors are adjacent, announced, preserve entered data, and give a recovery action. Sensitive previews/files never appear unauthenticated or in logs.
- Validate representative non-happy states on compact, standard, and large iPhones, both appearances, largest text, VoiceOver, denied permissions, and interrupted connectivity.
- Measure, do not assume: press response <=100 ms; 60/120 Hz cadence without sustained dropped frames; cached Home useful content <=2 seconds p75; uncached skeleton <=400 ms p75; confirmed result or recoverable pending state <=10 seconds p95; no skeleton layout shift; 500-item lists virtualize under low-memory device tests.

Every evidence record must include candidate commit/build number, environment/tenant, device/OS, screen/state or test fixture, expected result, observed result, artifact link, date, and issue disposition.

## 9. Release gates

All gates are currently **closed**.

| Gate | Required closure evidence |
|---|---|
| G01 Tenant/environment | Explicit staging/production tenant, Supabase URL/key ownership, auth behavior, and server validation; never choose the first row |
| G02 Native compatibility | Signed device build qualifying Native Tabs, Keychain, WebView, camera, QR/capture, permissions, and exact SDK 57 dependency set |
| G03 Household | 0093 applied; legacy audit; resident/admin authorization, foreign/duplicate ID, attendance preservation, and approved concurrency behavior |
| G04 Private IDs | Owner/same-barangay admin allowed; cross-barangay/anonymous denied; signed access for profile and request paths |
| G05 QR Ph | Settlement, paid reopen, reservation/concurrency, timeout, partial failure, expiry, cancellation, polling, webhook, duplicate/replay |
| G06 Pickup | Existing RPC plus authoritative reads and confirmed administrative reconciliation |
| G07 Maps/content | Approved providers, transfers, attribution, route disclaimer/suitability, freshness, and content owner |
| G08 Check-in | Resident/check-in/actual-center tenant equality, active center, resident-only semantics, online authoritative confirmation |
| G09 Medical | Signed-in resident only, actual/null prior-dose date, authoritative result/error handling |
| G10 Export | Approved versioned inventory, pagination, section errors, household decision, schema validation, no partial sharing |
| G11 Deletion/retention | Approved matrix, auth handling, observable retries, idempotent truthful outcome, deployed audit |
| G12 Moderation | Approved concern visibility, reporting/filtering/blocking applicability, operator contact, escalation, retention |
| G13 Push | If included: package/plugin/new binary, APNs/credentials, sender, preferences, token lifecycle, generic previews, guarded routing |
| G14 Distribution | Bundle ID, scheme, EAS/Apple/App Store Connect ownership, signing, build profiles, TestFlight approvals |
| G15 Household QR processor | Processor and identifier transfer disclosure/approval |
| G16 Medical authorization | Server resident-role and drive-tenant/active enforcement with two-tenant/role tests |

Gate approval requires the named owner role and same-candidate evidence; checking a source file or setting a boolean is not approval.

## 10. Decisions, assumptions, and unresolved questions

The following are not facts until approved. Unanswered items stay fail-closed.

1. **Release slice:** Which capabilities are in the first release? This determines mandatory phases and valid navigation/listing promises.
2. **Documents:** Which services require identity/location verification and which attachments, remediation, review, waiver, payment, and pickup rules apply?
3. **Attachments:** What types, byte limits, metadata stripping, malware screening, and retention rules apply to request and concern files?
4. **Concerns:** What may be anonymous, public, mapped, retained, escalated, moderated, or withdrawn, and what operator contact is available?
5. **Check-in:** Does an approved future contract cover only the resident, every household member, or a selected subset? **Current assumption:** resident only.
6. **Household concurrency:** How are simultaneous resident/admin edits resolved? Last-writer-wins is not approved.
7. **Privacy:** What exact export inventory and lawful retention/deletion matrix define complete outcomes?
8. **Notifications:** What server inbox/read-state contract applies, and is remote push in release scope? **Current assumption:** in-app center first; remote push off.
9. **Maps/content:** Which processors and emergency content sources/owners are approved?
10. **Auth:** Is email confirmation enabled in production, and what scheme/callback/allowlist is approved?
11. **Distribution:** Who owns Apple Developer, App Store Connect, EAS, signing, bundle ID, scheme, and TestFlight decisions?
12. **Device scope:** **Assumption:** iPhone portrait, iOS 16.4+, compact through Pro Max; iPad-native work deferred.

## 11. Current execution record

This is the current snapshot, not acceptance evidence for a release candidate.

| Area | Current status | Evidence limitation |
|---|---|---|
| Phase 0 | Not started | Decisions are listed but not revision-bound or approved |
| Phase 1 | Source present, unverified | 0093/0094 and pgTAP are untracked/unexecuted; document invariant absent |
| Phase 2 | Not started | Existing export/deletion implementations have confirmed defects |
| Phase 3 | Partial implementation | Auth/session shell and primitives exist; design/auth/native acceptance fails or is unverified |
| Phase 4 | Partial implementation, unsafe | Catalog/request insert exists; safeguards/review/uploads/timeline/payment lifecycle absent or gated |
| Phase 5 | Not implemented beyond announcement shell | Concerns, inbox, actionable Home absent |
| Phase 6 | Not implemented beyond gated routes/source guard | No provider/content/device/deployed evidence |
| Phase 7 | Partial read-only/gated shells | Household/ID/medical mutations not accepted |
| Phase 8 | Not started | No EAS profiles, signed candidate, physical device, TestFlight, or same-revision evidence |

Historical local results recorded before this revision—eight iOS tests, iOS typecheck/lint, 93 shared tests, and an Expo production export—are historical only. The historical `expo install --check` failed compatibility recommendations. None of these results is tied to an immutable candidate or substitutes for a clean install, native build, deployed contract test, device run, accessibility session, or TestFlight qualification.

The release checker currently fails for `IOS_BUNDLE_IDENTIFIER`, `IOS_URL_SCHEME`, `EAS_PROJECT_ID`, Supabase URL, anon key, barangay ID, and all 13 source gates. Keep those failures until their required evidence exists.

## 12. Review traceability map

| Review locator | Concrete plan response |
|---|---|
| F1 - Required document-request safeguards are bypassed | Sections 4-5 account-scoped drafts, verification, attachments, review, idempotent/reconciled submission, authoritative receipt, and testable upload/duplicate criteria; Phase 4 |
| F2 - Service requests do not enforce document-type tenancy | Section 5 table-boundary invariant and no-side-effect two-tenant tests; Phase 1 |
| F3 - Account deletion does not meet release prerequisite | Section 5 approved inventory, explicit retention, auth handling, retryable/observable cleanup, truthful idempotent status; Phase 2 |
| F4 - Export can return partial data as complete | Section 5 versioned inventory, pagination, section errors, schema validation, forced-failure criteria; Phase 2 |
| F5 - Launch experience remains absent/unavailable | Section 1 release-scope decision; Sections 2 and 6 retained flows/states; conditional Phases 4-7 |
| F6 - Backend corrections are untracked/unexecuted | Sections 1, 5, 7, and 11 require ordered deployment, direct tests, environment identity, and rollback evidence |
| F7 - Production/native evidence absent | Sections 1, 3, 7-9 and 11 keep gates closed and require clean CI, signed builds, devices, TestFlight, and same-candidate evidence |
| F8 - Tokens/navigation not implemented | Sections 2 and 4 encode exact navigation, tokens, component extensions, and rendered acceptance; Phase 3 |
| F9 - Status/copy/cancellation conflicts | Section 5 provides the iOS mapping, server history/instructions, named confirmation, and stale-rejection criteria; Phase 4 |
| F10 - Auth/deep-link behavior unresolved | Sections 5 and 10 retain the decision and require matching confirmation/recovery/deep-link tests; Phases 0 and 3 |
| F11 - Rendered/accessibility/device conformance unverified | Section 8 defines representative states, matrix, measures, and evidence identity; Phases 3 and 8 |
| F12 - Living record is stale/misleading | Sections 1 and 11 preserve the historical baseline while giving every phase one truthful current status; same-candidate evidence rule throughout |
