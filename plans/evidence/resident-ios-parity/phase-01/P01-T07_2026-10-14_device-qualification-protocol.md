# P01-T07 device qualification protocol — 2026-10-14

**Status: Pending manual verification (blocked).** Requires a signed SDK 57 development build (`eas build --profile development --platform ios` or a local Xcode 26.4+ build) and devices covering iOS 16.4 and the current iOS on a compact and a large iPhone (PR-02, PR-04, PR-05), plus a development `.env`/EAS environment with `EXPO_PUBLIC_BARANGAY_ID` and `EXPO_PUBLIC_ENVIRONMENT` (PR-18). Record each run as `phase-01/P01-T07_<date>_<device>-<ios>.md` with build name `ios-development-<version>(<build>)`, source SHA, device/OS, tenant fixture and pass/fail per step. Use sanitized fixture accounts only.

Pass requires every step on every device in the matrix. A failure of steps 1–5 means the approved six-destination/More navigation is not qualified: record a blocker and resolve it explicitly with the owner — do not switch to a custom tab bar (plan §2, P01-T07).

| # | Step | Expected result | Requirement IDs |
|---|---|---|---|
| 1 | Cold launch signed out with network | Barangayan splash, fade, Home. Tab bar shows Home, Services, Maps, Health, More; More lists Reports and Settings with icons/labels | A01-001/002/016–024, R02 |
| 2 | Tap each visible tab, then More → Reports, More → Settings | Selected item highlighted, outline→filled icon; Reports/Settings open with large titles, the More list's own bar hidden, back returns to the More list | A01-024–027, R17/R30 |
| 3 | In Reports (inside More) open an announcement, switch to Home, return to More | Announcement detail still on top of the Reports stack (state retained) | A01-034, handoff §1 |
| 4 | Signed in with unread announcements/resolved reports | More tab and the Reports row show the badge = unread resolved + unread announcements; Reports shows all three labeled counters; badge hidden at zero | A01-028–033 |
| 5 | Mark an announcement read; from another device/admin publish a new announcement while on Health | Badge and counters update without visiting Reports | A01-033 |
| 6 | Settings → Edit profile, change a field, then (a) swipe back, (b) tap Back, (c) reselect the Settings tab | (a)/(b) "Discard changes?" alert with Keep editing / Discard changes. (c) record whether the native reselect pop is intercepted; if not, record as a P01 defect against P01-D06 | A50-028, handoff §1 reselect rule |
| 7 | Reselect Home while scrolled | Scrolls to top / pops to root | handoff §7 Home |
| 8 | Toolbar "Settings" link on each non-Settings root | Opens the Settings destination | P01-T03 |
| 9 | Signed out: open Settings → Edit profile path via `/profile` and `/settings/profile` links, and `/requests` | "Sign in required" state in place with a sign-in link; no private data requested | A01-009/010, F01 |
| 10 | Deep links (once PR-03 fixes the scheme): `/reports/<announcement uuid>`, `/reports/announcements/<uuid>`, `/reports/incidents/<uuid>`, `/reports/not-a-uuid`, `/reports/incidents/not-a-uuid`, `/profile` | Announcement route; incident placeholder (visibly incomplete); "Link not recognized"/"Concern not found" with Back to Reports; profile redirect. Warm and cold start | IR01, R18, OD-02 rules 1–4, F01 |
| 11 | Airplane mode, cold launch with a stored session | Splash lifts after ≈3 s to "Restoring your session…" or "Session not restored" with Retry / Sign out on this device; Retry after reconnect restores | A01-005–007, F07 |
| 12 | Password-recovery state active, then open each root link from step 10 | Only the recovery screen is reachable | A01-012 |
| 13 | Background 10 min, foreground | Session revalidated; counts refreshed; no duplicate subscriptions (watch Supabase realtime connections) | A51, F07 |
| 14 | Largest accessibility Dynamic Type; VoiceOver on tab bar, More list, Reports counters, Field errors, Selector sheet, Sign out | No clipped essential text; buttons wrap; counters read "Active reports: N"; errors announced; Selector reads label/value; sheet Close reachable | G22, A50-029–032, F12 |
| 15 | Reduce Motion and Dark Mode | Splash fade acceptable; dark tokens applied; primary buttons readable (onPrimary on primary) | G22, D01 |
| 16 | Request cancellation on a cancellable request | Destructive confirmation names "Cancel request"; Cancel leaves the request unchanged | A50-019 |
