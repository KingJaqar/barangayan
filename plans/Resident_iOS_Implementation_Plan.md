# Barangayan Resident iOS Implementation Plan

Date: September 25, 2026

**Recommendation:** Create a separate, iOS-only Expo SDK 57 application at `C:\Users\User\barangayan\apps\resident-ios-mobile`. Reuse `@barangayan/shared`, existing Supabase contracts, and selected resident business logic. Build an iPhone-focused interface with native iOS navigation and controls, and replace the existing session-storage and device-integration implementations where necessary.

Propose **iPhone, portrait orientation, iOS 16.4 and later** for launch. Device scope and feature prioritization remain provisional because the repository does not establish iOS product requirements.

The applicable [AGENTS.md](../AGENTS.md) and the **exact SDK 57 documentation** were read. The exact documentation was available. Its published baseline is React Native 0.86, React 19.2.3, Node.js 22.13.x minimum, and Xcode 26.4 or later. No other SDK’s documentation was substituted. [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)

This is a source-based assessment and implementation plan. During the review, no application files were modified, dependencies installed, or applications built or tested. Live Supabase configuration, payment settlement, Apple credentials, and physical-device behavior remain unverified. Saving this plan is a documentation-only change.

**Implementation readiness:** Ready with the targeted prerequisites and contract corrections identified below. The SDK 57 application foundation can begin after Phase 0 records the decisions and owners, but household editing, evacuation check-in, medical registration, data export and release cannot be accepted until their stated dependencies pass the corresponding contract tests.

## 1. Codebase assessment

The reference application is already a React Native/Expo application, despite its Android-specific directory name. Its [package manifest](../apps/resident-android-mobile/package.json) declares Expo `^57.0.10`, React Native `0.86.2`, Expo Router, Supabase, and `@barangayan/shared`. This makes selective reuse practical.

The repository uses npm workspaces for `apps/*` and `packages/*`. The [shared package exports](../packages/shared/src/index.ts) include database/domain types, validation schemas, categories, roles, themes, request-status logic, geographic utilities, and map-message contracts.

The existing [mobile README](../apps/resident-android-mobile/README.md) is primarily template documentation. The [codebase research paper](<../barangayan project paper/Barangayan Codebase-Centered Research Paper - Revised.md>) provides useful context but does not establish binding iOS launch priorities.

Repository links in this document are relative to this file so they remain usable when the repository moves. Line numbers are review-time references and may shift as implementation proceeds.

| Area | Verified implementation and implications |
|---|---|
| Navigation | Six custom tabs: Home, Services, Maps, Health, Reports, Settings. Reports has three distinct indicators. Authentication, registration, recovery, and guest access are controlled through protected route groups. See [AppTabs](../apps/resident-android-mobile/src/components/app-tabs.tsx), line 19, and [RootNavigator](../apps/resident-android-mobile/src/app/_layout.tsx), line 114. |
| Onboarding/authentication | Welcome/value proposition/personalization/completion, account choice, email/password login, registration, password recovery with OTP, and password reset. No social-login implementation was found. |
| Resident profile | Structured identity and demographic fields, contact/address information, ID images and verification state, household members, avatar, and location verification. Registration uses a barangay boundary check; a separate settings flow handles location verification. |
| Home/emergency | Emergency information, hotlines, evacuation centers, alerts, family/household information, QR guidance, scanning, and check-in. Some content has bundled fallback data. |
| Services | Document catalog, application form, supporting ID upload, requests/logs, request details, payment-method selection, QR Ph payment, pickup payment instructions, cancellation, and PDF receipt sharing. |
| Maps | Incident and evacuation-center markers, location selection, boundary handling, search/geocoding, route display, and distance calculations. Implemented with Leaflet inside React Native WebView. |
| Health | Medical-drive calendar/list/filtering, registration, registration status, and server-calculated prioritization. This is not a HealthKit integration. |
| Reports | Announcements, incident submission with photos/location/category, own reports, incident details, confirmation/withdrawal, and unread/status indicators. |
| Settings | Profile, location verification, password change, appearance/font preferences, notification preferences, help articles, terms/privacy/about, personal-data export, and account deletion. |
| State | React contexts and custom hooks for authentication, profile, notifications, theme, fonts, unread counts, and feature data. Supabase Realtime updates several screens. No central Redux-style store is required to reproduce this structure. |
| Persistence | Supabase sessions and a full cached profile use AsyncStorage. Emergency information and pending check-ins also use local persistence. Some settings persist to the profile. |
| Device features | Foreground location, camera QR scanning, image/file selection, image saving, QR capture, PDF generation/sharing, telephone links, notification permission/token registration, and WebView messaging. |
| Branding | Green-led palette, light/dark appearance, accent preferences, decorative typography, and Barangayan logo assets. Some splash/icon assets remain Expo template artwork. |
| Build readiness | No committed native iOS project or EAS configuration was found. The app configuration contains an iOS camera description, but lacks a complete iOS identity, permission, signing, and release setup. See [app.json](../apps/resident-android-mobile/app.json). |

Important distinctions between implemented behavior and apparent features:

- **Authentication storage needs adaptation.** The current [Supabase initialization](../apps/resident-android-mobile/src/lib/supabase.ts), line 15, uses AsyncStorage. The shared [client factory](../packages/shared/src/lib/supabase-client.ts), line 5, already accepts a storage adapter, so iOS can introduce secure storage without changing its public contract.
- **Logout does not guarantee immediate local cleanup.** [logout](../apps/resident-android-mobile/src/hooks/use-auth.tsx), line 91, sets guest mode and races sign-out against a timeout; it does not explicitly clear the session in the timeout path. The iOS implementation must guarantee local sign-out independently of network success.
- **Cached profile data is not account-scoped.** [use-profile](../apps/resident-android-mobile/src/hooks/use-profile.ts), line 12, uses a fixed `resident_profile` cache key. Do not carry this behavior into the iOS app.
- **Payment amounts are server-authoritative.** [create-payment-source](../supabase/functions/create-payment-source/index.ts), line 14, derives fees and creates/resumes payment records. Preserve this design.
- **Pickup payment has a client/server mismatch.** The [pickup screen](<../apps/resident-android-mobile/src/app/(app)/services/payment/pickup/[requestId].tsx>), line 59, attempts a direct payment insert, while [payment RLS hardening](../supabase/migrations/0017_harden_payments_rls.sql), line 1, removes resident insertion rights. The iOS implementation should use the existing payment-method RPC and authoritative reads; staging must establish the expected pickup workflow.
- **Offline check-in is incomplete.** [checkIn and syncPendingCheckins](../apps/resident-android-mobile/src/hooks/use-qr-checkins.ts), line 51, queue any insert error and later clear the whole queue even when individual retries fail. No caller of the synchronization function was found. Reliable offline check-in is not an established capability.
- **Remote notification delivery is not established.** [push-notifications](../apps/resident-android-mobile/src/lib/push-notifications.ts), line 47, registers tokens, and [use-notification-realtime](../apps/resident-android-mobile/src/hooks/use-notification-realtime.ts), line 21, presents local notifications from live events. No server push sender was found. Token storage alone does not provide background delivery.
- **Several controls are incomplete.** The SMS preference is local state, the service search field is not connected to filtering, and the Maps preparedness/hotline routes are placeholders. Real emergency content exists elsewhere and can serve those iOS journeys.
- **Account deletion is a release dependency.** The current endpoint anonymizes selected fields and permanently bans the auth account. It does not delete the auth record, and the anonymization predates newer personal-data fields. See [deletion function](../supabase/functions/delete-my-account/index.ts), line 62, and [anonymization RPC](../supabase/migrations/0074_account_deletion.sql), line 44.
- **Household profile edits can erase evacuation attendance.** The profile flow writes `profiles.household_members`; its database trigger deletes and recreates the corresponding `household_members` rows with identity fields only. Existing `is_checked_in`, center and timestamp values are lost for retained members. See [profile household writes](../apps/resident-android-mobile/src/hooks/use-profile-household-members.ts), line 86, [the sync trigger](../supabase/migrations/0067_fix_household_members_uuid_sync.sql), line 20, and [attendance fields](../supabase/migrations/0046_household_members.sql), line 4.
- **Same-tenant evacuation validation is not enforced by the insert contract.** The scanner compares the QR payload's claimed `barangay_id` with the resident profile, while the insert policy checks only the submitted check-in row's barangay. Neither verifies that `evacuation_center_id` belongs to that barangay. See [scanner validation](../apps/resident-android-mobile/src/components/qr-scanner-overlay.tsx), line 47, and [check-in RLS](../supabase/migrations/0045_evacuation_center_checkins.sql), line 25.
- **The medical applicant selector exceeds the resident RPC contract.** The existing screen lets the user select a household member, but `register_for_drive` always records `auth.uid()` and has no household-member parameter. The screen also sends `2025-01-01` as a placeholder prior-dose date for every second-dose/booster choice, and that value is persisted and affects server scoring. See [medical registration screen](<../apps/resident-android-mobile/src/app/(app)/health/register.tsx>), lines 273 and 384, and [registration RPC](../supabase/migrations/0035_medical_drives.sql), line 142.
- **The data export can report success with missing or truncated sections.** The Edge Function does not fail when an individual query fails, maps missing results to empty arrays, and does not paginate collections. It also omits canonical household attendance rows. See [export function](../supabase/functions/export-my-data/index.ts), lines 57–100, and the API `max_rows` setting in [Supabase config](../supabase/config.toml), line 18.
- **Repository CI is below the SDK 57 Node baseline.** The existing workflow uses Node 20 even though SDK 57 requires Node 22.13.x or later. The iOS work must update the root install/check runtime as well as add iOS-specific checks. See [CI workflow](../.github/workflows/ci.yml), line 11.

## 2. Provisional feature-parity matrix

“Launch” below is a proposed iOS baseline, not a documented product commitment.

| Resident capability | Reuse | iOS implementation/adaptation | Proposed scope |
|---|---|---|---|
| Onboarding and guest access | Copy, branding, guest-access rules | Native screens; preserve access to public information and protect personal actions | Launch |
| Login, registration, recovery | Supabase Auth calls and shared schemas | Keychain-backed sessions, native autofill/OTP input, explicit recovery state, reliable local logout | Launch |
| Profile and household | Existing fields and validation; household identity fields only after sync correction | Accessible forms, native image selection, secure temporary files, explicit verification state; preserve attendance for retained member IDs | Launch after household sync correction |
| Location verification | Boundary rules and existing persistence contract | Foreground Core Location through Expo; manual selection and permission-denied recovery | Launch |
| Document services | Catalog, request schema, status derivation, cancellation RPC | Native list/detail/form flows; working search; preserve fee and document requirements | Launch |
| Pickup payment | Existing payment-method RPC and request state | Pickup instructions and server-confirmed status; omit the denied direct insert | Launch, after contract verification |
| QR Ph payment | Existing Edge Functions, payment polling and Realtime | Resume pending payment, expiry/cancel handling, server-confirmed success, QR save/share | Launch only after settlement and end-to-end verification |
| Receipts | Receipt content and payment records | Native PDF generation/share; reload authoritative payment before producing a paid receipt | Launch with payments |
| Incident reporting | Categories, tenant rules, incident calls, upload limits | Photo selection, location picker, upload progress/recovery, confirmation and withdrawal | Launch, subject to moderation/privacy review |
| Announcements and unread state | Existing queries and unread logic | Native feed; retain separate active/resolved/announcement counts within Reports | Launch |
| Map and evacuation discovery | Map data, bridge schema, polygon/distance logic | Hardened WKWebView/Leaflet implementation; provider approval and accessible list alternative | Launch |
| Emergency hub/hotlines | Existing emergency-information contracts | Consolidate placeholder destinations onto real content; native telephone actions | Launch after content-owner approval |
| Evacuation QR check-in | QR schema and UI flow; server insert contract requires tenant hardening | Camera permission on demand, duplicate-scan prevention, resolve the actual center and enforce resident/check-in/center tenant equality server-side | Launch after tenant-invariant verification |
| Reliable offline check-in | Some queue concepts only | User-scoped queue and server-supported idempotency would be required | Later; explicit backend dependency |
| Household QR and sharing | Authenticated QR endpoint and existing payload | Native image display/share/save; preserve distinction from evacuation-center QR | Launch |
| Medical drives | Filters, self-registration RPC and server scoring | Native calendar/list/forms, consent, status and capacity/error handling; self-only registration and actual/null prior-dose date | Launch; household applicants excluded unless a backend contract is approved |
| Appearance/help/privacy/export | Existing preference IDs and content; export endpoint requires completeness hardening | iOS typography and controls, system share sheet, temporary-file cleanup; explicit failure for incomplete export and pagination for collections | Launch after export contract verification |
| Account deletion | Existing user-facing flow and endpoint name | Preserve entry point; depend on complete server deletion/approved retention behavior | Launch requirement; blocked until resolved |
| In-app/foreground alerts | Existing Realtime subscriptions and preferences | Lifecycle-aware subscriptions, unread refresh, truthful notification settings | Launch |
| Remote push | Token table/RPC already permits `ios` | APNs credentials, sender, routing, token lifecycle and delivery validation | Conditional launch; otherwise later |
| SMS preference | No functional delivery found | Do not display an operational SMS toggle without a real service | Excluded until defined |

Do not infer appointment booking from an unused schema field, delivery from retired data-model concepts, or HealthKit/Apple Calendar access from medical-drive screens. These are not verified resident capabilities.

## 3. Architecture and repository decisions

### Separate iOS application, shared contracts

Use a new workspace package named provisionally `@barangayan/resident-ios`. The repository already supports additional application workspaces through its [root manifest](../package.json).

| Decision | Recommendation | Main alternative and tradeoff |
|---|---|---|
| Application boundary | Separate iOS application | Reusing the existing application directly reduces duplication, but couples navigation, dependencies, configuration, and releases to its current consumers. A separate app better enforces this request’s iOS-only scope. |
| Shared code | Import existing schemas, types, constants, status rules and geographic utilities from `@barangayan/shared` | Extracting a new shared “resident application core” immediately would broaden the change surface before iOS requirements are validated. |
| Feature logic | Adapt selected hooks into iOS-local feature modules with small API repositories | Importing files from the other application creates an implicit application-to-application dependency and should be avoided. |
| State | Retain contexts for session/preferences and focused hooks for feature state | Introducing a new global state framework is not justified by the current workflows. |
| Navigation | Expo Router native stacks and five native tabs; Settings accessible from a consistent profile/settings button | Six custom tabs preserve the current badge layout exactly but provide less room on compact iPhones. |
| Maps | Retain Leaflet within a hardened WKWebView for launch | Native Apple Maps would improve native map interaction but requires rebuilding polygon selection, marker behavior, routing presentation and bridge logic. |
| Native project | Expo configuration/plugins with generated iOS native project | Maintaining a hand-edited native project adds maintenance before any verified custom native requirement exists. |

Selective duplication of feature hooks is an accepted initial tradeoff. Keep their backend calls explicit and covered by contract-focused tests so they do not drift silently.

The proposed directory layout is rooted at **`C:\Users\User\barangayan\apps\resident-ios-mobile`**:

| Proposed location | Responsibility |
|---|---|
| `src/app` | Thin Expo Router route files; authentication group, five tab stacks, settings stack, modal routes |
| `src/features/auth`, `profile`, `services`, `reports`, `maps`, `emergency`, `health`, `settings` | Feature screens, hooks, validation orchestration and presentation |
| `src/data` | Supabase queries, RPC/Edge Function adapters, response normalization and error classification |
| `src/lib` | Supabase client, secure session adapter, app lifecycle, cache scoping and configuration validation |
| `src/platform` | Camera, image/file handling, notifications, PDF/share, telephone links and map bridge |
| `src/components`, `src/theme` | Shared iOS components, semantic colors, spacing and typography |
| `assets` | Approved Barangayan artwork, fonts if retained, boundary data and bundled Leaflet resources |
| `tests`, `e2e/ios` | Contract/state tests and iOS journey automation |
| `app.config.ts`, `eas.json`, `.env.example` | iOS identity, permissions, environments and build profiles |

These are proposed files and directories; none were created as part of this review.

### Shared-code boundary

Reuse the current [shared exports](../packages/shared/src/index.ts) without changing their signatures. In particular:

- Keep monetary amounts in the existing centavo representation.
- Preserve [request-status derivation](../packages/shared/src/lib/request-status.ts), line 14: pending payment, paid, processing, ready for pickup, completed, cancelled.
- Preserve QR payload schemas, IDs, category values and RPC parameter names.
- Keep medical prioritization and payment verification on the server.

These reuse rules do not endorse unsafe surrounding workflows. Preserve QR payload shape while validating the referenced evacuation center independently; use the medical RPC only for the signed-in resident; and do not reproduce the household sync or export behavior until the backend corrections below are verified.

No shared-package refactor is required for the initial iOS milestone. If an additive shared helper becomes necessary, document why the iOS app needs it and its possible effects on existing consumers. Root lockfile changes will be necessary when adding the workspace’s dependencies; preserve unrelated package resolutions.

### Routing and iOS presentation

Propose Home, Services, Maps, Health and Reports as native tabs. Put Settings behind a consistently positioned toolbar button. On Reports, display the three existing counts separately; use a single tab badge for unread attention, rather than combining active work and unread content into an ambiguous number.

SDK 57 documents Native Tabs, but the import remains under `expo-router/unstable-native-tabs`. Validate badge updates, accessibility, stack preservation and supported OS appearance during the first native spike. If it fails acceptance, use an iOS-styled custom five-tab component as the contained fallback. [SDK 57 Native Tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/)

Use native stack back gestures, sheets for short selections, and full screens for registration, incident submission and document requests. Protect unsaved forms from accidental dismissal.

### Configuration and dependencies

The proposed application should have:

- `platforms: ['ios']`, `ios.supportsTablet: false`, portrait orientation, and an owner-approved bundle identifier.
- Barangayan-specific icon and splash assets. The existing iOS icon bundle references Expo artwork and must not be copied unchanged.
- Separate development/staging/production environment values and an EAS project owned by the intended organization.
- Public Supabase URL and public client key only in client configuration.
- No Supabase service-role key, PayMongo secret, APNs private key or Apple signing secret in the JavaScript bundle.
- QR Ph settlement disabled unless explicitly verified. The reference environment example’s enabled value is not proof of readiness.
- No copied PayMongo public key unless an actual iOS code path needs it; the inspected payment flow uses server functions.
- A confirmed URL scheme and Supabase redirect allowlist where links are used. Preserve the existing OTP recovery contract; validate actual hosted email templates and auth settings.
- Default Expo Metro configuration first. Do not copy the reference app’s manual workspace resolution and Markdown dependency workaround automatically. Expo supports npm monorepos through its standard configuration. [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/)
- Node.js 22.13.x or later in the repository's existing CI and the new iOS workflow. The current root workflow uses Node 20 and performs the root `npm ci`, so adding only a separate iOS workflow would leave an unsupported SDK 57 install path.

Resolve packages through SDK 57-compatible Expo installation during implementation and commit the resulting versions. This does not require upgrading the reference application.

## 4. iOS experience and platform integration

### iPhone launch scope

Recommend iPhone-only launch because the inspected flows are portrait, single-column resident journeys and no repository requirement establishes an iPad experience. Set `supportsTablet: false`; a native iPad layout is a later product decision. This setting does not by itself establish how Apple may make the iPhone app available in compatibility mode.

Preserve the green palette, Barangayan logo, document terminology, status language and recognizable workflow order from [theme.ts](../apps/resident-android-mobile/src/constants/theme.ts). Use system typography for readable body text and forms; reserve decorative fonts for suitable branding.

Required iOS behavior:

- Safe-area-aware headers, footers, camera overlays and payment actions.
- Dynamic Type, VoiceOver labels, logical focus order and status announcements.
- Statuses distinguishable without color; sufficient contrast in both appearances.
- At least 44-point interactive targets.
- Keyboard avoidance, correct email/phone/password content types, password-manager support and OTP autofill.
- A visible completion action for numeric keyboards.
- Native confirmation dialogs and destructive-action placement.
- Reduced-motion support and no essential information conveyed only by animation.
- Accessible list equivalents for map markers and center selection.
- Payment expiry re-evaluated after foregrounding, rather than trusting a paused timer.

### Dependency and native-configuration verification

“Documented” below means SDK 57 explicitly documents iOS support. It does not mean this repository’s exact combination has passed a native build.

| Integration | Proposed implementation | Permission/configuration and verification |
|---|---|---|
| Native UI | Expo Router stacks/tabs and `@expo/ui` controls for menus, switches, pickers and short sheets | SDK 57 documents SwiftUI support. Use virtualized React Native lists for long feeds. Verify Native Tabs’ unstable API in the initial spike. [Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/) |
| Secure credentials | `expo-secure-store` through the existing storage adapter | iOS Keychain support documented. Test maximum actual session size; no plaintext fallback. Keychain values can survive reinstall, so handle fresh installation deliberately. No biometric gate required for launch. [SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/) |
| QR camera | `expo-camera`, rear camera, QR-only scanning | Configure `NSCameraUsageDescription`; ask when scanning begins. No microphone access is needed. Verify with physical iPhones. [Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/) |
| Location | `expo-location`, foreground requests | Configure `NSLocationWhenInUseUsageDescription`. No background-location mode. Handle denied access, approximate location, stale fixes and manual selection. [Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/) |
| Photo/file selection | `expo-image-picker` and `expo-document-picker`; normalize with `expo-image-manipulator` | Support iOS photo selection and Files. Preserve supported upload formats and size limits; convert HEIC when necessary. Ordinary selected-file access does not justify adding iCloud-container entitlements. [ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), [ImageManipulator](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/) |
| Local files and sharing | SDK 57 `expo-file-system` APIs and `expo-sharing` | Use temporary app files; clean up IDs, receipts and exports after use. Avoid carrying Android content-URI handling into iOS adapters. [FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), [Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) |
| QR save/capture | `react-native-svg`, QR renderer, `react-native-view-shot`, optional `expo-media-library` save | SDK 57 documents SVG and view-shot. Use add-only Photos access where sufficient; configure the corresponding usage description. Share directly without Photos permission. Avoid broader album access for launch. [SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/), [view-shot](https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/), [MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/) |
| Maps | `react-native-webview` using WKWebView | SDK 57 documents version 13.16.1, matching the reference declaration. Remove Android-only props; restrict navigation and validate messages. No native Maps entitlement or Google Maps key is needed for this approach. [WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/) |
| PDFs | `expo-print` and `expo-sharing` | iOS support documented. Inline required image data in generated HTML where local image URLs are unsupported. Verify receipts and exports on a device. [Print](https://docs.expo.dev/versions/v57.0.0/sdk/print/) |
| Notifications | `expo-notifications` | Configure its plugin; remote delivery requires APNs entitlement/credentials and a server sender. Handle iOS authorized, provisional and denied states. Do not enable background notification execution without a defined requirement. [Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) |
| Public caching/connectivity | AsyncStorage for non-sensitive information; NetInfo if reconnect detection is needed | Both have SDK 57 iOS documentation. No Wi-Fi SSID access is needed. Connectivity is a hint, not proof a backend request will succeed. [AsyncStorage](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/), [NetInfo](https://docs.expo.dev/versions/v57.0.0/sdk/netinfo/) |
| Development builds | `expo-dev-client` | Use the application’s own iOS binary for permission, entitlement and notification validation. Expo Go is insufficient as release evidence. [DevClient](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/) |

Compatibility still requiring proof:

- `react-native-qrcode-svg` depends on native SVG, but its upstream documentation does not establish explicit React Native 0.86 certification. Test rendering and image capture; declare SVG directly.
- `react-native-markdown-display` and the reference Metro workaround need an SDK 57 iOS spike. Validate text, links and unsupported markup before deciding whether replacement is necessary.
- Supabase’s React Native guidance supports lifecycle-aware token refresh, but it does not certify this exact dependency set. Validate the secure-storage adapter and foreground/background transitions. [Supabase React Native guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native)

Do not carry unused packages into the new app merely because they appear in the reference manifest. No verified requirement calls for background location, HealthKit, contacts, microphone, advertising tracking, Apple Pay or biometric authentication.

### Map implementation details

The reference [MapView](../apps/resident-android-mobile/src/components/map-view.tsx), line 467, parses bridge messages without runtime schema validation and allows broad WebView origins. For iOS:

1. Bundle pinned Leaflet code/styles with the application.
2. Validate every bridge message, coordinate and identifier against an explicit schema.
3. Restrict navigation and external-resource hosts; never inject a session token into map HTML.
4. Retain boundary snapping and coordinate contracts.
5. Preserve attribution and disclose external map/geocoding/routing requests.
6. Provide list/manual-address fallbacks when providers fail.

The shared [geocoder](../packages/shared/src/lib/geocode.ts) uses public Nominatim, while [routing](../packages/shared/src/lib/osrm.ts) calls the public OSRM service. These are external production dependencies. Public Nominatim imposes application-wide rate limits and other restrictions; public tiles have attribution, caching and usage requirements. [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [tile policy](https://operations.osmfoundation.org/policies/tiles/)

The `foot` URL segment does not establish that the deployed routing service produces suitable pedestrian evacuation routes. Confirm its routing profile and service suitability before presenting walking instructions. Label straight-line fallback distances clearly.

## 5. Backend contracts, security and data handling

### Preserve the existing business rules

| Flow | Contract to preserve | iOS acceptance requirement |
|---|---|---|
| Document request | `service_requests` insertion and existing request schema | Valid ownership/tenant fields, supported document ID, successful upload linkage and useful validation errors |
| Payment method | `set_service_request_payment_method(p_request_id, p_method)` | `pickup`/`qrph` remain the existing values; no resident payment-row insertion |
| QR Ph lifecycle | `create-payment-source`, `check-payment-status`, `cancel-payment` | Resume pending payment, reconcile after reconnect, and show success only from authoritative payment state |
| Request cancellation | `cancel_own_service_request` | Respect server rules for paid, processing/completed and cancelled records |
| Incident actions | Existing incident insert, `confirm_incident`, `withdraw_incident` | Preserve tenancy and status rules; no blind mutation retries |
| Medical registration | `register_for_drive` for the signed-in resident | Do not show a household applicant option without a new approved contract; send an actual prior-dose date or null; show server score/status/applicant number |
| Evacuation check-in | Existing tables and payload shape after server tenant hardening | Resolve the referenced center and enforce resident/check-in/center tenant equality; distinguish a confirmed check-in from an unsuccessful request |
| Household QR | Authenticated `generate-household-qr` | Own-profile authorization and correct payload type |
| Household editing | Existing identity fields after sync correction | Preserve attendance/center/timestamp fields for retained IDs; insert new members and delete only removed members |
| Privacy actions | Existing endpoint names after export/deletion hardening | Reauthentication where required, complete outcome reporting and local cleanup; never label a partial export complete |

Relevant implementations include [payment orchestration](../apps/resident-android-mobile/src/hooks/use-paymongo-source.ts), [medical registration](<../apps/resident-android-mobile/src/app/(app)/health/register.tsx>), line 438, and [pickup/cancellation RPCs](../supabase/migrations/0082_remove_delivery_add_pickup.sql).

### Contract corrections required before feature acceptance

These are narrow corrections to shared backend behavior. They do not require a new resident application core or a general backend rewrite, but the dependent iOS features must not be declared complete before they pass the stated checks.

#### Household editing and evacuation attendance

Treat the canonical `household_members` rows as the source of attendance state. Replace the current delete-and-recreate synchronization behavior with reconciliation by member ID:

1. Update identity fields for retained member IDs without overwriting `is_checked_in`, `checked_in_at`, `checked_in_center_id` or `checked_in_center_name`.
2. Insert genuinely new members with attendance defaults.
3. Delete only IDs removed from the profile household list.
4. Define how concurrent admin and resident edits are detected or reconciled; never silently reset attendance.

Acceptance requires a database integration test that checks in household members, then renames, adds and removes members through the resident contract. Retained members must keep their attendance and center fields; removed members must be deleted; unchanged JSON must not reconstruct rows.

The product owner must also decide whether scanning one evacuation-center QR marks the resident only, every household member, or a selected subset. The current client bulk-updates every household row and does not populate its center or timestamp fields. Until that decision is recorded, the iOS flow should confirm only the resident check-in and must not claim household members are present.

#### Evacuation-center tenant invariant

Do not trust `barangay_id` from a QR payload as proof of the center's tenancy. On submission, resolve the referenced `evacuation_centers` row and enforce on the server that:

- the authenticated resident owns the check-in;
- the submitted check-in barangay equals the resident's current barangay;
- the referenced center belongs to that same barangay; and
- the center is active and not deleted when the check-in is created.

Implement this as one authoritative insert/RPC or an equivalent database constraint/trigger that all clients must pass. Client schema validation and friendly preflight errors remain useful but are not the security boundary. Test valid scans, forged payloads whose claimed barangay is correct but whose center belongs elsewhere, direct authenticated inserts, and inactive/deleted centers. A rejected check-in must not update household state.

#### Medical applicant and dose data

The existing resident RPC is a self-registration contract: it always records `auth.uid()` and allows one registration per signed-in user per drive. Therefore the initial iOS flow must register only the signed-in resident. Do not copy the existing household applicant selector unless product and backend owners approve a new applicant identity, authorization, uniqueness and privacy contract.

Collect the real prior-dose date when the drive/form requires it, or send null when no prior dose applies. Never copy the fixed `2025-01-01` placeholder. Verify that the displayed applicant is the persisted owner and that actual/null dates round-trip and produce the documented server score.

#### Personal-data export completeness

Before calling an export complete, define its required dataset inventory with the privacy/backend owner. At minimum, the implementation must:

- check and propagate every section-query error instead of converting failure to an empty result;
- paginate collections beyond the configured API row limit;
- include canonical household rows and attendance if they are within the agreed export scope;
- return an explicit failed or incomplete outcome when any required section cannot be produced; and
- let the client share a file only after the response passes the expected contract/schema.

Test fixture counts and representative fields against the exported result, including more than one page and a forced section-query failure. This plan does not infer legal completeness; the agreed inventory is the acceptance source of truth.

### Authentication and local data

- Store session credentials in Keychain using the existing adapter boundary.
- Test session sizes using realistic signup metadata. If storage-size limits are encountered, design and test a bounded secure representation; do not silently fall back to AsyncStorage.
- Start/stop token refresh with application lifecycle; maintain one auth listener.
- Treat logout as an immediate local security transition. Clear session state, credentials, private caches, queued personal operations and sensitive temporary files even when remote revocation fails.
- Unregister the current device token while authenticated where possible. The existing unregister helper relies on an in-memory cached token and is not wired into logout.
- Keep personal profile and health data in memory for launch unless a concrete offline requirement justifies encrypted persistence.
- Scope public emergency caches by tenant and content version; expose freshness. The current [emergency cache](../apps/resident-android-mobile/src/lib/emergency-cache.ts), line 3, is not tenant-scoped.
- Handle Keychain persistence across reinstall with an explicit fresh-install policy.
- Keep guest access separate from authenticated session state; a guest flag must never make a retained session appear signed out.

### Uploads and privacy

The source currently accepts up to five incident photos, with a 10 MB per-image limit, and a 5 MB supporting-ID limit. Preserve server bucket constraints after conversion; validate actual file bytes and MIME type.

Incident images and profile avatars use public storage arrangements, while the latest [ID storage migration](../supabase/migrations/0073_id_documents_private_again.sql), line 17, makes ID documents private. Therefore:

- Use signed/authenticated access for ID images.
- Make incident-photo visibility clear before upload.
- Avoid logging signed URLs, image contents, OTPs, tokens or personal form data.
- Remove unnecessary image metadata where feasible and verify the result.
- Clean temporary files and roll back uploaded files when record creation fails; account for partial multi-image upload failure.
- Do not claim that deleting a local image removes an already uploaded public copy.

The app handles identity/contact information, precise location, photographs, household details, health/disability information, service requests and payment records. Its privacy disclosure must reflect the actual transfers, including map providers and backend processors. Audit native SDK privacy manifests and required-reason API use rather than copying blanket declarations. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/), [Expo privacy manifests guidance](https://docs.expo.dev/guides/apple-privacy/)

### Account deletion: external release prerequisite

Apple requires an in-app account-deletion path for apps that create accounts; account deactivation alone is insufficient. [Apple account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

The inspected implementation bans the auth user and clears only selected profile fields. It also performs best-effort storage cleanup. Before iOS release, the backend owner must establish and verify:

- Removal of the authentication account and associated personal data, except documented lawful retention.
- Treatment of newer structured identity/address/location fields, household data, uploads and related records.
- Complete cleanup or a monitored retry mechanism for failed storage deletion.
- An idempotent result the iOS app can display accurately.

This is a **verified iOS release requirement that may require backend implementation changes**. Preserve the existing endpoint where possible. Such a change affects all consumers of deletion, so it requires explicit backend ownership and compatibility review; it does not expand this plan into other application work.

### Errors, reconnects and offline behavior

Use bounded retries for safe reads, clear expired-session recovery, and actionable handling for permission denial, rate limits and service outages. On foreground/reconnect, refresh active requests, payment state, health registrations and unread counts.

Do not automatically retry ambiguous writes: a timed-out request may already have committed. Reconcile by querying server state first.

Launch emergency check-in should be online-confirmed. Reliable offline submission would require idempotency beyond the current timestamp-based uniqueness in [check-in migration](../supabase/migrations/0045_evacuation_center_checkins.sql), line 15. That enhancement remains separate.

### Notifications and user-generated content

Foreground Realtime events cannot guarantee background emergency alerts. Settings must describe the actual available behavior.

If remote push becomes a launch requirement, add an explicit dependency for a server sender, event selection, APNs credentials, token cleanup, preference enforcement and authorized deep-link routing. Existing [push-token infrastructure](../supabase/migrations/0063_push_notifications.sql), line 1, can be reused.

Incident information is visible beyond its author through maps. Determine how applicable user-generated-content safeguards—reporting, filtering, blocking and operator contact—are supplied. No complete abuse-reporting/blocking contract was found. This is an App Store readiness question, not permission to invent an unrelated moderation system. [App Review Guidelines, §1.2](https://developer.apple.com/app-store/review/guidelines/)

## 6. iOS testing and release plan

### Supported device proposal

Test the minimum supported iOS 16.4 environment and the latest stable iOS version available when implementation begins, plus representative intermediate versions where runtimes/hardware are available. Include:

- Compact iPhone/SE-class layout.
- Standard notched or Dynamic Island iPhone.
- Large Pro Max-class layout.
- Large accessibility text, dark appearance, reduced motion and VoiceOver.
- Physical devices for camera scanning, location accuracy, photo selection, notification permissions, background/resume behavior and sharing.

The current Windows workstation can initiate remote iOS builds, but local iOS simulator work requires a Mac. Secure access to a Mac with Xcode 26.4 or later and available test runtimes, or a suitable remote Mac environment. Obtain physical iPhones early. EAS builds run on macOS infrastructure. [EAS iOS build process](https://docs.expo.dev/build-reference/ios-builds/)

### Verification layers

| Layer | Required evidence |
|---|---|
| Pure logic/contract tests | Request-status mapping, centavo handling, QR validation, upload validation, tenant boundaries, medical payload mapping, export response validation, error classification and session cleanup |
| Component tests | Guest restrictions, permission-denied states, validation, loading/empty/error states, payment confirmation rules and accessible labels |
| Staging integration tests | Auth/recovery, RLS ownership, file access, pickup workflow, QR Ph lifecycle, incident actions, household attendance preservation, forged center-tenant rejection, self-only medical registration, paginated/failure-aware export and deletion |
| Simulator journeys | Navigation/back behavior, keyboard/forms, Dynamic Type, appearance, lifecycle refresh and deep-link authorization |
| Physical-device journeys | Camera/QR, approximate/denied location, Photos/Files, saving/sharing, foreground/background notifications and reconnect behavior |
| Release-candidate validation | Signed production-mode build, correct environment, no template assets, accurate privacy metadata, no secrets/log leakage, all launch acceptance criteria |

Essential end-to-end acceptance scenarios:

1. A guest can browse permitted information but cannot submit personal transactions.
2. Registration, login, OTP recovery and password change work against the intended environment.
3. Account A logs out offline; neither its session nor profile appears after restart or login as account B.
4. A resident submits a document request and follows it through supported statuses.
5. QR Ph payment handles app termination, expiry, reconnect and cancellation without falsely reporting payment.
6. Pickup selection succeeds without a prohibited payment insert.
7. Incident submission handles partial uploads, denied location and server failure without false success.
8. A valid same-tenant evacuation QR succeeds; malformed payloads, another tenant's payload and a forged payload claiming the resident's barangay while referencing another tenant's center fail safely. Rejected scans do not mutate household state.
9. Household identity edits preserve attendance and center/timestamp state for retained members; the chosen resident/household check-in semantics are reflected accurately.
10. Medical registration identifies the signed-in resident as the persisted applicant, sends an actual or null prior-dose date, displays server results and handles duplicate/capacity/eligibility errors. No household applicant is offered without an approved backend contract.
11. Export returns every agreed dataset across multiple pages and fails explicitly when a required section query fails; deletion produces a verified outcome and both flows complete required local cleanup.
12. Every permission can be denied without trapping the resident in an unusable screen.
13. Emergency content remains clearly dated and provider outages do not produce misleading route guidance.

### Signing and release configuration

Create iOS-only EAS profiles for simulator development, registered-device development, and App Store distribution. TestFlight and final App Store distribution should use the same release configuration; promote the tested build where practical.

External prerequisites:

- Apple Developer Program membership and an authorized account owner.
- Approved bundle identifier and App Store Connect application record.
- Signing certificate/provisioning access, managed through EAS or organization policy.
- EAS organization/project access and build capacity if EAS is selected.
- App Store Connect submission credentials.
- APNs credentials if remote push is included.
- Staging and production backend access, test accounts and payment test facilities.

Prepare iPhone screenshots, app description, age rating, support/privacy URLs, review contact, review account/instructions, export-compliance answers and accurate privacy labels. Provide reviewers a way to exercise location/QR/payment-gated workflows.

TestFlight upload is distinct from App Store submission and approval. Use internal testing first, then external testing where required. [Expo iOS submission](https://docs.expo.dev/submit/ios/), [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

Apple currently requires uploads to use Xcode 26 or later with the iOS 26 SDK or later; SDK 57’s Xcode 26.4 minimum is stronger. Recheck submission requirements before release. [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)

The inspected fees appear to purchase document services fulfilled outside the app. Keeping QR Ph rather than adding in-app purchase is a reasonable inference under Apple’s rules for such services, but confirm against the actual launch catalog. [App Review Guidelines, §3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/)

## 7. Ordered implementation backlog

Effort is relative: **S** bounded configuration/discovery, **M** a focused feature area, **L** several interacting workflows or native/backend dependencies. These are not calendar estimates.

Every new application path below belongs to the proposed `C:\Users\User\barangayan\apps\resident-ios-mobile` workspace. The bounded exceptions are the shared backend contract corrections and the existing root CI runtime needed to support SDK 57. No phase includes application development or release work for another platform.

| Phase | Concrete tasks and affected locations | Prerequisites/dependencies | Deliverable and acceptance criteria | Effort / principal risk |
|---|---|---|---|---|
| **0. Establish iOS contract baseline** | Record launch decisions, environment matrix, route inventory and API fixtures in proposed `docs/ios-contracts.md`. Verify staging migrations, auth email behavior, tenant selection, pickup flow and settlement state. Record self-only medical registration unless explicitly expanded; define the export dataset inventory and household check-in semantics. Assign household-sync, evacuation-tenant, export, deletion, moderation and map-service owners. | Backend access and product/operational contacts | Reviewed contract checklist separates confirmed launch flows from external blockers. No unverified capability represented as complete. Owners and acceptance fixtures exist for every required backend correction. | **S–M**; live deployment may differ from repository |
| **1. Create iOS foundation and native spike** | Add package/configuration, route shell, branding, development build, default Metro setup, SDK 57 dependencies and secure-session adapter. Exercise Native Tabs, WebView, QR/SVG capture, Markdown and native UI. Align the existing root CI and new iOS workflow to Node 22.13.x or later and add explicit iOS typecheck/test steps. Locations: root of proposed app, `src/app`, `src/lib`, `src/platform`, `assets`; root lockfile; existing and proposed workflows under `C:\Users\User\barangayan\.github\workflows`. | Phase 0 basics; Mac access; signing for device build | Clean root install and existing/new workspace checks pass on the selected supported Node runtime. Simulator and physical iPhone development builds launch with Barangayan branding. Critical dependency spikes pass or have a documented contained fallback. Dependency changes are limited to the new workspace and required CI runtime. | **M**; native compatibility, CI and signing |
| **2. Complete account and resident shell** | Onboarding, guest rules, login/register/recovery, profile/household, password change, settings entry, secure logout, preference mapping and location verification. Correct household synchronization to reconcile by member ID and preserve attendance for retained members. Locations: `src/features/auth`, `profile`, `settings`, `src/lib`, route groups and the narrowly scoped household backend contract. | Phase 1; working SMTP/OTP and tenant-selection contract; household-sync owner and fixtures | Authentication and recovery pass; offline logout/restart/account-switch tests prove no retained personal data; forms work with keyboard and accessibility text. Household rename/add/remove integration tests preserve attendance/center/timestamp fields for retained members. | **L**; tenant ambiguity, auth lifecycle and household consistency |
| **3. Deliver services and payments** | Catalog/search, application uploads, request details/statuses, pickup RPC flow, cancellation, QR Ph resume/polling/reconciliation, receipt share. Locations: `src/features/services`, `src/data`, `src/platform/files` and PDF adapter. | Phase 2; verified pickup contract; payment environment | End-to-end request and pickup journeys pass. QR Ph enables only after successful pending/paid/expired/cancelled tests. UI never trusts route parameters as proof of payment. | **L**; settlement and ambiguous payment states |
| **4. Deliver reports and map discovery** | Announcements/unread state, incident create/detail/confirm/withdraw, image normalization/cleanup, map bridge validation, local Leaflet assets, provider handling and accessible lists. Locations: `src/features/reports`, `maps`, `src/platform/maps`, map assets. | Phase 2; provider decision; moderation/privacy assessment | Incident and map journeys pass on compact/large iPhones; denied location and provider failures have usable recovery; bridge rejects malformed input. | **L**; provider reliability and public image exposure |
| **5. Deliver emergency workflows** | Hub/content, hotlines, centers, family state, household QR, scanner, online check-in and save/share. Add one authoritative backend check that resolves the center and enforces resident/check-in/center tenant equality plus active/non-deleted state. Apply the Phase 0 resident/household attendance decision; consolidate placeholder routes. Locations: `src/features/emergency`, camera/QR adapters, public cache and the narrowly scoped check-in backend contract. | Phases 2 and 4; approved emergency content; completed household-sync correction; recorded attendance semantics | Physical-device check-in succeeds against staging; malformed, duplicate, other-tenant, forged-center and inactive/deleted-center attempts fail safely; direct authenticated insert/RPC tests prove the tenant invariant; unsuccessful writes never update household state or appear confirmed. | **L**; safety-critical content, tenant isolation and household consistency |
| **6. Deliver health and resident information** | Medical-drive calendar/filter/detail/self-registration/status, consent, help/about/privacy content, appearance preferences and data export. Collect an actual/null prior-dose date; omit household applicants unless a new contract is approved. Harden export error handling and pagination against the agreed dataset inventory. Locations: `src/features/health`, `settings`, `src/data`, PDF/share adapter and the narrowly scoped export backend contract. | Phase 2; medical fixtures and approved content; recorded applicant scope; export inventory and backend owner | Persisted applicant is the signed-in resident; actual/null dose dates and server score/status are shown unchanged; registration error cases work. Export fixture counts and fields match across multiple pages, a required-section failure cannot produce a success result, and temporary files are removed. | **M–L**; sensitive-data correctness and export completeness |
| **7. Close privacy and notification gates** | Foreground alerts, lifecycle/unread refresh, settings truthfulness, token cleanup, privacy manifests, deletion integration and data-retention checks. Remote push only if committed to launch. Locations: `src/platform/notifications`, `src/lib`, `src/features/settings`, app configuration. | Phases 3–6; completed deletion dependency; notification scope; APNs/sender if included | Deletion passes an agreed data audit; no misleading SMS/push controls; privacy declarations match actual behavior; authorized notification routing passes if enabled. | **L**; external backend/compliance dependencies |
| **8. Qualify and release iOS** | Execute device/OS acceptance matrix, resolve release blockers, create signed candidate, run TestFlight pilot, prepare listing/review evidence and submit. Locations: `tests`, `e2e/ios`, `eas.json`, iOS CI and release checklist. | All launch gates complete; Apple access; approved metadata | Release candidate passes agreed journeys and privacy gates, pilot findings are resolved, and the tested build is ready for App Store review. | **L**; hardware coverage and review findings |

Dependency order is principally **0 → 1 → 2 → feature phases → 7 → 8**. Services, reports/maps and health can proceed independently after the account foundation. Emergency check-in depends on the map/location and household foundations.

External backend work is limited to explicitly identified dependencies:

- **Required before dependent feature acceptance:** household reconciliation that preserves attendance; server-enforced resident/check-in/center tenant equality; failure-aware paginated export matching an agreed dataset inventory.
- **Required for iOS release:** compliant account deletion/retention behavior.
- **Conditional:** notification sender if remote push is a launch commitment; moderation capabilities if existing operational controls do not satisfy the public-content experience.
- **Conditional:** a medical household-applicant contract only if product requires residents to register other household members. The launch default is self-registration only.
- **Later only:** an idempotent contract for reliable offline check-in.
- **Investigate before changing anything:** pickup payment reconciliation. A client fix using the existing RPC may be sufficient.

## 8. Unresolved questions

“Blocking” identifies the gate it blocks; several items do not prevent the initial iOS foundation work.

| Classification | Question | Consequence or provisional assumption |
|---|---|---|
| **Blocking — integrated testing** | Which Supabase environment reflects the intended production migrations, RLS and email templates? Who supplies test residents and operational fixtures? | Source code alone cannot establish deployed behavior. |
| **Blocking — device distribution/release** | Who owns the Apple Developer account, bundle identifier, App Store Connect record and EAS project? | Required for signing and distribution. |
| **Blocking — release** | What retention policy applies to resident, health, incident and payment records, and who will complete account deletion? | The current ban/anonymization flow is insufficient evidence of compliant deletion. |
| **Blocking — public incident release** | What moderation, abuse-reporting and user-blocking arrangements apply to the incident experience? | Determine applicable controls before releasing resident-visible contributed content. |
| **Blocking — QR Ph activation** | Is the merchant account approved and settlement operational? What is the authoritative pickup-payment workflow? | Keep QR Ph disabled until verified; resolve pickup behavior against staging. |
| **Blocking — emergency/map launch** | Who approves hotline/guidance/center content, and which map, geocoding and routing services are authorized for production? | Do not ship unapproved seed guidance or imply verified walking safety. |
| **Blocking — household editing acceptance** | Who owns the household sync correction, and how are concurrent resident/admin edits reconciled? | Do not accept profile household editing while retained-member attendance can be reset. |
| **Blocking — emergency check-in acceptance** | Does one scan check in only the resident, every household member or a selected subset? Who owns the server tenant-invariant correction? | Until decided, record only the resident check-in. Do not claim household presence; do not accept check-in until forged cross-tenant center references are rejected server-side. |
| **Blocking — health phase if household registration is required** | Must residents register household members for medical drives? | Default to signed-in-resident-only registration. A household requirement adds an applicant identity, authorization, uniqueness and privacy contract before Phase 6. |
| **Blocking — export acceptance** | Which datasets and fields constitute a complete personal-data export, and who owns that inventory? | Do not label or share a result as complete until required sections are failure-aware, paginated and verified against the agreed inventory. |
| **Nonblocking** | iPhone only or native iPad support? | Assume iPhone-only launch, portrait, iOS 16.4+. |
| **Nonblocking** | Must the original six-tab layout be preserved exactly? | Assume five native tabs and a Settings toolbar entry, retaining all feature destinations and distinct report counts. |
| **Nonblocking** | Which barangay is the initial deployment, and can residents choose among several? | Assume the existing pilot barangay, explicitly configured and validated. Do not select an arbitrary first database row. |
| **Nonblocking** | Are remote background alerts mandatory at launch? | Assume in-app/foreground alerts initially. If mandatory, the sender/APNs work becomes a launch blocker. |
| **Nonblocking** | Is reliable offline check-in required? | Assume confirmed online check-in at launch, with clear offline messaging. |
| **Nonblocking** | What localization scope is expected? | Preserve existing approved language/content; defer additional localization until specified. |
| **Nonblocking** | Must all existing font preferences have identical rendering? | Preserve preference meaning where possible, with accessible iOS font mappings and system-font fallback. |

## First actionable iOS development milestone

Produce a signed SDK 57 iPhone development build with Barangayan branding, guest navigation, secure login, a read-only service catalog and an authenticated read-only profile screen. Align root and iOS CI with Node 22.13.x or later. The milestone is complete when the clean root install and iOS checks pass, and cold launch, background/resume, expired-session recovery, offline logout and account switching pass without exposing a previous resident’s data. Household mutation remains gated by the sync correction. This establishes the iOS foundation before payment, reporting, household or emergency mutations are introduced.
