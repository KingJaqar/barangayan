# Web Phase 1 — baseline and requirement map

October 21, 2026, Asia/Manila. Scope: shared data/operations verification and demonstrated missing contracts only. Shared migration and initial schemas/tests belong to the Android track; no duplicate migration, native edit, commit, deployment or remote mutation is authorized. Root AGENTS is empty; CLAUDE delegates to it. No instruction conflict. This execution supersedes the historical planning-only statement. Docker-unavailable wording is stale: PostgreSQL 17.6 and pgTAP 1.3.3 are available.

## Workflow and ownership

Git status, existing tracked patch, original hashes and recoverable relevant working-copy inputs: `tmp/family-web-phase1-20261021/`. Relevant untracked source copies are included. Other dirty work remains user-owned. Runtime credentials were neither read nor packed. `.env.local` presence is observed by builds only. Repowise is unnecessary; narrow ripgrep and verified Phase 0 relationships suffice. Shared workflow is centralized in plan Section 6.0.

Prerequisites verified in source: profiles/household_members mirror, conditional-save raw comparison and canonical return, existing resident/admin roles, private schema, deletion v1/v2, and archive/generic writer contracts. Phase 0 revalidation: 32/34 historical source hashes match; Android plan and context index changed externally and are not reused as current implementation evidence. New candidate XML is complete/uncompressed and equivalent to originals at capture. Manifest/continuations/read ledger are in the local recovery root. Later owner changes require a supplement.

## Before-edit requirement classification

| Phase 1 requirement | Observed state | Action |
| --- | --- | --- |
| Tables, indexes, constraints, private receipts, four secured operations | Partially done externally, source reviewed; independent tests pending | Reuse one shared candidate, rehearse locally and verify role/race behavior |
| Legacy writer guards, lifecycle, roster coordination | Partially done externally; regression correction in progress | Revalidate final source and independent regressions |
| Export/deletion and actor preservation | Partially done externally | Inspect export bodies and prove scoped lifecycle fixtures |
| Shared generated types | Delivered externally during orientation, unaccepted | Compare with effective catalog; typecheck consumers |
| Shared QR/input/error/response schemas | Partially done; 22 baseline tests pass | Verify concurrent owner response semantic checks and prototype-safe mapping; add independent contract tests |
| Web UI/native work | Later phases/out of scope | No UI/native changes |

## Baseline checks

Isolated target: `family_attendance_web_phase1_20261021_verified` on `supabase_db_barangayan`. Default DB is at 0117; schema-only restore preserves original owners, excludes pg_cron/pg_net singleton extensions, then migrations 0118–0136 all pass. No resident data copied. Failed environment attempts retained: active default connections prevent template cloning; first schema restore requires excluding singleton extensions; second requires actual superuser for privileged function settings. Diagnosed through installed pg_dump help, PostgreSQL 17 docs and role catalog; final restore uses supabase_admin with preserved owners, migrations use postgres. No default or other chat database changes.

Before candidate: conditional-save 22 assertions pass; admin lifecycle 153 assertions pass; account deletion 56 assertions pass. Tenant guard suite has one expected pre-cutover failure because the other owner updated its test for the not-yet-applied attendance guard. Full output is retained; actual final counts supersede these initial counts if different.

Shared input schemas: 22/22 pass. Web/admin typecheck and lint commands launched once; exact exits and build results are recorded at closure. No product code edited before this baseline.
