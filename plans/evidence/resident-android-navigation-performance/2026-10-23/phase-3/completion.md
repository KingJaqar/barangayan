# Phase 3 completion — 23 October 2026 (Asia/Manila)

Phase 3's scoped ownership and isolation implementation is complete. This is not a claim that the universal 1–3 second tab delay is causally resolved or that physical/release timing targets are met. Phase 4/5 implementation was not started.

## Changes and requirement acceptance

| Requirement | Status | Implementation / direct evidence |
|---|---|---|
| Suspend hidden/background SLA ticks and polls; preserve freshness | Met | Both full/compact cards require screen focus and foreground. Abortable transport and deadline timers clean up. Final native retained-six-card hidden and background windows each run 32 seconds with zero ticks/polls, zero dropped events and zero recorded issues. Return performs six reads for six distinct requests, without a catch-up request queue. Full tracking separately records 30 full ticks/two polls, zero retained-compact callbacks and zero issues/drops. |
| Evaluate shared visible ticking/request ownership | Met | Six native cards justified one shared 1s clock; one shared AppState listener. Fixture verifies one tick interval for six visible cards, zero hidden intervals, ten loops without growth, and terminal clock suppression. Existing RPC accepts one ID (migration 0099, security invoker); no resident batch contract was found. Distinct visible IDs keep existing 15s polling; hidden/full-vs-compact duplicate owners stop. No new polling service or dependency. |
| Isolate pathname handling from destination content | Met | A small adapter publishes two scalar clearance contexts; six root path changes produce zero actual consumer commits. Root restoration chrome is a sibling after the navigator; path changes and the existing 3000ms timer do not render the navigator in the focused fixture. Nested clearance, keyboard/map hide, guest/public admission and restoration-error stacking are covered. |
| Explicit screen visibility for route work | Met in implementation and hook lifecycle checks | Centers focus + foreground owns local/connected work, periodic conditions checks and status age. Hidden input changes do no local compilation/search; local token and connected transport/timer cancel. Native representative-origin/closure qualification remains manual below. |
| Cancel obsolete work and resume current inputs | Met in controlled lifecycle coverage | Actual card/hooks tested with deferred old responses, request/account replacement, blur/background, origin/center/conditions changes and return. Local output is keyed before effect publication; connected key includes origin coordinates/accuracy. Retry, malformed response, timeout/backoff and solver rejection are covered. Shell already remounts private content by account. |
| Measure preparation/assembly before modifying search chunking | Met as a conservative conditional decision | Shipped 900-node/1064-edge pack, 30 actual-core runs in Node with diagnostic-only synthetic two-center/closure-free inputs: max freezing 1.26ms, attachments 17.89ms, individual assembly 0.56ms, uninterrupted generator segment 22.23ms. Host-only evidence; Hermes probe rejected. Search chunking/algorithm stays unchanged. Hermes profiling is required before any future algorithm/chunk change. |
| Separate always-live badges/notifications | Met by source preservation and shell coverage | Badge provider remains above tabs; notification engine remains above navigator. Optional card/route gates do not wrap them. Existing profile/theme/font ownership is retained. Real remote mutation/notification acceptance is not claimed. |
| Controlled freezeOnBlur candidate | Met; candidate not retained | Installed Router 57.0.10 and screens 4.26.2 verified. Default and clean candidate complete the same six-tab circuit, rapid final Health selection and Maps controls with zero issues/drops and no warm map load/ready events. Commits 133→70; no qualified presentation/timing or complete nested/backlog/restoration comparison. Candidate removed; app-tabs.tsx byte identity restored to working-copy baseline. |
| Conditional native detachment test | Met by decision not to alter it | No attach/draw-dominant evidence. Installed Android detachment and lazy defaults remain enabled. No speculative memory/WebView tradeoff introduced. |

The exit gate is supported by native SLA ownership counts and actual-hook/provider fixtures: optional work stops, state belongs to current inputs, return has no queued replay, and repeated hide/show has no growing timer/listener count. Long-session retained heap and release presentation targets require Phase 5 qualification.

## Files

- `src/components/services/agency-sla-status.tsx`, `src/hooks/use-app-foreground.ts`, `src/hooks/use-visible-clock.ts`, `src/lib/agency-sla-snapshot.ts`: focused/foreground clock and request ownership, account/request scope and response validation.
- `src/hooks/use-local-route.ts`, `src/hooks/use-resident-route.ts`, `src/components/evacuation-centers-panel.tsx`, `src/components/offline-route-card.tsx`: explicit route visibility, cancellation/current-result ownership and failure guidance.
- `src/hooks/use-floating-tab-layout.tsx`, `src/hooks/use-floating-tab-inset.ts`, `src/lib/floating-tab-inset.ts`, `src/app/_layout.tsx`: scalar layout subscriptions and small restoration chrome.
- `src/lib/agency-sla-snapshot.test.ts`, `src/lib/floating-tab-layout.test.ts`, `tests/hidden-work-ownership.mjs`, `tests/root-navigation-isolation.mjs`, `tests/tracking-payment-ui.mjs`: boundary/lifecycle/regression coverage.

Paths above are relative to `apps/resident-android-mobile`. No dependency, migration, backend authorization, app configuration, commit, push or deployment change.

## Verification

| Check | Before | Final |
|---|---|---|
| Expo lint | Pass | Pass |
| App unit tests | 294/294 pass | 303/303 pass |
| Shared routing/client/SLA tests | 85/85 pass | 85/85 pass |
| Shell / Services / tracking-payment / DRRM Centers / Maps fixtures | Pass | Pass; shell rechecked after overlay-order correction |
| New hidden-work ownership / root-isolation fixtures | Not present | Pass, zero page errors |
| Whole-app typecheck | Three TS2859 errors, external-link.tsx lines 9/12 | Same three pre-existing errors; zero new diagnostics |
| Android production JavaScript export | Pass with normal Hermes Temp access | Pass after freeze rollback and final root change |
| Final loaded Android source identity | Phase 0/1/2 identities historical | Ten current module factories/source-map originals match |
| Final native SLA hide/background/return and separate full card | Hidden compact work reproduced | Zero hidden/background callbacks; one current read per distinct request on return; compact/full separation passes |
| Owned diff / experimental restoration / source drift / plan scope | Working-copy snapshots retained | Source review records current hashes, zero unexpected drift and selected-phase-only plan edits |

The baseline/final application typecheck is not reported as clean. `external-link.tsx` was unchanged. Browser fixture deprecation notices and export color-environment warnings predate this work. An Android JS export is not an installed release APK.

## Deliberate retained ownership

The offline conditions controller remains one durable shared process store; deduplicated reads already started may finish after blur within their existing eight-second deadline and update the public offline cache. New periodic reads stop with visible ownership. Shared public incident/center subscriptions remain mount-owned (known Maps/DRRM instances); no measured event bottleneck justified a new cache/subscription architecture. Badge/notification subscriptions remain deliberately live. None of these are claimed to leak or to explain the universal delay.

Polling after readiness remains useful because total turnaround runs until release; visible authoritative polling also catches status corrections. Cancelled/released displayed clocks do not require ticking. Long lists still mount their rows; pagination/virtualization is Phase 4 and was not introduced.

## Workflow, discrepancies and rejected diagnostics

Followed plan section 7's centralized Git → ripgrep → Reader → cached scoped Repomix 1.18.1 → complete bounded XML → original-source workflow. Root AGENTS.md is empty, CLAUDE.md delegates to it, and no applicable nested/ancestor conflict was found. Existing changes belong to prior/user work and were preserved against working-copy copies/patches, not reset to HEAD. Packet identities, selectors, hashes, omissions and continuation boundaries are recorded in the included manifests/context index. Security scans are clean; no unexplained omissions. Final review reuses unchanged entries and supersedes three changed entries with a small supplement. Packet estimates are not model-usage savings.

Current packages still match the plan's Router 57.0.10 reference; screens resolves to 4.26.2. The historical document-wide “fixes pending” statement is stale; only this Phase 3 record was updated. The SLA contract supports one request, so shared ticking plus focus exclusion was chosen over a fabricated batch API. Shared conditions storage may complete a bounded cache write after blur intentionally.

Rejected/limited work is retained in the local index: first browser runner lacked an environment definition; stale/native control labels and insufficient settling caused invalid navigation-runner cleanup samples; fake-clock drift was resolved by pausing its clock; first freeze run overlapped an app source edit and was excluded. The clean freeze run supersedes it. Native cleanup was checked separately after transitions settled.

The large diagnostic-only Hermes source-copy probe failed to expose callable accessors and a later inspector evaluation terminated the development process with a Hermes native SIGSEGV. It is rejected, not a timing result or an application-flow pass. The app was restored through its confirmed explicit MainActivity; independent native checks then succeeded. Node timing is supplementary only. Do not reuse that failed inspector probe as a production-path benchmark. Sandbox Hermes Temp denial and ADB connection denial were resolved through permitted local execution.

## Pending manual verification

1. Use a source-matched profileable/release build on representative physical Android hardware. With the shipped graph and representative conditions, record Hermes preparation, attachment, search and assembly segments without the rejected inspector injection. Preserve exact routes/ties/closures/avoidance; change chunking only if measurement warrants it.
2. Confirm a real origin in Centers, choose a center, leave for at least 60 seconds, then return. Verify no hidden connected polls/local searches, current closures/avoidance/origin, one current refresh, correct route and retained map selection/viewport. Repeat offline/reconnect and permission changes.
3. Run cold public emergency/deep-link admission, actual account switching, mutations and live badge/notification delivery with owner-approved accounts. Controlled fixtures cover ownership; no remote mutation was performed here.
4. Phase 5: physical/release per-pair timing, 30 warm samples per directed pair over at least three runs, adverse network, nested Back/history, accessibility/reduced-motion/theme/font and ten-minute resource/heap qualification. Freezing stays disabled unless these gates support it. Detachment testing needs attach/draw evidence first.

Evidence: [verification.json](verification.json), [context-index.md](context-index.md), packet/source manifests and named baseline/final logs. Recoverable source copies, owned patches, full native experiment results and rejected diagnostic logs remain under `tmp/resident-nav-phase3-20261023`.
