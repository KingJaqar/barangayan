# Phase 5 — document guide and forms

19 October 2026, Asia/Manila. Implementation delivered; **native acceptance pending manual verification**. No later phase, remote mutation, commit, push or deployment was performed. No dependency or asset was added.

## Requirements and result

| Requirement | Before | Result / acceptance |
|---|---|---|
| Guide hierarchy, facts, requirements, client steps, fee footer | Partial: flat charter sections | Grouped facts, tinted requirements, connected stored steps, fee/processing panels and independent Agency Actions/Person Responsible/Additional Notes accordions. All eleven charter values retained, including null-person fallback. Automated synthetic rendering passes; exact native fidelity pending. |
| Resident/ID/purpose/upload/toggle/notes panels | Partial: resident primitives already adopted, mixed spacing/grouping | 20dp outer spacing, 16dp panels, 21/26 hero typography, readable error colors and unclipped filenames/fee wording. Actual account accent/font/theme hooks retained. ID panel keeps its measured maximum height across loading to protect subsequent field positions. |
| All catalog types / legacy | Existing behavior done | Business name/address/DTI; indigency/job-seeker HOA/renter/lessor; CTC reference/copies/pages; general and legacy retained. Native Switch remains an explicit platform adaptation. No schema, catalog, query, upload-helper, auth or payment-owner changes. |
| CTC large values / Business fields | Done | Actual fixture accepts 1,000 copies and 1,000,000 pages into the existing fields; Business/DTI controls render. Existing validators remain authoritative. Prototype page stepper/200-page ceiling intentionally excluded. |
| Refresh/file/checkbox stability | Partial | Form remains mounted; fixed child ownership and top-level validation measurements retained. Synthetic refresh preserves ID panel height, purpose explanation and notes. Picker cancel/error, renter evidence removal and Other-purpose branch pass. Native scroll/keyboard arbitration pending. |
| Validation-error focus | Existing deliberate scroll done | Same field-location/first-error code retained; reduced motion uses immediate deliberate scroll. Error feedback remains visible. Native focus/scroll position pending. |
| One action, one submission attempt | Current charter guard done; legacy upload guard missing | Existing charter busy/idempotency retained. Added synchronous legacy busy ref around upload/attempt; five rapid synthetic clicks produce one attempt and one legacy upload. Existing payment route retained. Real safe-fixture integration pending. |
| M04/M06/M12 | Purpose sheet/button resident variants done; guide accordion partial | Reuse existing purpose sheet/button motion. Local measured accordion height/opacity 220ms, chevron 200ms; animations stop on cleanup/reversal, no business callbacks; reduced motion immediate. Five fixture accordion cycles pass. Native timing, rapid reversal, performance and TalkBack pending. |

## Reference and adaptations

Live Brave viewer still displayed **v32**; disposable preview used artifact `df178e1c-7b6e-4d98-8334-06f3a00f28c3`. Inspected Services → Indigency guide → Additional Notes → Request Document against retained RequirementsGuide, RequestDocument, DetailAccordion, NumberedList and requirements source. No editor changes, uploads or prototype submissions occurred. The Documents quick action did not navigate in this observed preview; Services navigation worked. Initial screenshot after navigation showed the outgoing catalog; settled guide was subsequently inspected.

Live charter strings remain authoritative. Processing durations are rendered verbatim rather than fabricated into action/person assignments or a new structured duration model. Stored numbering is retained; unnumbered prose is never given invented step numbers. The source already uses native stack transitions; no generic entrance/fade was added. Native switches, current icons (including the owner's existing custom document icons), actual selected fonts and light/dark surfaces remain named platform adaptations. The legacy upload preview no longer replays a decorative entrance on file replacement; this is consistent with the reference form's lack of an entrance animation for changing files.

## Verification

Detailed raw logs, baseline source copies and owned recovery material: [execution folder](../../../../tmp/resident-android-magicpatterns-phase-5-20261019/). Context packet provenance: [Phase 5 index](../../../../tmp/resident-android-magicpatterns-repomix/phase-05-document-forms.context.md).

| Check | Result |
|---|---|
| Baseline Android types | Pass |
| Baseline lint | Pass: zero errors, six existing duplicate-import warnings |
| Baseline Android units | Pass: 22 files / 243 tests |
| Baseline shared catalog/request validation/request form/submission | Pass: 4 files / 38 tests; optional service-foundations test selector matched no test file |
| Baseline Android Hermes export | Pass |
| Final Android types / lint | Pass; zero errors and the same six warnings |
| Final Android units | Pass: 22 files / 243 tests |
| Real-component synthetic browser fixture | Pass: five groups; zero console errors/warnings. All five service kinds, legacy, stored charter content, independent accordions, 320/360/400/412 widths, dark/custom accent, refresh height/drafts, picker cancel/read failure, renter evidence cleanup, five rapid submit clicks, authoritative result route, guest and verification destinations. Browser font preference input is exercised; native selected-font rendering is not certified. |
| Exact-final Android Hermes export | Pass; bundle/asset sizes and source hashes recorded in audit.json |
| Diff/ownership/dependency review | Pass; details in audit.json. No assertion, diagnostic or security guard was weakened. |
| Native Phase 5 flows/fidelity/motion | Pending manual verification |

Tool limitations were resolved independently: npm-cache/runner ancestor-directory sandbox denials required permitted filesystem access. A restricted export failed to write Hermes temporary output; its replacement stalled, was identified by exact owned process/command and stopped after final source changed. Final export used an owned temporary folder and permitted filesystem access. The first synthetic fixture lacked Link/withRepeat adapters; the next refresh adapter remained loading; diagnostic capture then identified missing Easing.inOut in the loading-skeleton adapter. The adapter now uses installed platform easing, and final tests pass without suppressing console diagnostics. These were tool/fixture failures, not claimed application passes.

## Native evidence and exact remaining steps

MuMu reconnected on explicit serial `127.0.0.1:16384` after an offline listing. Read-only identity/display/log/screenshot capture confirms installed `com.barangayan.resident.dev` version 1.0.0/code 1, 1080×1920 / 480dpi (360×640dp), font scale 1.0. The captured screen is the **launcher**, not the Phase 5 application. It establishes neither final build rendering nor a flow pass. No native tapping, account switch, data clearing or consequential action occurred.

1. Launch the current SDK 57 development build and record bundle identity, account/fixture, Android API, navigation mode and refresh rate. Browse each available live catalog kind plus a safe legacy fixture; compare guide top/middle/footer/three expanded accordions with v32, preserving all wording/numbering and long fees.
2. Cover Light/Dark, default/blue/warm/light-and-dark custom accents, all offered fonts on representative long fields, 320/360/400/412dp plus a taller layout and 1.3/1.5 font scale. Check keyboard/footer reachability, text wrapping, contrast, 44dp targets, TalkBack roles/expanded state/focus order and focus return.
3. On each safe form, select Other, type explanation/notes, toggle renter/appearance, cancel/select/remove files, retry unreadable/oversize/wrong-type files and refresh verification through loading/error/success. Record scroll offset and input before/after; only deliberate failed submission may scroll to the first invalid field. Check CTC 1,000/1,000,000 accepted and 1,001/1,000,001 rejected by existing validation; check Business DTI requirements.
4. Use an existing isolated submission fixture for one successful submit, failure/retry and five rapid taps during a slow response; compare uploads/RPC/query counts with baseline. No real resident record is authorized for this test. Without a safe fixture, retain integration as pending.
5. Repeat purpose open/select/close/backdrop/handle/Android Back and independent accordion reversal five times, then two background/foreground cycles. Inspect M04/M06/M12 recordings/profiler timing, stable final state, listener/timer/request counts and native logs. Test reduced motion separately. No native performance or leak claim follows from a browser fixture.

## Scope, discrepancies and rollback

The main plan's opening planning-only label, old stop-before-Phase-5 notes and fully-complete dependency wording are historical: actual predecessor implementations exist, while their comprehensive native gates remain pending. The current user authorizes Phase 5 implementation without passing those gates. Root AGENTS is an empty preserved user edit; CLAUDE references it; no nested applicable instructions or instruction conflict was found. Cancelled usability Phase 8 stays excluded.

The original broad Phase 5 route selector also included later payment routes. Discovery narrowed it to guide/request/layout and contracts. A bracketed-guide selector initially missed the guide; the supplemental pre-edit packet corrected that omission. Generic existing Repomix snapshots were preserved. Two first-run extraction outputs exceeded the requested display budget; their missing required ranges were subsequently read through bounded extracts/originals, and no truncated output is treated as complete analysis.

Owned source: guide route, request route, charter-request-form, two new document presentation components and one new fixture. Keep generic Collapsible/AnimatedAppear for existing consumers; remove only replaced local imports/styles/wrappers. Recover using the saved working-copy originals, owned-source.patch and exact new-file list in audit.json; reverse only owned hunks and reconcile overlapping later edits. Restore no file blindly from HEAD. Preserve all prior Home/Services/shell work and historical packets.

Out of scope: predecessor manual acceptance, existing six lint warnings, live backend qualification and release/deployment. Phase 5 stays **Partially complete** until its native/integration gates above are verified.
