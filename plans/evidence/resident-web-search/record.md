# Resident web search verification

Verified on 2026-10-13 (Asia/Manila). Scope: resident web only.

The home search now offers live, debounced suggestions and opens `/search`. Results use the existing application tables for documents/services, announcements, medical drives, help articles, the caller's requests, and the caller's reports. The dedicated page groups results, highlights matching terms, supports category filters and pagination, and opens the corresponding content. New web detail routes provide direct announcement and medical-drive destinations. Queries support multiple words in any order and matching content bodies, service names, and request references.

Quality follow-up: title matches now precede body-only matches across the entire dataset before pagination, with disjoint bounded reads rather than downloading a catalog into the browser. Mixed service-name/reference searches work for personal requests. Previews keep relevant terms visible even when their word order differs. Fees and processing guidance use the same shared label helpers as the document detail page, including per-page pricing and assessed fees. Search category icons match the resident navbar and its stroke weight.

Loading uses the existing delayed spinner and pulse primitives, shaped suggestion/result placeholders, and short opacity/position entrances with reduced-motion support. A same-query refresh retains loaded results. Failures and malformed responses show retryable notices, keeping prior results with an explicit stale-data message. The suggestion menu fits the available viewport, contains its own scroll, scrolls keyboard selection into view, and closes on outside pointer interaction. IME composition is not sent prematurely. Re-entering an earlier query starts a fresh request instead of committing an old result. Obsolete requests are cancelled and their responses ignored.

The API uses the existing public-key server client with verified session cookies, preserving RLS. Signed-in searches explicitly filter by the profile's barangay and personal searches additionally filter by the caller's ID. Guests never query requests or reports. Missing authenticated profile scope fails closed. Deleted/inactive content is excluded. Responses are private and uncached. Search text is bounded and filter values are quoted; literal wildcard and filter-injection cases were checked against local PostgREST. No database migration was needed.

Verification passed:

- Production Next.js build, including TypeScript validation: [build.txt](build.txt).
- Targeted lint of all added/modified search code and test files.
- All 65 resident-web unit tests (13 search contract/result tests, 4 search API boundary tests, and 48 existing authentication/settings tests).
- All 26 browser/API checks with real Supabase Auth sessions and real local database reads: [results.json](results.json).
- Browser page errors: zero. Temporary fixture cleanup: passed.
- Visual inspection at 1440px and 390px, including dark mode. The home menu's layering was corrected and checked with browser hit testing; preview/link contrast was checked in dark mode.

The browser checks cover home query entry, suggestions, Enter, all six result destinations, multi-word and body searches, literal punctuation, request-reference lookup, tenant/owner isolation, spoofed scope parameters, unavailable unauthorized detail pages, pagination/reload/back navigation, empty/no-result states, keyboard selection, error/retry, stale response protection, clearing, responsive layouts, and guest access. See [results.json](results.json) for the individual checks.

The quality checks additionally cover cross-page relevance with 46 title/body fixtures and no duplicated or missing rows, out-of-range/invalid page recovery without PostgREST errors, animated loading during delayed transport, refresh retention, partial failure recovery, malformed-response recovery, rapid typing with one debounced request, IME composition, reduced motion, and fourfold CPU slowdown.

Local performance results, using 3,000 additional unmatched articles: 12 real suggestion requests in two batches of six concurrent requests; median 252 ms, p95/max 314 ms, and no failed categories. During rapid typing under fourfold CPU slowdown, the longest recorded input event took 40 ms (below the 200 ms responsiveness check). These are local measurements; hosted production latency and larger production workloads were not measured.

Screenshots: [home suggestions](suggestions-desktop.png), [desktop results](results-desktop.png), [narrow web results](results-narrow-web.png), [narrow web suggestions](suggestions-narrow-web.png), [dark mode](results-dark.png), [result loading](results-loading.png), [suggestion loading](suggestions-loading.png).

Reproduce unit checks from `apps/resident-web` with `npx vitest run`. Run the complete browser verification from the repository root with `node apps/resident-web/tests/search-e2e.mjs`, with the local Supabase Docker stack and either Playwright Chromium or installed Chrome available. The script builds a separate output directory, creates random fixture tenants/accounts, and removes its fixtures in `finally`. It refuses hosted database URLs and does not pass an elevated database key to resident web.

Verification used synthetic local records; hosted data and payment providers were untouched. HTTP delays/failures were injected only for recovery and race checks. Next.js printed destination-stream early-close notices during interrupted navigation; there were no browser page errors. Next.js streamed unavailable pages may send HTTP 200 before `notFound()` resolves, so unauthorized direct-link checks assert rendered 404 content and the absence of protected content.

Existing unrelated working-tree changes were preserved. The only change to the pre-existing home stylesheet is the dashboard hero's stacking order so suggestions remain above the action cards. Temporary build-directory additions to `tsconfig.json` were removed.
