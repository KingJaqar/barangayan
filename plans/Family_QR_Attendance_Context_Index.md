# Family QR Attendance — Compact Context Index

Updated: October 22, 2026 (Asia/Manila). Scope: Phase 1 backend complete; Phases 2–3 implementation/local gates met, with full authenticated staging and physical-camera verification pending; Phase 4 local execution complete; actual staging/hardware/Auth/data-reconciliation gates remain. Pushed 0139→0141 final local schema independently verified (480 SQL); latest hosted static catalog inspected. Native nine flow groups and 320dp/130% text pass; remote/physical checks pending by user direction. Deployment remains unauthorized. Shared execution rules live in [plan Section 6.0](Resident_Android_Family_QR_Attendance_Implementation_Plan_2026_10_21.md#60-shared-execution-workflow--mandatory-for-every-phase). The plan was renamed at the user's request; historical packet selectors below retain the original name.

Update changed facts in place. Add a small row only for a new source, packet, question, or result. Do not copy full logs or prior narratives here. The index is a navigation and evidence ledger, not proof of correctness.

## Phase state

| Phase | State | Prerequisite / next evidence |
| --- | --- | --- |
| Planning revision | Documentation reviewed; structural checks recorded below | Current user requirements incorporated; no product behavior verified. |
| 0 — Baseline/contracts | Complete — discovery/contracts only | [Baseline and gate evidence](evidence/family-qr-attendance/phase-0-2026-10-21/baseline.md); [resolved contracts](evidence/family-qr-attendance/phase-0-2026-10-21/contracts.md). Linked hosted project compared read-only. Phase 1 requires a healthy isolated PostgreSQL 17 database. |
| 1 — Backend | Complete — backend only | [Implementation, acceptance and handoff](evidence/family-qr-attendance/phase-1-2026-10-21/README.md); [candidate/check identities](evidence/family-qr-attendance/phase-1-2026-10-21/verification.json). Isolated PostgreSQL 17.6 gates passed; UI/device/release gates stay in later phases. |
| 2 — Admin | Partially complete — implementation/local gates met | [Phase 2 independent review and acceptance](evidence/family-qr-attendance/phase-2-2026-10-21/README.md), [20 current candidate identities/check logs](evidence/family-qr-attendance/phase-2-2026-10-21/verification.json). Physical displayed Android QR and real staging Auth/navigation remain pending. |
| 3 — Android/cutover | Partially complete — implementation/local gates met | [Phase 3 report and manual gates](evidence/family-qr-attendance/phase-3-2026-10-22/README.md), [source/check identities](evidence/family-qr-attendance/phase-3-2026-10-22/verification.json). Native local QR/status and conditional saves plus resident legacy cutover implemented; real staff-to-Android staging roundtrip and physical camera pending. |
| 4 — Release readiness | Partially complete — local execution complete | [Phase 4 report](evidence/family-qr-attendance/phase-4-2026-10-22/README.md), [identities/checks](evidence/family-qr-attendance/phase-4-2026-10-22/verification.json), [rollout/recovery](evidence/family-qr-attendance/phase-4-2026-10-22/rollout-recovery.md). Pushed 0140 restores attendance after 0139, 0141 restores receipt export access; final local schema passes 480 SQL assertions and native supplement. Actual target/Auth/physical/full-native/data-reconciliation gates remain. |

## Ownership and recoverable baseline

- Phase 0 owned changes: only plan Section 6.1, Phase 0 facts in this index, `plans/evidence/family-qr-attendance/phase-0-2026-10-21/`, and local `tmp/family-attendance-phase0-20261021/` evidence. Recoverable pre-edit plan/index copies, status and existing-path patch live in that local root. Existing product/migration/lockfile changes remain user work; no product edits or Git mutations made.
- Historical planning-revision ownership: the implementation plan and index only. Phase 1 owns the additive attendance migration/tests, shared attendance contracts/type composition, required export compatibility, Phase 1 plan progress and evidence. Its exact file/snapshot identities are in Phase 1 verification; all other existing work remains user work.
- The plan was untracked, not ignored, at this revision's baseline; HEAD did not contain its content. Preserve it as a file snapshot, not merely an empty Git diff.
- Evidence root: `tmp/family-plan-polish-20261021/`. `plan.before.md` is the original recoverable snapshot; `git-status.before.txt` records working-copy status; `plan.before.patch` is empty because the plan was untracked. `plan.polish.diff` records the documentation delta against the snapshot. Evidence paths are local working files, not guaranteed committed artifacts; verify availability before reuse.
- No sensitive input was read or packed. No credentials, environment files, or ignored application runtime state were required for this documentation edit. Product phases must inventory their own relevant ignored/untracked inputs under Section 6.0.

## Planning-revision source identities and reads (historical)

SHA-256 values identify bytes at the stated revision. Revalidate before reuse; a matching hash does not establish analysis completeness.

| Source | Identity | Completed inspection / finding |
| --- | --- | --- |
| Root `AGENTS.md` | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` | Empty file, fully read. Nested instructions must be discovered for implementation paths. |
| Original plan / `plan.before.md` | `145E9B821F1D5F463E1ABE01696F9EBA365198E0BD0F92C322056E47FA6FD4E6` | Original source fully read; packet entry lines 1–195 fully analyzed. Historical baseline only. |
| Revised implementation plan | Historical `EEF56761546FAEFFBC483B617D17DB24195EC9C8DB394C7D2C128B4347396FF2` | Superseded identity; Phase 0 pre-edit/final identities live in its source/verification ledgers. Shared guidance and other phases were preserved. |
| User requirements in current chat | Authoritative request; no file hash | Workflow order, context reuse, scoped cleanup, bounded verification, approved MuMu/Docker/Brave use, no scope expansion. |
| Product files listed in plan Section 2 | Phase 0 [source/read ledger](evidence/family-qr-attendance/phase-0-2026-10-21/source-reads.json) | 58 path identities; complete packet reads and scoped original ranges distinguished. Findings are discovery, not behavioral passes. |
| App/runtime/lockfile dependencies | Phase 0 [locked versions](evidence/family-qr-attendance/phase-0-2026-10-21/locked-versions.json) and source ledger | Expo 57.0.10 / RN 0.86.2 / Supabase JS 2.112.1 / PostgreSQL 17.6 verified; no dependency change. |

## Packet and Reader ledger

| Item | Recorded value |
| --- | --- |
| Packet | `tmp/family-plan-polish-20261021/planning.before.xml`; historical pre-edit planning context, superseded for current plan text. |
| Packet SHA-256 | `C19AFBE2320C2D2F88D94AFA3BF607FEA41566231D1A24A2EA9EBAF22A4A8414` |
| Generator | Cached Repomix **1.18.1**, resolved version checked; no dependency installation or repository lockfile change. |
| Selectors / actual manifest | Explicit `AGENTS.md` and `plans/Family_QR_Attendance_Implementation_Plan_2026_10_21.md`; both included, no unexplained omissions. |
| Options / exclusions | Parsable XML, uncompressed. Built-in security enabled; explicit dependency/Git/credential/secret/runtime/previous-packet exclusions. Exact command is in this chat's tool record. |
| Generation / validation | Exit 0; no suspicious files reported; XML parsed; entry text matched original source after CRLF/LF normalization and trailing-newline trimming. This is normalized text equivalence, not byte identity. |
| Reader method | No named Reader or Repowise tool exposed. Used local XML parsing for Reader validation/extraction; Repowise was not needed. |
| Completed extractions | Plan entry 1–80: 7,016 characters, next 81; 81–150: 7,407 characters, next 151; 151–195: 6,444 characters, complete. Empty AGENTS entry complete. No missing continuation or compression gap. |
| Size estimate | Repomix reported 4,599 artifact tokens and 23,440 characters. These are not actual model usage and do not demonstrate savings. |
| Current reuse rule | Reuse historical analysis only for unchanged requirements. The plan changed after generation; Phase 0 needs current guidance in a scoped packet/supplement. Do not relabel this historical packet current. |

For subsequent packets record: phase/purpose; version/options; selectors; intended/actual files; source and packet hashes; exit/security/parse results; omissions; supersession; extracted entry ranges/counts/continuations; findings and dependency identities. Keep full logs outside this index.

### Phase 0 packet and verification ledger — October 21, 2026

| Item | Identity / completed work |
| --- | --- |
| Primary packet | `tmp/family-attendance-phase0-20261021/contracts.before.xml`; SHA-256 `A62360D78DAC7DD581D0CEEE62C382495142CEBECF305DE091EC44F70011CA73`; 22 entries / 24 bounded ranges, 14 product chunks read, complete prior direct instruction/plan/index reads reused after identity validation. |
| Supplemental packet | `tmp/family-attendance-phase0-20261021/consumers.before.xml`; SHA-256 `B65AF6F0B96285A3C03A76526CDBADA543CAFC104ADD6C4C602E0FBACDFC2BE3`; 12 entries / 12 ranges, six consumer/test chunks read; six complete manifest reads reused. |
| Generation | Cached Repomix 1.18.1 version checked once; security enabled, uncompressed parsable XML; both exit 0, no suspicious files, no omissions, normalized source equality passed. Exact commands/selectors/hashes and per-entry boundaries: [primary manifest](evidence/family-qr-attendance/phase-0-2026-10-21/packet-manifest.json), [supplement](evidence/family-qr-attendance/phase-0-2026-10-21/supplement-manifest.json), and companion read ledgers. |
| Reader / source closure | Local safe XML parsing; each extraction ≤12,000 characters and ≤200 lines. Primary `0136` continuation completed against original lines 81–142 after combined output omitted its end. No required entry remains unread. Optional Repowise not used. |
| Reuse boundary | Plan/index packet entries are now historical due to Phase 0 edits; unchanged product entries remain reusable after source/dependency verification. Artifact token estimates do not establish actual usage savings. |
| Discovery / final checks | [Baseline inventory](evidence/family-qr-attendance/phase-0-2026-10-21/baseline-inventory.json), read-only catalog/log evidence and [final structural/protected-source verification](evidence/family-qr-attendance/phase-0-2026-10-21/verification.json). No app build, mutation/concurrency test, or camera acceptance pass claimed. |

### Phase 1 packet and verification ledger — October 21, 2026

| Item | Completed work / evidence |
| --- | --- |
| Baseline/ownership | `tmp/family-attendance-phase1-20261021/git-status.before.txt`, `existing-user-work.patch`, `before/`; working-copy snapshots include pre-existing untracked privacy code. No Git commit/push or historical migration edit. |
| Discovery/reuse | Phase 0 source identities checked; required conditional-save/mirror/grant/deletion functions confirmed in code/catalog. Initial requirement classification and documentation/version context: [report](evidence/family-qr-attendance/phase-1-2026-10-21/README.md). |
| Prerequisites packet | [Manifest](evidence/family-qr-attendance/phase-1-2026-10-21/packet-manifest.json): 9 entries, chunks 0–11 fully inspected; empty AGENTS complete. Conditional test original lines 42–55 close an output omission. |
| Lifecycle packet | [Manifest](evidence/family-qr-attendance/phase-1-2026-10-21/lifecycle.before-manifest.json): 12 entries, chunks 0–26 fully inspected, including all database-type continuations and exact existing generic-editor/deletion definitions. |
| Export supplement | [Manifest](evidence/family-qr-attendance/phase-1-2026-10-21/export-contract.before-manifest.json): 2 entries/chunks fully inspected. |
| Packet validation | Repomix 1.18.1; security enabled, uncompressed parsable XML; generation/source equivalence passed, no unexplained omissions; ≤12,000 characters/200 lines per extraction. Full hashes/selectors/boundaries in manifests. Changed entries now historical; no measured usage-savings claim. No optional Repowise. |
| Implementation/contract | Migration `20261021111056_household_attendance.sql`; four authenticated invoker APIs/private checked implementations; opaque receipt export ID; generated types match final candidate PostgreSQL 17.6 catalog. No dependency changes. |
| Checks | 321 SQL assertions (83 new + 238 regression), 21 independent-session races, 569 shared tests, 15 export tests, four app typechecks, supported owned lint pass. Five shared standalone type diagnostics and one Edge jsr lint diagnostic are pre-existing. Exact logs and candidate hashes: [verification](evidence/family-qr-attendance/phase-1-2026-10-21/verification.json). |
| Rehearsal/recovery | Fresh local canonical and missing-archive-guard schema rehearsals pass; no backfill. Exact synthetic attendance/receipt restore and request replay pass; fixtures removed. No production recovery performed. |
| Ownership boundary | `household-attendance-responses.test.ts` appeared as separate user work: preserved, read and run. Only Phase 1 plan section changes; acceptance definitions and other phases unchanged. |

### Phase 2 packet, coordination and verification ledger — October 21, 2026

| Item | Completed work / evidence |
| --- | --- |
| Ownership | Explicit user authorization resolved concurrent Android/Web requests for the same admin workflow. Web chat owns shared production source/migration; this chat owns Android plan/evidence and read-only review. Existing user work and both snapshots preserved; no duplicate flow/migration remains. |
| Context | Initial scoped Repomix 1.18.1 packet/source-equivalence and original verification; five-entry review packet + three-entry cleanup supplement fully read with bounded output. Exact hashes/read boundaries and one post-generation log-encoding failure recorded in [Phase 2 evidence](evidence/family-qr-attendance/phase-2-2026-10-21/README.md). Owner final packet/session-feedback supplement closes later source changes. No optional Repowise, compression gaps or usage-savings claim. |
| Candidate | One projection migration; secured admin dialog/helper/hook/camera; legacy boolean editors removed, stable roster edit IDs retained, holder-aware totals. Existing html5-qrcode 2.3.8 declared by admin; temporary jsqr/duplicate files retired. All 20 shared final source hashes revalidated. |
| Checks | Final typecheck/build PASS; lint only same two baseline warnings; admin suite 159 pass + one pre-existing unrelated request-editor failure; 45 affected shared tests; 263 SQL assertions + additive projection rehearsal pass. Brave → actual local PostgREST/PostgreSQL passes 14 groups with synthetic Auth/media and zero console errors. Exact source/log identities in [verification](evidence/family-qr-attendance/phase-2-2026-10-21/verification.json). |
| Gate | Implementation/local gates met. Actual Android display through physical staff camera, real staging Auth/role/tenant/account navigation and release-target checks remain pending manual/Phases 3–4. No remote migration/deployment/commit/push. |

### Phase 3 packet and verification ledger — October 22, 2026

| Item | Verified context / result |
| --- | --- |
| Ownership | `tmp/family-attendance-phase3-20261022/before`, full existing-work patch/status, recovered hash-verified historical untracked test snapshots and `owned.diff`. No unowned snapshotted source/lockfile changed. No dependency, migration, commit/push or remote mutation. |
| Reader | Initial 17-entry Repomix 1.18.1 packet, 16 nonempty bounded chunks 0–15 fully read; empty AGENTS complete. Four-entry final supplement/chunks 0–3 fully read (≤10,250 chars/106 lines). Security, exact selectors, normalized source equality and no omissions verified. Manifests and boundary counts in Phase 3 evidence; changed initial entries are historical. Original Settings/iOS/web handlers inspected directly to close scope gaps. |
| Prerequisites | All prior Phase 1/2 production candidate hashes match; historical plan/index identities differ due subsequent progress. Current SQL guard/mirror/RPC signatures and staff wiring confirmed. Earlier SQL/race/privacy results retained, not rerun; Docker engine unavailable. |
| Checks | Android 266 tests, shared 42 contracts, iOS 49 affected tests, four Web contract groups, 13 Family/scanner + 12 Settings browser groups pass. Android export/lint and Web/iOS types/lint pass. Android types retain only the three pre-existing external-link TS2859 diagnostics. Exact results/logs/source identities: Phase 3 report/verification. |
| Native | Existing Android 12 MuMu dev client, actual Family components with synthetic auth/transport, local Expo harness. Normal/enlarged native QR decoded using existing staff decoder from framed screenshots; holder arrival/departure, unselected member, dark theme and 130% text inspected. Original font scale restored; no new warning in isolated runtime window. Full candidate Auth/backend and physical camera remain pending. |
| Retirement | Android image loader and sole queue/write hook, Web write hook/old completion helper, iOS legacy receipt parser/reconciliation removed after consumer discovery. Web Family still calls image endpoint, so endpoint retained with exact caller/retirement condition. Old queued data left inert; no data deletion. |

### Phase 4 packet and verification ledger — October 22, 2026

| Item | Current fact / evidence |
| --- | --- |
| Ownership | Working-copy snapshots/patch/status under `tmp/family-attendance-phase4-20261022/`; owns only two shared maintenance-error changes, new pause/resume/recovery files and Phase 4 documentation/evidence. Unowned migration renames/0139 preserved. |
| Reader | Repomix 1.18.1: 11-entry primary/chunks 0–10 and two-entry maintenance supplement fully read; security/source equivalence and ≤11,000 characters/180 lines verified, no omissions. Manifests in Phase 4 evidence. No measured usage claim. |
| Candidate | Original timestamp migrations externally renamed to 0137/0138 with identical hashes. Another actor pushed 0139 then 0140. The latter restores the verified definitions (reviewed deletion-v2 anchor/pre/postflight differences); final local schema through 0141 passes 480 SQL assertions; unchanged 21 races/recovery/17 browser groups retained after identity verification. Native supplement passes nine groups plus 320dp/130% text. No migration applied or owned by this task. Any pre-0140 dropped data requires operator reconciliation. |
| Local checks | Final 480 SQL assertions through 0141, 21 independent-session scenarios, 17 real REST staff-to-Family browser groups, exact pause/restore/replay pass. Baseline Android 266/shared 569/iOS 64 pass; final shared 44/admin attendance six pass. Both final builds pass. Supported types/lint retain only known Android types/admin baseline diagnostics. Exact tools/logs/artifacts in verification. |
| Recovery | Separate empty PostgreSQL 17.6 schema; two visits/three receipts preserved exactly, delayed replay leaves later visit open, public/private mutation suspension, resident reads/legacy guard retained. Fixtures zero. Operator-only SQL is outside migrations. |
| Target/manual | Initial read-only linked catalog lacked attendance after 0139; latest history/catalog confirms external 0140/0141 and restored inspected tables/APIs/guards/grants plus protected receipt exports. This is static evidence, not actual Auth/behavioral staging proof. Actual staging Auth/deployed Edge/full installed Android/physical camera remain pending. MuMu native supplement now passes nine flow groups plus 320dp/130%-text/input focus and software QR decoding; final native warning/error log empty. Full-release/tabs/visual-keyboard still pending; font/display restored, ports/services stopped. |
| Cleanup/retirement | Owned test PostgREST stopped; no unrelated service stopped. Web image endpoint still called and retained with Web release owner/next-cutover gate. No dependency added, real-data deletion or remote mutation. |

Phase 4 continued: user explicitly keeps remote tests pending and confirms physical camera unavailable. Native test/runtime/source identities and failure-to-pass history are in Phase 4 `native-results.json`; display/font settings restored, reverse ports removed and owned services stopped. Final source review packet: five entries/all bounded reads complete, no omissions.

## Decisions and unresolved evidence

| Topic | Current decision / evidence still needed |
| --- | --- |
| Authority and identity | Existing admins confirm attendance; holder comes from the profile; one member ID identifies one additional roster person. No invitations, account linking, or real-world identity matching. |
| UI scope | Existing Family/admin areas only; necessary scan/select/confirm/checkout controls. Reuse resident selection for camera fallback. No redesign, extra history view, polling, or subscriptions. |
| Failure handling | Plain messages; internal failures remain observable in diagnostics. Finite timeouts, explicit retry with original request UUID, no automatic resubmission loops. |
| Retry and tenant boundaries | Validate current access before receipt replay; stored attendance barangay constrains admin history reads. Phase 1 role/tenant/auth replay and independent-session races pass; target/UI checks remain later-phase gates. |
| Cleanup | Delete a replacement only after verifying callers/runtime entry points; keep historical migrations and user work. Active cross-client callers require a recorded retirement condition. |
| Actual QR failure / remaining diagnosis | Observed exact-function hosted logs: two HTTP 546 `WORKER_RESOURCE_LIMIT` and one 504 `IDLE_TIMEOUT`, all ~150 seconds; runtime shutdowns `WallClockTime`. Android/web lack explicit image-request deadlines. Internal stall cause remains unproven; do not blame provider/auth/default handler without further evidence. Phase 3 local rendering removes this dependency. |
| Effective schema / lifecycle | Phase 0 compared read-only hosted catalogs with local source. Current mirror/save verified (30 members). Hosted archive guard absent despite local `0115`; local v2 deletion/export Edge sources are not deployed although SQL exists. Phase 1 implements and tests attendance/receipt removal before JSON cleanup in both erasure versions; fresh missing-guard drift rehearsal passes. Historical actor references retain de-identified profiles. See baseline for exact drift and migration identities. |
| Exact API / cutover contracts | Resolved in Phase 0 contracts: four named JSON-returning operations with `p_` arguments, actual `barangayan_private` schema, 2,048 UTF-8 QR bytes, ≤31 participants, canonical replay inputs, ordered locks, history isolation, error copy and legacy retirement gates. Phase 1 implements all four APIs and normalizes the generic household lock path. Phase 3 moved both Android Family and Settings to raw-snapshot conditional saves; server bypass guards remain unchanged and reject direct member writes once deployed. |
| Runtime environments | ADB read-only inventory reaches `127.0.0.1:16384` (Android 12, SM-S918U, `com.barangayan.resident.dev`) and `7555`. Phase 3 native harness verifies actual Family rendering/QR/status with synthetic transport on the installed dev client (1.0.0/code 1, October 15 build); full rebuilt candidate/Auth parity is still pending. Prior isolated PostgreSQL backend/race/recovery and Phase 2 Brave results retained; Docker became available during Phase 4; fresh 464-assertion/21-session rehearsal and recovery pass. Physical staff camera remains pending. |
| Deployment | Read-only comparison target: linked Barangayan `pwjbucnyqexiepoinoke`, PostgreSQL 17.6. No production deployment/migration/config/data-mutation authorization. Phase 1 completed on disposable PostgreSQL 17.6 targets; Phase 4 builds/identities are recorded; latest read-only target catalog/history confirms external 0140 restoration; actual staging/hardware/Auth and any pre-0139 data reconciliation still gate release. |

## Acceptance coverage ledger

Phase 1 proves the backend portions of A01–A13 and A16–A17 in isolated PostgreSQL 17.6. Each row below records its scoped evidence and remaining UI/release responsibility. A14–A15 are pending their assigned phases; no overall release acceptance or physical-camera pass is inferred. Exact candidate hashes, commands, environment and pass/failure logs are linked in Phase 1 verification. Reuse only while source/dependency identities remain valid.

| IDs | Responsible phases | Required evidence / candidate identity | Current result |
| --- | --- | --- | --- |
| A01 | 1–3; final 4 | Final 0141 source/artifact ledger; 83 attendance assertions; holder-only staff flow; actual Family hooks/real-REST roundtrip; native local API holder arrival/departure displayed with Manila times | **Pending manual verification** for release: Actual installed candidate/staging holder-only camera-to-Family flow. |
| A02 | 1–3; final 4 | Final 0141 source/artifact ledger; Final browser groups: exactly two of four, two unchanged; arrival/departure shown in actual Family components; actual native local staff two-participant arrival/departure status | **Pending manual verification** for release: Full authenticated installed Android/staff target roundtrip. |
| A03 | 1–3; final 4 | Final 0141 source/artifact ledger; 21-session suite same-center/request races, original arrival preserved; browser duplicate confirm one write | **Pending manual verification** for release: Recheck immutable staging candidate after migration resolution. |
| A04 | 1–3; final 4 | Final 0141 source/artifact ledger; Independent-session different-center conflict and source-current admin rejection | **Pending manual verification** for release: Recheck staging candidate/target. |
| A05 | 1–3; final 4 | Final 0141 source/artifact ledger; SQL replay/access revocation; browser response loss exact UUID/payload; recovery delayed replay | **Pending manual verification** for release: Actual staging Auth/session revocation and target replay. |
| A06 | 1–3; final 4 | Final 0141 source/artifact ledger; Exact-stay SQL/browser departure; recovery closed receipt replays without closing later visit | **Pending manual verification** for release: Staging candidate/target replay. |
| A07 | 1–3; final 4 | Final 0141 source/artifact ledger; 83 + 30 SQL boundary assertions: atomic batch/key conflicts/forged authority; UI response ownership | **Pending manual verification** for release: Staging candidate/target. |
| A08 | 1–3; final 4 | Final 0141 source/artifact ledger; Authenticated-role RLS/tenant/history tests and real REST; actual DB authority, synthetic Auth endpoint | **Pending manual verification** for release: Real staging Auth/role/account/tenant revocation. |
| A09 | 1–3; final 4 | Final 0141 source/artifact ledger; Local tested candidate blocks direct/generic/legacy/queued writers; clients send no attendance writes | **Pending manual verification** for release: 0140 restores server boundary and final local chain checks pass; actual target role/legacy/queued write behavior still requires separately authorized staging tests. |
| A10 | 1–3; final 4 | Final 0141 source/artifact ledger; Lifecycle/rename/roster/race suites; stable member identities; no production code change | **Pending manual verification** for release: Attended target rename/removal/arrival flow. |
| A11 | 1–3; final 4 | Final 0141 source/artifact ledger; Center lifecycle/reassignment races; real browser inactive-center checkout | **Pending manual verification** for release: Candidate/target recheck. |
| A12 | 1–3; final 4 | Final 0141 source/artifact ledger; 22 conditional-save assertions; prior hash-current Android two-editor UI evidence | **Pending manual verification** for release: Full candidate target multi-editor Family/Settings flow. |
| A13 | 1–3; final 4 | Final 0141 source/artifact ledger; Final 480 SQL assertions include 16 receipt-export boundary tests, 56 deletion, 86 backend and seven tenant checks; 15 export tests within 64 iOS tests. Final 0141 helper/view source and target static catalog inspected. | **Pending manual verification** for release: Deploy/smoke both actual erasure/export Edge versions under separate authorization. |
| A14 | 1–3; final 4 | Final 0141 source/artifact ledger; Native actual QR: direct settled enlarged decode; normal captured pixels decode after documented nearest-neighbor doubling through staff html5-qrcode 2.3.8. Physical camera unavailable per user; directory fallback passes locally. | **Pending manual verification** for release: Physical camera scans displayed normal/enlarged QR; authenticated target fallback. |
| A15 | 1–3; final 4 | Final 0141 source/artifact ledger; Brave states, error copy, theme/narrow/200% zoom, account cleanup; actual Family arrival/departure screenshots inspected; nine MuMu flow groups, 320dp/130% text, serif/extreme accent/dark, native conditional editing and account isolation pass | **Pending manual verification** for release: Full installed release app/actual Auth and bottom-tab clearance; visual keyboard overlap. User keeps remote checks pending.. |
| A16 | 1–3; final 4 | Final 0141 source/artifact ledger; Real browser stable idle counts, timeout/key retry, double-confirm and late camera cleanup; actual recovery pause has clear mapped copy; native idle/focus/resume/error/Retry/delayed-account/logout pass; post-restart ReactNativeJS warning/AndroidRuntime error log empty | **Pending manual verification** for release: Actual deployed Auth/session behavior and full app navigation; remote verification pending per user. |
| A17 | 1–3; final 4 | Final 0141 source/artifact ledger; Owned diff/retirement/source/artifact ledgers; fresh migration-through-0138 and recovery pass; no new dependency | **Pending manual verification** for release: Final local chain through 0141 verified; preserve pushed history. Operator must reconcile any data affected by external 0139; physical-camera/full-release/target gates remain pending.. |

## Documentation verification

- Phase 0 verification is recorded in its `verification.json` and baseline. Only Section 6.1 of the plan and Phase 0 index facts changed; Phases 1–4 and all A01–A17 definitions are preserved. Product/lockfile identities are rechecked; no runtime correctness pass is inferred from documentation checks.
- Original snapshot hash and packet/source normalized equivalence passed before editing; both required packet entries were completely read.
- Documentation verification: 28 structural/identity checks passed, including five six-item phase checklists, unique A01–A17 definitions/coverage rows, workflow order, cross-links, and preserved baseline. The final lock-order clarification and backend-only Phase 1 gate received focused follow-up source/identity checks; results are recorded in `tmp/family-plan-polish-20261021/documentation-checks.json`.
- No app builds, behavioral tests, hosted queries, emulator/browser sessions, or deployments were run for this documentation revision. Their absence is not a passing product result.
