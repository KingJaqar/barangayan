# Phase 0 baseline (25 Oct 2026, Asia/Manila)

HEAD `d9253f0d42934133143d3b67955a4f987504914d`, branch `main`. Working tree carries 481 uncommitted/untracked status entries from other sessions (none of the 55 manifest inputs). No source, config, dependency or test file was changed by Phase 0; the only new files are this folder and `ledger.md`.

Run from `apps/resident-android-mobile` with Node 24.13.1. Logs sit beside this file. The Android export went to the session scratchpad, not the repo.

## Source identities

55 of 55 manifest sha256 values match; 0 changed, 0 missing. `git status --short` over the 55 paths is empty (all clean at HEAD). So every finding F1–F23 stays valid.

## Snapshot (recovery)

`tmp/resident-pull-refresh-20261025/before/` (`tmp/` is untracked and not git-ignored, like earlier phases' folders; do not commit it): `working-tree.patch` (`git diff`, 42,034 bytes, other sessions' tracked edits), `status.txt` (481 lines), `files/` (copies of the 19 edit-role inputs, all clean at HEAD). No `.env` or secrets were copied.

## Checks (before any edit)

| Check | Command | Exit | Result | Log |
| --- | --- | --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | 0 | no diagnostics, about 57 s | `typecheck.log` |
| Unit tests | `npx vitest run` | 0 | 32 files, 335 tests passed | `vitest.log` |
| Source lint | `npx eslint <19 edit files>` | 0 | no output | `eslint-source.log` |
| Android JS export | `CI=1 npx expo export --platform android --output-dir <scratchpad>` | 0 | 1 Hermes bundle (8.4 MB), about 95 s | `export-android.log` |
| Harness tests | `node tests/<name>.mjs`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` = Brave, `TEST_ARTIFACTS_DIR` = scratchpad | see below | 14 pass, 2 fail | `tests/*.log`, `tests/_summary.txt` |
| Navigation suite | `node tests/navigation-regressions.mjs` | 1 | 15 entries: 14 pass, 1 fail (`services-lists-ui`) | `tests/navigation-regressions.log` |

### The 16 regression tests

Pass (exit 0): `refresh-ownership`, `settings-profile-ui`, `health-presentation-ui`, `help-legal-about-ui`, `reports-announcements-ui`, `services-tab-stability`, `drrm-hub-alerts-ui`, `drrm-scan-family-ui`, `resident-search-explore`, `resident-search-session`, `resident-search-submit`, `resident-shell-lifecycle`, `tracking-payment-ui`, `request-tracking-navigation`.

Baseline metrics to hold equal: `refresh-ownership` `dataConsumerCommits 0`, `cacheWrites 0`, `totalRequests 60`, `rpcCalls 1`, `errors []`. `reports-announcements-ui` reports 2 `errors` entries, both react-native-web deprecation warnings (`"shadow*" style props are deprecated`, `props.pointerEvents is deprecated`): baseline, not new. Every other passing test reports `errors []`.

### Pre-existing failures (not caused by this work)

1. `services-lists-ui` (exit 1): Playwright strict-mode violation, `getByText('No payment required', { exact: true })` matches two elements (`tests/services-lists-ui.mjs:68`). It is the known duplicate-locator failure recorded in earlier phases. It also fails inside the navigation suite.
2. `home-presentation-ui` (exit 1, 1 s): esbuild `No loader is configured for ".png" files: assets/images/services-icon.png`, from `src/components/services-tab-icon.tsx:5` (`require('../../assets/images/services-icon.png')`) imported by `home/index.tsx`. The file came in with commit `fcb7d194` and is unchanged in the working tree; the test's esbuild `build` (line 69) sets only `loader: { '.css': 'empty' }`, and its plugin handles png only for paths it resolves itself. Other harnesses that bundle the same import (`services-tab-stability`, `resident-search-explore`) pass `loader: { '.png': 'dataurl' }`. This test was not in the earlier "known failure" history.

Consequence for later phases: `home-presentation-ui` is a named gate for Phases 1 and 3, but it cannot produce an "equal to baseline" result while it fails to build. It needs a one-line harness fix (`'.png': 'dataurl'`) before Phase 1's gate or at the latest before Phase 3, which the plan allows ("a `tests/*.mjs` only if a gate shows it needs an update"). Phase 0 makes no code change, so this is recorded, not fixed.

## Not run

Broad `expo lint` (62 errors outside source in earlier history) was not rerun: the plan's gate is source-only lint on the 19 edit files.
