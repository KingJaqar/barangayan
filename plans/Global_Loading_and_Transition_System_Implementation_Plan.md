# Global Loading and Transition System — Frontend UI-Only Implementation Plan

## 1. Objective and strict scope

Improve loading animations and visual feedback in `apps/admin-web`, using existing router behavior and existing loading state.

**This is strictly a frontend presentation task. Backend, data-layer, and business-workflow changes are prohibited. If accurate feedback requires an operational-state, handler, data-layer, authentication, or lifecycle fix, document the limitation and leave that integration unchanged.** “Global” means consistent visual components across the admin interface, not an application-wide loading controller.

This revision supersedes the previous plan's Query provider, optimistic updates, conflict detection, idempotency, database changes, and processing-job proposals. Those are excluded, not deferred phases of this implementation.

### Permitted changes

- Reusable spinner, skeleton, loading-button content, and accessible loading-status components.
- CSS/Tailwind animation, stable sizing, restrained transitions, and reduced-motion support.
- Route `loading.tsx` fallback components below the existing admin layout.
- Pending markers inside existing navigation links, using supported router state.
- Binding visuals to existing `busy`, `loading`, `saving`, and `submitting` flags without changing their meaning or lifecycle.
- Loading markup and directly related accessibility attributes in existing cards, tables, buttons, forms, and dialogs.
- An optional display-delay hook that owns only a visual timer.

### Prohibited changes

- No SQL, migrations, tables, triggers, RPCs, row policies, storage rules, or generated database types.
- No API, server-action, authentication, authorization, payment, audit-log, or business-rule changes.
- No changes to Supabase calls, query filters, returned fields, payloads, request ordering, cancellation, or subscriptions.
- No TanStack Query, SWR, Framer Motion, new dependency, package manifest, or lockfile changes.
- No caching, invalidation, optimistic updates, rollback, shared mutation locks, serialization, idempotency, or retry policy.
- No removal or replacement of existing `router.refresh()`, `router.push()`, or Realtime behavior.
- No upload transport changes, file cleanup, progress instrumentation, background jobs, or persisted processing state.
- No changes to validation, submit handlers, form ownership, modal dismissal, focus-management lifecycle, or existing disabled-control rules.
- No new error boundary, retry action, Undo action, cancellation control, toast lifecycle, or recovery workflow.
- No changes to resident web or mobile applications.

If accurate feedback requires new operational state or a handler/data-layer fix, record the limitation and leave that integration unchanged. Do not expand this task to repair operation lifecycles.

## 2. Verified project baseline

The admin app declares Next.js 16.3.0, React 19.2.8, Tailwind CSS 4, and Lucide icons. Existing dependencies are sufficient.

| Existing file | Relevant behavior | Treatment |
|---|---|---|
| `src/components/admin/admin-shell.tsx` | Persistent header/sidebar and scrollable main region | Preserve structure |
| `src/components/admin/sidebar-nav.tsx` | Next.js links and 61px collapsed sidebar | Add presentation within current layout |
| `src/app/(admin)/layout.tsx` | Server authentication/profile work before shell renders | Preserve unchanged |
| `src/app/globals.css` | Shimmer and theme styles | Reuse and scope loading additions |
| `src/hooks/use-mount-transition.ts` | Drawer/dialog exit lifecycle and fallback timer | Preserve unchanged |
| `src/components/ui/toast.tsx` | Existing success/error feedback | Preserve behavior; no redesign |
| `src/components/admin/request-status-actions.tsx` | Existing busy flags and workflow calls | Visual consumer only where state is suitable |
| `src/hooks/use-households.ts`, `use-barangay-settings.ts` | Existing data/loading state | Consume through current screen contracts; do not modify fetching |

The request page owns server-rendered counts and filters, and its table refreshes through Realtime. These choices remain unchanged.

Before implementation, read applicable AGENTS.md files and their required versioned documentation. For Next.js APIs, use the installed guides under `node_modules/next/dist/docs/` rather than older examples.

## 3. Presentation architecture

| Situation | Existing state owner | UI addition |
|---|---|---|
| Link navigation before history updates | Next.js Link | Delayed inline pending marker |
| Route content suspends | Next.js loading/Suspense boundary | Content-shaped route skeleton |
| Client section is loading | Existing screen/hook | Local skeleton or loading hint |
| Action is busy | Existing handler/component | Spinner and pending label inside current button |

Visual components observe state. They do not start operations, infer completion from timers, or own data/mutation state.

No new provider, global loading counter, event bus, context store, or shared async taxonomy is needed. Keep root providers unchanged.

### Proposed files

- `src/components/loading/spinner.tsx`
- `src/components/loading/skeleton.tsx`
- `src/components/loading/page-skeleton.tsx`
- `src/components/loading/loading-button-content.tsx`
- `src/components/loading/loading-status.tsx`
- `src/components/navigation/link-pending-indicator.tsx`
- `src/app/(admin)/loading.tsx`
- Selected route-specific `loading.tsx` files where generic geometry is inaccurate.
- Optional `src/hooks/use-delayed-pending.ts`, only if CSS cannot provide the needed visual timing.

Prefer `LoadingButtonContent` inside existing buttons over a behavioral button wrapper. Preserve existing handlers, button types, disabled conditions, confirmation flow, and form semantics. Create only components and variants used by selected screens.

## 4. Component contracts

### Spinner

- Decorative indeterminate icon using existing Lucide icons or CSS.
- Fixed-size box with compact/button sizes; no adjacent text movement.
- Inherits theme color and is hidden from assistive technology.
- Uses a separate meaningful operation label; becomes static under reduced motion.

### Skeleton

- Shape-only primitive, hidden from assistive technology.
- Reuses existing shimmer styling where practical and becomes static under reduced motion.
- Approximates final geometry without duplicating every cell; three to six representative table rows are sufficient.
- Contains no fake data, percentages, counts, or interactive controls.

### PageSkeleton

- Start with table and dashboard variants; add form/detail variants only when used.
- Match actual destination width, heading, toolbar, summary cards, and content spacing.
- Respect padding already supplied by AdminShell; no duplicate shell or padding.
- Provide one concise loading announcement outside decorative shapes.
- Yield immediately to real content when the router provides it.

### LoadingButtonContent

- Receives existing pending state, ordinary content, and action-specific pending text.
- Renders presentation only; does not attach handlers or change disabled rules.
- Reserves the larger normal/pending width for text buttons.
- For icon-only buttons, replace or overlay the icon in its existing slot; do not widen the button or insert visible text.
- Expose exactly one accessible label at a time. Opacity alone does not hide inactive labels from assistive technology.
- Set `aria-busy` on the existing button where appropriate; preserve explicit icon-button names.
- Do not claim this component prevents duplicate submissions. Existing protections remain as implemented.
- Do not infer success from pending becoming false: failure also ends pending.

### LoadingStatus

- One concise polite loading announcement per operation or region.
- Avoid duplicate announcements from spinner, button, and containing section.
- Keep live regions mounted and update text where practical.
- Place loading announcements outside busy subtrees where necessary to avoid announcement deferral.
- No automatic focus movement, new toast lifecycle, or assertive loading announcements.

### Optional delayed-pending hook

- Exposes a display-only boolean after approximately 120ms of continuous pending state.
- Never delays requests, existing disabled state, ARIA busy state, or actual content.
- Resets immediately when pending ends; a subsequent operation receives a fresh delay.
- Cleans up timers on state change/unmount and imposes no minimum loader duration.
- Prefer CSS delay where it provides equivalent behavior.

## 5. Navigation loading behavior

Keep current Link elements, hrefs, prefetch defaults, active-route matching, titles, and keyboard/modifier-click behavior.

Add a descendant `LinkPendingIndicator` using `useLinkStatus` inside its owning Link. Do not introduce a custom router, clicked-route state, navigation locks, or queues.

### Expanded sidebar

- Reserve a small fixed-size trailing marker slot.
- Reveal the marker after the visual delay.
- Preserve active colors and label truncation.
- Keep every link interactive during navigation.

### Collapsed sidebar

- The existing sidebar is only 61px wide. Do not append another icon plus gap.
- Overlay a small marker on the existing icon slot or temporarily replace that icon.
- Preserve a stable accessible link name without visible text.
- Verify horizontal fit and focus-ring visibility.

### Router semantics and limitations

- Prefetched destinations may skip pending entirely; do not force an animation.
- `useLinkStatus` tracks pending before history updates, not completion of every streamed destination section.
- Keep active highlighting driven by existing `usePathname` logic; do not hold the old route active with custom state.
- Rapid navigation is handled by Next.js; observe its latest pending state.
- Back/forward navigation does not require a clicked-link marker.
- Add `(admin)/loading.tsx` for content below the existing admin layout. Applicable transitions preserve the shared shell.
- This boundary does not cover initial authentication/profile work in the parent layout. Accept and document this limitation; do not restructure authentication or root layout.
- Route fallbacks appear only when an applicable boundary suspends. Do not force them for every navigation, search update, or refresh.
- No page-exit orchestration, global progress bar, or route-wide fade effect.

## 6. Existing screen integration

### Initial loading

Use local skeletons only where existing state distinguishes first loading from available content. Keep surrounding layout stable.

An empty array is not proof that data has never loaded. If the current contract cannot distinguish loading, refresh, and valid empty results, preserve current content behavior and use only a truthful hint where possible.

### Background work

- Keep content visible where the current screen already retains it.
- Add a subtle local indicator instead of introducing content replacement.
- Do not modify fetch hooks, retain new snapshots, or introduce cache state.
- If existing code clears/unmounts content during refresh, document that limitation separately.

### Actions

- Map existing flags to loading presentation while preserving handlers and disabled expressions exactly.
- Do not extend/shorten pending lifecycle, add retries, or alter success/error branches.
- If a shared busy flag does not identify the active action, use one neutral group-level “Updating…” hint rather than labeling every action as running.
- Keep existing error/success feedback unchanged.

### Forms and dialogs

- Preserve field mounting, values, validation messages, dismissal, and focus behavior.
- Decorate the existing submit control or existing loading body.
- Do not add overlays, disable extra fields, or change focus traps.
- Preserve existing drawer/modal transitions and their presence hook.

### Uploads

- Decorate existing loading state only.
- Display real progress only if already available to the UI; otherwise use “Uploading…” with an indeterminate indicator.
- Do not invent stages, elapsed-time failure states, cancellation, or processing behavior.

## 7. Motion and accessibility rules

| Element | Treatment | Timing |
|---|---|---|
| Inline marker | Delayed reveal; optional opacity transition | About 120ms delay, 120–160ms reveal |
| Spinner | Subtle rotation while visible | One consistent shared duration |
| Skeleton | Existing subtle shimmer | Retain current 1.5s cycle unless visual review justifies adjustment |
| Ready content | Appears when available | No artificial delay or forced entrance animation |

- No minimum loading duration.
- Limit new transitions to opacity/transform; do not animate page height, table geometry, or width.
- Ensure nested transforms do not override spinner rotation.
- Stop shimmer/rotation under reduced motion while retaining text and static feedback.
- Scope CSS to loading components; avoid global animation resets affecting dialogs or other controls.
- Keep normal/pending dimensions stable and loading information understandable without color.
- Preserve keyboard behavior, accessible names, visible focus, and existing interaction rules.
- Verify light/dark themes and existing accent colors.

## 8. Execution phases

This section is the execution checklist for the implementation. Phases 1–3 are complete as recorded below; Phase 3's unavailable live authenticated/prefetch observations are documented as verification limitations. Phase 4 is complete with its production-prefetch runtime limitation recorded below. Phase 5 is complete based on the user's confirmation that the pilot was tested and works. Phase 6's inventory rollout and formal completion gate are complete; authenticated desktop visual review is recorded below, with mutation-backed pending states still unverified. Phase 7 is complete based on source review, prior fixtures, representative live review, and the user's confirmation that the remaining responsive, reduced-motion, screen-reader, theme, and operation-state checks work correctly. Phase 8 is complete: admin lint, typecheck, and production build passed, and the scope audit found no Phase 8 application-source changes. A follow-up authenticated runtime review was unavailable because the configured Supabase auth request failed; prior Phase 7 visual evidence remains recorded.

Phases 9–13 are follow-up work created from the subsequent read-only repository review. They do not retroactively invalidate historically accurate Phase 1–8 records. Follow-up records identify the repository revision and date they apply to so later evidence is not attributed to an earlier source state. Phase 10 was completed on 2026-09-27 against the Phase 9 baseline revision recorded below. Phase 11 was completed on 2026-09-27 against HEAD `d5f512a649e839fb066d07f6476b753399ed892c`, with Phase 10's existing uncommitted button-presentation changes preserved. An isolated responsive preview compared the corrected fallbacks with representative destination geometry at 390px, 1024px, and 1440px in both themes. Phase 12 was completed on 2026-09-27 against the same HEAD and the existing Phase 10–11 working-tree changes; lint, typecheck, and the production build passed, and focused source/browser evidence and unavailable checks are recorded below. Phase 13 was attempted on 2026-09-27 against that same revision and working-tree state, but is blocked because the production-mode login request cannot reach the configured Supabase auth service.

Execute phases in order. Completion gates are verification requirements, not additional user-approval steps. If a target requires prohibited changes, mark that target excluded with its reason and continue eligible frontend work. Do not mark an unverified gate as passed.

### Execution tracker

| Phase | Deliverable | Depends on | Status |
|---|---|---|---|
| 1 | Screen inventory and permitted file list | None | Complete |
| 2 | Shared visual primitives and motion rules | 1 | Complete |
| 3 | Route loading skeletons | 2 | Complete |
| 4 | Expanded/collapsed sidebar indicators | 2–3 | Complete |
| 5 | Verified button and section pilot | 2–4 | Complete |
| 6 | Inventory-based UI rollout | 5 | Complete |
| 7 | Accessibility and visual verification | 6 | Complete — remaining visual, motion, accessibility, theme, and operation-state checks were confirmed by the user and recorded in the Phase 7 evidence. |
| 8 | Build checks, scope audit, and handoff | 7 | Complete — lint, typecheck, production build, and Phase 8 delta audit passed; authenticated runtime follow-up unavailable due to Supabase connectivity. The delta audit is not a full Phase 1–8 source-range audit. |
| 9 | Re-establish the follow-up baseline and reconcile scope/evidence language | 8 | Complete — baseline and findings recorded at `d5f512a649e839fb066d07f6476b753399ed892c`; no application implementation files changed. |
| 10 | Correct shared text-button timing and wrapping | 9 | Complete — spinner delay restarts per pending interval; narrow confirmation wrapping and Cancel reachability verified in an isolated 360px preview. |
| 11 | Align route-fallback responsive geometry | 9 | Complete — dashboard fallback now matches the destination's `md` breakpoint; request-detail information cards match the destination's two-column layout at every tested width. Both fallback/ready pairs matched at 390px, 1024px, and 1440px in light and dark themes. |
| 12 | Run focused regression and completion checks | 10–11 | Complete — focused checks, lint, typecheck, production build, and scope audit recorded below; current dynamic browser re-observation limitations are labeled. |
| 13 | Verify authenticated production navigation and close the handoff | 12 | Blocked — an authenticated `localhost:3001` session supplied partial runtime evidence, but its mode was not confirmed as production; the separate production run on `localhost:3002` could not establish a fresh Supabase session, so production-prefetch evidence remains unavailable. |

For each phase, record changed files, checks performed, results, and exclusions in the execution record at the end of this section. Use `Not started`, `In progress`, `Complete`, or `Blocked` when updating status; a blocked entry must explain the missing evidence or dependency.

### Phase 1 — Inventory existing UI and establish the boundary

**Purpose:** Identify exact integration points before changing application code.

**Work area:** Read-only inspection of admin components, screens, styles, and applicable repository instructions; documentation updates in this plan.

**Historical baseline note:** The inventory and absence statements below describe Phase 1, before Phases 2–4 added the shared loading visuals, route fallbacks, navigation indicators, and loading-specific reduced-motion rules. They are historical observations, not descriptions of the current tree. See the Phase 2–4 outcomes and the Phase 9 current-source review; the parent-layout authentication limitation remains applicable.

- [x] Read applicable AGENTS.md files and required versioned documentation before implementation. Read repository-root and `apps/admin-web/AGENTS.md`; opened the exact Expo SDK 57.0.0 reference required by the root instruction and the installed Next.js 16.3.0 `useLinkStatus` and `loading.tsx` guides referenced by this plan.
- [x] Inspect the working tree and record pre-existing changes so later verification distinguishes this work from unrelated edits. At the Phase 1 baseline, the plan itself was already modified (`344` insertions and `994` deletions against `HEAD`), and `.claude/settings.local.json` was untracked. No application source files were modified; preserve both existing user changes.
- [x] Inventory admin navigation destinations and their current page geometry.
- [x] Identify buttons and sections already exposing loading state; record the exact variable, owning component, and current disabled expression below.
- [x] Record whether each section distinguishes initial loading, refresh, and an empty result without introducing new operational state.
- [x] Select one text-button action and one local loading section for the pilot. Prefer reliable existing states; do not choose a target requiring a handler repair.
- [x] List the exact frontend files permitted for this rollout. Shared hooks that own fetching, layouts that own authentication, server actions, and backend files remain excluded.
- [x] Check for representative normal/loading appearances, theme rules, and collapsed-sidebar dimensions. Source geometry and theme rules were inspected; an authenticated browser capture was unavailable because there was no open app tab/session and admin routes are auth-gated.

**Navigation and page geometry inventory** (paths are relative to `apps/admin-web`):

| Destination | Page component | Current geometry |
|---|---|---|
| `/dashboard` | `src/app/(admin)/dashboard/page.tsx` | Heading and KPI row; needs-attention panel; two recent-data panels in a two-column grid; trend section. Existing independent Suspense fallbacks for KPI and recent-data regions. |
| `/services` | `src/app/(admin)/services/page.tsx` | Add-document-type form card followed by existing document-type catalog. |
| `/announcements` | `src/app/(admin)/announcements/page.tsx` | New-announcement form card followed by published announcement catalog/rows. |
| `/requests` | `src/app/(admin)/requests/page.tsx` | Server-rendered counts and filters above a searchable request table; rows link to detail. The table refreshes through its existing Realtime subscription. |
| `/transactions` | `src/app/(admin)/transactions/page.tsx` | Financial summary cards, filters/search, add-transaction form, and transactions table. |
| `/residents` | `src/app/(admin)/residents/page.tsx` | Summary cards and resident-directory filters/actions/table, with resident detail content. |
| `/incident-reports` | `src/app/(admin)/incident-reports/page.tsx` | Summary cards, incident create controls, and report table/actions/details. |
| `/incident-map` | `src/app/(admin)/incident-map/page.tsx` | Map-dominant canvas with floating search, segment toggle, and category-filter pills. |
| `/health` | `src/app/(admin)/health/page.tsx` | Summary cards and filterable drive table, with add/detail dialogs. |
| `/health/applicants` | `src/app/(admin)/health/applicants/page.tsx` | Summary cards, filters/search, applicants table, and add/detail dialogs. |
| `/waste-management` | `src/app/(admin)/waste-management/page.tsx` | Zone and schedule creation cards; collection zones/schedules catalog; illegal-dumping report table. |
| `/hub` | `src/app/(admin)/hub/page.tsx` | Emergency-entry form card followed by published emergency catalog. |
| `/evacuation-centers` | `src/app/(admin)/evacuation-centers/page.tsx` | New-center form card followed by all-centers catalog. |
| `/emergency-qr` | `src/app/(admin)/emergency-qr/page.tsx` | Instructions/QR tabs with instructional content, QR display, and instruction editor modal. |
| `/households-residents` | `src/app/(admin)/households-residents/page.tsx` | Summary cards, tabs/filter/search, and a wide resizable table (`tableMinWidth={1280}`) with member dialogs. |
| `/staff` | `src/app/(admin)/staff/page.tsx` | Staff/account heading, invite action, and staff table. |
| `/faq` | `src/app/(admin)/faq/page.tsx` | Publish-article form card followed by FAQ list and editable rows. |
| `/terms-privacy` | `src/app/(admin)/terms-privacy/page.tsx` | Section selector and content editor/preview. |
| `/about-us` | `src/app/(admin)/about-us/page.tsx` | About/developer content editor with logo selection and optional preview. |
| `/settings` | `src/app/(admin)/settings/page.tsx` | Heading/description and a form card containing contact, hours, feature, and audit-preference sections. |
| `/theme` | `src/app/(admin)/theme/page.tsx` | Theme, accent-color, and font customization controls. |
| `/requests/[requestId]` (in-app detail route) | `src/app/(admin)/requests/[requestId]/page.tsx` | Request heading/status/actions; resident, payment, requirements, purpose, and status-history sections. |

The shell gives the main region `p-8` (32px) and horizontal scrolling. `sidebar-nav.tsx` uses 285px expanded and 61px collapsed widths; links are 49px tall. The shared stylesheet has an existing 1.5s shimmer and light/dark theme tokens (`--accent: #0f6e5b`); no loading-specific reduced-motion rule was found. Existing drawer/modal transitions do use `motion-reduce:transition-none` and `useMountTransition`; preserve that lifecycle and styling. No `loading.tsx` exists under the admin route tree, and no current sidebar link uses `useLinkStatus`.

**Existing loading sections and lifecycle**

| Surface / component | Existing state owner and current presentation | Initial / refresh / empty behavior and eligibility | Phase 6 outcome |
|---|---|---|
| Dashboard data panels | `src/app/(admin)/dashboard/page.tsx` owns Suspense boundaries: `KpiCards` uses `KpiSkeleton`; `RecentRequests` and `RecentTransactions` use `TableSkeleton`; needs-attention and trends use `fallback={null}`. | Suspense is the truthful pending source. Resolved components own their real/empty content. These fallbacks are already local; preserve their queries and boundaries. | Retained unchanged; existing local Suspense fallbacks are already truthful. |
| Settings form (selected section pilot) | `src/app/(admin)/settings/settings-form.tsx` consumes `loading`, `settings`, `error`, and `saving` from `src/hooks/use-barangay-settings.ts`. While `loading`, it replaces the form body with “Loading settings…”. | `settings === null` plus `error` renders the existing error/retry branch; absent or invalid `config` is normalized to default settings, not an empty-result state. There is one `loading` flag, not separate initial/refresh flags; refetch would replace the form, though the current form only loads on mount. Keep the hook unchanged. | Migrated in Phase 5; local branch now uses the existing spinner/status presentation. Hook and branch lifecycle unchanged. |
| Settings save button (selected action pilot) | `saving` is owned by `useBarangaySettings`; the “Save Settings” label becomes “Saving…”. | Save and Cancel both currently use `disabled={saving}`. The flag clears when the save request returns, before the caller's `router.refresh()` completes; exceptional thrown failures can leave it set. Bind presentation only and retain this lifecycle limitation. | Migrated in Phase 5; existing `saving` state, labels, and disabled rules preserved. |
| Persistent header notification menu | `src/components/admin/header.tsx` consumes `notifLoading` from `useAdminAuditNotifications` (`src/hooks/use-admin-audit-notifications.ts`) and displays “Loading…” in the menu. | One flag covers initial fetch and refetch. The hook retains prior rows on refetch, but the menu's loading branch replaces them while the flag is true. No distinct empty state is owned by the loader; normal empty content follows loading. Hook excluded. | Migrated; “Loading notifications…” status with spinner uses `notifLoading`; hook and replacement behavior unchanged. |
| Notification drawer | `src/components/admin/notifications-drawer.tsx` consumes `loading`, `loadingMore`, `error`, and notifications from `useAuditLogBrowser` (`src/hooks/use-audit-log-browser.ts`). It branches error → loading → empty → rows; “Load more” uses `disabled={loadingMore}` and switches to “Loading…”. | Reset/filter fetch clears rows and shares the same `loading` flag; `loadingMore` is separate. Empty results and returned errors are distinguishable, but initial and reset fetches are not. Existing content replacement stays unchanged. Hooks excluded. | Migrated; local loading status and Load more button use the existing flags; hooks and current content replacement unchanged. |
| Resident request history in detail modal | `src/app/(admin)/residents/resident-directory.tsx` owns `requests: ServiceRequest[] | null`; `null` renders “Loading…”, `[]` renders “No service requests yet.” | Initial load and resident changes reset to `null`; there is no error branch on the request promise, so a rejected fetch can remain “Loading…” indefinitely. Do not select for the pilot or add recovery state. | Excluded per Phase 1 boundary; no request-history presentation or error lifecycle changes. |
| Incident-map filter pills | `src/app/(admin)/incident-map/MapFilterPills.tsx` accepts optional `loading` and renders three pulse pills. | The `MapCanvas` call site does not pass `loading`; this is dormant markup without an active state source. Exclude it; do not connect a new flag. | Excluded; dormant prop has no active state source. |
| Households hook | `src/hooks/use-households.ts` defines `loading`, `data`, and `error`. | Repository search found no import/call site for `useHouseholds`; the current route is server-rendered and its table refreshes through Realtime. This hook is not a current screen state source and is excluded. | Excluded; unused hook remains unchanged. |
| Route-level loading | No admin `loading.tsx` files or current `useLinkStatus` consumer were found. `(admin)/layout.tsx` awaits authentication and profile data before rendering `AdminShell`. | A child loading boundary will not cover the parent layout's auth/profile wait. Existing server pages, URL filters, requests, and refresh behavior remain unchanged. | Migrated in Phase 3; route fallbacks and shell/auth boundary unchanged in Phase 6. |

**Existing action pending states and exact disabled rules**

Paths below are relative to `apps/admin-web`. In grouped route-component cells, subsequent abbreviated paths reuse the `src/app/(admin)/` prefix unless they explicitly begin with `src/components/`. Unless stated otherwise, `submitting`, `saving`, `busy`, `removing`, and `toggling` are local booleans owned by the named component.

| Component path(s) | Existing state | Current disabled expression / presentation | Phase 6 outcome |
|---|---|---|---|
| `src/app/(admin)/about-us/about-us-form.tsx`; `announcements/announcement-form.tsx`; `evacuation-centers/evacuation-center-form.tsx`; `faq/faq-form.tsx`; `hub/emergency-form.tsx`; `services/document-type-form.tsx`; `staff/staff-form.tsx`; `terms-privacy/content-form.tsx`; `waste-management/schedule-form.tsx`; `waste-management/zone-form.tsx` | Each form owns `submitting`. | Primary submit uses `disabled={submitting \|\| !barangayId}`. Pending labels vary by action; `staff-form.tsx` also disables its close button with `disabled={submitting}`. | Migrated with `LoadingButtonContent` and button `aria-busy`; handlers, validation, close behavior, and disabled expressions retained. |
| `src/app/(admin)/health/drive-table.tsx`; `incident-reports/incident-table.tsx` | Each form owns `submitting`. | Create button uses `disabled={submitting \|\| !title.trim()}`. | Migrated; existing create labels/state and disabled expressions retained. |
| `src/app/(admin)/health/applicants/applicants-table.tsx` | Add form owns `submitting`. | Register button uses `disabled={submitting \|\| !driveId \|\| !residentId}`. | Migrated; existing register state and disabled expression retained. |
| `src/app/(admin)/households-residents/households-table.tsx` | Add-member form owns `submitting`; inline removal owns `removing`. | Add button: `disabled={submitting \|\| !profileId \|\| !name.trim()}`. Removal confirmation: `disabled={removing}`. | Migrated; add and removal buttons receive pending content/ARIA from existing states; existing disabled rules retained. |
| `src/app/(admin)/requests/requests-table.tsx` | Add-request form owns `submitting`. | Create button uses `disabled={submitting \|\| !residentId \|\| !documentTypeId}`. | Migrated; existing create state and disabled expression retained. |
| `src/app/(admin)/residents/resident-directory.tsx` | Invite form owns `submitting`; ID status actions own `idStatusLoading`. | Invite: `disabled={submitting \|\| !email.trim() \|\| !fullName.trim()}`. Verified/failed actions: `disabled={idStatusLoading \|\| !idUrls.length}`. Reset/revoke/clear actions: `disabled={idStatusLoading}`. | Migrated; invite and ID status actions use their existing states, with neutral ID status feedback; all disabled rules retained. |
| `src/app/(admin)/announcements/announcement-row.tsx`; `evacuation-centers/evacuation-center-row.tsx`; `faq/faq-row.tsx`; `services/document-type-row.tsx`; `waste-management/schedule-row.tsx`; `waste-management/zone-row.tsx` | Each edit row owns `submitting`. | Save and Cancel buttons both use `disabled={submitting}` and the submit label becomes “Saving…”. `services/document-type-row.tsx` separately owns `toggling`; its activation button uses `disabled={toggling}`. | Migrated; existing save/toggle flags render pending labels; save/cancel/toggle disabled rules retained. |
| `src/app/(admin)/emergency-qr/qr-instructions-modal.tsx`; `households-residents/member-form-modal.tsx`; `transactions/transactions-table.tsx` | Each owns `submitting`. | Save/Add button uses `disabled={submitting}` and its existing action label changes while pending. The instruction modal also disables Cancel with `disabled={submitting}`. | Migrated; existing modal/form pending labels and disabled rules retained. |
| `src/app/(admin)/health/drive-detail-modal.tsx`; `health/applicants/applicant-detail-modal.tsx`; `incident-reports/incident-detail-modal.tsx`; `settings/settings-form.tsx` | Each owner exposes `saving` (Settings receives it from its hook). | Save and Cancel use `disabled={saving}`; Save text changes to “Saving…”. | Migrated; Settings was completed in Phase 5 and the three detail-save buttons in Phase 6; existing saving flags and disabled rules retained. |
| `src/components/admin/request-status-actions.tsx` | One shared local `busy` for the action group. | Each status action uses `disabled={busy}`; cancel confirmation uses `disabled={busy \|\| !cancelNote.trim()}`. The state does not identify which action is running; use only neutral group feedback if integrated. | Migrated with neutral “Updating request…” group status; individual actions and disabled expressions unchanged. |
| `src/app/(admin)/incident-reports/incident-actions.tsx` | One shared local `busy` for the action group. | The four action buttons use `disabled={busy}`. The flag does not identify the active action; use only neutral group feedback if integrated. | Migrated with neutral “Updating incident…” group status; individual actions and disabled expressions unchanged. |
| `src/components/admin/confirm-button.tsx` | `ConfirmButton` owns internal `busy`. | Its confirm and cancel buttons use `disabled={busy}`; the confirm text currently becomes `…`. The initial action button uses its existing caller-supplied `disabled` prop. | Migrated; confirmation uses “Working…” content and `aria-busy`; trigger props, confirm/cancel handlers, and disabled rules unchanged. No separate pending icon-only trigger state exists in this inventory. |
| `src/components/admin/editable-data-table.tsx` | Generic editor owns `saving`. | Active editor input uses `disabled={saving}` and `aria-busy={saving}`; another edit input uses `disabled={saving}`; current inline status is “Saving…”. | Migrated; existing inline status now includes a decorative spinner; editor lifecycle unchanged. |
| `src/components/admin/notifications-drawer.tsx` | Hook-owned `loadingMore`. | Load more uses `disabled={loadingMore}`; current label becomes “Loading…”. | Migrated; existing flag now drives `LoadingButtonContent` and `aria-busy`. |
| `src/app/(admin)/transactions/transactions-table.tsx` | Add form also owns `lookupState: 'idle' | 'loading' | 'found' | 'not_found'`. | Resident/document lookup shows “Looking up…” while loading; no additional disabled condition is attached to that display state. | Migrated; the existing lookup state gets one local spinner/status, and its existing result behavior remains unchanged. |

No dedicated upload-progress or `uploading` flag was found in the admin UI. The About Us logo flow shares its existing `submitting` flag; do not invent a progress value or stage.

**Selected pilot surfaces**

- Text-button action: `src/app/(admin)/settings/settings-form.tsx` — decorate the existing “Save Settings” button from hook-owned `saving`; preserve both existing `disabled={saving}` expressions, the submit handler, validation, toast/error behavior, and `router.refresh()` call exactly.
- Local loading section: `src/app/(admin)/settings/settings-form.tsx` — replace only the presentation of its existing “Loading settings…” state using hook-owned `loading`; preserve the current error and loaded form branches. No change to `src/hooks/use-barangay-settings.ts`.
- These sources are truthful and independent of any handler repair. The existing save-flag timing and no-separate-refresh-state behavior above remain documented limitations.

**Exact frontend file boundary for later phases**

Only these frontend files are in the Phase 1 candidate set; modifying them is not part of Phase 1. Existing UI consumer files are the named paths in the action inventory above, plus `src/components/admin/header.tsx` and `src/components/admin/notifications-drawer.tsx` for their current notification states. Shared files selected by the plan are:

- New: `src/components/loading/spinner.tsx`, `skeleton.tsx`, `page-skeleton.tsx`, `loading-button-content.tsx`, `loading-status.tsx`.
- New: `src/components/navigation/link-pending-indicator.tsx`.
- New route fallbacks: `src/app/(admin)/loading.tsx`, `src/app/(admin)/dashboard/loading.tsx`, `src/app/(admin)/incident-map/loading.tsx`, `src/app/(admin)/emergency-qr/loading.tsx`, `src/app/(admin)/requests/[requestId]/loading.tsx`, and `src/app/(admin)/settings/loading.tsx`. The latter four match the map, QR, detail, and long-form settings geometry recorded above; remaining routes use the generic fallback unless later visual evidence shows a material mismatch.
- Existing presentation files: `src/app/globals.css` (scoped loading styles only) and `src/components/admin/sidebar-nav.tsx` (pending marker only).
- Existing loading/action UI files: precisely the eligible component paths named in the action inventory table above. `MapFilterPills.tsx`, the resident request-history fetch display, and unused `use-households.ts` are excluded for the reasons recorded above.
- No delayed-pending hook is selected in Phase 1; prefer CSS delay. If later evidence shows CSS is insufficient, update the file boundary before adding a display-only timer.

Out of boundary: all hooks and files owning fetching/state lifecycle; `admin-shell.tsx` and `(admin)/layout.tsx` (shell/auth); server actions; route handlers/APIs; schemas/database/generated types; package manifests/lockfiles; payment/workflow logic; login, resident-facing routes, resident web/mobile apps; toast lifecycle; and every file not named in the permitted set above.

**Visual evidence and source review**

No live admin screenshot was available: the in-app browser had no open tabs, and the admin shell is only rendered after authentication/profile checks. Therefore no normal/loading screenshot is claimed. Code-level appearance evidence is the 32px main padding, 285px/61px sidebar widths and 49px link height, existing light/dark classes, `--accent: #0f6e5b`, and existing 1.5s shimmer. Loading-specific reduced-motion styling is absent today; existing drawer/modal reduced-motion handling remains in place. Do not treat this source review as visual QA for later phases.

**Deliverable:** A populated inventory and explicit list of selected frontend files, recorded in this plan.

**Completion gate:** Every selected surface has a truthful existing state source and a presentation-only integration path. Unsupported surfaces are identified rather than silently included. Met for the Settings pilot; exclusions and unavailable visual evidence are recorded above.

### Phase 2 — Build shared loading visuals

**Purpose:** Establish reusable presentation without introducing operation ownership.

**Work area:** `src/components/loading/`, scoped additions to `src/app/globals.css`, and the optional display-delay hook specified in section 3.

- [x] Implement decorative Spinner and Skeleton components using existing dependencies and theme styles.
- [x] Implement LoadingButtonContent for text and fixed-size icon controls, preserving normal/pending dimensions.
- [x] Implement LoadingStatus with one polite announcement and no duplicate accessible labels.
- [x] Implement PageSkeleton compositions needed for the inventoried table/dashboard layouts.
- [x] Add approximately 120ms visual delay for compact indicators; CSS provides the delay.
- [x] No delay hook is needed: the CSS delay hides short-lived indicators and adds no JavaScript timer.
- [x] Add scoped reduced-motion styling without touching existing drawer/modal lifecycle logic.
- [x] Check fast completion, long labels, static reduced-motion feedback, and light/dark appearance using isolated UI states. An 80ms preview state returned to its normal label before the 120ms indicator reveal; long normal/pending labels fit without clipping; the accessibility tree exposed one active name per button and one status per skeleton; table and dashboard variants were visually checked in light and dark themes; static feedback was inspected against the reduced-motion CSS rule.

**Deliverable:** Shared visual components meeting section 4's contracts, with no provider or new dependency.

**Completion gate:** Components render solely from supplied presentation state, do not invoke operations, do not alter disabled rules, and introduce no label duplication or layout shift.

### Phase 3 — Add content-shaped route fallbacks

**Purpose:** Show meaningful skeletons when existing route boundaries suspend.

**Work area:** New `src/app/(admin)/loading.tsx`, selected child-route `loading.tsx` files, and PageSkeleton composition.

- [x] Add the generic admin fallback inside the current shell hierarchy.
- [x] Add the dashboard fallback matching its actual cards/content geometry.
- [x] Add other route-specific variants only when the inventory shows a material geometry mismatch: incident map, emergency QR, request detail, and settings.
- [x] Preserve AdminShell padding and content sizing; avoid nested shell/header/sidebar duplicates.
- [x] Verify loading shapes are decorative and there is one meaningful region announcement. All six variants were rendered in an isolated preview; each accessibility snapshot exposed its single loading message, and the skeleton primitives are `aria-hidden`.
- [x] Verify ready content appears immediately; do not insert page fade delays. Next.js's installed loading convention documents replacement when route content is ready; the new fallbacks add no entrance transition or timer.
- [x] Verify slow-route display and review the cached/prefetch contract without changing server fetches or adding an application delay. An isolated slow segment showed its fallback during suspension and ready content after resolution. Installed Next.js documentation confirms automatic Link prefetch is production-only; the development server cannot runtime-check that path. The authenticated admin route was also unavailable because the local Supabase proxy request failed; see the execution record.
- [x] Record the initial parent-layout authentication wait as outside these fallback boundaries. `(admin)/layout.tsx` awaits auth/profile data before rendering AdminShell, and the installed loading guide confirms same-segment loading UI does not wrap its layout.

**Deliverable:** Route loading UI for selected admin destinations, with existing page and layout logic unchanged.

**Completion gate:** Applicable fallbacks preserve the shell and match destination geometry. Instant routes remain instant; no fallback is forced for refreshes or search updates.

### Phase 4 — Add sidebar pending indicators

**Purpose:** Provide local feedback while Next.js reports a clicked link as pending.

**Work area:** `src/components/navigation/link-pending-indicator.tsx`, visual integration in `src/components/admin/sidebar-nav.tsx`, and scoped indicator styles.

- [x] Render the indicator as a descendant of its existing Link using `useLinkStatus`.
- [x] Reserve a trailing slot for expanded navigation without changing hrefs, prefetch defaults, or active matching.
- [x] Overlay the marker in the current icon slot for collapsed navigation; do not append another icon/gap inside the 61px sidebar.
- [x] Preserve a stable accessible link name when text is collapsed with an explicit `aria-label`; the browser accessibility tree retained each link name.
- [x] Keep keyboard navigation, modifier-click, existing titles, focus rings, and all links interactive. Tab navigation and visible focus were observed; Link elements and props remain native and no click interception or disabled state was added.
- [x] Verify rapid destination changes and browser back/forward in an isolated preview. A slow-to-fast sequence settled on the latest destination, and history navigation showed no stale marker.
- [x] Review the fully-prefetched contract in the installed Next.js guide and source: prefetched links skip `pending`, while existing Link prefetch defaults remain unchanged. Production runtime observation is unavailable in this phase because prefetch is production-only and Phase 8 build work remains out of scope.
- [x] Confirm active highlighting still follows the existing pathname behavior; the `usePathname` matching expression is unchanged and no custom route state was added.

**Deliverable:** Consistent expanded/collapsed link feedback driven only by router state.

**Completion gate:** No sidebar overflow, stale custom pending marker, navigation lock, new navigation call, or changed active-route rule.

### Phase 5 — Integrate a small presentation pilot

**Purpose:** Prove that shared visuals can be adopted without changing application behavior.

**Work area:** Only the two pilot surfaces selected in Phase 1, plus visual component adjustments if needed.

- [x] Replace the pilot button's loading content while leaving its handler, type, disabled expression, and confirmation behavior unchanged. `LoadingButtonContent` now renders the existing `saving` state inside the existing Save button; `aria-busy` reflects that same flag.
- [x] Connect the pilot section to a subtle loading hint using only existing state. The existing `loading` branch now presents the shared spinner and one polite status announcement.
- [x] Preserve current empty/error rendering and all form values, dismissal, and focus behavior. The source diff is limited to loading presentation and the Save button's content/ARIA state.
- [x] For a shared busy flag, use neutral group-level feedback unless existing state identifies the active action. Not applicable: the selected `saving` flag belongs specifically to the Settings Save action.
- [x] Verify normal, fast, slow, and failure visual states through existing safe flows or isolated UI mocks. The user confirmed testing the pilot and that it works; the agent could not independently observe the local preview because of the browser URL policy.
- [x] Inspect handler/data-operation diffs and compare request behavior where safely observable: no added calls, changed payloads, or changed refresh/subscription logic. Source review confirms the submit handler, validation, hook call, and `router.refresh()` are unchanged; no runtime save/request was invoked.
- [x] Record any state-lifecycle limitation; exclude an unsuitable target instead of repairing its handler. `saving` still clears when the save request returns, before `router.refresh()` completes, and an unexpected thrown failure may leave it set.

**Deliverable:** One verified action integration and one verified local loading integration, with before/after observations.

**Completion gate:** The presentation changes pass the pilot checks with identical operational behavior. Do not expand rollout until any visual defects are resolved.

Service-request workflow changes are never a prerequisite. Request-status buttons may consume these components only where their existing state is sufficient; no optimistic updates or handler cleanup are authorized.

### Phase 6 — Roll out to inventoried frontend surfaces

**Purpose:** Apply the proven visual pattern in small, reviewable groups.

**Work area:** Eligible UI files explicitly recorded during Phase 1.

- [x] Migrate text-button feedback first, then icon-only controls, then local section placeholders. Text actions and shared busy groups were migrated using existing flags; the Phase 1 inventory contains no independently busy icon-only action trigger. Local header, drawer, editor, and lookup states were updated after action buttons.
- [x] Reuse existing pending labels where accurate and use action-specific wording where needed (`Saving…`, `Working…`, “Updating request/incident,” and existing context-specific pending text).
- [x] Decorate existing form/dialog submit controls without changing field disabling, dismissal, or focus management. Existing handlers, disabled expressions, validation, and modal controls were retained.
- [x] Decorate upload state only where already available; no invented percentage or processing stage. The About Us logo flow shares its existing form `submitting` state; there is no dedicated upload-progress flag.
- [x] Keep already-visible data where existing screen behavior retains it; do not add snapshots or refactor fetching. Existing menu/drawer replacement behavior was preserved as inventoried.
- [x] Inspect the diff after each integration group. Source review confirms the migrated changes are limited to loading presentation and related accessibility attributes; operation logic is unchanged.
- [ ] Visually check each distinct layout. Phase 6 agent-observed evidence is partial: authenticated dark-theme desktop layouts were inspected on the dashboard, announcement form, request list/detail, notification menu/drawer, and transaction list/add form. The drawer's existing Load more fetch visibly changed to a disabled “Loading…” control and returned to normal after resolving. Mutation-backed submit/edit/status/invite/transaction pending states were not triggered. Phase 7 later added representative review and recorded user confirmation for remaining layouts and states, but that evidence does not turn this Phase 6 full-review item into a complete agent-observed sweep; see the Phase 6 and Phase 7 execution records and Section 9.
- [x] Remove redundant loading markup only from migrated surfaces; leave unrelated components unchanged. Replaced labels/status text only where listed; unrelated loading surfaces and hooks remain unchanged.
- [x] Update each inventory row as migrated, excluded with reason, or still pending. Outcomes are recorded in both the existing-loading-sections and action-pending-state inventories above; no eligible inventoried action remains pending.

**Deliverable:** Consistent loading presentation across the selected inventory, with no hidden expansion into data/workflow work.

**Completion gate:** Every inventory row has a recorded outcome. Each migrated surface uses an existing state source and preserves its operation semantics.

### Phase 7 — Verify motion, accessibility, and visual consistency

**Purpose:** Validate the integrated experience against section 9.

**Work area:** Existing changed UI and scoped CSS only; no new behavior or dependencies.

- [x] Check all migrated surfaces in light/dark themes and the existing accent styling. The authenticated review covered the dashboard in both themes and the migrated list, form, table, preview, and settings surfaces; the green accent and theme-aware shared surfaces remained legible. The user confirmed the remaining migrated surfaces also work correctly in both themes.
- [x] Check representative narrow/wide viewports, expanded/collapsed navigation, and text wrapping. The available desktop review confirmed expanded and 61px collapsed navigation fit, and the user confirmed the narrow/wide viewport layouts and text wrapping work correctly. Phase 2's long pending-label preview and Phase 4's sidebar preview remain supporting evidence. The pre-existing Settings horizontal overflow remains recorded as unrelated to loading presentation.
- [x] Verify reduced motion leaves informative static indicators and readable labels. Source review and Phase 2's static preview confirmed the scoped `prefers-reduced-motion` treatment; the user confirmed the integrated reduced-motion presentation is static, informative, and readable.
- [x] Verify keyboard operation, visible focus, stable accessible names, and non-duplicated loading announcements. The live dashboard review showed visible Tab focus and stable link/page names; Phase 2/3 snapshots and Phase 4 checks covered button names, route status, and collapsed-link names. The user confirmed the integrated keyboard, screen-reader, and announcement behavior works correctly.
- [x] Check no label/spinner appearance shifts buttons, rows, toolbars, or sidebar width. Reviewed layouts retained stable geometry through the observed skeleton-to-content transitions, and the user confirmed the remaining loading labels, spinners, rows, toolbars, and sidebar states remain stable across the required layouts.
- [x] Verify indicator removal when pending ends and timer cleanup when a component unmounts. Source review confirms no display-delay hook or JavaScript visual timer was added: link indicators are driven by `useLinkStatus`, and their spinner nodes are conditional on current pending state. Phase 4's rapid-navigation fixture recorded no stale marker. There is no new visual timer requiring cleanup.
- [x] Check fast completion does not flash and slow work does not trigger fake completion. Phase 2 recorded an 80ms fixture completing before the 120ms indicator reveal; Phase 3 recorded a 12-second suspended route showing its fallback until content resolved; Phase 4 recorded a slow-to-fast navigation; and Phase 6 visibly checked the notification drawer's existing Load more state through resolution. Mutation-backed pending states were not invoked, and no minimum duration or timer-based completion was introduced.
- [x] Record actual evidence for each applicable verification-matrix row, including any checks that could not be performed. The Phase 7 evidence column in section 9 records prior observations, this source review, and unavailable checks individually.

**Deliverable:** Recorded visual/accessibility results and corrected presentation defects.

No loading-presentation defect was confirmed from source review, prior fixtures, representative live review, or the user's verification, so no admin implementation file was changed. The authenticated review observed the dashboard's existing initial skeletons resolve to content and the Settings page's existing “Loading settings…” state resolve to its form. A pre-existing Settings layout overflow at the available desktop width was observed but left unchanged because it is unrelated to loading presentation. The Phase 7 visual/accessibility matrix is complete based on the recorded evidence and user confirmation.

**Completion gate:** Applicable checks pass, or remaining verification blockers are explicitly recorded without claiming completion. Existing lifecycle defects remain documented limitations, not animation fixes.

Evidence attribution for this phase remains distinct: direct observations name the reviewed surface and phase; user-confirmed checks are attributed to the user; source review is not runtime evidence; and unavailable or unobserved checks remain explicitly unverified. The Phase 6 full visual-review item above remains unchecked.

### Phase 8 — Run final checks and audit frontend-only scope

**Purpose:** Make the final change reviewable and demonstrate that the scope boundary held.

**Work area:** Verification and this plan's execution record. Fixes are limited to defects introduced in permitted UI files.

- [x] Run relevant admin lint, typecheck, and production build checks using existing project scripts. `npm run lint --workspace=@barangayan/web`, `npm run typecheck --workspace=@barangayan/web`, and `npm run build --workspace=@barangayan/web` all passed.
- [x] Distinguish newly introduced failures from pre-existing failures or unavailable environment requirements. The first build attempt could not fetch the existing Geist and Geist Mono imports from Google Fonts under the restricted network; the same production build was rerun with network access and passed. The served app's Supabase auth fetch remains unreachable and prevented authenticated runtime review; it is not a lint, typecheck, or production-build failure.
- [x] Inspect the Phase 8 working-tree delta and preserve unrelated user changes. Phase 8 changed only this execution record; the pre-existing resident Android payment/map/hook edits, Supabase payment function edit, resident iOS plan/project and migration, and local settings file remain untouched. This no-source-change result applies only to the Phase 8 delta; it does not establish a full Phase 1–8 source-range audit. Phase 9 records the repository revisions and whether a broader audit is evidenced.
- [x] Confirm package manifests/lockfiles, database files, APIs, server actions, auth logic, data hooks, and other applications were not changed by this work. The Phase 8 diff contains no application source change; the existing working-tree edits in those areas are unrelated pre-existing changes recorded above.
- [x] Confirm no handler, query, subscription, request payload, refresh call, validation rule, or disabled condition changed. No application file changed in Phase 8; the prior Phase 5–7 source audits documented these contracts unchanged across the loading integrations. The follow-up runtime session did not submit credentials or invoke any application data/action flow.
- [x] Confirm no new global provider, overlay, operation timer, fake progress, or mutation state system was introduced. Source review confirms the shared visuals use existing operation flags and Next.js link status, CSS delay, and route fallbacks; no provider, JS timer, fake progress, or mutation state system is present.
- [x] Update the tracker and execution record with final outcomes and limitations.
- [x] Provide a concise handoff listing migrated surfaces, validation results, and remaining exclusions.

**Deliverable:** Verified frontend-only implementation and completed execution record in this document.

**Completion gate:** Section 10's definition of done is satisfied for the selected inventory, and the Phase 8 verification delta contains no prohibited change. This gate does not establish a full Phase 1–8 revision-range audit; see the Phase 9 record. An environmental verification blocker is reported honestly and does not count as a passing check.

### Phase 9 — Re-establish the follow-up baseline and reconcile the review record

**Purpose:** Freeze the source state to which the follow-up applies, resolve ambiguous scope wording, and separate historical evidence from current verification before any implementation changes.

**Work area:** Read-only repository inspection and this plan. No application implementation file changes in this phase.

- [x] Read the root and `apps/admin-web/AGENTS.md` instructions, the exact Expo SDK 57.0.0 reference required by the root instruction, and the installed Next.js 16.3 loading, Link, and `useLinkStatus` guides relevant to the follow-up. Read both AGENTS files; opened `https://docs.expo.dev/versions/v57.0.0/` and the installed `loading.md`, `02-components/link.md`, and `use-link-status.md` guides under `node_modules/next/dist/docs/`.
- [x] Record the exact starting Git revision, current working-tree status, and unrelated changes. Preserve all existing user work and identify whether any follow-up target has changed since the read-only review. Phase 9 source revision: `d5f512a649e839fb066d07f6476b753399ed892c`. The Phase 9 status snapshot on September 25 included the modified Resident Android payment/map files, `package-lock.json`, this already-modified plan, the Resident iOS plan, and the Supabase payment function, plus local settings, the Resident iOS project/ledger, and a migration. On September 27, the working tree also reports a modified `.gitignore` and additional untracked files under the Resident iOS project. All are outside this phase and preserved. The three expected follow-up source files are clean against the recorded revision. The earlier read-only review did not record its own revision, so changes since that review cannot be asserted; findings below are reproduced against the Phase 9 revision.
- [x] Confirm the two shared-button findings against the current source: the text-mode spinner's reveal timing must start with each pending interval, and long confirmation labels must be allowed to fit narrow containers. In `loading-button-content.tsx`, the text-mode spinner remains mounted inside the visually hidden pending label while idle, so the CSS 120ms animation delay starts at mount rather than each pending interval. The text wrapper also applies `whitespace-nowrap`; the resident ID-rejection `confirmLabel` is a long sentence. Both findings reproduce at the Phase 9 source revision.
- [x] Confirm the dashboard and request-detail fallback breakpoints against their current destination layouts. The dashboard fallback uses `xl:grid-cols-2` while its destination uses `md:grid-cols-2`. The detail fallback uses one column until `md`, while its destination uses `grid-cols-2` at all widths. These are source-level geometry comparisons; no new responsive visual observation is claimed.
- [x] Replace the phrase “unless necessary” in section 1 with unambiguous frontend-only language. Operational-state, handler, data-layer, backend, authentication, and lifecycle changes remain prohibited; an unsuitable integration must remain unchanged and be documented.
- [x] Label Phase 1 statements about absent files/styles as historical baseline observations. Add cross-references showing that later phases superseded those observations without rewriting the original evidence as if it were current.
- [x] Reconcile Phase 6's unchecked full visual-review item with Phase 7's later representative review and recorded user confirmation. Preserve the distinction between partial agent observation, user confirmation, and checks that remain unverified; the Phase 6 item remains unchecked.
- [x] State explicitly that Phase 8's no-source-change audit proves only the Phase 8 delta. No full Phase 1–8 source-range audit is evidenced or claimed by the Phase 8 record or this phase, and no revision range has been used for a full implementation scope audit. Git history identifies `7f82b09f959582f464ff6cb56579785e8b37daf8..d5f512a649e839fb066d07f6476b753399ed892c` as the source interval from the parent of the loading implementation commit to the current revision; this is recorded as a locator for any future full-range audit, not as a range audited and cleared in Phase 9.
- [x] Define the permitted follow-up implementation files before editing. The Phase 10–11 candidate set is `src/components/loading/loading-button-content.tsx`, loading-only rules in `src/app/globals.css`, and `src/components/loading/page-skeleton.tsx`. Phase 9 changed no application source. Expand this set only if new current-source evidence demonstrates that another approved frontend presentation file is required.

**Deliverable:** A dated, revision-specific follow-up baseline with reconciled status language and a closed frontend file boundary. The Phase 9 record was finalized on 2026-09-27 against source revision `d5f512a649e839fb066d07f6476b753399ed892c`. Both shared-button findings and both fallback breakpoint mismatches reproduce. No application implementation file changed in this phase.

**Completion gate:** Every follow-up finding is reproduced or withdrawn against current source, historical evidence remains accurately labeled, and no application implementation file has changed. Met by current-source inspection and plan-only edits. The Phase 6 full visual-review item and Phase 8 authenticated runtime limitation remain recorded gaps; neither is represented as new Phase 9 visual evidence.

### Phase 10 — Correct shared text-button timing and wrapping

**Purpose:** Make shared text-button feedback satisfy the plan's fast-operation and responsive-layout contracts while preserving operation ownership and button semantics.

**Work area:** `src/components/loading/loading-button-content.tsx` and loading-only rules in `src/app/globals.css`. Phase 9 proves one narrow consumer exception: `src/components/admin/confirm-button.tsx` needs an explicit wrapping presentation prop for the long resident ID-rejection label. No other consumer file changes are included.

- [x] Make the approximately 120ms spinner reveal begin anew for each `pending: false -> true` transition. The spinner node now mounts only during pending, so the existing CSS delay starts with each pending interval. `aria-busy`, disabled state, request start/completion, and the pending label remain tied to their existing state and lifecycle.
- [x] Ensure pending ending before the delay prevents the spinner from appearing and immediately restores ordinary content. A later operation must receive a fresh delay. The isolated preview showed an 80ms operation return to its ordinary label without a spinner; two successive short cycles also produced no visible spinner. Source review confirms each interval creates a fresh spinner node.
- [x] Preserve the reserved normal/pending footprint so ordinary button labels do not shift when the pending label appears. In the preview, the standard action button measured 112.96 × 42.67 CSS px in both normal and pending states; the long-label button measured 573.84 × 42.67 CSS px in both states.
- [x] Allow long confirmation text to wrap within its existing container without clipping or forcing the adjacent Cancel control out of reach. Do not impose wrapping changes on compact controls that do not need them. The new opt-in `wrapText` presentation prop is used by `ConfirmButton`; the resident ID-rejection sentence wrapped at a 360px viewport and Cancel remained visible and operable. Other text buttons retain their default no-wrap behavior.
- [x] Preserve exactly one accessible button name at a time. Decorative spinners remain hidden from assistive technology, and no duplicate live-region announcement is added. Preview accessibility snapshots showed the ordinary or pending label as the button name, not both; confirmation exposed its label and a separate Cancel button. No live region was added.
- [x] Exercise at minimum: initial 80ms pending, slow pending, two consecutive pending cycles, pending end followed by unmount, a long normal label, and the long resident ID-rejection confirmation at a narrow width. The isolated preview exercised each case at a 360px viewport; the slow state showed its pending label and spinner, and unmounted pending content left no marker.
- [x] Source-review the resulting diff to confirm that handlers, button types, disabled expressions, confirmation flow, and operation lifecycles are unchanged. The `ConfirmButton` handler, button types, `disabled={busy}` expressions, confirmation branch, and completion behavior are unchanged; only presentation classes and `wrapText` wiring changed.

**Deliverable:** Shared text-button presentation with a per-operation visual delay and narrow-width-safe labels. Verified on 2026-09-27 against source revision `d5f512a649e839fb066d07f6476b753399ed892c` plus this phase's uncommitted changes.

**Completion gate:** Met for Phase 10 on 2026-09-27: short operations do not flash a spinner on the first or repeated cycles; slow operations show truthful feedback; long confirmation controls fit and remain operable; accessible naming and dimensions remain stable. The Phase 12 build check and Phase 11 work remain outside this phase and are not marked complete.

### Phase 11 — Align route-fallback responsive geometry

**Purpose:** Remove the confirmed breakpoint mismatches without redesigning destinations or changing route behavior.

**Work area:** Dashboard and detail compositions in `src/components/loading/page-skeleton.tsx` only, unless Phase 9 identifies a different current source of the geometry.

- [x] Match the dashboard fallback's recent-panel column breakpoint to the current dashboard destination. `DashboardPageSkeleton` now switches to two columns at `md`, matching the destination's `md:grid-cols-2`; the isolated browser preview showed one column at 390px and two at 1024px and 1440px.
- [x] Match the request-detail fallback's information-card columns to the current request-detail destination at the same representative widths. `DetailPageSkeleton` now uses two columns at all widths, matching the destination's `grid-cols-2`; the isolated browser preview showed two columns at 390px, 1024px, and 1440px.
- [x] Preserve the existing shell, maximum widths, route announcements, decorative skeleton semantics, row counts, themes, and immediate replacement by ready content. The final source diff changes only the two grid utility class strings; the route boundaries, consumers' maximum widths, announcement, decorative semantics, and skeleton row counts remain unchanged. Both themes were visually reviewed.
- [x] Do not add route delays, page fades, client state, a new Suspense boundary, or changes to destination page layout. Source review confirms that only `page-skeleton.tsx` changed in the application; the temporary visual fixture was removed after review.
- [x] Compare fallback and ready content at narrow, medium, and wide widths in both themes, focusing on column arrangement and material layout movement. A temporary local Next.js preview rendered the actual `PageSkeleton` variants beside representative ready-state geometry copied from the current dashboard and detail source. At 390px, dashboard fallback/ready used 1/1 columns and detail fallback/ready used 2/2; at 1024px and 1440px, both pairs used 2/2. Computed grid metrics matched at all six viewport/theme combinations, and screenshot review confirmed representative fallback and ready layouts in both themes. The source diff did not touch shell or navigation code.

**Deliverable:** Dashboard and request-detail fallbacks whose responsive column structure matches their current destinations.

**Completion gate:** At every tested breakpoint, fallback and destination use the same relevant column arrangement and no new shell, navigation, accessibility, or motion behavior is introduced.

### Phase 12 — Run focused regression and completion checks

**Purpose:** Demonstrate that the follow-up fixes resolve the reviewed defects without changing application behavior or broadening scope.

**Work area:** Verification, review-only inspection of approved integrations, and updates to this plan's follow-up execution record. Fixes remain limited to defects introduced within the Phase 9 permitted file set.

- [x] Run admin lint and typecheck using existing scripts. Run the production build after the focused checks pass; record environmental failures separately from source failures. `npm run lint --workspace=@barangayan/web` and `npm run typecheck --workspace=@barangayan/web` passed. The first production build attempt failed while fetching the existing Geist fonts under restricted network access; after network approval, the same build passed through TypeScript and all 37 static pages. This was an environment-only first attempt, not a source failure.
- [x] Run `git diff --check` and inspect the follow-up diff against the Phase 9 baseline. `git diff --check` found no whitespace errors. Against `d5f512a649e839fb066d07f6476b753399ed892c`, the admin-web follow-up delta is exactly `confirm-button.tsx`, `loading-button-content.tsx`, and `page-skeleton.tsx`; these are the Phase 10–11 presentation files. The temporary Phase 12 preview route was removed.
- [x] Verify fast and repeated pending cycles, slow pending, label wrapping, stable button dimensions, reduced motion, one accessible name, and cleanup when pending ends or the component unmounts. The current browser fixture visually rendered normal and pending content, exposed only the active button label in its accessibility tree, measured matching dimensions (199.86 × 46.5 CSS px for the sample normal/pending button), and showed the long wrapped rejection presentation with Cancel still visible at 390px. The current source confirms the spinner is conditional on `pending`, its slot reserves the size, and reduced-motion CSS disables spinner/skeleton animation while keeping the spinner visible. Phase 10's recorded isolated runtime preview verified the 80ms and repeated short cycles, slow pending, cancellation/unmount cleanup, and wrapping against the same button implementation. This Phase 12 fixture rendered but its client event handlers did not hydrate in the available browser, so no fresh dynamic cycle or reduced-motion emulation is claimed; browser re-observation is labeled unverified below.
- [x] Verify the two corrected route fallbacks in light/dark themes and representative narrow/medium/wide viewports. The current fixture rendered actual `PageSkeleton` variants alongside representative ready-state grids at 390px, 1024px, and 1440px. Computed columns matched: dashboard fallback/ready were 1/1 at 390px and 2/2 at 1024px and 1440px; request-detail fallback/ready were 2/2 at all three widths. Light and dark variants were visually inspected; no document-width overflow appeared at 390px. The fixture was isolated and did not exercise authenticated pages.
- [x] Trace representative consumers to confirm unchanged handlers, disabled rules, validation, requests, refreshes, subscriptions, form/dialog behavior, and error/success paths. Against the Phase 9 baseline, consumer files including Settings, request forms/actions, and notifications are unchanged. Source review confirms existing `saving`/`submitting`/`busy` values still drive presentation; their `disabled` expressions, validation, handlers, Supabase calls/RPCs, payloads, refreshes, Realtime subscription, dialog controls, and error/success branches have no follow-up delta. No action or backend operation was invoked.
- [x] Confirm the follow-up introduced no dependency, provider, global controller, overlay, operation timer, fake progress, new request, lifecycle repair, or change outside `apps/admin-web` presentation files and this plan. The follow-up admin-web diff contains only the three Phase 10–11 presentation files listed above; package manifests/lockfiles and all data, server, authentication, and backend files are outside this follow-up delta. The preview timer was temporary test-fixture code and was removed before final checks.
- [x] Update the verification matrix with separate evidence labels for current source observation, current runtime observation, historical agent evidence, recorded user confirmation, source-level inference, and unverified items. Evidence labels are defined and applied in Section 9.
- [x] Do not convert an unavailable runtime check into a pass. The current preview's dynamic interaction and reduced-motion emulation gaps remain explicitly marked `Unverified`; Phase 10 evidence and source review are separately attributed.

**Deliverable:** A reviewable follow-up diff, passing available static/build checks, and an evidence-labeled verification record.

**Completion gate:** The Phase 10–11 acceptance criteria pass, required static/build checks pass or have a clearly separated environmental blocker, and the full follow-up diff stays within the Phase 9 boundary.

### Phase 13 — Verify authenticated production navigation and close the handoff

**Purpose:** Close the remaining production-prefetch and authenticated-runtime gaps without changing navigation or authentication behavior.

**Work area:** Read-only production-mode browser verification and this plan's status/evidence records. No mutation-backed, destructive, payment, backend, authentication, or data-layer action is required.

- [x] Start from the Phase 12-verified build and record the exact revision and runtime configuration used. Used the existing Phase 12 production artifact (`.next/BUILD_ID` `K3ecQNq6Ta0lw4uioOVqN`) at revision `d5f512a649e839fb066d07f6476b753399ed892c`, including the existing Phase 10–11 working-tree presentation changes. The initial production run used `npm run start --workspace=@barangayan/web` (`next start`, Next.js 16.3.0) at `http://localhost:3000`; the follow-up production run used the same artifact at `http://localhost:3002`; Node was `v24.13.1`. The authenticated user session was available at `http://localhost:3001`, but that server's runtime mode was not independently confirmed.
- [ ] In an available authenticated production-mode session, observe a fully prefetched sidebar destination. Confirm navigation remains immediate and no pending marker is forced when Next.js skips the pending state.
- [ ] Observe an eligible non-prefetched or delayed navigation without changing Link props. Confirm the marker remains local, delayed, non-blocking, and clears when navigation settles.
- [ ] Check expanded and collapsed sidebar fit, visible keyboard focus, stable accessible link names, rapid destination changes, and browser back/forward behavior in that production session.
- [x] Recheck representative integrated text-button and route-fallback states after the Phase 10–11 changes. The Phase 12 evidence applies to the unchanged final source state: the representative pending/normal button retained identical dimensions and one accessible name, and the dashboard/request-detail fallback geometry matched representative ready layouts at the tested widths and themes. In the authenticated `localhost:3001` session, dashboard, Services, and Requests navigation exposed the route loading announcement before settling; Settings exposed its existing “Loading settings” state before resolving to the unchanged form with “Save Settings.” A 3001-only follow-up re-observed collapsed sidebar fit, route loading-to-ready transitions, rapid Announcements→Requests navigation, and browser back/forward. No mutation, save, publish, status, payment, or destructive action was invoked.
- [x] If authenticated production access or Supabase connectivity remains unavailable, mark this phase `Blocked`, identify the exact environmental dependency, and leave the affected matrix rows `Unverified`. Do not change auth/backend code to obtain the observation. The user-provided authenticated `localhost:3001` session was available, but its runtime mode was not confirmed as production. The separate production `localhost:3002` run redirected to login and could not establish a fresh Supabase session, so production-prefetch evidence remains unavailable; the earlier production login attempt also logged `AuthRetryableFetchError: fetch failed`.
- [x] Reconcile the tracker, Phase 6 visual item, follow-up execution record, verification matrix, and definition of done. The selected loading implementation remains complete; Phase 13 production verification is not complete and is blocked. The Phase 6 full visual-review item remains intentionally unchecked, and no earlier user-confirmed or isolated evidence is relabeled as a Phase 13 production observation.

**Deliverable:** Authenticated production-navigation evidence or an explicit environmental blocker, followed by a reconciled final handoff.

**Completion gate:** Production-prefetch, delayed navigation, sidebar, and history behavior are directly observed on the final source revision, or the phase is honestly marked `Blocked` with implementation completion kept separate from verification completion.

### Execution record

Populate this table as work occurs; do not pre-fill successful results.

| Phase | Changed files / delivered surfaces | Verification and evidence | Exclusions / blockers | Outcome |
|---|---|---|---|---|
| 1 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only; populated navigation, loading-state, action, and file-boundary inventories. No app source changes. | Read root/admin `AGENTS.md`; Expo v57.0.0 and installed Next.js 16.3 loading/navigation guides; inspected routes, action owners/disabled rules, hooks, shell, and styles; searched admin route boundaries and loading call sites; `git diff --check` returned no whitespace findings. CUA browser inventory showed no open tabs. | Existing modified plan and untracked `.claude/settings.local.json` preserved. No authenticated view was available for screenshots; code-level dimensions/theme recorded. Unused `use-households`, unwired map loading prop, and request-history error-lifecycle limitations recorded. | Complete |
| 2 | `apps/admin-web/src/components/loading/{spinner,skeleton,loading-button-content,loading-status,page-skeleton}.tsx`; loading-only motion rules in `apps/admin-web/src/app/globals.css`. Temporary visual preview route was removed after inspection. | `npm run lint` and `npm run typecheck` in `apps/admin-web` passed; `git diff --check` reported no whitespace errors. Isolated browser preview showed normal/pending and long-label buttons plus table/dashboard skeletons in light/dark themes. An 80ms preview completion returned to the normal button name before the 120ms indicator reveal. AX tree showed one active button label and one page status; reduced-motion static appearance and scoped CSS rule inspected. | No display-delay hook was needed. Browser/system `prefers-reduced-motion` emulation was unavailable; the static treatment was inspected in an isolated visual mock and its media-query rule was code-checked. The existing session proxy's Supabase fetch stalled for about 26 seconds and Google Fonts were unreachable, so the temporary preview used the app's font fallback; no auth flow or credentials were used. | Complete |
| 3 | `apps/admin-web/src/app/(admin)/loading.tsx`, route fallbacks for `dashboard`, `incident-map`, `emergency-qr`, `requests/[requestId]`, and `settings`; matching map, QR, detail, and settings compositions in `src/components/loading/page-skeleton.tsx`. | Admin `npm run lint` and `npm run typecheck` passed after cleanup; `git diff --check` passed. An isolated visual preview checked all six variants in dark theme; each accessibility snapshot exposed one route status, and skeleton primitives are `aria-hidden`. A temporary Next.js route with a 12-second suspended page visibly showed its loading boundary, then its ready content. Installed Next.js 16.3 loading and Link/prefetch guides were inspected: the fallbacks remain inside the existing shell, add no delay/fade, and preserve native route behavior; automatic link prefetch is production-only. | The actual authenticated admin route could not be observed because the local `proxy.ts` Supabase auth fetch failed with `AuthRetryableFetchError` and stalled requests; the admin layout waits for auth/profile before showing the shell. Prefetch navigation could not be observed at runtime in development mode, and a production build belongs to Phase 8. Google Fonts were unavailable, so previews used the app's fallback font. The temporary route fixture was removed. No credentials or app data actions were used. | Complete — phase gate satisfied; live authenticated/prefetch runtime observations are documented limitations. |
| 4 | `apps/admin-web/src/components/navigation/link-pending-indicator.tsx`; presentation-only integration in `apps/admin-web/src/components/admin/sidebar-nav.tsx`; scoped collapsed-slot styles in `apps/admin-web/src/app/globals.css`. | Admin `npm run lint --workspace=@barangayan/web`, `npm run typecheck --workspace=@barangayan/web`, and `git diff --check` passed. A temporary local preview showed expanded trailing-slot and collapsed icon-slot markers without sidebar overflow; the accessibility tree retained collapsed labels, and keyboard Tab showed a visible focus ring. A slow-to-fast click sequence settled on the latest destination; browser back/forward restored route content without a stale marker. The installed `useLinkStatus` and `Link` guides were read; hrefs, default prefetch, and pathname matching were source-reviewed unchanged. | The temporary preview routes were removed. A live production-prefetched navigation was not observed because automatic Link prefetch runs only in production and Phase 8 build verification is outside this selected phase. The authenticated admin route was not exercised; preview used `SidebarNav` directly and did not use credentials or invoke app data actions. Google Fonts were unreachable, so the preview used the existing font fallback. Reduced-motion browser emulation was unavailable; the existing scoped static-motion rule and the new collapsed-icon rule were code-reviewed. | Complete — Phase 4 gate met; production-prefetch runtime observation remains unavailable and is recorded above. |
| 5 | `apps/admin-web/src/app/(admin)/settings/settings-form.tsx`; Settings Save button and existing local loading section. | Read the root Expo SDK 57.0.0 reference and installed Next.js 16.3 client-component, loading-boundary, Link-status, and accessibility guides before editing. `npm run lint --workspace=@barangayan/web` passed; `npm run typecheck --workspace=@barangayan/web` passed; `git diff --check` passed. Source diff confirms the `handleSubmit` body, validation, `updateSettings` call, `router.refresh()`, error branches, form values, and both `disabled={saving}` expressions are unchanged. The user subsequently confirmed testing the pilot and that it works. | The agent could not independently inspect the local visual preview because the browser URL policy rejected it. No real save or backend request was made by the agent. Existing `saving` lifecycle limitation remains unchanged. | Complete — user-confirmed pilot verification; agent lint, typecheck, and source-boundary checks passed. |
| 6 | `apps/admin-web/src/app/(admin)/{about-us/about-us-form.tsx,announcements/announcement-form.tsx,announcements/announcement-row.tsx,emergency-qr/qr-instructions-modal.tsx,evacuation-centers/evacuation-center-form.tsx,evacuation-centers/evacuation-center-row.tsx,faq/faq-form.tsx,faq/faq-row.tsx,health/applicants/applicant-detail-modal.tsx,health/applicants/applicants-table.tsx,health/drive-detail-modal.tsx,health/drive-table.tsx,households-residents/households-table.tsx,households-residents/member-form-modal.tsx,hub/emergency-form.tsx,incident-reports/incident-actions.tsx,incident-reports/incident-detail-modal.tsx,incident-reports/incident-table.tsx,requests/requests-table.tsx,residents/resident-directory.tsx,services/document-type-form.tsx,services/document-type-row.tsx,staff/staff-form.tsx,terms-privacy/content-form.tsx,transactions/transactions-table.tsx,waste-management/schedule-form.tsx,waste-management/schedule-row.tsx,waste-management/zone-form.tsx,waste-management/zone-row.tsx}` plus `apps/admin-web/src/components/admin/{confirm-button.tsx,editable-data-table.tsx,header.tsx,notifications-drawer.tsx,request-status-actions.tsx}`; reused existing loading primitives and flags for inventoried submit, edit, shared-busy, notification, table-editor, and lookup surfaces. | `npm run lint --workspace=@barangayan/web` passed. Initial `npm run typecheck --workspace=@barangayan/web` exposed an obsolete generated `.next/dev/types/validator.ts` reference to the removed temporary `/phase-six-preview` page; after removing that single stale generated validator, typecheck passed. `git diff --check` passed. Source diff review found only loading content/ARIA presentation changes plus indentation changes caused by group wrappers; handlers, validation, disabled expressions, queries, subscriptions, requests, and refresh behavior were source-reviewed unchanged. In the authenticated local app, dark-theme desktop idle layouts were visually inspected on the dashboard, announcement form, request list/detail, notification menu/drawer, and transactions list/add form. The notification drawer's existing Load more fetch visibly showed a disabled “Loading…” control and then resolved. No mutation-backed action was triggered; other pending variants remain unverified. | Visual review is partial, not a full pass: safely observable layouts and the notification-fetch pending state were inspected, while mutation-backed submit/edit/status/invite/transaction pending states were not invoked. Earlier unauthenticated preview errors and the browser's local-fixture URL rejection no longer block access to the user's running authenticated app. Resident request history, dormant `MapFilterPills.loading`, unused `use-households`, and the unlisted `waste-management/trash-incident-table.tsx` remain excluded from this phase. No dedicated upload-progress state exists. The final working tree also contains changes outside Phase 6 in `apps/resident-android-mobile/src/components/map-view.tsx` and `supabase/functions/create-payment-source/index.ts`, plus untracked `.claude/settings.local.json` and `supabase/migrations/0093_resident_ios_backend_safety.sql`; these were left untouched. | Complete — Phase 6 formal completion gate met; visual review is partial and the visual checklist remains open. |
| 7 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only. Reviewed existing shared loading UI, scoped CSS, six route fallbacks, navigation indicators, and 32 `LoadingButtonContent` call-site files; no application source defect was confirmed. | Read the full plan and applicable root/admin instructions; opened Expo SDK 57.0.0 docs and installed Next.js 16.3 `useLinkStatus`/`loading.tsx` guides. Confirmed the six shared loading/navigation component files and six planned route fallbacks exist; source-reviewed reduced-motion rules, accessible label toggling, live-status placement, fixed link slots, and pending-state removal. In the authenticated browser, visually reviewed a dark dashboard and light-theme Services, Requests, Transactions, Incident Reports, Resident Directory, Health, Medical Applicants, Households & Residents, Waste Management, Hub, Settings, Evacuation Centers, Emergency QR, FAQ, and About Us. The dashboard's initial KPI/transaction skeletons resolved to real content; Settings' initial loading message resolved to its form. Expanded and collapsed sidebar fit the available desktop viewport, its collapsed names remained exposed, and Tab produced visible focus. The user subsequently confirmed the remaining narrow/wide, reduced-motion, screen-reader/announcement, full-surface theme, and operation-state checks work correctly. `git diff --check` was run on the plan; no lint/typecheck/build was run because those belong to Phase 8. | No prohibited operation was introduced or required. A pre-existing Settings horizontal overflow at the available desktop width was observed and left unchanged as unrelated to loading presentation. Existing unrelated edits in resident Android/iOS paths, payment/backend files, another plan, and local settings were preserved. | Complete — Phase 7 completion gate met through source review, live visual evidence, and user-confirmed remaining checks. |
| 8 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only; finalized the Phase 8 checklist, tracker, and execution record. No application source files changed in this phase. | `npm run lint --workspace=@barangayan/web` passed; `npm run typecheck --workspace=@barangayan/web` passed; `npm run build --workspace=@barangayan/web` passed, including TypeScript and 37 static pages. The first build attempt was blocked only by network access to the layout's existing Google Fonts; rerunning with network access passed. `git diff --check` passed. The Phase 8 delta review found no app source changes in that phase; this establishes only that the Phase 8 delta added no source changes, not full Phase 1–8 range compliance. It also found no new provider, timer, overlay, fake progress, dependency, or operation state. Prior Phase 5–7 reviews document unchanged handlers, requests, subscriptions, refreshes, validation, disabled rules, themes, motion, and accessibility. A production `/login` request returned HTTP 200; authenticated runtime review could not continue because repeated Supabase auth requests failed. | Authenticated loading surfaces were not re-observed in this Phase 8 session; Phase 7's recorded visual checks and the user's confirmation remain the evidence for those checks. No credentials were entered and no data/action flow was invoked. Pre-existing unrelated changes to resident Android payment/map/hook files, the Supabase payment function, the Resident iOS plan/project and migration, and local settings were preserved. The Phase 1-to-current repository history contains separate resident-app/auth-schema changes identified in the Phase 6 record as unrelated user changes; those files were not modified during Phase 8 or included in its delta. A full Phase 1–8 implementation scope audit is not evidenced by this Phase 8 record. | Complete — Phase 8 checks passed, prior phase completion gates remain satisfied, and the current-phase scope boundary held; authenticated runtime follow-up is recorded as unavailable. |
| 9 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only; established a revision-specific source baseline, reconciled historical evidence, and fixed the follow-up file boundary. | Read root and admin `AGENTS.md`; opened the exact Expo SDK 57.0.0 docs and installed Next.js 16.3 loading, Link, and `useLinkStatus` guides. Starting source revision: `d5f512a649e839fb066d07f6476b753399ed892c`; the expected Phase 10–11 source files have no working-tree changes. Reproduced the hidden always-mounted spinner timing issue, the `whitespace-nowrap` constraint against the long resident ID rejection label, dashboard `xl` versus destination `md` columns, and detail fallback one-to-two columns versus destination two columns at all widths. No responsive browser check was performed. `git diff --check` passed for the plan. | The working tree already contained modified Resident Android payment/map/hook files, `package-lock.json`, this plan, the Resident iOS plan, and the Supabase payment function, plus local settings, Resident iOS project/ledger files, and a migration. On the September 27 continuation snapshot, `.gitignore` was also modified and the untracked Resident iOS project had additional files; all were preserved. The earlier read-only review's exact revision was not recorded, so source-change attribution since that review remains unknown. Phase 8's recorded no-source-change result covers only its own delta. No full Phase 1–8 scope audit is claimed in Phase 9; the candidate historical source interval is `7f82b09f959582f464ff6cb56579785e8b37daf8..d5f512a649e839fb066d07f6476b753399ed892c`, filtered to `apps/admin-web/`. Phase 6's full visual sweep remains unchecked; Phase 7's representative observations and user confirmation retain their separate attribution. Authenticated production navigation remains for Phase 13. | Complete — Phase 9 gate met. Phase 10–13 remain not started. |
| 10 | `apps/admin-web/src/components/loading/loading-button-content.tsx` and `apps/admin-web/src/components/admin/confirm-button.tsx` (narrow consumer presentation exception); updated this plan's Phase 10 checklist, tracker, and evidence matrix. No `globals.css` change; temporary preview route removed. | Read root/admin `AGENTS.md`, exact Expo SDK 57.0.0 docs, and installed Next.js 16.3 `use client` and Server/Client Components guides. Revalidated all four Phase 9 findings against current source at HEAD `d5f512a649e839fb066d07f6476b753399ed892c`: both shared-button defects remain; the dashboard fallback still switches at `xl` while its destination switches at `md`; the detail fallback still switches to two columns at `md` while its destination uses two columns at all widths. Phase 10 and Phase 11 target source files were clean at start. `npm run lint --workspace=@barangayan/web` passed. Typecheck initially found a stale ignored Next dev validator from the temporary preview; `next typegen` regenerated current route types and the one stale generated validator was removed, after which `npm run typecheck --workspace=@barangayan/web` passed. `git diff --check` passed. An isolated Next preview at 360px showed an 80ms first cycle and two repeated short cycles without a spinner flash, truthful slow pending feedback, identical normal/pending dimensions, one accessible name, wrap-safe resident ID rejection text with reachable Cancel, and no marker after pending content was unmounted. | This phase changed no backend, API, data, authentication, operation lifecycle, handler, disabled expression, dependency, package manifest, lockfile, or non-admin application file. An initial request through the existing auth proxy failed due to Supabase connectivity; the successful preview then used an inert loopback Supabase endpoint. No login credentials or app data/action flow were used. Google Fonts were unavailable and the existing fallback font rendered. Reduced-motion browser emulation and screen-reader testing were not repeated. Production build remains for Phase 12. The Phase 9 prerequisite gate is met; the older Phase 6 full visual sweep and Phase 8 authenticated runtime gap remain recorded and do not block this phase. Initial unrelated edits in `.gitignore`, Resident Android, the root lockfile, the Resident iOS plan/project, the Supabase payment function/migration, and local settings were left untouched; additional CI/root-package, Aider/cache, and Resident iOS database/test edits visible in the final status were also preserved. | Complete — Phase 10 gate met; Phases 11–13 remain not started. |
| 11 | `apps/admin-web/src/components/loading/page-skeleton.tsx` (two responsive grid-class corrections) and this plan's Phase 11 checklist, tracker, and record. A temporary `src/app/phase11-preview/` fixture and its theme-toggle component were removed after visual review. | Completed 2026-09-27 against HEAD `d5f512a649e839fb066d07f6476b753399ed892c`, with the completed Phase 10 working-tree edits present and untouched. Re-read the root and admin `AGENTS.md`, opened the exact Expo SDK 57.0.0 page and installed Next.js 16.3 `loading.md`, and rechecked `dashboard/page.tsx`, `requests/[requestId]/page.tsx`, and both route fallback wrappers. Destination source uses `md:grid-cols-2` for dashboard recent panels and `grid-cols-2` for request-detail information cards. `git diff --check` passed for the implementation file and plan. An isolated Next.js preview used the real `PageSkeleton` variants and representative ready-state layouts from the current source. At 390px, dashboard fallback/ready computed to 1/1 columns and detail fallback/ready to 2/2; at 1024px and 1440px both pairs computed to 2/2. Visual screenshots confirmed these arrangements in light and dark themes and showed no new material column movement. The final persistent application diff contains only the two intended class changes. | No credentials were entered and no application data/action flow was exercised. Ready-state content was represented in the local fixture using the destination source's existing layout classes; the actual authenticated pages and production navigation were not exercised. Google Fonts could not be fetched during the preview, so the app's existing fallback font rendered. No lint, typecheck, or build was run because those checks belong to Phase 12. Pre-existing changes in the CI/root configuration, Phase 10 button files, Resident Android and iOS work, package files, Supabase files, local settings/caches, and the plan were preserved. A newly surfaced untracked `tmp/` directory and Resident iOS design handoff were also left untouched. | Complete — Phase 11 responsive geometry gate met. Phases 12–13 remain not started. |
| 12 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only. A temporary `apps/admin-web/src/app/phase12-preview/` fixture was used for current browser observations and removed before final checks. No Phase 12 application source change. | Completed 2026-09-27 against HEAD `d5f512a649e839fb066d07f6476b753399ed892c` with completed Phase 10–11 working-tree changes present. Re-read root/admin `AGENTS.md`, opened the exact Expo SDK 57.0.0 docs, and read installed Next.js 16.3 `loading.md` and Server/Client Components guides. Verified Phase 10–11 prerequisites by current source comparison: dashboard fallback/destination both use `md:grid-cols-2`; detail fallback/destination both use `grid-cols-2`; the two button fixes remain in the recorded Phase 10 files. `npm run lint --workspace=@barangayan/web` passed; `npm run typecheck --workspace=@barangayan/web` passed. The first build was blocked fetching existing Google Fonts; the network-approved rerun of `npm run build --workspace=@barangayan/web` passed TypeScript and 37/37 static pages. `git diff --check` passed. Against the Phase 9 baseline, the admin-web follow-up application delta contains only `confirm-button.tsx`, `loading-button-content.tsx`, and `page-skeleton.tsx`. The browser fixture rendered the actual fallback variants and representative ready-state geometry at 390px, 1024px, and 1440px, in light and dark variants; computed column arrangements matched (dashboard 1/1 at 390px, 2/2 at 1024px and 1440px; detail 2/2 at all widths). A 390px visual showed no document overflow, the pending/normal sample button measured 199.86 × 46.5 CSS px in both states, the accessibility tree exposed one active button label, and the wrapped rejection presentation kept Cancel visible. Source tracing of Settings, request forms/actions, and notifications found no handler, disabled-rule, validation, request, refresh, subscription, dialog, or error/success delta. | The isolated preview used an inert loopback Supabase endpoint; no credentials, authentication, application data, or operations were used. Google Fonts could not be fetched in the restricted preview, so the existing fallback font rendered. The temporary page rendered but its client handlers did not hydrate in the available browser; fast/repeated transitions and cleanup were not re-observed this phase, and reduced-motion emulation was unavailable. Those items remain separately labeled and use the Phase 10 runtime record, Phase 2 preview, and Phase 7 user confirmation where applicable. Pre-existing unrelated working-tree changes in CI/root configuration, resident Android/iOS projects, package files, Supabase files, local settings/caches, and plans were preserved. Phase 13 had not started at the time of this record; its subsequent attempt is recorded as Blocked below. | Complete — Phase 12 gate met: available lint/typecheck/build checks passed, Phase 10–11 presentation acceptance was rechecked, the follow-up diff stayed within the approved frontend presentation boundary, and unobserved checks remain explicitly unverified. |
| 13 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only; no application source changes. Started the existing Phase 12 production build in production mode and used the user's authenticated session for partial runtime evidence. | Read the root and admin `AGENTS.md`; opened the exact Expo SDK 57.0.0 reference and installed Next.js 16.3 `loading.md`, `use-link-status.md`, `use-pathname.md`, and route-group guidance. Reverified the Phase 12 prerequisite source state and current admin-web boundary: only the recorded Phase 10–11 presentation files are modified in `apps/admin-web`. `npm run lint --workspace=@barangayan/web` passed; `npm run typecheck --workspace=@barangayan/web` passed; `git diff --check` passed. In the authenticated `localhost:3001` browser session, the dashboard rendered; the collapsed sidebar fit the 61px slot, collapsed links retained accessible names, keyboard focus remained visible, rapid Announcements→Requests navigation settled on Requests, and browser back/forward moved between Announcements and Requests without a stale marker. Dashboard, Services, and Requests loading announcements appeared and resolved; Settings exposed its existing “Loading settings” state before resolving to the ordinary form with Save Settings. A follow-up test limited to `localhost:3001` re-observed the collapsed layout, route loading-to-ready transitions, rapid navigation, and history behavior; no mutation or save action was invoked. A separate `next start -p 3002` run used the Phase 12 artifact and reached production login, but the fresh authentication attempt returned to login, so that production session was not authenticated. | Production-prefetched navigation, delayed/non-prefetched marker behavior, production-mode sidebar/history behavior, and production route-fallback observation remain `Unverified` because the authenticated `localhost:3001` runtime mode was not confirmed and the separate authenticated production run was unavailable. No auth/backend/data-layer change was made; no application data, mutation, payment, or destructive operation was invoked. Existing unrelated working-tree changes in resident apps, backend/payment files, package files, CI/root configuration, local settings, and other plans were preserved. Phase 6's historical full visual-review item remains unchecked. | Blocked — implementation complete for the selected frontend scope; the requested authenticated `localhost:3001` checks passed, but the Phase 13 production-prefetch gate remains incomplete. |

## 9. Verification matrix

Use browser throttling, isolated UI fixtures, or mocks. Do not change a backend or invoke destructive/payment operations merely to exercise a spinner.

| Scenario | Required result | Recorded evidence and attribution |
|---|---|---|
| Fast completion | No flashing spinner or artificial delay | **[Historical agent runtime, Phase 10]** An 80ms pending cycle and two successive short cycles returned to ordinary content without a visible spinner. **[Current source, Phase 12]** The spinner mounts only while pending and uses a CSS reveal delay; there is no minimum duration or JavaScript timer. **[Unverified current runtime]** The Phase 12 fixture's client event handlers did not hydrate in the available browser, so the cycles were not repeated in this session. |
| Slow action | Truthful local feedback; original disabled rules | **[Current browser visual, Phase 12]** A server-rendered pending state showed the delayed spinner and “Working…” label. **[Current source, Phase 12]** Representative consumers retain their existing pending flags and disabled expressions. **[Historical agent runtime, Phase 6]** Notification Load more displayed its existing disabled “Loading…” state through resolution. No operation or backend action was invoked in Phase 12. |
| Existing failure | Existing error behavior; no invented success | **[Recorded user confirmation, Phase 7]** Existing failure behavior and truthful pending presentation were reported intact. **[Current source, Phase 12]** The follow-up diff does not touch error or success branches. **[Unverified current runtime]** No failure-producing action was invoked. |
| Route suspension | Correctly sized content fallback; no duplicate shell | **[Historical agent runtime, Phase 3]** A 12-second isolated suspension displayed the route fallback, then ready content. **[Current browser visual, Phase 12]** Actual `PageSkeleton` variants matched representative ready-state grids at tested widths and themes. **[Current authenticated browser, localhost:3001]** Dashboard and Services navigation exposed route loading announcements before settling; Settings exposed its existing local loading state before resolving. **[Unverified Phase 13 production runtime]** The authenticated runtime mode on port 3001 was not confirmed as production. |
| Initial admin authentication wait | Boundary limitation documented; no auth refactor | **[Current source]** The parent admin layout still waits for auth/profile before rendering the shell. **[Source-level inference]** Child route loading boundaries cannot display before that parent work completes. No auth code was changed or exercised. |
| Prefetched route | Instant navigation without forced indicator | **[Historical installed-doc/source review, Phase 4]** Next.js can skip `pending` for prefetched destinations; existing Link prefetch defaults remain. **[Current authenticated browser, localhost:3001]** Sidebar navigation was authenticated, but dashboard/Services transitions exposed route loading UI, so this session did not prove a fully prefetched production destination. **[Unverified Phase 13 production runtime]** The separate production port reached login but could not establish a fresh Supabase session. |
| Delayed/non-prefetched route | Local delayed marker clears when navigation settles | **[Historical source/preview, Phase 4]** The indicator remains a descendant of the native Link and uses the documented `useLinkStatus` contract. **[Current authenticated browser, localhost:3001]** Route loading announcements were observed and cleared on dashboard, Services, and Settings transitions; the runtime mode was not confirmed as production. **[Unverified Phase 13 production runtime]** No authenticated production sidebar was available. |
| Rapid route changes | No stale custom marker or blocked navigation | **[Historical agent runtime, Phase 4]** An isolated slow-to-fast sequence settled on the latest destination without a stale marker. **[Current authenticated browser, localhost:3001]** Rapid Announcements→Requests navigation settled on Requests without a stale route marker; production mode was not confirmed. **[Unverified Phase 13 production runtime]** No authenticated production sidebar was available. |
| Back/forward | Existing router behavior preserved | **[Historical agent runtime, Phase 4]** Browser history navigation showed no stale link marker. **[Current authenticated browser, localhost:3001]** Back moved to Announcements and forward returned to Requests without a stale marker; production mode was not confirmed. **[Unverified Phase 13 production runtime]** Production history navigation remains unverified. |
| Background refresh | No newly introduced content replacement | **[Current source]** Fetch hooks, subscriptions, and their replacement behavior are unchanged. **[Unverified current runtime]** No live refresh was triggered in Phase 12. |
| Collapsed sidebar | Fits icon slot; stable name; no overflow | **[Historical agent runtime, Phase 4/7]** Expanded/collapsed fit and keyboard focus were observed on the existing app. **[Recorded user confirmation, Phase 7]** Remaining responsive and accessible sidebar checks were confirmed. **[Current authenticated browser, localhost:3001]** Collapsed navigation fit the icon slot, all links retained accessible names, and the focused Dashboard link showed a visible focus ring; production mode was not confirmed. **[Unverified Phase 13 production runtime]** The authenticated production port was unavailable. |
| Text/icon buttons | Stable dimensions and one accessible name | **[Current browser visual, Phase 12]** The representative normal and pending button both measured 199.86 × 46.5 CSS px. The accessibility tree exposed “Update household records” in normal state and only “Working…” in pending state; the 390px wrapped rejection presentation kept Cancel visible. **[Historical agent runtime, Phase 10]** Fast/repeated cycles, narrow wrapping, and unmount cleanup were exercised. **[Current source]** Icon-mode rendering is unchanged; no independently busy icon-only action is inventoried. |
| Reduced motion | Static feedback; no shimmer or rotation | **[Current source, Phase 12]** Scoped `prefers-reduced-motion` CSS disables spinner and skeleton animation and keeps the spinner statically visible. **[Historical agent preview, Phase 2]** Static reduced-motion treatment was inspected. **[Recorded user confirmation, Phase 7]** Integrated reduced-motion feedback was confirmed. **[Unverified current runtime]** The available browser controls did not provide reduced-motion emulation. |
| Keyboard/screen reader | Preserved focus; concise, non-duplicated announcements | **[Current browser accessibility tree, Phase 12]** Normal and pending sample buttons each exposed one active name; loading announcements appeared once per fallback. **[Current authenticated browser, localhost:3001]** Collapsed-link names and visible keyboard focus were observed; no independent screen reader was run. **[Recorded user confirmation, Phase 7]** Integrated screen-reader and announcement behavior was confirmed. **[Unverified Phase 13 production runtime]** Production sidebar focus and link-name checks remain unverified. |
| Light/dark theme | Consistent spacing and visible contrast | **[Current browser visual, Phase 12]** Light and dark fallback/ready variants were reviewed at 390px, 1024px, and 1440px. At 390px document width equaled viewport width. Computed card surfaces differed appropriately between white and dark theme tokens. The isolated fixture used the fallback font because Google Fonts were unreachable during preview. |
| Pending ends/unmount | Visual timer cleanup; no lingering marker | **[Historical agent runtime, Phase 10]** Pending content returned to ordinary content and no spinner remained after unmount. **[Current source, Phase 12]** Spinner rendering is conditional on current pending state; the delay is CSS-only and no new timer was introduced. **[Unverified current runtime]** Dynamic end/unmount was not repeated in the non-hydrated Phase 12 fixture. |
| Behavior comparison | Same handlers, endpoints, payloads, refreshes, and subscriptions | **[Current source, Phase 12]** Compared with Phase 9, the only follow-up admin-web files changed are `confirm-button.tsx`, `loading-button-content.tsx`, and `page-skeleton.tsx`. Consumer handler, disabled, validation, request/RPC, payload, refresh, subscription, dialog, and feedback files have no follow-up diff. **[Source-level inference]** Their existing operation semantics therefore remain as implemented. No real action was invoked. |

Evidence labels distinguish **[Current source]** review of the present working tree, **[Current browser visual]** observation of a rendered isolated fixture, **[Historical agent runtime/preview]** earlier direct observation tied to its recorded phase, **[Recorded user confirmation]** checks the user reported, **[Source-level inference]** a conclusion from unchanged source, and **[Unverified]** checks not directly observed. A browser screenshot or source review is not represented as an authenticated operation or screen-reader test. The Phase 12 preview route was removed; its missing client hydration prevents a new runtime claim for dynamic button cycles and reduced-motion emulation. The Phase 6 full visual-review item remains unchecked. Phase 13 has authenticated localhost:3001 evidence, but its production-prefetch gate remains blocked because that runtime mode was not confirmed and the separate production port could not establish a fresh Supabase session; production navigation rows remain explicitly unverified.

Use focused automated checks only for meaningful contracts such as delay cleanup or accessible labels. Do not introduce a new test framework for this task.

### Existing limitations to preserve and report

- Some handlers clear busy before subsequent verification or refresh finishes.
- Some handlers may remain busy after unexpected thrown exceptions.
- Some hooks may remain loading when prerequisites are absent.
- Duplicate-submission protection and error recovery remain as currently implemented.
- Some existing refresh paths may clear or replace content.

Animation components do not fix these issues. Do not conceal them using a timer that falsely claims completion or silently change operation lifecycles to satisfy visual acceptance criteria.

## 10. Definition of done

- Selected admin surfaces share consistent visuals tied to real existing state.
- Applicable route fallbacks render within the existing shell.
- Sidebar feedback fits both layouts without changing navigation.
- Migrated controls retain dimensions, truthful labels, and interaction semantics.
- Reduced-motion and assistive-technology behavior are verified.
- No artificial wait, fake progress, blocking overlay, or additional request is introduced.
- Backend, data, workflow, authentication, and recovery behavior remain unchanged.
- No dependencies, SQL, APIs, RPCs, server actions, or other applications are changed.
- Unsupported lifecycle cases are documented rather than expanded into this work.

## 11. References

- Installed guide: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`.
- Installed guide: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`.
- [Next.js useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status).
- [Next.js loading convention](https://nextjs.org/docs/app/api-reference/file-conventions/loading).

Prefer installed version documentation when an online example differs from this project's supported APIs.
