# Global Loading and Transition System — Frontend UI-Only Implementation Plan

## 1. Objective and strict scope

Improve loading animations and visual feedback in `apps/admin-web`, using existing router behavior and existing loading state.

**This is strictly a frontend presentation task. No backend changes, data-layer migration, or business-workflow changes are included unless necessary.** “Global” means consistent visual components across the admin interface, not an application-wide loading controller.

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

This section is the execution checklist for the implementation. Phases 1–3 are complete as recorded below; Phase 3's unavailable live authenticated/prefetch observations are documented as verification limitations. Phase 4 is complete with its production-prefetch runtime limitation recorded below. Phase 5 is complete based on the user's confirmation that the pilot was tested and works. Phase 6's inventory rollout and formal completion gate are complete; its visual inspection could not be performed and is recorded as unavailable, not passed. Phases 7–8 remain **Not started**. Updating this plan does not mark later application integration work complete.

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
| 7 | Accessibility and visual verification | 6 | Not started |
| 8 | Build checks, scope audit, and handoff | 7 | Not started |

For each phase, record changed files, checks performed, results, and exclusions in the execution record at the end of this section. Use `In progress`, `Complete`, or `Blocked` when updating status; a blocked entry must explain the missing evidence or dependency.

### Phase 1 — Inventory existing UI and establish the boundary

**Purpose:** Identify exact integration points before changing application code.

**Work area:** Read-only inspection of admin components, screens, styles, and applicable repository instructions; documentation updates in this plan.

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
- [ ] Visually check each distinct layout. Not verified: the browser URL policy rejected the local fixture, and the authenticated preview was unavailable after its Supabase/font requests failed. No visual pass is claimed; see the Phase 6 execution record.
- [x] Remove redundant loading markup only from migrated surfaces; leave unrelated components unchanged. Replaced labels/status text only where listed; unrelated loading surfaces and hooks remain unchanged.
- [x] Update each inventory row as migrated, excluded with reason, or still pending. Outcomes are recorded in both the existing-loading-sections and action-pending-state inventories above; no eligible inventoried action remains pending.

**Deliverable:** Consistent loading presentation across the selected inventory, with no hidden expansion into data/workflow work.

**Completion gate:** Every inventory row has a recorded outcome. Each migrated surface uses an existing state source and preserves its operation semantics.

### Phase 7 — Verify motion, accessibility, and visual consistency

**Purpose:** Validate the integrated experience against section 9.

**Work area:** Existing changed UI and scoped CSS only; no new behavior or dependencies.

- [ ] Check all migrated surfaces in light/dark themes and the existing accent styling.
- [ ] Check representative narrow/wide viewports, expanded/collapsed navigation, and text wrapping.
- [ ] Verify reduced motion leaves informative static indicators and readable labels.
- [ ] Verify keyboard operation, visible focus, stable accessible names, and non-duplicated loading announcements.
- [ ] Check no label/spinner appearance shifts buttons, rows, toolbars, or sidebar width.
- [ ] Verify indicator removal when pending ends and timer cleanup when a component unmounts.
- [ ] Check fast completion does not flash and slow work does not trigger fake completion.
- [ ] Record actual evidence for each applicable verification-matrix row, including any checks that could not be performed.

**Deliverable:** Recorded visual/accessibility results and corrected presentation defects.

**Completion gate:** Applicable checks pass, or remaining verification blockers are explicitly recorded without claiming completion. Existing lifecycle defects remain documented limitations, not animation fixes.

### Phase 8 — Run final checks and audit frontend-only scope

**Purpose:** Make the final change reviewable and demonstrate that the scope boundary held.

**Work area:** Verification and this plan's execution record. Fixes are limited to defects introduced in permitted UI files.

- [ ] Run relevant admin lint, typecheck, and production build checks using existing project scripts.
- [ ] Distinguish newly introduced failures from pre-existing failures or unavailable environment requirements.
- [ ] Inspect the full task diff against the Phase 1 baseline; preserve unrelated user changes.
- [ ] Confirm package manifests/lockfiles, database files, APIs, server actions, auth logic, data hooks, and other applications were not changed by this work.
- [ ] Confirm no handler, query, subscription, request payload, refresh call, validation rule, or disabled condition changed.
- [ ] Confirm no new global provider, overlay, operation timer, fake progress, or mutation state system was introduced.
- [ ] Update the tracker and execution record with final outcomes and limitations.
- [ ] Provide a concise handoff listing migrated surfaces, validation results, and remaining exclusions.

**Deliverable:** Verified frontend-only implementation and completed execution record in this document.

**Completion gate:** Section 10's definition of done is satisfied for the selected inventory, and no prohibited change is present. An environmental verification blocker is reported honestly and does not count as a passing check.

### Execution record

Populate this table as work occurs; do not pre-fill successful results.

| Phase | Changed files / delivered surfaces | Verification and evidence | Exclusions / blockers | Outcome |
|---|---|---|---|---|
| 1 | `plans/Global_Loading_and_Transition_System_Implementation_Plan.md` only; populated navigation, loading-state, action, and file-boundary inventories. No app source changes. | Read root/admin `AGENTS.md`; Expo v57.0.0 and installed Next.js 16.3 loading/navigation guides; inspected routes, action owners/disabled rules, hooks, shell, and styles; searched admin route boundaries and loading call sites; `git diff --check` returned no whitespace findings. CUA browser inventory showed no open tabs. | Existing modified plan and untracked `.claude/settings.local.json` preserved. No authenticated view was available for screenshots; code-level dimensions/theme recorded. Unused `use-households`, unwired map loading prop, and request-history error-lifecycle limitations recorded. | Complete |
| 2 | `apps/admin-web/src/components/loading/{spinner,skeleton,loading-button-content,loading-status,page-skeleton}.tsx`; loading-only motion rules in `apps/admin-web/src/app/globals.css`. Temporary visual preview route was removed after inspection. | `npm run lint` and `npm run typecheck` in `apps/admin-web` passed; `git diff --check` reported no whitespace errors. Isolated browser preview showed normal/pending and long-label buttons plus table/dashboard skeletons in light/dark themes. An 80ms preview completion returned to the normal button name before the 120ms indicator reveal. AX tree showed one active button label and one page status; reduced-motion static appearance and scoped CSS rule inspected. | No display-delay hook was needed. Browser/system `prefers-reduced-motion` emulation was unavailable; the static treatment was inspected in an isolated visual mock and its media-query rule was code-checked. The existing session proxy's Supabase fetch stalled for about 26 seconds and Google Fonts were unreachable, so the temporary preview used the app's font fallback; no auth flow or credentials were used. | Complete |
| 3 | `apps/admin-web/src/app/(admin)/loading.tsx`, route fallbacks for `dashboard`, `incident-map`, `emergency-qr`, `requests/[requestId]`, and `settings`; matching map, QR, detail, and settings compositions in `src/components/loading/page-skeleton.tsx`. | Admin `npm run lint` and `npm run typecheck` passed after cleanup; `git diff --check` passed. An isolated visual preview checked all six variants in dark theme; each accessibility snapshot exposed one route status, and skeleton primitives are `aria-hidden`. A temporary Next.js route with a 12-second suspended page visibly showed its loading boundary, then its ready content. Installed Next.js 16.3 loading and Link/prefetch guides were inspected: the fallbacks remain inside the existing shell, add no delay/fade, and preserve native route behavior; automatic link prefetch is production-only. | The actual authenticated admin route could not be observed because the local `proxy.ts` Supabase auth fetch failed with `AuthRetryableFetchError` and stalled requests; the admin layout waits for auth/profile before showing the shell. Prefetch navigation could not be observed at runtime in development mode, and a production build belongs to Phase 8. Google Fonts were unavailable, so previews used the app's fallback font. The temporary route fixture was removed. No credentials or app data actions were used. | Complete — phase gate satisfied; live authenticated/prefetch runtime observations are documented limitations. |
| 4 | `apps/admin-web/src/components/navigation/link-pending-indicator.tsx`; presentation-only integration in `apps/admin-web/src/components/admin/sidebar-nav.tsx`; scoped collapsed-slot styles in `apps/admin-web/src/app/globals.css`. | Admin `npm run lint --workspace=@barangayan/web`, `npm run typecheck --workspace=@barangayan/web`, and `git diff --check` passed. A temporary local preview showed expanded trailing-slot and collapsed icon-slot markers without sidebar overflow; the accessibility tree retained collapsed labels, and keyboard Tab showed a visible focus ring. A slow-to-fast click sequence settled on the latest destination; browser back/forward restored route content without a stale marker. The installed `useLinkStatus` and `Link` guides were read; hrefs, default prefetch, and pathname matching were source-reviewed unchanged. | The temporary preview routes were removed. A live production-prefetched navigation was not observed because automatic Link prefetch runs only in production and Phase 8 build verification is outside this selected phase. The authenticated admin route was not exercised; preview used `SidebarNav` directly and did not use credentials or invoke app data actions. Google Fonts were unreachable, so the preview used the existing font fallback. Reduced-motion browser emulation was unavailable; the existing scoped static-motion rule and the new collapsed-icon rule were code-reviewed. | Complete — Phase 4 gate met; production-prefetch runtime observation remains unavailable and is recorded above. |
| 5 | `apps/admin-web/src/app/(admin)/settings/settings-form.tsx`; Settings Save button and existing local loading section. | Read the root Expo SDK 57.0.0 reference and installed Next.js 16.3 client-component, loading-boundary, Link-status, and accessibility guides before editing. `npm run lint --workspace=@barangayan/web` passed; `npm run typecheck --workspace=@barangayan/web` passed; `git diff --check` passed. Source diff confirms the `handleSubmit` body, validation, `updateSettings` call, `router.refresh()`, error branches, form values, and both `disabled={saving}` expressions are unchanged. The user subsequently confirmed testing the pilot and that it works. | The agent could not independently inspect the local visual preview because the browser URL policy rejected it. No real save or backend request was made by the agent. Existing `saving` lifecycle limitation remains unchanged. | Complete — user-confirmed pilot verification; agent lint, typecheck, and source-boundary checks passed. |
| 6 | `apps/admin-web/src/app/(admin)/{about-us/about-us-form.tsx,announcements/announcement-form.tsx,announcements/announcement-row.tsx,emergency-qr/qr-instructions-modal.tsx,evacuation-centers/evacuation-center-form.tsx,evacuation-centers/evacuation-center-row.tsx,faq/faq-form.tsx,faq/faq-row.tsx,health/applicants/applicant-detail-modal.tsx,health/applicants/applicants-table.tsx,health/drive-detail-modal.tsx,health/drive-table.tsx,households-residents/households-table.tsx,households-residents/member-form-modal.tsx,hub/emergency-form.tsx,incident-reports/incident-actions.tsx,incident-reports/incident-detail-modal.tsx,incident-reports/incident-table.tsx,requests/requests-table.tsx,residents/resident-directory.tsx,services/document-type-form.tsx,services/document-type-row.tsx,staff/staff-form.tsx,terms-privacy/content-form.tsx,transactions/transactions-table.tsx,waste-management/schedule-form.tsx,waste-management/schedule-row.tsx,waste-management/zone-form.tsx,waste-management/zone-row.tsx}` plus `apps/admin-web/src/components/admin/{confirm-button.tsx,editable-data-table.tsx,header.tsx,notifications-drawer.tsx,request-status-actions.tsx}`; reused existing loading primitives and flags for inventoried submit, edit, shared-busy, notification, table-editor, and lookup surfaces. | `npm run lint --workspace=@barangayan/web` passed. Initial `npm run typecheck --workspace=@barangayan/web` exposed an obsolete generated `.next/dev/types/validator.ts` reference to the removed temporary `/phase-six-preview` page; after removing that single stale generated validator, typecheck passed. `git diff --check` passed. Source diff review found only loading content/ARIA presentation changes plus indentation changes caused by group wrappers; handlers, validation, disabled expressions, queries, subscriptions, requests, and refresh behavior were source-reviewed unchanged. | Visual inspection was unavailable: the browser policy rejected the local fixture URL; the authenticated app preview failed its Supabase auth and Google Fonts requests. No visual pass is claimed; no browser workaround or credentialed app operation was attempted. Resident request history, dormant `MapFilterPills.loading`, unused `use-households`, and the unlisted `waste-management/trash-incident-table.tsx` remain excluded from this phase. No dedicated upload-progress state exists. Separate resident Android/web registration edits, a shared auth-schema edit, and an untracked resident iOS plan are present in the working tree and were left untouched. | Complete — Phase 6 formal gate met; visual inspection remains unverified and is not claimed as passed. |
| 7 | — | — | — | Not started |
| 8 | — | — | — | Not started |

## 9. Verification matrix

Use browser throttling, isolated UI fixtures, or mocks. Do not change a backend or invoke destructive/payment operations merely to exercise a spinner.

| Scenario | Required result |
|---|---|
| Fast completion | No flashing spinner or artificial delay |
| Slow action | Truthful local feedback; original disabled rules |
| Existing failure | Existing error behavior; no invented success |
| Route suspension | Correctly sized content fallback; no duplicate shell |
| Initial admin authentication wait | Boundary limitation documented; no auth refactor |
| Prefetched route | Instant navigation without forced indicator |
| Rapid route changes | No stale custom marker or blocked navigation |
| Back/forward | Existing router behavior preserved |
| Background refresh | No newly introduced content replacement |
| Collapsed sidebar | Fits icon slot; stable name; no overflow |
| Text/icon buttons | Stable dimensions and one accessible name |
| Reduced motion | Static feedback; no shimmer or rotation |
| Keyboard/screen reader | Preserved focus; concise, non-duplicated announcements |
| Light/dark theme | Consistent spacing and visible contrast |
| Pending ends/unmount | Visual timer cleanup; no lingering marker |
| Behavior comparison | Same handlers, endpoints, payloads, refreshes, and subscriptions |

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
