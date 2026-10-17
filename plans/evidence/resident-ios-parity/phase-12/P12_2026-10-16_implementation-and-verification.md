# P12 — Concern forms, photos, location, detail, corroboration and withdrawal: implementation and verification (2026-10-16)

**Status:** Partially complete (non-device scope, OD-06/OD-07). Source: uncommitted on base `e860743`. Environment: local workspace plus read-only hosted catalog queries (project `pwjbucnyqexiepoinoke`). No commit, push, deployment, migration, dependency, configuration, Edge Function, shared-package or Android/web change; no gate was opened.

## Entry assessment

Phase 11 is Verified (non-device); Phases 3, 4 and 6 are Partially complete and their open exits are carried as blockers, as for Phases 4–11. Phase 2 primitives (protected drafts, staged uploads, file validation, image preparation, location controller, single flight, pagination) were reused unchanged except for two compatible extensions (below). `AGENTS.md`/`CLAUDE.md` impose no conflict: no migration was needed (next unused prefix stays `0129`) and no Android UI was touched.

Baseline before editing (iOS workspace): `tsc --noEmit` 0 errors, `eslint .` 0, `vitest run` 19 files / 354 tests passed.

## Requirement classification (before → after)

| Item | Before | After |
|---|---|---|
| P12-T01 form fields/limits/zone/location | not started (route `reports/new` absent) | done |
| P12-T02 picker/bridge/foreground location | partial (Phase 5 picker for the home pin, gate `mapProviders` closed) | reused and qualified; processors still closed |
| P12-T03 photos | not started (`incident-photo` policy and 10 MiB limit existed; no picker/uploader) | done |
| P12-T04 draft/review/submit/reconcile | not started | done |
| P12-T05 detail | placeholder route | done for own reports; other residents' reports behind the closed `publicIncidents` gate |
| P12-T06 withdraw/confirm | not started | withdrawal done; confirmation implemented behind the closed gate |
| P12-T07 moderation | not started | blocked: no backend contract, no approved policy (PR-13) |
| P12-T08 combinations/races | not started | automated tests done; live runs Skipped |

## What exists now

| Area | Locator |
|---|---|
| Concern form model: limits, category/zone rules, validation through the shared `incidentReportSchema`, server row, copy | `src/features/reports/concern-form.ts` |
| Filing: ordered uploads to immutable owned paths, progress, cleanup, reconciliation, abandon | `src/features/reports/concern-submit.ts` |
| Protected draft (answers, pin, unconfirmed attempt) | `src/features/reports/concern-draft.ts` |
| Form screen and route | `src/features/reports/concern-screen.tsx`, `src/app/(tabs)/reports/new.tsx` |
| Detail screen and typed route | `src/features/reports/incident-detail.tsx`, `src/app/(tabs)/reports/incidents/[incidentId].tsx` |
| Eligibility and status trail | `src/features/reports/incident-model.ts` |
| Single-flight confirm/withdraw controller | `src/features/reports/incident-actions.ts` |
| Photo gallery and full-screen viewer | `src/features/reports/photo-viewer.tsx` |
| Server reads/writes: categories, zones, detail, confirmation state, confirm, withdraw, create, exists | `src/data/resident-api.ts`, `src/data/schemas.ts` |
| Multi-photo picker with previews | `src/lib/image-source.ts` (`pickImages`; `pickImage` now shares `prepareAsset`), `src/lib/image-prep.ts` (`incident-photo` purpose) |
| Read-only/recenter map mode, pin dragging toggle | `src/features/profile/pin-picker.tsx` (`LocationMap` exported), `src/features/profile/location-map.ts` |
| Report an issue action, focus refresh | `src/features/reports/reports-hub.tsx` |
| Error copy, allowlisted return paths | `src/lib/errors.ts`, `src/auth/pending-destination.ts` |
| Tests | `tests/concerns.test.ts` (43) |

## Decisions

- **P12-D01 Idempotency without a migration.** `incidents.id` is chosen by the app (a UUID per filing attempt) and is the idempotency key. The existing insert policy and write guard do not constrain `id`. A lost reply or a duplicate (`23505`) is reconciled with a read of the resident's own row by that id; an unfound row stays `unknown` and only an unchanged resend (same id, same photo paths) is offered. Photo paths use the attempt id as the upload folder, so a resend reuses the same objects. Verified on the real query builder; not executed against the hosted API (OD-07).
- **P12-D02 Public visibility stays closed (G12/PR-13).** `publicIncidents` remains `false`. The detail read is restricted to `reporter_id = auth.uid()` while it is closed, so another resident's report is never fetched, and the confirm control is not offered. The confirmation, already-confirmed and terminal-status logic exists and is tested with the gate open. Filing and withdrawing the resident's own report do not need the gate.
- **P12-D03 Reporter identity is not kept.** `reporter_id` is selected only to compute `own` and is dropped by the data layer.
- **P12-D04 No silent default location.** Android pre-fills the barangay centroid when GPS is unavailable (A33-021). The iOS form starts with no pin, opens the map on the boundary, and the resident must pin or use the device location (permission only on action). A centroid is not a place the resident reported; the plan's "no invented data" rule was applied. Recorded as a corrective equivalent.
- **P12-D05 Address detection and tiles stay closed** with `mapProviders` (PR-10 not approved): the address is typed, as in the Phase 5 location screen. The map shows the bundled boundary and pin with a CSP that blocks all network.
- **P12-D06 Photo previews.** A 720-point JPEG preview is rendered at pick time and held as a data URI; the validated upload bytes are held separately and no photo bytes are persisted in drafts. An unconfirmed attempt is restored from the draft with its uploaded paths only.
- **P12-D07 Definite versus unknown outcomes.** Only `unknown-commit` (transport failure after the request left, or HTTP 5xx) keeps the uploaded photos and locks the form to the exact payload; every other failure removes the fresh uploads (A33-032) and starts a new attempt id on the next send. Discarding an unconfirmed attempt removes photos only after the server confirms no row exists.
- **P12-D08 Status trail is not invented.** A concern records its current status, `created_at` and `updated_at` only (hosted columns re-checked); the trail shows times for "Report submitted" and the current step and no time for passed steps. The schema has no resolution note, so A34-016 shows only that the barangay marked it resolved.
- **P12-D09 Created detail is the durable result.** After a commit the form is replaced by the detail route with a "Report received" card (A33-035/036 equivalent); the committed reference is not a dismissible message.
- **P12-D10 Withdraw stays on the detail screen** with the new status and a note (Android navigates back); a committed mutation never loses its result.
- **P12-D11 Server completed-profile trigger.** The hosted `a0_require_complete_profile` trigger on `incidents` raises `resident_profile_completion_required` (42501); it is mapped to resident copy, and the form also checks setup status first (A33-001).

## Verification

| Check | Baseline | Final |
|---|---|---|
| `tsc --noEmit` (iOS workspace) | 0 errors | 0 errors |
| `eslint .` | 0 | 0 |
| `vitest run` | 19 files / 354 tests | 20 files / 397 tests (43 new in `tests/concerns.test.ts`) |
| `expo export --platform ios` | not run | exit 0 (1680 modules, bundle 4.7 MB; output written to a temporary directory and removed) |
| Hosted read-only catalog check | — | passed (below) |

Hosted check (SELECT on catalogs only, 2026-10-16): `incidents` has `address`, `specific_area_details`, `zone_id`, `confirmation_count`, `location jsonb`, `photo_urls text[]`, `reporter_id`, `updated_at`; `incident_categories` (`name,color,icon,is_trash_related`), `waste_zones` (`name,is_active,deleted_at,sort_order`) and `incident_confirmations(incident_id,user_id)` exist; `confirm_incident(uuid)→boolean` and `withdraw_incident(uuid)→void` exist with the 0121 authenticated-user check and are granted to `authenticated` only; triggers `a_guard_incident_write` (0121 guard), `a0_require_complete_profile` and `set_incidents_updated_at` exist; policies for resident insert, own-resolved-read update, barangay select and own confirmation select exist; `incidents` and `incident_confirmations` are in the realtime publication; bucket `incident-photos` is public, 10 MiB, JPEG/PNG/WebP, with resident upload and own-folder delete policies.

Test coverage (`tests/concerns.test.ts`): required fields, title 3–100, description/address/area limits, zone applicability and clearing, boundary and missing-boundary location, five-photo limit; 10 MiB final-byte limit and HEIC/over-limit re-encoding bound to 2048; bucket-only photo URLs; own/barangay detail scope, reporter id dropped, malformed id without a request, malformed row fails closed; confirm confirmed/already/refused/lost-reply reconciliation; withdraw reconciliation and refusal codes; create payload (client id, reporter, open status), lost-reply and `23505` reconciliation, guard-code mapping, profile requirement, no-session refusal before any request; action eligibility (own, terminal, confirmed, window, closed gate), status trail without invented times; single flight and no automatic retry; ordered immutable uploads, progress, upload-failure cleanup, definite-refusal cleanup, unknown keeps photos, resend reuses photos and id, staged references kept when removal fails, confirm/abandon only from the server's own row; draft round trip, other-account isolation, invalid draft discarded; allowlisted return paths.

## Acceptance and open items

- **A33 (form)** — met on non-device evidence: category, zone toggle, limits and counters, up to five photos with the 10 MiB/HEIC rules, pin inside the boundary, typed address and area, validation, upload-before-create, cleanup on failure, progress, durable result. A33-025 automatic address detection waits on PR-10 (typed address instead). A33-021 is a corrective equivalent (P12-D04).
- **A34 (detail)** — met for the resident's own reports: all fields, photo paging/dots/full-screen, location map with recenter, status trail, confirmation count, withdrawal with confirmation and explained unavailability, live updates. A34-018…023 (confirming another resident's report) are implemented and tested but not reachable until `publicIncidents` opens (G12). A34-016 is limited by the schema (P12-D08).
- **A32** — A32-026 (create action) and A32-030 (refresh after incident changes, by focus reload and the existing realtime source) met; A32-025 now opens the real detail.
- **P12-T07 blocked.** No content report, block or filter contract exists in the schema or shared package, and PR-13 (approved visibility, escalation, retention and a moderation owner) is not supplied. Nothing was built that only looks like a control. Needed: the owner-approved policy, then a backend contract (migration `0129` or later) and an operating moderation owner.
- **Skipped (OD-06/OD-07):** any rendered screen, live resident session, real photo upload to the hosted bucket, two-device confirmation/withdrawal races, iCloud/limited-library photo cases, camera permission prompt, VoiceOver/Dynamic Type on a device.
- **Carried blockers:** Phase 3 exit (hosted function deploy, stray history row, hosted invariant run), Phase 4 (PR-06), Phase 6 T06 partial.
- **Out-of-scope observations (not fixed):** (1) a resident's update on their own *resolved* report is row-scoped only, so direct API calls can change any column (already recorded in Phase 11). (2) The "residents soft-delete own open incident" policy (0025) still lets a resident with the API set `deleted_at` on an open report inside 24 hours without the withdrawal status; the app never uses it. (3) `incident-photos` is a public bucket by design (0025); photo URLs are world-readable once known, which the visibility notice and G12 must cover.
