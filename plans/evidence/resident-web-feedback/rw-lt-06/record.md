# RW-LT-06 — Services, request journey, and payments

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local"). No credentials, tokens, OTPs, or real resident records are in this folder (scanned: no JWT, provider key, or generated-password strings). Request submissions, pickup records, and receipts use the real local database with synthetic rows that every scenario restores (a restore step runs after every scenario; I confirmed afterwards that the fixture request, payment, and document-type counts and the table grants were back to their starting state). The PayMongo Edge Functions (`create-payment-source`, `check-payment-status`, `cancel-payment`) are fulfilled in the browser: no provider call, charge, or provider payment row was made.

## 1. Preconditions and inputs

- RW-LT-05 is complete ([record](../rw-lt-05/record.md)). I re-read the repository `AGENTS.md` (Android Phase 8 stays cancelled and untouched; sequential migrations), `apps/resident-web/AGENTS.md`, and the full plan.
- Expo v57 docs (https://docs.expo.dev/versions/v57.0.0/) were re-read: SDK 57 only; nothing applies to the Next.js resident web and no Expo code is touched. Installed Next.js 16.3 guides for `loading.js`, `error.js`, and `useLinkStatus` were applied as in earlier phases (route fallbacks sit below the persistent shell; boundary Retry is read-only).
- Verified against installed sources: `@supabase/postgrest-js` reports a failed/aborted fetch as `status: 0` with an empty error `code`; `@supabase/functions-js` reports one as `FunctionsFetchError`; Storage wraps it as `StorageUnknownError({ originalError: TypeError })`. Classification reads those structures, never message text.
- Contracts read before editing: `ResidentSubmissionAttempt` (one idempotency key per form instance; a retry of an unchanged form recovers the same request), `start_pickup_payment` / `barangayan_private.pickup_payment` in migration `0098_phase4_resident_submission_payment.sql` (reuses the request's pending/paid pickup payment and only inserts when none exists), `cancel_own_service_request` (raises human-readable text or `snake_case` tokens), and the payment hook's polling/cancel race guard (kept verbatim).
- Working tree: unrelated admin-web, Android, iOS, migration, and other-plan changes were left untouched. **No backend change, migration, admin-web/Android/iOS edit, or new dependency was needed; no backend exception was recorded.** The highest migration prefix was not touched.
- A route handler `app/auth/email-change/route.ts` appeared from concurrent account work after the RW-LT-00 inventory; it is recorded in `coverage.json` under RW-LT-08 (server redirect, no loader/toast) so the reconciliation passes.

## 2. Changes (apps/resident-web/src)

| File | Change |
|---|---|
| `lib/service-feedback.ts` (new) | Pure classification and wording: `isNoAnswer` (status 0 / empty code / `FunctionsFetchError` / `AbortError` / wrapped `TypeError`), `isMissingRow` (PGRST116), submission / pickup / payment-method / cancel-request failure wording. Raw tokens (`request_not_payable`…) and provider text never reach the page; function-written sentences pass through. |
| `hooks/use-paymongo-source.ts` | Polling interval, cancel race guard, resume, and Realtime wiring untouched. Poll errors are caught (previously an unhandled rejection inside `setInterval`) and exposed as a display-only `statusCheckFailed`; `cancelPayment` returns an `outcome` (`cancelled` / `paid` / `rejected` / `unconfirmed` / `ignored`) next to the existing `ok`/`error`, clears a stale error at the start of a cancel, and treats a lost response as unconfirmed (it resumes watching instead of claiming failure). |
| `components/services/document-request-modal/qrph-step.tsx` | D-14: a refused or unconfirmed cancel is toasted once and kept as persistent guidance in the pending view. `Payment received.` is announced once per payment attempt (`eventId('payment', paymentId, 'paid')`), confirmed expiry once (`…'expired'`); a poll and a Realtime event observing the same transition notify once. A cancel that loses the race to payment shows only the paid outcome. Countdown at zero is a display note ("expiry time has passed… still confirming"), never an expired/failed claim. Steady 256 px (square, `max-w-full`) placeholder with one polite "Generating your QR code…" announced outside the frame, so the frame height never changes. |
| `components/services/document-request-modal/payment-method-step.tsx` | D-04: synchronous repeat guard, thrown/lost responses handled, "Saving your choice…", refused/unconfirmed → one toast + persistent plain guidance. The false `Request submitted.` toast is gone (the request was submitted earlier; the next step is the confirmation). |
| `components/services/document-request-modal/pickup-step.tsx` | D-13: `start_pickup_payment` verified idempotent (see §1), so the on-mount write is guarded to once per mounted request, outcomes are inline (the step is its own confirmation), a Retry control and token-free wording were added, and a lost response says retrying creates no second record. |
| `components/services/document-request-modal/success-step.tsx` | Receipt read states: skeleton + one polite status / ready / not-confirmed / error; thrown reads settle; **Retry receipt is a select only** and persistent guidance says not to pay again. |
| `components/services/request-payment-journey.tsx` | D-06: built on `useScopedRead` — the 10 s poll and focus refresh are unchanged but a failed refresh keeps the assessment with a warning and Try again; an initial failure is an inline error; obsolete responses are dropped. A background refresh that observes `paid` no longer swaps the QR/receipt step for a bare summary (only when the QR step was engaged for an unpaid request; opening the QR route for an already-paid request still shows the paid summary and never mounts the step, so no attempt is created). |
| `components/services/document-request-modal/document-request-modal.tsx`, `details-step.tsx` | Identity-scoped service read (ready / unavailable / error with Retry; an older response never replaces a newer selection; a failed re-read keeps an already-loaded service), "Checking your account…" pending with a single-flight guard and an inline failure that no longer masquerades as a service-load error. **Per the owner's request the panel is back to the request-drawer shell** (Radix `modal={false}`, `forceMount` + framer-motion slide with the shared drawer tokens, document-icon title, X close, 4-segment stage bar), including the `onOpenAnimationComplete` hand-off after the slide so the catalog grid collapses to one column only when the panel has settled. |
| `components/services/resident-service-form.tsx` | Real stage labels ("Checking your details…" → "Uploading file n of m…" / "Uploading your ID…" → "Submitting your request…", no percentage), one polite status, validation inline only (no toast, nothing sent), refused / lost / upload failures → one toast + persistent guidance, retry of an unchanged form goes through the idempotent attempt (no duplicate), and a success toast only when the form was closed while the submission completed. |
| `app/(resident)/services/requests/[requestId]/request-tracking.tsx` | Cancel request / cancel QR payment: attempt IDs, synchronous repeat guards, confirmed / refused / lost / paid outcomes through the notify adapter; unconfirmed outcomes re-read the request read-only; quiet refresh failures keep the last request and no longer erase a known pending payment; Pay Now has a pending state. |
| `components/services/agency-sla-status.tsx` | A failed refresh keeps the last valid clock marked out of date; loading is announced on the tracking page. |
| `app/(resident)/services/{documents,logs,requests}/page.tsx`, `[documentId]/page.tsx`, `requests/[requestId]/page.tsx`, `requests/new/[documentId]/page.tsx`, `payment/**/page.tsx` | A failed server read shows `ReadFailure` (read-only Try again) instead of a false empty state or a 404; only a genuinely missing/inaccessible record (PGRST116) is `notFound()`. `requests-list.tsx` gains `hideEmpty` so a failed list is not presented as empty while `?open=` still works. |
| `app/(resident)/services/{[documentId],requests/[requestId],requests/new/[documentId],payment}/loading.tsx` (new) | Route-specific detail / form / payment fallbacks below the persistent shell (RW-LT-03 left these variants unconsumed). |
| `components/services/documents-list.tsx`, `requests-list.tsx` | Bounded entrance (first six cards only). |
| `scripts/resident-web-feedback-regression.cjs` | Adds `rw-lt-06:build`, `rw-lt-06:unit`, `rw-lt-06:verify <run>`; `mockRealtime.push` can carry a record. Two earlier scenarios were re-pointed because the product changed intentionally (card wrapper selector; the tied-`created_at` fixture ordering that the earlier detail-route routes assumed). |

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint | **Pass**: 0 errors; the same 2 inherited warnings (location-verification) | [checks/lint.txt](checks/lint.txt) |
| Production build | **Pass** (exit 0), `tsconfig.json` restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-06:unit` (classification, wording, event dedup against the real adapter, ownership/contracts) | **5/5 pass** | [unit-results.json](unit-results.json) |
| `rw-lt-06:verify run-2` (24 scenarios, 80 checks, production build, Chrome) | **24 pass, 0 fail, 0 error** | [run-2/results.json](run-2/results.json), [screens](run-2/screens/) |
| RW-LT-00 baseline journeys rerun | **20/20 executed, 0 errors**; D-01, D-02, D-03, D-07 (household), D-14 and the login abort no longer reproduce; D-12 (notification toggle, RW-LT-08) still does | [baseline-regression/results.json](baseline-regression/results.json) |
| RW-LT-01 / 02 / 03 / 04 / 05 reruns | **13/13, 10/10, 15/15, 18/18, 28/28**; unit reruns RW-LT-02 8/8 and RW-LT-05 4/4 | [01](../rw-lt-01/rerun-after-rw-lt-06/results.json), [02](../rw-lt-02/rerun-after-rw-lt-06/results.json), [03](../rw-lt-03/rerun-after-rw-lt-06/results.json), [04](../rw-lt-04/rerun-after-rw-lt-06/results.json), [05](../rw-lt-05/rerun-after-rw-lt-06/results.json) |
| Inventory reconciliation | **Pass** (every entry assigned to one phase) | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

Process notes (honest account): the first full run ([run-1](run-1/results.json), kept for the record) had 18 pass, 5 fail, 1 error and crashed its own cleanup once. Product findings fixed from it: the QR loading frame was 36 px taller than the finished QR (the status label sat inside the frame); opening the QR route for an already-paid request would have mounted the QR step after my first paid-refresh fix (now guarded and covered by the revisit scenario); the QR was not square at 320 px. The rest was test harness: the cleanup missed the `legacy_submission_keys` foreign key, an auth-call count that included unrelated `getUser` calls, a Realtime event pushed before the paid row existed, `window.next.router.push` without a prefetched fallback, guarded routes that redirect when REST is stopped (those reads are now failed with a returned permission error and the grants restored exactly), and a regex that lost its backslash. Two earlier-phase scenarios were re-pointed (see §2).

### Scenario results (run-2)

| Scenario | Observed |
|---|---|
| catalog-modal-read-states | Slow: matching skeleton + one polite "Loading service…" + aria-busy; failed re-read keeps the loaded service; first-read failure → inline error + read-only Retry; missing record → unavailable view with a way back; transport failure settles. |
| catalog-rapid-selection-obsolete-response | A 2.5 s response for the first document never replaces the second selection. |
| request-check-pending-and-failure | "Checking your account…" disabled + aria-busy immediately; repeated activation adds no account check; a failed check is an inline message (not the service-load retry), control restored, no toast. |
| request-form-outcomes | Validation: inline, no toast, zero requests. Refused: one toast, guidance, input retained, control restored. Lost response: one unconfirmed warning, one call, nothing created, "won't create a duplicate" + My Requests. Slow + repeated activation: one write, one request, immediate stage label, no toast. |
| request-form-upload-stages | Failed upload: one toast, files kept, no request, no provider text; retry completes with one request; stages named truthfully ("Uploading your ID…" → "Submitting…"), no percentage. |
| requests-list-and-drawer | ≤ 6 entrance reveals; missing record → unavailable; failed read → error + Try again → recovers. |
| tracking-cancel-request-outcomes | Refused text passes through; lost response → one unconfirmed warning, one call; confirmed + repeated activation → one call, one success. |
| tracking-cancel-payment-outcomes | Refused → provider reason; lost → unconfirmed; paid wins → "already completed", never "cancelled"; confirmed → one success and the request-level control returns. |
| payment-method-and-pickup | Refused / lost wording ("Nothing was charged"); repeated activation → one method write, pickup recorded once, no toast; **reopening and reloading the pickup step leaves exactly one pickup row (D-13)**. |
| pickup-failure-and-retry | Persistent alert + Retry, Done disabled, no toast, no raw token; retry records once; lost response → uncertain wording, one call. |
| qr-generation-geometry-and-announcement | Steady 256 px placeholder, one polite status, identical frame height before and after. |
| qr-paid-poll-and-realtime-overlap | One "Payment received." toast; real local paid row → confirmed receipt; one create call; a later background refresh does not replace the receipt; leaving the page stops polling. |
| qr-paid-during-cancellation | One paid outcome, never a cancellation toast; receipt reached. |
| qr-cancel-failure-and-guidance | D-14: refused cancel → toast + guidance that survives the toast, QR stays, control restored; lost → unconfirmed + still watching; confirmed → one success and back to the method step. |
| qr-expiry-and-connectivity | Countdown at zero: no expired/failed claim, no toast, QR and Cancel remain; server-confirmed expiry (poll + Realtime) → one warning and persistent guidance with a request link. |
| qr-status-check-connectivity | Failing checks: persistent "don't pay again" note, content intact, no toast; recovers quietly. |
| qr-creation-failures | Provider refusal → alert with the reason + Go Back; transport failure settles; one create call each. |
| receipt-read-only-retry-and-revisit, receipt-step-retry-is-read-only | Revisiting a paid request or the receipt page: no create call, no toast, no writes; receipt read failure → guidance + Retry that issues no write or function call. |
| payment-journey-refresh-failure-retains-content | D-06: refresh failure keeps the method choices with a warning; Try again clears it; initial failure → error with retry. |
| server-read-failures | REST stopped (catalog, document detail) and returned permission errors (requests, logs, tracking, payment, receipt): every page shows a retryable notice — no empty state, no 404, no toast; grants restored exactly; another resident's request is still a not-found page. |
| route-fallbacks | Prefetched detail / form / payment fallbacks show one polite status and a placeholder under the single persistent header; navigation makes no writes. |
| narrow-320-and-reduced-motion | No horizontal overflow; QR square and equal to its placeholder; placeholder static under reduced motion. |
| account-change-suppresses-payment-outcome | A cancellation completing after sign-out never toasts for the next visitor. |

## 4. Exit gate

| Criterion | Result |
|---|---|
| Failed request creation retains valid input | **Met** (refused/lost/upload scenarios keep notes and the chosen file). |
| Missing drawer records settle | **Met** (request drawer and service modal unavailable views). |
| A lost response does not cause automatic duplicate submission | **Met** (one call; idempotent retry yields one request). |
| Overlapping poll/Realtime events notify once | **Met** (browser + unit event-ID tests). |
| Payment completing during cancellation never shows cancellation success | **Met** (modal and tracking page). |
| Receipt revisit/retry never creates a charge or a historical toast | **Met** (read-only retry; no create/status/write calls). |
| Local end-to-end request/receipt checks and production build pass; no real payment | **Met** (real local rows; provider functions mocked). |
| Typecheck/lint | **Met** (0 errors; 2 inherited warnings). |

Phase status: **Complete**, subject to the limits below.

## 5. Not verified / carried forward

- **Live PayMongo.** QR creation, status, and cancellation are browser-fulfilled; a sandbox end-to-end payment (and the webhook→Realtime path ordering) needs sandbox/manual evidence in RW-LT-09. Local Realtime is down, so Realtime events use the in-browser protocol stand-in.
- **Real-device and assistive technology.** No manual screen-reader pass (DOM-level `role=status`/`role=alert` checks only); Chrome only (no Firefox/Safari/iOS web); no 200% zoom pass; the slide-in drawer's focus order was not manually walked.
- **`ConfirmDialog` shared behavior unchanged.** Services consumers never reject; the report-withdraw consumer is reviewed in RW-LT-07. Its dialog closes in `finally` regardless of outcome (outcome toasts and inline guidance carry the result).
- **`qrph-payment.tsx` is still dead code** (no import); not migrated, not removed.
- **Fixture ordering.** The fixture requests share a `created_at`, so list order is arbitrary after updates; earlier-phase scenarios that assumed an order now match any request id.
- **Hard-load fallbacks** for the new detail/form/payment routes are observable only through client navigation with a prefetched fallback locally (streamed hard-load fallbacks remain unobservable here, as recorded in RW-LT-03).
- **Remaining defects owned elsewhere:** D-03 incident/register drawers (RW-LT-07), D-04 report submit/withdraw (RW-LT-07) and location save (RW-LT-08), D-06 my-incidents/FAQ, D-11 export/PDF, D-12 notification toggle and profile validation toast (RW-LT-08).
- **Production readiness** is not claimed. Broader qualification remains pending under RW-LT-09, and nothing was deployed.
