# Admin content UI preview

Run from the repository root:

```sh
node apps/admin-web/tests/content-workspace/preview.mjs
```

Open `http://127.0.0.1:4178`. The preview bundles the actual Services, Announcements,
Waste Management, Hub, FAQ, and Evacuation Centers components with synthetic records. Navigation,
audit logging, and data adapters are replaced for this preview; database writes
are disabled. It does not change the application's authentication or adapters.

Use the screen selector and light/dark and empty toggles to review every screen.
Create sheets and inline editors use the production forms. Do not use this
preview to assess real data persistence.

## Verified on 2026-10-13

- Service search, announcement category filters, Hub categories, collection
  status and schedule switching, and FAQ visibility and answer search.
- Filter resets and zero-record empty states on all five screens.
- Create-sheet draft retention, Escape dismissal, restored trigger focus,
  released scroll lock, and Tab wrapping inside the sheet.
- Light and dark layouts; no horizontal page overflow on all five screens at
  a 390px viewport. Inline editors on all five screens also fit this viewport.
- Scoped TypeScript and ESLint checks passed. Preview console had no errors
  or warnings after the final revision.

The full admin type check encounters four existing unresolved imports in the
resident-web service form, imported by the separate resident request route.
Authenticated routes, real writes, OS reduced-motion behavior, and high-volume
performance were not exercised. Reduced-motion CSS and immediate modal cleanup
were reviewed in the implementation.

## Visibility update on 2026-10-13

- Shared item cards now have separated surfaces, stronger borders, and spacing.
  Actions and filter tabs have clearer borders and fills; selected filters use
  a solid accent. Primary actions and archive actions have distinct emphasis.
- Service fees and processing times, emergency announcement badges, and center
  capacity, occupancy, verification, and full-capacity notices have stronger emphasis.
- Evacuation Centers uses the shared summaries, filters, cards, and create sheet.
- Center search, active/inactive filters, reset, empty state, inline editing,
  archive confirmation cancellation, sheet draft retention, Escape, focus
  restoration, and scroll-lock cleanup passed in the preview.
- All six screens fit a 390px viewport without horizontal page overflow.
  The center editor also fits. Light/dark appearances were visually reviewed;
  final console logs contained no warnings or errors.
- Scoped TypeScript and ESLint checks passed for the updated components.
