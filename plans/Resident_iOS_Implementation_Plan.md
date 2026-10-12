# Barangayan Resident iOS Implementation Plan — Revision 1.2

**Revision date:** October 12, 2026

**Target document:** `plans/Resident_iOS_Implementation_Plan.md`

**Objective:** Deliver a production-ready iPhone application with complete functional parity against the current resident Android application, plus the iOS adaptations specified below.

## 1. Authority, scope, and completion standard

The revised plan becomes the controlling iOS implementation specification. The Android source establishes existing resident capabilities; shared contracts and deployed backend behavior establish authorization and data semantics; the iOS design handoff supplies visual and accessibility requirements except where this revision explicitly supersedes it.

Replace the September 27 baseline with a dated inventory of the current commit, relevant uncommitted changes, dependency lockfile, Android routes, iOS implementation, shared contracts, migrations, and available evidence. Preserve previous findings and results as historical records. Revalidate each finding before carrying it forward as a current defect.

The repository now contains migrations through `0112`. New migrations must use the next unused sequential four-digit prefix after the highest repository prefix at implementation time. Never reuse a pending number, renumber pushed migrations, or assume that locally present migrations are deployed.

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
2. Passing behavior, authorization, failure-recovery, accessibility, and native-device evidence.
3. Production configuration and operating ownership.
4. Evidence identifying the exact app build, source revision, backend contract, and environment.

A disabled gate, route placeholder, successful JavaScript export, or passing typecheck does not establish feature completion.

## 2. Traceability, navigation, and resident workflows

Add three appendices to the revised document:

- **Parity ledger:** one row per Android route, workflow, modal, preference, native integration, and resident-visible outcome.
- **Contract catalogue:** every table, RPC, Edge Function, storage bucket, realtime subscription, and shared schema consumed by those workflows.
- **Acceptance catalogue:** test identifiers linked to parity rows, phases, release gates, and evidence.

Each parity row records the Android source locator, implementation state, iOS destination, disposition, dependency, acceptance test, and owner. Distinguish working, partial, defective, placeholder, obsolete, and unreachable Android behavior.

### Navigation contract

Declare all six destinations statically. Preserve nested stack state, list position, search/filter state, authorized deep-link restoration, and appropriate tab-reselection behavior.

Qualify six destinations and native More overflow in an early signed SDK 57 build. Test direct links into overflow destinations, Settings navigation, return paths, accessibility, state restoration, and foreground/background transitions. Failure of this qualification blocks the navigation milestone; it must not silently trigger a different tab architecture.

Native tabs expose one system badge per destination. Preserve Android’s three independent Reports signals inside the Reports hub as labeled counters:

- Active reports.
- Unread resolved reports.
- Unread announcements.

The Reports badge represents unread resolved reports plus unread announcements; active reports remain a separate operational count. Preserve access to these signals when Reports is inside More through the Home summary and Reports hub.

The six-destination decision supersedes the handoff’s five-tab recommendation. Preserve its remaining tokens, component behavior, safe-area, accessibility, and content rules.

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
| Push | Notification plugin, EAS project/APNs credentials, token lifecycle, signed release delivery tests. |

Read the exact [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and each package’s versioned page before implementation. Qualify the root lockfile and generated native configuration without upgrading unrelated workspaces.

## 4. Implementation sequence and acceptance evidence

Use an **IOS-** phase prefix to distinguish this roadmap from the cancelled Android phase.

| Phase | Deliverable and exit |
|---|---|
| IOS-0 — Baseline and contracts | Current source/evidence inventory, complete parity and route/modal ledgers, resolved engineering defaults, named external owners, and requirement/test identifiers. |
| IOS-1 — Native foundation | Compatible SDK 57 lockfile, signed development build, six destinations/More, tokens, appearance controls, secure lifecycle, native capability proof. |
| IOS-2 — Authentication | Email/Google/Apple, account setup, verification, recovery, provider-aware compatible contracts, sensitive-action server enforcement. |
| IOS-3 — Backend safeguards/privacy | Current migration reconciliation, tenant invariants, concurrency, storage, complete export, truthful deletion, retention and compatibility tests. |
| IOS-4 — Services | Complete catalogue-to-fulfillment journey, activity/history, payment/pickup, QR/PDF exports and fault recovery. |
| IOS-5 — Reports/Home | Four report views, read controls/counts, concerns, corroboration, withdrawal, announcements and actionable Home. |
| IOS-6 — Maps/emergency/health | Equivalent map/list/content, household/QR, online check-in, medical calendar/registration/history. |
| IOS-7 — Notifications/information | Operating inbox/outbox/push, preference/token lifecycle, Help, Terms/Privacy, About/version and content governance. |
| IOS-8 — Release qualification | Complete parity evidence, clean CI, production signing/configuration, accessibility/performance, TestFlight and operating readiness. |

Backend and client work may proceed independently after their contracts are fixed. A dependent feature cannot close before its authoritative backend evidence passes.

### Mandatory tests

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

Retain G01–G16, refresh their descriptions, and add gates for complete parity, provider authentication, list/persistence behavior, diagnostics, and App Store compliance. Map each source feature flag to its gate and acceptance evidence. Keep diagnostic preflight distinct from release approval.

Require development/simulator, registered-device, staging and App Store build profiles. Build with SDK 57’s supported Node/Xcode baseline; inspect the generated production binary for bundle ID, schemes, capabilities, environment, permissions and secrets.

Add explicit release artifacts:

- Privacy manifests, required-reason API/dependency review and App Privacy disclosures.
- Discoverable account deletion, retention copy and privacy-policy/support URLs.
- Apple authentication and revocation evidence.
- Public-content moderation/filter/report/block applicability and operating ownership.
- Age rating, encryption/export compliance, icon/splash/assets/licenses and screenshots.
- Reviewer account, sample QR, payment instructions and accessible backend.
- Symbolicated native/JavaScript crash diagnostics, redaction rules, release identifiers and alerts.
- Operational dashboards for failed mutations, uploads, payments and notification delivery.
- TestFlight results, staged rollout, feature kill switches, backend-compatible rollback and support runbook.

Keep OTA updates disabled for the first production release. Changes ship through signed binaries until a separately approved runtime-version and rollback policy exists.

External facts remain explicit prerequisites rather than invented defaults: Apple/EAS ownership, identifiers, provider credentials, payment settlement, service verification rules, lawful retention, map processors, published support details and moderation staffing. Assign each prerequisite an owner and required evidence; missing evidence blocks the applicable gate.

### Final completion checklist

- [ ] Every current Android route, workflow, modal, preference and integration is represented.
- [ ] Six destinations and native More behavior pass signed-device qualification.
- [ ] Email, Google and Apple authentication and account management pass.
- [ ] Services, payments, Reports/corroboration, Maps/emergency, Health and Settings pass complete journeys.
- [ ] Appearance, information content, read-state controls, logs and exports are preserved.
- [ ] Inbox and reliable remote notification delivery operate with named ownership.
- [ ] Backend authorization, concurrency, pagination, storage and privacy tests pass.
- [ ] All deployed migrations and contract versions are recorded.
- [ ] All temporary/private state is protected and cleaned correctly.
- [ ] Accessibility, visual behavior and performance pass supported-device testing.
- [ ] App Store, signing, provisioning, privacy and reviewer artifacts are complete.
- [ ] The exact production candidate passes CI, physical-device testing and TestFlight.
- [ ] Every parity row and release gate has evidence or an explicitly approved correction for defective Android behavior.
- [ ] Remaining issues contain no unresolved Critical/High release blocker.
- [ ] Rollback, incident response and resident support have accountable owners.
- [ ] The completion statement identifies the final build and describes any approved behavioral differences accurately.
