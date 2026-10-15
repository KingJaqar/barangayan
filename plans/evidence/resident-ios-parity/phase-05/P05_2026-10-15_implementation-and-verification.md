# P05 — Profile, household, avatar, ID evidence and location verification: implementation and verification (2026-10-15)

Source: uncommitted on base `4540e6d`, in the resident iOS workspace (`apps/resident-ios-mobile`) plus one additive shared type. Standard: non-device, non-live scope under OD-06/OD-07 (no signed build, no simulator, no app launch against a backend). Nothing was committed, pushed, deployed or applied to a remote database in this session, and no migration was added.

## 1. Authorization and entry

Owner decision OD-08 (2026-10-15) approved `expo-image-picker`, `expo-image-manipulator` and `react-native-webview` with bundled Leaflet, and kept RD01 (the post-baseline Android Valid ID wizard) deferred. The owner then asked for Phase 5 to be implemented through completion. The entry exits are **still open** and carried as blockers, not as passed:

| Entry item | State |
|---|---|
| Phase 2 | Verified (non-device scope). |
| Phase 3 | Partially complete: hosted stray history row `20261015003812`, the `delete-my-account` freshness deploy and the hosted invariant run are open. G03/G04 (household integrity, private IDs) need that run, so `householdEditing` and `privateIdUploads` stay closed. |
| Phase 4 | Partially complete (Phase 3 exit, PR-06 open). |
| PR-03, PR-18 | Skipped (OD-07): the app has never been launched against a backend, so no screen below was rendered or driven. |
| PR-10 | Open: map tile and geocoding processors are not approved. |

## 2. Dependencies

| Package | Version | Why |
|---|---|---|
| `expo-image-picker` | `~57.0.20` (new) | Avatar and ID photo selection from the Photos library and camera. |
| `expo-image-manipulator` | `~57.0.21` (new) | HEIC/HEIF conversion and downscaling to a permitted format before final-byte validation (OD-05, P02-D02). |
| `react-native-webview` | `13.16.1` (already resolved for Android) | Host for the bundled Leaflet pin picker. |
| `leaflet` (dev dependency) | `1.9.4` (already resolved for Android) | Source for the generated bundled assets (`scripts/generate-leaflet-assets.mjs` → `src/lib/leaflet-assets.ts`); no runtime package import and no CDN. |

`package-lock.json` gained only the three new package entries (`expo-image-picker`, `expo-image-manipulator` and its loader dependency `expo-image-loader`) and the iOS workspace declarations; no resolved version of an existing package changed (diffed against a pre-install copy). `expo install --check` lists only the pre-existing P01-D04 patch drift; the new packages are compatible.

SDK 57 docs read before writing code: ImagePicker, ImageManipulator, WebView (the page documents only install and an inline-HTML example; remaining props were confirmed from the installed package's typings and used conservatively), plus FileSystem `File`, Location and Router pages from earlier phases. Facts used: library picking needs no permission on iOS; `UIImagePickerPreferredAssetRepresentationMode.Compatible` returns a transcoded JPEG instead of HEIC; `ImageManipulator.manipulate(uri).resize().renderAsync()` → `ImageRef.saveAsync({ format, compress })` writes a cache file that the app must delete.

`app.config.ts`: `expo-image-picker` plugin with `photosPermission: false`, `microphonePermission: false` and a specific camera purpose string. `expo config --type introspect` shows `NSCameraUsageDescription` only (no `NSPhotoLibraryUsageDescription`, no microphone); `NSAppTransportSecurity` and `NSLocationWhenInUseUsageDescription` unchanged.

## 3. What changed, by requirement

| Task | Implementation (all under `apps/resident-ios-mobile` unless noted) |
|---|---|
| P05-T01 profile fields, avatar | `src/features/profile/profile-screen.tsx` (route `settings/profile`): first/middle/last/suffix, sex, date of birth, mobile (digits only, 11), profile email, house/unit, street, city, read-only barangay and province, employment status with conditional occupation, live per-field validation, one **conditional** save (`profile-save.ts`). `avatar-card.tsx` + `avatar.ts`: photo library or camera, progress, immutable new object per change, separate apply, previous object removed best effort, outcome reported independently of the form. Link and verification entry points to Email verification, ID verification, Location verification. |
| P05-T02 birthday | `birthday-sheet.tsx` + `birthday.ts`: month/year/day in a native sheet, year steppers and ±10 years, apply/cancel with draft-vs-saved, adult fallback (25 years), 1900 floor, no future dates, date-only strings. Also replaces the compact native date control in the registration details form. |
| P05-T03 household | `household-card.tsx` + `household.ts`: count, initials, relationship (7) and role (6) chips, add/edit/remove with confirmation, staged edits saved as one whole list through `save_resident_household_if_unchanged` against the last-read raw list (`PT409` → nothing written, reload required), unreadable-entry notice, 30-member limit, non-UUID legacy ids regenerated. Editing is behind the closed `householdEditing` gate; the list is always readable. |
| P05-T04 ID evidence | `id-screen.tsx` (route `settings/id-verification`) + `id-evidence.ts`: 16 ID types, "Other" named with the shared `Other: ` prefix convention, front and back pick/replace/remove from library or camera, in-memory previews, 5 MiB limit, one immutable `versions/{submissionId}` folder, publication through `publish_id_submission`, same submission id per selection (idempotent retry), reconciliation lookup after a lost reply, confirmation before replacing a pending/verified version. Submission is behind the closed `privateIdUploads` gate. |
| P05-T05 previews, recovery | Latest version read fresh (`id_submissions`, newest `version`); state pending / verified / rejected (with staff reason) / revoked / unconfirmed — an unreadable or unknown decision is never shown as approved. Private signed previews (5 min TTL, renewed 30 s before expiry, reload action). Demographic save, avatar upload and ID publication are separate actions with separate outcome messages. |
| P05-T06 location | `location-screen.tsx` (route `settings/location-verification`), `pin-picker.tsx`, `location-map.ts`: bundled-Leaflet WebView (CSP blocks all network requests; navigation limited to `about:blank`; validated bridge messages only), boundary outline, tap/drag pin, accessible north/south/east/west nudge buttons, GPS through the Phase 2 foreground adapter (permission, denied, approximate, stale and cancel states), boundary refusal with pin snap-back, editable address, save of `verified_location` and `verified_location_address` only (`location_verified_at` is server-set), status. Registration: `home-pin.tsx` adds the optional manual home pin to the details form (carried from P04-D03). |
| P05-T07 refresh and cleanup | Profile refreshed after every committed or uncertain write; ID state is a fresh read, never cached approval; picker/manipulator temporary copies deleted after reading; ID bytes are never written to storage until submit; avatar staged references use the owner-scoped protected store and are purged on logout. |
| P05-T08 | See section 5; live runs Skipped. |
| Shared (additive, type-only) | `packages/shared/src/types/resident-account-setup.database.ts` declares `save_resident_household_if_unchanged` (migration `0123`). |
| Other | `src/data/schemas.ts` + `resident-api.ts`: `barangayProfile`, `latestIdSubmission`, `idSubmissionExists`. `src/lib/image-prep.ts`, `image-source.ts`, `data-uri.ts`. Settings index and layout: links and titles. |

## 4. Decisions and plan discrepancies

| ID | Decision / discrepancy |
|---|---|
| P05-D01 | **Profile save is one conditional direct update, not `complete_resident_profile_if_unchanged`.** That RPC (0095/0102/0107) rewrites `email` from the Auth user on every call and raises `registration_locality_not_configured` for a barangay without a locality, so using it for edits would reset a deliberately different profile email and block legacy barangays. The update matches `id`, `barangay_id` and the `updated_at` the form was based on (`set_profiles_updated_at` bumps it on every write); zero rows means nothing was written, and one retry against the newer row is made only when no edited field changed. Web and Android already write these columns directly. |
| P05-D02 | The profile email is editable and is **not** the sign-in email (D16). A changed profile email resets its verification through migration `0109`; the app says so. Changing the sign-in email still needs the Auth email-change confirmation link and therefore a callback scheme (PR-03, skipped), so it is not offered. |
| P05-D03 | **Address detection and map tiles stay behind `mapProviders` (G07, PR-10).** OD-08 approved the WebView and Leaflet, not OpenStreetMap tiles or Nominatim. The picker draws only the boundary and pin; the address is typed. A41-010 ("detect an address from the selected position") is therefore **not delivered** and is recorded as pending PR-10. The generated page contains no tile code and a deny-all content-security policy unless the gate is open. |
| P05-D04 | Both ID sides are required (committed contract). The front-only `confirmedDetails` path from migration `0118` belongs to RD01 and is not used. Photos are held in memory and uploaded straight into the version folder at submit; there are no staging objects (the ID bucket forbids client deletion, so staged objects would be permanent orphans). |
| P05-D05 | Avatar objects are public by bucket design; the screen says profile photos are not private. The 2 MiB bucket limit (P02) means larger photos are downscaled instead of refused; the web app's 3 MB figure differs from the bucket policy and is not followed. |
| P05-D06 | `householdEditing` and `privateIdUploads` remain closed (C.3 maps them to G03/G04, which need the hosted invariant run). The editing and submission code is complete and tested at the logic level but is **not reachable in the app** until the owner opens the gates with evidence. |
| P05-D07 | Plan §4.4 lists "account-link entry controls" under P05-T01: the profile screen links to Email verification and the Verification card; Google linking itself remains in Settings (Phase 4). |
| P05-D08 | The plan's "Existing code to extend" cites the old minimal `profile.tsx`; it is replaced by `ProfileRoute` (route file re-exports it). |

## 5. Verification

Baseline before editing (iOS workspace): `tsc --noEmit` 0, `eslint .` 0, `vitest run` 123/123.

Final: `tsc --noEmit` 0, `eslint .` 0 (no warnings), `vitest run` 161/161 (38 new tests in `tests/profile.test.ts`), `expo export --platform ios` 0 (one 4.3 MB Hermes bundle), `expo config --type introspect` as in section 2. Android `tsc --noEmit` reports three pre-existing "excessive complexity" errors in `src/components/external-link.tsx`; the same three appear with the shared type change reverted (verified), so they are not caused by this phase. Resident web `tsc --noEmit` 0. `npm run check:release` fails exactly as at baseline (missing owner-supplied configuration, closed gates).

New automated coverage (logic, adapters and builders against the real supabase-js query builder with a scripted transport): leap-year, month-length, future-date and 1900 rules; required/format validation and city locking; conditional-save request shape, safe retry, review-required and second-change outcomes, lost-reply and denial classification; household payload, id regeneration, stale `PT409`, malformed and lost replies; ID type encoding, status derivation (unknown decision never approved), immutable version paths, identical-object retry, lost-reply reconciliation and refusal; HEIC conversion, bounded downscale ladder and failure; avatar path ownership, apply and previous-object removal, not-applied; bridge-message validation, CSP with and without tiles, page-script syntax; Leaflet bundle equals the installed package; `barangayProfile` and `latestIdSubmission` query shapes and schema drift.

Not exercised: no screen was rendered, no WebView or picker ran, and no query ran against a real backend.

## 6. Acceptance status

| Criterion | Status |
|---|---|
| T37 profile fields, conditional occupation, invalid/future date, locality, partial save, stale editor | Met on the non-device standard. Account switch relies on the existing runtime scope reset. |
| T38 birthday (leap year, month length, future, none, cancel) | Met (logic); large-text and focus return pending device check. |
| T39 ID (missing side, type, changed evidence, revoked, expired preview, partial publication) | Implemented and logic-verified; **gate closed** (`privateIdUploads`). Pending G04. |
| T41 location (outside, missing boundary, approximate/stale GPS, manual pin, geocoder failure, save conflict) | Met except address detection (A41-010), pending PR-10. Save conflict: the write is unconditional on the pin; an unknown outcome is reloaded and reported. |
| T27 household CRUD (not QR) | Implemented and logic-verified; **gate closed** (`householdEditing`). Pending G03. QR closes in Phase 15. |
| F02–F04/F06–F08/F12 | Covered at logic level; device and live runs Skipped (OD-06/OD-07). |
| G03/G04 deployed + device proof | Not met: hosted invariant run and device runs open/Skipped. |

## 7. Pending manual verification (owner-attended; applies if PR-03/PR-18 are supplied and gates opened)

1. On a build with tenant configuration: open Settings → My profile; edit one field, save, confirm the message and that the Home name refreshes; edit the same profile on a second device first and confirm "changed on another device".
2. Change the avatar from the library, then from the camera; use a HEIC photo and a photo above 2 MB; confirm the old photo is replaced.
3. Change the profile email; confirm the verification badge resets and Email verification still works.
4. Settings → Location verification: place a pin inside and outside the boundary, use the nudge buttons with VoiceOver, use device location with approximate permission, and save.
5. With `privateIdUploads` opened by the owner: submit front and back with a library photo, a HEIC photo and a camera photo; replace one side; confirm status, reason display after staff review, and preview expiry reload.
6. With `householdEditing` opened by the owner: add, edit and remove members on two devices and confirm the stale-list refusal; confirm staff attendance survives an edit.

## 8. Out-of-scope observations (not changed)

- Android `tsc` has three pre-existing errors in `external-link.tsx` (typed-route complexity).
- The registration home pin is stored by the setup RPC as `registration_home_location`, while the Settings pin is `verified_location`; they remain two separate server fields (unchanged model).
