# Phase 6 context supplement and verification — 2026-10-28

Extends the [phase-5](../phase-5-2026-10-28/context-index.md) supplement. Shared rules: plan §3. Raw logs, packet, screenshots and pre-edit status (private, not committed): `tmp/resident-notifications-phase6-20261028/` (`logs/`, `shots/`, `before/`, `context.xml`, `selectors.txt`, `md.sh`, `find.py`). The R18 rehearsal scripts are committed here under `r18/`.

## Checklist
| Item | Record |
|---|---|
| Scope | Native (MuMu) acceptance of the hub, one dedicated clone + isolated GoTrue/PostgREST/Realtime stack, R18 recovery rehearsal, defects the native walk exposes. No hosted service, deployment or D20 gate changed. |
| Prerequisites | Phase 5 Verified (I2). Re-proved: tsc/lint/vitest and the hub/tap fixtures pass at entry; clone `notif_p5_20261028` gates were `false,false`. **No physical Android device, no signed/embedded release build and no FCM/Expo push provider exist in this environment** → R16 is a blocker, not simulated (plan §5 Phase 6 entry rule). |
| Context inputs | Direct reads of the plan, phase-5 evidence and memory recipes; one scoped Repomix 1.18.1 packet (`context.xml`: 8 files — `announcements.tsx`, hub cards/row/detail sheet, tap handler, push-registration hook, `push-notifications.ts`, `app.json`; 44,461 chars / ~10.8k tokens, security clean, `--include` honoured, no omissions; sha256 `4cd866fbb767e305…`). Read in bounded chunks: `push-notifications.ts` (326–515), tap handler and registration hook (238–325) in full; the screen/row/sheet entries were verified behaviourally on device. Repowise not used. |
| Instructions | Root `AGENTS.md` empty; nested ones cover only admin-web/resident-web. No conflict. |
| Git baseline | HEAD `9fe8add1`; 649 status entries at entry (user/concurrent work), saved to `before/status.txt` + `unstaged.patch`. Owned source edits: two one-line-class changes (below). A concurrent session's mid-edit of `scrollable-chevron-row.tsx` produced one transient Metro `snapToItems` ReferenceError during the walk (file not mine; fixed by that session; the app reloaded clean). |
| Database identity | Walk DB `notif_p6_20261028` = `notif_p5_20261028` + `realtime.list_changes` copied from the dev DB (the pg_dump-made clones lack it; without it Realtime's CDC stream errors) with both gates **on in the clone only**. Rehearsal DB `notif_p6r_20261028` = `notif_p0_20261028` (0144) + 0145 + 0146. Both retained. |
| Native environment | Dedicated MuMu 12 instance (Android 12, 1080×1920, 480 dpi, dev client `com.barangayan.resident.dev`, SDK 57) created for this phase and deleted afterwards; Metro 8106 with `EXPO_PUBLIC_SUPABASE_URL` pointing at the isolated proxy (58420 → GoTrue 58421, PostgREST 58422, Realtime 58423). Test residents `rwfb-populated@test.local` (A, seeded: 83 announcements, 40 history events + profile/incident events, 3 notices) and `rwfb-other@test.local`; password in the session scratchpad only. |

## Baseline (entry; logs `logs/B*.log`)
tsc 0 · lint 0 errors / 1 pre-existing warning (Health `useState`) · vitest 37 files / 391 tests · `notification-hub-ui` and `notification-tap-ui` pass.

## Findings and decisions
| ID | Finding / decision |
|---|---|
| F44 | **Defect (native):** the header bell's badge showed `9…` instead of `99+` whenever the whole-hub unread was above 99 (Phase 3 made the bell whole-hub, so this is now the common case). The absolute badge inherited the 22 dp icon width. D42. |
| D42 | `notification-bell.tsx`: the badge wrapper gets `width: 48; alignItems: 'flex-end'` so the pill can widen and stays anchored right. Verified on device: `99+`. |
| F45 | **Defect (native, R12):** at 2.0× system font the fixed-size card/bell count badges clipped two-digit counts (`79` → `7`, `40` → `4`) — a truthful-count failure. D43. |
| D43 | `count-badge.tsx` (resident presentation only): `maxFontSizeMultiplier={1.2}` on the label. Verified on device at 2.0×: `79`, `40`, `1`, `99+` intact. The shared default presentation is untouched. |
| F46 | The first native read looked stale (opened notice stayed "unread", count 3). Cause was my harness: the first proxy still routed `/realtime/v1/websocket` unmapped, so no Realtime channel was connected; opening an item marks it read and relies on Realtime to invalidate (`announcements.tsx:93`; the explicit toggle at `:99` also refetches). With a correct proxy, SQL-side and in-app read changes reach the screen live. Left as designed; see "Observation". |
| F47 | Expo **dev client** cannot carry the native notification-tap test: tapping a tray notification relaunches the dev launcher to a blank screen/`Refreshing…` (twice; once it hung the emulator's adbd). A real tap test needs an embedded/release build (memory recipe: `export:embed`, `debuggableVariants`). Native warm/cold tap routing therefore stays **pending**; the OS did display the notification on the app's `default` channel (a local notification carrying a push-shaped payload from a temporary probe route, deleted). |
| Observation | If Realtime is disconnected while a resident opens an unread row, the list/count show it unread until the next refresh. Not changed (Phase 3 design, "Realtime only invalidates"); a one-line `finally(invalidateAll)` after the open-read write would remove the gap — recommended follow-up, not required by an R-gate. |
| Observation | With the backend wholly unreachable the existing app-level guard shows "Let's try that again / couldn't load your account setup" with **Try again**; it recovers after reconnect. Hub-specific failure states were exercised with fault injection instead (below). |

## Native results (MuMu, isolated stack; screenshots in `shots/`)
| Case | Result |
|---|---|
| R01 layout | Four cards in order All / Barangay / Account / System with counts (99+/80/41/3), "124 unread" + "Mark all as read", chips pinned, group heading "Barangay · 83"; no "What's New"; app-header title "Announcements". |
| Cards/chips | Account chips (All, Document Requests, Incident Reports, Verification, Security, Profile), System chips (All, Service Status, App Updates, Policies) and Barangay chips show the correct rows; Barangay Health chip → 20 rows scope count (= 80/4), badge arithmetic exact. |
| Paging (R02) | Barangay: 25 rows then "Load older announcements" → 50 rows, another control; keyset order holds across ties. |
| Details | Long-description announcement sheet scrolls; System notice sheet; Back closes the sheet and restores card/chip; incident row opens `/reports/<id>` and Back returns to Account + Incident Reports with the row read and Account 41 → 40 via Realtime; incident row untouched (R06). |
| Realtime | After the proxy fix, an SQL read change and in-app reads updated badges/rows live (R13 premise F42 exercised). |
| Theme/font (R12) | Light, Dark + purple accent + Arial: selected card, dots, chips, rows all follow the account theme; 1.5× and 2.0× system font: no clipping of titles/previews/trailing read control (after D43), TalkBack labels present (`View announcement: …, unread`, `Mark … as read`). |
| Partial failure (R11) | With only `notification_inbox_page` returning 503: Account panel shows "Account notifications could not be loaded. Please try again." with **Try again**; counts and Barangay still load; no error codes shown. Proxy restored → recovery. Total outage → existing app guard + Try again, recovers. |
| Identity | Valid resident verified natively. Guest, required-setup, another-resident and logout/switch were **not** walked natively (device instability after the tap test); covered by I2 J2 (peer/foreign/guest over real RLS) and the fixtures. |
| Not run | Android Back with keyboard/interrupted motion/reduced motion/app background-resume beyond the Back cases above; physical push (R16); native warm/cold tap (F47). |

## R18 recovery rehearsal (`notif_p6r_20261028`, scripts in `r18/`)
1. Legacy data at 0144 (6 residents × 8 announcements, 48 mirrors/48 events/48 outbox rows, divergent read states). Apply 0145 + 0146 with `ON_ERROR_STOP`: **row counts, announcement_reads, inbox rows and the incident/service-request/profile hashes unchanged; gates `false,false`; no event replayed.**
2. `notification_reconcile_announcement_reads(100)` twice: first 1 read added + 1 mirror marked, remaining 0, boundary recorded; second 0/0/0.
3. A resident then marks one reconciled read unread; `notification_restore_announcement_reads(batch)` restores **1** (untouched mirror) and **skips 1** (resident's newer action preserved); events/outbox/inbox rows unchanged (48/48/48).
4. Interrupted fan-out: 250-resident barangay, gates on in the clone; a run rolled back as a whole leaves 0 events and the cursor unmoved; resumed in 4 committed runs (100, 100, 50, 0), 250 events/250 distinct residents/250 inbox rows, fan-out marked complete, final run delivered 0 (no replay). `push_tokens` in the clone: 0, no worker run → no real or test recipient reached.

## Second pass — embedded release build (same day)
| Item | Record |
|---|---|
| Build | `expo prebuild --platform android` (it rewrote two `package.json` script lines; restored to HEAD) → `gradlew assembleRelease -PreactNativeArchitectures=x86_64` with Android Studio JBR, `EXPO_PUBLIC_SUPABASE_URL=http://localhost:58420`, `usesCleartextTraffic="true"` added to the generated manifest; BUILD SUCCESSFUL in 15 m 26 s, APK 65,152,325 B (`tmp/.../apk/p6-release.apk`, private). Generated `android/` and the temporary probe route were deleted afterwards; `git status` shows neither. |
| Environment | Fresh dedicated MuMu instance (Android 12, x86_64, deleted afterwards), same isolated stack. Docker Desktop's localhost port relay (wslrelay) stalled twice and made the app show "couldn't load your account setup"; restarting my containers/pointing the proxy at `localhost` restored it. Those stalls caused the first blank/"Try again" screens, not the app. |
| Identity (native, release) | Guest: All + Barangay cards only, no counts, no "Mark all as read", public announcements listed (plan §2.2 text says "Guest Account shows sign-in guidance"; the shipped Phase 3 behaviour hides Account/System for guests — recorded discrepancy, consistent with D21). Another resident (`rwfb-other`): All 86 = Barangay 83 + System 3 + Account 0, Account shows "No account notifications yet." — none of A's 40 events or read states visible. Incomplete profile (`rwfb-incomplete`): app opens in browse mode with a "Complete profile" banner; hub opens; counts are barangay/System only. Logout → login switching between three accounts: each saw only its own data. |
| F48 (resolved — harness) | Superseded by the third pass below. |

## Third pass — F48 root cause, R16 kit
| Item | Record |
|---|---|
| Environment | New MuMu instance with `resolution_mode=phone.3`, `window_auto_rotate=false` (the earlier default profile was a landscape tablet, which is why the launcher/Settings flipped orientation); same release APK (x86_64) then a rebuild with temporary `console.log` on the tap path (9 m 46 s). LDPlayer could not be used: its adb port forward is blocked while MuMu holds 127.0.0.1:5555. |
| F48 cause | (1) The probe route stayed on the stack as an empty screen: Back from the "blank" screen returned Home. (2) `am start -d '…?inbox=…&kind=…&id=…'` without device-side quoting cut the URI at the first `&`, so the scheduled notification carried only `{inbox, v:2}`; `pushInboxId` correctly returned null. Evidence: `P6TAP emit … {"inbox":…,"v":2}` / `P6TAP inboxId null`. |
| Native proof | Quoted link: `P6TAP emit DEFAULT {id, inbox, v:2, kind:'notice'}` → `inboxId ae632d1e…` → `settle open reachable true path /home`; the Announcements hub opened (screenshot `shots/tap2_result.png`). The temporary logging and probe were removed; `push-notifications.ts` / `notification-tap-handler.tsx` hashes equal the pre-edit backups. |
| F49 (fixed) | `announcements.tsx`: new `loadThenOpen` (fresh `AbortController` per attempt; a thrown error → `loadFailed` with a retry that re-runs the same fetch; a null row → `unavailable`). The three call sites (announcement deep link, notification deep link, announcement mirror from the list) use it; `fetchInboxItem`/`fetchAnnouncement` already threw on errors and returned null when missing, so no data-layer change. Fixture: `notification-hub-ui` scenario with `failTable='notification_inbox'` asserts the load-failure text, no "no longer available", and that the retry opens the item. Backup of the pre-change file: `tmp/.../backup/announcements.before-f49.tsx`. |
| Not demonstrated | Opening the row after the tap and the resulting `read_at`, and the cold-start tap: Docker Desktop's host-port relay (wslrelay vs the Docker backend listener) dropped connections on this machine even for the CLI's Kong on 54321; moving the proxy inside Docker and forwarding through the LAN IP did not stabilise it, and the Docker engine API itself stopped answering twice. Environment limit, not an app result. |
| R16 kit | `r16-kit/` (README, `up.sh`, `seed.sql`, `proxy.cjs`, `trigger.sh`, `send.mjs`). `seed.sql` was validated on a fresh clone (83 announcements, 124 inbox rows); `up.sh` through the containers step was exercised, the container start was interrupted by the Docker stall; `send.mjs`/`trigger.sh` were written but **not executed** (no token, no reliable Docker). The kit's safety rule: `send.mjs` refuses to run unless `push_tokens` holds exactly the tester's token. |
| Cleanup | Probe route, generated `android/`, my containers, forwarder and emulator removed; `package.json` scripts restored; the peer session's proxy on 58400 untouched. `notif_r16_20261028` database retained. |

## Verification (post-change; logs `logs/F*.log`)
| Check | Result |
|---|---|
| Android `tsc --noEmit` | exit 0 |
| Android `expo lint` | 0 errors, 1 warning = the pre-existing Health `useState` |
| Android `vitest run` | 37 files / 411 tests pass (entry 391; +20 from concurrent sessions' new tests, none in files I touched) |
| `notification-hub-ui`, `notification-tap-ui`, `home-presentation-ui`, `services-lists-ui` | pass |
| `services-tab-stability`, `resident-shell-lifecycle` | pass |
| `reports-announcements-ui` | **fails** at the 5 s "Large report 49" wait (line 109) in the final run and one rerun; fails identically with my two edits temporarily reverted (`F-reports-announcements-ui-without-edits.log`) → not caused by this phase. Another session is editing the Reports screens/this fixture (`tests/reports-announcements-ui.mjs` modified, `reports/[incidentId].tsx` mtime during the run). Earlier phases saw the same wait flake and pass on rerun; classified unrelated, **not baseline-proven**; owner to triage |

## Limits (not claimed)
No physical device, provider push, release/embedded build, hosted DB/worker or deployment. Native evidence is one MuMu dev-client instance on a disposable stack. No speed/size claim.
