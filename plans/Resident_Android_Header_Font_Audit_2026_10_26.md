# Resident Android header font audit

Date: 26 October 2026

Requirement: every screen/navigation header and modal, dialog, or sheet title uses **Gideon Roman Regular** (`GideonRoman`, weight `400`), independently of the resident's font preference.

This audit covers the Android app's screen header bars, native navigation titles, and modal/sheet titles. In-page content headings, card titles, tabs, form labels, and body text continue to follow their existing typography and font preferences.

## Screen and navigation exceptions found and fixed

| Header / implementation | Previous behavior | Change |
| --- | --- | --- |
| Profile — `app/(app)/settings/profile.tsx` | Used the resident's selected font; no Gideon Roman family. | Uses `ThemedText`'s fixed `residentHeader` style. |
| Scan QR Code — `components/qr-scanner-overlay.tsx` | Used the resident's selected font with weight `700`. | Uses `residentHeader`, which enforces family and regular weight after local styles. |
| Maps → Preparedness Guide and Hotline Directory — `app/(app)/maps/_layout.tsx` | Inherited native navigation's default title font. | Native stack title defaults explicitly use Gideon Roman, weight `400`. |
| Default auth/setup/recovery header — `components/auth-header.tsx` | Selected Gideon Roman but inherited the default text weight `500`. Affected Log In, Create Account, Complete Profile, password setup, and password recovery header bars. | Uses `residentHeader`, weight `400`. |
| Guest action header — `components/guest-auth-callout-screen.tsx` | Selected Gideon Roman but inherited weight `500`. Affected Account Required for Emergency QR and Log In Required. | Uses `residentHeader`, weight `400`. |
| Public Evacuation Centers — `app/emergency-centers.tsx` | Selected Gideon Roman but inherited weight `500`. | Uses `residentHeader`, weight `400`. |
| Shared service header's default presentation — `components/services/service-screen-header.tsx` | Standard titles selected Gideon Roman but inherited weight `500`; compact default titles could use the resident's chosen family. Its resident presentation already enforced Gideon Roman Regular. | Every presentation and compact variant uses `residentHeader`. |

All nine native Stack layouts now explicitly set the same title family and weight, including layouts whose current headers are hidden, so native fallback headers share the rule.

## Modal, dialog, and sheet title exceptions found and fixed

All implementations below previously followed the resident's font preference and generally requested a bold weight. All now use `residentHeader` to enforce Gideon Roman Regular while retaining their title sizes and layout.

| Implementation | Affected titles / surfaces |
| --- | --- |
| `components/settings-sheet.tsx` | Custom Accent Color; Sex; Employment Status; profile Add/Edit Family Member; Select ID type; resident Date of birth. |
| `components/drrm/scan-family-sheet.tsx` | Camera Access Needed; Show QR Code; Select Evacuation Center; household QR title; DRRM Add/Edit Family Member. |
| `components/health/health-presentation.tsx` (`HealthSheet`) | Medical drive details; Select Month & Year; Registering for; profile Select Date of Birth. |
| `components/home/request-summary-sheet.tsx` | Recent-request summary's document title. |
| `components/birthday-wheel-modal.tsx` | Default Date of birth wheel header. |
| `components/birthday-calendar-modal.tsx` | Select Date of Birth calendar title. |
| `components/services/purpose-sheet.tsx` | Document-purpose selection sheet. |
| `components/delete-account-modal.tsx` | Account deletion dialog title. |
| `app/(app)/settings/index.tsx` | Permanently Delete Account? confirmation title. |
| `components/evacuation-centers-panel.tsx` | Block a road? confirmation title. |
| `components/reports/announcement-modal.tsx` | Announcement detail modal title. |
| `components/reports/feedback-modal.tsx` | Report submission and feedback dialog titles. |
| `components/services/action-success-modal.tsx` | Payment Successful; Payment Cancelled; Request Cancelled; password-success dialog titles. |

## Headers already compliant

The shared `ResidentHeader` already uses `residentHeader`: Home, Services, Emergency & DRRM Info, Maps, Health, Reports, Announcements, and Settings.

The resident presentation of `ServiceScreenHeader` also already used it, covering document requirements and requests, request tracking, payment and receipt flows, incident reporting/details, health applicant registration, authenticated Emergency QR Check-In, location pinning, Help Center/articles, About Us, Terms & Privacy Policy, and resident account/verification/password header bars.

The font is bundled in `assets/fonts/GideonRoman-Regular.ttf` and loaded as `GideonRoman` by the root layout. `ThemedText` applies the `residentHeader` font family and weight after caller styles, keeping both fixed even when a local style or font preference requests another face or heavier weight.

## Verification

- Android TypeScript check passed.
- ESLint passed with no errors; one existing unused `useState` import warning remains in `health-presentation.tsx`.
- Settings/Profile UI checks passed with the bundled Gideon Roman font loaded in the browser fixture. The Profile header remains `GideonRoman` / `400` when the body font changes to Georgia; body inputs still use the selected serif font.
- DRRM/centers UI checks passed.
- Tracking/payment UI checks passed.
- Profile's rendered dark-theme screenshot was visually inspected.

UI checks use the real components with browser/native-service adapters. An Android device rendering check was not performed in this task.
