# P17 — Server inbox, durable remote push and notification preferences: implementation and verification (2026-10-21)

**Tasks:** P17-T01…T08. **Requirements:** A44 (+ A36/A47/A51 integration), B18, B24, F01–F03/F07/F11/F12, handoff D19/D04/D15/D20, G13/G20, G18 account binding. **Status:** Partially complete, non-device scope (OD-06/OD-07/OD-14). **Source:** uncommitted on base `187a2ab3`. **Environment:** disposable local database clone (`p17_notifications`, dev data at migration 0117 plus repository migrations 0118–0135); hosted project `pwjbucnyqexiepoinoke` read-only. Nothing was committed, deployed or applied remotely; no hosted data was written; no push was sent to Expo or Apple; no screen of the app was run signed in.

## What was built

| Layer | Files | Behavior |
|---|---|---|
| Database | `supabase/migrations/0135_resident_notifications.sql` | `notification_preferences` (own read), private `notification_events` / `notification_outbox` / `notification_deliveries`, resident-visible `notification_inbox` (own read; `read_at` is the only column a resident can write), event creation by AFTER triggers on request status/payment, incident status, announcement, medical drive and drive-registration changes, `set_notification_preferences`, `release_push_token`, seven `notification_worker_*` functions (service_role only), realtime on the inbox. |
| Sender | `supabase/functions/send-notifications/{worker.ts,index.ts}`, `config.toml` | Claims due rows (preferences applied at that moment), sends one Expo message per token in batches of 100 with backoff, records tickets, removes dead tokens, checks receipts after 15 minutes, purges expired rows, returns operational counts. Shared-secret header; refuses to run without a configured secret. |
| Data | `src/data/schemas.ts`, `src/data/resident-api.ts`, shared types | Inbox page/detail/unread count/read marking (single and snapshot-bounded bulk), saved kinds, preference save, token register/release. |
| Logic | `src/features/notifications/{model,tap-routing,push-controller,preference-actions,inbox-actions}.ts` | Destination allowlist, push-data validation, tap resolution against the resident's own inbox row, replay guard, token registration/release with retry marker, preference and read controllers. |
| UI | `src/features/notifications/{inbox-screen,preferences-screen,inbox-count,push-lifecycle,tap-handler,native-push,push-store,logout}`, routes `app/notifications.tsx`, `(tabs)/settings/notifications.tsx`, Home/Settings entries, `_layout.tsx`, `runtime.tsx` logout hook | Inbox (All/Unread, mark all, detail sheet, open linked item), Settings → Notifications (global and per-kind switches, honest device state, SMS shown unavailable), unread count entries on Home and Settings, token lifecycle, tap handling, release at logout. |
| Config | `app.config.ts`, `metro.config.js`, `package.json` | `expo-notifications` plugin (no background mode); web stand-in for the module. |

**Dependency added:** `expo-notifications ~57.0.11` (iOS workspace). Reason: permission, push token and notification responses cannot be done without it. It was already resolved in the root lockfile (57.0.11, used by Android), so the lockfile gained one workspace declaration line and no resolved version changed. `expo-device` and `expo-constants` were not added.

## Decisions (P17-D01…D16)

- **D01 Outbox per notification, tickets per token.** P03-T07 sketched an outbox row per token. Here the outbox row is per inbox entry and `notification_deliveries` holds one ticket per token, so a token registered after the event still receives it and a token that rotated is not retried by stale id.
- **D02 Kinds.** `request_status`, `payment`, `incident_status`, `announcement`, `medical_drive`, `health_registration`. Added `medical_drive` (Android notifies new drives, A44-009); dropped the sketched `emergency_alert` (emergency announcements are announcements; no delivery guarantee is promised). **No check-in event:** a check-in is the resident's own online action confirmed in-app, and the approved contract lists none.
- **D03 The inbox always records.** Switches control phone alerts only (applied at claim time); an opted-out resident still has the entry.
- **D04 Generic text, written server-side.** Fixed strings per kind/status. Titles, addresses, names and reporter data of the source row are never copied. Verified by a test that fails if source text appears.
- **D05 A notification failure never rolls back the operational change.** Trigger functions catch errors and raise a warning. A trigger bug therefore loses a notification rather than blocking staff work; the worker health counts make a silent gap visible only indirectly (no events), so the owner should watch the event count after deployment.
- **D06 Own actions are not notified.** No event when the acting user is the recipient (resident cancels own request or registration, withdraws own report).
- **D07 Sender authentication.** Gateway JWT verification is off (any resident's JWT would pass it); the function requires `x-worker-secret` (`NOTIFICATION_WORKER_SECRET`) and returns 503 without one. Not deployed.
- **D08 Token removal by possession (owner-approved 2026-10-21).** `release_push_token(token)` is callable by anonymous callers as well as signed-in ones: a signed-out device has no session, and offline logout is exactly when it has none. It only ever deletes the push address it is given, answers the same whether or not the token existed, and refuses a malformed token. A push token is delivered only to the app on its device and to this server, so possession is the proof; a wrongly removed token costs alerts only until that device is next opened, when the app registers again. The app retries a pending removal on every app open and foreground, signed in or not, and a later registration of the same device replaces the marker, so a token another account has taken over is never released. The sender also ignores tokens unused for 60 days. The Phase 3 test that pins the anonymous-executable security-definer routines now lists `release_push_token` as the one addition (86 assertions still pass); a Phase 17 assertion confirms no other notification routine is anonymous-executable.
- **D09 Taps.** The payload is a pointer `{v:1,kind,id,inbox}`. The target comes from the resident's own stored inbox row (row-level security), must equal the payload, and must be allowlisted; anything else lands in the inbox with an explanation. A tap while signed out is dropped. Each response is handled once.
- **D10 Permission timing.** The iPhone prompt appears only when the resident turns alerts on in Settings. The lifecycle never prompts. A denial keeps the saved choice and shows how to allow notifications.
- **D11 Everything sits behind `remotePush`, which stays closed.** Opening it is an owner decision after the deployment steps below; with it closed, Home/Settings show no entry, the routes show the unavailable screen, and no token, count or listener is started.
- **D12 No silent push, critical alerts or background mode.** `enableBackgroundRemoteNotifications: false`; generated Info.plist has no `UIBackgroundModes`.
- **D13 Retention** as staged in P03-T07: read inbox rows 90 days after reading, finished outbox rows 30 days, events 180 days when no inbox row remains. Needs the privacy owner's confirmation (PR-14).
- **D14 Staleness.** A queued alert older than 24 hours is skipped (`stale`); Expo `ttl` is 24 hours.
- **D15 Home bell.** The announcement bell on Home does not exist in the iOS app yet (A08-009, Phase 18). The inbox has its own entry and count on Home and Settings; Reports counts are untouched.
- **D16 Realtime.** `notification_inbox` joins the realtime publication (migration). It is a refresh signal only.

## Verification

| Check | Result |
|---|---|
| iOS baseline before edits | typecheck 0, lint 0, tests 572/572 |
| iOS final | typecheck 0, lint 0, tests 652/652 (62 in `notifications.test.ts`, 18 in `notification-worker.test.ts`), `expo export --platform ios` 0 |
| Generated configuration (`expo config --type introspect`) | `aps-environment` entitlement present, no `UIBackgroundModes`, no new usage strings |
| New pgTAP `resident_ios_phase17_notifications.test.sql` on the clone | 121/121 (cross-tenant, deleted/staff recipients, dedupe, own-action skip, column-level inbox privileges, anonymous and resident denial of the sender surface, anonymous token release with no oracle and malformed-token refusal, preference validation and merge, claim-time preferences, tickets, dead-token removal, retries and dead at five attempts, stale claims, receipts, health, retention) |
| Existing backend tests on the same clone | `resident_ios_phase3_backend` 86, `phase3_requests` 28, `tenant_write_guards` 7, `rls_isolation` 17, `automatic_document_payments` 65, `resident_household_conditional` 22: no failures |
| Sender against the real database functions (throwaway test, deleted) | one resident with a good and a dead token: claimed 1, sent 1, dead token removed, 1 ticket error counted; after aging the ticket, receipt recorded as `provider_ok`; no errors |
| Web localhost (OD-14), gate closed | app starts, guest Home renders with the new provider and no console errors; `/settings/notifications` shows the unavailable screen. **Verified (web localhost)** for the closed state only |
| Other workspaces | resident-web, admin-web, resident-android `tsc` 0; shared `tsc` shows the same 5 errors as before in `id-evidence.ts`/`service-catalog.test.ts` (none in files this phase touched) |
| Hosted (read-only) | migrations through 0134; no `notification_inbox`; `push_tokens` present with 0 rows; `upsert_push_token` has the 0121 body and the unique token index exists; no `send-notifications` function |

## Acceptance (A44, G13/G20)

| Criterion | Status |
|---|---|
| A44-001/002 on/off and persisted preference | Met on automated and database tests; Pending device/web for the screen |
| A44-003/004/005 permission, token, refresh on session start | Logic and lifecycle built and tested with doubles; **Pending device (OD-14)** for the real prompt and token |
| A44-006 remove token on opt-out | Met by tests; an offline logout keeps a retry marker that is completed on the next app open, signed in or not (D08) |
| A44-007…013 events and event-specific text | Met for request, payment, incident, announcement, drive, registration (D02 for check-in); text is generic by design (D04), replacing Android's per-event titles |
| A44-014 preferences respected | Met at send time (database tests) |
| A44-015/016/017 denial, Expo Go, native build | Denial and no-token states met; Expo Go is not a supported target for this app; real-device run **Pending device** |
| A44-018 SMS visible, not operational | Met: disabled switch labelled unavailable, no consent stored |
| A52-009 tap routing | Logic met by tests; cold/warm/foreground on a device **Pending device** |
| Durable inbox/outbox, dedupe, receipts, retries | Met on the database clone and with a scripted provider |
| Named ownership, monitoring, alerts | **Not met**: sender not deployed or scheduled; PR-07 on-call and alert thresholds not set |
| G13 signed binary / APNs credentials | Skipped (OD-06) |

## Pending, with exact steps

**Owner-authorised operations (not done here):**
1. Apply `0135` to the hosted project (hosted is at 0134).
2. Deploy `send-notifications`, set `NOTIFICATION_WORKER_SECRET` (and `EXPO_ACCESS_TOKEN` if Expo enhanced security is on), and schedule one POST per minute with `x-worker-secret`.
3. Name the sender operator/on-call (PR-07) and alert on the returned health counts: `oldest_pending_seconds`, `dead_last_24h`, `ticket_errors_last_24h`, `unreceipted_over_1h`, and on `errors` in the response.
4. Confirm retention (PR-14). (D08, anonymous token release, was approved and built on 2026-10-21.)
5. Then decide whether to open `remotePush` (G02, G13, G17, G20, G21 remain partly Skipped under OD-06).

**Pending device (OD-14, needs a development build, which OD-06 currently excludes):** permission prompt on first enable; denied then allowed in iPhone Settings; token registration; a staff status change delivering a banner (foreground) and a lock-screen alert; tap from cold start, background and foreground opening the right screen; tap after logout and as another account; offline logout then sign-in; two accounts on one iPhone; VoiceOver and Dynamic Type on the inbox and settings screens.

**Pending web (OD-14):** with a local database clone and a development-only localhost allowance (the web config rejects HTTP), open the gate locally and exercise the inbox list, filters, detail, mark read/unread and mark all, unread count updates through realtime, and the preferences switches; the push-specific calls fail by design on web.

## Out-of-scope observations (not fixed)

- Android still presents local notifications from client realtime and registers tokens without a sender; it will keep working but receives no server-side inbox.
- `AGENTS.md` is empty in the working tree (an uncommitted deletion of its 11 lines, not mine); `CLAUDE.md` only imports it. Its former rules were followed anyway (SDK 57 docs read; migration `0135` is the next prefix after `0134`; its "last pushed 0094" line was already stale).
- The plan's phase-17 Home bell (A08-009) belongs to Phase 18.
- Phase 3's anonymous-executable allowlist test was changed once, deliberately, for D08 (one routine added, with the reason in the assertion text).
