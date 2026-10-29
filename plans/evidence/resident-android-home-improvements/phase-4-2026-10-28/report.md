# Phase 4 execution — 28 October 2026 (Asia/Manila)

Status: **Complete / Verified for Phase4 local exit gates**, updated29 October2026 (Asia/Manila). Implementation and automated gates pass, and the user's subsequent explicit ADB authorization enabled completion of native I2 on the selected MuMu instance. See the [I2 report and acceptance evidence](i2/report.md). The earlier computer-use denial is historical; Phase5 was not started.

Checklist complete: scope R1/R6/R9 and affected R10; prerequisites0148/0149 and Phase2/3 verified; working edits preserved; scoped XML and original-source reads; baseline/affected checks; independent sources; native/publisher I2; owned-process/device cleanup.

## Changed behavior and initial classification

| Requirement | Before | Implemented / evidence |
|---|---|---|
| R1 independent active advisories | Not started in Home; expiry contract already implemented | Published, nondeleted emergency candidates with explicit future expiry; deterministic publication/ID order; independent from latest news. Exact-count pagination, at most 100 serial pages inside the existing 12-second deadline; incomplete/oversized replies are errors. Local expiry timer and focus/resume refresh; multiple advisory actions retain exact detail IDs. |
| R6 useful latest preview | Partially done: title/category/date/image/detail ID existed | Plain-text body preview, readable shared category label, visible View details, flexible full-width card, retained image-failure fallback. Expired label in Home and existing feed/detail; no new destination. |
| R9 independent resilient state | Requests implemented; news partial; alerts absent | Existing RefreshResource reused for news/alerts, scoped by account/barangay. Independent loading/error/empty/refresh states; failed refresh retains data and successful-fetch timestamp. Connectivity comes from installed NetInfo, not generic errors. Last-known alert copy during offline/failure/revalidation. No persistent private cache or new Realtime owner. |
| R10 affected behavior | Existing theme/fonts/reduced motion and controls | Existing palette/text/action components retained. New advisory target minimum48dp and wrapping text. A reproduced RN Web summary-focus race now uses the actual web Modal dismissal event; Android retains its existing cancellable-frame path. |

Nine owned source/test files are listed in `source-final.json`; `owned.diff` isolates changes from pre-existing working bytes. New files are the Home advisory helper/tests and two hooks. No dependency, migration, publisher implementation change, business mutation, global visibility change, push behavior, commit, push or deployment. I2 intentionally edits synthetic publisher content only.

## Workflow / Reader index supplement

- Root AGENTS.md is empty; CLAUDE.md delegates to it; no nested Android/shared instructions were found. No repository-instruction conflict. The execution request supersedes historical planning-only restrictions. Global plan Not-started/U01 wording is stale relative to dated Phase1–3 records and existing0148/0149; only Phase4 progress is updated.
- Git status, working/staged binary patches and recoverable touched-file bytes were preserved under `tmp/resident-home-phase4-20261028/before`. Existing Android/admin/shared/notification edits belong to prior work and were retained. No secret configuration was copied into packets.
- Narrow ripgrep confirmed current routes, scoped resource, NetInfo12.0.1, category/schema contracts and existing detail/read ownership. Repowise was unnecessary; no index freshness or coverage claim.
- Repomix1.18.1: six actual main entries, five contiguous bounded reads covering `[0,49851)`; four supplement entries, two bounded reads `[0,10830)` and `[10830,12456)`. Each bounded read is at most12000 characters/200 lines. Initial full supplement output exceeded the requested byte bound; the two bounded extracts were subsequently read in full. Exact identities, boundaries, selector omissions and resolutions are in `packet-manifest.json`. The missing guessed lifecycle/constants paths were resolved to existing schema/category metadata; no code depends on them. Default security/exclusions retained. No compression used; no token-savings claim.
- Main XML: RefreshResource joins ordinary reads, retains data and aborts by deadline; old Home news was unscoped and had no deadline. Announcements route owns detail lookup and intentional read marking. Supplement: category schema defines explicit expiry; feed has no expiry label; existing RLS must remain authoritative. Original bodies/effects/styles/read handlers and installed RN Web ModalAnimation/FocusTrap were read to resolve those questions. Packet versions of changed Home/card/modal are historical; final identities supersede them.
- Version guidance: Expo57 Router useFocusEffect and Image onError; RN0.86 AppState; React19 effect/cleanup guidance and installed19.2.3 APIs; NetInfo12.0.1 installed README plus official tagged README; Supabase JS2 filters/abort/retry/select contracts and current changelog. Expo NetInfo page was unavailable; installed version and tagged upstream docs supplied the contract. Supabase changelog Markdown failed content-type handling; HTML fallback read. React publishes major-version docs, not a separate19.2 archive.

## Actual verification

| Check | Baseline → final |
|---|---|
| Android TypeScript | Pass → pass (`accepted-types.json`) |
| Android lint | Pass with1 existing Health unused-useState warning → identical warning,0 errors |
| Focused tests | Home16 + RefreshResource9 baseline pass; final Home16 + resource9 + advisory11 = **36 pass** (`final-units.log`) |
| Brave Home fixture | Pass baseline → pass after diagnosed fixes; final `accepted-home-presentation-ui` and test-only resume supplement `tmp/resident-home-phase4-20261028/resume-ui/results.json`: **0 console errors/warnings** |
| Services, tracking navigation, resident-shell | Pass → pass, accepted command records |
| Reports/Announcements Brave fixture | Baseline and final pass; same2 existing shadow/pointerEvents deprecation warnings, raw logs under task tmp |
| Android production Hermes export | Baseline command exits0; final accepted export exits0, same inherited NO_COLOR/FORCE_COLOR warning class. Bundle only, not APK/native qualification. Baseline export overlapped creation of new source files, so its precise source identity is not certified; no binary size/performance comparison is claimed. |
| Actual Docker/API loaders | Pass: exact current `loadAnnouncements` body transpiled without logic changes, Supabase JS2.112.1 → PostgREST14.5 → PostgreSQL17.6 disposable `resident_home_p4_20261028`. Owner sees1/2, other barangay sees none, guest sees1/2/7 under existing policy. Future/deleted/expired/unknown filtered. Read-marker/inbox/private event counts unchanged (`integration-results.json`). |
| Owned diff | Reviewed against snapshots, new hooks/helper/tests reviewed; whitespace check pass. No new dependencies or obsolete old Home loader left. |

All eight accepted runner checks exit0; exact commands/cwd/deadlines/start/end/logs in `accepted-checks.json`. Tests are event-driven with bounded waits; no automatic test repetition loop. Reruns followed source/harness changes or focused diagnostics. Earlier intermediate errors are preserved, not counted as successful checks.

Diagnoses: old fixture methods overwrote their callable order/range fields; updated adapters support actual query chaining, exact counts and separate alert failures without weakening assertions. Production TypeScript/purity errors were corrected. Removed-card focus intermittently returned to body; installed RN Web source confirms focus-trap cleanup happens in an additional modal cycle. The actual web onDismiss now owns restoration, and both accepted/resume suites pass existing focus assertions. API setup errors (private event schema name, stopped container-name collision, initial schema-cache startup, direct-PostgREST URL prefix) were corrected independently before successful checks; production query semantics were not weakened.

## Acceptance status and remaining gates

| Criterion | Status |
|---|---|
| R1 query eligibility, multiple/stale alerts, focused/resume expiry, exact detail ID | **Met**, including actual native focused/resume expiry, exact detail and retained expired feed item; I2 evidence. |
| R6 category/title/date/plain-text/action and retained expired feed/detail implementation | **Met for Phase4**, including native long/plain preview, missing/failed images and detail/Back. Real release content is the separate I3 gate. |
| R9 independent partial-success, offline distinction, retained refresh, scope cancellation and cleanup | **Met**, including native combined failures, single-attempt timeout, actual offline/retry, account change, outstanding-response logout and background cleanup. |
| R10 themes/fonts/named actions and affected browser focus | **Met for affected Phase4 content**: native light/dark, fonts/accents,320/360/~412dp, large text, painted color contrast. Whole-product acceptance remains Phase5. TalkBack waived, not passed. |
| I2 one Android build/backend, full guest/sign-in/shortcuts/requests/advisory/feed/Back/error/account journey + Brave publisher edit observed in Home | **Met** on recorded APK/unchanged accepted sources and isolated backend. Full root/provider/route components, actual password sessions, scoped storage adapter; Realtime/push delivery excluded explicitly. |

The29 October ADB continuation completed those journeys; see [I2's per-gate evidence and diagnoses](i2/report.md). All nine accepted source identities remain unchanged; existing automated checks were reused after identity verification. Final native JS console has zero errors/warnings, and background source requests remain314→314.

The initial denial was followed by the user's explicit ADB execution request. Original app/storage is preserved through namespaced test storage. Device display/network settings and original16416/8087/8088 routes were restored; task Metro/proxy, routes and temporary credentials are cleaned. The explicitly approved Docker restart initially hit a stale WSL disk attachment. The later approved administrator service restart succeeded; both task containers are absent and all four task ports are closed. All8 original local Supabase services recovered, their7 configured health checks are healthy, and REST→PostgreSQL returns HTTP200 for a zero-row read. Both synthetic databases remain. See [restart verification](i2/restart-verification.json) and [administrator result](i2/wsl-admin-recovery.json). Pre-existing Health warning, shared44dp controls, browser deprecations and prior framework diagnostics remain separately recorded. No production source changed during native qualification or cleanup.

Phase4 is **Complete**: R1/R6/R9, affected native presentation, I2 and final owned-container cleanup are verified. Phase5/release/real-content/I3 and hosted rollout remain separate, unexecuted gates.
