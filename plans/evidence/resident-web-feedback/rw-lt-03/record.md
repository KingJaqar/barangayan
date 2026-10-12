# RW-LT-03 — Navigation, boundaries, and read-state pilot

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local"); no credentials, tokens, OTPs, or real resident records in this folder (scanned: no JWT, generated-password, or secret-key strings).

## 1. Preconditions and inputs

- RW-LT-02 is complete ([record](../rw-lt-02/record.md)). I re-read the repository `AGENTS.md` and `apps/resident-web/AGENTS.md` (Android Phase 8 stays cancelled and untouched; sequential migrations), the full plan, and the Expo v57 reference (SDK 57 / RN 0.86 / React 19.2.3; nothing in it applies to the Next.js resident web).
- I read the installed Next.js 16.3.0 guides: `loading.md`, `error.md`, and `use-link-status.md`. I also checked the installed `ErrorBoundaryHandler` source, which confirms that `retry()` runs `startTransition(() => { router.refresh(); reset(); })`.
- **Contracts applied:**
  - `loading.js` does not cover runtime data read in its own segment's layout, so the root fallback covers the session reads in the group layouts.
  - `error.js` does not wrap its own segment's layout, so `app/error.tsx` covers failures in the group layouts.
  - `useLinkStatus` must be a descendant of `<Link>`. Its hint must be fixed-size and always rendered, and prefetched routes skip it.
- **Working tree:** unrelated admin-web, Android, migration, and other-plan changes were left untouched. There is no backend change, migration, admin-web/Android/iOS edit, or new dependency, and no backend exception was needed.

## 2. Changes (apps/resident-web/src)

| File | Change |
|---|---|
| `app/loading.tsx` (new) | Neutral root fallback for waits in the (resident)/(auth) layouts. It shows no shell, header, or account shapes. "Loading Barangayan…" appears after 120 ms. |
| `app/error.tsx`, `app/(resident)/error.tsx`, `app/(auth)/error.tsx` (new) + `components/shared/route-error.tsx` (new) | Inline recovery views. The root view is neutral and links to Home. The resident view sits inside the shell, so the nav stays usable, and links to Home. The auth view has no resident shell and links to Log In. `RouteError` shows `role=alert` copy and calls `retry()` inside `useTransition`, so the button reads "Trying again…" and stays disabled until the refresh settles, giving one refresh per activation. It shows the digest as a reference and never shows the raw error message. Retry refreshes the route only. It never replays a write. |
| `app/(resident)/loading.tsx`, `app/(auth)/loading.tsx` (new) | The resident group fallback is a list placeholder inside the persistent shell. The auth fallback is a centered form card. |
| `app/(resident)/{home,maps,maps/directory,maps/preparedness,settings,emergency,health,services}/loading.tsx` (new) | Route-specific placeholders using the `PageSkeleton` home, map, list, and settings compositions. The map viewport stays steady (no pulse). Segment fallbacks render below their segment nav or the settings sidebar. |
| `components/shell/link-pending-hint.tsx` (new) + `app/globals.css` | `LinkPendingHint`: an always-rendered, absolutely positioned, aria-hidden `useLinkStatus` bar. CSS `rw-link-hint` reveals it after 120 ms and pulses it; under reduced motion it is static. |
| `top-nav.tsx`, `bottom-tab-bar.tsx`, `emergency/health/services-segment-nav.tsx`, `settings/settings-sidebar.tsx`, `services/requests/page.tsx` (tabs) | Hint added inside the existing links (`relative` added where needed). Hrefs, active styles, names, prefetching, and modifier clicks are unchanged. |
| `hooks/use-announcements.ts` (pilot list) | Results and failures are keyed by the barangay/category identity. A generation guard drops obsolete responses (fixes D-08 for this hook) and thrown rejections are handled. Adds `isInitialLoading`, `isRefreshing`, and `isReady`. `isLoading`, `error`, and `announcements` keep their meaning for `alerts-content.tsx`. The query and Realtime subscription are unchanged. |
| `announcements/announcements-feed.tsx` (pilot list) | A skeleton shows only until the first result for the current filter. A refresh keeps the loaded list (fixes D-06 here) and shows a quiet "Updating" hint after 120 ms. A failed refresh keeps the list and adds a polite stale-data warning with Try again. An initial failure shows a plain-language alert instead of the raw message. Card entrances play only for the first result's cards, never on refresh. |
| `services/requests/request-drawer.tsx` (pilot drawer) | Explicit loading / ready / unavailable / error states (fixes D-03 for this drawer). "Unavailable" covers PGRST116 or no row: missing, deleted, RLS-hidden, or signed out, with no access details shown. "Error" covers a returned or thrown failure and offers a read-only Try again. Reads are keyed by request id, so switching cards never flashes or restores the previous record. Reopening starts a fresh read. |
| `components/ui/sonner.tsx` + `components/shell/resident-shell.tsx` | **Regression fix found by the RW-LT-02 rerun.** On a hard load, the root fallback renders before the shell, so the host's per-pathname anchor lookup missed the header and toasts sat at 16 px instead of below it. The header now registers itself through a stable React 19 ref callback (`toastAnchorRef`, with cleanup), and the pathname effect is removed. |
| Removed during the phase | `reports/[incidentId]/loading.tsx` and `services/requests/[requestId]/loading.tsx`. No in-app link reaches the first. For the second, the services segment boundary is always the deepest prefetched one for in-app navigation, so the detail placeholder could not be reached or verified. |

`scripts/resident-web-feedback-regression.cjs` adds:

- `rw-lt-03:build` and `rw-lt-03:verify <run>`. Verify delays only the browser's non-prefetch RSC navigation request.
- `mockRealtime`, an in-browser Realtime protocol 2.0.0 stand-in, because local Realtime is down.
- A defect Status column in `coverage.md`.

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint | **Pass**: 0 errors; the same 2 inherited warnings (location-verification files) | [checks/lint.txt](checks/lint.txt) |
| Production build (required at RW-LT-03) | **Pass** (exit 0) on the final source; tsconfig restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-03:verify run-2`: 15 scenarios, 75 checks, production build, Chrome (primary) | **15 pass, 0 fail, 0 error** | [run-2/results.json](run-2/results.json), [screens](run-2/screens/) |
| `rw-lt-03:verify run-1` (same build, earlier run) | 15/15 pass. Its drawer screenshots were taken mid-entrance, so run-2 adds a 350 ms wait before them | [run-1/results.json](run-1/results.json) |
| RW-LT-02 rerun (host/shell changed) | **10/10 pass** after the anchor fix. The first rerun failed the 3 header-clearance scenarios (toast top 16 px, header bottom 58 px); that failure led to the fix above, and the failing rerun was deleted | [../rw-lt-02/rerun-after-rw-lt-03/results.json](../rw-lt-02/rerun-after-rw-lt-03/results.json) |
| RW-LT-02 adapter unit rules | **8/8 pass**. This rewrote `rw-lt-02/unit-results.json` with the same results and a new timestamp | [../rw-lt-02/unit-results.json](../rw-lt-02/unit-results.json) |
| RW-LT-01 primitives rerun (pilots changed) | **13/13 pass** | [../rw-lt-01/rerun-after-rw-lt-03/results.json](../rw-lt-01/rerun-after-rw-lt-03/results.json) |
| RW-LT-00 baseline journeys rerun | **20/20 executed, 0 errors.** Compared with the RW-LT-02 rerun (below) | [baseline-regression/results.json](baseline-regression/results.json), [comparison.json](baseline-regression/comparison.json) |
| Inventory reconciliation | **Pass.** 11 loading boundaries, 3 error boundaries, 128 client modules, 22 Sonner importers (unchanged), every entry assigned | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

### Scenario results (run-2)

| Scenario | Observed |
|---|---|
| nav-fallback-resident-group | With a 1.5 s server response, the URL commits at once, inside the 250 ms check. "Loading page…" appears in one `role=status` region. No decoration shows before 120 ms, and the placeholder is visible while slow. There is always exactly 1 header and 1 main. It settles to "My Reports" with no status or busy region, and makes 0 writes |
| nav-route-specific-variants | Each navigation shows exactly one placeholder: "Loading map…" with a static viewport skeleton; "Loading services…" (home → request detail, and documents → requests) under the services nav; "Loading emergency information…" and "Loading health services…" under their segment navs; "Loading settings…" with the sidebar visible; "Loading directory…"; and "Loading page…" for announcements. Next uses the deepest prefetched boundary, so no generic → specific double flash was observed |
| nav-fast-no-flash | Unshaped navigation responses took 172–229 ms. Content rendered 62–136 ms after the response arrived (no minimum loader time). No decoration showed in the first 100 ms. On these ~300 ms navigations, the placeholder decoration correctly appears after the 120 ms delay. A cached back navigation renders content in 16 ms with no RSC fetch and no loader |
| link-hint-blocking-navigation | `?tab=` links block (no boundary applies to search-param changes). The current page and tabs stay; the hint is pending, invisible before 120 ms, and visible after. It is aria-hidden, and the link name and size are unchanged (< 0.5 px). It clears on arrival. Top-nav hints never became visible, because those routes commit to a prefetched fallback |
| rapid-link-selection | Reports, then Health 200 ms later, both slow: the final page is /health and "My Reports" never renders. Back goes to /reports |
| back-forward-reload-deeplink | Back, back, and forward restore the correct pages. A hard reload renders inside the shell. The `/settings/theme` deep link renders both the sidebar and the content |
| modifier-click-and-prefetch | 29 prefetch requests on /home. Ctrl+click opens /reports in a new tab; the current page stays on /home with no hint or status. Nav hrefs are unchanged |
| guest-fallback-and-redirects | The guest sees "Loading page…" inside the guest header (Log In/Sign Up, no logout, no bottom bar). A hard load of /services/requests still ends at `/login?next=%2Fservices%2Frequests` with no protected content |
| auth-fallback-and-signed-in-redirect | The auth fallback ("Loading…", centered card) renders with no resident header. A signed-in visit to /login still lands on /home |
| inaccessible-record-not-found | Another resident's request and incident still show the 404 view, with `noindex` and no leaked content |
| error-boundary-resident-retry | A malformed row throws during render. The recovery view appears inside the shell, with the nav visible, no toast, and no raw error text. A retry while the failure persists produces 1 refresh and 1 re-read, then shows the view again with no loop. Recovery: "Trying again…" is disabled and busy; a second activation is ignored (1 refresh, 0 writes); content returns |
| error-boundary-auth-retry | A malformed locality response throws during render on /register. The auth recovery view appears without the resident shell and with "Go to Log In". Retry re-renders the form with 0 submissions |
| drawer-read-states | **Slow read:** "Loading request…" and aria-busy, then the record. **Returned 500:** settles to the "We couldn't load this request" alert with no skeleton, status, or raw text. Retry makes 1 GET and 0 writes, recovers, and shows no toast. **PGRST116:** "This request isn't available", with no retry and no access details; Close works and the list stays. **Stale selection:** REQ-…34 delayed 2 s, then REQ-…35 is selected; …34 never appears. **Close and reopen:** closing during a load, then reopening, shows a fresh record. **Aborted request:** settles to the retryable error. 0 writes throughout |
| list-read-states | **Empty response:** empty state. **Initial 500:** plain alert, no toast; retry recovers. **Filter change:** the previous filter's rows disappear and the loader shows. **Obsolete response:** the slower General response never replaces the Emergency results. **Realtime event (stand-in):** exactly one feed refetch. The same mounted cards stay, with no skeleton, status, or entrance replay. The "Updating" hint appears only after 120 ms and then clears. No toast. **Refresh failure:** the list is kept, a `role=status` stale-data warning shows, and Try again clears it |
| reduced-motion-and-360 | The pending hint is visible but static (0 infinite animations). At 360 px, the bottom-bar navigation shows a static "Loading page…" fallback, keeps the bottom bar, has no horizontal overflow, and completes |

### Baseline comparison (RW-LT-02 rerun → after RW-LT-03)

- **Routes:** every guest and resident sweep route has the same final path, status, and h1.
- **Defect flags:** every `reproduced` flag is identical. D-03's RW-LT-00 probe was already `false` (it looks for `.animate-pulse`); the RW-LT-03 drawer scenario is the evidence that D-03 is fixed for the request drawer. D-01, D-02, D-07, D-08 (drive dates), D-12, and D-14 still reproduce, as their owning phases expect.
- **Requests:** data request counts are identical except the resident sweep's first `/home` visit (REST 6 → 7). A repeated probe shows a steady-state `/home` makes 3 distinct REST reads with no duplicates. The extra read falls in the post-login measurement window (a one-time profile read seen only on the first visit), so it is not attributable to this phase. These changes add no loading-related data request.
- **Inaccessible records:** these now return document status **200** with the not-found view and `noindex`, instead of **404**.

## 4. Behavior change recorded: streamed hard loads

Adding route fallbacks above the group layouts makes Next stream hard loads: the shell and fallback flush first. As the Next 16.3 `loading.md` "Status Codes" section documents, `redirect()` and `notFound()` that run after streaming has started are delivered in the stream:

- The guest redirect to `/login?next=…` and the signed-in `/login` → `/home` redirect now arrive as a 200 document followed by a client redirect, not a 307.
- Another resident's request or incident shows the 404 view with `noindex` under a 200 document.

Destinations, `next=` handling, authorization, and RLS are unchanged, and no protected content is rendered before the redirect (verified in scenarios 8–10). If raw HTTP 307/404 statuses are required for compliance or analytics, Next's documented option is a proxy-level check. That would change auth routing infrastructure, which this phase must not do, so it is left as a decision for the owner.

## 5. Exit gate

| Criterion | Result |
|---|---|
| Persistent navigation remains usable | **Met.** The shell, segment navs, and settings sidebar stay visible and clickable during fallbacks; rapid selection works; the bottom bar works at 360 px |
| Fast routes are not artificially delayed | **Met.** Content renders 62–136 ms after the response; a cached back navigation takes 16 ms with no loader; decoration never shows before 120 ms |
| Valid content remains during same-identity refresh | **Met** for the pilot list (Realtime refresh keeps the mounted cards; a refresh failure keeps the list with a warning) |
| Record changes never flash another identity's data | **Met.** Drawer stale-selection and announcement filter/obsolete-response checks pass |
| Boundary Retry recovers reads without resubmitting writes | **Met.** Resident and auth boundaries: 1 refresh per activation, 0 writes, recovery confirmed |
| No whole-shell keying, global progress controller, or changed query/subscription contract | **Met.** No keys on the shell; no global controller; the announcements query, Realtime channel, and drawer select are unchanged (only local bookkeeping changed) |
| Deliverables | **Met.** Route fallbacks and error recovery, navigation hints, and the local-read pattern (identity-keyed result, generation guard, `isInitialLoading`/`isRefreshing`/`isReady`, retained refresh content, refresh warning, unavailable vs error with read-only retry) are ready for reuse in RW-LT-04…08 |

Phase status: **Complete**. Every RW-LT-03 task, deliverable, required verification, and exit-gate criterion is met, subject to the limits in section 6.

## 6. Not verified / carried forward

- **Realtime.** Local Realtime is still unavailable (WebSocket 503). The refresh scenarios use an in-browser protocol 2.0.0 stand-in that delivers real `postgres_changes` frames to the unmodified supabase-js client. A live Realtime server was not exercised.
- **Streamed hard-load fallbacks.** The local server renders too quickly to observe the root and group fallbacks on a hard load. Hard loads were verified for correct final content, redirects, and not-found behavior. Client-navigation fallbacks were verified deterministically.
- **Unconsumed variants.** The `detail` and `form` `PageSkeleton` variants still have no consumer; their geometry belongs to RW-LT-06/07 in-page boundaries. `PendingHint` now has a runtime consumer (the feed's "Updating" hint).
- **Screen reader and browsers.** No manual screen-reader pass was done. The announcements were checked at DOM level: one `role=status` per loading region, `role=alert` on errors, an aria-hidden hint. Only Chrome (Playwright, headless) was used. Firefox, Safari/iOS web, and 200% zoom are pending for RW-LT-09.
- **Retained defects (owned elsewhere).** The `top-nav` and segment pills still use a spring with a 0.25 bounce (existing motion, not in this phase's tasks). D-03 for the incident and register drawers (RW-LT-07), the false-empty request list D-07 (RW-LT-06), and the other hooks named in D-06/D-08 remain open.
- **Production readiness** is not claimed. Broader qualification remains pending under RW-LT-09, and nothing was deployed.
