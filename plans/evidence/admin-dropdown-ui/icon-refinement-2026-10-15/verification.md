# Dropdown icon refinement — 2026-10-15

Status: Complete for this frontend icon request.

The existing generic fallback made the semantic-icon requirement only partially met. The shared select now separates the field icon from option icons. Fixed values use symbols grounded in the existing UI options and shared constants. Data-driven records, placeholders and unknown values retain the same icon gutter without invented per-record symbols. Explicit caller icons remain supported. Selected values preview the option symbol unless an explicit field icon is supplied.

Presentation metadata covers sort fields/directions, inline editors, record drawers, form/filter controls, compatibility controls and the two previously audited unused modals. QR presets display the actual corresponding glyphs. Neither unused modal was activated. No dependency, business configuration, callback, query, payload, permission, backend or deployment changes were made for this request.

| Check | Baseline | Final |
| --- | --- | --- |
| Admin typecheck | Pass | Pass |
| Full admin lint | Pass | Pass |
| Existing Vitest suite | Pass, 118 tests | Pass, 118 tests |
| Production build (`next build --webpack`) | Pass, 45 generated pages | Pass, 45 generated pages |
| Existing dropdown browser regression | Earlier evidence preserved | Pass; no page/console errors or warnings |
| New focused semantic-icon browser suite | Added for this request | Pass; no page/console errors or warnings |
| Changed-screen metadata audit | Pre-edit snapshot captured | Pass, all 25 screens; source identical after stripping only icon-kind metadata |
| Diff whitespace review | — | Pass |

Browser checks use actual frontend components, synthetic records and mocked persistence/navigation; no hosted data writes. The icon suite directly checks announcement, FAQ, hub and waste options; sex/employment compatibility controls; all ten QR presets; selected QR preview; request, transaction, resident, health and staff inline editors; sort fields/directions; payment choices in record drawers; explicit icon overrides; unknown values; and no popup-open/dismiss writes. The regression suite rechecks keyboard, forms, focus, inline saves/cancels, 30 viewport/theme/accent combinations, fonts, zoom, reduced motion, eight main tables, eight record archives and generated drawer selectors.

Reviewed the settled `qr-icon-previews.png` and `qr-icon-previews-dark.png` screenshots. During implementation, fixed one React static-component lint finding by selecting icons from module-level metadata. Corrected two test-only assumptions (the installed CircleHelp glyph class and staff's actual Role header); the final run passed.

Acceptance criteria for this refinement: semantic field and option icons **met**; no repeated generic glyph for unrelated choices **met**; selected/explicit icon behavior **met**; interaction and save behavior **met** in local fixtures; no new type/lint/test/build/runtime regressions **met**. No blockers.

Plan discrepancies observed: the current service form has no pricing selector, and the old request-review-panel file is absent. Preserved the current implementation. Unrelated concurrent profile/header/surface/backend changes remain outside this request. Supplemental authenticated read-only, screen-reader, physical-touch and other-browser checks remain pending manual verification under the exact steps in the parent `verification.md`; none is claimed passed here.

Evidence: `icons-results.json`, `browser-results.json`, `screen-icon-audit.json` and the screenshots in this directory. Reproduce the icon suite from `apps/admin-web` with `node tests/dropdown/icons-browser.mjs`. The existing regression suite accepts `DROPDOWN_TEST_EVIDENCE_DIR` to preserve the original evidence.
