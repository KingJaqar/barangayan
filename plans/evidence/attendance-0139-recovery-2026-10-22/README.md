# Household attendance recovery after 0139

Completed October 22, 2026 (Asia/Manila), on hosted project `pwjbucnyqexiepoinoke`.

Authorization: the user requested, "now revert 0139's unwanted changes then keep the household attendance feature". This authorized the database correction and verification. No application deployment, Git commit, or Git push was performed.

## Result

- Kept migrations `0137`, `0138`, and `0139` in hosted history and left their repository files unchanged.
- Applied `0140_restore_household_attendance.sql` through the linked CLI, preserving its four-digit version. It restores attendance tables/indexes/constraints, private replay receipts, four invoker APIs, identity/lifecycle/legacy-write guards, roster/account-deletion integration, and attendance-derived admin views.
- Applied `0141_attendance_receipt_export_access.sql` after the security advisor flagged the original restored receipt view. The view now uses invoker permissions and a narrow private function that returns only the current eligible resident's receipt metadata. No direct receipt-table access is granted. Existing view columns and consumer behavior are retained.
- Final CLI deployment preview: **Remote database is up to date.** The next unused sequential migration prefix is `0142` at this checkpoint.

The 42 profiles, 6 household members, and 3 legacy center check-ins retained identical whole-row fingerprints before and after deployment and the rollback-only hosted tests. The restored attendance and receipt tables contain zero records; this operation does not recover any earlier missing records or infer attendance from legacy booleans/check-ins.

## Verification

1. Saved the hosted function/view/trigger definitions, ACLs, counts, and record fingerprints before changing the schema. Full diagnostic snapshots are retained locally in `tmp/attendance-0139-recovery-20261022/`; they contain schema definitions and hashes, not copied resident rows.
2. Created a new schema-only local database, `family_attendance_restore0139_20261022`, from the existing pre-0139 reference, then explicitly applied repository 0139. All reproduced function bodies matched the hosted baseline after normalizing formatting/comments. The substantive changes from the reference were attendance-related.
3. Rehearsed 0140 atomically. The first rehearsal correctly rolled back on the missing account-deletion comment anchor. The final migration uses the retained executable boundary instead. All pre-0139 function definitions and admin view semantics were restored; 0141 intentionally improves the receipt-export view.
4. Passed **234 local SQL assertions** across attendance (83), boundaries (30), admin projections (27), conditional household saves (22), account deletion (56), and receipt export access (16). Passed **21 independent-session concurrency cases**, plus the established pause/resume and exact receipt backup/restore rehearsal.
5. Passed **156 hosted SQL assertions** across attendance, boundaries, admin projections, and receipt access. Synthetic fixtures and all mutations ran in transactions that rolled back; no test fixtures persisted. The hosted reporting wrapper grants access only to its temporary result table so anonymous denial assertions can be collected.
6. Confirmed RLS on both restored tables; no anonymous/service-role attendance mutation grants; no authenticated direct attendance writes, member updates, or private receipt reads; all eight attendance/roster triggers present; four public attendance APIs use invoker permissions.
7. Final security advisor: **zero ERROR findings**. Existing unrelated warnings about other function permissions/search paths and leaked-password protection remain; private receipt RLS without a client policy is intentional. See `security-advisors.json`.

CLI 0140 deployment returned success and recorded the migration. Its optional post-deployment catalog-cache export warned about a connection timeout; direct hosted catalog queries and all hosted tests subsequently passed. CLI 0141 deployment completed successfully.

## Evidence and limits

- `verification.json`: migration hashes, catalog comparison, row fingerprints, local SQL results, restored function list, and limits.
- `hosted-tests.json`: all hosted suites and assertion counts.
- `security-advisors.json`: final advisor summary.
- `*.test.sql.log`: local SQL assertion output.

This verifies database recovery and the tested API/access contracts. Browser/device-camera acceptance and recovery of previously missing historical records were not part of this operation. Migration-history entries alone do not establish whether 0139 executed drops or recorded an already-existing schema difference.
