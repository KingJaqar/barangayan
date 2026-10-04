# Phase 4 — Resident document journey and payments

Verdict: **complete**. Phase 2 and Phase 3 passed their gates before the next phase began. Work stops at Phase 4. All verification used disposable local databases and synthetic residents; nothing was deployed or written to production.

## Requirement and exit-gate evidence

| Assigned requirement | Complete behavior | Evidence |
|---|---|---|
| Charter screens and preserved resident details | Eleven readable charter sections on Android details, web drawer and standalone details, including explicit missing CTC personnel; Resident Details and Edit in Profile retained | Four-service UI journeys below; source charter reconciliation and Phase 3 report; final web builds and Android export |
| Purpose and conditional requirements | Configured dropdowns; Others requires a trimmed explanation of at most 1,000 characters, separate from notes; business name/address/DTI; alternative HOA evidence; renter lessor endorsement; CTC reference/copies; appearance acknowledgment | Shared validation tests, actual API rejection tests and UI forms/uploads; `browser-service-switch.png`, `android-service-switch.png` show clean purpose, fields and copies after switching |
| Private supporting uploads | JPG/PNG/WebP/PDF, nonempty and at most 5 MB each; immutable owner paths; actual stored metadata validation and owner/same-tenant staff access | Actual Storage upload/download and rejection tests in `http-1791025919676`; Android PNG and PDF picker journeys; eight-journey stored-object audit |
| Verification states and approved-ID reuse | Persistent missing/pending/failed warnings, verified indicator and approved ID type/front/back previews; direct routes blocked; publication/review refresh; current approval checked transactionally | Web and Android missing/pending/failed screenshots; approved evidence visible in eight forms; requests reference version 1 with no request-level ID upload; audit proves those references survive publication/approval of version 3 |
| Verify Now and account isolation | Web focuses `upload-valid-id` after load; Android waits for loaded content and focuses Upload Valid ID using the RN 0.86 accessibility API; profile cache, pending replies and retained Services stack scoped to account | Browser active-element inspection; actual TalkBack heading-focus screenshot `android-id-focus-talkback.png`; logout/second-account UI, `android-final-account-safe.png`; shared scope tests and HTTP isolation checks |
| Every submission path shares the transaction | Primary web drawer, standalone web form, older resident portal, and Android routes use the shared submission operation; owner-scoped stable idempotency; legacy consumers preserve V1 shape and original fees | Actual older-portal submission `39f75892-ef80-4383-ae54-9ba86c753dbe` completed with waiver; `browser-older-portal-waived.png`; API concurrent V2 and V1 submissions, changed-retry denial, direct-insert/forged-identity/foreign-file/inactive-service denial |
| Assessment and request-level payments | Awaiting assessment blocks payment; positive assessment or explicit waiver controls UI; CTC uses total confirmed pages without multiplying again by copies; pickup reservation/collection are controlled operations; receipts/logs read recorded ledger amounts | All eight journeys; CTC copies=3, total pages=4 produces ₱40; `browser-recorded-receipt.png` ignores forged URL amount; final HTTP and production provider-handler tests |
| Retry, concurrency and failure recovery | Stable upload paths compare saved bytes after lost replies; unchanged submissions recover the same reference; one active payment; assessment frozen after payment starts; exact PHP amount validation; signed duplicate settlement preserves paid time and recorded refunds | Ten submission-helper tests; 299 API assertions; 19 provider-handler assertions including provider failure, concurrent reservation/polling and webhook retry; actual interrupted local REST request followed by successful Android Retry (`android-offline-error.png`, `android-offline-recovered.png`) |
| Exit gate | All four services complete submission, staff requirements/eligibility/appearance review, assessment, pickup payment or waiver, readiness and release on both web and native Android; bypasses and duplicate creation fail | Eight actual UI journeys reconciled to stored requests, evidence, private objects and ledger in `ui-audit-1791025320772.json`; final API/provider suites |

All Phase 4 evidence paths in this report are relative to `plans/evidence/phase4/` unless otherwise stated.

## Eight completed UI journeys

| Service | Web request | Android request | Recorded outcome on both |
|---|---|---|---|
| Business clearance | `4c92aa99-0337-4b49-8347-e65571ee3fe9` | `131b0e41-8e14-4139-9f84-60de8f83df37` | Completed; ₱125 assessment paid once at pickup; private DTI PNG |
| Indigency | `ebb5efea-d86d-4a15-bb00-4d6bbd2f54e9` | `5f34a903-f827-41fe-bb5b-1897f8919c1a` | Completed; ₱100 assessment paid once; renter with HOA PNG and lessor PDF |
| First Time Job Seeker | `f8882737-6b2b-4cc9-846d-987554ccd2a8` | `43c66c35-745d-46be-9c3a-64259e3d2771` | Completed; eligibility confirmed; explicit exemption/waiver; no payment row |
| Certified True Copy | `1e3d98a8-ffee-4846-9320-281cc64ff01b` | `1dd1ebc5-aed8-4398-aa24-634d4363efaa` | Completed; three copies, four total confirmed pages; exactly ₱40 paid once |

The UI audit was saved before the final disposable database reset. Requests were created through the actual resident UI. Business review/assessment/collection/release was also exercised through the administrator browser; the remaining staff actions used the same authenticated production RPCs. Synthetic files prove transport, access and validation; they do not represent official DTI or residency certification.

## Final checks

- **125 shared tests** pass, including submission recovery, catalog, ID scope and foundation contracts (`final-checks/shared-tests.log`).
- Shared, resident web and admin web typechecks and both web linters pass in `final-checks`; final Android typecheck, lint, export and SDK compatibility pass without lint warnings in `final-retry-clean`.
- Both web production builds pass (`final-builds`). The Android production JavaScript/Hermes export passes; native UI used official Expo Go SDK 57 on the Android 36 emulator.
- Three changed payment Edge handlers pass native Deno typechecking (`edge-types-repaired.log`). Runtime dependencies were resolved in the isolated Deno cache rather than changing application dependencies.
- Final local migration reset passes (`plans/evidence/phase2/local/reset-1791025880789.json`); **199 database assertions** pass (`test-1791025908767.log`).
- Real local Auth/Storage/PostgREST checks pass: **71 Phase 2** assertions (`plans/evidence/phase2/http-1791025908963/results.json`), **121 Phase 3** (`plans/evidence/phase3/http-1791025914745/results.json`), **299 Phase 4** (`http-1791025919676/results.json`).
- **19 provider-contract assertions** pass (`provider-1791025925559/results.json`): production handlers and real Auth/database, with only PayMongo HTTP stubbed. No external charge occurred.
- Empty and representative existing migration rehearsals pass, with seven-table historical reconciliation and other-tenant preservation (`plans/evidence/phase3/phase4-rehearsal-final`).
- Database advisors report **zero errors**, retaining 60 previous warnings: 24 RLS initialization, 29 permissive-policy and seven mutable-search-path findings (`plans/evidence/phase2/local/advisors-1791025932636.log`).
- Final diff whitespace check passes. Protected original migration 0094, Claude settings, source PDF and main-plan hashes remain unchanged (`preservation-final.json`); existing Phase 1 work remains present. Browser error checks returned none.

Earlier failed checks remain saved. The restricted baseline test-launch issue was resolved with authorized filesystem access. Final SDK validation exposed the original `react-native-view-shot@5.1.1` mismatch; the existing Android dependency is now pinned to Expo SDK 57's recommended **5.1.0**, and the Android checks pass. A final service-navigation review added account-change remounting and explicit request-list recovery. The native preview cache was restarted after dependency installation; the subsequent native failure/recovery check passed. No types, validation, authorization or tests were weakened.

## Decisions, operational setup and limits

Unclear charter fees remain staff assessments, and eligible job seekers receive an explicit recorded exemption. HOA remains alternative/supplementary evidence. Legacy requests retain recorded ledger amounts first, then their original request fee snapshot. A payment attempt, including a failed attempt, freezes the assessment to protect retry amounts. New immutable upload objects remain available for safe retry and the established account-deletion cleanup.

Production rollout remains separately authorized. Apply saved additive migrations in order with compatible web, administrator and Android consumers; do not activate the new catalog against older incompatible clients. Live QR PH requires the existing merchant secrets, signed webhook registration and settlement-ready flag; leave the flag disabled until configured. Pickup and waivers work independently and were exercised end to end. Real merchant settlement and a signed Android release build were not exercised; these are release/provider checks, not evidence of a live charge. The existing Expo Go push-notification limitation is unrelated to this phase.

No Phase 2–4 requirement or exit-gate condition remains unmet. Phase 5 timing evaluation/displays/reports, Phase 6 OAuth/maps, and later privacy/usability/release phases were not implemented.
