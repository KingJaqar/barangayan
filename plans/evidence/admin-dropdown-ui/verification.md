# Admin dropdown verification — 2026-10-14

Phases 1–7 are implemented and their local completion gates passed. All browser interaction checks used actual frontend components with synthetic records and mocked write/navigation adapters. No authenticated live checks, hosted-data writes, database changes, commits, pushes, or deployments were performed.

## Baseline and instructions

- Read root `AGENTS.md` and `CLAUDE.md`, and admin-web `AGENTS.md` and `CLAUDE.md`. No instruction conflicts were found. The cancelled Android phase remains outside this task.
- Read Expo v57 reference before code, and installed Next.js 16.3 client-component, layout, CSS and CLI documentation. Checked React 19 APIs against the installed admin React 19.2.8 runtime/types and the installed React Hook Form 7.85 Controller documentation/types.
- Baseline typecheck and full admin lint: **passed**. Existing table/search tests: **110 passed in eight files**.
- Default Turbopack build remained in the compile stage without further output and was cancelled. The documented Webpack alternative initially hit a sandbox `EPERM` while creating a generated directory. With the sandbox restriction lifted for the local build, Webpack production compilation, typechecking and generation of all **42 pages** passed. The final saved production code also passed this build.
- Captured the working source and Git status before implementation. The original inventory is **54 admin declarations** (including four in two unused modals), plus **four resident compatibility declarations**, across **32 TSX files**, plus one transaction datalist. A CSS comment containing `<select>` was excluded from the declaration count.
- All inventory A–E sites were confirmed in source. The two unused modal filenames have no production imports; the added imports occur only in the isolated coverage fixture. Compatibility forms remain on their existing routes.

## Requirement classification before editing

The existing domain values, queries, permissions, conditional restrictions, and persistence handlers were already implemented. They were preserved, rather than reimplemented.

| Phase requirement | Initial classification | Final result |
| --- | --- | --- |
| 1: Instructions, working changes and reachability | Partially done: plan inventory existed; execution reconciliation absent | Done; session snapshot and source/import review |
| 1: Exact source baseline | Partially done: audited counts existed | Done; inventory-before.json and compressed source snapshot |
| 1: Reference/admin screenshots | Not started | Done; saved original-source and replacement screenshots; native OS popup capture limit below |
| 1: Labels, validation, focus and blur owners | Not started | Done; label sites, RHF field, ContentSideSheet, TableDetailDialog, QR Escape listener and inline blur boundary reviewed |
| 2: Shared surface/select/tokens/icons/motion | Not started | Done; five shared files |
| 2: Compact and full-width variants | Not started | Done; 44px normal, 32px compact and automatic page-size width |
| 2: Form/disabled/reset/dynamic contracts | Not started | Done; focused browser suite |
| 2: Browse/required/QR/inline pilot | Not started | Done; actual controls plus isolated required form/Controller |
| 2: Focus/portal/blur/Escape pilot | Partially done: native modal containment existed | Done; scoped portals and dismissal tests |
| 3: Browse controls and pagination | Not started | Done; existing state/URL callbacks preserved |
| 3: Inline select branch | Not started | Done; commit-on-change, Enter, Escape and blur boundary verified |
| 3: Record select/boolean fields | Not started | Done; all 16 generated fields, including v2 restriction |
| 3: Necessary focus selectors | Not started | Done; backing selects excluded, custom trigger recognized |
| 3: Eight tables and both archives | Partially done: existing native consumers were integrated | Done; actual component fixtures and existing regressions |
| 4: All screen fields/eligibility | Not started | Done; every source site migrated with existing option markup/handlers |
| 4: Generated restricted/conditional fields | Partially done: restrictions existed | Done; source parity and actual generated-field fixtures |
| 4: Compatibility and unused modals | Not started | Done; all eight declarations fixture-verified; unused modals remain unused |
| 4: Editable reference suggestions | Not started | Done; free text, current reference options and existing lookup callback retained |
| 4: Option order/values and semantic icons | Partially done: domain options existed | Done; options preserved, presentation metadata kept in UI |
| 5: Account/notification restyling | Not started | Done; menu/region semantics, icons, scoped surfaces and focus |
| 5: Row-context restyling | Not started | Done; original anchor, discovery, observer and action handlers preserved |
| 5: Navbar suggestions | Partially done: editable-combobox behavior existed | Done; surface/row styles and nested Escape handling only |
| 5: Calendar surface | Not started | Done; calendar/draft/Save/Reset unchanged; popup focus handling added |
| 5: Nested dismissal | Partially done: parent Escape handling existed | Done; select/QR/drawer/calendar nesting tested |
| 6: Checks | Partially done: existing suites available | Done; final lint/typecheck/unit/browser/build results |
| 6: Focused interaction coverage | Not started | Done; dropdown and coverage browser fixtures |
| 6: Four independent browse behaviors | Partially done: existing state tests | Done; sort key, direction, category/status, page size, Back/Forward, page reset |
| 6: Other popup flows | Partially done: existing context-menu fixture | Done; actual header/search/calendar plus row suite |
| 6: Required viewport/layout matrix | Partially done: existing table fixture | Done; five widths, drawers, long lists, viewport edges, resizing, scroll, zoom |
| 6: Theme/accent/font/motion matrix | Partially done: existing dark table checks | Done; 30 combinations and live variable changes |
| 6: Labels/focus/selection/44px target | Partially done: native semantics | Done; accessible-role and geometry assertions; visual inspection |
| 7: Final inventory | Not started | Done; 58/58 accounted for, only one backing-select declaration |
| 7: Evidence and final documentation | Not started | Done; this folder |
| 7: Diff/dependency/frontend boundary audit | Not started | Done; session-relative diff and source audit |

## Shared implementation and decisions

- `apps/admin-web/src/components/admin/dropdown/admin-select.tsx`: controlled value selection, explicit string callback, optional icons, existing option-child compatibility, required validation, native form serialization/reset, disabled fieldsets, typeahead, active-option scrolling and noninteractive exit.
- `dropdown-surface.tsx`: full-trigger measurement, 7px gap, same width by default, viewport shift/flip, 320px/50%-viewport height cap, scoped dialog host, scroll/resize/visual-viewport alignment and CSS zoom handling. Ancestor transitions are followed for at most 2.5 seconds; frames, observers and listeners are cleaned up.
- `dropdown.module.css`: admin-only token mapping, 12px panel/5px padding/7px rows/10px row padding, foreground labels, selected tint/checkmark distinct from keyboard highlight, 150ms panel and 180ms chevron motion, reduced-motion support.
- `admin-action-menu.tsx`: account navigation/actions with actual menu semantics and keyboard focus. Row context menus retain their original behavior and reuse the shared CSS.
- `admin-suggestions.tsx`: editable transaction reference, not a fixed-choice field. No endpoint or lookup change.
- Selection icons blend the accent toward foreground to retain contrast even for bright custom accents. Page-size controls do not inherit the reference's minimum width.
- The native backing select is aria-hidden, has no tab stop, and has explicitly bounded geometry so existing form/table CSS cannot enlarge it and introduce overflow. Invalid messages come from the browser and focus the first invalid visible select trigger. No synthetic React change events are constructed.
- The QR icon uses `Controller` with the existing field name, value, change, blur, ref and disabled state. Dirty/touched/reset/submission were verified.
- A native-browser comparison confirmed that Enter opens a select and selects an option without submitting, while Enter in the adjacent text input submits. The replacement preserves that behavior; inline-editor Enter still uses its original commit callback.
- Waste archive “tabs” are existing `SegmentedFilter` buttons with group/aria-pressed semantics. Those semantics and all three choices were preserved.

## Final verification

| Check | Result |
| --- | --- |
| `npm run typecheck --workspace=@barangayan/web` | Pass |
| `npm run lint --workspace=@barangayan/web` | Pass; zero errors/warnings |
| `npm run test:tables --workspace=@barangayan/web` | Pass; 110 tests, eight files, including search |
| `npm run build --workspace=@barangayan/web -- --webpack` | Pass; compilation, types, 42 generated pages |
| Focused dropdown browser | Pass; keyboard, validation, reset, serialization, disabled/missing/empty options, unchanged selection, portals, inline commit/cancel, 16 generated fields and v2 request guard |
| Compatibility/popup/content-archive browser | Pass; four compatibility fields, two unused modals, real QR adapter, account, notifications drawer, calendar Save/Reset/Escape, free reference, navbar and five content archives |
| Existing table browser, Chrome | Pass; 45 size/count combinations, sort/direction/category/status/page size, Back/Forward/reset, pending/error/retry, resize/scroll, 200%/400% zoom, forced colors and cleanup |
| Existing record browser | Pass; eight actual screens, mocked mutation failure/retry/cancel and archive workflows; zero page/console errors |
| Existing row-context browser | Pass; eight screens, action parity, readable icons, disabled/hidden controls, workflow guards, confirmations, keyboard and viewport dismissal |
| Source inventory/audit | Pass; 58/58 migrated declarations, 38 existing UI source files plus five shared files; no unexpected existing source edits |
| `git diff --check` | Pass; Git emitted existing line-ending conversion notices, not whitespace failures |

Browser matrix: Chrome 155 on Windows; 320, 390, 768, 1024 and 1440 CSS pixels; light/dark; default green, yellow and purple accents; system, Georgia and Verdana font stacks; reduced motion; long labels/lists; bottom/right collisions; native drawer portals; horizontal scroll/resized columns; equivalent narrow/short and CSS 200%/400% zoom. Focused and coverage fixtures recorded zero page errors, console errors or warnings.

Existing record/context-menu suites also regenerate their usual local fixture reports; copies of their result JSON are stored here. No database or hosted mutation suite was run. Historical database result files are not verification evidence for this task.

## Acceptance criteria

| Criterion from section 6 | Status and evidence |
| --- | --- |
| Full-trigger alignment and width | **Met**; five widths, 7px gap, zoom and edge collision assertions |
| Reference spacing/corners/icons/selection/motion | **Met**; shared rules, source comparison and screenshots |
| Admin theme/accent/font updates | **Met**; open-panel live changes, 30 combinations and three font stacks |
| Keyboard/pointer/scroll/drawer dismissal | **Met** in tested Chrome flows; focused suite and native dialog fixture |
| Original values/options/permissions/integrations | **Met** by session-relative source parity, existing unit tests and safe component fixtures |
| Form validation/reset and inline save/cancel | **Met**; browser validation, form data, Controller, unchanged-selection and inline tests |
| Eight tables and 13 archives | **Met**; eight actual table/record-archive components plus five content archives |
| Menu/search/calendar styling with semantics | **Met**; action menu, row suite, editable suggestions, navbar and actual calendar/drawer |
| Four compatibility selects/two unused modals | **Met**; actual component fixture; production reachability unchanged |
| No backend/mobile/redesign/new dependency changes | **Met**; task-only source diff review |
| No query/payload/persistence/rule/auth/integration changes | **Met**; changed-line review; original callbacks receive the same values |
| No hosted-data writes/backend resource changes | **Met**; verification used local fixtures/mocks only |

## Boundary audit and limitations

Reviewed every changed line in the session-relative patch, including mixed UI/data files. Changes are imports, dropdown markup/event adapters, presentation icons, popup surfaces, focus/keyboard handling and narrowly scoped focus selectors. Existing options, handlers, queries, payload construction, permission conditions and business configuration were preserved. No changes attributable to this task exist in actions, APIs, queries, shared business/schema packages, Supabase, resident-web, either mobile app, manifests, lockfiles, environment configuration or deployment files. Pre-existing source edits remain intact.

Native browser/OS selection popup chrome is not captured by headless page screenshots. Original-source screenshots therefore document the reference, closed native controls, inline editor and drawer; the replacement long-list surface is captured after migration. This is an evidence capture limitation, not a visual/behavior pass for the former OS popup.

Pending manual verification (additional coverage; not claimed as passed):

1. On an authenticated local/live admin session, open Requests, Transactions, a content archive, Emergency QR and the notification drawer in light/dark with the user's saved accent/font. Compare open controls and read-only navigation with the saved screenshots. Do not submit, logout, mark notifications read, archive or change records solely for this check.
2. With NVDA or VoiceOver, verify each trigger announces its field name, required/invalid state and current value, and that keyboard highlight/selection and errors are announced once. Check native drawer focus containment and the calendar's focus return.
3. On a physical phone browser, verify touch scrolling in a long list and near-edge placement at browser zoom. Spot-check Safari/Firefox/Edge; this session's automated browser evidence is Chrome only.

No implementation blocker or outstanding regression remains. These manual/live/assistive checks were unavailable and are explicitly outside the checks claimed above.
