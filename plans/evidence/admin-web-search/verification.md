# Admin web search verification

Verified on October 13, 2026 (Asia/Manila).

The admin enters a query in the navbar, receives live suggestions, opens grouped results, filters or pages through matches, and navigates to the corresponding record. Queries use the administrator's actual session and real Supabase records.

## Delivered behavior

- Debounced suggestions, previews, query highlighting, recent searches, clear controls, outside-click dismissal, and keyboard navigation. Exact/prefix title matches rank ahead of preview-only matches; suggestion reads do not perform exact counts.
- Dedicated `/search` results with category counts, grouped previews, filters, and complete category pagination.
- Requests open the existing request detail route. Other results open a dedicated record page with current details and a link to the management workspace.
- Record pages recheck access and preserve the results query, category, and page for the return link.
- Loading, short queries, empty queries, no matches, partial failures, expired sessions, and retryable errors have explicit feedback. Consistent skeleton rows and a fixed visible status footer keep loading clear. Reduced motion disables these animations.
- Admin theme colors, light/dark styles, reduced-motion support, and compact web layouts.
- All feature code is in `apps/admin-web`. No resident web or mobile changes, schema changes, or hosted database writes were made for this feature.

## Flow evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| Navbar entry → suggestions | Passed | Real database matches; keyboard submission; visible previews |
| Client → authenticated API | Passed | `/api/search`; HTTP success; `Cache-Control: private, no-store` |
| API → Supabase | Passed | All 15 categories return real records from the local database |
| Supabase → organized results | Passed | Category counts, previews, multi-word and literal punctuation searches |
| Results → corresponding content | Passed | All 15 categories open the correct record |
| Filters and pagination | Passed | 13 resident matches across two pages; deep-page clamping; return preserves category/page |
| Error and race recovery | Passed | Delayed old queries cannot replace new ones; navbar/results retries; partial failures remain visible |
| Access restrictions | Passed | Anonymous/resident/archived-admin denial; archived-record exclusion; cross-barangay search and direct-record denial |
| Appearance | Passed | Light, dark, and 820px admin-web layouts inspected |
| Output quality | Passed | Real PostgreSQL prefix ranking/body fallback, stable name/reference ordering, readable previews that preserve email punctuation |
| Input responsiveness | Passed | One debounced request for rapid typing; input paints measured at 8–27ms under 4× CPU throttling; IME waits for committed composition |
| Response validation | Passed | Malformed HTTP-success payloads show retry UI without render errors |

## Checks

- Admin TypeScript check: passed.
- ESLint on changed search code, navbar integration, and search tests: passed, no warnings.
- Search contract tests: 13 passed.
- Production Next.js build: passed.
- Expanded real browser/Supabase end-to-end suite: all 13 check groups passed; no browser runtime errors; fixture cleanup passed. The audit includes 500 additional resident records.

## Measured performance

Five local authenticated requests per mode, with 500 additional resident records:

| Measurement | Observed range |
| --- | --- |
| Suggestion API response | 174–193ms |
| Full results API response | 159–180ms |
| Input event to animation-frame callback under 4× CPU throttling | 8–27ms |

Typing 11 characters produced one debounced search request. Dynamic search links disable automatic destination prefetching; abandoned requests share the request cancellation signal with database reads. Auth network failures produce retry feedback rather than an expired-session message. Category failures are logged by category/error code without queries, tenant IDs, or record contents.

These measurements describe this local run and do not establish hosted production capacity or performance.

Run `npm run test:search --workspace=@barangayan/web` for contract checks. Run `npm run test:search:e2e --workspace=@barangayan/web` with the local Supabase stack running for the production-build browser checks. The latter creates isolated test tenants/accounts and removes them afterwards; it refuses hosted database URLs. The application under test receives only the public key and session cookies.

## Saved evidence

- [End-to-end results](results.json)
- [Production build](build.txt)
- [Server output](server.txt)
- [Navbar suggestions](navbar-suggestions.png)
- [Grouped results](grouped-results.png)
- [Dark results](dark-results.png)
- [Compact admin search](compact-admin-search.png)
- [Suggestions during delayed loading](suggestions-loading.png)
- [Results during delayed loading](results-loading.png)

Verification used synthetic records in the actual local Supabase stack. HTTP delays/failures were injected only for recovery checks. Hosted deployment and hosted data were not tested or changed.
