# P13 — Maps discovery and emergency guidelines, hotlines and alerts: implementation and verification (2026-10-16)

**Status:** Partially complete (non-device scope, OD-06/OD-07/OD-10). T01–T05 and T07 verified; T06 and T08 partial. Source: uncommitted on base `e860743`. Environment: local workspace, a browser run of the generated map page, and read-only hosted catalog and content queries (project `pwjbucnyqexiepoinoke`). No commit, push, deployment, migration, dependency, configuration, Edge Function, shared-package or Android/web change. One gate changed: `emergencyContent` was opened after the owner waived PR-12 (OD-10, below).

## Entry assessment

Phases 2 and 11 are Verified (non-device scope); Phases 3, 4, 6 and 12 are Partially complete and their open exits are carried as blockers, as for Phases 4–12. The work was started on the owner's request of 2026-10-16. Phase 2 primitives were reused: public cache and `usePublicResource`, `usePagedResource`/`readAll`, the foreground location controller, the bundled-Leaflet WebView page, announcement read actions and the Phase 11 announcement route. `AGENTS.md`/`CLAUDE.md` impose no conflict: no migration was needed (next unused prefix stays `0129`) and no Android UI was touched.

Baseline before editing (iOS workspace): `tsc --noEmit` 0 errors, `eslint .` 0, `vitest run` 20 files / 397 tests passed.

**Owner decision OD-10 (2026-10-16).** After the first pass asked for a named DRRM owner, review date and escalation contacts, the owner replied: "we dont need that actually, just copy the same DRRM in the android resident". PR-12 is waived, the Android content is accepted as is, and `emergencyContent` was set to `true` for the non-device, non-live scope. See P13-D01, P13-D02 and P13-D12.

## Requirement classification (before → after)

| Requirement | Before | After |
|---|---|---|
| A19 Maps layers, boundary, markers, search, chips, location, DRRM panel | Not started (placeholder screen) | Implemented; own reports only and no tiles until `publicIncidents`/`mapProviders` open |
| A20 Hub sections, aliases, return paths | Partial (flat list behind a closed gate) | Implemented (six sections, route-parameter state, Android aliases); Family/QR say they are not available yet |
| A21 Guidelines | Partial (titles and body only) | Implemented (expandable steps, icons, cache labels, bundled fallback) |
| A22 Hotlines | Partial (no numbers, no dialer) | Implemented (every number its own validated call action) |
| A28 Alerts | Not started | Implemented (periods, custom filters, exact counts, pagination, read state) |

## What exists now

- **Data.** `schemas.ts`: `emergencyInformationRow` gains `icon`, `icon_color`, `icon_bg`, `content`, `sort_order`; `centerRow` gains `position`; new `incidentMapRow`. `resident-api.ts`: `announcements(category, window?)` takes a half-open publication window; new `announcementCount` (exact head count) and `mapIncidents` (own concerns, bounded `readAll`). Public-cache contract versions for emergency content and centers rose to 2, so older cached shapes are discarded rather than shown.
- **Emergency** (`src/features/emergency/`): `content.ts` (row parsing, `dialTarget`, colour/icon safety), `seed.ts`, `sections.ts`, `alert-filters.ts`, `alerts-read.ts`, `use-emergency-content.ts`, `content-status.tsx`, `guidelines-section.tsx`, `hotlines-section.tsx`, `alerts-section.tsx`, `emergency-screen.tsx`; `src/app/emergency.tsx` is a thin route.
- **Maps** (`src/features/maps/`): `map-model.ts` (records, filters, distance, bridge payload), `discovery-map.tsx`, `drrm-panel.tsx` with `panel-motion.ts`/`panel-gesture.ts`, `location-card.tsx`, `maps-screen.tsx`; `(tabs)/maps/index.tsx` renders it; `(tabs)/maps/hotline-directory.tsx` and `preparedness-guide.tsx` redirect to the hub sections.
- **Map page** (`profile/location-map.ts`): the bundled page now also handles `SET_MARKERS`, `SET_USER_LOCATION`, `FIT_ALL`, `SET_CENTER` and reports `MARKER_TAPPED`, using the shared bridge vocabulary. `readPoint` accepts unknown JSON.
- **Tests:** `tests/emergency.test.ts` (30) and `tests/maps.test.ts` (19).

## Decisions

- **P13-D01 — `emergencyContent` is not a screen blocker.** The first pass rendered the hub with the gate closed and a notice that no DRRM reviewer or review date was recorded. After OD-10 the gate is open and that notice was replaced by a single line on Guidelines and Hotlines: the app does not monitor emergencies or guarantee alerts. Content sources and the age labels are unchanged.
- **P13-D02 — bundled fallback.** The fallback is Android's own seed (three earthquake guidelines; 911, Red Cross 143, BFP 911, PNP 911). It appears only when the barangay's published list for that category is empty or could not be loaded and no saved copy exists, is labelled as built-in reference information, and is never cached. The owner accepted it as is (OD-10); no separate approver exists.
- **P13-D03 — sections.** Android has five (Hub, Centers, Scan, Family, Alerts); the plan names six. The hub has Guidelines, Hotlines, Centers, Family, QR, Alerts selected by `section` (Android `tab` accepted: `hub`→Guidelines, `scan`→QR, plus the two obsolete screen names). Unknown values open Guidelines. Family and QR show a sign-in prompt for guests and "not available in this version yet" for residents; they are not counted ready (Phases 14–15).
- **P13-D04 — incident layer scope.** `publicIncidents` is closed, so the layer shows the resident's own concerns, every status (as Android shows every status), with the status in the detail line. A concern without a usable pin is counted and reported, not dropped silently. A visible note says other residents' reports are not shown.
- **P13-D05 — extra filter button omitted.** Android's filter icon does nothing; real filtering stays in the search and category chips (allowed by P13-T01).
- **P13-D06 — alert filters.** Periods match Android: Today is the local day; Last Week/Month/Year count back 7/30/365 local days. A period and the custom fields both apply. A year, a month of a year or a day is a server window (exact pages and counts). A month or day without a year recurs across years and cannot be a range, so it is matched on the device against a bounded snapshot (`readAll`, 1,000 rows, refused rather than cut). Invalid month/day/year text is flagged and shows "Check the date filter" instead of being ignored (Android ignored an unknown month yet counted it as active). Months accept a name or at least three letters (superset of Android). Impossible dates (31 April, 29 February in a common year) match nothing without a read. The bulk "mark all" stays in Reports; alerts keep per-item read state only.
- **P13-D07 — centers.** The hub's Centers section keeps the basic Phase 2 list with a validated call action; search, nearest-first, details and routes are Phase 14. The map's center layer lists centers with distance from a confirmed origin only.
- **P13-D08 — map page safety.** Only ids, pins and validated colours cross the bridge; labels stay in React Native and never enter the page. The page validates coordinates, ids and colours itself, builds no HTML from messages and uses no popups. Tiles stay off (CSP `img-src data:`).
- **P13-D09 — dialer.** `Linking.openURL('tel:…')` after `dialTarget` validation (3–15 digits, optional leading `+`, common separators only; `*`, `#`, `,`, `;` rejected). iOS asks the resident to confirm; nothing auto-dials. A failure to open the dialer shows the number to dial manually. `canOpenURL` is not used (it would need `LSApplicationQueriesSchemes`).
- **P13-D10 — DRRM panel.** Handle tap is the accessible action (expanded/collapsed state announced, collapsed content hidden from VoiceOver); a vertical drag also works with Android's 60-point/0.5-velocity rule, using React Native `Animated`/`PanResponder` (no Reanimated layout animations) and skipping motion when reduced motion is on.
- **P13-D12 — OD-10 and the sample content.** The hosted `emergency_information` rows look like sample data (a "Sample Guideline", a guideline whose only step is "333", placeholder-style numbers). Because the Android app shows the same rows, the owner's decision accepts that behavior; the rows were not edited or published by this phase.
- **P13-D11 — location UI.** `LocationCard` renders the shared controller's wording and its six actions (locate, retry, cancel, confirm, reject, open Settings) plus "Not now". Phase 14 reuses it.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors (baseline 0) |
| `eslint .` | 0 problems (baseline 0); two findings in my own code (ref access during render, unneeded memo dependency) were fixed |
| `vitest run` | 22 files / 447 tests passed (baseline 20 / 397; 50 new). `tests/config.test.ts` now lists `emergencyContent` among the owner-opened gates (OD-09: `qrph`, `pickup`; OD-10: `emergencyContent`) and `tests/emergency.test.ts` asserts the gate state |
| `expo export --platform ios` | exit 0, one Hermes bundle |
| Map page executed in a browser | Valid markers drew, a malformed marker and a non-string id were dropped, an unsafe colour fell back to the default, a marker tap posted its id, clearing markers left only the resident marker, boundary/fit/centre messages ran, console had no errors |
| Hosted contract (read-only) | All selected columns exist with the expected types; anon and authenticated select policies exist for `emergency_information`, `evacuation_centers`, `announcements`; hosted content shapes (list of strings for guidelines, `{label, number}` for hotlines, JSON object positions) match the parsers |

Not run: the app on a device or simulator, a live session, VoiceOver or Dynamic Type, hosted reads through the app, `expo config --type introspect` (no configuration changed).

## Acceptance and open items

- **Met (non-device):** layers, boundary, markers, search, category chips with second-tap clearing, selected place/list equivalence, location states, DRRM panel; hub sections, aliases and return state; guidelines and hotlines with labels, fallback and validated multi-number calls; alert periods, custom filters, counts, pagination and read state; WebView restrictions and bridge validation; content mirrors Android with no invented number or monitoring promise (P13-T07 under OD-10).
- **Open — P13-T06 partial.** Tile and geocoding processors and attribution (PR-10) and an approved public incident projection (PR-13) are not supplied; `mapProviders` and `publicIncidents` stay closed.
- **P13-T03 note.** The task also lists QR guidance content; Appendix A assigns the QR guide to Phase 15 (A25), so it is not part of this phase's closure.
- **Open — P13-T08 partial.** Live, device, VoiceOver, Dynamic Type, real dialer behaviour and offline behaviour on a device are Skipped (OD-06/OD-07).
- **Out-of-scope observations (not fixed):** the `announcements` and `emergency_information` anon select policies carry no tenant predicate (the app filters by tenant; matters if a second tenant is added); `npm run check:release` fails by design while gates are closed; Android's seed lists 911 for three agencies; the hosted emergency rows look like sample data.
