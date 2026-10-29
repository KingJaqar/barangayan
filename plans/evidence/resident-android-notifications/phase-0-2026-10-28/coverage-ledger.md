# Phase 0 coverage ledger — enabled catalog IDs

**Date:** 2026-10-28, Asia/Manila. **Source state:** HEAD `9fe8add1` + working copy in [source-manifest.json](source-manifest.json); effective SQL definitions were read from the disposable clone `notif_p0_20261028` (local dev DB + migrations 0118–0144 applied), not from hosted.
**Labels:** "Writer" is a verified fact (file:line or effective clone definition). "Producer plan" and "Destination" are phase-1/2 **assumptions/contracts**; nothing below is implemented. "Test" names the gate where the row must be proven. Phase 0 changed no product code or data outside the disposable clone.

Shared facts used by every row:

- **L1** `emit_notification` (0135:124–146) writes event + inbox + outbox in one statement, dedupes on `(recipient_id, dedupe_key)`, accepts only residents of the given barangay, and every inbox row gets an outbox row (no "history only" path exists). Kinds/subjects/destination are CHECK-limited to the six v1 kinds and `{v:1,kind∈request|incident|announcement|drive|registration,id}` (0135:34–58). → Phase 1 must add new kinds, new destination variants and an explicit **no-alert history** path (event+inbox without a deliverable outbox row) instead of mutating preferences.
- **L2** Existing producers skip the actor's own change (`auth.uid() = owner`, 0135:153,179) and use permanent `subject:status` keys (0135:157,168,183) → G11 collision for genuine repeated transitions; phase 2 adds occurrence keys for **new** producers and must not resend existing rows.
- **L3** Service-role/webhook writes have `auth.uid() = null`, so they count as non-owner (alert-eligible).
- **L4** Android routes that exist today: `/settings`, `/settings/profile`, `/settings/valid-id`, `/settings/email-verification`, `/settings/change-password`, `/settings/terms-privacy`, `/settings/about`, `/services/requests/[requestId]`, `/reports/[incidentId]`, `/announcements` (`src/app/(app)/…`).

## Account — Profile / Verification / Security

| ID | Writer (committed state) | Recipient | Current producer | Producer plan (phase 2) | Filter | Destination | Test |
|---|---|---|---|---|---|---|---|
| A01 | `complete_resident_profile_fields(jsonb)` is the only function assigning `profile_completed_at` (clone `prosrc` search); guarded by `guard_profile_foundations` (0095:234) | profile owner | none | AFTER UPDATE on `profiles` when `profile_completed_at` null→not null; key `account_ready:<id>` (once ever); no-alert history | Profile | `/settings` | SQL transition + repeat-save negative |
| A03 | Resident: direct `profiles` UPDATE from `settings/profile.tsx:889–910` (names, sex, email, mobile, house_no, street, city, employment, occupation, birth_date). Staff: `admin_mutate_record`/0128 editors | profile owner | none | AFTER UPDATE whitelist diff (exclude email→A15, avatar, preferences, theme, `updated_at`, verification fields, location); key per occurrence (`profile:<id>:<xact/updated_at>`); self-edit = no-alert history, staff = alert-eligible | Profile | `/settings/profile` | SQL: whitelist hit, unchanged save, preference-only update emit nothing |
| A05 | `profiles.household_members` jsonb → `sync_household_members_from_jsonb` (BEFORE UPDATE, 0139) into `household_members`; staff `admin_add/update/remove_household_member` (0139) | household owner (profile id) | none | Observe committed `household_members` row changes for owner, coalesced to one event per statement/transaction; self = no-alert history | Profile | `/settings/profile` | SQL: add/edit/remove, unchanged jsonb no event |
| A07 | `publish_id_submission` (0118:10–72): inserts version N, sets `current_id_submission_id`, `approved_id_submission_id=null`, status `pending` | submitter | none | AFTER INSERT `id_submissions` when no prior approved/current verified evidence; key `id:<submission_id>:submitted`; self = no-alert history | Verification | `/settings/valid-id` | SQL first submission; idempotent re-publish (0118:56–63 returns existing id) emits once |
| A08 | `review_id_submission` (0095:421–445; effective clone def lines 14–28): pending→`verified` | submitter | none | AFTER UPDATE `id_submissions.decision` pending→verified; key `id:<submission_id>:verified` | Verification | `/settings/valid-id` | SQL |
| A09 | same: pending→`verification_failed`, reason required | submitter | none | key `id:<submission_id>:verification_failed`; safe generic text, reason only in Valid ID | Verification | `/settings/valid-id` (+reason display) | SQL + phase 3 reason fixture |
| A10 | same: verified→`revoked` (profile maps to `verification_failed`) | submitter | none | key `id:<submission_id>:revoked` | Verification | `/settings/valid-id` (+reason) | SQL |
| A11 | `publish_id_submission` when a previous approved/current verified version existed (profile row locked at 0118:54 before update) | submitter | none | Same INSERT trigger branch → replacement copy instead of A07 (one event per submission) | Verification | `/settings/valid-id` | SQL replacement-after-approval |
| A12 | **Discrepancy:** `id_repair_required=true` is only set by the one-time legacy import (0096:39–40); cleared on publication (0096:105–116). No runtime writer sets it. | flagged resident | none | Trigger on false→true (future writers) **plus** one bounded, idempotent activation reconciliation for currently flagged residents keyed `id_repair:<profile>:<current_id_submission_id or none>`; never inferred from fetch failure | Verification | `/settings/valid-id` | SQL: flagged → one event; rerun → zero |
| A14 | `verify-resident-email/index.ts:43–56` service-role update → `email_verification_status='verified'`, `email_verified_at` | owner | none | AFTER UPDATE status →verified; key `email:<id>:verified:<email_verified_at>` (no address in key) | Verification | `/settings/email-verification` | SQL |
| A15 | `reset_changed_profile_email_verification` (0109:5–17) resets status on normalized email change | owner | none | AFTER UPDATE when normalized email changed and new email non-null; key per occurrence; self = no-alert history | Verification | `/settings/email-verification` | SQL: case/space-only change emits nothing |
| A18 | `observe_resident_auth_password` (0122:22–42) updates `resident_account_lifecycle` on hash change; old row `password_set=false` | owner | none | AFTER UPDATE on lifecycle `password_observed_at` change where `old.password_set=false` → "Password added" | Security | `/settings/change-password` | SQL |
| A19/A20 | same observer; `old.password_set` true or **null** (unknown legacy provenance, 0122 v2 comment) | owner | none | One generic "Password updated" event (D16); key `password:<id>:<password_observed_at>`; recovery (A20) produces this same event; never stores credential data | Security | `/settings/change-password` | SQL change + recovery path (auth.mjs) one event each |

## Account — Document Requests (`service_requests` / `payments` / `service_request_pauses`)

| ID | Writer (committed state) | Current producer (0135) | Producer plan | Destination | Test |
|---|---|---|---|---|---|
| A31 | `submit_service_request` (effective def 0142) INSERT | none (trigger is UPDATE-only, 0135:232) | AFTER INSERT; key `request:<id>:submitted`; self = no-alert history | `/services/requests/<id>` | SQL submit + failed submit emits nothing |
| A32 | **Discrepancy:** `review_service_request` raises `request_review_removed` (effective def). The only committed resident-action state is the SLA pause, which requires a resident-wait reason (`transition_service_request_sla` pause branch). | none | Pause start (`service_request_pauses` INSERT) emits the A32 "needs attention" event; key `request_pause:<pause_id>:started`. No evidence-reply form | `/services/requests/<id>` | SQL pause |
| A33 | `fee_assessment_state`/`assessed_amount_centavos` (states legacy/assessed/waived/pickup_due/page_count_required) via submission/assessment/`admin_edit_request_payment` (0132) | none | AFTER UPDATE when state becomes `assessed` with amount>0 or a materially revised assessed amount; key includes amount revision | `/services/requests/<id>` | SQL; estimate-only states emit nothing |
| A34 | `payments` → `sync_service_request_payment_status` → `payment_status='paid'` | **yes** `payment` kind (0135:154–158), owner self-change skipped | Reuse; verify webhook (service-role) path | existing v1 `request` | Existing phase17 + new actor case |
| A35 | `payment_status='waived'` | **yes** (0135:154–158) | Reuse | v1 `request` | Existing |
| A36 | `status='in_progress'` (SLA accept) | **yes** `request_status` (0135:160–169) | Reuse; occurrence-key decision for repeats (L2) | v1 `request` | Existing + repeat case |
| A37 | pause/resume (`service_request_pauses` INSERT / `resumed_at` UPDATE) | none | Resume emits "Request processing updated", key `request_pause:<pause_id>:resumed`; pause is A32 (one event per pause occurrence, no duplicate) | `/services/requests/<id>` | SQL pause→resume→pause distinct |
| A38 | `status='ready_for_pickup'` | **yes** | Reuse | v1 `request` | Existing |
| A39 | `status='completed'` (release) | **yes** | Reuse | v1 `request` | Existing |
| A40 | `status='cancelled'` (staff or resident `cancel` action) | **yes** for non-owner; owner cancellation skipped | Add owner self-cancel as no-alert history only (distinct key, no duplicate for staff path) | v1 `request` | SQL both actors |
| A43 | `payments.status` → `failed`/`expired` (paymongo-webhook:146,156; check-payment-status) | none | AFTER UPDATE on `payments` provider-confirmed failed/expired; key `payment:<payment_id>:<status>`; transient checkout errors stay Flow | `/services/requests/<service_request_id>` | SQL |
| A44 | `payments.refund_status` none→pending (refund-payment:132), →processing/refunding/refunded/failed (refund-payment:199–207; webhook:181–188) | none (0135 ignores `refunded`) | One event per stage transition; key `refund:<payment_id>:<refund_status>:<occurrence>`; "pending/processing" copy never says money returned | `/services/requests/<id>` | SQL each stage + rollback to failed |
| A45 | `admin_edit_request_details` (0133, effective 0144) versioned staff edits | none | Emit only for resident-facing field changes not already covered by status/fee events (coalesce); key includes record version | `/services/requests/<id>` | SQL coalescing |

## Account — Incident Reports (`incidents`, status open/in_progress/resolved/withdrawn/unresolved)

| ID | Writer | Current producer | Producer plan | Destination | Test |
|---|---|---|---|---|---|
| A46 | resident INSERT (guarded by `a0_require_complete_profile`, `a_guard_incident_write`) | none (UPDATE-only, 0135:236) | AFTER INSERT; key `incident:<id>:submitted`; no-alert history | `/reports/<id>` | SQL |
| A47 | status→in_progress | **yes** `incident_status` (0135:177–188) | Reuse | v1 `incident` | Existing |
| A48 | status→resolved | **yes** | Reuse; `resolved_read_at` untouched | v1 `incident` | Existing + R06 |
| A49 | status→unresolved | **yes** | Reuse | v1 `incident` | Existing |
| A50 | `withdraw_incident(uuid)` (0139) → `withdrawn` | none (excluded status + owner skip) | Add withdrawal as no-alert history; key `incident:<id>:withdrawn` | `/reports/<id>` | SQL + admin withdrawal (0116) actor |

## System

| ID | Committed state today | Producer plan (phase 1–2) | Filter | Destination | Test |
|---|---|---|---|---|---|
| Y01–Y06 | **None.** No System notice storage/publisher exists (F12: admin audit "System" is admin login/logout). | New restricted notice table (typed subtype, audience=barangay, state draft/scheduled/published/resolved/cancelled, window, revision, creator). Publish/revise/resolve/cancel via service-role-only function; due scheduled notices published by the existing sender invocation before claim (U03). Recipient = non-deleted residents of the target barangay; delivery key notice+revision+recipient | Service Status | new System notice detail (generic sheet) | SQL lifecycle, revision dedupe, bounded fan-out |
| Y08 | **None.** No store listing URL or update policy in repo; app is `com.barangayan.resident` v1.0.0 / versionCode 6 (`app.json:5,17–18`); `expo-constants` available | Informational notice with optional versionCode upper bound; **no external store link** (none verified; D09 forbids arbitrary URLs) | App Updates | System notice detail | SQL + Android parser fixture |
| Y11 | Feature notice only; feature itself must already exist | Notice action limited to typed allowlist of existing routes | App Updates | allowlisted existing route or notice detail | parser allowlist test |
| Y12/Y13 | `/settings/terms-privacy` renders `site_content` sections `terms_of_service`/`privacy_policy` (`terms-privacy.tsx:13–15`); `site_content` has no version column; guests read active rows (RLS) | Notice carries policy kind + effective date + revision; reading ≠ consent | Policies | `/settings/terms-privacy` (section) | SQL + destination fixture |

## Non-enabled IDs (unchanged disposition, plan §1.2)

A02, A06, A13, A26–A28, Y14–Y16 preserved in context; A04, A16–A17, A21–A25, A29–A30, A41–A42, A51–A52, Y07, Y09–Y10, Y17 outside execution. No producer is planned for them; phase 1 must not add their kinds.

**Count check:** enabled rows above cover A01, A03, A05, A07–A12 (6), A14–A15 (2), A18–A20 (3), A31–A40 (10), A43–A45 (3), A46–A50 (5), Y01–Y06 (6), Y08, Y11, Y12–Y13 = **42 enabled IDs**; 27 non-enabled = 69 total.
