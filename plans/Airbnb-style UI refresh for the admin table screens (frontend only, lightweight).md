# Airbnb-style UI refresh for the admin table screens (frontend only, lightweight)

## Context
The 5-section layout (header+summary / search / sort+direction+category / filters / table+pagination) is live on 8 screens, but the controls are still raw browser widgets: 1px grey-bordered `<select>`s, unstyled buttons, flat boxed summary cards, a bare "Search [input]" label. Goal: a calmer, more premium look and better interaction feel modelled on airbnb.com for **everything except the table body**.

**Hard constraints**
- Frontend only. No change to `src/lib`, `src/hooks`, `src/actions`, `supabase/`, routes, queries, URL-state or the `commit` pipeline.
- **Lightweight:** CSS-first, no new dependencies, no animation library, no JS-measured animations, no new global listeners, no new state beyond what exists. Net code should *shrink*: many duplicated Tailwind strings are replaced by a few shared classes/components.
- **No buggy motion:** only `opacity`/`transform` transitions (compositor-only), ≤ 200ms, one easing token, all disabled under `prefers-reduced-motion`. No layout-affecting animation, no animation that depends on measuring DOM.

## What airbnb.com does (measured live) and what we take from it
| Airbnb trait (measured) | How we apply it |
|---|---|
| Text `#222`, muted `#6c6c6c`, hairline `#ddd`, fill `#f7f7f7`/`#f2f2f2` | Neutral tokens `--ab-*` (light + dark) |
| Search = one pill, radius 32px, soft shadow, no border, icon button at end | Search pill with leading icon, shadow, focus ring |
| Segments: 12px/500 label over 14px value, thin dividers | Section 3 selects become label-over-value fields in one capsule (CSS grid, no JS) |
| Category rail: muted → dark text, 2px underline on active | Filter tabs: underline on active via border (no sliding JS) |
| Circular `#f2f2f2` icon buttons (50% radius) | Pagination First/Prev/Next/Last as 40px circular buttons |
| Cards 12–16px radius, almost borderless, layered soft shadow | Summary cards |
| `cubic-bezier(.2,0,0,1)` ~0.2s; subtle press scale | One `--ab-ease`, `:active` scale .97 |
| Brand `#FF385C` | **Not hard-coded**: admin's per-user `--accent` stays the brand colour |
| Airbnb Cereal font | **Not used** (proprietary): keep selectable `--font-app` |

## Scope
In: Section 1 (header, summary cards, error banners), Section 2 (search), Section 3 (sort/direction/category), Section 4 (filter tabs + Add button), Section 5 chrome outside the table (pagination, rows-per-page, loading bar, error panel), inline Add forms above the table.
Out: the table (`EditableDataTable`, `TableScrollArea`, `table-browse-layout.ts`), detail modals, sidebar/header shell, data layer.

## Design decisions (what we deliberately keep simple)
- **Native `<select>` stays** (styled with `appearance:none` + background-image chevron). No custom listbox: keeps keyboard/AT behaviour, the shipped dark-mode popup fix, and avoids new JS.
- **Filter underline is a per-button border-bottom**, not a sliding indicator (no measuring, no resize bugs).
- **No sticky controls, no `/` shortcut, no "reset" button, no count badges** (extra state/listeners/data — skipped to stay lean).
- **Summary cards:** CSS grid that wraps; no carousel/snap JS. Optional icon omitted unless one-line static map exists.
- **Add forms:** restyle with a shared class constant; no floating-label trick (fragile with selects/datetime). Labels stay above fields.
- **Loading:** keep the existing fade + 2px bar; only restyle colours/shape.

## Section-by-section spec
1. **Header + summary** — new `AdminPageHeader` (title 28px/600, muted 15px description). `SummaryCards` shared component: white card, 16px radius, no border, `--ab-shadow-1`, number 26px/600 over 13px muted label, hover lift 2px (`transform`). The three summary files become thin config wrappers. Error banner: soft red tint, rounded, pill "Retry".
2. **Search** — 48px pill, leading magnifier icon (inline SVG/lucide already present), shadow deepens on `:focus-within`, accent ring, native `type=search` clear control kept. Optional `searchPlaceholder` prop.
3. **Sort/Direction/Category** — one rounded capsule (`grid`, dividers via border, stacks on mobile). Each field: 12px/500 muted label above value, hover tint on segment, focus-within ring on the capsule. Direction label unchanged.
4. **Filters** — scrollable row (`overflow-x:auto`, hidden scrollbar), tab = text button, inactive muted, hover dark, active = dark text + 2px accent underline (`aria-pressed` styled). "+ Add" = accent pill CTA, press scale, right-aligned; wraps below on mobile.
5. **Pagination** — circular 40px icon buttons with `aria-label`s kept exactly (`First`, `Previous`, `Next`, `Last` — tests rely on them), "Page N of M" muted, Rows-per-page uses the shared select style. Error panel: icon + rounded Retry.
6. **Add forms** — container 16px radius + shadow, fields 44px / 12px radius / hairline border / accent focus ring, pill Submit + ghost Cancel; shared `form-styles.ts` replaces 8 duplicated `inputClass` strings.

## Execution phases (each ends with a gate; stop and fix before moving on)

### Phase 0 — Baseline (no code changes)
- Run `npx tsc --noEmit`, `npx eslint src`, `npx vitest run --config vitest.config.ts`, and the browser harness (evidence dir redirected to scratchpad). Record the 68 passing tests.
- Capture "before" screenshots of Requests in light/dark at 1440 and 375 px.
- **Gate:** all green; baseline recorded.

**Status: COMPLETE (verified 2026-10-12).** No product code changed.
- `npx tsc --noEmit`: exit 0, no errors.
- `npx eslint src`: exit 0, no warnings.
- `npx vitest run --config vitest.config.ts`: 4 files, **68/68 passed** (browse-state 51, operations 3, pilot 5, queries 9).
- `tests/table-browse/browser.mjs`: exit 0; Chrome, Firefox, WebKit each passed 11 checks. Edge reported unavailable (not installed), so it was not exercised.
- Harness tweak: `tests/table-browse/browser.mjs` now honours optional `TABLE_TEST_EVIDENCE_DIR` (default unchanged) so evidence can be redirected to scratchpad without touching tracked `plans/evidence/admin-table-phase1/*`.
- "Before" screenshots (light/dark x 1440/375) captured in scratchpad `before/` from the table-browse **fixture**, not the real Requests route: that route needs an authenticated Supabase session, unavailable here. Re-take them from the same fixture for the Phase 7 comparison.
- Step 0: this plan already lives in `plans/`; no separate copy was made, to avoid two diverging files.
- Pre-existing state: the working tree already had many uncommitted admin-web changes (other table phases); baseline results above include them.

### Phase 1 — Tokens and primitives (CSS only)
- Add `--ab-*` tokens, `.ab-card`, `.ab-pill`, `.ab-field`, `.ab-btn`, `.ab-btn-primary`, `.ab-icon-btn` and the single `@media (prefers-reduced-motion)` block to `globals.css`, scoped under `.table-browse-panel` / new `.ab-*` classes so nothing else on the site changes.
- **Gate:** nothing visually changes yet except the replaced `.table-browse-*` control rules; Requests screen renders correctly light + dark; tests green.

**Status: COMPLETE (verified 2026-10-12).** Only `apps/admin-web/src/app/globals.css` changed (no TSX, `src/lib`, `src/hooks`, `src/actions`, `supabase/`, or `package.json`).
- Added: `--ab-*` tokens (light + dark, per the token table, plus `--ab-accent-line`: accent mixed 75% toward text so a pale user accent still yields a visible underline/ring), primitives `.ab-card`, `.ab-card-lift`, `.ab-pill`, `.ab-field`, `.ab-btn`, `.ab-btn-primary`, `.ab-icon-btn`, `.ab-label`, `.ab-muted`, native-select chevron, the state matrix (hover under `@media (hover:hover)`, focus-visible 2px accent ring/2px offset, press `scale(.97)` 80ms, disabled 45%), a `prefers-reduced-motion` block and `forced-colors` additions. ~80 lines appended; transitions are `transform` only.
- Replaced rules: the generic `.table-browse-panel button/select/input` border rule is now scoped to `.table-browse-body` (table body look unchanged); controls (`[data-browse-controls]`), footer (`[data-browse-footer]`) and the error-panel Retry take the `--ab-*` look (hairline, 12px fields at 44px, pill buttons at 40px, chevron selects). Active filter segment keeps accent fill.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68 passed**; `tests/table-browse/browser.mjs` Chrome/Firefox/WebKit 11/11 each (Edge not installed, not exercised).
- Light + dark at 1200 and 375 px screenshots of the table-browse fixture (not the authenticated Requests route, as in Phase 0) reviewed in scratchpad `phase1/`: controls render correctly in both themes, no horizontal overflow added.
- Not verified: hover/press/focus states by interaction (visually unchanged-by-markup phase), real Requests route (needs authenticated Supabase session). Markup/section-specific layout (capsule, search pill, tabs, circular pagination) is deliberately left to Phases 2-5.

### Phase 2 — Section 1: header + summary cards
- Add `admin-page-header.tsx`, `summary-cards.tsx`; convert 3 summary wrappers and 8 `page.tsx` headers (markup swap only).
- **Gate:** 8 screens show identical card data; error banner + Retry still works (force via fixture); typecheck/lint/tests pass.

**Status: COMPLETE (verified 2026-10-12).**
- New: `components/admin/admin-page-header.tsx` (28px/600 title, muted 15px description) and `components/admin/summary-cards.tsx` (`SummaryCards`: `.ab-card ab-card-lift`, 16px radius, no border, number 26px/600 `tabular-nums` over 13px muted label, auto-fit grid `minmax(8.5rem,1fr)` so it wraps, two per row at 375px; error banner = soft red tint, rounded, `.ab-btn` pill "Retry summary", `role=alert`). No CSS added (reuses Phase 1 primitives).
- Converted: `pilot-summary`, `operations-table-summary`, `profile-table-summary` are now thin card-config wrappers (same keys/labels, `formatCentavosAsPHP` still applied for transactions); the 8 `page.tsx` headers use `AdminPageHeader` (title/description text unchanged). No `src/lib`, `src/hooks`, `src/actions`, `supabase/` or `package.json` changes made in this phase.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68 passed**; `tests/table-browse/browser.mjs` Chrome/Firefox/WebKit passed (Edge not installed).
- Card data / banner gate: scratch fixture rendering the real wrappers (requests, transactions, incidents, residents configs) in Chrome, light + dark x 1440/375: all labels/values match the old configs (transactions formatted as PHP), forced error shows banner and Retry fires `onRetry` on each click, no horizontal overflow, no console errors, hover lift `translateY(-2px)` confirmed. Screenshots reviewed in scratchpad `phase2/`.
- Not verified: the real authenticated routes (need a Supabase session), and the health/applicants/households/staff summaries individually (same shared component and unchanged configs).

### Phase 3 — Sections 2 + 3: search and sort capsule
- Restyle `table-browse-controls.tsx` markup/classes (keep props and `data-section` attrs).
- **Gate:** search debounce, sort/direction/category changes still update the URL; tab order and labels unchanged; capsule stacks at 375 px with no horizontal overflow.

**Status: COMPLETE (verified 2026-10-12).** Changed: `components/admin/table-browse-controls.tsx` and `app/globals.css` only (+~35 CSS lines; no `src/lib`, `src/hooks`, `src/actions`, `supabase/`, `package.json` changes by this phase; no new hooks/listeners/deps).
- Markup: controls root now carries `data-browse-controls` (the Phase 1 control rules keyed on it but nothing set it, so they only take effect from here); search is a pill with an `aria-hidden` inline magnifier, the "Search" label text is kept (`sr-only`, accessible name unchanged), new optional `searchPlaceholder` prop (default "Search"); props and `data-section` attrs unchanged.
- CSS: 48px search pill (shadow, deepens on focus-visible, accent-line ring via `:has(input:focus-visible)`); sort/direction/category are one rounded capsule (flex-wrap, `box-shadow` hairline dividers, 12px/500 muted label over 14px value, hover tint, `:has(:focus-visible)` accent ring, `max-width:56rem`); native `<select>` + chevron kept; per-screen category markup untouched.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68**; `tests/table-browse/browser.mjs` Chrome/Firefox/WebKit 11/11 each (Edge not installed).
- Gate checks in Chrome on the fixture (light + dark x 1440/768/375): no horizontal overflow; capsule stacks to one column at 375 (fields at different tops); typing in Search updates `q` after debounce, Sort by updates `sort`, Direction updates `dir`; tab order Search > Sort by > Direction > filter; capsule shows a 2px focus ring on keyboard focus. Screenshots reviewed in scratchpad `phase3/`.
- Not verified: authenticated real routes (needs Supabase session); the screens' category slot (Document, Method, Relation, ...) rendered in the capsule (fixture has none; markup is the same `.table-browse-field` pattern handled by CSS); hover state by interaction; Safari/Firefox visual look of `:has()` ring (harness behavioural checks pass in both).

### Phase 4 — Section 4: filter rail + Add CTA
- Restyle `segmented-filter.tsx`; style the `actions` slot; remove per-screen inline Add-button class strings where duplicated.
- **Gate:** `aria-pressed` semantics unchanged; row scrolls horizontally on narrow widths without page overflow; keyboard focus ring visible.

**Status: COMPLETE (verified 2026-10-12).** Changed: `apps/admin-web/src/app/globals.css` (+~20 lines net: filter-rail/Add-CTA block replaces the old filled-segment rules; forced-colors rule adjusted) and three TSX files with only a duplicated className string removed (`health/applicants/applicants-table.tsx`, `health/drive-table.tsx`, `incident-reports/incident-table.tsx`). `segmented-filter.tsx` markup deliberately unchanged (CSS-only restyle; props and `aria-pressed`/`role=group` intact). No `src/lib`, `src/hooks`, `src/actions`, `supabase/`, `package.json` changes by this phase; no new state/listeners/deps.
- Rail: text tabs, muted -> dark on hover, active = dark text + 2px `--ab-accent-line` bottom border (per-button, no sliding indicator); one-row `overflow-x:auto` with hidden scrollbar and static 12px `mask-image` edge fade; focus ring drawn inside (`outline-offset:-2px`) so overflow does not clip it. "+ Add" (`.table-browse-actions button`) is an accent pill with white text, `--accent-strong` hover, shared press scale; right-aligned, wraps below when the rail fills the row. Forced-colors: active tab keeps a `Highlight` underline.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68**; `tests/table-browse/browser.mjs` Chrome/Firefox/WebKit 11/11 each (Edge not installed).
- Gate checks in Chrome (scratch fixture: 9 tabs + Add button via the real `TableBrowseControls`/`SegmentedFilter`; light + dark x 1200/375): no page horizontal overflow at 375 while the rail scrolls internally (client 355 / scroll 701); `role=group`, `aria-label=Status`, one `aria-pressed=true` and Enter/keyboard selection moves it; keyboard focus shows a 2px accent outline; active underline 2px, inactive transparent; Add CTA 40px, white on accent, wraps below at 375; no console/page errors. Screenshots reviewed in scratchpad `p4/`.
- Not verified: authenticated real routes (needs Supabase session); the five screens whose Add button had no inline class (now styled by the shared CSS) individually; hover by interaction; Safari/Firefox visual look of the mask fade (behavioural harness passes); `forced-colors` rendering.

### Phase 5 — Section 5 chrome: pagination, loading, error panel
- Restyle `table-pagination.tsx` (icon buttons, same `aria-label`s), `table-browse-panel.tsx` progress/error styles.
- **Gate:** `browser.mjs` passes in Chrome/Firefox/WebKit (selectors for First/Previous/Next/Last/Rows per page unchanged); loading bar still appears only after 120 ms.

**Status: COMPLETE (verified 2026-10-12).** Changed: `components/admin/table-pagination.tsx` (+18/-8), `components/admin/table-browse-panel.tsx` (error panel markup only, +3/-1), `app/globals.css` (+16 lines appended Section 5 block). No `src/lib`, `src/hooks`, `src/actions`, `supabase/`, `package.json` changes by this phase; no new state/hooks/listeners/deps.
- Pager: First/Previous/Next/Last are 40px circular `--ab-fill` buttons with inline SVG chevrons (`aria-hidden`), `aria-label`s exactly `First`/`Previous`/`Next`/`Last` plus `title` tooltips; disabled logic unchanged (factored into `atStart`/`atEnd`). "Page N of M" muted, `tabular-nums`. First/Last (`data-edge`) hide below 480px so Previous/Next stay on one row. Rows-per-page uses the shared chevron select with a 12px/500 muted label; the outer `.table-browse-pagination` class (harness selector) is kept, the inner nav now uses `.table-browse-pager`. Footer row is `space-between`.
- Loading: existing 2px bar and 120ms-delayed fade unchanged; only the bar gets a pill radius.
- Error panel: `role=alert` keeps the same text and `Retry` button name; adds an `aria-hidden` alert icon, soft red tint (matches the summary banner, light + dark), 16px radius, transparent border so forced-colors still shows an outline; Retry uses the existing pill style.
- Icons are inline SVG, not `lucide-react`: importing lucide into the table chrome made the esbuild fixture load a second React copy (root `node_modules`) and crash with "Invalid hook call"; Phase 3's search icon follows the same inline pattern.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68**; `tests/table-browse/browser.mjs` (evidence redirected to scratchpad) Chrome/Firefox/WebKit 11/11 each (Edge not installed).
- Gate checks in Chrome (fixture, scratch script `p5/gate.mjs`): accessible names in the "Table pages" nav = First, Previous, Next, Last; buttons 40x40, 50% radius; Next -> "Page 2 of 11", Last -> "Page 11 of 11" with Next disabled; Tab from Rows per page reaches the next enabled pager button with a 2px solid outline; progress bar opacity 0 at ~30ms (transition-delay 0.12s) and 1 at ~430ms after pending; at 375px First/Last `display:none` and Previous/Next 40px; no horizontal overflow at 1440/375 light + dark; error panel tint/radius/icon correct in light + dark and Retry clears it; reduced motion -> pager `transition: none`; no console/page errors. Screenshots reviewed in scratchpad `p5/` (footer 1440/375 x light/dark, error 375 light/dark, pending 1200).
- Not verified: authenticated real routes (needs Supabase session); pager disabled-while-pending visually (fixture does not pass `pending` to `TablePagination`; logic unchanged); hover by interaction; Safari/Firefox visuals beyond the behavioural harness; `forced-colors` rendering of the error panel.

### Phase 6 — Inline Add forms
- Add `form-styles.ts`; replace the 8 `inputClass` constants and form container classes.
- **Gate:** each form still submits/cancels (no logic touched; `git diff` shows only className/markup changes in those blocks).

**Status: COMPLETE (verified 2026-10-12).** New `apps/admin-web/src/components/admin/form-styles.ts` (5 class constants: `formContainerClass`, `inputClass`, `readOnlyClass`, `submitButtonClass`, `cancelButtonClass`); `globals.css` +4 lines (`.ab-btn-ghost`, ghost hover, `.ab-field[readonly]`). No new state/hooks/listeners/deps; no `src/lib`, `src/hooks`, `src/actions`, `supabase/`, `package.json` changes by this phase.
- Converted (className/import only, handlers and logic untouched): `requests-table`, `transactions-table` (also `readOnlyClass`), `resident-directory` (invite form; `inputCls` renamed to the shared `inputClass`; the rejection-reason textarea in the detail modal keeps its original class since modals are out of scope), `incident-table`, `drive-table`, `applicants-table`, `households-table`, `staff-form`. The duplicated `inputClass`/`inputCls`/`readOnlyClass` strings were removed; the `rounded-xl border ...` container, accent submit and zinc cancel strings now come from the shared constants.
- Look: container `.ab-card` (16px radius, shadow, no border); fields `.ab-field` (44px, 12px radius, hairline, native select with chevron, accent focus ring); accent pill submit, ghost Cancel; read-only fields use `--ab-fill`. Labels stay above fields.
- `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68**; `tests/table-browse/browser.mjs` exit 0 (Chrome/Firefox/WebKit; Edge not installed).
- Gate checks in Chrome on a scratch fixture built from the real shared constants with compiled `globals.css` (light + dark x 1200/375): no horizontal overflow; container 16px radius + shadow; inputs/selects 44px, 12px radius, chevron present; submit 40px pill on accent; Cancel transparent; read-only fill correct in both themes; disabled opacity .45; keyboard focus shows a 2px solid outline. Screenshots in scratchpad `p6/`.
- Not verified: submit/cancel of each form by interaction against the authenticated routes and database (need a Supabase session; handlers are textually untouched and tsc confirms bindings); a clean `git diff` boundary, because the working tree already held many uncommitted changes from other phases (className-only was confirmed by inspecting the changed form blocks); hover/press by interaction.

### Phase 7 — QA and weight check
- Manual pass in the built-in browser on all 8 screens: light/dark × 1440/768/375, reduced-motion on, keyboard-only walkthrough.
- `git diff --stat`: confirm nothing changed under `src/lib`, `src/hooks`, `src/actions`, `supabase/`, and that CSS added is small (target < ~200 lines net, no new dependencies in `package.json`).
- **Gate:** all checks green; summarize before/after screenshots.

**Status: COMPLETE for everything verifiable without an authenticated session (verified 2026-10-12); the per-route manual pass on the 8 real screens is NOT done (blocker below).** No product code changed in this phase; only this plan was edited.
- Static/automated: `npx tsc --noEmit` exit 0; `npx eslint src` exit 0; vitest 4 files, **68/68**; `tests/table-browse/browser.mjs` (evidence redirected to scratchpad `p7/harness`) Chrome/Firefox/WebKit **11/11 each**, no page errors; Edge not installed (not exercised).
- Manual pass, **fixture-based, not the real routes**: scratch page composing the real `AdminPageHeader`, `SummaryCards`, `TableBrowseControls` (category select + 9-tab `SegmentedFilter` + Add CTA), `TableBrowsePanel`/`EditableDataTable`, `TablePagination` and the shared `form-styles` Add form, rendered in installed Chrome with the compiled `globals.css` (script `p7/qa.mjs`):
  - Light + dark x 1440/768/375: document horizontal overflow 0 in all six; every `.ab-field` >= 44px and every pager button >= 40px; no console/page errors.
  - Reduced motion (`prefers-reduced-motion: reduce`): transition duration `0s` and animation `none` on `.ab-btn`, pager buttons, `.ab-card-lift`, filter tabs and `.ab-field`.
  - Keyboard-only walk from page top: Search > Sort by > Direction > Document > 9 filter tabs > Add > table region > column resizers > Rows per page > Next > Last > Add form. Order is logical, nothing is skipped or trapped; Space on a tab sets `aria-pressed=true`. Buttons/inputs show a 2px outline; the sort/direction/category selects show the ring on the capsule via `:has(:focus-visible)` (by design, Phase 3), so a per-element check reports them as "no ring" while the capsule outline is present.
  - Contrast (measured): muted label on card 5.41:1 light / 6.91:1 dark (>= 4.5); active-tab text 15.9 / 18.2; active underline vs page background 7.97:1 light / 5.27:1 dark (>= 3:1).
  - Forced summary error shows the soft-red banner with "Retry summary"; Retry clears it.
- Boundary (`git status`/`git diff`): nothing from this plan touched `src/lib`, `src/hooks`, `src/actions`, `supabase/` or any `package.json`/lockfile. The working tree does hold earlier, other-plan uncommitted changes there (new `src/lib/admin-tables/**`, `src/hooks/use-*`, migrations 0110-0112, and a 2-line cleanup effect in `use-table-browse-navigation.ts`); none were produced by Phases 0-7 of this plan.
- Weight budget: `globals.css` is +202/-14 vs HEAD (net +188), which includes about 35 lines of other work (`color-scheme`, native-select base, loading bar), so about 155 net lines are attributable to this plan (< 200). 3 new small files (`admin-page-header.tsx` 6 lines, `summary-cards.tsx` 23, `form-styles.ts` 8; none contain hooks or listeners). 0 new dependencies. 0 added `useState`/`useEffect`/`addEventListener` in `table-pagination`, `table-browse-controls`, `table-browse-panel` or the new files. In the eight converted Add-form files, deleted lines exceed added lines in every one.
- Before/after screenshots (scratchpad `p7/shots/`: `after-{light,dark}-{1440,768,375}.png`, `before-{light,dark}-{1440,375}.png`). "Before" is an approximation: the same current components rendered with `globals.css` from `HEAD`, because the original Phase 0 "before" captures were not retained. It shows the old look (raw selects, boxed filter buttons, bare search, unstyled pager/forms) versus the new pill search, capsule, underline tabs, accent CTA, circular pager and card form.
- **Not verified / blocker:** the manual pass on the 8 real authenticated routes (Requests, Transactions, Residents, Households, Staff, Incidents, Health drives, Applicants) and interactive submit/cancel of each Add form against the database. Both need a signed-in Supabase admin session, which is unavailable here (the seeded test account's password is known-broken per project memory). Also not exercised: Edge, hover by interaction, `forced-colors` rendering, real screen reader. To close: sign in as an admin, open each of the 8 routes in light/dark at 1440/768/375, and submit/cancel one Add form per screen.

## Polish pass: concrete specs

### Token values (defined once in `globals.css`, light / dark)
| Token | Light | Dark |
|---|---|---|
| `--ab-text` | `#222222` | `#f5f5f5` |
| `--ab-muted` | `#6a6a6a` | `#a1a1aa` |
| `--ab-line` | `#dddddd` | `#3f3f46` |
| `--ab-surface` | `#ffffff` | `#18181b` |
| `--ab-fill` | `#f7f7f7` | `#27272a` |
| `--ab-fill-hover` | `#f2f2f2` | `#323238` |
| `--ab-shadow-1` | `0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.06)` | `0 1px 2px rgba(0,0,0,.5)` |
| `--ab-shadow-2` | `0 4px 12px rgba(0,0,0,.12)` | `0 4px 14px rgba(0,0,0,.6)` |
| `--ab-ease` / `--ab-dur` | `cubic-bezier(.2,0,0,1)` / `160ms` | same |
| radii | pill `999px`, card `16px`, field `12px` | same |

### State matrix (pills, fields, icon buttons, tabs)
- **Rest:** token colours, no motion.
- **Hover:** `--ab-fill-hover` background *or* `--ab-shadow-2`, never both; only under `@media (hover:hover)`.
- **Focus-visible:** 2px accent ring, 2px offset; never removed; mouse focus shows no ring.
- **Press:** `transform: scale(.97)`, 80ms.
- **Disabled:** 45% opacity, `cursor: not-allowed`, no hover/press.
- **Pending (loading):** controls unchanged; only the table body fades (existing behaviour).

### Interaction details
- Search clear (x) is the native `type=search` control: no extra JS or state.
- Capsule (section 3) uses `:focus-within` for shadow + accent ring: no JS.
- Filter rail: static 12px edge-fade via `mask-image` (no overflow measuring).
- Pagination: First/Last hide below 480px; Previous/Next stay, so the footer never wraps awkwardly.
- Summary numbers use `font-variant-numeric: tabular-nums` so refreshes don't jitter.

### Accessibility and contrast gates
- Body text >= 4.5:1 (`#6a6a6a` on white 5.3:1; dark `#a1a1aa` on `#18181b` 7.1:1).
- Active-tab underline needs 3:1; if a user-chosen accent fails, fall back to `--ab-text` via `color-mix` (CSS only).
- Targets: icon buttons >= 40px, fields >= 44px.
- `forced-colors: active` keeps Highlight outlines; shadows never carry meaning.
- Accessible names unchanged: First, Previous, Next, Last, Rows per page, Search, Sort by, Direction, filter group names.

### Weight budget (checked in Phase 7)
- New CSS <= 200 lines; <= 3 small new TSX/TS files.
- 0 new dependencies, 0 new `useEffect`/`useState`, 0 new event listeners.
- Net line count across touched TSX files goes **down** (duplicate class strings removed).

### Risk and rollback
| Risk | Mitigation |
|---|---|
| Test selectors break when buttons become icons | Keep text as `sr-only` + `aria-label`; harness queries by role/name |
| Style bleed to other pages | Scope everything to `.table-browse-panel` / `.ab-*` |
| Poor-contrast user accent | `color-mix` fallback; CTA text stays white on accent via existing helpers |
| Long option text clips in capsule | `min-width:0`, ellipsis, full text in `title` |
| Regression in the 10-row layout | Table files untouched; gates re-run the harness |
| Need to undo | One phase = one reviewable change; `git checkout -- <files>` per phase |

### Per-phase report
After each gate: files changed, line delta, test results, one light + one dark screenshot. Continue only if green.

## Step 0 on approval: save this plan to the repo
Copy this document to `plans/Admin_Table_Airbnb_UI_Refresh_Plan.md` in the repo (the project keeps its plans in `plans/`), before Phase 0. Nothing else is written until Phase 1.

## Files
Modify: `src/app/globals.css`; `src/components/admin/{table-browse-controls,segmented-filter,table-pagination,table-browse-panel,pilot-summary,operations-table-summary,profile-table-summary,profile-table-panel}.tsx`; 8 `page.tsx` headers; Add-form blocks in `requests-table`, `transactions-table`, `resident-directory`, `incident-table`, `drive-table`, `applicants-table`, `households-table`, `staff-form`.
New (small): `src/components/admin/{admin-page-header,summary-cards}.tsx`, `src/components/admin/form-styles.ts`.
Untouched: `editable-data-table.tsx`, `table-scroll-area.tsx`, `table-browse-layout.ts`, `src/lib/**`, `src/hooks/**`, `src/actions/**`, `supabase/**`.

## Reuse
`TableBrowseControls` slots (`category`/`filters`/`actions`), `SegmentedFilter` props (unchanged), `StatusPill`, lucide-react icons already installed, existing `Skeleton`, and the shipped loading bar/fade classes.

## Verification (end-to-end)
`npx tsc --noEmit` · `npx eslint src` · `npx vitest run --config vitest.config.ts` · `tests/table-browse/browser.mjs` (redirected evidence dir) · manual browser pass per Phase 7 · `git diff --stat` boundary check.

## Assumptions
- Admin accent colour setting remains the brand colour (no `#FF385C`).
- Font stays the admin's selectable `--font-app`.
- Inline Add forms are in scope; detail modals are not.
