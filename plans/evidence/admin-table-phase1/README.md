# Phase 1 — Shared frontend foundation

Implemented on 2026-10-11 (Asia/Manila). This is the section 4 frontend phase, superseding the earlier baseline-only Phase 1 audit. Phase 0 was already complete. No screen integration or database adapter was implemented.

## Delivered

- Admin-local validated URL state, canonical URL builder, screen allowlists, sort descriptors, exact 10/20/30/50/100 page sizes, ranges and stable query identity.
- Navigation with one 300ms search timer, immediate draft commits, atomic page resets, history/unmount cancellation, pending-navigation state merging and edit settlement. Latest-result gate and refresh coalescer are available to later adapters.
- Opt-in shared panel, labeled controls, pressed-button segmented filters, pagination, committed announcements, busy/inert pending results and separate query-error Retry.
- Named focusable viewport, sticky opaque headers, measured maximum height, compact short-window layout, gutter-aware mirror, persistent column buttons, keyboard scrolling and resize/edit entry. Stable column IDs are optional for compatibility.
- Failed opt-in saves retain their draft and expose Retry/Cancel. Active-save settlement shares one promise, captures the record identity, restores focus and cleans up active drag listeners and focus frames on unmount.
- Scoped wheel boundary fallback following observed Firefox/WebKit chaining. Strip input is normalized and applied once. Ctrl/Meta zoom is preserved; nested scrollable editors consume their own input first. No global wheel cancellation.
- Main flex containment anchor and scoped CSS. Existing table callers remain unbounded and unsorted unless wrapped/configured. No resident UI or migration changes.

## Executed evidence

| Check | Result |
|---|---|
| Vitest | 51 passed, zero failed; `unit-tests.log` |
| Admin typecheck | Passed; `typecheck.log`; final production build also typechecks |
| Affected source/config/test lint | Passed, 15 TS/TSX files; empty successful `lint.log` |
| Production build | `next build --webpack` passed; `build-webpack.log` |
| Chrome 154.0.8037.99 | 11 browser groups passed |
| Firefox 153.0 | 11 browser groups passed |
| WebKit 26.5 | 11 browser groups passed |
| Edge | Unavailable: no installed executable |

`browser-results.json` records the final run. Each browser exercises all 45 count/page-size combinations, ranges and partial final pages, internal wide-table overflow, first/last row/column access, header alignment, mirror equality, ten boundary wheel inputs per direction, strip routing, keyboard boundaries/Tab escape, keyboard resizing, header/toolbar agreement, failed edits, focus restoration, search/debounce/history, pending/error/Retry, delayed navigation merging, narrow/short windows, sidebar, dark/forced colors, 200%/400% equivalent viewports and CSS zoom, and ten repeated mounts. The unchanged DataTable is rendered as a dashboard compatibility fixture. Observer and window-listener counts return to the harness baseline; the one remaining document/history/hit-target observer/listeners belong to React, the navigation mock or Playwright, not the table.

Fixtures bundle the actual source components and actual stylesheet, using a local Next navigation mock. These are component/browser acceptance tests, not authenticated routes, server rendering/navigation transitions, database completeness/security, actual OS/browser zoom commands or a production release. Unit gate/coalescer tests execute delayed/disposed identities, editing deferral, burst reconciliation and failure without automatic retry. Later screen adapters must use those contracts; their actual network/Realtime integrations remain later work.

## Failures and limitations retained

`browser-attempt1.json` through `browser-attempt13.json` retain the earlier runs. The initial sandbox could not access loopback; the approved external run did. Browser testing identified and fixed grid minimum-width overflow and Firefox/WebKit wheel chaining. Other failures were corrected test accounting/label/focus assumptions: exact select labels, keyboard modality, React's document observer and Playwright's hit-target listeners. No failed run is presented as a pass.

The default Turbopack build first failed fetching the existing Geist/Geist Mono Google Fonts dependency in the sandbox. A network-enabled attempt then failed starting a Turbopack CSS child process (exit 0 before connection). The cause of that toolchain failure was not established. The supported webpack production build passed; this does not establish that default Turbopack now works. No font, framework or unrelated dependency was upgraded to bypass the issue.

Edge, physical Windows/macOS wheel/trackpad input, OS overlay-scrollbar preferences, native Safari and manual screen-reader checks remain unperformed. The fixture provides buttons independent of scrollbar thumb visibility. These are recorded release-verification limitations, not successful checks or claims about manual accessibility. Authenticated route/dashboard smoke and the integrated eight-screen/query/permission flows belong to the later integration/release phases.

## Scope and repeatability

Test dependencies are declared in the admin package. `dependency-delta.json` compares the lockfile to its immediate pre-install snapshot: only the admin package, Playwright, Playwright core and Playwright's optional fsevents entry changed. All other pre-existing lock entries were preserved. Root normalization of the engine/workspace key order was restored. Unrelated resident/shared/OTP changes remained untouched; no whole-workspace byte-equality claim is made while concurrent work is ongoing.

Run `npm run test:tables --workspace=@barangayan/web` and `npm run test:tables:browser --workspace=@barangayan/web`. Browser setup is `npx playwright install firefox webkit`; Chrome must already be installed. Set `PLAYWRIGHT_BROWSERS_PATH` for a custom cache, or `TABLE_TEST_ENGINES=chrome` for one engine. This execution's ignored `dist/admin-table-phase1-browsers` cache is used when present. Its downloaded binaries and the separate `.next-phase1-build` output are retained for repeat checks. Every fixture run closes its browsers and task-owned loopback server in `finally`; no DB, account, container or deployment was created. The fixture deadline is 180 seconds and actions/launches have explicit limits. Browser servers use an automatically assigned loopback-only port.

The phase completion gate is satisfied by the three-engine component fixtures, unit contracts and compatibility fixture. Broader release checks above remain explicitly pending for Phase 6. Phases 2–6 were not started.
