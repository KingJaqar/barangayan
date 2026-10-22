# Phase 12 — Health execution, 20 October 2026

Status: **Partially complete**. Implementation and automated gates delivered; candidate-native,
real-service and full fidelity/accessibility/performance acceptance remain pending. No later phase
started. No commit, push, deployment, migration, real registration or other remote write performed.

## Changed requirements and files

- Health `index.tsx`: underline tabs, softer calendar with bounded day geometry, independent calendar
  collapse, preserved month/year/adjacent-day/category/month-wide semantics; divided drives and
  applications, status filters and retained detail sheet with facts/current timeline/pinned Close.
- Health `register.tsx`: grouped registrant/eligibility/privacy sections, wrapping chips, selected fonts,
  theme-aware roles, stable consent/footer, actual household options/age reset/PWD/None behavior,
  vaccination-only dose controls with validated actual previous-dose date, recoverable loading/errors.
- `components/health/health-presentation.tsx`: reused summary/panel/facts/status and two-consumer sheet.
  M04 is 280ms panel/200ms scrim via existing hook with retained exit/reversal cleanup; reduced motion
  removes translation. M03 dose pill200ms, M12 press150ms (.97 drive/.98 submit), M13 check240ms once.
- `primary-button.tsx`: opt-in Health appearances reserve the consent footer border and set drive press
  scale. Existing default, auth, Services and requestForm behavior stays intact.
- `use-medical-drives.ts`: explicit month/registration error state and user-driven retry. Existing
  projection, queries, filters, subscription ownership and atomic registration RPC are unchanged.
- `tests/health-presentation-ui.mjs`: actual routes/hook/components with isolated synthetic transport and
  native adapters. No new dependency or production asset.

## Direct acceptance matrix

| Phase12 criterion | Status | Evidence / limit |
|---|---|---|
| Month/year jump, adjacent-date/category/month-wide behavior retained | **Met (automated)** | Actual hook query/filter and UI checks; native pass pending below |
| Long chips wrap; preferences respected | **Met (automated)** | 320/360/400/412px; dark/light, extreme accents, system/Georgia; native font-scale matrix pending |
| Consent does not move scroll; footer stays reachable | **Met (automated)** | Exact offset equality after Health-only stable border fix; short-height fixture; native keyboard pending |
| Stock/duplicate/server errors remain visible and retry preserves input | **Met (automated)** | Full disabled, failed fetch/profile, malformed result, duplicate/stock/server messages; no fake success |
| Correct server applicant number and actual Pending status | **Met (automated)** | Full `DEN-20261020-0046`, parsed server result; honest submitted/awaiting review copy. Real backend pending |
| No double submission | **Met (automated)** | Five synchronous click events during500ms response → one RPC; account/drive key and generation guard |
| M03/M04/M12/M13 and exact v32 native reproduction | **Pending manual verification** | Config/source and selected browser captures, not measured native motion/fidelity |
| Native flow, Back, keyboard, TalkBack/focus, lifecycle/performance | **Pending manual verification** | Device discovered; no candidate interaction/profile measurement performed |
| Real server races and household identity integration | **Pending / backend limitation** | No approved disposable backend fixture used. RPC has no member identifier; no backend change authorized |
| Scope, dependencies and user-work preservation | **Met for owned diff** | Audit/patch; concurrent external changes explicitly separate; no lockfile edits |

## Verification actually run

Recovery and complete diagnostic logs: [working folder](../../../../tmp/resident-android-magicpatterns-phase-12-20261020).
Context and input/packet identities: [phase index](../../../../tmp/resident-android-magicpatterns-repomix/phase-12-health.context.md).

| Check | Baseline | Final |
|---|---|---|
| `tsc --noEmit -p apps/resident-android-mobile/tsconfig.json` | Pass | Pass, exit0 (`types-reviewed`) |
| `npm run lint --workspace=@barangayan/mobile` | Pass,0errors/2existing duplicate Health imports | Pass,0errors/0warnings, exit0 (`lint-reviewed-permitted`) |
| Android `vitest run --config vitest.config.ts` from app | Pass25files/260tests | Pass25files/260tests, exit0 (`units-handoff-permitted`) |
| Shared `vitest run src/schemas/drive-registration.test.ts src/schemas/drive-registration-result.test.ts` | Pass2files/11tests | Pass2files/11tests, exit0 |
| Health actual-component fixture | New | Pass10groups, exit0, zero captured console warnings/errors (`ui-reviewed`) |
| Existing Services lists fixture | Not rerun before edits (existing test read) | Pass7groups, exit0, zero captured diagnostics |
| SDK57 Android Hermes export with workspace TEMP/TMP | Pass | Pass, exit0 (`export-reviewed`) |

Baseline8,286,928 → final8,264,447Hermes bytes (−22,481/~0.271%); same53asset identities.
This is a working-copy aggregate, including concurrent external DRRM changes; not an isolated
attribution to Phase12. No measured native performance or production-readiness claim.

Initial test commands incorrectly combined relative config and root; diagnosed/corrected before
source edits. Fixture setup errors (`window` scope, missing Router adapter and asynchronous channel
settling) are retained. The fixture exposed a real2px consent scroll regression; the owned border
fix passes exact equality. A new lint warning from the generation-ref cleanup was fixed. Later
sandbox restrictions blocked esbuild config/dependency lookup, ESLint parent-directory scanning,
and cached formatter/Repomix paths; approved unrestricted read-only/local checks succeeded. Earlier
failed logs remain, not relabeled as product failures or concealed. Expo's inherited
NO_COLOR/FORCE_COLOR runner warnings were present at baseline/final; native runtime logs were not tested.

## Context, discrepancies and ownership

- Root AGENTS was empty; CLAUDE only references it; no applicable nested instructions/conflict.
  Historical planning-only/Phase12-not-started wording is superseded only by this selected-phase record.
- Phase2 shell/provider/tab implementation confirmed in current source; its manual gates stay open.
- Supplied36-entry XML was read completely in five <=11,500-character chunks. Pinned cached
  Repomix1.18.1 produced13-entry and latest-contract supplements, then35-entry final source packet;
  security/parse/manifest gates pass. No Repowise needed. Hashes do not imply behavior correctness.
- Docs read before editing: Expo57 Router/Reanimated/Image, RN0.86 Animated/Modal/KeyboardAvoidingView,
  React effects and Supabase JS2 RPC. Installed versions retained; changelog Markdown endpoint unsupported.
- Editor is nowv35. Explicitly selected read-only v32/artifact
  `df178e1c-7b6e-4d98-8334-06f3a00f28c3`; inspected rendered Health/form and matching retained sources.
  Only IAB was exposed to browser tooling, so reference inspection used it instead of Brave; saved
  versioned evidence supplies remaining states within recorded limits. No unsupported exact match claimed.
- The latest0121 migration supersedes0035: real server validates age/prior date, closed drive, duplicate,
  stock and returns Pending. No migration edited/applied. Existing RPC only stores signed-in user;
  member selector is retained with an explicit ownership limitation. No member identity fabricated.
- Removed stale local preview number and fake2025-01-01 date. Number issuance is explained until server
  success; full number/status shown afterward. Reference approval-like wording adapted to actual Pending.
- Old `RegistrationModal` had no path setting its drive non-null; narrow global reference search confirmed
  no caller. Removed obsolete duplicate local form/styles while replacing route presentation. Route files,
  service logic, assets and public consumers remain. Native post-cleanup smoke stays pending; removal is
  source/automated-qualified only, not a passed native deletion gate.
- Compact index was written just after the first new presentation file; independently saved baseline,
  XML analysis/docs and baseline checks preceded code. This ordering deviation is recorded, not hidden.
-397 baseline source/config/test inputs were byte-snapshotted.12 non-owned files changed concurrently:
  DRRM components/tests/filter and shared segmented control. They are recorded in `concurrent-user-inputs.json`,
  preserved, and excluded from the Phase12 patch. Current compact option only changes pill segments;
  Health underline branch remains compatible. Current tests/export include those bytes.

## Exact remaining native steps

Read-only ADB discovery found `127.0.0.1:16384` and `emulator-5554` online. Recorded MuMu endpoint:
AndroidAPI32,1080×1920px,480dpi =360×640dp, fontScale1.0, installed `com.barangayan.resident.dev`.
No current screenshot is presented as candidate evidence; build version/navigation mode remain unrecorded.

1. Load the final SDK57 candidate with the existing dev workflow on explicit serial127.0.0.1:16384;
   record build identity/navigation mode and capture Health19–22 against v32. Do not clear app data or
   change the owner's account. Use a separately approved disposable test account/backend fixture.
2. Manually cover expanded/collapsed calendar, prev/next/adjacent/month-year jump/category/month-wide,
   empty/loading/error/Retry, full/registered drives; all four statuses and details/Close/backdrop/Back.
3. Exercise member/self/age/PWD/None/multiple, vaccination first/second/booster with valid/invalid dates,
   consent without scroll movement, short keyboard/footer; five close/open and rapid-submit cycles,
   two background/foreground cycles. Inspect native console/server logs and resource counts.
4. With an approved disposable backend, verify one atomic write, authoritative number/Pending refresh,
   duplicate/stock race/error branches. Member identity persistence needs separately authorized backend
   scope; this presentation task cannot add it.
5. Cover320/360/400–412dp+tall, light/dark/all presets/extreme custom accents/offered fonts, fontScale1.3/1.5,
   TalkBack labels/focus/return and reduced motion. Record M03/M04/M12/M13 timings and JS/UI/frame/memory
   evidence against same-device baseline; unrecorded results remain pending.

Rollback: review `owned.patch` against saved `before/` bytes and reverse only owned hunks after checking
for newer overlap. Never restore from HEAD, apply the whole tracked-before patch, or discard concurrent work.
