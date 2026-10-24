# Resident Android Search and Explore Implementation Plan

Status: Phases 1–3 Verified / Complete (2026-10-23, automated non-native evidence; Phase 3 server reads on an isolated local clone); Phase 4 Partially complete (2026-10-23: implemented, Gate 4A met; 4B met on LDPlayer except native Load more beyond 20 (data lacks > 20 matches); 4C met except the largest system font size); Phase 5 Partially complete (2026-10-23: implemented; 5A and 5C met on LDPlayer; 5B met except a native scope change, which needs the owner to sign in to another account or barangay); Phase 6 Partially complete (2026-10-24: Gates 6A–6D all met, including native guest Load more beyond 20, which also closes Phase 4's Load more item, and native fault injection; the exit waits only on Phase 4's largest font and Phase 5's native scope change, both owner-attended). Track implementation verification, deployment, and production validation separately. No deployment or production-validation status is claimed by this plan.

## Objective

Complete the Resident Android search flow with a dedicated Explore screen, persistent history limited to 10 queries, explicit search submission, category browsing, and reliable return navigation. Use the four supplied Facebook screenshots as references while preserving the Resident app's visual style.

## Evidence labels and planning boundary

**Verified fact — authoritative instruction:** The user's current request limits this pass to the plan and maintained context notes: no implementation, application-code edits, data changes, installs, environment setup, or deployments. Investigate read-only only to close a gap affecting implementation, acceptance, or risk; schedule heavier workflow steps at the responsible phase's entry unless they resolve such a gap now.

**Assumption — inherited label:** Unless explicitly labeled otherwise, objectives, requirements, choices, workflow instructions, unchecked gates, and proposed behaviors below carry the label **assumption: planned requirement**. Their phase gates state how execution will confirm them; they are not claims of existing or completed behavior.

- **verified fact:** Cite current file:line, identified command output, or version-matched documentation; record source identity and inspected boundaries.
- **assumption:** State the confirming gate; matching hashes alone prove identity, not analysis completeness.
- **open decision:** Name the unresolved choice/evidence gap, responsible phase, and closure method.
- **blocker:** Use only for an observed unmet prerequisite/gate; identify evidence and recovery.
- **optional improvement (kept out of scope):** Do not implement without separate authorization.

Map existing terms rather than add a parallel status scheme: Planned/Not started = unverified planned work; Pending = named open evidence/decision; Blocked = observed blocker; Verified = all phase gates passed. Completed reads, intent, and prior phase status do not prove a gate. No checklist guarantees zero defects.

## Scope, quality, and execution rules

Repository instructions and user requirements take precedence over generated guidance and tool recommendations. Implement only the specified search flow using existing components, sources, design, history, and navigation contracts. Resolve real gaps required for it; do not introduce unrelated features, UI, functions, dependencies, or architecture changes.

Resolve routine reversible choices from evidence and conventions, recording one-line rationale. Surface only a material change to scope, visible behavior, security, data handling, compatibility, recurring cost, or recovery that existing authorization cannot settle. Continue independent work while a dependent choice is open; do not invent approval gates.

| Quality goal | Observable passing contract |
| --- | --- |
| Fully working / no new bugs | Named journeys and failure cases in Phases 2–6 pass in their stated fixtures/native environment, with no task-introduced failures against the identified baseline. No absolute bug-free claim. |
| Clean / no errors | Relevant type, lint, test, build/export checks have no new errors; scoped journey logs have no new crashes, uncaught exceptions, unhandled rejections, or loop warnings. Expected denied/offline failures produce actionable UI, never raw codes/traces; retain secure diagnostics. |
| Lightweight / no bloat | Owned diff and dependency/lockfile review find no unexplained dependency, duplicate old/new implementation, dead import, speculative abstraction, or inactive-screen work. Each new abstraction names its requirement. Size/performance claims require a measured matching baseline; otherwise make no such claim. |
| Remove replaced code | Before deletion, reference/consumer and build checks confirm no remaining runtime, build, config, migration, compatibility, asset, or platform role. Record replacement evidence; preserve unrelated changes, shared consumers, historical packets, and recoverable snapshots. |
| No loops | Follow the bounded-work policy below; verify one submission per action, one in-flight page per query/category, no auto-retry, stale-response isolation, and cleanup on blur/unmount where appropriate. |
| Recoverable work | Before owned code edits, retain current patches/snapshots. Local-history writes require isolated fixtures or authorized protected preimages and a tested restore; code rollback cannot recover trimmed data. |
| Implementation ready | All six exits and explicit Phase 4/6 integration gates pass with matching source/build/environment identities; no required pending check or flow-critical baseline failure remains. Deployment and production validation require separate evidence and remain outside this plan. |

**Bounded work:** Each command/job gets an absolute timeout and stop condition before invocation; observe long jobs with polls of at most 60 seconds and stop at the recorded deadline. Allow at most two attempts per failing approach; a second attempt requires a diagnosed cause and relevant change. Never rerun an unchanged failure. After three distinct diagnosed approaches to the same blocker, stop dependent work and record it. Apply this to repairs, tests, builds, packets, and long-running tooling.

**Bounded search behavior:** Retain the existing 300 ms draft debounce and 12-second request deadline unless version-matched evidence justifies a documented adjustment. Zero automatic retries; one page per Load more action; one in-flight request per query/category. Stop on cancellation, changed query/scope, page failure, or exhaustion. Explicit Retry starts one request; scripted checks attempt a failing operation at most twice before diagnosis. Do not add a permanent user lockout. Cancel owned timers/listeners and ignore late responses.

Prefer MuMuPlayer for native Android. Docker is approved for a concrete isolation need; Brave/browser automation is approved for a relevant shared-web regression only. Record availability, environment, and candidate identity when needed; browser evidence does not replace native keyboard, Back, or lifecycle checks. Reuse installed/pinned tools; no installs/upgrades or new dependencies are assumed necessary.

Proceed in dependency order. Fix diagnosed in-scope defects in their owning phase, invalidate affected evidence, and rerun justified gates. Do not ship partial phase artifacts. Preserve uncertain/concurrent work and record blockers honestly.

**Optional improvement (kept out of scope):** New categories/filters/ranking, analytics, unrelated web/UI changes or cleanup, framework upgrades, performance redesign, backend schema/auth changes, deployment/release work. Surface evidence if a necessary fix would cross these boundaries.

## Shared phase workflow

Main purpose: reduce usage burn from redundant file reads, oversized tool output, unnecessary context regeneration, and repeated verification while preserving quality, security, and complete acceptance coverage. Usage savings are an objective, not a guaranteed or measured result.

At each implementation phase's entry, perform the following sequence; heavier steps are deferred during planning unless needed for a named decision:

Every execution phase must follow:

**Git baseline → ripgrep discovery, assisted by Repowise when useful → Reader validation → scoped Repomix → Reader XML analysis → original-source verification → scoped implementation and acceptance checks.**

The checklists below specialize this workflow; they do not replace or duplicate its shared rules.

### 1. Git: establish and preserve the phase baseline

- Inspect current status and relevant staged/unstaged diffs. Identify user-owned, task-owned, concurrent, and uncertain changes; HEAD is a reference, not the working-copy baseline.
- Before editing, save recoverable patches or snapshots for affected tracked files and relevant untracked/ignored inputs. Record paths, hashes, ownership, and recovery locations. Do not reset or stash unrelated work.
- Inventory relevant sensitive inputs by identity only. Exclude their contents from packets, normal logs, and ordinary snapshots; use secure storage if a sensitive backup is necessary.
- Reuse the baseline throughout the phase. Compare subsequent diffs with it, and rebaseline affected files if concurrent edits occur. Do not overwrite changes whose ownership is unclear.

### 2. ripgrep: discover the actual implementation

- Read applicable instructions and phase requirements, then confirm prerequisites in current code. Locate only relevant implementation, callers, consumers, tests, routes, schemas, and configuration.
- Start with narrow paths and symbols. Batch independent searches, save diagnostics when useful, and bound displayed output without silently discarding relevant matches. Expand discovery only for an unresolved requirement or evidence of another dependency.
- Use Repowise only when indexed relationships can replace repeated discovery or narrow packet selectors. Verify freshness against relevant working-copy contents, including uncommitted/new files. Refresh affected index data or use direct discovery when freshness is uncertain. Treat inferred relationships as leads requiring source confirmation.
- Avoid asking multiple tools the same answered question. Adapt stale plan paths to confirmed source and record material discrepancies.

### 3. Reader: validate reusable context

- Consult the compact context index before reading source or regenerating packets. Compare source hashes, packet identities, dependency versions, relevant relationships, and completed read boundaries; mark inputs unchanged, changed, missing, or uncertain.
- Reuse verified findings and analyzed entries. Invalidate conclusions affected by source/dependency changes. A matching hash proves content identity, not completeness or correctness of prior analysis.
- Record inspected paths, symbols, line ranges, packet entries, unresolved questions, and any Repowise freshness evidence. Prior phase completion and graph coverage are not proof of prerequisites or acceptance.
- “Reader” denotes the reading/validation step. Discover an available reader/parser and record it; do not invent a tool or claim a read that did not occur. A local bounded XML reader is acceptable if no dedicated Reader tool is available.

### 4. Repomix: prepare only missing context

- Discover and record the installed pinned/cached Repomix version and supported options. Generate scoped XML from confirmed selectors, including required instructions, contracts, consumers, and tests. Preserve security checks and exclusions; exclude secrets, unrelated directories, generated builds, and unrelated evidence.
- Record intended selectors, actual included files, source hashes, packet hash/identity, tool version, generation command/result, and omissions. Compare intended and actual scope and resolve unexplained omissions.
- Reuse unchanged verified packets. Add small supplemental packets for changed/missing context instead of regenerating historical packets; keep old packets identifiable and mark superseded entries.
- Repowise is optional; scoped Repomix context and source verification remain required. An observed unavailable required tool blocks its dependent gate; resolve it before completing that phase and continue independent work without claiming the workflow ran. Follow the bounded-work policy.

### 5. Reader: analyze the XML completely

- Extract required entries in bounded chunks, initially no more than 12,000 characters or 200 lines, whichever limit is reached first. Record entry names, extraction counts, and explicit continuation boundaries. Read each required entry completely across continuations; never silently truncate it.
- Reuse prior analysis only while both the entry and relevant dependencies remain verified. Read changed entries or missing continuations instead of restarting an unchanged packet.
- Tie concise findings to requirements and source locations. Record compression gaps and uncertainty. Packet token estimates are not actual model usage and do not establish savings.

### 6. Original source: verify, implement, and close the phase

- Resolve omitted bodies, handlers, effects, validation, styles, cleanup, and discrepancies against current source, schemas, configuration, and relevant version-matched documentation. Do not reread unchanged verified content without a new question.
- Before editing, establish the relevant existing-check baseline once and record the exact command, environment, exit code, result, and full diagnostic artifact where needed. An unchanged verified earlier result may be carried forward with its source/dependency identities and reason for reuse.
- Implement the smallest complete phase change. Review the owned diff, verify every acceptance criterion directly, and check safe removal of replaced code.
- Rerun affected checks after editing. Broaden only when shared behavior, diagnosed failures, or unresolved risks justify it. Repeat a check only after a relevant change, diagnosed failure, or other recorded reason.
- Preserve full diagnostic output when needed and inspect missing portions rather than rerunning solely to recover output. Record actual results, pre-existing failures, pending manual verification, and remaining blockers. Required correctness/security evidence takes precedence over lower usage.

## Context index and decision register

Maintain plans/evidence/resident-android-search-explore/context-index.md as the compact execution record. Update changed facts in place; link large manifests/diagnostics rather than duplicate narratives. Track evidence labels, source/dependency identities, ownership/recovery, packet manifests/read continuations, inspected symbols/lines, unresolved questions, phase status, and actual verification results. Initial unversioned planning reads remain leads.

| Label | Choice or gap | Rationale / confirmation |
| --- | --- | --- |
| verified fact — Phase 1 | Hidden /explore alongside /search; reuse the shared header/provider with explicit origin and submit/edit/back state. | Gates 1A–1B passed (phase-1-2026-10-23.md). No app-wide navigator refactor. |
| assumption — resolved choice | Up to 3 previews per group; 20 per category page plus one extra to detect more; See all selects that category. | Reuses the existing page size and supplied layout; Phases 3–4 verify boundaries/exhaustion. |
| assumption — resolved choice | Categories derive from supported sources/account eligibility; preserve guest history behavior. | Avoids adding content/auth features; Phases 2–4 verify contracts. |
| verified fact — Phase 2 | Keep account keys; serialize trimming/edits and persist at most 10 newest unique queries; older/corrupt saves are trimmed on load. | Gate 2A passed on isolated fixtures (phase-2-2026-10-23.md). Native restart persistence remains Phase 6B. |
| verified fact — Phase 4 (4A) | Explore keys one `createSearchResults` instance, its tab and its list scroll on `[submission, submittedQuery, userId, barangayId]`; the entry keeps its debounced live query only as the typed-suggestion title source. | Gate 4A passed (phase-4-2026-10-23.md). Native 4B–4C pending. |
| verified fact — Phase 3 | Range pagination with existing ordering and ID deduplication; one `createSearchResults` instance per submission/scope (reset = new instance), automatic client retries off. Detail-return state remains Phase 5. | Gates 3A–3C passed (phase-3-2026-10-23.md); completeness proven on a fixed dataset only. Live inserts/deletes may shift ranges; no snapshot-consistency claim or new refresh UI. |
| open decision — execution evidence | Installed versions, reader/Repomix availability, authoritative policies/test target, native environment, supported production build/export command. | Responsible phase entry resolves actual availability/compatibility; no tool/runtime/test success is currently inferred. Escalate only a material unresolved choice. |
| verified fact — Phase 2 | One submit path: provider `submitSearch` (validate/normalize → navigate once → save once → dismiss keyboard); `submission` changes once per accepted submit and is the key Explore uses to reset to All, page 1 and top scroll. | Gate 2B passed. Phase 4 must key Explore result state on `submission`, not on `submittedQuery`. |
| blocker | No blocker requiring user input established in this pass. | Pending evidence is not an observed failure; do not invent an approval gate. |

## Verified planning facts

Source paths below are relative to apps/resident-android-mobile/. Evidence is current narrow source inspection recorded in the context index; it establishes static contracts, not runtime success.

| Label | Finding and source |
| --- | --- |
| verified fact | Shared search provider wraps header/tabs: src/app/(app)/_layout.tsx:16, :20. Tabs use history Back and hide search: src/components/app-tabs.tsx:34, :52. |
| verified fact (updated after Phase 2) | Header treats /search as entry (autofocus, entry-only `Submit search` button) and /search or /explore as searching; keyboard and button call `submitSearch`: src/components/resident-header.tsx:36, :47, :133. |
| verified fact (updated after Phase 2) | History limit is 10 with serialized account-key operations and load-time trimming: src/lib/search-history.ts:3, :21–49. Guest writes are excluded and all submissions share the provider path: src/hooks/use-resident-search.tsx:56–66. |
| verified fact (updated after Phase 4) | Entry renders only Recent/Suggested/matching suggestions; its live query feeds suggestion titles only: src/app/(app)/search.tsx:13–16. Explore owns results and the six push/navigate destinations: src/app/(app)/explore.tsx:35–45. Six sources are defined in src/lib/resident-search.ts:4–11. |
| verified fact | Client-side scope/owner filters, guest source exclusion, and 21-fetched/20-returned behavior appear in src/lib/resident-search.ts:35–47. This does not verify authoritative database authorization. |
| verified fact | /search activation, 300 ms debounce, 12-second deadline, and abort cleanup: src/hooks/use-resident-search.tsx:77–117 (deadline :103, debounce :111). Map idle interval is 15 seconds: src/hooks/use-search-inactivity.ts:4–16. |
| verified fact | Read-only scoped Git status this pass reports existing modifications to resident-header.tsx and app-tabs.tsx. Ownership remains unassigned; execution must preserve/reconcile them. |

## Phase 1: Establish search state and route contracts

**Verified — Complete, 2026-10-23. Dependencies: none.** Independent route/state gates do not require later results rendering. [Execution evidence](evidence/resident-android-search-explore/phase-1-2026-10-23.md).

- [x] **Objective/boundary:** Separate draft/submitted query, retain /search, and add a minimal hidden /explore route shell with shared header/provider; no unrelated UI/navigation.
- [x] **Entry/workflow:** Reconcile instructions, existing header/tab edits, and the resolved navigation choice; run the shared workflow and relevant pre-edit lifecycle/navigation baseline.
- [x] **Inputs/consumers:** search.tsx, app layouts, app-tabs.tsx, resident-header.tsx, provider, actual route/config callers, focus effects and lifecycle tests.
- [x] **Transition:** Define submit/edit/back/origin contracts; migrate affected consumers atomically or preserve their old API until migration. Document impact before dependent phases.
- [x] **Applicable risks:** Scope/account changes, draft edits, stale responses, unexpected focus, duplicate navigation, and history cycles; no persistent data changes here.
- [x] **Gate 1A — state/route assertions:** Draft changes leave submitted state unchanged; submit captures one normalized query/origin; scope changes clear transient state; Explore does not autofocus; duplicate actions do not duplicate transitions.
- [x] **Gate 1B — navigation harness:** Ten open/submit/edit/back cycles follow the transition table without growing history; origin/Home fallback and header eligibility pass; affected type/lint/consumer checks have no new baseline failures.
- [x] **Recovery:** Restore only owned patches/snapshots and remove task-added routes after reference checks; preserve existing header/tab work.
- [x] **Exit/blockers:** Both gates and shared workflow pass with identified evidence. No Phase 1 blocker; native restoration belongs to Phase 5, not this phase's contract gate.

**Progress — 2026-10-23 (Asia/Manila):** Added scoped transient session API and hidden Explore shell; retained old draft/history consumers until Phase 2. Existing header/tab changes preserved. Cached Repomix 1.18.1 generated scoped XML; all 14 entries read and relevant compressed bodies verified against source. Gate harness passed 80 cycles (ten across eight origins), bounded transitions/history, normalization, duplicates, scope reset, focus and fallback checks. Lint, 309 unit tests and all four browser suites pass. Typecheck reports the same three pre-existing TS2859 errors in external-link.tsx, with no new diagnostics. Android/Hermes export passed after redirecting temporary files into the workspace following a sandbox TEMP write failure. Recovery, command logs, hashes, transition table and consumer impact are linked in the execution evidence. Historical planning-only restrictions are superseded by the current implementation request; no other plan/repository conflict. No new dependencies, commits, remote writes or deployment. Phases 2–6 remain unverified.

## Phase 2: Complete history, suggestions, and submission

**Verified — Complete, 2026-10-23. Dependency: Phase 1 verified (re-confirmed in code).** Submission is verified against the route shell; this phase does not claim final results behavior. [Execution evidence](evidence/resident-android-search-explore/phase-2-2026-10-23.md).

- [x] **Objective/boundary:** Empty entry shows Recent then Suggested; typed entry shows matching suggestions; add Search immediately right of X and preserve existing removal/clear actions.
- [x] **Entry/workflow:** Phase 1 contracts pass; discover actual storage callers/fixtures, baseline and restore method; complete the shared workflow before editing.
- [x] **Inputs/consumers:** History store/tests, entry UI, header/provider handlers, persistence load/edit callers, history UI/lifecycle tests and account-key contract.
- [x] **Submit contract:** Visible button, keyboard Search, recent query, and suggestion share one path: validate/normalize, save once, select All, reset page/scroll state, dismiss keyboard, navigate once. Empty/unsearchable input does none of these.
- [x] **Integrity/failure risks:** Persist at most 10 newest case-insensitive unique queries; duplicate selection promotes; serialized hydrate/add/remove/clear cannot lose new entries or resurrect deletions. Storage failure leaves search usable with actionable history feedback; guest writes remain absent.
- [x] **Gate 2A — storage fixtures:** Assert >10 migration, restart, duplicates, corrupt storage, storage failure, rapid hydration/edits, and account switching; exact newest order/limit/isolation and protected fixture restore pass.
- [x] **Gate 2B — UI/submission harness:** All four valid actions emit one matching submit/save/transition; whitespace or punctuation-only invalid input emits zero; empty/typed sections and X/Search order pass without new existing-check failures.
- [x] **Recovery/data:** Trim/restore only isolated accounts/fixtures during implementation tests. Before any real-account mutation, require an authorized protected preimage and tested restore that preserves later user removals/account isolation. Code rollback cannot recover discarded history; unavailable safe recovery blocks that write/check. No backend migration.
- [x] **Exit/blockers:** 2A–2B pass with baseline comparison. Native restart is independently verified in Phase 6; it is not claimed passed here.

**Progress — 2026-10-23 (Asia/Manila):** History limit is 10 with load-time migration of older/corrupt saves; empty entry lists Recent then Suggested (fixed recents consuming all six suggestion slots); entry-only `Submit search` button sits immediately right of X. Keyboard, button, recent and suggestion all call the provider `submitSearch` (validate/normalize → navigate once → save once → dismiss keyboard; `submission` key changes once per accepted submit for Phase 4's All/page/scroll reset). History errors are typed (`load` offers Try again; failed edits re-read saved state). Cached Repomix 1.18.1 scoped packet (14 entries) read completely in two chunks with original-source verification. Gate 2A: 8 isolated store fixtures pass. Gate 2B: new `tests/resident-search-submit.mjs` passes with no console errors. Lint, 312 unit tests and all five browser suites pass; typecheck shows only the three pre-existing TS2859 errors in external-link.tsx. Discrepancies: `selectSearch` removed (consumers migrated); `historyError` is now a code. Interim until Phase 4: a submission opens the empty Explore shell; live results still show on the entry screen while typing. Native restart/keyboard checks remain with Phases 4–6. No new dependencies, commits, remote writes or real-account data access.

## Phase 3: Implement pagination and query-state contracts

**Verified — Complete, 2026-10-23. Dependencies: Phases 1–2 verified (re-confirmed in code).** This data contract precedes the consuming UI, removing the former UI/pagination dependency gap. [Execution evidence](evidence/resident-android-search-explore/phase-3-2026-10-23.md).

- [x] **Objective/boundary:** Extend existing ordered queries with category-specific 20-row range pages plus a “more” probe and normalized loading/error/partial-success state; no schema/auth changes.
- [x] **Entry/workflow:** Complete the shared workflow; confirm installed APIs against version-matched Supabase docs/changelog and identify actual policy/session/tenant contracts before relying on them.
- [x] **Inputs/consumers:** resident-search.ts/tests, provider consumers, source/table/schema/policy contracts, session/profile events, abort/retry paths, dependency versions.
- [x] **Compatibility/security:** Preserve consumers during API migration; validate/escape inputs, retain active/deleted/owner/scope restrictions, and verify authorization at the authoritative server layer. Client filters alone do not authorize reads.
- [x] **Concurrency/failure risks:** One in-flight page per query/category; deduplicate source/ID; cancel on changed scope/query and ignore late responses; retain successful rows when a source/page fails; explicit retry only and 12-second deadline.
- [x] **Gate 3A — query fixtures:** For 0/1/20/21/45 matches, assert ordered fixed-dataset IDs are reached once, exhaustion stops loading, overlapping load actions do not duplicate work, and failed pages preserve earlier rows.
- [x] **Gate 3B — lifecycle/error fixtures:** Invalid input makes zero requests; cancellation/stale replies cannot overwrite results; denied/offline/timeout/partial failure and explicit retry satisfy bounded work and actionable states.
- [x] **Gate 3C — authoritative read checks:** Using an approved read-only/isolated target and guest/two distinct resident-barangay scopes, verify unauthorized personal/cross-tenant reads fail; record actual policy and session evidence, not only mocks.
- [x] **Recovery:** Restore owned query/provider changes and cancel pending work. Use existing/isolated datasets; no production data edits or privilege changes. A necessary policy change beyond scope becomes an evidence-backed decision.
- [x] **Exit/blockers:** 3A–3C and affected existing checks pass. Missing policy/target evidence blocks the relevant gate. Document live range-shift limitations; claim completeness only for the fixed test dataset.

**Progress — 2026-10-23 (Asia/Manila):** Added `queryResidentSearchPage` (existing order + `order('id')`, `.range(offset, offset+20)` probe, offset/eligibility/tenant validation before any request), typed `SearchError` failures (denied/offline/timeout/unavailable; cancellation separate), `searchCategories`, shared `SEARCH_DEADLINE_MS`, and the framework-free `createSearchResults` controller in `src/lib/search-results.ts` (one in-flight page per category, ID dedup, explicit retry, deadline, dispose drops late replies). `queryResidentSearch` keeps its API on top of the page query; `search.tsx` unchanged. Discrepancy fixed: installed postgrest-js 2.112.1 retries GETs up to 3× by default, contrary to the plan's zero-retry rule; search requests now call `.retry(false)`. Cached Repomix 1.18.1 scoped packet (10 entries) read completely with original-source verification. Gate 3A/3B: new `search-results.test.ts` (23 tests) passes. Gate 3C: role/claims probe on isolated clone `resident_search_phase3_20261023` — requests are owner-only, and announcements/document types/incidents are tenant-isolated for residents. FAQ and medical drives are public across barangays, and incidents are readable barangay-wide (recorded as existing policy design, not changed). Lint, 335 unit tests, all five browser suites and the Android/Hermes export pass. Typecheck shows only the three pre-existing TS2859 errors. Two regressions in the first final run (harness mock export list, fixture type) were diagnosed and fixed. No repository-instruction conflict. No new dependencies, commits, remote writes or real-account data. The controller has no UI consumer until Phase 4.

## Phase 4: Build Explore and pass the integration gate

**Partially complete, 2026-10-23. Dependencies: Phases 1–3 verified (re-confirmed in code by Phase 3 candidate hashes).** Implementation and Gate 4A are verified; 4B passed on LDPlayer for guest and signed-in resident except native Load more beyond 20, and 4C except the largest system font size, so the exit is not met. [Execution evidence](evidence/resident-android-search-explore/phase-4-2026-10-23.md).

- [x] **Objective/boundary:** Show submitted query in shared back/search header; All has up to 3 previews per nonempty source; category tabs/See all select the same state; Load more uses Phase 3 pages. *(Met in the 4A harness; native confirmation in 4B.)*
- [x] **Entry/workflow:** Gates 1A–3C pass on matching contracts; complete the shared workflow for missing UI/consumer context and verify supplied reference-image identities.
- [x] **Inputs/consumers:** explore.tsx, header/provider, labels/models, existing search result handlers, actual detail/tab consumers, theme/fonts, safe areas/floating tabs, reference screenshot 4.
- [x] **Phase 2 handoff:** Key Explore category/page/scroll state on the session `submission` value. Replace the live results still rendered on the entry screen (search.tsx) once Explore shows them, after consumer checks; the entry then keeps only Recent/Suggested/matching suggestions. *(Done; the entry's live query remains only as the source of typed suggestion titles.)*
- [x] **UI/state/access risks:** Distinguish loading/empty/denied/error/partial results; retain successes and retry failed work without raw codes/sensitive data. Explore starts with keyboard closed; only supported eligible categories appear.
- [x] **Gate 4A — render/control checks:** Preview cap, All/category/See all agreement, query/control visibility, guest tab eligibility, loading/empty/error/partial rendering, and pagination beyond 20/exhaustion all meet exact assertions.
- [ ] **Gate 4B — native integration:** On MuMuPlayer or an identified native Android target, all four submit paths display actual matching results; category Load more works; all six applicable result types open the correct content/identifier/date, not merely dispatch a route. *(Met on LDPlayer 2026-10-23 except Load more: all four submit paths (keyboard, button, recent, suggestion) show real results, and all six result types open their own item (documents, announcements, health, help after a help-detail fix, My requests REQ-2026-00074, My reports "report title"). Pending: native Load more needs a source with > 20 matches, which the hosted data for this guest/resident lacks; covered by 4A.)*
- [ ] **Gate 4C — accessibility/layout:** On an identified small display, both supported themes, and increased text size, no controls/results are clipped/obscured; each control has a label, tabs expose selection, and touch targets meet numeric minima recorded from existing accessible components before editing. *(Met on LDPlayer ≈ 386 dp wide in light and dark with a changed accent at default text size; browser approximation also passes at 1.3 text. Pending: native largest system font size, which needs an Android system setting change; deferred by the owner 2026-10-23.)*
- [x] **Recovery:** Revert owned UI/extraction changes while preserving earlier verified contracts; remove replaced renderers only after consumer/reference verification.
- [ ] **Exit/blockers:** 4A–4C pass on a matching native source/build identity. Missing native/backend evidence blocks this integration gate; mocks alone do not close it.

**Progress — 2026-10-23 (Asia/Manila):** `explore.tsx` now renders submitted results: one `createSearchResults` per `[submission, submittedQuery, userId, barangayId]` (created in an effect, disposed on change/unmount, read via `useSyncExternalStore`), All with ≤ 3 previews per nonempty source and See all, existing underline `SegmentedControl` tabs (eligible sources only) in a `ScrollableChevronRow`, category paging with Load more / Loading more / No more results, typed failure messages with explicit Try again, and the existing result destinations (moved from `search.tsx`). Tab, page and scroll reset on every accepted submission. The entry screen renders only Recent/Suggested/matching suggestions; its live query remains solely as the typed-suggestion title source. Discrepancies: react-native-web 0.21 ignores `accessibilityState`, so the new harness mirrors it to `aria-selected` like the existing UI harnesses; content-sized underline tabs got `minWidth: 48` to meet the recorded minimum (shared component, Services suites pass). Cached Repomix 1.18.1 packet (6 entries, 567 lines) read completely; Phase 3 sources reused by hash. Gate 4A: new `tests/resident-search-explore.mjs` passes (11 assertion groups, no console errors). Lint, 335 unit tests, all six search/shell browser suites, two Services suites and the Android/Hermes export pass; typecheck shows only the three pre-existing TS2859 errors. No repository-instruction conflict, no new dependencies, commits, remote writes or real-account data. Remaining: native 4B/4C on MuMu or another identified Android target, including an owner-signed-in pass.

**Progress — 2026-10-23 18:48 (Asia/Manila), LDPlayer native run:** guest pass on LDPlayer (Android 9, ≈ 386 dp) with the dev client on the project's Metro and the hosted backend (read-only). Real results, preview cap, See all/tab agreement, exhaustion text, back to Explore/entry/origin, and dark theme + accent all behaved correctly. Defect found and fixed: `settings/help/[articleId].tsx` showed "Article not found" for guests although FAQ rows are guest-readable (`0088`); guests now load by ID, and residents keep the barangay filter. `help-legal-about-ui.mjs` got a `useAuth` stand-in; it, lint and typecheck (only the three pre-existing TS2859 errors) pass. Still pending: signed-in recent-query submit and My requests/My reports destinations, native Load more (no guest source has > 20 matches) and the largest Android font size. At the owner's request, the Help Center list, help detail and About Us now load for guests (unscoped read scoped by RLS, as on resident-web); checked on LDPlayer.

## Phase 5: Complete editing, Back, and result-return state

**Partially complete, 2026-10-23. Dependency: Phase 4 integration — not fully verified (native Load more > 20 and largest font still open; neither touches Phase 5 code). Phase 5 proceeded at the user's explicit request.** 5A and 5C met on LDPlayer; 5B met except the native scope-change check. [Execution evidence](evidence/resident-android-search-explore/phase-5-2026-10-23.md).

- [x] **Objective/boundary:** Focus Explore search to edit in entry; X opens empty entry; submit replaces the search session; return from a detail/tab destination restores query/category/pages/scroll.
- [x] **Entry/workflow:** Phase 4 passes; complete the shared workflow for changed effects/navigation and baseline actual native Back/focus behavior. *(Shared workflow done. Phase 4 not fully passed, see above. Native Back/return behavior before the edits was settled from expo-router source because no emulator was free; the one defect that source analysis missed, losing the origin, was found natively and fixed.)*
- [x] **Inputs/consumers:** Header/provider, every result destination, keyboard/Android Back handlers, origin/history, foreground/scope events, map-origin idle hook and existing lifecycle tests.
- [x] **Lifecycle/security risks:** Restore only within the same account/barangay; invalidate affected data on scope change. Prevent stale restore, unexpected focus, route cycles, inactive fetches, and leaked timers/listeners.
- [x] **Gate 5A — native return/edit:** For each supported destination, restore query/category/loaded IDs and the same visible result/offset within 1 dp on the same layout; editing/reset yields correct suggestions/new results without duplicate routes. *(All six destinations return to a pixel-identical Explore on LDPlayer.)*
- [ ] **Gate 5B — native Back/lifecycle:** Back closes keyboard first, then Explore → entry (query preserved) → origin/Home; ten edit/submit/open/back cycles meet the pre-recorded transition/request budget with no extra retained route; background/resume and scope changes never restore another scope. *(Met natively except the scope change. Keyboard-first is evidenced by the input-method state, since LDPlayer draws no soft keyboard. Ten scripted native cycles each give an identical frame. The transition/request budget (6/12 per cycle) is asserted in the harness. Pending: a native scope change, owner-attended.)*
- [x] **Gate 5C — map/timer:** Emergency/map-origin search returns correctly; waiting beyond 15 seconds cannot collapse Explore; leaving search cancels obsolete work and instrumentation shows no orphan owned timer/listener. *(Native map origin with a 21-second wait; abort and listener counts in the harness.)*
- [x] **Recovery:** Restore owned state/effect/navigation changes, cancel task-owned work and discard invalid transient caches; preserve persistent history and unrelated navigation changes.
- [ ] **Exit/blockers:** 5A–5C and affected regression checks pass. Browser evidence cannot close native Back/keyboard/lifecycle gates.

**Progress — 2026-10-23 (Asia/Manila):**

What changed:

- **Editing from Explore.** Focusing Explore's field reopens the entry with the submitted query (`editSearch`). X on Explore opens an empty entry (`editSearch('')`). Resubmitting gives a fresh session at All.
- **Android Back.** It now follows the header's Back path while searching (`BackHandler`), so leaving search clears the session and aborts Explore's pending pages.
- **Defects fixed:**
  1. A foreground or realtime profile refresh disposed Explore's results. Explore now waits only on `isInitialLoading`.
  2. Detail results pushed into an already-open tab stack stopped on that tab's list on Back. They now open anchored, and Explore's tab `state` listener sends one tab Back once the detail is popped.
  3. Opening a result in the origin's own tab lost the origin, and Back went to Home. `backFromSearch` now pops, then navigates to the origin.
  4. The entry's autofocus frame could fire on Explore and bounce the resident back to editing. It is now guarded.

How it was checked:

- Cached Repomix 1.18.1 packet: 10 entries, 941 lines, read completely, with expo-router 57.0.10 routers verified in source.
- The baseline and final runs both show only the three pre-existing TS2859 errors. Lint, 335 unit tests and all nine browser suites pass. The Explore harness gained 7 Phase 5 groups, and a mutation check confirms the refresh guard is tested.
- LDPlayer (Android 9, signed-in Phase Tester, hosted backend), checks that passed:
  - all six destinations return pixel-identical;
  - the stacks are left on their index;
  - focus-to-edit, X, and the Back order;
  - the origin fix;
  - background/resume;
  - the map origin after more than 15 s;
  - ten scripted cycles.

Plan discrepancies: MuMu was occupied by another project, so LDPlayer was used. Phase 4 was not fully verified, as noted above. There is no conflict with repository instructions. No new dependencies, commits, pushes or deployments. Account side effects: two saved searches and one announcement marked read. Out-of-scope observations, such as the header stuck after the app was exited and resumed, and the double-tap landing on X, are in the evidence.

## Phase 6: Final journeys, cleanup, and reporting

**Partially complete, 2026-10-24. Dependencies: Phases 1–5 — not fully verified (Phase 4 largest font; Phase 5 native scope change; Phase 4's native Load more > 20 is now met by this phase's guest run). Phase 6 proceeded at the user's explicit request.** Gates 6A–6D are all met; the exit waits only on those two owner-attended checks. [Execution evidence](evidence/resident-android-search-explore/phase-6-2026-10-24.md).

- [x] **Objective/boundary:** Verify the complete specified flow and safe replacement cleanup; fix only diagnosed in-scope defects. No release/deploy or new product features. *(Two defects fixed: a See all tab left out of view, and two unused exports.)*
- [x] **Entry/workflow:** Reconcile final hashes/concurrent edits, phase exits, baselines, native identity and actual supported production build/export command; complete the shared workflow with only missing final-review supplements.
- [x] **Inputs/consumers:** Final owned diff/new files, source/config/lockfile consumers, result destinations, packet/read manifests, tests, native logs/screenshots/build identity; include web consumers only if actual shared changes affect them. *(No web consumer affected.)*
- [x] **Gate 6A — automated/build:** Meaningful history/query/lifecycle/UI regression tests, relevant type/lint checks and supported production Android build/export show no new baseline failures. Record exact commands/results; reuse passed checks/artifacts only with matching relevant identities. *(No task-introduced failure. `services-lists-ui` regressed after the baseline because of changes outside this plan; it still fails with this phase's edits reverted.)*
- [x] **Gate 6B — native complete journeys:** Home → recent/suggested → type/submit → All → category → Load more → actual result → return/edit/clear/Back passes for signed-in/guest eligibility, restart-persistent history, and all applicable destinations on the matching candidate. *(LDPlayer: signed-in on the hosted backend, including restart persistence; guest on an isolated local clone with 45 matches, Load more to 45, then "No more results". An end-of-list return defect was found and fixed.)*
- [x] **Gate 6C — failure/logs:** Invalid/empty/no-match input, denied access, offline/timeout, storage failure, partial source/page failure, Retry, duplicate submit, cancellation and scope changes meet the owning contracts; scoped logs show no new uncaught/runtime errors. *(Native through a fault proxy: partial, offline, denied, timeout with the late reply ignored, failed page, one-request Retry, no auto-retry, invalid input, double tap. Logcat and Metro show no errors or warnings. Storage failure, cancellation and scope reset are covered by their harnesses; the native scope change remains Phase 5's owner-attended item.)*
- [x] **Gate 6D — deletion/lightweight:** Reference/build/config/migration/compatibility audit proves each deletion safe; no dangling imports/routes/assets, duplicate old/new paths, or unjustified dependency/abstraction remains. Size/performance claims require actual matching measurements.
- [x] **Recovery:** Fix in the owning phase, invalidate affected evidence and rerun justified gates; preserve owned snapshots/secure preimages. Never delete user work/historical packets or claim code rollback restored data.
- [ ] **Exit/blockers:** All gates pass, with no required manual check pending, known task-introduced failure or scope-critical gap. Unrelated baseline failures need impact evidence; if they prevent a required check, implementation remains unverified.

**Progress — 2026-10-24 (Asia/Manila):**

What changed:

- **See all keeps its tab visible.** On LDPlayer, See all on My requests selected a tab that stayed scrolled off the row. `SegmentedControl` (underline) now has an optional `onActiveLayout`, `ScrollableChevronRow` has an optional `reveal`, and Explore connects them. Other consumers are unchanged. The Explore harness gained a group for it, and a mutation check confirms the group catches the defect.
- **Cleanup.** `CategoryResults` and `FetchSearchPage` are no longer exported. No other unused export, leftover renderer or dependency change remains.

How it was checked:

- Repomix 1.18.1 supplement packet: 5 entries, 652 lines, read completely.
- Final results:
  - `tsc` exits 0; the three old TS2859 errors are gone without any change here;
  - lint passes, and all 335 unit tests pass;
  - 8 of 9 browser suites pass;
  - the Android/Hermes export passes.
- LDPlayer, signed in, hosted backend:
  - history order survives a force-stop and cold relaunch;
  - entry, submit, All, See all, open REQ-2026-00074, and Back to an identical Explore frame;
  - edit, clear, and Back to Home.

What is still open:

- Native guest journey with Load more past 20, and native fault injection. A local clone with 45 fixtures, a fault proxy and the Metro recipe are ready, but no emulator stayed up.
- `services-lists-ui` regressed outside this plan.

Plan discrepancies: the dependency on Phases 4–5 is not fully met; the native run used LDPlayer, not MuMu. There is no conflict with repository instructions. No new dependencies, commits, pushes or deployments.

**Progress — 2026-10-24 13:42–14:30 (Asia/Manila), native completion:**

What changed:

- **End-of-list return.** Stack details (help, document, request, report) hide the shared header, so Explore's list grows 80 dp while covered. Android clamped an offset near the end, and Explore came back 80 dp higher. Explore now records the offset and list height when it opens a stack result, and restores the offset once the list is back to that height. Natively pixel-identical; the harness reproduces Android's clamp, and a mutation check confirms the harness catches the defect.
- **Harness stability.** The harness now waits for batched sections, reaches tabs under an edge chevron through the chevron, and bounds the kept wrapper's height. Three consecutive passes.

How it was checked:

- LDPlayer guest run on an isolated clone (45 fixture articles) through a fault proxy:
  - Load more ×2 to 45 rows, one request per page;
  - the tab reveal;
  - partial, offline, denied and timeout states, with the late reply ignored;
  - a failed page with explicit Retry (one request each);
  - no auto-retry in 12–15 s;
  - invalid input (0 requests);
  - a double tap (one submission);
  - the Back order;
  - logcat and Metro without errors or warnings.
- Final results:
  - `tsc` 0 errors, lint passes, 335 unit tests pass;
  - 8 of 9 browser suites pass; `services-lists-ui` has the same failure caused outside this plan;
  - the Android export passes.

What is still open: Phase 4's largest system font and Phase 5's native scope change, both owner-attended.

Side effect: my Python edits briefly switched `explore.tsx` and the Explore harness to CRLF line endings; both are back to LF and the checks were rerun.

## Requirement → phase → verification

**Planned acceptance mapping:** Link actual outcomes in the context index. Rows for Phases 1–3 are met on automated evidence (see each phase record); Phase 4 has automated 4A evidence only; every other row remains unverified.

| Requirement | Phase | Verification / passing condition |
| --- | --- | --- |
| Draft/submitted separation, hidden routes | 1 | 1A–1B state assertions and ten bounded route cycles pass without history growth. **Met 2026-10-23.** |
| Latest 10, persistent/account-safe history | 2 | 2A migration/restart/race/failure/restore fixtures pass with correct newest order and isolation. **Met 2026-10-23** (native restart: 6B). |
| X/Search controls, four submission paths | 2, 4 | 2B + 4B: invalid input emits nothing; valid actions save/navigate once and show real matching results. **2B met 2026-10-23**; real results pending native 4B (4A harness shows results for submitted queries). |
| All/category/See all, complete page browsing | 3, 4 | 3A + 4A–4B: fixed 45-record dataset exhausts without duplicates; native browsing crosses 20 matches. **3A + 4A met 2026-10-23**; native 4B pending. |
| Server authorization, errors/retries/stale work | 3, 4, 6 | 3B–3C + 6C deny unauthorized reads, retain successes, ignore stale replies and obey bounds. **3B–3C met 2026-10-23** (isolated clone; public-by-policy sources recorded); 6C pending. |
| Resident design/header/accessibility | 4 | 4A–4C verify controls, labels and no clipping/obscuring on identified native configurations. **4A met 2026-10-23; 4C browser approximation only, native pending.** |
| Edit/restore/Back/map/lifecycle | 5 | 5A–5C pass all destinations, ten cycles, hardware Back/resume/scope changes and >15-second wait. **5A + 5C met natively 2026-10-23; 5B met except the native scope change (owner-attended).** |
| No new errors / loops | 1–6 | Exact baseline comparisons plus 6A–6C; no new failures/runtime errors or violated job/request bounds. **6A–6C met 2026-10-24 (no task-introduced failure; native fault injection and logs clean).** |
| Safe cleanup/recovery / no unjustified bloat | 2, 6 | Protected fixture restore + 6D reference/build audit and justified dependency/abstraction diff. **6D met 2026-10-24.** |
| Implementation readiness / honest reporting | 6 | All exits and final report below; deployment and production status require their own separate evidence. |

## Final execution report and stopping rule

Report what changed/was removed; exact verification actions and actual outcomes versus baseline with source/build/environment identity; material limitations (including live pagination range shifts); unresolved risks/blockers/pending checks; and remaining actions. Report implementation, deployment and production-validation statuses separately. Link requirement evidence. No “bug free,” “production validated,” or measured-savings claim without evidence; no checklist guarantees zero defects.

Planning stops when scope/decisions are explicit, criteria measurable, phases executable in dependency order without later-work exit dependencies, convergence gates defined, applicable recovery covered, and each gate has a method/pass condition with accurate evidence labels. Do not schedule more wording passes or speculative improvements. Execution stops at verified completion or an honestly recorded blocker; deployment/release remains out of scope.

## Visual references

**Assumption — reference use:** Verify repository image identities at Phase 4 entry; prior conversation inspection is not native implementation evidence.

Reference directory: `C:/Users/User/barangayan/contexts/facebook search flow screenshots/`

1. `facebook_search_flow_screenshot_1.png` — home/search entry point.
2. `facebook_search_flow_screenshot_2.png` — empty search with recent searches and recommendations.
3. `facebook_search_flow_screenshot_3.png` — query entry and matching suggestions.
4. `facebook_search_flow_screenshot_4(explore screen missing in resident android search flow).png` — submitted results, category tabs, grouped results, and See all.
