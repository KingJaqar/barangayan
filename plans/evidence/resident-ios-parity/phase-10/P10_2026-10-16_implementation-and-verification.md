# Phase 10 — implementation and verification record (2026-10-16)

Paired documents: `plans/Resident_iOS_Implementation_Plan.md` Revision 1.5 and `plans/Resident_iOS_UI_UX_Design_System_Handoff.md` Revision 2.1 (D08, DX14–DX17).
Source revision: base `e860743` plus uncommitted work. Environment: Windows host, iOS workspace `apps/resident-ios-mobile`. No signed build, no app launch, no live backend or processor run (OD-06, OD-07). Nothing committed, deployed or applied remotely; no real payment was made.

## Scope

P10-T01…T08 (A14 payment portion, A15, A16, A17; D08). Owner decision OD-09 (2026-10-16) approved `expo-media-library`, `expo-print` and `expo-sharing` and decided that the `qrph` and `pickup` gates are opened once their flows are implemented and tested. The owner's evidence is the operation of the resident Android app; it is not iOS or settlement evidence.

## Entry check

| Dependency | State found | Effect |
|---|---|---|
| Phase 3 | Partially complete (hosted function deploy, stray history row, invariant run open) | Carried as a recorded blocker, as for Phases 4–9. |
| Phase 8 | Partially complete (T08 live runs Skipped) | Submission and received screens reused. |
| Phase 9 | Partially complete (T07 Skipped) | Request detail, `cancelEligibility` and `requestAmount` reused. |
| Hosted contract (read-only, 2026-10-16, project `pwjbucnyqexiepoinoke`) | All 15 `payments` columns the app selects exist; `service_requests.fee_assessment_state/billable_pages/payment_method/assessed_amount_centavos` exist; `set_service_request_payment_method`, `start_pickup_payment`, `set_service_request_pages`, `cancel_own_service_request` exist; residents have a read policy on `payments` through their own requests and no write policy | Selected columns and RPC names are confirmed, not assumed. |
| Edge Functions | `create-payment-source` v20, `check-payment-status` v16, `cancel-payment` v11 ACTIVE (OD-09 read); their repository sources were read in full | Request/response contracts below come from the source. |
| Fee model | Migrations `0125`/`0126` replaced staff assessment with automatic fees: states are `legacy`, `assessed`, `waived`, `pickup_due`, `page_count_required`; `set_service_request_pages` is a resident RPC | The Phase 10 plan wording "assessment" is implemented as these server states; residents never assess. |
| Repository instructions | `AGENTS.md`: Expo SDK 57 docs, migration naming, cancelled Android Phase 8 | SDK 57 pages for MediaLibrary, Print, Sharing and FileSystem were read; no migration; no Android change. No conflict with the plan. |

## Requirement classification (before editing)

| Requirement | Found | Action |
|---|---|---|
| Amount/assessment states | Fee line on the request detail only; `Unavailable` placeholder for payment | `assess()` model and the assessment screen. |
| Method selection, pickup | Not started | Payment screen, `setPaymentMethod`, `startPickupPayment`, `setBillablePages`. |
| QR PH create/check/cancel | Not started | Function client, session state machine, QR screen. |
| Payment-attempt cancellation | Request cancellation only; a note said to cancel the payment first | Cancel-payment action (QR screen and request detail), reconciled. |
| QR save to Photos | Not started | `saveQrToPhotos` with add-only permission. |
| Receipt and PDF share | Not started | Receipt screen from the committed paid payment; PDF and share. |
| Gates | `qrph`, `pickup` false | Opened after implementation and tests (OD-09). |

## Files

- `src/features/payments/assessment.ts` — pure assessment/eligibility model, page-count validation.
- `src/features/payments/qr-functions.ts` — the three Edge Functions: identifier-only requests, strict response parsing, server-message → stable code mapping, QR image source validation.
- `src/features/payments/qr-session.ts` — QR PH attempt state machine (epoch-guarded replies, reconciliation, expiry grace, check-failure pause) and `resolveCancel`.
- `src/features/payments/use-qr-session.ts`, `use-countdown.ts`, `countdown.ts` — focus/foreground-bound polling, realtime refresh signal, foreground countdown.
- `src/features/payments/payment-screen.tsx`, `qr-screen.tsx`, `receipt-screen.tsx`, `request-payment.tsx` — screens and the request-detail payment actions.
- `src/features/payments/receipt.ts`, `native-actions.ts`, `native-bindings.ts` — receipt model/HTML, Photos save and PDF share logic (injected dependencies), device adapters.
- `src/app/services/payment/[requestId].tsx`, `pickup/[requestId].tsx`, `qrph/[requestId].tsx`, `success.tsx`; four `Stack.Screen` entries in `src/app/_layout.tsx`.
- `src/data/resident-api.ts`, `src/data/schemas.ts` — `setPaymentMethod`, `startPickupPayment`, `setBillablePages`, `paymentAttempts`, `openQrAttempt`, `paymentStatus`, `paidReceipt`; `service_kind` added to the request detail embed.
- `src/features/services/request-tracking.ts` — `requestAmount` extracted from `feeLine` (behavior unchanged); `request-detail.tsx` shows `PaymentActions` instead of the placeholder.
- `src/lib/errors.ts` — resident copy for the payment RPC and function codes.
- `src/lib/release-gates.ts`, `tests/config.test.ts` — `qrph` and `pickup` opened (OD-09); the test now asserts exactly those two are open.
- `app.config.ts`, `package.json`, root `package-lock.json` — dependencies and the add-only Photos purpose string.
- `tests/payments.test.ts` (new, 62).

## Dependencies

| Package | Declared | Why |
|---|---|---|
| `expo-media-library` | `~57.0.3` | Add-only save of the QR image to Photos (A16-013…018). |
| `expo-print` | `~57.0.1` | PDF receipt from committed payment data (A17-011). |
| `expo-sharing` | `~57.0.13` | Native share sheet for the PDF (A17-012). |

Approved by OD-09. The root lockfile already resolved these three versions for Android; the lockfile diff is the three workspace declarations only, and no resolved version changed. `npm ls` reports 57.0.3 / 57.0.1 / 57.0.13 for the iOS workspace. `expo config --type introspect` shows `NSPhotoLibraryAddUsageDescription` and no `NSPhotoLibraryUsageDescription`.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| P10-D01 | Opening a payment screen records nothing. Pay at pickup is recorded only by its button (Android's pickup route auto-started on open). | F03: a deep link or a reopened screen must not write; one explicit, single-flight action. |
| P10-D02 | The amount comes from `requestAmount` (paid, else pending ledger row, else the request's committed assessment/legacy snapshot). `pending` shows no peso value. | Plan §6.2, D08: pending is never free; version 2 never uses today's catalogue fee. |
| P10-D03 | QR is created only when the request is payable, not pickup-only, at least ₱1.00, method `qrph`; otherwise the screen explains why and offers the payment options. A wrong method is changed by an explicit button. | The server enforces the same rules; the client does not spend a provider call to be told no. |
| P10-D04 | The device clock never decides expiry alone: after the device time passes `expires_at` the QR keeps being checked and is closed when the provider says expired or after a 2-minute grace. | The server's expiry is epoch milliseconds from the server clock; a fast device clock must not close a payable QR. |
| P10-D05 | A lost creation reply is reconciled from the stored pending attempt (or a paid record) before anything is shown; `create-payment-source` is also idempotent (resumes the open QR). | A16-006/007, F03. |
| P10-D06 | Automatic checking stops after 5 consecutive failures; a manual "Check payment now" resumes it. | Defined retry limit; no silent endless polling. |
| P10-D07 | Cancelling a payment never cancels the request; a payment that settled during the cancel is reported as paid; an unreadable result is reported as "could not confirm", never as cancelled. | A14-007…011. |
| P10-D08 | Save to Photos writes the provider's QR image as given (PNG bytes verified by signature, ≤ 2 MiB) under `Barangayan-QR-<reference>.<ext>`. The Android framed capture (`react-native-view-shot`) is not ported. | No new dependency; the saved image scans identically. The reference is in the file name. |
| P10-D09 | The share sheet's result is reported neutrally ("share sheet closed"); a rejection is a failure message. Unavailable sharing is explained, and files are deleted either way. | `expo-sharing` documents no cancel result; iOS has no user-visible cache path to quote (A17-013 adaptation). |
| P10-D10 | The receipt is also available for a staff-collected pickup payment (Android linked it only from the QR flow). | A17 "load the confirmed receipt"; the committed paid record is the same source. Reopened paid requests link to it from the request detail. |
| P10-D11 | The PDF contains text only (no image), so the iOS local-image limitation does not apply; the HTML helper documents the data-URI rule for any future image. | Smallest correct change. |
| P10-D12 | `qrph`/`pickup` opened in code with the OD-09 comment; `check:release` still fails on the other closed gates and on missing release configuration. | Owner decision; no other gate changed. |

## Baseline versus final

| Check | Baseline (before Phase 10) | Final |
|---|---|---|
| iOS `tsc --noEmit` | 0 errors | 0 errors |
| iOS `eslint .` | 0 problems | 0 problems |
| iOS `vitest run` | 258 / 258 (17 files) | 321 / 321 (18 files; 62 payments + 1 gate test added) |
| `expo export --platform ios` | exit 0 (Phase 9) | exit 0, 1665 modules |
| `expo config --type introspect` | — | add-only Photos key present, no library-read key, camera/location unchanged |

Android and web were not touched (no shared-package change), so no Android/web regression run was needed. Typed routes were regenerated with a short `CI=1 npx expo start`; the `.gitignore` line it appends was reverted.

## Acceptance (A14 payment, A15, A16, A17)

All items below are Verified (non-device scope, OD-06/OD-07) unless noted: logic, schema, adapter and fault tests; no screen was rendered or run.

| Checkpoints | Result | Locator |
|---|---|---|
| A14-007…011 | Cancel a pending QR attempt separately, with confirmation, settlement race → paid, lost reply reconciled, new attempt allowed, action chosen by outstanding payment state | `qr-session.ts` `resolveCancel`; `request-payment.tsx`; tests "cancelling one payment attempt" |
| A15-001…004 | Fee state/basis/amount, refresh, retry | `assessment.ts`; `payment-screen.tsx` |
| A15-005…009 | Pickup, QR PH (gated, eligible), method saved, pickup started, existing workflow continued | `payment-screen.tsx`, `resident-api.ts` |
| A15-010…014 | Open request, back to Services, errors with copy, single-flight, no-payment cases | `payment-screen.tsx`, `errors.ts` |
| A16-001…012, 019, 020 | Create/resume, countdown, expiry, monitoring, success, cancel, errors, no actions for paid/closed | `qr-session.ts`, `qr-screen.tsx` |
| A16-013…018 | Save with add-only permission, denial/blocked explanation, progress, confirmation, failure | `native-actions.ts`, tests |
| A17-001…009, 016…018 | Committed receipt fields, PHP money, track, retry, return | `receipt-screen.tsx`, `receipt.ts` |
| A17-010…015 | PDF generation, share sheet, unavailable message, progress, errors | `native-actions.ts` |

## Not run / open

- **P10-T04** has no iOS code. Owner approval of G05/G06 is recorded (OD-09). Webhook signature/replay/idempotency, reservation concurrency, processor settlement and the operating owner are **not evidenced** by this plan (PR-08, PR-09 stay open facts).
- **P10-T08** end-to-end resident/staff/processor journeys: Skipped (OD-07).
- Skipped (OD-06/OD-07): Photos permission prompt, share sheet, PDF rendering on a device, QR rendering and scanning, real PayMongo QR, keyboard/VoiceOver/Dynamic Type runs.
- Gates G05/G06 are approved by the owner for the non-device, non-live scope only; G01, G17, G19, G20 are not claimed.

## Out-of-scope observations (not changed)

- `check-payment-status` and `cancel-payment` mutate `payments` through `service_role` without a per-attempt lock beyond status predicates; webhook behavior was not inspected.
- The Android `request-tracking` screen shows `Pay Now with QR PH` only while `PAYMENT_SETTLEMENT_READY` is true at build time; the iOS gate is a source constant (`releaseGates.qrph`).
