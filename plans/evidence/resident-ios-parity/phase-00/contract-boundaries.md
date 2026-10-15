# Versioned API boundaries (P00-T07) — Approved 2026-10-13

Approved by the named owner `KingJaqar` (decision-register OD-02). Baseline for plan Appendix B.1 rows B01–B24. "Current boundary" is what source and the hosted inventory show at the baseline; it is not a security or deployment qualification (that is Phase 3, P03-T01–T08). "iOS boundary rule" is the approved versioning stance; changing it reopens affected tasks per decision-register §6.

Rules for every row:

- Parse every response with a strict shared schema at the adapter boundary. Unknown fields, missing fields, network failure, HTTP failure, timeout/unknown commit and valid empty data are distinct outcomes (P02-T01).
- Never widen an existing strict Android/web response. Provider- or iOS-specific shapes are additive (new versioned RPC/function or new optional input), never a changed enum on a legacy contract.
- Admin-only operations (`review_id_submission`, `assess_service_request_fee`, `review_service_request`, `transition_service_request_sla`, `collect_pickup_payment`, refunds) are never called from iOS.
- Deployed Edge Function versions below come from `hosted-inventory.json`; database objects are recorded by migration prefix only.

| B | Boundary | Current boundary at baseline | iOS baseline use | iOS boundary rule | Owning phase |
|---|---|---|---|---|---|
| B01 | Supabase Auth: password, OTP, Google PKCE, recovery, refresh, logout | supabase-js `2.112.1`; Android `use-auth.tsx`. Apple provider disabled locally; hosted state unknown (PR-06). | Password login, recovery OTP, change password, `signUp` with metadata (defective). | Keep Auth API; remove metadata-based signup; add Apple via `signInWithIdToken` with nonce once PR-06 closes. | P04 (P03-T03) |
| B02 | Account setup status and progression | `get_resident_account_setup_status` parsed by strict `residentAccountSetupStatusSchema` (`registrationOrigin: email_otp \| google \| legacy`); `ensure_google_resident_profile`; `complete_resident_profile`; migrations `0102`–`0108`. | None. | Freeze v1 shape for Android/web. Add an additive provider-aware v2 status (Apple origin, linked identities) as a new versioned function; iOS consumes v2 only. | P03-T03, P04 |
| B03 | `profiles` reads/writes, preferences | `profiles` + locality join; `0081`, `0108` conflict guard. | Unconditional `update` of demographics incl. `city`. | Conditional versioned writes using the existing conflict guard; field-level writable list approved in P03-T04. | P05, P06 |
| B04 | Household (`profiles.household_members` JSON + canonical `household_members` mirror) | Mirror/guard migrations (`0046`, `0052`, `0067`, `0093`/`0094`). | Unused adapter reads canonical table. | Edit only through the reachable profile JSON contract; canonical table is read/attendance-owned; whole-list conditional update. | P03-T04, P05 |
| B05 | ID evidence | `id_submissions`, `profiles.approved_id_submission_id`, `publish_id_submission`; private `id-documents` bucket (`0073`). | None (gate closed). | Immutable versions; signed expiring previews only. | P05, P08 |
| B06 | Catalogue/charter | `document_types` + charter/pricing/purpose rules (`0095`, `0097`, `0101`); shared service schemas. | Reads `document_types.*`, displays `fee_centavos`. | Strict parse of legacy and contract-version-2 shapes; fees via `requestFee`. | P07 |
| B07 | Submission/cancellation | `submit_service_request` + `ResidentSubmissionAttempt` (UUID idempotency); `cancel_own_service_request`. | Direct `service_requests` insert (defective); cancel RPC with reconciliation. | `submit_service_request` only; keep attempt key/payload across unknown outcome; no direct insert. | P08, P09 |
| B08 | SLA tracking | `service_request_sla_tracking`; shared agency SLA calculations (`0099`). | None. | Parse server evaluation time; monotonic foreground projection. | P09 |
| B09 | Payment method/pickup | `set_service_request_payment_method`, `start_pickup_payment`; `payments`. | None. | Resident RPCs only; centavos from server. | P10 |
| B10 | QR PH | `create-payment-source` v12, `check-payment-status` v8, `cancel-payment` v3, `paymongo-webhook` v8, `refund-payment` v4 (admin). | None (gate closed). | Send request/payment IDs only; validate source/expiry/status; refunds never from iOS. | P10 (PR-08) |
| B11 | Incidents | `incidents`, `incident_categories`, `waste_zones`, `incident_confirmations`; `confirm_incident`, `withdraw_incident`. | None. | Resident-safe projections; add an idempotent create contract if P03-T06 finds none. | P12 |
| B12 | Announcements/read states/counters | `announcements`, `announcement_reads`, `incidents.resolved_read_at` (`0080`, `0085`). | Direct `announcement_reads` upsert. | Snapshot-bounded bulk read contract; three independent counters. | P11 |
| B13 | Emergency content/centers | `emergency_information` (`0069` tenant fix), `emergency_qr_content`, `evacuation_centers`. | Reads behind closed gate. | Tenant/version/fetched-time cache envelope. | P13, P14 |
| B14 | Check-in | `evacuation_center_checkins` (`0045`, `0093`/`0094` guards). | None. | Online resident-only authoritative insert/receipt; no queue, no bulk household rows. | P03-T06, P15 |
| B15 | Household QR | `generate-household-qr` v1 (GET, JWT). | None. | Owner-cached PNG; processor decision PR-11. | P15 |
| B16 | Medical drives/registration | `medical_drives`, `drive_registrations`, `register_for_drive`; `residentDriveRegistrationResultSchema`. | Self-only RPC call with reconciliation (gate closed). | Self-only; actual or null prior dose; parse applicant number strictly. | P16 |
| B17 | Email verification | `verify-resident-email` v1; shared client; `0109` invalidation. | None. | Shared client; current-profile-email binding. | P04 |
| B18 | Push tokens/notifications | `upsert_push_token`, `push_tokens` (`0063`). No inbox/outbox/sender. | None. | New versioned inbox/outbox/event contract (P03-T07, P17); token rows bound to owner + environment + device. | P17 |
| B19 | Export | `export-my-data` v1, `last_data_export_at` (`0079`). | None (gate closed). | Versioned complete inventory with per-section status (PR-14). | P18 |
| B20 | Deletion | `delete-my-account` v1, `request_own_account_deletion` (`0074`). | None (gate closed). | Fresh same-account proof, retention matrix, Apple revocation (PR-06/PR-14). | P18 |
| B21 | Help/legal/About | `faq_articles`, `site_content`, `about_us`, `developer_profiles`. | FAQ and `site_content` lists. | Active/approved scoped content; publisher/date fields. | P18 |
| B22 | Maps/geocode/routing processors | Bundled boundary, OSM tiles, Nominatim (`geocode.ts`), OSRM demo `foot` (`osrm.ts`). | None. | Processor approval PR-10; typed finite-coordinate bridge. | P12–P14 |
| B23 | Storage buckets | `request-attachments`, `id-documents` (private), `incident-photos`, `profile-photos`. | None. | Owned immutable paths, `upsert: false`, actual-byte validation. | P02-T05, P05, P08, P12 |
| B24 | Realtime | Android channels on catalogue, requests/payments, incidents/announcements, drives/registrations, profile. | None (iOS refetches on foreground only). | Unique channel per owner/tenant; coalesced refetch; unsubscribe on dispose/account change. | P02-T03 and feature phases |
