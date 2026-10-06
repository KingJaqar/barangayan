# Phase 9 — Integration, cleanup and release

Work in progress, 2026-10-06. Verdict remains **partially complete** until every exit condition has executed evidence. No production deployment or data mutation is authorized. Phase 8 and section I usability changes are permanently excluded.

## Acceptance and evidence checklist

| Action / exit condition | Work and verification | Status |
|---|---|---|
| Complete affected suites and builds | Shared tests/types; Android types/lint/SDK/export/callback tests; both web types/lint/production builds; all SQL suites; Edge function typechecks; iOS score compatibility regression | Pending fresh execution |
| Representative migration rehearsal / data reconciliation | Full ordered chain on empty and synthetic historical databases; compare original requests, fees, payments, IDs, applicants, scores, timestamps and other tenant records; verify 0105 privacy checkpoint before 0106 | Pending fresh execution |
| Full resident-to-administrator journeys / critical flows | Actual local Auth/Storage/REST/RPC and browser journeys covering four services, ID approval/replacement, supporting evidence, review, assessment/waiver, payment, SLA/readiness/release, profile gates and score privacy | Pending fresh execution; native/provider release gates open |
| Code review and obsolete cleanup | Trace supported entry points and contracts; review changed code for unsafe types, duplication, unused branches/dependencies; remove only proven obsolete paths, retain historical and other-tenant compatibility | Pending review |
| Validate setup against staging | Verify exact environment/redirects, Google consent/linking/restarts, scheduler, private storage, export and released consumers on dedicated staging | Blocked: staging target and installed development/signed Android build not supplied |
| Release and recovery runbook | Exact migration/consumer/export checkpoint, preflight, reconciliation, smoke checks, monitoring, stop conditions and forward recovery | Pending |
| No known release-blocking defects | Resolve introduced regressions; record baseline failures; carry open prerequisite gates explicitly | Open Phase 6 provider/native and Phase 7 hosted rollout gates |

## Grounding and boundaries

Read the entire unified plan, root and web AGENTS instructions, exact Expo SDK 57 reference, and installed Next.js 16.3.0 documentation before editing. Installed Node is 24.13.1. Highest migration is 0106; no new schema requirement has yet been established. Existing uncommitted Phase 7 work, Android restoration and auth recovery work are preserved; task evidence records baseline file hashes.

Docker Desktop read access initially failed in the sandbox; elevated inspection succeeded (29.8.1). The existing `barangayan-phase1` WSL Docker stack is accessible and contains synthetic local Supabase services. It is not staging. Tests must verify named container/ports and synthetic fixture provenance, never use hosted environment credentials, reset that stack, or delete its existing resources.

Earlier plan completion reports are supporting records, not proof of current behavior. Phase 6 explicitly retains unverified real provider/linking and installed development/signed-release callbacks. Phase 7 local completion does not prove hosted score isolation. Migration-history repair is separately recorded through 0104; this task does not authorize replay or hosted migration application.
