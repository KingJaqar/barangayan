# Phase 0 — Baseline, evidence, and handoff

Executed October 21, 2026 (Asia/Manila). Phase 0 status: **Complete — discovery and contracts only**. [Contracts](contracts.md) are the Phase 1 handoff. Product acceptance A01–A17 remains pending implementation and behavioral verification.

## Requirement classification at entry and completion

| Phase 0 requirement | Entry classification | Completion evidence / result |
| --- | --- | --- |
| Scope/prerequisites and target | Partially done: existing planning guidance; execution/environment not recorded | Met: current request authorizes Phase 0, linked hosted project matched read-only; isolated test target and restrictions specified |
| Context inputs | Partially done: historical findings not identity-current | Met: instructions, current clients, schema/privileges, mirror/save, lifecycle, deployment source and logs inspected; source/packet ledgers retained |
| Required context workflow | Partially done: only historical planning packet | Met: Git baseline, bounded ripgrep, prior-index validation, cached Repomix 1.18.1, complete XML reads and original-source verification; supplement rather than repacking |
| Baseline checks/inventories | Not started for execution | Met: schema/check/test/environment inventories and actual QR log outcomes recorded; unavailable Docker explicitly gated |
| Exact contracts and coverage allocation | Not started | Met: signatures, payload/result/error contracts, 30+holder limits, locks, current authorization, retention and cutover resolved in contracts; A01–A17 assigned in context index |
| Handoff | Not started | Met: plan Phase 0 progress updated, evidence/source/read identities retained, discrepancies and external gates separated from passing discovery |

No prerequisite phase precedes Phase 0. The existing household/conditional-save/admin foundations were verified in source and catalog rather than accepted from plan labels. Phase 1 must first establish a healthy isolated database; Phase 0 completion does not waive that gate.

## Git and source ownership

Recoverable evidence: `tmp/family-attendance-phase0-20261021/plan.before.md`, `index.before.md`, `owned-paths.before.patch`, `git-status.before.txt`. Both plan/index were existing untracked user inputs. The patch also preserves the pre-existing empty root AGENTS change; it is not ours. Existing Android/iOS/backend/shared/lockfile changes are prior/user work. No reset, stash, clean, staging, commit, push, deployment, migration application, or data deletion was performed.

Owned deliverables are this evidence folder, Phase 0 progress in the plan, Phase 0 facts in the context index, and local `tmp/family-attendance-phase0-20261021/` evidence. Application sources, migrations and dependencies are read-only. Packet source hashes plus the lockfile identity were checked immediately before documentation edits; no changes were found. Final checks revalidate protected source identities.

Ignored runtime inputs were inventoried by path only: admin/resident web `.env.local`, Android `.env`, iOS `.env`/`.env.development.local`, and Supabase `.temp` connection/runtime metadata. No credential/environment contents or resident records were read, copied into evidence, or packed. Only the non-secret linked project reference and runtime version files were read. Relevant untracked Android presentation components were included from the working copy, not HEAD. Prior root/app Repomix outputs were not treated as current context.

## Current local versus hosted observations

Catalog observations were read-only SELECTs, not access/behavior tests. Durable decoded catalog evidence is in this folder; raw tool envelopes and decoded function sources remain in the local evidence root.

| Area | Observed result and required implication |
| --- | --- |
| New attendance/receipts and four new APIs | Absent locally and hosted; new names have no public/private overload collision. Define them in Phase 1; do not pretend they already exist |
| Conditional household save | Both public invoker and `barangayan_private` definer exist; authenticated EXECUTE only, service role and anon revoked; limit 30; raw snapshot comparison raises `PT409`; seed-1 advisory lock then profile row lock |
| Mirror | Hosted and migration `0123` reconcile retained IDs without resetting attendance; missing role defaults to `member`; removed unarchived rows are hard-deleted today. Trigger is BEFORE UPDATE (established by `0093`), not the original `0052` AFTER rebuild |
| Archive guard drift | Local `0115` defines `barangayan_private.guard_household_archive()` and its trigger. Hosted function is null and trigger count is zero, confirmed directly; no local removal found. The hosted migration list alone is insufficient proof of effective schema. Phase 1 must restore/replace protection in a new additive migration and test both canonical local and drifted target state before rollout |
| Household table access | RLS enabled but broad resident-own and same-barangay admin ALL policies remain; both anon/authenticated have legacy table grants. An anon grant is not proof of row access: there is no matching anon household policy. New attendance needs explicit grants and narrowed server mutation boundaries |
| Legacy scans | `evacuation_center_checkins`, not a table named `qr_checkins`. Hosted direct resident INSERT policy and tenant trigger remain. Current uniqueness includes timestamp; iOS RPC serializes one resident/center pair and deduplicates for ten minutes. Neither ensures one active stay across centers or durable receipt replay |
| Generic admin mutation | Hosted `admin_mutate_record` still permits household `is_checked_in` and locks the member before profile. Its body includes later unrelated request/payment modifications; preserve those when editing the household branches. Do not replace the entire hosted/effective function with an older `0129` body |
| Admin projections | `_browse`, `_records`, `_summary` exist with current household fields. Source `0110`/`0115` shows member-only rows/counts and boolean-derived attendance; no holder row. Existing `pilotOptions` supplies same-barangay active resident IDs/names with a 15-second deadline; reuse it for manual selection |
| Profile/actor retention | Profile FK to Auth currently cascades on physical Auth deletion. Current erasure retains/anonymizes profile; deployed v1 bans Auth rather than hard deleting it. Local v2 calls soft `deleteUser(id, true)`. New historical actor FKs must prevent unsafe profile hard deletion and preserve actor/time pairs |
| Account lifecycle | Hosted `account_deletion_requests` and `erase_own_account_records` exist; erasure clears profile JSON before deleting members. Both v1 and v2 must delete new household attendance/receipts before that point. Hosted delete/export Edge v9 have **v1 only**, whereas current local working source includes v2. Do not assume local v2 is deployed |
| Migration identities | Latest local files are `0135_resident_notifications.sql` and `0136_account_deletion_state.sql`; hosted records those changes under `20261021094448` / `20261021094513`. Preserve both historical identities; do not renumber, reapply blindly, or infer full schema equality from these names |
| Resident writers | Android Family and Settings/Profile write whole JSON lists directly; web uses direct JSON writes; iOS uses the conditional API. Settings is an additional stale-editor path omitted from the original starting points |

## Actual QR failure evidence

The hosted `generate-household-qr` is ACTIVE, v9, JWT verification enabled, artifact `6ec65bc02af303a0126f2035d57dd4b0c6277aa10cce5270d01b11a28b1e4b59`. Its retrieved source matches the local implementation structurally: authenticated owner/same-barangay admin authorization, legacy `{type, profileId}` payload, then an unbounded request to the external PNG API. The current Android loader uses authenticated `expo-image` with no explicit deadline; it waits for load/error callbacks. Web also waits on the same endpoint without an explicit request deadline.

In the tool's default last-24-hour window on October 21, filtered **exact function-ID** edge logs showed:

| HTTP outcome | Error header | Count | Execution duration |
| --- | --- | --- | --- |
| 546 | `WORKER_RESOURCE_LIMIT` | 2 | 150,111–150,113 ms |
| 504 | `IDLE_TIMEOUT` | 1 | 150,662 ms |

Runtime logs for that function/version contained 23 Boot and 23 Shutdown events, all shutdown reason `WallClockTime`. Only aggregate status/duration/event metadata was retrieved; no URL query values, JWTs, resident identifiers, IP addresses, or session contents were exported. These outcomes establish real server timeouts; they do **not** prove an upstream QR provider failure, auth failure, missing handler registration, or the precise cause of each resident's spinner. No image-generation endpoint was invoked and no resident identifier was sent to the QR provider during this investigation. Phase 3 removes the dependency by local rendering; Phase 4 still verifies a real displayed QR.

An early broad log substring count was discarded: `401` can occur in IDs and is not an HTTP status. Final results use `log_attributes['response.status_code']` with the exact function ID. An early schema query incorrectly referenced `public.qr_checkins`; it failed read-only with `42P01`, was diagnosed against source `0045`, and corrected to `evacuation_center_checkins`. Multi-statement tool calls returned only the final result; final catalog evidence uses a single JSON aggregation query. None of those discovery errors is a product failure or an accepted behavioral result.

## Context packets and completed reads

Full manifests contain exact selectors/options, actual included files, SHA-256 identities and no omissions. Security scanning remained enabled; secrets, dependencies, Git/runtime contents and prior packets were excluded. No compression was used. All packet text matched working originals after newline/edge-whitespace normalization.

| Packet | Files / Reader work | Result |
| --- | --- | --- |
| `tmp/family-attendance-phase0-20261021/contracts.before.xml` | 22 entries; 24 bounded ranges; 10 ranges of already-read current plan/index/instructions reused after hash validation; 14 product chunks completely read | Repomix 1.18.1 exit 0; parsable XML; no suspicious files; no omitted selectors |
| `tmp/family-attendance-phase0-20261021/consumers.before.xml` | 12 entries; 12 bounded ranges; 6 complete manifest reads reused; 6 consumer/test chunks completely read | Same version/security/parse/source-equivalence checks passed |

Each extraction is at most 12,000 characters and 200 lines; `read-ledger.json` and `supplement-read-ledger.json` record path, start/end, characters, final-entry flag and reuse. Primary chunk 13 (`0136`) was completed through its original-source continuation, lines 81–142, after a combined output omitted the end. No required continuation remains. Packet token estimates (27,537 primary) are artifact estimates, not model usage or proof of savings. No named Reader/Repowise tool was exposed; safe local ElementTree parsing supplied the Reader role. Optional Repowise was unnecessary.

The plan/index entries become historical once Phase 0 progress is edited; other unchanged entries remain reusable by hash and dependency identity. The original planning-only packet is still historical. Preserve packet identities rather than regenerating them after documentation-only edits. Supplementary original-source ranges and package-lock identities are listed in `source-reads.json`.

## Baseline checks, environments, and verification limits

| Check or environment | Actual result |
| --- | --- |
| Git baseline and recoverable document copies | Pass; existing dirty state recorded; no assumption that HEAD equals working files |
| Instruction/source discovery and baseline inventory | Pass; `baseline-inventory.json`; 34 packet sources plus lockfile unchanged before edits |
| Repomix version, selectors, XML parse, security and normalized source equality | Pass for both packets; no dependency install |
| Hosted catalog / deployed QR / log comparison | Pass as discovery; archive/Edge/migration discrepancies recorded; no remote writes |
| Node / Python | `v24.13.1` / `3.13.14` |
| Android environment | Sandboxed ADB failed to reach daemon. Read-only unsandboxed inventory found serials `127.0.0.1:16384` and `127.0.0.1:7555`; selected `16384` reports model `SM-S918U`, Android `12`, installed `com.barangayan.resident.dev`. Prior evidence identifies it as MuMu; emulator vendor/build identity and the installed app's source parity were not reverified |
| Docker / isolated database | Sandbox pipe permission denied. Unsandboxed `docker ps` failed with API v1.56 HTTP 500. Different diagnostic `docker version --format ...` timed out after 20 seconds. No healthy database/container version verified; no reset/start/config change attempted |
| Brave / physical camera | No browser session or physical-camera decode exercised; not needed for Phase 0 contracts; required future gates remain pending |
| Existing household SQL regression | Read `supabase/tests/resident_household_conditional.test.sql` completely; it covers stale snapshots, 30-member limit, foreign IDs, denied identities and retained attendance. **Not executed**: no healthy isolated DB. Do not mark it passed |
| Other existing regressions | Inventoried admin lifecycle, iOS tenant/backend/deletion SQL and two-connection script; script explicitly requires disposable `P3_TEST_DB != postgres`. No fixture writes ran |
| Typecheck / lint / app build | Not run: Phase 0 changes documentation/evidence only. Plan 6.0(6) explicitly uses discovery/schema/check inventories for read-only Phase 0. No app correctness/build pass is claimed |
| Documentation verification and protected-source recheck | Exact final results are in `verification.json`; checks enforce unchanged other-phase sections and A01–A17 coverage |

Dependency lock observations: Expo `57.0.10`, image `57.0.2`, camera `57.0.3`, router `57.0.10`, React Native `0.86.2`, Supabase JS `2.112.1`, Zod `3.25.76`, Next `16.3.0`, native QR SVG `6.3.21`, web QR `4.2.0`, Vitest `3.2.7`, root TypeScript `6.0.3` and web TypeScript `5.9.3`. Lockfile identity is preserved in `source-reads.json`. No new dependencies.

Existing command inventory, read from workspace manifests (not executed for this read-only phase): shared `npm run test --workspace=@barangayan/shared`; admin `npm run typecheck`, `lint`, `test:tables`, and `build` with `--workspace=@barangayan/web`; resident web `typecheck`, `lint`, `build` with `--workspace=@barangayan/resident-web`; iOS `typecheck`, `lint`, `test`, `export:ios` with `--workspace=@barangayan/resident-ios`; Android `lint` with `--workspace=@barangayan/mobile` (no named typecheck/test/build script in its manifest). No existing shared household/household-QR schema test was found. The SQL regression files require pgTAP in an isolated database. The concurrency harness's existing invocation is `P3_TEST_DB=<disposable_name> node supabase/tests/resident_ios_phase3_concurrency.mjs`, with `P3_DB_CONTAINER` selecting its Docker container; environment assignment must use the current shell's syntax. Do not run its committed fixtures on the linked hosted project.

The first final documentation check reported a missing link to its own `verification.json` because that report is written after the link pass. The report was then created, and the final check revalidates the now-existing target. This is an evidence-generation ordering issue, not an application regression.

Documentation consulted: [Expo v57 Image](https://docs.expo.dev/versions/v57.0.0/sdk/image/) image headers/lifecycle callbacks, [Expo v57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/) barcode callbacks/unmount requirements, [PostgreSQL 17 partial indexes](https://www.postgresql.org/docs/17/indexes-partial.html), [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and Edge Functions documentation through the connected docs search. The requested Supabase changelog URL could not be read through the web tool (unsupported Markdown response); a direct fetch also failed DNS. No Supabase feature code was written or version changed, and no undocumented runtime diagnosis is asserted. Read installed Next.js guides before future web code edits; this phase does not edit web code.

## Handoff gates

1. **Phase 1 environment:** restore access to a healthy disposable PostgreSQL 17 test database with pgTAP/current migrations, then run the inventoried baseline and new authenticated-role/two-connection tests. Docker failure prevents a passing DB baseline today. This requires an environment change before Phase 1 behavior verification; it does not prevent completing Phase 0's contract inventory.
2. **Schema drift:** explicitly reconcile the missing hosted archive guard and preserve later generic mutation changes; validate effective schema, not only migration names. No remote repair is authorized here.
3. **Release/legacy:** web and supported old Android image callers prevent immediate endpoint retirement. Identify released supported builds and collect target-specific post-cutover evidence in Phase 4. New server protection must reject old queued/direct/center RPC writes.
4. **Device/manual:** verify the candidate MuMu build, staff Brave flow, real camera decoding at normal/enlarged QR size, themes/fonts/narrow screens, focus/logout/timeouts/request counts in Phases 2–4. These are pending manual/integration checks, not Phase 0 passes.
5. **Deployment:** v2 delete/export source is not deployed even though its SQL exists hosted. Coordinate lifecycle source release explicitly. Commits, pushes, deployments, remote migrations, external configuration changes and data deletion remain unauthorized.

All six Phase 0 discovery gates are met. There is no unanswered product-contract question or user decision needed to finish this phase. Stop before Phase 1; do not treat its environment prerequisite or A01–A17 as completed.
