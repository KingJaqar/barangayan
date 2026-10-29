# Resident Android notifications — compact context index

**Date:** October 27, 2026, Asia/Manila. **Run:** document-only planning. **Product phases 0–6:** Not started.

**Rules:** execution workflow, scope, decisions, phase checklists, and acceptance gates are centralized in the [implementation plan](C:/Users/User/barangayan/plans/Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md). The [breakdown](C:/Users/User/barangayan/plans/Resident_Android_Account_System_Notifications_and_Announcements_Redesign_Breakdown_2026_10_27.md) holds scenario IDs/copy and S01–S24 source references. Update changed findings here; do not duplicate the full catalog or plan.

**Evidence labels:** F rows are **verified facts** about cited source or historical snapshots, not runtime/deployment results. D rows in the plan are adopted **assumptions**, confirmed by R-gates. U rows below are **assumptions** needing the stated phase-entry check unless explicitly marked **open decision** or **blocker**; none needs user input in this pass. Excluded catalog suggestions are **optional improvements (out of scope)**. Current pass is planning-only; writes are restricted to the plan and this context note. No test, environment, packet, dependency, code/data or deployment action occurred.

## Baseline and ownership

- HEAD: `9fe8add15b0a5b75f6c232e30679da869731a4ea`. HEAD is not the working-copy baseline.
- [Source manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/source-manifest.json): 16 nonsecret source/config/catalog identities and actual working-copy snapshots under `C:/Users/User/barangayan/tmp/resident-notifications-plan-20261027/before/sources/`. Full status and scoped staged/unstaged binary patches are in the same private baseline folder.
- Pre-existing product edits include header, segmented control, Requests list, shell lifecycle and service fixtures. Earlier keyboard-plan/evidence edits and PDF deletions remain outside this task. No source reset, cleanup, restoration, commit, push, database change, or device operation was performed.
- The catalog is an existing untracked file from the preceding requested work. This run adds the implementation plan and task-local planning context/evidence; it does not modify the catalog or application.
- No sensitive config values were read into the packet. Phase 0 must record relevant ignored generated/config input identities and preserve sensitive material privately before product edits; planning does not claim an environment-complete product baseline.

## Context workflow record

| Step | Actual planning result |
|---|---|
| Git | Full status, relevant diffs, HEAD, 16 working snapshots and SHA-256 identities saved. |
| ripgrep | Narrow plan/tool/package/notification/route/test discovery. Root AGENTS is zero bytes; no mobile nested AGENTS found. Source/packet references narrowed to current owners. |
| Reader validation | Reused prior catalog/source analysis for established contracts; inspected changed header/Requests implementations and current package/consumer facts. Previous keyboard test statuses were read as historical context only, not adopted as notification baseline results. |
| Repowise | Not used. No installed/fresh index was established; no availability/freshness claim. |
| Repomix | Cached 1.18.1; 11 exact selectors, XML + parsable style + compression, git-frequency ordering disabled, default security/exclusions retained. All intended files included; security found no suspicious files. |
| Reader XML | All 11 entries read completely, 24,364 decoded characters. Chunks `[0,9828)`, `[9828,18854)`, `[18854,24364)` at 200/200/129 lines and 9,828/9,026/5,510 characters. Final continuation: none. |
| Original source | Resolved current animation body, announcement screen, sender version handling, iOS destination fallback, current script/config and known event/read paths. Compression is not evidence that omitted handlers are correct. Phase-specific missing bodies/tests remain execution inputs. |

[Selectors](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/selectors.txt), [packet](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/context.xml), and [packet manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/packet-manifest.json) preserve identities, included entries, and boundaries. Tool estimate: 8,084 tokens; this is not actual model usage or measured savings. Zero-byte AGENTS, the already reviewed catalog, lockfile, raw SQL migration, and the small iOS row-schema excerpt were deliberately handled outside the packet; the 11-selector set has no omissions.

## Verified findings / read index

Source identity is the full hash in source-manifest.json. Ranges below describe actual inspected originals or prior source reads reused in this same conversation, not whole-file completeness claims for compressed entries.

| ID | Finding and source location | Decision / gate impact |
|---|---|---|
| F01 | `announcements.tsx` entire current file, lines 1–end: heading, existing chips, scoped params, old unread provider. | Four-section replacement needed; preserve announcement details/links. R01/R08. |
| F02 | `use-unread-counts.tsx`, `refetchAnnouncementCounts`, `markAnnouncementsRead`, individual marker methods, provider values; prior source review plus full compressed entry. | Old bulk ignores active chip; report business/acknowledgment counts are separate. R02/R04–R06. |
| F03 | Migration 0135 event/inbox definitions, emit/notify functions, preferences, worker claim/purge; prior original source review and current catalog. | Request/payment/report rows already exist for some transitions; no duplicate Account events. Phase 0 expands exact later schema/producer dependencies. R03/R07/R09. |
| F04 | **Verified fact, current planning read:** `apps/resident-android-mobile/src/components/services/requests-list.tsx:176–234` uses shared height/opacity, settled natural height, an outer height wrapper and separate inner opacity wrapper; `src/constants/disclosure-motion.ts:4–7` supplies 280/220 ms timing. Earlier packet versions remain historical. | U06's design uncertainty is resolved; reuse this structure after execution-entry freshness validation. No native correctness or motion performance is claimed. D12/R12–R15. |
| F05 | `resident-header.tsx` current search ownership lines 30–80 and relevant dirty diff; compressed entry complete. | New user search/focus cleanup is unrelated and must survive bell change. R15. |
| F06 | `worker.ts` current lines 50–88: validates only destination v1, rewrites parsed destination to v1, and sends `data.v = 1`. | New types require coordinated sender updates, not just DB validation. D09/R10. |
| F07 | iOS `data/schemas.ts` lines 324–331 permits unknown destination/kind; notification model lines 30–102 validates each destination and falls back to unopenable generic entry. | Unknown rows need not fail the whole page; retain old routes and test actual fallback. D10/R10. |
| F08 | `push-notifications.ts`, token registration/removal and `presentNotification`; `use-notification-realtime.ts` five source listeners; prior original reads plus complete compressed entries. | Local migrated alerts overlap server path; title/body-only local payload has no record reference. Preserve Health branches. R07/R08/R16/R17. |
| F09 | Root `_layout.tsx` lines 81–92 contains app-level token registration and realtime hook owner. | One response/resource owner; phase 4 must inspect full auth/logout/current effect bodies before editing. R09/R13. |
| F10 | Current mobile package scripts and entire Vitest config; root/shared package scripts; existing local tsc/eslint/vitest entry paths. | No assumed notification test command. Resolve installed versions/workspace-specific binaries in phase 0. R17. |
| F11 | Catalog contains 52 Account and 17 System scenarios, including 22 document-request/report additions; identities snapshotted. | Plan §1.2 partitions all 69 IDs; conditional workflows are outside execution. R03. |
| F12 | Existing admin audit System category describes admin login/logout; it is not a resident System notice publisher. | Do not misuse it or add an admin screen. Minimal restricted backend System publisher is required. D07. |
| F13 | Public Shopee reference in catalog is historical, dated 2020. No new current screenshot was captured. | UI is a requested hierarchy adaptation; no exact current Shopee fidelity claim. D15/R01. |
| F14 | **Verified fact:** `supabase/migrations/0107_resident_account_setup_lifecycle.sql:48–49` installs the credential observer; `0122_resident_apple_account_setup.sql:22–42` records password presence/evidence/time when the hash changes, with no reset/change intent field. Search of migration 0139 found no observer replacement. | D16 uses one safe generic event when intent is unknown; A20 recovery tests must not invent a reset classification. Writer integration remains U01. |
| F15 | **Verified fact:** `supabase/functions/send-notifications/worker.ts:14–20` bounds claim to 100, HTTP attempts to 3 and per-attempt timeout to 15 s. `0135_resident_notifications.sql:320–351` ends exhausted attempts at 5 and skips stale alerts after 24 h. | Preserve/test these source limits; no observed provider-delivery result is claimed. New bounded work and runner/repair deadlines are assumptions in plan §6.2. |

## Resolved product decisions

### Historical concurrent-source refresh (prior planning pass)

Final validation found the Requests file changed after the initial snapshot. This was a concurrent working-copy change, not a planning-task edit. Its old identity and packet remain historical. The new Requests bytes and new shared motion constant were snapshotted under `tmp/resident-notifications-plan-20261027/source-refresh/`, with a saved delta. [Refresh source identities](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/source-refresh-manifest.json) override only the matching initial Requests entry and add the dependency.

A scoped two-file [supplemental packet](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/context-refresh.xml) was generated with the same cached version, XML/compression/security defaults, and no unexplained omission. Its [manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/packet-refresh-manifest.json) records the complete `[0,5636)` decoded read, 119 lines, no continuation. Compression omitted the motion constant's value and component body; both current originals were read completely for those relevant definitions. Fifteen original input identities remain reusable; the effective current manifest contains 17 unique inputs after the override/addition. D12 and F04 were updated, without regenerating the unchanged packet.

A second final check detected further external changes to Requests. The refreshed packet remains valid evidence of its captured snapshot but is not current context for that live file. Treat its effective manifest as a **reviewed snapshot manifest**, with Requests explicitly invalidated for execution. Other matching identities remain reusable. Preserve both failed freshness checks; final document validation separately reports live drift rather than overwriting it or pretending the source is stable. Phase 0 refreshes this narrow input once editing has settled; no product edit depends on it in this document-only run.

D01–D16 in the plan are the adopted execution assumptions. F04's narrow current read supersedes the historical uncertainty above; no packet was regenerated. D16 resolves credential wording from F14. Bulk timeouts reconcile authoritative state without automatically replaying a new snapshot. Phase-local gates and I1/I2/I3 now separate backend, isolated end-to-end and native/physical evidence; deployment/production statuses remain distinct.

## Execution prerequisites / unresolved source qualifications

These are concrete phase-0 actions, not undecided UI preferences or requests for user confirmation.

| ID | Fact to qualify | Bounded next step / consequence |
|---|---|---|
| U01 | **Assumption, partially confirmed by F14:** observer exists, but complete setup/review/refund producer integration remains unverified. | Phase 0 traces exact committed operations and authorization. Reset-versus-change wording is resolved by D16; no new intent source is presumed. |
| U02 | Actual isolated DB harness, installed versions, later guards and existing worker test invocation. | Read owning configs/scripts and resolve installed binaries once; run relevant baseline once. No commands or hosted migration status inferred from filenames. |
| U03 | Existing authorized operator/deployment path and worker schedule/configuration. | Qualify permission boundary and existing scheduler; add only the scoped backend notice operation/due processing. Hosted rollout gate stays pending until verified. |
| U04 | Current guest visibility and safe read-bridge behavior across consumers. | Verify later RLS/guards/current callers; exercise mirror reconciliation and repeat reads/unreads without new event emission. |
| U05 | Build/source match, physical Android/provider access and current native environment. | MuMu qualifies UI; phase 6 separately qualifies physical push. Device/provider absence cannot be converted into a pass. |
| U06 | **Resolved planning decision; verified fact F04.** Current body/dependency was read narrowly without a new packet. | Phase 0 still revalidates freshness before reuse; both original packets remain historical for Requests. |

## Verification ledger

- Planning baseline snapshot, packet inclusion/security, complete bounded XML reads, and original-source corrections: completed as described above.
- Plan references, Markdown tables, exhaustive scenario partition, phase/gate definitions, and final preservation hashes: final validation results are written to `validation.json` after the documents are saved.
- Product type/lint/unit/UI/SQL/native/build/delivery checks: **not run in this planning task**. No product code changed, so those suites are phase-0 inputs rather than an unnecessary repeated planning check.
- Historical keyboard-context results and device configuration were not reused as current notification tests. No production-readiness claim is made.

### Current planning-only revision

- Verified facts F04/F10/F14/F15 came from bounded read-only file/line inspection; no environment/tool-availability qualification was attempted. U01 is partially confirmed, U06 resolved for design; U02–U05 remain phase-entry assumptions, not observed failures or user-input blockers.
- Prior `validation*.json` files describe earlier document versions, not this revision. This pass checks document tables/links, all 69 scenario dispositions, phases 0–6, 18 R-gates, dependency order and local recovery/exit clauses in memory; it does not run application tests or overwrite historical validation artifacts.
- Size baseline from this pass: 54,554 bytes / 7,147 whitespace-delimited words. The revised plan is checked against both 15% caps. Context notes retain source qualifications without repeating the plan.
- Document validation confirmed 12 local references, all 69 unique scenario dispositions, seven phase checklists and 18 acceptance gates. The first structural check found phase 5's integration condition lacked an explicit gate label; it was named I2 and rechecked. Growth is approximately 8.5% in bytes / 7.5% in words. No application result is inferred from these document checks.
- Stop condition: measurable criteria, adopted scope/decisions, executable ordered phases, explicit integration/recovery, evidence-qualified unknowns, and methods for every gate. No further speculative or wording-only pass is scheduled.

When execution starts, add phase-0 baseline/check records and invalidate only changed F/U rows. Do not restart packet analysis or reread this entire catalog solely because a new turn begins.
