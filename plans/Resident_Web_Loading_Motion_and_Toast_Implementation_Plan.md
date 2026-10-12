# Resident Web Loading, Motion, and Toast Implementation Plan

Revised: 2026-10-08 (Asia/Manila)

Status: RW-LT-00 through RW-LT-06 complete (2026-10-12); RW-LT-07 onward not started. Evidence index: plans/evidence/resident-web-feedback/README.md.

## 1. Outcome, scope, and implementation boundaries

Deliver clean, lightweight, expressive loading feedback and logical toast notifications across the entire resident web experience. Production readiness means accurate state, working recovery, accessible interactions, stable layouts, and verified existing workflows—not merely attractive animations.

This plan replaces the earlier conversational resident-web proposal. It does not replace the separate admin loading plan or authorize the permanently cancelled Android usability phase.

### Accepted product decisions

- Cover public pages, authentication, onboarding, and every signed-in resident feature.
- Include loading animations, short content reveals, and consistent transitions in existing dialogs and drawers.
- Keep compact top-center toasts.
- Notify direct user actions and confirmed critical outcomes. Ordinary refreshes, incoming announcements, and unread-count changes remain quiet.
- Allow small frontend correctness fixes when necessary for truthful feedback.

### Frontend-first boundary

The default change set is resident-web components, styles, layouts, local hooks, frontend helpers, and focused verification scripts/documentation. A client-side hook calling Supabase remains frontend code; changing its local pending/error bookkeeping does not authorize changing its queries or backend contracts.

Preserve authentication routing, authorization, query filters and payloads, existing business validation, fees, payment settlement/cancellation protections, polling intervals, subscriptions, and confirmed receipt checks. Reuse existing dependencies. Do not introduce a query framework, global request interceptor, global loading counter, offline write queue, optimistic mutation layer, or new telemetry service.

Backend changes are exceptions, not a planned phase. Make one only if a reproducible defect prevents the scoped UI from reporting or completing an existing operation correctly, and no frontend correction can resolve it. Document the reproduction, why frontend handling is insufficient, the smallest contract change, compatibility impact, and backend regression test before making that change. Do not redesign APIs or add backend features for animation convenience. If a migration is genuinely necessary, inspect the current highest prefix and follow the repository's sequential four-digit naming rule; never assume 0095 is still available.

Keep admin web, Android, iOS, unrelated shared code, and existing working-tree changes untouched. No production deployment is part of this implementation request.

## 2. Verified baseline and shared presentation system

The inspected resident web contains 48 page entrypoints and uses Next.js 16.3.0, React 19.2.8, Tailwind 4, Framer Motion, and Sonner. It already has a root toast host, a shared loading button, FadeIn, individual skeletons, and browser data hooks. At inspection, there were no route loading boundaries. Re-inventory before implementation because other resident work may be in progress.

Confirmed integration issues include unconditional household success toasts in the profile editor, a family dialog that does not await its save callback, and drawers that can leave missing/error results looking like indefinite loading. Existing payment receipts already query confirmed paid records, and the payment hook already protects cancellation against polling/Realtime races. Preserve and test these protections.

### Components and local interfaces

| Addition/change | Contract |
|---|---|
| Spinner | Decorative, fixed-size indicator; inherits current color |
| Skeleton | Theme-aware shape; optional soft pulse; hidden from assistive technology |
| PageSkeleton | Home, list, form, detail, settings, and map compositions using actual destination geometry |
| LoadingStatus | Concise operation label and one polite loading announcement per region |
| PendingHint | Observes existing pending state; delays only decorative visibility |
| Existing Button | Add optional loadingLabel; preserve loading, variants, button type, and Radix asChild behavior |
| Existing FadeIn | Shared timing, bounded movement/stagger, reduced-motion handling |
| notify adapter | Thin Sonner wrapper with success/error/warning/info, optional description, and operation/event ID |

Keep skeletons and simple reveals compatible with server rendering. Add client boundaries only where existing interaction/state requires them. The real-button loading branch must not inject multiple children into an asChild Slot. Icon controls retain a stable accessible name and fixed dimensions. Text buttons reserve the larger normal/pending label width without exposing two accessible labels.

### Motion defaults

| Element | Default |
|---|---|
| Inline decorative pending hint | 120 ms reveal delay |
| Spinner | 800 ms rotation |
| Skeleton | Low-contrast 1.6-second opacity pulse |
| Content arrival | 200 ms fade; up to 6 px vertical movement |
| Initial card entrance | 30 ms stagger for at most the first six visible cards; 150 ms maximum delay |
| Drawer | 240 ms entrance; 180 ms exit; no bounce |
| Dialog | 180 ms entrance; 140 ms exit |
| Toast | Existing Sonner motion; do not wrap it in a second animation system |

Pending labels, disabled state, and aria-busy update immediately. The 120 ms delay affects visual decoration only. No minimum loading duration, fake percentage, timed success, or delay before real content renders.

Prefer CSS for skeletons, spinners, and simple entrances. Use existing Framer Motion for current motion components. Animate opacity/transforms rather than height, width, large blur, or expensive shadows. Use one reveal per content region; avoid stacked parent/child reveals. Do not replay entrances on typing, polling, focus refresh, theme changes, or routine Realtime updates. Maps, payment QR codes, camera previews, and urgent emergency information remain steady.

Respect prefers-reduced-motion in both CSS and existing Framer Motion components: static skeletons and pending symbols, no movement/stagger, and instant programmatic navigation scrolling. Hidden tabs must not accumulate notifications or replay entrances when focus returns.

### Navigation and boundaries

- Add a neutral root loading fallback for nested layout waits, without guessing account identity or authentication state.
- Add resident/auth group fallbacks and route-specific variants where generic shapes would be misleading. Do not duplicate persistent shell padding/header/navigation.
- Keep layouts, active tabs, and existing content interactive where Next.js permits. Preserve prefetching and modifier clicks.
- Use the installed Next.js useLinkStatus API for fixed-size descendant hints inside existing links. Its pending state is pre-history feedback, not a global completion signal.
- Fast/prefetched navigation may show no loader. Back/forward navigation must work without click tracking.
- Do not key the entire shell, force form remounts, add page-exit orchestration, or delay navigation for animation.
- Add a resident segment error boundary and an auth segment error boundary for unexpected render/server failures. Render a concise inline recovery view using Next.js 16.3's stable retry() boundary callback to re-fetch/re-render; never replay a mutation. Use reset() only for a render-only recovery that intentionally does not refetch. Preserve existing auth error routing and redirects.

## 3. Operational correctness and real-world recovery

### Reads: initial, ready, empty, refreshing, and error

Use explicit readiness for the current account/entity/filter identity; an empty array or null value alone is not proof of loading.

- Initial request: show matching placeholders and a meaningful label.
- Successful empty response: show the current empty-state explanation, never a perpetual loader.
- Background refresh: retain the last valid same-identity result, including an empty result, with a subtle local Updating indicator.
- Initial failure: replace the loader with an inline error and deliberate Retry for the same read.
- Refresh failure: retain content with a local warning and retry affordance. Do not claim stale data is current.
- Account/tenant/entity/filter change: reset readiness for that identity; do not display another identity's retained data.
- Missing, deleted, or inaccessible record: show an unavailable state and a safe return link; do not claim it exists or distinguish sensitive access details.

Use existing request-scoping helpers where present. Add local generation/active guards only where absent or insufficient. Obsolete responses must not replace a newer selection or current account. Preserve existing hook fields; add isInitialLoading/isRefreshing where genuinely needed instead of changing isLoading semantics silently. Do not build a generalized fetch framework.

Handle both returned errors and thrown failures; clean up display timers/listeners on unmount. At 10 seconds of continuous foreground pending, show Taking longer than usual while retaining the actual operation state. Elapsed time alone must not label a request failed, expired, or cancelled. Quiet background refreshes do not need this message.

### Mutations: confirmed success, confirmed failure, uncertain outcome

- Tie pending to the actual awaited promise. Use try/catch/finally where appropriate and a synchronous local guard for repeated activation of the same action.
- Preserve validated input and selected files after failure when the existing form can retain them. Do not disable unrelated navigation or fields globally.
- Success requires the existing operation's success result—not merely a resolved promise or missing exception. Follow existing return contracts rather than adding server confirmation calls everywhere.
- Confirmed failure restores controls and gives the resident a useful next step.
- If a submission may have reached the server but its response was lost, say completion could not be confirmed. Do not call it a definite failure or automatically retry it. Provide the relevant existing request/report/registration view to check before another submission. For actions without a tracking screen, instruct the resident to review the affected record before repeating the action.
- Do not add automatic retries, resubmission, optimistic success, or invented Undo for payments, reports, registrations, deletion, or uploads.
- Closing a dialog or changing route does not cancel a server operation. Preserve existing dismissal rules; suppress stale local state updates while allowing a confirmed user-action outcome to notify the still-active account. Suppress outcomes belonging to a previous account/session.
- Component unmount is not a reason to dispose of uploaded files or reverse backend work. Preserve the existing upload workflow and cleanup policy.

### Concrete fixes required by this UI work

1. Profile household handlers must check nullable member/boolean results before reporting success or closing the editor.
2. FamilyMemberDialog save/delete callbacks return Promise<boolean>, where true means the existing write succeeded. Await the callback, keep inputs/dialog open on false or rejection, and keep submitting active until completion; update both existing consumers together. The consuming screen owns the single terminal notification.
3. Request, incident, and registration drawers get explicit loading, unavailable, and failure rendering where their current contract conflates null with pending. Selection changes must not flash the old record.
4. Authentication handlers release pending state on unexpected failures; preserve current redirect destinations and Google sign-in behavior. Starting OAuth is not signing in successfully.
5. Logout gets pending and returned-error handling. Apply existing preference reset and navigation only following a successful sign-out; do not change sign-out scope or session policy.
6. QR camera and upload flows produce one full-success or partial-success outcome, with working camera/location permission fallback guidance.
7. Clipboard/export messages describe the browser-confirmed result. Receipt loading/retry must settle correctly on returned and thrown failures without replaying payment creation.
8. Audit remaining async controls against the same rules; repair only defects that directly undermine scoped feedback or an existing interaction.

### Payment-specific invariants

Preserve fee calculation, request creation, QR generation/resume behavior, polling intervals, cancellation race guards, redirect timing, and receipt ownership/paid-status checks.

Toast a paid transition only from the existing confirmed payment status. Use the actual payment attempt ID and terminal state to deduplicate polling/Realtime observations. Do not toast a historical paid record merely because a receipt was revisited. A countdown reaching zero is a display condition, not evidence that money was not received. Cancellation that loses the race to payment must follow the paid outcome and must not announce successful cancellation.

Retrying a receipt reloads the receipt only. Slow connectivity must never automatically create another payment attempt or charge. Payment-specific errors remain persistent in the payment view even after a toast disappears.

### Connectivity and browser capabilities

Respect actual request results; navigator.onLine is only a browser hint and must not decide financial outcomes. Display local connection/recovery guidance where failures occur. Do not add offline caching or queued writes. Restore current read state through existing refetch/focus mechanisms; do not automatically repeat writes on reconnection.

Cover unavailable/denied geolocation, camera failure, malformed QR images, clipboard rejection, popup blocking, expired sessions, slow uploads, and tab background/foreground changes. A permission error must explain the existing manual alternative where one exists.

## 4. Toast policy and accessibility

### Host and visual defaults

Use one root Sonner host, top-center, themed to the application's active light/dark mode and font. Maximum width 400 px; 16 px horizontal gutters; up to three visible toasts. Use an icon, short title, optional useful description, and a keyboard/touch-accessible dismiss control. Semantic status colors remain readable with custom accents.

On resident pages, position below the actual header with a 12 px gap; on auth pages, use a 16 px top offset. Account for safe-area insets and responsive header size without a hardcoded desktop height. Keep above drawers without a full-screen pointer-intercepting container. Verify notifications remain usable and announced with Radix dialogs open.

Success/info duration: 4 seconds; warning: 6 seconds; error: 8 seconds. Pause dismissal during hover/focus and while the page is hidden, using existing Sonner support and minimal frontend handling if needed. Toasts do not steal focus. Critical recovery instructions must also remain in the relevant page.

### Ownership and deduplication

The screen/action owns notifications; hooks return data/results/errors. The local notify adapter owns defaults and deduplication, not async work or backend state. Only that adapter and the host import Sonner directly after migration.

Generate distinct IDs for deliberate user attempts; suppress repeated callbacks for the same attempt. Payment event identity combines account/session, payment attempt ID, and terminal state. Use bounded in-memory bookkeeping cleared on session change; do not suppress a later intentional action because its message text matches. At most one terminal toast per operation. If an explicit confirmation screen already communicates an ordinary action's success, omit its success toast.

| Situation | Feedback |
|---|---|
| Navigation, first load, search, filters, tabs | Local loading; no toast |
| Refresh, new announcement, unread update | Quiet content/badge update |
| Field validation | Inline field messages; focus first invalid field on submission; no duplicate toast |
| Action-level failure | One useful error notification; inline persistence when recovery is necessary |
| Save/upload/remove/withdraw | One confirmed outcome unless an explicit success view already covers it |
| Confirmed active payment completion | One Payment received toast and existing receipt |
| Confirmed active payment expiry | One warning and persistent guidance |
| Check-in recorded; household update failed | One partial-success warning |
| Copy | Success only after the clipboard promise resolves |
| JSON export | Download started, not File saved |
| PDF export | Print preview opened, not Printing completed |
| Appearance adjustments | Immediate preview; no toast per adjustment |
| Existing unavailable feature | One informational message on deliberate selection |

Map known errors to plain, action-specific English. Preserve useful service/payment instructions, avoid raw SQL/provider internals, and do not hide rate-limit or permission recovery instructions behind a generic connection message. Avoid global error interception and message-substring heuristics as the primary business-result classifier.

### Accessibility and responsive behavior

- One polite loading announcement per operation/region; decorative spinners and skeletons are aria-hidden. Place the announcement outside a busy subtree if otherwise deferred.
- Use aria-busy on the affected control/region, not the whole application. Preserve button/link semantics and explicit icon names.
- Prevent duplicate live announcements from toast and identical inline alert content. Persistent inline guidance remains readable without being announced repeatedly.
- Preserve dialog focus handling and Escape behavior; ensure no hidden focusable controls remain during animated exit.
- Verify toast dismissal/recovery controls by keyboard, touch, and screen reader. Use at least 24 px targets, with 44 px touch hit areas for new compact dismiss/icon controls where layout permits.
- Support 320 px widths, 200% zoom, long descriptions, safe-area insets, virtual keyboards, and bottom navigation without clipped controls or horizontal overflow introduced by this work.

## 5. Complete resident-web coverage

| Area | Required treatment |
|---|---|
| Public home/auth/onboarding | Guest-safe fallbacks; login/register/OTP/recovery/Google pending; preserve redirect and profile-completion behavior |
| Home/announcements | Card/feed skeletons; bounded reveals; quiet read/unread updates; retained refresh content |
| Emergency | Guidelines, hotlines, center lists/maps, household CRUD, QR generation, camera startup and image decoding; partial-success handling |
| Services | Catalog/detail, multi-step modal, forms, requests/logs/tracking, drawer failures and cancellation outcomes |
| Payments | Fixed QR geometry, generation/wait/cancel feedback, confirmed terminal outcomes, safe receipt-only retry |
| Maps | Stable viewport and code/data placeholders; local search/location feedback; manual alternatives to permission denial |
| Health | Calendar/list/registration placeholders; awaited applicant actions; preserve eligibility/stock errors and applicant confirmation |
| Reports | Same-identity list refreshes, detail drawers, real photo-upload/submission stages, withdrawal outcomes |
| Profile/account | Section loads, avatar/ID uploads, household CRUD, location, password, deletion, JSON/PDF export |
| Informational settings | Help/article drawers, about, legal content, notification/theme settings; truthful empty/unavailable states |

Create a checklist for every current route and async action. Each entry records state owner, load identity, initial/refresh/error/empty treatment, pending label, outcome owner, recovery path, and verification evidence. Read-only/no-async screens should explicitly record that no loader/toast is needed. Reconcile the checklist with the actual route inventory before sign-off.

## 6. Implementation phases and scope control

### Phase register and execution rules

Execute in the order below. RW-LT IDs belong exclusively to this resident-web plan; they do not refer to any Android phase or revive cancelled work.

| Phase | Execution unit | Depends on | Status |
|---|---|---|---|
| RW-LT-00 | Baseline, coverage, and verification setup | None | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-00/baseline-record.md, coverage.md, baseline/results.json. Remaining: local Realtime unavailable (WebSocket 503) and Edge runtime stopped, so Realtime-refresh behavior is static-only and provider flows are browser-mocked; Firefox/Safari/screen-reader coverage untested; defects D-01–D-14 assigned to RW-LT-04…08 |
| RW-LT-01 | Shared loading and motion primitives | RW-LT-00 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-01/record.md, run-1/results.json (13/13 pass), baseline-regression/results.json. Remaining: PageSkeleton/PendingHint have no consumer yet (static only; runtime check in RW-LT-03); no icon-size Button consumer exists (static only); pilot drawer D-03 and announcements D-06 entrance replay carried to RW-LT-03/04; Chrome-only, no manual screen-reader/Firefox/Safari coverage |
| RW-LT-02 | Toast host, ownership, and notification adapter | RW-LT-01 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-02/record.md, unit-results.json (8/8 pass), run-1/results.json (10/10 pass), baseline-regression/results.json, RW-LT-01 rerun 13/13; production build pass. Remaining: no manual screen-reader pass (DOM-level announcement checks only); Chrome-only; hidden-tab pause verified by simulated visibility; keyboard cannot reach toasts while a Radix modal traps focus (by modal design); focus pause covers adapter toasts only until direct Sonner callers migrate in RW-LT-04…08; inherited sonner 1.7.4 per-toast visibilitychange listener leak recorded for RW-LT-09; D-04 still owned by RW-LT-04 |
| RW-LT-03 | Navigation, boundaries, and read-state pilot | RW-LT-02 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-03/record.md, run-2/results.json (15/15 pass), baseline-regression/results.json + comparison.json, RW-LT-02 rerun 10/10 (after a toast-anchor regression fix found by that rerun), RW-LT-01 rerun 13/13; production build pass. Remaining: hard loads now stream, so redirect()/notFound() arrive in-stream (document 200 + client redirect / noindex 404 view instead of 307/404; destinations unchanged) — raw status preservation would need a proxy-level decision by the owner; Realtime refresh verified with an in-browser protocol stand-in (local Realtime down); streamed hard-load fallbacks not observable locally; detail/form PageSkeleton variants unconsumed (RW-LT-06/07); no manual screen-reader pass; Chrome-only |
| RW-LT-04 | Authentication, public home, and announcements | RW-LT-03 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-04/record.md, run-1/results.json (18/18 pass, 75 checks), baseline-regression/results.json (20/20 executed), RW-LT-01 rerun 13/13, RW-LT-02 rerun 10/10 + unit 8/8, RW-LT-03 rerun 15/15; production build pass. Remaining: live Google OAuth, SMS/email OTP and Brevo delivery not exercised (browser-fulfilled/local Auth only); local Realtime unavailable (stand-in); no manual screen-reader pass; Chrome-only; `/home` takes tens of seconds to render while the REST gateway is down (3 serial server reads × ~5 s gateway retries; outside frontend scope); forgot-password's raw-provider-text/no-label behavior changed intentionally so two earlier-phase scenarios were re-pointed; D-04 remains open for RW-LT-06/07/08, D-12 for RW-LT-08 |
| RW-LT-05 | Emergency, maps, and household actions | RW-LT-04 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-05/record.md, run-1/results.json (28/28 pass, 91 checks), unit-results.json (4/4), baseline-regression/results.json (20/20 executed; D-01/D-02 no longer reproduce), RW-LT-01 rerun 13/13, RW-LT-02 rerun 10/10, RW-LT-03 rerun 15/15, RW-LT-04 rerun 18/18; production build pass. Remaining: live camera decoding of a real printed code, `navigator.share` sheet, manual screen reader, Firefox/Safari/iOS web and 200% zoom untested (Chrome-only); local Realtime stand-in; Centers location/route internals belong to the concurrent DRRM routing session's device-location controller (user-visible behavior verified); html5-qrcode logs its own unhandled play() rejection when closed mid-start (camera is released); D-03 incident/register drawers, D-04 (payment-method, report submit/withdraw, location save), D-11 export/PDF, D-12 and D-13/D-14 remain with RW-LT-06…08 |
| RW-LT-06 | Services, request journey, and payments | RW-LT-05 | Complete (2026-10-12) — evidence: plans/evidence/resident-web-feedback/rw-lt-06/record.md, run-2/results.json (24/24 pass, 80 checks), unit-results.json (5/5), baseline-regression/results.json (20/20 executed; D-14/D-03 no longer reproduce), RW-LT-01 rerun 13/13, RW-LT-02 rerun 10/10 + unit 8/8, RW-LT-03 rerun 15/15, RW-LT-04 rerun 18/18, RW-LT-05 rerun 28/28 + unit 4/4; production build pass. Remaining: live PayMongo/webhook ordering not exercised (browser-fulfilled provider functions; local Realtime stand-in); no manual screen-reader pass; Chrome-only; slide-in drawer focus order not manually walked; `ConfirmDialog` unchanged (report-withdraw consumer reviewed in RW-LT-07); `qrph-payment.tsx` still unused; D-03 incident/register drawers, D-04 report submit/withdraw and location save, D-06 my-incidents/FAQ, D-11 export/PDF, D-12 remain with RW-LT-07/08 |
| RW-LT-07 | Reports and health registration | RW-LT-06 | Not started |
| RW-LT-08 | Profile, account, and informational settings | RW-LT-07 | Not started |
| RW-LT-09 | Whole-app qualification and release handoff | RW-LT-08 | Not started |

For each phase, complete its tasks, run relevant verification, and record evidence before marking it Complete or beginning the dependent phase. Phase completion is based on evidence, not a new permission checkpoint. Keep each migrated workflow usable; do not leave placeholder buttons, simulated success, or half-migrated callback contracts.

Maintain this register with Not started, In progress, Complete, or Blocked, plus evidence references and remaining issues. Missing required access or browser/provider coverage remains pending and prevents a production-readiness claim. A blocked item does not authorize unrelated work or speculative backend changes; continue independently verifiable tasks in the active phase and record the dependency.

Use plans/evidence/resident-web-feedback/ for baseline, coverage, phase results, screenshots, and traces. Evidence must use synthetic accounts/data and must not include passwords, session tokens, OTPs, or real resident records. Add a focused scripts/resident-web-feedback-regression.cjs entrypoint using the existing browser runtime; group scenarios by these phase IDs so relevant checks can run independently. Do not execute unrelated phase scripts that modify databases, configure hosted services, or touch other applications.

After a phase changes TSX or frontend logic, run resident-web typecheck/lint and its targeted regression scenarios. Run production builds at RW-LT-00, RW-LT-02, RW-LT-03, RW-LT-06, and RW-LT-09. Later changes invalidate earlier evidence only for affected behavior; rerun those checks and any shared consumers affected, rather than repeatedly running unrelated suites. Run the React best-practices checklist after multiple TSX edits, and applicable verification/Supabase skills when implementation reaches their scope.

### RW-LT-00 — Baseline, coverage, and verification setup

**Goal:** establish current contracts and reproducible evidence before changing runtime behavior.

**Tasks**

- Re-read applicable repository instructions, required Expo v57 docs, and installed Next.js loading/link/error guides. Reconcile current changes from other work without resetting or overwriting them.
- Inventory every current page, layout, drawer, async action, direct Sonner call, loading flag, and refresh trigger. Assign each entry to exactly one feature phase; the inspected 48-page count is a baseline, not a hardcoded target.
- Record account/entity/filter ownership, current success/error return contract, notification owner, and recovery destination. Flag existing false-success and indefinite-loading cases with reproductions.
- Establish guest, normal resident, profile-completion-required, empty/populated, inaccessible-record, and local payment/registration fixtures. Use existing local infrastructure; do not change production data or provider configuration.
- Capture initial typecheck/lint/build results, representative production-build screenshots, request counts, and loading/motion traces. Record inherited failures separately.
- Establish deterministic slow/error/obsolete-response scenarios and the evidence format before broad screen changes.

**Deliverables:** current route/action coverage checklist, preservation/baseline record, local fixture instructions, regression entrypoint, and defect list tied to affected phases.

**Exit gate:** every current route/action is assigned; local guest/resident read journeys and delayed/error scenarios are reproducible; baseline results distinguish pass, failure, and untested. No runtime application or backend change has been made in this phase.

### RW-LT-01 — Shared loading and motion primitives

**Goal:** provide stable, accessible presentation components without changing operation contracts.

**Tasks**

- Implement Spinner, Skeleton, PageSkeleton compositions, LoadingStatus, and display-only pending/slow-operation hints using section 2 contracts.
- Extend the existing Button with loadingLabel and stable dimensions while preserving type, disabled conditions, event handlers, and asChild Slot semantics.
- Standardize the existing FadeIn and motion tokens. Apply reduced-motion behavior to CSS and existing motion components; keep server-compatible placeholders outside unnecessary client boundaries.
- Integrate the primitives into one real list, one form submit control, and one existing drawer from the inventory. Reuse these integrations in their later feature phases; do not add a publicly accessible demo route.
- Verify timer cleanup, immediate busy/disabled feedback, and immediate content availability after pending resolves.

**Deliverables:** reusable loading components, shared motion defaults, compatible button change, and three working pilot integrations.

**Exit gate:** under-120 ms operations avoid decorative flash; delayed operations show truthful feedback; settled failures release pending visuals; reduced motion is static; button labels do not shift controls or duplicate accessible names. Text, icon, form-submit, and asChild navigation buttons remain functional.

### RW-LT-02 — Toast host, ownership, and notification adapter

**Goal:** establish one consistent notification system and prove it before replacing every call site.

**Tasks**

- Refine the existing root Sonner host for top-center placement, measured header clearance, safe areas, active theme/font, bounded width/count, dismissal, and section 4 durations.
- Implement the local notify adapter with action/event IDs and bounded session-scoped deduplication. Do not give it fetch/mutation ownership or globally intercept errors.
- Migrate the three pilot integrations to screen-owned outcome handling. Preserve remaining direct Sonner calls until their feature phase migrates them; the same single host renders both during rollout.
- Verify deliberate second attempts still notify, repeated callbacks do not, and previous-account notifications are cleared/suppressed.
- Exercise toasts over existing Radix dialogs and with hover, keyboard focus, hidden tabs, long text, dark mode, and reduced motion.

**Deliverables:** one production toast host, notification adapter, pilot outcome integrations, and a verified notification policy.

**Exit gate:** one operation yields at most one terminal toast; critical guidance persists in the page; no duplicate live announcements or focus stealing; host placement does not block underlying controls. Production build passes or inherited failures are explicitly distinguished.

### RW-LT-03 — Navigation, boundaries, and read-state pilot

**Goal:** establish truthful route and local-read behavior without remounting forms or altering fetching contracts.

**Tasks**

- Add root/resident/auth loading fallbacks and representative route-specific compositions below the existing shells. Leave authorization and parent-layout data work intact.
- Add fixed-size useLinkStatus hints to existing top/bottom navigation and relevant segment/settings links while preserving active styles, prefetching, modifier clicks, and names.
- Add resident/auth error boundaries with the installed Next.js 16.3 retry contract, safe return destinations, and no mutation replay.
- Complete read-state behavior in the pilot list/drawer: initial, ready, empty, refreshing, unavailable, and error. Add readiness/refresh fields and request-generation guards only where needed; reuse current request-scoping helpers.
- Verify hard reload, guest fallback, back/forward navigation, rapid link selection, stale drawer responses, and pending/error announcements.

**Deliverables:** working route fallbacks/error recovery, navigation hints, and a proven local-read integration pattern for later feature phases.

**Exit gate:** persistent navigation remains usable; fast routes are not artificially delayed; valid content remains during same-identity refresh; record changes never flash another identity's data; boundary Retry recovers reads without resubmitting writes. No whole-shell keying, global progress controller, or changed query/subscription contract.

### RW-LT-04 — Authentication, public home, and announcements

**Goal:** migrate public entry and auth feedback while preserving every existing admission/redirect rule.

**Tasks**

- Cover login, registration, Google sign-in initiation/error, OTP verification/resend, forgot/reset password, onboarding, profile completion, auth error, and logout.
- Bind pending to awaited results, guard repeated activation, handle thrown failures, and distinguish inline validation from action-level outcomes. Preserve current field requirements, OTP behavior, resend policy, and redirect destinations.
- Ensure starting OAuth never reports completed sign-in; logout preference reset/navigation follows a successful existing sign-out result.
- Migrate guest/resident home, announcement feed/details, and read/unread feedback to section 3 read-state rules. Quiet ordinary incoming events; use bounded initial reveals.
- Cover expired session and account-change feedback without replacing current auth/session mechanisms.

**Deliverables:** migrated public/auth routes and action controls, home/announcement loaders, and auth notification ownership.

**Exit gate:** guest browsing still works; normal and profile-completion-required residents follow existing destinations; invalid inputs remain inline; failed login/OTP/logout restores usable controls; OAuth initiation does not announce success; automatic announcement/unread updates produce no toast burst. Local auth regressions pass; actual provider coverage is recorded honestly.

### RW-LT-05 — Emergency, maps, and household actions

**Goal:** make urgent information and browser-capability flows reliable without distracting motion.

**Tasks**

- Migrate emergency guidelines, hotlines, alerts, evacuation centers, household list/QR, camera scanner, and image-upload decoding.
- Migrate main map, center map, preparedness, directory, and local location/search indicators. Preserve stable viewport geometry and existing manual location alternatives.
- Change FamilyMemberDialog save/delete contracts to Promise<boolean> and update both emergency and profile consumers together. Repair result checks and preserve inputs/dialog on failure; remaining profile presentation belongs to RW-LT-08.
- Consolidate QR full/partial-success messaging and ensure camera cleanup follows existing scanner lifecycle.
- Apply shared drawer/dialog motion without altering modality, focus, outside-click rules, or map/QR/camera usability.

**Deliverables:** emergency/map coverage, working awaited household actions in both consumers, and accurate QR/capability outcomes.

**Exit gate:** urgent content does not wait for stagger; denied/unsupported camera/location has usable guidance; invalid QR input produces one error; partial check-in produces one warning; rejected household writes never toast success or close the editor; map/QR dimensions remain stable. No emergency backend or check-in payload changes.

### RW-LT-06 — Services, request journey, and payments

**Goal:** cover the complete request/payment UI while preserving financial correctness.

**Tasks**

- Migrate service catalog/details, multi-step request modal, standalone request form, request list/logs, tracking, and request drawer.
- Provide explicit missing/error/retry states and real stage labels where upload/submission state already exists. Preserve form ownership and the catalog's existing panel/layout-completion callbacks.
- Guard repeated submission/cancellation, verify returned results, and provide check-existing-request guidance for uncertain submission outcomes.
- Migrate payment-method selection, pickup confirmation, QR generation/wait/cancellation, standalone receipt, and modal receipt. Deduplicate confirmed terminal observations by account/payment attempt/state.
- Preserve server-confirmed receipt checks, amount derivation, polling/subscription setup, cancellation guards, QR resume behavior, and the existing paid transition timing.
- Make receipt retry a read-only action and keep payment recovery guidance persistent.

**Deliverables:** complete request/payment feedback coverage and focused financial-race/uncertain-response regression evidence.

**Exit gate:** failed request creation retains valid input; missing drawer records settle; a lost response does not cause automatic duplicate submission; overlapping poll/Realtime events notify once; payment completing during cancellation never shows cancellation success; receipt revisit/retry never creates a charge or historical toast. Local end-to-end request/receipt checks and production build pass; no real payment is made for testing.

### RW-LT-07 — Reports and health registration

**Goal:** finish resident submission/list flows with accurate stages and usable recovery.

**Tasks**

- Migrate report lists/status tabs, details/drawers, new report form, photo upload, location lookup, submission, and withdrawal.
- Migrate health calendars/filters, drive lists, registration drawer/form, registration list, and registration details.
- Preserve report ownership, photo limits, required fields, existing stock/eligibility rules, applicant numbers, and success confirmations.
- Repair drawer errors and pending cleanup where needed. Suppress duplicate success toasts when an explicit report/registration confirmation already communicates completion.
- Test stale filter/selection responses, retained refresh content, failed uploads, failed submissions, uncertain outcomes, and repeated activation.

**Deliverables:** complete reports/health feedback migration with verified submission-to-detail/list journeys.

**Exit gate:** valid local reports/registrations complete through current workflows; invalid/failed operations retain inputs and existing validation; uploads are not represented by fake percentages; absent drive/report records settle into unavailable/error views; quiet refreshes remain usable. Eligibility/stock decisions and applicant identifiers remain backend-owned.

### RW-LT-08 — Profile, account, and informational settings

**Goal:** finish settings presentation and browser-dependent outcomes without expanding account functionality.

**Tasks**

- Complete profile sections, avatar/ID uploads, household presentation, location verification, password change, account deletion, and JSON/PDF export feedback. Preserve the household contracts already repaired in RW-LT-05.
- Migrate help/search/article drawers, about, terms/privacy, notification settings, theme/accent/font preferences, and existing unavailable-feature messages.
- Keep immediate appearance previews quiet; give explicit confirmed outcomes for persistent actions where appropriate.
- Resolve clipboard rejection/popup blocking; use Download started and Print preview opened only when the corresponding browser action succeeds.
- Apply consistent section/drawer skeletons, read-only retry, and bounded reveals. Do not add account actions or implement currently unavailable features.

**Deliverables:** completed settings coverage and accurate upload/export/account feedback.

**Exit gate:** profile/upload/password failures leave usable recovery and truthful state; ID/account business rules remain unchanged; deletion success follows the existing result; clipboard/export errors cannot generate success; legal/help read failures do not loop indefinitely; theme changes produce no notification spam.

### RW-LT-09 — Whole-app qualification and release handoff

**Goal:** establish production readiness through complete evidence, not appearance alone.

**Tasks**

- Reconcile coverage against the current route/action inventory. Search for remaining direct Sonner imports, ad hoc loaders, mismatched pending flags, duplicate motion wrappers, and unhandled drawer null/error states. Migrate remaining scoped cases; record explicit no-async cases.
- Run the full section 7 scenario matrix against a production build with synthetic local journeys and deterministic delays/failures. Include Strict Mode lifecycle checks and timer/listener cleanup.
- Qualify 320/360, 768, and 1440 px; light/dark/custom accent/font; reduced motion; 200% zoom; long toast text; safe areas and virtual keyboards.
- Verify keyboard/screen-reader behavior, toast accessibility inside dialogs, hidden-tab recovery, supported browsers, deep links, hard reload, and back/forward navigation. Record unavailable browser/provider checks as pending.
- Compare baseline performance/request counts and inspect layout shifts. Fix attributable regressions, rerun affected checks, and verify no unbounded/offscreen animation or new unnecessary client boundary.
- Complete final typecheck/lint/build, scoped diff review, coverage report, screenshots/traces, and any necessary backend-exception evidence.

**Deliverables:** phase evidence index, complete coverage checklist, regression results, visual/accessibility/performance evidence, and release handoff report with explicit limitations.

**Exit gate:** every section 7 release criterion is met; no unresolved critical/major defect exists in changed flows; required real-world coverage is verified; all relevant checks pass or an inherited unrelated failure is clearly documented without a false passing claim. Do not call the work production-ready while required browser/provider/workflow qualification remains pending.

Production deployment is a separate action. The handoff includes the validated change set, existing release procedure references, and a scoped rollback approach. Prefer reverting this feature's changes without overwriting subsequent unrelated work; do not reset a shared working tree or alter backend data as a frontend rollback.

### Necessary backend exception procedure

No phase above plans backend changes. If a scoped integration is demonstrably blocked by a backend defect, record an exception inside that feature phase using section 1's criteria. Complete unaffected frontend work, make only the necessary compatible fix, add regression evidence, and rerun the affected frontend journey. Do not mark the phase Complete while its required integration remains blocked. Preserve sequential migration naming if a migration is necessary and check the actual current highest prefix.

## 7. Verification matrix and production-readiness gates

Use the existing local browser-testing approach and bundled Playwright runtime. Add a focused resident-web feedback regression script; do not add an animation/test dependency merely for this plan. Use deterministic request delays/failures and synthetic local data. Test real local backend flows for submissions and receipts; mock provider payment outcomes without making real charges. Live OAuth/SMS/email provider behavior requires sandbox/manual evidence and must not be claimed verified from frontend mocks alone.

### Required scenarios

| Scenario | Required result |
|---|---|
| Cached or under-120 ms response | No decorative loader flash or forced delay |
| 1–3 second load | Matching skeleton and accurate pending label |
| Over-10 second foreground operation | Still-pending explanation; no fabricated failure |
| Successful zero records | Meaningful empty state |
| Returned error/thrown rejection | Loader settles; recovery guidance works |
| Background refresh failure | Existing same-identity content remains usable |
| Rapid filter/entity/navigation changes | Obsolete responses cannot replace current state |
| Repeated click/Enter/touch activation | One local operation; one terminal notification |
| Save/delete callback fails | Inputs retained; no false success or premature close |
| Mutation response lost | Unconfirmed wording; no automatic duplicate write |
| Account switches/logout | No previous-account content, pending state, or toast leakage |
| Payment poll + Realtime overlap | One confirmed outcome |
| Payment completes during cancellation | Paid outcome; no cancellation-success toast |
| QR countdown ends before status confirmation | No invented unpaid/failed settlement claim |
| Receipt retry/revisit | Read only; no new payment and no historical completion toast |
| Camera/location/clipboard/popup denial | Useful guidance and existing fallback remain functional |
| Check-in partial success | One warning, no contradictory success |
| Upload fails then retry | Accurate stage; retained valid inputs; existing limits enforced |
| Drawer/dialog closes during work | No stale local update; no claim of server cancellation |
| Tab hidden then visible | No notification burst, entrance replay, or resumed write |
| Error boundary retry | Render/read recovery, never mutation replay |

### Browser, accessibility, and performance review

- Run resident-web typecheck, lint, and production build. Track pre-existing failures separately; do not broaden scope to fix unrelated failures or describe failed checks as passing.
- Validate navigation and full workflows against a production build, including hard reload, deep link, browser back/forward, and settings nesting.
- Capture at 320/360, 768, and 1440 px; light/dark mode; custom accent/font; normal/reduced motion; 200% zoom.
- Exercise supported Chrome/Edge and Safari/iOS web behavior plus Firefox. Use available automated engines, and record manual coverage or unresolved coverage explicitly. iOS web testing does not authorize native-app edits.
- Manually verify keyboard and screen-reader announcement/focus behavior, especially loading-to-error transitions and toasts inside open dialogs. Automated DOM checks alone are insufficient evidence.
- Compare controlled production-build traces before/after. No new animation library, loading-related network requests, repeatable performance regression attributable to these changes, or new greater-than-50 ms main-thread animation tasks. Offscreen/long lists must not create unbounded motion work.
- Verify stable button/map/QR geometry and inspect layout shifts from placeholders; require no new feedback-induced overflow or interaction-blocking overlay.
- Check timer/listener/subscription cleanup and exercise Strict Mode for duplicate effect-driven notifications. Preserve existing subscription ownership and query counts.

### Release checklist

- Every inventoried route/action has a verified treatment or an explicit no-async designation.
- Initial loading, refreshing, empty, unavailable, error, and uncertain submission outcomes are truthful.
- No pending control remains stuck after a settled success/error; no fake success or contradictory outcome.
- At most one terminal toast per operation; ordinary automatic updates remain quiet.
- Real content is immediately usable; available content remains visible during background refresh.
- Confirmed receipts, payment race protections, auth redirects, and existing business workflows pass regression checks.
- Accessibility and reduced-motion checks pass; outstanding browser/provider coverage is visible in the evidence report.
- No newly introduced failure in typecheck/lint/build or relevant regressions; no unresolved critical/major issue in modified flows.
- Final diff contains only scoped frontend/verification/documentation work, or a separately justified and tested necessary backend exception.

Do not label implementation production-ready until these gates are met. Record failures and limitations honestly instead of substituting screenshots or a successful build for full workflow verification.

## 8. Deliverables and defaults

Deliver the reusable frontend system, migrated resident-web screens, focused correctness repairs, route/action coverage checklist, regression verification, representative screenshots/traces, and a concise release report with known limitations.

Defaults remain English copy, existing layouts/brand settings, expressive but short motion, top-center toasts, quiet background updates, and no database change. No fabricated loading percentage, optimistic settlement, automatic mutation retry, or blanket full-screen busy overlay.

Before writing implementation code, read the required Expo v57 documentation at https://docs.expo.dev/versions/v57.0.0/ and the relevant installed Next.js guides under node_modules/next/dist/docs/. Re-check applicable AGENTS.md instructions and current contracts rather than assuming the inspected baseline is unchanged.
