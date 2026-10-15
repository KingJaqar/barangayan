# Admin Web Dropdown UI Consistency Plan

Created: 2026-10-14 (Asia/Manila)
Status: Complete — Phases 1–7 implemented and verified locally on 2026-10-14; additional live, assistive-technology and physical-device checks remain pending manual verification.
Scope confirmed: frontend UI modifications only; backend modifications are prohibited.

## 1. Objective and boundaries

Apply the resident web Reports sorting dropdown's visual and interaction design to every dropdown identified in the admin-web audit. Preserve each control's purpose, options, permissions, validation, persistence, routes, and integrations.

The approved reference is:

- `apps/resident-web/src/components/reports/report-sort-menu.tsx`
- The `.sortControl`, `.sortTrigger`, `.sortMenu`, `.sortOption`, `.sortChevron`, and `.sortCheck` rules in `apps/resident-web/src/components/reports/reports.module.css`.

Use that design as the source for proportions, alignment, spacing, selection treatment, and motion. Create reusable admin components rather than importing resident application code or copying the four report sorting options into unrelated fields.

Scope includes active admin screens, shared controls, all archive tables, conditional form fields, inline editors, and the additional files explicitly identified in the audit. The four resident-facing selects housed in the admin-web package are tracked as compatibility work. The two currently unreferenced modal files are tracked separately and must not be activated.

Constraints:

- Frontend UI presentation and interaction only. No backend modifications, including changes described as essential to completing the UI.
- Use the **admin's** current light/dark mode, accent, and font settings. Do not read resident preferences.
- No new dependencies. Admin-web does not declare Framer Motion; reproduce the short transition using CSS and existing React capabilities.
- Keep existing labels, option values, defaults, ordering, conditional fields, empty options, disabled rules, and save workflows.
- Do not change resident-web or either mobile app. In particular, do not resume the cancelled Android usability work.
- Inspect current instructions and the relevant installed Next.js documentation before implementation; read the exact Expo v57 documentation required by the root instructions before writing code.

### Mandatory frontend-only boundary

Allowed changes are dropdown components, styling, icons, animation, positioning, accessibility, focus handling, responsive layout, and the minimum frontend adapters needed to connect the replacement control to existing callbacks. Frontend tests, fixtures, screenshots, and this plan may also change.

Do not modify:

- Supabase files, database schemas, migrations, SQL, RLS policies, database functions, triggers, or Edge Functions.
- Server actions, route handlers, API endpoints, server-side queries, authentication, authorization, or integrations.
- Existing data-fetching or persistence logic, client-side queries, request payloads, validation/business rules, permissions, or filtering/sorting semantics. A changed UI event signature may call the existing callback with the same value; it does not authorize rewriting the operation.
- Deployment, infrastructure, environment variables, secrets, dependency manifests, or lockfiles.

Files containing both UI and data logic may receive narrowly scoped UI edits only. Review the changed lines, not just the file location, to enforce this boundary. Do not edit configuration-driven business definitions merely to attach presentation icons; keep that metadata in the UI layer.

Verification must not deploy migrations, create or alter backend resources, or modify hosted data. Use isolated frontend fixtures and mocked callbacks to test write-related interactions; any live checks must be read-only and use existing access.

If a dropdown cannot be migrated without violating this boundary, preserve its existing implementation and document the limitation. Backend work is outside this plan and is not authorized.

## 2. Design specification

| Reference behavior | Admin implementation requirement |
| --- | --- |
| Aligned panel | Anchor to the complete trigger, including its leading icon. Default to the same width, with a 7px gap beneath it. Keep it attached during container scrolling and resizing. Flip above only when necessary to stay visible. |
| Cleaner options | Use the reference's 12px panel radius, 5px internal padding, 7px option radius, 10px option padding, and consistent icon/text/checkmark columns. Baseline trigger and option height: 44px; support a deliberate compact variant for existing dense table editors. |
| Clear selection | Accent-tinted selected row and trailing checkmark. Keep selection distinct from the currently keyboard-highlighted row. Do not rely on color alone. |
| Smooth motion | Approximately 150ms opacity and 3–4px vertical movement; approximately 180ms chevron rotation. No spring or bounce. Disable movement and transitions for reduced motion. Exiting content must stop accepting interaction immediately. |
| Theme support | Derive surface, foreground, border, hover, accent text, tint, and shadow from admin theme variables. Define component-local tokens because resident-only `--card`, `--popover`, and `--reports-*` tokens are not available in admin-web. |
| Keyboard controls | Arrow keys, Home/End, Enter/Space, prefix typing, Escape, Tab/Shift+Tab, and focus restoration. Scroll the active option into view in long lists. Skip disabled options. Reset typeahead between openings. |
| Existing functionality | Sort controls retain each screen's configured sort keys and ascending/descending meanings. Filters and form selectors retain their domain-specific options and current handlers. |
| Responsive layout | Keep the trigger and panel within the viewport at 320px and larger. Wrap labels where necessary, bound panel height, allow internal scrolling, and retain existing toolbar stacking. |

Additional design rules:

- Use semantic icons for sort methods, categories, status, people, dates, and actions. Accept optional per-option icons and provide a consistent icon gutter for data-driven options; do not invent a unique icon for every resident or record.
- Use the existing app font, with 13px trigger text and 12–13px option text as the starting point. Avoid clipping long resident, document, drive, or center names.
- Preserve readable contrast for arbitrary accents in both themes. Selection labels remain foreground-colored; accent colors decorate the tint, checkmark, and icons.
- Support small page-size controls without forcing the resident sorting control's minimum width everywhere.
- Native selection popup appearance is browser/OS controlled. Replacing only its CSS is insufficient; use an accessible custom listbox for the common select component.

## 3. Reusable components and compatibility contracts

Proposed files under `apps/admin-web/src/components/admin/dropdown/`:

- `admin-select.tsx`: value selection, visible trigger, listbox, keyboard interaction, optional icons, empty/disabled states, and form integration.
- `dropdown-surface.tsx`: anchored panel and positioning support shared where appropriate; no business logic.
- `dropdown.module.css`: common theme tokens, panel, rows, focus, checkmarks, and motion, plus compact and destructive variants.
- `admin-action-menu.tsx`: reusable action-menu behavior only where existing menus need it; do not force action menus into the select API.

### Select contract

- Controlled `value`, `options`, and `onValueChange(value)`; explicit label or `aria-labelledby`, descriptions, error associations, IDs, names, required state, and disabled state.
- Visible trigger ref for autofocus and validation focus. Keep one accessible control and one tab stop; do not expose a duplicate hidden select to screen readers.
- Preserve form serialization, form reset, required-field validation, disabled-fieldset behavior, and submit-by-Enter behavior where the original form uses them.
- Implement a native form backing/validation bridge where required and prove it in the pilot. Invalid controls must focus the visible trigger and show the existing validation message. Do not leave an invalid hidden field that the browser cannot focus.
- Adapt existing handlers explicitly to `onValueChange`; do not manufacture React change-event objects.
- Use a React Hook Form `Controller` adapter for the QR instruction icon field so touched, dirty, validation, reset, and submission behavior remain intact.
- Distinguish a valid empty-string option such as “Uncategorized” from an unselected required placeholder. Handle missing, loading, changing, or removed options without a crash or accidental write.
- Do not invoke persistence on menu open, highlight, typeahead, Escape, or outside dismissal. Selecting an unchanged value must not cause an extra save.

### Positioning, portals, and focus

- Do not rely on `position: absolute` inside clipped table cells. Support a scoped overlay host with trigger-measured coordinates, viewport collision handling, and bounded height.
- Inside dialogs and side sheets, place the popup in an overlay host allowed by that dialog's focus containment. A body portal outside a focus trap is not automatically safe.
- Update the existing `content-create-panel.tsx` initial-focus and focusable-control logic to recognize custom select triggers. Hidden backing controls must not become autofocus targets.
- Preserve theme variables when moving panels into overlay hosts. Position, width, and stacking must work inside scrollable and horizontally resized tables.
- Close or safely reposition on relevant scroll/resize; close when the trigger unmounts, becomes disabled, or its editor closes. Remove listeners on cleanup.
- Escape closes the innermost popup first without closing its parent drawer. Tab dismisses without trapping focus or skipping the next form control.
- Treat portal option clicks as internal interaction. They must not invoke a row's detail action or the editor's blur-to-save callback prematurely.

### Keep distinct interaction types

| Type | Styling to reuse | Behavior to preserve |
| --- | --- | --- |
| Select / filter | Full trigger, surface, row, icon, selected tint, checkmark, chevron, and motion system | Single-value selection and original filtering/form behavior |
| Account menu | Surface, spacing, icons, hover/focus, motion | Navigation and logout actions; menu semantics, no selected-value checkmark |
| Row context menu | Surface, spacing, icons, hover/focus, motion | Pointer or keyboard context-menu anchor, existing action availability and confirmations; no same-width-trigger rule where there is no trigger |
| Navbar search | Surface, row rhythm, hover/focus, motion | Editable combobox, suggestions, recent queries, loading/errors, IME composition, and navigation |
| Transaction reference suggestions | Matching suggestion surface and selection treatment | Editable free text plus optional reference suggestion; do not turn it into a required fixed-choice select |
| Notifications popover | Surface, motion, consistent actionable rows | Unread markers, notification filters, notification navigation, and drawer opening |
| Date-range picker | Panel border, radius, shadow, theme, and motion | Calendar grid, month navigation, draft selection, Save/Reset, and discard-on-dismiss; no listbox conversion |

## 4. Complete migration inventory

Audit baseline: **54 native select declarations across 29 files** in admin-screen/shared code, plus **4 resident-facing declarations** in the admin-web package. Counts describe source sites, not simultaneously rendered controls. Some sites generate many controls; four declarations belong to currently unreferenced modals. Reconfirm reachability and counts before implementation because this workspace contains concurrent changes.

### A. Shared controls

Paths in this table are relative to `apps/admin-web/src/components/admin/`.

| File | Controls | Coverage |
| --- | --- | --- |
| `table-browse-controls.tsx` | Sort by; Direction | Eight main tables and all 13 archive sections |
| `table-pagination.tsx` | Rows per page | Same table families; preserve 10/20/30/50/100 |
| `editable-data-table.tsx` | Configured select cell editor | All fields in inventory B's inline column |
| `record-workspace.tsx` | Configured select; boolean Yes/No | All fields in inventory C |
| `header.tsx` | Account menu; notification popover | Admin shell on every applicable screen |
| `search/navbar-search.tsx` | Search suggestions | Admin header |
| `row-context-menu.tsx` | Row actions | Requests, Transactions, Residents, Incidents, Health, Applicants, Households, Staff |
| `date-range-picker.tsx` | Date-range calendar popover | Notifications drawer |
| `request-review-panel.tsx` | Eligibility | `/requests/[requestId]`, where the existing review workflow applies |

### B. Screen selectors and inline editors

Paths are relative to `apps/admin-web/src/app/(admin)/`. “Shared browse” means Sort by, Direction, and Rows per page in addition to the listed controls.

| Screen / source files | Filter and form controls | Inline selectors | Shared browse |
| --- | --- | --- | --- |
| Requests — `requests/requests-table.tsx` | Document filter; add Resident, Document, Status, Payment | Resident, Document, Status, Payment | Yes |
| Transactions — `transactions/transactions-table.tsx` | Method filter; add Method, Status, conditional Collected By; Reference datalist suggestions | Resident, Document, Method, Status, conditional Collected By | Yes |
| Residents — `residents/resident-directory.tsx` | ID presence filter | Sex, Employment Status | Yes |
| Incident Reports — `incident-reports/incident-table.tsx` | Category filter; add Category, Reporter, Status | Category, Reporter, Status | Yes |
| Health — `health/drive-table.tsx` | Category filter; add Category | Category, Active/Inactive | Yes |
| Medical Applicants — `health/applicants/applicants-table.tsx` | Category filter; add Drive, Resident, Is PWD | PWD, Status | Yes |
| Households & Residents — `households-residents/households-table.tsx` | Relation filter; add Resident (Head), Relation, Role | Relation, Role, Checked In | Yes |
| Staff — `staff/staff-table.tsx`, `staff/staff-form.tsx` | Official Role filter; add Barangay Role | Official Role | Yes |
| Services — `services/document-type-form.tsx` | Create/edit Service Workflow, Pricing | None | No |
| Announcements — `announcements/announcement-form.tsx`, `announcement-row.tsx` | Create/edit Category | None | No |
| FAQ — `faq/faq-form.tsx`, `faq-row.tsx` | Create/edit Category | None | No |
| Hub — `hub/emergency-form.tsx` | Create/edit Category, including the form reused by `emergency-row.tsx` | None | No |
| Evacuation Centers — `evacuation-centers/evacuation-center-form.tsx`, `evacuation-center-row.tsx` | Create/edit Status | None | No |
| Evacuation Routing — `evacuation-routing/routing-conditions-editor.tsx` | Availability for each center | None | No |
| Emergency QR — `emergency-qr/qr-codes-tab.tsx`, `qr-instructions-modal.tsx` | Select Center; instruction create/edit Icon | None | No |
| Waste Management — `waste-management/schedule-form.tsx`, `schedule-row.tsx` | Add Zone, Waste Type, Day of Week; edit Waste Type, Day of Week | None | No |

Retain conditional restrictions: legacy versus version 2 request edits, pickup versus QR PH collection/source fields, fixed service workflow rules, and options unavailable while loading or after a failure.

### C. Record workspace selectors

Generated by `apps/admin-web/src/lib/admin-tables/record-config.ts` and rendered by `record-workspace.tsx`. Preserve `editableFields()` restrictions.

| Record family | Dropdown fields |
| --- | --- |
| Requests | Status; Payment Status; Payment Method — version 2 exposes only its currently permitted field |
| Transactions | Payment Method; Status |
| Residents | Sex; Employment Status |
| Incidents | Status |
| Health drives | Category; Active |
| Applicants | Person with Disability; Status |
| Household members | Relation; Member Role |
| Staff | Official Role; Active |

### D. Archive coverage

Verify both `archive/[screen]/records.tsx` and `content-records.tsx`. Shared changes must reach all sections below without introducing inline edits into archive tables:

`/archive/services`, `/archive/announcements`, `/archive/requests`, `/archive/transactions`, `/archive/residents`, `/archive/incidents`, `/archive/health`, `/archive/applicants`, `/archive/waste-management`, `/archive/hub`, `/archive/evacuation-centers`, `/archive/households`, `/archive/staff`.

Preserve existing archive sort configuration; content archives currently offer “Archived on.” Keep Waste Management's archive kind tabs as tabs, not dropdowns.

### E. Compatibility and currently unreferenced files

| Location under `apps/admin-web/src/app/` | Identified controls | Treatment |
| --- | --- | --- |
| `resident/profile/profile-form.tsx` | Sex; Employment Status | Migrate presentation within this package, preserving the resident-facing form and routes |
| `resident/profile/id-upload.tsx` | ID Type | Same select component with existing upload/validation behavior unchanged |
| `resident/requests/new/new-request-form.tsx` | Document Type | Same select component with existing submission behavior unchanged |
| `(admin)/households-residents/member-form-modal.tsx` | Relation; Role | Recheck imports. If still unreferenced, update for compatibility and verify in an isolated fixture; do not mount it or remove it |
| `(admin)/health/applicants/applicant-detail-modal.tsx` | PWD; Status | Same treatment as the unreferenced member modal |

Dashboard, Incident Map, SLA Reporting, Settings, Theme, About Us, Terms/Privacy, and authentication screens had no additional screen-specific dropdowns identified. Verify their shared header menus where present. Do not convert their tabs, accordions, color swatches, or ordinary buttons into dropdowns.

## 5. Implementation phases and completion gates

### Phase 1 — Freeze the inventory and establish the reference

Status: Complete.

- [x] Recheck applicable instructions, current working changes, and dropdown reachability.
- [x] Record the exact source baseline; account for new or removed controls rather than assuming the original counts remain current.
- [x] Capture resident-reference and representative admin screenshots: light/dark, custom accent, desktop/phone, long list, drawer, and inline editor.
- [x] Identify label/validation dependencies, autofocus selectors, blur-save handlers, and popup/focus containment owners.

Gate: every inventory row has a reachable screen or an explicit compatibility/unused classification. No implementation work has overwritten unrelated changes.

2026-10-14 progress: Read the applicable root/admin instructions, Expo v57 reference and installed Next.js 16.3 guides; no conflicts found. Confirmed 54 admin declarations plus four compatibility declarations across 32 TSX files and one transaction datalist. Both identified modals remain unreferenced in production. Saved the session source/status baseline, original-source reference/phone/desktop/inline/drawer screenshots, and initial requirement classifications in `plans/evidence/admin-dropdown-ui/verification.md`. Typecheck, full lint and 110 table/search tests passed at baseline. Default Turbopack compilation stalled and was cancelled; sandbox Webpack initially reported EPERM, then the documented local Webpack build passed outside that restriction. Native OS popup chrome is not captured by headless page screenshots; this capture limit is recorded explicitly.

### Phase 2 — Build and verify the shared select

Status: Complete.

- [x] Implement the shared admin surface, tokens, select, motion, positioning, and optional icon support.
- [x] Add compact and full-width variants without screen-specific color rules.
- [x] Verify required validation, disabled fieldsets, controlled value updates, form reset, missing options, and dynamic options.
- [x] Pilot Requests Sort by/Direction and Rows per page, one required form field, the QR instruction form adapter, and an inline select editor.
- [x] Resolve drawer focus-trap, portal, blur-save, and Escape behavior before broader migration.

Gate: the pilot matches the resident visual reference and preserves actual field values, submissions, sorting/filter semantics, and save timing. No new dependency is required.

2026-10-14 progress: Added `components/admin/dropdown/` with admin-only tokens, same-width anchoring/7px gap, viewport flip/shift, scoped dialog portals, normal 44px/compact 32px variants, icons and reduced motion. Required validation, native serialization/reset, disabled fieldsets, missing/empty/dynamic options, keyboard/typeahead/scrolling, unchanged selection and outside dismissal passed isolated browser checks. Actual browse/inline controls and QR Controller passed their pilot. Native comparison confirmed Enter opens/selects without submitting, while adjacent text-input Enter submits. Dialog Escape closes the popup first; option clicks do not blur-save or open rows. Hidden backing geometry is bounded against existing global CSS; CSS zoom and bounded ancestor-transition tracking preserve alignment. Panel height is capped at 320px/50% viewport, and accent decoration is blended toward foreground for bright-accent contrast. No dependencies added.

2026-10-15 icon refinement: The icon criterion was partially implemented: the shared control repeated a generic field icon on every option. Replaced that fallback with UI-only, typed field/option metadata. Fixed domain choices receive semantic glyphs; data-driven, placeholder and unknown choices retain a neutral gutter. Selected options preview their glyph unless the caller supplies an explicit trigger icon. Existing explicit per-option icons retain priority. No interaction or form-bridge logic changed.

### Phase 3 — Migrate high-reuse shared entry points

Status: Complete.

- [x] Migrate `table-browse-controls.tsx` and `table-pagination.tsx`.
- [x] Migrate the `editable-data-table.tsx` select branch while preserving save-on-selection, explicit commit, cancel, disabled-saving, and error/retry paths.
- [x] Migrate `record-workspace.tsx` select and boolean fields.
- [x] Update only necessary form styling/focus selectors to support the new trigger.
- [x] Verify all eight main tables and both archive table implementations.

Gate: sorting/direction/page-size still use existing browse state, URL changes, page reset rules, and query flows. An inline selection results in exactly the original intended write; opening or dismissing does not write.

2026-10-14 progress: Migrated browse sort/direction, page size, configured inline select, and record select/boolean fields. Updated ContentSideSheet focus selectors to exclude backing controls and recognize triggers, and the inline editor's internal blur boundary. Actual fixtures verified eight main tables, eight record archive implementations, five content archive sections, all 16 generated record fields and the version-2 request restriction. Existing table browser passed all 45 size/count combinations plus independent sort/direction/category/status/page-size, page reset, Back/Forward, pending/error/retry, scroll/resize and cleanup checks. Existing record and row-context suites passed with mocked writes. Original queries, settlement and persistence callbacks were preserved.

2026-10-15 icon refinement: Added explicit icon kinds to the existing inline-editor UI configurations and record-field rendering without editing business configurations. Sort methods now show field-specific icons (resident, document, amount, stock and others); direction glyphs reflect text, dates, numbers/references and boolean ordering. Existing browse, drawer, keyboard and save/cancel regression checks passed.

### Phase 4 — Migrate screen filters, forms, and compatibility sites

Status: Complete.

- [x] Complete every row in inventory B and the eligibility control in inventory A.
- [x] Verify all generated fields in inventory C, including restricted and conditional variants.
- [x] Complete inventory E without activating unused modals or redesigning resident routes.
- [x] Adapt transaction reference suggestions as an editable combobox, preserving free-text entry, existing reference options, lookup, validation, and errors. No new search endpoint.
- [x] Use current option labels/order and semantic icons. Do not add new sorting choices or domain options.

Gate: the inventory has no unexplained remaining native selects or datalists. Any native element retained solely as a form backing field is documented and not an extra visible control.

2026-10-14 progress: Migrated all inventory B fields and eligibility, all generated C controls, four resident compatibility declarations, and the four declarations in the two unused modals. Actual compatibility/modal/QR fixtures passed without production activation or submission. Transaction reference uses an editable suggestion combobox and the unchanged lookup callback/options. Options, defaults, order, required/disabled rules, conditional fields and permissions remain in their existing source expressions. Final source scan finds only the one aria-hidden, untabbable native backing declaration in `admin-select.tsx`; no production datalists remain. The audit records 58/58 migrated declarations.

2026-10-15 icon refinement: Wired semantic icons for announcement/FAQ/hub categories, health types, waste types, payment methods, staff roles, sex/employment, ID presence, service workflows, center availability and related field triggers. QR instruction choices now preview the actual corresponding symbols. Both unused modals remain unreferenced in production. Actual form, compatibility, QR, inline-editor and record-drawer icon checks passed with mocked persistence and zero console/page errors or warnings. No dependencies added.

### Phase 5 — Apply the same visual system to other popup types

Status: Complete.

- [x] Restyle the account menu and notification popover in `header.tsx`.
- [x] Restyle row context menus, preserving their pointer-based positioning, action discovery, disabled actions, mutation-observer dismissal, and confirmation workflows.
- [x] Restyle navbar search suggestions while preserving typing, composition, pending/error/empty states, recent searches, keyboard navigation, and destination links.
- [x] Restyle the notification drawer's date-range picker surface without changing calendar or draft/save/reset logic.
- [x] Ensure nested popup dismissal closes only the intended layer.

Gate: all audited popup types visually belong to the same system, with correct menu/listbox/calendar semantics and existing actions intact.

2026-10-14 progress: Account uses a semantic action menu; notification/calendar surfaces use scoped anchoring and shared CSS; row context menus keep their original pointer anchor, action discovery, mutation observer and handlers while sharing surface/row styling. Navbar suggestion behavior remains intact with matching surface/row rhythm and nested Escape handling. Actual account, notification More/drawer, calendar draft discard/Save/Reset/focus return, free reference, navbar recent/keyboard destination and five content-archive fixtures passed. Header popup bounds passed at all five required widths. Waste archive kind controls retain their existing SegmentedFilter group/aria-pressed button semantics; the plan's “tabs” wording is descriptive, not an instruction to change roles.

### Phase 6 — Regression and visual review

Status: Complete for local/browser verification. Additional live, assistive-technology and physical-device checks are pending manual verification and are not claimed as passed.

- [x] Run admin typechecking, focused lint, and relevant existing table/search tests.
- [x] Add focused interaction coverage for the shared dropdown where it protects behavior: keyboard selection, required validation, disabled fields, outside dismissal, portal alignment, and inline commit/cancel.
- [x] Exercise all four sorting-related behaviors independently: sort key, sort direction, category/status filtering, and page size. Verify browser back/forward and page reset behavior remain correct.
- [x] Exercise account navigation, search suggestions, notification opening, calendar Save/Reset, and row-action menu invocation. Use safe fixtures for actions that write data; do not trigger production logout, deletion, or record changes solely for visual checks.
- [x] Review at 320, 390, 768, 1024, and 1440px, including open drawers, horizontally scrolled tables, resized columns, and controls near viewport edges.
- [x] Review light/dark mode, the default accent plus at least two custom accents, current font settings, reduced motion, browser zoom, long labels, and large option lists.
- [x] Verify focus visibility, accessible labels, selected/highlighted distinction, active-option scrolling, and a usable 44px normal touch target.

Gate: no clipped or detached panels, no horizontal overflow introduced, no wrong-value saves, no duplicate saves, no focus escape from parent dialogs, and no theme-specific hardcoded palette. Record any environment limits explicitly.

2026-10-14 progress: Final typecheck, full admin lint, all 110 existing table/search tests and production Webpack build passed. Focused dropdown, compatibility/popup/content-archive, existing table, record and context-menu browser suites passed. Focused/coverage fixtures logged zero page/console errors or warnings. Reviewed 320/390/768/1024/1440, 30 light/dark/accent combinations, live font/theme/accent changes, system/Georgia/Verdana stacks, long lists/labels, drawers, edge collisions, horizontal scroll/resized columns, reduced motion, forced colors and 200%/400% zoom. Tests use actual UI with synthetic records and mocked callbacks. Manual authenticated read-only checks, screen-reader announcements, physical touch and other browser engines remain supplemental coverage; exact steps and environment limits are in `plans/evidence/admin-dropdown-ui/verification.md`.

2026-10-15 verification: Baseline and final admin typecheck, full lint, 118 existing unit tests and local production Webpack build passed (45 generated pages). The final focused icon browser suite and existing dropdown regression suite passed; both report zero page/console errors or warnings. The latter reverified form serialization/reset/validation, disabled and dynamic choices, keyboard/typeahead/dismissal, inline commit/cancel, 30 viewport/theme/accent combinations, font changes, reduced motion, zoom, all eight main tables and record archives, and all generated record selectors. Reviewed settled light/dark QR screenshots. An initial icon-test expectation used Lucide's old CircleHelp CSS alias and the wrong staff header label; corrected those fixture expectations to the installed package and actual UI. React's static-component lint finding was corrected with a stable module-level icon lookup. No outstanding regression remains. Evidence: `plans/evidence/admin-dropdown-ui/icon-refinement-2026-10-15/`.

### Phase 7 — Close the audit and deliver

Status: Complete.

- [x] Re-run the source inventory and mark every audited site migrated, form-backing-only, or explicitly unreferenced/fixture-verified.
- [x] Save representative before/after screenshots and test results under `plans/evidence/admin-dropdown-ui/`.
- [x] Document final shared component locations, compatibility handling, tests performed, and any remaining limitations.
- [x] Review the final diff for unrelated changes and dependencies.
- [x] Audit the task's changed lines against the mandatory frontend-only boundary, including mixed UI/data files. Confirm there are no backend, query, business-rule, integration, environment, or deployment changes attributable to this work; preserve unrelated pre-existing workspace edits.

Gate: all identified sites are accounted for, and the frontend-only diff audit passes. The final summary distinguishes browser/sample-data checks from any read-only live checks. No outstanding regression is described as completed work.

2026-10-14 progress: Saved before/after screenshots, native Enter comparison, browser results, before/after inventory, compressed original source snapshot and task-only source patch under `plans/evidence/admin-dropdown-ui/`. Reviewed the 38 changed existing UI files and five new shared files against the session baseline, including every changed line in mixed UI/data files. The frontend-only audit passes: no backend/query/payload/business/permission/integration/environment/deployment/dependency changes attributable to this task. Pre-existing source edits are preserved. No commits, pushes, deployments, remote migrations, hosted-data writes or resource changes were performed. Every acceptance item below is met by the recorded local/source/fixture evidence; supplemental manual checks are explicitly unverified. No implementation blocker or outstanding regression remains.

2026-10-15 closeout: Icon refinement complete. Compared the 25 affected screen files with this session's pre-edit snapshot: removing only icon-kind metadata yields identical source, confirming unchanged callbacks, options, values and rules. Reviewed the four shared-component changes and new icon metadata separately. Preserved concurrent profile/header/surface/backend work and added no dependencies or backend changes. Saved separate evidence instead of replacing the 2026-10-14 results. Inventory discrepancy: the current service form has one workflow selector and no pricing selector; the formerly listed request-review-panel file is absent, so neither was recreated. Previously recorded live, assistive-technology, physical-device and other-engine checks remain pending manual verification with their existing steps.

## 6. Acceptance checklist

- [x] Expanded select panels align to their full triggers and match their widths except documented viewport collision adjustments.
- [x] Spacing, corners, icons, checkmarks, hover/focus, and animation match the Reports dropdown design.
- [x] Admin light/dark, accent, and font changes update both trigger and open panel immediately.
- [x] All supported keyboard and pointer interactions work, including long-list scrolling and dismissal inside drawers.
- [x] Every original dropdown value, option, permission rule, and integration is preserved.
- [x] Existing form validation/reset and inline-editor save/cancel behavior is preserved.
- [x] Shared controls cover all eight main tables and all 13 archive sections.
- [x] Custom menus, search suggestions, and the calendar share the styling without losing their appropriate semantics.
- [x] All four resident-facing compatibility selects and both currently unreferenced modal files are accounted for.
- [x] No backend, mobile UI, unrelated redesign, or new dependency changes.
- [x] No changes to queries, persistence, payloads, validation/business rules, authentication, authorization, or integrations; existing callbacks receive the same values.
- [x] Verification performed no hosted-data writes or backend resource modifications.

## 7. Risk handling and rollback

| Risk | Required mitigation |
| --- | --- |
| Browser-native behavior lost during replacement | Prove validation, disabled fields, reset, focus, and form adapters in Phase 2 before bulk migration |
| Portal clicks cause early inline save or open a row | Explicit internal-popup interaction boundary; regression coverage for selection, blur, Enter, and Escape |
| Popup clipped by tables or excluded by drawer focus trap | Scoped overlay host, collision tests, and focus containment checks |
| New dropdown styles depend on unavailable resident tokens | Component-local admin token mapping; verify portalled surfaces in both themes |
| Concurrent work changes forms or inventory | Reconcile before each rollout group and preserve unrelated edits |
| Existing external tests target native selects | Update UI selectors to accessible combobox/listbox roles and selected values; keep business assertions unchanged |

Keep implementation changes grouped by shared primitive, shared consumers, screen forms, and other popup types so a failed group can be reverted without reverting unrelated work. Do not remove the existing paths until their replacements have passed the applicable gate. If a call site cannot preserve behavior, leave that site on its existing control temporarily and record the exact blocker; it remains incomplete until resolved.
