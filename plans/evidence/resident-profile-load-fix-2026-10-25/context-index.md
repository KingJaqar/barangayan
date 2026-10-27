# Profile loading fix: context index

25 October 2026, Asia/Manila. Scope: diagnose the observed Complete Profile error and fix directly related profile/locality initialization defects. Earlier keyboard/Maps changes belong to the existing working copy. No commits, remote writes, account changes or new dependencies.

## Execution checklist

- [x] Git working-copy baseline and recoverable patches/snapshots; identify existing ownership.
- [x] Narrow ripgrep discovery: form, setup consumers, shared auth/setup contracts, locality schema/policies and tests.
- [x] Validate existing keyboard context; confirm current implementation and dependency versions against original sources.
- [x] Read applicable instructions and version-matched documentation; run baseline checks before production edits.
- [x] Generate scoped cached Repomix1.18.1 XML, read all required entries in bounded chunks, resolve compression gaps in original sources.
- [x] Reproduce native failure, implement minimal fix, test related failure/cancellation/tenant boundaries, review owned diff.
- [x] Record actual verification and remaining native resident-account limitation; preserve other work.

## Baseline and reusable identity

`source-manifest.json` records27 initial nonsecret source snapshots, selectors, hashes and versions. Recoverable files and staged/unstaged patches are in `tmp/resident-profile-load-fix-20261025/before`, `staged.txt`, `unstaged.txt`; initial full status is `status.txt`. Existing keyboard Profile/password/ID/charter and Maps/Centers/test bytes were captured and are preservation gates, not owned changes. Root AGENTS is empty; CLAUDE references it. No nested mobile/shared instructions were found. Resident-web rules were read; no web source was edited. No repository-rule conflict.

Two additional shared account-setup files were initially Git-clean and read before modification. Their original bytes were later recovered from HEAD into `before` for the compiler comparison; these are not represented as pre-edit copied snapshots. The keyboard plan was copied to `before-keyboard-plan.md` immediately before this follow-up note. Only Phase2 status/progress was changed.

Installed versions: Expo57.0.10, RN0.86.2, React19.2.3, Supabase/PostgREST2.112.1, Zod3.25.76; mobile TypeScript6.0.3, resident-web TypeScript5.9.3. Package manifests/lock remain unchanged. Environment/session secrets were excluded from packets and snapshots. Live diagnostic output records only account role, deletion/matching booleans and HTTP statuses, not profile identifiers/values/tokens.

## Packet coverage and read boundaries

| Packet | Identity / required reads | Analysis |
|---|---|---|
| `context.xml` | `packet-manifest.json`; SHA25632b2492c42f33e98a6f5eeec76981030b695bfa8218d9758f81c75c54c7fac39;17 entries,23594 decoded characters. Complete extraction ranges [0,11000), [11000,22000), [22000,23594). | Form, routes, setup request ownership, shared auth/test, schema, map/profile hook and web registration consumer established before edits. |
| `intermediate-context.xml` | Superseded intermediate packet; not used as final analysis. | Retained for provenance; do not reuse its stale setup-status implementation. |
| `final-context.xml` | `final-context-manifest.json`; SHA256d1a94211dfa6e2388212285d44689a44aec4e767a83e132b08e9d97286aa9a5d;6 entries,10075 decoded characters; complete extraction [0,10075). | Final three production owners and three affected/new test files. |

Selectors and actual entries are explicit in the manifests. Required entries were read completely; no silent continuation was omitted. Cached pinned generator's security scan remained enabled and passed. Lockfile/generated database types were snapshotted and directly inspected as needed rather than collected in the XML. Compression omitted function/test bodies: initialization, save ownership/CAS, errors, cleanup, shared queries/classifier and all new test bodies were checked in original source and executed. No packet token count is claimed as measured usage savings. Repowise was unnecessary; bounded Reader validation used the local `read.cjs` extractor.

## Verified source findings

- `resident-details-form.tsx`: full original owner read; final initialization201–238, submit guard240–241, loading283–287 and actions460–468 reviewed. The old catch-all masked the local role guard after successful API reads. Existing SetupOwner generation and snapshot/CAS save logic retained.
- `resident-auth.ts`: final110–141 reviewed. New explicit-barangay option matches database completion's profile tenant; new profiles retain the configured enabled-locality contract. Shared AbortSignal covers both reads. Missing/ambiguous configuration fails closed; a present barangay with null advisory polygon remains valid.
- `resident-account-setup.ts`: classifier34–47 and getter58–70 reviewed. Actual PostgREST response status is separate from its error object; HTTP401 now survives wrapping and requires fresh sign-in.
- `complete-profile.tsx`, `account-setup.tsx`, profile hook, web registration consumer, shared exports, setup schemas, database types and resident completion migrations were inspected for callers/contracts. Existing admin/staff route intentionally resolves to existing access; resident-only SQL mutation guards remain unchanged.
- Native caught exception: `This account cannot complete resident setup.` Profile/locality/boundary each returned200 with data; active account role admin, not deleted. Locality/profile tenant match. Root cause is client error classification, not absent data or demonstrated RLS/network failure.
- Read-only database review: configured locality exists with linked boundary, expected SELECT privileges/policies present. Existing unrelated security/performance advisories recorded separately; no remote change warranted for this symptom.

## Verification index

Baseline mobile type/lint and59 auth/setup tests passed before production edits. Final logs in `logs`:586 shared tests/38 files,335 mobile tests/32 files, mobile type/scoped lint, resident-web installed5.9.3 typecheck, six real-form browser groups, unchanged Settings/Profile browser regression and Android JS/Hermes export pass. `shared-type-comparison.json` records baseline6/current6/new0 diagnostics. `native-verification.json`, `final-source-identity.json` and `live-helper-verification.json` record native admin UI/navigation,29/29 source checks and actual helper's public readonly API checks. `final-audit.json` records owned hashes and user-work preservation.

Browser fixtures explicitly adapt native/network boundaries; these do not claim a native resident-account save. Native before/after console issue sets match; an existing buffered push-token warning remains. Export retains existing tooling color warnings and does not establish native APK qualification. No repeated check was used to hide a diagnosed failure; intermediate fixture resolution/build failures were corrected against actual source imports before successful execution.

## Acceptance and remaining boundaries

Root-cause reproduction, accurate account/session/config/transport handling, conditional retry/loading, explicit own locality, stale-response/unmount/deadline cleanup, safe blocked form and preservation of auth/RLS/CAS/account styling are met by source plus tests/native evidence. A valid-resident native completion/save remains pending manual verification: use a designated development resident account, open required setup and optional Complete Profile, verify populated own locality and readonly email/city, exercise retry after temporary network loss, navigate away/back, and complete the approved test-account save. No production-role alteration is needed. Earlier Phase2 keyboard field/device/iOS acceptance remains pending as separately documented; this fix does not promote it to Complete.
