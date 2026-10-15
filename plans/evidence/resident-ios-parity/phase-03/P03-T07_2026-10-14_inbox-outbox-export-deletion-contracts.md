# P03-T07 — staged contracts for inbox/outbox/push, export, deletion and upload cleanup (2026-10-14)

**Task:** P03-T07. **Requirements:** B18, B19, B20, B23; A44, A45, A46, A47, A51; G10, G11, G13, G20; F03/F04/F07. **Consumers:** Phase 17 (inbox, outbox, push, preferences), Phase 18 (export, deletion). **Status:** designed and staged. Nothing in this file is deployed, and no table below exists. Each contract is a specification the consuming phase implements and tests; the only code delivered by P03-T07 is migration `0124` (orphan discovery) and the token-ownership/validation changes in `0121`.

Existing source endpoints are not proof of any of this (plan B.1): `upsert_push_token`/`push_tokens` (0063), `export-my-data` v1 and `delete-my-account` v1 are baselines. Operating owners are the Phase 0 named owner (KingJaqar, OD-01) until delegated; naming an owner does not satisfy a gate (PR-07, PR-13, PR-14).

## 1. Durable inbox, event outbox and token contract (Phase 17)

### Delivered now (migration 0121)

| Control | Rule |
|---|---|
| Token ownership | One current owner per Expo token (`push_tokens_expo_push_token_key`). `upsert_push_token` deletes any other account's row for that token, so a shared device never delivers the next account's notifications to the previous account. Legacy duplicates are collapsed to the most recently used row by the migration. |
| Token format | `ExponentPushToken[...]`/`ExpoPushToken[...]`, at most 200 characters; device type `ios` or `android`. Enforced by the RPC and by a `NOT VALID` check constraint (new and changed rows only; legacy rows are validated by the sender's receipt processing). |
| Caller | Authenticated, non-deleted profile only. Anonymous execution revoked. |
| Logout | `push_tokens` keeps its own-row `ALL` policy, so a client may delete its token on logout. Offline-logout recovery (token removed server-side after a failed client delete) is the sender's invalid-token path below. |

### To build in Phase 17 (all additive)

| Object | Shape |
|---|---|
| `notification_events` | `id uuid pk`, `barangay_id`, `recipient_id` (profile), `kind` text check in (`request_status`, `payment`, `incident_status`, `announcement`, `health_registration`, `emergency_alert`), `subject_type`/`subject_id` (record the destination resolves), `dedupe_key text not null`, `payload_version int default 1`, `created_at`. Unique `(recipient_id, dedupe_key)`. Created by the same transaction that changes the source record (trigger or definer RPC), so an event cannot exist without the change or vice versa. |
| `notification_inbox` | One row per resident per event: `event_id`, `recipient_id`, `title`, `body` (generic, privacy-reviewed preview text), `destination jsonb` (validated `{v:1,kind,id}` only; never a URL or a record snapshot), `read_at`. RLS: `recipient_id = auth.uid()` select; update restricted to `read_at`. Inbox read state is independent of `announcement_reads` and `incidents.resolved_read_at` (plan §3). |
| `notification_outbox` | `id`, `event_id`, `token_id`, `state` in (`pending`,`sending`,`sent`,`failed`,`dead`), `attempt_count`, `next_attempt_at`, `provider_ticket_id`, `provider_receipt_state`, `last_error` (sanitized). Private schema, no API grants; service role only. |
| Preferences | Existing `profiles` opt-in plus a per-kind map. Applied at **send time** by the worker (plan §3), not at event creation, so a resident who opts out after an event still receives nothing. |
| Worker | Authenticated server worker (Edge Function or scheduled job) with service-role access: claims `pending` rows with `for update skip locked`, batches to the Expo Push Service, records tickets, polls receipts, retries with exponential backoff to a defined limit (5 attempts, then `dead` and an operational alert), deletes tokens on `DeviceNotRegistered`. No background-location, critical-alert or silent-push requirement. |
| Routing | Cold/warm tap handler validates `{v,kind,id}` against the allowlist, resolves with the resident's own RLS read, and falls back to the inbox item when the record is deleted or unauthorized. Replay suppressed by inbox row id. |
| Retention | Inbox rows 90 days after read; outbox terminal rows 30 days; events follow their source record. Needs privacy-owner confirmation (PR-14). |

Prerequisites still open: PR-07 (named sender operator and on-call), PR-13 (concern visibility policy decides which incident events are previewable), PR-02/PR-04 are not required under OD-06.

## 2. Export contract v2 (Phase 18)

Defects in `export-my-data` v1 that the v2 contract removes (recorded, not fixed here): sections are fetched without pagination so PostgREST's row cap silently truncates them; a failed section is returned as `[]`, indistinguishable from "no data"; the cooldown is recorded before the payload is validated; `service_requests` is exported with `select('*')`, including staff-only review columns; identity images, request attachments, household members, announcement reads and corroborations are absent.

| Rule | Contract |
|---|---|
| Identity | Caller JWT only; no profile id parameter. Fresh authentication is not required (read-only) but the cooldown applies. |
| Envelope | `{ contractVersion: 2, exportedAt, account, sections: { <name>: { status: 'complete' | 'failed', rowCount, truncated: false, rows | error } } }`. The export is `complete` only when every **required** section is `complete`; otherwise the function returns a non-2xx result and does not record the cooldown. |
| Pagination | Keyset pages of 500 by `(created_at, id)` until exhausted, so the result is not bounded by the API row cap. |
| Required sections | profile (resident-safe columns), household members, service requests with payments and status history, attachments (metadata, not bytes), ID submissions (metadata and decision, not images), incident reports, corroborations, announcement and resolved-report read state, health registrations, evacuation check-ins, notification preferences and inbox. |
| Excluded | Token and device secrets, other residents' data, staff identities (`reviewed_by`, `assessed_by`, `collected_by` become role labels), operational internals (`submission_payload` hashes, idempotency keys). |
| Cooldown | Server-side, recorded only after a complete export; `last_data_export_at` already exists (0079). |
| Formats | JSON from the function; PDF is rendered on the client from the same payload. A section marked `failed` is printed as unavailable, never as empty. |

## 3. Deletion, retention and cleanup contract (Phase 18)

Delivered now: `request_own_account_deletion()` requires fresh authentication (JWT `amr` within 10 minutes, migration 0121) and the Edge Function checks the same evidence **before** touching Storage. A retry after a partial failure converges: the RPC reports the already-anonymized profile (`P0002`) before the freshness check, and the function re-bans.

To build in Phase 18:

| Step | Contract |
|---|---|
| State record | `account_deletion_requests(user_id pk, state, step, started_at, completed_at, last_error)`; states `requested`, `profile_anonymized`, `storage_cleaned`, `auth_revoked`, `completed`, `needs_attention`. The function advances idempotently and returns the truthful state, never `success` for a partially completed deletion. |
| Auth | Ban plus revocation of existing sessions (`auth.admin` sign-out of all sessions) so a previously issued JWT cannot keep using protected operations; RLS already rejects a deleted profile on the guarded write paths (0094, 0121). Apple credential revocation needs the Apple client secret (PR-06) and runs before the auth ban. |
| Storage | Remove the resident's own objects in `profile-photos`, `id-documents`, `request-attachments`, `incident-photos` through the Storage API; failures are recorded per bucket and retried, not swallowed. Objects left behind are found by section 4. |
| Retained records | Needs the privacy-owner approved matrix (PR-14). Proposed default pending approval: service requests, payments and audit rows retained de-identified for the lawful accounting period; incident reports retained de-identified; household, ID evidence, contact data and device tokens deleted. The export of section 2 must be available before deletion and the screen must state what is kept and why. |
| Terminal result | `completed` only after auth revocation and Storage cleanup succeed. Anything else is `needs_attention` with a staff-visible reason. |

## 4. Orphaned upload discovery and cleanup (closes P02-D10)

Delivered now: `barangayan_private.unreferenced_upload_objects(bucket, min_age)` (migration 0124) — service-role only, read-only, restricted to `request-attachments` and `id-documents`, minimum age one hour, default seven days. References: `request_attachments.object_path`; `id_submissions.front_path/back_path`, `service_requests.id_document_path`, `profiles.id_photo_urls`.

Phase 17/18 builds the worker: list candidates, delete through the Storage API in batches of 100, log counts only (never paths), alert when a run deletes more than a configured ceiling. Draft-retention interacts with the minimum age: a staged upload belonging to a Keychain draft older than the age is treated as abandoned, which matches the client's draft expiry.

## 5. Open decisions for the owner

| ID | Decision | Recommendation |
|---|---|---|
| PR-14 | Approve the retention/deletion matrix in section 3. | Approve the proposed default; it keeps lawful accounting records and removes identity material. |
| PR-07 | Name the sender operator and on-call owner for the outbox worker. | Same named owner until delegated (OD-01); required before Phase 17 can exit. |
| PR-13 | Which incident events may appear in a push preview. | Generic text only; no title, address or reporter data. |
| P03-T07-1 | Inbox retention (90 days after read) and outbox terminal retention (30 days). | Accept. |
