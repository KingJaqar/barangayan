# Resident Web Valid ID — Android Parity Implementation Breakdown

Date: 2026-10-15  
Status: Proposed implementation; application changes have not started.

## 1. Objective and boundaries

Move resident web ID verification out of Profile into `/settings/valid-id`, matching the updated resident Android four-step submission flow, including the birthday wheel.

Use Android's step hierarchy, four-segment indicator, field order, Previous/Continue controls, and final Submit action. Adapt the presentation to the existing web Settings shell, responsive layout, theme, and web form components. Keep the Android implementation as the behavioral reference; this work does not change Android screens or resume the cancelled Android usability phase.

Profile retains personal information, avatar, employment, household, and account-linking features. The birthday wheel in this work belongs to Valid ID review; changing other birthday fields is outside scope.

## 2. Current state and reusable work

| Area | Current web implementation | Required change |
| --- | --- | --- |
| Profile | `IdDocumentSection` in `profile-form.tsx` owns ID type, front/back photos, previews, and an independent save action. | Move submission into the dedicated flow and remove the old section and ID-only helpers. |
| Settings | `settings-sidebar.tsx` has Profile, Email Verification, Location Verification, and other account links. | Insert Valid ID immediately after Profile, with verification status. |
| Status loading | `settings/layout.tsx` reads email/location flags; `use-profile.ts` already includes current/approved ID submission IDs and repair status. | Add a fresh, account-scoped ID status to navigation. |
| Service entry points | `resident-service-form.tsx` defaults ID verification links to `/settings/profile#upload-valid-id`. | Send ID verification actions to `/settings/valid-id`. |
| Shared submission | `publishIdEvidence` already supports front-only evidence, confirmed details, safe retries, and Android/browser image reading. | Reuse the existing helper. |
| Extraction and persistence | `extract-resident-id`, `idConfirmedDetailsSchema`, and migration `0118_resident_front_id_submission.sql` exist in the repository. | Verify target-environment readiness and consume these contracts. Repository presence does not confirm deployment. |

The web Forgot Password page uses an auth card and is not currently the same four-segment shell as Android. Use Android's `StepFlowScreen` as the progress/navigation reference while keeping the existing web Settings layout.

## 3. Target resident experience

Settings → Valid ID → Select ID type → Provide front photo → Confirm details → Review and submit → Pending verification.

| Step | Resident action | Completion requirement |
| --- | --- | --- |
| 1 — Select ID type | Choose from the shared ID list. Selecting Other reveals an exact ID-name field. | A selected type; a nonblank name for Other. Preserve the shared `Other: ` encoding. |
| 2 — Provide an ID photo | Upload a file or take a photo; inspect its preview. The back is not requested. | A successfully uploaded, readable JPG, PNG, or WebP front image, at most 5 MB, followed by extraction or explicit manual-entry selection. |
| 3 — Review and confirm details | Review/correct full name, ID number, birthday, and address. Select birthday using month/day/year wheels. | Full name is required. Optional fields may remain blank when not printed on the front. Any supplied birthday must be a real, nonfuture date. |
| 4 — Review and submit | Read the front photo, ID type, and confirmed details. Use Previous to correct them, or Submit. | Successful publication of the exact reviewed photo and details. |

After submission, show confirmation and a Back to Settings action. Refresh verification status. Pending submission is not approval. A replacement for a verified ID requires a new staff review, matching Android. Confirmed ID details stay with the evidence and do not overwrite Profile fields.

## 4. Implementation phases

### Phase 1 — Confirm shared contracts and deployment prerequisites

- Inspect the current Next.js guides bundled under `node_modules/next/dist/docs/` before writing application code, as required by the web AGENTS.md.
- Confirm migration 0118 is applied in the target environment and `publish_id_submission` accepts a front path plus confirmed details without a back path.
- Confirm `extract-resident-id` is deployed with authenticated access and the server-side `GOOGLE_CLOUD_VISION_API_KEY`. Keep the key out of browser environment variables and bundles.
- Reuse `ID_TYPES`, `OTHER_ID_TYPE_PREFIX`, `IdConfirmedDetails`, `idConfirmedDetailsSchema`, `idVerificationState`, and `publishIdEvidence` from shared code.
- Reuse the existing immutable storage paths, owner/tenant access rules, and staff approval process. No additional database migration is expected for web parity. If a real schema gap is found, use the next unused four-digit prefix; do not renumber existing migrations.

**Gate:** The frontend/backend request and response contracts are documented, and any missing deployment prerequisite is recorded separately from code implementation.

### Phase 2 — Build the dedicated route and four-step shell

- Add a server page at `settings/valid-id/page.tsx`, protected with the existing resident authentication pattern, and a client `valid-id-flow.tsx`.
- Keep the page reachable for signed-in residents who still need to complete their Profile, consistent with Android's ID screen. Service-request eligibility checks remain in their existing service flow.
- Implement step-specific headings/descriptions, “Step N of 4,” four progress segments, Previous, Continue, Submit, and the success state.
- Use the existing Settings content region; keep the sidebar mounted. On step changes, scroll the content to its heading and move keyboard focus appropriately.
- Keep the draft in memory, keyed by resident identity. Previous preserves entered values. Logout/account changes clear it and invalidate unfinished responses. Reloading starts a fresh draft; do not persist ID photos or details in local storage.
- Use inline field/action errors and the existing web pending controls. Prevent duplicate upload, extraction, and publication actions.

**Gate:** All four steps render on narrow and wide screens, and navigation preserves the current draft without publishing it.

### Phase 3 — Implement type selection, upload, and camera capture

- Use the shared ID list instead of the Profile form's duplicated local list.
- Provide distinct Upload a photo and Take a photo actions with a front-only instruction and preview.
- Validate MIME type, nonempty content, file size, and whether the browser can decode the image. Do not rely on a filename extension or the file input's accepted-type hint alone.
- Upload a new immutable owner-scoped front object. Changing the photo invalidates extracted/confirmed details so data from the previous image cannot be submitted accidentally. Cancelling a picker preserves the existing selection.
- For browser camera capture, request video only, prefer the rear camera where available, provide preview/capture/cancel controls, and encode a supported image format.
- Handle permission denial, unavailable cameras, and unsupported contexts with an upload fallback. Camera access needs a secure context and user permission. Stop camera tracks when closing, navigating away, or receiving a late permission result after cancellation. See [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- Do not depend solely on an HTML `capture` hint for desktop camera behavior; browser support varies. See [MDN capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).
- Revoke local preview object URLs when replaced or unmounted. Do not overwrite or delete published evidence as part of draft cancellation.

**Gate:** Upload and capture produce the same valid front-photo draft; invalid/cancelled selections cannot advance the flow.

### Phase 4 — Add extraction, editable details, and the birthday wheel

- Invoke the existing `extract-resident-id` function with the selected front storage path and ID type using the resident's authenticated Supabase client.
- Validate the extraction response shape. Display available fields without inventing missing values from the resident's Profile.
- For unreadable photos, unavailable OCR, or rate limits, show Try reading again and Enter details manually. An extraction failure must not make a successfully uploaded image unusable.
- Keep corrections when navigating backward. Do not automatically rerun extraction and overwrite corrections merely because the resident re-enters a step.
- Replace birthday typing with a browser dialog containing month/day/year wheels, faded neighboring values, and a highlighted center row matching Android.
- Initialize the wheels from the extracted/confirmed birthday. If blank, use an uncommitted default; do not assign a birthday until Use date is pressed.
- Support scrolling, tapping values, keyboard adjustment, focus trapping, Escape/Cancel, and returning focus to the birthday field. Provide a Not shown on ID action that clears the optional date.
- Clamp invalid days when month/year changes, handle Gregorian leap years, and prevent future birthdays. Store `YYYY-MM-DD` without timezone-driven date shifts.
- Port or share the pure calendar rules from Android's `birthday-wheel.ts`; keep the browser UI separate from React Native components. Avoid an Android refactor solely to share presentation code.

**Gate:** Corrections persist, wheel confirmation/cancellation behave correctly, and shared detail validation passes before the final review.

### Phase 5 — Implement review, publication, and recovery

- Show the complete front photo and confirmed ID type/name/number/birthday/address as read-only content. Render blank optional fields as Not shown on ID.
- Validate confirmed details again at Submit and call `publishIdEvidence` without a back path.
- Keep a stable submission ID for retries of an unchanged payload. A changed reviewed payload needs a new publication attempt identity. Preserve immutable evidence and the helper's identical-byte retry checks.
- Prevent double submission and keep the reviewed draft available after a recoverable network error. A lost response must not create duplicate versions on retry.
- On success, show Pending verification and refresh the profile, sidebar, and service verification displays. Reconcile updates from staff review and other sessions through fresh profile reads.
- Show current pending/failed/verified status when residents enter the page. Explain the need for renewed verification before they replace a verified ID.

**Gate:** One confirmed submission persists the reviewed front image and corrected details; staff approval and subsequent service requests work with front-only evidence.

### Phase 6 — Switch Settings, Profile, and existing verification links

- Add Valid ID directly after Profile in the desktop sidebar and the existing compact Settings navigation.
- Show a check icon only when `idVerificationState` confirms the current approved evidence. Show a warning for unverified, pending, failed/revoked, or repair-required states. Loading/read failures must not retain a stale verified badge; expose their status in accessible text.
- Update `settings/layout.tsx` and sidebar props/client refresh logic so status changes are visible without a full manual reload.
- Remove `IdDocumentSection`, its front/back upload controls, ID-only state/effects/helpers, and obsolete ID copy from the Profile page once the dedicated flow is complete.
- Update service verification links and search for all remaining references to `#upload-valid-id`.
- Preserve old bookmarked `/settings/profile#upload-valid-id` links with a client-side handoff to `/settings/valid-id`; URL fragments are not available to server redirects. Normal Profile navigation stays on Profile.
- Keep existing legacy service-request attachments intact; they are separate from resident ID verification. Preserve existing two-sided submissions and front-only approval previews.

**Gate:** Every resident ID verification entry point opens the new page, Profile contains no ID submission controls, and normal Profile editing still works.

### Phase 7 — Verify and release

Use meaningful unit tests for date rules, extraction/error handling, stale-response rejection, and publication retries. Use browser integration tests for the actual four-step page; distinguish fixture-backed checks from live backend/device checks.

Release acceptance checklist:

- [ ] Valid ID appears immediately after Profile, with correct status icons and accessible labels.
- [ ] Guests cannot open the protected submission page; account changes never expose the previous resident's draft.
- [ ] ID types and Other match Android's shared list/encoding.
- [ ] Upload/camera require only the front and enforce supported image/size rules.
- [ ] Camera permission denial, no camera, cancellation, and track cleanup work.
- [ ] OCR success, unreadable text, missing fields, rate limits, and manual entry work.
- [ ] Birthday is selected by wheels; leap days, shorter months, current-date limits, Cancel, and clearing work.
- [ ] Previous retains corrections; replacing the photo clears stale extracted details.
- [ ] Final review is read-only and matches the submitted payload.
- [ ] Double clicks and interrupted retries produce one committed version for the same payload.
- [ ] Submission shows pending; staff approval/rejection updates web and Android consistently.
- [ ] Front-only approval can be used for a service request, and older two-sided evidence still displays.
- [ ] Profile saving, avatar uploads, household editing, and old ID links work after the move.
- [ ] Desktop and mobile browser layouts, dark mode, keyboard navigation, focus, and zoom are checked.
- [ ] Resident web typecheck, lint, production build, focused tests, and relevant shared tests pass.
- [ ] Test the deployed extraction function with an authorized sample ID and test live publication/approval before marking the integration verified.

## 5. Expected file changes

Paths below are relative to the repository root, `C:/Users/User/barangayan`.

| File or area | Work |
| --- | --- |
| `apps/resident-web/src/app/(resident)/settings/valid-id/page.tsx` | New authenticated route and initial page data. |
| `apps/resident-web/src/app/(resident)/settings/valid-id/valid-id-flow.tsx` | New four-step client flow and success state. |
| `apps/resident-web/src/components/settings/valid-id/` | Focused web components for photo/camera, birthday wheel, and review where useful. |
| `apps/resident-web/src/lib/valid-id/` | Extraction adapter, draft transitions, and testable browser-independent helpers. |
| `apps/resident-web/src/app/(resident)/settings/settings-sidebar.tsx` | Navigation placement, icons, and accessible status. |
| `apps/resident-web/src/app/(resident)/settings/layout.tsx` | Initial ID status and sidebar data wiring. |
| `apps/resident-web/src/app/(resident)/settings/profile/page.tsx` and `profile-form.tsx` | Remove embedded ID submission and handle old anchor links. |
| `apps/resident-web/src/components/services/resident-service-form.tsx` | Replace verification link defaults and inspect front-only previews. |
| `apps/resident-web/tests/` | Focused unit and browser flow coverage. |
| `packages/shared/src/` | Reuse existing contracts/helpers; add shared pure date rules only if needed, with focused compatibility checks. |

Implementation order: contracts/readiness → route shell → type/photo → extraction/details/wheel → publication → navigation/Profile cutover → release verification. Deliver the cutover as one complete feature so residents are not left without a working ID submission entry point.
