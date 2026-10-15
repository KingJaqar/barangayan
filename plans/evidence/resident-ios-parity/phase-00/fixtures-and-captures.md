# Fixtures, Android source states and capture plan (P00-T06) — 2026-10-13

## 1. Sanitized two-tenant / role fixtures (existing, reusable)

The repository already contains transactional pgTAP fixtures with synthetic two-tenant data. They contain no resident data and roll back. Phase 3 (P03-T08) reuses and extends them; they were **not executed** in Phase 0.

| Fixture | Tenants | Covers |
|---|---|---|
| `supabase/tests/rls_isolation.test.sql` | `RLS Test Barangay A/B` | Cross-tenant RLS isolation |
| `supabase/tests/resident_ios_tenant_write_guards.test.sql` | `iOS Guard Barangay A/B` | Migrations 0093/0094 iOS write guards (household, ID, check-in, medical) |
| `supabase/tests/service_foundations.test.sql` | `Foundation Tenant A/B` | Submission/attempt foundations, admin role |
| `supabase/tests/registration_maps_auth.test.sql` | `Phase Six Ampid` / `Phase Six Foreign` | Locality/boundary-trusted registration |
| Also: `catalog_staff_workflows`, `agency_sla`, `document_charter_forms`, `deferred_profile_completion`, `google_minimal_profiles`, `administrator_scores`, `admin_document_type_creation` (`.test.sql`) | Foreign-tenant cases | Charter/SLA/setup/admin-only scores |
| `supabase/tests/*.auth.mjs`, `*.hosted.mjs` | Auth-level flows | Setup, email verification, sensitive actions, registration upgrade rehearsal |

Gaps to add in Phase 3: a resident-vs-staff-vs-admin-vs-anonymous-vs-deleted matrix per B-row mutation with negative post-state assertions (plan B.1), and two-tenant fixtures for incidents/read states, check-in and export/deletion.

Client fixtures: `apps/resident-ios-mobile/tests/config.test.ts` (tenant/HTTPS/privileged-key rejection, closed gates) and `secure-storage.test.ts` (Keychain chunking, interrupted write, fail-closed, logout tombstone). Both pass at baseline (8 tests).

## 2. Android source-state dispositions (verified anchors)

Every §6.8 anchor was re-checked against current source on 2026-10-13. 63 checkpoints carry a non-working Android state in `parity-ledger.csv`.

| Disposition | Anchor checked | Result |
|---|---|---|
| Home/Services search unwired (A52-001/002) | Breakdown A08-012, A09-006 | Recorded as `unconnected` |
| Map filter icon inert (A52-003) | Breakdown §19 note | `inert-control` |
| SMS switch local-only (A44-018/A52-004) | `settings/index.tsx:68` `useState(false)`, `:405` toggle | Confirmed local state only |
| QR PH conditional (A52-005) | `services/requests/[requestId].tsx:303` gates on `PAYMENT_SETTLEMENT_READY` | Confirmed |
| Hotline/guide placeholders (A52-006/007) | R14/R16 files exist | `placeholder` |
| Check-in queue never synced (A51-027/A52-008) | `hooks/use-qr-checkins.ts:88` `syncPendingCheckins` | No caller found |
| Notification tap helper unused (A52-009) | `lib/push-notifications.ts:141` `addNotificationResponseListener` | No caller found |
| Old health registration modal unreachable (A52-010) | `health/index.tsx:968` `RegistrationModal`; state `modalDrive` (`:2226`) is only ever set to `null` (`:2531`); Register pushes `/health/register` (`:2290`) | Confirmed unreachable |
| Old family modal unused (§6.4) | `components/add-family-member-modal.tsx` | Referenced only by itself |
| Household applicant not sent (A30-002/005) | `health/register.tsx:443` `register_for_drive` | Confirmed (anchor matches) |
| Fabricated prior dose | `health/register.tsx:394` returns `'2025-01-01'` | Confirmed; plan cites `:390` (drift recorded) |
| Bulk household attendance (A25-023/024) | Breakdown §25; `use-qr-checkins.ts` `updateHouseholdStatus` | `defective` per §6.4 |
| Weather/BFS/Dijkstra (A52-012) | `grep -i "dijkstra\|bfs\|routing-pack\|routing_conditions\|weather\|evacuation-routing"` over `apps/resident-android-mobile/src` | **No matches.** Center routing uses OSRM in `home/emergency-info/index.tsx:536`. The uncommitted shared/admin routing-pack and `0113_routing_conditions` work is not Android-wired. Not imported (PD-11). |

## 3. Android behavior captures — received 2026-10-14

The owner supplied `contexts/Barangayan Resident Android — Screens.pdf` (195 pages). Index, coverage and observations: `android-captures/README.md` and `android-captures/captures.json`. 32 of 44 screen routes are captured; remaining captures are tracked as PR-21 and are needed before P19-T05.

The review also found post-baseline Android changes (offline routing, new routes RD01/RD02) that contradict the 2026-10-13 A52-012 "not wired" result for the working tree. They are recorded as PR-20, not imported.

Steps used for any further captures:

1. Build or install the existing Android development APK (`apps/resident-android-mobile/eas.json`; the previously used EAS APK route) on an emulator or device.
2. Sign in with a sanitized resident test account on the agreed environment (PR-01). Do not use or display real resident records, IDs, health data or precise home coordinates.
3. For each screen route R04–R54 (skip layouts), capture the default state, plus loading/empty/error states that can be reached safely, in light and dark mode.
4. Record one short screen recording per split journey: Services request → payment screen; Reports four views + read/unread; Emergency Hub sections; Health calendar → register; Settings appearance color picker and font chips.
5. Save as `phase-00/android-captures/R<nn>_<state>_<yyyy-mm-dd>.png` (or `.mp4`) with a `captures.json` listing route, state, device/OS, app build and account fixture name.
6. Update `android_state` in `build-ledgers.mjs` if a capture contradicts the source-traced state, rerun the generator and record the delta.
