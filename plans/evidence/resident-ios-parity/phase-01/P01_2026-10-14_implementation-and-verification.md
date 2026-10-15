# P01 implementation and verification record — 2026-10-14

**Tasks:** P01-T01 … P01-T07. **Requirements:** A01-001…036, A50 (Phase 1-primary rows), R01/R02/R03/R06/R13/R17/R18/R21/R30/R36/R38, IR01; D01; G02/G14/G22 foundation contributions; F01/F08/F12 (device portions pending).
**Source revision:** uncommitted (base `2e5681c`). **Native build:** none — no signed build could be produced (see Blockers). **Backend/environment:** hosted project from `apps/resident-ios-mobile/.env` (read-only HEAD query-shape checks only). **Owner / reviewer:** KingJaqar (OD-01); review pending.

Nothing below is device evidence. Every checkpoint is at most `implemented-unverified` until the signed-build/device steps in [P01-T07_2026-10-14_device-qualification-protocol.md](P01-T07_2026-10-14_device-qualification-protocol.md) pass.

## 1. Baseline before editing (same session)

| Check | Result |
|---|---|
| `npm run typecheck` (iOS) | exit 0 |
| `npm run lint` (iOS) | exit 0 |
| `npm test` (iOS) | 8/8 passed |
| `npx expo export --platform ios` | exit 0 (3.7 MB Hermes bundle) |
| `npm run check:release` | exit 1 — missing `IOS_BUNDLE_IDENTIFIER`, `IOS_URL_SCHEME`, `EAS_PROJECT_ID`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BARANGAY_ID`; all 13 release gates closed (expected, pre-existing) |
| `npx expo install --check` | exit 1 — patch drift: `@expo/ui` 57.0.9→~57.0.23, `expo` 57.0.10→~57.0.28, `expo-crypto` 57.0.3→~57.0.4, `expo-router` 57.0.10→~57.0.26, `expo-splash-screen` 57.0.5→~57.0.10, `react-native` 0.86.2→0.86.3, `eslint-config-expo` 57.0.1→~57.0.2 (pre-existing) |

## 2. What changed (by task)

### P01-T01 — SDK 57 workspace qualification
- Read: SDK 57 Native tabs, Splash screen, Protected routes guide, Native tabs guide, EAS `eas.json` reference; `ExpoConfig` types (`ios.deploymentTarget`, `ios.infoPlist`) and installed `react-native-screens` 4.26.2 source (`RNSTabBarController.mm`: UIKit More navigation controller handled for ≥ 6 tabs, More's own navigation bar disabled for nested stacks).
- Installed versions (hoisted, shared with Android): expo 57.0.10, expo-router 57.0.10, react-native 0.86.2, React 19.2.3, react-native-screens 4.26.2. Local Node v24.13.1 (engines `>=22.13.0`). `ExpoModulesCore.podspec` declares iOS 16.4.
- `app.config.ts`: `ios.deploymentTarget: '16.4'` pinned; ATS hardened (`NSAllowsArbitraryLoads: false`, `NSAllowsLocalNetworking: true` for dev-client LAN access). Verified with `npx expo config --type introspect` (introspection previously showed a blanket `NSAllowsArbitraryLoads: true`).
- Added `expo-dev-client ~57.0.20` (required by the development build profiles). Root lockfile change is additive only: `expo-dev-client`, `expo-dev-launcher`, `expo-dev-menu` under the iOS workspace; no other package entry changed (semantic diff against a pre-install snapshot). The user's pre-existing lockfile/Android edits were preserved.
- **Not upgraded:** the SDK patch drift above. Those packages are hoisted and shared with `apps/resident-android-mobile`; upgrading would change the Android build. Owner decision recorded as open item P01-D04.
- Xcode 26.4+ qualification: not possible on this Windows host (PR-05).

### P01-T02 — Identity, schemes, EAS profiles
- New `apps/resident-ios-mobile/eas.json`: `simulator` (dev client, iOS simulator), `development` (dev client, internal device), `device` (internal release-config), `staging` (internal, EAS `preview` environment), `production` (store, `autoIncrement`); `appVersionSource: remote`; each profile sets `EXPO_PUBLIC_ENVIRONMENT`. No OTA channel (plan C.4: OTA disabled for first production release).
- Bundle ID, URL scheme, EAS project ID and Supabase/tenant values stay owner-supplied environment variables (`app.config.ts`, `.env.example`). Nothing invented. **Blocked:** PR-02, PR-03, PR-04.

### P01-T03 — Six native destinations
- `src/app/(tabs)/_layout.tsx`: six statically declared `NativeTabs` triggers in the approved order Home / Services / Maps / Health / Reports / Settings, SF Symbol outline→filled pairs, token tint. On iPhone UIKit shows four destinations plus **More** (Reports, Settings inside More).
- Settings moved into the tab group (`src/app/(tabs)/settings/*`, git renames) — it is now a full destination with its own stack; `/settings` URLs unchanged. Profile moved to `/settings/profile`.
- Each destination has a nested native stack via `ResidentStack` with declared child titles (`Service details`, `Medical drive`, `Announcement`, `Concern details`, `My profile`, `Change password`, `Help`, `Help article`, `Resident information`), large titles on roots, token header tint/background, and a supplemental **Settings** toolbar link on the five non-Settings roots.
- Reports badge: one system badge = unread resolved reports + unread announcements; hidden at zero; `99+` cap. Active reports are a separate labeled counter. Counts come from `ReportCountsProvider` mounted beside the tabs (stays live on every destination): four server-side `count=exact, head=true` queries, realtime refresh signals on `incidents`/`announcements`/`announcement_reads` coalesced (300 ms), foreground refresh, abort on supersede, channel/listener/timer cleanup, last confirmed counts kept on failure (never a false zero). Reports root shows the three labeled counters with a stale/refresh state.
- Duplicate in-content headings removed where the native header now carries the title.

### P01-T04 — Bootstrap, guards, typed destinations
- Splash: `preventAutoHideAsync()` at module scope; iOS fade (300 ms); hidden on the first authoritative state (navigator ready, restoration error, configuration error, error boundary) or after 3 s, when an in-app "Restoring your session…" state takes over.
- Restoration failure: "Session not restored" + **Retry session restoration** + **Sign out on this device** (destructive confirmation).
- Every root route is now declared in the root stack and all except `index`/`recovery` sit inside the `Stack.Protected guard={!recovery}` block (previously `emergency`, `requests`, `request/[id]`, `services/request/[id]` and `health/register/[id]` were undeclared and therefore outside the recovery guard). Enforced by `tests/navigation.test.ts`.
- Private routes (`settings/profile`, `settings/change-password`, `requests`, `request/[id]`, `services/request/[id]`, `health/register/[id]`) use one guard, `RequireResident`, which keeps the resident in place with an explained sign-in path instead of mixed redirects.
- Typed record routes: `/reports/announcements/[announcementId]` (IR01) and `/reports/incidents/[incidentId]` (R18; visibly incomplete "Concern details" until Phase 12; malformed IDs show "Concern not found"). Aliases: `/reports/[id]` → announcement route only (OD-02 rule 1; malformed → "Link not recognized"), `/profile` → `/settings/profile`.
- Fonts: no bundled font is used by any current iOS screen (system typography per handoff §5). Android's only bundled font, GideonRoman, is used by its authenticated scan view (Phase 15); font preference IDs are Phase 6 (PR-19). No font gate was added because there is nothing to load.

### P01-T05 — Tokens and primitives
- `src/lib/theme.ts`: handoff §5 semantic colors (light/dark), type scale, spacing, radius, layout tokens.
- `src/components/ui.tsx` (extended, no second framework): tokenized `Action` (primary/secondary/destructive, ≥50 pt, pressed feedback, disabled state; replaced the SwiftUI button because its label colour cannot be set and white on dark `primary` fails contrast), `Field` (required marker, adjacent announced error, password Show/Hide, numeric Done), `Selector` + `Sheet` (native page sheet, labelled Close, swipe dismissal, checkmark on selected option), `StatusBadge` (icon + label), `Skeleton` (after 250 ms, hidden from VoiceOver), `EmptyState`, `ErrorState` (Try again), `Loading`, `Notice` (VoiceOver announcement), `confirmDestructive` (named final action), `useDiscardGuard` (back/swipe/stack-replacement protection).
- Applied: profile (field errors, employment `Selector`, discard guard), change password (field errors, visibility toggles, discard guard), request form (discard guard; navigation only after the committed result), request cancellation (confirmation), request list/detail (`RequestStatus` badge, monospaced reference, `formatDateTime`), announcements (relative timestamps), list empty/filtered-empty/error/skeleton states, not-found states with a return path.

### P01-T06 / P01-T07
- Capability matrix prepared: [P01-T06_2026-10-14_native-capability-matrix.md](P01-T06_2026-10-14_native-capability-matrix.md). No spike executed — needs a signed build.
- Device protocol prepared: [P01-T07_2026-10-14_device-qualification-protocol.md](P01-T07_2026-10-14_device-qualification-protocol.md). Not executed.

## 3. Verification after the change

| Check | Result vs baseline |
|---|---|
| `npm run typecheck` | exit 0 (same) |
| `npm run lint` | exit 0, no warnings (same) |
| `npm test` | 13/13 passed (8 baseline + 5 new: `tests/format.test.ts`, `tests/navigation.test.ts`) |
| `npx expo export --platform ios` | exit 0, 1,469 modules bundled |
| `npx expo config --type introspect` | ATS hardened, `deploymentTarget` 16.4, portrait orientations, dev-client local-network purpose string; no camera/location/photos keys (no such capability installed yet) |
| `npm run check:release` | exit 1, identical missing-config/closed-gate output (expected) |
| `npx expo install --check` | exit 1, identical patch drift (pre-existing; P01-D04) |
| Report-count query shapes (HEAD, public key, nil UUIDs, read-only) | all four return HTTP 200 with `Content-Range */0`; a deliberately misspelled embed returns HTTP 400, so the check discriminates |
| Typed routes regenerated | `.expo/types/router.d.ts` lists the six destinations, both typed Reports routes and the aliases |

Not run: any simulator/device build, VoiceOver, Dynamic Type, More overflow, deep-link, or realtime-on-device check (Windows host, no signing — PR-02/04/05). The app also cannot start against the configured backend until PR-18 supplies `EXPO_PUBLIC_BARANGAY_ID`/`EXPO_PUBLIC_ENVIRONMENT`.

## 4. Checkpoint status (Phase 1-primary rows)

| Checkpoints | Status | Locator / note |
|---|---|---|
| A01-001, A01-002 | implemented-unverified | `src/app/_layout.tsx` splash hold + iOS fade (adaptation of Android animated overlay) |
| A01-003 | planned (no Phase 1 consumer) | No bundled font used by current iOS screens; GideonRoman → P15, font IDs → P06 (PR-19) |
| A01-004 … A01-007 | implemented-unverified | `src/lib/runtime.tsx` (unchanged restore), `RestorationState` in `src/app/_layout.tsx` |
| A01-008 … A01-010, A01-012 | implemented-unverified | root redirect `/home`; guest public browsing; `RequireResident`; recovery guard covers all root routes |
| A01-011, A01-013 … A01-015 | blocked → P04 | account-setup routing and OAuth callback need Phase 4 contracts and PR-03 scheme |
| A01-016 … A01-027 | implemented-unverified | `src/app/(tabs)/_layout.tsx`; selection highlight/animation/pressed feedback are native UIKit |
| A01-028 … A01-033 | implemented-unverified | `src/data/report-counts.tsx`, Reports badge, `ReportSignals` in `src/app/(tabs)/reports/index.tsx` |
| A01-034, A01-036 | implemented-unverified | native stack back/swipe + `useDiscardGuard`; `contentInsetAdjustmentBehavior="automatic"` |
| A01-035 | partial | typed record routes exist; subsection query contracts (`/services?segment=`, `/reports?tab=`, `/emergency?tab=`) are delivered by P09/P11/P13 |
| A50-001 … A50-004, A50-016 | implemented-unverified | `Field` |
| A50-007 | implemented-unverified | `StatusBadge`, `RequestStatus` |
| A50-010, A50-011, A50-013 … A50-015 | implemented-unverified | `Loading`, `Skeleton`, `EmptyState`, not-found states, `ErrorState` |
| A50-019 … A50-021 | implemented-unverified | `confirmDestructive`, disabled-while-busy actions, pressed opacity |
| A50-026 … A50-028 | implemented-unverified | `Sheet` Close + swipe dismissal; `useDiscardGuard` (iOS equivalent of guarded back) |
| A50-029 … A50-032 | implemented-unverified | ≥44 pt targets, labels/roles/states, `AccessibilityInfo.announceForAccessibility` |
| A50-034 … A50-036 | implemented-unverified | shared `formatCentavosAsPHP`/`formatDateTime`; `formatRelativeTime` (`src/lib/format.ts`) |

## 5. Decisions made in this phase

| ID | Decision | Reason |
|---|---|---|
| P01-D01 | Feature-owned root routes (`emergency`, `requests`, `request/[id]`, `services/request/[id]`, `health/register/[id]`, `(tabs)/health/[id]`, `(tabs)/services/[id]`) keep their current paths; they now have titles and recovery protection. Their canonical moves (R08/R05/R28/R29/IR08/IR10) happen in P08/P09/P13/P16 with aliases. | Moving them now would create non-canonical paths (e.g. a `/services/requests` list) before their owning phase defines the segment contract. |
| P01-D02 | `Action` is a tokenized `Pressable`, not the `@expo/ui` SwiftUI button. | The universal button exposes no label colour; white on dark `primary` (#35C7A0) fails contrast, while `onPrimary` (#06251D) passes (handoff §5). |
| P01-D03 | Private routes render an in-place "Sign in required" state; no pending destination is stored yet. | Handoff/OD-02 rule 4 allow only an allowlisted pending destination; that state machine belongs to Phase 4. |
| P01-D04 | Shared SDK 57 patch drift is not upgraded in Phase 1. | Packages are hoisted and shared with Android; upgrade changes the Android build. Owner decision needed before the signed build. |
| P01-D05 | `/reports/[id]` aliases to the announcement route only (OD-02 rule 1). | If the owner later chooses the Android scheme `barangayan` for iOS (PR-03), Android `/reports/<incidentId>` links collide with this alias; resolve the collision before enabling that scheme. |
| P01-D06 | Tab reselection keeps the native default (pop to root, scroll to top); forms rely on `useDiscardGuard`. Whether a native tab-reselect pop honours the guard must be proven on device (T07 step 6). | Documented reselect behaviour required by handoff §1. |

## 6. Blockers and remaining work

- **PR-05** (macOS/Xcode 26.4+ or EAS cloud build, device matrix), **PR-02** (Apple team, bundle ID, capabilities, provisioning), **PR-04** (EAS project/owner), **PR-03** (iOS scheme/callback), **PR-18** (development tenant ID/environment) — block the signed development build, P01-T06 spikes and P01-T07 device qualification, and therefore the Phase 1 exit.
- P01-D04 owner decision on SDK patch alignment.
- Out of scope, noted only: `profile.birth_date` null defaults to 2000-01-01 in the profile editor (pre-existing; P05); `.expo/types` is regenerated only by `expo start` (generation also appends `expo-env.d.ts` to `.gitignore` — reverted here because the file is tracked).
