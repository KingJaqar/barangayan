# Resident Web Toast Coverage Implementation Plan

Created: 2026-10-16 (Asia/Manila)

Revised: 2026-10-16 (Asia/Manila). Frontend-only scope and execution safeguards strengthened; execution phases numbered Phase 1 through Phase 8.

Status: Planning only. The message catalog below is proposed implementation copy; the additional notifications have not been implemented or tested. The existing login welcome and ordinary logout notifications are the baseline to preserve.

## 1. Objective and scope

Complete resident-web action feedback by adding the missing success, error, warning, and information notifications identified in the source audit. Reuse the existing toast system and keep its appearance unchanged. Preserve persistent inline recovery guidance and existing confirmation flows.

This document carries forward the conversation's complete action inventory, the proposed messages, the intentionally quiet interactions, and the special cases needed to make the messages truthful. It supplements `Resident_Web_Loading_Motion_and_Toast_Implementation_Plan.md`. For the actions explicitly cataloged here, this newer plan changes earlier decisions to omit a success toast where the catalog now specifies one. It does not reopen loading, motion, navigation, or unrelated phases of that plan.

Creating or polishing this document does not start implementation. Every phase below remains not started. Production readiness is an acceptance gate supported by evidence, not a guarantee inferred from this plan or from passing a single check.

### Included

- Resident-web authentication, registration, onboarding, and account settings.
- Email verification, email changes, and every existing password-recovery entry point.
- Appearance preferences, individual read/unread actions, and bulk announcement reads.
- Valid ID upload, camera capture, optional photo reading, submission, and uncertain-submission recovery.
- Medical-drive registration, service requests, page counts, payment choices, payment outcomes, receipts, and exports.
- Explicit location, routing, QR, camera, and fullscreen actions.
- Selected validation summaries and user-initiated search/refresh failures.

### Boundaries

- **Strictly frontend UI modifications only. No backend modifications.** Change only resident-web client presentation, local notification-result handling, focused frontend tests, and necessary implementation evidence.
- Backend/server files are inspection-only: do not edit route handlers, API endpoints, server actions, server-side auth/session handling, database queries executed on the server, Supabase functions, schema, migrations, RLS, triggers, grants, or service configuration. An existing server result may be consumed by client UI; it must not be changed to make a toast possible.
- Preserve existing client request payloads, query/ownership filters, endpoints, mutation counts, and request timing. A client hook calling an existing backend remains frontend code, but this plan permits only its local presentation/result handling, not changes to the business operation or extra network requests.
- If a required result cannot be established using existing responses and client-visible state, retain truthful inline feedback and mark that outcome blocked by the frontend-only boundary. Do not invent a result, add backend work, weaken a guard, or silently reduce the requirement to claim completion.
- Keep the shared toast position, card styling, colors, icons, dimensions, close control, theme behavior, stacking, and timing unchanged.
- No new product features, screens, dialogs, buttons, settings, camera/location capabilities, payment capabilities, or workflows. Add notification wiring and copy only at existing action boundaries. Existing inline feedback may receive narrowly scoped accessibility adjustments; its content, recovery controls, and layout stay intact.
- Reuse existing dependencies and existing auth/data operations. Do not add a notification service, polling loop, global request interceptor, automatic retry, or offline queue.
- Preserve redirects, authentication/session scopes, ownership filters, RLS behavior, validation, payment gates, fees, subscriptions, and business contracts.
- No schema changes, migrations, backend exceptions, production deployment, account deletion against a real account, or external messaging are authorized by this plan.
- Leave admin web, iOS, Android, and unrelated working-tree changes untouched. In particular, the permanently cancelled Android usability Phase 8 in `Major_Web_AndroidMobile_Improvement_Plan.md` remains cancelled; this document grants no Android UI authorization.
- Before any application-code implementation, read the repository's required Expo v57 documentation and the relevant installed Next.js documentation. Re-read applicable `AGENTS.md` instructions and inspect the then-current files before editing.

## 2. Baseline to preserve

| Component | Existing contract |
|---|---|
| `apps/resident-web/src/components/ui/sonner.tsx` | Single root Sonner host; top center; resident header anchor; theme-aware; maximum three visible; close control; focus/hover handling and dialog coexistence |
| `apps/resident-web/src/app/layout.tsx` | Root mounts the shared toast host |
| `apps/resident-web/src/lib/notify.ts` | `notify.success/error/warning/info`; optional description; per-attempt/event deduplication; account-session cleanup |
| `beginAttempt(action)` | Unique operation ID for one deliberate activation; one terminal toast for that attempt |
| `eventId(...parts)` | Stable, session-scoped identity for one observed event; use for polling/Realtime convergence |
| `NotificationSession` | Reports account identity, clears obsolete notifications, and handles unexpected sign-out |
| `apps/resident-web/src/lib/auth/session-feedback.ts` | Queues and consumes the explicit-login welcome; produces the ordinary logout success notification |
| Login success | `Welcome back {firstName} {lastName}`, falling back to `Welcome back` if the optional name read fails |
| Ordinary logout success | `Logged out`; persists through the transition to the guest/login screen |
| Durations | Success/info: 4 seconds; warning: 6 seconds; error: 8 seconds |

Feature changes must use the adapter rather than introducing more direct Sonner imports. Existing direct calls may be migrated in the handlers being changed when necessary to deduplicate the whole action. Do not expand this into an unrelated application-wide rewrite.

Keep the existing adapter and host architecture. Do not create a second notification framework, parallel legacy/new pathway, new public application function, or additional generic abstraction for this work. Prefer extending the existing handler or notification helper; a minimal private helper is justified only when required to keep the scoped wiring correct and smaller. New source files are a last resort and require a documented reuse limitation, not a new product capability.

## 3. Notification and copy rules

### 3.1 What produces a toast

1. A deliberate operation produces the cataloged terminal notification only after its result is known.
2. A confirmed rejection produces an error. Connection loss, timeout, or a missing response after a write may have reached the server produces an uncertainty warning instead.
3. A deliberate cancellation may produce the cataloged information message. Browser share-sheet and color-picker dismissal stay quiet.
4. A repeated callback, double activation, React effect replay, polling update, or Realtime update must not duplicate the same outcome.
5. A later deliberate attempt with identical text is a new attempt and may notify again.
6. Ordinary navigation, tabs, filters, sorting, pagination, map gestures, previews, and background refresh stay quiet as specified in section 4.6.
7. A read returning empty results is not a failure. An unavailable, stale, missing, or inaccessible record must retain its accurate inline state.
8. Do not toast progress on a timer. Retain existing pending labels and loading states. The explicitly cataloged street-selection information message belongs to that user selection, not to a terminal routing attempt.

### 3.2 Truthful and useful wording

- Use short titles. Move a second sentence into the existing optional description when it improves readability; this does not change the shared UI.
- Never expose raw SQL, stack traces, access tokens, HTTP/status numbers, database error codes, internal service details, or arbitrary server messages in resident-facing toast titles or descriptions. Map known cases to plain-language catalog copy and keep safe recovery guidance inline. Internal structured codes may be inspected locally to select copy; do not display them, remove diagnostic handling, or conceal a real failure with a success message.
- Preserve account-enumeration protection for public password reset: do not reveal whether an email is registered.
- Do not claim an ID is verified when it was only uploaded/submitted, a payment was received when only a method was saved, or a browser download actually completed when it was merely initiated.
- Use saved/applied wording only after the corresponding persistence/result is confirmed. Guest preferences are device-local.
- User-provided names and reference numbers are plain text, never interpreted HTML. Never show another account's name or outcome.
- Placeholder values such as `{number}`, `{method}`, `{reference number}`, and `{content name}` must be populated from the confirmed result or a controlled display-label map.

### 3.3 One announcement, persistent guidance

Some new success toasts accompany existing confirmation dialogs or screens. Keep their content and navigation intact. Assign one accessible announcement owner to each outcome: announce the toast once, and keep duplicate inline confirmation text readable without a second automatic live announcement. Dialog title/focus behavior must still identify the new screen and meet accessibility requirements. Do not globally remove alert semantics or suppress unrelated validation errors.

When field validation produces both a summary toast and multiple inline errors, use the toast as the single summary announcement and preserve field associations, `aria-invalid`, and focus on the first invalid field. Avoid multiple identical live announcements.

### 3.4 Lifecycle, identity, and storage

- Capture the operation's account/entity identity and suppress a late outcome after that identity changes.
- Do not tie notification delivery to the form remaining mounted if the operation legitimately continues after it closes. Do not update an unmounted component's state.
- A toast for the action that intentionally ends a session must be issued in the correct guest notification session and survive the expected navigation. Do not generalize `keepOnSessionChange` to unrelated notifications.
- Reuse the existing login handoff for explicit login only; do not turn ordinary refresh, token renewal, password reauthentication, or identity linking into another welcome event.
- A browser-storage failure is a warning about persistence, not failure to apply the current in-memory preference. Report it once for the deliberate action, not once per internal storage call.
- No repeated toast for each drag, color-slider movement, permission-state update, route poll, or Retry rendering. Identify the deliberate commit or explicit request boundary.

### 3.5 Bounded execution and no notification loops

- Notifications are a presentation sink. Showing, dismissing, or rendering a toast must never start a fetch, write, route refresh, retry, timer, state-machine restart, or another notification.
- Add no new polling, retry scheduler, unbounded loop, recursive recovery, or timer-based completion assumption. Existing route/payment polling and camera/location watches keep their current cadence and cleanup; they are not removed or retimed for toast work.
- A Retry button starts one existing attempt per accepted activation. It does not start another attempt when an error toast closes or when the component renders again.
- Do not make an effect depend on an object/function that it recreates through its own notification-state updates. Prefer existing explicit event handlers; use effects only for already-observed lifecycle outcomes with a stable identity.
- Use the existing attempt/event deduplication. A callback from an obsolete attempt must not be reissued with a fresh ID to bypass suppression. Bookkeeping stays bounded; no permanent per-event arrays or growing log caches.
- Settle local pending/guard state on every handled terminal path, including returned rejection, thrown error, cancellation, account change, and unmount. Preserve deliberate navigation-pending behavior until the existing destination replaces the screen.
- Clear listeners/timers added for strictly necessary frontend wiring, abort supported reads when appropriate, and stop owned media resources using the existing lifecycle. Do not invent cancellability for an irreversible submitted write.
- If one verification approach fails repeatedly, stop that approach after at most three materially identical attempts, inspect the evidence, and either correct the cause or record the exact limitation. Do not rerun an unchanged failing command or flow indefinitely.

### 3.6 Small changes and replacement cleanup

- Implement a small, reviewable action group at a time. Keep one authoritative handler/notification owner and reuse current hooks, styles, types, result objects, and dependencies.
- When a handler, notification branch, helper, or file is actually replaced, remove the superseded implementation in the same change after its callers are migrated. Do not leave both old and new code, commented-out copies, compatibility shims with no callers, temporary fixtures, unused imports, or dead state/effects.
- Before deleting a file, verify static imports, barrel exports, dynamic imports, route/file conventions, test references, and other workspace consumers. Preserve required framework entry points and any still-used shared behavior. Absence from one text search is not proof that a file is unused.
- Scope deletion to code made obsolete by this plan. Do not run a general repository cleanup, remove historical plans/evidence, delete user changes, or remove backend/shared/platform files outside scope.
- Record meaningful replacements/removals with their former caller and current owner. If a reference cannot be resolved confidently, keep the file and document the question rather than guessing.
- Avoid new dependencies, heavy utilities, broad component refactors, duplicate message registries, and one abstraction/file per toast. Use the existing project's organization and minimal necessary state.

### 3.7 Evidence before claims

- Section 4 is a proposed copy catalog grounded in an earlier source audit. It is not proof of current reachability, execution behavior, or a production defect. Re-read the actual handler, caller, response, and destination before marking a row ready to implement.
- Link every implemented row to its verified source path/action owner and the result signal used to choose its severity. Record unexpected differences instead of guessing a missing API, result field, or user flow.
- Do not invent callbacks, browser completion events, response fields, error classifications, supported platforms, or passing tests. If the existing result only establishes uncertainty, use warning copy or retain accurate inline feedback.
- Distinguish source review, automated verification, mocked browser behavior, and actual browser execution in the ledger. A mocked success does not prove a live external integration completed.
- Do not call the implementation bug free, fully working, or production ready while scoped failures, missing evidence, inaccessible required paths, or unfinished outcomes remain. Report exactly what passed and what remains unverified.

## 4. Complete action and message catalog

Legend: **S** = success, **E** = error, **W** = warning, **I** = information. **Both** means neither success nor failure has a toast in the audited path. Listed copy is for missing outcomes only; preserve already-covered outcomes unless a touched handler needs consolidation. 'No toast' is an explicit implementation decision, not unfinished coverage.

The Current feedback column describes the audited baseline, not the result after implementing this plan. Revalidate it before each phase because the repository has concurrent work.

### 4.1 Account, email, and password actions

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| AUTH-01: Start Google sign-in | Failure | Error below the Google button | **E:** Couldn't connect to Google. Please try again. |
| AUTH-02: Complete Google sign-in when its callback fails | Failure | Dedicated error page | **E:** Google sign-in couldn't be completed. Please start again. |
| AUTH-03: Register a new account | Success | Account-created modal | **S:** Account created. Log in to continue. |
| AUTH-04: Registration requires unsupported email confirmation | Failure | Inline error | **W:** Your account needs email confirmation. Contact barangay support for help. |
| AUTH-05: Send the initial public password-reset code | Success | Opens code-entry page | **S:** If this email has an account, a reset code has been sent. |
| AUTH-06: Successfully verify a public password-reset code | Success | Opens password-reset page | **S:** Code verified. Choose your new password. |
| AUTH-07: Check recovery eligibility inside Settings | Both | Dialog guidance or error | **S:** Your account is ready for password recovery.<br>**W, unverified email:** Verify your email before resetting your password.<br>**E:** Couldn't check your account. Please try again. |
| AUTH-08: Send/resend a code inside the Settings recovery dialog | Both | Code-entry step or inline error | **S:** Reset code sent. Check your email.<br>**E, confirmed rejection:** Couldn't send the reset code. Please try again.<br>**W, uncertain:** We couldn't confirm the code was sent. Check your email before trying again. |
| AUTH-09: Verify a code inside the Settings recovery dialog | Both | Password step or inline error | **S:** Code verified. Choose your new password.<br>**E, invalid/expired:** Code not accepted. Check the code or request a new one.<br>**E, connection:** Couldn't verify the code. Check your connection and try again. |
| AUTH-10: Update the password inside the Settings recovery dialog | Both | Password-updated confirmation | **S:** Password updated. Log in with your new password.<br>**E, confirmed rejection:** Couldn't update your password. Please try again.<br>**W, uncertain:** We couldn't confirm the password change. Try logging in before resetting it again. |
| AUTH-11: Log out after password recovery | Both | Opens Login or shows inline error; bypasses ordinary logout hook | **S:** Logged out.<br>**E:** Your password was updated, but we couldn't log you out. Please try again. |
| AUTH-12: Verify a code through the separate Settings recovery page | Both | Redirect or inline returned error | **S:** Code verified. Choose your new password.<br>**E, invalid/expired:** Code not accepted. Check the code or request a new one.<br>**E, connection:** Couldn't verify the code. Check your connection and try again. |
| AUTH-13: Resend a code through the separate Settings recovery page | Failure | Inline returned error; success already toasts | **E:** Couldn't send a new code. Please try again.<br>**W, uncertain:** We couldn't confirm a new code was sent. Check your email first. |
| AUTH-14: Update a password through the separate Settings recovery page | Both | Confirmation/redirect or inline returned error | **S:** Password updated. Log in with your new password.<br>**E, confirmed rejection:** Couldn't update your password. Please try again.<br>**W, uncertain:** We couldn't confirm the password change. Try logging in before resetting it again. |
| AUTH-15: Send/resend an email-verification code | Both | Inline Code sent message | **S:** Verification code sent. Check your email.<br>**E:** Couldn't send the verification code. Please try again.<br>**W, uncertain:** We couldn't confirm the code was sent. Check your email first. |
| AUTH-16: Verify the email address | Both | Verified status card | **S:** Email verified.<br>**E, invalid code:** Code not accepted. Check the code or request a new one.<br>**E, connection:** Couldn't verify your email. Please try again. |
| AUTH-17: Use current sign-in email | Both | Refresh or inline error | **S:** Profile email updated to your sign-in email.<br>**E:** Couldn't update your profile email. Please try again. |
| AUTH-18: Request an email-address change | Both | Inline instructions | **S:** Confirmation instructions sent. Check your inboxes.<br>**E:** Couldn't request the email change. Please try again.<br>**W, uncertain:** We couldn't confirm the request. Check your inboxes before trying again. |
| AUTH-19: Resend email-change confirmation | Both | Inline confirmation or error | **S:** Confirmation instructions resent. Check your inboxes.<br>**E:** Couldn't resend confirmation. Please try again.<br>**W, uncertain:** We couldn't confirm the instructions were resent. Check your inboxes first. |
| AUTH-20: Check email-change confirmation | Both | Inline changed/pending/error message | **S:** Email address changed.<br>**I, pending:** Your email change is still awaiting confirmation.<br>**I, no completed change:** No completed email change was found. Check your confirmation emails.<br>**E:** Couldn't check confirmation. Please try again. |
| AUTH-21: Return from an email-change confirmation link | Both | Updated details or inline error | **S, confirmed:** Email address changed.<br>**I, still pending:** One more confirmation may be needed. Check both inboxes.<br>**E:** Couldn't complete email confirmation. Request a new confirmation email. |
| AUTH-22: Delete the account | Failure | Inline password/rate-limit/deletion errors; success already toasts | **E, incorrect password:** Incorrect password. Your account wasn't deleted.<br>**E, rate limit:** Too many attempts. Wait a moment and try again.<br>**E, missing email:** We couldn't verify account ownership. Contact barangay staff.<br>**E, confirmed deletion rejection:** Couldn't delete your account. Review the message below.<br>**W, uncertain deletion:** We couldn't confirm account deletion. Check your account before trying again. |

Implementation notes:

- AUTH-02 and AUTH-21 require client-side once-only delivery using the existing destination state and existing frontend notification facilities. Server callbacks, query parameters, response contracts, and server actions are inspection-only. Reading a static error query parameter on every mount must not replay a toast. A genuine repeat attempt may notify again. Use only minimal session-bound transient data; do not put names or sensitive results in URLs. If the existing client-visible signals cannot distinguish a result or attempt safely, document that outcome as blocked instead of modifying the backend or guessing.
- Verify ownership and the actual result before selecting AUTH-21 success. Returning to the page is not proof that the email changed. Do not change the existing two-inbox confirmation contract.
- Treat structured server-action redirects as navigation, not caught application failures. Inspect both page and dialog variants; do not assume the same handlers cover both.
- AUTH-07 success is for an explicit eligibility recheck. Opening a dialog that automatically checks eligibility should not generate an unsolicited success toast.
- AUTH-11 applies to both dialog and page recovery completion. If password update and logout complete together, use one success notification: `Password updated. Log in with your new password.` The standalone `Logged out.` copy is for an explicit later sign-out retry/completion. Do not emit a misleading logout error when logout succeeded but opening Login failed; retain the existing inline navigation recovery and, if a toast is needed, use **W:** `You're logged out. Open Login to continue.`
- Reuse existing rate-limit, expired-session, and weak-password guidance. Do not map all returned failures to an invalid-code or generic connection message.

### 4.2 Appearance and read-status actions

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| PREF-01: Change light/dark theme | Success | Immediate appearance change; database errors already toast | **S, confirmed account save:** Theme preference saved.<br>**S, guest:** Theme updated on this device. |
| PREF-02: Change accent color | Success | Immediate color change; database errors already toast | **S, confirmed account save:** Accent color saved.<br>**S, guest:** Accent color updated on this device. |
| PREF-03: Change font | Success | Immediate font change; database errors already toast | **S, confirmed account save:** Font preference saved.<br>**S, guest:** Font updated on this device. |
| PREF-04: Add a custom accent color | Success; local-storage failure | Swatch appears; storage failure silently tolerated | **S:** Custom color added.<br>**W, local-storage failure:** Color added for this session. Your browser couldn't save it. |
| PREF-05: Remove a custom accent color | Both | Swatch disappears; storage failure silently tolerated | **S:** Custom color removed.<br>**W, local-storage failure:** Color removed for this session. Your browser couldn't save the change. |
| READ-01: Mark all announcements as read | Success | Indicators update; failure already toasts | **S:** All announcements marked as read. |
| READ-02: Mark one announcement as read | Both | Indicator updates; returned database errors not surfaced | **S:** Announcement marked as read.<br>**E:** Couldn't mark the announcement as read. Please try again. |
| READ-03: Mark one announcement as unread | Both | Same behavior | **S:** Announcement marked as unread.<br>**E:** Couldn't mark the announcement as unread. Please try again. |
| READ-04: Mark one incident report as read | Both | Indicator/count updates; returned database errors not surfaced | **S:** Report marked as read.<br>**E:** Couldn't mark the report as read. Please try again. |
| READ-05: Mark one incident report as unread | Both | Same behavior | **S:** Report marked as unread.<br>**E:** Couldn't mark the report as unread. Please try again. |

Implementation notes:

- Await the actual persistence result for 'saved' copy. A locally applied theme and an empty successful HTTP response are not, by themselves, proof that a profile row changed. Do not add a confirmation read, change a mutation query, or alter server behavior for this plan. If the existing contract cannot support 'saved', use **I:** `Preference applied. We couldn't confirm it was saved to your account.` and record the limitation.
- For overlapping preference saves, correlate outcomes to the current deliberate selection. An obsolete response must not announce the wrong selected value. Avoid toast-per-slider-tick behavior.
- Custom color addition may also select/save an accent. That single user action gets one terminal outcome, not separate color-added and accent-saved toasts. A partial persistence failure gets one warning explaining what applied and what was not confirmed.
- Guest storage failure must not produce a device-saved success followed by a contradictory warning. If the preference applied in memory but could not persist, use **W:** `Preference updated for this session. Your browser couldn't save it.`
- Check returned and thrown errors for read/unread writes. Let the caller consume a clear result; do not silently refresh after a rejected update or show success because an async handler merely returned.
- A refresh failure after a confirmed read/unread write is not a write failure. Preserve the success outcome and show stale-count guidance inline if needed.
- Do not notify from shared hooks for automatic/background read bookkeeping. Put notification ownership at the explicit resident-action boundary. Functions with no current user-facing caller are not new UI work.

### 4.3 Valid ID and health registration

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| ID-01: Upload/replace the front ID photo | Both | Preview/caption or inline error | **S:** ID photo uploaded. Review the details before submitting.<br>**E:** Couldn't upload the ID photo. Please try again. |
| ID-02: Open the camera for an ID photo | Both | Camera preview or inline error | **Success:** No toast; preview confirms readiness.<br>**E:** Couldn't open the camera. Allow camera access or upload a photo. |
| ID-03: Capture an ID photo | Both | Starts upload or shows inline error | **Success:** Use ID-01 after upload finishes; no separate capture-success toast.<br>**E:** Couldn't capture the photo. Try again or upload an existing photo. |
| ID-04: Read details from the ID photo | Both | Suggestions and inline result | **S:** ID details read. Review every value before submitting.<br>**W, incomplete:** Some ID details couldn't be read. Check and complete them manually.<br>**E:** Couldn't read the ID photo. You can enter the details manually. |
| ID-05: Cancel ID-photo reading | Cancellation/info | Inline cancellation message | **I:** Photo reading cancelled. You can enter the details manually. |
| ID-06: Cancel an ID-photo upload | Cancellation/info | Upload stops | **I:** Photo upload cancelled. |
| ID-07: Submit/replace a valid ID | Both | Confirmation screen or inline error | **S:** ID submitted for staff review.<br>**E, rejected:** Your ID submission couldn't be accepted. Review the details and try again.<br>**W, uncertain:** We couldn't confirm your ID submission. Use Retry to check the same submission. |
| ID-08: Retry an uncertain ID submission | Both | Confirmation or inline guidance | **S:** Your ID submission is confirmed and awaiting staff review.<br>**W, still uncertain:** We still couldn't confirm your submission. Use Retry to check again.<br>**E, confirmed rejection:** Your ID submission couldn't be accepted. Review the details and try again. |
| HEALTH-01: Submit a medical-drive registration | Both | Confirmation/applicant number or inline error | **S:** Registration confirmed. Applicant number: {number}.<br>**E, rejected:** Couldn't complete your registration. Review the message below.<br>**W, uncertain:** We couldn't confirm your registration. Check My Registrations before trying again. |

Implementation notes:

- Preserve current abort signals, operation locks, account checks, uploaded-photo handling, edited-field protection, and same-submission retry identity.
- Suppress stale upload/OCR/camera completion after cancellation; it must not produce success after a cancellation toast.
- Cancellation reports the stopped browser operation only. Do not claim a server-side upload was rolled back or deleted.
- Distinguish no/partial OCR suggestions from transport/service failure. Keep manual entry available and preserve edited values.
- Camera errors are local to this acquisition attempt. Re-rendering the guidance must not repeatedly toast the same camera denial.
- Do not replace staff-review status or imply approval. HEALTH-01 must use the returned applicant number, not a generated client label.

### 4.4 Service requests, payments, and downloads

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| SERVICE-01: Request Document account/profile check fails | Failure | Inline error in document modal | **E:** Couldn't check your account. Please try again. |
| SERVICE-02: Submit a service request while the form remains open | Success | Advances to payment; existing success toast only after form unmount | **S:** Request submitted. Reference: {reference number}. |
| SERVICE-03: Save an older request's page count | Both | Payment methods or inline error | **S:** Page count saved.<br>**E, rejected:** Couldn't save the page count. Please try again.<br>**W, uncertain:** We couldn't confirm the page count was saved. Refresh the request before trying again. |
| PAY-01: Save the chosen payment method | Success | Advances to next step; failures already toast | **S:** Payment method saved: {method}. |
| PAY-02: Record Pay at Pickup, including retry | Both | Recorded message or inline error | **S:** Pay at Pickup recorded. Payment is due at collection.<br>**E, rejected:** Couldn't record Pay at Pickup. Please try again.<br>**W, uncertain:** We couldn't confirm Pay at Pickup. Check your request before retrying. |
| PAY-03: Generate/start a QR PH payment | Both | QR image or inline error | **S:** Payment QR code is ready.<br>**E, rejected/unavailable:** Couldn't prepare the payment QR code. Please try again.<br>**W, uncertain setup:** We couldn't confirm the payment setup. Check your request before starting another payment. |
| PAY-04: Receive a confirmed QR PH payment | Success | Payment-confirmed dialog and receipt screen | **S:** Payment received. Your receipt is ready. |
| FILE-01: Download a payment receipt | Both | Browser download; no dedicated failure handler | **S:** Receipt download started.<br>**E:** Couldn't prepare the receipt download. Please try again. |
| FILE-02: Export personal data as PDF | Success | Opens print dialog; failures already toast | **S:** Your data is ready. Choose Save as PDF in the print dialog. |
| SERVICE-04: Retry the approved-ID check in a service form | Both | Updated ID information or inline error | **S, approved:** Approved ID confirmed. You can continue.<br>**W, not approved:** Your ID isn't approved yet. Open Valid ID in Settings for details.<br>**E:** Couldn't check your approved ID. Please try again. |

Implementation notes:

- SERVICE-02 must have one owner for mounted and unmounted outcomes; do not retain the old unmounted success branch as a second notification path.
- Method selection and pickup recording may be one automatic chain. If pickup is selected and recording follows automatically, PAY-02 owns the combined terminal success; suppress the intermediate PAY-01 success in that branch. For QR PH, the confirmed method-save and QR-generation boundaries may notify separately, but avoid simultaneous queued successes if both finish together; prioritize the QR-ready outcome.
- Never call Pay at Pickup 'paid'. Confirmed payment success requires an authoritative paid result for the owned payment/request, not a countdown, route URL, image availability, or a clicked button.
- PAY-04 must deduplicate by payment identity across polling, Realtime, redirects, and cancellation racing with settlement. Do not replay payment-received when reopening an already-paid historical request or receipt.
- Preserve current QR PH availability gates. Test disabled/gated paths without enabling settlement or changing fees to demonstrate a toast.
- Keep cancellation and expiry notifications already present. Do not add a paid message alongside a cancelled result for the same payment outcome.
- FILE-01 success means download initiation, not completed storage on the resident's device. Catch synchronous PDF/Blob/link preparation failures; browsers do not expose a reliable completion event here.
- FILE-02 success is for prepared data and a successfully opened print view; never claim a PDF was saved. Keep blocked-popup and export errors.
- SERVICE-04 is explicit Retry only. Initial approval checks, account changes, and background updates stay quiet.

### 4.5 Location, maps, and emergency actions

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| LOC-01: Detect location during registration | Both | Coordinates or inline error | **S:** Device location found.<br>**E, permission:** Location access is blocked. Allow access or place your home pin manually.<br>**E, unavailable:** Couldn't find your location. Try again or place your home pin manually. |
| LOC-02: Confirm the registration home pin | Success | Inline confirmation | **S:** Home location selected for registration. |
| LOC-03: Retry the registration map | Both | Reloaded map or inline error | **Success:** No toast when the map appears.<br>**E:** Couldn't load the map. You can still continue registration. |
| LOC-04: Use My Location in a new incident report | Both | Pin update or inline error | **S:** Location found. Check the report pin before submitting.<br>**E:** Couldn't find your location. Allow location access and try again. |
| LOC-05: Show My Location on the general map | Success | Marker/recentering; failures already toast | **S:** Your location is shown on the map. |
| LOC-06: Detect location in Location Verification | Success | Pin/address update | **S:** Location found. Review the pin and save it. |
| LOC-07: Detect/select an out-of-boundary point in Location Verification | Rejection/warning | Inline boundary notice | **W:** This location is outside the barangay boundary. Choose a location inside the outlined area. |
| LOC-08: Look up an address for a pin | Both | Filled address or inline failure | **Success:** No toast when the address fills in.<br>**W:** Couldn't find the address. You can enter it manually. |
| EM-01: Acquire/retry location on Emergency Centers | Both/status | Location card and map changes | **S:** Location found. Review it before continuing.<br>**E:** Couldn't find your location. Check location access and try again. |
| EM-02: Confirm location on Emergency Centers | Success/status | Status card and route calculation | **S:** Location selected for route planning. |
| EM-03: Discard location on Emergency Centers | Info/status | Selection clears | **I:** Location discarded. |
| EM-04: Calculate/retry an evacuation walking route | Both/status | Map route and status card | **S:** Walking route ready. Review the route guidance.<br>**W, no route:** No available walking route was found. Review the guidance below.<br>**E, service failure:** Couldn't calculate the route. Check your connection and try again. |
| EM-05: Choose a nearby street for routing | Success/status | Route recalculates | **I:** Street selected. Updating your route. |
| EM-06: Load/retry the household QR code | Both | QR image or inline error | **Success:** No toast when the QR appears.<br>**E:** Couldn't load your household QR code. Please try again.<br>**E, session:** Log in again to view your household QR code. |
| EM-07: Start/retry QR scanner camera | Both | Live scanner or camera guidance | **Success:** No toast when scanning starts.<br>**E, permission:** Camera access is blocked. Allow access or upload a QR image.<br>**E, other failure:** Couldn't start the camera. Try again or upload a QR image. |
| EM-08: Share evacuation QR through native sharing | Success/cancellation | Browser/system share sheet | **No additional toast.** Keep existing clipboard-fallback success/error notifications. |
| MAP-01: Enter/exit map fullscreen | Both | Fullscreen changes; no dedicated rejection feedback | **Success:** No toast.<br>**E:** Couldn't change fullscreen mode. You can continue using the map. |

Implementation notes:

- Location selected during registration is not a saved, verified profile location. Preserve the existing distinction between device GPS and the chosen home pin.
- Explicit geolocation attempts notify; automatic first-load acquisition stays quiet. Continuous watch fixes do not each get a toast.
- LOC-07 is one notification per deliberate rejected selection, not one per drag frame. Preserve the registration map's advisory allowance for out-of-boundary registration; do not apply Location Verification's blocking rule there.
- EM-04 success means a route was returned, not that a center is confirmed open or travel is guaranteed safe. Preserve detailed route warnings, freshness, coverage, and availability in the status card.
- Auto-refresh route results stay quiet. A street choice gets EM-05 information; the resulting route may have a single terminal outcome, not duplicate messages from each observer.
- Preserve browser permission behavior, HTTPS requirements, manual alternatives, stopped camera tracks, abort handling, and unmounted-map guards.
- Share-sheet cancellation is not an error. Fullscreen success is visible; catch only actual rejected operations for MAP-01.

### 4.6 Other interactions and intentionally quiet behavior

| Action | Toast missing | Current feedback | Toast Message |
|---|---|---|---|
| OTHER-01: Complete onboarding | Success | Opens Home | **S:** You're all set. Welcome to Barangayan. |
| OTHER-02: Remember onboarding when browser storage fails | Warning | Failure silently tolerated | **W:** Your browser couldn't remember setup completion. You may see this introduction again. |
| OTHER-03: Select a color with the screen eyedropper | Both | Color changes; errors ignored | **Success/cancellation:** No toast.<br>**E, actual failure:** Couldn't pick a screen color. Choose a color manually. |
| VALID-01: Submit invalid registration details | Validation | Fields and first-invalid focus | **E:** Check the highlighted registration details. |
| VALID-02: Submit an invalid new password | Validation | Field messages and focus | **E:** Check the password requirements and confirmation. |
| VALID-03: Submit health registration with missing consent/invalid age | Validation | Inline message | **E:** Review your age and consent before registering. |
| VALID-04: Continue/submit invalid ID details | Validation | Field messages | **E:** Review the highlighted ID details. |
| VALID-05: Submit an incomplete incident report | Validation | Inline message | **E:** Complete the required report details and select a location. |
| SEARCH-01: Search/retry search | Both | Results/loading/inline error | **Success:** No toast.<br>**E:** Couldn't complete the search. Please try again. |
| QUIET-01: Change filters, sorting, tabs, or pagination | Success | Visible results/selection change | **No toast.** |
| QUIET-02: Pan, zoom, reset, or select a map marker | Success | Map changes | **No toast.** |
| QUIET-03: Select/remove an attachment before submission | Success | File list or preview changes | **No toast.** Existing file-validation errors and upload/submission outcomes remain authoritative. |
| QUIET-04: Open/close a dialog or drawer | Success | Dialog opens/closes | **No toast.** |
| QUIET-05: Cancel editing before saving | Cancellation | Returns to previous view | **Normally no toast.** Only an existing explicit discard-confirmation action may use **I:** Unsaved changes discarded. Do not introduce a new discard dialog/flow. |
| REFRESH-01: Manually refresh/retry loading data | Both | Loading/updated content/inline error | **Success:** No toast.<br>**E:** Couldn't refresh {content name}. Please try again. |
| QUIET-06: Background refresh/automatic loading | Both | Existing loading/error/status UI | **No toast.** Persistent inline guidance handles failures. |

Implementation notes:

- OTHER-01 may overlap with the existing login welcome. Do not put two welcome toasts on top of each other. The login welcome belongs to login; onboarding completion gets one message only when the resident explicitly finishes. OTHER-02 replaces OTHER-01 when local completion cannot be remembered.
- Validation summaries happen on explicit submit/continue only, never on each keystroke, blur, or invalid render. Preserve browser-native required-field handling where it already stops submission.
- SEARCH-01 is explicit search submission/Retry only. Live typeahead requests, aborted queries, stale responses, and partial suggestion failures stay inline and quiet. Preserve usable partial search results.
- REFRESH-01 covers existing explicit read retries across search, lists, details/drawers, health, services, payment details, ID status, emergency content, maps, and informational pages. Re-inventory actual controls; do not invent refresh buttons. Specific cataloged retry actions own their outcomes and must not also emit this generic error.
- A background request failing while an explicit retry exists elsewhere is still a background failure. Preserve the operation source so it cannot accidentally toast.

## 5. Source ownership and implementation map

All paths below are repository-relative. This is a starting map, not permission to rewrite every listed file. Server routes, server actions, and server page logic listed here are reference-only; notification work belongs in existing client UI handlers/components. Do not move server behavior to the client or create endpoints/components/workflows solely to bypass the frontend-only boundary.

| Area | Source references; edit only in-scope client UI handling |
|---|---|
| Shared notification/session lifecycle | `apps/resident-web/src/lib/notify.ts`; `src/lib/auth/session-feedback.ts`; `src/components/shared/notification-session.tsx`; `src/hooks/use-sign-out.ts` |
| Google and registration | `src/components/auth/google-button.tsx`; `src/app/auth/callback/route.ts`; `src/app/auth/error/page.tsx`; `src/app/(auth)/register/register-form.tsx` |
| Recovery | `src/app/(auth)/forgot-password/page.tsx`; `verify-otp/verify-otp-form.tsx` and `page.tsx`; `reset-password/reset-password-form.tsx` and `page.tsx`; `src/app/(resident)/settings/change-password/forgot-password-dialog.tsx` |
| Email/account | `src/app/(resident)/settings/email-verification/verification-form.tsx`, `change-email-form.tsx`, `actions.ts`, `page.tsx`; `src/app/auth/email-change/route.ts`; `settings/delete-account/delete-account-form.tsx` |
| Appearance | `src/app/(resident)/settings/theme/theme-form.tsx`; `src/components/theme/theme-controller.tsx`, `accent-controller.tsx`, `font-controller.tsx`, `color-picker-popover.tsx` |
| Read status | `src/hooks/use-unread-counts.tsx`; `src/components/reports/announcement-card.tsx`, `incident-card.tsx`; `src/app/(resident)/announcements/announcements-feed.tsx` |
| Valid ID/health | `src/app/(resident)/settings/valid-id/valid-id-flow.tsx`, `camera-dialog.tsx`; `src/components/health/applicant-form.tsx`; `src/hooks/use-medical-drives.ts` |
| Service/payment | `src/components/services/resident-service-form.tsx`, `request-page-count.tsx`, `request-payment-journey.tsx`, `download-receipt-button.tsx`; `document-request-modal/document-request-modal.tsx`, `payment-method-step.tsx`, `pickup-step.tsx`, `qrph-step.tsx`; `src/hooks/use-paymongo-source.ts` |
| Export/location | `src/app/(resident)/settings/download-data/page.tsx`; `settings/location-verification/location-verification-form.tsx`; `src/components/auth/registration-map.tsx`; `src/app/(resident)/reports/new/new-report-form.tsx` |
| Maps/emergency | `src/components/maps/locate-button.tsx`; `src/hooks/use-fullscreen.ts`, `use-device-location.ts`, `use-connected-route.ts`; `src/components/emergency/location-status-card.tsx`, `route-status-card.tsx`, `household-qr-dialog.tsx`, `qr-scanner-dialog.tsx`, `qr-show-dialog.tsx` |
| Onboarding/search/read retries | `src/app/(auth)/onboarding/page.tsx`; `src/lib/onboarding.ts`; `src/components/search/search-input.tsx`; `src/hooks/use-resident-search.ts`; existing explicit retry callers and read-error components |

Except for the first full path in each area, `src/...` means `apps/resident-web/src/...`. Reusable read/data hooks should report results; feature action handlers normally own notifications. Avoid putting toasts in a shared error renderer, as re-renders and automatic reads would replay them.

## 6. Execution phases

Run Phase 1 through Phase 8 in order. Each phase has one initial verification pass; repeat checks only after a material change or a new finding justifies them. Do not keep reopening completed phases or restarting the whole plan. Preserve failing/blocked evidence, finish independent authorized work, and never mark an incomplete phase complete.

These phase numbers belong only to this resident-web toast plan. Phase 8 below is final resident-web verification and has no connection to the cancelled Android usability Phase 8 in the separate major-improvement plan.

| Phase | Status | Required gate |
|---|---|---|
| Phase 1 | Complete — 2026-10-16 | Source-verified action/result map, quiet decisions, and precise frontend-only limitations recorded; no application wiring in this phase |
| Phase 2 | Partially complete — 2026-10-17 | AUTH-01–22 implemented and locally verified, including callbacks; real recovery-session redirect and assistive-technology verification pending |
| Phase 3 | Partially complete — 2026-10-17 | PREF-01–05 and READ-01–05 implemented and locally verified, including affected-row success; hosted persistence and assistive-technology verification pending |
| Phase 4 | Complete — 2026-10-17 | ID/health implementation, browser/SQL/real local HTTP acceptance and owner-attested camera/OCR/spoken checks verified |
| Phase 5 | Complete — 2026-10-17 | Request/payment/export implementation, browser/SQL/real local HTTP races and owner-attested provider timing/spoken checks verified |
| Phase 6 | Partially complete — 2026-10-17 | Implementation/local browser gates passed; physical browser-permission and spoken-accessibility verification pending |
| Phase 7 | Partially complete — 2026-10-17 | All reachable coverage locally verified, including approved server-result handoff; physical/spoken verification pending; removed onboarding obsolete |
| Phase 8 | Not started | All feasible scoped outcomes verified, cleanup complete, limitations recorded |

Common gate for every implementation phase: a narrowly scoped diff; no backend/server/business-contract changes; no new UI/product capabilities; superseded code removed with references checked; targeted checks passed or a concrete limitation recorded. Gates are not evidence that has already been collected.

### Phase 1: Revalidate baseline and assign outcome owners

- [x] Read current repository/subdirectory instructions and required versioned framework documentation before application changes.
- [x] Inspect working-tree changes; preserve unrelated work and existing login/logout behavior.
- [x] Re-inventory static and dynamic toast calls, including `notify[level]`, shared feedback helpers, and direct `toast()` calls.
- [x] Confirm each catalog action is reachable and distinguish dialog, standalone-page, automatic, and explicit paths. Dormant standalone Settings routes and callback limitations are explicitly recorded rather than labelled exercised.
- [x] Record each action's result contract, identity, terminal owner, existing inline/live-region owner, and navigation behavior.
- [x] Record explicit no-toast decisions for the QUIET rows and success branches marked quiet.
- [x] Classify source files as editable client UI or read-only backend/server references. Record where existing results suffice and where confirmed success or delivery would require forbidden contract/request changes.
- [x] Identify any replacement candidates and their actual callers before editing; retain baseline check results for comparison. No UI changes or replacement/removal occurred, so no new screenshot comparison is required for this phase.

**Status: Complete (source audit/evidence only), 2026-10-16 Asia/Manila.** Phase 1 has no prior phase dependency; the actual root host, adapter, session observer, and login/logout handoff were read and their existing tests inspected/run. No repository-instruction conflict affects this phase. The earlier planning-only statements above describe the pre-execution catalog; this phase note is the current Phase 1 status. Phases 2–8 remain not started.

**Dated progress note — 2026-10-16:** Completed the initial done/partially-done/not-started comparison, current owner/result ledger for every catalog ID, explicit read-retry inventory, frontend/server classification, and replacement/caller register in [Phase 1 evidence](evidence/resident-web-toast-coverage/phase-1/README.md) and [action ledger](evidence/resident-web-toast-coverage/phase-1/action-ledger.md). AST inventory found 107 calls (73 adapter-feature calls, 32 direct feature Sonner calls, 2 adapter Sonner render/dismiss calls), including all four dynamic call sites; exact file/line/import evidence is retained there. Source reachability is distinguished from browser execution. Existing user changes were preserved; no application source, styling, dependency, server/backend, other platform, or service setting was changed.

Verification: resident-web typecheck passed; lint exited 0 with two pre-existing location-verification warnings; existing Vitest suite ran with 142 passed and one pre-existing `tests/search.test.ts:74` pricing-copy failure. The first sandbox test attempt failed before startup due to Windows esbuild directory access; a cause-based permission retry ran the suite. Resident-web Next 16.3.0 **Turbopack production build passed**, exit 0, with separate temporary output and original tsconfig restored byte-for-byte. Logs and final ID/source/scope validation are in the evidence folder. No unchanged failing check was looped, and no application changes required repeated checks.

Feasibility/discrepancies: AUTH-02 has a server-only error destination with no existing client outcome owner/attempt marker; AUTH-21 lacks callback provenance/result props and exposes the static error flag only on the server. Automatic callback toasts are blocked under the current frontend-only boundary. AUTH-12–14 standalone Settings variants exist but have no current UI navigation entry and require existing recovery intent; they are not browser-verified. PREF-01–03 cannot prove account persistence from plain no-row-return updates; use the catalog's information fallback, not saved success. Individual read-write helpers discard returned errors and have no affected-row proof. Server `router.refresh()`/same-route retry controls expose no terminal result; retain inline recovery where generic failure cannot be established. Other result/lifecycle discrepancies, including separate receipt readiness and preserved prior origin after candidate discard, are detailed in the ledger. No new request, changed payload, new UI control, or backend workaround is authorized.

Acceptance: every catalog row now has a source owner/result, an intentionally quiet decision, or a precise boundary limitation; inventory, ownership, scope and check-evidence criteria are met. Runtime/console, visual and screen-reader behavior of future toast wiring remains pending verification in its implementation phase; no live external outcome or production readiness is claimed. Later-phase limitations do not block this audit's exit gate and require no user input to complete Phase 1.

Exit: every catalog row has a verified client owner/result signal, a documented no-toast decision, or a precise frontend-boundary limitation. No source location, result contract, or test outcome is assumed. No UI styling changes are needed.

### Phase 2: Authentication, email, and recovery coverage

- [x] Implement AUTH-01 through AUTH-22, including both recovery variants and recovery logout.
- [x] Reuse the adapter and existing frontend session handoff for once-only destination feedback. The continuation below records the narrow callback response exception; auth decisions, server actions and redirect destinations remain unchanged.
- [x] Preserve existing public reset privacy and server-action redirect handling. Structured redirects are rethrown; real dormant-route delivery still needs the manual pass below.
- [x] Consolidate combined password-update/logout feedback and prevent duplicate unexpected-session messages.
- [x] Keep normal login, ordinary logout, reauthentication, account deletion success, and Google identity linking behavior distinct.

**Status: Partially complete, 2026-10-17 Asia/Manila — implementation complete; manual integration/accessibility verification pending.** AUTH-01–22 now have result-owned feedback. AUTH-02/AUTH-21 are no longer code blockers: the continuation adds short-lived feedback receipts to the existing callback responses and consumes them once at the existing destinations. Actual handlers and destinations passed local HTTP/Chrome checks with synthetic Auth results. Standalone Settings components passed redirect-control/recovery regressions; real recovery-cookie/Server Action transport and spoken screen-reader behavior remain pending. The earlier dated notes describe the initial pass, superseded by the continuation below for these blockers.

**Dated progress note — 2026-10-16:** Revalidated Phase 1 infrastructure and compared every selected requirement with the starting sources. Added safe Google startup, registration, public recovery, both Settings recovery variants, verification/email-change and deletion feedback at existing client owners. The existing logout handoff now supports combined recovery success and post-logout navigation warnings; normal welcome/logout/linking/reauthentication remain separate. Delayed public verification and signup session transitions are guarded, confirmed update/logout chains produce one outcome, and inline/live announcement ownership is scoped to touched outcomes. No repository-instruction conflict was found. Concurrent onboarding removal/configuration changes were preserved; historical plan statements remain unchanged outside these selected progress/status sections.

Verification: baseline typecheck/build passed; baseline lint had two existing location-verification warnings; baseline tests had 142 passed and one existing search-pricing failure. Final checks: normal typecheck passed; full lint passed with the same two warnings; final touched-file lint had zero errors/warnings; Vitest had 148 passed and the same pre-existing `tests/search.test.ts:74` failure; final Next 16.3.0 Turbopack production build passed, including TypeScript. Twenty-eight Chrome/StrictMode fixture checks passed with zero runtime errors, console errors or warnings, covering the selected phases; no live email, OAuth or deletion occurred. Initial fixture/session-transition defects and test-fixture lint errors were corrected and rechecked. See [Phases 2–3 evidence and complete action ledger](evidence/resident-web-toast-coverage/phases-2-3/README.md), [check results](evidence/resident-web-toast-coverage/phases-2-3/checks.json) and [browser results](evidence/resident-web-toast-coverage/phases-2-3/browser-results.json).

Acceptance: confirmed/rejected/uncertain and account-change cases exercised in the fixture have the expected single outcome; public reset reload does not replay success; request contracts and shared styling are unchanged. **Pending manual verification:** actual standalone Settings Server Action redirect delivery and screen-reader announcement/focus behavior. **Not met:** automatic AUTH-02/AUTH-21 delivery, for the precise frontend boundary above. Exact manual steps and unexercised variants are recorded in the evidence ledger. No production-readiness claim is made.

**Additional Phase 2 execution note — 2026-10-16:** Continued from the existing/concurrent wiring without replacing user work or changing Phase 3. The auth-only review found and corrected navigation-result classification, deletion failures after possible partial work, and delayed recovery feedback after an account switch. Recovery now captures an adapter attempt under the guest session before awaiting navigation; completion survives legitimate form unmount, while a subsequently signed-in account invalidates the pending outcome without having its session or welcome receipt reset. `notifyLoggedOut` remains the existing helper, now returning that attempt when presentation is deferred; no new public function, dependency, request or production file was added. The current listener tracks the last observed identity for repeated unexpected-sign-out events. Exact per-ID starting classifications, synthetic scenarios, initial/final checks, inspected-only backend files, replacement reference checks and manual steps are in [Phase 2 supplemental evidence](evidence/resident-web-toast-coverage/phase-2/README.md). AUTH-02/AUTH-21 and real callback/standalone-route/screen-reader checks remain explicitly incomplete; no full-completion or production-ready claim is made.

**Continuation progress note — 2026-10-17 (Asia/Manila):** Following the request to finish after the reported result-contract blockers, this pass made the narrow feedback changes described in the continuation: two existing callback responses now carry a 120-second, destination-scoped UI cookie with a random event ID, timestamp, account ID and controlled outcome kind. This is a limited execution-scope exception to the earlier frontend-only boundary. Auth decisions, redirect destinations, server actions, business payloads, ownership filters, RLS, schema and external configuration remain unchanged. Existing NotificationSession/session-feedback validate age/owner, remove the receipt before delivery, suppress replay/stale-account results and clear an abandoned Google welcome on failure. A cancellable microtask after mount lets the unchanged root host subscribe before synchronous callback feedback. Email success requires the existing synchronized email to establish the completed change; pending/unproven confirmation uses information. Inline guidance remains, with one live announcement owner. No dependency or product source file was added.

Verification: continuation baseline typecheck/build passed; lint had the same two location warnings; tests had 148 passes and the existing pricing-copy failure. Final typecheck and Next 16.3.0 production build passed; lint has zero errors and the same two warnings; tests have 157 passes and the same unrelated failure. All 33 combined browser scenarios and 14 auth-only scenarios passed with zero runtime/console errors or warnings. Callback checks use actual handlers over local HTTP and actual client owners; read checks use the installed Supabase/PostgREST builder with synthetic responses. Light/wide recovery-dialog and dark/narrow captures were inspected. Final source review found unchanged business-call arguments after normalizing timestamp/list aliases; only return projections and feedback cookies were added. See the [current evidence](evidence/resident-web-toast-coverage/phases-2-3/README.md), [checks](evidence/resident-web-toast-coverage/phases-2-3/checks.json) and [completion source review](evidence/resident-web-toast-coverage/phases-2-3/completion-source-review.json).

Current acceptance: **met locally** for safe success/rejection/uncertainty, one outcome per attempt, account-switch suppression, distinct login/logout/link/reauth/deletion behavior, callback destination delivery and quiet reload. **Pending manual verification:** real provider/email delivery, existing standalone Settings recovery intent and Server Action transport, and spoken screen-reader/focus behavior; exact steps are in the evidence. No application-code blocker remains. The phase stays partially complete until the unexercised acceptance items are verified; no production-readiness claim is made.

Exit: confirmed, rejected, uncertain, redirected, and account-changed cases each produce the correct single outcome; refreshing an outcome page does not replay it.

### Phase 3: Preferences and read/unread writes

- [x] Implement PREF-01 through PREF-05 and READ-01 through READ-05.
- [x] Surface currently ignored returned errors and await confirmed results before success. No-row writes use truthful information/uncertainty instead of unproven success.
- [x] Make local-storage results observable to the deliberate action owner without throwing away applied in-memory state.
- [x] Consolidate custom-color add/select/save into one terminal toast and suppress obsolete preference responses.
- [x] Leave automatic read bookkeeping and background count refreshes quiet.

**Status: Partially complete, 2026-10-17 Asia/Manila — implementation and automated exit checks complete; manual hosted/accessibility verification pending.** PREF-01–05 preserve truthful local/account fallback wording. READ-01–05 now request affected-row representation in the same existing write and emit definitive success only for the expected row IDs/state. Empty/mismatched returns retain information; rejection/uncertainty/no-op stay distinct. The previous affected-row code blocker is resolved. No extra confirmation request or changed write payload/filter was introduced. Earlier dated notes describe the initial pass and are superseded by the continuation below for affected-row proof.

**Dated progress note — 2026-10-16:** Controller setters now return storage results while keeping applied memory state. Custom-color bookkeeping no longer writes storage or sets a return flag inside a replayable React updater. One add/select action retains its existing two account writes and has one terminal owner; obsolete selections are suppressed. Explicit read controls have synchronous guards, returned-error handling and quiet no-op branches. Failed count refreshes preserve the last counts and do not recast accepted writes as failures. Direct Sonner paths in the touched theme/bulk/deletion handlers were replaced with the existing adapter; no application source file or dependency was added or removed.

Verification: the shared final checks/results above cover both phases. Fixture checks include guest preference success, unavailable storage, account rejection/rapid selection/account switch, legitimate same-account completion after form unmount, custom add/remove under StrictMode, bulk read, individual returned/thrown failures, repeated activation and count-refresh failure. Light/dark, narrow/wide and open-dialog captures use the unchanged host; idle expiry and dismissal start no work. AST comparison of twenty starting client sources confirmed unchanged query/mutation call names and arguments; source/caller review found no parallel notification implementation or obsolete scoped import. No backend/server, migration, other-platform or deployed-service change was made by this execution. Details: [Phases 2–3 evidence](evidence/resident-web-toast-coverage/phases-2-3/README.md).

Acceptance: **met** for no false success on failed persistence, accurate guest/account fallback wording, storage-state preservation, tested rapid/repeat deduplication and quiet automatic bookkeeping. **Not met** for definitive READ-01–05 saved-state success, pending authorized affected-row proof. **Pending manual verification:** remaining live read/unread variants and assistive-technology behavior, with steps in the evidence ledger. Phase 2 callback blockers do not prevent the independent Phase 3 work recorded here; no later phase was started.

**Continuation progress note — 2026-10-17 (Asia/Manila):** The limited response-proof exception above also permits `.select(...)` on the five existing explicit read writes. Announcement read/unread validates the single expected ID; bulk validates the complete requested ID set; report read/unread validates expected ID, resolved status and read timestamp/null state. The installed SDK requests `Prefer: return=representation` on the same mutation. Existing count refreshes remain quiet; failed refreshes preserve counts and cannot negate confirmed write success. Ownership filters, upsert conflict keys, write payloads and mutation counts remain unchanged. The earlier AST statement of completely unchanged query arguments applies to the initial pass; this continuation intentionally adds return projections only. Existing own-row SELECT/write policies and resolved-report guards were inspected; no migration or policy change is needed.

Verification: all five success paths, empty/mismatched/incomplete returns, rejected/lost writes, double activation, later unread, bulk write count, failed count refresh, storage failures, rapid preferences and stale-account completion are covered by the passing combined browser suite. Write checks use the installed SDK, assert affected-row headers and preserved reporter filters, and contact no hosted database. Final project checks and totals are recorded in the Phase 2 continuation above.

Current acceptance: **met locally** for every Phase 3 exit criterion: no false persistence success, accurate guest/account wording, retained in-memory state, one custom-color outcome, quiet bookkeeping, and deduplicated rapid/read-repeat actions. **Pending manual verification:** hosted read/unread persistence with the actual account/RLS (including missing/inaccessible rows), account preference persistence and spoken assistive-technology behavior; exact steps are in the evidence. No application-code blocker remains. The phase is not called fully complete while those manual items remain unverified. No later phase was started.

Exit: no success on failed persistence; guest and signed-in messages are accurate; rapid/read-repeat interactions do not duplicate or contradict results.

### Phase 4: Valid ID and health registration

- [x] Implement ID-01 through ID-08 and HEALTH-01 with existing ownership, cancellation, and retry protections intact; locally verified with synthetic responses.
- [x] Keep camera readiness quiet and use upload completion as the capture/upload success boundary.
- [x] Preserve manual OCR correction, same-submission retries, and unknown-outcome warnings.
- [x] Add the relevant validation summaries with one accessible announcement owner; local semantics/focus verified, spoken verification pending.

**Status: Complete — 2026-10-17 (Asia/Manila). Implementation and selected acceptance criteria verified through automated browser/SQL/real local HTTP checks and direct owner confirmation of real camera/OCR and spoken screen-reader toast functionality.** The prerequisite adapter/root host and Phases 1–3 wiring were confirmed in code. Their existing manual limitations remain recorded; no earlier phase was reopened. Root/resident-web AGENTS.md and CLAUDE.md, Expo v57, installed Next 16.3.0 docs and matching library implementations were read before implementation. No instruction conflict was found. The plan's overall “Planning only” introduction predates these dated execution records.

**Dated progress note — 2026-10-17:** Existing ID actions now carry adapter attempt IDs. Explicit upload/OCR cancellation detaches the action before abort and notifies once; internal cancellation stays quiet. Camera readiness/capture success remain quiet until upload completion. OCR uses parsed suggestions/warnings conservatively: blank optional fields alone do not prove failure. Initial publication and same-submission retry retain immutable IDs, current-owner guards and uncertainty locks. Health preserves structured RPC failure metadata, uses the returned applicant number, guards double activation and warns to check My Registrations on an unknown result. VALID-03/04 summaries retain inline recovery/field associations; invalid-field focus does not jump while correcting another field. Fresh saved-ID guidance avoids repeating the submission toast's live announcement while historical/later verification status remains live. Concurrent user scrolling changes were preserved.

Verification shared with Phase 5: baseline typecheck passed; lint had two existing location warnings; Vitest had 157 passes and the existing pricing-copy failure. Final serial typecheck and Next 16.3.0 webpack production build passed; lint has zero errors and the same two warnings; Vitest has 161 passes and the same unrelated failure. All **63** focused browser scenarios passed with zero page/console errors or warnings. Existing Valid ID browser suite: **41** checks passed, no unexpected runtime/console errors or warnings (its injected network failures are separately identified). Existing document/payment browser regression passed. Light/wide and dark/narrow open-dialog captures were inspected; host/styles/dependencies are unchanged. A stalled initial Turbopack build and corrected intermediate test/lint/generated-type issues are recorded honestly in the [evidence ledger](evidence/resident-web-toast-coverage/phases-4-5/README.md), alongside [results](evidence/resident-web-toast-coverage/phases-4-5/checks.json) and [source review](evidence/resident-web-toast-coverage/phases-4-5/source-review.json).

Acceptance: **met locally** for cancellation/stale-success suppression, submitted-versus-verified wording and health uncertainty guidance. **Pending manual verification:** actual camera/OCR, hosted owned ID/health persistence and spoken assistive-technology behavior; exact steps are in the ledger. No backend, migration, other-platform, deployment or dependency change was made. No later phase was started.

**Continuation progress — 2026-10-17:** Re-read applicable instructions/versioned documentation and preserved the newly changed landing page and Valid ID scrolling work. Baseline typecheck passed, lint had the same two warnings, Vitest had 161 passes and the existing search failure. Real disposable PostgreSQL replay of all 128 current migrations passed the 26 ID and 46 health assertions, including ownership, duplicate and tenant cases. The expanded 66-scenario browser suite passed with zero runtime/console errors or warnings. Final shared checks: 181 Vitest passes with the same search failure; webpack production build and serial typecheck passed; lint has zero errors/two existing warnings. Local SQL is additional evidence, not proof of hosted Auth/Storage, real camera/OCR or spoken assistive technology. Those exact manual checks remain pending; Phase 4 stays partially complete.

**Completion progress — 2026-10-17:** The user directly confirmed real camera/OCR and spoken screen-reader toast functionality. These are owner-attested passes, not agent-observed measurements. The independent real local HTTP pass now has **85 passing assertions** across actual Auth, private Storage and PostgREST, including immutable ID publication/retry, private-byte retrieval, owned/My Registrations persistence and duplicate/cross-tenant refusal. Earlier browser/SQL acceptance evidence remains valid and final source hashes/tsconfig were rechecked unchanged. All three Phase 4 exit criteria are met. Historical pending notes above are superseded by this completion record; no whole-plan release readiness or independent hosted-deployment parity claim is made. See [owner verification](evidence/resident-web-toast-coverage/phases-4-5/owner-verification.json) and [real HTTP results](evidence/resident-web-toast-coverage/phases-4-5/http-integration-results.json).

Exit: cancellation cannot be followed by stale success; ID submitted is never ID verified; health uncertainty never encourages a duplicate registration.

### Phase 5: Requests, payment, receipts, and exports

- [x] Implement SERVICE-01 through SERVICE-04, PAY-01 through PAY-04, FILE-01, and FILE-02; locally verified with synthetic responses.
- [x] Unify mounted/unmounted request success and correlate by the existing operation identity.
- [x] Consolidate automatic payment-step chains; preserve existing client settlement/cancellation race guards and locally verify returned outcomes; real provider/database race remains unverified.
- [x] Add download-preparation error handling without claiming browser download/save completion.
- [x] Exercise gated QR PH behavior without enabling unavailable payment capabilities.

**Status: Complete — 2026-10-17 (Asia/Manila). Implementation and selected acceptance criteria verified through automated browser/SQL/real local HTTP checks and direct owner confirmation of provider timing and spoken screen-reader toast functionality.**

**Dated progress note — 2026-10-17:** Request success has one owner for open/closed forms, correlated by the existing immutable request key and confirmed reference. A failed reference read after a possibly accepted write is uncertainty, not rejection. Page-count and pickup writes report confirmed/returned-error/lost-or-gateway outcomes without added requests. Explicit approved-ID retry retains provenance; automatic checks stay quiet. Mounted pickup/QR chains suppress intermediate method-save success; a method save that completes after closure reports the saved controlled label without starting pickup. QR setup retains error origin, validates the returned payment ID/image and leaves the existing availability gate intact. PAY-04 waits for the existing receipt read to match the observed paid payment/request, deduplicates by payment identity and does not replay for historical views. Receipt/PDF preparation errors are caught; success wording means initiation/readiness only. Direct export Sonner calls were replaced in the existing handler; no new notification pathway or product source file was introduced.

Verification: the final checks and totals in Phase 4 cover both phases. The 63-scenario browser suite includes mounted/unmounted request success, post-write reference failure, page counts, pickup repeat/double activation, disabled QR choice with no write, setup rejection/uncertainty, actual hook poll/Realtime/cancel outcomes, missing/mismatched/stale receipt, historical silence, receipt download events and PDF popup/printing failures. Synthetic outcomes do not certify live provider settlement or saved files. Source review confirms unchanged backend-call arguments/counts, ownership filters and polling signatures. No new timer/subscription/retry loop or dependency was added; former single-branch success/direct-Sonner handling was replaced, not retained in parallel.

Plan/source discrepancies: `create-payment-source` can return only `{status:'paid'}`; local UI now keeps that response quiet with existing guidance because it cannot establish a fresh payment identity/receipt. The cancellation endpoint's missing affected-row proof and provider-failure fallthrough were corrected locally under the continuation's narrow prerequisite exception; actual provider/webhook timing remains unverified. Health's selected-household-member RPC discrepancy also remains untouched. Details, inspected-only server/shared files, replacements and manual steps are in the [Phase 4–5 ledger](evidence/resident-web-toast-coverage/phases-4-5/README.md).

Acceptance: **met locally** for one request success, no premature paid/receipt-ready claim, initiation-only download wording and no historical paid replay. **Pending manual verification:** hosted ownership/persistence, authorized payment-provider/database races and spoken assistive-technology behavior. These limitations prevent full-completion/production-ready claims; there is no remaining application-code blocker for the verified local wiring. Phases 6–8 remain not started.

**Continuation progress — 2026-10-17:** The user approved necessary continuation actions. A strictly required correction to `supabase/functions/cancel-payment/index.ts` is recorded as an exception to this plan's frontend-only boundary: validate input, bound the existing provider cancellation, require documented HTTP 200, return the pending-only updated row, and on zero rows perform one caller-RLS read of the actual terminal winner. Existing JWT, resident ownership and privileged pending-row guards remain intact. No migration, provider capability change or deployment. The client treats function 5xx/relay/malformed replies as uncertainty and resumes existing observers. Nineteen actual-handler scenarios and five helper tests passed; all 66 browser scenarios passed. Deno check passed against frozen SDK 2.117.2; Deno lint reports only the unchanged import-prefix violation reproduced against original source. All 65 targeted payment SQL assertions passed against current migrations. The broader SQL runner exposed one unrelated existing admin acceptance expectation failure; it is recorded and untouched. Final production build/typecheck passed, lint retained its two existing warnings and Vitest retained only the search-copy failure. Isolated HTTP-stack image downloads were unavailable and no authenticated test resident/native screen-reader session exists here. Provider/webhook, hosted HTTP and spoken checks remain pending; Phase 5 stays partially complete. Full results, scope exception and exact remaining steps are in the Phase 4–5 evidence ledger.

**Completion progress — 2026-10-17:** The user directly confirmed provider timing and spoken screen-reader toast functionality; these are owner-attested passes. The **85-assertion real local HTTP integration** verifies request/reference idempotency, pending pickup persistence/retry, ownership and the actual cancellation handler with frozen SDK 2.117.2 against actual database rows. The financial-provider boundary is synthetic, as allowed by section 7.2; real-provider timing is separately user-attested. Confirmed cancellation, provider refusal/gateway uncertainty and concurrent paid/expired winners all match persisted state; neighbors are denied before provider calls. Cached repository service-version metadata resolved stack startup, and a bounded temporary WSL keeper prevented idle shutdown. Integration-fixture startup/status-shape corrections and the interrupted attended attempt are preserved honestly in the ledger. No application source changed during this completion pass; prior passed build/typechecks and 66 browser checks remain supported by unchanged hashes, with pre-existing failures/warnings retained. All four Phase 5 exit criteria are met. Historical pending notes above are superseded; phases 6–8 were not started. No hosted write, chargeable payment, deployment, remote migration or broader production-readiness claim.

Exit: no request duplicate success, no premature paid message, no false download-completed statement, and no payment-received replay for a historical paid request.

### Phase 6: Explicit location, route, QR, and browser actions

- [x] Implement LOC-01 through LOC-08, EM-01 through EM-08, and MAP-01, including their explicit quiet branches; locally verified with synthetic browser/service outcomes.
- [x] Preserve automatic location/watch/route refresh silence and stale-result guards; operation IDs are captured at deliberate actions, including location permission continuation.
- [x] Emit boundary warnings at the deliberate rejected selection boundary rather than every drag update; the existing map still rejects on click/dragend and registration remains advisory.
- [x] Keep route/center availability detail persistent and do not imply safety or availability beyond the returned result; actual Centers street selection and unknown-availability guidance passed locally.
- [x] Distinguish camera denial, camera readiness, native-share cancellation, and fullscreen rejection in local browser scenarios; physical APIs remain pending below.

**Status: Partially complete — 2026-10-17 (Asia/Manila).** All feasible Phase 6 client wiring and local acceptance checks are implemented and verified. Physical GPS/camera/permission prompts, native share/fullscreen behavior and spoken assistive-technology verification are pending manual verification; synthetic APIs do not establish those passes. No application-code blocker remains for this phase.

**Dated progress — 2026-10-17:** Read repository instructions, the overall plan/selected phases, Expo v57 reference, installed Next 16.3 client/error guides, React 19 documentation, version-matched library source and browser API contracts before their implementation. Verified existing adapter/root host/session IDs and prerequisite auth/preferences/ID/health/request/payment owners in current code; earlier Phase 2–3 manual limits remain independent. Preserved the user's existing Centers layout/CSS changes and all unrelated temporary evidence. Added explicit GPS/home selection, boundary/address, Centers location/route/street, household-QR/camera and fullscreen feedback at existing owners. Native-share success/cancellation and successful camera/fullscreen startup remain quiet. Existing timers, request/query arguments and business operations are unchanged. Route/location detail and inline recovery remain; scoped live-announcement ownership avoids duplicate outcome announcements. No new dependency, production file, route, control, backend change, migration or other-platform change.

Verification: baseline typecheck passed; baseline lint had zero errors/two existing location warnings; baseline Vitest had 181 passes and one existing search-pricing failure (`tests/search.test.ts:74`). The initial baseline Turbopack build was stopped after making no progress; a subsequent restricted webpack build encountered Windows EPERM. Cause-based unrestricted local webpack builds passed, including the final change set. Final typecheck/build/lint/test outcomes and exact commands are retained in the [Phase 6–7 evidence](evidence/resident-web-toast-coverage/phases-6-7/README.md). The final new browser suite passed **49 scenarios**, with zero runtime/console errors or warnings. Existing ID/health/request/payment regression passed **66 scenarios**; auth/preferences regression passed **33 scenarios**, recorded separately in the evidence. Browser/service/provider boundaries are synthetic, explicitly separated from manual checks. Final source review compares request/query/geolocation arguments and confirms no contract change. Intermediate fixture import/button/viewport issues, one permission-continuation fix, and environment failures are recorded rather than counted as passes.

Acceptance: the five implementation criteria and the exit condition are **met locally**. Physical API and spoken accessibility behavior is **pending manual verification** with exact steps in the evidence. Whole-plan production readiness is not claimed; Phase 8 was not started.

Exit: one appropriate result per explicit attempt; no toast stream from tracking, polling, camera frames, or map gestures.

### Phase 7: Onboarding, validation, search, and explicit read retries

- [x] Implement OTHER-01 through OTHER-03, VALID-01 through VALID-05, SEARCH-01, and REFRESH-01. **All reachable outcomes implemented/locally verified, including the approved server-result handoff. OTHER-01/02 are obsolete because onboarding was removed; no replacement workflow was introduced.**
- [x] Verify every QUIET row remains quiet within the reviewed scope and targeted browser scenarios; no new action or confirmation dialog was added.
- [x] Route local-persistence uncertainty to one warning instead of a contradictory success/warning pair. **Not applicable to OTHER-01/02: no onboarding-completion action or persistence helper remains. Existing preference behavior is preserved.**
- [x] Cover partial/aborted search and distinguish user retry from automatic reads. A single ephemeral, session-invalidated attempt receipt carries explicit search through client navigation; filters, pagination, typeahead, partial results, reloads and background reads do not manufacture attempts.

**Status: Partially complete — 2026-10-17 (Asia/Manila).** All reachable application wiring is complete and locally verified. The user-approved continuation below resolves REFRESH-01 server refresh/error-boundary/same-route results through a narrow server result-prop exception. Physical/spoken verification remains pending; approval is not a test result. Removed onboarding is a source discrepancy, not a reason to recreate it. No application-code blocker remains.

**Dated progress — 2026-10-17:** Initial classifications: OTHER-01/02 obsolete (missing route/helper; existing `/onboarding` redirect to `/home`); OTHER-03, VALID-01/02/05, SEARCH-01 and client REFRESH-01 not started; VALID-03/04 already implemented in Phase 4 and reconfirmed by the existing 66-scenario regression; quiet interactions already present. Added single validation summaries without changing schemas/native required-field handling, retained field guidance/focus, and distinguished actual eyedropper failure from cancellation. Search submit and explicit Retry own top-level failures only; usable partial results, stale/aborted responses and live suggestions remain quiet. Existing read owners carry deliberate retry provenance and controlled content labels, with no generic renderer toast or additional request. FAQ's former duplicated state handling now reuses `useScopedRead`; obsolete state/callback imports were removed after caller checks. Existing specific payment/ID/camera/location retry owners remain authoritative.

Verification: final typecheck and production webpack build passed; lint has zero errors/one unchanged unused-disable warning (the old missing-dependency warning was resolved by the scoped geolocation lifecycle correction). Vitest has **181 passed and the same one pre-existing pricing-copy failure**. The new browser suite has **49 passing scenarios**, covering actual frontend owners, stale/unmounted/account cases, explicit/background reads, partial/aborted search, validation focus, camera cleanup, routes, QR/share, eyedropper and fullscreen; runtime/console errors and warnings are zero. The existing Phase 4–5 suite passed 66 scenarios. Source inventory, complete per-ID ledger, inspected-only server references, final regression results and manual steps are in the [evidence](evidence/resident-web-toast-coverage/phases-6-7/README.md). No repository-instruction conflict was found. Historical planning-only and earlier source-map statements outside these selected progress/status sections were left unchanged.

Acceptance: validation/quietness/search/announcement-ownership and full REFRESH-01 criteria are **met locally**, including existing server recovery; onboarding persistence is **met as not applicable to removed functionality**. **Pending manual verification:** spoken summaries/focus and physical browser APIs listed in the evidence. The narrow server result-prop exception is explicitly approved and recorded below; no new request, UI workflow or Phase 8 implementation.

**Approved continuation progress — 2026-10-17 (Asia/Manila):** After the reported server-result blocker, the user approved all necessary actions/tools to complete Phases 6–7. This authorizes a narrow exception to the original frontend-only/inspection-only boundary: fresh failure UUID props and controlled content labels at existing server failed-read branches, plus a root client transition receipt that survives boundary fallback remount. Existing `ReadFailure`, `RouteError`, `ProfileSetupNotice` and the Valid ID recovery link use that receipt; fresh returned failure or an actual new boundary Error establishes the outcome. Cached errors, transition completion, sibling failures, initial/background reads, success, old-account results and abandoned navigation cannot manufacture a toast. Receipt bookkeeping is bounded to one current transition and discarded on settlement. Existing server queries, auth/ownership guards, writes, request timing, endpoint contracts and toast host/adapter appearance are unchanged by this execution. The Valid ID paragraph/link/layout is preserved. No dependency, production file, new product control, migration, native/admin change, deployment or external send was added. Concurrent service-sheet/payment/admin work was preserved and excluded from this task's change claims.

Continuation verification: installed Next 16.3 error/router/server-client references and actual boundary implementation were read before edits. Baseline typecheck passed; tests retained 181 passes/the existing search-pricing failure; baseline lint also exposed an unrelated concurrent service-sheet fixture error, subsequently corrected outside this execution. The baseline build was interrupted after no visible progress and is not counted as passing. Final production webpack build and serial typecheck **passed**; lint **passed with zero errors/one unchanged map unused-disable warning**; Vitest **189 passed/the same one existing search-pricing failure** (eight payment-handler tests were added concurrently). The new real Next production transport suite passed **11 scenarios** with zero unexpected runtime/console errors/warnings; intentionally injected HTTP 500/React 441 boundary errors are separately retained and reviewed. It verifies named failure, quiet success/background, selected-slot/repeat ownership, account/navigation suppression, original account link and same-digest fresh boundary recovery. The Phase 6/7 suite rerun passed **49 scenarios** with zero runtime/console errors/warnings. The earlier 66- and 33-scenario prerequisite regression evidence remains recorded as earlier evidence. Valid ID guard tests were adapted to the actual root provider/router boundary and all eight passed. AST review of 66 scoped/preserved sources found unchanged data/geolocation/timer arguments; standard diff whitespace check passed. Exact logs, fixture corrections, scope exception, source hashes and remaining manual steps are in the [Phase 6–7 evidence](evidence/resident-web-toast-coverage/phases-6-7/README.md). No repository-instruction conflict was found; the user-approved exception resolves the plan boundary conflict. Physical/spoken gates remain pending, so neither phase is falsely marked complete.

Exit: validation summaries retain field guidance; ordinary browsing stays quiet; specific retry handlers and generic read failures do not both notify. Locally verified for client and server recovery owners; remaining physical/spoken acceptance is pending manual verification.

### Phase 8: Integration verification, cleanup, and readiness review

- [ ] Run the focused tests and project checks in section 7.
- [ ] Inspect the existing shared toast in light/dark mode, narrow/wide viewports, and open dialogs without changing its design.
- [ ] Update the catalog checklist/evidence with passed, failed, deferred, and intentionally quiet outcomes. Never label unexercised paths passed.
- [ ] Confirm only authorized resident-web feedback changes are present in the final diff.
- [ ] Remove all code/files made unused by scoped replacements after verifying framework, static, dynamic, test, and workspace references. Confirm no required or unrelated file was removed.
- [ ] Confirm no newly unused exports, imports, state, effects, listeners, timers, temporary assets, or parallel notification paths remain.
- [ ] Check frontend bundle/build output for unexpected new dependencies or growth caused by notification wiring; investigate material growth without starting an unrelated optimization project.
- [ ] Verify no new request, subscription, polling/retry loop, notification-triggered state cycle, or repeated terminal callback was introduced.
- [ ] Complete the release-readiness checklist in section 7.4; record exact checks, results, and remaining limitations.

Exit: all implemented catalog entries satisfy the definition of done, replaced code is removed safely, and the evidence supports the stated readiness. Any remaining scoped failure/blocked outcome prevents a full-completion or production-ready claim. No deployment is included.

## 7. Verification strategy

### 7.1 Focused behavior tests

Test meaningful outcome and lifecycle behavior rather than mirroring each string in a separate test.

| Scenario | Required assertion |
|---|---|
| Confirmed success vs returned rejection vs thrown failure | Correct severity/copy; no contradictory success; uncertainty after potentially delivered writes |
| Double activation and effect replay | One write where existing guards require it; one terminal toast per operation |
| Same later intentional action | A new operation can notify even with identical text |
| Account change/unmount while pending | No stale identity/name/outcome; legitimate same-account completion may still notify after form closure |
| Redirect/full-page handoff | Outcome delivered once at the correct destination; reload/back does not replay it |
| Recovery password update plus logout | One combined outcome; failure distinguishes password result, logout result, and navigation result |
| Read/unread returned database errors | No false success, and errors are not silently ignored |
| Preference/storage partial failure | Current visual change remains; one accurate warning; no saved-to-device claim |
| Rapid preference changes | No obsolete save toast for a superseded selection; no per-slider-tick notification |
| ID upload/OCR cancellation and retry | Cancelled/stale callbacks suppressed; same submission identity preserved; no approval claim |
| Health registration unknown outcome | Warning directs to My Registrations; no false rejected/registered assertion |
| Payment polling/Realtime/cancel race | One authoritative paid/cancelled outcome; history views do not replay payment success |
| PDF/receipt generation | Preparation errors handled; initiation/readiness language only; blocked-popup behavior preserved |
| Geolocation/routing/camera/fullscreen | Permission, unavailable, no-route, cancellation, and actual failure cases remain distinct |
| Search and explicit read Retry | User action may notify on failure; background, partial, aborted, and obsolete requests remain quiet |
| Validation and dialogs | One summary announcement; field associations/focus and dialog accessibility retained |
| Notification rendering/dismissal | No fetch, mutation, retry, refresh, or second toast starts as a side effect |
| Foreground idle after an outcome | Toasts expire normally; no repeating timer/callback or accumulating notification state |
| Replacement cleanup | Removed paths have no remaining route/import/export/test references; retained workflows resolve |
| Unexpected backend error codes | Resident sees safe plain-language copy, not raw status/code/SQL or a false success |

### 7.2 Browser acceptance passes

- Authentication: email/password and Google success; Google startup/callback failures; registration success; required-email-confirmation branch; public password reset and both Settings recovery entry points.
- Session transitions: normal logout, recovery logout, logout failure, unexpected session end, account switch, and delayed profile reads. Preserve the new welcome and ordinary logout toasts.
- Email: send/resend, invalid/expired code, verified result, profile sync, both-inbox email change, pending confirmation, callback error, and refreshed callback destination.
- Preferences/read status: guest and signed-in saves, storage unavailable, server rejection, rapid selections, each individual read/unread action, bulk read, and failed count refresh after a successful write.
- ID/health: upload rejection, camera denial, capture failure, OCR partial/failure/cancel, submit confirmed/rejected/uncertain, same-submission retry, and medical registration confirmed/rejected/uncertain.
- Services/payment/files: open/closed-form submission, page count, method save, pickup, gated QR PH, simulated settlement races, historical paid request, receipt generation failure, PDF popup block, and cancellation of browser printing.
- Location/emergency: explicit vs automatic acquisition, out-of-boundary selection, unavailable address lookup, route retry/no route/stale route, household QR/session errors, camera restart, share cancellation/fallback, and fullscreen rejection.
- Quiet behavior: filters/tabs/sorting, map gestures, typeahead, initial reads, background polls, focus refresh, Realtime, dialog opening/closing, and ordinary attachment preview changes.

Use existing fixtures and mocked outcomes for destructive or financially consequential paths. Do not delete real accounts, create chargeable payments, or change deployed service configuration to test wording.

### 7.3 Project checks and visual stability

- Run the existing resident-web typecheck and lint checks, plus relevant existing and new focused tests. Adapt commands to the current workspace configuration; do not assume a root test command uses the resident-web test root.
- Run a production build when changes affect server/client boundaries, callback delivery, or framework routing in a way not covered by focused checks. Record genuine pre-existing failures separately.
- Require a successful resident-web production build before claiming production readiness for the final change set. Do not edit server behavior or routing to make the build pass; a pre-existing build failure must be documented and prevents a verified-ready claim until resolved within authorized scope.
- Verify the unchanged shared host: top-center/header offset, light/dark theme, close button, maximum visible stack, keyboard focus, hover pause, safe-area behavior, long names/messages, and toast interaction while dialogs remain open.
- Recheck reduced-motion behavior and screen-reader announcement ownership. Do not modify visual styling as a shortcut for a lifecycle problem.
- Review the final diff for unrelated edits, additional toast hosts, extra direct Sonner imports, backend changes, and Android/iOS/admin changes.

### 7.4 Production-readiness gate

- [ ] All feasible scoped catalog outcomes have recorded source ownership and the appropriate behavior evidence; blocked/unverified rows are explicitly visible.
- [ ] Resident-web typecheck, applicable lint checks, focused regression tests, and production build pass for the final change set. A pre-existing unrelated failure is identified accurately, never silently counted as passed.
- [ ] Existing login/logout, request submission, ID submission, read-state controls, and payment flows remain functional under the targeted regression checks.
- [ ] Plain-language messages cover confirmed rejection and uncertainty; no raw backend/status error codes appear in new or replaced toast paths.
- [ ] Layout/theme/focus/dialog behavior is unchanged; no new UI, control, route, workflow, or dependency has been introduced.
- [ ] No duplicate success/error pairs, unhandled rejection caused by scoped wiring, stuck local pending state, stale-account notification, or new execution loop remains in verified scenarios.
- [ ] Existing backend/server files, contracts, requests, mutation counts, polling intervals, and authorization behavior are unchanged.
- [ ] Scoped replacement cleanup is complete with references checked; no duplicate old/new handler remains.
- [ ] Final review records what was tested, what was mocked, what was not exercised, and any residual limitation. Do not claim zero possible defects; readiness means the defined gates passed for the verified scope.

## 8. Evidence and completion tracking

During implementation, store concise evidence under `plans/evidence/resident-web-toast-coverage/` if needed. A useful ledger has: catalog ID, entry point, scenario, confirmed result, expected message/type, observed toast count, inline feedback retained, session/navigation behavior, test or browser evidence, and status.

Allowed statuses: not started, implemented awaiting verification, verified, intentionally quiet, or blocked/deferred with a concrete reason. Existing login/logout coverage is baseline, not proof that alternate recovery paths are covered. An unreachable path is not verified: record the source evidence and why it was not exercised without implementing a new entry point.

For each phase, also record changed client files, backend/server files inspected but not changed, targeted verification commands/results, replacements/removals with reference checks, and unresolved issues. Store only concise evidence needed to assess this change; no tokens, credentials, resident-sensitive data, or redundant generated artifacts.

## 9. Definition of done

- Every catalog row is implemented and verified, or explicitly recorded as intentionally quiet; any genuinely blocked/deferred item remains visible and the plan is not called fully complete.
- Every cataloged success is based on the required result, and every uncertain write outcome uses accurate warning copy.
- One terminal toast per operation/event; no duplicate announcement from competing handlers or observers.
- Inline guidance, field focus, dialogs, routing, payment protections, ownership checks, and cancellation behavior remain correct.
- No toast flood from routine interactions or automatic activity.
- The existing toast UI is unchanged, and login/ordinary logout continue to work once across navigation.
- Appropriate focused checks pass and material browser-only limitations are documented.
- All superseded code/files made unused by this scoped replacement are removed safely; no required framework entry point, active dependency, shared behavior, or unrelated user change is deleted.
- No new product feature, UI component/screen/control, public application function, dependency, request pattern, or notification framework was introduced. Any minimal private helper serves only the existing scoped action and is justified by correctness/reuse.
- No new retry/polling/render loop, unbounded bookkeeping, duplicate old/new notification handler, or raw resident-facing backend error code is introduced.
- Backend/server code, database, APIs, auth/business contracts, other platforms, and deployment remain unchanged.
- Phase 1 through Phase 8 have honest evidence/status records. Full completion and production readiness are claimed only when the applicable gates actually pass; blocked or unverified outcomes are never hidden.
