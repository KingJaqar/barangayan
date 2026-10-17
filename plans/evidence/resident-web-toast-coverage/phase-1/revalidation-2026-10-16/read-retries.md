# Explicit read retries — REFRESH-01 ownership supplement

2026-10-16 source review only. Paths are relative to `apps/resident-web/`. Every listed generic retry success is intentionally quiet. A visible old error is not evidence that the next attempt failed. Preserve empty/missing/inaccessible states, last valid same-identity data, request filters, existing subscriptions, and existing polling intervals. No control or request was added.

All generic notifications below remain **not started**. The existing component that starts the deliberate retry is the proposed terminal presentation owner. Its data hook/read effect must expose or correlate the result of **that existing request**, rather than causing notification from a shared error renderer or fetching again. A same-scope automatic refresh superseding the explicit request must not be misattributed. Current void `refetch` APIs cannot simply be awaited as proof of success.

## Client results with existing Retry controls

| Existing owner/control | Existing read/result contract and identity | Persistent feedback / feasibility |
|---|---|---|
| `src/app/(auth)/register/register-form.tsx`: Retry locality; Reload saved details | `registrationLocality` returns data or throws; separate prefill effect reads own profile and catches; localityAttempt/prefillAttempt plus active flag | Separate inline alerts. Capture which deliberate read failed; initial reads remain quiet. Preserve entered fields during prefill. Neither is signup retry. |
| `src/app/(resident)/announcements/announcements-feed.tsx`: ErrorState/RefreshWarning Try again | `useAnnouncements.refetch`, barangay/category identity + newest generation; returned and thrown failure retained separately from rows | Alert/error and stale warning; lists retained. No toast from category changes/Realtime. Do not also emit READ-01 for a count read. |
| `src/app/(resident)/reports/my-reports-tabs.tsx`: Try again | `useMyIncidents.refetch`, own reporter/status filter; returned query error/state, cancelled ref | Existing inline error. Hook currently lacks full thrown-failure/newest-attempt correlation; local result handling needs bounded stale protection without changing query. No read toast from withdrawal refresh. |
| `src/components/reports/new-report-drawer.tsx`: Retry loading form | ReportFormContent read effect rechecks auth/profile, then existing categories/zones/barangay reads; active flag and retry state | Existing alert; guest/profile-completion redirects are navigation, not failure. Missing profile/schema context is not permission to invent a result. |
| `src/components/services/document-request-modal/document-request-modal.tsx`: Retry loading service | Selected document ID + retry; ready/unavailable/error discriminated read; active effect guard | Alert and details retained on failed re-read; missing/unavailable is not a generic connection failure. Separate from SERVICE-01 explicit account check. |
| `src/app/(resident)/services/requests/request-drawer.tsx`: Retry | Request ID + attempt; ready/unavailable/error, returned/thrown failures and cancelled flag | DrawerMessage alert; missing/inaccessible state remains distinct. Only retrying the existing select, never a request mutation. |
| `src/components/services/request-payment-journey.tsx`: payment-details Try again / refresh warning | `useScopedRead` request identity, data/error/newest generation; initial read + **10s** poll and focus refresh share refetch | InlineReadError alert/status. Capture explicit source; poll/focus remain quiet. Page-count save's onSaved refresh is not this explicit Retry. |
| `src/components/services/document-request-modal/success-step.tsx`: Retry receipt | Request ID + retry; paid ledger select returns ready/missing/error and active flag | Persistent receipt alert with don't-pay-again guidance. Missing receipt is not proof payment failed; no new paid notification just for reopening history. |
| `src/components/services/agency-sla-status.tsx`: noncompact Retry | `service_request_sla_tracking` RPC read, request ID + retry; snapshot/error; current inFlight/AbortController/10s timeout | Alert without snapshot, stale warning with old snapshot; **15s** refresh and **1s** display tick quiet. Compact mode has no Retry. No toast per tick. |
| `src/components/emergency/hub-content.tsx`: guidelines/hotlines Try again (including stale notices) | `useEmergencyGuidelines` / `useEmergencyHotlines` via useScopedRead; barangay identity, typed rows/error | InlineReadError alert/status. Two different contents/attempts; preserve empty results and Realtime silence. |
| `src/components/emergency/alerts-content.tsx`: Try again / stale-warning Retry | `useAnnouncements` category emergency, barangay/category/newest generation | Existing alert/stale status. Opening an alert or receiving Realtime update is not Retry. |
| `src/components/emergency/centers-content.tsx`: list read Try again / stale-warning Retry | `useEvacuationCenters` via useScopedRead, barangay identity and rows/error | InlineReadError. Does not acquire GPS or calculate route; location and route retries have specific IDs below. |
| `src/components/emergency/family-content.tsx` and `src/app/(resident)/settings/profile/profile-form.tsx`: household Try again | `useFamilyMembers` via useScopedRead; profile identity and read error, separate from `lastWriteFailure` | InlineReadError alert/status. Household write helper already owns writes; its recovery refetch is quiet. |
| `src/components/emergency/scan-content.tsx`: instructions Try again and centers-read retry passed to Show QR | `useEmergencyQrContent` and `useEvacuationCenters`, barangay-scoped results/errors | Existing InlineReadError. Instructions and centers are distinct contents; neither is camera/check-in/household-QR attempt. |
| `src/components/emergency/qr-show-dialog.tsx`: centers Try again | `onRetryCenters` delegates to scan-content's existing centersRead.refetch; dialog receives centersStatus | InlineReadError; same upstream request has one owner. Do not add a second toast in child and parent. Native share stays quiet. |
| `src/components/maps/directory-content.tsx`: directory Try again / stale warning | `useEmergencyHotlines` via useScopedRead, barangay scope | Existing alert/status; no change to displayed hotlines or empty results. |
| `src/app/(resident)/settings/help/help-center-client.tsx`: Retry | `useFaqArticles.refetch`, active/deleted/optional-barangay filtering, articles/loading/error | Existing inline error; query returned errors retained, but thrown/stale result protection is incomplete. Local presentation/result correction must preserve query/subscription; no auto toast. |
| `src/components/search/search-results.tsx`: Try again / same-query submit; `search-input.tsx`: suggestion Try again | useResidentSearch's key + activation sequence + retry + current/AbortController; error versus failed groups/empty success | **SEARCH-01 owns** deliberate search failure. Suggestions/typeahead partial/aborted results stay quiet; no duplicate REFRESH-01 error. |

## Specific catalog retry ownership (no additional generic notification)

| Existing control | Catalog owner / result |
|---|---|
| Recovery Check again, resend, verify, password-update/sign-out retry | AUTH-07–14; typed recovery result and sign-out result; both page/dialog variants retained |
| Email send/resend/Check confirmation | AUTH-15–20; current explicit handler owns terminal result |
| Approved-ID Retry in form and ServicesVerification notice | SERVICE-04; useResidentEvidence's profile/evidence/error generation; background/focus/auth/Realtime quiet |
| Valid ID status Try again (`valid-id-flow.tsx`→`settings-id-status.tsx`) | Generic REFRESH-01 for the **read only**, separately from ID-08 submission retry; status refresh catches failures and returns Promise<void>, may coalesce an in-flight refresh and queue one existing follow-up; result must match original owner/generation |
| Valid ID Try reading again / Retry same submission | ID-04 / ID-08; original OCR/read or immutable submission identity; no generic duplicate |
| Registration Retry map / explicit Detect My Location | LOC-03 / LOC-01; map tile errors can repeat and must not notify per tile; successful map appearance quiet |
| General-map locate; Location Verification Detect | LOC-05 / LOC-06–07; explicit fix distinct from auto GPS |
| Centers location Try again / walking route Try again | EM-01 / EM-04; wrappers are void; actual keyed fix/route state owns settlement; never infer from wrapper return |
| Household QR Try again / scanner Try again | EM-06 / EM-07; success readiness quiet; no generic duplicate |
| Pickup Retry recording | PAY-02, a mutation, **not a generic read retry** |

## Existing server refresh controls: documented result limit

`src/components/shared/read-failure.tsx` calls `router.refresh()` within a transition. `src/components/shared/route-error.tsx` calls the framework-provided retry in a transition. Neither exposes the server read's successful/failing result, content identity or fresh attempt number to its caller. A transition settling or an old error being rendered is insufficient by itself to classify a current result. No notification on mount/click; no server result/query/route change. A future implementation must demonstrate an existing-client, same-route/content settled-attempt correlation, or keep this outcome visibly limited with inline guidance. Generic notification must not require a new public helper, observer, endpoint or request.

Inspection-only server callers of ReadFailure:

- `src/app/(resident)/home/page.tsx`: recent requests, recent reports, latest announcement; separate notices preserve each read's error. Guest latest announcement also uses this notice.
- `src/app/(resident)/announcements/[announcementId]/page.tsx`: profile/announcement read; missing announcement remains not-found.
- `src/app/(resident)/health/drives/[driveId]/page.tsx`: profile/medical-drive read; missing/inactive drive remains unavailable/not-found.
- `src/app/(resident)/services/documents/page.tsx`: document catalog.
- `src/app/(resident)/services/[documentId]/page.tsx` and `services/requests/new/[documentId]/page.tsx`: document read; preserve ownership/profile gates and unavailable distinctions.
- `src/app/(resident)/services/requests/page.tsx`, `services/logs/page.tsx`, `services/requests/[requestId]/page.tsx`: own requests/activity/request details.
- `src/app/(resident)/services/payment/[requestId]/page.tsx`, `payment/pickup/[requestId]/page.tsx`, `payment/qrph/[requestId]/page.tsx`: own-request guard read; missing/inaccessible remains not-found.
- `src/app/(resident)/services/payment/success/page.tsx`: owned confirmed paid receipt; retain don't-pay-again guidance.

Root, `(auth)` and `(resident)` error boundaries use RouteError with retry and safe error/digest guidance. These are framework entry points; do not remove them or treat mounting an error boundary as a new user action. Existing comment text saying a route retry is always read-only is not proof: remounts/server layout work can rerun existing setup/payment effects. Preserve those operations and do not add any retry loop.

`src/components/auth/profile-setup-notice.tsx` exposes **Retry account setup**, which also refreshes the route. `getOptionalUser` can call `ensureGoogleResidentProfile`; it is therefore not safely classifiable as a pure data-read retry. The client has no setup-result contract beyond subsequently rendered state. Keep its existing status and flow; no generic read-failure toast based only on Promise/transition completion and no change to server setup behavior.

## No existing explicit Retry control (do not invent one)

- `components/health/active-drives-content.tsx` has date/filter/month controls and an error display, but no read Retry. `my-registrations-content.tsx` has filters/selection, no read Retry. `register-drawer.tsx` lacks an error/Retry result path; `registration-drawer.tsx` renders parent data without a fetch. The standalone drive **detail** ReadFailure is already listed above.
- `components/reports/incident-drawer.tsx` ignores read errors and has no explicit Retry. `announcement-modal.tsx` uses supplied data without its own read Retry. Preserve automatic/read-silence decisions; broader missing-error UI is outside this toast-only phase.
- Settings `about/about-client.tsx` consumes about/developers/loading but exposes no Retry; `terms-privacy/terms-privacy-client.tsx` consumes content/loading without Retry. Hook-exported refetch alone is not a reachable control.
- `components/maps/preparedness-guide.tsx` contains static guidance, not a data source/Retry. General map's dynamic wrapper has a loading fallback and no Retry control; gesture/search/location/fullscreen actions keep their own contracts.
- Manual browser reload, normal navigation, filters, background/focus refresh and Realtime are not an invented explicit Retry button.

## Verification still needed in implementation phases

For each actual Retry: fail the first read, activate Retry once, prove the **new** attempt failed before one toast; make the same Retry later to prove a new attempt can notify; abort/switch entity/account or supersede with automatic activity and prove no stale notification; return empty results and prove silence; retain old data with stale guidance after failed refresh. Watch pending state/console and keep network counts/cadence unchanged. None of these browser cases was executed in Phase 1.
