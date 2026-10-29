# Resident Web Notifications and Announcements — Implementation Plan

**Prepared:** October 29, 2026, Asia/Manila.  
**Status:** Planning document only. Web implementation, deployment, and production validation under this plan are **Not started / Not performed / Unverified**, respectively. No Android completion status is transferred to Web.  
**Source:** [Resident Android implementation plan](C:/Users/User/barangayan/plans/Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md), read as it exists on October 29, plus the [coverage catalog](C:/Users/User/barangayan/plans/Resident_Android_Account_System_Notifications_and_Announcements_Redesign_Breakdown_2026_10_27.md). The Android plan is preserved unchanged.  
**Authority:** User requirements and applicable repository instructions override this plan and generated context.

**Evidence labels:** F = **verified fact** about the cited repository source or a dated command result, not runtime/hosted proof. D = adopted **assumption/design decision**, confirmed through R acceptance gates. U = **assumption requiring phase-entry confirmation**, unless explicitly labeled **open decision** or **blocker**. Excluded catalog ideas are **optional improvements, out of scope**. All instructions, proposed behavior, phase checklists and acceptance tables are contracts, not observed successes. No material decision currently needs user input.

## 1. Outcome, scope, and approved coverage

Deliver a responsive Announcements hub at the existing `/announcements` route with four sections, in order:

1. Category navigation: **All, Barangay, Account, System**, each with an icon and label.
2. Current-scope **X unread** / caught-up state and **Mark all as read**.
3. Filter chips for the selected category.
4. Announcement/notification rows, grouped under **Barangay → Account → System** in All.

Account includes **Document Requests**, their linked payments/refunds, **Incident Reports**, and the approved verification/security/profile events. Services and Reports retain their actual records, permissions, status changes and existing actions. Health registrations and evacuation attendance stay outside the Account hub scope.

Preserve the approved Shopee-inspired category/message hierarchy, adapted to Barangayan's web theme, typography, Lucide icons, CSS, current motion primitives and accessible Radix dialogs. Do not copy React Native controls, Android navigation, OS notification channels, APK/update requirements or MuMu acceptance into Web.

**Planning boundary:** this task creates only this new Markdown file. It does not change the Android plan, application code, data, dependencies, settings, running environments or deployed services. No baseline suite, browser session, database query/migration or new context packet is needed to finish this document. Execution entry steps are scheduled below.

### 1.1 Exhaustive coverage disposition

The A/Y IDs refer to the catalog; each of its 52 Account and 17 System scenarios has one disposition below. “Consume/complete” means reuse the shared domain notification and implement its Web presentation, not create a new domain workflow or a second event stream. Revalidate source/deployment availability in phase 0.

| Catalog IDs | Web execution decision | Boundary |
|---|---|---|
| A01, A03, A05 | Consume/complete Profile notifications. | Account readiness and meaningful existing profile/household changes; no alerts for unchanged saves/preferences. |
| A07–A12 | Consume/complete Verification notifications. | Existing ID submission/approval/failure/replacement/revocation/repair; current evidence and authorized reason, not stale approval. |
| A14–A15 | Consume/complete Verification notifications. | Existing contact-email verification/change; do not imply Auth sign-in email changed. |
| A18–A20 | Consume/complete Security notifications. | Known first-password state may say added; otherwise preserve the shared generic “Password updated” event. Do not invent reset-versus-change provenance. |
| A31–A40, A43–A45 | Consume/complete Document Requests, including linked payment/refund stages. | Existing requests, fees, submission, processing, pickup, completion/cancellation and material updates. Shared Android D17 maps A32 to pause and A37 to resume; no new reply/upload workflow or rejected status. |
| A46–A50 | Consume/complete Incident Reports. | Original reporter's submitted/in-progress/resolved/unresolved/withdrawn events; no notification to every public incident reader. |
| A02, A06, A13, A26–A28 | Preserve existing in-context feedback. | Setup/email reminders, home pin, deletion and synchronous export; no new reminder scheduler, post-deletion inbox or background export. |
| A04, A16–A17, A21–A25, A29–A30, A41–A42, A51–A52 | Optional improvements, out of scope. | No new residency review, device detection, MFA, restriction/appeal, privacy cases, deadline/rejection, incident messaging or reopening workflow. |
| Y01–Y06 | Consume/complete shared Service Status notices. | Operator-confirmed service notice lifecycle; no new outage detector or public status website. |
| Y08, Y11 | Consume shared informational App Updates/feature notices. | Do not apply native version codes to the website, force reload/install, or implement the announced feature. |
| Y12–Y13 | Consume shared Policies notices. | Link existing policy content and display available version/effective metadata; read is not consent. |
| Y14–Y16 | Existing in-feature/browser guidance only. | No Device Settings filter, browser permission history or new offline-resource manager. |
| Y07, Y09–Y10, Y17 | Optional improvements, out of scope. | No retirement/migration program, forced upgrade/support policy or data-impact case management. |

**Existing-kind compatibility:** F12 identifies session sign-in/session-ended messages in migration 0152 as `account_security`. Display authorized existing rows under Security without treating them as new-device detection, adding a second producer, changing their safe copy, or introducing browser push. This does not enable the excluded A22 device-detection workflow.

### 1.2 In-app notifications versus browser delivery

D01: deliver the durable **in-app** inbox and live/catch-up refresh. F05 establishes that Web push is explicitly absent from the existing Web feature set. Do not add a service worker, VAPID keys, Push subscriptions, Notification permission prompts, browser background-delivery worker, SMS/email sender or preference backend under this task.

Browser-permission acceptance therefore checks that unsupported/denied/unavailable Notification APIs do not affect the inbox and that no permission is requested unexpectedly. A closed tab receives no promised browser alert; returning reloads authorized durable history. Existing SMS/email toggles do not become evidence of delivery or control inbox retention. Existing toast feedback remains separate from retained inbox entries.

## 2. Verified current implementation and source index

These are source observations on October 29. Tests, browser behavior, RLS execution, migration deployment and operator activation were not exercised. Stale source comments are not treated as implementation facts.

| F-ID | Verified source and finding | Plan consequence |
|---|---|---|
| F01 | [Web instructions](C:/Users/User/barangayan/apps/resident-web/AGENTS.md:1), [package](C:/Users/User/barangayan/apps/resident-web/package.json:5), and installed [Next package](C:/Users/User/barangayan/node_modules/next/package.json:3): app declares Next 16.3.0/React 19.2.8; installed Next reports 16.3.0. Instructions require bundled guides before code changes. | Use local version-matched Next docs, not remembered APIs. Runtime availability remains U02. |
| F02 | [Page](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/announcements/page.tsx:8), [feed](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/announcements/announcements-feed.tsx:73): optional-auth page passes barangay ID; feed has only Barangay chips/grid/manual read actions. No ID/query selection is handled there. | Replace composition and add validated URL selection; preserve public entry. |
| F03 | [Query hook](C:/Users/User/barangayan/apps/resident-web/src/hooks/use-announcements.ts:29): generation/identity guards, realtime invalidation, initial versus refresh state; unpaged announcement query. [Read provider](C:/Users/User/barangayan/apps/resident-web/src/hooks/use-unread-counts.tsx:51) maintains announcement IDs and independent report counters. | Add bounded hub queries/full counts without removing other consumers or redefining Reports signals. |
| F04 | [Card](C:/Users/User/barangayan/apps/resident-web/src/components/reports/announcement-card.tsx:40) separates row button/read buttons; [dialog](C:/Users/User/barangayan/apps/resident-web/src/components/reports/announcement-modal.tsx:43) has Radix focus handling and full-description fallback. Feed opening sets selection/visibility, not a read mutation. | Open-to-read is an intentional Web behavior change, tested once per successful authorized open. Preserve manual unread and dialog focus behavior. |
| F05 | [Settings](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/settings/notifications/page.tsx:3): Web push is an explicit non-goal; email/SMS switches use component state/toasts. Source/public search for service-worker registration, Notification permission/request construction and Push subscriptions found only this explanatory page. | No supported Web push pipeline established. Do not infer one from Expo sender or the settings switches. |
| F06 | [Session feedback](C:/Users/User/barangayan/apps/resident-web/src/components/shared/notification-session.tsx:22): local toast identity invalidation/auth listener; [layout](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/layout.tsx:18) mounts that and the unread provider. | Preserve immediate toast invalidation; add durable-hub account/tenant identity clearing without conflating feedback/history. |
| F07 | [Top nav](C:/Users/User/barangayan/apps/resident-web/src/components/shell/top-nav.tsx:27), [bottom nav](C:/Users/User/barangayan/apps/resident-web/src/components/shell/bottom-tab-bar.tsx:39) use announcement-only badges. Source search found `NotificationBell` only at its [definition](C:/Users/User/barangayan/apps/resident-web/src/components/shell/notification-bell.tsx:15). | Update rendered nav consumers, not only a standalone bell module. Its old “placeholder” comment is stale. |
| F08 | [Requests page](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/services/requests/page.tsx:40), [list](C:/Users/User/barangayan/apps/resident-web/src/app/(resident)/services/requests/requests-list.tsx:32): URL status tabs, responsive card grid and selected tracking drawer; no Android-style All disclosure groups. | Adapt approved grouping to Web; do not claim a reusable Web Requests section exists or redesign Requests. |
| F09 | [Shared types](C:/Users/User/barangayan/packages/shared/src/types/service-foundations.ts:73), [contracts migration](C:/Users/User/barangayan/supabase/migrations/0145_notification_hub_contracts.sql:156): summary, inbox-page and atomic bulk-read RPCs, private activation flags, owner read bridge, System notice publisher/detail source exist in repository. | Prefer reuse/verification over duplicate migrations/endpoints; hosted application and activation are unknown. |
| F10 | [Producer migration](C:/Users/User/barangayan/supabase/migrations/0146_notification_hub_producers.sql:1) and [Android model](C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/notification-hub.ts:1) cover existing event classification/destination shapes. Android plan records isolated progress with native limitations. | Use shared SQL/types as authoritative; do not import an app-private RN module into Next or transfer Android pass labels. |
| F11 | [Auth helper](C:/Users/User/barangayan/apps/resident-web/src/lib/auth/get-optional-user.ts:13), [guard](C:/Users/User/barangayan/apps/resident-web/src/lib/auth/require-user.ts:31), [login](C:/Users/User/barangayan/apps/resident-web/src/app/(auth)/login/page.tsx:81): optional browsing, per-route guards and `safeResidentRedirect(next)`. | Keep public hub access; owner/tenant enforcement belongs in RLS/API; use existing safe return-path conventions. |
| F12 | [Session migration](C:/Users/User/barangayan/supabase/migrations/0152_account_session_notifications.sql:30) adds A22S/A22E as account_security. It says ended, not necessarily user-initiated logout. | Consume compatible Security rows without inventing device recognition or recreating Auth triggers. |
| F13 | [Vitest config](C:/Users/User/barangayan/apps/resident-web/vitest.config.ts:3) includes `tests/**/*.test.ts`, 5-second test timeout. [Feedback harness](C:/Users/User/barangayan/scripts/resident-web-feedback-regression.cjs:13) is local-stack-only; line 335 launches Chrome, not Brave. [Auth browser fixture](C:/Users/User/barangayan/apps/resident-web/tests/auth-session-browser.mjs:1) explicitly uses synthetic Auth replies. | Discover supported runners/flags once; no assumed Web `test` script, Brave launch or hosted proof. Harness setup/fixtures can write data: isolate before execution. |
| F14 | Bundled [Next page guide](C:/Users/User/barangayan/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:11) models promised params/searchParams and server page boundaries. | Verify applicable search-param/client-navigation/cache guides before implementation; prevent private state from entering shared static caches. |

### 2.1 Shared backend versus Web ownership

| Surface | Existing shared work to verify/reuse | Web-specific work |
|---|---|---|
| Registry/types | SQL `notification_kind_filter`/source mapping; exported row/RPC types. | Small Web-safe presentation/destination adapter with parity tests; no cross-app private imports or new framework. |
| Lists/counts | `notification_hub_summary(p_view,p_filter)` and `notification_inbox_page` with `(created_at,id)` cursor. | Browser-session client, identity-scoped resources, URL filters and honest unknown/failed counts. |
| Individual read | Inbox `read_at` owner column grant; announcement marker upsert/delete; mirror bridge. | Pending/error handling and selected-event acknowledgment. No new single-item RPC unless a demonstrated gap requires one. |
| Bulk read | `notification_mark_scope_read` freezes candidates in a statement and serializes a resident's calls. | Captured scope, double-submit guard, uncertain-outcome reconciliation and visible result. |
| Domain events | Existing request/payment/report and account producers, including 0146/0152. | No duplicate producers for a Web visit; verify Web-originated operations reach the same writers. |
| System | Existing `system_notices` and restricted create/publish/revise/resolve/cancel operations. | Safe authorized detail and action routes; no new admin authoring screen or operator UI. |
| Delivery | Existing Expo worker and native registrations are not a Web Push transport. | In-app realtime/catch-up only; never register an Expo token from the website. |

Repository presence is not deployment proof. Any shared backend fix found necessary must be additive, separately evidenced and tested against existing Android/iOS consumers. Do not copy 0145/0146, reset activation flags, rerun reconciliation or enable native alerts just to implement Web. A compatible backend may already be active for another client.

## 3. Settled Web behavior and compatibility decisions

### 3.1 Navigation, structure, and filters

D02: keep one `/announcements` route; use validated same-origin query state `view`, `filter`, optional `announcementId`/`notificationId`. Default is All/All. Use ordinary accessible Next links/buttons with intentional history behavior, never a React Native tab stack. Card changes reset the filter to All; filter changes return results to the top; Back/Forward and copied/new-tab URLs reproduce selection. Bad/unknown filter values normalize safely without redirect loops. Explicit foreign record IDs show unavailable, not another item.

| View | Chips, in display order |
|---|---|
| All | All, General, Emergency, Health, Events, Account, System. |
| Barangay | All, General, Emergency, Health, Events. |
| Account | All, Document Requests, Incident Reports, Verification, Security, Profile. |
| System | All, Service Status, App Updates, Policies. |

D03: preserve four requested content sections. The Web feed currently has a screen-reader-only Announcements heading, not a visible “What's New” block (F02); retain a single semantic h1 and do not invent/remove unrelated headings. Put category cards first, scoped summary second, chips third, rows fourth. Keep existing shell/header/navigation; no new top-level destination.

D04: in All, group matching items in fixed Barangay → Account → System order, one event once. Collapse uses semantic buttons with `aria-expanded`/`aria-controls`, a section heading and matching total count distinct from unread. Use existing CSS/motion primitives, no native animation import or new animation library. Groups start expanded; hide only confirmed-empty groups, keep loading/failed groups identifiable. Filter All/Emergency shows only the Barangay group; All/Account only Account. Other category views use one list without redundant group chrome.

D05: use compact grouped Web rows, single content scroll owner and sticky chips positioned under the actual responsive shell header. Reuse theme/font/contrast tokens, list/dialog primitives and DOM semantics. Do not nest independently scrolling same-axis feeds or require a new virtualization dependency. Load at most 25 rows/source/page, independent cursors and explicit load-older controls; initially render only loaded pages. Measure long-session DOM growth before claiming bounded memory; use a retention/windowing solution only if measured need justifies it within scope.

Order Barangay by `published_at DESC,id DESC` and private rows by immutable `created_at DESC,id DESC`. Pass full database timestamp strings to the cursor; do not round timestamps through browser Date milliseconds. Display localized timestamps using existing conventions; service windows explicitly identify Asia/Manila time. Read changes do not reorder rows. Browser date/locale hydration must not leak private state or create warnings.

### 3.2 Read scope, counts, and pending outcomes

D06: summary and bulk use the **active view + chip across every matching page**, including collapsed groups. Nav/category badges use full unfiltered totals. Add an explicit combined unread counter; do not silently redefine the provider's report business/acknowledgment values. Update TopNav/BottomTabBar and any confirmed bell caller; retain announcement-only counters where a component genuinely means Barangay.

- Guests make no summary/private inbox/read calls and see no personal unread count; All/Barangay preserve permitted public announcements. Account/System show sign-in guidance. A signed-in profile with unavailable/NULL counts shows unknown, not zero/caught-up.
- Full totals come from authorized matching predicates, not loaded rows or fetching every history ID. Read-marker display uses bounded visible-ID queries or a verified equivalent. Do not copy Android's all-history ID enumeration into a new Web resource.
- Successfully opening authorized announcement content marks it read, an intentional change from F04. Account/System details likewise mark only the selected event; request/report rows may link to their existing detail routes after event/record authorization. A navigation failure must not silently acknowledge the event.
- Manual read/unread controls remain separate from row navigation, with accessible labels and pending guards. Do not nest buttons inside links/buttons. A failed write must not prevent reading, falsely clear a badge, or claim successful receipt.
- Use the existing feedback adapter's distinction between confirmed, accepted/unconfirmed, rejected and uncertain. Do not convert an accepted request into “saved” without evidence or suppress an ambiguous result.
- Bulk invokes the existing server operation once for its captured scope. Disable conflicting repeat mutations. On timeout/lost response, refetch authoritative state; never automatically replay with a new snapshot that could clear later arrivals. A fresh explicit action starts a new operation.
- Event read state does not resolve an incident, acknowledge every resolved report, pay/complete a request, verify an ID, accept a policy or delete history. Preserve any existing destination-screen acknowledgment independently.
- Shared announcement bridge/reconciliation stays authoritative. Do not run a global backfill from browser startup or emit a notification from a read-state mutation.

### 3.3 Destination and detail contract

| Stored reference | Web destination / behavior |
|---|---|
| v1 request + UUID | `/services/requests/<id>`; optional existing Requests drawer uses `/services/requests?open=<id>`, but no tracking redesign. |
| v1 incident + UUID | `/reports/<id>`, with actual existing guard/RLS; private event ownership is required even if the report is publicly browsable. |
| v1 announcement + UUID | Authorized direct fetch and existing announcement dialog; never require it to be in the loaded page. |
| v2 account screen allowlist | `/settings`, `/settings/profile`, `/settings/valid-id`, `/settings/email-verification`, `/settings/change-password`. |
| v2 notice + UUID | Owner event + authorized `system_notices` detail in a small generic dialog; do not select hidden operator columns. |
| Unsupported/malformed/future reference | Safe authorized event text and unavailable action; no arbitrary navigation, crash, raw error or silent row deletion. |

Only map supported notice actions to actual Web routes: services/reports/health/maps, `emergency_info` → `/emergency`, email verification and terms/privacy. Use policy metadata where available; do not claim immutable historical policy text exists if only the current policy page is available.

D07: existing System `app_version_code` is not a Web build version. The inspected notice model has no platform selector (F09); do not invent platform filtering, force a website update or mark a whole row read because a version number differs. Show authorized informational content, clearly label native version metadata when present, and offer only a supported allowlisted action. Any platform-targeting schema expansion is outside this plan unless a concrete blocking correctness issue requires an explicit scope decision.

D08: modal selection has explicit history/focus ownership. Escape/backdrop/close and browser Back close an internally opened dialog; direct entry close replaces only the selection parameters instead of sending the visitor to an unrelated origin. Restore the opener's focus when still present, otherwise the relevant section heading. Only one modal focus trap is active. Preserve current full description/image rendering and reduced-motion exit behavior.

D09: a guest may load a typed private notification link but sees a sign-in prompt, no private content. Preserve the complete safe same-origin hub URL in the existing login `next` path, including allowed query parameters. Reauthorize the event after login; never reuse a prior resident's pending intent. Existing route guards may preserve only pathname, so verify this end to end rather than assuming query restoration.

### 3.4 Web session, cache, and browser lifecycle

- Keep server optional-user metadata and browser authenticated resources separated. Pass the minimal owner/tenant/read-eligibility identity needed; RLS/RPC checks are authoritative. Never put service-role credentials, private inbox data or activation controls in `NEXT_PUBLIC_*`, shared caches or public page props.
- Immediately invalidate private rows, counts, pending mutations/intents and toast ownership on logout/account switch, before a stale layout or cached route can redisplay the prior resident. Requests belong to a user+tenant+scope generation and are aborted/discarded when it changes.
- Reuse the existing browser Supabase client and one app-level resource owner. Do not attach realtime listeners per card/row. Invalidate the affected source and counts; coalesce bursts and remove listeners on owner change/unmount.
- Browser focus/visibility return and realtime reconnect trigger bounded catch-up, not a permanent polling loop. Closed/background tabs are not reliable realtime clients; durable history remains available on re-entry.
- Cross-tab read/logout consistency must be tested with actual browser contexts/tabs; the current toast session handler alone does not establish inbox cache isolation. No custom token store or auth framework is added.
- Read network errors stay in context. Retain same-identity last-good content with stale feedback; never use another user's cached result. No new service-worker cache/offline inbox is introduced.
- Unsupported or denied browser Notification permission leaves all hub functions working and produces no repeated prompt. Do not alter mobile push preferences or claim the Web SMS/email UI switches control this inbox.

## 4. Execution workflow, evidence, and ownership

**Objective:** avoid redundant reads, oversized output, repeated context regeneration and repeated tests without weakening acceptance/security. Packet size is not measured usage savings.

Every execution phase follows **Git baseline → narrow ripgrep discovery (Repowise only when useful/fresh) → Reader validation → scoped pinned/cached Repomix → complete bounded XML analysis → original-source verification**. Planning investigation for this file stops at the specific source findings above; heavier steps are phase-entry work, not completed work.

1. **Git:** identify actual working-copy/staged/untracked/ignored inputs and user changes. Save recoverable scoped snapshots/patches before editing. HEAD is not the baseline. Preserve secrets privately, exclude them from packets/logs, and never restore an old Android snapshot over current code.
2. **Discovery:** inspect applicable root/Web instructions and only phase-relevant callers, schemas, events, routes, configs and tests. Bound output and follow explicit continuations. Repowise is optional; indexed relations need working-copy/new-file freshness evidence and source confirmation. Do not install it for this plan or repeat a settled search with another tool.
3. **Reader:** validate hashes, packet identities, source relationships, completed reads and installed dependency versions. Hash equality proves content identity, not correct behavior. Invalidate only conclusions affected by changed or missing context.
4. **Repomix:** discover/revalidate the cached pinned version at execution entry. Pack exact needed files with security checks/exclusions; record selectors, actual entries, hashes, options and omissions. Reuse verified unchanged packets, add small supplements instead of regenerating everything. No historical tool availability is presumed current.
5. **XML:** initially limit extraction to 12,000 characters or 200 lines, preferably both. Read every required entry fully across recorded half-open continuation ranges. Track compression omissions and token estimates separately from model usage.
6. **Original/check/change:** inspect missing bodies, effects, auth checks, styles and cleanup against originals. Read relevant local Next 16.3 guides before code and current Supabase guidance before backend changes. Run relevant baseline checks once, retain full diagnostics, make the smallest complete change, review owned diffs, then rerun affected checks. Broaden/repeat only for a changed input, diagnosed failure or specific risk.

Maintain a compact execution index with F/D/U IDs, scenario/R IDs, source+dependency SHA-256, read ranges/packet entries, ownership, omissions, decisions, command/cwd/exit/result/log location, environment identity and phase status. Each phase has Not started/In progress/Partially complete/**Verified**; Verified requires every phase-local gate. Supersede changed facts instead of copying entire narratives. No sub-agent work is assumed authorized.

**Finite work:** stop after two failed attempts of an approach and diagnose; cap a diagnosed repair at three revised iterations before recording a blocker. Default deadlines: 90 seconds per browser journey, 5 minutes per targeted check, 20 minutes per full suite/build, with any justified larger bound declared first. New runtime requests need finite deadlines/abort; reconnection performs one coalesced catch-up. No automatic uncertain bulk mutation retry, no per-row polling, and no read→event→read feedback cycle.

**Baseline comparison:** store exact source/build/DB identities and distinguish pre-existing failures from regressions. Do not adopt the Android plan's recorded passes/failures as Web results. Add tests only for actual behavior regressions; never delete assertions or mute logs to get green output.

**Cleanup:** delete replaced code/files/styles/exports only after runtime, build, routes, configuration, migration and compatibility roles are checked. `useAnnouncements` and existing read components have other consumers: migrate confirmed consumers or retain required adapters. A standalone bell definition is only a cleanup candidate, not automatically dead. Preserve migration history, useful tests, user files and snapshots.

## 5. Ordered implementation phases and integration gates

Dependency chain: **0 → 1 → 2 → 3 → 4 → 5**. I1 in phase 1 qualifies the existing shared backend for Web; I2 in phase 4 joins actual backend and Web journeys; I3 in phase 5 qualifies supported browsers/accessibility and recovery. Early phases verify their local contracts without borrowing later browser/hosted results.

### Phase 0 — Qualify Web baseline, instructions, and dependencies

**Objective/boundary:** establish executable source/test contracts without implementing features or assuming hosted setup.

- [ ] Entry/context: current plan/catalog, root/Web instructions, F01–F14 and U01–U05; preserve actual working inputs before later edits. No Android plan change.
- [ ] Trace callers: optional-user/layout/provider, live nav badges, Home/Emergency announcement consumers, details/guards, shared types/RPCs and current tests. Record exact owner/tenant identity and deployment dependencies.
- [ ] Read local Next guide sections for async search params, client/server boundaries, navigation and private cache behavior; validate installed runner/browser paths. Generate packets only for missing execution context.
- [ ] Baseline once: Web type/lint, affected Vitest/auth/session/announcement fixtures and build where prerequisites allow; retain command/log/exit/source identity. Use a disposable backend for any harness that creates/deletes fixtures.
- [ ] Gate: every enabled catalog outcome maps to a real shared event and Web destination; URL/auth/read cases and test commands are concrete; no essential I1 decision unresolved. Missing environment is a named blocker, not a fabricated pass.
- [ ] Recovery/exit: no data to restore here; discard only task-owned planning derivatives. Phase Verified after all baseline/source gates; leave unsupported browser/hosted facts pending at their owning phase.

### Phase 1 — Verify shared backend reuse and Web adapter contracts

**Objective/boundary:** consume existing contracts; make a shared fix only for a demonstrated Web correctness gap. No producer/publisher duplication or activation/deploy.

- [ ] Entry: phase 0 Verified; isolated target includes actual 0145/0146/0152 dependencies and current guards. Inspect runtime schema rather than inferring migration application from filenames.
- [ ] Consumers/context: shared types/RPCs, activation/producer/worker/read-bridge semantics, Android/iOS compatibility and restricted notice columns. Do not import Android-private modules into Web.
- [ ] Implement later: minimal Web-safe adapters/validators for registry, cursors, known destination shapes, owner detail, scoped reads and complete counts. Preserve old records, keys and native alert switches.
- [ ] Risks: wrong tenant/guest, forged filters/IDs, NULL counts, timestamp truncation, lost bulk response, concurrent arrival/read, unsupported kind/version, unsafe notice action and incompatible shared schema.
- [ ] I1 gate: real isolated RLS/RPC tests prove owner-only access/read writes, matching full counts/paging, exact timestamp cursors, atomic scope and no business-state change; parity/negative tests verify adapter classification/destinations. Existing-client regression checks pass for any shared edit.
- [ ] Recovery: normally no backend data migration. If a proven gap requires one, first snapshot affected state privately and rehearse targeted revision-aware restoration; preserve newer user actions. Restore owned adapter/schema changes independently of domain records.
- [ ] Exit: Verified I1; missing deployment of required contracts remains a release prerequisite. Do not enable global emission/native delivery simply to obtain a Web fixture.

### Phase 2 — Hub resources, counts, and session isolation

**Objective/boundary:** integrate actual browser resources and rendered navigation badges; no unrelated auth or Reports rewrite.

- [ ] Entry: I1 passes; baseline/read contracts and account generations defined. Reuse verified same-identity checks, inspect changed sources only.
- [ ] Consumers/context: resident layout/provider, browser singleton, NotificationSession/toast adapter, TopNav/BottomTabBar, old announcement read consumers and visibility/reconnect hooks.
- [ ] Implement later: one owner/scope-keyed source/count owner, bounded page/read-state queries, summary/individual/bulk mutation states and coalesced realtime/catch-up. Preserve separate Reports counters and existing feedback semantics.
- [ ] Risks: old tab/user response, incomplete profile, failed source/count, expired session, duplicate submit, socket reconnect and ambiguous mutation after commit. No silent zero or replay.
- [ ] Gate: controlled resource/browser fixtures show complete scoped counts, no wrong-user state, successful and uncertain outcomes correctly labeled, no listener/query accumulation, and unchanged Reports/legacy read behavior. Query/read writes do not create domain events.
- [ ] Recovery/exit: restore owned provider/nav changes, retain compatibility adapters and existing read history; close only task resources. Verified for data/lifecycle fixtures, not full page/browser acceptance yet.

### Phase 3 — Responsive four-section UI, links, and details

**Objective/boundary:** implement only the requested hub using phase-2 resources and existing Web components/styles.

- [ ] Entry/context: phase 2 Verified; current page/feed/card/dialog/CSS/shell and request/report/settings routes, Next navigation guide, baseline motion/focus fixtures.
- [ ] Implement later: exact four cards/summary/chips/grouped rows; responsive CSS and semantic disclosures, independent load-older, existing announcement content and minimal safe Account/System details. No native APIs/new UI framework.
- [ ] Navigation: normalized shareable view/filter/selection URLs, direct fetch beyond page, Back/Forward, close-on-direct-entry, safe login next/query preservation and typed destination actions.
- [ ] Risks: partial/loading/empty/offline/error, stale deleted target, double activation, sticky header overlap, nested controls, long previews, hidden collapsed focus, lost focus/opener and motion preference.
- [ ] Gate: behavior fixtures cover every category/chip/group and changed open-to-read semantics; stale failure retains content, row/read controls act independently, route/auth/focus cases pass, no hydration/internal-code display errors. Browser matrix remains I3.
- [ ] Recovery/exit: restore owned page/CSS changes without reverting other Web work or data; remove only proven-unused replacements. Verified UI/route fixture scope after gates pass, preserving a single semantic h1 and current shell.

### Phase 4 — Complete isolated Web integration and compatibility

**Objective/boundary:** prove actual backend→Web journeys and safe cleanup; no real resident data or live service activation.

- [ ] Entry/context: phases 1–3 Verified, actual local app/source/DB/browser identities, affected source supplements and original full logs. Reuse unchanged baseline results.
- [ ] I2 journeys: existing operator notice or staff ID/request/report transition → shared event → Web list/count → authorized detail/read → nav badge; include payment/refund stage, profile/security, read in a second tab/client and safe return after login.
- [ ] Failure cases: foreign/guest/setup, lost response after commit versus rollback, retry, concurrent arrival, delayed old user response, expired session, unsupported notice/action and offline/reconnect. Assert domain and report acknowledgment states separately.
- [ ] Gate: actual isolated RLS/API integration and required affected Web/shared/native-consumer checks have zero new failures; classification, count/bulk, history and read convergence agree. Stubbed fixtures alone cannot pass I2.
- [ ] Cleanup/performance: verify ≤25 fetched rows/source/page, no per-row request fan-out, one intended subscription per owner/source, no growth after repeated mount/dispose; record measured bundle/latency/query baselines before claims. Deletions need all-role caller/build verification.
- [ ] Recovery/exit: restore task-owned files from baseline; targeted data restoration only for isolated fixtures under its tested procedure. Verified I2; native push qualification from Android is neither required nor claimed for Web.

### Phase 5 — Browser/accessibility acceptance and release handoff

**Objective/boundary:** qualify supported browser behavior and recovery; deployment/production have separate statuses.

- [ ] Entry: I2 Verified; actual browser executables/versions and production-build prerequisites qualified, test settings captured. Unavailable engines/checks stay pending.
- [ ] I3 matrix: Brave/Chromium desktop and responsive viewport cases; actual Firefox/WebKit only where installed/support is claimed. Test keyboard/Tab/Enter/Space/Escape, focus return, screen-reader semantics, 200% zoom/text, touch, dark/light/custom theme and reduced motion.
- [ ] Browser lifecycle: two tabs, logout/account switch, background/focus return, offline/reconnect, reload/share/new-tab/deep-link/Back; denied/unavailable Notification API never prompts or breaks the hub. No closed-tab alert promise.
- [ ] Gate: all applicable R01–R15 implementation/I1–I3 gates pass with source/build/browser/DB evidence, zero new relevant runtime/hydration/accessibility errors, and successful isolated recovery. Screenshots alone do not prove keyboard, auth or RLS correctness.
- [ ] Recovery/exit: restore test settings, clear synthetic browser data only, close task-owned tabs/processes; retain evidence and original user work. Mark Web implementation Verified only when gates pass; report pending engines/hosted facts explicitly. No deployment is performed merely because this plan exists.

## 6. Verification methods, quality contract, and report

### 6.1 Baseline and runner selection

Verified F01/F13: Web has `lint`, `typecheck`, `build` scripts and a Vitest config, not a declared universal `test` script. Resolve actual installed runtime/Vitest/Playwright from the workspace at execution entry; no installs are planned. Do not substitute root TypeScript blindly for the Web-owned version.

Relevant existing entry points: `scripts/resident-web-feedback-regression.cjs` (select only affected RW-LT groups after reading its invocation/setup), `apps/resident-web/tests/auth-session-browser.mjs`, `auth-session-isolation.test.ts`, `auth-toast-browser.mjs`, and `session-feedback.test.ts`. Backend candidates include `resident_android_notification_hub.test.sql`, `resident_android_notification_producers.test.sql`, `resident_account_session_notifications.test.sql`, `notification_hub_concurrency.mjs` and `notification_transport_i1.mjs`; names do not imply Android-only data contracts or current passes.

The feedback harness uses explicit local Docker fixtures and Chrome. Do not run its cleanup against a user's existing local dataset; qualify a disposable target/snapshot first. Brave is preferred for requested manual/browser-automation Web testing only once its executable is identified and the runner supports it. Chromium emulation is not a real mobile Safari/Firefox pass. No supported-browser result is invented from tool availability.

Run meaningful existing checks once on the baseline and after relevant edits. Add focused regressions for uncovered hub behavior, not tests that merely mirror markup or implementation. Preserve full logs/exit codes, read relevant omissions, classify pre-existing failures honestly and do not rerun unchanged commands to recover lost output.

### 6.2 Measurable gates

| R-ID | Requirement / passing condition | Phase / direct verification |
|---|---|---|
| R01 | Four sections/cards and exact chips/group order; one h1, no invented What's New block; preserved full announcement content. | 3/5: behavior assertions + responsive visual comparison. |
| R02 | Enabled account/request/payment/report and System events appear once, correct subtype/owner; all 69 catalog IDs dispositioned. | 0–1/4: source ledger, actual producer→Web journey and exclusion/parity tests. |
| R03 | 25-row cursor paging has no loss/duplicate at tied timestamps, including >1,000 retained records; total and active-scope counts agree. | 1–2/4: isolated API and UI paging tests with original timestamp precision. |
| R04 | Scoped bulk covers collapsed/unloaded rows atomically; later arrivals remain unread; lost responses cause reconciliation, not silent mutation replay. | 1–2/4: concurrent/fault injection and request-count assertions. |
| R05 | Individual read/unread converges across announcement mirrors/tabs without altering business state or report acknowledgments. | 1–2/4: before/after source rows, cross-client tests, no continuing read/event writes. |
| R06 | Zero unauthorized content/read writes across resident/tenant/guest/setup/deleted-account cases; private browser caches clear on owner change. | 1–2/4–5: real RLS tests, two-tab/account-switch/delayed-response journeys. |
| R07 | Validated links/Back/Forward/reload/login-return/detail close work; missing/unsupported/foreign targets never redirect to arbitrary URLs. | 3–5: direct URL, new-tab, query/auth and focus/browser history tests. |
| R08 | Unknown/loading/empty/partial-error/read failure/stale refresh/offline states remain truthful; accepted/uncertain is never mislabeled saved. | 2–5: delayed/rejected/lost-response fixtures and actual local API cases. |
| R09 | Keyboard/focus/disclosure/dialog and responsive theme/text/motion matrix pass with no trapped hidden control, clipped action or sticky overlap. | 3/5: DOM accessibility assertions, keyboard and screen-reader/manual browser evidence. |
| R10 | Open tab/reconnect catches up; unsupported/denied Notification API does not prompt/fail; no promise or dependency on browser push/SMS/email delivery. | 2/5: lifecycle/permission mocks plus real browser permission states where supported. |
| R11 | Stable per-owner query/subscription counts, no N+1 or automatic retry/feedback loop; every long step has a deadline/stop condition. | 2/4–5: network/listener instrumentation, repeated toggle/dispose and exhaustion/timeout tests. |
| R12 | No new dependency/abstraction without requirement and reuse rationale; no unmatched deletion; all old runtime/build/config/migration/compatibility roles checked. | 3–5: owned diff/deletion ledger, caller search, measured bundle/query data. |
| R13 | Zero new relevant type/lint/build/test/runtime/hydration errors against identity-matched baseline; no raw internal code in user error messages. | 0/4–5: exact command/log comparison and fault-state assertions. |
| R14 | Existing Home/Emergency/Services/Reports/Auth/toasts and other native clients retain affected behavior after any shared change. | 1/4–5: targeted consumer regressions; no new UI outside scope. |
| R15 | Rehearsed compatible release/recovery preserves inbox/read history/newer user actions and native activation; no historical replay or real-recipient fixture leak. | 1/4–5: isolated interruption/restore/compatibility checks; hosted status separate. |

Quality words mean these named journeys/failure cases passing with actual evidence, not a guarantee of zero defects. “No errors” does not permit hiding diagnostics. “Lightweight” permits no unmeasured speed/size claim. A page limit is not proof of bounded lifetime DOM; verify R11/R12 on a long session.

### 6.3 Browser matrix

| Axis | Required cases |
|---|---|
| Viewport | 360/390 CSS-pixel mobile widths, 768 tablet, 1280/1440 desktop; 200% zoom and long labels/messages. |
| Inputs/accessibility | Keyboard-only, touch, visible focus, screen-reader labels/live-region restraint, dialog trap/Escape/return, reduced motion. |
| Identity/navigation | Guest/active/incomplete resident, two owners/tenants/tabs, expired session, direct notification URL, login return, Back/Forward/reload/new tab. |
| Network/data | First/refresh failure, one failed source, offline/focus catch-up, duplicate activation, old-response cancellation, bulk+arrival/lost response, deleted/revoked targets. |
| Browser features | Brave/Chromium actual version; additional engines only if qualified. Notification API absent/denied/default must not affect the in-app hub. |

Use representative pairwise layout combinations and all high-risk combinations (large text + read controls; account switch + delayed response; bulk + arrival; direct private URL + login). Do not multiply every independent axis into a wasteful full Cartesian suite.

## 7. Compact context index and open prerequisites

This source index is sufficient for the planning task; execution creates phase evidence/index supplements only when needed. Completed read scope: relevant source portions behind F01–F14, current Android coverage/D17–D27 contracts, Web page/feed/hook/provider/session/card/dialog, route guards/destinations, shared SQL/types, tests/settings and local Next page guide. No source hash implies a behavior pass, and no compressed packet or tool availability from October 27 is presumed current.

| U-ID / label | Fact to confirm / settled next action | Affected gate |
|---|---|---|
| U01 — assumption | Required shared migrations, RLS/bridge/producer semantics and operator activation in the execution target; inspect/rehearse isolated contracts, not production data. | I1; missing contracts block dependent integration, not this document. |
| U02 — assumption | Installed Web-owned runner versions, existing harness commands and Brave/other browser paths; qualify once at phase entry, with no install assumed. | 0/5 baseline and I3. |
| U03 — assumption | Exact current Home/Emergency/read-provider consumers and shared-change compatibility; trace callers before replacing helpers. | R05/R12/R14. |
| U04 — assumption | Login query preservation, private route-cache invalidation and count visibility for incomplete/staff profiles under current Next/auth behavior. | R06/R07; source comments alone are insufficient. |
| U05 — assumption | Real browser focus/screen-reader/layout/reconnect behavior and intended contemporary Shopee reference. Use specified hierarchy/Web tokens; do not claim exact modern Shopee fidelity. | R01/R09/R10; no new design scope. |

No open material decision requires user input. Routine reversible choices are resolved in D01–D09. A prerequisite becomes a **blocker** only when it actually prevents its named gate; report it accurately and continue independent authorized work. Stop planning once criteria/methods, scope, phase order, integration and recovery are explicit; no speculative additional pass is scheduled.

**Preservation reference:** at this review the Android plan SHA-256 was `7598EB79055682B420FAE9C52D768713900436ABB6EB704E817D1B933CE17DF2`. It is a read-only source, not a file to rewrite, reset or execute automatically. This plan does not adopt its historical native/isolated pass labels as Web results.

**Verified fact — document-only validation:** 31 local file/line references, all 69 unique catalog dispositions, six ordered phases, 15 acceptance gates and Markdown table structure passed static checks. The Android plan hash still matched the preservation reference. These are document results, not application, browser, database or deployment passes.

## 8. Recovery, rollout, and final reporting

### 8.1 Recovery before mutating steps

Restore only task-owned Web code from its captured working-copy baseline; never overwrite current user or Android edits. Keep shared schema additive/compatible and leave existing native switches/history intact. Do not delete 0145/0146/0152 or rerun their reconciliation as a UI rollback.

If a proven shared data fix is essential, record affected keys/versions privately, test backup/targeted restore, define conflicts with newer resident actions and rehearse before execution reaches an irreversible write/purge. A code revert does not restore read markers or delete sent alerts. Disable only the new Web path when recovering; do not revoke global native alert settings or undo real profile/password/payment/report operations.

### 8.2 Separate completion tracks

| Track | Evidence required | Present status |
|---|---|---|
| Implementation | Phase-local gates + I1/I2/I3 + all applicable R01–R15 pass on identified source/build/DB/browser. | Not started under this plan. |
| Deployment | Actual approved target, compatible backend prerequisites, Web build/revision/config, deployment/rollback record and preserved native activation. | Not performed by this task; existing hosted state unverified. |
| Production validation | Bounded post-deployment smoke/error/ownership/read/navigation observations on that exact release, with actual results and limitations. | Not performed; never borrowed from local/Android evidence. |

For a later authorized release: verify compatible shared backend first, deploy Web without enabling unrelated native switches, run scoped safe journeys using authorized synthetic accounts, and observe existing errors for a declared finite window. Stop on foreign content, read corruption, replay or new relevant errors; recover using the rehearsed path. No automation/recurring watch or new publishing UI is created by this plan.

The execution report must state what changed/enabled/deleted, actual tests/journeys with counts/exit codes/logs and identities, baseline failures versus regressions, browser/environment limitations, unresolved risks/blockers and remaining actions/owners. Use Verified only for passed scope; never claim “bug free,” unqualified “production validated,” or browser background push that does not exist.

### 8.3 Requirement → phase → verification

| Requirement | Phase / convergence | Passing evidence |
|---|---|---|
| Approved scope/coverage; shared reuse | 0–1 / I1 | 69 dispositions, source/action/recipient ledger and SQL/type parity; no duplicate producers. |
| Complete Web journeys/failures | 2–5 / I2/I3 | R01–R10 actual isolated/browser journeys; no transferred native pass labels. |
| Session/security/data integrity | 1–5 | R04–R07/R14–R15 RLS, two-tab, ambiguous outcome and recovery assertions. |
| No new errors / accessible responsive UI | 0, 3–5 | R08–R09/R13 baseline-relative results and keyboard/layout evidence. |
| Lightweight, finite execution, safe cleanup | 2–5 | R11–R12 counted requests/listeners, deadlines, measured claims and deletion role ledger. |
| Honest completion/release status | 5 then separate release | Phase evidence, independent deployment record and bounded production checks. |
