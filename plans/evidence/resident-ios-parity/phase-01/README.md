# Phase 1 — Expo SDK 57 native foundation and six-destination navigation (`P01`)

**Status (amended 2026-10-14, OD-06):** In progress — only P01-T02's approved URL scheme/OAuth callback (PR-03) is open. Owner decision OD-06 (supersedes OD-04) skips signed builds for the whole plan: T01 and T03–T05 are Verified (non-device scope), T06/T07 are Skipped, and PR-02/PR-04/PR-05 are no longer required. Earlier status, kept for history: In progress — Blocked at the exit. JavaScript/configuration work for T01–T05 is implemented and verified on this host (typecheck, lint, tests, iOS export, config introspection); the signed development build, native spikes (T06) and device qualification (T07) are blocked by PR-02, PR-03, PR-04, PR-05 and PR-18. Started 2026-10-14. **Owner decision 2026-10-14 (OD-04, choice "C"):** the signed build is deferred; the exit stays Blocked until a build route and the PR-02/03/04/05/18 inputs are supplied. Phase 2 work that needs no device may proceed meanwhile.

**Entry dependencies:** Phase 0 (Verified 2026-10-14).

**Lead owner role:** iOS lead + Apple/EAS owner + design. **Named owner:** KingJaqar (decision-register OD-01).

**Required working deliverable:** Signed SDK 57 development build, six native destinations/stacks and qualified component/native capability baseline.

| Task | Status | Blocker / next step |
|---|---|---|
| P01-T01 | Verified (non-device scope, OD-06) | Xcode qualification Skipped; P01-D04 drift recorded, non-blocking |
| P01-T02 | Blocked (PR-03 only) | `eas.json` profiles kept unused; bundle ID/EAS/signing Skipped (OD-06); approved scheme/OAuth callback needs PR-03 |
| P01-T03 | Verified (non-device scope, OD-06) | Device More/stack qualification Skipped |
| P01-T04 | Verified (non-device scope, OD-06) | Setup/callback routing continues in P04; PR-18 for backend tests |
| P01-T05 | Verified (non-device scope, OD-06) | VoiceOver/Dynamic Type/contrast device proof Skipped |
| P01-T06 | Skipped (OD-06) | Native spikes need a signed build |
| P01-T07 | Skipped (OD-06) | Device qualification needs a signed build |

## Evidence

- [P01_2026-10-14_implementation-and-verification.md](P01_2026-10-14_implementation-and-verification.md) — changes, baseline vs final checks, checkpoint statuses, decisions P01-D01…D06, blockers.
- [P01-T06_2026-10-14_native-capability-matrix.md](P01-T06_2026-10-14_native-capability-matrix.md) — capability matrix prepared; no spike run.
- [P01-T07_2026-10-14_device-qualification-protocol.md](P01-T07_2026-10-14_device-qualification-protocol.md) — device steps pending manual verification.
