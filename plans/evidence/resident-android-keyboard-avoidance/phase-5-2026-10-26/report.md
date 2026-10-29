# Phase 5 execution report — 27 October 2026 (Asia/Manila)

**Status: Complete within the plan’s available-MuMuPlayer scope.** All required native records checked by final-gates.cjs exist and pass. The hardware-key image cannot render gesture/three-button bars; no bar-rendering pass, release-APK qualification or native-iOS pass is claimed.

## Changed

- C15: retained existing shared search/session/submit/history behavior across all9 origins. ResidentHeader uses its existing one-line title mode only when an obstructed authenticated Centers editor requests room.
- C16: after actual overlap (editor bottom597px vs IME580px), Maps locally releases the layer row while editing. Full candidate input306–443px clears the keyboard. Dismissal restores the row and original map dimensions.
- C17: after actual overlap (bottom768px vs641px at480dpi;1157px vs580px at540dpi), Centers locally releases its toolbar, excess authenticated header height and hub-tab row. Full candidate input314–464px clears IME580px. The single Map-only editor, query, selected place, timeout, camera and navigation behavior remain intact. The public consumer needs no authenticated provider.
- Added regression assertions to the two existing browser fixtures and a narrow task-local ignore file for private raw captures/snapshots. No dependency, package lock, global input mode, security/domain handler or iOS policy change.

## Verified

| Check | Baseline | Final result |
|---|---|---|
| Typecheck | Pass | Pass, final2 |
| Source lint |0 errors/1 existing health warning |0 errors/1 same warning, final2 |
| Library tests |335 tests/32 files pass |335 tests/32 files pass, final2 |
| Android JS/Hermes export |Pass |Pass, final2 |
| Search fixtures |All5 pass on resumed source |Affected lifecycle/submit pass after change; unchanged session/explore/history evidence reused |
| Maps/Centers fixtures |Pass |Pass, including measured-obstruction/full-height/restoration assertions |
| Native C15 |Default and compact480/font1.3 all9 origins pass |Taller540 all9 origins pass; long native paste/caret/120-character cap/IME submit and final default regression pass |
| Native C16 |Default/compact480 editing and restoration pass |Taller540 typing/paste/caret/filter/layer/retention/3 cycles, selected marker/camera/nav/already-open header; taller480 and final default checks pass |
| Native C17 |All3 real routes, selection/status/idle/List cases pass |All3 taller540 editing/paste/caret/3 restoration cycles and candidate selection/status/camera/idle; taller480 and final default geometry/long-text checks pass |

Commands, timestamps and full diagnostics are in logs/. Native case JSON and ledger.md identify the exact scope of each observation; they are not interchangeable full-case claims. Browser fixtures are supporting evidence. Map resize rounding is explicitly bounded to1 Leaflet CSSpx with unchanged zoom/selection, based on a measured maximum0.75px diagnostic; pixel deltas are retained.

## Acceptance

| Criterion | Status |
|---|---|
| Every C15 origin and C16/C17 real consumer on recorded available MuMu configurations |Met |
| Initial/IME-already-open visibility, complete editor/caret, native typing/paste/selection/long text |Met |
| Submit/refocus/Clear/Back, query retention, Map/List absence and timeout/reset behavior |Met |
|3 dismissal/reopen cycles, restored header/toolbar/map geometry, no accumulating spacing |Met |
|Map zoom/selection/filter/navigation preservation; no refit or remount introduced |Met within documented resize-rounding tolerance |
|Theme/font/security/public-shell/iOS-policy preservation, no new automated regressions |Met by source/diff and recorded checks |
|Current source/native identity, console review, local test-data/settings/connection cleanup |Met with explicitly limited downloaded-bundle identity and filtered native logging |

## Limits and remaining work

- qemu.hw.mainkeys=1: hardware Back is exercised; gesture/three-button overlays apply but no system bars render. Actual bar behavior is unavailable on this image, not passed.
- Native APK hash/API/boot/Gboard/settings are recorded. Its native source revision is unknown. RN Runtime inspector is unavailable; final cold-downloaded factories and served originals match all20 compared contracts. This is not live Runtime factory inspection or release certification.
- Known pre-existing health lint warning, web shadow/pointerEvents deprecations, export color-tooling warnings and Firebase push-token configuration warning remain separate. No new native warning/error or observed WebView exception was found in the recorded interval; this is sampled evidence.
- Existing resident session and history retained; only synthetic drafts/recent entries were cleared. Original Gboard size/display/font/nav settings restored, owned inspector/log readers removed, existing Metro server and8081 bridge preserved. See final-cleanup.json.
- Physical phones, other emulator images, release APKs and native iOS are outside the current plan gate. Earlier phases’ unresolved cases and Phase6 remain unchanged. This chat issued no commit, push, deployment, remote migration, service configuration change or domain submission.

Historical interrupted/failed attempts remain in checkpoint-report.md, checkpoint-ledger.md and temporary driver logs. Git preservation is audited against100 resumed inputs; owned-product.diff is the review boundary. General plan headers are stale historical prose and were intentionally left outside the selected-phase update.

## Final Git state

Final Git audit: HEAD advanced externally to 9fe8add15b0a5b75f6c232e30679da869731a4ea (27 October09:20 Asia/Manila) and includes the validated product/test changes. This chat issued no commit or push. Source hashes remain identical to the tested working copy; resumed snapshots, not HEAD, remain the ownership baseline. Final progress/evidence cleanup remains uncommitted. The earlier full camera diagnostic was included in that external commit; its current reviewable version is redacted, and no history rewrite was performed.
