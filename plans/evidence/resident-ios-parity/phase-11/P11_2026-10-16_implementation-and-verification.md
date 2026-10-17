# P11 — Reports hub, announcements, read states and counters: implementation and verification (2026-10-16)

**Status:** Verified (non-device scope, OD-06/OD-07). Source: uncommitted on base `e860743`. Environment: local workspace plus read-only hosted catalog queries (project `pwjbucnyqexiepoinoke`). No commit, push, deployment, migration, dependency, configuration, Edge Function, shared-package or Android/web change.

## Provenance note — second implementation pass

The first pass of this phase left the plan, ledger and evidence README marked Verified, but when work resumed the working tree no longer held its new files: `src/data/report-filters.ts`, `src/data/report-signals.ts`, `src/features/reports/*`, `tests/reports*.test.ts` and this record were absent, while tracked files (`(tabs)/_layout.tsx`, `(tabs)/reports/index.tsx`, `data/report-counts.tsx`, `data/resident-api.ts`) still imported them, so `tsc --noEmit` failed with four TS2307 errors. The surviving tracked changes (data adapters, schemas, counts provider, tab badge, Home link, pending-destination allowlist) were kept and the missing modules were rebuilt against them. The first pass's test counts (41 new tests, 362 total) could not be reproduced and are superseded by the figures below. The first pass's decision text was lost with the file; the decisions below are the ones in force in the current code.

## What exists now

| Area | Locator |
|---|---|
| View/filter model, route-parameter resolution | `src/data/report-filters.ts` |
| Counter and badge contract (reusable by Home and the later inbox) | `src/data/report-signals.ts` |
| Counts provider, realtime refresh (unchanged behavior, typed against the contract) | `src/data/report-counts.tsx` |
| Server queries: filtered announcements with own read embed, own incidents by status, individual/bulk read and unread, snapshots | `src/data/resident-api.ts` (`announcements`, `announcement`, `markAnnouncementRead/Unread`, `unreadAnnouncementIds`, `markAnnouncementsRead`, `incidents`, `setIncidentRead`, `unreadResolvedIncidentIds`, `markIncidentsRead`), `src/data/schemas.ts` |
| Read/unread controller (single flight, optimistic with rollback, snapshot bulk, disposal) | `src/features/reports/read-state.ts`, `use-read-actions.ts` |
| Image/preview validation | `src/features/reports/media.ts` |
| Reports hub UI (counters, four views, filters, cards, mark-all) | `src/features/reports/reports-hub.tsx`, `src/app/(tabs)/reports/index.tsx` |
| Announcement detail (image, read/unread toggle, unavailable state) | `src/app/(tabs)/reports/announcements/[announcementId].tsx` |
| Native badge | `src/app/(tabs)/_layout.tsx` |
| Tests | `tests/reports.test.ts` (33) |

## Decisions

- **P11-D01** No date or search filter: the Android Reports screen offers category chips (announcements) and status chips (own reports) only (`apps/resident-android-mobile/src/app/(app)/reports/index.tsx`, `components/reports/*`). None was added.
- **P11-D02** The route parameter `segment` selects the view and is written back with `router.setParams`; the Android `tab` and `incident-reports` values are accepted. Filters live in the view component, which is keyed by view, so switching view resets them (A32-008).
- **P11-D03** Guests are offered Incidents (a sign-in explanation, the destination is remembered) and Announcements; Active and Resolved are not offered and resolve to Incidents.
- **P11-D04** Announcement detail is the typed route `reports/announcements/[announcementId]`, not a modal; the legacy `reports/[id]` redirects there; incident links use `reports/incidents/[incidentId]`. Record types are never inferred from an id.
- **P11-D05** Active = Submitted + In Progress, Resolved = resolved; status chips apply to the Incidents view only and are server-side restrictions, so paging and counts agree.
- **P11-D06** Optimistic read values are shown at once, are dropped if the write fails or its outcome is unknown, and are otherwise dropped only after the list re-read returns.
- **P11-D07** One write runs at a time for the whole screen, individual or bulk; a second activation sends nothing.
- **P11-D08** Bulk marking acts on the ids unread at tap time, in chunks of 100, stopping at the first failure and reporting `n of m`; a partly applied snapshot drops its optimistic marks and the re-read decides. Resolved bulk skips rows that changed meanwhile (`resolved_read_at is null` and `status = resolved` in the update).
- **P11-D09** The own read marker is embedded only for a signed-in resident (filtered to their id); a signed-in read without the embed fails closed as a schema error instead of showing everything as unread.
- **P11-D10** Images: announcement images must be plain https; a report photo must additionally be an object of this project's public `incident-photos` bucket. Anything else is not rendered.
- **P11-D11** Incident detail and "Report an issue" belong to Phase 12: the hub states that reporting is not available in this version; no disabled-looking action pretends to work.
- **P11-D12** The system badge is unread resolved + unread announcements, capped at `99+`; active reports are a separate labeled counter. Home wiring is Phase 18.
- **P11-D13** Opening an announcement does not mark it read (Android does not either); only the explicit toggle or mark-all does.
- **P11-D14** An unknown announcement category is shown by its stored name and an unknown incident status as "Unknown"; neither breaks the list.

## Verification

| Check | Baseline (before this pass) | Final |
|---|---|---|
| `tsc --noEmit` (iOS workspace) | 4 × TS2307 (missing modules) | 0 errors |
| `eslint .` | 0 | 0 |
| `vitest run` | 18 files / 321 tests passed | 19 files / 354 tests passed (33 new in `tests/reports.test.ts`) |
| `expo export --platform ios` | not run (would fail on the missing imports) | exit 0 |
| Hosted read-only catalog check | — | passed (below) |

Hosted check (SELECT on catalogs only): columns `announcements.{id,title,category,published_at,body,detailed_description,image_url,barangay_id,deleted_at}`, `announcement_reads.{announcement_id,resident_id}`, `incidents.{id,title,description,status,created_at,resolved_read_at,photo_urls,reporter_id,barangay_id,deleted_at,category_id}` exist; `announcement_reads` has foreign keys to `announcements` and `profiles`; policy "residents manage own announcement reads" exists; incident policy "residents mark own resolved incident read" (UPDATE) exists; `announcements`, `announcement_reads` and `incidents` are in the `supabase_realtime` publication; bucket `incident-photos` is public.

Test coverage (`tests/reports.test.ts`): view/filter resolution and server restrictions; guest limits; independent counts, aggregate badge and 99+ cap; image and bucket validation; announcement queries (own read embed, guest without embed, category filter, missing embed fails closed); idempotent unread; own-incident status queries; zero-row resolved update is a failure; guest writes refused before any request; snapshot across more than one page; 250-id bulk in chunks of 100; stop at first failed chunk; duplicate ids and changed rows; controller optimistic/rollback/unknown-outcome, single flight, snapshot-only marking, nothing-to-do, partial results, failed snapshot, disposal after owner change, guest through the real adapter.

## Acceptance and open items

- A32 lists/views, A35 controls, A36 counters and typed announcement routes: met on non-device evidence. A32 incident-detail contributions (A32-025 opens a route that is still the Phase 12 placeholder) and A32-026/A32-030 (create action, refresh after incident changes) complete in Phase 12.
- A35-024 "update the Home bell": the contract (`report-signals.ts`, counts provider) is in place; Home itself is wired in Phase 18.
- Skipped (OD-06/OD-07): any rendered screen, live resident session, two-device concurrent-arrival run, hosted execution of the read-state embed, More-overflow link and native badge/VoiceOver on a device.
- Carried blockers: Phase 3 exit (hosted function deploy, stray history row, hosted invariant run), Phase 4 (PR-06), Phase 6 T06 partial.
- Out-of-scope observations (not fixed): (1) the resident UPDATE policy on resolved incidents checks rows only, so a resident calling the API directly can change any column of their own resolved report; closing it needs a migration (`0129` or later). (2) The incidents SELECT policy "residents read own barangay incidents" is barangay-wide, so the own-reports filter `reporter_id = auth.uid()` in the client is what limits these lists; the `publicIncidents` gate stays closed.
