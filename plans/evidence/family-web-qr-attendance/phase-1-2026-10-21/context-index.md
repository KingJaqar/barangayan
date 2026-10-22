# Phase 1 context and acceptance — resident web

October 21, 2026 (Asia/Manila). **Complete for shared backend/data scope.** This is not completion of the staff/resident interfaces, hardware checks, remote migration, or release gates. [Baseline/ownership](baseline.md), [results](verification.json), [source identities](sources.json), [packet ledger](packet-ledger.json), [catalog contract checks](catalog-contract-checks.json).

## Effective candidate and ownership

Reuse the Android-owned migration `supabase/migrations/20261021111056_household_attendance.sql`, SHA-256 `44986A0EEDC28B3ED7500C7696259178B24098FEBBBBE3D4D5AF8455AB0CC69E`. No web migration or competing RPC was created. It contains authoritative stays, partial unique indexes, composite member ownership, private durable receipts, tenant-aware reads/mutations, compatibility/legacy guards, lifecycle/erasure coordination and a caller-owned receipt export projection. Existing public operations return JSONB and delegate to guarded private implementations; no client receives private receipt-table access.

Exact public signatures verified in the isolated catalog:

- `get_my_household_attendance()`
- `lookup_household_for_attendance(p_qr_payload text)`
- `check_in_household_members(p_profile_id uuid,p_center_id uuid,p_participants jsonb,p_request_id uuid)`
- `check_out_household_attendance(p_attendance_ids uuid[],p_request_id uuid)`

All return `jsonb`; public wrappers are invokers with empty search paths. Shared generated types match all nine columns, six foreign keys and four public signatures; both attendance tables have RLS. A deliberately privileged security-barrier view exports only the active caller's own receipt metadata, with explicit identity filtering; clients still cannot query private receipts. Export v1/v2 reuse caller-scoped pagination and fail incomplete attendance sections. No service credential is introduced.

Owned additions: `supabase/tests/household_attendance_boundaries.test.sql` (30 assertions) and `packages/shared/src/schemas/household-attendance-responses.test.ts` (19 cases). Owned changes to `supabase/tests/resident_ios_phase3_backend.test.sql` adapt retired self-check-in expectations while preserving the user's prior notification/token assertion. Shared schema, generated types, migration, export changes, expanded main tests and concurrency harness were delivered concurrently by the Android owner and preserved. An initially added overstrict receipt-person check was removed: checkout legitimately accepts different historical visits for the same person. The shared final schema restricts participant uniqueness and one center to arrivals. No remaining production-code delta is claimed as independently authored by this web track.

## Context workflow and source reads

Git baseline → narrow ripgrep → historical identity validation → cached Repomix 1.18.1 → bounded XML Reader → original source verification completed. Shared workflow rules remain in plan Section 6.0. Root AGENTS is empty, CLAUDE delegates; no instruction conflict. Web/admin AGENTS were read. No Next.js/React/Expo implementation was edited. Supabase/PostgreSQL skills were read; original PostgreSQL 17 locking/pg_dump docs, Supabase RLS/function guidance and changelog, and Zod 3 docs/installed 3.25.76 refinement implementation were consulted. Installed Next 16.3 distDir guidance and CLI build help supported isolated build outputs. Changelog Markdown fetching was unsupported, so the official HTML index was used. No dependency change.

Seven scoped, parsable, uncompressed XML packets were generated with security checks enabled and passed, with credentials/dependencies/prior packets excluded. Intended and actual entries reconcile without omissions. `packet-ledger.json` records every file/hash/line/character continuation. Local ElementTree supplied Reader; each extraction is at most 200 lines and 12,000 characters. Completed chunks: initial 0–10; handoff supplement 0–6; legacy regression 0–2; final candidate 0–8; role-test supplement 0–1; closure supplement 0–4; final receipt delta 0–1. Empty AGENTS is verified separately. Oversized combined output was not credited: handoff export chunk 4, export tests chunk 0, and final migration chunk 4 were re-extracted completely. Final closure supersedes earlier schema/response/boundary/harness entries. The final receipt delta supersedes five later owner-changed sources using a complete unified diff plus original source hashes; all unchanged bodies retain their fully inspected identities. It adds an opaque unique receipt ID so equal request UUIDs from different staff cannot skip an export page; explicit insert columns and receipt view/type/test/export changes are verified. The first delta selection omitted ignored tmp inputs; intended/actual manifest reconciliation caught it and the exact two reviewed non-sensitive evidence inputs were repacked successfully. The legacy regression packet is the pre-edit identity; its inspected owned delta and passing final source hash close that change. Original hashes and normalized packet/source equality were checked at each capture and again at closure.

Verified prerequisite relationships: profile JSON → canonical member mirror; raw expected snapshot → conditional save → returned canonical JSON; generic/admin roster writers → profile mutex before member locks; request key → identity/household → ordered center/stay locks; account erasure → attendance/receipt cleanup before roster cleanup; export → owner-scoped metadata projection. The final owner added trusted-function-owner grants after a restored-schema rehearsal exposed differing owners. The local concurrency harness now accepts only verified `postgres`/`supabase_admin` fixture owners; actor operations explicitly switch to authenticated roles.

Historical Phase 0 source reuse: 32/34 shared packet identities match; the Android plan and shared index changed externally and were not reused as current code. All needed changed inputs were supplied in supplements. Repowise was unnecessary. Packet token estimates are not model usage or measured savings.

## Environments, diagnostics and verification

Final target: `family_attendance_web_phase1_20261021_clean`, PostgreSQL 17.6 + pgTAP 1.3.3, Docker `supabase_db_barangayan`. The baseline schema was exported without data from local 0117, restored with original owners and singleton pg_cron/pg_net excluded, then migrations 0118–0136 and the exact captured attendance candidate were rehearsed. The final attendance rehearsal used `supabase_admin` over postgres-owned historical functions, verifying the narrow trusted-owner grants. A schema-only recovery of the preceding DD48 candidate into the clean database passed; the final receipt-ID candidate then passed its own fresh full migration rehearsal. No resident data was copied. This is schema/migration recovery evidence, not Phase 4's retained-data release recovery proof.

Database suites: 437 passing assertions, including authenticated-role ownership, cross-tenant history, forged/malformed batches, stale retries, actor de-identification, both erasure versions, raw CAS and 0/30/31 roster boundaries. Controlled independent connections: 21/21 scenarios pass, with observed database lock waits (plus explicit bounded-timeout retry). Shared schema/QR contracts: 42/42 pass; export helper regressions: 15/15 pass. Resident/admin typecheck and lint pass with unchanged warnings (one resident, two admin). Both final production builds pass using installed `--webpack` and separate app-local output directories. Build-added tracked configuration changes were removed.

Default admin Turbopack baseline failed fetching Google fonts; resident baseline was stopped after prolonged compile inactivity. Final webpack builds succeeded with permitted network access. The broad admin table suite has 152 passes and one pre-existing versioned request-editor expectation failure; its test and implementation match HEAD, import only existing table code and were not changed here. This does not waive a scope regression. Initial pre-cutover tenant denial failed as expected before the candidate was applied. The old Phase 3 success-based check-in regression was updated to test the new denial and passes all 86 assertions.

Preserved diagnostic corrections: schema cloning was blocked by active default sessions; schema restore required excluding singleton extensions and using the real superuser while preserving object owners. A restored-owner harness cleanup initially lacked private-table privileges; no product grant was relaxed. A guarded local adapter stopped because the shared owner concurrently added the supported owner option; the final run uses that real option, not a modified test copy. A boundary assertion initially counted receipts across unrelated synthetic fixtures; it now filters its household. Failed attempts remain in the local log root. No unchanged failing command or fix was blindly repeated. No current scope-related failure remains.

Full local recovery/log root: `tmp/family-web-phase1-20261021/`; checked-in-ready summaries and source identities are alongside this file. Local temporary evidence is not guaranteed committed. No commits, pushes, deployment, remote migration, external configuration change or third-party message was performed.

## Acceptance allocation at closure

Each row is scoped to the responsible phase. “Met (backend)” does not mark the whole multi-phase product criterion passed. Candidate identities are in sources.json; exact commands/results/logs are in verification.json. [Phase 0 browser procedures](../phase-0-2026-10-21/acceptance-coverage.md) remain the concrete later-phase manual steps.

| ID | Phase 1 result and direct evidence | Remaining phase |
| --- | --- | --- |
| A01 | Met (backend): holder-only read/arrival/departure/history; main attendance + boundary SQL | 2–4 actual QR and resident/staff UI flow |
| A02 | Met (backend): two of four selection, unchanged others and atomic departure; attendance SQL | 2–4 UI projection |
| A03 | Met (backend): unique holder/member constraints, same-center/request races preserve timestamp | 2,4 repeated scanner/confirmation callbacks |
| A04 | Met: different-center race commits one stay and denies the contender | 4 target revalidation |
| A05 | Met (backend): original receipt after departure, moved actor/household/center denial, revocation and timeout/retry races | 2,4 lost-response UI and original-payload Retry |
| A06 | Met (backend): old attendance IDs and exact departure replay leave later visit open | 2,4 UI confirmation |
| A07 | Met (backend): invalid batch atomicity/no receipt, raw 31 bound, multidimensional/null/extra keys and changed key/operation | 2,4 form edges |
| A08 | Met (backend): anon/missing/anonymous Auth/deleted Auth/banned/erased/foreign principals, real foreign member and immutable tenant history | 2,4 real sessions/target |
| A09 | Met (backend): direct/generic/legacy/queued write denials; 86 existing backend regressions | 2–4 remove misleading UI paths |
| A10 | Met (backend): rename/history, removal/archive races, explicit restore, no implicit resurrection and cross-household member-ID claim race | 2–4 UI draft lifecycle |
| A11 | Met (backend): inactive-center checkout; ordered center/household archive/reassignment and erasure races | 2,4 target revalidation |
| A12 | Met (backend): raw expected JSON versus normalization, canonical return, zero/30/31 and direct JSON limit, stale-editor rejection | 3–4 both web editors, lost response/draft/session behavior |
| A13 | Met (local backend): v1/v2 erasure, actor retention/FKs/time pairing, owner-only private receipt projection and paginated export/error tests | 4 deployed Edge version and target |
| A14 | Pending manual verification, outside Phase 1 | 2–4 Brave layouts and camera on separate display |
| A15 | Pending manual verification, outside Phase 1 | 2–4 guest/session, navigation, keyboard/zoom/themes |
| A16 | Met (backend): bounded indexed single-call reads, five-second lock timeout, explicit same-key retry, malformed-response rejection | 2–4 15-second request deadlines, cleanup and browser request counts |
| A17 | Met (Phase 1): exact candidate/schema restore, owned diff review, preserved historical migrations/APIs and caller retirement record below | 2–4 client cleanup, retained-data recovery, deployment and endpoint retirement |

## Compatibility and retirement handoff

| Existing surface → replacement | Confirmed consumers / retention and next gate |
| --- | --- |
| Direct/boolean member attendance → authoritative operations | Admin table/record editor still exists; server writes now reject. Phase 2 removes toggles and fixes holder-aware projections. |
| Legacy center RPC/direct inserts → explicit staff confirmation | Android/web camera + upload, iOS and old queued builds remain. Signatures/history retained; all client-role writes denied. Phase 3 supplies compatible UI copy and removes conflicting web paths. |
| Member mirror/generic mutation → coordinated profile-first routines | Existing admin add/update/remove and generic archive/restore/delete callers preserved; lifecycle tests pass. Do not delete those used APIs. |
| v1/v2 erasure/export → attendance-aware same entrypoints | Existing privacy clients remain compatible; new narrow export view retained because the existing Edge implementation consumes it. Production Edge versions remain unchanged here. |
| QR image endpoint → later local browser renderer | Resident web and supported native callers still use it. Retain endpoint until Phase 3 migration and Phase 4 caller/traffic retirement proof. |

Open questions: none for Phase 1. Remaining work is assigned to later phases and requires its own authorization. The plan's historical planning-only header is stale; this user's execution request controls Phase 1. No repository instruction conflict was found.
