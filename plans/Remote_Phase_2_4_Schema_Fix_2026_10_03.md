# Remote schema fix — 2026-10-03

Verdict: **complete for the missing remote schema and profile query error**.

The user authorized the remote fix after the database was confirmed to be at migration 0094 while the updated application queried `profiles.province`. Target: `pwjbucnyqexiepoinoke` (Barangayan), confirmed ACTIVE_HEALTHY.

## Applied scope

Applied the exact repository contents of 0095, 0096, 0097, and 0098, in order. Migration 0099 was excluded and remains pending. No application or Edge Function deployment, password reset, Vault update, seed, migration renumbering, or synthetic production records were performed.

Used the working Supabase connector because the Windows CLI's pooler connection timed out. The standard migration helper assigns timestamp versions; to preserve the user's required four-digit versions, the migration SQL and its corresponding history records were committed together through a single explicit transaction. Each history row stores the exact original file text. Only the files' outer transaction delimiters were removed from execution so the entire rollout could remain atomic.

First rehearsed the complete operation in a transaction that rolled back. The committed operation repeated the same reconciliation assertions before commit. Locks and a baseline guard prevented a competing write/migration from invalidating those checks. The PostgREST schema cache was notified after the schema changes.

## Verification

| Check | Actual result |
|---|---|
| Remote migration history | 0095–0098 recorded with the correct names; 0099 absent |
| Recorded SQL matches local migration files | All four MD5 hashes match; original SHA-256 hashes retained below |
| Missing profile column | `public.profiles.province` exists as `text` |
| Updated profile query | All selected fields compile successfully |
| Live PostgREST profile query, including barangay relation and new columns | HTTP 200; zero-row public-key probe read no resident records |
| Authenticated role profile read in rolled-back test context | Exactly one own profile; city San Mateo and province Rizal |
| Resident ID evidence isolation | Zero other-resident evidence rows visible in the authenticated test context |
| Historical data reconciliation | All 18 profiles, 69 requests, 55 payments, and 33 Storage objects preserved |
| Original historical request fields and timestamps | Identical before/after; all 69 requests retain contract 1 and legacy timing |
| Payment and Storage records | Identical before/after |
| Profile history | Original fields preserved except the planned locality/display-address/display-name/timestamp updates |
| Historical pricing | Legacy fee snapshots equal the original catalog fees |
| Locality backfill | All 18 profiles have configured San Mateo / Rizal locality |
| Catalog | Four active contract-2 services, each with 15-minute target; original catalog IDs and tenant ownership retained |
| New public tables | RLS enabled on localities, ID submissions, request attachments, and request pauses |
| Six submission/review/pickup public RPCs | Invoker wrappers; authenticated execute allowed; anonymous execute denied |
| Private legacy idempotency table | RLS with no client policy and no authenticated SELECT grant, intentionally denying direct client access |
| Security advisors | No errors; existing warning counts decreased: mutable search paths 8→7, anonymous definer execution 29→27, authenticated definer execution 32→31; leaked-password protection warning remains 1 |

The ID import created two legacy pending evidence versions. One previously verified profile lacked a valid evidence pair and is now explicitly flagged for repair, as required by Phase 2; no ID objects or historical ID fields were deleted.

## Source hashes

| Migration | SHA-256 |
|---|---|
| 0095_phase1_shared_foundations.sql | 303A9AF66EACA70B2A67EE5203C7CFAE1618BD0330868BE1B9EE208F1BD1A234 |
| 0096_phase2_trusted_evidence_locality.sql | 1649AFEFB5BD9497C8E4FB8C472FB933B91A81E985E04F661B0A5BCFB8BF97FF |
| 0097_phase3_catalog_staff_workflows.sql | 2F59DA371BE6A682C81E08203586513D586600FEBDDC9B4FAE72E9B56991BE1F |
| 0098_phase4_resident_submission_payment.sql | 6686D2E43B8D5279EA59978EB187E73C2FE3E378254DD5D2F9DAC7183F29130E |

## Limits

This verifies the committed schema, data reconciliation, database permissions and live API field resolution. It does not establish that the Windows CLI timeout has resolved, deploy compatible payment Edge Functions, perform real payment charges, or verify the user's signed-in browser session. The existing application can be refreshed to retry the profile query. A later plain `db push` may apply the separately pending Phase 5 migration 0099; do not use it merely to repeat this completed rollout.
