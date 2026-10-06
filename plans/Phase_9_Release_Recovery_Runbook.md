# Phase 9 release and recovery runbook

Prepared 2026-10-06. This document is a reviewable release procedure, not authorization to deploy, change credentials, apply hosted migrations or alter production data. Phase 8 is cancelled; do not ship its reverted Android usability work.

## Environment and release inventory

| Target | Verified / required |
|---|---|
| Resident web | User supplied `https://barangayan-resident-im0s5v68e-barangayan.vercel.app`; connector access returned 403. Its running commit and authenticated UI are unverified. |
| Administrator web | User supplied `https://barangayan-admin-mljmo9xhp-barangayan.vercel.app`; connector access returned 403. Its running commit and authenticated UI are unverified. |
| Hosted database | Repository-linked Barangayan project `pwjbucnyqexiepoinoke`. Fresh read-only inspection finds migrations through 0106, protected scores, removed legacy score column, Google-profile RPC and enabled identity trigger, private buckets, Ampid 1 / San Mateo / Rizal, and active minute scheduler with three successful recent runs. No migration was applied by Phase 9. |
| Dedicated staging | Not established by the supplied deployment URLs. Confirm the backend project and data classification before any fixture write; a Vercel preview URL may use production Supabase. |
| Android | User confirms no release APK exists yet. SDK 57 source/export and callback unit checks are separate from installed development/signed-release qualification. |
| iOS | No release IPA exists yet. Phase 9's mobile qualification scope is Android; preserve iOS shared-score compatibility without inventing an iOS release obligation. |

Record exact source commit, migration hashes/history, deployment IDs/commits, function versions, platform binary identifiers, and environment identifiers with each release. Do not treat a mutable branch or a successful build as evidence that the deployed consumer uses that build.

## Preflight and stop conditions

1. Confirm the operator's explicit release authorization and intended environment. Freeze a reviewed source revision. Preserve unrelated work; do not deploy an unreviewed working tree.
2. Verify the requirement checklist and all critical flows. The current Phase 9 verdict stays partial while protected deployed UI, real Google consent/linking, Android development/signed-release callbacks and setup validation remain unverified.
3. Confirm usable recovery backups and before-release reconciliation snapshots through the existing approved database/storage backup process. Include original request contracts, fees, payment identifiers/amounts/statuses, readiness/release/pause timestamps, ID versions/approval references, applicant numbers and exact protected scores. Keep these restricted; reports need aggregate checks rather than resident PII.
4. Inspect installed migration history and objects together. Hosted history currently includes 0104–0106; **do not replay these migrations**. Never renumber previously pushed migrations. Any new fix uses the next unused four-digit prefix after repository 0106.
5. Verify the released export function and administrator protected-score join use the final schema. Resident wildcard/nested/CSV/realtime/personal-data exports must expose no score; active same-tenant staff must retain original values/rankings and foreign/deleted staff must fail.
6. Confirm private ID/supporting buckets, 5 MB limits and MIME rules. Verify immutable approved evidence cannot be overwritten and a replacement resets approval before new submissions. Existing requests keep their evidence snapshot.
7. Confirm active once-per-minute evaluation and successful recent runs, including while client screens are closed. Alert thresholds deduplicate by request and threshold. A scheduler declaration alone is insufficient.
8. Stop on failed reconciliation, a tenant/identity leak, verification bypass, duplicate financial operation, mutable assessed amount after payment starts, incorrect SLA calculation, provider callback failure, or unqualified native binary. Retain the failing evidence; never relax policies or assertions to proceed.

## Migration and consumer checkpoints

For an environment that is genuinely behind, rehearse its actual starting state first and apply only missing repository migrations in ascending order. The complete local chain contains 104 SQL files through prefix 0106; missing numerical prefixes are not permission to rename historical files.

For an environment before Phase 7:

1. Apply 0105 through an approved migration workflow. Verify exact score backfill, unchanged registration timestamps/applicant numbers/capacity, NULL-only compatibility mirrors, tenant RLS and publication exclusion.
2. Ship and smoke-test compatible administrator, resident web, Android and supported iOS score consumers, plus personal-data export. Keep authorization enforced during the transition.
3. Only after that compatibility checkpoint, apply 0106. Verify the obsolete score column is absent and supported consumers still work.

An unrestricted database push can select both 0105 and 0106 together. Use an explicitly reviewed staged migration artifact/workflow to enforce the checkpoint. Do not modify production migration history or replay 0104 to manufacture a desired starting state. For the currently inspected hosted project, these stages have already been applied by other work; validate the deployed consumers instead.

Legacy request/hour/fee compatibility remains necessary. Do not remove legacy request forms, hour reports, payment source reconciliation or fixed historical fee snapshots merely because Ampid 1 now uses the minute charter contract.

## Environment setup validation

Use the [Phase 6 setup guide](Phase_6_Registration_Profile_Maps_Google.md#manual-google-setup--do-this-before-your-real-sign-in-tests) and verify its actual settings in the intended environment:

- Google Web OAuth client, branding/audience/test users and OpenID/email/profile scopes; register the exact web origin and the project's Supabase `/auth/v1/callback`. Android browser OAuth uses the same Web client, not an invented native credential requirement.
- Supabase Google enabled with the correct client; exact web `/auth/callback` and `barangayan://auth/callback` allowlists. Validate the actual emitted safe `next` query. Keep client secrets/service-role credentials out of `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*`.
- Password signup's current email-confirmation setting must match supported behavior; do not silently change the setting to make a test pass.
- Incomplete Google accounts receive one minimal Auth-linked profile, may browse and skip completion, and cannot submit documents/health/reports via direct links or API until completion. Completion resumes a safe internal destination and does not approve an ID.
- Confirm the Android scheme in an installed native development binary and signed release binary. Expo Go, Hermes export and callback doubles cannot qualify warm/cold starts, browser cancellation, consumed-code retries, expiry, process death and persistence.
- Keep the Settings location picker constrained; registration GPS and home pin remain separate and advisory. Denied permission/network/GPS failures must recover. Obtain barangay confirmation before describing the existing boundary as officially certified.
- Verify deployed Edge Runtime export/payment behavior. Local execution of handler source and stubbed PayMongo responses do not prove live provider settlement or deployed Edge routing. Never make a real charge to obtain local test evidence. Use a separately confirmed test-mode environment for provider checks.

## Post-release smoke checks

Run synthetic cases only in a confirmed dedicated test environment. Production checks use authorized existing accounts and read-only observations until specific write approval is provided.

For all four services, verify charter fields and source omissions; upload applicable requirements; reuse approved ID; submit once under repeated taps/retries; review requirements/eligibility/appearance; assess fee or exemption; confirm CTC total pages are charged once; reserve/collect pickup payment or use a confirmed waiver; accept, pause/resume, ready and release. Compare actual database records with resident and staff UI.

Verify stale/replaced approvals, incomplete profiles, inactive services, forged tenants/identities, unauthorized files, direct writes, concurrent duplicate submissions, unpaid release, amount changes after payment starts, duplicate collection and cross-tenant staff actions fail.

Reconcile deterministic SLA cases: 719.999 seconds on track, 720 near target, 900 near target while unfinished, greater than 900 overdue; readiness at 900 agency seconds completes within target. A 60-second documented resident wait is excluded from agency time; release time selects turnaround samples independently. Preserve microseconds at boundaries, report UTC windows and separate historical hour trends. Cancelled samples do not count as successful compliance.

## Monitoring and recovery

Monitor authentication/profile repair failures, rejected submissions, upload errors, payment assessment/reservation/provider failures, scheduler failures and durable alerts. Use request references/operation IDs and aggregate rates; never log tokens, secrets, ID images or detailed resident documents.

| Failure | Safe response |
|---|---|
| New consumer fails against final schema | Stop rollout. Redeploy a previously verified **compatible** consumer or a focused forward fix. Do not restore resident score columns/values or verification bypasses. |
| Reconciliation mismatch | Stop writes/release through the approved operations process. Preserve snapshots and audit trail; identify the exact rows/contract fields. Reconcile or apply a reviewed forward migration; never recompute historical scores/fees to hide the mismatch. |
| Lost submission/payment reply | Recover the same idempotency key/request reference or existing ledger/provider intent. Do not create a fresh financial attempt until the prior outcome is established. |
| Payment amount/provider conflict | Stop collection/release for the affected request, compare immutable assessed amount and ledger/provider identifiers, and follow the authorized provider reconciliation/refund process. Never mark paid to bypass the discrepancy. |
| SLA evaluator failure | Restore the trusted minute scheduler, inspect recent failures, and rerun the private idempotent evaluator through authorized operations. Confirm durable deduplication; client displays alone cannot substitute for server evaluation. |
| Google/profile outage | Retain authenticated public browsing and accurate retry notice. Repair setup/RPC access; retry provisioning idempotently. Do not approve IDs or invent completed fields. |
| ID evidence missing/inconsistent | Flag for staff repair and block new affected submissions. Preserve historical requests and reviewed evidence; never repoint approval to unreviewed replacement files. |

After recovery, rerun the affected checks and reconciliation, retain both failed and successful evidence, and obtain release sign-off only when the unresolved gates have actual supporting results.
