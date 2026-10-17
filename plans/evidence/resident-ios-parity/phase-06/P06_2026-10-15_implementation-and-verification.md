# P06 — Appearance preferences, introduction and interaction completion: implementation and verification (2026-10-15)

Source: uncommitted on base `e860743`, in the resident iOS workspace (`apps/resident-ios-mobile`). Standard: non-device, non-live scope under OD-06/OD-07 (no signed build, no simulator, no app launch against a backend). Nothing was committed, pushed, deployed or applied to a remote database in this session. No migration, no shared-package change and no new dependency.

## 1. Entry

| Entry item | State |
|---|---|
| Phase 1 | Verified (non-device scope, OD-06/OD-07). |
| Phase 2 | Verified (non-device scope). |
| Phase 4 | Partially complete (Phase 3 exit, PR-06 open). Not needed by this phase: no auth flow or backend contract changed. |
| Phase 5 | Partially complete (closed gates `householdEditing`/`privateIdUploads`, PR-10). Not needed by this phase. |
| PR-03, PR-18 | Skipped (OD-07): no screen below was rendered or driven. |

The open Phase 3–5 exits are carried as recorded blockers for the phase status, as Phases 4 and 5 did. They do not block any Phase 6 code: the appearance columns (`theme_preference`, `accent_color`, `custom_accent_colors`, `font_preference`) have existed since migrations `0006`/`0075`.

## 2. Docs and sources read first

- AGENTS.md (Expo v57 docs rule; migration numbering; cancelled Android Phase 8 — not touched). No conflict with the plan.
- SDK 57 pages: UI (`@expo/ui` universal `Slider` and `Host`; modifiers path `@expo/ui/swift-ui/modifiers` for `accessibilityLabel`/`accessibilityValue`), Font. The Font page documents no built-in iOS family list, so family availability is not claimed beyond Apple's shipped faces (see P06-D04). `Appearance.setColorScheme` and `experimental_backgroundImage` were confirmed from the installed React Native 0.86.2 typings, not from memory.
- Plan: §1–§4 Phase 6, A02, A43, A50, §6.6, B.2 (R42/R46/R49/R50); handoff §5–§9, D01/D02/D18.
- Android source: `use-theme-preference.tsx`, `use-font-preference.tsx`, `constants/fonts.ts`, `custom-accent-color-modal.tsx`, `color-picker.tsx`, onboarding screens, Settings theme section.
- Backend: migrations `0006`, `0075`, `0001` (own-row update policy, `set_updated_at`), `0095` `guard_profile_foundations`, `0096` locality/ID triggers — none reject a write that only changes the four appearance columns.

## 3. What changed, by requirement

| Task | Implementation (all under `apps/resident-ios-mobile`) |
|---|---|
| P06-T01 introduction | Routes `onboarding/welcome`, `value-prop`, `personalization`, `completion` (`src/app/onboarding/*`, screens in `src/features/onboarding/screens.tsx`, shell and step dots in `frame.tsx`). Three-step progress, Continue / Get started, Skip on the three steps, native back, fade-in that is skipped under Reduce Motion, scrollable content. Entries: account choice (prominent "Take the tour" card until first seen, a quiet link afterwards), Help (header link), Settings (both signed-in and guest). The signed-out root is unchanged (`app/index.tsx` still goes to account choice or Home); leaving the tour returns to its origin through `router.dismiss(depth)`, or to the root decision when opened by a direct link. `intro-state.ts` keeps one non-sensitive device flag. |
| P06-T02 theme and accent | `src/features/appearance/provider.tsx`: `AppearanceProvider` (inside `ResidentProvider`) applies Light/Dark/System through `Appearance.setColorScheme`, so native chrome, alerts and pickers follow the choice, and supplies the accent and font contexts. `src/lib/palette.ts` derives action/selection tokens from the accent with contrast safeguards (≥ 4.5:1 for the primary on surface and canvas, and for its label); success/warning/danger/info and surfaces never change. `src/lib/theme.ts`: `useColors()` now reads scheme + accent. The navigation theme (header/background/tint) is built from the same palette in `app/_layout.tsx`. |
| P06-T03 custom colors | `src/features/appearance/color-picker.tsx` and `appearance-screen.tsx`: hue slider, saturation/brightness square (touch drag), saturation and brightness sliders, hex field, preview with hex, saved count "n of 10", invalid/duplicate/preset/limit messages, saved list with explicit Use and Remove buttons (no long-press needed), removal confirmation and cancel, discard confirmation for an unsaved pick, swipe dismissal blocked while dirty. VoiceOver: native sliders carry a label and value; the square is an adjustable element with brighter/darker and more/less-saturated actions. |
| P06-T04 fonts | `preferences.ts`: ten IDs from the shared list (Garamond and Courier New are web-only and excluded), iOS families Arial, Helvetica Neue, Verdana, Trebuchet MS, Georgia, Times New Roman; `system`, `inter`, `segoe-ui`, `tahoma` use the system face and say so; nothing is bundled or downloaded. `useType()` in `theme.ts` applies the family to every semantic role (size, weight and line height unchanged, so Dynamic Type still scales; references stay monospaced). All ten are shown as a full list with a per-row preview, not clipped chips. |
| P06-T05 persistence and sessions | `PreferenceStore` (`preferences.ts`) + `save.ts`: optimistic change, ordered writes, exact one-row match, failed write restores the confirmed value (unless a newer change replaced it) and shows a persistent explanation. Signed-in with a profile persists to `profiles`; guest or no profile row is session-only and says so. State is rebuilt per account through a key, so one account's accent or font never carries into another session; relaunch loads from the profile. |
| P06-T06 shared interactions | `ui.tsx`: all text uses the font-aware type roles; `Sheet` gains `swipeDismiss`; `SymbolIcon` exported; radio groups with checked state and checkmarks. See section 6 for what remains. |
| P06-T07 verification | Contrast, ten font IDs, ten-color limit and rollback have automated coverage (section 5). Device items are Skipped. |
| Settings | New route `settings/appearance` (title registered in the Settings layout) with Theme, Accent color, Your colors, Font style and a Preview card. |
| Mechanical | `typeScale.*` replaced by `useType()` in `resident-stack`, `details-form`, `avatar-card`, `birthday-sheet`, `household-card`, `profile-screen` and `ui.tsx` (no other behavior change). |

## 4. Decisions and plan discrepancies

| ID | Decision / discrepancy |
|---|---|
| P06-D01 | **Default accent.** Android's stored default is `#0F6E5B`; the iOS handoff primary is `#0D6B59` (light) / `#35C7A0` (dark). The stored default accent (and an unset one) renders with the handoff tokens untouched; every other accent derives from the stored value. |
| P06-D02 | **System is offered.** Android's Settings shows only Light/Dark although the column allows `system`. iOS offers System, Light and Dark (A43 "light/dark/system"; handoff §5). The default remains System. |
| P06-D03 | **Removing the color in use returns to the default accent** (one write), so a removed color is never left selected with no checkmark anywhere. Android leaves the removed color applied. |
| P06-D04 | **Fonts.** Qualified faces are the ones iOS ships; the plan's "verify availability and weights on supported iOS builds" cannot be done without a device (Skipped, OD-06). `fontWeight` 400–700 is requested with each family; iOS falls back to the nearest face. Native header and tab-bar titles stay in the system face (UIKit chrome). A stored `garamond` or `courier-new` (set on web) is kept, rendered with the system face, and never overwritten unless the resident picks another font. |
| P06-D05 | **Gradients use `experimental_backgroundImage`** (React Native 0.86 typed style). Without support the square degrades to the flat hue color; the sliders and hex field still work. Not device-verified. |
| P06-D06 | **Write path.** Preferences are a direct one-row `profiles.update(...).select('id')`, like Android/web. The row's `updated_at` trigger fires, so the Phase 5 profile form's base becomes stale; its existing reconcile (`reconcileConflict` → safe retry when no edited field changed) handles that without a false conflict. One extra read happens on the first profile save after an appearance change. |
| P06-D07 | **Guest choices** survive only the session and are discarded on login (the account's stored values load), matching Android. They are not written anywhere. |
| P06-D08 | **Completion screen.** Android's `completion.tsx` is unused there; here it is the confirmation after Get started (three step dots, then a fourth confirmation) and is the only route that blocks back, so the tour ends deliberately. |

## 5. Verification

Baseline before editing (iOS workspace): `tsc --noEmit` 0, `eslint .` 0, `vitest run` 161/161.

Final: `tsc --noEmit` 0, `eslint .` 0 (no warnings, no suppressions), `vitest run` 190/190 (29 new in `tests/appearance.test.ts`), `expo export --platform ios` 0 (one Hermes bundle). Typed routes regenerated with a short `CI=1 expo start`; the `.gitignore` line it appends was reverted. `app.config.ts`, the lockfile and the shared package are unchanged, so generated configuration and Android/web are unaffected (Android and web were not re-run: nothing they import changed).

New automated coverage: hex validation and canonicalization; HSV round trip for primaries, greys and all 20 presets; WCAG ratios including the handoff's approved 6.43:1 pairing; default/invalid accent leave tokens untouched; for every preset plus yellow, white, black, near-black and gold in both schemes the primary is ≥ 4.5:1 on surface and canvas, its label ≥ 4.5:1, selected rows readable, and success/warning/danger/info and surfaces never change; stored-value parsing and malformed fallbacks; column mapping; the ten font IDs, iOS families, system fallbacks and web-only IDs; custom colors (invalid, preset, case-insensitive duplicate, tenth saved, eleventh refused, removing the selected color); store behavior (session-only, optimistic save, rollback with explanation, ordered writes, superseded change not rolled back, multi-field rollback, no-op); persistence request shape and zero-row, lost-connection and denial outcomes against the real supabase-js builder; the root decision still never routes to the introduction and the step screens share a Skip action.

Not exercised: no screen was rendered, no gesture, slider, VoiceOver, Reduce Motion, Dynamic Type or keyboard behavior ran, and no query ran against a real backend.

## 6. Acceptance status

| Criterion | Status |
|---|---|
| A02-001…A02-014 / T02 (first install, skip/back, interrupted, reduced motion, returning resident) | Implemented; source-verified. Run-time behavior pending device/live check (Skipped OD-06/OD-07). |
| A43-001…A43-035 / T43 (all theme/font IDs, malformed/custom colors, tenth/eleventh, delete selected, relaunch/account switch, contrast) | Met on the non-device standard. A43-017 long-press is replaced by explicit buttons (accessible equivalent). Relaunch/account switch rely on the keyed provider; not run. |
| A50 / T50 shared controls | **Partially met.** Present: required markers, placeholders, keyboards, password visibility, checkmarks, status badges, spinners, skeleton, empty/not-found-capable states, retry, inline errors, alerts, destructive confirmation, disabled-while-busy, press feedback, fade-in, sheets, close button, discard guard, touch targets, labels/states, announcements, avatar initials, peso/date/relative formatting. **Not built (no consumer yet):** character counter on `Field` (Phase 12 description limit), progress bar and countdown (Phases 9/10), search field with clear (Phase 7), segmented control with large-text menu fallback (Phase 11), accordion (Phase 18 Help), transient toast/photo viewer (Phase 12). Per the plan they close in their owner phases; none was added speculatively to avoid unused exports. |
| F04/F07/F12 | Logic covered (rollback, concurrency, rate/offline classification); device/live Skipped. |
| G22 variant evidence | Not met: no rendered default/dark/custom/large-text captures exist (Skipped OD-06/OD-07). |

## 7. Pending manual verification (owner-attended; applies if PR-03/PR-18 are supplied)

1. Fresh install, signed out: confirm account choice is the first screen; open "Take the tour"; step through, use back and Skip at each step; reopen from Settings and Help.
2. Turn on Reduce Motion: confirm no fade; turn on largest Accessibility text: confirm every option stays reachable and nothing clips.
3. Settings → Appearance: switch System/Light/Dark and confirm the tab bar, header, alerts and the date sheet follow; toggle the iPhone appearance while on System.
4. Pick several presets and a custom color; confirm the checkmark, contrast of buttons/links/selected rows in both themes, and that danger/warning/success stay distinct. Try `#FFFF00` and `#000033`.
5. Save ten custom colors; confirm the Add button is disabled and the message appears; remove the selected one and confirm the default returns; cancel a removal; discard an unsaved pick.
6. With VoiceOver: adjust Hue, Saturation and Brightness; use the square's adjust and rotor actions; type a hex value.
7. Pick each of the ten fonts; confirm the face, bold weights, and that Inter/Segoe UI/Tahoma say "system font is used".
8. Go offline, change the accent: confirm it reverts with the explanation; relaunch and confirm the persisted choice; log out/in as another account and confirm no accent/font carries over; as a guest confirm choices reset on relaunch.
9. Confirm the gradient square renders on the target iOS version.

## 8. Out-of-scope observations (not changed)

- Native-stack header titles and tab labels cannot use the selected family (UIKit).
- Phase 3–5 open exits (hosted deploy/invariants, PR-06, PR-10, closed gates) are unchanged.
- The unavailable-configuration and session-restoration screens render before the appearance provider and therefore use the system scheme and default accent.
