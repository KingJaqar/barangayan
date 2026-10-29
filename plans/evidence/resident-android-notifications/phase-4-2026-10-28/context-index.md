# Phase 4 context supplement and verification — 2026-10-28

Extends the [phase-0](../phase-0-2026-10-28/context-index.md) … [phase-3](../phase-3-2026-10-28/context-index.md) supplements. Shared rules: plan §3. Raw logs (private, not committed): `tmp/resident-notifications-phase4-20261028/logs/`; pre-edit copies and `git status`: `tmp/resident-notifications-phase4-20261028/before/`.

## Checklist
| Item | Record |
|---|---|
| Scope | Android tap routing (warm/cold), account-bound pending intent, replay protection, token lifecycle (register / release / retry / rotate), Android channel, removal of the migrated local alert branches. No DB, worker, hosted service, gate or device changed. |
| Prerequisites | Phases 0–3 Verified in the plan; re-checked in source: `announcements.tsx` already resolves `notificationId` against the owner's row (D31); `emit_notification` still emits announcement/request/incident events server-side (`0135…sql:158–196`); `release_push_token` (0135:295, callable by anon) and `upsert_push_token` (0121:198) exist; worker `buildMessage` data = destination + `inbox` (`worker.ts:88–97`). |
| Context inputs | Direct reads of the ~12 touched/consumed files (no Repomix packet: the bodies were read in full, a packet would only duplicate them). `expo-notifications` 57.0.11 types read from `node_modules` + the Expo v57 notifications page. Repowise not used. iOS `push-controller.ts` / `tap-routing.ts` / `native-push.ts` read as the reference design. |
| Instructions | Root `AGENTS.md` empty (0 bytes); nested ones cover only admin-web/resident-web. No conflict. |
| Git baseline | HEAD `9fe8add1`; 614 status entries at entry (user/concurrent work). Every file I edited was clean in git at entry (SHA-256 first 12: push-notifications.ts `c65486c755cb`, _layout.tsx `5d91409ea30d`, use-notification-preferences.tsx `1d00f4c76cb1`, use-notification-realtime.ts `762ef057ca51`, notification-templates.ts `8dc01cce19da`, root-navigation-isolation.mjs `c3067be5464c`, app.json `507d51f5145b`). Post-edit status diff = only the files listed below. |

## Baseline (before edits, single runs)
tsc 0 errors · lint 0 errors / 1 pre-existing warning (`health-presentation.tsx` `useState`) · vitest 33 files / 358 tests · `settings-profile-ui` pass · `root-navigation-isolation` **fails before any edit** (esbuild: the fixture's `react-native` mock lacks `Platform`, imported by `constants/theme.ts`; it also launches Chromium without the Chrome fallback) — pre-existing fixture drift.

## Findings and decisions
| ID | Finding / decision |
|---|---|
| F38 | Sign-out never released the push token: `unregisterPushToken` used an in-memory `cachedToken` (null after a restart), deleted through the table (needs a session) and had no caller on logout. After a sign-out the previous resident's pushes kept arriving until another account registered the device. |
| F39 | `getExpoPushToken` asked for permission whenever it was not granted, on every session/preference change, and never created a channel; Android 13+ shows the prompt only once a channel exists (Expo docs). |
| F40 | Server events for `medical_drive`/`health_registration` also exist (0135:207,223) and the Android local Health branches are retained by D13, so once server alerts are live Health alerts can show twice (local + push). Health recategorization is excluded (§1.1): recorded, not changed. |
| D34 | Tap handling = pointer only. `pushInboxId` validates the push data (`{v,kind,id\|screen}` + `inbox`, via the existing `parseNotificationDestination`; provider-added keys ignored) and the handler navigates to `/announcements?notificationId=<inbox>`; the Phase 3 screen re-reads the row as the owner (foreign/missing/purged → "no longer available") and marks only that row read once. No second fetch in the handler. |
| D35 | Account-bound pending intent (`createTapIntent`): a cold tap received while restoring binds to the restored account; a tap received signed out, for an account that changed, or when the app cannot open yet (setup incomplete, password recovery) is dropped, never carried to the next account; it waits while setup is loading or the root redirect (`pathname === '/'`) has not landed. Replay guard on `notification.request.identifier` (bounded 50) + `clearLastNotificationResponse()` once taken over. Sync `getLastNotificationResponse`/`clearLastNotificationResponse` used (57.0.11 marks the Async variants deprecated). |
| D36 | Token lifecycle mirrors iOS `push-controller`: record `{userId, token, pendingRelease}` in AsyncStorage (`push-token-record-v1`, deliberately not cleared by logout); marker written before `release_push_token` (anon-callable, 5 s timeout); `retryPendingPushRelease` on every foreground; register on every foreground + device-token change; release on any session-user change (logout, expiry, switch); one serial queue. Only the Settings toggle may ask for permission (`askPermission: true`). Names `registerPushToken`/`unregisterPushToken` kept so existing fixtures keep working. |
| D37 | Channel: one `default` channel (HIGH) created before any permission/token call; `expo-notifications` config plugin added to `app.json` with `defaultChannel: "default"` so remote pushes without `channelId` use it. The worker is **not** changed to send `channelId` (an older installed build without that channel would drop the message). Needs a new native build (not run here → I3). |
| D38 | Removed local branches: announcements INSERT, incidents UPDATE, service_requests UPDATE (+ `announcementTemplate`, `incidentTemplate`, `serviceRequestTemplate`; no other reference: `rg` over src/tests/scripts/packages). Kept: drive_registrations, medical_drives (D13). The realtime hook now has 2 channels. |
| Rollout | **The Android build containing Phase 4 must reach residents only after the worker is deployed and the gates are on (plan §8.2 steps 2–3).** The repository cannot keep "the only working alert path" itself: an installed build without the local branches relies entirely on the server push. Owner action. |

## Files (owned)
Changed: `src/lib/push-notifications.ts` (rewritten), `src/app/_layout.tsx`, `src/hooks/use-notification-preferences.tsx`, `src/hooks/use-notification-realtime.ts`, `src/lib/notification-templates.ts`, `app.json`, `tests/root-navigation-isolation.mjs` (mock drift: `Platform`, new modules).
New: `src/lib/push-registration.ts` (+ test, 15), `src/lib/notification-tap.ts` (+ test, 11), `src/hooks/use-push-registration.ts`, `src/components/notification-tap-handler.tsx`, `tests/notification-tap-ui.mjs`. No dependency added.

## Verification (after edits)
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx expo lint` | 0 errors, 1 warning = the same pre-existing Health one |
| `npx vitest run` | 35 files / 384 tests passed (baseline 33 / 358; +26) |
| `node tests/notification-tap-ui.mjs` | passed, 5 scenario groups, 0 console diagnostics (cold tap + restoration; warm/replay/forged; signed-out/switch/setup/recovery; listener cleanup; registration lifecycle). First two runs failed on fixture bugs only (Sets lost in serialization, `undefined` option key), fixed in the fixture |
| `node tests/settings-profile-ui.mjs` | passed (toggle off still ends in `unregister`) |
| `node tests/root-navigation-isolation.mjs` | passed after the mock fix (needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE` = installed Chrome; baseline failed on the missing `Platform` mock) |
| `CI=1 npx expo export --platform android` | exit 0, one 8.5 MB hbc bundle |

## Limits (not claimed)
No physical or MuMu tap (R08), no real foreground/background/closed-app delivery, channels, OS permission prompt or Doze (R16) — I3. The `app.json` plugin resolves in `expo config --type prebuild`, but no native prebuild/APK was produced. `release_push_token`/`upsert_push_token` were not re-run against a database (pgTAP `resident_ios_phase17_notifications.test.sql` covers them from Phase 17; unchanged). The real list/read journey after a tap is I2 (the screen's deep link was Phase 3 fixture-verified). Not run: `notification-hub-ui`, `reports-announcements-ui` and the other Phase 3 fixtures (no file they load was changed by this phase).
