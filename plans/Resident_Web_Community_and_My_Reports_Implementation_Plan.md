# Resident Web Community Reports and My Reports Implementation Plan

Created: 2026-10-17 (Asia/Manila)

Revised: 2026-10-17 (Asia/Manila). Preserve the existing personal report tabs, rename All reports to My Reports, add Community Reports alongside them, and explicitly require profile completion before incident submission.

Status: Planning only. Implementation has not started. All execution phases below are pending.

## 1. Objective and scope

Improve the resident web Reports screen by renaming the existing All reports tab to My Reports, preserving the existing Active and Resolved tabs, and adding an Instagram-inspired Community Reports feed as a fourth tab in the same row. Add resident view counts, public report comments, anonymous submission enabled by default, and an explicit profile-completion requirement before incident submission.

This plan replaces the earlier conversational proposal to publish only staff-approved reports or public-safe summaries. The requested behavior is automatic inclusion of all non-deleted resident reports in the five supported statuses, using the submitted report content and the selected author identity mode. There is no publication approval queue or category-based exclusion in this plan.

Scope includes the resident web Reports page, submission side sheet, personal report history, community report reading and comments, and the backend changes necessary to support them. Existing report processing and withdrawal permissions remain authoritative.

The cancelled Phase 8 in `Major_Web_AndroidMobile_Improvement_Plan.md` remains cancelled. This plan does not authorize Android usability work, Android UI changes, or iOS UI changes. Shared backend changes must remain compatible with existing clients; any necessary compatibility adjustment must be narrowly tied to this feature and must not redesign mobile screens.

## 2. Updated product breakdown

### 2.1 Reports screen navigation

Keep one tab row in this order: **My Reports | Active | Resolved | Community Reports**. Rename the existing All reports tab only; retain its personal report list and behavior. Add Community Reports after the three existing tabs. Do not replace Active and Resolved with nested filters or introduce a second level of personal tabs.

| Tab | Purpose | Included reports |
| --- | --- | --- |
| My Reports | Existing All reports tab, renamed | The logged-in resident's own non-deleted reports in all five supported statuses, anonymous and named |
| Active | Existing Active tab, unchanged | The logged-in resident's Open and In Progress reports |
| Resolved | Existing Resolved tab, unchanged | The logged-in resident's Resolved reports |
| Community Reports | New tab for the same-barangay social feed | All non-deleted resident reports in all five supported statuses |

Keep **Report an Incident** available from all four tabs. Preserve the existing initial selection: My Reports (the renamed All reports tab). Preserve the chosen tab, filters, loaded position, and scroll position when returning from report details or comments. Support links directly to My Reports and individual community posts. Residents with incomplete profiles may open the submission side sheet but must complete their profile before the report form and Submit action become available; see section 2.10.

Working audience assumption: "public" means visible to other signed-in residents of the same barangay. It does not add an unauthenticated internet-wide feed or cross-barangay browsing. Preserve existing guest map behavior while ensuring it cannot disclose the identity behind an anonymous report.

### 2.2 Community Reports feed

Use [Instagram](https://www.instagram.com/) as the requested visual reference for the post anatomy: author row, prominent media, caption/content, interaction summary, and comments. Retain Barangayan's existing navigation, colors, typography, and accessibility conventions. This is a proposed adaptation; the reference site did not expose inspectable feed content through the available page fetch.

Use a readable, centered, single-column feed on desktop, with responsive spacing for narrower web browsers. Do not stretch photos across the full application width or use the current report-card grid as the community feed.

Each post contains:

1. **Author row:** appropriate profile picture and display name, report timestamp, and status badge.
2. **Report content:** title, category, description, location, and specific area details.
3. **Photos:** a prominent image or carousel with position indicators, previous/next controls, and an enlarged photo view. Preserve photo order and support the current limit of five photos. Reports without photos use the same post structure without a placeholder image block.
4. **Interaction summary:** unique resident view count and comment count.
5. **Discussion:** a short comment preview and a **View all comments** action, plus an accessible way to write a comment.

Long descriptions may collapse behind **Read more**. Full descriptions and specific area details must remain available. Location represents the reported incident location, not the account holder's home address. Do not substitute a coarse location or remove the requested specific area details.

The report body is limited to the fields the user requested. Status, timestamp, views, and comments are interface metadata supporting the agreed behavior. Do not add reporter contact details, resident IDs, private staff notes, account addresses, likes, follows, direct messages, or extra social-network features.

### 2.3 Status visibility

| Status | Included in Community Reports | Included in the author's My Reports |
| --- | --- | --- |
| Open | Yes | Yes |
| In Progress | Yes | Yes |
| Resolved | Yes | Yes |
| Withdrawn | Yes | Yes |
| Unresolved | Yes | Yes |

Publish on successful report submission. A status change updates the existing feed post; it does not create a second post or remove the original. Resolved, Withdrawn, and Unresolved posts remain readable and commentable.

Withdrawal is distinct from deletion: it changes status and retains the public post. Preserve existing authorized soft-delete behavior; deleted reports are excluded from the feed, comments, and view-recording endpoints. Do not change withdrawal into deletion or allow residents to change report statuses outside the existing workflow.

### 2.4 Anonymous submission toggle

Place a labeled **Submit anonymously** on/off switch beside the **Submit** button in the Report an Incident side sheet footer.

- Default to **on** for every newly opened report form. A prior named submission must not make the next report named by default.
- On means use a random anonymous picture and random anonymous display name in Community Reports.
- Off means use the resident's profile picture and resident account name in Community Reports.
- Preserve the chosen value during validation errors, photo upload failures, and submission retries for the same draft.
- Save the choice with the report. The server/database default must also be anonymous when older clients omit the field.
- Keep the switch and submission button in the same action area; allow wrapping on small web widths while retaining their association.
- Disable identity changes while submission is in flight. A double click or uncertain retry must not create a differently named duplicate.
- Apply the same behavior to the existing standalone new-report route because it uses the same form.

Suggested adjacent explanation: "Your report will appear in Community Reports. Anonymous hides your name and photo from other residents; authorized barangay staff can still identify your submission."

Anonymity changes the displayed author identity, not the report's ownership. The report remains linked to the resident account for My Reports, authorized staff processing, and permitted withdrawal. It does not anonymize identifying information residents include in their own descriptions, photos, or location details.

### 2.5 Public author identity and content

| Displayed item | Anonymous report | Named report |
| --- | --- | --- |
| Profile picture | Random anonymous avatar | Resident profile picture; neutral fallback if absent |
| Author name | Random anonymous name | Resident account name |
| Title | Submitted title | Submitted title |
| Category | Submitted category | Submitted category |
| Description | Submitted description | Submitted description |
| Photos | Submitted photos | Submitted photos |
| Location | Submitted incident location | Submitted incident location |
| Specific area details | Submitted details | Submitted details |

Assign an anonymous name and avatar once per report and persist them. They remain the same across residents, refreshes, status changes, and comments. Separate reports receive independently generated identities; do not use a resident-wide pseudonym that links their reports. Use a neutral local avatar collection or generated graphic, without uploading real resident photos to an avatar service.

The public response for an anonymous report must not include the real reporter's ID, name, avatar, contact information, or identity-bearing media paths. Hiding these values in rendered markup is insufficient. Avoid returning identity-bearing data through page payloads, APIs, Realtime events, search, profile links, or alternate incident endpoints.

Historical reports without an explicit identity choice should enter the feed anonymously. New reports submitted by older clients should also default to anonymous. Named attribution requires an explicit stored off choice; do not infer consent from an existing profile name or photo.

### 2.6 Resident view counts

Display a label such as **128 residents viewed this report** on every post, with correct zero and singular forms.

Working counting rule:

- Count distinct signed-in resident accounts per report, not page reloads, impressions, devices, or browser sessions.
- Count when at least half of the post remains visible for two seconds in the foreground, or when the resident deliberately opens its full report/comments view. Loading or prefetching a post alone does not count.
- Exclude the report author, guests, and staff accounts from the resident audience count.
- Count the same resident only once even across browsers, devices, repeated visits, and simultaneous requests.
- Record viewer identity privately to enforce uniqueness. Expose only the aggregate number, with no viewer list.
- Start counts at feature launch; do not invent historical views.
- A failed view update must not prevent report reading or generate repeated toast messages.

These counting details are implementation defaults proposed to make "how many residents" precise; the requested feature is the displayed resident count.

### 2.7 Comments

Every community report has one public discussion shared wherever that report is opened.

- Show comment count, a small preview, and a full comments panel with paginated history and a text composer.
- Residents in the report's barangay can read and submit comments, subject to existing account-completion and access requirements.
- Initial scope is plain-text, single-level comments. Use a proposed 1,000-character limit; reject empty or whitespace-only submissions and render text safely.
- Show commenter avatar, display name, text, and timestamp. Other residents use their account name and picture by default.
- When the author of an anonymous report comments on their own report, always use that report's anonymous name/avatar and an **Author** label. Never disclose their real identity in comment responses or payloads.
- For a named report, author comments use their account identity and an **Author** label.
- Residents can delete their own comments; existing authorized barangay staff permissions may support comment removal for abuse. Do not introduce a separate staff moderation dashboard in this scope.
- Deduplicate retries and Realtime delivery so one submitted comment appears once. Retain the draft on failure and show inline recovery; use the existing feedback system for deliberate actions.
- Keep comments available across all five report statuses. Counts and previews exclude deleted comments.

Comment anonymity for residents other than an anonymous report's author, threaded replies, reactions, attachments, mentions, and comment notifications are outside this initial scope.

### 2.8 My Reports

My Reports is the existing All reports tab with a new label. Preserve its list layout, sorting, details drawer, and complete account-owned history. Anonymous reports must be present because anonymity does not remove account ownership.

Keep the existing **Active** and **Resolved** tabs at the same level as My Reports. Active continues to include Open and In Progress; Resolved continues to include Resolved only. My Reports continues to include all five statuses, including Withdrawn and Unresolved. Do not add separate Withdrawn or Unresolved tabs, nested personal filters, or redesign these three existing views. Retain existing report card fields and behavior; add only the **Anonymous** or **Named** identity indicator needed by this feature. Preserve existing reference numbers, report details, resolution details, read/unread behavior, and withdrawal permissions wherever already supported.

Offer **View community post** from personal report details. Community readers receive only the public report fields; owner-specific controls and private details remain restricted to the owner and authorized staff.

### 2.9 Search, filtering, and screen states

- Community Reports: search title/description/location; filter by category and any of the five statuses; default to All statuses and newest submissions first.
- My Reports, Active, and Resolved: preserve existing sorting, filtering, and list behavior. Do not turn these tabs into a new personal-history filtering system. Any pagination work required for the new community feed must not silently change the existing personal views.
- Use stable pagination ordered by submitted time and report ID. Load a bounded first page and provide **Load more** without losing scroll position.
- Preserve loaded feed position when new reports arrive; offer a new-reports indicator rather than inserting content above the reader unexpectedly.
- Provide distinct initial loading, next-page loading, empty feed, no personal reports, no filter matches, report unavailable, comments loading/failure, and retry states.
- Keep existing theme support, reduced-motion preferences, keyboard access, visible focus, screen-reader labels, and image controls.

### 2.10 Profile completion required before reporting

An incomplete resident account cannot submit an incident report, whether anonymous or named.

- Check the signed-in resident's profile completion when the Report an Incident side sheet opens. While checking, show a loading state and keep submission unavailable.
- If incomplete, show a clear gate inside the side sheet: **Complete your profile to report an incident**, with explanation **You need to complete your resident profile before submitting a report.** Provide **Complete Profile** and retain the sheet's close control. Do not show an enabled Submit action or start photo uploads.
- Complete Profile opens the existing profile-completion flow, with a safe return destination to the reporting flow. After successful completion and return, recheck eligibility before showing the form. Completing a profile must never automatically submit a report.
- Use the application's existing authoritative profile-completion rules and helpers; do not introduce a different required-field checklist, an ID-approval requirement, or a second completion form.
- Recheck eligibility immediately before any report photo uploads and submission. The server/database must also reject incident creation from incomplete resident accounts, including direct API requests and profiles that become incomplete after the sheet opens. Reuse and verify existing enforcement before adding another guard.
- If the completion check fails, keep submission blocked and show retry guidance; do not treat an unavailable result as a complete profile.
- Apply the same restriction to the standalone `/reports/new` route and the shared submission form so another entry point cannot bypass it.
- Keep community reading and the existing personal report lists available under their current access rules. This restriction gates incident submission; it does not make profile completion a prerequisite for reading reports.

## 3. Repository findings and implementation boundaries

The following source observations were checked on 2026-10-17; they are repository findings, not claims about the currently deployed database.

| Area | Current implementation | Planned treatment |
| --- | --- | --- |
| Reports route | `apps/resident-web/src/app/(resident)/reports/page.tsx` renders `MyReportsTabs`; guests see an inline sign-in gate | Retain the account gate and existing default personal view |
| Personal report workspace | `apps/resident-web/src/app/(resident)/reports/my-reports-tabs.tsx` has All reports / Active / Resolved filters and detail/new-report drawers | Rename All reports to My Reports, preserve Active and Resolved, and append Community Reports in the same row |
| Personal report hook | `apps/resident-web/src/hooks/use-my-incidents.ts` queries by `reporter_id` and subscribes to incident changes | Preserve ownership filtering and existing personal tab queries; ensure types can represent all five statuses without adding personal filters |
| Submission | `apps/resident-web/src/app/(resident)/reports/new/new-report-form.tsx` uploads photos before inserting an incident | Persist anonymous choice and keep existing validation and upload flow compatible |
| Submission sheet | `apps/resident-web/src/components/reports/new-report-drawer.tsx` hosts the shared form and already checks `needsResidentProfile`, redirecting incomplete residents to completion | Make the restriction explicit inside the sheet with Complete Profile guidance; reuse the existing completion flow and add the anonymous switch only for eligible residents |
| Profile eligibility | `packages/shared/src/lib/resident-auth.ts` supplies `needsResidentProfile` and `residentCompletionDestination`; the standalone new-report page uses `requireUser`; migration `0103` defines a submission-completion guard | Reuse the existing rules, verify their effective database enforcement, and recheck eligibility before uploads/submission; avoid duplicate completion rules |
| Details | `apps/resident-web/src/components/reports/incident-drawer.tsx` and the `[incidentId]` route provide personal report details | Preserve owner access; provide a public-safe community detail/comment path |
| Schema | `packages/shared/src/schemas/incident-report.ts` covers report fields; migrations already define the five statuses | Extend inputs compatibly; do not create another report-status lifecycle |
| Identity exposure | Earlier migrations permit community and guest incident reads; the base incident row includes `reporter_id` | Audit effective grants, projections, policies, and dependent clients before changing access; a new feed projection alone does not secure the base table |
| Media | Existing upload paths start with the uploader account ID and use public photo URLs | Serve feed media through identity-neutral paths/responses; ensure legacy URLs cannot defeat report anonymity |
| Migrations | Highest repository prefix observed is `0130` | Recheck immediately before creating migrations; `0131` is only the next candidate if still unused |

Several relevant resident-web files already have local changes. Preserve those edits and implement against the current workspace after reviewing their diffs; do not reset or overwrite them.

## 4. Data and access design

The following is a proposed contract to finalize during Phase 1, not a declaration that these tables or APIs already exist.

1. **Report identity:** store the anonymous flag with a true default plus a report-scoped anonymous name and avatar key. Generate identities on a trusted write path; preserve private reporter ownership separately. Keep identity mode fixed after submission for this initial scope.
2. **Community reads:** expose a paginated, explicitly allowlisted report projection with the requested fields, computed public identity, status, timestamp, and aggregate counts. Check barangay membership server-side. Do not fetch broad profile rows to populate a feed card.
3. **Private identity access:** constrain raw reporter identity to the report owner and existing authorized staff. Audit base-table SELECT grants, map/search endpoints, guest reads, admin projections, storage URLs, and Realtime channels. If an existing client needs a broad incident read, replace it with a compatible safe response before enabling anonymity. Merely adding RLS to an already broad row does not hide individual identity columns.
4. **Views:** store one private report/resident pair with a unique constraint. Derive viewer and barangay from the authenticated session; validate report visibility and resident role. Use atomic insertion/aggregation, not a browser-supplied count or viewer identity. Index report lookup and enforce tenant restrictions.
5. **Comments:** store report ID, private author ID, body, timestamps, and deletion state. Derive displayed identity on the server, including the anonymous report-author rule. Enforce same-barangay access, author-owned deletion, authorized staff removal, validation, and a server-enforced posting limit. Return only public comment fields.
6. **Attachments:** retain the requested photos while preventing upload paths, redirects, original filenames, and image metadata from disclosing the anonymous account identity. Reuse originals internally if needed; return identity-neutral media references externally. Do not solve this by dropping photos or breaking existing attachments. Verify direct access paths as well as the feed renderer.
7. **Realtime and cache:** send only safe public report/comment changes. Never stream raw anonymous reporter IDs or private viewer rows to community subscribers. Scope cached responses and subscriptions to account/barangay and clear them on sign-out/account changes.
8. **Defaults and history:** backfill all existing non-deleted reports into anonymous presentation, assign stable anonymous identities, retain original report/status data, and initialize view counts to zero. Perform any media compatibility work before exposing the feed.
9. **Submission eligibility:** use existing profile-completion rules for the sheet, shared form, and standalone route. Verify the effective database incident-insert guard rejects incomplete resident accounts independently of the UI; retain staff/import permissions as currently authorized. Add or repair a guard only if verification identifies a gap. Do not permit anonymous reporting to bypass completion.

Apply row-level policies and explicit grants to new exposed relations. Use caller-respecting access where possible; any privileged operation needs narrow permissions, explicit account/tenant checks, and a documented reason. Follow the repository's four-digit sequential migration naming rule over timestamp-based generator defaults. Never renumber existing migrations.

## 5. Execution phases

### Phase 1 — Confirm data contracts and screen design

- [ ] Review effective incident/profile/storage policies and all readers of incident author IDs, including map, search, Realtime, and mobile data paths.
- [ ] Finalize the public report response, anonymous identity strategy, comments contract, view-count rule, and legacy media approach.
- [ ] Produce desktop and narrow-web layouts covering feed posts, photo/no-photo reports, comments, the existing personal views, the four-tab row, and the submission footer.
- [ ] Map existing profile-completion helpers, side-sheet/standalone-route checks, and database submission enforcement; design the side-sheet completion gate and return flow.
- [ ] Record any compatibility dependency before implementation. No Android UI changes are permitted.

Exit: a concrete layout and field/access mapping cover both identity modes, all five statuses, and existing report clients.

### Phase 2 — Backend identity, feed, and migration foundation

- [ ] Add compatible identity fields/defaults and historical anonymous backfill.
- [ ] Add safe paginated community reads, complete status filtering/search, and identity-neutral media handling.
- [ ] Close alternate identity read paths while preserving owner/staff access and existing client behavior.
- [ ] Write migrations using the next unused four-digit prefixes; verify migration ordering and generated shared types.
- [ ] Exercise anonymous, named, guest, same-barangay, different-barangay, owner, and staff reads in a local test environment.
- [ ] Verify incident creation rejects incomplete resident accounts at the database boundary; preserve or repair existing enforcement instead of duplicating it.

Exit: community data returns all requested statuses and fields without returning anonymous account identity.

### Phase 3 — Profile eligibility and anonymous submission

- [ ] Gate the side sheet with existing profile-completion rules, loading/error handling, and a Complete Profile action with a safe return destination.
- [ ] Recheck completion before uploads/submission and cover the shared form and standalone route; never submit automatically after completion.
- [ ] Add the default-on switch beside Submit in the shared report form.
- [ ] Save the choice atomically with the report; enforce anonymous defaults when the input is omitted.
- [ ] Keep ownership, validation, attachments, location picking, and submission feedback working.
- [ ] Verify incomplete profiles, completion-return flow, late eligibility changes, failed eligibility checks, new-draft reset, same-draft retries, both submission entry points, and anonymous/named feed responses.

Exit: incomplete resident accounts cannot submit through the sheet, standalone page, or direct API; eligible submissions have the intended identity mode and appear in My Reports and community reads.

### Phase 4 — Community Reports feed

- [ ] Rename All reports to My Reports, retain Active and Resolved unchanged, and append Community Reports in the same tab row; preserve the existing default personal selection.
- [ ] Add the new Community Reports feed post layout without redesigning the three existing personal lists.
- [ ] Add identity presentation, all report fields, photo carousel/enlargement, status metadata, filters, search, and pagination.
- [ ] Add public report linking and safe detail/comment entry points without exposing owner-only controls.
- [ ] Preserve navigation state and implement all loading/empty/error states.

Exit: residents can browse all five statuses using the requested feed structure and correct identity display.

### Phase 5 — Unique resident views

- [ ] Add private deduplicated view storage and authorized recording/aggregation.
- [ ] Add qualifying visible-post and deliberate-open tracking with foreground handling and cleanup.
- [ ] Show counts with zero/singular/plural wording; keep view failures quiet and recoverable.
- [ ] Verify self/staff/guest exclusions, duplicate/concurrent requests, multi-device behavior, and tenant isolation.

Exit: each eligible resident contributes at most one view per report and only aggregate counts are public.

### Phase 6 — Report comments

- [ ] Add comment storage/access, safe identity projection, validation, retry deduplication, and posting limits.
- [ ] Build comment count/preview, full paginated discussion, composer, author label, and own-comment deletion.
- [ ] Support existing authorized staff comment removal without creating a new moderation product.
- [ ] Verify anonymous report-author comments, other resident identities, terminal-status discussions, realtime convergence, and draft recovery.

Exit: discussions work for all five statuses and cannot expose the anonymous report author's account identity.

### Phase 7 — Preserve personal report tabs and verify end to end

- [ ] Verify My Reports is the renamed existing All reports view and Active/Resolved retain their current queries, layout, sorting, and capabilities; add the Anonymous/Named indicator without extra personal tabs or nested filters.
- [ ] Link personal details to the matching community post and retain tab/filter/scroll state on return.
- [ ] Complete access-control and browser acceptance checks below; run relevant lint, typecheck, build, and targeted regression checks.
- [ ] Review the complete anonymous-report flow from upload through every public response, including direct data requests.
- [ ] Record evidence and deployment/rollback order. Enable the feed only after schema, history, media, and identity protections are ready.

Exit: the full resident web experience and required backend behavior pass acceptance checks without mobile UI changes.

## 6. Acceptance checks

| Scenario | Expected result |
| --- | --- |
| Open Reports on a fresh signed-in visit | My Reports is selected; My Reports / Active / Resolved / Community Reports appear in one tab row and Report an Incident is available |
| Open My Reports, Active, and Resolved | My Reports retains the existing All reports list; Active includes own Open/In Progress and Resolved includes own Resolved, with existing layout, sorting, and behavior |
| Open Report an Incident with an incomplete profile | Side sheet shows the completion requirement and Complete Profile action; submission and photo uploads are unavailable |
| Complete the profile and return | Existing completion flow returns to reporting; eligibility is rechecked and the resident can fill and submit the form explicitly |
| Attempt anonymous or named reporting through another entry point with an incomplete profile | Standalone route, shared form, and direct database/API writes cannot bypass the completion requirement |
| Profile becomes incomplete after the form opens | Pre-upload/submission checks and the database reject creation until the profile is completed |
| Profile eligibility cannot be checked | Submission stays blocked with retry guidance |
| Browse all statuses | Open, In Progress, Resolved, Withdrawn, and Unresolved appear without publication approval |
| Submit without changing the toggle | Report is anonymous; only its stable random identity appears publicly |
| Turn the toggle off and submit | Resident account name and profile picture appear publicly |
| Submit named, then open another new form | Submit anonymously is on again |
| Retry a failed draft | Draft fields and chosen identity mode remain intact; uncertain retries do not duplicate reports |
| Read an anonymous report through alternate endpoints | Public payloads, profile joins, media links, search, and Realtime do not reveal reporter identity |
| Author comments on their anonymous report | Same anonymous avatar/name plus Author label; no real author identity returned |
| Another resident comments | Their account identity is shown; comment count and discussion update once |
| Resolve, withdraw, or close as unresolved | Existing community post remains visible and commentable with updated status |
| Revisit or concurrently open a report | One eligible resident contributes at most one view |
| Author, guest, or staff reads the report | No resident view is added |
| Request a different barangay's feed/report/comments/view action | Access is denied regardless of client-supplied IDs or filters |
| Inspect private report, viewer, or commenter account data | Only authorized ownership/staff access succeeds; community responses expose the allowlisted fields only |
| Browse My Reports | All own non-deleted reports appear, including anonymous and all terminal statuses |
| Load historical reports | They display anonymous identities, preserve report content/statuses, and have no fabricated historical views |
| Report without photos or a resident without an avatar | Layout remains readable; named identity uses a neutral avatar fallback |
| Filter, open a discussion, and return | Tab, filters, loaded position, and scroll position are preserved |
| Soft-delete an incident through an authorized path | Feed/detail/comment reads and new view/comment writes become unavailable |
| Use keyboard, narrow web layout, dark theme, or reduced motion | Tabs, switch, photo controls, comments, and side sheets remain usable |
| Use existing map, personal detail, or mobile report flows | Existing supported behavior remains compatible; no Android or iOS UI redesign is introduced |

Tests should focus on these meaningful behavior and authorization boundaries rather than duplicating component internals. Document any unavailable live-environment verification without claiming production readiness.

## 7. References and execution prerequisites

- [Requested Instagram UI reference](https://www.instagram.com/). The post layout in this plan is a proposed interpretation, not a verified copy of a signed-in Instagram screen.
- [Exact Expo v57 documentation](https://docs.expo.dev/versions/v57.0.0/) was opened for the repository prerequisite. This is a resident web plan, not an Expo upgrade.
- Before writing Next.js code, read the relevant bundled version-specific documentation under the installed `next/dist/docs/` as required by `apps/resident-web/AGENTS.md`.
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) inform the access design. Recheck relevant current documentation before implementation.
- Reuse the resident web loading, motion, and notification conventions documented in `Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md` and `Resident_Web_Toast_Coverage_Implementation_Plan.md`.

This document records the updated breakdown and implementation sequence. It does not itself apply database migrations, change application behavior, or start deployment.
