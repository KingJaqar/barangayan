# P16 — Health calendar, drive discovery, self-registration and registration history: implementation and verification (2026-10-16)

**Status:** Partially complete (non-device scope, OD-06/OD-07/OD-13). T01–T06 are verified on non-device checks. Self-registration was built behind the `medicalRegistration` gate (G01, G09, G16, G17) and the gate was **opened by owner decision OD-13 (2026-10-16)** for the non-device, non-live scope; G16's two-tenant tests, G01, G17, the race runs (T07) and device/live runs stay open. Source: uncommitted on base `e860743`. No migration, Edge Function, shared-package or Android/web change; nothing was committed, deployed or applied remotely; no registration was written to the hosted project; no screen was run (OD-06, OD-07). No `AGENTS.md`/`CLAUDE.md` conflict was found.

## Entry assessment

Phases 2, 3, 4, 5, 6 and 11 are Partially complete or Verified as recorded in the plan; their open exits (Phase 3 hosted function deploy and invariant run, PR-06, live runs) are carried as blockers, exactly as in Phases 4–15. The iOS workspace already held a minimal scaffold (`health/index.tsx` search list, `health/[id].tsx`, `health/register/[id].tsx` with a comma-separated conditions box, a prior-dose switch with a date picker that defaulted to today, and a consent switch, and a registration call that treated any error as success when a registration already existed).

Baseline before editing (iOS workspace): `tsc --noEmit` 0 errors, `eslint .` 0, `vitest run` 25 files / 533 tests passed.

## Requirement classification (before → after)

| Requirement | Before | After |
|---|---|---|
| A29 calendar/list toggle, month/year chooser, day selection, month-wide view, event dots, 11 categories + All, filters, card facts, empty/loading, refresh on focus, realtime | Partial (search list only) | Implemented, ungated: `health-screen.tsx`, `drive-calendar.tsx`, `drive-card.tsx`, `drive-detail.tsx`, `use-health-data.ts` |
| A29-041 register entry | Plain link | Detail screen decides from drive state, own registration, sign-in and the gate |
| A30 applicant summary, age (profile or manual 0–130), address, profile-edit return, PWD, five conditions + None, dose history, consent, errors, applicant number | Partial/unsafe (free-text conditions, no dose choice, consent only) | Implemented behind `medicalRegistration` (open since OD-13): `register-screen.tsx`, `registration-form.ts` |
| A30 household picker (A30-002/003/005) | Not present | Not built — approved self-only correction (plan §6.5); the screen says so |
| A31 status filter with counts, newest-first pagination, cards, detail sheet, schedule, timeline incl. cancelled, realtime | Not started | Implemented, ungated: `my-registrations.tsx`, `registration-model.ts` |
| §6.5 prior dose | Date picker defaulted to today | 1st dose sends no date; 2nd dose/booster require a real chosen date that has happened; nothing is invented |

## What exists now

- **Data (`resident-api.ts`, `schemas.ts`, `errors.ts`):** `drives(search, { type, from })` (category and upcoming filters, order `drive_date, time_start, id`), `drivesBetween(from, to)` (whole month, read to completion), `drive(id)` (now also `stock_label`/`stock_total`), `myRegistrations(status)` (own rows only, newest first, drive embedded; **no age, PWD, conditions, prior dose or priority score is selected**; a drive of another barangay or one that is not listed becomes `drive: null`), `registrationSummary()` (id, drive, status — counts and "already registered" marks), `registerForDrive()` (see D03). `errors.ts` gains `P0005` (registration closed) and `registration_profile_required`. `CHECK_IN_RECONCILE_SLACK_MS` was renamed `RECONCILE_SLACK_MS` (shared by both reconciliations).
- **Model (`features/health/`):** `drive-model.ts` (Manila date, month arithmetic and grid, categories, dots, availability, stock wording, date/time formatting from parts), `registration-form.ts` (None-exclusive conditions, age from date of birth, validation and payload), `registration-model.ts` (statuses, counts, timeline, per-drive status).
- **Screens:** `health-screen.tsx` (Drives / My registrations via the route's `segment` parameter, Calendar / List, category chips, search), `drive-calendar.tsx` (month grid, month/year sheet), `drive-card.tsx`, `drive-detail.tsx`, `register-screen.tsx`, `my-registrations.tsx` (list + detail sheet). Routes are unchanged; the three route files now render these screens. `BirthdaySheet` gained an optional `title` (used as "Previous dose date"; default behaviour unchanged).
- **Dependencies:** none added.
- **Tests:** `tests/health.test.ts` (39).

## Decisions

- **P16-D01 — `medicalRegistration` was built closed and is open since OD-13.** It needs G01, G09, G16 and G17. The G16 pass condition is a two-tenant, role and negative post-state test on the deployed schema; the hosted project has one barangay and no second tenant, and a registration would write real rows, so none was run. The owner opened the gate for the non-device, non-live scope on 2026-10-16 (OD-13), as OD-09…OD-12 did for other gates; G16, G01 and G17 are not thereby satisfied. With the gate closed the form and the detail's Register action show the "not available" explanation (kept). Browsing and history never depended on it.
- **P16-D02 — registration history and detail are not gated.** They are read-only reads of the resident's own rows.
- **P16-D03 — only a lost reply is reconciled, and only against this attempt.** The old code answered any error by returning an existing registration for the drive as if it had just been made (so "full", "closed" or "already registered" could look like success). Now P0002/P0003/P0004/P0005/22023 and the profile-completion refusal are definite answers with their own wording and no second request; only a transport failure or HTTP 5xx (`unknown-commit`) triggers one read of the resident's own registration for that drive, accepted only if created no earlier than 60 s before the attempt began. Otherwise the screen says it could not confirm and links to My registrations; the write is never retried.
- **P16-D04 — self only.** There is no applicant picker; the card says "You" and that family members cannot be registered from the app. Age comes from the profile's date of birth when it gives 0–130, otherwise the resident types it.
- **P16-D05 — medical answers are memory-only.** No draft, cache or storage is written for the form (the Keychain-backed drafts are not used), so nothing needs purging at logout; the form unmounts with the session scope. The screen says so. Unsaved answers are guarded against accidental back/swipe.
- **P16-D06 — Asia/Manila calendar day.** "Today", closed drives and the prior-dose upper bound use UTC+8 arithmetic (no DST), matching the RPC's `(now() at time zone 'Asia/Manila')::date`.
- **P16-D07 — History omits the resident's health answers and keeps archived rows.** The detail shows applicant number, status, dates and the drive; the typed answers are not re-read. Registrations an administrator archived (`deleted_at`, migration 0115) are still shown, matching Android; whether archiving should hide them from residents is a product question.
- **P16-D08 — cancelled timeline is Pending → Cancelled.** Nothing records that a cancelled registration was ever confirmed, so the timeline does not claim it.
- **P16-D09 — duplicate rule shown honestly.** The RPC refuses any second registration for a drive, including after cancellation, so a cancelled registration shows "Your registration was cancelled" and no Register button.
- **P16-D10 — category arrows (A29-018).** Android's category arrows are replaced by a sideways-scrolling chip row that lists all 12 options and works at every text size.
- **P16-D11 — Android's "Active Medical Drives" = Calendar day results; List = upcoming drives.** The list excludes past drives (they remain in the calendar, labelled closed); search covers title, category, place and an exact date.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` (iOS) | 0 errors (baseline 0) |
| `eslint .` (iOS) | 0 problems (baseline 0; one finding in my own file fixed) |
| `vitest run` (iOS) | 26 files / 572 tests passed (baseline 25 / 533; 39 new in `health.test.ts`); unchanged after OD-13 opened the gate (`config.test.ts` lists it as owner-opened; `health.test.ts` asserts it open) |
| `expo export --platform ios` | exit 0, one Hermes bundle (run twice) |
| Contract tests against the real supabase-js query builder | Drive/month/history/summary query shapes (tenant, active, not deleted, owner, order with id tie-break, explicit columns without health fields); malformed/foreign ids; unknown status → schema failure; guest → session failure; RPC arguments with and without a previous dose; P0002/P0003/P0004/P0005/22023/profile-incomplete wording and single request; lost reply found/old/absent/read failing; HTTP 500 checked once; the write is never repeated |
| Pure-logic tests | Manila midnight and year end; month/year boundaries and clamp; leap February; Sunday-first grid; 12 categories and unknown type → Others; dots (≤3 distinct); 12-hour times; availability (closed beats full); stock wording/bar; None-exclusive; age from date of birth; age 0/130 accepted, 131/blank/negative/fractional/text rejected; first dose sends no date; 2nd dose/booster need a real past date; consent; counts; timelines incl. cancelled |
| Hosted project `pwjbucnyqexiepoinoke`, read-only | `medical_drives` and `drive_registrations` have the columns used (`drive_registrations.deleted_at` exists; not in the shared generated types, not selected or filtered by iOS). `register_for_drive(uuid,int,bool,text[],date)` is executable by `authenticated` and not `anon`, and its body contains the `invalid_age`, `P0004` and `P0005` rules of migration 0121. Triggers present: `a0_require_complete_profile`, `guard_drive_registration_tenant`, `guard_drive_registration_edit`, `guard_registration_archive`, `record_drive_priority_score`. Both tables are in `supabase_realtime`. 12 drives (one barangay), 10 registrations (9 pending, 1 confirmed). Nothing was written. |

Not run: the app on a device or simulator (OD-06, OD-07), any screen (no screen of the app can run, OD-07), VoiceOver, Dynamic Type, a live registration, a two-tenant or role negative test, a stock/capacity/duplicate race against a real database, the realtime channels.

## Acceptance and open items

- **Met (non-device):** A29 controls and outcomes (calendar, list, chooser, dots, categories, filters, facts, empty/loading/error, focus refresh, realtime by code); A31 (filter, counts, cards, detail, schedule, timeline, cancelled, removed-drive handling, no cancel action); A30 form rules, payload, errors and applicant-number handling (tests; gate open since OD-13); no household booking is presented; administrator-only fields are neither selected nor shown.
- **Not met / pending:** G16 on the deployed schema with a second tenant, G01, G17, live race, realtime and device runs (Skipped, OD-06/OD-07). G09 is approved for the non-device scope by OD-13. The phase exit ("A29–A31 and G09/G16 pass on the deployed schema and signed app") is therefore met only for the non-device scope.
- **Plan discrepancies:** A29-018 arrows → scroll chips (D10); A30-002/003/005 household picker not built (corrective, §6.5); A31-012 "bottom sheet" is the page sheet; A52-010 dead modal not copied.
- **Out-of-scope observations (not fixed):** `medical_drives_public_read` has no tenant predicate (a client sees every barangay's active drives; iOS filters by `barangay_id` and checks it again on embedded drives); the policy `drive_registrations_own_cancel` lets a resident set their own pending registration to cancelled by calling the API directly (no app action exists, as required); the hosted `register_for_drive` body does not itself compare the drive's barangay to the caller's (the `guard_drive_registration_tenant` trigger is the control; not tested here); the shared generated types omit `drive_registrations.deleted_at`; Android applies a placeholder `2025-01-01` prior dose and sends no household identity.

## Update — OD-13 (2026-10-16)

The owner opened `medicalRegistration` for the non-device, non-live scope and asked for P16-T02 to T04 to be closed accordingly, with G16's two-tenant tests, G01 and G17 left open. `release-gates.ts` now has it `true`; `tests/config.test.ts` lists it among the owner-opened gates and `tests/health.test.ts` asserts it is open while `householdEditing` stays closed. T02–T04 are Verified (non-device scope). Re-run after the change: `tsc --noEmit` 0, `eslint .` 0, `vitest run` 572/572, `expo export --platform ios` 0. The registration RPC was not called and nothing was written to the hosted project.
