# RW-LT-05 — Emergency, maps, and household actions

Recorded 2026-10-12 (Asia/Manila). Synthetic local fixtures only (tenant "RW Feedback Local"). No credentials, tokens, OTPs, or real resident records are in this folder (scanned: no JWT or generated-password strings). The household and check-in rows the run writes use the real local database and are restored/removed by the run. The household QR Edge Function and the OSRM routing service are fulfilled in the browser; no external provider was called.

## 1. Preconditions and inputs

- RW-LT-04 is complete ([record](../rw-lt-04/record.md)). I re-read the repository `AGENTS.md` (Android Phase 8 stays cancelled and untouched; sequential migrations), `apps/resident-web/AGENTS.md`, and the full plan.
- Expo v57 docs (https://docs.expo.dev/versions/v57.0.0/) were re-read: SDK 57 / React Native 0.86. Nothing applies to the Next.js resident web and no Expo code is touched. The installed Next.js 16.3 lazy-loading guide (`next/dynamic`, `ssr: false` only in Client Components) was read for the map/QR-reader loading placeholders.
- Verified against installed sources: `@supabase/postgrest-js` 2.112.1 reports a failed/aborted fetch as `status: 0` (so only that status means "no answer arrived"), and `html5-qrcode` rejects `start()` with a string that names the browser's DOMException (probed in Chrome).
- Working tree: unrelated admin-web, Android, iOS, migration and other-plan changes were left untouched. No backend change, migration, admin-web/Android/iOS edit, or new dependency was needed; no backend exception was recorded.
- **Concurrent work.** Another Claude session (DRRM weather routing, R1) rewrote the Centers files (`centers-content.tsx`, `centers-map-client.tsx`, `centers-map.tsx`, `locate-button.tsx`) while this phase ran. Its device-location controller (`hooks/use-device-location.ts`, `location-status-card.tsx`) now owns Centers location state; it merged this phase's read-state, route-status, placeholder and locate-button behavior back in, and RW-LT-05 verifies the merged result. A `forgot-password-dialog.tsx` that appeared under settings/change-password came from the same concurrent work; it is recorded as a RW-LT-08 surface and is untouched here.

## 2. Changes (apps/resident-web/src)

| File | Change |
|---|---|
| `hooks/use-scoped-read.ts` (new) | Small bookkeeping hook, not a fetch framework: result and failure keyed by identity, newest-request-wins, returned errors and thrown rejections both become `error`, `isInitialLoading` / `isRefreshing` / `isReady`. The caller still owns the query, filters and subscription. |
| `hooks/use-emergency-guidelines.ts`, `use-emergency-hotlines.ts`, `use-emergency-qr-content.ts`, `use-evacuation-centers.ts` | Same queries, filters and Realtime subscriptions; read state now identity-scoped (D-07, D-08). `isLoading` keeps its meaning; new `isInitialLoading` / `isRefreshing` / `isReady`. The old cancelled-ref reset-at-effect-start race is gone. |
| `hooks/use-family-members.ts` | Read state as above (a failed refresh keeps the roster instead of replacing it with `[]`). Mutation return contracts unchanged (member\|null / boolean). Writes are serialised (the roster is rewritten whole, so overlapping writes would drop one) and `lastWriteFailure()` says `rejected` / `unconfirmed` (status 0 or thrown) / `busy`. `error` is now read-only. |
| `components/emergency/family-member-dialog.tsx` | `onSave` / `onDelete` return `Promise<boolean>` and are awaited; inputs and the dialog stay on false or rejection; pending "Adding…/Updating…/Removing…" until settled; synchronous repeat guard; a result for a closed/reopened dialog is ignored; selection chips expose `aria-pressed`. The dialog never notifies (D-02). |
| `components/emergency/family-content.tsx`, `app/(resident)/settings/profile/profile-form.tsx` (HouseholdSection only) | Both consumers updated together. One terminal notification per attempt via `lib/household-feedback.ts`; an unconfirmed write re-reads the roster (read-only) and never retries; profile's inline Remove has a pending state and blocks overlapping roster edits; read failures show an inline retry instead of "No … yet" (D-01, D-07). The rest of the profile form (uploads, validation toast) is RW-LT-08. |
| `lib/household-feedback.ts` (new) | Shared outcome wording: success, rejected ("Nothing was changed"), unconfirmed ("may or may not have been updated; check the list"), busy. |
| `hooks/use-qr-checkins.ts`, `lib/qr-checkin.ts` (new) | Insert columns and return contract unchanged. Thrown rejections are now failures; `lastCheckInFailure()` separates rejected from unconfirmed. `parseCenterQr` (same JSON → schema → barangay rules) and `completeCheckIn` give exactly one outcome: recorded / partial warning / failed / unconfirmed (D-09). |
| `components/emergency/qr-scanner-dialog.tsx` | Reader import inside the guarded start; a camera that finishes starting after close is stopped; repeated decodes run one check-in; named modal dialog (`role=dialog`, Close focused, Escape closes); failure-specific guidance (blocked / no camera / in use / unsupported / unknown) with Try again, Close and the Upload alternative; a result arriving after close still notifies once but does not touch the closed dialog (D-10). |
| `components/emergency/qr-upload-fallback.tsx` | One image at a time, real stage labels ("Reading image…" → "Checking in…"), `scanner.clear()`, chunk-failure and unreadable-image messages, input reset. |
| `components/emergency/qr-show-dialog.tsx` | Clipboard rejection reports one error naming the alternatives (D-11 clipboard); success only after the clipboard promise resolves; share-sheet dismissal is silent; "Download started"; centers read state (loading / error + retry) instead of "No evacuation centers found". |
| `components/emergency/household-qr-dialog.tsx` | `getSession` and fetch inside try, late object URL revoked, session-ended vs unavailable, read-only Try again, fixed 256 px frame, one polite "Generating your QR code…". |
| `components/emergency/hub-content.tsx`, `alerts-content.tsx`, `scan-content.tsx`, `hotline-skeleton.tsx` (new), `components/maps/directory-content.tsx`, `components/shared/inline-read-error.tsx` (new) | Matching skeletons with one polite label per region, retained content on refresh with a quiet "Updating" hint, stale-data warning on a failed refresh, inline retry on an initial failure, existing empty copy only for a successful empty read. Urgent content has no entrance motion. |
| `components/emergency/centers-content.tsx`, `centers-map.tsx`, `centers-map-client.tsx`, `components/maps/locate-button.tsx`, `map-canvas.tsx`, `map-client-wrapper.tsx`, `evacuation-center-card.tsx` | Centers read states; location status with deliberate retry (R1 controller); route status `loading` / `ready` / `unavailable` so "Fetching…" always settles; newer selection wins over an older route response; steady (non-pulsing) map placeholders at the map's own size; locate button: synchronous guard, `aria-busy`, one explanatory error per failure (blocked vs unavailable vs unsupported) naming pan/zoom; no toast on success; clickable center cards are keyboard buttons. |
| `components/ui/dialog.tsx`, `app/globals.css` | Dialog motion from the shared tokens (180 ms in / 140 ms out). The reduced-motion block previously matched only `.animate-in`/`.animate-out`, not Tailwind's `data-[state=open]:animate-in` classes, so shadcn dialogs still zoomed; it now covers both. |
| `scripts/resident-web-feedback-regression.cjs` | Adds `rw-lt-05:build`, `rw-lt-05:unit`, `rw-lt-05:verify <run>`; `RW_ONLY=id,id` narrows a run to named scenarios. |

## 3. Verification

| Check | Result | Evidence |
|---|---|---|
| Typecheck | **Pass** (exit 0) | [checks/typecheck.txt](checks/typecheck.txt) |
| Lint | **Pass**: 0 errors; the same 2 inherited warnings | [checks/lint.txt](checks/lint.txt) |
| Production build | **Pass** (exit 0), `tsconfig.json` restored | [checks/build.txt](checks/build.txt) |
| `rw-lt-05:unit` (QR parse/outcome rules, household wording, ownership/contracts) | **4/4 pass** | [unit-results.json](unit-results.json) |
| `rw-lt-05:verify run-1` (28 scenarios, 91 checks, production build, Chrome) | **28 pass, 0 fail, 0 error** | [run-1/results.json](run-1/results.json), [screens](run-1/screens/) |
| RW-LT-00 baseline journeys rerun | **20/20 executed, 0 errors**; D-01, D-02, D-07 (household) defect scenarios now `reproduced=false` | [baseline-regression/results.json](baseline-regression/results.json) |
| RW-LT-01 / 02 / 03 / 04 reruns | **13/13, 10/10, 15/15, 18/18** | [01](../rw-lt-01/rerun-after-rw-lt-05/results.json), [02](../rw-lt-02/rerun-after-rw-lt-05/results.json), [03](../rw-lt-03/rerun-after-rw-lt-05/results.json), [04](../rw-lt-04/rerun-after-rw-lt-05/results.json) |
| Inventory reconciliation | **Pass** (every entry assigned to one phase) | [inventory.json](inventory.json), [coverage.md](../rw-lt-00/coverage.md#phase-verification) |

Process notes (honest account of the run): the first full run failed 9 scenarios and errored 3. Product findings fixed: the reduced-motion CSS did not reach Tailwind variant classes; clickable center cards were not keyboard targets. Everything else was scenario or environment: init-script closures that did not serialise into the page, a Playwright fallback bug in my route helper, a stale server started before a rebuild (missing chunks), fixture state leaking between scenarios, and selectors made ambiguous by the R1 location card.

### Scenario results (run-1)

| Scenario | Observed |
|---|---|
| hub-read-states | Slow: skeletons + one "Loading emergency information…", never "No guidelines available."; content arrives with no entrance wrapper; refresh failure keeps content with a stale warning, no toast; initial failure (500 and transport failure, which supabase-js retries first) → inline error + read-only retry; successful empty → existing copy. |
| alerts-read-states | Failure → inline error + retry; refresh failure retains alerts with warning; empty → existing copy and filters; slow → skeleton cards + label. |
| centers-read-states, centers-location-* | Failure → inline error (not "No evacuation centers found"), retry recovers; empty and slow states; blocked permission, unavailable position (its own wording, Try again re-requests), granted position (distances, no notice); rapid selection: a slow older route never replaces the newer one; route failure settles to the straight-line note. |
| scan-read-states | Instructions failure → inline error with scan/show still usable; slow → skeleton + label. |
| qr-upload-checkin-outcomes | Real local DB: valid code → 1 row, 1 success; household update fails → 1 warning, no success, row exists; rejected insert → 1 error, 1 request; lost response → 1 unconfirmed warning, no second request; repeated selection while slow → 1 request, 1 toast, busy immediately; unreadable image / other barangay / wrong schema / plain text → exactly one error each, zero requests, zero rows. |
| scanner-camera-denied / missing / in-use / unsupported / chunk-failure | Matching guidance naming the Upload alternative; no toast duplicating it; Close focused; Try again re-runs; Escape closes; a failed reader chunk ends in guidance. |
| scanner-camera-lifecycle (fake capture device) | Camera starts, Close releases every track, starting is announced once. |
| scanner-close-while-starting | Closing before the stream arrives leaves no live track. The library logs its own unhandled "play() interrupted" rejection in that case (recorded and allow-listed for this scenario only). |
| qr-show-share-copy-download, qr-show-centers-read-states | Clipboard rejection → one error, no "Copied"; two rapid activations → one write, one success after it resolved; "Download started", PNG name; QR frame 256 px; failed centers read → retry offered. |
| household-qr-states | Loading → ready → failed keep a 256 px frame; one polite announcement; failure → explanation + Try again, no toast; retry regenerates. |
| family-dialog-contract | Rejected add keeps dialog/inputs/selection, one error; pending is immediate and held; repeated activation → 1 write; confirmed → one success and close; lost response → one unconfirmed warning, 1 write, dialog kept, read-only re-read; rejected remove keeps the dialog; confirmed remove closes; closing mid-write leaves the write running, one success, clean reopen. |
| family-read-failure-not-empty, profile-household-no-false-success | Roster read failure → inline error, never "No family members added yet."; profile editor: failed add never toasts success or closes; retry from retained input succeeds; inline remove pending/rejected/confirmed. |
| maps-placeholder-and-locate, maps-locate-success-and-repeat, locate-unsupported | Placeholder is steady, announced once, equals the map's height; denied → one blocked/pan-zoom error, control restored; repeated activation → 1 geolocation request, busy immediately, no toast on success; unsupported → one error. |
| directory-and-preparedness | Failure → inline error; local search no-match copy; empty copy; preparedness guide makes no data request, shows no loader or toast. |
| dialog-motion-normal / reduced | 180 ms dialog animation; reduced motion removes the zoom travel. |
| emergency-narrow-320 | No horizontal overflow on hub/family; toast within gutters; dialog within the viewport. |

## 4. Exit gate

| Criterion | Result |
|---|---|
| Urgent content does not wait for stagger | **Met.** No reveal/stagger on hub, alerts, directory; checked on the DOM. |
| Denied/unsupported camera/location has usable guidance | **Met.** Camera: five failure kinds with the Upload alternative; location: blocked/unavailable/unsupported with unsorted list or pan/zoom. |
| Invalid QR input produces one error | **Met.** Four invalid-input cases, one toast each, no request. |
| Partial check-in produces one warning | **Met.** One warning, no success toast; unit and browser. |
| Rejected household writes never toast success or close the editor | **Met** in both consumers. |
| Map/QR dimensions remain stable | **Met.** 256 px QR frames across loading/ready/failed; map placeholder equals the map height. |
| No emergency backend or check-in payload change | **Met.** Insert columns asserted unchanged; no migration or backend file touched. |
| Typecheck/lint/build | **Met.** |

Phase status: **Complete**, subject to the limits below.

## 5. Not verified / carried forward

- **Live camera decoding.** The fake capture device produces video, not a QR. The decode → check-in path is exercised through the upload fallback (same reader and `lib/qr-checkin.ts`) and the unit tests; a real device camera scanning a printed code is manual/RW-LT-09 coverage.
- **Real-device permission UX, screen reader, browsers.** No manual screen-reader pass (DOM-level `role=status`/`role=alert` checks only), Chrome-only, no Firefox/Safari/iOS web, no 200% zoom pass; the share sheet (`navigator.share`) was not exercised.
- **Realtime.** Local Realtime is unavailable; refresh scenarios use the in-browser protocol stand-in.
- **Library behavior.** html5-qrcode logs an unhandled "play() interrupted" rejection if the dialog closes while the camera is still starting; the camera is released, but app code cannot catch the library's internal promise.
- **Centers location/route internals** belong to the concurrent R1 session's device-location controller; this phase verified its user-visible behavior, not its internal state machine.
- **Remaining defects owned elsewhere.** D-03 (incident/register drawers, RW-LT-07), D-04 (payment-method, report submit/withdraw, location save), D-06 (my-incidents, FAQ, payment journey), D-07/D-08 for non-emergency reads, D-11 export/PDF (RW-LT-08), D-12 (notification toggle, profile validation toast), D-13, D-14 (RW-LT-06); profile uploads/toasts remain RW-LT-08.
- **Production readiness** is not claimed. Broader qualification remains pending under RW-LT-09, and nothing was deployed.
