# Phase 3 context index — 25 October 2026 (Asia/Manila)

Scope: W8 A08 Profile family, A09 Emergency Info and /drrm family, A10 custom hex, B32 resident deletion presentation; shared sheet regressions. No later phases, destructive submissions, commits, remote changes or dependencies authorized.

## Checklist and workflow

- [x] Git baseline: 79 nonsecret snapshots in tmp/resident-keyboard-phase3-20261025/before; status, staged/unstaged binary patches saved alongside. baseline-manifest.json records working-copy hashes. All prior edits belong to user, including profile, family-content, birthday and motion changes. Sensitive environment/runtime data excluded from packets.
- [x] ripgrep discovery: direct current owner/caller searches; no Repowise index assumed. Root AGENTS.md empty, CLAUDE.md references it; no nested instructions for this app, plans or shared package and no ancestor instructions. No conflict.
- [x] Reader validation: read full implementation plan/context/protocol, Phase 0/1 reports and local prototype patch; Phase 1 was explicitly a reverted local prototype, not shipped code. Current Delete wrapper remains Android undefined. Profile/ID/password/charter Phase 2 owner changes exist but are not prerequisites for W8.
- [x] Scoped cached Repomix 1.18.1: selectors in tmp/resident-keyboard-phase3-20261025/repomix.json; 19/19 files present including empty AGENTS.md, security scan clean. context.xml SHA and file counts in packet-manifest.json. Tool estimate 8,248 tokens is not actual usage.
- [x] XML fully analyzed in decoded character ranges [0,11000), [11000,22000), [22000,30457), final continuation null. Compression omits render/effect/handler bodies; source verification below resolves those gaps.
- [x] Original source: Delete 1–221 complete; SettingsSheet 1–67; ScanFamilySheet complete; FamilyMemberModal complete; custom color complete; TextField 1–125; Profile MemberModal 441–488; Settings deletion gates and confirmation handlers; report/DRRM/reduced-motion hooks complete. Callers found with ripgrep: Profile options, ID type, birthday; QR show/center picker, household QR, permission picker. No unsupported API inferred.
- [x] Documentation before code: Expo v57 reference and app config, Expo keyboard guide; RN 0.86 KAV, ScrollView, Modal docs. Installed package manifest: Expo ^57.0.10, RN 0.86.2, React 19.2.3. Bounded viewport and platform-specific behavior confirmed. Guide's optional global pan example is not applicable: plan requires existing resize.
- [x] Baseline: TypeScript, source ESLint, 335 tests/32 files, Settings/Profile browser fixture and Android JS/Hermes export pass. Exact commands/times/exits and full logs in logs/. Export is not a native APK build.
- [x] Native baseline: MuMu emulator-5554, API32, 1080×1920; resize verified in Modal and activity. B32 editor y975–1119; secure IME y1080; overlap39px; actions y1191–1349 covered. Raw screenshots/dumps stay in ignored tmp; environment and source identity recorded separately.
- [x] Candidate subsets, shared browser regressions and sampled console review recorded. Full W8 native matrix remains pending, explicitly listed in ledger.md/report.md.
- [x] Final-after-both-fixes checks, owned diff and source preservation audit completed; only selected Phase3 progress/status updated.

## Requirement classification before editing

| Requirement | State | Evidence / remaining work |
|---|---|---|
| A08 Settings family and A10 color | Partially done | Existing height owner, shrinking body/footer/safe areas; full native add/edit/color/configuration protocol pending |
| A09 emergency family | Partially done | ScanFamilySheet height, busy guard, mounted/onShow/measured motion, picker/slide variants exist; both routes pending |
| B32 Delete Account | Not started | Baseline overlap reproduced; earlier prototype reverted. Qualify minimal Android height branch, then check compact/error growth scroll constraints |
| Already-open IME, mount, error, close/reopen | Partially done | Existing motion cleanup/input reset/guard logic; native evidence required |
| Shared selection/birthday/QR/permission consumers | Partially done | No shared edit planned; native smokes pending; browser Settings/Profile passes |

## Sources and discrepancies

Source identities: baseline-manifest.json; packet identities: packet-manifest.json; native loaded factories/map comparison: baseline-source-identity.json. Prior source analysis is historical, not proof of current acceptance. Plan's overall “no dialog fix” remains true at baseline; its current-phase progress will supersede that header without rewriting other phases. Phase 1 already qualified the mechanism although Phase 3 prose says it is unproven; current reproduction is still required and recorded.

Initial restricted ADB/local-loopback calls could not reach host services; ordinary reviewed elevated host calls succeeded. No safety barrier bypass or device setting changed. ADB native controls are used under the plan's explicit section9.0 workflow, not Windows UI automation. UI capture immediately after opening the resident modal briefly showed the underlying page; fresh focus capture resolved it, so that initial dump is not geometry evidence.

## Native test interpretation updates

Current 29/29 loaded module factories and source-map originals match candidate source after a clean reload (candidate-source-identity.json). Existing push-token warning remains the monitored issue class. B32 default input/actions/typing/eye toggles and three exact restoration cycles pass; A08 default add passes three cycles, A09 add passes Emergency Info and /drrm, A10 default focus/actions/restoration passes. These are subsets, not full-protocol passes.

Harness corrections: custom-color Add is horizontally beyond20 swatches; vertical searches and an8-step horizontal attempt were insufficient. Reading ScrollableChevronRow/horizontal relationships resolved discovery. Hex field's visible bounds grow from117 to134px on focus; an equality assertion incorrectly called this clipping. Corrected assertion permits expansion but rejects shrinkage. A subsequent synthetic hex replacement did not change the original value; native paste/edit acceptance remains unresolved rather than passed.

The earlier inference of an active focus-loss recurrence was too strong: full input-focus.txt shows current Input Dispatcher focused on MainActivity with result OK, while a later retained last-ANR state contains FocusedWindows:none/NO_WINDOW. The plan's historical Modal focus issue is not newly proved by that string alone. A08's disappearing editor and failed hex replacement remain precisely observed test gaps, without a new cause claim.

### Final changed context and acceptance boundary

The later compact A08 failure screenshot resolves one missing-editor case: Gboard's font-update banner reduces usable height until fixed family header/footer consume the body. That observation justifies the second product change, Android family-only full-panel scrolling. It introduces no additional avoidance owner or keyboard-height subtraction. The candidate passes compact focus/typing/action reachability and three restoration cycles, but its IME top927 differs from the transient-banner case, so that exact comparison remains pending. Final native loaded identities match29/29 sources after clean reload.

Final full XML supplements are one entry each: final-owner.xml read completely in[0,8519), final-sheet.xml in[0,5233), continuation null. Their manifests record packet hashes and counts; selectors are the two confirmed changed owners, default security checks clean. The original19-entry packet remains historical baseline context; changed owner entries are superseded by these complete supplements. Final source hashes are in verification.json/preservation.json. No packet estimate is claimed as actual model usage.

Actual final checks after SettingsSheet changed: TypeScript/source ESLint/335 tests32 files/Android export/SettingsProfile14 groups pass. Expanded actual-component fixture16 groups passes loading/rejection/close and compact Android family scrolling; DRRM13 groups on unchanged owner passes. Its first supplemental build duplicated an existing Platform mock export, corrected before the passing run; no application fix was made for that harness error. All non-owned source hashes are unchanged. iOS and non-family layout branches retain the prior hierarchy/styles/callbacks; native iOS not run.

Ctrl+A/Copy did not select the synthetic local member; Paste used synchronized host clipboard. The local unsaved draft was discarded by cold restart and Profile reopened clean/Save disabled. No native domain save occurred. Exact selection/paste and unavailable A09 saved-member edit states remain pending. Device settings restored and final Home/IME hidden verified. See report.md, ledger.md and verification.json; Phase3 is Partially complete, not a full native pass.

After restarting the app, ADB's8081 reverse was absent. Restored the local development mapping, reloaded, and reverified source identity; no service configuration changed. First compact attempt returned to launcher after display settings; second included app restart but failed at native UI dump. Neither observed dialog geometry. Original1080×1920/480dpi/font1.0/navigation0/disabled navigation overlays were restored. Compact evidence is being completed using fresh observations and bounded capture retry (second attempt compressed), not by rerunning an unchanged failing command.

Docs: https://docs.expo.dev/versions/v57.0.0/ ; https://docs.expo.dev/versions/v57.0.0/config/app/ ; https://docs.expo.dev/guides/keyboard-handling/ ; https://reactnative.dev/docs/0.86/keyboardavoidingview ; https://reactnative.dev/docs/0.86/scrollview ; https://reactnative.dev/docs/0.86/modal .
