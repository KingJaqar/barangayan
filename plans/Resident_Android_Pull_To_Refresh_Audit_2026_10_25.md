# Resident Android — Pull-to-Refresh Audit and Lightweight Design

Date: 2026-10-25 · App: `apps/resident-android-mobile` · Status: analysis and planning only, no code changed.

Screen IDs (R-, F-, M-) come from the full inventory in
[Resident_Android_Screen_Inventory_2026_10_25.md](Resident_Android_Screen_Inventory_2026_10_25.md). Paths here are
relative to `apps/resident-android-mobile/src`.

## 1. Summary

- The app has **no `RefreshControl` anywhere** today (searched `src` for `RefreshControl`, `refreshControl`, `onRefresh`).
- Of 82 screen entries, **14 should get pull-to-refresh** (11 distinct implementations, because three are alias routes)
  and **68 do not need it**.
- The shared component itself is easy. The real work is that screens refresh through **three different dialects**
  (section 4), and the older ones are neither awaitable nor safe to call while content is on screen.
- Recommended scope: Tier A (7 route entries, 6 implementations) first, Tier B (4 entries, 2 implementations) second,
  Tier C (3 entries) only if wanted.

### Totals check

| | Routes (R) | Flows (F) | Modals (M) | Total |
| --- | ---: | ---: | ---: | ---: |
| Inventory (list 1) | 51 | 7 | 24 | **82** |
| List 2: should get RefreshControl | 14 | 0 | 0 | **14** |
| List 3: not needed | 37 | 7 | 24 | **68** |
| List 2 + List 3 | 51 | 7 | 24 | **82** ✔ |

Each ID appears in exactly one of lists 2 and 3.

---

## 2. List 2 — Screens that should get RefreshControl (14)

Tiers: **A** = core content that changes while the resident is away; **B** = status screens that already poll or use
realtime, so pull is a convenience; **C** = low-churn managed content, optional.

| ID | Screen (file) | Tier | Scroll container | Data to refresh | Reason |
| --- | --- | :-: | --- | --- | --- |
| R-39 | `app/(app)/announcements.tsx` | A | `FlatList` in `components/reports/announcements-feed.tsx` | `useAnnouncements(category)` — exposes `retry` (counter bump), not `refetch` | Main "What's New" feed; admins publish new items at any time. |
| R-36 | `app/(app)/reports/index.tsx` | A | `FlatList` in `components/reports/my-incidents-feed.tsx` | `useMyIncidents().refetch` (a `HistoryResource.refresh`, already a promise); `useUnreadCounts` incident counts | Report status changes as staff act; feed is paginated history. Same feed serves the Incidents/Active/Resolved segments. |
| R-16 | `app/(app)/home/index.tsx` | A | `ScrollView` | `useProfile().refetch`, plus two **inline** Supabase loads in the screen (latest announcement, latest request) | Landing screen; its summary cards go stale. |
| R-23 | `app/(app)/services/index.tsx` | A | `ScrollView` (Documents, Logs segments) and the inner `ScrollView` owned by `RequestsList` (Requests segment) | Documents: inline loader with a `retry` counter in `components/services/documents-list.tsx`. Requests/Logs: `useHistoryPages().refresh` (promise). Also `useProfile().refetch` | Request list and activity log change as staff process requests. |
| R-18 | `app/(app)/home/emergency-info/index.tsx` | A | One `ScrollView` for Hub, Alerts, Scan guide and Family tabs. **Centers tab excluded** (see R-05 note) | Hub: `useEmergencyGuidelines.refetch`, `useEmergencyHotlines.refetch`. Alerts: `useEmergencyAnnouncements.refetch`. Family: `useProfileHouseholdMembers.refetch` and `useHouseholdAttendance.refetch` (`FamilyContent.refresh()` already calls both). Scan guide: `useEmergencyQrContent.refetch` | Emergency alerts and hotlines are time-sensitive. Handler depends on the active tab. |
| R-19 | `app/(app)/drrm.tsx` | A | Same as R-18 (re-export) | Same as R-18 | DRRM tab renders R-18; implemented once. |
| R-34 | `app/(app)/health/index.tsx` | A | `ScrollView` in the Active Drives segment (list or month calendar); separate `ScrollView` in `MyRegistrationsPanel` | `useMedicalDrives`: `refetch` (daily list), `fetchMonthDrives` (month view), `refetchCalendar`, `refetchRegistrations` — all `RefreshResource.refresh` promises | Drive slots and registration status change. Refresh the mode that is on screen. |
| R-17 | `app/(app)/home/requests/[requestId].tsx` | B | `ScrollView` in `components/services/request-tracking-screen.tsx` | Inline Supabase load plus a realtime channel in the component; needs the load extracted into a callable | Already live via realtime; pull is a fallback when the channel drops. |
| R-26 | `app/(app)/services/requests/[requestId].tsx` | B | Same component as R-17 | Same as R-17 | Alias of R-17; implemented once. |
| R-27 | `app/(app)/services/payment/[requestId].tsx` | B | `ScrollView` in `components/services/resident-payment-screen.tsx` | Local async `refresh()` already in the component (also polls every 10 s and backs a "Refresh" button) | Payment status check; pull replaces the button as the gesture. |
| R-28 | `app/(app)/services/payment/pickup/[requestId].tsx` | B | Same component as R-27 | Same as R-27 | Alias of R-27 (pickup variant); implemented once. |
| R-48 | `app/(app)/settings/about.tsx` | C | `ScrollView` | `useAboutUs().refetch` (void, sets full loading) | Admin-managed content; changes rarely. |
| R-49 | `app/(app)/settings/help/index.tsx` | C | `ScrollView` (contains a horizontal chevron row) | `useFaqArticles().refetch` (void, sets full loading) | Admin-managed FAQ list; changes rarely. |
| R-51 | `app/(app)/settings/terms-privacy.tsx` | C | `ScrollView` | `useSiteContent().refetch` (void, sets full loading) | Admin-managed policy text; changes rarely. |

Guests: R-36 shows a guest callout instead of a scroller and R-23 shows only Documents, so the control simply is not
attached when there is no scroller or nothing to refresh.

---

## 3. List 3 — Screens that are fine without RefreshControl (68)

"Conflict" flags a gesture the pull would compete with. "None" means no conflict, just no reason to refresh.

### 3.1 Routes (37)

| ID | Screen | Why no pull-to-refresh | Conflict |
| --- | --- | --- | --- |
| R-01 | `app/index.tsx` | Redirect only; no UI. | None |
| R-02 | `app/account-setup.tsx` | Setup flow of forms and status; nothing list-like to reload. | None |
| R-03 | `app/auth/callback.tsx` | Transient OAuth callback. | None |
| R-04 | `app/complete-profile.tsx` | Wraps the details form; a pull could discard a draft. | Draft loss |
| R-05 | `app/emergency-centers.tsx` | Map-first guest entry (`CentersContent`); has its own retry banner. The list view is an absolute-fill scroller layered under the map. | Map pan; layered scrollers |
| R-06, R-07, R-08 | `(auth)/welcome`, `value-prop`, `personalization` | Static onboarding slides. | None |
| R-09 | `(auth)/auth-choice.tsx` | Static choice screen. | None |
| R-10, R-11 | `(auth)/login`, `register` | Credential forms. | Keyboard / draft loss |
| R-12, R-13, R-14 | `(auth)/otp`, `forgot-password`, `reset-password` | Code and password forms; refresh makes no sense mid-flow. | Keyboard / draft loss |
| R-15 | `(auth)/completion.tsx` | Static completion screen. | None |
| R-20 | `home/emergency-info/qr-guide.tsx` | Redirect only. | None |
| R-21 | `home/emergency-info/scan.tsx` | Static instruction content, cached offline; refreshed from the Emergency Info Scan tab (R-18) instead. | None |
| R-22 | `index/emergency-info/qr-guide.tsx` | Legacy redirect alias. | None |
| R-24 | `services/[documentId].tsx` | Single catalog entry fetched on open; re-entering reloads it. | None |
| R-25 | `services/request/[documentId].tsx` | Request form with a draft; a pull could discard input. | Draft loss; sheet drag (M-15) |
| R-29 | `services/payment/qrph/[requestId].tsx` | Live QR with its own expiry countdown and generation flow; "refresh" would mean regenerating a payment. | None |
| R-30 | `services/payment/success.tsx` | Static receipt. | None |
| R-31 | `maps/index.tsx` | Full-screen map; vertical drag pans the map. Has its own "Retry locations" action. | Map pan; nested overlay scroller; horizontal chevron row |
| R-32 | `maps/hotline-directory.tsx` | Placeholder panel. | None |
| R-33 | `maps/preparedness-guide.tsx` | Placeholder panel. | None |
| R-35 | `health/register.tsx` | Registration form. | Keyboard / draft loss |
| R-37 | `reports/[incidentId].tsx` | Detail screen already updates via a realtime channel; embeds a map and horizontal photo carousels. | Map pan; nested horizontal scroll |
| R-38 | `reports/new.tsx` | New-report form with photos and a map picker. | Keyboard / draft loss; horizontal chevron row |
| R-40 | `search.tsx` | Recents and suggestions are local; no remote data. | Keyboard |
| R-41 | `explore.tsx` | Results come from an explicit submit (each submit already yields fresh results); a pull would have to re-enter the query-state flow. `SectionList` paged by "See all". | Keyboard dismiss; horizontal chevron row |
| R-42 | `settings/index.tsx` | Preferences and account actions; profile already refreshes on focus/foreground. | Horizontal chevron row |
| R-43 | `settings/profile.tsx` | Edit form with a deliberately preserved draft; reload would discard edits (it has its own "Reload Profile"). | Draft loss; nested horizontal option rows |
| R-44 | `settings/change-password.tsx` | Password form. | Keyboard / draft loss |
| R-45 | `settings/email-verification.tsx` | Verification form. | Keyboard / draft loss |
| R-46 | `settings/valid-id.tsx` | Upload form with camera modal. | Draft loss |
| R-47 | `settings/location-verification.tsx` | Form with a map pin. | Map pan |
| R-50 | `settings/help/[articleId].tsx` | One article, loaded with the list in R-49; short, rarely changes. | None |

### 3.2 Full-screen flows (7)

| ID | Flow | Why no pull-to-refresh | Conflict |
| --- | --- | --- | --- |
| F-01 | `account-setup-status` | Setup progress/error state. | None |
| F-02 | `resident-details-form` | Form; refresh would discard a draft. | Draft loss |
| F-03 | `resident-password-step` | Password form step. | Keyboard |
| F-04 | `password-recovery-screen` | Recovery form shell. | Keyboard |
| F-05 | `guest-auth-callout-screen` | Static guest wall. | None |
| F-06 | `onboarding-screen` | Static onboarding layout. | None |
| F-07 | `navigation-diagnostic-screen` | Dev-only wrapper, no UI. | None |

### 3.3 Modals, sheets and overlays (24)

All render in a React Native `Modal` or a sheet on top of another screen. A modal has its own window, and the screen
underneath owns refreshing.

| ID | Modal | Why no pull-to-refresh | Conflict |
| --- | --- | --- | --- |
| M-01 | `SettingsSheet` | Option/edit sheet. | Sheet scroll body |
| M-02 | `CustomAccentColorModal` | Color picker; contains a drag control (`color-picker`). | Drag control |
| M-03 | `DeleteAccountModal` | Confirmation. | Sheet scroll body |
| M-04 | `GoogleDeletionDialog` | Confirmation dialog. | None |
| M-05 | `BirthdayCalendarModal` | Picker; has horizontal scrollers. | Nested horizontal scroll |
| M-06 | `BirthdayWheelModal` | Wheel picker (scrolling wheels). | Wheel scroll |
| M-07 | Front-ID camera modal | Camera capture. | None |
| M-08 | `ScanFamilySheet` | Base sheet for QR dialogs. | Sheet scroll body |
| M-09 | `QrPermissionModal` | Permission prompt. | None |
| M-10 | `QrShowModal` | Static QR display. | None |
| M-11 | `HouseholdQrModal` | Static QR display. | None |
| M-12 | `FamilyMemberModal` | Member form; has a horizontal chevron row. | Keyboard; nested horizontal scroll |
| M-13 | `QrScannerOverlay` | Live camera. | None |
| M-14 | `RequestSummarySheet` | Read-only summary sheet. | Sheet scroll body |
| M-15 | `PurposeSheet` | Picker; has a drag-to-dismiss `PanResponder`. | Sheet drag |
| M-16 | `ActionSuccessModal` | Confirmation. | None |
| M-17 | `PaymentSuccessModal` | Confirmation. | None |
| M-18 | `AnnouncementModal` | Read-only announcement body (the feed behind it is R-39). | Sheet scroll body |
| M-19 | `FeedbackModal` | Feedback form. | Keyboard |
| M-20 | `LocationPickerModal` | Map picker. | Map pan |
| M-21 | `PhotoViewerModal` | Photo viewer (pinch/pan). | Image gestures |
| M-22 | `HealthSheet` | Month/year picker and registration detail; underlying lists are refreshed from R-34. | Sheet scroll body |
| M-23 | Road-block confirm dialog | Confirmation over a map. | None |
| M-24 | `LoadingOverlay` | Blocking spinner, no content. | None |

Only M-15 has a confirmed drag gesture in code (`PanResponder`); the other "sheet scroll body" flags mean a scroll view
sits inside a `Modal`, which is irrelevant because none of these are refresh candidates.

---

## 4. Current-state findings that shape the design

### 4.1 Three refresh "dialects" in the codebase

| Dialect | Used by | Awaitable? | Keeps content visible while refreshing? |
| --- | --- | :-: | :-: |
| **A. `RefreshResource`** (`lib/refresh-resource.ts`): `useRefreshResource`, `useHistoryPages`, and hooks built on them — `useProfile`, `useMyIncidents`, `useMedicalDrives`, `useUnreadCounts` | `refresh()` returns `Promise<void>`, de-duplicates concurrent calls, has a built-in timeout | Yes | Yes (`refreshing` flag separate from `loading`) |
| **B. Legacy `doFetch` hooks**: `useAboutUs`, `useFaqArticles`, `useSiteContent`, `useEmergencyGuidelines`, `useEmergencyHotlines`, `useEmergencyAnnouncements`, `useEmergencyQrContent`, `useEvacuationCenters`, `useIncidents`, `useProfileHouseholdMembers` | `refetch()` returns `void` for all except `useProfileHouseholdMembers`, whose `refetch` is an `async` function (a promise) | Only `useProfileHouseholdMembers` | **No**: they call `setIsLoading(true)` (or `setLoading(true)`), so a pull would swap the content for a skeleton |
| **C. Inline or one-off loaders**: `useAnnouncements` (`retry` counter), `documents-list.tsx` (`retry` counter), `home/index.tsx` effects, `request-tracking-screen.tsx` effect, `resident-payment-screen.tsx` local `refresh()` | Mixed (payment screen's is async; the rest are not callable at all) | Mostly no | Mostly no |

Also: `useProfile` types `refetch` as `() => void` in its context even though it is backed by an async resource, and
`useHouseholdAttendance.refetch` is already async.

### 4.2 Existing refresh triggers (pull-to-refresh is additive)

Several screens already refresh on focus (`useFocusEffect` in `requests-list`, `logs-list`, `use-medical-drives`,
`services/[documentId]`), on app foreground (`use-household-attendance`), and through Supabase realtime
(`documents-list`, `requests-list`, request tracking, incident detail). Pull-to-refresh does not replace these.
`RefreshResource` de-duplicates in-flight calls, so a pull during a focus refresh will not double-fetch for dialect A.

### 4.3 Child components own their data

In Emergency Info, `HubContent` and `AlertsContent` receive their sources from the screen, but `FamilyContent` and
`QrGuideContent` call their own hooks internally; in Services, `DocumentsList`, `RequestsList` and `LogsList` do the
same. The screen that owns the scroller therefore cannot always reach the refetch function it needs.

---

## 5. Proposed lightweight shared design (no code)

Principle: one tiny component and one tiny hook, no new dependencies, no data layer. Do not migrate every hook.

### 5.1 Thin wrapper around the built-in `RefreshControl`

- One file under `components/` (for example `app-refresh-control.tsx`) exporting a themed element that screens pass to
  the `refreshControl` prop of a `ScrollView`, or to `FlatList`/`SectionList`'s `refreshControl` prop (the built-in
  `refreshing`/`onRefresh` props also work, but one element keeps theming in one place).
- It takes a single async `onRefresh` and nothing else in the common case. It does not wrap the scroll view, so
  existing scroll components, refs, keyboard props and bottom-tab padding stay exactly as they are.
- No new package: only `RefreshControl` from `react-native`.

### 5.2 Theming and dark mode through `useTheme()`

- Read colors from `useTheme().resident`: spinner color from the accent token already used for accent text, and the
  circle background from the card or surface token. On Android these map to `colors` and `progressBackgroundColor`
  (the iOS-only `tintColor` is not needed for an Android-only app).
- Because the tokens already switch with the theme, dark mode and the user's custom accent color work with no extra
  logic. Check contrast of the spinner on the circle in both themes, since a custom accent could be very light.
- Respect `useResidentReducedMotion`: `RefreshControl` has no custom animation to disable, so nothing to add.

### 5.3 How a screen registers what to refetch, and keeping the spinner up

- **Simple screens** (announcements, reports list, home, health, about, help, terms): pass one async function to the
  wrapper. That function calls the screen's existing refetch/refresh functions and returns when they finish.
- **Screens whose children own the data** (Emergency Info, Services): add a very small registration hook. The scroll
  owner provides a ref-held set of refresh functions through context; any child calls the hook with its own
  refetch, and it unregisters on unmount. On pull the wrapper runs whatever is registered at that moment, so the
  active tab or segment decides what refreshes. This is a ref-held set, not state, so it causes no re-renders.
- **Spinner lifetime:** the hook owns a single `refreshing` boolean. On pull it ignores the gesture if one is already
  running, sets `refreshing`, waits for all functions with `Promise.allSettled` (one failure must not hang or abort the
  others), then clears `refreshing`.
- **Hung-request guard:** dialect A resources have their own timeout; dialect B and C requests do not. The hook should
  clear the spinner after a fixed ceiling (proposal: about 15 seconds) so a stalled request cannot pin it forever.
- **Errors:** do not add a toast. Every L2 screen already shows its own error/retry state when its source fails, so the
  pull just triggers it. The existing Retry and Refresh buttons stay, because the pull gesture is not available to
  TalkBack users.

### 5.4 Making the legacy `refetch()` hooks awaitable

Smallest change set, in order of need:

1. **Dialect A:** nothing to build. Only widen types where they are declared `() => void` (`useProfile`'s context) so
   the promise reaches the caller.
2. **Dialect B hooks needed by list 2** — `useAboutUs`, `useFaqArticles`, `useSiteContent`, `useEmergencyGuidelines`,
   `useEmergencyHotlines`, `useEmergencyAnnouncements`, `useEmergencyQrContent`, `useProfileHouseholdMembers`: make
   `refetch` return the underlying promise (`useProfileHouseholdMembers` already does), and when data is already present
   do not flip the loading flag to true (or expose a separate `refreshing` flag). Without the second change a pull
   blanks the screen into a skeleton. Do not touch
   `useEvacuationCenters` or `useIncidents`: only excluded screens (maps, centers) use them.
3. **Dialect C one-offs:** `useAnnouncements` (turn the `retry` counter into an awaitable function or move it to the
   dialect A resource), `documents-list.tsx` (expose its loader), `home/index.tsx` (extract the two inline loads into
   one function), `request-tracking-screen.tsx` (extract its load). `resident-payment-screen.tsx` already has an async
   `refresh()`.

Migrating B and C hooks onto `useRefreshResource` is the cleaner long-term fix, but it is a data-layer change and not
required for pull-to-refresh. Treat it as optional follow-up.

### 5.5 Rollout order

1. Wrapper component and registration hook, tried on one dialect A screen (Reports list, the feed with the least
   plumbing).
2. Rest of Tier A: Announcements, Health, Services, Home, Emergency Info.
3. Tier B (request tracking, payment), then Tier C only if wanted.

---

## 6. Risks to verify on a device later

1. **Floating tab bar.** Bottom padding comes from `useFloatingTabInset`/`useFloatingTabClearance`. The pull control
   sits at the top, so it should be unaffected, but confirm the last list item still clears the bar after a refresh
   and that the bar's hide/show logic does not react to the overscroll.
2. **Header overlap and spinner offset.** The L2 screens render `ResidentHeader` outside the scroller, so the spinner
   should appear below it. Maps/Centers use a `coveredTop` inset because content scrolls under overlays; if any L2
   screen ever does that, the control needs a progress offset.
3. **Nested horizontal scrollers.** Android's pull gesture can steal a diagonal drag started on a horizontal row.
   Affected L2 screens: Home (chevron row), Help index (chevron row), Emergency Info Alerts (chevron row), Services
   Requests (horizontal status tabs), and the filter chips on Announcements/Reports (these sit above the list, not
   inside it, so lower risk). Test diagonal drags on each.
4. **Services Requests segment.** `RequestsList` owns its own scroller with pinned filter chips and a header block; the
   control must go on that inner scroller, not on the outer `ScrollView`. Its signed-in branch is the one that needs it
   (the guest branch is a separate `ScrollView` with only a login prompt). The sticky filter header
   (`stickyHeaderIndices`) must be checked against the spinner's position.
5. **Health has two vertical scrollers** (drives list/calendar and My Registrations) and a month view versus list view.
   Make sure the pull refreshes the mode on screen, and that the existing in-content "Refreshing…" text does not stack
   with the spinner.
6. **Emergency Info tab switching.** The Centers tab must not register a refresher or expose the control (map pan);
   the other tabs must unregister cleanly when you switch away.
7. **Double fetch.** Focus effects plus realtime plus a pull can overlap. Dialect A de-duplicates; dialects B and C do
   not, so confirm there is no flicker or stale overwrite.
8. **Scroll position.** `RefreshControl` only triggers at the top. Screens that restore scroll position or use
   `entering` animations (Reanimated entering/exiting is known to misbehave on web in this repo) should be checked.
9. **TalkBack.** Keep the existing visible Retry/Refresh controls; the gesture is not an accessible alternative.
10. **Guests and offline.** With no session or no connectivity the pull should end quickly and leave cached content
    (emergency data is cached offline), not show an empty state.

---

## 7. Open decisions for the owner

1. Include **Tier C** (About, Help index, Terms/Privacy), or stop after Tier B?
2. Fix the legacy hooks with the **minimal patch** in 5.4 (recommended), or migrate them onto `useRefreshResource`?
3. Should the **Centers list view** (R-05 and the Emergency Info Centers tab) get a pull later? It is excluded now
   because it is layered under a map; a list-only mode would be a separate, small follow-up.
