# Resident Web — UI Inventory

Scope: `apps/resident-web`. Derived from the source tree on 2026-10-24 (routes, components, hooks and state branches), not from existing plans. Inventory only: nothing was run, screenshotted or changed.

**Path convention.** Every path in the *Source* column is relative to `apps/resident-web/src/`. `(r)` stands for the `app/(resident)/` route group and `(a)` for `app/(auth)/`.

---

## 0. Variant axes that apply almost everywhere

| Axis | Values | Where it comes from | Notes |
|---|---|---|---|
| Session | Guest, signed in | `lib/auth/get-optional-user.ts`, `lib/auth/require-user.ts` | Pages using `getOptionalUser()` render for both. Pages using `requireUser()` redirect guests to `/login?next=<path>`. |
| Profile completeness | Complete, incomplete, "profile check unavailable", "account setup pending" | `components/auth/profile-completion-banner.tsx`, `components/auth/profile-setup-notice.tsx` (rendered by `(r)/layout.tsx`) | Banner sits above `children` on every resident route. `requireUser()` also redirects incomplete profiles to `/complete-profile` outside `/settings/*`. |
| ID verification (`idVerificationState`) | `verified`, `pending`, `failed` (also `id_repair_required`), `missing` | `packages/shared/src/lib/service-catalog.ts` | Drives the Services notice, the document form's "Approved profile ID" block, the Valid ID screens and the Settings sidebar badge. |
| Email verification | `unverified`, `pending`, `verified`, plus "Action needed" when profile email ≠ sign-in email | `profiles.email_verification_status` | Home banner, Settings sidebar badge, profile status chip, Email Verification screen. |
| Location verification | Saved, not saved | `profiles.verified_location` | Settings sidebar badge, Location Verification screen. |
| Theme | Light, dark (`.dark` class on `<html>`) | `components/theme/theme-controller.tsx`, `app/globals.css` | Toggle in the profile menu and in Settings → Theme. |
| Accent colour and font | Presets plus custom colours; font options from `@barangayan/shared` `FONT_OPTIONS` | `components/theme/accent-controller.tsx`, `font-controller.tsx` | Change the look of every screen. |
| Breakpoints | `<640` px mobile, `640–1199` tablet, `≥1200` desktop, `≥1600` wide; Settings and some pages switch at `lg` (1024) | `components/shell/resident-shell.module.css`, Tailwind `sm:`/`lg:` classes | See section 1. |
| Reduced motion | `prefers-reduced-motion` | `globals.css`, `MotionProvider` | Skips slide, spring and reveal animations. |

---

## 1. Layouts and persistent chrome

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Root layout (providers, Toaster) | All routes | `app/layout.tsx` | Always | Hosts the theme, accent and font init scripts, `MotionProvider`, `ReadRetryProvider` and the sonner `Toaster`. |
| Resident shell: header | Everything under `(r)` | `components/shell/resident-shell.tsx`, `resident-shell.module.css` | Any resident route | **Guest:** logo, locality "Barangay", horizontal scrolling main nav (below 640 px), Log In and Sign Up buttons. **Signed in:** brand with locality name, main nav, account nav (Announcements and Settings), resident name plus "Resident account" label (only ≥1600 px), profile avatar menu. Layout: `<640` one row, nav hidden for signed-in users; `640–1199` nav on a second row; `≥1200` single row. |
| Main top nav | Header | `components/shell/top-nav.tsx` | Header | Items: Home, Emergency, Services, Maps, Health, Reports, Announcements, Settings. Active pill (animated), red count badges on Reports (active plus resolved-unread, capped at "99+") and Announcements (unread), pending-link hint underline. Below 640 px the Announcements and Settings items move to the account group, and the compact variant hides at ≥640. |
| Bottom tab bar | Fixed to the viewport, signed-in only | `components/shell/bottom-tab-bar.tsx` | Signed in at `<640 px` (`sm:hidden`) | All 8 destinations, horizontally scrollable. Left and right gradient chevron buttons appear only when there is overflow. Active pill, unread badges. Not rendered for guests. |
| Profile menu (dropdown) | Header, signed-in | `components/shell/profile-menu.tsx` | Click the avatar | Closed. Open: summary (name, "Resident account"), My Profile, Settings, Dark mode (checkbox switch), Log out. Logging out: spinner and "Logging out…", then "Taking longer than usual…". Avatar image or initial fallback. |
| Notification bell | Not mounted in the shell | `components/shell/notification-bell.tsx` | Not reachable | Component exists, but no import in the shell (see coverage notes). |
| Profile completion banner | Top of every resident route | `components/auth/profile-completion-banner.tsx`, `resident-action-notices.tsx` | Signed in with an incomplete profile | "Your next step: complete your profile" with a Complete profile link. Variant "Profile check unavailable" when the check throws. |
| Profile setup notice | Top of every resident route | `components/auth/profile-setup-notice.tsx` | Google sign-in where profile creation failed (`profileSetupPending`) | "Your account details could not be saved yet…" plus Retry account setup (pending: "Retrying…"). |
| Settings shell: sidebar | `/settings/*` | `(r)/settings/layout.tsx`, `settings-sidebar.tsx`, `settings-content.tsx` | Any Settings route | Desktop (`lg+`): left rail with group titles (Account, Preferences, Privacy & Data, About), App Version row and Log out. Below `lg`: icon-only horizontal strip. **Guest:** only Preferences and About groups, and a Log In link instead of Log out. Badges: Valid ID (checking / unavailable / verified / not verified), Email Verification and Location Verification (✓ or !). Destructive row "Delete My Account" is red. |
| Services segment nav | `/services/*` | `components/services/services-segment-nav.tsx`, `(r)/services/layout.tsx` | Services routes | **Signed in:** Documents, Requests, Logs pills. **Guest:** a single static "Documents" pill. |
| Services verification notice | Under the segment nav, signed-in only | `components/services/services-verification.tsx`, `resident-service-form.tsx` (`VerificationNotice`) | Any `/services/*` page while signed in | Loading ("Checking ID verification…"); `verified` → "Valid ID Verified" bar with "Don't show again" (stored in localStorage); `pending`, `failed`, `missing` → amber notice with message plus "Verify Now"; read error → message plus "Retry verification check". |
| Emergency segment nav | `/emergency/*` | `(r)/emergency/layout.tsx`, `components/emergency/emergency-segment-nav.tsx`, `components/shared/sticky-primary-tabs.tsx` | Emergency routes | Sticky tabs Hub, Centers, Scan, Family, Alerts. |
| Health segment nav | `/health/*` | `(r)/health/layout.tsx`, `components/health/health-segment-nav.tsx` | Health routes | Tabs Active Drives and My Registrations. The second one shows a login gate for guests. |
| Landing footer | Bottom of `/home` | `components/home/landing-footer.tsx`, `footer-interactions.tsx` | Scroll `/home` | "In an emergency, call 911." strip with Call 911 and Barangay hotlines. Link groups Services, Emergency, Community. Legal links and Back to top. Mobile: link groups collapse into accordions (`FooterGroup`); the locality line only shows for signed-in users. |
| Toast stack | Global | `components/ui/sonner.tsx`, `lib/notify.ts` | Any action that notifies | Top-centre, up to 3 visible, close button. See section 2. |

---

## 2. Feedback: toasts, boundaries, banners (cross-cutting)

### 2a. Toast kinds

Toasts are positioned below the header and have a close button. Success and info last 4 s, warning 6 s, error 8 s. The timer pauses on hover or focus. Most toasts go through `lib/notify.ts` (de-duplicated by attempt ID); a few call sonner's `toast` directly (see coverage notes).

| Toast | Source | Trigger | Variants |
|---|---|---|---|
| "Welcome back [name]" | `lib/auth/session-feedback.ts` | After a successful login | Appears on the first screen after login or Google callback. |
| "Logged out" / "Logged out on this browser" (warning, with description) / "Couldn't log out" | `hooks/use-sign-out.ts`, `session-feedback.ts` | Profile menu or Settings sidebar → Log out | Success, "local-only" warning, failure. |
| "You've been logged out — Your session ended. Log in again to continue." (info) | `components/shared/notification-session.tsx` | Session expires in another tab, or `SIGNED_OUT` | Needs a signed-in session that ends. |
| Google/email callback notices | `session-feedback.ts` | Redirects from `/auth/error` and `/auth/email-change` (cookie `resident-web-callback-notice`) | Google error; email error, changed, pending, confirmed. |
| Form validation toasts ("Check the highlighted registration details.", "Please fix the highlighted fields.", "Complete the required report details…", "Review the highlighted ID details.") | register, profile, report, ID flow | Submit with invalid fields | Error. |
| Save and request results (profile saved, request submitted, report submitted, payment method saved, pickup recorded, location saved, and so on) | many | After a write | Success, warning ("couldn't confirm…", uncertain outcome) or error. |
| "Couldn't refresh [thing]. Please try again." | `components/shared/read-failure.tsx` (`ReadRetryProvider`) | Click Try again on a failed server-side read and it fails again | Error. |
| Read-status toasts ("Announcement marked as read/unread", "Report marked as read/unread", "All announcements marked as read.") | `announcement-card.tsx`, `announcements-feed.tsx`, `incident-card.tsx` | Mark as read/unread buttons | Confirmed / accepted (info) / rejected (error) / uncertain (warning). |
| Payment toasts ("Payment QR code is ready.", "This QR code has expired.", "Payment received. Your receipt is ready.", cancel outcomes) | `qrph-step.tsx`, `success-step.tsx`, `request-tracking.tsx` | QR PH payment lifecycle | Success, warning, error. |
| Geolocation toasts ("Device location found.", "Location access is blocked…", "Your location is shown on the map.") | `registration-map.tsx`, `locate-button.tsx`, `new-report-form.tsx`, `location-verification-form.tsx` | Detect or locate buttons | Success or error, depending on permission outcome. |
| Download and share toasts ("Receipt download started.", "Your data download started.", "Download started.", "Copied to clipboard.") | `download-receipt-button.tsx`, `download-data/page.tsx`, `qr-show-dialog.tsx` | Download or share buttons | Success or error. |
| Theme preference toasts | `(r)/settings/theme/theme-form.tsx` | Change scheme, accent or font | Guest copy ("this device") vs account-saved, warning/error when the browser or account save fails. |
| Neutral toast "Email/SMS notifications enabled/disabled." | `(r)/settings/notifications/page.tsx` | Toggle a switch | Plain `toast()`; local state only. |

### 2b. Error and loading boundaries

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Root loading ("Loading Barangayan…") | Any route whose layout reads the session | `app/loading.tsx` | Slow first navigation | Spinner and label appear only after a 120 ms delay; "Taking longer than usual." after the slow threshold. |
| Root error boundary | Failures in layouts | `app/error.tsx` | Session read throws | `RouteError` ("This page couldn't load") with Try again and "Go to Home"; shows `Reference: <digest>` if there is one. |
| Resident loading skeleton | `(r)` segment | `(r)/loading.tsx`, `components/shared/page-skeleton.tsx` | Navigating between resident routes | List skeleton. Other variants: home (`(r)/home/loading.tsx`), form, detail (`services/[documentId]`, `services/requests/[requestId]`, `services/requests/new/[documentId]`), settings (`settings/loading.tsx`), map (`maps/loading.tsx`, `maps/directory`, `maps/preparedness`), Emergency and Health loading files. |
| Resident error boundary | `(r)` segment | `(r)/error.tsx`, `components/shared/route-error.tsx` | A page component throws | Error view inside the shell, with Try again (spinner "Trying again…") and "Go to Home". |
| Auth loading | `(auth)` segment | `(a)/loading.tsx` | Navigating to auth routes | Centred card skeleton plus "Loading…". |
| Auth error boundary | `(auth)` segment | `(a)/error.tsx` | Auth page throws | `RouteError` with "Go to Log In". |
| Inline read error | Many lists | `components/shared/inline-read-error.tsx` | A client fetch fails | **Error tone:** centred card with Try again. **Warning tone:** amber strip, "Showing the last loaded list, which may be out of date." |
| Server read failure | Server pages | `components/shared/read-failure.tsx` | A server query errors | Inline "We couldn't load …" with Try again (refreshes the route). |
| Auth gate | Guest on gated pages | `components/shared/auth-gate.tsx` | Guest opens `/reports`, `/health/my-registrations`, `/emergency/family`, `/emergency/scan` | Lock icon, title and description, Log In and "Create an Account". |
| Default 404 | Anything that calls `notFound()` | Next.js default (no `not-found.tsx` in the app) | See route index (section 14) | Framework default page. |

---

## 3. Auth

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Login (screen) | `/login` | `(a)/login/page.tsx` | Header Log In; any gated route (`?next=`); after logout | Two-column at `lg+` (brand panel plus form), single column below with logo and Back to Home. Intro copy changes with `?next=`. Banners: `?passwordReset=success` ("Password updated…"), `?authError` (Google failure). Inline errors: incorrect credentials, connection, rate-limit, service, profile-load failure. Button loading "Logging in…". Prefilled email via `?email=`. Includes the Google button. |
| Google button | Login, Register, Settings → Profile (link mode) | `components/auth/google-button.tsx` | Click | Idle; loading (spinner, "Connecting to Google…" for screen readers); inline error and toast ("Couldn't connect to Google. Please try again."). Link mode: "Link Google to this account". |
| Register (screen) | `/register` | `(a)/register/page.tsx`, `register-form.tsx` | Header Sign Up; Login → Create an account | Sticky brand panel at `lg+`. Sections: Personal Details, Address (barangay name, "Loading…" until fetched), city and province read-only, Employment (occupation field only for some statuses), Security. Field-level status (error, "success" tick), password strength and match indicators, choice chips (Sex, Employment). Banners: locality error plus "Retry locality", submit errors (duplicate email, weak or breached password, invalid email, signup disabled, unconfirmed result, email confirmation not supported). Button "Creating account…". |
| Registration location check (section) | Inside Register / Complete profile | `components/auth/registration-map.tsx`, `(r)/settings/location-verification/location-verification-map.tsx` | Scroll Register | Map "Loading map…"; status line (boundary unavailable / tap to select / inside / outside Ampid 1); GPS observation; Detect My Location (loading), Retry map, Confirm Location. Errors: permission denied, GPS timeout, map tiles failed. |
| Account created (dialog) | Over Register | `register-form.tsx` | Successful signup | "Account Created Successfully" with OK and "Proceed to Login". |
| Complete profile (screen) | `/complete-profile` | `(a)/complete-profile/page.tsx` (`RegisterForm completing`) | Redirected there after login or Google sign-in with an incomplete profile; the banner link on resident routes goes to Settings → Profile instead | Same form without the password section. Email is read-only. Extra buttons: Sign out, "Skip for now — browse information". Prefill error plus "Reload saved details". Guests are redirected to `/login`. |
| Forgot password (screen) | `/forgot-password` | `(a)/forgot-password/page.tsx` | Login → Forgot password? | Email field; errors (connection warning, rate-limit, service, generic); button "Sending code…"; success toast then redirect to Verify OTP. |
| Verify reset code (screen) | `/verify-otp?email=…` | `(a)/verify-otp/page.tsx`, `verify-otp-form.tsx` | After Forgot password | Masked email, 6-digit input, Resend code with a 45 s countdown ("Resend code in 00:xx"), "Resending…". Errors: invalid/expired, connection, rate-limit, service. "Recovery session changed or ended" lock state. |
| Verify reset code, Settings variant | `/verify-otp?source=settings` | same | Reached from Settings → Change Password recovery | Includes a "Back to Change Password" link. If recovery state is invalid: "Password recovery" message card with a back link. |
| Reset password (screen) | `/reset-password` | `(a)/reset-password/page.tsx`, `reset-password-form.tsx` | After a verified code | Two password fields with validation messages; session-ended error; "Password updated" state; sign-out step; Settings variant (`?source=settings`) ends with a redirect to `/login?passwordReset=success`. Invalid recovery state renders the same message card as above. |
| Google sign-in failed (screen) | `/auth/error` | `app/auth/error/page.tsx` | Failed or cancelled Google OAuth callback | Static message with Return to login / Return to profile links. Unstyled `<main>`. |
| Auth callback (redirect handler) | `/auth/callback` | `app/auth/callback/route.ts` | Google OAuth return | No UI. Redirects to `/auth/error` on failure, otherwise to `next` or `/complete-profile`. |
| Email change callback (redirect handler) | `/auth/email-change` | `app/auth/email-change/route.ts` | Email-change confirmation link | No UI. Redirects to `/settings/email-verification` (`?emailChangeError=1` on failure) or `/login?next=…`. |
| Auth layout redirect | `(a)` group | `(a)/layout.tsx` | Visit auth routes while signed in | Signed-in users are redirected to `/home`, except `/reset-password`, `/verify-otp` and `/complete-profile`. |

---

## 4. Home and Search

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Home — guest landing | `/` (redirects) → `/home` | `(r)/home/page.tsx`, `components/home/guest-hero.tsx`, `landing-features.tsx`, `latest-announcement-card.tsx`, `landing-footer.tsx` | Open the site while signed out | Hero ("Your barangay. Closer than ever.") with Get Started and Log In; 3 highlight cards; four numbered feature rows with "Open to all" / "Account" tags, scroll-reveal animation, feature shortcut anchors; latest-announcement card; CTA band; footer. Announcement block: card / "all caught up" empty / read-failure. Hidden entirely when there is no announcement and no error. No search bar. |
| Home — signed-in dashboard | `/home` | same plus `home-search-bar.tsx`, `quick-action-tile.tsx`, `email-verify-banner.tsx` | Signed in | Search bar; email banner ("Email verification pending." or "Your email address is not yet verified."; hidden when verified); 4 quick-action tiles; Community updates (latest announcement: card / empty / read-failure); Recent Requests and Recent Reports panels, each with list / empty / read-failure; footer. Skeleton: `(r)/home/loading.tsx`. |
| Search suggestions (dropdown) | Home search bar, `/search` header | `components/search/search-input.tsx`, `search-loading.tsx` | Focus the search field | Empty query: "Explore your barangay" shortcuts. Typing: suggestion skeleton, up to 6 suggestions plus "See all results for …", "No suggestions found…", error or "Some suggestions are unavailable." with Try again. Keyboard-highlighted option. Clear button; submit shows a spinner while navigating. |
| Search results (screen) | `/search?q=&category=&page=` | `(r)/search/page.tsx`, `components/search/search-results.tsx`, `lib/search/query.ts`, `app/api/search/route.ts` | Submit search, or choose a suggestion | No query: "What are you looking for?" with shortcuts. Loading: result skeleton and "Searching for …". Results: grouped with highlighted matches, count line, "See all" per group, pagination (Previous / Next, "Page x of y") when a single category is selected. Empty: "No results found" with an optional "Search all categories". Error: alert with Try again, plus "Showing the last loaded results, which may be out of date." Partial failure: "We couldn't load [categories]. Other results are shown below." **Guest:** no "My requests" or "My reports" filters or results. The API returns 503 JSON ("We couldn't search right now…") on failure. |

---

## 5. Announcements

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Announcements feed (screen) | `/announcements` | `(r)/announcements/page.tsx`, `announcements-feed.tsx`, `components/reports/announcement-card.tsx` | Nav → Announcements; Home "View all" | Filter chips: All, General, Emergency, Health, Events. Result count. "Mark all as read" (disabled when there is no unread; "Marking as read…"). "Updating" hint. States: 3 skeleton cards; list; empty ("No announcements yet." / "No [Category] announcements."); full error with Try again; stale-warning strip when a refresh fails. Cards show Unread/Read state and mark-read buttons. **Guest:** all barangays' feed (no barangay filter); read controls rely on a signed-in unread-count context. |
| Announcement modal | Over `/announcements` | `components/reports/announcement-modal.tsx` | Click a card | Dialog with category chip, title, relative and absolute timestamp, scrollable body, Close. |
| Announcement detail (screen) | `/announcements/[announcementId]` | `(r)/announcements/[announcementId]/page.tsx` | Search result link or direct URL | Article card with category, title, date, body, optional detailed description. Errors: read failure; signed-in user without profile → "couldn't load your barangay information". **404** when the id is missing or deleted. |
| Emergency alerts (screen) | `/emergency/alerts` | see section 11 | | |

---

## 6. Services — Documents and request drawer

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Services index (redirect) | `/services` | `(r)/services/page.tsx` | Nav → Services | Redirects to `/services/documents`. |
| Document catalog (screen) | `/services/documents` | `(r)/services/documents/page.tsx`, `components/services/documents-list.tsx` | Services nav; Home "Request a Document" | Grid of document cards (name, description, price label, processing label); active card gets a "Viewing" tag and the grid collapses to one column while the panel is open. Empty: "No document types are available right now." Read failure. Guest sees the same catalog and the page works. |
| Document request panel (right drawer, 3 stages) | Over `/services/documents` | `components/services/document-request-modal/document-request-modal.tsx` | Click a document card | Header with eyebrow "Document services", step title and progress list Details → Request → Payment. Loading skeleton plus "Loading service…"; "We couldn't load this service" + "Retry loading service"; "This service isn't available right now" + "Back to the catalog". Slides in from the right. No overlay, the page stays interactive. |
| Stage 1 — Details | Inside the panel | `document-request-modal/details-step.tsx`, `ServiceCharter` in `resident-service-form.tsx` | Open the panel | Fee and processing overview; "What you'll need" list; "Bring your original documents" note; Service guidelines (charter sections, or a plain requirements list for legacy documents). CTA: "Request This Document" (signed in) or "Log In to Request" (guest). |
| Stage 2 — Request form | Inside the panel | `request-form-step.tsx`, `components/services/resident-service-form.tsx`, `components/auth/resident-action-guard.tsx` | "Request This Document" | **Guard states:** "Checking your account…"; "We couldn't check your account" + "Retry account check"; "Before you continue" dialog. **Dialog variants:** complete profile only / verify ID only / both, with an embedded profile notice and/or "Verify Now" notice. **Form:** Resident Details block (name, mobile, "Edit in Profile"); "Approved profile ID" block states `verified` / `pending` / `failed` / `missing` (with ID images when approved, "Refresh verification"); legacy services show an optional ID upload. Fields vary by service kind: purpose select plus explanation (≤1000 chars with counter); business (name, address, DTI upload); indigency / first-time job seeker (HOA upload, renter checkbox, lessor upload); certified true copy (reference, copies, total pages); personal-appearance checkbox. Submit disabled until approved ID evidence is loaded. States: stage text while submitting, red error line, amber "submission-guidance" box with "Open My Requests" for uncertain outcomes. |
| Stage 3 — Payment | Inside the panel | `components/services/request-payment-journey.tsx` | After submitting a request | See section 8. |
| Document detail (standalone) | `/services/[documentId]` | `(r)/services/[documentId]/page.tsx` | Search "Documents & services" result, or direct URL | Title, price pill, requirements card, Processing & Pickup card, notes, charter, CTA (Request This Document / Log In to Request). Skeleton `detail`. Read failure; **404** for a missing document. |
| New request form (standalone) | `/services/requests/new/[documentId]` | `(r)/services/requests/new/[documentId]/page.tsx`, `new-request-form.tsx` | Deep link (guards in the drawer use this as the `next` target) | Heading plus the same `ResidentServiceForm`; on success replaces the URL with `/services/payment/<id>`. **Guest:** redirected to `/login?next=…`. Incomplete profile: redirected to `/complete-profile?next=…`. **404** or read failure on a missing or inactive document. |

---

## 7. Services — Requests, tracking, logs

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| My Requests (screen) | `/services/requests?tab=all\|active\|pickup\|history&open=<id>` | `(r)/services/requests/page.tsx`, `requests-list.tsx` | Services nav; Home tile | Heading, New Request button, status tabs All / Active / Pickup / History. Cards show name, reference, date, payment pill, status pill and a timing note ("Taking longer than usual", "Nearing expected completion time", "Previous timing model", or the agency SLA line). Selected card gets a "Viewing" tag. Empty: "You haven't submitted any requests yet." / "No requests in this category." plus a "Request your first document" link. Read failure keeps the drawer usable. `?open=<id>` opens the drawer immediately. **Guest:** redirected to login. |
| Agency SLA status | Request cards and tracking | `components/services/agency-sla-status.tsx` | Requests with `timing_model = agency_minutes_v1` | "Loading processing clock…"; error with Retry; compact vs full layout; position label (various), "Waiting for resident: …", agency / resident / total durations, pause list; "Couldn't refresh — this may be out of date." |
| Request tracking drawer | Over `/services/requests` | `(r)/services/requests/request-drawer.tsx` | Click a request card | Right drawer titled "Request Tracking". States: skeleton plus "Loading request…"; ready (tracking content); "This request isn't available"; "We couldn't load this request" with Try again and Close. |
| Request tracking (standalone) | `/services/requests/[requestId]` | `(r)/services/requests/[requestId]/page.tsx`, `request-tracking.tsx` | "Track My Request" links, search result, Home recent-requests row | Header; processing-time card (legacy % bar) or SLA block; Payment card (method label, StatusPill, amount: free / fixed / see tax code); buttons "Pay Now with QR PH" / "Continue Payment m:ss", "Cancel Payment", "Cancel Request" (with confirm dialog). Status History timeline (Submitted → Processing → Ready for Pickup → Completed) with notes; cancelled variant ("This request was cancelled."). Optional Purpose / supporting-details card; "Choose or continue payment"; additional-notes card. Live updates over realtime. Skeleton `detail`; read failure; **404**. |
| Cancel request / cancel payment confirmation | Inside tracking | `components/shared/confirm-dialog.tsx` | Click Cancel Request | Dialog "Cancel Request — This cannot be undone." with "Never mind" / "Yes, Cancel" (loading). Cancel Payment uses the edge function directly (no dialog) in tracking, but the QR step uses a confirm dialog ("Cancel Payment?"). |
| Activity log (screen) | `/services/logs` | `(r)/services/logs/page.tsx` | Services nav → Logs | Grid of activity cards (name, last-updated time, fee, status pill). Empty "No activity yet."; read failure. **Guest:** redirected to login. |

---

## 8. Payments

All payment screens share `components/services/request-payment-journey.tsx`; the same journey shows in the Stage 3 panel and on standalone routes.

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Payment journey (loader) | `/services/payment/[requestId]`, `/payment/pickup/[requestId]`, `/payment/qrph/[requestId]`; also Stage 3 of the document panel | `(r)/services/payment/**/page.tsx`, `request-payment-journey.tsx`, `loading.tsx` | After submitting, "Choose or continue payment", or "Pay Now" | Skeleton plus "Loading request and payment details…"; error "We couldn't load the payment details" + Try again; stale warning strip "What you see may be out of date" (refreshes every 10 s and on focus); **already-resolved card** ("Payment received" / "Fee waived" / "No payment required" / "Request cancelled/completed") with confirmed amount and a "View My Request" link. Initial step varies by route (method / pickup / qrph). **404** or read failure on the page for a missing request; guests are redirected. |
| Page count (step) | Journey | `components/services/request-page-count.tsx` | Requests whose fee is `page_count_required` | "Payment Method" heading, total-pages input, "₱10.00 per page. Total: …", validation error, "Continue to payment methods" (loading). |
| Payment method (step) | Journey | `document-request-modal/payment-method-step.tsx` | Journey step "method" | Fee summary (Free / amount / "See Attached Tax Code…"), options "Pay at Pickup" and "Pay with QR PH"; QR PH hidden for pickup-only or ≤₱1.00. QR PH shows a "Setup in Progress" tag and a "being finalized" note when `NEXT_PUBLIC_QRPH_SETTLEMENT_READY` is not `"true"` (Continue disabled for QR PH). "No payable amount" note. Error text and a warning/error toast on save failure. Optional billable-pages line. |
| Pay at Pickup (step) | Journey | `document-request-modal/pickup-step.tsx` | Choose Pay at Pickup | Amount-due card; saving ("Recording your pickup payment…"); saved ("Pickup payment recorded…"); failed with "Retry recording pickup payment". "View My Requests" enabled only after saved. |
| QR PH payment (step) | Journey | `document-request-modal/qrph-step.tsx`, `hooks/use-paymongo-source.ts` | Choose Pay with QR PH | Skeleton QR plus "Generating your QR code…"; QR image with "Expires in m:ss" and transaction ref; "How to Pay" list; "Waiting for payment…" strip; guidance/error line; "having trouble checking your payment status" note; "expiry time has passed" note; **error** (cannot be paid / cannot start) with Go Back; **expired** with "View My Request"; **cancelled**; **paid** ("Payment received"). "Cancel Payment" confirm dialog. |
| Payment confirmed (dialog) | Over the QR step | `components/services/payment-confirmed-dialog.tsx` | Payment detected as paid | Non-dismissible "Payment successful" with OK. |
| Payment success (step) | Journey | `document-request-modal/success-step.tsx` | After the OK button | Loading skeleton; receipt error ("We couldn't load your payment receipt") + Retry receipt; "receipt isn't confirmed yet"; **ready** card (amount, ref, date, method, fee, transaction ref) with Track My Request, Download Receipt and Return to Home. |
| Payment success (standalone) | `/services/payment/success?requestId=` | `(r)/services/payment/success/page.tsx` | Direct link | Same receipt card; read failure ("If you already paid, don't pay again."); no-receipt alert with a "Return to request payment" link. Query params other than `requestId` are not read. |
| Download receipt | Success step and page | `components/services/download-receipt-button.tsx` | Click | Generates a PDF client-side; toasts for start or failure. |

---

## 9. Reports

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Reports (guest gate) | `/reports` | `(r)/reports/page.tsx` | Nav → Reports as a guest | `AuthGate` "Log In to See Your Reports". |
| My Reports (screen) | `/reports` | `(r)/reports/my-reports-tabs.tsx`, `components/reports/incident-card.tsx`, `report-sort-menu.tsx` | Signed in | Filter chips All reports / Active / Resolved; sort menu (Latest first, Oldest first, Most confirmed, Title A–Z); "Report an Incident" button. List states: 4 skeleton cards, "Reports couldn't load" + Try again, empty ("Your reports start here" with a Report button / "No active/resolved incident reports"), cards. Card: category icon, status chip (Open / In Progress / Resolved / Withdrawn), thumbnail, confirmations count; resolved cards show "New update"/"Update read" and mark-read buttons. |
| Sort menu (popover listbox) | My Reports toolbar | `components/reports/report-sort-menu.tsx` | Click the sort control | Closed/open with the selected option marked; typeahead support. |
| Incident drawer | Over `/reports` | `components/reports/incident-drawer.tsx` | Click a report card | Right drawer "Incident Report" with skeleton, then the detail body (below). |
| New-report drawer | Over `/reports` | `components/reports/new-report-drawer.tsx` | "Report an Incident" button | Right drawer wrapped in `ResidentActionGuard` (see section 6, action `report`). Form load states: "Loading report form…", "We couldn't load the report form" + "Retry loading form". |
| New report form | Drawer, or `/reports/new` | `(r)/reports/new/new-report-form.tsx`, `(r)/reports/new/page.tsx`, `components/reports/location-picker-map.tsx` | Drawer, Home tile, Maps "Report an incident" | Fields: title, category chips (colour per category; "No categories configured."), collection-zone chips (only for trash-related categories), description, photos (max 5, add / preview / remove), location map with draggable pin plus boundary, "Use My Location" (Locating… / Location captured ✓), auto-detected address, specific area details. Button "Submit Report" / "Uploading photos…" / "Submitting…", disabled until title, category and location are set. Inline error line. Photo rejection toasts (type, >10 MB). Standalone route: **guest** → login; incomplete profile → complete-profile. |
| Incident detail (standalone) | `/reports/[incidentId]` | `(r)/reports/[incidentId]/page.tsx`, `incident-detail.tsx` | Search result, Home recent-reports row (not linked), direct URL | Photo carousel with lightbox, header card (title, status chip, category, description), Location card (map, address, coords, area details), meta card (reported, updated, confirmations), Status History timeline. Status variants: **open** (withdraw available within 24 h; "24-hour window closed" note afterwards), **in progress**, **resolved** (green banner), **withdrawn** (banner), **unresolved** (banner, red timeline note). Withdraw button flow: button → inline "Withdraw this report? …" → loading. **404** if not found or not owned. |
| Photo lightbox | Over incident detail | `incident-detail.tsx` (`PhotoCarousel`) | Click the photo | Full-screen dark dialog with Close; prev/next only in the carousel. |

---

## 10. Health

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Active Drives (screen) | `/health` | `(r)/health/page.tsx`, `components/health/active-drives-content.tsx`, `drive-calendar.tsx`, `drive-card.tsx`, `category-filter-pills.tsx` | Nav → Health | Month calendar with event dots, month/year picker overlay, "Jump to Today", category filter pills (All, Vaccination, Maternal Care, Blood Drive, Medicine Distribution, Dental Care, Optical Care, and more from `DRIVE_TYPES`). Result header with count, loading text ("Finding scheduled drives…"), error alert, skeleton cards, empty ("No drives on this date"). Drive card: type badge, Registered badge, stock bar, `Full` disabled button, "Log In to Register" for guests, "You're registered" for already-registered. |
| Month/year picker (popover) | Calendar | `drive-calendar.tsx` | Click the month title | "Select Month & Year" with year prev/next and month grid. |
| Drive registration drawer | Over `/health` | `components/health/register-drawer.tsx` | Click Register on a card | Right drawer "Drive Registration" using `ResidentActionGuard` (action `drive`). Skeleton while loading data; then the applicant form. No visible error state if the drive or profile fetch fails (see coverage notes). |
| Applicant form | Drawer, or `/health/register/[driveId]` | `components/health/applicant-form.tsx`, `(r)/health/register/[driveId]/page.tsx` | Drawer, or deep link | "Registering for" select (self or household member), age field (override for members), address summary, Eligibility Information (PWD toggle, comorbidities, prior dose with date), consent checkbox. Error banner (consent, invalid age, rejected, unconfirmed). Button "Submit Registration" / "No Slots Available" / loading. **Success state:** "Registration Confirmed!" with the applicant number. Standalone route: guest → login; **404** if the drive is missing. |
| My Registrations (screen) | `/health/my-registrations` | `(r)/health/my-registrations/page.tsx`, `components/health/my-registrations-content.tsx` | Health tab | Guest: `AuthGate`. Status filters All / pending / confirmed / attended / cancelled (each with a count). Loading skeletons, empty (all / per-status with different copy and CTAs), registration cards (type badge, status, date, location, applicant number). |
| Registration details drawer | Over My Registrations | `components/health/registration-drawer.tsx` | Click a registration | Drive title, applicant number, status, details. |
| Medical drive detail (standalone) | `/health/drives/[driveId]` | `(r)/health/drives/[driveId]/page.tsx` | Search "Medical drives" result | Article card: date, time, location, eligibility, stock remaining; CTA "Register for this drive" (signed in), "Log in to register" (guest), or hidden/disabled message when full or past. Read failure; **404**. |

---

## 11. Emergency

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Emergency Hub (screen) | `/emergency` | `(r)/emergency/page.tsx`, `components/emergency/hub-content.tsx`, `emergency-accordion.tsx`, `hotline-row.tsx` | Nav → Emergency; Home footer | Two panels: "01 / PREPARE" guidelines accordion (collapsed/expanded rows), "02 / GET HELP" hotline rows with `tel:` links. Each panel: skeleton rows, empty ("No guidelines/hotlines available."), error card, stale-warning strip, "Updating" hint. Guest can see it. |
| Evacuation Centers (screen) | `/emergency/centers` | `(r)/emergency/centers/page.tsx`, `centers-content.tsx`, `evacuation-center-card.tsx`, `centers-map.tsx`, `horizontal-center-picker.tsx` | Emergency → Centers; Maps sidebar | **List view:** count, cards (name, verified badge, address, distance and ETA when located, occupancy bar that turns amber ≥80% and red/"FULL" at 100%, facilities, "View center on map"). **Map view:** boundary, centre pins, user marker, pending fix marker, route polyline, search bar, locate / reset / fullscreen buttons, collapsible "Evacuation Centers" picker with selected-centre card ("Fetching walking route…", route stats, "unavailable", "Set your location…"). Loading skeletons, empty, error (full or stale warning). |
| Location status card | Centers | `location-status-card.tsx`, `packages/shared/src/lib/device-location.ts` | Centers screen | Messages and actions per state: not set ("Use my location"), checking permission, finding (slow variant), confirm ("Use this location" / "Discard"), last known, permission off or blocked, services off, insecure context, unsupported browser, error, timeout ("Try again"). |
| Route status card | Centers | `route-status-card.tsx`, `hooks/use-connected-route.ts` | After a location and a selected centre | Calculating spinner; failed (route service unreachable) with retry; ready with freshness line; stale with "Showing the last route received…"; messages: ambiguous street (street picker buttons), outside Ampid I coverage, no nearby path, no route within coverage, centre unavailable, restrictions unmapped, invalid origin; "recommended route is N m longer…" explanation; unconfirmed availability note. |
| Scan / check-in guide (screen) | `/emergency/scan` | `(r)/emergency/scan/page.tsx`, `scan-content.tsx` | Emergency → Scan | Guest (or no barangay): `AuthGate`. Signed in: intro text, "why scan" card, "how it works" steps; skeleton / error / stale states; "Ready to check in?" panel with Scan QR and Show QR; QR upload fallback. |
| QR scanner (full-screen dialog) | Over Scan | `components/emergency/qr-scanner-dialog.tsx` | Scan QR | States: starting ("Starting camera…"), scanning (frame instructions), processing ("Checking you in…"), unavailable with guidance per problem (denied, no camera, in use, unsupported, unknown) and Retry/Close. Result toasts for bad codes. |
| QR upload fallback | Scan | `qr-upload-fallback.tsx` | Scan page | File input "QR code image"; "Reading the QR image…"; error toasts. |
| Show QR dialog | Over Scan | `components/emergency/qr-show-dialog.tsx` | Show QR | Centre select (loading / error / empty / list), generated QR, Share (loading "Sharing…"), Download, copy-to-clipboard fallbacks, "Unable to generate QR code". |
| Family (screen) | `/emergency/family` | `(r)/emergency/family/page.tsx`, `family-content.tsx` | Emergency → Family | Guest: `AuthGate`. Non-resident account: "An active resident profile is required…". Signed in: "My QR Code" card, Family Members toolbar (count, refresh), account-holder row plus member rows with attendance text (checked in / last departure / "No recorded check-in" / "Attendance unavailable" / "Last known status"), Add Family Member (disabled at 30, with note). Skeleton, error, stale warnings, "Your session or account changed…" lock. |
| Household QR dialog | Over Family | `household-qr-dialog.tsx` | Show My Code | Spinner → QR canvas; failure with message and Try again. |
| Family member dialog | Over Family and Settings → Profile | `family-member-dialog.tsx` | Add Family Member / click a member | Add and Edit variants: name, Relation chips, Role chips; Remove (loading "Removing…"), Save ("Adding…"/"Updating…"); inline status message. |
| Emergency alerts (screen) | `/emergency/alerts` | `(r)/emergency/alerts/page.tsx`, `alerts-content.tsx` | Emergency → Alerts; Maps sidebar | Date-range filters (All, Today, Last Week, Last Month, Last Year), collapsible "Filter by specific date" (month, day, year inputs; count badge), skeletons, error, stale warning, empty ("No emergency alerts found." with a hint), alert cards. |

---

## 12. Maps

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Community map (screen) | `/maps` | `(r)/maps/page.tsx`, `components/maps/map-canvas.tsx`, `map-client-wrapper.tsx`, `map-segment-toggle.tsx`, `map-search-bar.tsx`, `map-filter-pills.tsx`, `map-sidebar.tsx` | Nav → Maps | Summary line ("N incidents · N evacuation centers"); segment toggle Incidents / Evacuation with counts; search with suggestion dropdown ("Recent incidents" / "Evacuation centers to explore"); category filter pills (**signed-in only**, since categories are only loaded with a profile); filter summary with "Clear filters"; geolocation notice (unavailable / blocked); map with clusters, boundary, user marker, locate, fullscreen; empty overlay ("No incidents match your filters", "No evacuation centers available / match your search"); caption "N shown · Barangay boundary". Loading: map skeleton plus "Loading the map…". |
| Map popups | Over map | `components/maps/map-marker-popup.tsx`, `map-canvas.tsx` | Click a marker, or choose a search result | Incident popup (title, category chip, address, status pill); Evacuation popup (occupancy, "View in Evacuation Centers →"); "You are here". |
| Map resources sidebar | Beside/below `/maps` | `components/maps/map-sidebar.tsx` | Maps | "Report an incident" button and 5 resource links (Emergency Hub, Evacuation Centers, Emergency Alerts, Directory, Preparedness Guide). |
| Fullscreen map | `/maps`, centers map | `components/maps/fullscreen-button.tsx`, `boundary-fit-button.tsx`, `hooks/use-fullscreen.ts` | Fullscreen button | Enter and exit states; the same control also appears on the centers map. |
| Directory (screen) | `/maps/directory` | `(r)/maps/directory/page.tsx`, `components/maps/directory-content.tsx` | Maps sidebar; footer | Back to Map link; search field; hotline rows; "Updating"; skeleton; full error; stale warning; empty ("No contacts available." / "No contacts match your search."). |
| Preparedness guide (screen) | `/maps/preparedness` | `(r)/maps/preparedness/page.tsx`, `components/maps/preparedness-guide.tsx` | Maps sidebar | Accordion with Earthquake, Typhoon & Flooding, Fire, Power Outage (static content). |

---

## 13. Settings

### 13a. Entry and Account

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Settings index (redirect) | `/settings` | `(r)/settings/page.tsx` | Nav → Settings; profile menu | Signed in → `/settings/profile`; guest → `/settings/theme`. |
| Profile (screen) | `/settings/profile` | `(r)/settings/profile/page.tsx`, `profile-form.tsx` | Settings → Profile; profile menu → My Profile; banner link | Avatar with hover camera and "Change Photo" (uploading overlay), email chip ("Email verified" / "Email not verified" + Verify Email), locality line, personal fields with live validation (✓ and error rows), sex and employment chips, date-of-birth button (opens the calendar dialog), address fields (city read-only when the locality is fixed), "You have unsaved changes." hint, Save Changes ("Saving…"), Household Members section, "Link Google to this account" button. Guest: redirected to login. |
| Date-of-birth calendar (dialog) | Over Profile and Valid ID | `components/birthday-calendar-modal.tsx`, `(r)/settings/valid-id/birthday-dialog.tsx` | Date button | Month grid with prev/next and a year/month picker; "Select Date of Birth". |
| Household members section | Inside Profile | `profile-form.tsx` (`HouseholdSection`), `family-member-dialog.tsx` | Scroll Profile | List with edit and remove icons, "No household members added yet.", Add button (disabled at 30 or while editing is paused), session-changed lock ("Your session or account changed…"), status text. Uses the same Add/Edit dialog as Family. |
| Valid ID — wizard | `/settings/valid-id` | `(r)/settings/valid-id/page.tsx`, `valid-id-flow.tsx` | Settings → Valid ID; "Verify Now" links | Four steps with a progress bar: 1 Select ID type (including "Other" free text), 2 Provide an ID photo (Upload or camera), 3 Review and confirm details (optional "Read details from photo" OCR, form fields, date-of-birth button), 4 Review and submit. Status aside (checking / error / current verification copy). Busy states (upload, OCR, publish), cancel buttons, field errors, OCR feedback with "Try reading again", uncertain-submit retry. |
| Valid ID — saved view | Same route | `valid-id/saved-id.tsx` | Verification is `verified` or `pending`, or after submitting | Heading "Valid ID" (verified) or "ID submitted". Status banner: verified / pending / failed (with rejection reason) / needs checking. ID details list and the ID photo (signed URL; photo-failed error). "Submit a replacement ID" starts the wizard (with a "Back to …" button). Loading and error states for each part. |
| Valid ID — unavailable (cards) | Same route | `valid-id/page.tsx`, `valid-id-flow.tsx` | Account read fails, setup pending, non-resident role, session changed | Heading plus alert ("Your account information is unavailable…" with a retry link and Back to Settings), "Sign in with a resident account to submit an ID.", "Your session changed…". |
| Camera capture (dialog) | Over Valid ID | `valid-id/camera-dialog.tsx` | "Take a photo" in step 2 | Live preview, capture, loading and "Camera unavailable. Upload an existing photo." |
| Email Verification (screen) | `/settings/email-verification` | `(r)/settings/email-verification/page.tsx`, `verification-form.tsx`, `change-email-form.tsx` | Settings → Email Verification; Home banner is not linked | Status card states: **Verified**, **Not verified** (Send verification code), **Awaiting verification** (6-digit input, Verify email, Resend code with a 60 s countdown), **Action needed** (profile email ≠ sign-in email → "Use current sign-in email"). Inline message box. "Change email address" section: collapsed button, form (new email, "Send confirmation email" with a countdown), pending view (Requested email, Check confirmation, Resend confirmation, Choose another email). `?emailChangeError=1` shows a notice; `?changeEmail` opens the form. Load failure card ("Unable to load your profile…"). Session-changed message. |
| Location Verification (screen) | `/settings/location-verification` | `(r)/settings/location-verification/page.tsx`, `location-verification-form.tsx`, `location-verification-map.tsx` | Settings → Location Verification | Large map with boundary, status pill ("Locating you…" / "Tap or drag the pin"), red banner "Please pin a location inside … boundary." Details card: "Previously Saved Location", Detected Address textarea (loading spinner, "Couldn't detect this address automatically"), coordinates, "Detect Your Location" and "Save My Location" / "Location Saved ✓". |
| Change Password (screen) | `/settings/change-password` | `(r)/settings/change-password/page.tsx`, `change-password-form.tsx` | Settings → Change Password | Current / new / confirm fields with strength and match status; submit disabled until all are filled; errors (incorrect password, rate-limit via toast, connection). "Forgot password?" trigger opens the recovery dialog. |
| Forgot password (dialog, 5 stages) | Over Change Password | `change-password/forgot-password-dialog.tsx` | "Forgot password?" | Stages: send ("Reset your password" + "Send reset code", with "Check again" and eligibility checks), "Email not verified" (link to Verify email), "Enter reset code" (verify, resend with a countdown), "Choose a new password", "Password updated" (Continue to login). "Start again", session-changed lock, and inline error messages. |
| Notifications (screen) | `/settings/notifications` | `(r)/settings/notifications/page.tsx` | Settings → Notifications | Two switches (Email on, SMS off) with neutral toasts; note that web push is not available. Not persisted. |

### 13b. Preferences, Privacy and About

| Name / type | Route / parent | Source | How to reach | States and variants |
|---|---|---|---|---|
| Theme & Appearance (screen) | `/settings/theme` | `(r)/settings/theme/page.tsx`, `theme-form.tsx`, `components/theme/*` | Settings → Theme (the only account-less Settings page besides About) | Sections Color Scheme (Light / Dark cards), Font Style, Accent Color (Presets, Your colours, add custom colour), live preview, footer hint. Copy changes for guest ("on this device") vs signed in ("sync across devices"). |
| Colour picker (popover) | Over Theme | `components/theme/color-picker-popover.tsx` | "New color" | Dialog "Color picker" with channel sliders, hex input, error text, "Save color" (disabled at the max). |
| Download My Data (screen) | `/settings/download-data` | `(r)/settings/download-data/page.tsx` | Settings → Download My Data | Two buttons (JSON, PDF). Exporting state ("Preparing your export…", buttons disabled). PDF opens a print window, popup-blocked error toast. No server gate on the page itself. |
| Delete Account (screen) | `/settings/delete-account` | `(r)/settings/delete-account/page.tsx`, `delete-account-form.tsx` | Settings → Delete My Account | Step 1: warning list, acknowledgement checkbox, Continue (disabled until ticked). Step 2: password field with show/hide, Back, "Delete Account" ("Deleting…"). Errors: incorrect password, rate-limit, service, connection, uncertain deletion, "account changed". |
| Help Center (screen) | `/settings/help` | `(r)/settings/help/page.tsx`, `help-center-client.tsx` | Settings → Help Center; Home footer; Search shortcut | Category tabs (All, General, Services, Emergency, Health, Billing, Account); 4 skeletons; "Unable to load help articles" with Retry; empty ("Nothing here yet"); FAQ cards (selected state). |
| Help article drawer | Over Help Center | `(r)/settings/help/article-drawer.tsx` | Click a FAQ card | Right drawer "Help Article" with category chip, question, answer. |
| Help article (standalone) | `/settings/help/[articleId]` | `(r)/settings/help/[articleId]/page.tsx` | Search "Help articles" result | Back link; article card, or "Article not found" (renders inline, not a 404). |
| Terms & Privacy (screen) | `/settings/terms-privacy` | `(r)/settings/terms-privacy/page.tsx`, `terms-privacy-client.tsx` | Settings; footer | Two collapsible markdown sections (expanded by default), skeletons, empty "Content Coming Soon". No error state in the component. |
| About Us (screen) | `/settings/about` | `(r)/settings/about/page.tsx`, `about-client.tsx` | Settings; footer | Logo and title, Mission / Vision cards, History, Contact card, developers; skeletons; empty "About Us content is not yet available." Parts render only when data exists. |

---

## 14. Route index

| Route | Kind | Guest | Notes |
|---|---|---|---|
| `/` | Redirect → `/home` | Yes | `app/page.tsx` |
| `/home` | Screen | Landing | See section 4 |
| `/search` | Screen | Yes (fewer categories) | |
| `/announcements`, `/announcements/[id]` | Screen | Yes | Detail 404s on missing |
| `/services` | Redirect → `/services/documents` | Yes | |
| `/services/documents`, `/services/[documentId]` | Screen | Yes | Detail only reached by search or URL |
| `/services/requests`, `/services/requests/[id]`, `/services/requests/new/[documentId]`, `/services/logs` | Screen | Redirect to login | |
| `/services/payment/[id]`, `/payment/pickup/[id]`, `/payment/qrph/[id]`, `/payment/success` | Screen | Redirect to login | |
| `/reports` | Screen or gate | Gate | |
| `/reports/new`, `/reports/[id]` | Screen | Redirect to login | |
| `/health`, `/health/drives/[id]` | Screen | Yes | |
| `/health/my-registrations` | Screen or gate | Gate | |
| `/health/register/[id]` | Screen | Redirect to login | |
| `/emergency`, `/emergency/centers`, `/emergency/alerts` | Screen | Yes | |
| `/emergency/scan`, `/emergency/family` | Screen or gate | Gate | |
| `/maps`, `/maps/directory`, `/maps/preparedness` | Screen | Yes | |
| `/settings` | Redirect | Yes (→ theme) | |
| `/settings/theme`, `/settings/help`, `/settings/help/[id]`, `/settings/terms-privacy`, `/settings/about` | Screen | Yes | |
| `/settings/notifications`, `/settings/download-data` | Screen | Render without a gate | See coverage notes |
| `/settings/profile`, `/valid-id`, `/email-verification`, `/location-verification`, `/change-password`, `/delete-account` | Screen | Redirect to login | |
| `/login`, `/register`, `/forgot-password` | Screen | Yes (signed-in users redirect to `/home`) | |
| `/verify-otp`, `/reset-password` | Screen | Yes (allowed while signed in) | |
| `/complete-profile` | Screen | Redirects to `/login` | |
| `/auth/error` | Screen | Yes | |
| `/auth/callback`, `/auth/email-change`, `/api/search` | Route handlers (no UI) | Varies | |

---

## 15. Coverage notes

**Could not confirm from the code alone**

- **Real data content.** Document catalog entries, FAQ articles, announcements, hotlines, guidelines, Terms/Privacy and About Us copy, drive types in use, and QR "why scan / how it works" content all come from the database. The code only defines how they render. Exact wording and counts need seeded data.
- **Backend-condition screens.** Several states depend on conditions that are hard to reproduce locally:
  - QR PH states (pending, expired, cancelled, paid, status-check-failed, expiry-passed) need PayMongo or a stubbed payments table, and the QR option is hidden behind `NEXT_PUBLIC_QRPH_SETTLEMENT_READY === 'true'`.
  - "Page count required", "pickup due" and "business" fee states need specially configured document types and requests.
  - The agency SLA clock needs requests with `timing_model = agency_minutes_v1` and the `service_request_sla_tracking` RPC.
  - Route-service states on Evacuation Centers (ambiguous street, outside coverage, no route, restrictions unmapped, stale route) depend on the external route service and graph data.
  - `unresolved` incident status is rendered in the detail view but is not in `INCIDENT_STATUS_META`, so its pill falls back to a raw grey label.
  - Settings recovery pages that show the "Password recovery" message card require specific session or intent states.
  - The "profile check unavailable" banner and "account setup pending" notice need a failing Supabase read at layout time.
  - OAuth (Google) flows need real or stubbed providers.
- **Realtime changes.** Unread badges, request status, incident status and ID status update live via Supabase realtime; transitions can only be seen by changing rows while the page is open.
- **Visual details defined in CSS only.** Exact layout at each breakpoint for Home, Services, Maps and Emergency lives in module CSS files (`home.module.css`, `landing.module.css`, `maps.module.css`, `emergency.module.css`, `health.module.css`, `reports.module.css`, `announcements.module.css`, `document-request-modal.module.css`, `search.module.css`). This inventory records only the breakpoints visible in the shell CSS and Tailwind classes.
- **Not checked:** shadcn-style `button.tsx` variants, `input.tsx`, `password-input.tsx` and `label.tsx` states were not enumerated individually (disabled, loading, show/hide password are known but not catalogued).

**Anomalies and gaps worth knowing before capturing screens**

- `components/shell/notification-bell.tsx` is not imported anywhere in the shell, so the bell is unreachable.
- `components/maps/boundary-fit-button.tsx` renders a *fullscreen* toggle (it ignores its boundary props); the separate `fullscreen-button.tsx` is unused by `map-canvas.tsx`.
- Failed fetches in the **Drive registration drawer** (`components/health/register-drawer.tsx`) and the **Incident drawer** (`components/reports/incident-drawer.tsx`) never set an error state, so they stay on the skeleton indefinitely.
- `/settings/notifications` is local React state only; the toggles do not persist.
- `/settings/notifications` and `/settings/download-data` have no server-side login gate. A guest who visits the URL directly sees the page (the sidebar hides the links for guests). The export would fail with an error toast.
- Terms & Privacy and About Us have no error branch in their components, so a failed fetch looks like the empty state.
- `/reports/[incidentId]` is not linked from the My Reports list (cards open the drawer) or from Home's recent-reports rows. It is reached by search results or by direct URL.
- A few flows use sonner's `toast.*` directly rather than `lib/notify.ts` (new-report form photo and submit toasts, profile avatar and save errors, incident withdraw, change-password form, location-verification save, notifications toggles). These bypass the shared de-duplication, so their timing and wording may differ.
- Home has a search bar only for signed-in users; guests reach search via URL or the footer.
- There is no custom `not-found.tsx` or `global-error.tsx`; 404s and fatal errors use Next.js defaults.
- Document-type forms vary heavily by `service_kind` (general, business, indigency, first_time_job_seeker, certified_true_copy, and catalog vs legacy), so the form screenshots multiply per document type.
