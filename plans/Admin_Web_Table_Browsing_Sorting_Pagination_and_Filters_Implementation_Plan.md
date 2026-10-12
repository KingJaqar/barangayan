# Admin Web Table Browsing, Sorting, Pagination, and Filters

**Status:** **Phases 0–5 are COMPLETE.** Phase 5 integrates Incident Reports, Health and Medical Applicants with the shared foundation and server adapters; section 18 records authenticated browsing, aggregates, actions, details, Realtime, permissions and verification results. **Open owner decision:** a pre-existing incident-removal RLS defect (proposed fix: migration `0113`, not yet authorized or created) is tracked with the shared layout-shift observation under Phase 6's carried-forward items. Migrations 0110–0112 remain release prerequisites and were applied only to disposable fixtures; Phase 5 added none. Phase 6 remains unstarted. Sections 6–17 retain historical evidence. No deployment, production-data or resident Android UI change is authorized by this execution.

**Original inspection:** 2026-10-08, Asia/Manila. **Saved revision:** 2026-10-12, Asia/Manila.

**Evidence:** Original inspection findings are revalidated and corrected by section 6 and [Phase 0 evidence](C:/Users/User/barangayan/plans/evidence/admin-table-phase0/README.md). Static source, mocked-page tests, local read-only SQL fixtures, hosted catalog reads, and zero-row anon API probes are distinguished from authenticated/browser verification.

### Historical user authorization and current scope

The user explicitly stated: “i approve everything you need in order to complete all phases, now update the plan accordingly that any other tools like docker, or something is approved with my authorization”. This supersedes the earlier Phase 0-only execution restriction and the lack of authorization to provision its isolated runtime test environment. It authorizes the necessary work for Phases 0–6 of **this plan**, within the scope and verification gates below.

- Use Docker, existing or necessary local runtimes, Supabase CLI/API/connectors, database clients, browser automation, build/test tools, and necessary test dependencies. Install or configure missing tooling when needed for this work; evaluate existing tooling first and avoid unnecessary dependencies.
- Create and run isolated local/test services and databases, align their schema using repository migrations, provision synthetic administrator/resident/removed-administrator accounts and multiple tenants, seed deterministic representative datasets, and run authenticated query, permission, browser, concurrency, accessibility, and performance checks. Clean up only resources created for this task after verifying their identity and ownership; preserve existing databases and unrelated containers, volumes, accounts, and data.
- Implement the scoped admin frontend changes in later phases, add minimal backend read support only for demonstrated query limitations, and create required sequential migrations after rechecking the highest repository prefix. Run the required checks and perform the scoped migration/deployment steps described in Phase 6 after their verification gates pass.
- Continue authorized work without requesting the same permission again. Record actual results, failures, unresolved checks, and resource cleanup. Use bounded operations, explicit timeouts, and finite retries; investigate failures before retrying.

Authorization is permission to perform work, not evidence of successful execution or completion. Finish the Phase 0 evidence gate before beginning its dependent implementation phases. Tool sandbox/automatic approval requirements still apply; missing credentials, unavailable physical test equipment, or rejected operations must be reported accurately. Do not store or expose secrets in evidence artifacts.

The permanent cancellation of the separate Android usability phase remains in force. Preserve the resident Android UI and unrelated working-tree changes. This authorization does not expand the plan to unrelated work, production synthetic fixtures, destructive resets of existing environments, or deletion of real user data. Production changes must be the verified scoped release described in this plan.

## 1. Purpose, scope, and verified inventory

Deliver consistent, accessible table browsing across Requests, Transactions, Resident Directory, Incident Reports, Health, Medical Applicants, Households & Residents, and Staff Members.

This is an implementation plan only. Production readiness must be demonstrated through the verification gates below; it is not an existing verified condition.

The work is frontend-focused. Extend existing admin components and queries first. Modify database read support only when the existing query capabilities cannot satisfy complete-result filtering, ordering, counts, or pagination efficiently and correctly.

Preserve the resident Android UI. Do not start, resume, or reintroduce the cancelled Phase 8 or section I usability work in [Major_Web_AndroidMobile_Improvement_Plan.md](C:/Users/User/barangayan/plans/Major_Web_AndroidMobile_Improvement_Plan.md). Resident web, iOS, unrelated admin tables, and general redesigns are outside scope.

Follow [root AGENTS.md](C:/Users/User/barangayan/AGENTS.md) and [admin-web AGENTS.md](C:/Users/User/barangayan/apps/admin-web/AGENTS.md). The exact [Expo v57 documentation](https://docs.expo.dev/versions/v57.0.0/) was reviewed during inspection; read it before writing implementation code. Also consult the installed Next.js documentation required by the repository.

Preserve unrelated working-tree changes. Existing resident Android and other modifications visible when saving this plan belong to separate work; do not revert or incorporate them. Scope verification must distinguish this implementation's changes from pre-existing changes.

### Verified common implementation

- All eight active tables use `EditableDataTable`, which wraps the table in `TableScrollArea`.
- `TableScrollArea` already provides horizontal scrolling and a synchronized top scrollbar. It lacks a vertical viewport bound, both-axis containment, and an explicit accessible keyboard-scrolling contract.
- Headers are not sticky or sortable. Column resizing is mouse-driven. Editable cells need a keyboard entry path.
- Each screen sorts its received array locally. No explicit unique secondary sort is applied.
- None of the eight tables provides the requested pagination or page-size controls.
- Main queries fetch one batch, followed by filtering in server-page code. Incident category filtering is already applied in its database query.
- Local Supabase configuration limits ordinary API results to 1,000 rows. A single fetched batch therefore cannot establish complete search results, totals, or global sorting.
- `AdminShell` permits page-level horizontal scrolling and lacks explicit minimum-width containment on its main flex area.
- Five screens hold a selected detail snapshot: Directory, Incidents, Health, Applicants, and Households. Requests navigate to a detail/review route; Transactions and Staff have no selected-row detail modal. None has bulk checkbox selection.
- Existing loading components, route loading boundaries, mutation handlers, audit logging, and subscriptions can be retained.

### Screen-by-screen inventory

**Requests**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/requests/page.tsx), [requests-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/requests/requests-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/requests/types.ts).
- Table: Reference, Resident, Document, Status, Payment, Submitted, Notes, Actions; current minimum width 1,360px.
- Source: `service_requests`, document types, and resident profiles through the explicit resident foreign key. Soft-deleted requests are excluded.
- Current database order is creation date descending; the client then sorts reference ascending.
- Search covers reference, resident name, and document name. URL filters are `tab`, `q`, and `doc`; search is debounced by 300ms.
- Initial segment is Active. All currently appears last.
- Preserve legacy creation/edit guards, v2 review navigation, lifecycle actions, archive, lookups, audit logging, and request Realtime refresh.
- Main query failures currently fall through to empty data; introduce an explicit error state.

**Transactions**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/transactions/page.tsx), [transactions-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/transactions/transactions-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/transactions/types.ts).
- Table: Date, Reference, Resident, Document, Method, Amount, Status, Collected By/Source, Refund, Actions; minimum width 1,650px.
- Source: `payments`, related request/document/resident records, and collector profiles.
- Current default is payment creation date descending.
- Search covers request reference, resident, document, and collector. URL filters are `tab`, `method`, and `q`.
- All is already first and initially selected.
- The separate latest-100 request-reference suggestions are an action lookup, not table pagination.
- Preserve paid-amount restrictions, refunds, retry/claim links, creation lookups, audit logging, and action refresh.
- Main query failures currently resemble empty data; introduce explicit handling.

**Resident Directory**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/residents/page.tsx), [resident-directory.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/residents/resident-directory.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/residents/types.ts).
- Wide profile table, including split name fields, contact/address information, birthday, occupation, ID/email/location verification, household count, Joined, and Actions; minimum width 2,840px.
- Source: non-deleted `profiles` with resident role. Household count comes from profile JSON, not the normalized household-member table.
- Current default is persisted `full_name` ascending.
- Search covers the existing name, contact, address, occupation, and ID-type fields. Segments filter email verification; the separate dropdown filters ID presence.
- All is first and selected. Query errors are already surfaced.
- Preserve creation, profile edits, archive, ID review, signed evidence images, request-history loading, and audits.
- Add `updated_at` to the restricted projection for modification sorting.
- The commented historical table is not active. Request History is a card list, not another table.

**Incident Reports**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/incident-reports/page.tsx), [incident-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/incident-reports/incident-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/incident-reports/types.ts), [incident-detail-modal.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/incident-reports/incident-detail-modal.tsx).
- Table: Incident, Category, Reporter, Coordinates, Address, Specific Area Details, Confirmed, Status, Submitted, Actions; minimum width 1,710px, pinned final column.
- Source: non-deleted `incidents`, categories, and reporter profiles through `incidents_reporter_id_fkey`. Preserve this relationship disambiguation.
- Current default is `created_at` descending, displayed as Submitted.
- Search covers title, description, category, reporter name, and reporter email. Category filtering is already database-side.
- Initial segment is Open; All currently appears last.
- Preserve details, creation/editing, confirmations/location fields, status actions, archive, audit logging, surfaced errors, and incident Realtime refresh.

**Health**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/page.tsx), [drive-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/drive-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/types.ts), [drive-detail-modal.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/drive-detail-modal.tsx).
- Table: Drive, Category, Date, Stock, Registrations, Active, Actions; minimum width 900px, pinned final column.
- Source: non-deleted `medical_drives`; registration counts currently come from a separate registration scan. The public SELECT policy also applies to authenticated admins, so RLS alone does not restrict active drives to the admin's tenant; section 6 records the required tenant-contract correction.
- Current default is scheduled `drive_date` ascending. The requested default changes this to creation date descending.
- Search covers title, location, eligibility criteria, and displayed drive-type labels.
- Initial segment is Upcoming; All currently appears last. Upcoming includes Today.
- Current registration counts include cancelled registrations; preserve that meaning.
- Preserve stock/active edits, creation, details, removal, audit logging, surfaced errors, and drive Realtime refresh.
- Replace capped registration scans with complete grouped counts.

**Medical Applicants**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/applicants/page.tsx), [applicants-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/applicants/applicants-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/applicants/types.ts), [applicant-detail-modal.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/health/applicants/applicant-detail-modal.tsx).
- Nested Health registrations table: Applicant Number, Drive, Resident, Age, PWD, Priority Score, Status, Registered At, Actions; minimum width 1,320px.
- Source: `drive_registrations`, medical drives, and `drive_registration_scores!inner`. Resident names are presently attached through a separate profile lookup.
- Current default is registration `created_at` descending.
- Search covers applicant number, drive title, and comorbidities. Resident-name search is not currently supported and must not be added incidentally.
- All is first and selected.
- Global resident-name sorting requires joining names before pagination.
- Preserve inner-score membership, administrator-only score access, computed-field restrictions, registration RPC, details/status/cancellation actions, audits, errors, and registration Realtime refresh.

**Households & Residents**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/households-residents/page.tsx), [households-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/households-residents/households-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/households-residents/types.ts).
- Table lists household members: Name, Resident/Head, Relation, Role, Checked In, Center, Added, Actions; minimum width 1,280px.
- Source: `household_members` and owning profiles. Members are hard-deleted; do not add a nonexistent soft-delete predicate.
- Database creation-date order is overridden by client member-name ascending.
- Search covers member name, head name, relation, and role. Filters are check-in state and relation.
- All is first and selected. Errors are surfaced.
- Preserve add-member RPC, details, inline edits, removal, audit logging, and member Realtime refresh.
- Main `select('*')` already fetches `updated_at`; add it to the declared row type and relevant mutation-return projections when later implementing modification sorting. Turning check-in off must continue clearing its center and timestamp.
- Active dialogs are declared within `households-table.tsx`; inspect the separate member-form file as a dependency rather than assuming it controls those dialogs.

**Staff Members**

- Files: [page.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/staff/page.tsx), [staff-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/staff/staff-table.tsx), [types.ts](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/staff/types.ts), [staff-form.tsx](C:/Users/User/barangayan/apps/admin-web/src/app/(admin)/staff/staff-form.tsx).
- Table: Name, Role, Email, Mobile, Address, Hired, Actions; minimum width 1,215px, pinned final column.
- Source: non-deleted `barangay_officials` joined to profiles. Missing-profile rows are currently excluded.
- Existing database/server role ordering is overridden by final client name ascending.
- Search covers profile name/contact/address and raw official role. Segments distinguish Admins/Staff; the role dropdown is more specific.
- All is first and selected.
- Preserve all current-user self-edit/removal guards, staff creation, audit logging, and action refresh.
- Main query failures currently resemble empty data; introduce explicit handling.

Summary cards on these screens presently describe the unfiltered fetched dataset. Preserve their membership independently of table filters, while correcting capped-count completeness.

## 2. Shared architecture and functional contracts

### State and component interfaces

Keep domain actions within their existing screen components. Introduce shared admin-local browsing state and presentation:

- State: existing search/filter parameters plus `page`, `pageSize`, `sort`, and `dir`.
- Sort descriptor: stable key, visible label, value category, allowed directions, initial direction, and optional corresponding column ID.
- Result: page rows, exact matching total, effective page, page size, applied sort, query identity, and separately handled summaries.
- Selection: stable record ID and detail snapshot, independent of row position.
- Editing: stable record ID, draft, and pending-save state.

Validate URL values against screen-specific allowlists. Invalid values resolve to documented defaults. Do not accept arbitrary database column names or SQL expressions.

Use one shared URL builder and navigation path. Preserve existing filters and use navigation without resetting surrounding page scroll.

The shared panel contains four sibling areas:

1. Search, segmented filters, actions, and sorting controls.
2. Persistent horizontal-scroll access.
3. Bounded table viewport.
4. Range, page-size selector, and pagination.

### Scrolling and persistent access

- Give the panel and relevant flex/grid ancestors `min-width: 0` and constrained maximum width.
- Keep deliberate table column widths. Overflow belongs inside the table viewport.
- Measure available main-viewport height and outside control/footer heights. Recalculate after resizing, sidebar changes, wrapped controls, font changes, and zoom.
- Use a maximum body height rather than stretching short tables or adding filler rows.
- At short heights or increased zoom, keep controls in normal page flow and use a compact body viewport. Avoid a hard minimum height that makes content unreachable.
- Keep one semantic table and one column geometry. Make individual headers sticky with opaque backgrounds and correct stacking.
- Preserve existing action-column width pinning. `pinLastColumn` does not freeze the column during scrolling; sticky action columns are not an existing behavior to preserve. Any later frozen-column proposal needs an explicit implementation/verification contract.
- Retain native body scrollbars and improve the top horizontal mirror.
- Calculate the mirror range from the body's actual maximum horizontal offset, accounting for different viewport widths and vertical scrollbar gutters.
- Synchronize offsets only when they differ; batch work through animation frames and clean up all observers/listeners.
- Show labeled left/right column-scroll buttons whenever horizontal overflow exists. They provide persistent access when the operating system hides scrollbar thumbs.
- Do not claim CSS can force permanently visible native scrollbar thumbs. Stable gutters help classic scrollbars, while overlay/auto-hide behavior remains controlled by the browser and operating system. [Scrollbar-gutter documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter).

### Scroll containment and keyboard behavior

Apply both-axis overscroll containment to the actual table viewport and horizontal strip. A no-overflow scroll container is already at its boundary under the standard. [CSS Overscroll Behavior specification](https://www.w3.org/TR/css-overscroll-1/).

- Mouse wheels, trackpads, and scrollbar dragging must remain within the table at every boundary.
- Vertical input over the horizontal strip scrolls the table body when possible and stops at its boundary.
- Use a table-scoped wheel fallback only if supported-browser testing demonstrates incomplete containment. Normalize wheel units and diagonal/Shift-wheel input without applying deltas twice.
- Let nested editors consume their own scrolling first.
- Preserve Ctrl/Meta-wheel zoom and normal scrolling outside the table.
- Do not install global wheel cancellation or lock the page.

Make the viewport a named, visibly focusable region. When it or noninteractive table content is the keyboard scroll target:

- Arrows scroll the corresponding axis.
- Page Up/Down and Space/Shift+Space scroll by visible body height.
- Home/End reach vertical extremes.
- Boundary commands cannot scroll ancestors.
- Tab and Shift+Tab always leave normally.

Preserve input editing, select navigation, button activation, and dialog shortcuts. Give the horizontal strip an equivalent labeled keyboard path.

### Pagination

- Default page size: **10**.
- Options: **10, 20, 30, 50, 100**, exactly.
- Provide First, Previous, Next, and Last consistently.
- Display current range, exact matching total, and valid page information.
- For zero matches, show `Showing 0–0 of 0`; disable page navigation and avoid “Page 1 of 0.”
- For 23 matches at size 10, the final page shows 21–23.
- For seven matches at size 100, render seven rows.

Search, filters, sort field, direction, and page size reset to page 1 atomically. Page-only navigation retains all other state.

After committed browsing changes, reset table vertical position to the top. Preserve horizontal position, clamped to its valid range, and user column widths.

Keep the current page after ordinary refresh/addition where valid. After removal or an edit changes membership, clamp to the last valid page.

A direct-query adapter may perform at most one corrective page request after discovering an invalid page. If concurrent changes invalidate that correction again, show a recoverable results-changed state with Retry; do not enter a request loop. Where one consistent count/page operation is necessary, use minimal read support that returns the effective page directly.

### Sorting defaults and field meaning

| Screen | Default label and actual field | Initial direction |
|---|---|---|
| Requests | Reference — `service_requests.reference_number` | Lowest reference first |
| Transactions | Date created — `payments.created_at` | Newest first |
| Resident Directory | Name — `profiles.full_name` | A–Z |
| Incident Reports | Submitted — `incidents.created_at` | Newest first |
| Health | Date created — `medical_drives.created_at` | Newest first |
| Medical Applicants | Registered — `drive_registrations.created_at` | Newest first |
| Households & Residents | Name — `household_members.name` | A–Z |
| Staff Members | Name — joined `profiles.full_name` | A–Z |

**Verified date distinctions:**

- Incident sort, Submitted cells/edits, and details use `incidents.created_at`; the inspected schema has no separate `submitted_at`.
- Applicant sort, Registered At cells, and details use `drive_registrations.created_at`; there is no separate `registered_at`.
- Request Submitted also uses request `created_at`; legacy editing can backdate it.
- Health's current Date column is scheduled `drive_date`, not creation.
- Joined is profile creation; Added is member creation; Hired is `date_hired`.
- ID submission, payment, refund, modification, scheduled-drive, and registration dates remain distinct.

Request references are generated as `REQ-YYYY-00001`, using a sequence that is not defined to reset annually. Custom references are permitted. Current client order uses lexical `localeCompare`; the proposed numeric-token order intentionally differs for unpadded references (`...-2` versus `...-10`). Reference order must not be labeled as creation chronology.

### Additional sort choices

| Screen | Additional supported choices |
|---|---|
| Requests | Resident, document type, status, payment status, Submitted, date modified |
| Transactions | Request reference, resident, document type, method, status, amount, date modified, paid date, refund date |
| Resident Directory | First name, last name, email, email verification, ID status, Joined, date modified |
| Incident Reports | Title, category, reporter, status, confirmation count, date modified |
| Health | Title, category, Drive date, active state, registration count, stock remaining, date modified |
| Medical Applicants | Applicant number, resident, drive title/category, status, age, priority score, date modified, Drive date |
| Households & Residents | Head name, relation, member role, check-in state, center, Added, date modified, check-in date |
| Staff Members | Official role, email, Hired, staff-record creation/modification, account-profile modification |

Advertise each choice only when its global query implementation is complete.

- Text: A–Z/Z–A; initial A–Z.
- Dates: Oldest first/Newest first; initial Newest first.
- References: Lowest/Highest reference first; initial Lowest.
- Numeric values: Lowest/Highest first; initial Highest.
- Booleans: explicit positive/negative-state choices.
- Status/type/role sorting follows displayed labels, including a defined readable fallback for unknown values.

Comparison rules:

- Sort the complete filtered set before pagination.
- Database ordering is authoritative; do not independently re-sort page rows.
- Normalize sort text consistently, trim boundary whitespace, and treat blank text as missing.
- Use case-insensitive comparison with accents retained.
- Compare numeric reference portions numerically: `...-2` precedes `...-10`.
- Padded/unpadded numeric equivalents tie, then use the secondary key.
- Put missing values last in both directions.
- Compare timestamps as instants; compare calendar dates as dates.
- Use Asia/Manila for timestamp display and Health's “today” calculation.
- Append the base record's unique ID ascending to every primary sort.

Use a query-local collation/sort key rather than changing stored values or source-column uniqueness rules. Verify the actual database provider/version before using ICU. If unavailable, implement a tested database-side normalized/natural sort key with the same required fixtures.

Keep active field and direction visible outside the scrolling body. Sortable header buttons and toolbar controls share one state. Apply `aria-sort` only to the matching active header. Do not mark First Name when full name is active, or Drive date when creation date is active. [WAI sortable-table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/).

### Segmented-filter order

| Screen | Required order | Initial selection |
|---|---|---|
| Requests | All → Active → Processing → Ready for Pickup → Completed → Cancelled | Active |
| Transactions | All → Pending → Paid → Failed → Expired → Refunded | All |
| Resident Directory | All → Verified → Unverified | All |
| Incident Reports | All → Open → In Progress → Resolved → Withdrawn → Unresolved | Open |
| Health | All → Upcoming → Today → Past → Inactive | Upcoming |
| Medical Applicants | All → Pending → Confirmed → Attended → Cancelled | All |
| Households & Residents | All → Checked In → Not Checked In | All |
| Staff Members | All → Admins → Staff | All |

Move the existing All option first while retaining every other option's relative order and value. Keep route defaults explicit so reordering does not change initial selection.

Apply the same rule to reachable nested views. Do not invent All options or reorder unrelated dropdown choices.

### Selection, editing, loading, and accessibility

- Retain selected detail records by stable ID across sorting, filtering, and pagination.
- Absence from the current page does not imply deletion.
- Revalidate selected details independently when necessary. Confirmed deletion/access loss produces an unavailable state and safe focus restoration.
- Restore focus to the original trigger when present, otherwise a stable table control.
- Introduce no bulk-selection system.

Before user-requested navigation, settle the active edit according to existing save/cancel behavior. A failed save preserves its draft and Retry/Cancel access. Defer disruptive refresh while editing, then reconcile without changing the edited record's identity.

Reuse existing loading components:

- Initial loading has no invented count.
- Pending results remain clearly identified; stale row actions cannot operate as though they belong to the new query.
- Failed queries do not appear as zero matches.
- Retry retains search, filters, sort, and page size.
- Summary/option failures are separate from table failure; never substitute zero totals or silently incomplete options.

Provide visible labels, focus indicators, native table semantics, keyboard editing/resizing/details actions, and one polite announcement for committed sort/range changes. Mark pending regions busy.

Wrap controls and pagination at smaller widths. Preserve usable column widths and internal overflow. Long names, addresses, references, and descriptions must remain discoverable through wrapping, resizing, and existing details—not hover-only tooltips.

### Preventing uncontrolled loops and stale results

- Compare canonical URL state before navigation or correction.
- Maintain one search debounce timer; cancel it on immediate navigation and Back/Forward.
- Immediate control changes commit the current search draft.
- Commit only the latest query identity.
- Coalesce existing refresh events into one active refresh and one pending reconciliation.
- Do not retry failed queries automatically without a bounded policy.
- Update measurements only when dimensions change.
- Synchronize scroll offsets only when they differ.
- Clean up timers, animation frames, observers, listeners, and subscriptions.
- Keep network requests out of scroll/resize measurement effects.

## 3. Query strategy and file-level changes

### Frontend-first query strategy

For each screen, first attempt the complete contract using existing session-backed Supabase queries:

1. Apply authorization and existing membership predicates.
2. Apply every search/filter condition.
3. Apply global primary ordering and unique ID tie-break.
4. Request exact matching count.
5. Request only the selected page through the inclusive range.

Joined fields do not automatically justify a new RPC. Supported parent ordering through many-to-one/one-to-one relations and related-resource filtering should be evaluated first. [PostgREST resource embedding](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html), [Supabase ordering](https://supabase.com/docs/reference/javascript/order), [range](https://supabase.com/docs/reference/javascript/range), [exact count](https://supabase.com/docs/reference/javascript/select).

Introduce narrow read-only database support only for demonstrated gaps, such as natural/normalized ordering, complete cross-relation search, aggregate sorting/counts, or consistent page correction.

- Prefer screen-specific `SECURITY INVOKER` read helpers over a generic dynamic SQL endpoint.
- Preserve session credentials, existing RLS, tenant boundaries, and administrator-only score protection.
- Do not introduce service-role access or change write workflows.
- Bind search values and allowlist sort keys.
- Preserve nullable relationships and existing exclusions.
- Prevent join fan-out from duplicating base records.
- Preserve literal substring searches, including wildcard punctuation.
- Preserve Requests/Transactions' existing untrimmed search behavior; retain trimming on the other screens.
- Preserve independent summary membership and required action lookups.
- Do not download entire tenant datasets to implement browser sorting.
- Add indexes only after representative query plans demonstrate a need.

Health counts must be complete, including zero-registration drives and currently counted cancelled registrations. Applicant names must participate in the parent query before sorting/paging.

Offset pagination remains the planned interaction. Deep-page performance must be measured; do not silently replace page navigation with different behavior.

Any migration uses the next unused four-digit prefix. At the 2026-10-11 save, the repository contains migrations through `0109_invalidate_changed_profile_email_verification.sql`, so the next number is **0110 at this inspection**, subject to rechecking immediately before creation. Never renumber existing migrations.

### Existing shared files

| File | Planned change |
|---|---|
| [table-scroll-area.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/table-scroll-area.tsx) | Opt-in bounded viewport, containment, keyboard scrolling, exact mirror synchronization, persistent horizontal controls, cleanup |
| [editable-data-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/editable-data-table.tsx) | Stable column IDs, sticky headers, controlled header sorting, keyboard edit/resize paths, edit coordination |
| [admin-shell.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/admin-shell.tsx) | Minimum-width containment and viewport measurement anchor |
| [globals.css](C:/Users/User/barangayan/apps/admin-web/src/app/globals.css) | Scoped table layout, sticky/focus/scrollbar rules |
| [data-table.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/data-table.tsx) | Optional serializable wrapper configuration only if necessary; preserve server-compatible composition |
| Existing loading components | Reuse bounded loading/status presentation |

Keep unrelated table callers on existing defaults. Dashboard smoke testing covers shared-component compatibility.

### New admin-local modules

Planned under `C:/Users/User/barangayan/apps/admin-web/src/`:

- `components/admin/table-browse-panel.tsx`
- `components/admin/table-browse-controls.tsx`
- `components/admin/table-pagination.tsx`
- `components/admin/segmented-filter.tsx`
- `lib/admin-tables/browse-state.ts`
- `lib/admin-tables/sort-definitions.ts`
- `lib/admin-tables/queries/` for server-only screen adapters
- `hooks/use-table-browse-navigation.ts`

Each inventoried server page parses validated state and returns bounded rows/metadata. Each client removes local array sorting and integrates the shared panel while preserving domain actions.

Each screen's `types.ts` retains existing filter values and gains the necessary browse contracts. Directory needs `updated_at` in its restricted SELECT and DTO; household main SELECT already includes it and needs DTO/mutation-return alignment. Move server-page-declared row types into screen type modules only where the later adapter changes require it.

Detail modals change only where stable selection, refresh coordination, focus restoration, or verified date wording requires it.

Database migrations, generated function types in [database.ts](C:/Users/User/barangayan/packages/shared/src/types/database.ts), and SQL tests are conditional on necessary read support. Do not modify shared resident contracts.

Add admin-local Vitest tests for state/components and Playwright browser tests. These are proposed test additions; the admin package currently exposes lint, typecheck, and build without a dedicated test setup.

## 4. Execution phases: Phase 0 through Phase 6

These phases belong to this admin web plan. They do not authorize any cancelled Android work.

### Phase 0 — Baseline and contract verification

**Execution status (2026-10-11): COMPLETE.** Source contracts, deterministic fixtures, read-only hosted inspection, and representative isolated Auth/REST/Chromium/Realtime checks are recorded in section 6 and `runtime-completion.json`. All verification criteria have supporting evidence; `runtime-cleanup.json` confirms removal of the temporary resources. Existing defects are verified baseline findings rather than silently repaired. Later phases remain unstarted and dependent on their completion gates; unrelated database state is preserved.

**Current execution revalidation:** Section 13 confirms unchanged source/runtime-report linkage, fresh hosted/local catalogs and aggregate scale, 55 passing source/fixture tests, 11 passing SQL assertions, passing admin typecheck and affected-file lint, and preservation of all 3,483 pre-existing files. Browser/Auth/Realtime observations are retained executed evidence, not newly executed flows. No outstanding Phase 0 implementation requirement was found.

**Work**

- Recheck repository instructions, required documentation, working-tree changes, and highest migration prefix.
- Confirm source-to-label mappings, all active tables, nested filters, search predicates, summaries, selection, edit guards, and subscriptions.
- Check deployed/local schema alignment, supported related-query capabilities, collations, indexes, and representative data scale.
- Create synthetic fixtures for comparison, paging, permissions, and concurrency.
- Record which existing queries meet the contract and which require minimal read support.

**Completion gate**

Every screen has a documented field/filter/sort contract. Unknown runtime facts are explicitly identified. Backend changes have a demonstrated requirement rather than a blanket eight-RPC proposal.

### Phase 1 — Shared frontend foundation

**Execution status (2026-10-11): COMPLETE.** The current prompt explicitly authorized implementation of this phase. Section 14 and the Phase 1 evidence record the completed foundation and its fixture acceptance gate. Earlier sections titled “Requested Phase 1” describe baseline-only audits, not this implementation. Phases 2–6 remain outside this request.

**Dependency:** Phase 0 contracts.

**Work**

- [x] Add validated browse state, navigation, sort descriptors, and shared controls.
- [x] Extend bounded scrolling, sticky headers, persistent horizontal access, and responsive layout.
- [x] Add pagination with the exact page-size options.
- [x] Add accessible segmented controls, keyboard editing/resizing, focus behavior, and announcements.
- [x] Establish loop prevention, debounce cancellation, query identity, and observer cleanup.

**Completion gate**

Fixture-based component/browser tests prove full row/column reachability, aligned headers, both-axis containment, focus escape, accessible controls, and bounded layout. Unrelated shared-component callers retain their behavior. **Verified:** 51 unit tests, 11 fixture groups on each of Chrome/Firefox/WebKit, affected-file lint, admin typecheck and webpack production build passed. Edge and manual/physical-input checks remain recorded release limitations; native browser zoom was approximated with equivalent viewports and CSS zoom. No authenticated route integration is claimed.

### Phase 2 — Data-query correctness

**Execution status (2026-10-11): COMPLETE.** Server adapters, invoker read projections and measured read-performance prerequisites pass the section 15 acceptance checks. Route integration remains Phases 3–5.

**Dependency:** Phase 0 contracts; integrates with Phase 1 interfaces.

**Work**

- [x] Implement server-only adapters using existing queries wherever sufficient.
- [x] Move complete filtering and ordering before pagination.
- [x] Implement exact totals, bounded page correction, and independent summaries.
- [x] Add only necessary read helpers and measured indexes.
- [x] Preserve joined membership, tenant access, score privacy, and literal search semantics.
- [x] Verify missing values, numeric references, label ordering, and stable ties.

**Completion gate**

A 1,505-record fixture is completely searchable and pageable. Combined unchanged pages match the independently expected ordering. Counts and page membership are correct; authorization and query-performance evidence pass. **Verified:** all 132 sort/direction runs, five sizes, 33 filter combinations, permissions and summary checks pass. All nine representative 10k-row adapter/API benchmarks meet 500ms p95 (44.75–476.82ms). See section 15 for scope and limits.

### Phase 3 — Requests and Transactions

**Execution status (2026-10-12): COMPLETE for this phase's two-route integration gate.** Section 16 and the [Phase 3 evidence](C:/Users/User/barangayan/plans/evidence/admin-table-phase3/README.md) record the implemented flows and executed checks. Production release and the remaining routes remain outside this request.

**Dependency:** Phases 1 and 2.

**Work**

- [x] Integrate both wide tables as the initial production-flow pilot.
- [x] Apply Reference ascending and payment Date created descending.
- [x] Move Requests All first while retaining Active.
- [x] Preserve request contract guards, v2 review, payment restrictions, refunds, lookups, audit logging, and refresh behavior.
- [x] Introduce explicit query failures and retry states.

**Completion gate**

Defaults, global related searches, reference ordering, pagination, persistent horizontal access, rapid navigation, and existing row actions pass end-to-end. **Verified:** both 1,505-row routes, all 34 sort/direction combinations, five sizes, independent errors/retries, action/creation/archive flows, draft failure/retry, actual Realtime deferral and ten mount cycles pass. Chrome/Firefox/WebKit integrated pilot checks, eight route permission cases, 65 unit tests, full admin lint, typecheck and webpack build pass. External refund submission is mocked; release/environment limitations remain explicit in section 16.

### Phase 4 — Directory, Households, and Staff

**Execution status (2026-10-12): COMPLETE for this phase’s three-route integration gate.** Section 17 and the [Phase 4 evidence](C:/Users/User/barangayan/plans/evidence/admin-table-phase4/README.md) record implemented flows and executed verification. Later phases remain unstarted.

**Dependency:** Successful Phase 3 pilot — satisfied by section 16.

**Work**

- [x] Integrate name-based sorting and additional supported fields.
- [x] Add required modification-date projections and DTO/mutation-return alignment.
- [x] Preserve directory JSON household counts and normalized member rows as separate concepts.
- [x] Implement stable selected-detail identity and focus restoration.
- [x] Preserve member check-in cleanup and every staff self-edit/removal guard.

**Completion gate**

Long, mixed-case, missing, and duplicate name fields sort correctly across pages. Detail selection remains tied to the same ID. Search, ID review, member actions, and staff permissions remain correct. **Verified:** all 48 advertised sort/direction combinations, complete concatenated pages on the three 1,500+ row routes, five sizes, combined filters, summaries, beyond-cap search/options, errors/retries and one page correction pass. Stable details, failed drafts, ID verification/revocation/history/audits, member creation/removal/check-in cleanup, staff guards, actual Realtime deferral and ten mount cycles pass. Chrome/Firefox/WebKit, 12 route permission cases, 33 shared browser fixture groups, 65 unit tests, full admin lint, typecheck and webpack production build pass. Storage images/signing are synthetic; release/environment limitations remain explicit in section 17.

### Phase 5 — Incidents, Health, and Applicants

**Execution status (2026-10-12): COMPLETE for this phase’s three-route integration gate.** Section 18 and the [Phase 5 evidence](C:/Users/User/barangayan/plans/evidence/admin-table-phase5/README.md) record implemented flows and executed verification. Phase 6 remains unstarted.

**Dependency:** Phases 1 and 2; shared pilot corrections from Phases 3–4 — satisfied by sections 14–17.

**Work**

- [x] Apply Submitted and Registered defaults to their verified creation fields.
- [x] Change Health's default to creation date descending while retaining separate Drive date sorting.
- [x] Move All first in Incident and Health without changing initial selection.
- [x] Add complete registration aggregates and global applicant name sorting.
- [x] Preserve score privacy, inner-score membership, drive buckets, registration actions, and existing subscriptions.

**Completion gate**

Date meanings are correct throughout controls, queries, cells, and details. Today remains included in Upcoming. Counts, aggregate sorts, protected scores, and nested Applicants browsing pass end-to-end. **Verified:** all 50 advertised sort/direction combinations and complete unchanged concatenations on the three routes; five sizes, combined filters, independent summaries, Today ⊂ Upcoming, >1,000 and zero registration aggregates, missing-score exclusion, global resident-name order, errors/retries and one page correction. Creation, status, active-state, registration RPC and cancellation actions, failed drafts, detail dates and revalidation, actual Realtime deferral and ten mount cycles pass. Chrome/Firefox/WebKit, 12 route and 18 query permission cases, 33 shared fixture groups, 68 unit tests, full admin lint, typecheck and webpack production build pass. Incident removal is blocked by a pre-existing RLS defect recorded in section 18; it is not a Phase 5 regression.

### Phase 6 — Production verification and release preparation

**Current execution restriction:** NOT STARTED; no migration application, deployment or production-data change is authorized by the current request.

**Dependency:** All prior completion gates.

**Work**

- Run the complete functional, browser, accessibility, race, permission, and performance matrix.
- Run admin lint, typecheck, and production build.
- Review the final diff for resident Android changes introduced by this work, unrelated edits, and shared-contract regressions; preserve the recorded pre-existing working tree.
- Record evidence and unresolved environment limitations.
- Prepare migration-first deployment when read dependencies exist, compatible old-client behavior, and admin-build rollback.
- Define release monitoring for query errors, invalid-page corrections, failed mutations, and slow browse requests using existing observability.
- Carry forward the open items from section 18 (below).

**Open items carried forward from Phase 5 (2026-10-12)**

- [ ] **Owner decision required — incident removal RLS defect.** Administrators cannot soft-delete incidents: the only administrator-reachable `incidents` SELECT policy (migrations 0022/0025) requires `deleted_at IS NULL`, so the UPDATE fails with `42501`, and Realtime withholds soft-delete events from administrators. This predates this plan and is not a Phase 5 regression. **Proposed fix, not authorized or created:** next sequential migration (currently `0113_admin_read_deleted_incidents.sql`; recheck the highest prefix first) adding an administrator SELECT policy on `incidents` scoped to the active admin's own barangay without a deletion filter, mirroring `admins read all medical drives`. It would also need verification that resident/anon/foreign-admin visibility is unchanged, admin removal persists and audits, Realtime delivers the event, and the existing browse views still exclude deleted rows. Until the owner decides, incident removal remains a known failing action, recorded in this release's evidence.
- [ ] **Shared table layout shift.** Every integrated route first renders with `table-layout: auto` and switches to measured `fixed` layout after hydration, widening columns once (for example Incident Reports 1,787 → 2,257px). Layout is stable afterwards and actions remain reachable. Decide during release verification whether the initial geometry should match the settled geometry. Any change belongs to the shared Phase 1 components and must rerun all eight routes' browser checks.

**Completion gate**

All acceptance criteria below pass with recorded evidence. Open items above are either resolved with evidence or explicitly accepted by the owner as release limitations. Missing physical-browser/input coverage is marked unverified and completed before claiming that coverage. No production-readiness claim is based solely on static inspection.

Deploy additive read dependencies before the consuming admin build. Roll back the admin build if needed; do not destructively revert historical migrations. Removing unused read additions requires a later dependency-checked sequential migration.

## 5. Verification, acceptance criteria, and assumptions

### Required test scenarios

Use synthetic records covering:

- 0, 1, 7, 10, 11, 23, 100, 101, and 1,505 matching rows.
- Every page size and partial final pages.
- Matches beyond the original 1,000-row API cap.
- Duplicate names, references, timestamps, scores, and labels.
- Mixed capitalization, accents, Unicode, numeric reference tokens, custom references, nulls, and blank values.
- Missing related profiles/documents/categories/collectors.
- Long names and wide/unbroken column content.
- Slow loads, query/summary/options errors, failed edits, and permission loss.
- Rapid typing/filter/sort/page-size changes, delayed responses, Back/Forward, repeated mounting, and Realtime bursts.
- Adds, removals, membership-changing edits, and selected-record deletion.
- Multiple tenants, ordinary residents, and removed administrators.

Verify supported Chrome/Edge, Firefox, and Safari/WebKit behavior. Record versions. Supplement automation with Windows/macOS physical wheel/trackpad and scrollbar-setting checks.

Test 100%, 200%, and 400% zoom, narrow widths, short windows, sidebar states, dark mode, and forced colors. Verify keyboard and screen-reader flows manually in addition to automated accessibility checks.

### Measurable acceptance criteria

1. All eight routes implement the specified defaults and exactly five page-size options.
2. Rows rendered equal the smaller of page size and remaining matching records.
3. Counts/ranges are exact; empty results never show an invalid page label.
4. Search/filter/sort/size changes commit page 1; refresh/removal resolves to a valid page without uncontrolled retries.
5. A 1,505-row fixture is fully searchable; concatenated unchanged pages have no ordering gaps or duplicate IDs.
6. Every advertised sort works globally in both directions, with nulls last and base-ID ties.
7. All segmented sequences and initial selections match the plan.
8. Every row, column, and action remains reachable inside the table.
9. Table/control layout causes no ancestor horizontal overflow greater than one CSS pixel.
10. Ten continued boundary inputs on each axis leave ancestor scroll positions unchanged within one CSS pixel.
11. Headers remain visible and column boundaries align within one CSS pixel after scrolling/resizing.
12. Horizontal access works at the first row and with auto-hidden native scrollbars.
13. Pagination, page size, and sorting remain outside the row scroller.
14. Keyboard controls have visible focus; Tab exits; sort/result announcements match committed state.
15. Existing permissions, searches, actions, summaries, selected identities, and edit drafts are preserved.
16. Errors remain distinguishable from empty success; Retry preserves the query.
17. Stress tests show no growing listener/subscription counts, observer feedback, stale commits, or unbounded request loops.
18. Main-table transport/rendering is bounded to at most 100 rows; required independent lookups remain separate.
19. Query/security tests and admin lint/typecheck/build pass.
20. This work introduces no resident Android UI changes and excludes cancelled Android work.

Benchmark representative default, joined, aggregate, substring-search, and deep-page queries. Target warm database browse p95 at or below 500ms for 10,000-row tenant fixtures and control-to-committed-results p95 at or below 1.5 seconds under a recorded network profile. Evaluate 100,000-row deep pages separately; resolve measured failures before release rather than claiming universal performance.

### Verified findings versus remaining assumptions

**Verified:** active components, source tables, existing query/search/filter behavior, label mappings, reference generation, initial segments, local row limit, current action guards, and repository scope constraints, as established during the original source inspection.

**Proposed defaults:** architecture, sort directions, comparison policy, page-size contract, selection behavior, bounded correction, accessibility behavior, execution phases, and acceptance targets.

**Phase 0 evidence now available:** affected hosted/local schema columns, constraints, indexes, RLS, migration/collation comparison, exact small live aggregate counts, canonical reference-shape counts, authenticated REST capabilities, and isolated browser baseline results (section 6). The initial local capture lacked `0109`; the later disposable schema and source history include it. Full catalog equality remains false because the hosted-only payment INSERT policy is absent locally; affected read policies match.

**Not yet runtime-verified:** authenticated hosted acceptance, the future implemented global comparison/filter/page contract, production custom-reference ordering, large tenant performance, physical scrollbar/trackpad behavior, and the full deployed browser/accessibility matrix. Representative isolated authenticated reads, join membership, raw global related ordering, counts/ranges, permissions, edit outcomes, refresh/selection behavior, and a delayed-response race now have actual runtime evidence below.

Phase 0 establishes the baseline before implementation; it does not require the proposed improvements to exist. Phase 6 demonstrates the implemented release behavior. No application changes, application migration execution, deployments, or authenticated production acceptance are claimed by this task.

## 6. Phase 0 verified contracts and evidence — 2026-10-11

Evidence root: [plans/evidence/admin-table-phase0](C:/Users/User/barangayan/plans/evidence/admin-table-phase0/README.md). All source paths below are repository-relative, with current one-based line references. `source-inventory.json` supplies the full active column definitions, query arguments, action/dialog dependencies, and line references; commented JSX is excluded by the installed TypeScript parser. Its expanded 68-file/638-entry inventory includes Header notification hooks and is a source index, not a claim that every action was executed.

### Baseline, instructions, and documentation

- HEAD: `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`. Original status and SHA-256 manifest: `baseline-status.txt`, `baseline-head.txt`, `baseline-hashes.json`. The plan was already untracked. Substantial resident Android/web/shared/config/OTP work and migrations `0107`–`0109` were pre-existing. Preserve those exact contents; do not interpret the dirty tree as changes from this audit. `scope-result.json` records the final byte comparison.
- Applicable instructions read: root `AGENTS.md` and `apps/admin-web/AGENTS.md`. No additional instruction files were discovered under affected folders. Highest repository prefix is `0109`; next unused prefix would be `0110`, rechecked before any future creation. No migration created/applied/renumbered.
- Exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/) read before verification scripts were written. No Expo/native code was written. Installed Next.js guides read: `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` and `10-error-handling.md`; these cover server database reads, authorization, streaming, and explicit expected errors. Admin dependencies: Next 16.3.0, React 19.2.8, Supabase JS declared ^2.112.1 / SSR ^0.12.4 (`apps/admin-web/package.json`). Node used: 24.13.1. No packages installed.
- [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md) used for read/API/security assessment. Changelog markdown fetched and breaking-change entries scanned. Relevant [Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [PG minor release](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), and [Realtime schema restrictions](https://supabase.com/changelog/realtime-schema-locked-down-against-modification) reviewed. These do not authorize schema/realtime changes. Existing objects/grants remain the baseline; any later new read object needs explicit grants and RLS-aware access.

### Shared frontend and nested-view contracts

`components/admin/editable-data-table.tsx:23` declares supported editor types and `canEdit`; `:118` owns edit state by `rowKey` plus header text. `:158` installs mouse resize listeners, removed on mouseup, without an unmount cleanup path for an in-progress drag. `:196` uses `savingRef` to serialize saves; failed saves toast and call `cancelEdit`, discarding the draft (`:223`–`:225`). There is no header sort API, stable column-ID API, keyboard resize handle, focusable editor entry, or coordination with navigation/Realtime. Enter/blur save and Escape cancel are current behavior. The plan's draft-retention and navigation coordination are proposals, not preserved existing guarantees.

`components/admin/table-scroll-area.tsx:13` wraps one semantic table in horizontal body/top scrollers. ResizeObserver, MutationObserver, resize listener, and animation frame have cleanup (`:28`–`:55`). Mirror synchronization writes offsets directly (`:57`–`:75`); no differing-range normalization, vertical bound, both-axis overscroll rule, labeled keyboard region, or always-available scroll buttons exists. `pinLastColumn` in EditableDataTable pins **width**, not scroll position; none of the inventoried tables has a sticky action column. Preserve that width contract; do not describe it as existing frozen-column behavior.

`components/admin/admin-shell.tsx:45` permits main horizontal/vertical overflow without `min-w-0`. `components/admin/data-table.tsx:24` uses the same scroll wrapper; unrelated callers keep their defaults. `app/globals.css` contains no scoped table sticky/containment implementation. No Phase 0 component/style changes or dashboard compatibility claims.

`app/(admin)/loading.tsx:3` supplies the inherited table PageSkeleton. No eight-route-specific loading/error boundary was found; Request detail has a separate loading boundary. Existing Spinner/LoadingButtonContent/toasts handle mutations. A loading boundary does not catch query errors intentionally turned into empty arrays.

Every table has a 300ms search timer with cleanup and separate immediate navigation using URLSearchParams. Immediate changes use the committed `q`, not necessarily the current draft; `router.push` has no `scroll:false`. Sort direction is local state, not URL state. These patterns require later coordination; no race/subscription-leak freedom is established. Subscriptions directly call `router.refresh`, have removeChannel cleanup, and have no explicit event coalescing or edit deferral.

Directory (`residents/resident-directory.tsx:733`–`:996`) contains a commented legacy table; the only active table is EditableDataTable at `:997`. Historical names inside that comment are not active dependencies. Request History (`:190`–`:200`, rendered at `:445` onward) is a card list, not a nested sortable table; its single query is also capped, ignores query errors, and uses a cancelled flag to avoid committing after cleanup. ID evidence uses `id_submissions` and 600-second signed URLs (`:208`–`:221`), distinct from table Joined timestamps. The separate `households-residents/member-form-modal.tsx` and `hooks/use-households.ts` have no discovered call sites; active AddMemberForm/MemberDetailModal are declared in `households-table.tsx`. Health links to `/health/applicants`; no new nested segmented filter was found in its detail modal. Request review is a separate route, not another table.

### Screen contracts (verified source; not completed improvements)

Paths in this table start at `apps/admin-web/src/app/(admin)/`. All eight row keys are base record IDs. No query requests a main-table exact count/range, and no client has pagination/page-size controls. Text comparison is current localeCompare, with no explicit base-ID tie-break. Actual client sort tests reproduce input-order ties rather than ID ascending.

| Screen and source evidence | Current membership, filters, search | Default, summary, detail/actions/error/subscription contract |
|---|---|---|
| Requests — `requests/page.tsx:55`–`:107`; `requests-table.tsx:263`–`:307`, `:340`–`:487`, `:580`; `types.ts:3` | `service_requests`, `deleted_at IS NULL`; left document name and explicit `service_requests_resident_id_fkey` resident name. `tab`: Active means submitted, then processing/in_progress, pickup/ready_for_pickup, completed, cancelled, all. `doc`: document_type_id. Literal search OR over reference_number, resident full_name, document name; lowercase **without trim**. | Active initial, All last; DB created_at descending overridden by reference ascending client sort. Five summary status counts over all fetched requests, independent of q/doc/tab. Legacy reference/resident/document/status/payment/Submitted/notes cells require contract_version=1; creation dropdown limits to v1. v2 Review link goes to `[requestId]`; legacy RequestStatusActions uses lifecycle RPCs/cancel note/payment collection. Archive soft-deletes and confirms returned row. Audits retained. Main/lookup errors ignored. One fixed-name service_requests Realtime channel. No selected detail modal. |
| Transactions — `transactions/page.tsx:39`–`:105`; `transactions-table.tsx:97`–`:144`, `:423`–`:611`, `:614`–`:816`, `:903`; `types.ts:3` | Non-deleted payments; nullable service_requests→document/resident and collector alias. Tab/status plus method; All initial/first. Search OR over linked reference, resident name, document name, collector name; lowercase **without trim**. QR PH source ID is displayed but not searched. Cancelled exists in payment schema but has no own tab; All still includes it. | Payment created_at descending, Date column; paid_at/refunded_at are separate fields. Summary sums amount_centavos for paid pickup, paid qrph, pending, independent of filters. Latest-100 references are suggestions, not paging; live reference lookup confirms exact non-deleted request with lookup token but timer has no discovered unmount cleanup. Resident/document edits update linked requests; reference edit reassigns payment after lookup. Amount locked only when status=paid; centavo conversion and nonnegative validation retained. Status can update paid_at. Full-amount refund function, pending/refunding/failed/retry/claim links, archive and audits retained. Main errors ignored. No table Realtime subscription or detail selection; actions refresh. |
| Directory — `residents/page.tsx:84`–`:154`; `resident-directory.tsx:568`–`:654`, `:997` | Non-deleted profiles with role=resident; restricted projection omits updated_at. Tab verified means email_verification_status=verified; unverified means every other state (including unavailable/pending). ID dropdown is photo-array presence, **not ID decision**. Trimmed/lowercase literal OR: full/first/last/middle names, email, mobile, home_address, house_no, street, city, occupation, id_type. Suffix/sex/employment are displayed but not searched. | All initial/first, persisted full_name ascending; table displays structured name columns. Summaries: total/email status/ID presence/ID decisions plus JSON household array lengths, independent of filters. Location Verified display uses verified_location/address, distinct from location_verified registration flag. Inline structured-profile edits and archive verify affected rows/audit. Add uses resident invite; ID decision uses protected review operation with rejection/revocation reason. Snapshot selected; ID/history independently loaded with cancellation guard. Main error surfaced but summary computation can still show zeros; history/options/evidence failures are not complete explicit states. No table subscription. |
| Incidents — `incident-reports/page.tsx:54`–`:114`; `incident-table.tsx:306`–`:395`, `:396`–`:588`, `:707`; `incident-detail-modal.tsx:41`–`:85`, `:302` | Non-deleted incidents; nullable category and explicit `incidents_reporter_id_fkey` reporter (confirmation junction makes bare profiles ambiguous). Category predicate is database-side; tab/status then server JS search. Trimmed literal OR: title, description, category name, reporter full_name/email. Address/specific area are displayed/editable, not searched. Open initial, All last. | created_at descending displayed/edited as Submitted. Independent status scan summaries ignore category/q/tab, but are capped/error ignored. Title/description/photo details; category, reporter including anonymous, location coordinates (range validated), address, area, nonnegative integer confirmation count, status, Submitted inline edits; guided status RPCs and archive/audits preserved. Main error surfaced. Selected snapshot; detail save handles error but does not confirm an affected row. One unique-per-mount incidents channel. |
| Health — `health/page.tsx:9`–`:26`, `:56`–`:110`; `drive-table.tsx:287`–`:302`, `:304`–`:478`, `:590`; `drive-detail-modal.tsx:51`–`:98`, `:249` | Non-deleted drives; current query has **no tenant predicate**. All/upcoming/today/past/inactive buckets; active upcoming >= local-server today (includes today), today equality, active past < today, inactive !is_active. Type dropdown matches raw type. Trimmed literal OR: title, location, eligible_criteria, DRIVE_TYPE_CONFIG displayed label. Upcoming initial, All last. | Current drive_date ascending; creation-desc default is a future change. Single registration drive_id scan, no cancelled exclusion, reduced counts with zero fallback. Summary bucket counts over fetched drives; registration summary counts the independent scan across visible registrations, even for drives omitted from table. Public read can broaden Health drives across tenants. Details/title/location/time/criteria/stock labels edits, bounded integer stock_remaining (0..stock_total), type/date/active edits, soft removal and audits. Main error surfaced; registration failure falsely becomes zero counts. Selected snapshot and unique medical_drives channel; no registration channel, so registration-only changes need not refresh the count. Detail save lacks returned-row confirmation. |
| Applicants — `health/applicants/page.tsx:46`–`:91`; `applicants-table.tsx:59`–`:129`, `:266`–`:357`, `:360`–`:479`, `:578`; `applicant-detail-modal.tsx:18`–`:121`, `:299` | drive_registrations (no deleted_at) with **score:drive_registration_scores!inner**, left medical_drives; profiles attached after fetch through user-ID lookup. No profile-FK embed exists. Tab status/type via medical_drives. Trimmed literal OR: applicant_number, drive title, comorbidities joined with `', '`. **No resident-name search**. Missing profile/drive retained; missing/inaccessible score excluded by inner membership. | Registration created_at descending; All initial/first. Status/PWD/total summaries cover inner-score fetched rows independent of filters. Protected priority_score comes only from score table; applicant number/score/drive/resident/Registered remain read-only. Age 0..130, PWD/status and detail comorbidities/prior dose edits verify affected rows; snapshot score is not recomputed on editing. Admin registration RPC checks active admin, target/drive tenant, locks stock and prevents duplicates. Cancellation updates status with audits; detail save merges updated fields into selected snapshot. Main error surfaced, profile lookup errors ignored. One unique registration channel, score table excluded from publication. |
| Households — `households-residents/page.tsx:41`–`:105`; `households-table.tsx:116`–`:197`, `:198`–`:318`, `:405`, `:434`–`:484` | household_members (hard delete, **no deleted_at**) with nullable profile_id head embed. Tab checked_in/not_checked_in, relation equality. Trimmed literal OR: member name, head full_name, raw relation, raw role. Main wildcard SELECT already includes updated_at, but DTO and mutation projections omit it. | All initial/first; created_at DB order overridden by member name ascending. Summaries total/check-in/spouse/child/parent/other over fetched set. Existing “Parent / Other” card uses `counts.other`, which excludes parent; do not silently redefine this aggregate as preserving current behavior. Name/relation/role/check-in edits, hard delete, add RPC then row confirmation and audits. Turning check-in off clears checked_in_at, checked_in_center_id and checked_in_center_name. Selected snapshot/modal shares delete handler. Main error surfaced. One unique household_members channel. JSON directory counts and normalized row counts are separate read contracts; RPC/JSON sync triggers are existing write behavior, not Phase 0 changes. |
| Staff — `staff/page.tsx:32`–`:72`; `staff-table.tsx:100`–`:193`, `:195`–`:298`, `:381`; `staff-form.tsx:24`–`:64` | Non-deleted barangay_officials with profile; missing profile excluded server-side. Tab admin official_role=admin; staff means every other official_role; separate role dropdown. Trimmed literal OR: profile full_name/email/mobile/home_address, raw official_role. System profile role is admin even for official-role staff; do not confuse those meanings. | All initial/first; server role ordering finally overridden by profile name ascending. Summary total/admin/non-admin over fetched rows before filters. Name/mobile/address/official-role editors locked for current profile ID; email/Hired are read-only and remove control hidden for self. Hired=date_hired, distinct from official created_at/updated_at and profile updated_at. Invite API has session/role checks and server-only privileged write behavior; preserve it without extending that access to browse queries. Mutation affected rows/audits/action refresh retained. Main errors ignored. No selected detail modal or table subscription. |

All summaries/options need independent failure/completeness contracts, not just row pagination. Requests/Transactions/Staff main failures and several secondary scans/lookups currently resemble empty success. Existing signed-image errors, cancelled detail reads, lookup guards, mutation guards, and audit behavior are to be retained; they do not establish full runtime error coverage.

### Timestamp and field verification

`hosted-schema.json` and `local-schema.json` verify the following on both databases:

| UI meaning | Actual field/type | Source evidence |
|---|---|---|
| Request Submitted | service_requests.created_at, nonnull timestamptz; no separate submitted_at on this table | `requests-table.tsx:435`–`:444`; migration `0002_document_types_and_service_requests.sql:60` |
| Incident Submitted | incidents.created_at, nonnull timestamptz; no separate submitted_at | `incident-table.tsx:579`–`:587`; detail `:302`–`:303` |
| Applicant Registered / Registered At | drive_registrations.created_at, nonnull timestamptz; no registered_at column | `applicants-table.tsx:451`–`:456`; detail `:299`–`:300`; `registered_at` audit metadata is an alias, not a column |
| Transaction Date created | payments.created_at, nonnull timestamptz | `transactions-table.tsx:616`–`:624`; paid_at/refunded_at are nullable distinct timestamptz |
| Health Date created / Drive date | medical_drives.created_at timestamptz / drive_date date | `health/page.tsx:60`; `drive-table.tsx:402`–`:410`; details `:249`–`:251` show Drive Date, not Created |
| Joined / Added / Hired | profiles.created_at timestamptz / household_members.created_at timestamptz / barangay_officials.date_hired date | Directory `:652`; Households `:292`; Staff `:270`–`:274` |

Base table updated_at fields exist; priority_score is numeric in drive_registration_scores, not an obsolete registration-table column (`0105`/`0106`). ID-submission submitted_at is a separate real provenance field. Current shared `format.ts:17`–`:26` and local timestamp formatters omit timeZone; locale en-PH alone does not enforce Asia/Manila. Future admin-local timestamp formatting must implement the proposed zone without changing shared resident/Android behavior. Calendar-date formatters need distinct date semantics.

### Existing query capability assessment

Documentation reviewed: [PostgREST embedding/top-level ordering/OR filters](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html), [Supabase parent order](https://supabase.com/docs/reference/javascript/order), [inclusive range](https://supabase.com/docs/reference/javascript/range), [exact count](https://supabase.com/docs/reference/javascript/select), and [aggregate limitations](https://docs.postgrest.org/en/stable/references/api/aggregate_functions.html). Related-resource ordering via `referencedTable` sorts the **embed**; `.order('relation(field)')` sorts parent rows. Confusing them would page the wrong global order. Basic session-backed SELECT supports exact count and inclusive range before client processing, but the current eight queries request neither. Local max_rows=1000 (`supabase/config.toml:18`); hosted max-row setting was unavailable, not inferred from local configuration.

`environment-api-results.json` records **zero-row anon parser/schema probes**. A successful query/status proves acceptance, not authenticated completeness/collation/missing-related-row behavior. Exact Content-Range is available; anon public counts are not admin tenant totals.

| Screen | What existing queries can supply before paging | Demonstrated limitation / minimal later read proposal |
|---|---|---|
| Requests | Base status/doc/delete predicates; reference/timestamps; direct resident/document parent order. Authenticated empty-embed OR finds the resident sentinel beyond the original cap; document filtering counts all 1,505 matches. Exact counts and concatenated bounded pages verified. | Current post-fetch predicates/cap and lexical reference fail full contract. Numeric tokens and trim/case/blank normalization require a query-local derived key or computed read field. Related search alone is **not** evidence for an RPC. Escaped native regex handles tested literal punctuation; broad Unicode comparison equivalence still belongs to the implemented comparison gate. |
| Transactions | Base status/method/delete/timestamps/amount; direct request reference and collector relationships. Authenticated `order=service_requests(resident_name).asc,id.asc` matches independent SQL for the tested nested resident spread. Multi-level empty-embed OR and collector-name filtering return the expected actual matches; counts and bounded pages verified. | Naive nested `request(resident(full_name))` rejected PGRST100; lifted top-level alias rejected 42703. These failures **do not justify a flattened view/RPC**, since related spread and nested OR work. Paid sums need a complete aggregate read because aggregate functions are disabled. Normalized/natural/label and collector/source display keys remain narrower derived-expression gaps. |
| Directory | Same-table search OR and role/delete/email-status filters; full/first/last/email/date/ID-decision columns; exact count/range. | Current restricted projection lacks updated_at. ID presence and JSON household-length summaries need preserved empty/null semantics and complete counts. Ordinary raw text sorting does not satisfy lower/trim/blank-last contract; derived keys may be needed, not a generic browse RPC. |
| Incidents | Category already query-side; status/search predicates can move before range, direct category/reporter parent order accepted (HTTP 206 with zero returned rows); exact count/range. | Preserve reporter FK hint, nullable relationships, search OR, and independent summaries. Direct joins do not require new read support; normalized text/label keys remain a narrower gap. |
| Health | Base date/type/active/create/update/stock filters/orders plus exact count/range; type-label search can map matching known labels to existing enum values and OR base text fields. | Embedded `drive_registrations(count())` rejected PGRST123: aggregates disabled. Complete registration counts/sort and global registration summary require a narrow RLS-aware grouped read, including zero drives and cancelled registrations; do not enable broad aggregate API/config or scan all registrations into the browser. Add explicit admin tenant predicate and Manila day at adapter level. |
| Applicants | Base registration/date/age/PWD/status; drive relationship/type filters; one-to-one inner score relationship. Real active-admin score sorting, exact status/membership counts, and bounded pages verified. Missing score excludes the row; a historical missing profile retains its registration. Resident, foreign-admin, and removed-admin sessions cannot read tenant A scores. | Direct profiles embed rejected PGRST200, schema user_id FK targets auth.users. Minimal read support is a user-ID→profile relation/computed relationship or invoker projection retaining left-profile and inner-score semantics. It must not add resident-name search. `comorbidities.join(', ')` substring semantics differ from array membership; a narrow textual expression is needed for exact preservation, including matches across separators. The existing post-fetch profile lookup cannot provide globally ordered names before pagination. |
| Households | Name/relation/role/check-in/date base fields; head parent ordering accepted HTTP 200; same-table and related OR candidates plus exact count/range. | No soft-delete predicate exists. DTO/return projection alignment, normalized names, complete summaries; a new RPC is not justified solely by the profile join. |
| Staff | Role/delete base predicates; use profile!inner to preserve existing missing-profile exclusion (query parsed HTTP 200), then profile(full_name) parent order/count/range. | Keep profile-system role distinct from official role; displayed-label sorting versus raw enums and normalized names may need derived read keys. No blanket RPC requirement. |

**No current query meets the entire specified browsing contract.** Existing API capability is sufficient for ordinary columns, direct relations, basic counts and bounded ranges; current frontend placement of filters is the main completeness defect. Minimal database read support is demonstrated for disabled aggregates, absent applicant profile relationship, joined-array textual search, and transformed/natural/label sort keys not present in existing projections. Choose the smallest read projection/computed relationship/field after authenticated results confirm semantics. Do not build eight RPCs, arbitrary dynamic SQL, new indexes, or additional dependencies from this assessment.

ICU provider `und-x-icu` exists on both PG17.6 databases. The isolated SQL fixture demonstrates lower/trim/accent/null behavior for its values; it does not prove a numeric collation, all Unicode lowercase equivalence with JavaScript, or production reference normalization. Mixed token/custom reference ordering beyond the fixture needs an explicit tested future contract. Standard timestamp/numeric/boolean sorts can use nullsLast and base ID ascending directly. Status/type/role labels currently come from frontend configs or raw fallback; SQL raw enum order is not displayed-label order.

### Permissions, schema alignment, and scale

Server page clients use anon/public credentials plus session cookies (`lib/supabase/server.ts:15`–`:39`); no privileged browse client was added. Admin layout requires auth user and profiles.role=admin (`app/(admin)/layout.tsx:15`–`:33`), but does not check deleted_at. Households additionally checks user/profile role locally. Hosted `current_role()`/`current_barangay_id()` also omit deleted_at. This is a verified gap in removed-admin rejection, not a claim that all routes are secure or an authorization to change write security in Phase 0. New read helpers must explicitly reject removed admins and preserve tenant conditions; existing broader permission changes require separate scope.

Hosted `medical_drives_public_read` applies to public, permits every active non-deleted drive, and ORs with the admin tenant policy. Therefore the Health page comment “RLS scopes by barangay_id” is false for its current query. Proposed admin browse membership must add tenant restriction consistently to drive rows, options, grouped counts, and summaries. This is an intentional corrective change for a later phase, not an existing guarantee. Incident guest-wide policy applies to anon, not authenticated admins; do not transfer the Health conclusion to Incidents.

Score table grants SELECT only to authenticated, with an active-admin/same-drive-tenant/deleted_at-null policy. Anon access is denied; authenticated isolated resident, foreign-tenant and removed-admin sessions return zero protected scores, while the active same-tenant admin obtains the expected global score ordering (`runtime-api-results.json`). Score table is absent from Realtime publications; registration/drive/request/payment/incident/household tables are present (`hosted-security.json`). This does not mean every screen subscribes: Transactions does not, despite payments publication membership. General profiles/staff are not in that publication. Five live table feeds, route-unmount leave/no-callback, and delayed-response behavior were exercised in the runtime supplement; longer stress coverage remains a later gate.

Hosted/local affected columns, constraints, indexes, RLS flags, and inspected collations match. Initially local history stopped at `0108`, hosted at `0109`. Separate work advanced the source local history to `0109` before the isolated schema copy; this task did not apply that migration. Hosted additionally has `residents can create a payment on their own request` INSERT policy. Affected read policies and final copied migration history match (`runtime-final-schema.json`, `runtime-completion.json`). No source/hosted discrepancy was repaired. Catalog equality does not prove trigger/function/file-content equality; only explicitly captured helper definitions are verified.

Hosted exact aggregate counts: profiles 28, requests 69, payments 55, incidents 30, drives 13, registrations 10, members 6, officials 5. Largest inspected tenant groups: profiles 28, requests 69, drives 13. All 69 references canonical; zero cancelled registrations; six zero-registration drives. Local statistics indicate one profile and empty affected tables; estimates are not asserted as exact live counts. No large-data performance measurement is justified from this scale. Captured indexes already cover tenant/FK/status/date keys as detailed in schema JSON; no plans/benchmarks demonstrated a new index requirement.

### Focused verification and completion checklist

Artifacts and boundaries are documented in the evidence README. Lightweight deterministic fixtures remain outside application/package entry points. No new test dependency, production resource or application migration was created. Initial SQL used read-only CTEs; the authorized runtime continuation created synthetic accounts/data only in a labelled disposable stack and copied preview, subsequently removed. Operations have finite counts/timeouts and bounded startup/resource checks. Initial restricted Docker/network failures and later fixture/harness failures were investigated before targeted corrections. Host supabase/psql executables were unavailable; container psql supplied the fallback.

- [x] Repository instructions/documentation read; original status/HEAD/hashes and highest migration prefix recorded.
- [x] Eight active table/field/filter/default contracts and reachable nested views documented; source inventory distinguishes commented/unused code.
- [x] Submitted/Registered/Date created verified in source and both database schemas; calendar dates and other provenance fields distinguished.
- [x] Existing frontend/query/count/range/related-order capabilities evaluated with recorded source, docs, and zero-row API results; demonstrated gaps receive minimal conditional read proposals.
- [x] Local/hosted schema, policy/index/collation/history differences and small representative scale checked and recorded; no existing database, application migration or production data changed. Disposable synthetic data is distinguished below.
- [x] Required deterministic size/comparison/permission/concurrency fixtures created, isolated, and verified; mocked source tests **35 passed/0 failed** and independent local SQL **11 assertions passed**. Permission/event fixtures are prepared scenarios, not successful live tests.
- [x] Admin typecheck **exit 0** (13,831ms), lint **exit 0** (36,552ms), with 60s limits. Isolated Chrome baseline checks executed below; production build, physical-input and large-data performance tests not run.
- [x] Task writes limited to plan/evidence; 3,094 unrelated baseline files compared (`scope-result.json`). No application-source/Android byte changes detected. Three unrelated resident-OTP documents changed during the audit without being edited by this task; they were left as found, so scope checker exit 1 is recorded instead of claiming full workspace equality. No later phase started.
- [x] Authenticated isolated API results validate related spread/OR, score sorting, exact counts/ranges, invalid-range handling and nullable/inner-join membership: 42 assertions in `runtime-api-results.json`, 11 in `runtime-query-edges.json`; all eight 1,505-row populations concatenate to independent expected IDs. These are supported query capabilities, not implemented table pagination.
- [x] Two-tenant/resident/removed-admin results and browser edit/selection/refresh/navigation/race behavior executed in the isolated fixture environment: 30 completed interaction assertions, eight rendered screens, two browser route-permission observations, and five real change-feed checks. `runtime-completion.json` names the actual source reports and boundaries. Existing access/draft/selection/count defects are documented, not fixed.
- [x] Task-owned containers/network/private credentials/source preview removed safely; `runtime-cleanup.json` records four removed containers, removed network/credentials/preview, zero owned preview processes, and zero listeners on the five task ports. Owner labels, process command lines and resolved deletion paths were verified first.

**Phase 0 is complete; no Phase 0 evidence gate remains unresolved.** The discovered access, cap/count, edit-draft, and selected-snapshot defects remain prerequisites/risks for later implementation. Future browser/accessibility/10k–100k performance and release gates remain unverified; no functionality, bug-free, or production-readiness claim is made.

### Authenticated runtime supplement — 2026-10-11

`runtime-stack.json`, `runtime-final-schema.json`, and `runtime-completion.json` record a task-owned PostgreSQL 17.6/Auth/PostgREST/Realtime stack with fresh local signing keys and loopback API ports. A schema-only copy plus infrastructure metadata supplied the affected public application schema, owners, grants, triggers and RLS; no source users or production records were copied. The source local history had advanced to `0109` during separate work before copying; this task did not apply that migration to it. Affected columns, constraints, indexes, collations, history and read policies match the captured hosted catalog. The hosted-only payment INSERT policy remains a known difference outside these browse-read checks.

The final clean reproduction successfully starts the corrected stack and seeds 3,014 profiles, 1,505 requests/payments/incidents/members, 1,507 drives/registrations, 1,506 scores, and 1,508 officials. Four real password Auth accounts cover administrator, foreign administrator, resident, and removed administrator; other identities are non-login synthetic FK fixtures. Valid registration inserts use the existing score/tenant triggers. The missing-profile history case removes only a synthetic profile after a valid registration; direct insertion without an active resident is correctly rejected. Structured name fixtures account for the existing name-composition trigger.

- `runtime-api.mjs`: real Auth plus REST/RLS; **42 passed**. Each table returns a capped 1,000 rows while exact count is 1,505; 16 pages of at most 100 rows concatenate to independently expected IDs. This demonstrates existing API capability and the current table-query limitation.
- `runtime-query-edges.mjs`: **11 passed**. Nested transaction OR/collector search works. Plain `ilike` treats `*` as a wildcard alias and matches two test names; an escaped native `imatch` and quoted OR retain tested `%`, `_`, `*`, comma, parentheses and Unicode as literal substring text and match one. See [PostgREST operators](https://docs.postgrest.org/en/v14/references/api/tables_views.html). No new helper is justified solely for these tested direct-text searches. An invalid range returns **416/PGRST103**, not empty success; one independent exact HEAD count recovers the total. Later adapters must handle that distinction with a bounded correction.
- `runtime-browser-results.json`: Chrome **154.0.8037.99**, headless, eight actual server-rendered table screens with 1,000 rows each. `runtime-interaction-attempt3.json` contains 22 completed assertions from the earlier run; `runtime-interaction-results.json` contains eight subsequently completed assertions. `runtime-completion.json` consolidates only those **30 executed assertions**, preserving the earlier failed expectations instead of relabeling their runs as passed. All five detail views open/close; Staff self-edit/removal and paid-amount guards hold; validation/HTTP-denied edits expose failure and discard the draft; a valid age edit persists and preserves the score snapshot; actual incident Realtime refresh leaves the selected detail stale; final debounced query, Back/Forward and an older delayed RSC response were exercised.
- `runtime-subscription-results.json`: all **five actual table feeds passed**, each with verified changed values and client channel removal before the next subscription. The final clean-start check confirms the WAL slot before writing so fixture changes do not race cold replication setup. Browser unmount sends the incident topic's leave and a subsequent mutation delivers no callback/refresh over a measured 2,500ms window. Server subscription metadata can remain while the shared Header socket is connected; its row count alone is not a live-channel/leak test. This does not replace Phase 6 long-running listener/observer stress coverage.
- `runtime-route-permissions.json`: **two observations passed**. Ordinary resident access to `/requests` redirects to login; the removed administrator still renders its 1,000-row table. Along with active foreign Health drive visibility and removed-admin request reads, this reproduces the previously identified access gaps. Protected scores remain unavailable to resident/foreign/removed-admin sessions. These baseline defects require scoped guards in later implementation and are not grounds to modify the resident Android UI.

Additional shared-source verification: `components/admin/header.tsx:121`–`:156` implements a separate debounced last-five Requests/resident search, although its placeholder also mentions incidents; errors are ignored and it has no response-sequence guard. Preserve this independent lookup. `hooks/use-admin-audit-notifications.ts:14`–`:110` supplies the Header's last-50 notification feed, window-based unread count, tenant-filtered INSERT channel and read-state writes; this channel is expected to persist on Transactions. `hooks/use-audit-log-browser.ts:38`–`:61`, `:79`–`:127`, `:141`–`:245` already implements shared predicate logic, stable creation/id keyset order, 30-row limits, a request-ID stale-response guard, surfaced fetch errors and a separate drawer-only channel. Reuse those proven source patterns where appropriate; its cursor/load-more contract is not a numbered/exact-count table pager. `notifications-drawer.tsx:115`–`:159`, `:229`–`:233`, `:406`–`:443` and `use-mount-transition.ts:42`–`:106` provide nested loading/error/load-more, Escape/resize cleanup and a finite 450ms exit fallback. `scrollable-chip-row.tsx:36`–`:62` already cleans up its scroll listener/ResizeObserver and provides named scroll buttons. No new abstraction or dependency is warranted merely to duplicate these patterns.

Failures were investigated before targeted corrections. `runtime-setup-attempts.json` and the preserved `*-attempt*.json`/preview log record bootstrap-role and network-HBA setup failures, score-trigger/active-resident/name fixture corrections, pre-hydration/Close-selector errors, proxy PATCH/schema-header/large-lookup/WebSocket-path omissions, incompatible copied Realtime infrastructure and v2 serialized-array observation. Final Realtime infrastructure comes from the pinned service's migrations; affected public schema/read policies were rechecked afterwards. No source/hosted schema was repaired. The final setup/seed and authenticated API checks were repeated from a clean disposable stack, and feed checks passed after confirming the actual replication resource. No uncontrolled polling or recursive retries were added.

The continuation baseline compares **3,113** non-task files. No admin or resident Android application bytes changed. Three unrelated artifacts changed concurrently (`runtime-completion.json` lists them); they were preserved. The 35 existing mocked source tests passed again (`runtime-source-tests.log`); all 18 scripts passed syntax checks. Earlier lint/typecheck results remain valid source-baseline checks; no production build was run. Physical input, other browsers, broad accessibility and 10k/100k performance remain explicitly outside Phase 0's completed baseline claims.

Final artifact audit (`final-artifact-checks.json`) passed: 18 script syntax checks, 36 recorded JSON reports parsed, 38 evidence-file references resolved, runtime counts/schema booleans and completed checklist verified, cleanup confirmed, and the 3,113-file scope comparison unchanged from the final runtime review. Tracked `git diff --check` returned exit 0 with existing line-ending warnings. This check validates evidence consistency and scope; it does not turn preserved failed attempts into passes or establish later release behavior.

## 7. Requested Phase 1 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the requested baseline stage.** This is a revalidation of the historical baseline, not execution of the document's frontend foundation phase. Evidence: [current audit README](C:/Users/User/barangayan/plans/evidence/admin-table-phase1-baseline/README.md). Section 6's per-screen contracts, timestamp table, query capability matrix, nested views, action guards, and source locations remain applicable: all **68 indexed source files / 638 active entries** and **107 historical migration files** are byte-identical to the source used by the retained runtime evidence. The freshly generated AST index also equals the historical index exactly. This establishes current source linkage; it does not establish a fresh browser run or current hosted state.

### Instructions, scope, baseline and provenance

- Root and admin-web `AGENTS.md` were read; no additional admin-web instruction files were found. Exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/) was read before audit scripts were written. Installed Next.js data-fetching and error-handling guides under `node_modules/next/dist/docs/01-app/01-getting-started/` were consulted. The [Supabase skill](C:/Users/User/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md) was used for read/API/security assessment. No subagents or dependencies were added.
- Current HEAD is `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`; branch and status are recorded in `baseline.json` / `baseline-status.txt`. The new manifest covers **3,190 pre-existing files**, including existing Phase 0 evidence and unrelated Android/web/shared/OTP changes. The plan was already untracked. The plan and new evidence directory are the only allowed task writes.
- Highest prefix remains `0109_invalidate_changed_profile_email_verification.sql`; next unused would be `0110`, subject to rechecking before future creation. No migration was created, applied, or renumbered. The fresh local catalog history also matches the retained hosted history through `0109`.
- `scope-and-provenance.json` hashes each retained runtime report and proves its source/migration linkage. Historical observations remain historical: **42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 completed interaction assertions, five real feeds, and two permission observations**. Preserved failed attempts remain failures; consolidated observations are not a claim that every historical run passed. No authenticated or browser fixture stack was recreated because unchanged sources and existing focused evidence already support the baseline contracts.

### Revalidated contracts and necessary corrections

The eight current pages and their active client tables were rechecked. `field-contracts.json` records **170 verified field definitions** across the fresh local and retained hosted catalogs, source-linked column definitions/renderers/edit mappings, main queries, predicates, defaults and subscription locations. The full index additionally covers shared components, loading, review/detail/form dependencies, Header lookups and notification/audit drawer behavior. Catalog definitions provide types, nullability, defaults, constraints, indexes and policies; the index is source evidence, not execution of every mutation.

| Area | Verified baseline / correction | Evidence |
|---|---|---|
| Dates | Request/Incident Submitted and Applicant Registered use their base `created_at`, nonnull timestamptz. Transactions Date also uses payment `created_at`; paid/refund times are distinct. Health Date currently uses `drive_date` (date), while its proposed Date created is `medical_drives.created_at`. Joined/Added/Hired remain profile creation/member creation/official `date_hired`. No request/incident `submitted_at` or registration `registered_at` column exists. | `field-contracts.json`; section 6 timestamp locations; fresh `local-schema.json`; Requests cell `:439`–`:444`, Incident detail `:302`–`:303`, Applicant detail `:299`–`:300`, Health detail `:249`–`:251` |
| Query completeness | All eight current main queries lack exact count/range and filter after fetching, except Incident category already applied before fetch. Local cap is 1,000. Existing client sorts operate on that fetched subset and retain input-order ties. Summaries/options/history scans have separate completeness/error concerns. | Current `source-inventory.json`; `verify.mjs` and `fixtures.log`; `supabase/config.toml:18`; section 6 query matrix |
| Field spelling / obsolete fields | Incident field is **`confirmation_count`**, not `confirmations_count`. Applicant score comes from `drive_registration_scores.priority_score`; migration `0106` removed the obsolete registration-table score. Members/registrations have no `deleted_at`. The first new field-validator attempt failed on the incorrect plural spelling and was corrected against source/schema before rerun. | Incident cell `:549`–`:558`; shared generated type `database.ts:956`; migrations `0105`/`0106`; `field-contracts.mjs` |
| Missing embeds / lookup meaning | Preserve nullable request/document/reporter/head/collector relationships, Staff's missing-profile exclusion, and Applicant inner-score membership plus nullable post-fetch profile. Directory household count is JSON length, not normalized member count; ID-presence filter is photo-array presence, independent of review status. | Eight page queries / section 6; missing-embed and ID-presence fixture tests |
| Summaries | Summaries remain independent of table search/filter membership. Health counts cancelled registrations and includes registrations for drives omitted from its table; zero-registration drives get zero. Its capped secondary scan undercounts. Household “Parent / Other” currently excludes parents; treat any label/aggregate correction as a later explicit change. | Six added focused tests in `verify.mjs`; Health `page.tsx:64`–`:90`; Households `page.tsx:72`–`:79`, `:122` |
| Shared UI | `pinLastColumn` pins width, not scroll position. No current sticky-header/sort/page API exists. Failed saves call `cancelEdit`, discarding draft; resize drag listeners lack an in-progress unmount cleanup. Mirror observers/frame/window listener have cleanup; current mirror copies offsets directly. | `editable-data-table.tsx:85`, `:134`, `:158`–`:225`; `table-scroll-area.tsx:28`–`:75`; current AST; retained interactions |
| Active vs historical views | Directory's commented table is obsolete; its active EditableDataTable begins at `:997`. History is a card list. Health Applicants is the reachable nested table. Active household dialogs are in `households-table.tsx`; separate member-form/hook files have no discovered call sites. Request review and notification drawer retain their independent workflows. | Parser excludes JSX comments; section 6 nested-view/dependency findings; current AST equals historical index |
| Selection / editing | Five selected detail snapshots use stable record IDs but can remain stale across refresh. No bulk selection exists. Preserve legacy v1 request edit guards/v2 review, paid-amount lock, Staff self-edit/removal guards, check-in-off cleanup, registration computed-field restrictions, mutation row confirmation where present, audits and signed-image access. Save/navigation/refresh coordination is a future proposal. | Section 6 screen matrix; current columns/behavior locations; retained interaction reports |
| Permissions | Layout checks role but not profile deletion. Historical isolated sessions demonstrate removed-admin request access and active foreign Health visibility; current unchanged source and read policies support those findings. Score access remains admin/tenant protected in the tested sessions. Do not treat all RLS as interchangeable or add service-role browse reads. | `(admin)/layout.tsx:24`–`:30`; Health `page.tsx:56`–`:60`; current policies; retained route/API permission reports |
| Loading/errors/feeds | Parent loading boundary is retained. Requests/Transactions/Staff main errors still resemble empty data; several summary/option errors become zeros/empty arrays. Five table subscriptions refresh directly and remove their channels; Header audit channel is independent. No long-run leak freedom is established. Health has no registration feed for registration-only count changes. | Section 6; current AST; retained feed and 2,500ms post-unmount observations |

The fresh read-only local catalog matches retained hosted columns, constraints, indexes, RLS flags, collations and migration history. Full policy equality remains **false**: the retained hosted-only payment INSERT policy is absent locally. This is an existing write-policy difference; the affected SELECT/ALL policies match. Catalog equality does not establish function/trigger/migration-file execution equality. Hosted catalog/scale/API captures were not refreshed in this run; they cannot establish current production state or authenticated hosted acceptance.

### Query capabilities: retain direct reads first

Section 6's per-screen capability matrix is retained with its evidence boundaries. [PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html) and [aggregates](https://docs.postgrest.org/en/v14/references/api/aggregate_functions.html) were reviewed against the recorded runtime **PostgREST v14.5**, rather than assuming the moving stable documentation's v16 is the tested server. [Supabase ordering](https://supabase.com/docs/reference/javascript/order), [inclusive range](https://supabase.com/docs/reference/javascript/range) and [exact counts](https://supabase.com/docs/reference/javascript/select) were also reviewed.

| Screen | Existing capability / minimal demonstrated gap |
|---|---|
| Requests | Native status/document/delete filters, resident/document parent ordering, cross-embed OR search and exact counts/ranges work in retained authenticated fixtures. Existing lexical reference sorting differs from numeric-token/normalized proposed comparison; only derived read keys need evaluation. No blanket search RPC. |
| Transactions | Nested spread parent ordering, nested OR and collector filters/counts/ranges work; naive nested ordering failed but a working direct alternative exists. Complete paid sums and derived collector/source/label/natural keys are narrower gaps. |
| Directory | Same-table search/status/role predicates, raw field ordering/count/range are supported. Add `updated_at` projection later; complete JSON/ID summaries and normalized blank-last comparison need precise expressions. Raw ordering is not the advertised normalized comparison. |
| Incidents | Direct category/reporter relationships support parent order; preserve FK hint and nullable branches. Move existing status/search before paging later; keep independent status counts. Normalized/label keys are conditional derived-expression work. |
| Health | Base date/type/active/stock/create/update count/range works. Grouped registration count/sort is blocked by disabled API aggregates (PGRST123); narrow tenant/RLS-aware grouped read is justified. Explicit admin tenant predicate and Manila day are adapter corrections. No general aggregate API enablement or full-browser registration scan. |
| Applicants | Inner one-to-one score ordering/count/range works. `user_id` references Auth users; direct profile embed fails PGRST200. A narrow left user-ID/profile relationship or invoker projection is justified for global resident sorting. Joined-array substring needs an expression preserving `join(', ')`, not array membership. Do not add resident-name search. |
| Households | Base/head ordering, filter/count/range capabilities are available. Align DTO/mutation projections for `updated_at`; preserve hard deletes. Direct head join does not justify a generic RPC. |
| Staff | `profile!inner` preserves missing-profile exclusion, supports related ordering/count/range. Preserve official/system role distinction, self guards and independent lookups; normalized/label expressions remain conditional. |

**Limits:** several Incident/Household/Staff query shapes have parser/zero-row evidence rather than full authenticated nonempty global-search coverage; that distinction remains explicit in section 6. Tested literal `%`, `_`, `*`, commas, parentheses and Unicode work with escaped native regex/quoted OR; this does not prove every Unicode casefold equivalence with JavaScript `toLowerCase().includes`. No new index has a measured requirement. No new backend read object was implemented. Complete application filtering/sorting/counting/pagination remains future work on all eight screens, despite supported underlying API primitives.

**New retry finding:** the installed `@supabase/postgrest-js` **2.112.1** enables automatic retries by default; `src/types/common/common.ts:8` sets three retries for GET/HEAD/OPTIONS, and `PostgrestBuilder.ts:340`–`:383` handles transient/network errors, aborts and Retry-After. The app does not add its own table retry coordinator. Later adapters must account for SDK retries inside a request deadline and a finite page-correction budget, using verified `.retry(false)`/abort support where needed. A bounded retry count alone does not bound wall-clock time when Retry-After is large. This is a proposed adapter requirement; current behavior was not changed. The [Supabase changelog](https://supabase.com/changelog) was scanned; the markdown endpoint failed in the web reader, so the HTML changelog supplied the fallback. Read restrictions/API grants and Realtime schema restrictions do not authorize changes here.

### Fixtures, checks, completion and limitations

The new fixture files reuse the existing deterministic DTO/VM tooling and add six focused source-behavior tests. Sizes remain **0, 1, 7, 10, 11, 23, 100, 101, 1,505**; sizes **10/20/30/50/100** cover 45 size combinations. Comparison/permission/concurrency schedules remain synthetic and isolated. Duplicate references are comparator DTOs, not valid UNIQUE-constrained inserts. The VM models transport cap/predicates, not RLS, SQL sorting, embedding or Realtime. Real permission/concurrency observations are retained separately with hashes and source parity.

- [x] Required instructions/docs and current baseline/highest prefix recorded; unrelated work preserved.
- [x] Eight active table/column/field/search/filter/sort/summary/error/selection/action/permission/subscription contracts and nested/shared dependencies have current source evidence.
- [x] Submitted/Registered/Date created fields and absent obsolete fields verified against source and fresh local/retained hosted schemas.
- [x] Frontend patterns and query capabilities evaluated first; backend recommendations remain narrow, conditional and demonstrated.
- [x] Deterministic fixtures verified: **41 Node tests passed, zero failed**; **11 independent SQL value checks passed**. SQL is read-only CTEs with an 8-second statement limit and 15-second process limit; it does not execute application pagination.
- [x] All nine new audit scripts passed syntax checks; field/index/provenance checks passed, admin typecheck exit 0 (17,317ms), focused lint over 66 affected admin TypeScript files exit 0 (44,973ms), and tracked whitespace check exit 0. Whole-package lint timed out at 60 seconds without diagnostics and is not relabeled a pass. `final-verification.json` confirms the final results and boundaries.
- [x] No services/accounts/containers/network/temporary database objects were created in this run; therefore no temporary-resource deletion is needed. Prior disposable cleanup remains supported by its retained report. Existing local database was only read; no application migration or production write occurred.
- [x] Final scope check verifies all 3,190 baseline files with no missing/changed/out-of-scope additions; only the plan/new evidence were written. Resident Android UI and the cancelled usability phase were preserved. No later stage started.

**Baseline blockers: none. Verification limits:** fresh whole-package lint timed out; current hosted state and fresh authenticated/browser/Realtime runs were not checked. Prior unchanged-source runtime evidence is reused explicitly. Broad Unicode comparison, future adapters, physical input, cross-browser/accessibility, build/release and 10k/100k performance remain later verification gates. Completion establishes baseline contracts and documented limits, not bug-free behavior, full functionality or production readiness.

## 8. Requested Phase 2 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the requested baseline contract gate.** The current request's title controls scope; it maps to historical Phase 0. Historical Phase 2 Data-query correctness and all other implementation phases remain unstarted. Evidence: [Phase 2 audit README](C:/Users/User/barangayan/plans/evidence/admin-table-phase2-baseline/README.md), [final verification](C:/Users/User/barangayan/plans/evidence/admin-table-phase2-baseline/final-verification.json). Source contracts are verified; proposed improved behavior remains proposed. Completion does not establish bug-free behavior, full functionality, or production readiness.

### Current baseline, instructions and evidence linkage

Root/admin-web instructions and exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/) were read before writing audit code. Installed Next 16.3.0 fetching/error guides were consulted at `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` and `10-error-handling.md`. The Supabase skill, current ordering/count/range docs, versioned PostgREST v14 embedding/aggregate docs and changelog were reviewed; the changelog markdown failed with unsupported content type, so HTML was used. No subagents, packages or application changes were introduced.

`baseline.json` / `baseline-status.txt` capture HEAD `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`, branch, existing changes and hashes of **3,225 pre-existing non-task files**. The plan was already untracked. Highest repository migration is **`0109_invalidate_changed_profile_email_verification.sql`**; next unused would be `0110`, subject to rechecking before any future creation. No migration was created, applied or renumbered.

Fresh AST inventory equals the retained baseline: **68 source files / 638 active index entries**, including all eight table column objects, main/secondary queries, detail/review/form paths, Header/audit drawer, loading, permissions, edits and subscription locations. All **257 historical admin/shared files** and **107 historical migration files** also remain byte-identical (`scope-and-provenance.json`). This supports current linkage of section 6's detailed per-screen source contracts; it does not claim a fresh runtime replay. Index entries include JavaScript `Array.from` and storage `.from`; do not treat the index-entry count as a count of database queries.

Retained observations are expressly historical: 42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 completed interactions, five real feeds and two permission observations. Report hashes and completed cleanup consistency are revalidated. No fresh authenticated/browser/Realtime stack was created. Fresh local metadata is separate from the retained hosted capture; **current hosted state remains unknown**.

### Field, nested-view and behavior verification

`field-contracts.json` verifies **170 field definitions** across fresh local and retained hosted catalogs with current source locations. The fresh supporting `nested-catalog.json` adds **50 document-type/ID-submission/request-attachment/audit column definitions**, constraints, **32 policies**, **11 function definitions** and **21 publication entries**. These are metadata reads, not RPC/mutation execution. Existing source definitions and returned-row checks remain as documented in section 6.

| Contract | Verified current field/behavior and evidence |
|---|---|
| Submitted | Requests `service_requests.created_at` (`requests-table.tsx:435`–`:444`); Incidents `incidents.created_at` (`incident-table.tsx:579`–`:587`, detail `:302`–`:303`). Both nonnull timestamptz; neither table has `submitted_at`. |
| Registered | `drive_registrations.created_at`, nonnull timestamptz (`applicants-table.tsx:451`–`:456`, detail `:299`–`:300`). No registration `registered_at`; an audit metadata alias does not create a schema column. |
| Date created | Payment `created_at` (`transactions-table.tsx:616`–`:624`), distinct from paid/refund times. Proposed Health creation sort is `medical_drives.created_at`; current Health Date/default remains scheduled `drive_date` (`drive-table.tsx:402`–`:410`, `health/page.tsx:60`). |
| Other dates / fields | Joined=profile creation; Added=member creation; Hired=official `date_hired`. ID-submission `submitted_at` exists separately. Incident spelling is `confirmation_count`; protected score comes from `drive_registration_scores`, not the removed registration column. Members/registrations have no `deleted_at`. Complete captured column definitions are in both catalogs. |
| Search, filters and summaries | Eight page predicates, all searchable fields, trimmed/untrimmed semantics, initial segments, separate filters and independent summaries are linked in section 6/current index and exercised by `verify.mjs`. Added tests verify every Requests/Transactions/Incidents/Applicants status segment; payment cancelled remains in All. Health failed registration scans become zero counts; failed applicant profile lookup retains the score-backed row with null profile. |
| Active vs obsolete views | Directory's commented markup is excluded; its active table begins `resident-directory.tsx:997`. Request History remains cards (`:190`–`:200`, `:445` onward). Health Applicants is a reachable nested table. Household dialogs are local declarations; separate member-form/use-households files have no discovered callers. Storage bucket reads are distinct from public-table reads. |
| Selection/edit/action guards | Five selected snapshots use base ID but can stay stale. Preserve v1 request edit guards/v2 review, paid amount lock, Staff self guards, check-in-off center/time clearing, computed-score restrictions, mutation-row confirmation where present, audits and signed evidence. Shared failed saves still discard drafts (`editable-data-table.tsx:223`–`:225`); no edit-coordination improvement was implemented. |
| Frontend/loading/subscriptions | Existing mirror observer/frame/resize cleanup, search timers, inherited PageSkeleton, five directly refreshing table channels and separate Header/drawer channels remain verified source contracts. `pinLastColumn` pins width. Resize-drag unmount cleanup is absent. Requests/Transactions/Staff errors resemble empty rows; several secondary failures resemble zeros/empty options. Health has no registration-only feed. Retained feed tests do not establish long-run leak freedom. |
| Permissions | Layout checks admin role without deleted_at (`layout.tsx:24`–`:30`). Fresh local policy/helper definitions support the retained removed-admin request and active foreign-Health visibility findings. Scores retain protected active-admin/tenant membership. No service-role browse read or security change was added. |

Fresh local columns, constraints, indexes, RLS flags, collations and migration history match the **retained** hosted capture. Full policy equality is still false: its payment INSERT policy is absent locally. Affected SELECT/ALL policies match (`final-verification.json` includes the exact difference). No discrepancy was repaired; current hosted function/trigger or migration-file execution equality is not established. Historical row-scale observations in section 6 were not refreshed or used as performance evidence.

### Existing query capabilities and minimal proposals

**No existing main query meets the whole proposed browsing contract.** Every main query lacks exact count/range; filtering occurs after a capped fetch except database-side Incident category. Client ordering covers only fetched rows and lacks a unique tie-break. All eight reproduce 1,505→1,000 transport truncation in the mock; real capped reads and concatenated bounded API pages remain retained observations, not fresh tests of improved tables.

| Screen | Available direct read capability / verified limit | Minimal later proposal; not implemented |
|---|---|---|
| Requests | Base status/document/delete filters, resident/document parent ordering, cross-embed OR, exact count and inclusive pages have retained authenticated evidence. Current reference comparison is lexical. | Move predicates/order/count/range into direct read first. Evaluate only derived normalized/numeric reference keys; related search does not justify a blanket RPC. |
| Transactions | Nested spread parent ordering and multi-level OR work in retained authenticated fixtures; naive nested ordering failures have a working direct alternative. Base method/status/amount/date count/range are available. | Complete paid sums require narrow aggregate support while API aggregates are disabled; natural/normalized/source/label keys remain separate derived-expression work. No flattening RPC merely for nested joins. |
| Directory | Same-table search/role/delete/email/ID fields and raw column count/order/range available. Current projection omits updated_at. | Add modification projection later; preserve JSON household length and photo-presence semantics in complete summaries. Normalized blank-last comparison needs a precise key, not a generic endpoint. |
| Incidents | Category predicate already query-side; direct category/reporter parent ordering parsed with zero-row evidence. Exact count/range primitives available. | Move status/search before range; retain FK disambiguation, nullable joins and independent status summaries. Complex global related-search coverage remains narrower than Requests' evidence. |
| Health | Base fields count/order/range available. Grouped registration aggregate read rejected PGRST123 in retained API probes. | Narrow tenant/RLS-aware grouped counts including zero drives and cancelled registrations. Explicit tenant predicate and Manila-day calculation are adapter corrections; do not enable broad aggregates or scan all registrations into the browser. |
| Applicants | Inner score order/membership/count/range verified in retained sessions. Direct profile embed rejected PGRST200 because user_id references Auth users. | Narrow left profile relation/invoker read projection for global name sort while retaining inner scores; textual comorbidity expression must preserve `join(', ')` substring matches across separators. Do not add resident-name search. |
| Households | Base/head ordering/count/range available; related candidates retain parser/zero-row coverage limits. No soft-delete field. | Align DTO/mutation updated_at projections; preserve hard deletion, check-in cleanup, summaries and transformed label/name comparison. Head join alone does not warrant an RPC. |
| Staff | profile!inner candidate preserves missing-profile exclusion and supports related ordering/count/range; complex candidate coverage remains parser/zero-row. | Keep official role distinct from profile system role, preserve self guards and independent lookups; derived displayed-label/normalized keys only when needed. |

Raw sorting is not normalized/blank-last or displayed-label sorting. Literal punctuation works for tested escaped regex/quoted OR shapes, not every Unicode casefold. No measured query plan justifies a new index. Existing audit-browser predicate/keyset/request-ID patterns and UI loading/cleanup components should be reused where applicable; audit load-more is not numbered exact-count pagination. No speculative shared abstraction, backend read object or dependency was added.

Installed PostgREST client `2.112.1` still enables three automatic read retries (`types/common/common.ts:8`, `PostgrestBuilder.ts:340`–`:383`). Future bounded adapters must account for SDK retries/Retry-After plus page-correction budget and verified retry/abort APIs. This is a proposal, not an application change or proof of current request deadlines.

### Actual checks, failure investigation and completion checklist

The fixture files reuse existing Node/TypeScript VM tooling and add three focused tests. They remain synthetic DTOs isolated from production, with fixed time, comparison values, four permission actors and eight concurrency schedules. Schedule presence is not execution of permission/race behavior. Sizes remain 0/1/7/10/11/23/100/101/1,505 with five page sizes; SQL/array slice oracles cover 45 combinations without claiming current application pagination.

The first local metadata attempt failed on sandbox Docker named-pipe access; its logs are preserved. One approved read-only retry passed. A new profile-error test initially expected the wrong score from a different historical fixture: 43/44 passed. Source inspection showed this DTO generator supplied zero; the test now sets its own score and compares preservation against that input. The corrected run passed **44/44**, with the failed run retained. No application bug was “fixed” to satisfy an audit fixture.

- [x] Instructions/docs, working-tree baseline and highest migration prefix recorded (`baseline*`, README).
- [x] All eight source contracts, columns/mappings, queries/joins/search/filters, summaries, selection, guards, permissions, loading/errors and subscriptions have current linked evidence (section 6, fresh AST/field/nested catalogs).
- [x] Submitted/Registered/Date created and separate provenance/scheduled/modification fields verified; active and commented/unused code distinguished.
- [x] Direct frontend/API capabilities evaluated first; read proposals confined to demonstrated limitations; unresolved complex-query/Unicode/runtime coverage explicitly stated.
- [x] **44 Node tests passed, zero failed**; **11 independent SQL value assertions passed**. SQL uses read-only CTEs and 8-second statement/15-second process deadlines.
- [x] Admin typecheck exit 0; focused lint over 66 affected files exit 0. All new scripts pass syntax checks; evidence JSON parses; tracked whitespace check exit 0. Whole-package lint/build were not run in this request; earlier lint timeout remains historical, not a fresh result.
- [x] No accounts/services/containers/networks/ports/subscriptions/temp database objects created; no cleanup was needed. Existing local database only supplied read-only metadata and CTE checks.
- [x] Only plan/new evidence written by this task; admin/shared/migration files unchanged. Strict scope equality records exit 1 for two changed and three added concurrent resident Android/registration OTP files, with exact paths in `final-verification.json` / `scope-and-provenance.json`. Finalization stopped on the newly observed OTP documents; they were inspected and left untouched before the final check. No full workspace equality claim, cancelled Android work, later implementation, migration/deployment or production-data change.

**Baseline blockers: none. Unverified runtime facts:** fresh hosted state, authenticated browser/Realtime replay, broad Unicode equivalence, complete proposed query semantics, 10k/100k performance, build/release, physical input and cross-browser/manual accessibility. Existing baseline defects remain documented and unfixed. These limits are explicit evidence boundaries under the baseline gate; they remain later implementation/release requirements.

## 9. Requested Phase 3 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the baseline contract gate.** The user's title governs this run; historical Phase 3 Requests/Transactions integration and all implementation stages remain unstarted. Evidence: [Phase 3 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase3-baseline/README.md), [final verification](C:/Users/User/barangayan/plans/evidence/admin-table-phase3-baseline/final-verification.json). Completion verifies the existing baseline and identifies unknown runtime facts; it does not establish improved tables, bug-free behavior or production readiness.

### Instructions, baseline and provenance

Read the entire plan, root/admin-web instructions, exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/), installed Next 16.3.0 fetching/error guides, Supabase skill and ordering/count/range/versioned PostgREST v14 documentation before writing audit scripts. Markdown changelog failed with unsupported content type; HTML provided the relevant breaking-change review. No dependency or subagent was added.

`baseline.json` / `baseline-status.txt` record HEAD `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`, branch, existing dirty/untracked state and **3,275 pre-existing non-task file hashes**. The plan was already untracked. Highest repository migration remains **`0109_invalidate_changed_profile_email_verification.sql`**; next unused would be `0110`, subject to a future fresh check. No migration was created, applied or renumbered.

The fresh AST index equals the historical index: **68 files / 638 active entries**. Current indexed sources, **257 historical admin/shared files** and **107 historical migration files** are byte-identical to the source supporting retained runtime evidence. Retained report hashes also equal the preceding Phase 2 audit (`scope-and-provenance.json`, `final-verification.json`). Thus sections 6 and 8's complete per-screen/shared/nested contracts and one-based source locations remain applicable. Array/storage `.from` entries are not database-query counts. The index alone does not prove action execution.

Retained evidence stays historical: **42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 executed interaction assertions, five feeds and two permission observations**, with prior cleanup recorded. No fresh hosted/authenticated/browser/Realtime replay was performed. Current hosted state and fresh hosted acceptance are unknown.

### Current field and behavior contracts

`field-contracts.json` verifies **170 field definitions** across fresh local and retained hosted catalogs, linking eight active tables, full column objects/renderers/edit mappings, page queries and behavior/subscription locations. Fresh `nested-catalog.json` adds **50 supporting column definitions, 32 policies, 11 helpers and 21 publication entries**. Helper capture verifies definitions, not mutation execution. Sections 6 and 8 retain the complete field/filter/search/action matrices.

| Contract | Verified result / current source evidence |
|---|---|
| Submitted | Requests `service_requests.created_at` (`requests-table.tsx:435`–`:444`); Incidents `incidents.created_at` (`incident-table.tsx:579`–`:587`, detail `:302`–`:303`). Nonnull timestamptz; no separate submitted_at on either base table. |
| Registered | `drive_registrations.created_at` (`applicants-table.tsx:451`–`:456`, detail `:299`–`:300`). Nonnull timestamptz; registered_at audit metadata is an alias, not a database column. |
| Date created | Payment Date uses `payments.created_at` (`transactions-table.tsx:616`–`:624`); paid_at/refunded_at remain separate. Health's proposed creation sort is `medical_drives.created_at`; current Date/default uses scheduled `drive_date` (`health/page.tsx:60`, `drive-table.tsx:402`–`:410`). |
| Other fields | Joined=profiles.created_at; Added=household_members.created_at; Hired=barangay_officials.date_hired. ID-submissions has a separate submitted_at. Incident spelling is confirmation_count. Scores come from drive_registration_scores; `0106:5` removes obsolete registration priority_score. Members/registrations have no deleted_at. |
| Search/filters/defaults | Actual eight-page predicates and all listed searchable fields rerun through the VM. Requests/Transactions preserve untrimmed search; others trim. New tests cover Directory every non-verified state, Household check-in, Staff admin/non-admin raw-role membership, all Health date buckets/inactive precedence, invalid-tab defaults and displayed fields excluded from Directory/Incident search. |
| Membership/summaries | Preserve nullable embeds, Staff missing-profile exclusion, Applicant inner scores/nullable profile, Directory JSON household length/photo-presence semantics. Summaries remain independent of table filters; Health includes cancelled/omitted-drive registrations and capped/error scans can undercount. Household Parent / Other still excludes parents. Source tests reproduce these behaviors. |
| Selection/actions/permissions | Five ID-based detail snapshots can remain stale; no bulk selection. Preserve request v1 edits/v2 review, paid-amount lock, Staff self guards, computed-score restrictions, check-in-off center/time clearing, audit/signed evidence and returned-row checks where present. Role-only layout guard and public Health policy still support retained removed-admin/cross-tenant findings. Score access retains active-admin/tenant protection. No permission change was made. |
| Shared/loading/error/subscriptions | Existing horizontal mirror observers/frame/resize cleanup, PageSkeleton, mutation spinners, audit-browser request identity/keyset pattern and chip scroll buttons are reusable. Failed shared saves discard drafts; resize drag has no in-progress unmount cleanup; no browse sort/page API exists. Requests/Transactions/Staff errors resemble empty results; secondary errors can resemble zeros/options. Five table channels refresh directly and remove channels; Header/drawer channels are separate. Health has no registration-only feed. No long-run leak claim. |
| Active/nested vs obsolete | Directory commented table is excluded; active table starts `resident-directory.tsx:997`. Request History is cards, with its separate capped query. Health Applicants is a reachable nested table. Active household dialogs are local declarations; separate member-form/use-households have no discovered callers. Request review and audit drawer retain independent workflows. |

Fresh local columns/constraints/indexes/RLS/collations/history match retained hosting; affected SELECT/ALL policies match. Full policy equality remains **false** due to the retained hosted-only payment INSERT policy. Current hosted helper/trigger/migration-execution equality is not established. No discrepancy was repaired and no historical row-scale figure is presented as a fresh measurement.

### Existing query capability assessment — proposals only

**No existing main query satisfies complete filtering, global sorting, exact counts and valid numbered pagination together.** All lack main exact count/range, and post-fetch predicates/local ordering cover only the received batch; Incident category is already query-side. The capped mock reproduces 1,505→1,000 on all eight routes. Local `max_rows=1000` is configuration evidence, not proof of current hosted configuration. Raw sorting differs from normalized/display-label sorting and lacks the required unique tie-break in current clients.

| Screen | Existing capability / minimal later recommendation and evidence boundary |
|---|---|
| Requests | Retained authenticated direct status/document/delete predicates, to-one resident/document order, cross-embed OR, exact counts and bounded pages work. Move existing predicates/order/count/range into direct reads first. Only derived natural/normalized reference keys warrant further read support evaluation; no blanket RPC. |
| Transactions | Retained authenticated nested spread parent ordering and multi-level OR work despite naive nested-order failures. Direct method/status/date/amount count/range remain available. Complete paid sums need narrow aggregate support while aggregates are disabled; derived source/label/natural keys are separate work. |
| Directory | Same-table role/delete/search/email/ID/raw-order/count/range capabilities exist. Later add omitted updated_at projection, complete JSON/ID summaries and precise normalized blank-last keys. No generic endpoint justified. |
| Incidents | Direct category/reporter ordering has parser/zero-row evidence; category already filters before fetch. Later move status/search before range, preserve explicit FK hint, nullable joins and independent summaries. Full complex nonempty related-search coverage remains unresolved. |
| Health | Base date/type/active/stock/create/update order/count/range exist. Retained grouped aggregate probe fails PGRST123. Narrow tenant/RLS-aware grouped counts/sort must include zero drives and cancelled registrations; explicit tenant predicate/Manila day are adapter corrections. No broad API aggregate enablement or full-browser scan. |
| Applicants | Inner score membership/order/count/range have retained authenticated evidence. Direct profiles embed fails PGRST200 because user_id references Auth users. Minimal left-profile relation/invoker projection can support global name sorting; preserve inner scores and `join(', ')` substring expression. Do not add resident-name search. |
| Households | Base/head order/count/range capabilities exist, with complex related candidates limited to parser/zero-row evidence. Preserve hard deletes, check-in cleanup and summaries; align DTO/mutation updated_at projections. Head join alone does not warrant RPC. |
| Staff | profile!inner candidate preserves missing-profile exclusion and supports related order/count/range, with complex candidates limited to parser/zero-row evidence. Preserve official/system-role distinction/self guards/lookups. Derived displayed-label/normalized keys only as demonstrated. |

Versioned PostgREST docs distinguish parent to-one ordering from embedded ordering and confirm aggregate defaults. Exact count and inclusive ranges are primitives, not complete implemented behavior. Tested escaped regex/quoted OR literal punctuation does not establish every Unicode casefold. No benchmark/query plan justifies new indexes. Existing frontend/query patterns should be reused before adding support. No abstraction, backend read object, dependency or application code was added.

Installed PostgREST client retry source still permits **three default read retries** (`types/common/common.ts:8`, `PostgrestBuilder.ts:340`–`:383`); `.retry(false)` exists at `:262`. Future deadlines must include SDK retries/Retry-After and finite page correction. Current request deadlines were not changed or claimed verified.

### Actual checks, failures and completion checklist

New isolated fixture files reuse existing tooling and add five tests; synthetic comparison/permission/concurrency schedules are explicitly separated from retained runtime observations. Nine dataset sizes and five page sizes cover 45 combinations. The VM executes current page predicates/render branches/client comparisons, not RLS/SQL joins/Realtime. Independent SQL CTEs verify values, not application pagination or a full natural-reference comparator.

The first local read failed on sandbox Docker named-pipe access; failed logs/results remain in `local-attempt1*`. **One** approved read-only retry passed; separate nested metadata capture passed. No recursive retries/polling or resource creation. SQL statements have 8-second deadlines, database child processes 15 seconds, other checks 10–65 seconds. No fixture test failed in this run.

- [x] Instructions/docs, current status/HEAD/hash baseline and highest prefix recorded; no migrations changed.
- [x] Every affected table/shared/nested/query/column/search/filter/summary/selection/edit/permission/loading/error/subscription contract has current linked source/schema evidence (sections 6/8/9, fresh inventory/field/nested catalogs).
- [x] Submitted/Registered/Date created and obsolete/commented code distinctions verified.
- [x] Existing frontend and direct read capabilities assessed first; proposals are narrow, conditional and supported by demonstrated limits; unknown complex/Unicode/runtime facts remain explicit.
- [x] **49 Node tests passed / 0 failed**, **11 independent SQL value assertions passed**, deterministic sizes/comparison/permission/concurrency fixtures verified within stated boundaries.
- [x] Admin typecheck exit 0 (**20,523ms**); focused lint over 66 files exit 0 (**30,105ms**); ten scripts pass syntax checks, evidence JSON parses, source/provenance/field assertions and tracked whitespace check pass (`final-verification.json`). Whole-package lint/build were not run here.
- [x] No accounts/services/containers/networks/ports/subscriptions/temp database objects created; no cleanup needed. Existing database supplied metadata/read-only CTEs only; no production writes or migration/deployment.
- [x] Only plan/new evidence written by this task; indexed admin/shared/migration bytes preserved. Strict workspace equality remains exit 1 for concurrent Android app configuration changes, release-helper removal and EAS configuration addition, with inspected paths in `scope-and-provenance.json`. Finalization stopped on the additional app.json drift; its current content/diff were inspected, the failed scope report retained, and it was left untouched before finalizing. No restoration/deletion of unrelated files; no cancelled Android work or later stage started.

**Baseline blockers: none. Remaining unverified facts:** fresh hosted/authenticated browser/Realtime checks, complete improved query semantics, broad Unicode equivalence, performance at 10k/100k, whole-package build/release, cross-browser/manual accessibility and physical input. These are documented unknowns under the baseline gate and remain later implementation/release requirements. Existing baseline defects are unfixed.

## 10. Requested Phase 4 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the requested baseline stage.** This executes the historical Phase 0 completion gate, not the historical Phase 4 implementation. Evidence: [Phase 4 audit README](C:/Users/User/barangayan/plans/evidence/admin-table-phase4-baseline/README.md), `final-verification.json`, and sections 6/9's source contracts. Later implementation phases remain unstarted. The baseline gate requires documented contracts, explicit runtime unknowns and demonstrated backend-read requirements; it does not require the proposed improvements or Phase 6 acceptance criteria to already pass.

### Instructions, working-tree baseline and provenance

- Read root/admin-web `AGENTS.md`; repository search found no further applicable instruction file under the affected admin folders. Read exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/) before scripts, installed Next fetching/error-handling guides `06-fetching-data.md` / `10-error-handling.md`, and the Supabase skill. Current official count/range/order and versioned PostgREST v14 embedding/aggregate docs were reviewed. Changelog markdown failed with unsupported content type; HTML and relevant linked breaking-change entries supplied the review. Initial guessed installed-doc names did not exist; discovery located and read the correct guides before code was written. No package installation or subagent delegation.
- Original `baseline.json` records HEAD `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`, branch, status and **3,320 pre-existing non-task file hashes**. `baseline-status.txt` preserves unrelated Android/web/shared/OTP/config changes and existing evidence. This plan was already untracked. The manifest is immutable; only this plan and `plans/evidence/admin-table-phase4-baseline/` are allowed task writes.
- Highest repository prefix remains **`0109_invalidate_changed_profile_email_verification.sql`**. Next unused is **`0110` at this inspection**, recheck before any later creation. Fresh local and hosted catalog history also ends at `0109`. No migration created, applied, renumbered or changed.
- Fresh AST inventory: **68 files / 638 active entries**, equal to the retained runtime index. Current indexed sources, **257 historical admin/shared files** and **107 historical migrations** match their retained runtime hashes. Nine runtime/cleanup report hashes match the preceding Phase 3 audit. This supports reuse of historical observations; it does not represent fresh browser, Auth or change-feed execution.

### Verified table, field and behavior contracts

`field-contracts.json` records **255 verified required field definitions**: 85 each in fresh local, fresh hosted and retained hosted catalogs. Complete captured catalogs include **192 affected base columns**, types/defaults/nullability, keys/constraints, indexes, policies/RLS, collations and history. Eight current column objects include source-linked cell renderers, edit mappings and row-key behavior. The AST indexes all main and secondary queries plus review/detail/form/shared dependencies. `nested-catalog.json` adds 50 local supporting fields, 32 policies, 11 helper definitions and 21 publication entries; these are metadata checks, not execution of every RPC or write action.

| Area | Verified fact / required correction | Current evidence |
|---|---|---|
| Submitted | Requests and Incidents use base `created_at`, nonnull timestamptz; neither table has `submitted_at`. Legacy Request Submitted can be backdated. | `requests-table.tsx:439`–`:444`, `incident-table.tsx:579`–`:587`, Incident detail `:302`–`:303`; three catalog field checks |
| Registered / Date created | Applicants use registration `created_at`, with no `registered_at` column. Transaction Date is payment `created_at`, distinct from paid/refund dates. Health's current Date is scheduled `drive_date` (date); proposed Date created is drive `created_at` (timestamptz). | Applicant cell `:451`–`:456` / detail `:299`–`:300`; Transaction `:620`–`:624`; Health `page.tsx:60`, drive cell `:402`–`:410`; `field-contracts.json` |
| Other dates / score | Joined = profile creation, Added = member creation, Hired = official `date_hired`; modification and ID-submission dates are distinct. Score belongs to `drive_registration_scores`; `0106` removed the obsolete registration score. Members/registrations have no `deleted_at`. Locale en-PH alone does not enforce Manila time. | Section 6 timestamp table; current three catalogs; migrations `0105`/`0106`; `packages/shared/src/lib/format.ts:17`–`:26` |
| Search/filter/membership | All eight page predicates and defaults retain their exact fields and trim behavior. Requests/Transactions do not trim; the others do. Applicants search joined comorbidities text, not resident names. Preserve nullable embeds, explicit Request/Incident FK hints, inner-score membership and Staff missing-profile exclusion. Incident category already filters before fetch. | Fresh `source-inventory.json` / `field-contracts.json`; actual-page VM tests; sections 6/9 per-screen tables |
| Summaries / secondary reads | Summaries are independent of main search/filter membership but remain capped. Directory uses JSON household length and ID-photo presence, independent of normalized members/review status. Health includes cancelled registrations, gives zero-registration drives zero, and counts registrations for omitted drives. Transactions sum ledger centavos by method/status. Household Parent / Other presently excludes parents. Failed option/count/profile reads can silently substitute empty/zero/null. | Four new focused tests plus retained summary/error tests; Directory `page.tsx:104`–`:114`; Health `:64`–`:90`; Transactions `:88`–`:90`; Households `:72`–`:79`, `:122` |
| Selection / edits / permissions | Five stable-ID detail snapshots can remain stale. Failed shared saves discard drafts. Retain v1 Request guards/v2 review, paid-amount lock, Staff self guards, affected-row confirmation where present, check-in-off timestamp/center clearing, computed Applicant fields, audits and signed evidence. Removed-admin rejection is absent from layout/current-role helper; broad active-drive Health visibility remains supported by current policies and historical sessions. | Editable table `:118`, `:196`–`:225`; Request guards `:351`–`:454`; Transactions `:689`; Staff `:195`–`:298`; Households `:271`–`:273`; layout `:24`–`:30`; fresh nested helper/read policy definitions; retained interactions/permission results |
| Shared UI / loading / errors / subscriptions | Existing mirror is horizontal, without bounded vertical viewport/sticky/sort/pager APIs; `pinLastColumn` pins width. Mirror observers/frame/resize have cleanup; active drag lacks an unmount cleanup. Parent loading boundary exists. Requests/Transactions/Staff main errors resemble empty results. Five table feeds refresh directly with channel removal; Header/drawer feeds are independent. Health has no registration-only feed. | `table-scroll-area.tsx:28`–`:75`; Editable table `:134`, `:158`–`:180`; current AST subscription/loading entries; retained five real feeds and bounded unmount observation |
| Active / obsolete / nested views | Directory's commented table is excluded; active EditableDataTable is at `:997`. Request History is cards. Health Applicants is the nested table. Active household dialogs are inline; separate member-form/hook has no discovered caller. Request review, header last-five lookup and notification/audit drawer retain their independent contracts. | Parser excludes comments; section 6 dependency/line references; current identical AST; existing audit-browser keyset/30-row/stale-request/error/channel behavior at hook `:38`–`:245` |

All paths in the table are within `apps/admin-web/src/` unless explicitly qualified. Section 6 and the fresh index provide complete paths/line locations. Baseline defects remain unfixed; selection/navigation/error/deadline improvements are proposals, not claims of existing behavior.

### Existing query capabilities and minimal read recommendations — proposals only

**No current main query meets complete filtering + global sorting + exact counts + valid numbered pagination together.** All eight fetch one batch, use post-fetch predicates (except query-side Incident category) and locally sort without a unique ID tie-break; none requests exact count/range. Local API cap is 1,000 (`supabase/config.toml:18`). Fresh hosted SQL maximum-row setting is null, so current hosted transport cap remains unavailable. Retained isolated API results demonstrate a 1,000-row cap there, not necessarily current hosted configuration.

| Screen | Existing supported query capability | Smallest demonstrated limitation / later proposal |
|---|---|---|
| Requests | Base status/document/deletion predicates; resident/document parent order, cross-embed OR, exact counts/ranges demonstrated in retained authenticated fixtures. | Move predicates before paging; natural/normalized reference keys need a derived read expression. Related search alone does not warrant an RPC. |
| Transactions | Base method/status/date/amount, nested spread parent order and multi-level OR/collector search work in retained nonempty authenticated fixtures. | Complete sums need narrow aggregate support while API aggregates are disabled. Naive nested-order failures have a working direct alternative; no flattening RPC solely for joins. Display/natural/normalized keys remain separate gaps. |
| Directory | Same-table search/status/role/deletion predicates, raw ordering, exact counts/ranges supported; fresh schema confirms `updated_at`. | Add projection/DTO later. Complete JSON/ID aggregates and normalized blank-last text need precise read expressions, not a blanket browse RPC. |
| Incidents | Query-side category; base fields and to-one category/reporter ordering; exact count/range. | Preserve FK hint, nullable search OR and independent summaries. Complex candidate evidence is parser/zero-row, not full nonempty authenticated acceptance. Derived label/text keys are conditional. |
| Health | Base date/type/active/stock/create/update predicates/order and exact count/range. | Embedded counts rejected PGRST123 in retained probes: narrow tenant-aware grouped count/sort including zero/cancelled is justified. Add explicit admin tenant and Manila-day predicates later. Do not enable broad aggregates or download all registrations. |
| Applicants | Registration base predicates, drive relation and inner one-to-one score ordering/count/range demonstrated with real isolated sessions. | `user_id` targets Auth users; direct profile embed failed PGRST200. Minimal left user-ID/profile relation or invoker projection is justified for global names. Joined-array substring text requires an expression preserving separators; no resident-name search addition. |
| Households | Base/head fields, filters/order/count/range supported; related candidates have parser/zero-row evidence. | Align DTO/mutation `updated_at`, retain hard deletes, complete summaries and normalized text. Head join alone does not justify a new RPC. |
| Staff | Profile inner embed preserves missing-profile exclusion; related parent order/count/range parsed. | Preserve system/official role distinction and self guards; full complex nonempty authenticated candidate remains a later check. Normalized/displayed role keys may need derived expressions. |

Ordinary timestamps/numbers/booleans can use existing order/null options and base ID ascending. Text normalization, blank-last handling, label ordering and full natural/custom reference order are not satisfied by raw enum/lexical order. ICU `und-x-icu` exists on fresh local/hosted PG17.6; the limited SQL fixture is not proof of every Unicode/custom-reference comparison. Retain existing components and audit-hook patterns first. No new dependency, generic dynamic SQL endpoint, eight-RPC abstraction or index is justified; representative query plans/benchmarks have not demonstrated an index need. Session/RLS-aware read support remains conditional and must not broaden score or tenant access.

### Schema alignment, scale, actual checks and completion checklist

Fresh hosted catalog matches retained hosted structural keys. Fresh local/hosted columns, constraints, indexes, RLS flags, collations, history and SELECT/ALL policies match. Full policy equality remains **false**: hosting has one additional payment INSERT policy. Catalog equality is not full trigger/function/file-execution equality. Fresh local helper definitions still omit deletion in `current_role`/`current_barangay_id`; Health public read still ORs with tenant-admin read. Score privacy remains supported by policies plus retained isolated sessions; metadata alone is not fresh hosted authenticated acceptance.

Fresh hosted exact aggregate counts: profiles **28**, requests **69**, payments **55**, incidents **30**, drives **13**, registrations **10**, members **6**, officials **5**. All 69 references canonical; no cancelled registrations; six drives without registrations. Largest inspected tenant groups: profiles 28, requests 69, drives 13. These populations cannot establish 10k/100k performance. No production records were changed or copied into fixtures.

Synthetic fixtures use fixed time/IDs and no credentials/network. Nine dataset sizes × five page sizes cover **45 combinations**; edge values include duplicate/mixed-case/accent/Unicode/null/blank/numeric-token/custom/long text, missing joins and literal punctuation. Four permission actors/eight concurrency schedules are scenario definitions, distinct from historical executed Auth/browser/Realtime evidence. VM checks execute current predicates/render branches and extracted client comparators, not SQL ordering/joins/RLS. Duplicate reference DTOs are not valid UNIQUE-constrained inserts. Independent SQL CTE oracles are not application pagination.

Failure investigation: local named-pipe access was denied; failed logs/results were preserved, then **one** approved read-only retry passed. Combined 66-file lint hit 60 seconds without diagnostics; config/source inspection found no reported code error. Two disjoint 33-file batches with 45-second limits passed. Initial 49-test suite passed; after four new tests the 53-test suite passed. No failed run is relabeled as success, uncontrolled polling or recursive retry. SQL limits are eight seconds, local DB child limits 15 seconds; other checks have finite 10–60 second deadlines.

- [x] Applicable instructions/docs read; original working-tree HEAD/status/hashes and highest prefix captured; migrations preserved.
- [x] All eight table/shared/nested/source/join/field/search/filter/summary/selection/edit/permission/loading/error/subscription contracts have current source/schema linkage, with retained runtime boundaries explicit.
- [x] Submitted/Registered/Date created and active/commented/obsolete code distinctions verified.
- [x] Existing frontend and direct-query capabilities assessed first; only demonstrated limitations receive narrow conditional proposals; unsupported complex/Unicode/runtime claims remain explicit.
- [x] Fresh local/hosted structural/read-policy alignment and exact hosted small-scale aggregates recorded; existing INSERT-policy difference preserved without repair.
- [x] **53 Node tests passed / 0 failed; 11 independent SQL value assertions passed**; required deterministic fixtures verified within stated boundaries.
- [x] Admin typecheck exit 0 (**20,733ms**), incremental writes disabled. Two lint batches exit 0 (**31,796ms**, **21,319ms**) cover 66 distinct affected files. Initial combined lint timeout retained; whole-package lint/build not run.
- [x] Final script verifies script syntax, JSON reports, schema/field/provenance linkage, results, strict workspace preservation and tracked whitespace (`final-verification.json`). No unexplained concurrent drift accepted.
- [x] No task accounts/services/containers/networks/ports/subscriptions/temporary DB objects created; no cleanup needed. Existing database reads were read-only. Historical runtime cleanup report remains hash-verified.
- [x] Task writes restricted to plan/new evidence; all **3,320** baseline non-task files preserved, no outside additions. Resident Android UI and cancelled work excluded; no later phase, application behavior, migration application, deployment or production write.

**Baseline blockers: none. Remaining unverified later gates:** fresh authenticated hosted/browser/Realtime acceptance, execution of every mutation/RPC, complete improved query/global comparison semantics and broad Unicode equivalence, full trigger/function alignment, current hosted API cap, production build/release, physical inputs, cross-browser/manual accessibility and 10k/100k performance. Retained source-linked runtime observations are representative historical results. No bug-free, full-functionality or production-readiness claim is made.

## 11. Requested Phase 5 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the requested baseline contract gate.** The title governs scope, matching historical Phase 0's gate: each screen has a documented contract, runtime unknowns are explicit, and backend proposals have demonstrated requirements. Historical Phase 5 implementation and all other implementation/release stages remain unstarted. Evidence: [Phase 5 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase5-baseline/README.md), [final verification](C:/Users/User/barangayan/plans/evidence/admin-table-phase5-baseline/final-verification.json). This is baseline verification, not verification of the proposed improvements.

### Instructions, current baseline and evidence provenance

- Read the plan, root/admin-web instructions, exact [Expo v57 documentation](https://docs.expo.dev/versions/v57.0.0/), installed Next 16.3.0 data-fetching/error guides under `node_modules/next/dist/docs/01-app/01-getting-started/`, Supabase skill, official order/range/count/OR docs, and versioned PostgREST v14 embedding/aggregate docs before audit scripts. The changelog markdown reader rejected its content type; the HTML changelog and linked API grants, PostgreSQL minor-release and Realtime restrictions supplied the review. Initial guessed Next guide paths failed; file discovery located and read the actual paths before scripts. No dependency installation or delegation.
- `baseline.json` / `baseline-status.txt` record HEAD `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`, branch `main`, existing dirty/untracked state and **3,371 pre-existing non-task file hashes**. The plan was already untracked; unrelated Android/web/shared/OTP/config and previous evidence are preserved. Only this plan and the new `admin-table-phase5-baseline/` directory are task-owned writes.
- Highest repository prefix: **`0109_invalidate_changed_profile_email_verification.sql`**; next unused **`0110` at this inspection**, subject to a fresh check before future creation. Fresh hosted/local history ends at `0109`. No migration created, applied, edited or renumbered.
- Fresh TypeScript AST inventory equals the prior runtime index: **68 files / 638 active entries**. All indexed source files, **257 historical admin/shared files** and **107 historical migration files** match retained runtime hashes. Nine runtime/cleanup report hashes match Phase 4's provenance. Thus section 6's complete per-screen/shared/nested contracts and one-based locations remain current. The AST is a source index, not execution of every action; storage/Array `.from` entries are not database query counts.
- Retained runtime evidence remains historical: **42 Auth/REST assertions, 11 query edges, eight rendered screens, 30 completed interactions, five real feeds and two browser permission observations**. No fresh authenticated/browser/Realtime replay or hosted end-user acceptance was performed. Prior failures remain failures; cleanup is hash-linked, not rerun.

### Verified field, behavior, shared and nested contracts

`field-contracts.json` verifies **255 required field definitions** (85 each in fresh local, fresh hosted and retained hosted catalogs), with all eight complete active column objects, render/edit mappings and main/secondary query locations. Captured base catalogs include **192 columns**, types/defaults/nullability, keys/constraints, indexes, policies/RLS, collations and history. Fresh local **and hosted** supporting catalogs add **50 columns, 32 policies, 11 helper definitions and 21 publication entries**. These definitions are metadata evidence, not execution of the RPCs.

All short source paths in the following table start under `apps/admin-web/src/`; `source-inventory.json` provides the complete path and active expression. Section 6's eight-screen matrix remains applicable without changing any application bytes.

| Contract | Current verified finding / necessary later correction | Evidence |
|---|---|---|
| Submitted | Requests and Incidents use nonnull timestamptz `created_at`, with no base `submitted_at`. Request legacy editing can backdate this timestamp. | `app/(admin)/requests/requests-table.tsx:439`–`:444`; Incident cell `incident-table.tsx:579`–`:587` and detail `:302`–`:303`; three catalog assertions |
| Registered / Date created | Applicants use registration `created_at`; `registered_at` is audit metadata, not a column. Transactions Date is payment `created_at`, distinct from paid/refund timestamps. Health Date/default currently uses scheduled `drive_date` (date); proposed Date created is drive `created_at`. | Applicant cell `:451`–`:456`, detail `:299`–`:300`; Transactions `:620`–`:624`; Health `page.tsx:60`, drive cell `:402`–`:410`; `field-contracts.json` |
| Other dates and fields | Joined=profile creation; Added=member creation; Hired=official `date_hired`. ID-submission `submitted_at` is real and separate. Score comes from `drive_registration_scores`; `0106` removed registration-table score. Members/registrations have no `deleted_at`. `en-PH` does not enforce Manila time. | Section 6 timestamp table; nested/base catalogs; migration `0106:5`; shared `format.ts:17`–`:26` |
| Queries/search/filters | Preserve explicit Request/Incident FK hints, nullable embeds, Applicants inner-score membership plus nullable profile lookup and Staff missing-profile exclusion. Requests/Transactions do not trim search; other screens trim. Applicant array search joins with comma-space and can match across separators; resident names are not searched. Incident category filters before fetch. | All eight page expressions in fresh inventory/VM tests; sections 6/10 field/search matrices |
| Defaults/summaries | All eight existing defaults and filters are tested. Summaries are independent of table filters but capped. Directory household count is JSON length; ID presence is independent of review state. Health counts cancelled/omitted-drive registrations and gives zero drives zero. Transaction sums use ledger centavos. Parent / Other currently excludes parents. | `verify.mjs` / `fixtures.log`; Directory `page.tsx:104`–`:114`; Health `:64`–`:90`; Transactions `:88`–`:90`; Households `:72`–`:79`, `:122` |
| Selection/guards/actions | Five stable-ID selected snapshots can remain stale; no bulk selection. Preserve request v1 guards/v2 review, paid-amount lock, Staff self-edit/removal guards, Applicant computed-field restrictions, check-in-off center/time clearing, affected-row checks where present, audits and signed ID evidence. Shared failed saves discard drafts. | Requests `:351`–`:476`; Transactions `:689`; Staff `:195`–`:298`; Households `:271`–`:273`; Editable table `:196`–`:225`; retained interactions |
| Permissions | Layout/current-role/current-tenant helpers omit profile deletion. Health's public active-drive SELECT policy broadens visibility beyond tenant-admin policy, while main query lacks tenant predicate. Protected scores retain active-admin/tenant/deletion checks. These gaps are findings, not authorization to change security. | Layout `:24`–`:30`; Health `page.tsx:56`–`:60`; fresh hosted/local helper definitions and read policies; retained session/route observations |
| Shared/loading/errors/subscriptions | Existing horizontal mirror, observers/frame/resize cleanup and inherited PageSkeleton are reusable. No vertical bound, sticky/sort/pager API exists; `pinLastColumn` pins width. Active resize drag has no unmount cleanup. Requests/Transactions/Staff main failures resemble empty results; secondary errors can become zeros/empty/null. Five directly refreshing table feeds remove channels; Header/drawer channels are separate. Health has no registration-only feed. | Scroll wrapper `:28`–`:75`; Editable table `:134`, `:158`–`:180`; current AST; VM failures; retained five real feed checks |
| Active/nested/obsolete | Directory's commented table is excluded; active EditableDataTable starts `resident-directory.tsx:997`. Request History is a capped card query. Health Applicants is the nested table. Household dialogs are inline; separate member-form/use-households has no discovered caller. Request review, Header last-five lookup, notifications and audit drawer keep independent contracts. | Section 6 nested contracts; current identical AST/dependency locations; audit hook `:38`–`:245` |

Fresh supporting catalog comparison finds **three raw function-text differences solely from CRLF versus LF** (`admin_add_household_member`, `current_role`, `current_barangay_id`). All **11 captured helper definitions match after line-ending normalization**, including attributes and identity arguments; columns, constraints, policies and publications match without normalization (`supporting-alignment.json`). This extends earlier local-only supporting evidence; it does not establish full trigger/function equality, write semantics or migration-file execution equality.

### Existing frontend/query capability assessment — proposals only

**No current main query meets complete filtering + global sorting + exact counts + valid numbered pagination together.** Current queries fetch one batch; post-fetch predicates and local comparator ties do not cover a complete result set. Incident category is the existing query-side exception. The strengthened mock asserts no exact count/range and reproduces missing searchable sentinels beyond the cap on **all eight screens**. Local `max_rows=1000` is configuration evidence; fresh hosted maximum-row setting is null/unavailable. Retained API cap tests describe the isolated environment, not current hosting.

| Screen | Existing direct capability and evidence level | Minimal later recommendation, not implemented |
|---|---|---|
| Requests | Base status/document/deletion predicates, to-one parent ordering, cross-embed OR, exact count/range have retained authenticated fixture evidence. | Move existing predicates before paging. Natural/normalized reference comparison needs a derived read key; the related search does not justify a browse RPC. |
| Transactions | Nested spread parent order and multi-level OR/collector search work in retained nonempty authenticated fixtures; naive nested syntax failures have a working direct alternative. | Narrow complete ledger aggregates while API aggregates are disabled; natural/normalized/display-source keys are separate gaps. No flattening RPC solely for nested joins. |
| Directory | Same-table predicates/raw-order/count/range; schema includes `updated_at` but projection/DTO omit it. | Align projection later; preserve complete JSON/ID summaries and normalized blank-last comparison. No generic endpoint. |
| Incidents | Category already query-side; base/category/reporter order/count/range; complex related candidates have parser/zero-row evidence only. | Move status/search before page, retain FK hint/nullable OR and independent summaries. Validate nonempty complex candidates later; derived text/label keys only where required. |
| Health | Base date/type/active/stock/create/update order/count/range. Retained embedded counts fail PGRST123. | Narrow tenant/RLS-aware grouped count/sort including zero drives/cancelled registrations; explicit tenant/Manila-day adapter correction. Do not enable broad aggregates or download all registrations. |
| Applicants | Inner score and drive order/membership/count/range have retained authenticated evidence. Direct profile embed fails PGRST200; `user_id` FK targets Auth users. | Minimal left user-ID/profile relation or invoker projection for global names while retaining inner scores; comma-space joined-array search expression. Do not add resident-name search. |
| Households | Base/head order/filter/count/range; complex related candidates have parser/zero-row evidence. | Align `updated_at` DTO/return projections; retain hard deletes/check-in cleanup/complete summaries. Head join alone does not warrant new RPC. |
| Staff | Profile inner embed candidate preserves missing-profile exclusion; parent order/count/range parsed, with complex nonempty candidate coverage unavailable. | Preserve official/system-role distinction/self guards; validate complex candidates and derived displayed-label/text keys later. |

The reusable audit-browser predicate/request-ID/keyset/limit and loading/scroll-control patterns should be evaluated before adding modules. Audit load-more is not a numbered exact-count pager. Parent `.order('relation(field)')` differs from embedded `referencedTable` order ([PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html)); [exact count](https://supabase.com/docs/reference/javascript/select) and [inclusive range](https://supabase.com/docs/reference/javascript/range) are primitives, not existing complete table behavior. Raw enum/text order does not meet displayed-label, trim/case/blank-last or natural/custom reference comparison. Tested punctuation/Unicode samples do not establish every Unicode casefold. ICU exists on inspected PG17.6 databases, but the small CTE does not prove the complete future comparator.

Installed PostgREST client allows **three default read retries**, with `.retry(false)` and abort support (`PostgrestBuilder.ts:262`, `:340`–`:383`; `types/common/common.ts:8`). Future deadlines must encompass Retry-After, SDK retries and at most one page correction; current request deadlines were not changed or claimed bounded. No speculative eight-RPC abstraction, generic dynamic SQL, dependency or new index is justified. Representative plans/large-scale benchmarks have not demonstrated index need.

### Actual results, finite operations and completion checklist

Fresh hosted structural keys match retained hosting. Fresh local/hosted columns, constraints, indexes, RLS flags, collations, migration history and SELECT/ALL policies match. Full policy equality is **false**: one extra hosted payment INSERT policy remains untouched. Current exact aggregate counts are profiles **28**, requests **69**, payments **55**, incidents **30**, drives **13**, registrations **10**, members **6**, officials **5**; all 69 references canonical, zero cancelled registrations and six drives without registrations. Largest inspected tenant groups are profiles 28, requests 69, drives 13. These counts cannot establish 10k/100k performance; no real records were copied to fixtures.

Fixtures remain fixed-time synthetic DTOs, with nine sizes × five page sizes (**45 combinations**), comparison edges, four permission actors and eight concurrency schedules. These schedules are definitions, separate from historical executed Auth/browser/feed results. The VM executes actual page predicates/render branches/client comparators while mocking transport/joins; it does not execute SQL ordering, RLS or Realtime. Duplicate references are comparator DTOs, not valid UNIQUE-constrained inserts. The read-only SQL CTE is an independent value oracle, not implemented pagination.

The initial local read failed on sandbox Docker named-pipe access; `local-attempt1*` preserves the failure. One approved read-only retry passed; the supporting metadata read also passed. Initial **53 tests passed**, then two added focused checks and exact-count assertions produced **55 passed / 0 failed**. No test failure was relabeled. Two disjoint lint batches were used based on the prior audit's combined timeout; **no combined lint attempt occurred in this stage**. Their inherited report wording about a retained timeout refers to prior evidence, not a new failure; the reusable script wording is corrected. SQL has 8-second limits, DB children 15 seconds, tests 35 seconds, lint batches 45 seconds, typecheck 60 seconds; no automatic audit retry/polling or new subscriptions.

Finalization initially stopped on two concurrent non-task registration-document changes: `plans/Resident_Registration_Brevo_Supabase_OTP_Execution_Plan.md` and `plans/evidence/resident-registration-otp/live-acceptance.md`. The earlier scope check had passed. Current registration status/device-matrix text was inspected and left untouched; `scope-attempt1.json`, `final-attempt1.json` and `concurrent-change-review.json` retain the failure and exact reviewed hashes. Strict workspace equality remains **false / exit 1**; **3,369 of 3,371 files remain byte-identical**, no files are missing and no outside files were added. Final consistency accepts only those exact inspected document hashes; new drift stops it. The immutable baseline was not rewritten. All admin/shared/migration linkage remains unchanged.

- [x] Applicable instructions/docs, immutable working-tree baseline and highest migration prefix recorded.
- [x] All eight tables and shared/nested/data/query/join/field/search/filter/summary/selection/edit/permission/loading/error/subscription contracts have current source/schema evidence and explicit historical runtime boundaries.
- [x] Submitted/Registered/Date created and active/commented/obsolete distinctions verified.
- [x] Existing components/direct query capabilities evaluated first; only demonstrated gaps receive narrow conditional read proposals.
- [x] Fresh local/hosted base/supporting catalog comparison and exact hosted small-scale counts recorded; raw line-ending and INSERT-policy differences documented without repair.
- [x] **55 Node tests / 0 failures; 11 independent SQL value assertions passed.** Required deterministic fixtures verified within their stated boundaries.
- [x] Admin typecheck exit 0 (**19,499ms**); two lint batches exit 0 (**20,856ms**, **19,882ms**) cover 66 distinct affected files. Incremental writes disabled. Whole-package lint/build not run.
- [x] Final verifier checks script syntax, JSON consistency, field/source/report provenance, catalog differences, successful results, tracked whitespace and all **3,371 baseline files**. **3,369 unchanged; two reviewed concurrent document differences preserved**, zero missing/outside additions. Strict equality exit 1 remains explicit; reviewed-evidence consistency is recorded separately in `final-verification.json`.
- [x] No task services/accounts/containers/networks/ports/subscriptions/temporary DB objects created; cleanup is unnecessary. Historical cleanup report is hash-verified; current SQL is read-only.
- [x] Only plan/new evidence changed; resident Android UI and unrelated work preserved. No later implementation, migration application, deployment or production-data write.

**Baseline blockers: none. Explicitly unverified later/runtime facts:** current hosted transport cap; fresh authenticated hosted/browser/Realtime acceptance; execution of every mutation/RPC; full trigger/function alignment; complete proposed global filtering/comparison/page correction and broad Unicode semantics; production build/release; physical inputs, cross-browser/manual accessibility and 10k/100k performance. These remain documented unknowns, not successful checks. Existing defects remain unfixed; no bug-free, full-functionality or production-readiness claim is made.

## 12. Requested Phase 6 — Baseline and contract verification only — 2026-10-11

**Status: COMPLETE for the requested baseline gate.** The requested title controls scope. This revalidates historical Phase 0; historical Phase 6 release preparation and all implementation stages remain unstarted. Evidence: [current audit README](C:/Users/User/barangayan/plans/evidence/admin-table-phase6-baseline/README.md), [final verification](C:/Users/User/barangayan/plans/evidence/admin-table-phase6-baseline/final-verification.json). Baseline completion requires supported existing contracts, documented runtime unknowns and demonstrated narrow read requirements; it does not require future improvements or release acceptance to already pass.

### Instructions, baseline and evidence boundaries

Root/admin instructions, exact [Expo v57 reference](https://docs.expo.dev/versions/v57.0.0/), installed Next 16.3.0 testing/Vitest guide, Supabase skill, official order/count/range/changelog and versioned PostgREST v14 embedding/aggregate docs were read before audit scripts. Installed Next guidance does not support claiming Vitest tests async Server Components; the existing VM is a predicate/render-branch oracle, not Next/React end-to-end rendering. Documentation lookup failures and fallbacks are recorded in `documentation.json`. No package installation or delegation.

`baseline.json` / `baseline-status.txt` record HEAD **a75ee345224ed7f93d57b3e0c4de24e7540ba82c**, branch **main**, the pre-existing dirty/untracked tree and **3,424 non-task file hashes**. Baseline overwrite is prohibited. Highest migration is **0109_invalidate_changed_profile_email_verification.sql**; next unused would be **0110**, subject to rechecking before any later creation. No migration created, applied, altered or renumbered.

Fresh AST: **68 files / 638 active entries**, exactly matching the retained source inventory. Current indexed files, **257 historical admin/shared files** and **107 historical migrations** match retained runtime hashes. Nine historical runtime/cleanup report hashes match the preceding audit. Sections 1/6/11's complete per-screen/shared/nested matrices and one-based locations therefore remain current; `source-inventory.json` and `field-contracts.json` supply full paths/expressions. Array/storage calls are not database-query counts; indexing and byte parity are not execution of every action.

Historical observations remain historical: **42 Auth/REST assertions, 11 query-edge assertions, eight rendered screens, 30 interaction assertions, five real feeds, two permission observations**. No fresh authenticated/browser/Realtime fixture stack was recreated. Fresh metadata/aggregate reads below are separate from retained end-user runtime evidence.

### Verified contracts and corrections

`field-contracts.json` verifies **255 required field definitions** across fresh local, fresh hosted and retained hosted catalogs. Full base catalogs capture **192 columns**, types/defaults/nullability, constraints/FKs, indexes, policies/RLS, collations and migration history. Supporting catalogs add **50 columns, 32 policies, 11 helper definitions and 21 publication entries**. These are metadata reads, not execution of RPCs/mutations.

| Contract | Verified result and current evidence |
|---|---|
| Submitted | Requests `service_requests.created_at` (`requests-table.tsx:435`–`:444`); Incidents `incidents.created_at` (`incident-table.tsx:579`–`:587`, detail `:302`–`:303`). Nonnull timestamptz; neither base table has submitted_at. Legacy Request edit can backdate creation. |
| Registered | `drive_registrations.created_at` (`applicants-table.tsx:451`–`:456`, detail `:299`–`:300`). Nonnull timestamptz; registered_at audit metadata is an alias, not a column. |
| Date created | Payment Date = `payments.created_at` (`transactions-table.tsx:616`–`:624`), distinct from paid_at/refunded_at. Health proposed Date created = `medical_drives.created_at`; current Date/default = scheduled `drive_date` (`health/page.tsx:60`, `drive-table.tsx:402`–`:410`). |
| Other fields/time | Joined=profiles.created_at; Added=household_members.created_at; Hired=official date_hired. ID-submission submitted_at exists separately. Incident spelling is confirmation_count. Scores come from drive_registration_scores; 0106 removed the obsolete registration score. Members/registrations have no deleted_at. en-PH locale alone does not enforce Manila time (`packages/shared/src/lib/format.ts:17`–`:26`). |
| Queries/search/filters | All eight current main queries lack exact count/range and filter after fetching, except Incident category applied before fetch. Preserve Request/Incident FK hints, nullable relationships, Applicant inner scores/nullable profile lookup and Staff missing-profile exclusion. Requests/Transactions search remains untrimmed; others trim. Applicant search uses applicant number/drive title/comorbidities.join(', '), excludes resident name. Exact remaining fields, segment defaults and dropdown membership are in section 6/current page index and rerun source tests. |
| Summaries/options | Summaries retain independent membership from table filters but remain capped. Directory household count is JSON length, ID presence is photo-array presence. Health counts cancelled/omitted-drive registrations and zero-registration drives. Transactions sum ledger centavos by method/status. Parent / Other currently excludes parent. Several failed secondary reads substitute empty/zero/null. Source tests reproduce these facts; no aggregate was corrected. |
| Selection/edit guards | Five selected stable-ID snapshots can stay stale; no bulk selection. Preserve Request v1 guards/v2 review, paid-amount lock, Staff self-edit/removal guards, Applicant computed fields, check-in-off timestamp/center clearing, affected-row checks where present, audits and signed ID evidence. Shared failed saves discard drafts (`editable-data-table.tsx:196`–`:225`). Proposed navigation/save/refresh coordination is not existing behavior. |
| Shared/loading/error/feed | Existing horizontal mirror and observer/frame/window-resize cleanup are reusable (`table-scroll-area.tsx:28`–`:75`). No bounded vertical/sticky/sort/pager contract exists; pinLastColumn pins width. Resize drag lacks unmount cleanup (`editable-data-table.tsx:158`–`:180`). Parent PageSkeleton exists. Requests/Transactions/Staff main failures resemble empty results. Five table feeds refresh directly/remove channels; Header/drawer feeds are separate. Health has no registration-only feed. No long-running leak freedom is established. |
| Permissions | Layout role check omits deleted_at (`(admin)/layout.tsx:24`–`:30`); current_role/current_barangay_id also omit it. Health's public active-drive read ORs with tenant-admin policy and its main query lacks tenant restriction (`health/page.tsx:56`–`:60`). Scores retain active-admin/same-tenant/deletion checks. Fresh policies/helpers support retained access findings; this is not fresh authenticated hosted acceptance or permission to change security. |
| Active/obsolete/nested | Directory's commented historical table is excluded; active EditableDataTable starts `resident-directory.tsx:997`. Request History is capped cards. Applicants is the reachable nested Health table. Household dialogs are inline; repository search finds only declarations of separate MemberFormModal/useHouseholds, no callers. Request review, Header last-five lookup and audit drawer keep independent contracts. |

Source paths above are within `apps/admin-web/src/` unless qualified. Section 6 retains full screen matrices for all columns, queries/joins, search fields, summaries, mutations, dialogs, signed storage evidence and subscriptions; the fresh identical AST and runtime-source hashes revalidate those locations. Verified defects remain unfixed; future behavior remains a proposal.

### Existing frontend/query capabilities — minimal proposals only

**No current main query satisfies complete filtering, global sorting, exact counts and valid numbered pagination together.** Source tests reproduce search loss beyond a simulated cap on every screen. Local max_rows=1000 (`supabase/config.toml:18`); fresh hosted SQL maximum-row setting is null, so current hosted transport cap remains unavailable. Retained isolated cap tests do not establish current hosted configuration.

| Screen | Existing direct capability / evidence level | Smallest demonstrated gap and later recommendation |
|---|---|---|
| Requests | Base status/document/deletion predicates; resident/document parent order, cross-embed OR, exact count/range have retained nonempty authenticated evidence. | Move existing predicates/order/count/range before paging. Derived natural/normalized reference key needs evaluation; related search does not justify a browse RPC. |
| Transactions | Base method/status/date/amount; nested spread parent order and multi-level OR/collector filters work in retained authenticated fixtures. | Complete ledger sums need narrow aggregate support while API aggregates are disabled. Naive nested-order failures have a direct working alternative; no flattening RPC solely for joins. Natural/normalized/display-source keys are separate gaps. |
| Directory | Same-table role/deletion/email/ID/search fields, raw column order/count/range available. Schema has updated_at; restricted projection/DTO omit it. | Align projection later; preserve complete JSON household/ID summaries and normalized blank-last text expressions. No generic browse abstraction. |
| Incidents | Category already query-side; base/category/reporter ordering/count/range. Some complex related candidates have only parser/zero-row evidence. | Move status/search before range, preserving FK hint/nullable OR and independent summaries. Nonempty complex-candidate semantics remain later validation; derived label/text keys only where required. |
| Health | Base date/type/active/stock/create/update predicates/order/count/range; retained embedded aggregates rejected PGRST123. | Narrow tenant/RLS-aware grouped count/sort including zero drives and cancelled registrations. Explicit tenant and Manila-day adapter correction. Do not enable broad aggregate API or download all registrations. |
| Applicants | Drive/base fields and inner one-to-one score order/membership/count/range have retained authenticated evidence. Direct profiles embed failed PGRST200; user_id FK targets auth.users. | Minimal left user-ID/profile relationship or invoker projection for global resident-name sorting while retaining inner scores. Separator-preserving comorbidity text expression; do not add resident-name search. |
| Households | Base/head fields/filter/order/count/range; complex related candidates retain parser/zero-row limits. | Align updated_at DTO/mutation-return projections; preserve hard deletes/check-in cleanup/independent summaries. Head join alone does not warrant an RPC. |
| Staff | Profile inner embed preserves missing-profile exclusion; parent order/count/range parsed. Full complex nonempty candidate coverage remains unavailable. | Preserve official/system-role distinction and self guards; validate candidates and only necessary derived displayed-label/normalized keys later. |

Reuse existing components, loading states, audit-hook predicate/request-ID/cleanup patterns first. Audit keyset load-more is not numbered exact-count pagination. Parent `.order('relation(field)')` differs from embedded `referencedTable` order ([PostgREST v14 embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html)). [Exact counts](https://supabase.com/docs/reference/javascript/select) and [inclusive ranges](https://supabase.com/docs/reference/javascript/range) are supported primitives, not completed application behavior. Raw enum/lexical order does not satisfy displayed-label/trim/case/blank-last/natural reference rules. The fixture does not establish broad Unicode equivalence. No benchmark/query plan justifies a new index, dependency, generic dynamic SQL endpoint or eight-RPC architecture.

Installed PostgREST client permits three default read retries (`types/common/common.ts:8`, `PostgrestBuilder.ts:360`–`:373`), with `.retry(false)` at `:262`. Future adapters must bound wall-clock time across SDK Retry-After/retries and at most one page correction. Current app requests were not changed or claimed deadline-safe.

### Fresh schema, fixtures, checks and completion gate

Fresh local/hosted columns, constraints, indexes, RLS flags, collations, migration history and affected SELECT/ALL policies match. Hosted structural keys match retained hosting. Full policy equality remains **false**: one extra hosted payment INSERT policy. Supporting columns/constraints/policies/publications match; three raw helper definitions differ solely by CRLF/LF, and all **11 match after line-ending normalization**. No difference was repaired; complete trigger/function/file-execution equality remains unverified.

Fresh hosted exact aggregate counts: profiles **28**, requests **69**, payments **55**, incidents **30**, drives **13**, registrations **10**, members **6**, officials **5**. All 69 references canonical, zero cancelled registrations, six drives without registrations. Largest inspected tenant groups are profiles 28, requests 69, drives 13. These populations cannot establish 10k/100k performance. No production rows were copied into fixtures.

Existing deterministic DTO/VM tooling was reused in the new evidence directory: fixed instant, synthetic IDs, nine dataset sizes × five page sizes (**45 combinations**), comparison/missing-related edges, four permission actors and eight concurrency schedules. Schedules are definitions, separate from historical executed sessions/browser/feeds. Duplicate reference DTOs are not valid UNIQUE-constrained database inserts. Mocked predicates/render branches/comparators and independent SQL CTE assertions are separate from SQL order/RLS/React/Realtime execution.

Actual checks: **55 Node tests passed / 0 failed**, **11 independent SQL assertions passed**, admin typecheck **exit 0 / 21,692ms**. Two concurrent 33-file lint batches timed out at 45 seconds without diagnostics; a smaller batch also timed out, a second smaller batch passed. Process inspection found no remaining audit children. A one-file host-runtime diagnostic passed; final host-runtime lint of **66 affected files passed / 23,204ms**, bounded at 60 seconds. No smaller batches 2/3, whole-package lint or build were run. The timeout cause is unproven and failures remain in evidence. First local metadata attempt failed on sandbox named-pipe access; one approved read-only retry passed. No failed result was relabeled successful.

SQL deadlines are 8 seconds; DB children 15 seconds, source tests 35 seconds, lint attempts 45/60 seconds, typecheck 60 seconds. No automatic audit retry/polling, service/account/container/network/port/subscription or temporary database object was created. Final process inspection found zero matching audit/lint Node processes (`process-cleanup.json`); no resource deletion was needed. Retained disposable cleanup is hash-verified.

- [x] Applicable instructions/docs, immutable current working-tree baseline and highest migration prefix recorded.
- [x] Eight affected tables and shared/nested/source/query/join/field/search/filter/summary/selection/edit/permission/loading/error/subscription contracts have current source/schema evidence and explicit runtime boundaries.
- [x] Submitted/Registered/Date created and active/commented/unused/obsolete distinctions verified.
- [x] Existing frontend/direct query capabilities evaluated first; backend-read proposals restricted to demonstrated gaps.
- [x] Fresh read-only base/supporting local/hosted catalogs and exact small-scale counts captured; differences recorded without repair.
- [x] Deterministic isolated fixtures verified: 55 Node tests and 11 independent SQL assertions passed.
- [x] Admin typecheck and final 66-file lint passed; initial timeouts and diagnostic results retained, finite limits documented.
- [x] Final script-syntax/JSON/source/field/schema/report-provenance/result/whitespace consistency gate passed. Of 3,424 baseline files, 3,419 are byte-identical; five concurrent Android registration/navigation changes were reviewed and preserved. No missing/outside additions. Strict scope remains exit 1; reviewed-evidence consistency passes separately.
- [x] No task-created runtime resources remain; no migrations/deployment/production-data writes/application behavior/Android UI changes or later implementation.

Finalization first stopped on five concurrent changes: Android `app.json`, root `_layout.tsx`, root `index.tsx`, `lib/setup-navigation.test.ts` and `lib/setup-navigation.ts`. Current contents concern resident registration configuration/callback routing; they were read and left untouched. Baseline hashes alone cannot provide the exact baseline-to-current textual delta; tracked Git diffs include pre-existing work. `scope-attempt1.json`/`final-attempt1.json` retain the failure; `concurrent-change-review.json` records exact inspected current hashes. New drift fails final consistency; the immutable baseline was not rewritten. All admin/shared/migration linkage remains unchanged.

**Baseline blockers: none. Strict workspace equality remains false for the five inspected concurrent files. Explicit runtime/later unknowns:** hosted transport cap, fresh authenticated hosted/browser/Realtime acceptance, every mutation/RPC execution, full trigger/function alignment, implemented global comparison/filter/page correction and broad Unicode semantics, production build/release, physical input, cross-browser/manual accessibility and 10k/100k performance. These unknowns are documented within the baseline gate, not successful checks. No bug-free, full-functionality or production-readiness claim.

## 13. Current Phase 0 execution revalidation — 2026-10-11

**Status: COMPLETE.** The selected phase is the Phase 0 defined in section 4. Its existing work and completion gate were already satisfied; no application change was necessary. Current evidence: [revalidation README](C:/Users/User/barangayan/plans/evidence/admin-table-phase0/revalidation/README.md) and `revalidation/result.json`. Historical reports remain intact.

- [x] Root/admin instructions, exact Expo v57 reference and installed Next.js page guide read; overall plan, selected-phase work/dependencies/gate and dirty repository reviewed. No deeper affected AGENTS.md found. Highest prefix remains `0109`; no migration required.
- [x] Eight-screen field/filter/sort, labels/dates, nested views, summaries, selection/edit guards, errors/loading and subscription contracts remain supported by 68 unchanged indexed source files. The current source tests reproduce baseline behavior; improvements in sections 2–5 remain later work.
- [x] Fresh read-only hosted/local columns, constraints, indexes, RLS, collations and migration history checked. Hosted keys match prior evidence. Local/hosted affected read policies match; the known extra hosted payment INSERT policy remains. Full trigger/function equality and current hosted transport cap are unverified. No discrepancy repaired.
- [x] Fresh hosted exact counts and tenant scale match section 6; no large-data inference. Conditional narrow read requirements remain demonstrated, with existing direct-query capabilities evaluated first.
- [x] Existing deterministic comparison/paging/permission/concurrency fixtures rerun: **55 Node tests passed, 0 failed**, **11 independent SQL assertions passed**, including **45** size/page-size combinations. Mocked tests are distinguished from database and browser execution.
- [x] Admin typecheck passed in **20,612ms**; lint of **66** affected files passed in **44,523ms**. No production build or fresh browser/Auth/Realtime run. Nine retained runtime reports and **107** migration files still match historical hashes; section 6's representative executed flows remain valid baseline evidence for the unchanged indexed source.
- [x] Current **3,483** pre-existing files are byte-identical; no additions outside this plan/evidence scope. All unrelated resident Android/web/shared/OTP changes preserved. No later phase, application edit, dependency install, service creation, schema mutation, migration application, deployment or production-data write.

The restricted local Docker read initially failed on named-pipe access. Its failed artifacts remain preserved; one approved read-only execution passed. An early final-check invocation stopped because lint was still running; the completed final invocation passed. No product regression was found. Checks have bounded deadlines and no automatic retry loop.

**Phase 0 blockers: none.** Retained browser coverage is Chrome-only and was not rerun in this execution. Existing access/count/draft/detail defects remain documented for later scoped implementation. Authenticated hosted acceptance, full trigger/function alignment, physical input, cross-browser/accessibility, 10k/100k performance and production-release checks remain unverified later gates. Completion establishes the baseline contract, not completed sorting/pagination features or production readiness.


## 14. Phase 1 shared frontend foundation execution — 2026-10-11

**Status: COMPLETE for the section 4 Phase 1 completion gate.** Evidence: [Phase 1 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase1/README.md), `browser-results.json`, `unit-tests.log`, `typecheck.log`, `lint.log` and `build-webpack.log`. This execution supersedes the baseline-only restrictions for Phase 1, while preserving all historical audit evidence.

- [x] Root/admin instructions and parent/deeper instruction locations checked; exact Expo v57 and installed Next.js navigation documentation read. Overall plan, Phase 0 dependency, selected work/gate, active source and dirty repository reviewed. Existing shared foundation requirements were outstanding.
- [x] Validated allowlisted state, canonical URLs, query identity, sort descriptors and shared control interfaces implemented. Search/filter/sort/size changes reset page 1; page-only changes retain state. Pending navigation merges subsequent changes rather than overwriting earlier controls.
- [x] Exact five page sizes, empty/partial ranges and First/Previous/Next/Last controls implemented. Initial unknown counts remain caller-owned; query failures have separate Retry and are not rendered as empty success.
- [x] Opt-in measured bounded viewport, sticky opaque headers, exact gutter-aware mirror range and persistent labeled horizontal buttons implemented. Controls and footer remain siblings in normal flow, with compact short-height behavior and internal overflow.
- [x] Named keyboard regions, Tab escape, segmented pressed buttons, visible focus, active matching-header aria-sort, keyboard editing/resizing, failed-draft Retry/Cancel, stable edit snapshots and focus restoration implemented. Pending rows are inert; committed announcements are retained during pending/error states.
- [x] Single search timer/history cancellation, canonical navigation comparison, latest-query gate, refresh coalescer/edit deferral, conditional measurements, animation-frame synchronization and observer/listener/frame cleanup verified. Adapters/subscriptions are not integrated yet.
- [x] **51 Vitest tests passed** including all 45 size/count combinations and delayed-result/refresh concurrency contracts. **11 browser fixture groups passed on each of Chrome 154.0.8037.99, Firefox 153.0 and WebKit 26.5.** Tests execute actual shared components/CSS with synthetic rows and a Next navigation mock; no database completeness claim.
- [x] Fixture browser acceptance establishes wide-table row/column reachability, sticky/header alignment, both-axis boundaries, keyboard controls/focus escape, accessible labels and bounded responsive layout. Firefox/WebKit boundary chaining was fixed with a scoped fallback; Ctrl/Meta zoom and nested editor behavior remain protected. Ten mount cycles return table observers/listeners to baseline. The unchanged DataTable dashboard fixture stays unbounded and has no new sorting/pagination behavior.
- [x] Admin typecheck, affected source/test/config lint, script syntax and final **webpack production build passed**. Default Turbopack remains unverified after font-network and child-process startup failures; the latter's cause is unproven. Failed browser attempts and test-accounting corrections remain recorded separately.
- [x] Test tooling is declared and repeatable. The lockfile's Phase 1 dependency delta affects only the admin package and Playwright entries; unrelated entries are preserved. No resident UI, shared resident contract, migration, database write, account/container creation, deployment or later-phase route integration. Fixture browsers/server are closed; ignored browser cache/build output are retained for repeat checks.

**Implementation blockers: none for the shared fixture completion gate. Remaining release-verification limitations:** Edge is not installed; physical wheel/trackpad/OS scrollbar behavior, native Safari/browser zoom and manual screen-reader checks were unavailable. Responsive tests cover 1200×900, 600×450 and 300×225 plus CSS zoom 2/4, sidebar, dark and forced colors. These are not substitutes for manual release verification. Authenticated live-route/dashboard and eight-screen data/security/Realtime acceptance remain later-phase work. Current Phase 1 completion does not assert production readiness or integrated sorting/pagination on the eight routes.


## 15. Phase 2 — Data-query correctness execution — 2026-10-11

**Status: COMPLETE for the section 4 Phase 2 gate.** Evidence: [Phase 2 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase2/README.md), results.json, filters.json, security.json, performance-final.json and final check logs. This execution supersedes historical baseline-only restrictions for Phase 2. Later phases remain unstarted.

Server-only adapters and local descriptors support all eight tables. Migration 0110 supplies invoker read projections, independent summaries, normalized and numeric comparison keys, nullable related membership and active-admin tenant gates. Migration 0111 caches existing SELECT-policy session lookups without changing their predicates or ALL/write policies and adds only the two measured Requests reference indexes. No resident DTO, stored reference, write action or production route was changed. The adapter fetches a globally ordered/count-bounded ID page, then bounded payloads with the same filters. One correction is permitted; changed results and independent query failures remain explicit errors under a shared deadline.

### Verified completion checklist

- [x] Reviewed exact Expo v57 docs, applicable AGENTS, installed Next guidance, plan dependencies, baseline contracts and repository state before coding. Initially clean; unrelated Android/OTP changes appeared concurrently and were preserved.
- [x] All 66 sorts in both directions compose to independently expected full fixture order. Five page sizes, exact counts/membership, correction, empty results, related search beyond 1,000 and literal punctuation pass. Each response is bounded to at most 100 rows. Applicants has 1,506 members because a deliberate extra nullable-profile registration retains its score; the other tables have 1,505.
- [x] Thirty-three combined filter checks pass with independent summary invariance. Health totals include cancelled registrations and missing-score registrations; zero registrations and nullable joins are retained.
- [x] Resident, other-tenant admin, removed admin and anon permission checks pass; resident score read is empty. All 16 views are invoker secured with read-only grants, helpers are private invokers, underlying RLS remains enabled, SELECT predicates remain equivalent, ALL/write policies are unchanged.
- [x] Warm representative 10k tenant benchmark passes for default, deep reference, joined resident/reporter/score/head, substring, aggregate and label reads: nine p95 values from 44.75 to 476.82ms, 20 samples after two warmups per candidate, loopback, DB/REST each limited to two CPUs. Full adapter/API measurement includes exact count and payload retrieval. Earlier failures and measured remedies are retained in evidence.
- [x] Sixty unit tests, affected-file lint, admin typecheck and final webpack production build pass.
- [x] Temporary owned database/REST services, network and private credentials removed; cleanup.json reports no remaining task resources.

**Phase 2 blockers: none. Remaining integration/release limitations:** migrations are not deployed to source or hosted databases; hosted advisors were not run. Browser route/action/Realtime integration belongs to Phases 3–5 and was not started. UI committed-result timing, manual accessibility/input checks, other network profiles and 100k deep-page evaluation remain later release verification. Representative fixture performance does not establish universal production latency. This work does not implement the cancelled resident Android audit.

## 16. Phase 3 — Requests and Transactions execution — 2026-10-12

**Status: COMPLETE for the section 4 Phase 3 integration gate.** Evidence: [Phase 3 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase3/README.md), `final-verification.json`, `scope.json` and the individual reports linked there. Earlier execution restrictions are historical; Phases 4–6 remain unstarted.

Both pilot routes now use the Phase 2 bounded authoritative server adapters and the Phase 1 opt-in controls, bounded sticky table and pagination. No local array sorting/filtering remains in either pilot. Requests defaults to Reference ascending and Active, with All first; Transactions defaults to Date created descending and All. Complete action options are independent batched reads under one deadline, while the existing latest-100 transaction reference suggestions remain a separate action lookup. Timestamp cells use Asia/Manila.

### Verified completion checklist

- [x] Read root/admin instructions, exact Expo v57 reference, installed Next navigation guidance, plan context/dependencies and dirty repository before code. Phases 1–2 were already satisfied; both route integrations were outstanding. Unrelated Android/OTP work and concurrent additions were preserved.
- [x] Connected five page sizes, global search/filter/sort, stable column IDs, persistent horizontal access, bounded sticky scrolling, exact ranges/empty states and one authoritative page correction. Chrome executes all **34** pilot sort/direction combinations against database results before paging; unchanged concatenated pages cover all **1,505** records on each route without gaps or duplicates. Related-name search reaches the row beyond the 1,000-row transport cap. Retained Phase 2 comparator/permission/10k benchmark evidence remains unchanged.
- [x] Delayed rapid search/sort/direction changes merge atomically, reset page 1 and commit the latest query; history cancels pending search. Table, summary and option failures remain independent and retry preserves the full query. Lookup-dependent actions are disabled on option failure, with explicit retry.
- [x] Failed saves retain the same record's draft and block navigation; Retry persists/audits the same record and reconciles membership. Real request lifecycle changes, v1 editors, v2 review navigation and guards, request creation for a resident beyond the cap, transaction creation/centavo edit, paid-amount guard, refund submission/retry/claim links and archive pass. Audit and confirmation reads use the actual fixture; provider submission is mocked and no PayMongo endpoint was contacted.
- [x] Three actual request `postgres_changes` events produce **zero** refreshes while editing and **one** after cancel, without losing draft identity. Ten client route mount cycles retain one request subscription and baseline table observers. Navigation settles edits and pending rows remain inert; refreshes are coalesced with a finite deadline.
- [x] Chrome **154.0.8037.99**, Firefox **153.0** and WebKit **26.5** pass integrated defaults, sizes/ranges, controls, scrolling/resizing, narrow layout, beyond-cap search and empty results. The final Firefox/WebKit repeat has no uncaught errors. Eight authenticated permission cases pass across both routes: anon/resident/removed admin redirect, foreign admin sees only its own tenant.
- [x] Warm control-to-committed-result p95 meets 1.5 seconds for the recorded local profile: **658.26ms Requests**, **706.54ms Transactions**, ten samples per route, loopback/unthrottled development preview, 1,505 rows each and DB/REST limited to two CPUs each. This is not a universal production latency claim.
- [x] **65 unit tests**, full admin lint, admin typecheck and final **webpack production build** pass. Final source/snapshot, script syntax, whitespace, prerequisite preservation and cleanup checks are recorded in the Phase 3 evidence.
- [x] Added sequential migration **0112_admin_reference_index_writer_permissions.sql** after rechecking highest prefix 0111. Actual service-role writes through 0111's expression indexes demonstrated missing execution permissions. Only usage of the helper schema and execution of its two pure comparison functions are granted to the existing writer; anon remains denied, no view/table grants or RLS policies change. Verified in the task-owned fixture. Existing 0110/0111 and Phase 2 files remain byte-identical.
- [x] Owned preview processes, four fixture containers, network and generated private credentials removed. No source/hosted migration application, deployment, source user/data write, resident UI change or later-phase implementation. Existing unrelated work is preserved; `scope.json` records concurrent drift separately from owned edits.

**Phase 3 implementation blockers: none. Remaining release/environment limits:** migrations **0110–0112** must precede the consuming admin deployment in Phase 6; they were applied only to disposable fixtures. Hosted advisors/acceptance, external refund-provider integration, native Safari/Edge, physical input/OS scrollbar settings, native zoom, manual screen-reader checks, other network profiles and 100k deep-page benchmarks remain unverified release work.

Earlier failed attempts remain intact. Incorrect test locators, invalid synthetic v2/refund restoration values and a Windows screenshot overwrite failure were corrected; affected groups were rerun. Completed positive groups from stopped reports are identified individually rather than declaring those whole attempts passed. Early WebKit runs passed table behavior but reported a shared-header background notification access-control error after login/navigation. An unchanged-dashboard/Requests diagnostic showed ten successful notification responses and no errors; awaiting the initial read before navigation yielded a passing browser repeat. The exact earlier cause remains unproven; no notification code was changed. Firefox retained one navigation-aborted background notification read without an uncaught error. These limits do not invalidate the verified pilot integration gate or establish production readiness.

## 17. Phase 4 — Directory, Households, and Staff execution — 2026-10-12

**Status: COMPLETE for the section 4 Phase 4 integration gate.** Evidence: [Phase 4 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase4/README.md), `final-verification.json`, `scope.json` and the individual reports linked there. Historical baseline-only restrictions do not govern this execution. Phases 5–6 remain unstarted.

The three routes now use bounded authoritative Phase 2 adapters and the Phase 1 controls. Name ascending and All remain explicit defaults. All 24 supported sort fields work in both directions before paging; no local array sorting/filtering remains. Independent complete summaries, five exact sizes, visible labels, sticky headers, persistent horizontal controls, pending-row protection and query-preserving retries are connected to real server navigation. Required resident action options are independent complete batched reads. Directory/member DTOs and mutation projections include modification dates; existing views already supplied them, so no migration was required.

### Verified completion checklist

- [x] Read applicable instructions, exact Expo v57 and installed Next data/navigation guidance before code; inspected plan context, Phase 3 prerequisite, existing source and dirty repository. No dependency installation or delegation. The immutable baseline records 3,731 existing files; concurrent unrelated drift is recorded separately and preserved.
- [x] All **48** sort/direction combinations match database order before pagination. Complete unchanged concatenations on the three routes have no gaps or duplicate IDs. Mixed case, accents, blank/duplicate/long names and missing structured-name fields are represented; retained Phase 2 comparator/permission/10k evidence remains unchanged. Chrome, Firefox and WebKit pass integrated defaults, sizes/ranges, scrolling/resizing, narrow layout, beyond-cap search and empty results. Trimmed search and allowlisted filters retain their contracts.
- [x] Combined filters retain independent exact summaries. Table/summary/options failures remain separate and Retry preserves the full query. Delayed rapid changes merge, reset page 1 and settle the latest query; Back cancels pending search. An invalid page is corrected once. Real removals reduce a 23-row result from page 3 to page 2; seven matches at size 100 render seven rows.
- [x] Details revalidate by ID independently of page/search membership, preserve identity off-page and distinguish failed reads from confirmed unavailability. Actual deletion produces a recoverable unavailable state. Native modal keyboard/focus behavior passes; mouse/keyboard triggers restore correctly, with Search as the fallback for missing rows. Long titles wrap within a scrollable header at short heights. Directory JSON count **2** remains distinct from the same resident's **1** normalized member row.
- [x] A failed directory save retains its same-record draft and blocks navigation; Retry persists and audits it. Actual member creation using a resident beyond the cap, member removal, check-in-off timestamp/center ID/name cleanup and staff profile/role changes/removal pass. Every current-user editable-cell/removal guard remains effective. ID verification and revocation execute the real RPC, request-history read and audits; evidence signing/image responses are synthetic. Existing invitation endpoints remain unchanged; provider delivery was not tested.
- [x] Three actual household `postgres_changes` events cause **zero** refreshes during an edit and **one** after cancel. Selected-member refresh/error/deletion behavior passes. Ten client route mount cycles retain one household subscription and one table ResizeObserver/MutationObserver each. All **12** route permission cases pass: anon/resident/removed-admin rejection and foreign-tenant isolation across three routes.
- [x] Warm control-to-committed-result p95 is **642.58ms Directory**, **774.37ms Households**, **610.58ms Staff**: ten samples per route, loopback/unthrottled development preview, approximately 1,500 records per route, database/REST two CPUs each. This meets 1.5 seconds for this profile and does not establish universal or production latency.
- [x] **65 unit tests**, full admin lint, admin typecheck and final **webpack production build** pass. The final shared browser fixture repeat passes **33** groups on Chrome **154.0.8037.99**, Firefox **153.0** and WebKit **26.5**. The short-window check demonstrated that the old 48px bound could leave only the sticky header visible; the scoped shared correction measures a compact header/row/scrollbar budget without stretching short tables. Dashboard/unbounded compatibility, boundaries and cleanup pass.
- [x] Owned preview processes, four fixture containers, network and private credentials removed. Migrations **0110–0112** and later-route source remain unchanged. No source/hosted data write, deployment, resident UI change or later-phase implementation. Final source/snapshot, syntax, whitespace and preservation checks are recorded in the Phase 4 evidence.

**Phase 4 implementation blockers: none. Remaining release/environment limits:** migrations **0110–0112** must precede the consuming deployment in Phase 6; they were applied only to disposable fixtures. Hosted acceptance/advisors, invitation provider delivery, real storage delivery, native Safari/Edge, physical inputs/OS scrollbar settings, native zoom, manual screen-reader checks, other network profiles and 100k deep-page benchmarks remain unverified release work.

Failed attempts remain intact. Initial detail-state null access, short-window action obstruction and long-title clipping were fixed and affected checks rerun. Split-name, empty-table, column-index and structured-name test locators were corrected; an asynchronous audit assertion was replaced with bounded observation. The baseline fixture's normalized member was removed by the existing add-member RPC's JSON synchronization; the Realtime test uses a dedicated synthetic member. Observer baseline capture now waits for registration. Earlier partial reports contribute only their explicitly completed positive groups, never whole-report success. Final post-verification source cleanup removes trailing whitespace only. No production-readiness or bug-free claim is made.

## 18. Phase 5 — Incidents, Health, and Applicants execution — 2026-10-12

**Status: COMPLETE for the section 4 Phase 5 integration gate.** Evidence: [Phase 5 README](C:/Users/User/barangayan/plans/evidence/admin-table-phase5/README.md), `scope.json` and the individual reports linked there. Route integration was implemented in an earlier session of this request; this execution ran the outstanding acceptance groups and final checks against that unchanged source. Historical baseline-only restrictions (section 11) do not govern this execution. Phase 6 remains unstarted.

The three routes use bounded authoritative Phase 2 adapters and the Phase 1 controls. Incident Reports defaults to Submitted (`incidents.created_at`) descending with Open; Health to Date created (`medical_drives.created_at`) descending with Upcoming, keeping Drive date a separate sort; Medical Applicants to Registered (`drive_registrations.created_at`) descending with All. All is first on Incident and Health. No local array sorting/filtering remains. Registration counts are complete aggregates including cancelled and missing-score registrations; resident names join before paging; scores remain administrator-only with inner-score membership. Detail dialogs label and display the same creation fields. No migration or dependency was added; the highest prefix remains `0112`.

### Verified completion checklist

- [x] Read root/admin instructions, exact Expo v57 reference, plan context/dependencies and the dirty repository before continuing. Phases 1–4 were satisfied and the three route integrations already existed; Chrome browsing and the Firefox/WebKit matrix had passed, while flows, actions, Realtime, timing, final static checks, plan/evidence records and cleanup were outstanding. Concurrent unrelated resident-web work was preserved.
- [x] All **50** sort/direction combinations match database order before pagination; complete unchanged concatenations have no gaps or duplicate IDs. Five sizes, exact ranges, empty state without an invalid page label, keyboard scrolling/Tab escape, resizing, narrow layout and beyond-cap trimmed search pass on Chrome **154.0.8037.99**, Firefox **153.0** and WebKit **26.5**.
- [x] Combined filters keep independent complete summaries. Health Today is a subset of Upcoming and combines with category. A drive with more than 1,000 registrations and a zero-registration drive render their database counts. Missing-score registrations are excluded; missing-profile registrations are retained with a blank resident; resident-name order is global. Table, summary and option failures stay separate and Retry preserves the query. Delayed rapid controls merge into one page-1 query, Back cancels pending search, an invalid page is corrected once, and 23 rows render at size 100.
- [x] Real incident and drive creation, guided incident status changes, drive active edits and drive removal persist and audit. Failed inline drafts block navigation, keep identity and retry/persist/audit on all three routes. Complete resident lookup beyond the cap and own-tenant-only drives feed the real registration RPC, which stores a score; status change and cancellation persist. Detail dialogs show Submitted / Date created / Registered at from `created_at`, retain failed modal drafts, revalidate after save and restore focus.
- [x] Three actual `postgres_changes` events per route cause **zero** refreshes during an edit and **one** after cancel. Selected details revalidate off-page and distinguish failed reads from confirmed unavailability. Ten client mount cycles keep one channel and one table ResizeObserver/MutationObserver per route. All **12** route permission cases and **18** query security cases pass, including zero exposed protected scores.
- [x] Warm control-to-committed-result p95 is **634.54ms Incidents**, **690.44ms Health**, **745.99ms Applicants**: ten samples per route, loopback/unthrottled development preview, about 1,500 rows per route. This meets 1.5 seconds for this profile only.
- [x] **68 unit tests**, full admin lint, admin typecheck and webpack production build pass on the final source. The shared browser fixture passes **33** groups across Chrome, Firefox and WebKit.
- [x] Owned preview/proxy stopped; four fixture containers, network and private credentials removed. One-off codemod scripts previously left in ignored `dist/` were moved to the evidence `codemods/` folder as provenance. Scope review finds only concurrent resident-web files outside the Phase 5 allowance; no resident Android, shared package, migration or deployment change.

**Pre-existing defect requiring an owner decision:** administrators cannot remove incidents. The only administrator-reachable `incidents` SELECT policy (migrations 0022/0025) requires `deleted_at IS NULL`, so the soft-delete UPDATE fails with `42501` regardless of `RETURNING`. The removal query is identical to `HEAD`; the UI surfaces the error, keeps the row and writes no delete audit, which the acceptance test asserts. The same gap withholds Realtime events for incidents soft-deleted elsewhere; open details revalidate on the next committed query. Medical drives are unaffected. Section 6 records that permission gaps are findings, not authorization to change security, so no policy migration was created. The decision and proposed `0113` fix are tracked as an open item under Phase 6.

**Phase 5 implementation blockers: none. Remaining release/environment limits:** migrations **0110–0112** must precede deployment in Phase 6. Hosted acceptance/advisors, native Safari/Edge, physical inputs/OS scrollbar settings, native zoom, manual screen-reader checks, other network profiles and 100k deep-page benchmarks remain unverified. Every integrated route switches from auto to measured fixed table layout after hydration, widening columns once; this shared Phase 1 behavior is recorded for Phase 6 and left unchanged.

Failed attempts remain intact. All corrections in this execution were test-only: a hard-coded registration count, label-wrapped form controls, uppercase dialog labels, an unawaited post-save revalidation, an Incident needle that also matches the reporter name, waiting for settled table geometry, and the RLS behaviours above. No production-readiness or bug-free claim is made.
