# Phase 9 — DRRM Hub and Alerts

20 October 2026, Asia/Manila. **Partially complete: implementation and automated verification delivered; native/reference acceptance pending manual verification.** No later phase started.

## Scope and requirement results

| Requirement / files | Delivered behavior |
|---|---|
| Hub — `components/drrm/hub-content.tsx`, `emergency-accordion.tsx`, `hotline-row.tsx` | 26dp heading, 28dp section rhythm, external section headings, single divided guideline/hotline panels, 40dp rounded icon tiles, 44dp call control. Single `openIndex` retained. Actual managed content and first dial number preserved; malformed content renders safely, missing steps use stored body, unavailable numbers disable the call action. |
| Hub/Alerts source feedback — `components/drrm/presentation.tsx` | Existing hook offline/error/loading states exposed separately. Available cached rows remain visible on refresh errors; explicit retry calls existing refetch only. Offline badge reflects the hook state rather than claiming every response is offline. No hook/query/cache/subscription changes. |
| Alerts — `components/drrm/alerts-content.tsx`, `alert-date-picker.tsx`, `lib/emergency-alert-filter.ts` | Semantic red header, total count, horizontal period chips, divided alert rows, compact timestamp, expandable date wheels, draft/apply/clear and applied summary. Each month/day/year may be Any; manual numeric year entry retains the previous unrestricted range. Period and date remain combined. Impossible combinations yield empty results, without clamping or silently changing the selected date. |
| Motion — `components/drrm/disclosure.tsx` | Measured M06 height/opacity220ms with bezier(0.23,1,0.32,1); chevron200ms ease-out. Interruptions stop obsolete animation; equal layout measurements do not update state. Reduced motion uses immediate geometry/rotation. M11 native snap/smooth click scroll, nonanimated programmatic scrolling in reduced motion; no wheel settle timer or new clock. Closed content is excluded from touch/accessibility. Keyboard dismisses when the date panel closes/applies/clears. |
| Shared integration — existing Emergency Info route / `resident-theme.ts` | Reuses Phase2 measured underline control; route/provider/deep-link ownership retained. Only Hub/Alerts padding/entrance treatment changed. Added centralized orange call-fill/foreground/outline roles; no existing theme role changed. Centers controller/props and Scan/Family branches compare unchanged with the saved working copy. |

No dependencies, lockfile, assets, backend, migrations, public/auth screens, iOS, web or admin implementation changed. Replaced local Hub/Alerts rendering/styles/tooltip timer and bespoke tab measurement were removed after reuse of the existing primitives. New production files contain no sample records, credentials, debug logging, TODO stubs, `any`, suppressions or unbounded retry loops.

## Baseline and final verification

Full local logs and recovery files: [execution directory](../../../../tmp/resident-android-magicpatterns-phase-9-20261020/). [Context index](../../../../tmp/resident-android-magicpatterns-repomix/phase-09-drrm-hub-alerts.context.md) records discovery, packets, identities, reads, limitations and decisions. Commands ran from the Android app unless otherwise noted.

| Check | Baseline | Final |
|---|---|---|
| `npx tsc --noEmit` | Pass | **Pass**, exit0 |
| `npm run lint` | Pass, zero errors / two Health `import/no-duplicates` warnings | **Pass**, same two warnings; none introduced |
| `npx vitest run` | 23 files / 246 tests pass | **Pass**, 24 files / 253 tests; includes birthday-wheel and existing theme tests |
| Shared `npx vitest run src/schemas/announcement.test.ts` | 9 tests pass | **Pass**, 9 tests |
| Android Hermes export | Initial sandbox temp-write failure; corrected workspace TEMP/TMP export **passes** | **Pass**, workspace TEMP/TMP, exit0 |
| `node apps/resident-android-mobile/tests/drrm-hub-alerts-ui.mjs` from root | New fixture; no prior test result claimed | **Pass**, seven groups, zero console warnings/errors |
| Owned diff / whitespace / preservation | Dirty working copy saved before edits | **Pass**: unrelated tracked patch identical; all35 supplied source identities unchanged except the three intended presentation files. Owned central theme diff contains two added token lines only. |

Hermes: **8,279,759 → 8,289,846 bytes**, +10,087 bytes (~0.122%). Export assets remain identical by relative filename and SHA256; no dependency/asset growth. Export proves bundling, not native runtime behavior. Toolchain FORCE_COLOR/NO_COLOR and Hermes undeclared-runtime-global warnings existed in the baseline export; no suppression was added.

The new filter tests compare 14,700 combinations against an independent copy of the old predicate, plus exact rolling lower boundaries, future-date behavior, partial leap dates, impossible combinations and arbitrary years. Last Week/Month/Year remain lower bounds of7/30/365 days using local `Date.setDate`; existing future-date inclusion is retained. No fixed prototype today, clock timer, birth-date constraint or2027 limit is introduced.

The fixture runs actual components, theme/text/button primitives and reduced-motion hook with native API adapters and synthetic records; it never opens a dialer, connects to services or places calls. It covers managed steps/body fallback, unknown icon/JSON boundaries, absent numbers, rejected dialer launch, duplicate-call lock, source error/offline/retry/loading/empty states, one-open/rapid accordion behavior, date drafts/apply/clear/partial/period combinations, wheel callbacks, reduced geometry, five toggle cycles,320/360/400/412 widths, dark/extreme custom accent/serif and listener cleanup. Saved images are **component fixtures**, not Android screenshots or proof of exact fonts/icons. Test adapters translate Android accessibility state, momentum-scroll events and font mapping to web equivalents. Initial fixture failures were missing shared export, incomplete selected-state adapter and absent native momentum event translation; logs retained, assertions preserved. Later capture corrections add actual themed surface and wait for settled collapse. The final run is `logs/ui-settled-final.log` / `ui/results.json`.

## Acceptance matrix

| Phase 9 acceptance criterion | Status and evidence |
|---|---|
| Managed/offline content and calls remain | **Pending manual verification.** Source identities and fixture preservation/error/call-dispatch checks met. Real managed refresh, cold cached/seed fallback, device dialer/cancel and network transitions not qualified. No real call placed. |
| Period / partial / exact filters match current predicates | **Met** in source, unit oracle and component fixture. Native wheel/keyboard/Back interaction remains pending below. |
| Accessible wheel/date controls retain prior range | **Pending manual verification.** Any/partial range, unrestricted year entry, labels/adjustable actions,44dp minimum rows and hidden-panel semantics implemented; fixture passes scroll/filter/layout and reduced-motion behavior. Actual TalkBack/focus return/native snap/font-scale behavior needs device evidence. |
| No new clock/date business rules | **Met.** Same predicates, local timezone/date comparisons and refresh ownership; no clock or range cap. |
| Reference Hub11 / Alerts16 hierarchy and M06/M11 | **Pending manual verification.** Retained v32 source and captured samples inspected; static fixture structure reviewed. No current live version/native screenshot pair, timing/profile, native resource or smoothness qualification. |

## Reference, adaptations and discrepancies

Reference retained v32 / artifact `df178e1c-7b6e-4d98-8334-06f3a00f28c3`: HubTab, GuidelinesAccordion, HotlinesList, AlertsTab, DateWheelPicker, WheelColumn and Tailwind token source read;07/14 contact sheets visually inspected. Computer Use initially found Brave/MuMu windows, then stopped because it could not confidently determine Brave's URL. No further desktop input was issued. A read-only Android SDK ADB device inventory could not connect/start its daemon in the sandbox; no device input or permission/settings changes followed. Existing historical native evidence is not a pass for this candidate.

- Explicit current request supersedes historical planning-only/stop-before-9 text. Empty root AGENTS and delegating CLAUDE preserved; no nested applicable instructions or repository/plan conflict found. Phase2 implementation verified; predecessor native gates remain open.
- Source reference places headings outside each divided group; this resolves the old double-border/nested cards. Hub title uses resident text rather than accent. Icons retain managed hues through readable mode-aware tints; invalid glyphs use a verified Ionicons fallback. White managed glyphs derive hue from their stored background. Exact Lucide/Figtree shapes/fonts remain the existing native adaptation.
- Any per date column and manual arbitrary-year field intentionally differ from the prototype's whole-date2024–2027 wheel. Year suggestions derive only from loaded alert dates and the typed value; they do not cap the entered year. Days1–31 remain independent of month/year. Apply/Clear changes presentation state only; period is never reset by date controls. These preserve prior filtering capabilities.
- Native44dp wheel rows grow with font scale instead of source40px rows. Manual year field and Any guidance add height for retained functionality. Long headings/timestamps wrap; no critical field truncation is required to match the prototype.
- Call fill uses source orange`#E8930C` through shared theme roles, with contrast-derived dark foreground and outline where required; reference white glyph is adapted for contrast. Offline badges are truthful hook states, not permanently displayed source decorations. Existing seed content and30-minute cache policy remain untouched.
- The Maps hotline/preparedness placeholder routes pre-exist and are preserved; they are not Hub/Alerts implementations and no new directory screens are authorized. Existing hook async seed-timer cleanup and alert retry/unmount ownership concerns remain out of scope and unchanged.

Docs checked: [Expo57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/), [Expo57 Reanimated4.5.1](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), [React Native0.86 ScrollView](https://reactnative.dev/docs/0.86/scrollview), [Animated](https://reactnative.dev/docs/0.86/animated), [Linking](https://reactnative.dev/docs/0.86/linking), [Reanimated4 timing](https://docs.swmansion.com/react-native-reanimated/docs/animations/withTiming/). Final review additionally checked SDK57 SafeAreaContext and React effects guidance. React publishes docs by major, not minor/patch ([version policy](https://react.dev/versions)); installed React remains19.2.3. Installed Expo57.0.10, Router57.0.10, RN0.86.2 and Reanimated4.5.1 verified directly. No API from a newer SDK was adopted.

## Exact remaining native checks

1. Use the existing safe guest/test-account development build and the repository's dev-client workflow; load this candidate. Record package/build, serial, density/font scale/refresh rate. Capture Hub and Alerts at320/360/400–412dp and short-height/keyboard, Light/Dark, default/blue/warm/extreme custom accents, available fonts and1.3/1.5 font scale. Pair Hub closed/open and Alerts collapsed/open/applied/empty with retained v32 source/capture geometry; recheck live v32 before claiming current-reference fidelity.
2. Verify each managed section's loading, true empty, failure/retry and available offline content. Disconnect only through an owner-controlled safe fixture; verify warm/cold cache and existing seed fallback without editing shared cache policy. Tap a **synthetic/non-emergency test hotline** only, verify dialer number and cancel before any call; simulate missing dialer/rejection. Do not call an emergency number.
3. For each period, verify Any, month-only, day-only, year-only and exact combinations, February29 across leap/non-leap years, month-end31 with a shorter month, arbitrary old/future years, collapse/discard draft, Apply and Clear while retaining period. Test slow/fast wheel flicks, click-scroll, TalkBack increment/decrement/value announcements, focused year field and keyboard/Android Back; date close must dismiss keyboard and leave reachable controls.
4. Record normal/reduced M06 and M11 on this candidate; five rapid open/close/reselect cycles, two background/foreground cycles and route/alias return. Confirm no hidden touch target or stale scroll selection. Profile ten transitions on the same configuration and compare native frame budget, memory, listeners/channels/request counts to baseline. Record console/server logs. No repeated real submissions/calls are needed. No native timing/performance claim is made until these pass.

No commit, push, deployment, remote database/service change or external message occurred. No further user decision is needed to review the prepared diff; native acceptance is the outstanding verification work.
