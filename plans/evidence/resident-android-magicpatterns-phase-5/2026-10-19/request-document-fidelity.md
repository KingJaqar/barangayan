# Request Document — owner screenshot correction

19 October 2026, Asia/Manila. The owner's three attached Magic Patterns screenshots and matching retained v32 RequestDocument/FileField/OptionSheet/Button/ActionFooter source govern this correction. Earlier Phase 5 form screenshots do not establish fidelity for the corrected screen.

## Corrected presentation

- 21/26 title, fee badge and required-field hint on one wrapping metadata row; 20dp outer rhythm.
- Resident panel uses an outline icon, text-only Edit in Profile action with a 44dp target, and indented resident line.
- Approved-ID panel uses a shield icon, 108×72 contained thumbnail beside identity/type/version, and full-width Refresh verification with refresh icon. Both existing ID sides remain visible when provided. Existing refresh height retention remains intact.
- Purpose is an unboxed label and full-width 48dp gray selector with trailing chevron. The resident purpose sheet has the source's 19px bold heading, 36dp close surface, divided 56dp option rows and 24dp ring/dot selection indicators. Its open/close/pan/Back handling and motion are unchanged.
- Upload cards use 40dp accent-soft icon tiles, 16dp padding and subtle source shadow. Toggles use contiguous divider rows; notes are a standalone label and 94dp-minimum textarea. Business/CTC/Other fields remain standalone fields with all current limits/validation.
- Fee/action footer uses the source hierarchy, full-size button, subtle form-specific borders and disabled presentation. Shared buttons/fields have an explicit opt-in requestForm appearance; all other consumers retain defaults and the owner's existing compact variant.

Only four application presentation files changed: charter-request-form.tsx, purpose-sheet.tsx, primary-button.tsx and text-field.tsx. No route/header, guide, legacy form, theme preference, data helper, backend/API/schema/permission or business-rule edits. No dependency/asset added. A byte comparison proves the entire CharterRequestForm state/effect/validation/picker/submit-controller region before `const upload` is unchanged. All existing field bindings, error messages, attachment actions, submit guards and destinations remain.

The reference disables Submit using prototype validation. This correction intentionally preserves the real application's existing enablement/validation guards as required by the owner's frontend-only instruction; it does not copy mock submission logic. Stored accent/font preferences, native Switch mechanics, both ID sides, dynamic wording/fees and Android safe areas remain explicit native/data adaptations. Simulated phone status/home-indicator chrome and the reference's fixture identity are not copied into production.

## Verification

| Check | Result |
|---|---|
| Lint baseline/final | Pass: zero errors, same four pre-existing duplicate-import warnings |
| Types baseline/final | Same pre-existing Home index.tsx:116 TS2345 route error; no new diagnostics in changed files |
| Existing document-forms-ui baseline | Pre-existing failure: guide requirement text assertion; original fixture and guide left unchanged |
| New Request Document fixture | Five groups pass, zero console errors/warnings; light composition/ID geometry/text action, purpose selection, textarea/dividers, refresh height and drafts, picker cancellation/renter evidence, one attempt after five rapid clicks, 320/360/400/412 widths, dark/extreme accent, Business/DTI/job-seeker/general/CTC large values |
| Existing Android units | Pass: 22 files / 243 tests |
| Android Hermes export | Pass, final source |
| Native observation | Final updated CTC form observed on MuMu serial 127.0.0.1:16384; title/metadata, resident panel, side-by-side real test ID and footer render. Bounded filtered error log empty. Native purpose-sheet/scroll/keyboard/Back/theme/font/motion matrix remains unverified. |
| Scope/whitespace | Pass; existing user edits preserved; data/controller region unchanged |

Evidence: [execution logs/audit and synthetic screenshots](../../../../tmp/resident-android-magicpatterns-phase-5-fidelity-20261019/), [final native CTC screen](../../../../tmp/resident-android-magicpatterns-phase-5-fidelity-20261019/native-final.png). Browser images use synthetic account data and icon/platform adapters; they qualify layout/interactions, not native icon/font or motion accuracy. The native capture uses the existing test account, without native tapping or a real submission.

## Context and recovery

Current root AGENTS remains the preserved empty user edit; CLAUDE references it; no nested applicable instructions found. Expo v57 Image and RN 0.86 Pressable/TextInput/ViewStyle boxShadow pages were read before using their APIs; previous unchanged controller/motion/contract context was reused.

Pinned cached Repomix 1.18.1 produced security-clean parsable compressed before/final packets under `repomix output files/phase-05-request-fidelity.{before,final}.xml`: eight/nine actual files, 3,080/3,260 artifact-token estimates. Extracted/read all relevant XML text in single bounded chunks of 8,763/9,283 characters; originals supplied omitted effects, handlers, bindings and styles. Selectors and provenance are retained in logs and the execution audit. Old source packets intersecting these four files are historical. Current guidance is shared-guidance.phase-05-request-fidelity.xml; supporting documents are unchanged and reused by hash.

Saved real working-copy status/patches and form/sheet/button originals before edits. TextField was clean in the saved baseline status/patch; its pre-edit source was recovered from HEAD only after reversing the three owned presentation edits exactly reproduced that clean source. This recovered text is normalized, not claimed as an original raw-byte snapshot. `owned-source.patch` contains only this follow-up's four file deltas; remove the new focused fixture only if later work does not use it. Reconcile overlapping subsequent edits; do not restore complete files from HEAD or reverse prior phase/user work.

Remaining native checks: compare Indigency top/scrolled/purpose-sheet states directly with all three owner screenshots, including Other/renter/error states, native Switch/keyboard/Back, selected fonts and dark mode, compact widths/large font scale and measured M04/M12 motion. Preserve earlier Phase 5 native/integration gates as pending; do not claim every pixel/state has been verified.
