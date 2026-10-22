# Phase 4 — Home evidence

19 October 2026, Asia/Manila. Implementation delivered; phase **Partially complete** because comprehensive native acceptance remains pending. No Phase 5 work, new dependency, backend/schema/auth change or external mutation.

## Baseline, context and ownership

HEAD: 187a2ab331dd6dce1cfa54d397fc245d1232a9a0. Root AGENTS is an empty user change, CLAUDE references it; no further applicable instructions/conflict found. Phases 1–3 implementations were checked in current originals; their pending native gates were not upgraded. Historical planning-only prose does not describe this execution request.

[Recoverable snapshots/status/patches](../../../../tmp/resident-android-magicpatterns-phase-4-20261019/) preserve the actual working copy before edits. [Audit](../../../../tmp/resident-android-magicpatterns-phase-4-20261019/audit.json) records eleven Phase 4 source/test paths, seven new, forty unchanged read-only packet inputs, unchanged lockfile, ten unchanged unrelated patch sections and eight independently changed sections. Services, header, tabs, document icon mapping and custom icon assets changed concurrently. Home's DocumentIcon, ServicesTabIcon and DrrmTabIcon integrations belong to that concurrent work and were retained. Combined patches include those Home hunks: use the [three-way rollback instructions](../../../../tmp/resident-android-magicpatterns-phase-4-20261019/ROLLBACK.md), never blindly reverse them or restore HEAD.

[Context index](../../../../tmp/resident-android-magicpatterns-repomix/phase-04-home.context.md) records pinned Repomix 1.18.1 selectors, exclusions, source hashes, bounded extraction counts and version documentation. Before/final source XML: 44/55 files, 13,122/14,867 artifact tokens, security clean and parsable. Original bodies resolve compression gaps. Before packets are historical; final source and guidance are current only for their recorded hashes.

## Requirements and adaptations

| Requirement | Initial state | Result |
|---|---|---|
| Existing data/actions/guest/profile | Done | Latest three resident requests and one public announcement; five quick destinations, login/profile banner, announcement deep-open and detailed tracking preserved. No new channel/query. |
| Identity/greeting/tiles | Partial | 36dp identity/location, first-name time greeting 28/800, five 56dp semantic tiles; account font/accent/light/dark and readable foregrounds retained. |
| Request shelf | Not started | 244dp cards, four payment-aware stages, measured native snap and boundary controls. Latest results can include terminal requests, so subtitle says recent requests. |
| Announcement shelf | Partial | Actual single 232dp card has no overflow controls. Existing optional image is retained with visible unavailable feedback; body opens existing feed detail. |
| Summary/full tracking | Not started | Validated loaded history/creation date only; unavailable dates and cancelled/unknown status explicit. Close first, then existing full-tracking destination. No fabricated category/estimate. |
| Reachable states/lifecycle | Partial | Loading, empty, guest, independent database/transport errors/retries, stale-account isolation, focus/background/unmount cleanup. Long summary scrolls between fixed Close/footer controls. |
| M04/M11/M12 | Partial/not started | Panel/scrim 280/200ms, reduced <=100ms opacity; native snap/200ms edge fade; 150ms press feedback, tiles .95/cards .98. Configured timings and fixture results are not native motion certification. |

Reference: live Brave v32 iframe artifact df178e1c-7b6e-4d98-8334-06f3a00f28c3 and matching retained HomeHeader/QuickAccessGrid/RequestCard/RequestSheet/HorizontalScroller source. Home, chevrons, settled summary and full tracking were inspected. Reference imagery/fixture metadata does not broaden actual queries.

Explicit adaptations: existing fonts/icons and derived dark surfaces (no dark reference); rose #C2416B, established Android info #2563EB rather than reference #2F66CC; compact/enlarged-font actions wrap three columns; real long text grows vertically; existing Completed/payment/cancellation semantics; optional imagery remains because current feed/detail does not display it; decorative handle has no invented drag-dismiss. Guest/Close keep 36dp visible geometry plus 4dp hit slop. Hidden chevrons immediately leave input/accessibility while fading. A native chevron coordinate initially landed below the control; correct-center taps worked. No claim of a native defect from that miss.

## Actual checks

| Check | Result |
|---|---|
| Before edits | Types/lint pass (0 errors, 6 existing duplicate-import warnings); Android 20 files/235 tests; shared tracking/catalog/SLA 3 files/31 tests; Hermes export 8,185,301 bytes. |
| Final types | **Pass**, handoff-types.exit 0. A temporary concurrent document-icon error appeared in an intermediate run and was fixed by its independent author. |
| Final lint | **Pass**, handoff-lint-permitted.exit 0: zero errors, same six warnings in Health registration/payment QRPH/request tracking. Restricted import resolution failed on ancestor directory access; permitted unchanged lint passed. |
| Android units | **Pass**, units-runner.exit 0: 22 files/243 tests, eight new history/greeting/overflow cases. Supported Vitest configLoader runner avoids restricted bundler enumeration without suppressing checks. |
| Shared units | **Pass**, shared-runner.exit 0: 3 files/31 tests, same supported loader. |
| Final Home fixture | **Pass**, home-ui-short-settled.exit 0, eight groups and no console warnings/errors. Actual Home/summary/theme/status/control code; explicit synthetic platform/data/navigation/SVG adapters. Workspace-only file resolution uses installed packages and adds no permissions. Covers query shape/counts, zero/one/three, shelf boundaries, single announcement, dates, five dismissal cycles, Close/Escape/focus, tracking/quick/news routes, normal/reduced target durations, 320/360/400/412 theme/font/extreme accents, short 320px height/long title, guest/profile/loading/empty/errors/retries, late-account isolation/listener cleanup. Initial short-screen assertion sampled entry animation; corrected to await settled control geometry, then passed unchanged production code. |
| Contrast | **Pass**, 220 foreground/fill pairs across all saved presets plus white/black, both modes; minimum ratio 4.5965908082. Actual final role source, not native accessibility certification. |
| Final Android Hermes export | **Pass**, handoff-export.exit 0, no tool warnings/errors. 8,210,741 bytes: +25,440/about .31% overall. Assets 50→52, no removals. Added verified-ID/services-icon PNGs match concurrently introduced files exactly by MD5 (46e3e4cbd76529d757738d5d05793866 / 819ecfa61d69f91db4cd5cec98c43684). No Phase 4 asset/dependency was introduced; overall growth includes concurrent work. |
| Build observation | 358 captured source/config inputs unchanged from export startup through completion. Capture started after launch, before Metro compilation output; not represented as a pre-launch snapshot. Final packet hashes match originals at audit. |
| Shared consumer regression | Earlier existing Services fixture passed seven groups without console warnings/errors. Its source subsequently changed independently; it is prior-source evidence. Older stability fixture was not completed because restricted startup/approval review failed. Default passive Settings wrapper body is byte-equivalent after line-ending normalization. |
| Native smoke/diagnostics | Prior-source real light/default Home, dates/status summary, Close/return and chevron advance/end with long title observed. Existing SDK57 com.barangayan.resident.dev 1.0.0/code1, MuMu 127.0.0.1:16384 API32 360x640dp/font1/navigation0. [Captures/logs](../../../../tmp/resident-android-magicpatterns-phase-4-20261019/native/). Bounded logs had no matched ReactNativeJS exception/max-depth/FATAL; unscoped emulator diagnostics do not certify a clean app session. No pre-edit native recording captured. |
| Source review/recovery | Owned source reviewed for guards, cleanup, dead/debug code and scope; scoped whitespace review passes. Optional avatar/default Settings behavior preserved. No lint suppression, debug logging, placeholder or new dependency. Plan changes confined to Phase 4 progress/checklist. |

Earlier automatic approval-review capacity/timeouts prevented some final commands from executing. Source/guidance refresh, final lint and fixture subsequently succeeded. Additional native observation and older Services stability remain unverified, not failed assertions or unsafe-action determinations.

## Acceptance and manual verification

| Phase 4 acceptance criterion | Status |
|---|---|
| Zero/one/many layouts fit | **Pending manual verification** for exact-final native matrix; fixture met, many/long prior-native smoke observed. |
| Vertical gestures still scroll Home | **Met** in one current-development-source native card drag; full resize/interrupt/preference matrix pending. |
| Actions retain destinations | **Met** in source/fixture; native tracking/back/deep-open round trip pending. |
| Unknown step data is not fabricated | **Met** in source/units/fixture. |
| Current query count/scope unchanged | **Met** in source/fixture; native network/resource instrumentation pending. |
| Dismiss/back returns to correct origin | **Pending manual verification** for native hardware Back/backdrop/full-tracking/focus; fixture and prior native Close met. |
| Assigned native M04/M11/M12 fidelity/accessibility/performance | **Pending manual verification**. Timings, static screenshots and web adapters are not measured native results. |

On final source, complete these steps without changing real resident records:

1. At 320/360/400–412dp and font scales 1/1.3/1.5, use safe zero/one/three/error fixtures. Check light/dark, all offered body fonts and default/blue/warm/extreme custom accents; long titles, compact labels, one announcement and bottom clearance.
2. Swipe/tap both shelf boundaries; drag vertically from cards, interrupt snap, rotate/resize. Confirm page scroll, correct controls and no accidental card opening.
3. Five open/Close/backdrop/hardware-Back cycles; full tracking→Back; announcement deep-open→Back and all five quick actions. Verify preserved Home scroll/focus and no leftover scrim.
4. Reduced motion, rapid input and two background/foreground cycles; verify no hidden-Home focus, stale prior-account sheet or extra requests/listeners/channels.
5. TalkBack labels, modal focus/return and status/error announcements. Capture normal/reduced motion video, frame and network/resource counts against a properly recorded pre-change fixture baseline. No pre-edit native baseline exists for this execution; do not invent one.

No user-input blocker affects implementation correctness. The remaining gates require attended native verification. Phase remains **Partially complete**; stop before Phase 5. No commits, pushes, deployments, remote migrations, data deletion or service configuration changes were performed.

## Continuation verification, 19 October 2026

Current development-client smoke additionally verified full tracking→Home, vertical card drag→Home page scroll without opening the card, Escape summary dismissal preserving Home scroll, announcement deep-open→dismiss→Back→same scrolled Home, and backdrop summary dismissal. Captures 08–13 in native/ retain settled results. Intermittent Refreshing/input latency was observed separately after settling. These are development-source observations, not installation of the exported Hermes artifact, physical hardware Back certification or measured performance. Comprehensive matrix/TalkBack/resource/motion gates remain pending.

Local server recovery attempts started no process (incompatible offline/localhost flags, then occupied port); no existing process/mapping/configuration changed. Final React/Supabase review is in final-review.json: public client/resident filter preserved, no auth/RLS/privileged-key changes, primitive effect keys and cleanup inspected. Installed SDK2.112.1 has existing bounded GET retries (three); no application automatic retry was added. Reviewed official [select](https://supabase.com/docs/reference/javascript/select), [limit](https://supabase.com/docs/reference/javascript/limit) and [HTML changelog](https://supabase.com/changelog); markdown fetch failed explicitly. Verification skill checked the Home→loaded data→summary→tracking→return story; no deployment/service changes.

After the main-plan continuation note, shared-guidance.phase-04-final.xml became historical. New shared-guidance.phase-04-verified.xml (five files, security clean, parsed) is current for recorded input hashes: SHA256 BB1FFD0D95496A531540790E089E8F68F8D72149FB2F4C2FEC846CBD71E1D98C. Its changed continuation was extracted/read in one exhausted 1,269-character chunk; unchanged guidance was reused by matching hashes. Final source packet remains current; source/ownership audit exits0. No application source changed after passing final checks.
