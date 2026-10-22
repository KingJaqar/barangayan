# Phase 0 context index — resident web

October 21, 2026 (Asia/Manila). [Baseline/decisions](baseline.md); [acceptance procedures](acceptance-coverage.md); [actual verification](verification.json). Shared workflow rules remain centralized in web plan Section 6.0. This index records source evidence, not completed product behavior.

## Identity and reuse

| Input | Current validation / reuse boundary |
| --- | --- |
| Historical nine-entry web XML | `tmp/family-web-plan-20261021/web-source.xml`, SHA-256 `8668E8E3EDDA7A5DE3C2230698EF3833ACC950332E50020382F288EBA609A07B`. All nine source hashes and normalized entry/original equivalence passed again; prior complete reads reused. Family route/content, household QR loader, roster hook, legacy writer and completeCheckIn findings remain valid. |
| CAS supplement | `tmp/family-web-plan-polish-20261021/conditional-save.supplement.xml`, SHA-256 `359D33F9FE16946ED98A16D35F75DFFE5C0F3220A480785B74038520E937E12A`. Source/packet equality passed; original 0123 read completely this session, 1–118. Raw expected JSON/canonical return/30-member cap verified. |
| Shared contracts/evidence supplement | `tmp/family-web-plan-polish-20261021/shared-phase0.supplement.xml`, SHA-256 `97A77B7CE0268DE81474881E5C53805BE8FFCF07BF9103B8E530415E9FA3A52B`. Both entries match originals. Contract 1–100 read completely in bounded ranges; previous verification is discovery evidence, never a product pass. |
| Shared source/read index | 58 source rows rehashed. The two already-changed plan/index rows were not reused as current implementation evidence. 56 matching rows supported historical source findings; later concurrent Phase 1 changes are external and require new verification. See reuse-validation.json and source-observations.json. |
| Dependency identities | versions.json records exact lock SHA-256 and installed/locked package versions: Next 16.3.0; app-local React/DOM 19.2.8 (root 19.2.3); Supabase JS 2.112.1, SSR 0.12.4; qrcode.react 4.2.0; html5-qrcode 2.3.8; Zod 3.25.76; web TypeScript 5.9.3, root 6.0.3; Vitest 3.2.7. Resolve from each app; root React is not its version. |
| Hosted functions | Six definitions freshly retrieved and compared with shared Phase 0 catalog sources, unchanged after CRLF normalization. hosted-source-comparison.json records signatures, ACLs, definition hashes, RLS and trigger/FK metadata. Read-only observation, not an authenticated-role test. |
| External shared candidate | Android **Implement Phase 1** owns CLI-generated migration 20261021111056 and its isolated DB. Changing source, incomplete validation; do not reuse as a completed prerequisite. No new shared implementation owner is assigned to the web track. |

## New packet/read ledger

Cached Repomix **1.18.1** was resolved once this execution. Both new packets are parsable XML, uncompressed, security enabled and passed, with explicit credential/dependency/runtime/old-packet exclusions. All selectors were reconciled with the actual manifest; no omissions. Local ElementTree parsing supplied the Reader role; each range is at most 12,000 characters and 200 lines. No missing continuation remains. Packet source equivalence was checked before documentation editing and again at closure.

| Packet / exact ledger | Entries / completed reads | Requirement findings |
| --- | --- | --- |
| `tmp/family-web-phase0-20261021/web-context.xml`; packet-manifest.json; read-ledger.json | 11 entries / 15 ranges. Profile form 1–200, 201–400, 401–600, 601–761; scanner 1–200, 201–241; QR show 1–180; upload 1–133; AuthGate 1–34; scoped read 1–97; optional user 1–67; sign-out 1–50; browser client 1–13; server client 1–42; household feedback 1–34. All read, no compression gaps. | Shared Profile CRUD retains drafts and owns terminal feedback (294–400); scanner/upload both write (124–130 / 83–89); existing QRCodeCanvas is center-specific; guest gate stays inline; generation cancellation lacks timeout/coalescing; account/session checks require Phase 3 work. |
| `tmp/family-web-phase0-20261021/deadline-supplement.xml`; deadline-manifest.json | 2 entries, auth-fetch 1–13 and tests 1–39, completely read. | Auth-only deadline bypasses REST; existing test explicitly covers that. pilotOptions original 1–36 confirms explicit 15-second abortSignal and retry(false), usable as pattern for future attendance requests. |

The main supplement reports 21,665 artifact tokens / 84,837 characters. These are generator estimates, not actual model usage or demonstrated savings. The complete Profile source was larger than the narrow household section; no unrelated implementation changes follow from that read.

Original-source closure additionally inspected: admin route 1–29; table updateField 77–114 and boolean editor 181–205; record-config household fields; 0115 archive guard 99–112; 0129 mutation lock/household branches via bounded symbol matches; 0130–0133 dynamic mutation modifiers via discovery; shared household/emergency schemas completely; QR Edge source completely; deployed QR/delete/export bodies completely (138/129/120 lines); current hosted v1/v2 erasure bodies completely. Canonical unmodified shared migrations/lifecycle callers were reused only by verified source identity and linked previous read ranges. The concurrent attendance migration was inspected only for file identity and signature/table/grant discovery; its bodies and behavioral acceptance are **not** adopted.

Initial oversized combined discovery output was not credited as a complete read. Required entries were subsequently extracted with explicit ranges above. Diagnostic helper failures (optional absent ledger ranges, list-shaped catalog envelope, and Windows stdout encoding) were diagnosed and corrected; they are evidence-tool issues, not application regressions. Existing packet/source bytes, omitted outputs, and raw diagnostics remain available in the local recovery root.

## Verification and pending environment work

- Baseline structural/source checks: `python tmp/family-web-phase0-20261021/audit.py baseline`, 25 passed / 0 failed before plan edits. Exact results: baseline-verification.json.
- Web typecheck, web lint and the existing three Auth fetch tests: actual commands/exits/log locations are in verification.json. No app source was edited, so valid results are reused while its candidate identities match; do not rerun unchanged commands merely for reassurance.
- Final document/packet/source/other-phase checks: `python tmp/family-web-phase0-20261021/audit.py final`, recorded in verification.json; recoverable documentation delta in `tmp/family-web-phase0-20261021/plan.owned.diff`.
- Live hosted catalog and Edge/log discovery were read-only. Docker inventory escalation succeeded after sandbox denial. Local default DB is behind at 0117, so an engine health result is not proof of current-migration readiness. Do not use the other chat's active database for independent work.
- Browser Family/private QR behavior, staff camera and runtime console checks are pending; exact steps are A14–A16 in acceptance-coverage.md. No app build, mutation/concurrency test or deployment result is claimed here.

No unresolved product-contract question prevents this phase's discovery handoff. Revalidate changing backend/source/environment identities before the dependent phase; authorization limits and manual release gates remain in force.
