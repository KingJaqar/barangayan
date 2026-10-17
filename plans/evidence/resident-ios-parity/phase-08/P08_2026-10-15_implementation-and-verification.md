# Phase 8 — implementation and verification record (2026-10-15)

Paired documents: `plans/Resident_iOS_Implementation_Plan.md` Revision 1.5 and `plans/Resident_iOS_UI_UX_Design_System_Handoff.md` Revision 2.1 (D06, DX11).
Source revision: base `e860743` plus uncommitted work. Environment: Windows host, iOS workspace `apps/resident-ios-mobile`. No signed build, no app launch, no live backend run (OD-06, OD-07). Nothing committed, deployed or applied remotely.

This is resident iOS Phase 8 (document forms). It is unrelated to the cancelled Android usability Phase 8; no Android UI was changed.

## Scope

P08-T01…T08 (A11; D06). Request detail, tracking and logs are Phase 9; fee assessment, payment and receipts are Phase 10.

## Entry check

| Dependency | State found | Effect |
|---|---|---|
| Phases 2, 7 | Verified (Phase 2) / Partially complete (Phase 7, Logs segment open; closed later the same day by P09-T05, so Phase 7 is now Verified, non-device scope) | Upload, protected-draft, staged-upload and catalogue/readiness adapters reused unchanged. |
| Phases 3–5 | Partially complete; exits carried as blockers (as for Phases 4–7) | The Phase 3 hosted invariant run is still open. Phase 8 needs no migration. |
| Hosted contract (read-only definition/aggregate check, 2026-10-15) | Migrations through `0127` applied incl. `0125`/`0126`; `barangayan_private.submit_service_request` has the legacy-key branch, the `use_approved_profile_ID` charter branch and fee-state logic; `service_requests` has `idempotency_key`, `submission_payload`, `approved_id_submission_id`; active catalogue: 4 version-2 rows (business, certified true copy, first-time job seeker, indigency), 0 legacy rows | The submission contract the form targets is deployed. |
| G04 required-ID gate | Closed (`releaseGates.privateIdUploads = false`) | Only the optional legacy ID photo is behind it; charter requests reuse the already-approved ID and need no upload. |

## Requirement classification (before editing)

| Requirement | Found | Action |
|---|---|---|
| Form for charter and legacy services | `services/request/[id].tsx` was a notes-only form that inserted into `service_requests` directly (`api.createRequest`) | Replaced. `createRequest` and `createdRequestRow` removed (no direct insert remains). |
| Approved ID type/version/previews | Not started | Built (`ApprovedIdCard`, reuses the Phase 5 signed `PrivatePreview`). |
| Conditional fields, purposes, renter/appearance | Not started | Built (`request-form.ts`, `request-screen.tsx`). |
| Supporting files JPEG/PNG/WebP/PDF ≤ 5 MiB, ≤ 10, unique | Phase 2 adapters existed (`pickUploadFile`, `uploadOwned`) and were unused for requests | Reused. |
| Protected drafts | Phase 2 primitives existed | Used for answers and the unconfirmed attempt. |
| `ResidentSubmissionAttempt` | Shared, but its key could not be restored after a restart | Additive shared change (optional constructor key). |
| Receipt | Not started | Built (`/request/received`). |

## Files

- `src/features/services/request-form.ts` — pure model: slots, pruning, purpose reset, payload builders, validation (shared `submissionSchemaForCatalog`), fee note, review lines.
- `src/features/services/request-draft.ts` — protected draft (answers + exact unconfirmed payload with its key), scope/schema-bound.
- `src/features/services/request-submit.ts` — per-file upload (`upsert: false`, staged, resumable) and `sendRequest` over `ResidentSubmissionAttempt`/`submit_service_request`.
- `src/features/services/request-screen.tsx` — the form, review step, locked (unconfirmed) state.
- `src/features/services/request-receipt.tsx`, `src/app/request/received.tsx`, `src/app/_layout.tsx` — durable received screen.
- `src/app/services/request/[id].tsx` — route now re-exports the new screen.
- `src/features/services/document-detail.tsx` (`ApplyBlock`), `src/features/profile/id-screen.tsx` (`PrivatePreview`) — exported for reuse.
- `src/data/resident-api.ts`, `src/data/schemas.ts` — `approvedIdSubmission` added; `createRequest`/`createdRequestRow` removed.
- `packages/shared/src/lib/resident-submission.ts` (+ test) — `ResidentSubmissionAttempt` accepts an optional key (default unchanged). Android/web call it without arguments.
- `tests/request-submission.test.ts` (new, 26), `tests/resident-api.test.ts` (updated).

No new dependency, migration or configuration change.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| P08-D01 | Uploads happen at submit, not at file selection. | A file chosen and abandoned never creates an object; request-attachment storage is not client-deletable (P02-D10), so selection-time upload would manufacture orphans. Per-file states (waiting/uploading/uploaded/failed) are shown; retry sends only files not yet stored. |
| P08-D02 | File bytes are not persisted; answers and an unconfirmed attempt are. | Keychain is unsuitable for up to 50 MiB; a restored attempt references already-uploaded immutable paths, so it needs no bytes. A draft restored before submission asks for the files again. |
| P08-D03 | The unconfirmed attempt (key + exact payload) is written to protected storage before the RPC; the shared class gained an optional constructor key. | The plan requires retaining attempt identity across ambiguous replies; an in-memory key is lost on process termination, which could create a second request. |
| P08-D04 | After an uncertain reply the form is locked to the stored payload ("Retry unchanged", "Check My requests", confirmed "Start a new request"). Only `22023`/`42501`/local validation are treated as definite. | Matches the shared class, which refuses an edited payload after any other failure. |
| P08-D05 | `idempotency_conflict` creates a fresh key. | The key is bound to a different payload on the server; reusing it can never succeed. |
| P08-D06 | The legacy path requires the approved profile ID like the charter path (Phase 7 `applyState`); its optional ID photo is shown only when `privateIdUploads` is open. | A11-006/034; legacy evidence follows the same G04 gate as every ID upload. The server does not require the photo. |
| P08-D07 | Orphan references are staged before upload and linked after commit; no client cleanup is run for `request-attachments`. | The bucket forbids client deletion (P02-D10); discovery is server-side (migration `0124`). |
| P08-D08 | The fee line is informational ("Estimate", "The barangay confirms the amount"); nothing here states a payable amount. | Plan §6.2: submission is not payment; the server assesses. |
| P08-D09 | After commit the app replaces to `/request/received?id=`, which reads the request back. | The reference and status shown are the server's and survive reopening; the form is not re-enterable from the back gesture. |

## Baseline versus final

| Check | Baseline | Final |
|---|---|---|
| iOS `tsc --noEmit` | 0 errors | 0 errors |
| iOS `eslint .` | 0 problems | 0 problems |
| iOS `vitest run` | 207 / 207 | 234 / 234 (26 new; 1 removed, 2 added in `resident-api`) |
| shared `resident-submission` tests | 10 | 11 / 11 (1 new) |
| `expo export --platform ios` | exit 0 (Phase 7 record) | exit 0 |
| Android `tsc --noEmit` | not run at baseline | 3 errors, all in `src/components/external-link.tsx` (TS2859 typed-route union complexity), a file this phase did not touch; none in a file that uses the shared helper |

Typed routes were regenerated with a short Metro start so `/request/received` type-checks; `.gitignore` was restored afterwards.

## Acceptance status

| Criterion | Status |
|---|---|
| A11-001…003 profile completion check, resident name/mobile, Edit in profile | Met (non-device): readiness gate, resident card. |
| A11-004, 024 name and pricing; page-based fee explanation | Met (non-device): informational estimate. |
| A11-005 charter and legacy forms | Met (non-device). |
| A11-006…009 verified ID, type/version, front/back previews, refresh | Met (non-device). Live preview loading not exercised (OD-07). |
| A11-010…014 purpose, cancel selection, explanation + counter, notes | Met (non-device). |
| A11-015…021 business, DTI, HOA, renter/lessor, switch-off clears lessor | Met (non-device): unit tests. |
| A11-022, 023, 025 record reference, copies, appearance acknowledgment | Met (non-device). |
| A11-026…031 choose/display/replace/remove, JPG/PNG/WEBP/PDF, 5 MB | Met (non-device): actual-byte validation is the Phase 2 adapter. |
| A11-032…036 service validation, errors, disabled while unverified, progress, duplicate prevention | Met (non-device): validation and idempotency tested; double activation guarded by single-flight (the component itself is not rendered in tests). |
| A11-037, 045 continue after submission | Equivalent: the received screen (payment is Phase 10, gated). |
| A11-038…044 legacy purpose/notes, chips, ID image choose/preview/replace/validate/upload before create | Met (non-device) for notes and chips; the ID photo is behind the closed G04 gate (P08-D06). |
| T11 every kind/rule, lost reply, interrupted uploads, process termination | Met at unit level; real-backend and device runs Skipped (OD-06/OD-07). |

## Pending manual verification (Skipped — OD-06/OD-07)

On a signed build against a configured backend (PR-03/PR-18 supplied) with a verified resident: (1) request each of the four active services; confirm required fields/files block review; (2) turn "I am a renter" off after choosing a lessor file and confirm the slot disappears; (3) choose a 6 MB file and a `.txt`; confirm both are refused with the limit; (4) enable airplane mode after tapping Submit; confirm the locked state, restore connectivity and confirm "Retry unchanged" shows the same reference and My requests lists one request; (5) force-quit while locked, reopen; confirm the locked state and the same reference after retry; (6) from the admin app revoke the ID mid-form and submit; confirm the specific "approved ID" message and no request; (7) double-tap Submit; confirm one request; (8) VoiceOver and Accessibility XXL over the form, upload cards and review.

## Out-of-scope observations

1. `request/[id].tsx` still shows "Payment and receipt actions" as unavailable; Phases 9–10 own it.
2. Hosted `document_types` has 0 active legacy rows, so the legacy form has no live subject; its server branch exists.
3. `ResidentSubmissionAttempt` throws `Account changed.` for a different signed-in user; the iOS UI shows the locked state because the message has no definite code. Starting a new request resolves it.
4. Android `tsc` reports TS2859 in `external-link.tsx` (typed-route union size); unrelated to this phase.
