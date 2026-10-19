# Scoped native baseline/candidate observations — 19 October 2026

**Source version limit:** These measurements precede the final resident dialog/button typography, spacing and danger-fill correction. The measured candidate is identified by the [archived audit](audit-before-dialog-correction.json) and [archived patch](phase-1-source-before-dialog-correction.patch). They remain prior-source scoped observations, not final-build performance certification. [Final correction and checks](final-reference-review.md). The owner elected to leave full measured-motion acceptance pending manual verification.

The same SDK 57 development package, disposable signed-in account, Light/default green/System Default preferences, restored effective font scale 1.0 and original transition scale 0.5 were used on MuMu serial `127.0.0.1:16384`. [Current display evidence](native-resume/performance-display-mode.txt) reports active mode 2, approximately 15Hz, 1080×1920/480dpi. This is emulator evidence, not physical-device certification.

The baseline server used the 14 original source snapshots whose bytes match Phase 0 hashes. A scratch-only [Metro resolver](native-resume/metro-baseline.cjs) redirected those exact files and translated their relative import origins back to the original project; repository files, providers, route/data code and account storage were not rewritten. Native baseline rendering shows the original bold [form title and controls](native-resume/performance-baseline-form/screen.png), while the restored candidate shows its intended Gideon/variant treatment. Baseline bundled 2,675 modules versus candidate 2,677, consistent with the two new production helpers. The baseline server on 8096 was stopped after comparison. The candidate remains on the owned 8098 server; the original 8081 process is untouched.

Installed RN 0.86.2 source confirms its local-Origin inspector guard and tracing categories. The generic `Profiler.enable` command is unsupported here; its installed `Tracing.start`/`Tracing.end` implementation collects sampling/React events. The client supplied the required legitimate local Origin without changing the guard and selected the advertised main execution context. Read-only observations use the installed emitter's `listenerCount` and existing Supabase client's `getChannels`; no credentials, headers, request bodies or response content are retained. Network observations store aggregate event counts only. Non-CPU/frame trace argument payloads are removed.

## Results

Each accepted window has one untimed warm-up and **ten confirmed purpose-picker open/Android Back/closed cycles**. Every cycle retains its open and closed native UI XML. Every accepted run returns to the unsaved form. No purpose option or final Submit action was used.

| Observation | Original source | Candidate | Candidate repeat |
|---|---:|---:|---:|
| Confirmed cycles | 10 | 10 | 10 |
| Reduced-motion listeners, before → after | 0 → 0 | 6 → 6 | 6 → 6 |
| Existing realtime channels, before → after | 10 → 10 | 10 → 10 | 10 → 10 |
| Observed requests / failures | 0 / 0 | 0 / 0 | 0 / 0 |
| React commit pairs | 70 | 118 | 120 |
| React commit p95 / max | 3.922 / 5.736ms | 4.732 / 13.916ms | 5.406 / 10.141ms |
| Retained renderer frames, flags=0 | 77 | 97 | 99 |
| Renderer completion p95 / max | 12.924 / 14.640ms | 18.032 / 69.216ms | 16.688 / 21.620ms |
| Retained renderer frames within ~66.67ms budget | 100% | 98.97% | 100% |
| Retained renderer frames over 50ms | 0 | 1 | 0 |
| RN BeginFrame/DrawFrame trace events | 0 | 0 | 0 |

The candidate repeat was justified by the first window's single 69ms renderer outlier. It did not recur in the repeat window; neither attribution nor universal absence of stalls is inferred. Candidate React work is higher and bounded in these samples. These measurements do not establish all-scope performance equivalence.

After leaving the candidate form, [read-only state](native-resume/inspector-after-form-exit.json) reports **zero reduced-motion listeners** and nine existing realtime channels. Two Back inputs exited to the [emulator launcher](native-resume/performance-candidate-cleaned/screen.png); the scratch filename does not denote a Services screenshot. The [current app was then brought forward again](native-resume/final-current-app-restored/screen.png). The six presentation listeners clean up. No registration/channel growth or request fan-out was observed in the accepted purpose cycles. This does not count every native timer or certify unrelated integrations.

[Comparison and analysis limits](native-resume/performance-comparison.json) · [original summary](native-resume/performance-baseline-verified/summary.json) · [candidate summary](native-resume/performance-candidate-verified/summary.json) · [repeat summary](native-resume/performance-candidate-repeat/summary.json). Raw trace, gfxinfo, frame statistics and per-cycle native trees are retained in each corresponding directory.

## Limits and rejected observations

- RN tracing emitted CPU/React events but no BeginFrame/DrawFrame events, even with its installed frame category requested. Android frame-statistics buffers cover surviving windows; dismissed modal-window frames are not retained in the final snapshots. The table therefore describes the available renderer subset and **does not pass the full M03/M04/M05/M12 frame-budget, modal-smoothness or stall-attribution gates**. UIAutomator and inspector overhead are present in all accepted runs.
- Signed input/GPU sentinel columns are retained in raw frame statistics. Nonzero flag rows are excluded (9/4/5 respectively). MuMu's FrameInterval/FrameStartTime columns disagree with their header; no silent column remapping is used. Completion duration uses the recorded FrameCompleted minus IntendedVsync, compared with the independently observed approximately 15Hz budget. React commit duration pairs use actual async begin/end IDs and microsecond timestamps. Initial parsing did not handle signed fields or async pairs; it yielded no usable durations, then was corrected against the observed formats before reporting the table.
- The first timing-only baseline sequence left the form and is **rejected**, with `returnedToForm=false`. Its exact cause was not conclusively isolated; it is not a product-regression or performance pass. The revised script explicitly checks native open and closed states before proceeding. The rejected [summary](native-resume/performance-baseline/summary.json) and trace remain separate.
- Initial inspector probes without the required Origin were rejected with HTTP 401. Installed middleware source identified the expected local-Origin handshake; no security check was removed. One read-only default-context expression referenced an unavailable `global` alias and returned an inspector ReferenceError; the corrected probe uses the actual main context and `globalThis`. These are recorded verification-client errors, not claims of a clean server log or application-flow failures. The unsupported Profiler result and actual tracing capability are retained in [the probe](native-resume/inspector-probe.json).
- The baseline's first launch preceded its server listening and failed to connect. A confirmed HTTP 200 and cold launch loaded it successfully. No app storage or existing server was reset.

Exact geometry/timing/easing/held-press/rapid-reversal acceptance, full modal/JS/UI frame correlation, remaining motion families, native timer counts, TalkBack speech, software keyboard and largest supported text remain pending under the [native continuation's manual steps](native-continuation.md#remaining-acceptance-steps-and-cleanup). No test limitation changes a phase gate to passed.

## Reproduction and retained tools

The runnable scratch directory is `C:/Users/User/barangayan/tmp/resident-android-magicpatterns-phase-1-20261019`. [Collector snapshot](native-fixture/profile-purpose.cjs), [analysis snapshot](native-fixture/analyze-performance.cjs) and [capability/state probe snapshot](native-fixture/probe-inspector.cjs) are retained for review; their relative package paths assume the original scratch location. Accepted invocations used:

```text
node profile-purpose.cjs 8096 performance-baseline-verified <fresh-baseline-purpose-ui.xml>
node profile-purpose.cjs 8098 performance-candidate-verified <fresh-candidate-purpose-ui.xml>
node profile-purpose.cjs 8098 performance-candidate-repeat <fresh-candidate-final-ui.xml>
node analyze-performance.cjs
node probe-inspector.cjs inspector-after-form-exit state-only
```

The collector takes coordinates from the specified captured native control bounds, uses finite loops, checks every resulting state, closes the inspector socket and stops tracing on failure. No dependency or production diagnostic system was added. Repeating performance checks without a new concern is unnecessary; use these retained results within their stated limits.
