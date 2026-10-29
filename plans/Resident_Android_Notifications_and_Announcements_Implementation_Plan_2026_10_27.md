# Resident Android Notifications and Announcements — Implementation Plan

**Prepared:** October 27, 2026, Asia/Manila  
**Status:** Phase 0 Verified (2026-10-28, local baseline/contracts only); Phase 1 Verified (2026-10-28, local DB/parser contracts on a disposable clone; nothing activated or deployed); Phase 2 Verified (2026-10-28, isolated DB + worker/parser transport I1; nothing activated or deployed); Phase 3 Verified (2026-10-28, Android app-fixture scope; native/real-API items remain I2/I3); Phase 4 Verified (2026-10-28, simulated tap/token/session scope; physical tap and delivery remain I3); Phase 5 Verified (2026-10-28, isolated I2 scope: real PostgREST/RLS/worker journeys; native, physical and rehearsal items remain I3); Phase 6 Partially complete (2026-10-28: MuMu walk on an isolated stack + R18 rehearsal; R16/native tap routing blocked — no physical device or release build; two native badge defects fixed). Deployment and production validation are separately unverified (§8).  
**Authority:** User requirements and applicable repository instructions take precedence over this plan and generated context.  
**Coverage reference:** [Account/System breakdown](C:/Users/User/barangayan/plans/Resident_Android_Account_System_Notifications_and_Announcements_Redesign_Breakdown_2026_10_27.md). This plan resolves its implementation decisions and narrows conditional suggestions; the breakdown remains the scenario/copy catalog.  
**Working context:** [Context index](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/context-index.md), [source identities](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/source-manifest.json), [packet manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/planning-2026-10-27/packet-manifest.json).

**Evidence labels (existing IDs):** **verified fact** = F-ID with file:line or dated command/artifact evidence, never proof of runtime/deployment; **assumption** = adopted D-ID design or proposed requirement/checklist, confirmed by its R-gates; **closed decision** = D-ID the owner confirmed (dated); binding on later phases unless the owner reopens it; **open decision** = unresolved U-ID requiring material choice; **blocker** = U-ID preventing a named phase gate; **optional improvement (out of scope)** = excluded catalog rows. All prescriptive sections/tables below are **assumptions / acceptance contracts**, not observed successes. U-items default to assumptions with explicit confirmation steps until reclassified. Historical claims retain their dated F/artifact scope; “current” requires revalidation. No open decision currently needs user input; routine reversible choices remain within authorization.

## 1. Outcome and scope

Deliver one Announcements hub in Resident Android with four sections, in order:

1. Icon-and-label navigation cards: **All, Barangay, Account, System**.
2. Scoped unread summary and **Mark all as read**.
3. Chips for the selected view.
4. Announcement/notification rows, with grouped sections in All.

Remove the content heading **“What's New”**. Retain the existing app-header title **Announcements**, announcement content/details, themes, fonts, accessibility behavior, and safe areas. Shopee supplies the notification-hub visual direction; Barangayan supplies styling and the current Services → Requests → All grouping pattern.

Account includes the resident's document requests, request-linked payments/refunds, incident reports, and supported profile/verification/security events. System covers the service/update/policy notices specified below. Existing Services and Reports screens remain the owners of their records and actions.

Broad quality goals mean the measurable R-gates and named journeys in §7, with zero new relevant failures against an identity-matched baseline. No checklist guarantees zero defects. Unexecuted/unavailable gates stay pending; do not suppress diagnostics, fake successful states, hide failed sources as empty, or equate emulator tests with physical push. Implementation, deployment, and production validation have separate statuses (§8).

### 1.1 Boundaries

Included internal work: minimal contracts, event producers, recipient-safe queries, counts/read operations, System notice persistence/publishing, notification tap handling, and regression checks necessary for this hub to work end to end. Necessary internal functions are implementation details of this task, not permission to add unrelated product features.

Excluded: new admin/resident-web/iOS notification UI, health/attendance recategorization, residency approval/transfer, MFA/device-security dashboards, chat/follow-up workflows, new deadlines or rejection states, background privacy exports, appeals/suspension management, forced-upgrade enforcement, new public status hosting, new payment/refund business rules, and unrelated refactors. Existing policies and actions may be linked; do not invent missing operations to make a notification look actionable.

MuMuPlayer is the main Android UI test environment. Docker is permitted for an isolated backend. Brave/browser automation is permitted for relevant existing web/admin regression checks. Use these only where an acceptance gate needs them; do not launch parallel test environments for the same unanswered question.

### 1.2 Coverage disposition — exhaustive mapping of the catalog

Each scenario ID in the breakdown has exactly one disposition here. “Implement” means notifications for an existing domain event; it does not authorize a new domain workflow. Preserve the catalog's safe copy and recipient rules unless the actual current source requires a correction recorded in the context index.

| Catalog IDs | Decision | Required implementation / limit |
|---|---|---|
| A01, A03, A05 | Implement | One-time usable-account completion and meaningful supported profile/household changes. Exclude unchanged saves, theme/preferences, generated timestamps, and unrelated profile updates. |
| A07–A12 | Implement | Existing ID publication/review/replacement/revocation/repair transitions, tied to evidence version. Reuse existing Valid ID flows; add authorized reason display only where needed for the notification's existing review outcome. |
| A14–A15 | Implement | Current profile-email verification/change events. Keep contact email distinct from Auth sign-in identity. |
| A18–A20 | Implement | Trusted completed password writes; identify first-set only from known prior state. F14 shows no reset-versus-change provenance: use one “Password updated” event for either unless trusted intent is established; never infer intent from client focus or publish credential values. |
| A31–A40, A43–A45 | Implement | Document request submission/review, fee/payment/refund, processing, pickup, completion, cancellation, and material existing detail updates. Reuse existing request/payment inbox events. A32 reports the actual existing requirements-review result and links to current tracking; do not add a new evidence-reply form. A37 reports an existing pause/resume, not a new timer workflow. |
| A46–A50 | Implement | Existing report submission, in-progress, resolved, unresolved, and withdrawal transitions. Reuse existing `incident_status` events. |
| A02, A06, A13, A26–A28 | Preserve in context | Keep setup/email reminders, self-confirmed map pin, deletion outcomes, and synchronous export feedback in their existing flows. No new reminder scheduler, post-deletion inbox, async export, or cross-device permission history. |
| A04, A16–A17, A21–A25, A29–A30, A41–A42, A51–A52 | Outside this execution | Conditional or unestablished correction/security/residency/MFA/access/privacy/deadline/rejection/follow-up/reopening workflows. Keep the catalog for future discussion; do not implement or generate their notices now. |
| Y01–Y06 | Implement | Minimal authorized System service notices: publish/schedule, meaningful maintenance/incident revisions, cancellation, and recovery. These describe real operator-confirmed service conditions; no monitoring platform or outage detector is added. |
| Y08, Y11 | Implement | Informational Android update/meaningful feature notices with supported links/capability checks. No forced update gate or new feature implementation. |
| Y12–Y13 | Implement | Version-identified notices linking to existing terms/privacy content. Reading is not consent. |
| Y14–Y16 | Preserve in context | Permission/device/offline guidance stays within existing supported features. Do not add a persistent Device Settings filter or an offline-download manager. |
| Y07, Y09–Y10, Y17 | Outside this execution | New migration/retirement programs, upgrade enforcement, support-policy changes, and incident-impact case management. |

**Coverage rule:** an Implement row cannot be silently dropped because its producer is harder than expected. Phase 0 must locate its actual committed state and existing destination; resolve necessary notification gaps in phases 1–2. If the catalog assumes a domain action that does not exist, document the discrepancy and use the existing real outcome without inventing a workflow. An essential unresolved prerequisite blocks that row and the relevant completion gate.

## 2. Settled implementation decisions

| ID | Decision | Implementation consequence |
|---|---|---|
| D01 | Default All / All; retain `/announcements`. | Card switches happen in place; no four new top-level navigation stacks. |
| D02 | Account owns request/payment/report notification presentation. | `request_status` and request-linked `payment` → Document Requests; `incident_status` → Incident Reports. Preserve existing inbox IDs/destinations. |
| D03 | Keep announcements and private inbox as separate storage sources behind one screen query layer. | Do not add Account/System to the community announcement category enum or copy announcement rows into a second feed. |
| D04 | Summary and bulk read use category + chip over the full matching dataset. | Card/header badges use category/global totals. Collapsed groups and unloaded pages are included. Unknown is not zero. |
| D05 | Announcement read markers are canonical for an announcement; inbox mirrors converge with them. | Implement owner-scoped idempotent synchronization and one-time reconciliation. Keep Reports' `resolved_read_at` separate. |
| D06 | Bulk scope membership is captured by a database statement snapshot. | Use server-selected candidates in one atomic mutation, such as materialized candidate CTEs. Do not rely on loaded IDs, client clock, an arbitrary row cap, or a timestamp alone. |
| D07 | No new admin publisher screen. | Add a restricted backend System publisher/storage; U03 must establish the operator/scheduler path before implementation depends on it. Never presume an existing path or expose privileged publishing to residents. |
| D08 | New System lifecycle is minimal. | Draft/scheduled/published, meaningful revision, resolved/cancelled, archival/expiry. Existing delivery worker processes due notices in bounded idempotent batches. No new independent scheduler daemon. |
| D09 | Existing version-1 references remain supported; new types get an explicit validated contract. | Update database destination validation, worker parsing/message building, Android parsing, and compatibility tests together. Do not put arbitrary route strings or external URLs in pushes. |
| D10 | Preserve repository iOS fallback; installed behavior is unverified. | Verified fact F07: `data/schemas.ts:329` accepts unknown destinations; `features/notifications/model.ts:40` validates individually. Test generic fallback/compatibility, without an iOS redesign. |
| D11 | Keep existing retention baseline. | Preserve 90 days after read for inbox purge. Unread entries follow existing policy. Resolved/expired notices retain safe history; disable obsolete actions. No “read = delete/resolve/consent.” |
| D12 | Preserve Requests disclosure verified at execution entry. | ~~Verified fact F04: `requests-list.tsx:176` and `disclosure-motion.ts:4` now use shared RN Animated height/opacity.~~ **Superseded 2026-10-28 by F04′ (phase-0 context):** `requests-list.tsx:183–232` uses Reanimated shared values (`useRequestMotion`, measured height × progress, separate opacity); `disclosure-motion.ts` is Health-only. Reuse the current shared-value structure; runtime correctness remains unverified. |
| D13 | Server event/outbox path owns migrated phone alerts. | Realtime invalidates list/count resources. Remove only replaced announcement/request/report local-alert branches; preserve Health branches and shared token utilities that still have callers. |
| D14 | Do not promise app-wide outage delivery from an unavailable backend. | Persist an operator notice when reachable and preserve existing connection guidance. No new external status website/service is included. |
| D15 | Missing original reference is not a license to invent Shopee fidelity. | The catalog's public reference is historical. Implement the specified hierarchy with Barangayan styling; record visual comparison as an adaptation, not an exact current Shopee clone. |
| D16 | Use generic credential wording when intent is unknown. | Verified fact F14: `0122_resident_apple_account_setup.sql:22–42` observes a password write, not reset intent. One event avoids false labels and duplicates; A20 tests recovery producing that safe event. |
| D17 | Map catalog rows whose assumed action does not exist to the real committed outcome (phase 0). | F17: `review_service_request` is disabled; the resident-action state is the SLA pause (reason required) → A32 = pause start, A37 = resume, one event per pause occurrence. F18: `id_repair_required` has no runtime writer → A12 = false→true trigger plus one bounded idempotent activation reconciliation for currently flagged residents. |
| D18 | History without a phone alert is a first-class emission mode (phase 0). | F16: `emit_notification` always writes an outbox row. Phase 1 adds a no-alert variant (event + inbox, no deliverable outbox row) for self-actions (A03/A05/A07/A15/A31/A40-self/A46/A50) instead of touching preferences. |
| D19 | Baseline failures found in phase 0 are pre-existing, not regressions (phase 0). | `reports-announcements-ui.mjs:95` picker-duration drift (blocks announcement assertions 96–113), navigation-suite Health/Maps/root-mock failures, `service_foundations` 7 and `admin_request_row_workflows` 1 fee/acceptance failures. Phase 3 corrects the announcements fixture with its screen change; others stay out of scope. |
| D20 | Activation and destination shapes (phase 1). | **Closed 2026-10-28 (owner-confirmed).** `barangayan_private.notification_hub_settings` holds two owner-SQL switches, both off: `emission_enabled` (every `emit_notification_v2` call and System fan-out) and `v2_alerts_enabled` (outbox rows for v2 destinations; the current worker rejects v≠1 at `worker.ts:60`, so it stays off until phase 2 ships a v2-aware sender). v2 = `{v:2,kind:'notice',id}` or `{v:2,kind:'account',screen∈settings/profile/valid_id/email_verification/change_password}`; request/report events keep v1. Binding: phase 2 producers emit only through `emit_notification_v2`; `v2_alerts_enabled` is turned on only after the v2-aware sender passes I1; no other destination shape is added without reopening D20. |
| D21 | Guests get no hub summary (phase 1). | **Closed 2026-10-28 (owner-confirmed).** F30: guests cannot reach private helpers and have no read state, so `notification_hub_summary` is `authenticated`-only; guest All/Barangay keep the public announcement list without counts. A signed-in account without an active profile gets NULL (unknown) Account/System/read counts. Binding: phase 3 shows no guest card/header counts and renders NULL as unknown, never zero. |
| D22 | Individual reads reuse existing owner writes (phase 1). | **Closed 2026-10-28 (owner-confirmed).** No new single-item RPC: inbox `read_at` column grant (0135) and `announcement_reads` upsert/delete stay the individual operations; the bridge keeps both stores converged. Barangay pages stay a direct RLS query on `announcements` (`deleted_at is null`, `published_at DESC, id DESC` keyset), matching the summary's predicate. Binding: phase 3 adds no single-item read RPC or announcement page RPC. |
| D23 | Occurrence identity and key compatibility (phase 2). | The occurrence token is the client command (`statement_timestamp()`). The first occurrence keeps the legacy key, so existing event ids are unchanged; a genuine repeat gets `:x<token>`. Applied to the new producers and to the existing request/payment/incident producers (text unchanged). |
| D24 | Actor and recipient rule for new producers (phase 2). | A change made by the recipient is history only (A03/A05/A15/A40/A50); submissions (A01/A07/A11/A31/A46) are always history only; staff, provider-callback and service-role changes may alert. A recipient must be a usable account: resident, not deleted, profile completed. |
| D25 | Reconciliation scope (phase 2). | `notification_reconcile_account_events` (service_role, ≤100/call, history only) repairs only events whose key is the source row. Profile/household/fee/refund/password/email-verification occurrences have no durable per-occurrence source row, so a lost one cannot be rebuilt: residual risk of non-blocking producers, accepted. |
| D26 | System catch-up (phase 2). | `notification_publish_due_notices` (same signature) also delivers a published, unexpired (<90 days) notice's current revision, as history only, to eligible residents whose `updated_at ≥ published_at` and who have no event for it; it shares the ≤100 budget and ends when nothing is missing. |
| D27 | Worker contract (phase 2). | `parseClaimed` accepts v1 and the two validated v2 shapes; push `data` = destination + `inbox`; the sender calls `notification_publish_due_notices(100)` once before claim in its own try block. Deploy 0145/0146 before this worker; enable `emission_enabled` then `v2_alerts_enabled` (D20). iOS ignores v2 pushes (`parsePushData` is v1-only). |

### 2.1 Fixed filters and list rules

| View | Chips, in order |
|---|---|
| All | All, General, Emergency, Health, Events, Account, System. |
| Barangay | All, General, Emergency, Health, Events. |
| Account | All, Document Requests, Incident Reports, Verification, Security, Profile. |
| System | All, Service Status, App Updates, Policies. |

Access, Privacy, and Device Settings have no persistent launch workflows in this plan and therefore have no empty placeholder chips. Changing cards resets its chip to All; returning from details preserves the visit state. All groups have fixed order Barangay → Account → System, are disjoint, start expanded, and omit only confirmed-empty groups. A failed/loading group remains visible with its state. Other category views use one panel without a redundant category heading.

Sort Barangay by `published_at DESC, id DESC`; sort Account/System by the inbox's immutable `created_at DESC, id DESC` for stable compatibility with existing history. The stored event detail may separately show its actual occurrence time. Do not introduce an unverified sorting field or reset an old item's position every time read/current status changes.

Use one virtualized scroll owner, with category cards/summary in its header and the chips pinned. Initially request 25 rows per included source/group; use independent stable keyset cursors and correctly named load-older controls. Counts cover all authorized matching rows, not just those 25. Do not paginate by unstable offsets or let an announcement-heavy page starve Account/System.

### 2.2 Read and navigation semantics

- Scrolling, receiving, filtering, or collapsing does not mark an item read. Opening authorized content marks only the selected event read. A read-write failure keeps the content accessible and exposes a readable retry; no raw SQL/provider/error code is shown.
- Existing announcement links keep working even beyond the loaded page. Add owner-checked notification-ID entry for Account/System. Resolve legacy `request` to `/services/requests/<id>` and `incident` to `/reports/<id>`; do not copy iOS route names into Android.
- Request/report rows may open their existing authorized detail directly; other Account/System events use one small generic detail sheet and supported existing actions. An action's destination comes from a typed allowlist and current authorized data.
- Account notification bulk read never changes request/payment/report business statuses or Reports' separate acknowledgment marker. The target report screen retains its own existing acknowledgment behavior; test it independently.
- Announcement reconciliation initially preserves a read observed in either store. After the recorded migration boundary, explicit read/unread actions converge. Prevent feedback loops using actual-value comparisons and idempotent writes; read synchronization must not create new business events or reset timestamps indefinitely.
- Guest Account shows sign-in guidance; All/Barangay preserve permitted public announcements. System guest access uses only explicitly public existing/implemented notices; default is no private inbox exposure. Guests get no hub counts (D21). Setup and deleted/restricted-account guards remain authoritative.
- New items after the bulk statement snapshot remain unread. During a bulk operation, freeze the captured scope and prevent conflicting repeat operations; on error, reflect actual atomic state rather than announcing success.
- After an ambiguous bulk timeout, refetch authoritative state; do not automatically replay the mutation with a new snapshot. Only a fresh explicit action starts another operation, so arrivals cannot be silently cleared by a transport retry. Test lost response after commit as well as rollback before commit (R04).

## 3. Centralized execution and context workflow

**Main purpose:** reduce usage burn by avoiding redundant reads, oversized output, unnecessary context regeneration, and repeated verification while preserving correctness, security, and complete acceptance coverage. Usage savings are an objective, not a measured or guaranteed result.

Every execution phase follows **Git baseline → ripgrep discovery, assisted by Repowise when useful → Reader validation → scoped Repomix → Reader XML analysis → original-source verification**. Maintain one shared context index with concise phase supplements. Reuse unchanged verified inputs; do not repeat the whole audit per phase.

**Planning-only boundary:** this pass writes only this plan/context notes. No product changes, data operations, installs, deployments, test runs, setup, or new packets. Read-only investigation stops when a specific planning gap is resolved; heavier workflow steps remain entry actions of the phase needing them.

### W1 — Git baseline and ownership

1. Record HEAD, status, relevant staged/unstaged diffs, and phase touch list. HEAD is not the working copy. Label existing user edits, task-owned edits, and uncertain ownership; never reset/stash/clean unrelated work.
2. Before editing a file, save its actual working bytes and recoverable relevant patches. Include relevant tracked/untracked inputs and identities of ignored generated/config inputs where correctness depends on them. Sensitive values stay in private storage and out of XML, screenshots, committed evidence, and terminal output.
3. Reuse the phase baseline. At meaningful boundaries compare owned diffs and relevant hashes; a concurrent edit invalidates only affected findings. Never overwrite an unexpected user change with a historical snapshot.
4. Record raw diagnostic/snapshot locations separately from concise review artifacts. Verify absolute resolved targets before any Windows recursive cleanup; delete only task-owned, proven-obsolete files.

### W2 — Narrow discovery and optional Repowise

1. Read applicable instructions and that phase's prerequisites; locate exact symbols, callers, consumers, routes, schema guards, configs, and tests with `rg`/`rg --files`.
2. Batch independent queries and bound their output. If output truncates, inspect its missing relevant range; do not treat it as a completed read.
3. Repowise is optional. Use it only if available and its indexed relationships replace a real repeated search or narrow packet selectors. Verify freshness against working-copy hashes, including uncommitted/new files; refresh affected entries or use direct source discovery. Record freshness evidence and inferred relationships needing confirmation.
4. Do not install a new context service or ask multiple tools to re-answer a settled question. No Repowise freshness/availability claim is made by this planning run.

### W3 — Reader validation

“Reader” is bounded source/XML extraction through the available file tools; it is not an assumed unavailable plugin.

- Check existing indexes, source/packet hashes, dependency versions, completed entry/range reads, and required relationships. Mark each needed input unchanged, changed, missing, or uncertain.
- Hash equality proves content identity, not analysis completeness or correct behavior. Reuse findings only when the prior read and relevant dependencies actually answer the current requirement.
- Record changed conclusions as compact deltas, not copied phase narratives. Flag generated/source differences and adapt stale plan references to confirmed source.

### W4 — Scoped Repomix

- Use the pinned cached Repomix **1.18.1**, whose executable was located in this planning run. Revalidate that pin on resume; use the installed runtime, not an unpinned download. Keep default security scanning and exclusions enabled.
- Select exact required files from confirmed dependencies, including applicable instructions/contracts/consumers/tests. Exclude credentials, `.env` contents, local session/account data, build/media trees, generated repomix dumps, and unrelated evidence.
- Prefer a small supplemental packet for changed/missing entries. Reuse a verified packet if no required source/relationship changed; record why no generation was needed rather than producing identical output.
- Record selectors, intended/actual files, hashes, packet identity, tool version/options, result/security summary, and explained omissions. A zero-byte instruction file can be recorded outside XML; no unexplained omission is allowed.
- `--include` was verified on Windows in planning. Do not assume an earlier `--stdin` workaround succeeds; confirm actual inclusion. Compression is optional when it would cause more original-source rereads than it saves.

### W5 — Complete bounded XML analysis

- Extract at most **12,000 characters or 200 lines initially**, preferably within both bounds. Record decoded counts and explicit half-open continuation boundaries. Read every required entry completely across continuations; do not silently truncate.
- Read changed entries/missing continuations only. Tie concise findings to requirements and original paths/symbols/ranges. Record omissions, compression gaps, and uncertainty.
- Packet token estimates are tool metadata, not actual model usage or demonstrated savings.

### W6 — Original-source verification, change, and acceptance

1. Resolve omitted bodies, validation, effects, cleanup, handlers, styles, schema permissions, config, and version-sensitive contracts against current originals. Use matching official docs when needed. Repository/user rules prevail over tool suggestions.
2. Before product edits, run relevant existing checks once and retain exit code, exact command/cwd, full log, and baseline source identity. A prior plan's pass/failure label is only a lead until the current source and prerequisites are verified.
3. Implement the smallest complete change for the phase. Review the owned diff and check every acceptance criterion. Rerun affected checks; broaden only for shared behavior, a real failure, or unresolved risk.
4. Repeat a check only after a relevant change, diagnosed failure, changed prerequisite, or other recorded reason. Recover missing diagnostics from saved logs instead of rerunning to obtain output.
5. Failures are not hidden or treated as completed phases. Record pre-existing issues separately, fix task-induced errors, and retain pending native/physical/manual checks. Stop dependent rollout when an essential gate fails; continue useful independent diagnosis.

### 3.1 Context index and evidence contract

Use one compact index and per-phase evidence subfolders under `plans/evidence/resident-android-notifications/`. Each context entry contains:

| Field | Required information |
|---|---|
| Finding | Stable F-ID, requirement/scenario IDs, concise verified conclusion. |
| Identity | File SHA-256 and relevant dependency/config identities; working-copy ownership. |
| Read | Source symbols/ranges, packet entry/hash, completed extraction ranges, remaining continuation. |
| Discovery | Confirmed caller/consumer relationships; optional Repowise freshness evidence. |
| Question | U-ID, actual missing fact, impact, narrow next action, resolved decision/evidence. |
| Check | Command/cwd, source/build identity, exit code, result counts, log location, limitation. |
| Phase | Not started / In progress / Partially complete / Verified; Verified requires all local gates to pass. Keep implementation, deployment, and production validation statuses separate. |

Maintain a coverage ledger mapping every enabled catalog ID and acceptance R-ID to its producer, kind/filter, recipient, destination, test, current result, and evidence. Do not infer completion from packet coverage, test-file presence, or another phase's status.

### 3.2 Historical evidence and present qualification

**Verified facts — dated planning artifacts:** source-manifest.json records HEAD `9fe8add15b0a5b75f6c232e30679da869731a4ea`, 16 working snapshots, scoped patches and ownership; packet-manifest.json records the 11-file Repomix 1.18.1 run and complete bounded reads. The two-file supplement records a later Requests snapshot; it does not prove live identity. Full details stay in the context index rather than being duplicated here. Tool availability and historical results require phase-entry revalidation.

**Verified fact F04 — this pass:** Requests now has a separate inner opacity wrapper (`requests-list.tsx:219–230`); its previous packet entry remains stale. U06 is resolved for the planning decision, not runtime acceptance. **Assumptions U01–U05:** writer integration, test harness, operator/scheduler, read-bridge/guest behavior and delivery environment need their specified entry checks. No product tests/setup/packets were run this pass.

## 4. Data, runtime, and lifecycle design

### 4.1 Storage and API work

Keep public announcement rows and `announcement_reads`. Extend existing `notification_inbox`, private events/outbox, preferences, and worker contracts only where this scope needs them. Do not create a parallel Account inbox or per-screen copy of the event stream.

Implement a small shared kind registry: kind → presentation category/subfilter, safe label/icon, allowed destination. Preserve old kinds and existing preference semantics; new kinds may use existing default-on behavior only subject to the global opt-in. Do not add notification preference UI beyond the current global switch.

New System storage needs a notice ID, typed subtype, authorized scope, safe content, state, publication/effective window, stable revision, optional supported-action reference, creator identity, and resolution/expiry metadata. Use a minimal unique recipient/notice/revision delivery key. Validate dates, lengths, audience, and actions at the trusted boundary. Reuse current notice/policy data if discovery establishes an exact compatible owner; do not overload unrelated `site_content` keys without a typed contract.

Provide owner/tenant-scoped list, count, individual read/unread, and atomic scoped bulk operations. Exact API names and migration filenames are assigned during implementation through repository conventions; names below are contracts, not claims existing functions exist.

- Lists: bounded keyset pages per source, a stable cursor, full matching count, and visibility matching the count/read predicates. Account/System use `notification_inbox_page`; Barangay stays a direct RLS query on `announcements` (D22).
- Summary: category totals and selected-scope unread count; it excludes Health/attendance and Reports' business/acknowledgment counts. `notification_hub_summary` is signed-in only (D21).
- Individual read/unread: mutate only read state of the owner's identified event; announcement reads also reconcile a matching mirror. Uses the existing inbox `read_at` write and `announcement_reads` upsert/delete; the bridge converges them (D22).
- Bulk: one server-snapshot candidate set and atomic mutation of all matching unread items. Return actual applied counts; no success-after-partial-commit behavior.
- System publishing: service-role/authorized operator only; no arbitrary recipient-owned content injection, no client ability to assign categories or copy another user's event.

Use RLS, explicit table/column/function privileges, tenant checks, and validated inputs. Resident writes may only affect their own read state. Do not introduce `SECURITY DEFINER` just to bypass a failing permission check; any required privileged internal fan-out must have a minimal private boundary and explicit permission tests. Follow the Supabase skill/current documentation before schema/API implementation; use local isolated rehearsal and the repository's migration workflow rather than editing historical migration 0135.

### 4.2 Producers and idempotency

- Preserve existing events/inbox IDs for request/payment/report transitions. Add producers only for enabled missing transitions, using trusted persisted facts and the real current actor rules.
- Source INSERT success can produce submission history; failed submissions cannot. Self-submission/withdrawal/cancellation can be retained without noisy duplicate phone alerts. Track event delivery eligibility separately from history where required; do not mutate the global preference to suppress a single self-action alert.
- Status keys must identify an actual transition occurrence/revision. A retry reuses that occurrence; a genuinely repeated state transition does not collide with an old permanent subject/status key. Changing the emitter must not resend all existing events.
- Profile producers observe an explicit small field whitelist; read/preference/timestamp changes do not emit. ID producers track the actual evidence version and submitted/reviewed decision. Credential observers emit only a trusted completed event, without persisting credentials in notification payloads.
- Refund stages are independent: initiated/pending, claim action if supported, confirmed outcome/failure. Do not say “refunded” when only the request was accepted. Request/incident status change and existing detail visibility are not expanded beyond their current domain rules.
- System revision fan-out is bounded, resumable, and idempotent with transactional progress. Publish due scheduled notices before processing their delivery rows. Newly registered eligible residents can receive active notice history without replaying old alerts; existing eligibility changes require authorization refresh.
- If source producer failure is intentionally non-blocking for a domain write, provide a bounded reconciliation path keyed by the source occurrence. Delivery retries cannot repair an event that was never emitted. No perpetual database scan or timer per resident is added.

### 4.3 Delivery and resource ownership

Use one app-level notification resource owner, with account-keyed list/count invalidation. Preserve the separate Reports business/acknowledgment provider semantics; do not mount a delivery engine per card or make count refresh depend recursively on its own read write.

**Verified fact F06:** `supabase/functions/send-notifications/worker.ts:53–75` accepts and emits version 1. **Assumption D09:** validate/preserve new variants across database → claim → worker → push → Android; test existing request/incident/announcement payloads and iOS fallback. A database-only test is insufficient.

Configure required Android notification channels through the existing notification library and supported installed version. Add one notification-response owner for warm/cold taps and one minimal account-bound pending intent. Unsubscribe/abort on logout, ignore late responses from the previous resident, and use supported offline token-release behavior without deleting another installation's registration.

No repeated permission prompting on ordinary render/foreground cycles, no uncontrolled poll/resubscribe loops, no duplicate local/server display for migrated events. Keep bounded existing retry/backoff behavior; do not remove legitimate finite worker batches merely to claim “no loops.”

### 4.4 Lightweight implementation and cleanup

Prefer existing themed rows, read controls, refresh primitives, history-resource helpers, and Requests section presentation. Introduce only small cohesive modules needed for classification/querying/rows/taps; do not build a generic notification framework or add dependencies by default.

Cleanup is part of the phase that replaces a path. Delete styles/handlers/exports/files only after runtime, build, config, route, migration and compatibility searches plus affected checks show no remaining role. Record that evidence per deletion. Assumption U02 (historical F08 requires freshness): old realtime/templates may still serve Health, so retain used branches. Preserve migration history, useful tests, user evidence/snapshots and unrelated files.

Remove task-only diagnostics from shipped paths. Close only task-owned processes/connections and restore changed device/browser settings after tests. Keep recoverable evidence and explain any intentionally retained compatibility adapter.

## 5. Phase-by-phase execution

**Assumptions — executable phase contracts.** Dependency order is 0 → 1 → 2 → 3 → 4 → 5 → 6. Each exit covers only work available in that phase; later native/physical gates are named explicitly, never borrowed as early passes. Integration converges at **I1 (phase 2: producers/API/worker)**, **I2 (phase 5: complete isolated user journeys)**, and **I3 (phase 6: native/physical/recovery)**. These are phase-local gates, not a parallel evidence-label scheme. Apply W1–W6, reuse identity-matched baselines, and record actual results/blockers in the central index. No extra agents are authorized.

### Phase 0 — Establish baseline and executable contracts

**Objective/boundary:** Verify source owners and executable contracts; no product behavior changes.

- [x] Entry: plan/catalog and ownership baseline available; refresh changed inputs only. Resolve U01–U04 decisions needed by phase 1; defer U05 device qualification until phase 6.
- [x] Consumers/context: S01–S24, current routes/writers/schema guards, shared/iOS parsers, packages and existing tests. Revalidate F04 motion and historical tool paths before reuse.
- [x] W1–W6: preserve working bytes; inspect prerequisites/callers; generate only justified missing context. Map each Implement ID to a real committed state, recipient and existing destination; use D16 for unknown credential intent.
- [x] Baseline: run relevant current type/lint/announcement/request/report/SQL/worker/parser checks once. Save command, identity, exit code, full log and pre-existing failures. Add tests only for real uncovered behavior.
- [x] Risks: uncertain ownership, stale source, absent harness/operator path and undocumented visibility rules. Never assume deployed migration state or a hardware test result.
- [x] Gate: source/coverage ledger accounts for all enabled IDs; test commands/fixtures and phase-1 permissions/recovery are concrete. No essential phase-1 decision is unresolved.
- [x] Recovery: discard only task planning derivatives; preserve user changes and snapshots. No data mutation occurs.
- [x] Exit: Verified only with the above evidence; otherwise name U-blocker and affected downstream gate, while continuing independent planning.

**Phase 0 status: Verified (2026-10-28).** Scope = local baseline and executable contracts; no product code, hosted data or device changed. Evidence: [phase-0 context](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-0-2026-10-28/context-index.md), [coverage ledger](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-0-2026-10-28/coverage-ledger.md), [baseline checks](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-0-2026-10-28/baseline-checks.md), [source manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-0-2026-10-28/source-manifest.json), [packet manifest](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-0-2026-10-28/packet-manifest.json).

**Progress note — 2026-10-28.**
- W1–W6 ran once: git baseline saved privately; 15/17 planning identities unchanged (Requests list + motion constant changed by concurrent user work, preserved); Repomix 1.18.1 8-file packet (security clean, no omissions) read in 7 bounded chunks; effective SQL read from a migrated disposable clone.
- Ledger: all 69 catalog IDs accounted for — 42 enabled rows each mapped to a committed writer, recipient, existing/new producer, filter and existing route; 27 non-enabled rows unchanged. Existing producers cover A34–A36, A38–A40 (non-owner), A47–A49; every other enabled row needs a phase-2 producer. Discrepancies resolved by D17/D18; F04 superseded (D12).
- U01–U04 resolved for phase 1 (U03 hosted scheduler/secret remains an owner rollout action); U05 deferred to phase 6.
- Checks (single runs, logs in `tmp/resident-notifications-phase0-20261028/logs/`): Android tsc 0 errors; lint 0 errors / 1 pre-existing warning; Vitest 335/335; services-lists, request-tracking-navigation, tracking-payment, shell-lifecycle, services-tab-stability pass; reports-announcements fails at pre-existing `:95` drift (history-only scope passes); navigation suite 11 pass / 4 pre-existing fail; iOS worker+parser Vitest 80/80; migrations 0118–0144 apply on clone `notif_p0_20261028`; pgTAP 11 suites green incl. phase17 121/121, `service_foundations` 108/115 and `admin_request_row_workflows` 42/43 pre-existing fee/acceptance failures (D19).
- Repository instructions: root `AGENTS.md` is empty and no nested instructions cover mobile/supabase, so no conflict with this plan.
- Next: phase 1 entry — read current Supabase guidance, then add migration 0145+ on the retained clone.

### Phase 1 — Notification contracts, query/read APIs, and System persistence

**Objective/boundary:** Add minimal schema/registry/read/query/System contracts in isolation; no UI redesign or live activation.

- [x] Entry: phase 0 Verified; isolated target/harness and read-data recovery confirmed; current Supabase guidance read before schema implementation.
- [x] Consumers/context: migration 0135 and later guards, shared types, current Android/iOS callers, worker payload contracts and ownership tests; reuse unchanged inputs/baselines.
- [x] Transition: additive schema preserves v1 and existing IDs; keep new emission disabled. Document new destination impact before dependent consumers change; old clients retain tested fallback.
- [x] Implement: owner-only read APIs, keyset lists/counts, atomic full-scope bulk, idempotent announcement bridge and restricted minimal System publisher. No historical migration rewrite.
- [x] Risks: forged/foreign input, guest disclosure, conflicting reads, new arrivals, partial writes, constraint/backfill failure and read-trigger amplification.
- [x] Verify: SQL fault/concurrency/ownership cases show zero unauthorized changes, list/count agreement, no page cap, atomic rollback and no business-event emission from reads. Local parser fixtures accept v1 and reject malformed input.
- [x] Gate: R02–R06/R09 and the database/parser portions of R10/R13 pass here. Worker transport is explicitly I1; full app/native behavior is I2/I3.
- [x] Recovery: before reconciliation capture affected read markers/mirror values and batch IDs privately; rehearse revision-checked targeted restoration in isolation. Code rollback alone is insufficient; never overwrite newer resident actions.
- [x] Exit: Verified local contracts and recovery evidence; absent isolation/restore capability blocks data-changing steps.

**Phase 1 status: Verified (2026-10-28).** Scope = local DB/parser contracts on disposable clone `notif_p1_20261028`; new emission and v2 alerts are off (D20); no worker, producer, UI, hosted DB or device changed. Evidence: [phase-1 context](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-1-2026-10-28/context-index.md), [baseline and verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-1-2026-10-28/baseline-and-verification.md).

**Progress note — 2026-10-28.**
- Changed: `supabase/migrations/0145_notification_hub_contracts.sql` (activation gate, new kinds/subjects/payload v2, coalesced destination validator, `emit_notification_v2` history-only mode, `notification_hub_summary`/`notification_inbox_page`/`notification_mark_scope_read`, announcement read bridge, service-role reconciliation + revision-checked restore, `system_notices` + service-role create/publish/revise/resolve/cancel and bounded resumable `notification_publish_due_notices`); Android `src/lib/notification-hub.ts` (views/chips, kind→chip registry, v1/v2 destination parser) + test; shared `SystemNoticeRow`/hub RPC types; iOS v2-fallback test case. Tests: `supabase/tests/resident_android_notification_hub.test.sql`, `supabase/tests/notification_hub_concurrency.mjs`.
- Checks: 0145 applies (and re-applies) on a fresh clone from `notif_p0_20261028`; new pgTAP 162/162; concurrency script 3/3 (snapshot, advisory-lock serialization, rollback); 11 existing suites green, `service_foundations` 108/115 and `admin_request_row_workflows` 42/43 identical pre-existing failures (D19); Android tsc 0, lint 0 errors/1 pre-existing warning, vitest 343/343 (baseline 335); iOS worker+parser 81/81 (baseline 80), iOS tsc 0; resident-web tsc 0.
- Defects found and fixed during verification: guests could execute new public functions through Supabase default privileges (F27); revoking `valid_notification_destination` broke resident `read_at` writes via the inbox CHECK (F28). Latent 0135 validator NULL pass-through closed (F25).
- Discrepancies/decisions: D20 (gate + v2 shapes), D21 (summary is `authenticated`-only), D22 (individual reads reuse existing writes; Barangay pages stay a direct RLS query) — all three **closed by the owner 2026-10-28**. F29 (deleted profile still reads its barangay's announcements via the existing policy) recorded, out of scope.
- Phase 2 inputs: call `emit_notification_v2` from producers (history-only for D18 self-actions); teach the worker v2 (`parseClaimed`/`buildMessage`) and call `notification_publish_due_notices` before `notification_worker_claim`, then enable `v2_alerts_enabled`; history for residents who register after a notice's fan-out is not delivered yet (phase 2 due-notice reconciliation).

### Phase 2 — Trusted producers, due notices, and delivery contract

**Objective/boundary:** Produce enabled events and compatible worker messages from existing domain transitions; no new domain workflows.

- [x] Entry: phase 1 Verified and actor/source mappings fixed; capture source identities and reuse matched domain/auth/worker baseline results.
- [x] Consumers/context: exact profile/setup/ID/email/credential/request/payment/refund/report writers, outbox/claim/purge, destination validators and old-client fixtures.
- [x] Implement: missing enabled producers, occurrence dedupe, safe generic text, silent self-action history, due notices and bounded reconciliation; preserve existing event IDs and actual refund stages. Per D20: producers call `emit_notification_v2` (history-only for D18 self-actions); the worker learns v2 (`parseClaimed`/`buildMessage`) and calls `notification_publish_due_notices` before `notification_worker_claim`.
- [x] Risks: repeated genuine status, retries, self-action duplicates, source-save failure, obsolete notice revisions, unknown credential intent, unauthorized recipients and historical replay.
- [x] Verify: each enabled transition and negative/duplicate/actor case persists the expected event once; retries preserve identity, new occurrences remain distinct, and reads/preferences create no events.
- [x] I1 gate: actual isolated writer → inbox/outbox → claim → worker-payload → parser tests pass; R03/R07/R09/R10/R13 backend portions pass. Assert safe v1/new-version transport and bounded retry counts. App routes are not claimed verified yet.
- [x] Recovery: turn off `emission_enabled`/`v2_alerts_enabled` (D20) and restore compatible worker code; repair only tagged task-owned event/outbox rows. Never undo a real password, request/payment or incident action to remove its notification. *(Verified locally: producers are silent with the gate off and v2 rows get no outbox row while v2 alerts are off; redeploying the worker and flipping hosted gates are owner actions.)*
- [x] Exit: Verified I1 with every enabled producer evidenced; unsupported sources or transport failures block phase 3 integration, not unrelated diagnosis.

**Phase 2 status: Verified (2026-10-28).** Scope = producers, reconciliation, catch-up delivery and the worker/parser contract on disposable clone `notif_p2_20261028` (= p1 + migration 0146); `emission_enabled`/`v2_alerts_enabled` stay off in the repository and in every clone; no Android UI, hosted DB, deployment or device changed. Evidence: [phase-2 context](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-2-2026-10-28/context-index.md), [baseline and verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-2-2026-10-28/baseline-and-verification.md).

**Progress note — 2026-10-28.**
- Changed: `supabase/migrations/0146_notification_hub_producers.sql` (copy catalog `account_event_copy`, recipient rule, `account_notify`, `occurrence_key`; triggers for A01/A03/A12/A14/A15, A05, A07–A11, A18–A20, A31, A32/A37, A33, A40-self, A43, A44, A45, A46, A50; existing request/incident producers rewritten with occurrence keys and unchanged text; `notification_reconcile_account_events`; `notification_publish_due_notices` with catch-up); `supabase/functions/send-notifications/worker.ts` (v2 destinations, due-notice step, `notices` in the summary); tests `resident_android_notification_producers.test.sql`, `notification_transport_i1.mjs`, iOS `notification-worker.test.ts` (+5).
- Checks (logs in `tmp/resident-notifications-phase2-20261028/logs/`): 0146 applies and re-applies; new pgTAP 125/125 (real `publish_id_submission`/`review_id_submission`/`submit_service_request`/SLA transitions); hub pgTAP 162/162; concurrency 3/3; **I1 8/8** (writer → outbox → claim → worker → Android parser, notice publish/revise/catch-up, v1 incident unchanged, ≤5 attempts × 3 requests then dead, opt-out); 11 existing suites identical to phase 0/1 with the gate off and on; `service_foundations` 108/115 and `admin_request_row_workflows` 42/43 unchanged (D19); iOS worker+parser vitest 86/86 (baseline 81), iOS tsc 0. Android checks not re-run (no Android file in this phase).
- Discrepancies/decisions: D23–D27. A32/A37 = resident-wait pause and A40 resident path = `transition_service_request_sla(cancel)` as recorded in D17; A45 coalesces at commit with a status/payment/fee event of the same transaction (only the negative/positive cases in one transaction are testable in pgTAP). A concurrent session's uncommitted `0147_resident_setup_id_submitted.sql` and edits to the `resident_account_setup`/`resident_apple_account_setup` tests make 3 assertions fail on a clone without 0147; unrelated to this plan and untouched.
- Repository instructions: root `AGENTS.md` is empty; the nested `AGENTS.md` files cover only `apps/admin-web` and `apps/resident-web`; no conflict with this plan.
- Phase 3 inputs: Account rows carry `kind` ∈ request_status/payment/incident_status/account_* with v1 request/incident or v2 account-screen destinations; System rows carry v2 notice destinations (detail from `system_notices`); A09/A10 show the review reason only inside Valid ID (reason display is phase 3 scope); guest rules unchanged (D21).
- Pending (owner/rollout, not part of this phase's Verified claim): deploying 0145/0146 and the worker, setting/rotating the worker secret and scheduler (U03), flipping the gates in D20 order, running `notification_reconcile_account_events` once after activation for A12.

### Phase 3 — Android data integration and four-section screen

**Objective/boundary:** Implement the requested hub with phase-1 APIs/phase-2 event fixtures; no unrelated Services or search refactor.

- [x] Entry: I1 passes; current header/search/Requests user edits preserved. Confirm affected UI/type/lint baseline once or reuse matching results.
- [x] Consumers/context: screen/feed/row/modal/chips/read controls, Requests disclosure/motion, history/refresh/theme, header/bell/provider, direct request/report routes and guards.
- [x] Implement: exact four sections/chips, disjoint All groups, full counts, one virtualized list, keyset pages, original announcement sheet, authorized direct records and minimal generic detail.
- [x] Risks: loading/unknown/empty/partial-error/offline state, stale response, rapid filters, failed read, deleted target, long text, collapsed focus, navigation/back and account changes. *(Fixture-covered except offline/reconnect, long-text/large-font and Android Back, which move to I3.)*
- [x] Verify: behavior fixtures cover scope/reset/back/read/count/paging/error cases, unchanged announcements and all enabled groups; fixture read mutations do not alter business state. Check current themes/fonts/large text and reduced-motion semantics. *(Themes/accent/font/320–412 px checked with reduced motion on; large text and reduced-motion-off are native checks → I3/R12. Back restoration is state-preserved by the mounted screen, not asserted.)*
- [x] Gate: R01–R06/R11/R14 app-fixture portions and accessible markup/navigation assertions pass. MuMu visual/TalkBack proof for R12 remains I3; no later gate is required to call this fixture scope Verified.
- [x] Recovery: restore owned UI changes only, preserving additive contracts/data and user edits; retain old compatible screen composition until replacement checks pass.
- [x] Exit: Verified behavior fixtures and clean owned diff; unsupported real API behavior becomes an I1 regression, not a mocked success.

**Phase 3 status: Verified (2026-10-28, app-fixture scope).** Scope = Android screen/hooks/data layer/header count against the phase-1 RPC contracts; fixture transport mirrors 0145's scope rules in JS (real database behaviour is an I2 journey); no DB, worker, hosted service, gate or device changed. Evidence: [phase-3 context + verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-3-2026-10-28/context-index.md).

**Progress note — 2026-10-28.**
- Changed: `announcements.tsx` rewritten as the hub (four cards All/Barangay/Account/System, scoped unread + Mark all as read, pinned chips, one FlatList with collapsible Barangay → Account → System groups, "What's New" heading removed); new `use-notification-hub.ts` (summary + three independently keyset-paged sources, realtime invalidation), `notification-hub-data.ts` (RPC/RLS reads, single-row read write, bulk RPC), `components/notifications/*` (cards, shared row, inbox row, generic detail sheet that re-reads System notices), extended `notification-hub.ts` (+22 unit tests); `use-unread-counts.tsx` now counts the whole hub for the bell and exposes `markHubScopeRead`/`markInboxRead`; `announcement-card.tsx` composes the shared row; `AnnouncementModal` unchanged. Deleted the replaced `announcements-feed.tsx` and `use-announcements.ts` (no importers). No dependency added.
- Checks (logs in `tmp/resident-notifications-phase3-20261028/logs/`): tsc 0; lint 0 errors / 1 pre-existing warning; vitest 33 files / 357 tests (baseline 335); new `notification-hub-ui.mjs` 16 scenarios pass; `reports-announcements-ui.mjs` now passes in full (baseline failed at the D19 picker drift — corrected to the committed 340/220/200 values, hook unchanged); shell-lifecycle, services-tab-stability, services-lists, request-tracking-navigation, tracking-payment pass; `expo export --platform android` exit 0. One 1003-row virtualized wait timed out once and passed on rerun without code change (flake). Not run/unrelated failing: `pull-refresh-settings-ui` (fixture mock lacks `usePathname`, no file of this phase involved), `resident-search-*` (Playwright headless shell missing).
- Decisions: D28–D33 (phase-3 context): atomic {view,chip} state; `announcementsUnreadCount` = whole-hub unread; first inbox page reads the scope total via the summary RPC (failure never hides rows); deep links resolve against owner data; old feed deleted; `historyBefore` accepts `published_at`.
- Phase 4 inputs: `announcements?notificationId=<inbox id>` opens an owner-checked Account/System item (record rows push `/services/requests/<id>` / `/reports/<id>`; account/notice rows open the detail sheet with an allowlisted action); `announcementId` unchanged. Local alert branches and the push-response owner are untouched.
- Pending (not part of this Verified claim): MuMu visual/TalkBack/large-text/offline/Android-Back (I3, R12), real-database list/count/read journeys (I2), R14 before/after latency and bundle measurements.

### Phase 4 — Android tap routing, alert ownership, and lifecycle cleanup

**Objective/boundary:** Integrate response handling and delivery ownership; preserve Health alerts and token utilities still in use.

- [x] Entry: phase 3 Verified, I1 sender contract and supported Android library/build identified; no physical test is assumed available. Reuse matched auth/navigation/sender baselines.
- [x] Consumers/context: root/app layouts, push/preferences/channels, session/logout guards, old local branches, pending intents and worker payloads.
- [x] Implement: one warm/cold response owner, replay protection, account-bound pending intent, owner re-fetch, valid routes and idempotent token/OS-state handling.
- [x] Transition: switch migrated local/server presentation together in the isolated build; retain Health behavior. Live activation remains off until rollout qualification; never remove the only working alert path first.
- [x] Risks: denied permission, foreign/malformed/deleted target, account switch during fetch, offline logout, repeated taps/foreground callbacks and duplicate presentation.
- [x] Verify: simulated receipt/tap/session tests assert one navigation and read per authorized event, zero foreign disclosure, and listener/token cleanup; denied/disabled alerts retain history without repeated prompting.
- [x] Gate: response/resource portions of R07–R10/R13/R15 pass. R08 physical tap and R16 delivery remain explicit I3 gates, never early passes.
- [x] Recovery: restore compatible local/server ownership as a unit, clear only task pending intents/listeners, preserve inbox/read history and other installations' tokens.
- [x] Exit: Verified simulated integration; absent physical credentials remain a phase-6 blocker only.

**Phase 4 status: Verified (2026-10-28, simulated scope).** Scope = Android tap routing, account-bound pending intent, replay protection, push-token lifecycle, Android channel and removal of the migrated local alert branches, against the Phase 1–3 contracts; no DB, worker, hosted service, gate or device changed (D20 gates stay off). Evidence: [phase-4 context + verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-4-2026-10-28/context-index.md).

**Progress note — 2026-10-28.**
- Changed: `src/lib/push-registration.ts` (pure register/release/retry/serial-queue rules, record + retry marker) and `src/lib/notification-tap.ts` (`pushInboxId`, replay guard, account-bound `createTapIntent`) with tests; `src/lib/push-notifications.ts` rewritten (Android `default` channel before any permission/token call, `release_push_token`-based release with a 5 s timeout, tap subscription + clear, token-change listener); `src/hooks/use-push-registration.ts` (register per account/foreground/token change, release on sign-out or switch, retry on foreground) and `src/components/notification-tap-handler.tsx` (taps → `/announcements?notificationId=…`, the Phase 3 owner-checked deep link); `_layout.tsx` wiring; Settings toggle is the only caller that may ask for permission; `app.json` gains the `expo-notifications` plugin (`defaultChannel`). Removed the announcements/incident/service-request local alert branches and their templates; Health branches kept (D13). No dependency added.
- Checks (logs in `tmp/resident-notifications-phase4-20261028/logs/`): tsc 0; lint 0 errors / 1 pre-existing warning; vitest 35 files / 384 tests (baseline 33 / 358); new `notification-tap-ui.mjs` passes (cold/warm/replay/forged/signed-out/switch/setup/recovery taps, listener cleanup, registration lifecycle); `settings-profile-ui` passes; `root-navigation-isolation` failed before any edit on a stale `Platform` mock and now passes (mock fix, run with an installed Chrome); `expo export --platform android` exit 0.
- Defects found and fixed: sign-out never released the push token (F38); permission was requested on every session/preference change and no channel existed for the Android 13+ prompt (F39).
- Decisions: D34–D38 (phase-4 context). F40: Health events also exist server-side, so Health alerts can show twice once server alerts are live (Health recategorization is out of scope, D13).
- **Rollout constraint (owner):** the Android build containing this phase must ship only after the worker is deployed and the D20 gates are on (§8.2 steps 2–3); it no longer presents announcement/request/report alerts locally.
- Pending (not part of this Verified claim): MuMu/physical tap and delivery, channels, OS permission prompt, Doze, native build with the new plugin (I3, R08/R16); real-database journey after a tap (I2).
- Phase 5 inputs: dead-code ledger candidates are already removed here (`announcementTemplate`, `incidentTemplate`, `serviceRequestTemplate`); `getExpoPushToken` is no longer exported; run `notification-tap-ui.mjs` with the other fixtures in the I2 regression.

### Phase 5 — Integrated regression, performance, and dead-code removal

**Objective/boundary:** Prove complete isolated user journeys, measure affected runtime work and delete only proven-obsolete replacements.

- [x] Entry: phases 1–4 Verified with exact app/source/DB identities; all owned edits separable from baseline. Read only changed supplements and unresolved failure logs. *(Identities in the phase-5 context; baseline logs saved; concurrent sessions' edits listed, untouched.)*
- [x] Consumers/context: actual API/producers/worker/Android paths plus existing Services/Reports/Health, shared/iOS compatibility and header/search regressions. *(One open search fixture failure: see status.)*
- [x] I2 journeys: operator notice or staff request/report/ID transition → event/outbox → resident list/count → detail/read/back; include foreign owner, delayed response, retry, partial-source failure, paging and concurrent bulk arrival. *(`notification-hub-i2.mjs` J1–J8: staff profile + incident transition + operator notice → worker → the app's own data layer over real PostgREST/RLS. Request/ID producers are covered by the real-writer pgTAP (125/125) and I1; "back" and the React screen stay with the fixture.)*
- [x] I2 gate: journeys pass against real isolated contracts, not only stubs; R01–R11/R13–R15/R17 automated/integration portions pass with zero new baseline-relative failures. R08 physical/R12 native/R16/R18 rehearsal remain I3. *(R-gate mapping in the phase-5 context; two defects fixed, F41/F42.)*
- [x] Performance: page ≤25 rows/source, one list owner and no per-row query fan-out; repeated toggles settle without accumulating listeners. Compare measured latency/bundle/query metrics to phase-0 values before making size/speed claims. *(Measured and asserted: ≤25 rows/page, 6 requests to open All, 1 per older page, 0 per-row queries, 7 channels constant over card cycles. Phase 0 recorded no latency/bundle numbers, so no size or speed comparison is claimed; bundle is 8,492,132 B.)*
- [x] Cleanup/risk: verify runtime/build/config/migration/compatibility roles before deletion, including Health callers. Retain useful tests/adapters and record each removed path's replacement and evidence. *(Deletion ledger in the phase-5 context: earlier deletions re-confirmed unreferenced, stale comment fixed, three unused exports un-exported, Health branches retained.)*
- [x] Recovery: restore task-owned deleted files/exports from snapshots; no data rewrite. A real regression gets a diagnosed narrow fix and targeted recheck, not a weakened assertion. *(No file deleted this phase; no data rewrite; pre-edit status/patch in `tmp/resident-notifications-phase5-20261028/before/`; no assertion weakened — the one fixture adapter change adds `range()` to the mock and a stricter burst assertion.)*
- [x] Exit: Verified I2 and deletion ledger; no unexplained new failure. Pending native/physical checks remain named rather than blocking this isolated scope retroactively.

**Phase 5 status: Verified (2026-10-28, isolated I2 scope).** Scope = integrated journeys against real PostgREST/RLS and the Edge sender on disposable clone `notif_p5_20261028` (= p2 + repository migrations 0147–0149), request-cost audit, deletion ledger and two defects the journeys exposed; no schema, worker, hosted service, gate or device changed (D20 gates stay off). Evidence: [phase-5 context + verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-5-2026-10-28/context-index.md).

**Progress note — 2026-10-28.**
- Changed: new `tests/notification-hub-i2.mjs` (8 journeys: writers → outbox → worker over PostgREST → the app's own `notification-hub-data.ts`/`notification-hub.ts` bundled unchanged); `loadUnreadAnnouncementIds` in `notification-hub-data.ts` and its use in `use-unread-counts.tsx` (F41: the per-row unread set was truncated at PostgREST's 1,000-row cap); new `lib/burst.ts` (+3 tests) coalescing realtime row events in the hub hook and the unread provider (F42: a bulk read refetched once per changed row); fixture mock `range()` + a 700-event burst scenario in `notification-hub-ui.mjs`; three unused exports un-exported and one stale comment re-pointed. No dependency added.
- Checks (logs in `tmp/resident-notifications-phase5-20261028/logs/`): I2 8/8; pgTAP on the p5 clone — hub 162, producers 125, phase17 121 and 12 older suites green, `service_foundations` 108/115 and `admin_request_row_workflows` 42/43 identical pre-existing (D19); concurrency 3/3; I1 8/8; Android tsc 0, lint 0 errors / 1 pre-existing warning, vitest 37 files / 391 tests (entry 35 / 384); UI fixtures notification-hub, notification-tap, settings-profile, shell-lifecycle, services-tab-stability, root-navigation-isolation, services-lists, request-tracking, tracking-payment, home-presentation, search session/submit/lifecycle/history pass; `reports-announcements-ui` passes (one 5 s virtualized-wait flake, same as phase 3, passed on rerun unchanged); `expo export --platform android` exit 0 (8,492,132 B); iOS tsc 0 + worker/parser 86/86; shared vitest and resident-web tsc pass.
- Decisions/findings: F41–F43, D39–D41 (phase-5 context). Observation: the screen's list owner and the app provider's count owner both subscribe (7 channels, constant) — Phase 3 design, left unchanged.
- Not passing / not mine: `health-presentation-ui` ("Next month", identical to the phase-0 baseline); `resident-search-explore` fails waiting for "See all My reports" — not in any earlier baseline; the fixture mocks `use-unread-counts` and none of this phase's runtime changes load there (a comment and two un-exports), so it is classified unrelated but **not baseline-proven**; the Explore/search owner should triage. `resident-shell-lifecycle` failed once at entry while another session was editing `app-tabs.tsx` and passed afterwards.
- Pending (phase 6): MuMu/physical tap and delivery (R08/R16), large text/TalkBack/offline/Android Back (R12), real Realtime row-event delivery for the F42 premise, interrupted-fan-out and restore rehearsal (R18), the native build with the `expo-notifications` plugin.

### Phase 6 — Native/physical acceptance and release handoff

**Objective/boundary:** Verify implementation on MuMu/physical Android and rehearse data recovery; actual deployment is a separate status/action (§8).

- [ ] Entry: I2 passes; U05 environment/build/provider facts and task-owned test accounts qualified; capture settings to restore. Missing hardware/provider is an R16 blocker, not a simulated pass.
- [x] Consumers/context: §7.2 cases, actual installed binary/source identity, Android OS/channels/TalkBack, isolated worker/schema and only changed evidence since phase 5. *(MuMu 12 / Android 12 dev client on a dedicated instance against an isolated stack; identities in the phase-6 context.)*
- [ ] MuMu: execute card/filter/read/detail/back, long-history/large-text/theme, interrupted motion, keyboard/safe-area/accessibility, reconnect and identity cases; record actual screenshots/logs and limitations.
- [ ] Physical: verify foreground/background/closed-app receipt/tap, channels, opt-out/permission denial and account isolation on the supported build. Synthetic local navigation cannot satisfy R16.
- [x] Recovery rehearsal: isolated additive migration/reconciliation, interrupted fan-out resume and targeted read restoration must retain existing data and avoid replay. No test notice/OTP or test record goes to a real resident. *(Scripts `phase-6-2026-10-28/r18/`: 0145+0146 over legacy data changed nothing; reconcile idempotent; restore 1 restored / 1 skipped preserving the resident's newer action; 250-resident fan-out interrupted, resumed 100/100/50/0, no replay; 0 push tokens, no worker run.)*
- [ ] I3 gate: all remaining R01–R18 implementation/native/physical/rehearsal subgates pass, with zero new relevant uncaught/runtime errors against baseline. Hosted deployment/production checks are explicitly excluded from this phase's verification claim.
- [ ] Recovery: stop owned test operations; restore device/browser settings and synthetic drafts. Before irreversible live steps, require the tested data-recovery procedure/backup and conflict handling in §8.2; code revert is not data restore.
- [ ] Exit: mark implementation Verified only when I1–I3/local gates pass. Otherwise Partially complete with exact blockers; deployment/production status remains independently unperformed/unverified. *(Not met: R16 and native tap routing need a physical device/embedded build — see status.)*

**Phase 6 status: Partially complete (2026-10-28).** Done: MuMu hub walk on an isolated stack (R01/R02/R11/R12 native subsets, details, Back restoration, themes/fonts/large text, real Realtime), two native defects fixed (F44/F45), R18 rehearsal. **Blockers (not simulated):** R16 — no physical Android device, no signed/embedded release build and no push provider in this environment; native warm/cold notification-tap routing — the Expo dev client relaunches to a blank launcher when a tray notification is tapped (F47), so it needs an embedded/release build. **Second pass (same day, embedded release build):** a local `expo prebuild` + Gradle `assembleRelease` (x86_64, 15 m 26 s, `usesCleartextTraffic` for the isolated stack) was installed on a fresh MuMu instance; guest (All/Barangay only, no counts, no read controls), another resident (no Account rows: "No account notifications yet."), an incomplete-profile resident (browse mode + "Complete profile" banner, hub open) and logout → login switching were walked natively. **F48 resolved (third pass, phone-profile portrait MuMu + release build with temporary `console.log`):** the "blank window" was my own probe route (an empty screen left on the stack — Back returned Home) and the first taps carried a malformed payload because an unquoted `&` in my `am start` deep link truncated `kind`/`id`; the app correctly ignored the invalid destination. With a quoted link the native warm tap logs `emit DEFAULT → inboxId → settle open (reachable true)` and the hub opens on `/announcements?notificationId=…`: **R08 warm routing is proven natively.** The final step (open the row, mark it read) could not be demonstrated because Docker Desktop's host-port relay kept dropping connections on this machine (the hub showed truthful load-failure states), so cold-start tap and read-on-open stay pending. F49 (fixed after the owner's go-ahead): `announcements.tsx` `loadThenOpen` now separates a thrown fetch error from a null (missing/foreign) row — a failure shows "This item could not be loaded. Check your connection and try again." with a **Retry loading item** button (the retry opens the item and clears the notice); only a confirmed missing row still reads "This item is no longer available." Applies to announcement deep links, notification deep links and an announcement mirror opened from the list. New fixture scenario in `notification-hub-ui.mjs`; tsc 0, eslint 0 on the file, `notification-hub-ui`, `notification-tap-ui`, `resident-shell-lifecycle` pass, vitest 38 files / 422 tests, lint 0 errors / the same 1 pre-existing warning. Not re-walked on a device (emulator and Docker torn down). Not walked natively: interrupted-motion/reduced-motion cases, TalkBack focus order. Evidence: [phase-6 context + verification](C:/Users/User/barangayan/plans/evidence/resident-android-notifications/phase-6-2026-10-28/context-index.md).

**Progress note — 2026-10-28 (phase 6).**
- Changed: `notification-bell.tsx` (badge wrapper `width: 48; alignItems: 'flex-end'` — the header bell showed `9…` for counts above 99, F44) and `count-badge.tsx` (`maxFontSizeMultiplier={1.2}` on the resident-presentation label — two-digit card/bell counts were clipped at 2.0× font, F45). Temporary native-tap probe route created and deleted; no dependency, schema, worker or gate change. Evidence/rehearsal scripts under `plans/evidence/resident-android-notifications/phase-6-2026-10-28/`.
- Checks (logs in `tmp/resident-notifications-phase6-20261028/logs/`): entry tsc 0 · lint 0 errors / 1 pre-existing warning · vitest 37/391 · hub-ui and tap-ui pass; final tsc 0 · lint 0 errors / same warning · vitest 37 files / 411 tests (+20 from concurrent sessions' tests, none in touched files) · `notification-hub-ui`, `notification-tap-ui`, `home-presentation-ui`, `services-lists-ui`, `services-tab-stability`, `resident-shell-lifecycle` pass. `reports-announcements-ui` fails at the 5 s "Large report 49" wait (twice) and fails identically with my two edits temporarily reverted → not caused by this phase; the Reports screens and that fixture are being edited by another session (last time this wait flaked it passed on rerun, so classify as unrelated/unproven, owner to triage). R18 database rehearsal: all assertions pass.
- Findings: F44–F47 and D42/D43 (phase-6 context). Follow-up done after the owner's go-ahead: `announcements.tsx:93` now refetches (`invalidateAll`) once the open-read write settles, like the explicit toggle at `:99`, so a dropped Realtime connection cannot leave an opened row looking unread; verified by tsc 0, eslint 0 on the file, `notification-hub-ui` and `notification-tap-ui` passing. Not re-walked on a device (the emulator was torn down).
- Pending manual/native (exact steps): build an embedded Android build with the `expo-notifications` plugin (memory recipe `export:embed --bytecode`, `debuggableVariants = ["debug","release"]`, lint-vital off) → install on MuMu; schedule a local notification carrying `{inbox, v:2, kind:'notice', id}` (or use a physical device with a real Expo/FCM token and the Phase 2 worker against an isolated DB) → tap from foreground/background/closed → expect `/announcements?notificationId=` to open the owner's row; repeat with permission off and the app opt-out; record on-device channel settings. F48 is resolved (harness, not app); repeat the cold-start tap and the read-on-open check on a stable backend (the R16 kit's `up.sh` + `trigger.sh`). F49 is fixed. Guest / `rwfb-other` / `rwfb-incomplete` / logout-switch were walked on the release build (second pass above); logout-during-fetch was not.

## 6. Check selection and execution discipline

### 6.1 Evidence-qualified entry points and runtime rules

**Verified fact F10:** mobile `package.json:63–64` defines `lint`/`test:navigation`; `vitest.config.ts:2` selects `src/lib/*.test.ts`. **Assumption U02:** shared/worker/DB commands and actual runner availability require phase-entry discovery; do not invent scripts, adopt old passes or download an unpinned runner.

**Verified fact — historical F10 command record:** the earlier workspace-dependency output located Node at `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` and local tsc/eslint/vitest entry files. **Assumption U02:** revalidate paths/installed versions and owning workspace before use; no present availability or dependency upgrade is claimed.

Use existing UI fixtures as behavioral tests, updating their current assertions rather than keeping abandoned screen assumptions. Existing files worth selecting by affected behavior:

- `reports-announcements-ui.mjs`, `services-lists-ui.mjs`, `request-tracking-navigation.mjs`, `tracking-payment-ui.mjs`.
- `resident-shell-lifecycle.mjs`, `services-tab-stability.mjs`, and affected search/session fixtures because the dirty header and shared provider are consumers.
- `resident_ios_phase17_notifications.test.sql`, existing worker tests discovered from their source/harness, and iOS notification parser/read tests.
- Mobile/shared targeted unit suites, changed-source lint, mobile typecheck, and Android bundle/export or build check after runtime integration.

These names are discovery inputs, not assertions they all passed. Run browser suites in their supported runner; browser fixtures are not native evidence. Brave is optional for actual web/admin regressions justified by changed shared behavior, not a substitute for MuMu.

### 6.2 Failure handling and finite execution

- Keep full stdout/stderr and exit code in one log per meaningful run. Print only a short result and relevant diagnostics. Read the saved remainder when output is truncated.
- Classify domain failure, test-fixture drift, environment failure, pre-existing failure, and task-induced regression accurately. A green result obtained by deleting an assertion or hiding an error is invalid.
- Stop after two failures of the same approach; diagnose before any revised attempt. Limit a diagnosed repair to three iterations, then record a blocker and affected gate rather than retry unchanged.
- Set deadlines before launch: default 90 seconds per UI journey, 5 minutes per targeted check, 20 minutes per build/full suite; a justified larger bound must be recorded first. Timeout means pending/failed, never passed. Stop owned work and retain diagnostics.
- Verified fact F15: worker HTTP limits are 3 attempts / 15 seconds each (`worker.ts:18–20`); outbox stops at 5 attempts and skips alerts older than 24 hours (`0135_resident_notifications.sql:320–351`). Assumption: preserve/test those limits; cap new publication/reconciliation work at 100 records per invocation with a resumable cursor and deadline. Stop on no progress. No new auto-retry after exhaustion.
- Dispose controllers/timers/listeners. Read synchronization terminates on equal state; require repeated read/unread tests to show no continuing writes/events after completion. Do not claim exactly-once phone presentation from event dedupe alone; record qualified provider behavior and residual delivery uncertainty.
- User-facing failures use readable messages with useful retry/next action; internal error codes remain in appropriately private diagnostics. “No error codes” does not mean removing error handling or diagnostics.

## 7. Acceptance matrix

### 7.1 Required gates

| ID | Acceptance requirement | Direct evidence |
|---|---|---|
| R01 | Four sections in order; exact cards/chips; no “What's New”; existing content/detail preserved. | Behavioral UI assertions + native captures. |
| R02 | Stable, disjoint grouping and keyset paging; full counts agree across cards/header/chips. | Multi-page fixture/API tests including tied timestamps and over 1,000 rows. |
| R03 | Every enabled Account/System row has a real trusted trigger, safe text, correct owner/filter, and supported destination. | Coverage ledger + source transition/integration tests; all 69 catalog IDs dispositioned. |
| R04 | Bulk read is atomic and full-scope, independent of page/group visibility; new arrivals remain unread. | SQL concurrency/fault-injection cases + Android summary assertions. |
| R05 | Individual read/unread works and announcement mirrors converge without duplicate rows or write amplification. | Two-consumer read/unread tests, reconciliation idempotency, bounded write counts. |
| R06 | Notification read never pays/completes/resolves or clears report acknowledgments. | Before/after domain-row assertions; target-screen behavior separately tested. |
| R07 | One durable event and one migrated alert path per occurrence; retry ownership is idempotent and genuine repeated transitions remain distinct. | Dedupe/retry/actor/status tests assert event/path counts; report provider delivery uncertainty separately. |
| R08 | Correct warm/cold/legacy routing, authorized direct fetch beyond loaded pages, unknown/deleted fallback. | Route fixtures + native navigation + physical push tap. |
| R09 | No resident/tenant leakage; guest/setup/deletion guards preserved; least-privilege write boundaries. | RLS/RPC ownership tests, switched-account late-response cases, guest UI. |
| R10 | v1 compatibility and new destination contracts survive database→worker→app; no arbitrary URL execution. | Validator/worker/parser tests and old-consumer generic fallback. |
| R11 | Loading, unknown count, empty, partial failure, refresh/read error, offline/reconnect states remain truthful. | Fault-injected resource fixtures + native subset. |
| R12 | Current themes/fonts/large text/TalkBack/reduced motion/safe areas and readable touch targets. | MuMu accessibility/native capture matrix; no clipping or invisible active controls. |
| R13 | No notification-generation/read/realtime/permission/subscription feedback loops or unbounded retry. | Transition/read counts, listener cleanup, timeout tests, native logs and settled behavior. |
| R14 | One list owner, ≤25 rows/source/page, no per-row queries/listener accumulation; no new dependency/abstraction without a requirement and reuse rationale. | Count queries/subscriptions on identical fixtures; record before/after bundle/latency metrics. Zero unmapped additions; no size/speed claim without baseline. |
| R15 | Existing Services/Reports/Health and header/search behavior preserved; existing user edits retained. | Affected regression results + baseline-versus-owned diff audit. |
| R16 | Real Android background/closed-app alerts, channels, opt-out and tap handling work. | Physical-device/provider evidence tied to actual build; emulator simulation alone cannot pass. |
| R17 | Replaced code has no remaining runtime/build/config/migration/compatibility role; zero new type/lint/build/test failures or relevant uncaught/runtime errors. | Deletion ledger + identity-matched baseline/final checks and native logs; retain named pre-existing failures, suppress none. |
| R18 | Isolated migration/backfill/worker rollout and data restoration rehearse successfully; no replay/test-recipient leakage. | Interrupted/resumed rollout, targeted restore and conflict-preservation assertions; hosted deployment has its separate §8 status. |

### 7.2 Compact native matrix

| Axis | Required cases |
|---|---|
| Views/filters | All cards; every enabled chip; exact source membership; zero and many items. |
| Read behavior | Open/read/unread; filtered bulk; collapsed/unloaded items; concurrent arrival; failed write. |
| Details | Announcement image/long description; request/payment/refund and incident routes; ID/current-state detail; System lifecycle; back restoration. |
| Identity | Guest, valid resident, required setup, another resident/tenant, logout/switch while fetching or handling a tap. |
| Network | Offline entry where supported, lost connection during read/refresh, reconnect, one failed source, worker retry/deduplication. |
| Layout | 320–412 dp class widths where available, default/large font, light/dark/custom accent/selected font, long labels and timestamps. |
| Interaction | Rapid navigation/chip/collapse, interrupted animation, repeated taps, app background/resume, Android Back, TalkBack focus/labels and reduced motion. |
| Delivery | Simulated navigation in MuMu; real foreground/background/closed-app push on physical Android, permission off and app opt-out. |

Use pairwise combinations where they cover independent layout axes; always run the high-risk combined cases: large text + long preview + trailing read control, account switch + delayed network, bulk + concurrent arrival, and cold tap + sign-in restoration. Do not multiply every axis into an unnecessary full Cartesian test matrix.

### 7.3 Requirement → phase → verification

| Requirement | Phase / convergence | Passing evidence |
|---|---|---|
| Given scope; no invented capability | 0–2 / I1 | All 69 IDs dispositioned; enabled sources/recipients/actions traced (R03/R10). |
| Fully working journeys/failures | 3–6 / I2/I3 | §7.2 journeys and denied/offline/timeout/duplicate/stale cases pass (R01–R12/R16); no new baseline failures. |
| No new errors / raw user error codes | 0, 5–6 | R11/R17 checks/log comparison pass; error-state fixtures show readable recovery, not internal codes. |
| Lightweight / no bloat | 3, 5 | R14 numeric page/query/listener checks and requirement-mapped additions; measured comparisons only. |
| Safe deletion / recovery | 1–2, 5–6 | R17/R18 role searches, restored fixtures and preserved newer actions. |
| Finite execution / no feedback loops | 1–2, 4–6 | R05/R13 exhaustion, cancellation/no-progress and quiescent-write assertions within §6.2 limits. |
| Production readiness, evidence honesty | 6 then separate release | I3 verifies implementation; §8 records deployment and production checks independently. No zero-defect guarantee. |

## 8. Completion, rollout, and handoff

### 8.1 Completion report

The execution report states what changed (including deletions/enabled IDs), actual check/journey results with counts/logs and source/build/DB identity, baseline failures versus regressions, material limitations, unresolved risks/blockers and remaining actions/owners. Separate isolated, browser, MuMu, physical and hosted evidence. Do not claim “bug free” or unqualified “production validated.”

| Status track | Evidence required; present status under this plan |
|---|---|
| Implementation | I1–I3 and all local R-gates pass; **In progress** — phase 0 Verified 2026-10-28 (baseline/contracts only); phase 1 Verified 2026-10-28 (additive migration 0145 + Android registry/parser, local clone only, emission off); phase 2 Verified 2026-10-28 (producers, reconciliation, catch-up, worker v2, I1 on a disposable clone; gates off, nothing deployed); phase 3 Verified 2026-10-28 (hub screen, data layer, header count; fixture scope, bundle exports, nothing deployed); phase 4 Verified 2026-10-28 (tap routing, token lifecycle, channel, local-alert retirement; simulated scope, nothing deployed, build must follow worker rollout); phase 5 Verified 2026-10-28 (I2: real PostgREST/RLS/worker journeys, request-cost audit, deletion ledger, F41/F42 fixed; isolated scope, nothing deployed); phase 6 Partially complete 2026-10-28 (MuMu native walk, F44/F45 badge fixes, R18 rehearsal passed; R16 physical push and native tap routing blocked — no device/build; I3 not met). |
| Deployment | Actual target/revisions, applied migration/backfill, worker/scheduler/activation and recovery record; **Not performed by this task**, existing hosted state unverified. |
| Production validation | Post-deployment scoped smoke journeys and error/delivery observations on that exact release, with a declared observation window and limitations; **Not performed**. A release record cannot borrow isolated passes. |

The plan is successful only when the requested hub works with real authorized data, every enabled path has a producer and destination, counts/read behavior agree, migrated alerts are not duplicated, unrelated features/user changes survive, and acceptance evidence supports release. Production readiness is not established by writing a checklist, compiling once, or displaying synthetic rows.

### 8.2 Rollout sequence and rollback

1. Rehearse additive schema, source emission, read reconciliation, version compatibility, and due-notice worker in isolation. Use synthetic recipients; keep private data out of context/evidence.
2. Deploy only compatible backend contracts first, with new notice/event emission disabled through the activation gate (`barangayan_private.notification_hub_settings`, D20) until consumers/sender are ready. Preserve old kinds and event IDs.
3. Qualify the worker and Android build; activate covered producers and retire their duplicate local presentation together. Do not remove local delivery first and leave an alert gap. Gate order (D20): `emission_enabled` first, `v2_alerts_enabled` only after the deployed sender accepts v2.
4. Reconcile existing announcement markers/mirrors once, record the boundary, and verify repeated execution is harmless. Existing request/report inbox rows are classified, not resent.
5. On a separately authorized release, declare a finite observation window before smoke/health checks and record actual results; stop on new errors, foreign-recipient exposure or duplicate/replayed events. No monitoring automation or open-ended watch is created.
6. Roll back by disabling emission/activation and restoring compatible app/worker ownership together. Before irreversible backfill/purge, capture scoped restore data privately, prove restore and define revision/conflict handling; if unavailable, block that step. Preserve events/newer user actions. Never equate code revert with data recovery, drop additive history, or undo domain operations to repair notifications.

### 8.3 Execution handoff

Start with **Phase 0**, reuse the planning index/identities, and refresh only changed facts. Do not repeat the entire breakdown review or treat this document-only planning run as completed implementation. No application code, database, device, or hosted service was changed while preparing this plan.
