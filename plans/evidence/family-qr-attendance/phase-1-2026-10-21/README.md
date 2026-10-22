# Phase 1 — backend implementation and evidence

October 21, 2026, Asia/Manila. Scope: plan Section 4 and required shared/privacy compatibility. This is backend completion evidence, not production release approval. Phases 2–4 remain unstarted. Machine-readable candidate identities and exact results are in `verification.json`; packet selectors, source hashes and continuation boundaries are in the three packet manifests. Local recoverable originals, XML packets, diagnostic history and rehearsal scripts remain in `tmp/family-attendance-phase1-20261021/`.

## Orientation, ownership and initial comparison

Root `AGENTS.md` was empty; `CLAUDE.md` points to it. Applicable instruction discovery found no additional backend/shared/iOS/plan instructions. Web instructions were inspected for typecheck context; no Next application code was changed. No conflict with repository instructions was found. Historical planning-only wording is superseded by the execution request. Phase 0 contracts were validated against current source and effective local PostgreSQL definitions, not its completed checklist alone.

The working copy was already extensively dirty. `git-status.before.txt`, `existing-user-work.patch` and `before/` snapshots preserve the relevant pre-edit working copy, including previously untracked export/iOS files. HEAD was not treated as their baseline. Final owned diffs are compared with those snapshots; historical migrations and unrelated user changes are preserved. The separately appearing `household-attendance-responses.test.ts` is user work: read and exercised, not authored or overwritten by this phase.

| Requirement | Initial state confirmed before feature edits | Phase 1 outcome |
| --- | --- | --- |
| Holder/member authoritative stays, constraints and history | Not started; legacy check-ins and member booleans existed | New additive attendance table; holder has null member ID; composite ownership FK; one active stay per person; history retained |
| Four attendance operations and replay receipts | Not started; signatures had no collision | Four JSONB operations, private receipt storage, canonical batches, current authorization before replay |
| Tenant/auth isolation and alternate write paths | Partial; existing tenant checks, self-check-in and editable projections | RLS, invoker entrypoints, narrow definer helpers, direct/generic/legacy/queued bypass protection |
| Roster identity, optimistic saves and lifecycle | Partial; stable IDs and conditional saves existed; generic lock order reversed; hosted archive guard absent | Reuse conditional saves, preserve metadata/history, normalize locks, guard active stays, restore missing guard |
| Account deletion/export | Partial; both local deletion/export contracts existed; local v2 not deployed | Both deletion APIs clean attendance/receipts; v1/v2 exports page both required owner-scoped sections |
| Shared contracts and checks | No attendance contracts; existing household/lifecycle suites | Strict QR/batch/read/receipt schemas, catalog-generated types, role-aware SQL and independent-session races |

## Workflow and reusable context

Followed Git baseline → narrow ripgrep discovery → Reader identity validation → scoped Repomix → bounded XML analysis → original-source verification. No optional Repowise index was needed. Cached Repomix **1.18.1**, parsable uncompressed XML, security scanning and exclusions were retained. Generation succeeded without suspicious-file findings or unexplained omissions. Packet source text matched original/snapshot text after newline normalization. Estimates are packet sizes, not actual model usage or measured savings.

| Packet | Entries / bounded chunks fully inspected | Reuse / closure |
| --- | --- | --- |
| `prerequisites.before.xml` | 9 entries, chunks 0–11; empty AGENTS complete | Plan/context/contracts, household schema and conditional save/test. One combined-output omission in conditional test was closed against original lines 42–55 |
| `lifecycle.before.xml` | 12 entries, chunks 0–26 | Database types 0–9, shared index 10, exports 11–13, migrations 0093/0115/0121/0129/0131/0132/0133/0136 in 14–26; no required continuation left unread |
| `export-contract.before.xml` | 2 entries, chunks 0–1 | Existing iOS export contract and tests; complete |

Every extraction was at most 12,000 characters and 200 lines. Earlier complete direct reads were reused only after identity checks; generated manifests distinguish entries and boundaries. These packets describe the pre-edit working copy. Changed entries are historical, not mislabeled current; final source identities live in `verification.json`. Original bodies, handler boundaries, grants, mirror triggers, deletion order and generic editor corrections were verified before replacement.

Version context: PostgreSQL **17.6**, Supabase JS **2.112.1**, cached CLI **2.121.0**, Zod **3.25.76**, TypeScript **6.0.3**, Vitest **3.2.7**, Expo **57.0.10**, React Native **0.86.2**. No dependency or lockfile change was needed. PostgreSQL 17 locking/partial-index documentation, Supabase RLS guidance, Zod 3 documentation/types, and Expo v57 index/Sharing documentation were consulted. Some Expo URLs were unavailable; the iOS change only adds export-section labels to plain TypeScript and introduces no native API dependency.

## Implemented contracts and compatibility

Migration: `supabase/migrations/20261021111056_household_attendance.sql`, created by the cached Supabase CLI. Historical migrations were not edited or renumbered. No legacy attendance is backfilled.

Public JSONB signatures, all security invoker with authenticated execution only:

- `get_my_household_attendance()`
- `lookup_household_for_attendance(p_qr_payload text)`
- `check_in_household_members(p_profile_id uuid, p_center_id uuid, p_participants jsonb, p_request_id uuid)`
- `check_out_household_attendance(p_attendance_ids uuid[], p_request_id uuid)`

Private implementations validate current auth identity, active account, role and tenant. Receipt replay rechecks access; canonical input mismatches fail explicitly. Household/identity/request locks serialize retries and lifecycle changes, with five-second mutation lock deadlines. Center/stay acquisition is ordered. Raw QR is limited to 2,048 UTF-8 bytes, accepts canonical/legacy household v1 only, and is decoded as data. Batches contain 1–31 raw entries; member ownership is authoritative, duplicates normalize, invalid selections roll back atomically. Reads are bounded to holder plus 30 current members, with active and latest departed stays per person; admin history uses the stay's stored tenant.

Attendance SELECT uses RLS; ordinary clients cannot directly mutate stays, receipts or compatibility member fields. Private receipt tables have no client SELECT grant. A security-barrier, explicitly owner-filtered export view exposes only opaque receipt ID, household ID, request UUID, operation and creation time. It deliberately executes with its trusted owner's access to the private table; auth/active-resident ownership predicates are part of the view. Actor identity, fingerprint and stored receipt results are excluded. The receipt ID is unique independently of the actor/request composite key, so pagination cannot skip different staff's confirmations sharing a UUID and timestamp.

The member JSON mirror persists normalized IDs, preserves retained metadata/history, rejects removal of active people, archives referenced departed people and deletes only unreferenced people. A sorted conditional upsert prevents two households concurrently claiming a new UUID. The generic household editor routes through a checked household-first handler; existing request/payment editor corrections are retained. Existing conditional-save and three admin roster APIs remain callable. Direct member writes are deliberately denied.

Both account-erasure APIs remove the household's stays and household/actor-owned receipts before roster cleanup. Other households' history retains required actor references to the deidentified profile. Erasure takes the household mutex before the exclusive identity lock. Trusted owners of preserved lifecycle APIs receive only their needed private helper execution grants; no client shortcut is granted. This handles ownership retained by `CREATE OR REPLACE` when migration owner and existing API owner differ.

Legacy direct/queued check-ins and the existing `check_in_to_evacuation_center(uuid)` now reject arrivals with an instruction to ask staff to scan Family QR. The old function signature and historical records remain. Privileged fixture/history administration remains possible; service-role arrival bypass is denied. This is a coordinated server cutover: **do not deploy this migration independently of the later staff/client release**.

Exports v1 and v2 now require complete, paginated attendance and receipt metadata reads before returning success or recording cooldown. A later-page failure rejects the export rather than reporting partial data complete. The pre-existing 100,000-row section bound is retained. iOS recognizes the two required section labels; no screen/UI redesign occurred.

## Baseline and verification

Before feature edits: existing household conditional-save (22), admin lifecycle (153), deletion (56), tenant write guards (7): **238 SQL assertions passed** in isolation. Shared: **527 tests passed**. iOS: **13 export tests**, typecheck and privacy lint passed. Shared standalone typecheck already had five diagnostics: two missing `FileReader` references and three service-catalog test casts. The saved pre-edit Edge handler also reproduces the unresolved `jsr:@supabase/supabase-js@2` ESLint import error.

Final candidate results and source hashes are recorded in `verification.json` and copied logs:

| Check | Result / limit |
| --- | --- |
| New attendance SQL | 83 assertions pass under synthetic authenticated/anonymous identities |
| Existing affected SQL suites | 238 assertions pass; one tenant test deliberately changes expected legacy arrival success to denial |
| Independent-session concurrency | 21 scenarios pass; real PostgreSQL lock waits observed, both acquisition orders exercised where relevant; fixture cleanup passes |
| Shared suite | 569 tests pass across 36 files, including 23 owned boundary tests and 19 preserved user response tests; the user response file grew from 17 tests during this work and was reread without modification |
| Export module | 15 tests pass; both versions, timestamp/request-UUID ties, ownership filtering, later-page failure |
| Application typechecks | Admin web, resident web, Android and iOS pass |
| Owned supported ESLint paths | Pass, zero warnings; unchanged Edge `jsr:` resolution limitation recorded separately |
| Shared standalone typecheck | Pre-existing failure only; final diagnostic bytes match baseline |
| Empty-schema migration rehearsal | Local 0117 schema only, 0118–0136 plus candidate applied; no resident data copied, zero attendance backfill |
| Missing-guard drift rehearsal | Empty restore, deliberately absent prior archive guard, candidate recreates it; 83 attendance assertions pass |
| Recovery rehearsal | Synthetic stays/receipts dumped/restored exactly in a rolled-back transaction; original request replays afterward; fixtures removed |
| Final catalog | Generated contract matches actual candidate catalog; grants/RLS/indexes recorded; zero synthetic stays/receipts remain |

Commands/procedures: existing npm workspace test/typecheck scripts; `npx tsc --noEmit -p packages/shared/tsconfig.json`; supported ESLint config `apps/resident-ios-mobile/eslint.config.js`; local `psql -X -At -v ON_ERROR_STOP=1` with test SQL on stdin and explicit TAP-failure detection. For concurrency: `ATTENDANCE_TEST_DB=family_attendance_rehearsal_20261021_v5`, `ATTENDANCE_DB_OWNER=supabase_admin`, then `node supabase/tests/household_attendance_concurrency.mjs`. The owner only administers fixtures; tested application sessions explicitly switch to authenticated role and synthetic JWT subject. The harness rejects shared/default database names and bounds processes/polling. Local rehearsal/recovery scripts and full historical failures are retained under the local evidence root; no remote service was modified.

Docker initially returned HTTP 500. With the user's restore authorization, Docker Desktop was recovered by terminating only its WSL distro and starting Desktop; the separate barangayan WSL distro was preserved. Early failed environment/schema-owner/harness attempts are diagnostic history, not passes. A fresh candidate rehearsal exposed and fixed trusted-owner helper grants; erasure races exposed and fixed lock inversion. The final candidate was reverified after those fixes and the export pagination correction.

## Acceptance and next-phase handoff

The context index retains one row per A01–A17 with phase ownership. **Backend portions A01–A13, A16–A17 are met** by SQL/race/export/schema checks. UI portions remain pending; A14–A15 belong to Phases 2–3. Neither a database test nor a module test claims a real camera, screen, release-target or deployed Edge flow passed.

| Acceptance | Phase 1 evidence |
| --- | --- |
| A01–A02 | Holder-only/partial household stays, unchanged unselected people, departed history and bounded read assertions |
| A03–A04 | Same-center/different-center independent sessions; no duplicate/reset active stay |
| A05–A07 | Original receipts after timeout/departure, role/tenant/auth changes, old checkout vs later visit, invalid-batch atomicity and changed-key rejection |
| A08–A09 | Role/RLS/tenant-history assertions, malformed bounds, direct/generic/legacy/service-role bypass denial |
| A10–A12 | Rename/stable IDs/metadata, active removal/archive denial, removal/arrival and reassignment races, inactive-center departure, stale conditional-save rejection |
| A13 | Both erasure versions, deidentified actors and noncascade references, owner-only receipt projection, complete export pagination/failure tests |
| A16 | Five-second lock timeout with explicit original-key retry; no frontend loop behavior claimed |
| A17 | Snapshot-owned diff, preservation hashes, migration/drift/recovery rehearsals, catalog and checks; retirement conditions below |

Consumer/retirement record:

- Shared attendance schemas/types are consumed by SQL-contract tests and database type composition now; staff/resident application wiring belongs to Phases 2–3. Existing `emergency-qr`/image rendering paths still have Android/web/iOS callers and were not removed.
- Existing member projections are transactionally maintained compatibility outputs. Next phases must remove boolean editing controls and use the new read/confirmation contracts; direct writes now fail.
- Generic admin record editor and admin roster APIs remain live and preserve conditional versions. Only household routing/guarding changes; no unrelated editor API was retired.
- Existing legacy check-in endpoint still has live client callers. Its signature is retained with deliberate denial; migrate callers in Phase 3 before considering removal. Historical legacy rows remain readable.
- Export v1 remains live for Android/web; v2 remains the iOS contract. Both are retained and extended. Local v2 Edge code predates this phase and is not claimed deployed.
- Account-deletion v1/v2 retain existing callers and signatures. No actor/profile cascade deletion was introduced.

Remaining release/manual verification: implement staff and resident flows in their assigned phases; exercise loading/error/account-switch/theme/accessibility/camera/fallback behavior and stable request counts in Brave/MuMu/real camera hardware; run the actual supported Edge runtime against the release target; inspect console/server logs during those flows. No host Deno executable was available, so module tests do not certify the deployed handler. Reconcile hosted migration-history/guard drift and local-v2 deployment differences before an authorized rollout. Production migration, backup/recovery, commits, pushes and deployment remain unauthorized and unperformed. Existing shared/Edge toolchain errors are outside this phase and recorded, not hidden.
