# Phase 0 prerequisite and external-owner register (P00-T05) — 2026-10-13

Facts below are either **established** (with the source that shows them) or **open prerequisites** that block a named later phase/gate. No credential, policy or external approval has been invented.

**Owner of every open prerequisite: `KingJaqar`** (decision-register OD-01, user choice 2026-10-13). Ownership means the item has an accountable person; it does not supply the missing evidence. Each open item still needs the listed evidence before its blocked phase or gate can exit.

## Resolved

| ID | Prerequisite | Resolution |
|---|---|---|
| PR-00 | Named owners and approvers for every phase lead role (plan §4.2), every G01–G22 approval role (plan C.3) and the Phase 0 proposals. | Resolved 2026-10-13: `KingJaqar` holds every role and approval until delegated (OD-01); Phase 0 proposals approved (OD-02). Recorded on every row of `../execution-ledger.csv`, `parity-ledger.csv`, `route-ledger.csv` and `modal-ledger.csv`. |
| PR-16 | Owner-attended Android behavior captures (P00-T06). | Resolved 2026-10-14: owner supplied `contexts/Barangayan Resident Android — Screens.pdf` (195 pages); indexed and reviewed in `android-captures/`. Remaining gaps moved to PR-21. |

## Open prerequisites (owner: `KingJaqar`)

| ID | Prerequisite | Current evidence | Required evidence | Blocks |
|---|---|---|---|---|
| PR-01 | Environment classification: which Supabase project is staging vs production. | One project, `Barangayan` (`pwjbucnyqexiepoinoke`), is visible and is the configured URL for both Android and iOS `.env`. No separate staging project found. | Owner statement plus a staging project (or an approved alternative) before destructive/two-tenant hosted tests. | G01; P03 hosted tests; P20 |
| PR-02 | **Not required — OD-06 (2026-10-14), no signed builds.** Apple Developer team, App ID and bundle identifier, Sign in with Apple and Push Notifications capabilities, provisioning. | `app.config.ts` reads `IOS_BUNDLE_IDENTIFIER` (unset). No `ios.usesAppleSignIn`, no notifications plugin. | Apple team ID, approved bundle ID, enabled capabilities, profiles. | G14; P01-T02; P04-T03; P17 |
| PR-03 | iOS URL scheme, Google OAuth iOS callback/redirect allowlist, universal-link decision. | `IOS_URL_SCHEME` unset; Android scheme is `barangayan`. Local `supabase/config.toml` only allows `127.0.0.1` redirects; hosted Auth settings not inspected. | Approved scheme/callback URLs added to hosted Auth allowlist by its owner. | G01/G18; P01-T02; P04-T03 |
| PR-04 | **Not required — OD-06 (2026-10-14), no signed builds.** EAS project ownership and build profiles (simulator/development/device/staging/production). | `EAS_PROJECT_ID` unset; no `apps/resident-ios-mobile/eas.json`. | EAS project ID, owner and approved profiles; build-secret handling. | G14; P01-T01/T02 |
| PR-05 | **Not required — OD-06 (2026-10-14), no signed builds or device runs.** macOS build host with Xcode 26.4+ (or approved EAS cloud builds) and physical iPhones on iOS 16.4 and a current iOS. | This workstation is Windows 11; no Xcode. Simulator/device builds cannot run here. | Named build route and device matrix. | P01 signed build; every device-evidence task |
| PR-06 | Supabase Apple provider configuration, Apple token revocation credentials. | Local `config.toml` `[auth.external.apple] enabled = false`. Hosted provider state not inspected. | Hosted provider enabled by its owner with server-held secrets; revocation path for deletion. | G18/G11; P03-T03; P04-T03; P18-T05 |
| PR-07 | *(OD-06: the APNs key/Expo push credential part is not required; the server sender/outbox operator and on-call owner remain required.)* APNs key, Expo push credentials, server sender/outbox operator and on-call owner. | Android has `upsert_push_token`/`push_tokens` (B18); no sender/outbox/receipt processor exists. | Credentials in server secret storage; named operations owner. | G13/G20; P17 |
| PR-08 | QR PH settlement qualification for iOS (PayMongo processor, webhook signing, reconciliation owner). | Android `.env.example` sets `EXPO_PUBLIC_QRPH_SETTLEMENT_READY=true`; plan C.3 states Android's flag is not iOS/backend evidence. `paymongo-webhook` v8 deployed with `verify_jwt=false` (expected for a provider webhook; signature checks unverified). | Processor approval, settlement records, webhook/replay/idempotency evidence, payments owner. | G05; P10 |
| PR-09 | Barangay pickup/collection operations owner. | `start_pickup_payment` exists (Android). Staff collection evidence not gathered. | Named owner and staff reconciliation procedure. | G06; P10 |
| PR-10 | Map tiles, geocoding and walking-route processors with attribution/transfer disclosure. | At baseline `packages/shared/src/lib/osrm.ts` used a public demo endpoint (`foot` profile); it was deleted by uncommitted work on 2026-10-14 in favor of the offline routing pack (PR-20); `geocode.ts` uses Nominatim; Android loads OpenStreetMap tiles. None approved for production. | Approved processors, attribution, rate/traffic policy, privacy disclosure, walking-profile suitability. | G07; P12-T02; P13-T06; P14-T04 |
| PR-11 | Household QR processor. | `supabase/functions/generate-household-qr/index.ts` sends the profile UUID to `api.qrserver.com`. | Approved disclosure or qualified local generation. | G15; P15-T05 |
| PR-12 | Emergency content, hotlines and guidelines publisher (DRRM owner, review date, escalation contacts). | Content comes from `emergency_information`/`emergency_qr_content` and bundled seed fallback; no named publisher. | Named DRRM owner and dated approved content. | G07; P13-T03/T07 |
| PR-13 | Public concern visibility and moderation policy/staffing. | Incident tables/realtime exist; no policy record. | Approved visibility, filter/report/block, escalation and retention; moderation owner. | G12; P11–P13; P18 |
| PR-14 | Retention/deletion matrix and complete export inventory. | `delete-my-account` v1 and `export-my-data` v1 deployed; plan B19/B20 say they are baselines, not complete. | Privacy-owner-approved matrix and versioned export inventory. | G10/G11; P03-T07; P18-T04/T05 |
| PR-15 | Service verification rules (which services need which evidence), catalogue/charter publisher, SLA/operations owner. | Charter/pricing/SLA contracts exist in shared code and migrations `0095`–`0101`; operational rules are data, not documented policy. | Catalogue owner, verification/appeal rules, SLA owner. | G04/G17; P07–P09 |
| PR-17 | Support contacts, privacy-policy/support URLs, legal content publisher, App Store reviewer account and sample QR. | Not present in iOS config or content inventory. | Published URLs/contacts, reviewer account owner. | G21; P18-T03/T07; P20-T03 |
| PR-18 | iOS development configuration. | `apps/resident-ios-mobile/.env` sets only the Supabase URL/public key and two unused PayMongo/QR PH values; `EXPO_PUBLIC_BARANGAY_ID` and `EXPO_PUBLIC_ENVIRONMENT` are missing, so `readConfiguration()` fails and the app shows its "Barangayan is unavailable" screen. | Owner-supplied tenant ID and environment for development builds. The tenant UUID must come from the tenant owner, not be copied from seed data by assumption. | P01-T04 bootstrap qualification |
| PR-19 | Font licensing for Arial, Helvetica Neue, Verdana, Trebuchet MS, Georgia, Times New Roman on iOS (system-provided vs bundled). | Plan §6.6 maps IDs; availability per iOS version not qualified. | Device qualification and license record. | P06-T04; G22 |
| PR-20 | Triage of post-baseline Android changes (found 2026-10-14, uncommitted concurrent work). | New routes RD01 `settings/valid-id.tsx` (ID wizard, front photo only) and RD02 `emergency-centers.tsx` (public Centers/offline routes, DRRM routing plan R6); offline routing modules; birthday wheel; `extract-resident-id` and `evacuation-route` Edge Functions; migrations `0115`–`0118`; `osrm.ts` deleted. Captures show the offline route card running. | Decision 2026-10-14 (OD-03): deferred until the Android work is committed. Trigger: the RD01/RD02 files and offline-routing modules are committed. Then, an additive ledger delta: B.2 rows for RD01/RD02, affected A19/A23/A24/A37–A39 checkpoints and §6.8 updates, regenerated ledgers. | P05 (valid ID), P13–P14 (routing/public entry); final G17 |
| PR-21 | Remaining Android captures. | Not in the PDF: R09, R10, R18, R26, R27, R34, R45, R51, R53, populated R05, most modals, RD01/RD02, and dark mode for the 20 captured screens that have light-mode captures only. | Additional captures with the sanitized test account, indexed in `android-captures/captures.json`. | P19-T05 visual comparison |

## Established authoritative facts (for later phases)

| Area | Fact | Source |
|---|---|---|
| Request states | `submitted`, `in_progress`, `ready_for_pickup`, `completed`, `cancelled`; payment derived separately. | Handoff §2; `packages/shared` status derivation |
| Concern states | `open`, `in_progress`, `resolved`, `withdrawn`, `unresolved`. | Handoff §2 |
| File limits | Supporting files JPEG/PNG/WebP/PDF ≤ 5 MiB, max 10; ID images ≤ 5 MiB image-only; concern photos ≤ 10 MiB, max 5. | Plan §2, §6.2 |
| Fees | `requestFee` (`packages/shared/src/lib/service-catalog.ts`): ledger amount wins; version-2 never falls back to catalogue fee. | Plan §6.2 |
| Timing models | `legacy_hours` and `agency_minutes_v1` via `service_request_sla_tracking`. | Plan §6.3 |
| Submission | `ResidentSubmissionAttempt` / `submit_service_request` (`packages/shared/src/lib/resident-submission.ts:81`). | Plan §6.2 |
| Account setup | `residentAccountSetupStatusSchema` is strict with `registrationOrigin: email_otp \| google \| legacy` (`resident-account-setup.ts:18`). Apple needs a versioned additive contract. | Plan §2 |
| Location | Shared controller thresholds: 2-minute fix age, 50 m accuracy, 10 s slow, 45 s timeout. | Plan §6.4; `packages/shared/src/lib/device-location.ts` |
| Hosted backend | Migrations `0001`–`0113` applied; nine Edge Functions active. | `hosted-inventory.json` |
| Migration numbering | Next unused prefix was `0114` at baseline. Concurrent work has since added `0114`–`0118` (untracked), so it is `0119` on 2026-10-14. Recheck immediately before writing any migration. | `baseline.json`; AGENTS.md rule |
