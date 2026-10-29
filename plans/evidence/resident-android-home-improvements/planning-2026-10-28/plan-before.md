# Resident Android home screen — implementation plan

Date: 28 October 2026 (Asia/Manila)  
Status: Planning complete; implementation and validation not started.  
Scope: The ten finalized home screen requirements in this chat. Android is the target shown in the supplied screenshots. Web and iOS changes are limited to compatibility with necessary shared contracts; their home screens are outside this plan.

## 1. Intended result

The screen presents content in this order:

1. Existing profile-completion guidance, when applicable.
2. Resident profile and barangay information, or the existing guest sign-in entry.
3. Shortcuts: **Services, Reports, Emergency, Maps, Health**.
4. Active emergency advisory banner, when applicable.
5. Your requests, ordered by resident attention and activity.
6. Around the barangay, with useful announcement previews.

Remove the greeting. Preserve the floating bottom navigation, existing destinations, themes, font preferences, reduced-motion behavior, pull-to-refresh, and request summary → tracking journey. Do not change notification badge semantics or redesign the announcements hub as part of this work.

## 2. What the source currently establishes

Read-only inspection used working files on 28 October 2026. Git HEAD was `9fe8add15b0a5b75f6c232e30679da869731a4ea`; the working tree also contains existing edits. HEAD alone does not identify those working files. Recheck affected files before implementation and preserve unrelated changes.

| Area | Observed behavior | Implementation consequence |
|---|---|---|
| Home screen | `apps/resident-android-mobile/src/app/(app)/home/index.tsx` renders the greeting, shortcuts, request shelf, and one announcement. | Main integration point; split into focused components only where useful. |
| Request selection | Home filters by resident, orders by creation date, and limits to three records. | Sorting those three locally cannot reveal an older request needing attention. Priority must be applied before the limit. |
| Request presentation | `src/lib/home-request.ts` supplies four delivery stages and payment-aware status labels. | Extend existing summary logic; preserve payment and delivery distinctions. |
| Request details | `src/components/home/request-summary-sheet.tsx` keeps full titles and routes through Home's tracking stack. | Retain full service names, dismissal behavior, Back behavior, and focus restoration. |
| Announcements | Home fetches the newest announcement only. `use-emergency-announcements.ts` fetches emergency-category records and uses a public emergency cache. | Fetch active advisories independently; an ordinary newer post must not hide an active advisory. |
| Alert lifetime | Inspected announcement types, schema, and announcement migrations have no active/expiry field. | Add a small lifecycle contract and publishing controls; category alone cannot establish an ongoing emergency. |
| Request metadata | Requests expose `updated_at`, `cancelled_at`, and `status_history`; fee and eligibility fields also exist. | Use recorded values and existing eligibility rules. Never infer a cancellation reason or payable fee from status alone. |
| Carousel | `src/components/scrollable-chevron-row.tsx` overlays controls and is shared with other screens. | Add an opt-in Home presentation or a Home-specific shelf; preserve other consumers. |
| Navigation | Shortcuts say Documents/Report/Emergency; tabs say Services/Reports/DRRM. | Align visible labels without renaming routes or rebuilding navigation. |
| Existing states | Home has guest, initial loading, empty, retry, and failed-refresh content-retention behavior. | Extend these rather than replacing them; add clear freshness and offline information. |

Paths beginning `src/` in this table are relative to `apps/resident-android-mobile/`.

Coordinate edits to shared announcement contracts and routes with `plans/Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md`. Revalidate the actual source; that plan does not prove its proposed work is implemented.

## 3. Settled implementation decisions

### Emergency advisories

- Proposed minimal field: nullable `alert_expires_at` on announcements, subject to the phase-0 schema check. Reuse an equivalent implemented contract if one has appeared; do not create competing lifecycle fields.
- A banner candidate must be an emergency announcement, visible to the current viewer under existing access rules, not deleted, already published, and have a recorded expiry later than the current time.
- New active advisories require an explicit expiry. Existing emergency posts with no expiry remain ordinary feed records until an authorized publisher explicitly activates them. Do not backfill them as active or expired from age alone.
- Add expiry/activation and early-end controls to the existing admin create/edit flow. Ending an active advisory records its end time through the same expiry contract. Validate timestamps and category combinations on the server as well as in the form; preserve authorized publisher boundaries and audit behavior.
- Expired records remain in the announcement feed with an **Expired** label. Compute expiry from timestamps; a scheduler is not required just to change the label or hide the banner.
- Reevaluate at the nearest expiry/publication boundary while Home is focused, after app resume, after refresh, and after relevant data changes. Clean up timers and listeners when inactive.
- With multiple active advisories, show the latest published advisory plus an accurate additional-alert count and a route to the remaining advisories. The detail action opens the existing announcement detail by ID. Never silently discard the others.
- Cached advisory content must show its last successful refresh time. Recheck its recorded expiry locally and describe unverified content as last-known information rather than asserting that its current status has been confirmed.

### Request ordering, titles, and progress

- Keep a maximum of three Home cards. Select from the full eligible resident dataset in this order: **requires resident action → other active → completed → cancelled**. Within each group, sort by last update descending, then a stable ID tie-breaker.
- Apply priority before limiting results, preferably in a small authenticated, security-invoker query function. Derive the resident from the authenticated session, preserve row-level access rules, and exclude deleted records. Do not download an unbounded history to sort on the device.
- Define attention using real tracking rules: collectible payment only after an actual positive assessed fee and supported payment flow, ready-for-pickup, and any other currently supported resident action verified in phase 0. A review in progress or unknown fee is not automatically an action request.
- Use one presentation contract for the query priority and UI next-action message, with parity cases verifying they agree. Do not create new review, payment, or submission workflows.
- Use verified service identifiers or catalog metadata for short-title mappings. Start with known long titles, including **Business Barangay Clearance**. Unknown services retain their full title and wrap; do not shorten them by arbitrary word removal.
- Show short title, reference, status/progress, last update, and the next action when one exists. Tapping the card preserves the existing summary sheet and full-tracking route; no payment mutation occurs from Home.
- Retain the existing four delivery stages where the service uses them. Show **Step N of 4 · [delivery stage]**, with payment state separately where necessary. Confirm versioned/legacy service behavior rather than inventing additional steps.
- Cancelled cards have no progress bar or step count. Use recorded `cancelled_at`, then a valid cancellation history event if needed; display a resident-visible reason only when explicitly recorded and authorized. If missing, say **Cancellation date unavailable** and omit the reason.
- Unknown statuses show **Status unavailable**, without a fabricated step or action. Missing update timestamps show **Update time unavailable**.
- Rename the Home subtitle from “3 recent requests” to wording such as **3 requests shown**, since priority ordering is no longer strictly chronological. “See all” must open the existing Requests view; verify its tab-selection contract rather than assuming `/services` selects Requests.

### Layout, labels, and carousel

- Remove the greeting and its unused screen variables/styles. Remove `homeGreeting` and its test only if no other callers remain.
- Keep the profile/barangay row and profile-completion guidance. Begin with 16 dp between major sections and 8–12 dp within sections; tune after native review without reducing touch targets or readable font sizes.
- Use **Services, Reports, Emergency, Maps, Health** for matching shortcut/tab labels. Keep existing routes, tab count/order, and business behavior. Use **Emergency information** for the corresponding header/accessibility wording; explain DRRM within that destination if needed.
- Size request cards from the available viewport rather than a fixed width. At rest, one complete card must be readable, including at large font sizes. Allow vertical growth and wrapping rather than fixed-height clipping.
- Place previous/next controls and **1 of 3** below the shelf, outside card content. Preserve swiping. Disable unavailable directions; hide controls and position text for a single card. Position state must stay correct after swiping, resizing, refresh, or item removal.
- Maintain bottom padding using `useFloatingTabInset` so the final content and action can scroll completely above the floating bar.

### Announcements and data states

- Retain the existing latest-announcement preview limit unless a requirement needs otherwise. Include title, readable category, publication date, a short plain-text preview derived from `body`, and a visible **View details** action within one accessible card action. Keep full content in the existing detail view.
- Preserve existing feed/detail destinations and announcement IDs. Exclude deleted or not-yet-published posts in the appropriate query/access layer. Verify permitted guest and barangay scope rather than broadening it.
- Keep independent initial-loading, empty, error, refresh, and stale-data states for requests, announcements, and alerts. A failed source must not appear as an empty successful list.
- Show **No requests yet** with **Request a document**, opening the verified request-entry destination. Keep guest sign-in guidance separate.
- Use the existing installed connectivity support for an explicit offline indication. A generic server error alone is not proof of offline status. Display **Last refreshed [time]** from the last successful fetch, not a record's modification timestamp.
- Retain already loaded data through failed refreshes and retry without blanking content. Use accessible placeholders for initial loads and one refresh operation at a time.
- Keep private request retention in memory by default. Scope all retained state by account and barangay; clear it on sign-out/account change and reject late results from the old scope. Show an offline-unavailable state after a cold start without private cached data. Reuse public caching only when its scope and visibility are valid; do not expose signed-in-only posts to guests.
- Replace sample records in release content through an explicit, reviewed content list. Keep synthetic test fixtures clearly separate. Do not hide records at runtime by filtering titles containing “Sample.” Real announcement copy must come from the publisher.

## 4. Phased delivery

All phases are pending. This planning pass changes only this document; it runs no product tests, migrations, installs, or deployment actions.

| Phase | Work and principal files | Completion gate |
|---|---|---|
| **0 — Baseline and contracts** | Capture affected working changes and native screenshots. Recheck Home, tracking/payment rules, request history reasons, feed visibility, admin publishing, and concurrent notification changes. Confirm existing tooling and record relevant baseline results. | Exact scope and field/query contracts are recorded; no unresolved guess about active alerts, request actions, ownership, or destinations remains. |
| **1 — Data prerequisites** | Implement alert lifetime in `packages/shared/src/types/database.ts`, `packages/shared/src/schemas/announcement.ts`, the admin announcement create/edit components, and a new migration. Implement priority-before-limit retrieval and supporting indexes only where justified. | Database and integration checks prove alert lifecycle, priority selection, validation, and authorized access, including an older attention-needed request outside the newest three. |
| **2 — Home structure and labels** | Update `src/app/(app)/home/index.tsx`, `src/components/app-tabs.tsx`, and `src/components/resident-header.tsx`. Remove greeting, tighten spacing, reserve the below-shortcuts advisory slot, and align labels. | Correct order, no blank greeting gap, profile retained, all five shortcuts reach the same destinations, and bottom content clears navigation. |
| **3 — Request cards and carousel** | Extend `src/lib/home-request.ts`, integrate the priority query, update Home cards and `request-summary-sheet.tsx` where required, and add a scoped shelf component or opt-in carousel presentation. | Concise/full-title behavior, correct priority, honest progress/cancellation, current index, readable cards, and unchanged summary/tracking Back behavior all pass. |
| **4 — Alerts, previews, and resilience** | Connect the advisory banner, expand preview content, and extend Home data-loading hooks/state. Reuse existing emergency/feed helpers only after checking scope and lifecycle. Update announcement card/detail rendering where expiry labels are needed. | Active/expired/multiple alerts, preview/detail links, independent states, failed-refresh retention, freshness display, account switching, and offline behavior pass. |
| **5 — Accessibility, regression, and release readiness** | Run targeted checks and native review; fix issues, collect before/after evidence, and verify approved release content. | Every acceptance item below passes, or a concrete external dependency remains explicitly pending. Code completion, database rollout, and release-content approval are recorded separately. |

Dependency order: phase 0 → phase 1 → phases 2–3 → phase 4 → phase 5. Reversible layout preparation can proceed while data contracts are being verified, but dependent behavior is not complete until its real data path works.

## 5. Verification and acceptance

Extend existing behavioral coverage rather than adding tests for individual style values. The existing `tests/home-presentation-ui.mjs` hard-codes the old newest-three query and labels; update its fixtures to model real priority/expiry filtering rather than merely changing expected snapshots.

| Requirement | Required evidence |
|---|---|
| **R1 — Active emergency alerts** | A newer routine post cannot hide an older active advisory. Future, deleted, wrong-scope, expired, and lifetime-unknown records do not become active banners. Test expiry while focused, background/resume, early end, multiple alerts, and stale cached content. Expired announcements remain reachable in the feed with their label. |
| **R2 — Scannable requests** | An older attention-needed request outranks three newer inactive requests. Verify cross-group and tie ordering, maximum three unique cards, reference/status/update/action content, known short titles, unknown long titles, and full names in details. |
| **R3 — Meaningful progress** | Test submitted paid/unpaid/waived, processing, ready, completed, cancelled, unknown status, malformed/missing history, and recorded cancellation reasons. Fee-not-assessed requests must not acquire a false payment action. |
| **R4 — No greeting** | Greeting is absent for both residents and guests; profile, barangay, completion guidance, and guest login remain usable. |
| **R5 — Spacing and clearance** | Compare native screenshots at 320, 360, and approximately 412 dp widths, including large font settings. No clipped essential text, overlapping controls, or last-item obstruction by the bottom bar. |
| **R6 — Announcement previews** | Title/category/date/body preview/action render correctly for long content, missing/failed images, and plain-text extraction. Detail links preserve the selected ID. Reviewed release content contains no placeholder posts. |
| **R7 — Consistent labels** | Matching shortcuts/tabs use Services, Reports, Emergency, Maps, Health; routes, Back history, headers, and screen-reader descriptions still agree with their destinations. |
| **R8 — Carousel controls** | Swipe and buttons update the same index; controls do not overlap cards. Verify zero/one/three items, edge disabling, large fonts, resizing, refresh, and selection removal. Screen-reader users can move through cards without gestures. |
| **R9 — Data states** | Verify guest, initial load, genuinely empty results, cold offline start, offline after success, server error while online, failed refresh, successful retry, double refresh, unmount, sign-out, and rapid account/visibility-scope changes. Old-scope content must never flash or return through a late response. |
| **R10 — Accessibility** | Native TalkBack review confirms logical reading order, named actions, meaningful stage/status announcements, focus restoration, and no hidden focus targets. All interactive targets are at least 48 × 48 dp; text contrast is at least 4.5:1 for normal text and 3:1 for large text, with 3:1 for essential control/state visuals. Check light/dark themes, representative accent/font settings, large text, and reduced motion. |

Use these existing checks where affected, after confirming local tooling in phase 0:

- Android TypeScript check and app lint; shared/admin checks when their contracts or publisher forms change.
- Focused Vitest coverage in `src/lib/home-request.test.ts` and new lifecycle/priority/state helpers; shared announcement schema tests.
- `tests/home-presentation-ui.mjs` for Home rendering, data states, gestures, and destinations.
- `tests/reports-announcements-ui.mjs` and `tests/request-tracking-navigation.mjs` for shared announcement and tracking regressions.
- Existing navigation, floating-tab-layout, hidden-work, and resident-shell lifecycle checks when shared tab, carousel, or loading ownership changes.
- Database tests for priority-before-limit, fee/action parity, lifecycle validation, resident/guest/publisher visibility, and cross-account access. Test all supported request contract versions.
- Native Android review in the established emulator/device environment. Browser fixtures are useful but do not establish TalkBack behavior, native font layout, or native Back handling.

Record commands, exit codes, source identity, limitations, and screenshot locations under `plans/evidence/resident-android-home-improvements/` during implementation. Run the affected baseline once, then rerun after relevant changes; broaden only for shared behavior, failures, or unresolved risks.

## 6. Rollout and completion

1. Validate additive schema/query changes in the existing local/test workflow. Use the Supabase skill and current official documentation before implementing database changes; create migrations with the supported CLI workflow. Preserve access policies and avoid privileged query shortcuts.
2. Deliver compatible publisher/shared-contract changes before relying on new expiry data in Android. Verify ordinary announcement creation and editing still work for other supported clients.
3. Verify the Android build against the actual schema/query version before release. A missing required backend contract is an integration failure, not an empty successful feed.
4. Review legacy emergency posts individually. Only the publisher can determine which are ongoing and assign real expiry times. Leave unknown records unpromoted and record missing release content as pending rather than fabricating it.
5. Capture final native screenshots and the R1–R10 results. Report implemented behavior, checks passed, and remaining database/content/release dependencies distinctly.
6. If rollout causes a regression, revert the task-owned Android/publisher changes without undoing unrelated working edits. Prefer retaining harmless additive data fields over destructive schema rollback.

The work is complete when all ten requirements are implemented and verified, required backend contracts are available in the target environment, and release content has been reviewed. Planning or fixture-only success does not establish release readiness.
