# Phase 0 — MuMuPlayer completion record

22 October 2026, Asia/Manila. **Complete for the user-authorized MuMu diagnostic baseline.** This supersedes the first-capture partial status in [comparison.md](../comparison.md). The user explicitly selected MuMuPlayer; a physical device is not a Phase 0 prerequisite. No later fix phase, native release installation, commit, push, deployment or backend mutation was performed.

## Acceptance

| Phase 0 criterion | Status | Direct evidence |
|---|---|---|
| Exact observed source/dependency/build state and runtime navigator | Met for this development baseline | [Source identity](source-identity.json): six loaded factories match generated bodies and source-map originals. [Final state](final-state.json): exact APK fingerprint, runtime stopped and source drift. Native APK source revision is unknown; it is not labelled the current release. Installed navigator defaults unchanged. |
| Bounded timing/render/mount/request/map instrumentation | Met | Original six owned diagnostic files; seven tests in the 286-test suite. Deadline, ring capacity, fetch restoration, error preservation, late replies, privacy and inactive production/standalone hosts tested. |
| Repeat samples and dominant measured interval for each slow pair | Met within observed JS stages | Historical 120 acknowledged presses, all 30 pairs, ten circuits; [all 19 slow observations classified](slow-pair-classification.json). Each is dominated by dispatch→destination React commit. [Current samples](native-samples.json) add five acknowledged round trips and [native analysis](native-analysis.json). Full native T0→correct-presented-T5 remains unverified. |
| Compact/full SLA ownership and actually loaded compiled code | Met | [Real-card summary](sla-summary.json), [cleanup capture](sla-cleanup.json), [compiled identity](source-identity.json). Six real compact cards, one real full card, hidden/background observations, unmount cleanup. Original timer/RPC fixtures are explicitly supplementary. |
| Cause report, including rejected explanations | Met | This record and the [historical cause report](../comparison.md) retain measured intervals, comparisons, rejected captures and uncertainty. No specific CPU function is declared causal. |
| Exit: repeated slow case reproducible and attributable to a measured interval | Met | Historical Services→DRRM n=12: first destination React commit median 1,142.8 ms vs dispatch median 0.31 ms. This establishes the repeated post-dispatch interval; it does not establish first correct content or release latency. |

The five slow directed pairs are Services→DRRM/Home/Health/Reports and Health→Reports. See the classification JSON for counts and every qualifying event. The historical triage threshold (commit ≥300 ms or dispatch ≥100 ms) is distinct from release targets.

## Current MuMu results

The supplementary current-source run uses the existing Android 12 development client `com.barangayan.resident.dev`, APK SHA-256 `9828659e5c4a24ddbd097fcbed7ab7b5ba185e6dd01242b912e9933420726f21`. Serial `emulator-5554` aliases `127.0.0.1:16384`; it is not a second reference device. Source identity includes the final portable development guard and the concurrently updated DRRM panel. Full bundle/environment contents were inspected only in memory; only selected hashes were saved.

| Current Hub pair | n | Dispatch median | Handler→destination React commit median | Max commit interval |
|---|---:|---:|---:|---:|
| Services→DRRM | 5 | 0.56 ms | 77.8 ms | 122.2 ms |
| DRRM→Services | 5 | 0.68 ms | 76.0 ms | 82.9 ms |

All ten presses and selections were observed, with no dropped samples or console issues. This smaller warm set differs from the historical fully warmed six-tab state, and DRRM changed concurrently. **These values are not a measured source-fix speedup.** The [six-tab native smoke](six-tab-smoke.json) also passed all expected presses/selections with no console issues. Map controls were prepared outside timed press intervals; earlier inaccessible-control attempts remain rejected.

The [current native trace](navigation.perfetto-trace) contains 20 app motion events and 56 app frame slices. The official local Perfetto 58.2 processor was downloaded from its published artifact URL and checksum-verified; it is a temporary analysis tool, not an app dependency or remote trace upload. Installed RN clock code uses `steady_clock`; trace snapshots relate MONOTONIC to BOOTTIME, and two `/proc/uptime` observations fall within JS call brackets. Provisional native-up→JS medians are 44.0 ms toward DRRM and 32.9 ms toward Services. The native APK revision is unknown, so these are supported clock-correspondence observations, not a rebuilt-clock certification.

The processor reports **92 dropped negative timestamps**; SurfaceFlinger frame ends are unresolved. App frame durations are positive, but a frame following a React commit does not prove correct destination content. Complete native input/presentation acceptance therefore remains unpassed. A separate clock probe found JS Systrace disabled; no setting or guard was bypassed. Earlier traces have 165/186 negative-timestamp drops respectively; their former structural packet counts do not establish timing correctness. Earlier Hermes duration attribution remains rejected for inconsistent profile clocks.

## Real SLA ownership

Only existing signed-in requests were read. No request, payment, profile or backend data was created/changed. Each observation was configured for 32 seconds; callback counts are actual observations, not ideal timer-rate claims.

| State | Mounted cards | Tick callbacks | Poll callbacks |
|---|---|---:|---:|
| Requests visible | 6 compact | 180 | 12 |
| Home selected, Requests retained | 6 compact | 180 | 12 |
| App backgrounded | 6 compact retained | 0 | 0 |
| Full tracking visible | 1 full + 6 retained compact | Full 31; compact 180 | Full 2; compact 18 |
| Tracking closed, Documents selected | 0 full / 0 compact | 0 | 0 |

Visible and hidden compact windows each started/completed 12 transport calls. Full tracking started/completed 20 calls across both owner types. Timer phase can put different poll counts in a window. Background return through the development URL reloaded the JS runtime; this is not evidence of seamless resume. A further cleanup window showed zero SLA callbacks and both owner counts zero. All diagnostic captures ended inactive.

One warning was recorded during full-card observation without retaining its text. Later LogBox was empty; its origin remains unclassified. That full run is not claimed warning-free. The two later native navigation captures recorded zero issues. Precise warning reproduction/classification is a remaining investigation boundary, not a suppressed console message.

The populated observations confirm retained hidden polling, but they do not make SLA the universal cause: the historical slow capture had **N=0**. Historical warm navigation also had no full marker replacement or map reload, and calendar shown/hidden/shown did not materially change median delay. Retained screen/data/context work remains an investigation branch; no blanket freeze, memoization or backend fix is justified by this phase alone.

## Verification

| Check | Actual result |
|---|---|
| Unit suite | PASS: 286/286, 28 files, including seven new diagnostic tests; pre-instrumentation baseline 279 |
| Expo lint | PASS current source |
| Updated DRRM browser UI | PASS current concurrent panel/test state; existing RN Web deprecations |
| Android production bundle export | PASS current source; isolated output, not an installed release APK |
| Current six-tab native smoke | PASS; six observed presses/selections, zero issues |
| Current native pair capture | PASS acquisition/acknowledgements; ten presses, zero drops/issues; presentation timing limited as above |
| Real compact/full unmount cleanup | PASS; zero owners and tick/poll callbacks after closing |
| Whole-app typecheck | FAIL: TypeScript 6.0.3 internal JSX assertion in unchanged `src/components/external-link.tsx` |
| Read-only type baseline replay | Same compiler crash with every Phase 0 application change removed; file unchanged from initial snapshot |
| Earlier shell/Services/Maps/tracking checks | Passed in their recorded source states; do not relabel them as a new native/release run |

[Check commands and exit codes](check-results.json), [build result](android-export-result.json), [per-file type diagnosis](type-diagnosis.json) and [baseline replay](type-baseline-replay.json) preserve exact evidence. Full logs are in `tmp/resident-nav-mumu-20261022/logs/`. Per-file analysis of 295 source inputs isolated the compiler assertion to `external-link.tsx`; no other semantic issue was reported. Earlier whole-app checks passed; the current compiler/generated-input problem is newly observed, reproduces without instrumentation, and is not hidden by a suppression or an out-of-scope source edit.

## Ownership and remaining boundaries

No application code changed during this continuation. The original Phase 0 implementation remains three modified diagnostic call sites and three added collector/wrapper/test files. Concurrent DRRM panel/test work was preserved and requalified by the current UI/build checks and source matching. The initial snapshot, continuation snapshot, XML packet identities, complete Reader boundaries, original-source checks and source drift are indexed in [the continuation context index](../../../../../tmp/resident-nav-mumu-20261022/context-index.md). No dependencies were added.

The document's earlier physical-device/source-fix/resource acceptance checklist combined later release gates with Phase 0 diagnosis. The user's MuMu instruction and Phase 0's actual measured-interval exit resolve that scope discrepancy. The updated plan changes only Phase 0 progress/status; all bytes before Phase 0 and from Phase 1 onward are unchanged.

Future/manual work remains: native source-revision/release qualification, precise T0→first-correct-T5, a controlled function/source-fix comparison, seamless background resume, the unclassified warning, the unrelated compiler assertion, adverse-network/account-isolation flows and longer resource checks. Those values are not passed here and no later phase is implemented. For eventual release validation, repeat on the required affected/reference hardware and use the plan's sample counts; physical hardware is not requested to close this MuMu Phase 0 baseline.
