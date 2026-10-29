# Resident Android: Account and System Notifications and Announcements Redesign

**Reviewed:** October 27, 2026, Asia/Manila  
**Deliverable:** Current implementation audit, notification coverage, gap analysis, and implementation specification.  
**Scope:** A proposed redesign of the existing Announcements screen. This document does not implement the screen or change notification delivery.

## 1. Current implementation findings

### 1.1 Findings and evidence limits

The current Android Announcements screen is a barangay announcement feed. It does not yet provide Account or System notification views. A durable, recipient-owned notification inbox and delivery worker already exist in the repository, but Android does not consume that inbox in this screen. The proposed Account category includes the resident's document request updates, request-related payment updates, and incident report updates, alongside profile, verification, security, access, and privacy updates.

Findings below come from the current working-tree source, migrations, shared types, and related iOS consumer. They establish repository behavior and intended database contracts; they do not confirm which migrations, worker schedules, credentials, or app builds are deployed. No hosted resident records were queried. Existing working-tree changes, including changes to the Requests list used as a layout reference, were read without modification.

| Area | Confirmed current implementation | Consequence for the redesign |
|---|---|---|
| Screen structure | `announcements.tsx` renders “What's New,” an authenticated unread summary/action, category chips, and `AnnouncementsFeed`. | Remove the “What's New” heading and introduce the four category cards. Keep the existing app-header title “Announcements.” |
| Barangay filters | Shared categories are General, Emergency, Health, and Events; the client adds All. | Preserve these values. All is a filter, not a stored announcement category. |
| Announcement content | Rows show category, icon, title, two-line preview, timestamps, unread styling, and a separate read/unread action. | Preserve content and read controls while adapting the container layout. |
| Announcement details | Opening a row presents a sheet with category, title, timestamps, optional image, and `detailed_description`, falling back to `body`. | Keep this behavior for Barangay items in both All and Barangay views. |
| Read state | `announcement_reads` stores a resident's read markers. Opening an announcement attempts to mark it read. The bulk action currently marks all unread announcements known to the provider, independent of the active chip. | Filter-scoped bulk behavior will be an intentional behavior change. |
| Header bell | `NotificationBell` and the header use `announcementsUnreadCount`. | Account and System items currently cannot affect this badge. A combined Announcements count is required. |
| Feed updates | `useAnnouncements` fetches non-deleted rows, orders by `published_at` descending, subscribes to changes, and supports retry and pull-to-refresh. | Retain refresh behavior and add stable pagination, source isolation, and consistent counts. |
| Announcement links | `announcementId` temporarily forces the existing feed to All, finds the item in fetched rows, and opens its sheet. | Preserve existing links; support fetching an accessible item directly when it is outside the loaded page. |
| Android phone alerts | `useNotificationRealtime` listens to announcement/medical-drive inserts and registration/incident/request updates, then schedules local alerts. | This is an active-client path, not proof of delivery while the app is closed. It can also notify on updates unrelated to a meaningful status transition. |
| Local alert payload | `presentNotification` schedules title/body without a destination or inbox ID. No notification-response handler was found in the inspected Android source. | Add validated tap routing and cold-start handling; current local alerts cannot provide the required routing contract. |
| Push preferences | Android exposes a global push preference on the profile. The SMS toggle is explicitly local-only. | Do not claim SMS delivery or per-category preference controls already exist. Turning phone alerts off must not hide inbox history. |
| Durable backend | Migration 0135 defines private events/outbox/deliveries, public `notification_inbox`, per-kind preferences, deduplication, and worker operations. | Extend this foundation rather than creating an unrelated second private inbox. |
| Existing backend kinds | `request_status`, `payment`, `incident_status`, `announcement`, `medical_drive`, `health_registration`. | Classify existing `request_status` and request-linked `payment` under Account → Document Requests, and `incident_status` under Account → Incident Reports. Other Account coverage and System notices need new accepted kinds. |
| Existing destinations | The stored destination must be exactly version 1, an allowlisted kind, and a UUID. Allowed kinds are request, incident, announcement, drive, and registration. | Account settings, security events, system notices, app updates, and policy destinations require a versioned contract extension. |
| Other consumer | iOS reads `notification_inbox` and validates a strict version-1 destination schema. | Coordinate shared contract changes; extending the database alone will not make new destinations open in existing apps. |
| Separate read models | Migration 0135 explicitly keeps inbox read state independent of `announcement_reads` and report acknowledgments. | Define a bridge for the same announcement across consumers. Do not clear report acknowledgments when clearing this screen. |
| Retention | The existing worker purge removes inbox rows whose `read_at` is over 90 days old. | “All” means all available retained items, not permanent history. Confirm retention for new event kinds. |
| Requests layout reference | `RequestSection` provides collapsible title/count/chevron headers, grouped panels, dividers, natural-height expansion, and reduced-motion support. Empty sections are omitted. | Reuse this presentation pattern. Do not copy the Requests business filters or its overlapping status groups. |

### 1.2 Source reference map

Links identify the inspected local files. Line numbers describe this review snapshot and may shift during implementation.

| Ref | File / component | Relevant evidence |
|---|---|---|
| S01 | [Announcements screen](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/announcements.tsx:12) | Current heading, chips, unread action, `announcementId`. |
| S02 | [Announcements feed](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/announcements-feed.tsx:23) | List, open/read behavior, missing-target state, pull-to-refresh. |
| S03 | [Announcement row](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/announcement-card.tsx) | Row information and manual read/unread control. |
| S04 | [Announcement sheet](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/announcement-modal.tsx) | Full content, image, and description fallback. |
| S05 | [Announcement query](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-announcements.ts) | Sorting, deletion filter, refresh, subscriptions. |
| S06 | [Unread provider](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-unread-counts.tsx:87) | Announcement and report counts, bulk and individual read operations. |
| S07 | [Bell](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/notification-bell.tsx), [header](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-header.tsx:114) | Announcement-only badge and entry point. |
| S08 | [Local alert subscriptions](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-notification-realtime.ts), [templates](C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/notification-templates.ts) | Existing five source-table listeners and message generation. |
| S09 | [Push registration and presentation](C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/push-notifications.ts:47), [preferences](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-notification-preferences.tsx) | Token registration, permission handling, global preference, local alert payload. |
| S10 | [Categories](C:/Users/User/barangayan/packages/shared/src/constants/announcement-categories.ts) | General, Emergency, Health, Events and associated visual metadata. |
| S11 | [Requests sections](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/requests-list.tsx:179) | `RequestSection`, grouped panels, collapse behavior. |
| S12 | [Announcement read schema](C:/Users/User/barangayan/supabase/migrations/0080_reports_unread_counts.sql:16) | Resident/announcement composite key and read timestamp. |
| S13 | [Durable notifications](C:/Users/User/barangayan/supabase/migrations/0135_resident_notifications.sql:20) | Event/inbox/outbox contracts, preferences, triggers, sender, retention. |
| S14 | [Sender entry](C:/Users/User/barangayan/supabase/functions/send-notifications/index.ts), [worker](C:/Users/User/barangayan/supabase/functions/send-notifications/worker.ts) | Server-side sender, generic text and versioned push references. |
| S15 | [Shared inbox types](C:/Users/User/barangayan/packages/shared/src/types/service-foundations.ts:66), [iOS notification model](C:/Users/User/barangayan/apps/resident-ios-mobile/src/features/notifications/model.ts), [iOS API](C:/Users/User/barangayan/apps/resident-ios-mobile/src/data/resident-api.ts:623) | Existing inbox consumers and strict destination validation. |
| S16 | [Account setup contract](C:/Users/User/barangayan/packages/shared/src/lib/resident-account-setup.ts), [Android setup routing](C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/setup-navigation.ts), [profile provider](C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-profile.ts) | Setup eligibility, account boundaries, fresh versus cached profile state. |
| S17 | [Valid ID screen](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx), [ID publication](C:/Users/User/barangayan/supabase/migrations/0118_resident_front_id_submission.sql), [review foundation](C:/Users/User/barangayan/supabase/migrations/0095_phase1_shared_foundations.sql:421) | Versioned evidence, staff approval/failure/revocation, review reason. |
| S18 | [Email verification](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx), [verification function](C:/Users/User/barangayan/supabase/functions/verify-resident-email/index.ts), [profile editing](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx) | Verification and profile email changes. |
| S19 | [Password settings](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx), [password setup](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-password-step.tsx), [recovery](C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/password-recovery.ts) | Existing credential actions and immediate confirmation. |
| S20 | [Location confirmation](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx) | Resident-confirmed map pin; this is not staff residency approval. |
| S21 | [Settings](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/index.tsx), [deletion function](C:/Users/User/barangayan/supabase/functions/delete-my-account/index.ts), [deletion state](C:/Users/User/barangayan/supabase/migrations/0136_account_deletion_state.sql), [data export](C:/Users/User/barangayan/supabase/functions/export-my-data/export-v2.ts) | Push/SMS settings, export, deletion, inaccessible post-deletion inbox. |
| S22 | [Existing screen checks](C:/Users/User/barangayan/apps/resident-android-mobile/tests/reports-announcements-ui.mjs), [Requests UI checks](C:/Users/User/barangayan/apps/resident-android-mobile/tests/services-lists-ui.mjs), [notification backend checks](C:/Users/User/barangayan/supabase/tests/resident_ios_phase17_notifications.test.sql) | Useful regression starting points; not evidence that the proposed design passes. |
| S23 | [Request tracking](C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/request-tracking-screen.tsx), [request route](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/requests/[requestId].tsx), [request status mapping](C:/Users/User/barangayan/packages/shared/src/lib/request-status.ts) | Existing request details, payment/refund presentation, cancellation, and resident-facing status. |
| S24 | [Incident detail](C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/[incidentId].tsx), [refund initiation](C:/Users/User/barangayan/supabase/functions/refund-payment/index.ts), [payment webhook](C:/Users/User/barangayan/supabase/functions/paymongo-webhook/index.ts) | Report lifecycle/withdrawal and request-linked refund stages; notification producer coverage remains narrower than these domain flows. |

### 1.3 Notification boundaries

**Account** includes updates about the resident's identity, profile, verification, credentials, privacy actions, account access, **document requests and their linked payments**, and **incident reports submitted by that resident**. This is the private activity category for the requested design. Services and Reports continue to own their records and actions; Account provides notification entry points into them. Health registrations and evacuation attendance remain outside this category unless separately requested.

**System** means an operational notice about Barangayan: planned maintenance, confirmed disruption, recovery, app compatibility, meaningful app changes, or published policy changes. An event being generated automatically does not by itself make it a System notification.

**Barangay** remains the existing community announcement feed. General, Emergency, Health, and Events are its content categories. Account and System must not be added to the existing announcement category enum simply to fit the new screen.

| Event example | Owner / destination | Included in this screen? |
|---|---|---|
| “Barangay assembly this Saturday.” | Barangay → Events. | Yes, as an existing announcement. |
| “Flood warning for your area.” | Barangay → Emergency, when published as an announcement. Emergency features remain available separately. | Yes, if it is an announcement; do not invent a duplicate System item. |
| “Free vaccination activity announced.” | Barangay → Health if staff publish an announcement. A medical-drive record is a separate Health feature. | Only the announcement belongs in Barangay. |
| “Your clearance is ready for pickup.” | Account → Document Requests; opens Services → the resident's request. | Yes. Reuse the existing request notification instead of creating a second event. |
| “Your payment was received.” | Account → Document Requests; opens the associated request/payment details. | Yes, when linked to the resident's document request. A provider-wide outage belongs under System. |
| “Your streetlight report was resolved.” | Account → Incident Reports; opens the resident's incident report. | Yes. Notification read state remains distinct from Reports' resolved acknowledgment state. |
| “Your medical drive registration was confirmed.” | Health → registrations. | No. |
| “Your household checked in at an evacuation center.” | Evacuation attendance / emergency feature. | No. This is attendance, not account identity. |
| “Your household information was changed.” | Account → Profile, if a meaningful change was persisted. | Yes; exclude routine unchanged saves. |
| “Barangay hall is closed for a holiday.” | Barangay → General. | Yes as Barangay; it is not app downtime. |
| “QR Ph checkout is temporarily unavailable.” | System → Service Status. | Yes, for residents affected by a confirmed app/payment integration disruption. |

## 2. Complete Account notification coverage

### 2.1 Status and channel legend

Every Account scenario below is **missing from the current Android Announcements inbox UI**. Some request/payment/report scenarios already have durable backend producers and inbox entries. Their classification and Android presentation are the missing pieces. The status column distinguishes those cases from missing producers and future workflows:

- **P — Partial:** The underlying action/state exists, but Android Account presentation is missing. Unless a row explicitly identifies an existing producer, the durable event producer is also missing or needs confirmation.
- **M — Missing:** No supporting end-to-end workflow was established in the inspected sources; it needs new implementation or confirmation.
- **C — Conditional:** A sensible future scenario, enabled only if the supporting product feature is introduced.
- **Context only:** Show immediate feedback in the relevant flow; normally do not create a permanent inbox row.

Channel recommendations: **Inbox** = retained Account entry; **Push** = optional phone alert subject to permission/preferences; **Flow** = in-context message or required step; **Email** = a separately implemented secure communication channel. Existing OTP email functionality is not proof that arbitrary security or deletion email templates are available.

### 2.2 Setup, profile, and verification

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Current status / recommended channel |
|---|---|---|---|---|---|
| A01 / Profile | First successful account setup reaches the usable state; emit once. | Account owner. | **Your account is ready** — “You can now use Barangayan with your resident account.” | Existing `/settings`; show current verification status without implying ID approval. | P, S16. Inbox; no default push. |
| A02 / Profile | Required profile details remain incomplete after an abandoned setup, under a defined reminder policy. | Eligible incomplete resident with an actual profile. | **Complete your profile** — “Add your missing personal details before submitting a request or report.” | `/settings/profile`, routed through current setup guards. | P. Flow first; optional Inbox, at most one unresolved reminder. No inbox-only dependency while setup blocks access. |
| A03 / Profile | Resident saves a meaningful contact/address/name change, or authorized staff changes resident details. | Owner of the changed profile. | **Your profile was updated** — “Your resident details changed. Open your profile to review them.” | `/settings/profile`. | P for resident edits; confirm each staff edit path. Inbox for sensitive/staff changes; routine edits use Flow. |
| A04 / Profile | Staff requests a correction with an explicit resident-visible reason. | Resident whose details need correction. | **Review your resident details** — “Barangay staff need you to review your address. Open your profile for details.” | Proposed correction detail → `/settings/profile`. | M. Inbox + optional Push. Needs correction workflow, reason visibility, and resolution state. |
| A05 / Profile | A meaningful household-member/detail change is committed. | Owner of the edited household record; no assumed shared-family delivery. | **Household details updated** — “Your household information changed. Review the saved details in your profile.” | `/settings/profile`, ideally the existing family/household section. | P for household editing. Inbox for staff/other-device edits; Flow for routine self-save. |
| A06 / Profile | A resident saves or replaces their confirmed map pin. | Account owner. | **Home location saved** — “Your selected home location has been saved.” | `/settings/location-verification`. | P, S20. Flow by default; optional Inbox for a material change on another device. Never say “residency approved.” |
| A07 / Verification | A front-ID evidence submission is successfully published and becomes pending. | Submission owner. | **ID submitted for review** — “Barangay staff will review your submitted ID. You can check its status in Valid ID.” | `/settings/valid-id`. | P, S17. Inbox; immediate Flow confirmation already exists. No alert for merely selecting/uploading a photo. |
| A08 / Verification | Authorized review changes the current submission from pending to verified. | Submission owner. | **Your ID is verified** — “Your submitted ID has been approved. Open Valid ID to review your status.” | `/settings/valid-id`. | P. Inbox + optional Push; bind event to the reviewed submission/version. |
| A09 / Verification | Authorized review changes the current submission to verification failed. | Submission owner. | **Your ID needs attention** — “Your ID could not be verified. Open Valid ID to review the reason and submit a replacement.” | `/settings/valid-id`, enhanced to show the authorized review reason. | P. Inbox + optional Push; do not invent a specific rejection reason. |
| A10 / Verification | An approved current submission is explicitly revoked. | Submission owner. | **ID verification changed** — “Your ID verification is no longer active. Review the reason and the next steps in Valid ID.” | `/settings/valid-id`, with current decision and reason. | P: review supports revoked; profile can map this to verification_failed. Use the submission decision to distinguish revocation. Inbox + optional Push. |
| A11 / Verification | A replacement submission is published, replacing the approved/current evidence. | Submission owner. | **Replacement ID submitted** — “Your replacement ID is pending review. Your current status is available in Valid ID.” | `/settings/valid-id`. | P. Inbox; use instead of a duplicate A07 for the same replacement. |
| A12 / Verification | A trusted integrity/repair state requires a new valid submission. | Affected resident. | **Resubmit your ID** — “Your ID record needs an update. Please submit a clear front photo and confirm its details.” | `/settings/valid-id`. | P: repair-aware verification state exists. Inbox + optional Push only after confirmed server state; never infer revocation from a failed profile fetch. |
| A13 / Verification | Email remains unverified after the relevant setup/change flow. | Owner of that email verification state. | **Verify your email** — “Confirm your email address to keep your account details up to date.” | `/settings/email-verification`, or the guarded setup verification step. | P, S18. Flow first; optional one unresolved Inbox reminder. Never store the OTP in the inbox. |
| A14 / Verification | Verification of the current profile email succeeds. | Account owner. | **Email verified** — “Your current email address has been confirmed.” | `/settings/email-verification`. | P. Inbox; no default push. Dedupe by email revision/verification operation without exposing the address in the key. |
| A15 / Verification | Profile email changes and its verification is reset. | Account owner. | **Verify your updated email** — “Your contact email changed. Confirm the new address in Email Verification.” | `/settings/email-verification`. | P. Inbox + Flow; coalesce with A13 for this revision. Keep profile contact email separate from the Auth sign-in email. |
| A16 / Verification | Staff residency approval, rejection, or transfer is introduced as a separate workflow. | Resident undergoing that process. | **Residency review updated** — “Your residency review has an update. Open your account details for the result.” | Proposed residency-review detail. | C. Requires explicit states and review/transfer permissions. Neither an ID approval nor a self-selected map pin proves this feature exists. |
| A17 / Verification | ID expiry is approaching or an ID actually expires. | Owner of an ID with a reliably recorded expiry date. | **Your ID expires soon** — “Check your ID expiry date and submit a replacement when needed.” | `/settings/valid-id`. | C. Confirm expiry data, ID-type applicability, and reminder policy first; do not infer expiry from age of upload. |

### 2.3 Security, access, and privacy actions

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Current status / recommended channel |
|---|---|---|---|---|---|
| A18 / Security | A first password is committed for an eligible passwordless account. | Account owner. | **Password added** — “You can now sign in with your email and password.” | `/settings/change-password`. | P, S19. Inbox + optional security Email; keep current success feedback. |
| A19 / Security | An existing password is successfully changed. | Account owner. | **Password changed** — “Your Barangayan password changed. If this wasn't you, recover your account.” | Proposed event detail with recovery/help actions. | P. Inbox + optional Push/Email. Generate from a trusted completed change, including changes outside this Android screen. |
| A20 / Security | A password reset/recovery is successfully completed. | Recovered account owner. | **Password reset completed** — “Your password was reset. Use your new password the next time you sign in.” | Proposed event detail → account security/help. | P. Inbox + optional Push/Email. Distinguish recovery from ordinary change; emit one event per credential operation. |
| A21 / Security | A recovery request is actually accepted for the owner's account. | Account owner, through an established channel. | **Account recovery requested** — “A password recovery request was made for your account. If this wasn't you, review your account security.” | Proposed security detail. | P for recovery flow; security event pipeline missing. Email first, optional Inbox. Rate-limit; never reveal whether arbitrary entered emails have accounts. |
| A22 / Security | A verified unfamiliar device/session signs in. | Account owner. | **New device sign-in** — “Your account was signed in on a device you haven't used before. Review this activity if it wasn't you.” | Proposed security activity page. | M. Inbox + optional Push/Email. Requires trustworthy device/session history and a review/revoke action. Do not alert on every token refresh. |
| A23 / Security | A trusted security service identifies suspicious activity or revokes sessions. | Affected owner. | **Review your account security** — “We detected activity that needs your attention. Review your account and recovery options.” | Proposed security detail with supported remediation. | M. Inbox + appropriate out-of-band channel; no inference from ordinary sign-in errors. |
| A24 / Security | The Auth sign-in email or linked identity actually changes. | Account owner; old/new addresses only through the verified identity-change workflow. | **Sign-in details changed** — “The sign-in details for your account changed. Review your account security if this wasn't you.” | Proposed sign-in/security settings. | C. Google sign-in and reauthentication exist; a general linking/unlinking UI is not established. This is different from A15 contact-email editing. |
| A25 / Access | A supported account restriction is applied, changed, or removed by an authorized actor. | Restricted/restored owner. | **Account access updated** — “Your account access changed. Review the notice for the reason and available next steps.” | Proposed access notice, accessible even when ordinary signed-in routes are blocked. | C. Existing deletion/forbidden guards do not establish a resident suspension/appeal workflow. Inbox alone is insufficient during a restriction. |
| A26 / Access | Account deletion is accepted, fails before completion, or requires follow-up. | Requesting owner. | **Account deletion needs attention** — “We couldn't complete your deletion request. Please review its status before trying again.” | Existing Settings deletion flow while accessible; proposed support/status page otherwise. | P for deletion process, S21. Flow first. A retained “request received” row is useful only if a real pending period exists. Do not invent a cancellation window. |
| A27 / Access | Account deletion finishes and access is revoked. | Former account owner. | **Account deleted** — “Your Barangayan account has been deleted.” | Post-deletion confirmation/help, outside the private inbox. | P for deletion; Context only after success, optional separately implemented Email. Do not insert an inbox entry the deleted owner cannot read. |
| A28 / Privacy | A resident's requested data export is completed or fails. | Export requester. | **Your data export is ready** — “Your requested account data is ready to download.” | Current Settings export flow; proposed authorized export detail only if made asynchronous. | P, S21. Current flow returns the export and saves/shares it on-device: use Flow. Durable Inbox is C if background export jobs are introduced. |
| A29 / Security | MFA/security factors are enabled, removed, or recovery codes change. | Account owner. | **Account security updated** — “Your sign-in security settings changed. Review them if this wasn't you.” | Proposed security settings. | C. No MFA management flow was established in this review. |
| A30 / Privacy | A formal privacy/access/correction request receives an outcome. | Request owner. | **Your privacy request has an update** — “A response to your privacy request is available. Open the request to review it.” | Proposed privacy request detail. | C. Existing export/deletion actions do not establish a general privacy request case system. |

### 2.4 Document Requests

All entries target the request owner, including a request created on their behalf through a supported staff workflow. Use **Document Requests** as the Account filter. Request-related payment events use the same filter; no separate Payments chip is needed for this scope. Existing `request_status` and `payment` inbox records are reused, not copied into new Account records.

Default destination: existing `/services/requests/<requestId>`. Re-read authorization and current state before offering payment, cancellation, download, or pickup actions. General inbox/push text stays safe; reference number, document type, amounts, reasons, and claim instructions are displayed in authorized details where supported.

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Current status / recommended channel |
|---|---|---|---|---|---|
| A31 / Document Requests | A new request is successfully committed. | Request owner. | **Document request received** — “Your document request was submitted. Open it to check its status and next steps.” | Existing request tracking. | P, S23. Current notification trigger is UPDATE-only and omits submission. Add Inbox producer; keep immediate Flow confirmation, no default push for self-submission. |
| A32 / Document Requests | Requirements review needs resident corrections or additional evidence. | Request owner. | **Your request needs attention** — “Please review the requirements for your document request and provide the requested information.” | Request tracking → authorized requirements/review details. | P for review-related domain data; event producer and complete resident remediation path need verification. Inbox + optional Push only when an actionable committed review exists. |
| A33 / Document Requests | A fee is assessed or materially revised and a payable amount becomes authoritative. | Request owner. | **Payment is needed for your request** — “Your document request has a confirmed fee. Open the request to review the amount and available payment methods.” | Request tracking → supported payment action. | P. Existing 0135 producer does not watch fee assessment. Inbox + optional Push; no estimated or unconfirmed fee claim. |
| A34 / Document Requests | Payment status genuinely changes to paid. | Request owner. | **Payment received** — “Your document request payment was received. Open your request to check the next step.” | Request tracking/payment details. | P: existing durable `payment` producer handles paid for eligible non-owner-initiated updates. Reuse the row; add Android Account presentation and verify actor/path coverage. Inbox + optional Push. |
| A35 / Document Requests | Fee/payment is authoritatively waived. | Request owner. | **No payment is due** — “The fee for your document request was waived. Open the request for its current status.” | Request tracking. | P: existing `payment` producer handles waived for eligible updates. Reuse it. Inbox + optional Push; do not describe an ordinary zero-fee document as a staff waiver. |
| A36 / Document Requests | Request enters in_progress. | Request owner. | **Your request is being processed** — “Barangay staff have started processing your document request.” | Request tracking. | P: existing `request_status` producer. Inbox + optional Push; no guaranteed completion time inferred. |
| A37 / Document Requests | Processing is explicitly paused or resumed with a resident-relevant reason. | Request owner. | **Request processing updated** — “Processing of your document request has an update. Open it to review the reason and next steps.” | Request tracking → current timing/review status. | P for timing/pause data; new producer and resident-visible reason mapping required. Inbox + optional Push for material changes; no alert for every timer refresh. |
| A38 / Document Requests | Request enters ready_for_pickup. | Request owner. | **Your document is ready for pickup** — “Open your request to review the pickup details and any remaining requirements.” | Request tracking → pickup details. | P: existing `request_status` producer. Inbox + optional Push; only display verified pickup hours/location and actual payment conditions. |
| A39 / Document Requests | Request enters completed after the supported completion/release action. | Request owner. | **Your document request is complete** — “Your document request has been marked complete.” | Request tracking/history. | P: existing `request_status` producer. Inbox; optional Push. Do not claim a download or delivery exists unless supported. |
| A40 / Document Requests | Request is cancelled by an authorized staff or resident action. | Request owner. | **Document request cancelled** — “Your document request was cancelled. Open it to review the details.” | Request tracking/history. | P: existing producer handles eligible staff/non-owner updates but skips owner-initiated cancellation. Add self-action history only if required, without duplicating current Flow confirmation. Inbox; Push primarily for staff action. |
| A41 / Document Requests | A real payment/pickup/action deadline approaches under a configured reminder policy. | Owner of the still-actionable request. | **Your request needs a next step** — “Open your document request to review the action needed before its deadline.” | Request tracking → specific supported action. | C. Requires authoritative deadline, scheduler, suppression after action, and occurrence dedupe. No invented deadline or automatic cancellation. |
| A42 / Document Requests | A document request is explicitly declined under a supported decision workflow. | Request owner. | **Your request could not proceed** — “Open your document request to review the decision and available next steps.” | Authorized request decision detail. | C for a distinct rejection decision: do not invent a rejected status where the actual model uses cancellation or requirements review. Use A32/A40 when those are the real outcomes. |
| A43 / Document Requests | A provider-confirmed payment attempt fails or expires and the resident must act. | Owner of the associated request/payment attempt. | **Your payment needs attention** — “Your payment attempt was not completed. Check the request's latest payment status before trying again.” | Request tracking → current payment state. | P for payment-attempt handling; existing durable producer only covers paid/waived. Add a scoped event when useful; transient checkout errors remain Flow. Never equate an expired QR with a confirmed failed debit. |
| A44 / Document Requests | A refund is initiated, needs a supported claim action, completes, or fails according to authoritative refund state. | Request/payment owner. | **Your refund has an update** — “A refund for your document request has an update. Open the request to review its status and any required action.” | Request/payment detail; add authorized claim instructions if needed. | P, S24: refund initiation and webhook flows exist, but 0135 omits refunded/pending/failed refund events. Add distinct stage-aware producers. Inbox + optional Push; initiation alone must not say the money has been returned. |
| A45 / Document Requests | Staff materially changes an existing request's resident-facing requirements, pickup arrangement, or assessed details. | Request owner. | **Document request details updated** — “Details of your document request changed. Open it to review the latest information.” | Request tracking with available change context. | P for request editing; confirm exact supported fields/actions. Add trusted revision-aware producer; coalesce with more specific status/fee notifications to avoid duplicate alerts. |

### 2.5 Incident Reports

Use **Incident Reports** as the Account filter. Notify the original reporter about their own report, rather than every resident able to browse the incident. Public incident warnings remain Barangay → Emergency when published as announcements. Existing `incident_status` inbox rows already represent some of these events and should be reused.

Default destination: existing `/reports/<incidentId>`. Keep sensitive reporter information, exact incident location, attachments, and staff notes out of generic push text. The report detail remains responsible for displaying information the current resident is authorized to see.

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Current status / recommended channel |
|---|---|---|---|---|---|
| A46 / Incident Reports | A new incident report is successfully committed with its actual initial status. | Original reporter. | **Incident report submitted** — “Your incident report was submitted to the barangay. Open it to check its status.” | Existing incident detail. | P. Existing durable producer is UPDATE-only and excludes initial open status. Add Inbox producer if submission history is wanted; preserve Flow confirmation and avoid unnecessary self-action push. |
| A47 / Incident Reports | Report enters in_progress. | Original reporter. | **Your report is being addressed** — “The barangay has started acting on your incident report.” | Incident detail. | P: existing `incident_status` producer handles eligible non-owner updates. Reuse it. Inbox + optional Push. |
| A48 / Incident Reports | Report enters resolved. | Original reporter. | **Your incident report was resolved** — “The barangay marked your report as resolved. Open it to review the update.” | Incident detail with available outcome. | P: existing `incident_status` producer. Inbox + optional Push. Viewing/reading this event does not itself change the operational status. |
| A49 / Incident Reports | Report enters unresolved. | Original reporter. | **Your report was closed as unresolved** — “The barangay closed your report as unresolved. Open it to review the available details.” | Incident detail. | P: existing `incident_status` producer. Inbox + optional Push. Do not describe unresolved as resolved; display a reason only if authorized and recorded. |
| A50 / Incident Reports | Reporter successfully withdraws an eligible report. | Original reporter. | **Incident report withdrawn** — “Your incident report was withdrawn. The barangay will no longer act on it.” | Incident detail/history. | P, S24. Withdrawal and Flow confirmation exist; durable producer excludes withdrawn and owner changes. Optional Inbox history, no default self-action push. |
| A51 / Incident Reports | Staff sends an actionable follow-up, requests evidence, or posts a resident-visible response. | Original reporter, or explicitly authorized participants if a participant model is introduced. | **Your report needs a response** — “The barangay requested more information about your report. Open it to review what is needed.” | Proposed supported follow-up section in incident detail. | C. Do not imply messaging, replies, or attachment resubmission exists until implemented. Inbox + optional Push once supported. |
| A52 / Incident Reports | A supported reopening/reassessment or material staff correction changes what the reporter needs to know. | Original reporter. | **Your incident report has an update** — “The status or details of your report changed. Open it to review the latest information.” | Incident detail, showing actual current state/history. | C for reopening unless allowed by the domain workflow; confirm material editing paths. Add a genuine occurrence/revision producer; current notification trigger excludes a return to open. |

### 2.6 Account events that should stay in context

- Incorrect password, invalid/expired OTP, missing fields, upload/OCR failures, and camera permission denial: show a useful error and retry in the active flow. An OCR failure is not a staff ID rejection.
- A network error or offline cached profile: show that current verification is unavailable. Do not notify the resident that their ID was revoked.
- Normal login/logout and session refresh: no permanent notification. An expired session needs a sign-in prompt, not an unread Account item.
- Theme, font, and ordinary notification-setting changes: immediate feedback only, unless a future trusted security policy identifies a meaningful unauthorized change.
- Failed request/report submission, cancelled pickers, unsuccessful uploads, and client-side validation do not create successful-submission inbox records. Routine incident confirmations, payment polling, and unchanged status refreshes do not generate new notifications.
- “Complete your profile” or “Verify your email” reminders: stop when resolved. Historical entries may remain readable, but their detail must show the current resolved status and must not continue asking for completed work.
- A person without a completed account may be routed into setup before the Announcements screen is reachable. Required setup instructions must remain in that flow; an inbox is an additional history channel.

## 3. Complete System notification coverage

No System notification publishing model or System view was established in the inspected Android/backend notification code. All durable System scenarios below therefore need implementation. Some existing UI capabilities, such as viewing terms/privacy or controlling push settings, can supply destinations.

### 3.1 Operational notices

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Status / recommended channel |
|---|---|---|---|---|---|
| Y01 / Service Status | Authorized operator publishes planned maintenance with a start/end window and affected features. | Residents in affected barangays/platforms; not automatically everyone. | **Scheduled maintenance** — “Barangayan will be unavailable on October 28, 10:00–11:00 PM. Please submit requests before or after this period.” | Proposed System notice detail with affected features and Manila time. | M. Inbox + optional Push before the window; any blocking notice also appears at the affected entry point. |
| Y02 / Service Status | Published maintenance starts, is extended, rescheduled, or cancelled. | Residents in the original or revised audience. | **Maintenance extended** — “Maintenance will continue until 11:30 PM. We'll post an update when service is restored.” | Same maintenance notice/thread. | M. Update incident status; create a new notification only for a material change. Cancel obsolete scheduled alerts. |
| Y03 / Service Status | Monitoring/operator confirms an app-wide outage. | Affected residents. | **Barangayan is temporarily unavailable** — “Some features are unavailable. We're working to restore service.” | Proposed status detail; public/out-of-band fallback if sign-in/backend is down. | M. Inbox when available + operational fallback. Do not promise an unavailable backend can deliver its own outage alert. |
| Y04 / Service Status | Confirmed degradation affects a specific feature: document submission, report uploads, email verification, health registration, maps, or QR scanning. | Residents who use the affected feature/platform/tenant. | **Document requests temporarily unavailable** — “New document requests can't be submitted right now. Please try again later.” | System detail and affected feature, with any verified workaround. | M. Inbox + optional Push for substantial impact; local single-request failures stay in context. |
| Y05 / Service Status | A confirmed payment integration/provider disruption prevents checkout. | Residents eligible to use the affected online payment method. | **Online payments temporarily unavailable** — “QR Ph payments are unavailable right now. Check your request for other available payment options.” | System detail → existing request/payment feature, if alternatives actually exist. | M. Inbox + optional Push. Individual request-linked payment results belong under Account → Document Requests. |
| Y06 / Service Status | A previously announced incident is confirmed resolved. | Original affected audience; newly affected audience if scope changed. | **Document requests are available again** — “You can now submit and track document requests.” | Original notice showing resolved status, with feature action. | M. Inbox + optional Push; link to the original incident. |
| Y07 / Service Status | A planned cutover, data migration, or feature retirement materially affects residents. | Affected feature users/app versions/barangays. | **A service is changing** — “A Barangayan service will change on November 2. Review what you need to do before that date.” | Proposed change notice with an explicit supported action. | C. Publish only for a real planned change; never expose internal migration details without a resident action. |

### 3.2 App changes, policies, and device guidance

| ID / filter | Scenario and trigger | Intended recipient | Suggested title — message | Tap destination | Status / recommended channel |
|---|---|---|---|---|---|
| Y08 / App Updates | A newer supported Android version is released with meaningful benefits. | Android installations below that version, using an authoritative version policy. | **An app update is available** — “Update Barangayan for the latest fixes and improvements.” | Notice → verified app-store listing. | M. Inbox, usually no push. Resolve action when installed; no new row on every launch. |
| Y09 / App Updates | Installed app falls below a formally supported minimum version. | Affected Android installations. | **Update required** — “Update Barangayan to continue using supported online services.” | Required-update prompt + verified app-store listing. | M. Flow is mandatory; Inbox supplementary. Preserve public emergency access where the existing architecture supports it. |
| Y10 / App Updates | A confirmed OS/device requirement changes. | Only incompatible/soon-incompatible installations. | **Device support is changing** — “This Android version will stop receiving Barangayan updates on the date shown in this notice.” | Compatibility notice with supported options/help. | C. Requires published support policy and reliable device/version matching. |
| Y11 / App Updates | A substantial resident-facing feature launches or changes. | Eligible residents/app versions/barangays. | **Household QR check-in is available** — “You can display your household QR code for evacuation-center check-in.” | Existing feature after capability check; otherwise explain the required update. | M as a System notice, even if the feature itself exists. Inbox; restrained push only when justified. Removing the “What's New” heading does not forbid useful feature notices. |
| Y12 / Policies | A published privacy notice changes materially. | Residents covered by that policy version; guests may read the public policy. | **Privacy notice updated** — “Review the updated notice to see how Barangayan handles your information.” | Existing `/settings/terms-privacy`, enhanced to identify the applicable version/change summary. | P for policy destination; M for versioned policy notification. Inbox; explicit acknowledgment only if separately required. |
| Y13 / Policies | Published terms or resident service conditions change materially. | Residents subject to the new version. | **Terms of use updated** — “Review the updated terms and their effective date.” | Versioned terms detail at `/settings/terms-privacy`. | P destination; M versioned publisher/notification. Marking read does not count as agreement. |
| Y14 / Device Settings | The resident has opted into alerts, but this installation's Android notification permission/channel is disabled. | Current installation only. | **Phone alerts are turned off** — “Enable Barangayan notifications in your phone settings to receive alerts on this device.” | Existing Settings plus a new supported action to Android app-notification settings. | P for app push switch; M for complete OS/channel-state reconciliation. Contextual device card by default, not a cross-device durable inbox item. |
| Y15 / Device Settings | Camera/location access prevents the resident from completing a feature. | Resident using that feature on this installation. | **Camera access needed** — “Allow camera access to scan a QR code, or use another available check-in method.” | In-feature permission guidance; Android settings only when needed. | Context only. Do not create an unread item for each denied prompt; mention alternatives only when implemented. |
| Y16 / Device Settings | A downloaded offline resource becomes outdated or an authorized package download completes. | The installation holding that resource. | **Offline information needs updating** — “Connect to refresh the offline information used on this device.” | Existing resource-management flow if available; otherwise proposed. | C. Local device guidance; durable notification only if an actual managed-resource lifecycle is introduced. |
| Y17 / Service Status | A confirmed service incident affects data integrity and residents must review specific information. | Precisely affected residents. | **Please review your saved information** — “A service issue may have affected some saved information. Open this notice for the details and next steps.” | Authorized incident detail with verified scope/remediation. | C. Requires confirmed impact and approved content. A personal security/credential event belongs under Account. |

### 3.3 Publishing and delivery rules

- A System notice needs an authorized publisher, audience, lifecycle status, publish time, effective window, expiry/resolution handling, and a stable notice ID. None should be inferred from arbitrary admin text.
- Suggested lifecycle: draft → scheduled/published → updated/resolved/cancelled → archived. Store revisions so a resident can distinguish the original problem from a later update.
- Target by barangay, platform, supported app capability/version, and other explicitly supported audience attributes. Do not place private information in a public System notice.
- Account inbox history is per resident. Device-specific System guidance is per installation. An Android permission problem must not appear as an unread problem on the resident's other device.
- Suggested delivery: persistent Inbox for meaningful service/update/policy notices; local banners for device/connection guidance; Push only for meaningful timely events. All channels obey their own supported controls.
- A new System notice may use the existing server inbox/outbox foundation after contract extension. A System publisher/scheduler and status-detail source must be implemented first.
- A total outage needs a separately reachable public status/help mechanism if outage communication is a product requirement. Label that mechanism as proposed until available.

## 4. Missing coverage and implementation dependencies

### 4.1 Gap register

| Gap | Evidence / risk | Required response |
|---|---|---|
| G01: Account event generation | Existing `request_status`, `payment`, and `incident_status` kinds cover part of the requested Account scope. Profile/security/verification events and several request/report transitions are not covered. | Reuse existing events for covered transitions; add trusted producers for missing A-series scenarios. Mapping an existing kind to Account does not require creating a duplicate event. |
| G02: System authoring | No scoped System notice lifecycle was established. | Add authorized authoring, targeting, scheduling, revision, resolution, and detail retrieval. |
| G03: Android inbox consumption | Android Announcements queries announcements only. | Include owner request/payment/report inbox rows in Account, add other enabled Account/System kinds, and keep medical-drive/health-registration kinds outside this scope. |
| G04: Destination compatibility | Version-1 destinations cannot identify settings/security/system notices; iOS validates them strictly. | Extend and version destinations, shared parsers, worker payloads, and supported consumers together; provide unknown-version fallback. |
| G05: Duplicate announcement/read state | An announcement can exist as both a shared row and a recipient inbox entry, with independent read markers. | Render it once and bridge its read state; see §4.2. |
| G06: Filtered bulk semantics | Current bulk read ignores the active announcement chip and relies on provider-held IDs. | Implement full-dataset scope-aware counts and bulk mutation, including pagination, new arrivals, and failure handling. |
| G07: Push duplication | A server sender and Android source-table local-alert path can both represent the same event. | Select one alert-delivery owner for each migrated event. Use realtime as invalidation; dedupe by durable event/inbox ID. |
| G08: Reliable taps | Current local alerts carry only title/body; no Android response handler was found. | Add authenticated warm/cold-start routing, pending intent ownership, validation, and replay prevention. |
| G09: Transition accuracy | Android listeners alert on any relevant table UPDATE; ID revocation and replacement need evidence version context. | Generate from actual committed transitions. Do not emit on read-marker changes, unchanged saves, or failed writes. |
| G10: Delayed publication | Existing announcement trigger is INSERT-only and skips future `published_at`; medical-drive INSERT skips inactive rows. The Android feed query itself has no explicit future-publication filter. | Verify intended publish rules, RLS, and scheduler before launch. Specify publish-time visibility/delivery and activation notifications; do not silently treat insert time as publish time. |
| G11: Repeated transition dedupe | Existing request/report keys encode subject ID + status. A later genuine return to the same status can share the original key. | Include the inherited request/report paths in this redesign's event audit. Keys must identify genuine occurrences/revisions while retries reuse the same key. Do not re-emit historical rows just to classify them as Account. |
| G12: Revoked/stale targets | Old notices can refer to deleted announcements, replaced ID evidence, or resolved actions. | Reauthorize on open; retain safe event context where permitted and show current state. A prior approval must not grant current access. |
| G13: Account changes and network races | New sources add late queries, cached private data, and subscription responses. The existing announcement count request has no explicit request-owner sequence guard. | Key resources by resident/tenant/scope; cancel/discard stale results, clear on logout, and remove old subscriptions before showing another account. |
| G14: Offline behavior | Realtime/local presentation is not a durable offline delivery guarantee. | Persist events server-side; reconnect and paginate/refetch after absence. Cached reads are labeled stale; failed read writes remain retryable. |
| G15: Rejection reason UX | ID submissions have review/rejection reason data, but a notification must lead to an authorized display of that data. | Add/reuse readable current submission details in Valid ID. Keep raw ID information/review notes out of lock-screen text. |
| G16: Push preference truth | Android has a global switch, cached-token unregister behavior, and no proven OS-channel-state reconciliation in these files. | Show application preference versus device delivery state accurately; verify logout/offline token cleanup, persistence failure, and physical-device background delivery. |
| G17: Retention / resolution | Current purge is based on read age; new System lifecycle has expiry and Account reminders can resolve. | Define whether items are retained, archived, or hidden. Reading, resolving an action, acknowledging a policy, and delivery are separate states. |
| G18: Missing supporting products | Device security history, residency approval/transfer, MFA, suspension/appeal, async exports, and general privacy cases were not established. | Keep their C/M scenarios documented; do not seed convincing notifications that lead to unavailable screens. |

### 4.2 Recommended data and read-state approach

**Recommendation: retain the existing announcement feed and extend the existing private inbox for Account/System.** Expose them through one presentation/query layer for this screen.

| Presentation category | Source | Canonical item identity / initial read model |
|---|---|---|
| Barangay | Accessible, published, non-deleted `announcements`. | `barangay:<announcement UUID>`; existing `announcement_reads` remains the announcement marker. |
| Account | Owner's `notification_inbox` rows: existing `request_status`, request-linked `payment`, `incident_status`, and other explicitly enabled Account kinds. | `account:<inbox UUID>`; inbox `read_at`. Request/report IDs remain destinations, not dedupe identities for every event about that record. |
| System | Owner's eligible System inbox entries referencing a versioned System notice. | `system:<inbox UUID>`; inbox `read_at`. Device guidance is not inserted here by default. |

Implementation requirements:

1. Extend event/inbox kind checks, preference validation, shared types, and a shared kind → category/subfilter registry. Category navigation, subfilter labels, business event kinds, and Android OS channels are separate concepts.
2. Classify `request_status` and request-linked `payment` as Account → Document Requests; classify `incident_status` as Account → Incident Reports. Include these rows in Account, All, the combined header badge, and their applicable filtered count/bulk scope. Their original Services/Reports detail routes remain authoritative. `announcement` inbox rows are delivery mirrors, not extra Barangay rows. Keep `medical_drive` and `health_registration` in Health and exclude them from this screen's totals.
3. Provide one read-operation contract for this screen. For a Barangay item, update its announcement marker and reconcile any matching owner-owned `announcement` inbox mirror. Reads/unreads made through other supported consumers must converge through a backend bridge or a coordinated consumer migration; changing Android alone cannot guarantee this. Backfill mismatched mirrors against the chosen canonical marker before rollout.
4. Existing iOS announcement inbox reads predate that bridge. Default conflict recommendation: preserve an existing read in either store during one-time reconciliation, record the reconciliation boundary, then honor later explicit read/unread actions consistently. Do not import service/report reads into this bridge.
5. Preserve old announcements even if no inbox mirror exists, including announcements predating registration. Do not backfill a private event for every historical announcement merely to display the feed.
6. Add count/list/bulk APIs over the same authorization and visibility predicates. The database already restricts inbox ownership; every added public table/function needs appropriate privileges and tenant/recipient checks. Client filtering alone does not protect private Account events. See [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
7. The bulk operation needs a server-defined membership snapshot or equivalent reliable boundary, not just a client timestamp. Mark matching eligible items that were unread in that snapshot across all pages; preserve arrivals after it. Return the applied scope/count and any failure so the UI does not claim complete success after partial writes.
8. Do not silently create a privileged combined endpoint that bypasses current guest/tenant rules. Guests retain permitted public announcement access; private inbox sources always require the actual owner.
9. New setting destinations should be typed references, resolved to known routes in the app. New System destinations should reference notice IDs. Preserve the current practice of keeping arbitrary URLs and private record snapshots out of push payloads. App-store links are configured/validated by the app, not taken directly from a push.
10. Maintain safe generic notification summaries. Full names, ID numbers/photos, birth dates, exact addresses, rejection notes, and recovery codes belong only in authorized detail flows. Apply existing title/body limits unless a reviewed contract changes them.
11. A request can have multiple distinct notification events, such as payment received and ready for pickup; a report can have in-progress and resolved events. Render each event once using its existing inbox ID, with the appropriate record destination. Opening/clearing one event does not silently clear every notification for that request/report.
12. Keep `notification_inbox.read_at` separate from `incidents.resolved_read_at` and active-report/request counts. Account bulk read updates only matching notification records; it does not acknowledge all resolved reports, close reports, or complete requests. Opening the actual report screen may retain that screen's existing acknowledgment behavior, which must be documented and verified separately.

### 4.3 Event creation and deduplication

- Suggested occurrence keys: ID submission ID + decision revision; credential operation ID; profile/household change revision; request/report transition occurrence or payment/refund attempt + confirmed stage; System notice ID + notification revision + recipient. These are proposed conventions, not current columns.
- Emit after trusted persistence, ideally in the same durable domain transaction. Client success pop-ups alone are insufficient producers: they miss staff changes, another device, and events occurring while Android is closed.
- Retries reuse the occurrence key. A genuinely new review, reset, or material notice revision gets a new occurrence ID. A resolved reminder does not repeatedly emit on screen focus.
- Fan out System notices idempotently and track audience/revision delivery progress. Confirm how newly registered residents obtain still-active notices without replaying old pushes.
- The current producer catches notification errors to avoid rolling back business operations. Add an observable reconciliation/retry path for missed notification creation; outbox delivery retries cannot repair an event that was never created.
- Do not generate historical security events from guesses. A deployment baseline may create clearly labeled current-action reminders, but must not claim “a new sign-in happened” without source evidence.

### 4.4 Suggested implementation order

1. Finalize the kind registry, including existing request/payment/report classification, launch coverage, destination versioning, read bridge, and System notice model.
2. Add the schema/API/event producers and meaningful backend verification for ownership, dedupe, transition accuracy, and count/bulk behavior.
3. Add Android data adapters, category navigation, grouped list, filters, and notification detail routing.
4. Integrate combined header counts and migrate duplicate alert paths for covered events; coordinate shared/iOS consumers.
5. Verify source publication rules, worker scheduling/configuration, catch-up behavior, and supported-device delivery.
6. Enable only notification scenarios with working producers and destinations. Keep conditional scenarios as future work.

## 5. Proposed Announcements screen layout and behavior

### 5.1 Visual reference and design direction

**Primary UI reference:** Shopee's notification screen, adapted to Barangayan's four requested categories. Use the idea of a notification hub with recognizable category icons, compact message previews, and a clear transition from category selection to individual entries.

A public [Shopee Feed User Guide, page 32](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/6f4f05f8ebdd50a3214e8683c3ef6d54/%5BMY%5D%20Shopee%20Feed%20User%20Guide.pdf#page=32) contains a historical notification/category example. The guide is dated October 21, 2020. It supports the category-hub reference; it does **not** establish the current Philippines Android screen's exact layout, spacing, icons, or behavior. The four-card row and layout below are a proposed Barangayan adaptation, not a claim about Shopee's current UI. Capture the intended contemporary Shopee reference before a later pixel-fidelity implementation review.

Keep Barangayan's theme-aware colors, selected fonts, icon system, rounded grouped panels, border treatment, header, and bottom-navigation safe area. Use S11 for section/panel presentation. Do not introduce Shopee's shopping categories, promotional density, or orange branding.

### 5.2 Screen hierarchy

```text
Existing app header: Announcements

1. Category navigation
   [ icon All ] [ icon Barangay ] [ icon Account ] [ icon System ]

2. Read summary
   6 unread                                  Mark all as read

3. Filter chips for selected category
   [All] [General] [Emergency] [Health] [Events] [Account] [System]

4. Items (example: All view / All chip)
   Barangay             [matching item count]   collapse control
   ┌ announcement row                                      ┐
   └ announcement row                                      ┘
   Account              [matching item count]   collapse control
   ┌ account notification row                              ┐
   └ account notification row                              ┘
   System               [matching item count]   collapse control
   ┌ system notification row                               ┐
   └ system notification row                               ┘
```

The app-header title remains. Remove the content heading “What's New”; do not replace it with a second large title. Source errors, progress, and guest prompts appear within the relevant section, without changing the four-section order.

### 5.3 Section 1: Category navigation

| Card | Suggested existing Ionicons name | Content | Badge |
|---|---|---|---|
| All | `grid-outline` | Barangay + Account + System. Default view. | Total unread across these three categories. |
| Barangay | `megaphone-outline` | Existing announcements only. | All unread accessible Barangay announcements. |
| Account | `person-circle-outline` | Document requests/payments, incident reports, profile, verification, security, and other enabled Account event kinds. | All unread owner Account entries, including request/payment/report notifications. |
| System | `settings-outline` | Eligible persistent System notices. | All unread owner System entries. |

- Four equal-width icon-and-label cards in one row at supported phone widths. Keep labels visible; increase height for text scaling rather than clipping. Allow a two-by-two fallback at accessibility sizes if four readable targets no longer fit.
- Selected card: themed accent surface/border and label emphasis. Also expose selected state to assistive technology; do not rely on color alone.
- Badges use actual category unread totals independent of the active chip or collapsed sections. Hide zero; display `99+` visually if needed and announce the actual count. Unknown counts are unknown, not zero.
- Tapping a different card switches the view in place, resets its chip to All, and starts the new list at the top. It does not push a separate screen onto navigation history or mark items read.
- Retapping the selected card retains the active filter; it may scroll the current list to the top only if that behavior is applied consistently.
- Initial entry defaults to All / All unless a valid notification/deep link specifies a category/item. Preserve state while opening and closing details in the same visit.

### 5.4 Section 2: Unread count and “Mark all as read”

**Recommended scope: selected category view plus active chip, across the full matching dataset.** The displayed unread count and the action always refer to the same eligible items, including collapsed sections and items not yet loaded through pagination.

| View / chip | Count and action scope |
|---|---|
| All / All | Barangay + Account + System. |
| All / Emergency | Emergency announcements only. |
| All / Account | All Account notifications; Barangay/System are unaffected. |
| Barangay / Health | Health announcements only. |
| Account / Verification | Account verification notifications only. |
| Account / Document Requests | The owner's document request and linked payment/refund notifications only. |
| Account / Incident Reports | Notifications about reports submitted by this resident only. |
| System / Service Status | Persistent service-status System notifications only. |

Rules:

- Show `1 unread`, `X unread`, or `You're all caught up` when the authoritative matching count is zero. A loading/failed count displays a checking/unavailable state instead of claiming zero.
- Keep the visible action label “Mark all as read.” Give it a scope-aware accessibility label, such as “Mark all unread Emergency announcements as read.”
- Disable when zero, while count/scope is unknown, or during a pending bulk operation. Successful completion updates summary, category badges, header bell, and affected rows together.
- Capture the operation's scope and membership on activation. Changing a chip while the operation finishes must not apply its response to the wrong view. Prefer disabling scope controls briefly during the mutation, while still permitting navigation away.
- New items arriving after the operation snapshot remain unread. If a mutation fails, preserve/refetch real state, show an actionable error, and do not announce success. Explain partial completion if the chosen API cannot be atomic.
- Collapsing groups changes visibility only. It does not reduce the scope or count.
- This intentionally replaces the current filter-independent bulk announcement behavior. Visible-scope semantics make the effect predictable when residents use a narrow category.

**Header bell decision:** show the total unread number for all three screen categories, regardless of the current view/chip. Its accessible label becomes “View announcements and notifications, X unread.” Retain announcement-specific counters elsewhere if they mean Barangay only; introduce an explicit combined count rather than changing every use of `announcementsUnreadCount` silently.

### 5.5 Section 3: Filter chips

Use the exact view/filter definitions in §6. Chips scroll horizontally as needed; never shrink text until it is unreadable. Pin only the chip strip below the app header as the list scrolls; cards and summary can scroll away. Use one outer virtualized scrolling owner and account for its dynamic header height.

Switching category resets the chip to All. Selecting a chip starts its result list at the top. Opening a detail and returning preserves the current category, chip, loaded pages, and position where practical.

### 5.6 Section 4: Grouping, ordering, and pagination

**All category view:** use the Requests All section pattern, with three disjoint groups in fixed order: **Barangay → Account → System**. A row belongs to exactly one group. The fixed group order takes precedence over global recency.

- All chip: show every non-empty matching group. General/Emergency/Health/Events chips: show only the Barangay group and matching announcements. Account/System chips: show only that group. Keep its header even when only one group remains, because the selected top-level view is still All.
- Within Barangay: descending `published_at`, then stable ID tie-breaker. Within Account/System: descending event publication/occurrence timestamp, then ID. Read items remain in place; no automatic unread-first reorder or hidden read history.
- Groups start expanded. Reuse the title + matching-item count pill + chevron, grouped row panel, dividers, and collapse/expand behavior from Requests. Section count means matching **items**, not unread items; distinguish it from card badges and the summary. Use total matching count, not just the loaded-page length; label unknown/loaded counts honestly.
- Collapse state persists through refresh/read changes during the visit. Reset to expanded on category/chip changes. Reduced motion uses immediate state transitions; expanded sections use natural content height so longer text/fonts never get clipped.
- Hide a section only when its source is successfully loaded and its matching count is zero. A failed or loading source gets its own inline state, not an empty disappearance. Hide Account for guests without labeling it an empty private inbox.
- Load full history through stable cursor pagination per source/group. Start with a proposed 25 items per group; offer “Load older Barangay announcements,” “Load older Account notifications,” etc. Do not fetch one global page that starves the later groups, and do not nest independent same-direction list scrollers.
- Realtime arrival refreshes/invalidates the affected source and counts. Do not jump the resident away from the item they are reading. Show a “New updates” affordance if applying arrivals would disturb their scroll position.

**Barangay, Account, and System category views:** render one grouped panel of matching rows without a redundant same-name collapsible heading. Preserve row/detail behavior. Pagination, counts, and read scope still use the full matching category/chip.

### 5.7 Row content and interaction

| Element | Requirement |
|---|---|
| Leading icon | Barangay retains its category icon/tone. Account/System uses subtype icons, with category fallback. Decorative icons are not additional focus targets. |
| Metadata | Category/subfilter label and a relative timestamp. Retain the absolute timestamp currently available on announcement rows; expose exact dates in all detail views. |
| Title | Meaningful resident-facing title. Unread uses stronger weight; read uses normal emphasis. Allow wrapping rather than truncating critical actions to an unreadable fragment. |
| Message | Two-line preview; full readable content in details. Retain current announcement body and detailed-description fallback. |
| Unread indicator | A visible dot plus text-weight difference and accessible “unread” state. Do not depend on color alone. |
| Read action | Keep a separate, labeled read/unread control for authenticated residents. It must not trigger row navigation. Keep it comfortably tappable even when its icon is small. |
| Target | Barangay rows open the existing announcement sheet. Document Requests and Incident Reports rows can open their authorized existing record details directly, with notification identity retained for read tracking. Other Account/System rows open notification details with supported follow-up actions. |

Read rules:

1. Merely displaying, scrolling past, receiving, filtering, or collapsing an item does not mark it read.
2. Opening an authorized item detail marks that notification event read; this preserves the existing announcement-open behavior. For request/report rows, mark the selected inbox row after the target is successfully authorized/opened. A failed navigation must not silently mark it read. Save failure must not block reading and must show retry feedback.
3. Account/System details show safe event text, exact timestamp, current resolution/status when relevant, and a clear supported action. Device permission prompts remain in context unless a later design explicitly adds them to the inbox.
4. Mark as unread remains available without opening the item. Read changes synchronize across supported consumers through the agreed bridge/contract.
5. Reading a verification/policy/maintenance/request/report notice does not verify an account, accept terms, pay/complete a request, resolve an incident, or complete the resident's required task. Notification bulk read never clears Reports' separate resolved acknowledgment markers.

### 5.8 Routing and unavailable items

- Preserve `/announcements?announcementId=<id>`. Open the requested accessible announcement even when the currently loaded page/filter does not include it. Use a direct authorized lookup instead of a client-side page search alone.
- Proposed new entry: `/announcements?view=account|system&notificationId=<id>`. Validate both parameters and fetch the owner-owned item; never trust a category or destination supplied by a push without checking the stored record.
- Existing version-1 `request` destinations map to Android `/services/requests/<id>` and `incident` destinations map to `/reports/<id>`. Reuse their owner inbox events; retain request/report routing from other app entry points. Both record visibility and event ownership must be checked, even when the resident can browse other public incident reports.
- Warm push tap: open the correct category/item once. Cold tap: retain a minimal pending intent, restore the correct account, then reauthorize/fetch. If login is needed, explain that step; never display another resident's pending notification after account switching.
- Existing app routes such as `/settings/valid-id`, `/settings/email-verification`, `/settings/profile`, `/settings/location-verification`, `/settings/change-password`, and `/settings/terms-privacy` are reusable destinations. The common notification detail, System notice detail, security activity, and access-case screens are proposed and must not be treated as already available.
- Deleted/inaccessible target: “This update is no longer available.” Keep the list usable. A retained authorized event summary can still be read even when its original action is unavailable; explain that state and disable the stale action.
- Unsupported destination/version: show generic authorized detail and “Update Barangayan to open this item,” if appropriate. Do not crash, navigate to an arbitrary URL, or silently discard the inbox row.
- Opening an old ID approval always refreshes current evidence state. It must not imply that a replaced or revoked ID is still approved.

### 5.9 Loading, empty, error, guest, and offline states

| State | Proposed behavior / wording |
|---|---|
| First load | Keep category navigation/filter controls available. Show row skeletons or “Loading updates…” in Section 4; show unknown count instead of zero. |
| Empty All | “No updates yet” — “Barangay announcements and account or system updates will appear here.” |
| Empty Barangay | “No announcements here yet.” Preserve category-specific empty wording when filtered. |
| Empty Account | “No account updates yet” — “Updates about your document requests, incident reports, profile, verification, and security will appear here.” |
| Empty System | “No system updates yet” — “App service notices and important changes will appear here.” |
| Empty chip | “No updates in this category.” Reset with the All chip; do not reset automatically. |
| One source fails in All | Keep successful groups visible. Show a named inline failure with retry in the failed group. Combined counts are incomplete/unknown, and combined bulk read is disabled until scope is trustworthy. |
| Refresh fails with existing data | Keep the last good rows and scroll position. Preserve the current quiet pull-to-refresh approach; do not replace content with a full-screen failure or add a permanent inbox item. |
| Read write fails | Keep content usable, show “Read status couldn't be saved. Try again.” Restore/refetch the true badge state. |
| Offline | Show retained authorized content if a cache is implemented, with an offline/stale indication. Disable server writes or explicitly queue them per account with visible pending state; the initial recommendation is disable-and-retry. |
| Guest: All/Barangay | Preserve current permitted public announcements. No personal unread counts or read actions. All shows public Barangay content plus a concise sign-in prompt for private updates. |
| Guest: Account/System | Keep category navigation visible. Account shows “Sign in to view your account updates.” System may show only explicitly public notices if that source is implemented; otherwise prompt sign-in for the private inbox. Do not expose resident history. |
| Setup/restricted account | Follow current guards. Show required next steps in the setup/access flow; an unreachable inbox is not the only route to a required action. |

### 5.10 Accessibility and performance requirements

- Support current light/dark themes, custom accents/fonts, readable contrast, reduced motion, and large Android text. Reuse current theme tokens instead of hardcoded reference colors.
- Provide at least 48 dp interactive targets as the proposed Android design baseline, particularly category cards, read actions, and collapse controls. Do not copy the size of a small glyph as its hit area.
- Announce selected category/chip, group expansion, item unread state, and mutation failures. Avoid noisy repeated announcements on every realtime refresh.
- Maintain one main virtualized list/scroll owner; avoid rendering an unbounded history or nested independent FlatLists inside a ScrollView. Shared section presentation may require extracting a reusable component from Requests rather than importing its feature-specific logic.
- Keep source queries/subscriptions stable through filter toggles and refresh. Coalesce invalidations, dispose on account changes, and do not mount duplicate notification engines for each category card.

## 6. Recommended Account and System filter chips

### 6.1 Exact navigation/filter matrix

| Selected category | Chips in display order | Matching rule |
|---|---|---|
| All | **All**, General, Emergency, Health, Events, Account, System. | All combines the three groups. The four announcement chips select a Barangay subtype. Account/System select that whole group. |
| Barangay | **All**, General, Emergency, Health, Events. | Existing announcement categories; All is the default aggregator. |
| Account | **All**, Document Requests, Incident Reports, Verification, Security, Profile, Access, Privacy. | Request/payment kinds map to Document Requests; incident-status kinds map to Incident Reports. Other kinds map to one supported primary subfilter. |
| System | **All**, Service Status, App Updates, Policies. | Persistent notices only. Device Settings is reserved for a later persistent-device-notice feature, not shown by default. |

All bold entries above are defaults. Preserve the user-requested All and Barangay chip sets exactly. Recommended Account/System chip sets are intentionally more specific without creating one chip per event.

### 6.2 Account filter coverage

| Chip | Covers | Scenario IDs |
|---|---|---|
| Document Requests | Submission, requirements/review actions, fees, linked payments/refunds, processing, pickup, completion, cancellation, and supported reminders/changes. | A31–A45; existing `request_status` and request-linked `payment`, plus new supported kinds. |
| Incident Reports | Submitted reports, staff progress, resolved/unresolved outcomes, withdrawal, and supported follow-up/reassessment. | A46–A52; existing `incident_status`, plus new supported kinds. |
| Verification | ID submission/review/replacement/repair, email verification, future explicit residency review/ID expiry. | A07–A17. |
| Security | Credential additions/changes/recovery, trusted sign-in/security alerts, future identity-link/MFA changes. | A18–A24, A29. |
| Profile | Setup/profile/household/home-location updates and correction requests. | A01–A06. |
| Access | Supported restrictions/restoration and deletion status while the owner can access it. | A25–A27; A27 itself remains outside the private inbox after deletion. |
| Privacy | Actual asynchronous export or formal privacy case updates, if introduced. | A28, A30. Current export stays in context. |

**Launch recommendation:** include All, Document Requests, and Incident Reports using their existing durable events and destinations, after Android integration and ownership/read checks pass. Add Verification, Security, and Profile once their producers are enabled. Enable Access and Privacy chips only when at least one supported persistent kind has a working destination. Do not show convincing empty product areas whose workflows do not exist. Empty enabled chips remain stable; do not hide/show them merely because a resident currently has zero items.

### 6.3 System filter coverage

| Chip | Covers | Scenario IDs |
|---|---|---|
| Service Status | Maintenance, incident/degradation/outage, recovery, provider availability, operational cutover, verified impact notices. | Y01–Y07, Y17. |
| App Updates | Optional/required app versions, compatibility changes, meaningful feature releases. | Y08–Y11. |
| Policies | Versioned privacy/terms/service policy notices. | Y12–Y13. |
| Device Settings — reserved | Device-local permission/resource guidance, only if a future managed persistent surface is approved. | Y14–Y16. Prefer contextual guidance now. |

Service Status includes maintenance and outages together to avoid nearly identical chips. App Updates includes feature release notices. A user's own privacy request belongs under Account → Privacy; an app-wide privacy notice belongs under System → Policies.

### 6.4 Filter behavior and forward compatibility

- Internal keys should be explicit, such as `account.verification` and `system.service_status`, rather than overloading shared announcement category values.
- Each persistent event has exactly one category and one primary subtype. A failed ID review is Verification even if it limits submissions; do not repeat it under Access.
- A request-linked payment/refund is Document Requests, not Security, Privacy, or System. A private report status update is Incident Reports; a community-wide incident warning published as an announcement is Barangay → Emergency. Referencing the same incident does not make these different-purpose events duplicates.
- Unknown future kinds must not be guessed into System. The server's versioned presentation registry should supply a supported category. Known-category/unknown-subtype items remain visible under that category's All with a generic label; entirely unclassified kinds stay out of these counts until their product ownership is defined.
- No Unread chip is added in this specification. The existing unread summary/read controls remain separate from the requested category filter sets.

## 7. Realistic notification examples

All examples are proposed copy, not live events. Dates illustrate Asia/Manila times. Detailed messages can provide more context than a push preview; account/private record details must remain behind authorized access.

### 7.1 Example resident inbox

| View / subtype | Title | Preview | Detail / action |
|---|---|---|---|
| Barangay / Events | Barangay assembly this Saturday | “Join the barangay assembly at the covered court on October 31 at 9:00 AM.” | Existing announcement sheet with complete body/image, if provided. |
| Account / Document Requests | Your document is ready for pickup | “Open your document request to review the pickup details and remaining requirements.” | Existing request tracking → pickup details. |
| Account / Document Requests | Payment received | “Your document request payment was received. Open your request to check the next step.” | Existing request/payment details; reuse the original payment inbox event. |
| Account / Document Requests | Your refund has an update | “Open your document request to review the refund status and any required action.” | Authorized request/payment details; never imply that initiation means the refund completed. |
| Account / Incident Reports | Your report is being addressed | “The barangay has started acting on your incident report.” | Existing incident detail; original reporter's inbox event only. |
| Account / Incident Reports | Your incident report was resolved | “The barangay marked your report as resolved. Open it to review the update.” | Existing incident detail; read state is separate from operational report status. |
| Account / Incident Reports | Your report was closed as unresolved | “Open your report to review the available details.” | Existing incident detail; do not label this resolved. |
| Account / Verification | Your ID is verified | “Your submitted ID has been approved. Open Valid ID to review your status.” | Review current status → **View Valid ID**. |
| Account / Verification | Your ID needs attention | “Your ID could not be verified. Review the reason before submitting a replacement.” | Authorized detail: “The front photo is blurred. Please submit a clearer photo.” Use this reason only if staff actually recorded it. |
| Account / Verification | Verify your updated email | “Your contact email changed. Confirm the new address in Email Verification.” | **Verify email**. Do not imply the sign-in email changed. |
| Account / Security | Password changed | “Your Barangayan password changed. If this wasn't you, recover your account.” | Show occurrence time → **Recover account** / supported help. No password or OTP is displayed. |
| Account / Profile | Household details updated | “Your household information changed. Review the saved details in your profile.” | **Review household details**; not a claim that the family is checked in at a center. |
| System / Service Status | Scheduled maintenance | “Barangayan will be unavailable on October 28, 10:00–11:00 PM.” | Explain affected features, Manila time, and supported alternatives. |
| System / Service Status | Online payments temporarily unavailable | “QR Ph payments are unavailable right now. Check again later.” | Current service incident; preserve request/payment status independently. |
| System / Service Status | Online payments are available again | “You can now continue paying eligible document requests.” | Original incident is marked resolved; action opens an eligible existing flow. |
| System / App Updates | An app update is available | “Update Barangayan for the latest fixes and improvements.” | Release summary → verified Android store listing. |
| System / Policies | Privacy notice updated | “Review the updated notice and its effective date.” | Correct policy version; read status is separate from any required acknowledgment. |

### 7.2 Count and bulk-read example

Assume the resident has 3 unread Barangay announcements, 2 unread Account items, and 1 unread System item:

| State / action | Expected result |
|---|---|
| Open All / All. | Summary says “6 unread”; category badges show 6 / 3 / 2 / 1. |
| Select All / Account. | Only Account group remains; summary says “2 unread.” Category-card totals remain 6 / 3 / 2 / 1. |
| Tap “Mark all as read.” | Both matching Account items become read, including any on an unloaded page. Summary becomes “You're all caught up”; badges become 4 / 3 / 0 / 1. |
| A third Account event arrives after the operation snapshot. | It remains unread. Badges become 5 / 3 / 1 / 1; current summary says “1 unread.” |
| Switch to Barangay. | Chip resets to All; summary says “3 unread.” Account/System state is unchanged. |
| Collapse Barangay in All / All. | Rows hide; unread summary and badges do not change. |
| Select Account / Document Requests with one unread payment event and one unread pickup event, then bulk-read. | Only matching request/payment notification events become read, across all pages. Incident Reports and other Account subfilters remain unchanged; no request/payment status is modified. |
| Select Account / Incident Reports and bulk-read a resolved notification. | That inbox event becomes read; the report remains resolved and its separate Reports acknowledgment marker is not changed by the bulk action. |

### 7.3 Overlap examples

- **ID approved, clearance still pending:** Account → Verification records the ID result; Account → Document Requests carries actual request updates and opens Services for details. ID approval does not imply clearance approval.
- **Payment failed during a confirmed outage:** Account → Document Requests carries an actionable, confirmed request-linked payment outcome. System separately explains the broader outage to its affected audience.
- **An incident report is resolved:** show the original reporter's update under Account → Incident Reports. A public warning remains Barangay → Emergency only when separately published. Preserve the distinction between notification read state, report acknowledgment, and report status.
- **Health announcement plus a new medical-drive record:** show the community announcement once in Barangay; route actual drive registrations/results through Health. Never recategorize those existing private updates as Account.
- **Password change while offline on another device:** no fabricated success event. A trusted successful change creates the event; the offline device catches up when connected.
- **Resident reads a maintenance notice:** the unread badge clears for that notice. Maintenance itself remains active until the operator resolves it.

## 8. Open questions and recommended decisions

### 8.1 Decision register

These are recommended defaults for implementation planning, not requests to halt work on this document.

| Question | Recommended decision | Remaining dependency |
|---|---|---|
| What is the initial category? | All / All. Keep the app-header name Announcements. | Product may later rename the hub, but that is outside the requested change. |
| What replaces “What's New”? | Remove it; category cards become the first content section. | No replacement heading needed. |
| What does “Mark all as read” affect? | Current category + chip, across all pages and collapsed groups. | New consistent count/bulk API and read bridge. |
| What does the header bell count? | All three included categories; keep feature-specific report/service counts separate. | Update provider, label, and all intended header consumers. |
| Are Account/System just more announcement categories? | No. Retain community announcements; extend private notification infrastructure. | Kind/destination schema and shared-type changes. |
| Which Account scenarios launch first? | Existing document-request/payment and incident-status events, then ID submission/decision/replacement/revocation/repair, email verification/change, meaningful profile changes, and trusted password events. | Reuse current inbox IDs; add missing producers, authorized details, dedupe, and compatible routes. |
| Where do document requests and incident reports belong? | Account → Document Requests and Account → Incident Reports. Request-linked payments/refunds use Document Requests. | Include existing kinds in All/Account counts, filters, bulk operations, and Android routing; preserve Services/Reports as record owners. |
| Which System scenarios launch first? | Service notices with lifecycle/targeting, meaningful app updates, and versioned policy notices. | Authoring/scheduler/version policy. |
| Are new device/security/residency notifications promised? | No. Keep them conditional until their underlying workflows are built. | Security history, residency cases, support actions, or access management. |
| Should device permission messages fill System history? | Prefer per-device contextual guidance. Keep Device Settings as a reserved filter. | Add persistent device notices only for a proven requirement. |
| What read state wins across announcement consumers? | Canonical announcement marker plus server reconciliation of inbox mirrors; preserve prior reads during one-time backfill. | Coordinated consumer/backend rollout, including unread operations. |
| Should read history be unlimited? | Preserve current available history and 90-day-after-read inbox purge as a baseline, subject to a deliberate policy decision for new kinds. | Decide separately about notice expiry, unread retention, and account security records. |
| How accurate must the Shopee match be? | Use the hub/category/message hierarchy now. Confirm the intended current reference before pixel-fidelity implementation. | Contemporary reference capture; historical guide is explicitly dated. |
| Are hosted deliveries verified? | No. Repository foundation is confirmed; deployment/delivery remains a later verification task. | Worker schedule, configuration, Android build, physical-device tests. |

### 8.2 Acceptance criteria for the later implementation

- [ ] Four category cards appear first, followed by read summary, correct chips, and item rows. “What's New” is absent.
- [ ] All / All groups rows exactly once under Barangay, Account, and System, in that order. Empty successful groups disappear; failed groups remain recoverable.
- [ ] Requests-style section headers, counts, panels, dividers, collapse behavior, and reduced-motion handling are reused without copying request-specific status semantics.
- [ ] Existing announcement categories, body/detail/image content, direct links, manual read/unread control, public access, and refresh behavior still work.
- [ ] Each enabled Account/System scenario has a real trusted trigger, correct audience, working destination, and documented dedupe key. Conditional scenarios do not generate production notices prematurely.
- [ ] Scope/count/bulk behavior matches §5.4 across unloaded pages, collapsed groups, multiple devices, arrivals during mutation, and partial source failures.
- [ ] Bell/category/row counters agree, and unknown/loading states never falsely claim zero unread.
- [ ] Document-request, linked payment/refund, and original-reporter incident events appear exactly once under the correct Account filters and are included in All/Account counts and applicable bulk operations. Existing events are reused rather than copied.
- [ ] Health-registration and attendance updates stay outside this Account scope. Notification read mutations never change business statuses or clear separate Reports acknowledgment markers; opening the target screen retains its independently tested acknowledgment behavior.
- [ ] Announcement inbox mirrors do not create duplicate rows or conflicting read markers across supported consumers.
- [ ] Warm/cold push taps validate payload/ownership, restore the intended account, open once, and handle missing/unsupported targets without exposing another resident's data.
- [ ] Push disabled/permission denied still allows inbox history. No duplicate local/server alerts for migrated events. Physical-device background delivery is tested separately from source-level/UI checks.
- [ ] Offline/reconnect, logout/account switch, deleted accounts/records, revoked IDs, resolved actions, and changed app versions are covered by meaningful regression cases.
- [ ] At 320–412 dp widths and large text, cards/chips/read controls remain usable with current themes/fonts; details and expanded groups do not clip. Verify TalkBack, reduced motion, and safe-area placement.
- [ ] Backend checks cover tenant/recipient isolation, unauthorized writes, title/body/destination validation, trusted transition emission, idempotency, count/list agreement, and bulk snapshot behavior.

### 8.3 Verification of this breakdown

This is a source-backed specification, not a completed implementation or test report. The review inspected the current Android UI/hooks, database notification/read contracts, ID/email/password/location/privacy flows, shared types, iOS notification consumer, and Requests grouping reference. External reference limits are disclosed in §5.1. Proposed routes, publishers, APIs, fields, and lifecycle policies are explicitly labeled so they are not mistaken for deployed functionality.
