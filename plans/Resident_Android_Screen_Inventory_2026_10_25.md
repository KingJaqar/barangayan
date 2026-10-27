# Resident Android — Complete Screen Inventory

Date: 2026-10-25 · App: `apps/resident-android-mobile` · Status: analysis only, no code changed.

All paths are relative to `apps/resident-android-mobile/src`. IDs are used by the companion document
[Resident_Android_Pull_To_Refresh_Audit_2026_10_25.md](Resident_Android_Pull_To_Refresh_Audit_2026_10_25.md).

## Totals

| Group | Count |
| --- | ---: |
| R — Route screens (files under `app/` that render a screen) | 51 |
| F — Full-screen flows/shells that are not routes | 7 |
| M — Modals, bottom sheets and blocking overlays | 24 |
| **Total screen entries** | **82** |

`app/` holds 61 files in total. The 10 `_layout.tsx` files are navigators, not screens, and are listed in the
appendix so the 61 can be reconciled: 61 − 10 layouts = 51 route screens.

How entries are counted:

- Every route file is one entry, including alias routes (a route that only re-exports or redirects). The alias
  names the component that actually renders.
- A body component that exists for exactly one route (for example `AuthenticatedScanView`, `AnnouncementsFeed`,
  `RequestTrackingScreen`, `CentersContent`) is described inside that route's entry and is not counted again.
- Tab and segment views inside one route (Emergency Info tabs, Services segments, Health segments) are described
  in the route entry and are not counted separately.
- Toasts (`logout-toast`, `onboarding-toast`, `service-error-toast`), inline cards (`guest-auth-callout`,
  `guest-prompt`, `profile-completion-banner`) and the header/tab bar are not screens and are not counted.

Tab bar (from `components/app-tabs.tsx`): Home, Services, DRRM, Maps, Health, Reports. `settings`, `announcements`,
`search` and `explore` are registered with `href: null` (reachable, but not in the tab bar).

---

## R — Route screens (51)

### R-A. Root level (5)

| ID | File | Description |
| --- | --- | --- |
| R-01 | `app/index.tsx` | Entry redirect: sends the user to auth, setup, home or password recovery depending on session state. |
| R-02 | `app/account-setup.tsx` | Post-signup account setup host: shows setup status, the details form and the password step. |
| R-03 | `app/auth/callback.tsx` | OAuth/email-link callback; shows a short progress or error state, then routes onward. |
| R-04 | `app/complete-profile.tsx` | Thin wrapper that renders the resident details form, then redirects to the safe `next` target. |
| R-05 | `app/emergency-centers.tsx` | Guest-reachable emergency evacuation centers screen (map and list via `CentersContent`). |

### R-B. Auth group `(auth)` (10)

| ID | File | Description |
| --- | --- | --- |
| R-06 | `app/(auth)/welcome.tsx` | First onboarding slide. |
| R-07 | `app/(auth)/value-prop.tsx` | Second onboarding slide ("explore the services"). |
| R-08 | `app/(auth)/personalization.tsx` | Onboarding step for theme/appearance preferences. |
| R-09 | `app/(auth)/auth-choice.tsx` | Choose between log in, register or continue as guest. |
| R-10 | `app/(auth)/login.tsx` | Email/password and Google sign-in. |
| R-11 | `app/(auth)/register.tsx` | Account registration (email, Google). |
| R-12 | `app/(auth)/otp.tsx` | One-time-code verification step (uses the password recovery shell). |
| R-13 | `app/(auth)/forgot-password.tsx` | Request a password reset link/code. |
| R-14 | `app/(auth)/reset-password.tsx` | Set a new password after recovery. |
| R-15 | `app/(auth)/completion.tsx` | Short completion screen ("Explore the services of Barangayan"). |

### R-C. App group `(app)` (36)

| ID | File | Description |
| --- | --- | --- |
| R-16 | `app/(app)/home/index.tsx` | Home tab: profile banner, quick actions, latest announcement and latest request summary. |
| R-17 | `app/(app)/home/requests/[requestId].tsx` | Alias of `RequestTrackingScreen` (request status, timeline, cancel); reached from Home. |
| R-18 | `app/(app)/home/emergency-info/index.tsx` | Emergency Info hub with five tabs: Hub (guidelines + hotlines), Centers (map/list), Alerts, Scan guide, Family. |
| R-19 | `app/(app)/drrm.tsx` | DRRM tab: re-exports R-18, same screen under the tab bar. |
| R-20 | `app/(app)/home/emergency-info/qr-guide.tsx` | Redirect-only route; replaces to `/home/emergency-info?tab=scan`. |
| R-21 | `app/(app)/home/emergency-info/scan.tsx` | Emergency QR check-in: guest callout, or `AuthenticatedScanView` (QR guide in a scroll view). |
| R-22 | `app/(app)/index/emergency-info/qr-guide.tsx` | Legacy alias; re-exports R-20. Sits in an `index/` folder with no layout; reachability not verified. |
| R-23 | `app/(app)/services/index.tsx` | Services tab: Documents catalog, Requests list and Activity logs segments. |
| R-24 | `app/(app)/services/[documentId].tsx` | Document detail/guide (requirements, fees, steps) with a start-request action. |
| R-25 | `app/(app)/services/request/[documentId].tsx` | Request form for a document (purpose, fields, submit). |
| R-26 | `app/(app)/services/requests/[requestId].tsx` | Alias of `RequestTrackingScreen`; reached from Services. |
| R-27 | `app/(app)/services/payment/[requestId].tsx` | Alias of `ResidentPaymentScreen` (payment status, method, retry). |
| R-28 | `app/(app)/services/payment/pickup/[requestId].tsx` | Same `ResidentPaymentScreen` for the pay-at-pickup path. |
| R-29 | `app/(app)/services/payment/qrph/[requestId].tsx` | QR Ph payment screen with generated QR, expiry countdown and success modal. |
| R-30 | `app/(app)/services/payment/success.tsx` | Payment success receipt screen. |
| R-31 | `app/(app)/maps/index.tsx` | Maps tab: full-screen map with incident and evacuation-center layers, filters and overlay. |
| R-32 | `app/(app)/maps/hotline-directory.tsx` | Placeholder panel ("content goes here"). |
| R-33 | `app/(app)/maps/preparedness-guide.tsx` | Placeholder panel. |
| R-34 | `app/(app)/health/index.tsx` | Health tab: Active Medical Drives (list or month calendar) and My Registrations segments. |
| R-35 | `app/(app)/health/register.tsx` | Applicant registration form for a medical drive. |
| R-36 | `app/(app)/reports/index.tsx` | Reports tab: Incidents / Active / Resolved segments over the resident's own reports. |
| R-37 | `app/(app)/reports/[incidentId].tsx` | Incident detail: photos carousel, status, location map, confirm/withdraw, feedback. |
| R-38 | `app/(app)/reports/new.tsx` | New incident report form (category, description, photos, location). |
| R-39 | `app/(app)/announcements.tsx` | "What's New" announcements feed with filter chips (hidden route, `href: null` in the tab bar). |
| R-40 | `app/(app)/search.tsx` | Search entry: recent searches and suggestions. |
| R-41 | `app/(app)/explore.tsx` | Search results (All, category tabs, See all paging). |
| R-42 | `app/(app)/settings/index.tsx` | Settings hub: profile summary, appearance, notifications, account actions (export, delete, logout). |
| R-43 | `app/(app)/settings/profile.tsx` | Profile editor (personal details, household, avatar). |
| R-44 | `app/(app)/settings/change-password.tsx` | Change password form. |
| R-45 | `app/(app)/settings/email-verification.tsx` | Email change/verification flow. |
| R-46 | `app/(app)/settings/valid-id.tsx` | Valid ID upload (front/back photos, ID type, birthday). |
| R-47 | `app/(app)/settings/location-verification.tsx` | Residency location verification with a map pin. |
| R-48 | `app/(app)/settings/about.tsx` | About Us (barangay profile, developers) from managed content. |
| R-49 | `app/(app)/settings/help/index.tsx` | Help Center: FAQ categories and article list. |
| R-50 | `app/(app)/settings/help/[articleId].tsx` | Single help article. |
| R-51 | `app/(app)/settings/terms-privacy.tsx` | Terms and Privacy policy segments from managed content. |

---

## F — Full-screen flows and shells that are not routes (7)

| ID | File | Description |
| --- | --- | --- |
| F-01 | `components/account-setup-status.tsx` | Full-screen setup progress/error state shown by R-02. |
| F-02 | `components/resident-details-form.tsx` | Resident details form used by account setup (R-02) and complete-profile (R-04). |
| F-03 | `components/resident-password-step.tsx` | Password creation step shared by account setup and change password. |
| F-04 | `components/password-recovery-screen.tsx` | Shared shell for OTP, forgot-password and reset-password; also imported by valid-id. |
| F-05 | `components/guest-auth-callout-screen.tsx` | Full-screen "log in or register" wall shown to guests on gated screens (for example R-21). |
| F-06 | `components/onboarding/onboarding-screen.tsx` | Shared onboarding layout (progress dots, toast) for R-06, R-07, R-08. |
| F-07 | `components/navigation-diagnostic-screen.tsx` | Dev-only profiler wrapper around each tab screen; renders no UI of its own. |

---

## M — Modals, bottom sheets and blocking overlays (24)

| ID | Component and file | Description |
| --- | --- | --- |
| M-01 | `SettingsSheet` — `components/settings-sheet.tsx` | Generic bottom sheet with scrolling body; used by profile, valid-id and appearance pickers. |
| M-02 | `CustomAccentColorModal` — `components/custom-accent-color-modal.tsx` | Custom accent color entry, built on M-01. |
| M-03 | `DeleteAccountModal` — `components/delete-account-modal.tsx` | Account deletion confirmation. |
| M-04 | `GoogleDeletionDialog` — inline in `app/(app)/settings/index.tsx` | Confirmation dialog for deleting a Google-linked account. |
| M-05 | `BirthdayCalendarModal` — `components/birthday-calendar-modal.tsx` | Calendar date picker for birthday. |
| M-06 | `BirthdayWheelModal` — `components/birthday-wheel-modal.tsx` | Wheel-style birthday picker. |
| M-07 | Front-ID camera modal — inline in `app/(app)/settings/valid-id.tsx` | Full-screen camera modal to capture the ID front. |
| M-08 | `ScanFamilySheet` — `components/drrm/scan-family-sheet.tsx` | Base sheet for the family QR dialogs (M-09 to M-12). |
| M-09 | `QrPermissionModal` — `components/qr-permission-modal.tsx` | Camera-permission prompt for QR scanning. |
| M-10 | `QrShowModal` — `components/qr-show-modal.tsx` | Shows a QR code with a share action. |
| M-11 | `HouseholdQrModal` — `components/household-qr-modal.tsx` | Household check-in QR display. |
| M-12 | `FamilyMemberModal` — `components/family-member-modal.tsx` | Add/edit a household member. |
| M-13 | `QrScannerOverlay` — `components/qr-scanner-overlay.tsx` | Full-screen camera scanner for evacuation-center QR codes. |
| M-14 | `RequestSummarySheet` — `components/home/request-summary-sheet.tsx` | Request summary sheet opened from Home. |
| M-15 | `PurposeSheet` — `components/services/purpose-sheet.tsx` | Purpose picker on the request form; has a drag-to-dismiss gesture. |
| M-16 | `ActionSuccessModal` — `components/services/action-success-modal.tsx` | Generic success confirmation (also used by change-password). |
| M-17 | `PaymentSuccessModal` — `components/services/payment-success-modal.tsx` | Payment success confirmation, built on M-16. |
| M-18 | `AnnouncementModal` — `components/reports/announcement-modal.tsx` | Full announcement body. |
| M-19 | `FeedbackModal` — `components/reports/feedback-modal.tsx` | Submit feedback on a report. |
| M-20 | `LocationPickerModal` — `components/reports/location-picker-modal.tsx` | Map-based location picker for new reports. |
| M-21 | `PhotoViewerModal` — `components/reports/photo-viewer-modal.tsx` | Full-screen photo viewer. |
| M-22 | `HealthSheet` — `components/health/health-presentation.tsx` | Sheet for the month/year picker and registration detail on the Health tab. |
| M-23 | Road-block confirm dialog — inline in `components/evacuation-centers-panel.tsx` | "Block a road?" confirmation shown over the centers map. |
| M-24 | `LoadingOverlay` — `components/loading-overlay.tsx` | Blocking spinner overlay used during account actions (an overlay, not a content screen). |

---

## Appendix — layout files (not screens) (10)

`app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(app)/health/_layout.tsx`,
`app/(app)/home/_layout.tsx`, `app/(app)/home/emergency-info/_layout.tsx`, `app/(app)/maps/_layout.tsx`,
`app/(app)/reports/_layout.tsx`, `app/(app)/services/_layout.tsx`, `app/(app)/settings/_layout.tsx`.

## Appendix — distinct implementations behind alias routes

Of the 51 route entries, 3 are duplicate aliases (R-19 = R-18, R-26 = R-17, R-28 = R-27) and 3 are redirect-only
with no UI (R-01, R-20, R-22). That leaves 45 distinct screen implementations that render UI.

## Reconciliation check

- Route files: 5 + 10 + 36 = 51; plus 10 layouts = 61 files under `app/`.
- Entries: 51 + 7 + 24 = 82.
