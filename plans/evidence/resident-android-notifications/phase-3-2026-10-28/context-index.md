# Phase 3 context supplement and verification — 2026-10-28

Extends the [phase-0](../phase-0-2026-10-28/context-index.md), [phase-1](../phase-1-2026-10-28/context-index.md) and [phase-2](../phase-2-2026-10-28/context-index.md) supplements. Shared rules: plan §3. Raw logs (private, not committed): `tmp/resident-notifications-phase3-20261028/logs/`.

## Checklist
| Item | Record |
|---|---|
| Scope | Android data integration + four-section screen against phase-1 APIs and phase-2 event shapes. No worker, DB, tap-routing (phase 4) or native work. |
| Prerequisites | Phases 0–2 Verified; 0145/0146 contracts re-read in source (`notification_hub_summary`, `notification_inbox_page`, `notification_mark_scope_read` signatures, scope rules, `system_notices` column grant). Not re-run against a DB: the app fixture mirrors the scope rules in JS (see limits). |
| Context inputs | Direct source reads (no Repomix packet: the phase touches ~15 Android files whose bodies were read in full; a packet would only duplicate reads). Repowise not used. |
| Instructions | Root `AGENTS.md` empty; nested ones cover only admin-web/resident-web. No conflict. |
| Git baseline | HEAD `9fe8add1`; 580 status entries at entry (user/concurrent work). Pre-edit copies of `announcements.tsx`, `resident-header.tsx`, `notification-bell.tsx`, `use-unread-counts.tsx`, both fixtures, the plan, and the two deleted files + status/unstaged patch: `tmp/resident-notifications-phase3-20261028/before/`. User-dirty files not edited: header (`b14524ea…` unchanged), requests-list, services, health, `use-history-pages.ts`, shell-lifecycle fixture. |

## Baseline (before edits, single runs)
tsc 0 errors; lint 0 errors / 1 pre-existing warning (`health-presentation.tsx` `useState`); vitest 32 files / 335 tests; `resident-shell-lifecycle`, `services-tab-stability` pass; `reports-announcements-ui` **fails at the picker-duration assertion (D19, pre-existing)**; `resident-search-explore|session|submit` fail to launch (Playwright headless shell missing — environment, unrelated).

## Findings and decisions
| ID | Finding / decision |
|---|---|
| F35 | `RefreshResource` loads only when asked (`refresh`/`invalidate`); a resource without a list hook needs an explicit initial `refresh`. Caught by the fixture ("Checking unread…" forever). |
| F36 | `FlatList` `stickyHeaderIndices` counts the `ListHeaderComponent` cell as index 0 (`VirtualizedList.js:582,802`), so the chips row (first data item) is index 1. |
| F37 | react-native-web ignores `accessibilityState`; the fixture adapts `selected/expanded/busy` to `aria-*` in its `Pressable` mock (adapter only). |
| D28 | One state object `{view, chip}` so a card switch resets the chip atomically (an invalid pair such as account/general is rejected by the server). |
| D29 | `announcementsUnreadCount` keeps its name and now means the whole hub (barangay + Account + System, `notification_hub_summary('all','all')`), so header/bell/Home/search consumers and their fixtures need no change. Provider gained a `notification_inbox` realtime channel (4th channel) and `markHubScopeRead` / `markInboxRead`; `markAnnouncementsRead` (client-id upsert) removed — it had one caller. |
| D30 | First inbox page also reads the scope total via the summary RPC (`HistoryResource` requires a total); a failed count falls back to rows loaded and never hides rows. Cost: 1 extra summary call per source on a first-page load. |
| D31 | Deep links `announcementId` / `notificationId` resolve against the owner's data (not loaded pages); foreign/missing → "This item is no longer available." Phase 4 wires pushes to `notificationId`. |
| D32 | Old `announcements-feed.tsx` and `use-announcements.ts` deleted (no importer; only comments referenced them — evidence: rg over src/tests/scripts, tsc, bundle export). `AnnouncementModal` untouched; `AnnouncementCard` now composes the shared `HubRow`. |
| D33 | `historyBefore` accepts `published_at` (keyset for announcements). |
| Fixture | `tests/reports-announcements-ui.mjs`: news-screen assertions moved to the new hub fixture; hub-summary RPC stub; channel counts 4→5 / 3→4 (inbox channel); rpc-count assertions ignore the hub summary; picker durations corrected to the committed hook (340/220 slide, 200 scrim) — drift fix per D19, hook unchanged. |

## Files (owned) and identity (SHA-256, first 12)
`src/app/(app)/announcements.tsx` 7a1bb4a5e49a (rewritten) · `src/hooks/use-notification-hub.ts` (new) · `src/lib/notification-hub-data.ts` (new) · `src/lib/notification-hub.ts` + test (extended; sources, counts, destination→open allowlist) · `src/components/notifications/{hub-cards,hub-row,notification-row,notification-detail-sheet}.tsx` (new) · `src/components/reports/announcement-card.tsx` (thin wrapper) · `src/hooks/use-unread-counts.tsx` dec8312f5b34 · `src/lib/history-resource.ts` (1 line) · `src/components/pull-refresh.tsx` (stale comment) · `tests/notification-hub-ui.mjs` (new), `tests/reports-announcements-ui.mjs`. Deleted: `use-announcements.ts`, `announcements-feed.tsx` (copies in `before/deleted/`). No dependency added.

## Verification (after edits)
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors (also after the deletions) |
| `npx expo lint` | 0 errors, 1 warning = the pre-existing Health one; my two exhaustive-deps warnings were fixed |
| `npx vitest run` | 33 files / 357 tests passed (baseline 32 / 335; +22 in `notification-hub.test.ts`) |
| `node tests/notification-hub-ui.mjs` | passed, 16 scenarios, no new console diagnostics (one known RNW `shadow*` deprecation) |
| `node tests/reports-announcements-ui.mjs` | passed (was failing at baseline). One run failed on a 5 s virtualized-list wait (1003-row check) and passed on rerun with no code change → recorded as timing flake |
| shell-lifecycle, services-tab-stability, services-lists, request-tracking-navigation, tracking-payment | pass |
| `pull-refresh-settings-ui` | fails: fixture `expo-router` mock lacks `usePathname` needed by `use-floating-tab-layout.tsx` (reached via `location-verification.tsx`); the fixture references none of this phase's files → unrelated, not in the phase-0 baseline set |
| `CI=1 npx expo export --platform android` | exit 0, one 8.5 MB hbc bundle |

## Limits (not claimed)
Fixture transport is a JS mirror of the 0145 scope rules, not the real database: real-API behaviour stays an I1 regression (phase 5 I2 runs the isolated contracts end to end). Not covered: native gestures/TalkBack/large text/safe areas (I3, R12), offline/reconnect, physical push (phase 4/6), `resident-search-*` fixtures (environment launch failure), measured latency/bundle comparison (R14 metrics: no before/after numbers recorded; only structural limits — ≤25 rows/source/page, one list owner, one hub realtime channel — were asserted).
