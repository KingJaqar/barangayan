# P20-T02 — App Store rules, privacy, compliance and assets (2026-10-21)

Requirements: P20-T02, G21, G11 (deletion/login requirements), G12 (UGC applicability), G13 (push disclosure), A44–A49 disclosure surfaces. Owner and reviewer: KingJaqar (OD-01). **Source:** uncommitted on base `187a2ab3`. **Native build:** none (OD-06). Nothing was submitted, and no App Store Connect, Apple Developer or hosted setting was read or changed.

## 1. Sources checked (2026-10-21)

| Source | What was read | Limits |
|---|---|---|
| [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | 1.2, 1.5, 2.1, 4.2, 4.8, 5.1.1, 5.1.2, 5.1.5 as published on the page the fetch tool returned. | The page showed no "last updated" date and the tool returned only part of it (it stopped inside 5.2). Guidelines outside the sections listed were not read. Wording below is paraphrased. |
| [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) | Data types, linked/tracking definitions, optional-disclosure rules, third-party partner rule, privacy policy URL requirement. | Read in full by the tool. |
| [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) | Xcode/SDK minimum (Xcode 26 / iOS 26 SDK from 2026-04-28), minimum deployment target for uploads (iOS 13 from 2026-09-09), age-rating questionnaire deadline (2026-01-31). | Read in full. |
| [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) | Rating tiers and the definitions relevant to this app. | The questionnaire itself and some deadlines were beyond what the tool returned. |
| [Describing data use in privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests.md) | Manifest structure; the statement that values must come from Apple's list and that an app's manifest need not cover SDK data. | The list of allowed data-type identifiers was **not** on any page the tool could read. |
| [Expo SDK 57 app config](https://docs.expo.dev/versions/v57.0.0/config/app/), [expo-notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) | `ios.privacyManifests`, `ios.icon`, `ios.config.usesNonExemptEncryption`, `aps-environment` note. | The notifications page documents no plugin `mode` option; the APNs note is quoted in T01. |
| Apple "required reason API" article | **Not read**: the page did not render for the tool. The category list used by `privacy-scan.mjs` (file timestamp, system boot time, disk space, active keyboard, user defaults) is from general knowledge and is a lead, not verified text. | See §3. |

The guidelines change often. Re-read them in full at submission time; this record is a dated snapshot.

## 2. Guideline applicability

| Guideline | Applies to this app? | State today | Verdict |
|---|---|---|---|
| 2.1 completeness, live backend, demo account | Yes: accounts are required for services, payments, reports, health registration. | No reviewer account or reviewer notes exist (T03). Closed gates (`householdEditing`, `privateIdUploads`, `mapProviders`, `publicIncidents`, `completeExport`, `accountDeletion`, `remotePush`) show "not available yet" screens or hide rows (`settings/index.tsx` lists them as unavailable). Apple expects final, fully functional builds with no placeholder content. | **Blocking risk.** |
| 5.1.1(v) in-app account deletion | Yes: the app creates accounts (email OTP, Google, Apple). | `accountDeletion` is closed: the "Delete My Account" row is **not shown** in Settings and the route shows an unavailable state. Migration `0136`, the v2 function and Apple token revocation (PR-06) are built but not deployed. | **Blocking: a store submission would be rejected until deletion is deployed, reachable and tested.** |
| 4.8 login services | Yes: Google sign-in is offered, so an equivalent privacy-preserving option is required. | Sign in with Apple is implemented (capability requested, flows tested) but the Supabase Apple provider is not configured (PR-06) and no real exchange has run. Google browser sign-in has no approved callback (OD-07), so the app reports it as unavailable in this build. | **Not met until PR-06 and a signed run.** |
| 5.1.1(i) privacy policy | Yes. | The policy is in the app (Settings → Terms & Privacy, from the barangay's `site_content`) and was updated on 2026-10-21 (OD-16). App Store Connect also needs a **public** URL; none is recorded, and the only web copy is under a signed-in resident route. | **Open (PR-17).** |
| 5.1.1(ii)/(iii)/(iv) consent, minimization, alternatives | Yes. | Three purpose strings, each naming the actual use. Photos use the system picker (`photosPermission: false`, add-only Photos for saving a QR); location is When-In-Use only; the location and concern flows have a manual pin (Phase 5 and 12 records), not re-run here; notifications are never required for any function. | Pass in configuration; on-device prompts Pending device (OD-14). |
| 5.1.2 data use and sharing / tracking | Yes. | No advertising SDK, no analytics SDK, no crash reporter (OD-18), no App Tracking Transparency prompt, no `NSUserTrackingUsageDescription`. Processors: Supabase (backend), PayMongo (QR PH, server-side), Expo Push (server-side, generic message text), OpenStreetMap tiles/Nominatim only if `mapProviders` opens. | Pass in code; disclosure text is the owner's (§4). |
| 5.1.5 location | Yes: evacuation centers, home pin, concern pins, route guidance. | Foreground only; no background modes; the start point goes only to the barangay's own `evacuation-route` function (OD-11). Emergency copy states the app does not monitor emergencies or guarantee alerts (OD-10). | Informational use with disclaimers. Apple's wording on location APIs and emergency services should be reviewed by the owner before submission; engineering does not decide it. |
| 1.2 user-generated content | **Conditional.** | Concern reports are visible to the reporter and barangay staff only; other residents' reports and corroboration are behind the closed `publicIncidents` gate (PR-13). If that gate opens, the four safeguards Apple lists (filtering, a report mechanism with timely response, blocking abusive users, published contact) are required and are not built. | Not applicable while closed; **blocking for opening `publicIncidents`.** |
| 1.5 developer contact / support URL | Yes. | The About screen shows the barangay's configured email/phone/address; no App Store support URL or monitored support contact is recorded (PR-17). | **Open.** |
| 4.2 minimum functionality | Yes. | Native app with native tabs, camera, location, Keychain, push; not a web wrapper. | Pass (assessment). |
| 4.1/5.x other | Not examined beyond the above. | — | Review at submission. |

## 3. Privacy manifests and required-reason APIs

- `node plans/evidence/resident-ios-parity/phase-20/privacy-scan.mjs` scanned the native iOS source of the app's 32 direct dependencies (everything in the iOS `package.json` except the JavaScript workspace package `@barangayan/shared`): **6 ship a `PrivacyInfo.xcprivacy`** (`react-native` ×6 files, `@react-native-async-storage/async-storage`, `expo-application`, `expo-file-system`, `expo-media-library`, `expo-notifications`); 8 are JavaScript-only; 17 have native code with no required-reason symbols found; **1 to review: `expo-sharing`**, whose native code reads `UserDefaults(suiteName:)` for its share-into feature (app-group state) and ships no manifest. The app only shares files out and does not configure an app group, so that code path is not exercised, but a build that links it may still be flagged by Apple's upload check.
- **Not verifiable on this host:** Expo's generated app-level `PrivacyInfo.xcprivacy`. `npx expo prebuild --platform ios` skips native generation on Windows ("Run npx expo prebuild again from macOS or Linux"), the Expo template is not in `node_modules`, and Apple's Xcode privacy report needs an archive. This is **Pending device/macOS (OD-06/OD-14)**: run `npx expo prebuild --platform ios` on macOS/Linux, read the generated manifest, and add `ios.privacyManifests` reasons for any category above that it does not cover (for `expo-sharing`, the app-group `UserDefaults` reason).
- **Decision, not omission:** no `ios.privacyManifests` entry was added. Expo accepts `NSPrivacyTracking` and `NSPrivacyCollectedDataTypes`, but Apple says Xcode cannot produce a correct privacy report from identifiers that are not on its list, and the list of allowed `NSPrivacyCollectedDataType` identifiers could not be read from any Apple page available to this session. Guessing them would violate the no-invention rule. The App Store Connect labels (§4) are the disclosure of record; the manifest's collected-data list can be added after the identifiers are confirmed.
- `NSPrivacyTracking` is not declared; its default is no tracking, which matches the code (no tracking domains, no ATT).

## 4. App Privacy labels — draft for the owner (not entered anywhere)

Basis: source and schema review on 2026-10-21; no analytics, advertising or diagnostics SDK; no tracking. "Linked" because every item is tied to the resident's account. Purpose for all: App Functionality. Final classification is the owner's/privacy owner's decision in App Store Connect.

| Apple data type | Collected? | What the app sends | Gate / note |
|---|---|---|---|
| Name, Email Address, Phone Number, Physical Address | Yes | Profile (name parts, email, mobile number, home address, house number/street); household members' names and relationships | `householdEditing` closed: household write path unavailable today |
| Other contact info / other data | Yes | Birth date, sex, employment status, occupation, civil details in the profile | Apple's "Other Data Types" |
| Health | Yes | Medical-drive self-registration: conditions, prior-dose information, consent | `medicalRegistration` open (OD-13) |
| Precise Location | Yes | Registered home pin, location-verification fix, concern report location, evacuation-route start point (sent to the barangay's own function, OD-11) | Foreground only |
| Photos or Videos | Yes | Profile photo, ID photos (front/back), concern photos, request attachments (images and PDFs) | `privateIdUploads` closed; ID photo upload is the closed part |
| Other User Content / Customer Support | Yes | Concern descriptions, request notes and purpose text, feedback on resolved reports | |
| User ID, Device ID | Yes | Account ID; Expo push token | Push token only when `remotePush` opens |
| Financial / Purchases | Payment status and amounts of document fees; no card or wallet details are entered in the app (QR PH is paid in the resident's own banking/e-wallet app) | | Owner/privacy owner decides the category; payment-instrument data is not collected by the app |
| Sensitive Info | Government ID images and details extracted from them (type, confirmed details) | | The owner decides whether Apple's "Sensitive Info" applies; ID images are also "Photos or Videos" |
| Browsing/Search history, Usage data, Diagnostics, Contacts, Audio, Environment | **No** | — | No analytics, no crash reporter (OD-18) |
| Used to track | **No** | — | No ad network, data broker or cross-app linking |

Third-party processors to name in the policy and labels: Supabase (hosting/authentication/storage), PayMongo (payment processing, server-side), Expo (push relay, server-side; message text is generic and carries no names, addresses or reporter data), Apple (Sign in with Apple, APNs). OpenStreetMap services apply only if `mapProviders` opens.

## 5. Account deletion, login and retention (G11/G18/G21)

Implemented and tested but **not deployed**: `delete-my-account` v2 (state machine, storage cleanup, sign-in soft-delete, Apple revocation hook), migration `0136`, 56 pgTAP assertions plus 17 function tests, retention matrix approved by the owner (OD-16). Open: PR-06 (Apple key and provider), deployment approval, `accountDeletion` gate, an in-app run. The rollback of `0136` is rehearsed (T06).

## 6. Age rating, encryption and export compliance

- **Age rating:** Apple's updated rating system (iOS 26; developers had to answer the new questions by 2026-01-31) is answered in App Store Connect by the owner. By Apple's definitions the relevant answers for this app are medical/treatment information (emergency and medical-drive content), real-world crimes (incident reports) and user-generated content (only if `publicIncidents` opens). The tool did not return the questionnaire, so no rating is claimed; Apple's page places infrequent medical or treatment information at 13+ and frequent at 16+.
- **Encryption / export:** a source search of `src` and the iOS dependencies finds no custom cryptography: HTTPS to Supabase, Keychain storage via `expo-secure-store`, `expo-crypto` for random/hash helpers, no bundled encryption library. That suggests the standard exemption, but the answer is a legal declaration for the account holder; `ITSAppUsesNonExemptEncryption` was therefore left undeclared (P20-F04) and the owner answers it in App Store Connect.
- **Xcode/SDK and deployment target:** Apple requires Xcode 26 with the iOS 26 SDK from 2026-04-28; uploads must target iOS 13 or later from 2026-09-09. The app targets 16.4, which satisfies the deployment rule. Whether the EAS build image used for a future build meets the Xcode requirement is unverified (no build, PR-05 not required under OD-06).

## 7. Legal, support and processor URLs

| Item | State |
|---|---|
| Public privacy policy URL | Not recorded (PR-17). In-app policy exists. |
| Terms of Service | In-app only (`site_content`). |
| Support URL / monitored contact | Not recorded (PR-17); About shows tenant-configured contact details. |
| Processor disclosures | Draft in §4; not published. |
| Open-source notices | All 32 direct third-party dependencies are MIT, and the bundled Leaflet is BSD-2-Clause (its license text is embedded in every map page); the transitive tree was not audited and the app has no acknowledgements screen. Low risk; owner to decide. |

## 8. Assets: icon, splash, fonts, screenshots

- **Icon:** none configured. `assets/barangayan-logo-1024.png` is a 1024×1024 RGBA PNG: a circular logo on a transparent background (transparent corners). Apple requires an opaque square icon, so it cannot be submitted as is. Producing a replacement (for example the circle on the `#0F6E5B` brand color) is an artwork/brand decision, so no icon was generated or wired; the exact change is one `ios.icon` entry once the owner supplies or approves the file. The same logo is the Android app's icon, so provenance is the owner's own asset; no third-party artwork is bundled.
- **Splash:** `expo-splash-screen` with `#0F6E5B` and the logo at width 96 (opaque background, transparent image is fine for a splash).
- **Fonts:** no font files are bundled; the resident's font choice maps to iOS system-provided families (PR-19: availability per iOS version not device-qualified).
- **Screenshots:** none exist for iPhone. They need a simulator or device (OD-06/OD-14); the Android captures in `phase-00/android-captures/` are not App Store assets.

## 9. Status

**P20-T02: Partially complete.** Done: dated rules check, applicability table, dependency privacy-manifest scan, App Privacy draft, encryption/age-rating analysis, asset review. Not met and blocking submission: in-app account deletion (G11/G21), Apple login operability (PR-06), public privacy/support URLs (PR-17), opaque icon, reviewer package (T03). Pending macOS/device: app-level privacy manifest generation, Xcode privacy report, screenshots.
