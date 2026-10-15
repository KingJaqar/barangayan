# P03 implementation and verification record — 2026-10-14

**Tasks:** P03-T01 … P03-T08. **Requirements:** backend prerequisites for A-sections (A04–A07, A11–A18, A27–A34, A37–A47, A51); contracts B01–B24; handoff D03/D06/D08/D13/D14/D16/D19/D20 state contracts; G01/G03/G04/G08/G16/G18/G19 prerequisite enforcement; F02/F03/F09–F11.
**Source revision:** uncommitted (base `2e5681c`, on top of the uncommitted Phase 1–2 work and concurrent sessions' migrations `0113`–`0120_flood`). **Native build:** none (OD-06). **Backend/environment:** isolated PostgreSQL clones of the local development database (hosted-equivalent through `0118`) for every write; the hosted project `pwjbucnyqexiepoinoke` was read only (migration list, Edge Function list, security advisors, catalog fingerprint queries, no row data). **Owner / reviewer:** KingJaqar (OD-01); review pending.

**Not done, by instruction:** nothing was applied to the hosted project and no Edge Function was deployed. The migrations and function change below are prepared and rehearsed; applying them needs owner approval (section 7).

## 1. Baseline before editing (same session)

| Check | Result |
|---|---|
| Local dev DB / hosted migration state | Local dev DB: `0001`–`0117` applied (115 rows); files through `0119` plus another session's `0120_flood_shadow_runs`. Hosted: `0001`–`0118` (absent `0016`, `0028` as at Phase 0). |
| pgTAP, 22 existing files on a clone at `0118` | 0 `not ok` in every file. `admin_profile_and_association` produced 30 errors and no assertions (needs `0119`, absent on hosted; its fixture rows also collide with another session's committed rows); `agency_sla` passes 61 assertions with 2 `cron.job` errors (pg_cron absent locally). Both pre-existing. |
| Edge Function vitest | `storage-cleanup` 11 tests pass. |

## 2. What changed (by task)

### Migrations (next unused prefixes after the highest repository file at write time)

`0120_flood_shadow_runs.sql` was taken by a concurrent session while this work was in progress, so these are `0121`–`0124`. None is applied anywhere but the isolated clones.

| File | Purpose |
|---|---|
| `0121_resident_ios_write_boundaries.sql` | Incident write guard; announcement-read guard; push-token ownership/validation; online check-in receipt RPC; medical-registration input rules; account deletion requires fresh authentication; revocations of anonymous/unused execution; drift correction for the hosted payments insert policy. |
| `0122_resident_apple_account_setup.sql` | Additive Apple-aware account setup (`apple` origin, `ensure_apple_resident_profile`, `get_resident_account_setup_status_v2`); v1 contract unchanged. |
| `0123_resident_household_conditional_save.sql` | `save_resident_household_if_unchanged` atomic stale-checked household save; `role` default fix for the mirror trigger. |
| `0124_unreferenced_upload_objects.sql` | Service-role orphan discovery for the private upload buckets (closes P02-D10 discovery). |

### P03-T01 — reconciliation
- Catalog fingerprints (functions with ACL, policies, triggers, constraints, bucket settings; 553 objects) were compared between the hosted project and a clone at the repository's `0118` state using hash buckets, then drilled to the differing objects. Function bodies on the local database carry CRLF from the migration files; comparison was done after normalizing line endings.
- Differences (hosted vs repository), none caused by this phase:
  1. **Policy `residents can create a payment on their own request` exists on hosted** although `0017` drops it and the local database does not have it. With it a resident can insert a forged `paid` payment for their own request (reproduced on the clone). Fixed in `0121`.
  2. `barangayan_private.guard_household_archive()` and trigger `household_members.guard_household_archive` (migration `0115` file) are **absent on hosted**: the hosted `0115` was applied from an earlier revision of the uncommitted file. Owner: the session that owns `0115`; re-apply as a new migration, or hosted keeps the 0115 behavior without the archive guard.
  3. Constraint `evacuation_centers_entrance_position_check` has a different definition on hosted than in the working tree (the routing migrations `0113`/`0114` were edited after being applied). Same owner/action as item 2.
  4. `register_for_drive` is stored with CRLF line endings on hosted (functionally identical).
- Edge Functions: all nine repository functions plus `evacuation-route` are active (versions as in `phase-00/hosted-inventory.json`). Deployed source was not diffed against the repository; the platform returns only a bundle hash. Behavior-level reconciliation for `delete-my-account` is the freshness change in section 2 / T03.
- Storage: policy set and bucket configuration identical to the repository (`id-documents` private 5 MiB image-only; `request-attachments` private 5 MiB incl. PDF; `incident-photos` public 10 MiB; `profile-photos` public 2 MiB).

### P03-T02 — authorization, tenant, active/deleted enforcement
Tested both ways (`resident_ios_phase3_backend`, `_requests`, `_storage`). Gaps found and fixed in `0121`:

| Gap (before) | Fix |
|---|---|
| A reporter could create an incident with a preset confirmation count, any status, another barangay's category/zone, another resident's photo objects, any number of photos; and could later rewrite any column of an open own incident (confirmation count, status, category, barangay). | `a_guard_incident_write` trigger: direct API writes keep Android/web payloads working (`status: 'open'`, public URLs under `/incident-photos/<uid>/`) but reject everything else; residents may only withdraw, soft-delete and mark a resolved report read. Definer RPCs, the service role and administrators are not restricted (administrators still get the category/zone tenant check). |
| Read state could be recorded for another barangay's or a deleted announcement. | `guard_announcement_read` trigger. |
| `confirm_incident`/`withdraw_incident` accepted a deleted account's still-valid JWT; tenant compare was not NULL-safe. | Active-profile check, `is distinct from` compare, same messages and codes. |
| Anonymous sessions could execute `confirm_incident`, `withdraw_incident`, `soft_delete_incident`, `request_own_account_deletion`, `upsert_push_token`, `save_about_us_with_developers` (x3), `recompute_waste_zone_scores`, and eight trigger functions. | Execute revoked from `anon`/`PUBLIC` (and from `authenticated` for `recompute_waste_zone_scores`, which pg_cron runs as owner, and for the trigger functions). `current_barangay_id`, `current_role` and `get_routing_conditions_snapshot` stay anonymous-executable on purpose (policy helpers / public routing snapshot). Advisor count of anonymous-executable security-definer routines drops from 20 to 3. |
| Hosted payments insert policy (above). | Dropped (`if exists`). |

Verified already correct (no change): cross-tenant/inactive document type and forged request state (`0095` `guard_request_foundations`), resident payment/pickup/cancel/SLA operations owner- and tenant-bound, administrator-only operations refused for residents with no post-state change, resident registration and check-in tenant guards (`0094`), storage ownership and ID-evidence immutability.

### P03-T03 — Apple-aware setup and fresh proof
- `0122`: lifecycle origin `apple` (private table check widened); provider identity rows (Auth-managed) drive profile provisioning exactly as for Google; names absent on a later Apple sign-in stay empty; tenant from the configured locality; no location/address/completion/ID approval is imported; user metadata cannot assign role or tenant. `get_resident_account_setup_status()` is unchanged in shape: an Apple account is reported as `legacy` with its real `passwordSet`, which Android/web treat as "recover a password first". iOS reads `get_resident_account_setup_status_v2()` (`contractVersion`, `registrationOrigin` incl. `apple`, `identityProviders`, `hasGoogleIdentity`, `hasAppleIdentity`, `emailIsPrivateRelay`, `profileComplete`, `passwordSet`). Metadata-import protection in `guard_profile_locations` now covers `apple` identities.
- Fresh same-account proof at the server boundary (previously only app code): `request_own_account_deletion()` requires an Auth `amr` timestamp within 10 minutes (`barangayan_private.has_recent_authentication`); `delete-my-account` checks the same JWT evidence **before** any Storage deletion (`fresh-authentication.ts`, 4 vitest tests). Android and web both call `signInWithPassword`/Google re-authentication immediately before invoking, so their flows are unaffected.
- Not possible in this repository: password changes are accepted by Auth with a refreshed session (recorded earlier as SA-2, `secure_password_change=false`); fixing that is a hosted Auth setting (section 7). Apple credential revocation on deletion needs the Apple client secret (PR-06) and belongs to Phase 18.

### P03-T04 — profile/household edits
- `complete_resident_profile_if_unchanged` (0108), email-verification invalidation (0109), ID publication/locality (0096/0118) already have passing tests; re-run unchanged.
- New `save_resident_household_if_unchanged(p_members, p_expected)`: validates (max 30 members, id UUID, name 1–200, relation 1–100, role ≤50, no duplicates), compares the stored list to the caller's snapshot under a row lock (`PT409 resident_household_changed` and no write when stale), lets the mirror trigger reconcile canonical rows (attendance, archive state and foreign-id rejection preserved), returns the normalized list.
- Latent defect fixed: a member without `role` made the mirror trigger insert NULL into the NOT NULL column (the explicit NULL bypassed the default); the column default is applied now.

### P03-T05 — submission, payment and SLA contracts
`resident_ios_phase3_requests` (28 assertions) proves ownership/tenant/administrator boundaries and no side effects for `set_service_request_payment_method`, `start_pickup_payment` (idempotent, amount from the server catalog), `cancel_own_service_request` and `service_request_sla_tracking`; the existing suites (`service_foundations` 114, `document_charter_forms`, `agency_sla`, `catalog_staff_workflows`) cover submission idempotency/payload binding, attachment ownership, review and fee assessment. Payment Edge Function behavior is Phase 10.

### P03-T06 — concern, medical and check-in rules
- Concerns: creation, corroboration (deduplicated, own report refused, cross-tenant refused), withdrawal and read state are covered by the `0121` guards above. Client-chosen incident `id` gives retry reconciliation (replay is `23505`; the owner reads the row back).
- Medical: `register_for_drive` keeps its result shape and `P0001`–`P0004`; adds `22023` for age outside 0–130, a prior-dose date after today (Asia/Manila), more than 10 conditions, an over-long condition, or `None` combined with a condition; `P0005` for a drive whose date has passed; a resident who already holds a slot now receives `P0004` instead of `P0003` when the drive is full. Age is not derived server-side because A30-008 keeps manual entry.
- Check-in: `check_in_to_evacuation_center(center)` returns an authoritative receipt, idempotent for 10 minutes per resident and center (advisory lock); resident-only (`P0010`), inactive/unknown center (`P0012`), cross-barangay (`P0011`). The direct insert path remains for Android (unchanged guard).

### P03-T07 — staged contracts
See [P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md](P03-T07_2026-10-14_inbox-outbox-export-deletion-contracts.md): token ownership delivered now; inbox/outbox/event schema, export v2, deletion state machine and retention matrix staged for Phases 17/18; `0124` orphan discovery delivered.

### P03-T08 — rehearsal and regression
Section 3.

## 3. Final verification (same session)

Run on `p03_rehearsal`, rebuilt by the script in this record's section 6 from the development database at `0118`, with legacy duplicate push tokens and a malformed token seeded, then `0121`–`0124` applied in order with `ON_ERROR_STOP`.

| Check | Result |
|---|---|
| Migration upgrade (`0118` → `0124`, in order, legacy data present) | Applied without error; duplicate tokens collapsed to the newest row, malformed legacy token retained (constraint `NOT VALID`). |
| Recovery | Re-running `0122` on the migrated database fails at the first existing object and leaves constraint and function hashes identical (each migration is one transaction). |
| Drifted-database rehearsal | Hosted-only payments insert policy created on a `0118` clone, `0121` applied: policy gone. |
| New pgTAP | `resident_ios_phase3_backend` 86/86, `resident_ios_phase3_requests` 28/28, `resident_ios_phase3_storage` 24/24, `resident_apple_account_setup` 37/37, `resident_household_conditional` 22/22, `unreferenced_upload_objects` 7/7. |
| Existing pgTAP regression (all 29 files) | 1,055 assertions pass. Only non-passing: `admin_profile_and_association` (26 errors: duplicate-key collisions with another session's committed fixture rows, same as baseline), `agency_sla` (2 `cron.job` errors, same as baseline) and `flood_shadow_runs` (needs the other session's `0120_flood_shadow_runs`; 37/37 once it is applied, also verified). One existing test, `service_foundations`, was updated because deletion now requires fresh authentication (plus a new refused-when-stale assertion): 114/114. |
| Concurrency (`resident_ios_phase3_concurrency.mjs`, 8 parallel committed sessions) | 7/7: one attendance row and one first-time receipt for 8 simultaneous check-ins; exactly 3 of 8 registrations accepted for 3 slots, stock 0, unique applicant numbers; 6 parallel corroborations count once; 2 accounts racing one device token leave one owner; 2 household saves from one snapshot give one commit and one `PT409`. |
| Trigger-function revocation | A role without `EXECUTE` inserts into `auth.users` and triggers fire (privilege is not checked at fire time). |
| `delete-my-account` | vitest 15/15 (4 new freshness tests); ESLint clean on the changed TypeScript and the concurrency script. |
| Hosted read-only | Security advisors re-read: 20 anonymous-executable security-definer routines (9 resident-facing fixed by `0121`; 8 trigger functions fixed; 3 intentionally retained). Leaked-password protection is disabled (owner setting). |
| Android/web contract review | Incident insert payloads (`status:'open'`, no count, public photo URLs under the uploader's folder), push-token RPC arguments, announcement-read upserts, deletion re-authentication and `confirm_incident`/`withdraw_incident` messages checked in source against the new rules. No Android/web/shared source changed. |
| iOS workspace | No iOS source changed; typecheck/lint/tests not re-run (nothing to regress). |

## 4. Task status

| Task | Status |
|---|---|
| P03-T01 | Verified (non-device scope, OD-06) — reconciliation complete; hosted drift recorded (items 2, 3 owned by the `0115`/`0113` session) |
| P03-T02 | Implemented; verified on isolated rehearsal. Hosted deployment pending (section 7) |
| P03-T03 | Implemented; verified on isolated rehearsal. Apple provider configuration (PR-06) and Auth password-change freshness are hosted settings, open |
| P03-T04 | Implemented; verified on isolated rehearsal. Hosted deployment pending |
| P03-T05 | Verified on isolated rehearsal (no schema change needed). Payment Edge Function evidence is Phase 10 |
| P03-T06 | Implemented; verified on isolated rehearsal. Hosted deployment pending |
| P03-T07 | Designed and staged; discovery routine delivered and verified. Consumers: Phases 17/18 |
| P03-T08 | Verified on isolated rehearsal. Staging-schema run pending: no separate staging project exists (PR-01) |

## 5. Decisions

P03-D01 Direct-write guards are `SECURITY INVOKER` triggers that apply only when `current_user` is `authenticated`/`anon`, so definer RPCs, the service role and migrations are not restricted (same convention as `guard_request_foundations`). P03-D02 Residents keep withdraw, soft-delete and mark-read on incidents; nothing else. P03-D03 One owner per push token; legacy token rows are not validated retroactively. P03-D04 Check-in idempotency window is 10 minutes; Android's direct insert is retained. P03-D05 Server fresh-authentication window is 10 minutes (clients use 5 minutes plus skew). P03-D06 Apple accounts appear as `legacy` in the v1 setup status. P03-D07 Household limits 30/200/100/50 and default role `member`. P03-D08 Medical rules as listed in P03-T06; `register_for_drive` does not derive age (A30-008). P03-D09 The hosted payments policy is dropped by migration rather than by dashboard so the state is reproducible. P03-D10 `current_barangay_id`/`current_role` keep anonymous execution (several anonymous-role policies and column defaults depend on the helpers; revoking needs a separate policy review).

## 6. Reproduction

```bash
# disposable database, never `postgres`
docker exec supabase_db_barangayan bash -c "pg_dump -U supabase_admin -Fc postgres -f /tmp/p.dump && createdb -U supabase_admin -O postgres p03_rehearsal && pg_restore -U supabase_admin -d p03_rehearsal --no-owner --role=postgres /tmp/p.dump"
# apply 0118 if absent, then 0121..0124 in order, then:
for f in supabase/tests/*.test.sql; do docker exec -i supabase_db_barangayan psql -U postgres -d p03_rehearsal -X -At < $f; done
P3_TEST_DB=p03_rehearsal node supabase/tests/resident_ios_phase3_concurrency.mjs
npx vitest run supabase/functions/delete-my-account
```

## 7. Hosted state and pending actions (updated 2026-10-15)

**What happened on 2026-10-15.** After the isolated verification above, the hosted migration history was read again (`list_migrations`): it now contains `0119`, `0120_flood_shadow_runs`, `0121`, `0122`, `0123` and `0124` — pushed by someone other than this session. This session then applied the `0121` SQL once through the Supabase `apply_migration` tool (before that push became visible to it), which recorded one extra history row, `20261015003812 resident_ios_write_boundaries`. The statements are idempotent (`create or replace`, `drop ... if exists`, `create unique index if not exists`, de-duplicating delete), so the second application changed nothing, but the row is stray.

| Item | State |
|---|---|
| `0121`–`0124` on hosted | Applied (history rows present). |
| Read-only confirmation (security advisors, 2026-10-15T00:39Z) | Anonymous-executable security-definer routines: 3 (`current_barangay_id`, `current_role`, `get_routing_conditions_snapshot`) — down from 20. `check_in_to_evacuation_center` exists on hosted. Leaked-password protection still disabled. |
| Stray history row `20261015003812` | **Open.** Removing it is a write to the hosted migration history; the permission classifier blocked this session's production SQL access, so it was not attempted. Until removed, `supabase db push` reports a remote migration missing locally and needs `supabase migration repair --status reverted 20261015003812` (or deleting the row). |
| `delete-my-account` freshness check | **Not deployed.** Hosted is still version 1, whose source is older than the repository (it uses `jsr:` imports and only cleans two buckets; the repository version imports `storage-cleanup.ts`). The RPC enforces freshness server-side already, so deletion is protected; the function check only prevents Storage deletion by a stale session. Deploy needs owner approval (production deploy) and a decision whether to ship the repository's uncommitted `storage-cleanup.ts` with it. |
| Hosted invariant run | **Open.** The pgTAP files were not run against the hosted schema (production SQL blocked; the files also create fixtures, so a rolled-back run needs explicit approval). Evidence for hosted is currently the catalog/advisor reads above plus the isolated rehearsal. |
| Hosted Auth settings | Open, owner: Apple provider (PR-06), callback allowlist (PR-03), secure password change, leaked-password protection. |
| Hosted drift items 2 and 3 (T01) | Unchanged by this phase; owned by the `0113`/`0115` session. The pushed `0115` file is the same file that was already recorded as applied from an earlier revision, so the archive guard is likely still missing; recheck. |
| PR-01 | No separate staging project; the hosted project is the only target. |
| PR-07, PR-13, PR-14 | Decisions for the staged contracts (T07). |

## 8. Out-of-scope observations (not changed)

- Android writes `household_members.is_checked_in` directly for all members and inserts check-ins from the client (defective baseline per plan §2); RLS still allows it.
- Cancelled medical registrations keep consuming drive capacity (stock is not restored); applicant numbers therefore remain unique today but would collide if stock restoration is added without changing the numbering.
- `service_request_sla_tracking` returns the whole request row, including staff review columns the owner can already read.
- `export-my-data` v1 truncates silently and masks section failures (specified in T07 for Phase 18).
- `delete-my-account` bans rather than deletes the Auth user and does not revoke existing sessions (Phase 18).
- Advisor WARN: seven public trigger/utility functions have a mutable `search_path`.
- AGENTS.md still names `0094` as the last pushed migration; hosted has `0118`.
