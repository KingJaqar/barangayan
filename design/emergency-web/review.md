# Resident web emergency UI review

Completed October 14, 2026 (Asia/Manila).

The five emergency routes share pill navigation, softly tinted content cards, and consistent typography adapted from [Lemon Squeezy](https://www.lemonsqueezy.com/). The large introductory cards were subsequently removed at the resident's request; page titles remain available to screen readers. All presentation colors derive from the resident's selected accent and light/dark theme tokens. Urgent and capacity warnings use the shared semantic status tokens. The existing resident shell and theme remain compatible.

## Presentation changes

- Hub: separate preparedness and hotline panels, clear section hierarchy, and larger click-to-call targets.
- Centers: responsive directory cards, clearer capacity indicators, and a highlighted location status panel. Existing list/map selection and walking-route behavior are preserved.
- Scan: numbered instructions, grouped scan/show actions, and a quieter upload fallback.
- Family: household header, prominent QR access, responsive roster cards, and consistent add/edit controls.
- Alerts: organized date filters, readable announcement cards, date metadata, and distinct urgent styling.
- QR and family dialogs: consistent styling, viewport margins, and scrolling for short screens. QR canvases retain their original payloads and download resolution.

## Checks

| Check | Result |
| --- | --- |
| Resident web production build | Passed, including final QR/dialog changes |
| TypeScript | Passed standalone and during the final build |
| ESLint on emergency components and layout | Passed |
| All five screens at 320, 768, and 1440 px | Passed; no page horizontal overflow |
| QR dialog at 320 × 568 px | Passed; no horizontal overflow |
| Family dialog at 320 × 568 px | Passed; vertical scrolling keeps controls reachable |
| Accordion interaction and telephone links | Verified |
| Keyboard center selection and map mounting | Verified using sample centers |
| Family add and relation/role selection | Verified using in-memory sample data |
| Alert time range, custom date filter, and empty results | Verified |
| Alert loading, read failure, and stale-data warning states | Verified with isolated fixtures |
| Light/dark compatibility | Reviewed |
| Live accent switching on all five screens | Passed for default, blue, and custom accents in both light and dark modes |
| Dialog colors outside the page wrapper | Passed; family choice controls, surface, and text inherit the current theme |
| Map marker colors | Passed; blue-to-custom accent changes update existing SVG pins without resetting the map |
| Motion | Existing navigation spring preserved; no content entrance animations added. Reduced-motion navigation and CSS transitions are handled. |

## Limits

Browser review used an isolated local preview of the real presentation components with synthetic data and in-memory household edits. It did not change hosted data. The local data service was unavailable, so authenticated API calls, physical camera scanning, check-in writes, household QR generation, and real device-location/walking-route responses were not exercised. Existing hooks, data flows, routes, integrations, and backend files were preserved. No dependencies or Android UI changes were introduced.

The preview build tools are in the ignored `dist/emergency-review` directory. The accent checks use the real resident theme and accent controllers, with local preview controls that are not shipped in the application. [Computed color evidence](theme-results.json) records these checks. QR graphics keep the QR library's standard scanning contrast; their surrounding controls and frame follow the resident theme. Other resident web changes made concurrently in the shared workspace were preserved.

## Theme review screenshots (sample data, before introductory card removal)

| Screen | Desktop | Tablet | Narrow web |
| --- | --- | --- | --- |
| Hub | [1440 px](hub-1440.jpg) | [768 px](hub-768.jpg) | [320 px](hub-320.jpg) |
| Centers | [1440 px](centers-1440.jpg) | [768 px](centers-768.jpg) | [320 px](centers-320.jpg) |
| Scan | [1440 px](scan-1440.jpg) | [768 px](scan-768.jpg) | [320 px](scan-320.jpg) |
| Family | [1440 px](family-1440.jpg) | [768 px](family-768.jpg) | [320 px](family-320.jpg) |
| Alerts | [1440 px](alerts-1440.jpg) | [768 px](alerts-768.jpg) | [320 px](alerts-320.jpg) |

Additional checks: [dark QR dialog](qr-dialog-blue-dark-320.jpg), [dark family dialog](family-dialog-blue-dark-320.jpg), [dark hub with blue accent](hub-blue-dark-1440.jpg).
