# Admin Web Toast Coverage Audit

Date: 2026-10-18 (Asia/Manila)

Status: Frontend migration and scoped outcome coverage implemented. The toast/browser checks below pass. Full production readiness is not claimed because the current workspace has a separate record-configuration type/test failure and the production build cannot download its existing Google Fonts.

## Scope and separation

- Admin owns `apps/admin-web/src/lib/notify.ts`, `src/components/ui/sonner.tsx`, and `src/components/ui/sonner.css` independently.
- The toast card design is copied from resident web: top center, header offset, 400 px desktop width, rounded theme-aware surface, semantic icon colors, close button/hit target, wrapping, and up to three visible messages. Success/info last 4 seconds, warning 6 seconds, and error 8 seconds.
- Admin uses the already installed Sonner 1.7.4 runtime. Its own manifest/lockfile declaration is added; resident dependencies are unchanged.
- Admin notification identity, operation IDs, session cleanup, theme hook, and host are local to admin. No new import from resident web or shared notification state was introduced.
- Existing admin toast callers, including callers in the older `/resident` routes within the admin application, have migrated to the new admin adapter. Those older routes received the design migration only; their resident functionality was not expanded.
- Removed the superseded `apps/admin-web/src/components/ui/toast.tsx`. Updated browser fixtures that imported its provider. No source/test references to `useToast`, `ToastProvider`, or the old toast module remain in admin.
- Resident source hashes match the snapshot taken before this task. No backend, server action, API route, database, authentication contract, payment contract, or authorization change was made by this task. Other work in this shared workspace changed record configuration/server files concurrently; those changes were not reverted or repaired here.
- The existing root layout changed only to mount the new client toast host instead of the old UI provider.

## Delivery rules

- One terminal toast per operation ID; a later intentional attempt may notify again.
- Existing mutation handlers use admin-local attempt IDs so duplicate callbacks or a catch after an already delivered result do not produce a second outcome within that handler.
- Synchronous existing action locks remain. Request fulfillment and logout also guard repeated activation while pending.
- Pending operations from a previous known admin session cannot display an outcome after the notification session changes. Logout success persists into guest navigation.
- No fetch, retry, write, navigation, or polling starts because a toast renders or dismisses. No new polling or retry loop was added.
- Native modal dialogs and fullscreen elements use one stable toast portal. Moving it does not mount another host, replay a message, or lose the current toast; it remains accessible above the native top layer. Portal observers/listeners are cleaned up on unmount.
- Inline validation and recovery text remain. New fulfillment and appearance success regions do not also live-announce the same toast outcome.
- Diagnostic database codes/tokens are replaced with plain-language popup copy. This is presentation-only; existing error handling and inline recovery remain available.

## Missing-outcome audit and implemented copy

S = success; E = error; W = uncertain/warning; I = information. The baseline column describes the source before this task. These are source-verified handler changes, not a claim that every live external service was exercised.

| Action | Previously missing | Previous feedback | Added toast / handling |
|---|---|---|---|
| Admin login | Success; thrown failure | Redirect or existing returned-error popup | S: Welcome back. E: Could not finish signing in. Check your connection and try again. Existing returned errors migrated. |
| Admin logout | Success/failure | Audit call, sign-out and redirect | S: Logged out. W: We couldn't confirm logout. Check your sign-in state before trying again. Existing audit and local sign-out scope preserved. |
| Inline table cell edit | Success | Cell closes/refreshes; errors already popped up | S: Changes saved. Unchanged values do not get the new success message. |
| Whole-row table edit | Success; numeric/date draft validation | Row closes or keeps inline error | S: Changes saved when values changed. Existing error/validation messages use the new host. |
| Record-sheet edit prerequisites | Failure | Inline edit-options error | E: Could not load edit options. Please try again. |
| Record-sheet invalid save | Validation summary | Inline validation | E: Review the highlighted changes before saving. |
| Request start processing | Success/failure in fulfillment panel | Inline notice/error | S: Request moved to processing. E: Could not update the request. Review the details and try again. W on thrown/lost response: We couldn't confirm the request change. Refresh before trying again. |
| Pause for resident / resume processing | Success/failure in fulfillment panel | Inline notice/error | S: Resident wait recorded / Processing resumed. Same rejection/uncertainty handling as other fulfillment actions. |
| Mark ready, collect pickup payment, release/cancel request | Success/failure in fulfillment panel | Inline notice/error | Reuses each existing confirmed operation's success message. No claim that a payment was collected before its operation returns successfully. E/W use the fulfillment messages above. |
| Service activation/deactivation/archive | Success/failure | Refresh or inline error | S: Service activated / Service deactivated / Service archived. W: We couldn't confirm the service change. Refresh before trying again. |
| Service definition save | Validation/failure | Success toast but inline-only rejection paths | E: Check the highlighted service details. W: We couldn't confirm the service save. Refresh before trying again. |
| Resident ID review | Failure | Existing success popup and inline review failure | W: We couldn't confirm the ID review. Reload the ID before trying again. Existing verified/rejected/revoked success wording retained. |
| Admin profile save, photo save/remove, cleanup warning | Both | Inline profile message and reconciliation | Existing safe profile-result text now also notifies. Confirmed success uses success; uncertainty/cleanup uses warning; rejection/validation uses error. All existing reconciliation and cleanup operations are unchanged. |
| Reload current admin profile | Both | Inline reload result/error | Current profile loaded. Review it before editing again; or existing safe failure text. |
| Refresh associated resident account | Both | Section data or inline error | S: Associated account details refreshed. Existing safe error text retained. |
| Unlink associated resident account | Both | Inline result | S: Association removed. Both accounts and their data are preserved. E/W follows the existing confirmed/unknown result. |
| Link resident account | Both | Inline ownership result/cleanup warning | S: Resident account linked. Accounts and credentials remain separate. E: Could not start account linking. Review the details below. W: Account linking could not be confirmed. Check account details before trying again; separate cleanup warning when cleanup is incomplete. |
| Change admin sign-in email | Both | Inline credential result | S: Email change requested. Check your confirmation emails. Existing returned warnings use warning severity; unsuccessful/unconfirmed results direct the admin to review inline details. |
| Change admin password | Both | Inline result or existing server-directed login notice | S: Password changed. Sign in again with your new password. Existing warning text retained; successful intentional session-ending outcomes are delivered in guest notification scope. Existing server redirects/notices remain unchanged. |
| Check current sign-in email | Both | Inline current/pending result | I: Email confirmation is still pending. Check your inboxes; or Current sign-in email checked. Review the details below. E for a failed status check. |
| Request admin security verification code | Both | Inline code-request result | S: Verification code requested. Check your admin inbox. E on returned rejection. W when delivery cannot be confirmed. |
| Verify ownership in the isolated proof window | Both | Confirmation text or inline error | S: Account ownership verified. Return to your admin profile to finish. E: Could not verify account ownership. Review the details and try again. |
| Request proof-window email code | Both | Inline instructions/error | S: Verification code requested. Check your sign-in inbox. E: Could not request verification. Check your email and review the details below. |
| Authenticator verification | Failure | Inline error | E: Could not complete authenticator verification. Check the code and review the details below. Successful ownership completion owns the success message, avoiding a second authenticator success toast. |
| Explicit proof-window cleanup failure | Failure | Inline cleanup warning | W: Temporary sign-in cleanup could not be confirmed. Keep this window open and retry closing verification. Automatic successful retirement stays quiet. |
| Return from admin email-confirmation callback | Result/failure | Inline callback message | I: Email confirmation checked. Review your current sign-in email in Profile. E for failed/expired confirmation or sign-in. Toast only for a callback URL result; plain reload does not claim a new email change. |
| Save theme, accent, font or custom-color list | Both | Immediate preview and small saved label | S: Appearance preferences saved. E: Could not save your appearance preferences. The local preview is still applied. W when an account/session/save result cannot be confirmed. Superseded save replies do not announce an obsolete selection. |
| Mark all bell notifications as read | Both | Optimistic indicators; returned errors ignored | S: All notifications marked as read. E/W directs to refresh if the status cannot be persisted/confirmed. Existing scope/filter preserved. |
| Mark matching drawer notifications as read | Both | Optimistic filtered list; returned errors ignored | S: Matching notifications marked as read. E/W for a rejected/unknown result. Existing filter-scoped query preserved. |
| Mark one notification read when opening it | Failure | Notification opens; returned errors ignored | E/W: Could not mark the notification as read / read status could not be confirmed. Success stays quiet because opening the item is the primary action. |
| Copy a notification identifier | Both | Temporary checkmark; clipboard failure silent | S: Copied to clipboard. E: Could not copy to the clipboard. Select and copy the text manually. |
| Download an emergency QR image | Both | Browser download only | S: QR image download started. E: Could not prepare the QR image. Please try again. Does not claim the browser finished saving. |
| Publish road closure with malformed/unconfirmed result | Warning | Inline unexpected-response error | W: The closure could not be confirmed. Refresh before trying again. Existing confirmed publish/reopen success messages migrated. |
| Routing configuration action throws | Failure/pending cleanup | Returned-error popup, but no thrown-error cleanup | W: The route update could not be confirmed. Refresh before trying again. Local pending state released; same RPC and payload remain. |
| Exit map fullscreen fails | Failure | Inline error | E: Could not close full screen. Press Escape to return to the page. Existing supported fullscreen fallback remains. Successful toggling stays quiet. |
| Form schema validation in existing admin forms | Summary where absent | Inline validation | E: Review the highlighted fields before continuing. Field detail and existing browser-native required checks remain. |
| Thrown/lost result in existing content/create/edit handlers | Failure where absent | Returned errors covered, but thrown promise could escape | W: The action could not be confirmed. Refresh the record before trying again. Existing pending state is released. Already delivered outcomes use the same attempt ID and are not duplicated. |
| Refund submission throws | Uncertain outcome | Returned-error popup or unhandled rejection | W: We couldn't confirm the refund request. Check the payment before trying again. Existing confirmed refund-request message remains; no completed-refund claim added. |
| Settings save or household hook write throws | Failure | Existing returned error/success popup | W: The change could not be confirmed. Refresh before trying again. Existing rejection/success and caller recovery are preserved. |
| Explicit search retry fails | Failure toast | Inline search failure | E: Could not refresh search results. Please try again / Review the message below. Initial/typeahead/background/aborted requests remain quiet. |

### Existing covered actions migrated without redesigning their workflows

The old provider's callers for announcements, FAQs, evacuation centers, emergency guidance/codes, road routing conditions, emergency hub content, staff/resident invitations, medical drives/applicants, households, incident actions, request status transitions, transactions/refund requests, site/about content, and barangay settings now use the admin adapter. Existing confirmed-outcome messages remain unless a missing branch needed a new message. Diagnostic details in popup copy are sanitized locally; inline recovery remains.

### Interactions deliberately left quiet

- Navigation, menu opening/closing, notification opening after successful implicit mark-read, filters, sorting, pagination, row selection, and dialog/discard cancellation.
- Map movement, marker selection, a successful fullscreen toggle/fallback, photo preview selection, and normal appearance preview rendering.
- Initial data reads, background refresh, subscriptions, automatic proof retirement, token refresh, and ordinary empty results.
- Successful explicit search retry: the resulting list is the confirmation. Partial results keep inline guidance.
- A new toast does not stand in for a backend operation or introduce another write/verification request.

## Verification and material limits

| Check | Result |
|---|---|
| New admin adapter unit tests | 6 passed: attempt/event deduplication, later repeat actions, previous-account suppression, guest/logout survival, focus pause/resume, durations, and safe diagnostic copy |
| Headless Chrome fixture | 9 checks passed; zero uncaught page errors. Uses the real host, native dialog and fulfillment component with mocked service results; no live backend writes. |
| Browser layout evidence | `evidence/admin-toast-coverage/light-toast.png`, `dark-toast.png`, `narrow-wrapped-toast.png`, `toast-over-native-dialog.png` |
| Legacy provider/reference search | Old component deleted; no old source/test imports/hooks remain |
| Resident isolation | Resident source hashes unchanged from the pre-task snapshot |
| Admin lint | Passed (`eslint src --quiet`) |
| Full configured unit suite | 152 passed, 1 failed. Remaining failure: `record-lifecycle.test.ts` expects versioned request edit fields different from the concurrently changed record configuration. That configuration/test policy was not altered to make the suite pass. |
| Typecheck | Blocked by `src/lib/admin-tables/record-config.ts:89`: `RecordData` is not compatible with `RequestState`. No toast type error was reported. The record-config file changed outside this task. |
| Default production build | Stopped after making no visible progress for several minutes; not counted as passed. |
| Isolated webpack production build | Failed fetching the existing Geist/Geist Mono Google Fonts because `fonts.googleapis.com` could not resolve. Existing font configuration was not changed to bypass verification. |

Commands (run from repository root unless noted):

- From `apps/admin-web`: `npx vitest run --config vitest.config.ts`.
- From `apps/admin-web`: `npx eslint src --quiet`.
- `npm run typecheck --workspace=@barangayan/web`.
- `node apps/admin-web/tests/table-browse/toast-browser.mjs` (uses installed Chrome by default; `PLAYWRIGHT_CHANNEL` can select a supported installed browser).
- `npm run build --workspace=@barangayan/web`; alternate isolated output via the existing `BARANGAYAN_PREVIEW_DIST_DIR` setting with `-- --webpack`.

No live account deletion, refund/payment action, credential change, email delivery, or all-screen authenticated end-to-end pass was performed. Manual screen-reader and physical-device verification remain unverified. The checked-in browser report states its fixture limitations. These boundaries prevent a full production-ready claim until the remaining checks are resolved/exercised.
