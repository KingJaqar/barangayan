# Phase 4 — Directory, Households and Staff

Completed 2026-10-12, Asia/Manila. [final-verification.json](./final-verification.json) records this three-route integration gate. Phases 5–6 and production release remain unstarted.

The routes use the existing authoritative adapters, complete independent summaries and shared controls. Name ascending/All remain defaults, with 24 supported fields, five page sizes and at most 100 main rows. Directory/member modification fields, complete resident action options, stable detail reads by ID, native dialogs, focus restoration, draft settlement and coalesced refresh are integrated. JSON household counts retain their meaning independently of normalized members. Member cleanup and staff self-protection remain intact. No migration or dependency was added.

Short windows exposed a shared 48px viewport that could hide every row beneath the sticky header. The viewport now measures a compact header/row/scrollbar budget; short tables still use only their content height and outer controls remain in page flow. Long detail titles wrap in a bounded scrollable header. The shared component changes preserve unbounded/dashboard callers.

| Evidence | Executed result |
| --- | --- |
| `acceptance-browsing-partial.json`, first five completed groups | Chrome defaults/sizes/ranges, keyboard, scrolling/resizing and narrow layout; all 48 sort/direction combinations; complete unchanged page concatenations on three 1,500+ row routes, beyond-cap search and empty results |
| `acceptance-remaining.json` | Combined filters, independent exact summaries, delayed navigation/history, single correction, separate table/summary/options failures and query-preserving retries |
| `acceptance-actions.json` | Failed-draft retention/navigation block/retry/audit; stable Directory details off-page/deletion/focus; member creation/removal/check-in cleanup and complete options; staff self guards, profile/role changes and removal |
| `acceptance-matrix.json`, `final-flows.json` | Firefox/WebKit integrated browsing; Chrome/Firefox/WebKit long-title containment and mouse/keyboard focus; JSON count 2 versus normalized count 1 |
| `route-permissions.json` | 12 cases: anon, resident, removed administrator and foreign administrator on three routes |
| `detail-realtime-attempt2.json`, two completed groups only | Three actual events, zero refreshes during draft and one after cancel; selected member updates independently off-page, failed reload retry and confirmed deletion |
| `detail-realtime-attempt3.json`, two completed groups only | Ten mount cycles retain one household channel and baseline observers; 30 warm timing samples |
| `detail-realtime.json` | Real ID verification/revocation RPC, request history and audits. Signing/images are synthetic |
| `final-flows-attempt1.json`, first completed group only | Actual 23-row last-page deletions clamp page 3 to 2 without a loop; seven rows at size 100 |
| `browser-results.json` | Final 33 shared fixture groups pass across Chrome, Firefox and WebKit, including short heights/zoom equivalents, containment, sticky alignment, keyboard access, races, cleanup and dashboard compatibility |
| `unit-tests-complete.log`, `lint-complete.log`, `typecheck-complete.log`, `build-complete.log` | 65 tests, full admin lint, typecheck and webpack production build pass |
| `scope.json`, `runtime-cleanup.json`, `preview-cleanup.json` | Source/snapshot linkage, unchanged migrations/later routes, preserved unrelated work and removal of owned services/private credentials |

Chrome 154.0.8037.99, Firefox 153.0 and WebKit 26.5 were used. Local warm p95: Directory **642.58ms**, Households **774.37ms**, Staff **610.58ms**. Ten samples per route, approximately 1,500 rows, loopback/unthrottled development preview, database/REST two CPUs each. These are measured fixture results, not universal production latency.

The fixture copied schema and infrastructure migration metadata only from the inspected local stack at 0109, with zero source accounts. Migrations 0110–0112 ran only in the owned fixture. Fresh Auth accounts, two tenants and a 1,000-row REST cap provided the authenticated acceptance environment. Source/hosted data was never written.

Failed attempts remain failed. Completed positive groups from partial reports are identified above. Product corrections were the initial detail-state null access, short-window row obstruction and long-title clipping. Test corrections concern hydration, split names, empty results, column indices, structured display names, asynchronous audit persistence and observer registration. The existing add-member RPC synchronized the baseline fixture's inconsistent JSON/normalized rows and removed its old fixture-only member; a dedicated member was used for Realtime. The RPC and sync functions were not changed.

No implementation blocker remains. Migrations 0110–0112 must precede release. Hosted acceptance/advisors, provider invitation delivery, real storage delivery, native Safari/Edge, physical inputs/OS settings, native zoom, manual screen readers, other networks and 100k deep pages remain Phase 6 verification. No production-readiness claim is made.

For reproduction, start `runtime-stack.mjs start`, then `runtime-serve.mjs` and wait for its proxy before `runtime-seed.mjs`. Run `acceptance.mjs --smoke`, `--matrix`, permissions, then `--actions`, `detail-realtime.mjs`, `final-flows.mjs` and `shared-browser.mjs` against that fixture. The preview has a 45-minute lifetime; finish by verifying/stopping its owned processes and running `runtime-stack.mjs cleanup`. Scripts refuse conflicting task identities. Existing local schema/cached images and browsers are required; no implicit production target is used. Final static checks run in the admin workspace. Ignored preview/build/browser artifacts remain for repeat checks; private credentials and owned runtime resources are removed.
