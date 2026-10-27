# Phase 3 compact context index — 26 October 2026

Current scope: W8 A08–A10/B32 and shared sheet smokes only. Status: Partially complete. Current findings/acceptance: [report](report.md), [verification](verification.json), [ledger](ledger.md). Historical completed reads and baseline findings: [25 October index](context-index-20261025.md). Shared protocol remains centralized in plan9.0–9.4.

## Checklist and reusable context

- Git baseline/preservation complete:79 nonsecret snapshots, binary/staged patches and working-copy manifest; all non-owned source hashes still match. Existing changes belong to the user. Sensitive runtime/environment inputs excluded from context packets.
- ripgrep/source discovery complete; root AGENTS.md empty, CLAUDE.md references it, no applicable nested/ancestor rules or conflict. Phase0/1 prerequisites verified in current code/evidence; Phase1 prototypes were reverted, not shipped fixes. No Repowise freshness assumed.
- Dependencies verified: Expo57.0.10, RN0.86.2, React19.2.3, TS6.0.3, safe-area5.7.0; manifest/lock unchanged. Expo57 reference/config/keyboard guide and RN0.86 KAV/ScrollView/Modal read before edits; bounded-scroll docs reconfirmed before the custom-color extension.
- Original owners, consumers, motion/cleanup, text/validation/security handlers read completely or at recorded scoped ranges in the historical index. Latest SettingsSheet full source and owned diff rechecked; no unresolved compression gap. Native final29/29 factories and source-map originals match working sources, including both changed owners.
- Baseline and post-family checks reused unchanged. After the additional two-line SettingsSheet condition change, type/lint/unit/UI/export ran once; all exit0, same2 baseline lint warnings. Expanded16-group fixture passes. DRRM13-group result retained because that owner did not change. Exact logs/commands in verification.json.

## Packet identities and completed XML reads

| Packet | Scope/read boundary | Identity/notes |
|---|---|---|
| context.xml |19 confirmed files, decoded[0,11000),[11000,22000),[22000,30457) |packet-manifest.json; historical baseline; compressed bodies verified in original source |
| final-owner.xml |Delete full entry[0,8519), continuation null |final-owner-manifest.json; unchanged current owner |
| final-sheet.xml |SettingsSheet full entry[0,5233), continuation null |Historical family-only candidate, superseded for this owner |
| postcolor-sheet.xml |SettingsSheet only, full decoded[0,5267), continuation null |SHA256 b6298c078810a8a9d6fe557fc03f0673dd6a9b68bd2351bd3c4e07dea1a59efa;1/1 intended file included, security clean; no omission |

Current source hashes are recorded in verification.json; packet manifests distinguish packet identity from source identity. All packets use cached Repomix1.18.1 with security/exclusions preserved. Estimates are not actual model usage. No unchanged packet was regenerated merely to reread it.

## Changed facts / unresolved questions

- SettingsSheet's Android family and default appearances both reproduced header/footer body collapse; both use the same existing full-panel scroller. Profile choice appearance/iOS hierarchy is retained. B32 uses its existing owner with Android height. No new dependency or global mode.
- Current native Add/Edit/local-origin/paste/reopen/configuration evidence is listed in report.md and verification.json. At usable height579, full164px input remains visible but border clearance is0; exact Gboard banner not forced. Larger-display Remove cycle1 was clipped; cycles2/3 establish full reachability. No cropped observation is a full-button pass.
- A09 saved-member Edit requires an existing member; none exists in the active account. Valid ID birthday wheel requires uploaded-photo review; no authorized uploaded state available. Native A10 duplicate/limit and B32 rejection/busy geometry also remain unobserved. Controlled browser coverage cannot close those native gates.
- Setup failures are preserved in raw ignored tmp and named evidence; normal desktop pointer/content-area gestures resolved input/navigation methods without weakening guards. No cause beyond observed error/state is inferred. Latest sampled console records use resume-*-console.json.
- Final cleanup verified: clean Profile, Home/IME hidden, original display/font/navigation/camera flags. Native APK revision unknown; no native iOS/release certification. No external write/upload/destructive submission authorized or performed.
