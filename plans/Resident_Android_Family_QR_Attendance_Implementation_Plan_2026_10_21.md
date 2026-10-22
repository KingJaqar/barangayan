# Family QR and Attendance Implementation Plan

Date: October 21, 2026  
Status: Revised execution plan; implementation has not started  
Primary delivery: resident Android app and admin web app

This revision authorizes planning only. Implementation progress and verification are recorded in [the compact context index](Family_QR_Attendance_Context_Index.md). Repository instructions and the user's requirements take precedence over this plan, generated guidance, and tool recommendations.

## 1. Outcome and release scope

Make the existing Family screen useful through one complete workflow:

1. A resident maintains a household roster and shows its Family QR.
2. A barangay administrator scans the QR and retrieves that household.
3. The administrator chooses an evacuation center and selects the people physically present.
4. The server records those people's attendance, including the account holder when selected.
5. The resident sees each person's recorded center and arrival time.
6. The administrator checks selected people out when they leave; departure times remain in history.

Use existing `admin` accounts as authorized staff for this release. Do not introduce a new staff role or permission management screen. A household means one resident profile plus its listed members; invitations, linking separate resident accounts, and merging duplicate real-world identities are outside this release.

Attendance operations require a connection. A saved QR may be presented without a connection, but lookup and confirmation require the staff device to be online. Do not show queued work as confirmed attendance.

Resident center scanning must not create staff-confirmed family attendance. Defer resident self-check-in, location tracking, automatic transfer, notifications, and additional attendance dashboards. Moving centers uses checkout followed by check-in.

Reuse the existing Family screen and admin Households & Residents area. Add only the controls and backend operations necessary for the four requested capabilities. No redesign, new navigation section, separate history screen, new role, or unrelated refactor. Resident web/iOS changes are limited to compatibility and removal of conflicting attendance behavior; full Family parity is not part of this release.

## 2. Current implementation and gaps

These findings come from the local working tree, not a verified hosted database. Phase 0 must compare them with the intended deployment environment.

| Existing foundation | Required change |
| --- | --- |
| Android `family-content.tsx` edits `profiles.household_members` through `use-profile-household-members.ts`. | Include the account holder in the displayed roster and load authoritative attendance separately. |
| `household_members` stores canonical member rows and mutable check-in fields. | Preserve member IDs; stop treating editable boolean fields as attendance authority. |
| The latest local mirror trigger in migration `0123` upserts retained members, preserves their attendance fields, and deletes removed, unarchived members. | Preserve historical member references and prevent removal of an actively checked-in member. Do not replace the trigger with the older delete-and-reinsert implementation from `0052`. |
| Android `HouseholdCode` requests an authenticated image from `generate-household-qr`; the function requests the PNG from an external QR service. | Render the validated household reference directly in the app, with bounded loading and retry for prerequisite data. Investigate the actual loading failure before retiring the image path. |
| The current household QR contains `{ type: 'household', profileId }`. | Share one validated household QR contract between resident display and staff lookup. |
| Resident scanners accept `EVACUATION_CENTER_CHECKIN`, not household QR payloads. | Add a household scanner to admin web; clearly distinguish the two QR types. |
| Android and web can insert individual check-ins and separately mark every household member checked in. | Remove the blanket family update and prevent these paths from changing the new attendance records. |
| iOS uses `check_in_to_evacuation_center`, which deduplicates a resident/center pair for ten minutes. | Do not reuse it as the new family attendance operation; a time window does not enforce one active stay. |
| Admin Households & Residents exposes an editable checked-in boolean, including a generic record-edit backend path. | Replace the toggle with attendance actions and block that mutation on the server too. |

Relevant starting points:

- Android: `apps/resident-android-mobile/src/components/family-content.tsx`, `components/drrm/household-code.tsx`, `components/household-qr-modal.tsx`, `components/qr-scanner-overlay.tsx`, `hooks/use-profile-household-members.ts`, and `hooks/use-qr-checkins.ts`.
- Admin: `apps/admin-web/src/app/(admin)/households-residents/`, `src/lib/admin-tables/record-config.ts`, and the table projections and record mutation functions in migrations `0110`, `0115`, and `0129`.
- Shared: `packages/shared/src/schemas/household.ts`, `schemas/emergency-qr.ts`, and generated database types.
- Backend: migrations `0045`, `0046`, `0093`, `0121`, `0123`, and `0136`; `supabase/functions/generate-household-qr/index.ts`.
- Other clients affected by attendance compatibility: resident web emergency components, `src/lib/qr-checkin.ts`, and resident iOS `src/data/resident-api.ts`.

## 3. Product rules

| Situation | Required behavior |
| --- | --- |
| Household has no additional members | The account holder still appears and can be checked in. Show `1 person`, not an empty family. |
| Only some people arrive | Record only the selected people. Start with nobody selected and require at least one selection. |
| Person already has an active stay at the selected center | Return the existing stay without changing its arrival time. |
| Person has an active stay at another center | Reject the new check-in with the current center shown. Require checkout first. |
| Repeated checkout or retry | Return the original departure result; do not change its timestamp or close a later stay. |
| One selection is invalid | Reject the whole batch; save no partial attendance. Refresh the roster so staff can correct it. |
| Member is renamed | Keep the same member ID and attendance history. |
| Member is removed or archived | Reject while checked in. Once checked out, preserve any history by archiving the referenced member instead of hard deleting it. |
| Center is inactive or archived | Block new arrivals; permit departure from an existing stay. |
| Household or center changes barangay | Block reassignment while active attendance exists; preserve historical barangay ownership. A new-barangay admin cannot read the previous barangay's attendance. The resident retains access to their own history. |
| No recorded stay | Show `No recorded check-in`; do not imply missing, unsafe, or physically absent. |

Store server timestamps in UTC and display them in Asia/Manila. Staff must confirm the household identity in person: a QR identifies a record and does not prove a person's identity or grant access.

## 4. Backend design

### 4.1 Reuse the household model

Keep `profiles` as the household owner and `household_members` as its additional people. Represent the account holder from `profiles`; do not insert the holder into the editable JSON roster or manufacture a dependent row.

Keep the existing JSON roster interface initially. Move Android roster saves to the existing conditional-save operation so two editors cannot silently overwrite each other. Preserve compatible web/iOS roster editing and the mirror trigger.

### 4.2 Add authoritative attendance stays

Add `public.household_attendance`, with one row per person's visit:

| Field | Purpose |
| --- | --- |
| `id` | Stable attendance UUID. |
| `household_profile_id` | Owning resident profile. |
| `household_member_id` | Member UUID; NULL means the account holder. |
| `barangay_id` | Server-derived barangay at attendance creation. |
| `evacuation_center_id` | Validated evacuation center. |
| `checked_in_at`, `checked_in_by` | Server arrival time and staff actor. |
| `checked_out_at`, `checked_out_by` | Server departure time and staff actor; NULL while open. |

An active stay is a row where `checked_out_at IS NULL`. Do not add a separately editable status boolean to this table. Constrain departure to be at or after arrival and require departure actor/time together. Reference staff profile IDs, not authentication rows or stored staff names. Preserve referenced, de-identified profiles during account erasure; do not introduce an actor `ON DELETE SET NULL` rule that violates the actor/time constraints. Phase 0 verifies that the existing lifecycle supports this before the migration is implemented.

Enforce membership with a composite foreign key from `(household_member_id, household_profile_id)` to a unique `(id, profile_id)` pair on `household_members`. The NULL member case is the holder. Prevent hard deletion of referenced members and centers; use existing archive mechanisms and explicitly update deletion cleanup.

Add two unique partial indexes:

- Unique `household_profile_id` for active rows whose member ID is NULL: one active stay for the holder.
- Unique `household_member_id` for active rows whose member ID is non-NULL: one active stay for that member across centers.

These constraints enforce duplicates even when two staff devices submit simultaneously. Add indexes for household history and barangay/center active attendance. This uses PostgreSQL's [partial unique index support](https://www.postgresql.org/docs/current/indexes-partial.html).

Keep closed stays as history. Do not infer new active stays from legacy booleans or historical scan logs, which do not reliably establish current presence. Preserve legacy records separately and label them as legacy where still exposed.

### 4.3 Retry protection and transactions

Each check-in/check-out submission gets a client-generated request UUID, reused after timeouts. Store a private operation receipt keyed by staff actor and request UUID, containing the household ID, operation type, normalized input fingerprint, and minimal authoritative result IDs/timestamps. Do not copy household names or contact data into receipts. Reusing a key with different inputs is rejected. Verify the caller's current role, active account, and barangay access before replaying a stored receipt.

The receipt and attendance changes commit in one transaction. A retry returns the original result, including after a person has subsequently checked out or checked in again. An active-row uniqueness constraint alone cannot protect that delayed-retry case.

Serialize mutations for the household, lock selected stays in a consistent order, revalidate the roster and permissions within the transaction, and use unique indexes as the final concurrency guard. Coordinate roster removal/archive with the same household lock so it cannot race against arrival.

Use one documented lock order across all related writes: request key, household profile, relevant center rows ordered by ID, then attendance rows ordered by ID. Roster-only writes and household reassignment start at the household lock. Center-only archive/reassignment locks its center row, checks for active attendance, and never subsequently acquires household locks; arrival rechecks center availability/ownership after acquiring that same center lock. Do not reverse this order. Test those races rather than assuming an isolated validation query is sufficient.

Checkout accepts specific attendance IDs, not only member IDs, so an old checkout cannot close a newer visit. Keep private receipts inaccessible to residents and ordinary table queries; use the existing private-schema function pattern with authenticated actor checks.

### 4.4 Backend operations

The following contracts define the required operations. Phase 0 records exact database signatures and maps any naming collision to verified existing code; it does not add operations beyond this scope.

| Operation | Caller and behavior |
| --- | --- |
| `get_my_household_attendance()` | Resident-only, caller-derived household; returns holder, active roster, current attendance, and each person's latest departure. Use indexed, bounded queries; do not load unbounded history. |
| `lookup_household_for_attendance(qr_payload)` | Active same-barangay admin; validates QR, resolves active resident household, and returns only names, relationships, participant references, and attendance needed for registration. |
| `check_in_household_members(profile_id, center_id, participants, request_id)` | Admin-only atomic batch; participants are typed holder/member references, not supplied names or timestamps. Returns new/existing stay receipts per selected person. |
| `check_out_household_attendance(attendance_ids, request_id)` | Admin-only atomic batch for one household; validates ownership and barangay and returns existing/new departure receipts. |

Handle authentication, access denial, invalid QR, unavailable household, invalid selection, inactive center, active stay elsewhere, stale roster, request-key conflict, and temporary server failure as explicit outcomes. Map internal exceptions/statuses to clear, actionable messages. Never display raw SQL errors, HTTP codes, stack traces, or internal identifiers as user-facing error messages. Do not suppress failures or misreport success. Avoid revealing another barangay's household details in an error.

Deduplicate selected participant IDs and enforce the existing roster limit plus one holder, verified in Phase 0. Reject empty, oversized, or mixed-household batches. Derive participants, center ownership, timestamps, and actors on the server. A client-supplied name, tenant ID, or timestamp cannot change attendance identity or authority.

### 4.5 Access rules and legacy write protection

- Anonymous callers have no household lookup or attendance access.
- Residents read only their own household attendance and maintain their own roster. They cannot confirm or edit attendance.
- Admins perform lookup and create attendance only when their active profile, the resident's active household, and the center belong to the same barangay. History reads additionally require the attendance row's stored barangay to match the admin's current barangay. Checkout validates that stored barangay and the referenced household/center without requiring the center to remain active. Derive role and barangay from database records, not request parameters or editable user metadata.
- Apply RLS and explicit grants to exposed tables; private receipts have no direct client access. Use the existing public invoker/private implementation pattern for narrowly privileged operations where needed. Every privileged operation checks the actor and tenant itself. Follow the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Prevent direct client INSERT/UPDATE/DELETE on authoritative attendance; route all writes through validated operations.
- Treat `household_members.is_checked_in` and its center/time fields as compatibility projections only. Update them transactionally for members from authoritative stays; do not make them a second source of truth.
- Remove attendance fields from generic admin record-edit allowlists and protect them from direct table writes, including existing broad resident/admin household policies. Residents must still be able to edit permitted roster fields.
- Remove blanket family-status updates in Android and web. Old center-scan paths must fail with an actionable upgrade/staff-check-in response once the staff workflow is enabled; they must not appear to confirm official attendance.
- Coordinate account deletion/export, member archive/restore, center archive/delete, and barangay reassignment with the new records. Account erasure must remove attendance/receipts as appropriate before existing profile JSON cleanup tries to remove referenced members.

## 5. QR and staff experience

Use a shared household payload: `{ type: 'household', version: '1.0', profileId: '<uuid>' }`. For compatibility, accept the current household payload without `version` as legacy v1, with the same authorization checks. Reject unknown versions, malformed IDs, payloads larger than 2,048 UTF-8 bytes, and center QR codes in the household scanner. Decode data only; do not navigate to scanned URLs or execute scanned content.

Generate the QR image locally from the authenticated resident's validated profile reference. This removes the external image dependency and requires no new token service. The QR contains no names, contact information, credentials, or session tokens. Possession of the profile reference never bypasses authorization. Keep the old image endpoint during client transition, then retire it after checking callers.

Add a `Scan Family QR` action to the existing admin Households & Residents area:

1. Choose an active center in the admin's barangay; keep the chosen center visible.
2. Scan a Family QR with a camera on an HTTPS staff page.
3. Show the household holder, additional members, and existing attendance.
4. Select arriving people, review the center and names, then confirm once.
5. Display the authoritative receipt and updated attendance.
6. Offer selected-person checkout for active stays.

Reuse the existing same-barangay resident directory/selection as the camera fallback; do not build another search service or screen. Pass its selected profile through the same secured lookup and confirmation flow. Stop the camera after a successful decode and on dialog close, backgrounding, logout, or account change. Lock repeat scan callbacks while processing. Handle denied camera permissions, absent cameras, failed lookup, stale data, and lost responses with useful retry states.

On Android, replace the current QR image loader, include the holder in the Family total, and show per-person center and timestamps. Refresh attendance on screen focus and through the existing refresh affordance. Do not add real-time subscriptions or polling. Keep add/edit controls visible above the bottom navigation and clear QR/household state when accounts change. Showing or scanning a code alone never records attendance.

Set a finite timeout on network operations. A timeout ends the busy state with an actionable message; it does not imply rollback of a mutation. Preserve its request UUID for an explicit retry and reconcile the original receipt. Do not add automatic retry loops, recursive refresh, repeated permission prompts, effect-driven resubmissions, or success/error feedback loops. Cancel or disregard stale reads and camera callbacks after close/account changes; a committed mutation remains valid and is reconciled on the next authorized read.

## 6. Execution phases

| Phase | Work | Completion gate |
| --- | --- | --- |
| 0 — Baseline and contracts | Compare local/hosted schema in the chosen environment; inventory all legacy writers/readers, latest RLS/grants, lifecycle hooks, and image-function deployment behavior. Capture the actual QR loading error. Confirm exact contracts, message mapping, admin role assumption, and legacy cutover. | Recorded baseline and verified contracts; no production changes. |
| 1 — Data and operations | Add attendance, indexes, private receipts, secured lookup/read/check-in/check-out operations, lifecycle handling, and roster-save coordination. Generate shared types and schemas. | Database tests prove ownership, transaction behavior, concurrency, and retry protection. |
| 2 — Admin workflow | Build scan/search, center selection, explicit person selection, confirmation, receipts, and checkout. Replace editable attendance toggles and update admin projections/counts. | Staff can complete arrival and departure on a staging household; account holder and members are counted correctly. |
| 3 — Resident integration and cutover | Render Family QR locally; show holder and attendance on Android; use conditional roster saves. Update or disable conflicting web/iOS/Android legacy attendance paths and protect compatibility fields on the server. | A real displayed Android QR resolves in staff web, selected arrivals appear on Family, checkout updates the display, and legacy paths cannot bypass the new rules. |
| 4 — Verification and release | Run access/concurrency/integration checks, device/browser visual checks, deletion/export regressions, and a migration/recovery rehearsal. Deploy backend before clients; enable staff attendance only after cutover checks pass. | All release acceptance checks pass and evidence is saved. |

Implement incrementally in additive migrations using the repository's migration workflow. Do not edit historical migration files or guess the next migration identifier. Read the applicable app AGENTS and installed framework documentation before changing app code.

### 6.0 Shared execution workflow — mandatory for every phase

Follow this order for Phases 0–4:

**Git baseline → ripgrep discovery, assisted by Repowise when useful → Reader validation → scoped Repomix → Reader XML analysis → original-source verification**

Use these rules centrally; phase checklists below specialize them instead of copying them. Reducing redundant context and verification is an objective, not a guaranteed or measured saving. Correctness, security, and complete acceptance evidence take priority.

1. **Git baseline.** Inspect status and relevant staged/unstaged diffs. Identify existing user changes and ownership; HEAD is not a substitute for the working copy. Save recoverable patches plus copies of relevant untracked inputs before editing. Inventory relevant ignored inputs affecting behavior, without adding them to Git or packets. Preserve sensitive inputs only in approved secure locations; record a redacted description, not secrets. Never reset, stash, clean, or overwrite unrelated work. Reuse this baseline and inspect subsequent owned diffs throughout the phase.
2. **ripgrep discovery.** Read applicable instructions and phase requirements, verify prerequisites in code, and trace the necessary callers, consumers, routes, schemas, configuration, and tests. Start with narrow paths/symbols, batch independent searches, and expand for a stated unresolved question. Save larger output and inspect bounded continuations instead of hiding matches. Repowise is optional: use indexed relationships only when useful, verify freshness against changed/untracked working-copy files, and record freshness evidence. Refresh affected index context or fall back to direct discovery if freshness is uncertain. Treat graph edges as leads, not proof; do not ask another tool to repeat an answered question.
3. **Reader validation.** Consult the compact index before rereading. Compare source SHA-256 identities, relevant dependency versions/lock entries, packet identity, relationships, and completed read ranges. Classify inputs as unchanged, changed, missing, or uncertain. Reuse verified unchanged analysis; invalidate affected findings when a source/dependency changes. Hash equality proves content identity, not completeness or correctness. Record inspected paths/symbols/ranges, packet entries, open questions, and any Repowise evidence. A prior phase status or graph coverage does not prove a prerequisite passes.
4. **Scoped Repomix.** Use the pinned/cached Repomix version **1.18.1**, rechecking the resolved version once per execution session; do not install an unpinned latest version or change repository dependencies. Select confirmed instruction, contract, implementation, consumer, and test files only. Keep built-in security checks and explicit exclusions for secrets, credentials, unrelated generated/build output, dependencies, and previous packets. Prefer parsable XML without compression for small packets; use compression only with recorded gaps. Record intended selectors, actual manifest, source hashes, packet hash/path, version/options, exit/security results, and omissions. Reconcile expected versus actual files. Add a small supplement for changed/missing inputs rather than regenerating an unchanged packet. Preserve historical identities and mark superseded packets.
5. **Reader XML analysis.** Parse XML safely and extract entries in chunks initially limited to **12,000 characters or 200 lines, whichever is reached first**. Record counts and explicit next-entry/line boundaries; finish every required entry across continuations. Reuse prior analysis only after source and dependency verification. Read changed entries and missing continuations, not the entire unchanged packet. Tie findings to requirements and source locations; flag compression gaps and uncertainty. Packet token estimates are not actual model usage and cannot establish usage savings.
6. **Original source and baseline checks.** Resolve omitted bodies, handlers, effects, validation, styles, cleanup, and discrepancies against current originals and relevant version-matched documentation. Recheck identities immediately before editing; inspect changed regions if another actor has edited them. Run the relevant existing checks once before implementation and record exact commands, exits, and diagnostics. For read-only Phase 0, use discovery/schema/check inventories; for documentation-only work, verify structure and references rather than running unrelated app builds. Missing tools/environment inputs leave only dependent gates pending; never fabricate source, commands, schema, or results.
7. **Implement and verify.** Make the smallest complete phase change, review the owned diff, and directly verify each assigned acceptance gate. Rerun affected checks after editing. Broaden only for shared impact, failures, or unresolved risks. Repeat a check only after a relevant change, a diagnosed failure, or another recorded reason. Preserve full diagnostic output securely and inspect omitted portions instead of rerunning just to recover output. Separate pre-existing failures from introduced failures; neither may be silently marked passed.
8. **Close the phase.** Update changed facts in the index; record exact results, evidence paths, unresolved questions, and pending manual checks. Finish required cleanup and recheck references/build inputs before marking a phase complete. Do not carry a failed prerequisite into dependent implementation or claim readiness with acceptance checks pending. Continue independent authorized work when a gate is blocked; do not loop on unchanged failures.

**Reader availability:** Reader denotes the validation/extraction role in this workflow. Use an available Reader tool when provided; otherwise use a safe local XML parser with bounded output and the same ledger. A tool's absence never permits skipping a required read. Repowise is optional. If pinned Repomix cannot run and no hash-current packet exists, record that context gate as pending, complete independent discovery, and do not substitute unrelated or stale context.

**Quality and cleanup:** Reuse established helpers, UI components, and locked dependencies. No speculative abstraction, service, dependency upgrade, feature, or broad rewrite. Fix real scope-related defects found by evidence. Trace replacements through imports, routes, exports, tests, configuration, deployed callers, and runtime entry points; remove unused implementation files, helpers, imports, assets, and obsolete tests in the same phase where replacement is proven. Preserve historical migrations, evidence, user work, and still-used cross-client code. The legacy QR endpoint may remain only for documented active callers during a bounded transition; Phase 4 must record its retirement state and owner. A file is not unused merely because a text search finds no import. Do not create a generic cleanup framework.

**Test environments:** MuMuPlayer is approved as the main Android test environment, Docker for isolated database/services testing, and Brave for admin/resident web testing and browser automation when useful. Reuse an available healthy environment; do not add containers, browsers, or dependencies solely for process compliance. Record device/browser/database versions and actual results. Emulator screenshots alone do not prove camera decoding: scan the displayed Android QR through a real camera when available, or leave that manual gate pending. No tests against real resident records or unintended production mutations.

### 6.1 Phase 0 checklist — baseline and contracts

- [x] **Scope/prerequisites:** Current execution request authorizes Phase 0, superseding the historical planning-only wording above. Instructions and existing dirty working-copy ownership recorded; linked hosted Barangayan project `pwjbucnyqexiepoinoke` is the read-only comparison target; mutation tests require a disposable PostgreSQL 17 database.
- [x] **Context inputs:** Current household/attendance/lifecycle source, effective hosted RLS/grants/functions/triggers, active client writers and consumers, deployed QR/delete/export source, QR logs, manifests and locked versions inspected. Material local/hosted differences are recorded, not inferred from migration names.
- [x] **Workflow:** Git baseline → ripgrep → Reader validation → Repomix 1.18.1 → complete bounded XML analysis → original-source verification completed. Two scoped uncompressed packets, manifests/hashes/read ranges and recoverable document snapshots retained; no production writes.
- [x] **Baseline checks:** Discovery/schema/check inventories passed. Real QR request timeouts captured; existing household and lifecycle tests inventoried. Android emulator available; Docker API failure prevents an isolated DB behavioral baseline. No app-build or behavioral-test pass is claimed for this documentation-only phase.
- [x] **Acceptance gate:** Exact future SQL/JSON/error contracts, 2,048-byte QR limit, 30 members plus holder, ordered locks, historical tenant ownership, actor/household erasure and export, legacy caller/retirement gates resolved in the evidence contracts. A01–A17 remain assigned to implementation phases and pending behavior checks in the context index.
- [x] **Handoff:** Phase 0 **Complete (discovery/contracts only)**. [Baseline, discrepancies and verification](evidence/family-qr-attendance/phase-0-2026-10-21/baseline.md) and [contract handoff](evidence/family-qr-attendance/phase-0-2026-10-21/contracts.md) recorded. Phase 1 must first obtain a healthy isolated DB; later phases remain unstarted.

**Progress — October 21, 2026 (Asia/Manila):** Completed Phase 0 only. Both Repomix packets passed generation/security/parse/source-equivalence checks; source identities and other-phase preservation are checked in the evidence `verification.json`. Read-only hosted comparison confirmed the current mirror/conditional save, no collision for the four new APIs, and a missing hosted household archive guard despite local `0115`. QR logs show two 546 worker-limit responses and one 504 idle timeout after approximately 150 seconds; the exact internal stall cause remains unproven. Additional discrepancies: Android Settings also overwrites the roster; generic household mutation reverses the intended lock order; local v2 deletion/export Edge code is not deployed; hosted latest migration identities differ from local `0135`/`0136`. These are explicit implementation/release inputs. Existing source/lockfile work is preserved, no dependencies added, no feature code/migration changed, no commit/push/deployment/remote mutation performed. A01–A17 and physical-camera verification remain pending; Docker HTTP 500/diagnostic timeout is a Phase 1 environment gate.

### 6.2 Phase 1 checklist — data and operations

- [x] **Scope/prerequisites:** Phase 0 contracts and actual conditional-save/mirror/lifecycle code verified. User-authorized Docker recovery provided isolated PostgreSQL 17.6; only Section 4, shared contracts and necessary export compatibility implemented. No repository-instruction conflict found.
- [x] **Context inputs:** Working-copy snapshots/patch and ownership saved; Phase 0 identities revalidated; three scoped Repomix 1.18.1 XML packets fully analyzed across bounded continuations, followed by original-body/grant verification. [Phase 1 evidence](evidence/family-qr-attendance/phase-1-2026-10-21/README.md) and context index record sources, versions, initial done/partial/not-started comparison, omissions and closure.
- [x] **Workflow:** Git → ripgrep → Reader validation → scoped Repomix → Reader XML analysis → original-source verification followed. Cached tooling and existing dependencies reused. Historical packets retained; final candidate identities and snapshot-owned diff recorded separately.
- [x] **Baseline checks:** Before feature edits, 238 existing SQL assertions, 527 shared tests, 13 export tests, iOS typecheck/privacy lint passed. Existing shared standalone typecheck diagnostics and Edge ESLint jsr import failure recorded. Rehearsals used empty local schemas/synthetic accounts; no production data copied or remote changes made.
- [x] **Acceptance gate:** Backend portions A01–A13 and A16–A17 met: 83 attendance plus 238 affected regression assertions; 21 independent-session concurrency scenarios with observed locks; 569 shared tests; 15 export tests; all four app typechecks and supported owned lint pass. Shared standalone diagnostics match baseline. Fresh canonical and missing-guard drift migration rehearsals, exact synthetic recovery/replay and final catalog checks pass. UI/device/deployed-runtime portions remain assigned to Phases 2–4.
- [x] **Handoff:** Phase 1 **Complete (backend only)**. CLI-created migration `20261021111056_household_attendance.sql`, exact four signatures, grants/RLS, source hashes, results and consumer/retirement ledger recorded in [evidence](evidence/family-qr-attendance/phase-1-2026-10-21/README.md) and `verification.json`. Existing signatures/history retained; direct/generic projection writes and legacy arrivals deliberately blocked. No commits, pushes, deployments or remote migration applied.

**Progress — October 21, 2026 (Asia/Manila):** Implemented authoritative holder/member stays, private canonical replay receipts, bounded household reads, current auth/tenant isolation, ordered lifecycle/identity/request locks, guarded stable-ID roster mirror/conditional edits, both account-erasure APIs, and complete owner-scoped paginated exports v1/v2 with shared validation/catalog types. Final review added opaque receipt IDs so different staff using the same request UUID/timestamp cannot cause pagination omissions; the corrected candidate was re-rehearsed and checked. Rehearsals also resolved preserved trusted-owner helper permissions and household-erasure lock inversion. Final local databases `family_attendance_rehearsal_20261021_v5` and `_drift_v5` contain no copied resident data or attendance backfill; fixtures were cleaned. Exact pass/failure history and identities are in the evidence ledgers. Pre-existing five shared type diagnostics and one unsupported Edge jsr-import lint diagnostic remain; no new diagnostics introduced. Plan discrepancies: earlier planning-only wording is superseded by this execution request; hosted missing archive guard and migration-history drift, plus undeployed local v2 privacy code, remain rollout inputs. The migration is a coordinated server cutover and must not be deployed ahead of the later staff/client release. Phases 2–4, Brave/MuMu/physical-camera flows, deployed Edge smoke/console checks and production recovery remain pending their assigned phase/authorization; no completion is claimed for those gates.

### 6.3 Phase 2 checklist — admin workflow

- [x] **Scope/prerequisites:** Phase 1 contracts/source identities and isolated PostgreSQL 17.6 gates verified. Admin-only scan/lookup, center/person selection, review, receipts and checkout implemented inside existing Households & Residents. No native code or later-phase implementation; no repository-instruction conflict.
- [x] **Context inputs:** Shared contracts, route/table/generic editor, existing directory selector, decoder/UI availability, projection consumers, lifecycle allowlists and tests inspected. Initial done/partial/not-started comparison and final source identities recorded in [Phase 2 evidence](evidence/family-qr-attendance/phase-2-2026-10-21/README.md).
- [x] **Workflow:** Git → ripgrep → Reader validation → scoped Repomix 1.18.1 → bounded complete XML analysis → original-source verification followed. Sensitive inputs excluded and user work snapshotted. User-authorized coordination resolved overlapping Web-plan work: one workflow/migration, one production owner; this chat independently reviewed final shared source/reports and owns this plan/evidence.
- [x] **Baseline checks:** Before edits, admin typecheck/lint exit 0 (two unrelated warnings); 152 tests pass/one pre-existing request-editor failure. Network-enabled baseline Webpack passes after diagnosing font DNS/Turbopack stall. Final typecheck/build pass, same lint warnings, admin 159 pass/same one failure, 45 shared tests pass; 263 SQL assertions and full additive projection rehearsal pass; Brave real local API/database flow passes 14 groups with no console errors.
- [ ] **Acceptance gate:** Admin local portions A01–A11 and A15–A17 met; A12–A13 unchanged backend evidence retained. A14 actual staff camera decoding the displayed Android QR at normal/enlarged size and A15/A16 real staging Auth/session/navigation remain **pending manual verification**. Synthetic decoder/video, directory fallback, permissions, stale/rejected reads, logout/account-switch, absent/inactive center, exact-key retries, empty selection, duplicate confirm, idle/focus counts and late camera cleanup pass locally. No editable boolean bypass remains in table/record configuration or backend.
- [x] **Handoff:** Phase 2 **Partially complete — implementation/local gates met; physical-camera and staging/session verification pending**. One additive migration `20261021125435_admin_household_attendance_projection.sql`; final 20 source identities/check evidence, consumer/retirement record, screenshots and exact manual steps linked below. Unused duplicate files/temporary jsqr removed; existing html5-qrcode 2.3.8 reused and declared by admin. No commit/push/deployment/remote migration performed.

**Progress — October 21, 2026 (Asia/Manila):** Completed the shared admin implementation with the explicitly authorized Web-plan chat as sole production owner, avoiding duplicate paths and preserving both working-copy snapshots. Added secured scanner/directory lookup, holder-aware unselected roster, explicit center/person review, atomic arrival/exact-stay departure, named authoritative receipts and bounded original-request Retry. Replaced legacy boolean editing/direct member writes with the dedicated workflow/privileged roster action; authoritative projection counts include holders while member table/archive IDs are preserved. Independent review closed stale-review, invalid-new-QR, readable lifecycle error and per-person receipt gaps. Browser late-permission testing found and fixed a native camera-track leak after dialog close. Final checks: typecheck/build pass; lint has only the same two pre-existing warnings; admin tests 159 pass with the same unrelated request-editor failure; 45 shared tests and 263 SQL assertions pass; Brave 155.0.8059.85 → actual Supabase/PostgREST 14.5/PostgreSQL with synthetic Auth/media passes 14 groups, zero console errors. Current source identities and full projection migration rehearsal verified. [Implementation, acceptance allocation, owned diff/context ledgers and pending manual steps](evidence/family-qr-attendance/phase-2-2026-10-21/README.md), [candidate/check identities](evidence/family-qr-attendance/phase-2-2026-10-21/verification.json). Physical displayed Android QR, real staging login/role/account navigation, Phase 3 resident integration and Phase 4 release/recovery remain unperformed. Historical planning-only status is stale and superseded by execution authorization; hosted schema/Edge drift remains an existing rollout input. Other plan phases and all acceptance definitions preserved.

### 6.4 Phase 3 checklist — resident integration and legacy cutover

- [x] **Scope/prerequisites:** Phase 1 backend and Phase 2 admin implementation/security contracts verified against current source and prior candidate identities. Inherited physical-camera/staging gates remain open. Android integration plus required web/iOS legacy compatibility implemented; no backend migration or later-phase work. No repository-instruction conflict.
- [x] **Context inputs:** Family/QR/modal/hooks, both Android roster editors, focus/account lifecycle, all resident legacy writers and the Android queue, web image caller, shared contracts and affected tests inspected. Working-copy snapshots and owned diff preserve pre-existing work. Initial classification and source/read identities are in [Phase 3 evidence](evidence/family-qr-attendance/phase-3-2026-10-22/README.md).
- [x] **Workflow:** Git → ripgrep → Reader validation → scoped Repomix 1.18.1 → bounded complete XML analysis → original-source verification followed. Initial packet and small final supplement source-equivalent; no dependency change, omitted required continuation or measured usage-savings claim.
- [x] **Baseline checks:** Android lint/260 tests, 42 shared tests, web types/affected lint, iOS types/54 affected tests and Android export passed. Three pre-existing Android TS2859 diagnostics recorded. Final checks: 266 Android tests, 49 affected iOS tests, four web contract groups, 13 Family/scanner and 12 Settings browser groups pass; web/iOS types and lint pass. Android types retain only baseline diagnostics; introduced test-import lint warning corrected and verified. Native MuMu Android 12 rendering, normal/enlarged QR decoding, statuses, dark theme and 130% text exercised with synthetic transport; no new native warning in the isolated test window.
- [ ] **Acceptance gate:** Local QR/holder/status, conditional-save, error/account/timeout/idle-count and client cutover gates met. A01–A02 real staff-to-resident arrival/departure, A14 physical staff camera, and A15–A16 full authenticated candidate/staging navigation remain **pending manual verification**. Existing server guards for old/queued writes are hash-current but were not deployed or rerun against a remote target. Exact acceptance allocation and manual steps are recorded in Phase 3 evidence; no synthetic test is presented as a production or physical-camera pass.
- [x] **Handoff:** Phase 3 **Partially complete — implementation/local gates met; real authenticated end-to-end and physical-camera gates pending**. Removed unused Android/web write hooks, Android queue producer/replay code and obsolete iOS receipt parser/reconciliation. Web still calls `generate-household-qr`, so its endpoint is retained with a verified caller and retirement condition. No commits, pushes, deployment, remote migration, external configuration change or data deletion.

**Progress — October 22, 2026 (Asia/Manila):** Implemented local validated v1 Family QR with no identity/contact/session data beyond the household reference; holder-aware totals and per-person active/latest-departure records with Manila timestamps; explicit/focus/resume reads with deadlines, cancellation and account isolation; conditional Family and Settings roster saves with raw snapshots, stable IDs, stale/active-removal feedback and explicit reload. Settings demographic-only saves no longer rewrite the roster and partial saves are reported truthfully. Android/web center scans now explain staff confirmation and never submit attendance; iOS legacy scanner requests fail locally with the same guidance and old scan history is labeled legacy. Existing backend cutover/RLS/lifecycle code is unchanged. Both native QR sizes decode through the existing staff decoder from framed MuMu screenshots; an actual physical camera and full authenticated staging workflow remain unverified. Baseline/final diagnostics, source identities, owned diff, cleanup/consumer ledger, environment limitations and exact manual steps: [Phase 3 report](evidence/family-qr-attendance/phase-3-2026-10-22/README.md), [verification identities](evidence/family-qr-attendance/phase-3-2026-10-22/verification.json). The plan's historical planning-only wording and blanket “Phases 1–2 pass” prerequisite are stale: execution is authorized, while prior camera/staging gates cannot be inferred complete. All other plan phases and acceptance definitions are preserved.

### 6.5 Phase 4 checklist — verification, cleanup, release readiness

- [ ] **Scope/prerequisites:** Phase 1 and Phase 2–3 implementation/local portions verified in code/source identities. Inherited physical-camera/actual Auth/full-native gates remain open. Exact local candidate and linked comparison target recorded. Another actor renamed/pushed 0137–0141 during execution; pushed history preserved, restored final chain and latest target catalog inspected. No remote mutation by this task.
- [x] **Context inputs:** Index, prior hashes/dependencies, real RPC/guard/caller bodies, actual migrations, checks/builds and unresolved gates inspected. Cached Repomix 1.18.1 primary packet (11 entries), two-entry maintenance supplement and one-entry 0140 restoration supplement, two-entry 0141 export supplement and five-entry final owned-code review analyzed. Unchanged restoration bodies reused only after equality/dependency checks; new wrappers/anchor/postflight read completely. No full-repository repack.
- [x] **Workflow:** Git baseline/snapshots → narrow ripgrep → Reader/source validation → scoped Repomix → bounded XML analysis → original-source checks followed. All 94 protected baseline inputs preserved, including hash-identical renamed migrations. Historical Web evidence overwritten by the existing test runner was restored after saving this run's result separately. No repository-instruction conflict; historical planning-only heading is superseded by execution authorization.
- [x] **Baseline checks/local verification:** Fresh PostgreSQL 17.6 empty-schema rehearsal through 0138, then the newly introduced 0139→0140 restoration chain, passes with zero presence backfill. Final schema through 0141: 480 SQL assertions, 21 actual independent-session scenarios, exact pause/restore/replay and 17 Brave staff-to-actual-Family/real-REST groups pass. Baseline Android 266/shared 569/iOS 64 tests pass; final affected shared 44/admin attendance six pass. Final Android export/admin Webpack builds and supported types/lint pass except the same three pre-existing Android TS2859 diagnostics; admin baseline retains its unrelated request-editor failure/two warnings. Native supplement: nine real-API flow groups plus 320dp/130%-text/input focus pass; software native QR decode passes (normal captured pixels explicitly doubled; enlarged direct), warning/error log empty. Display/font settings restored and owned services/ports stopped. Synthetic Auth/provider limits and physical/full-release/tabs/visual-keyboard gates remain explicit. Latest read-only hosted catalog after external 0140 confirms restored tables/APIs/guards and inspected permission denials; it is not a behavioral target test.
- [ ] **Acceptance gate:** All local backend/client portions have recorded evidence for the restored candidate; all A01–A17 retain actual target/manual gates. Physical camera, real staging Auth/deployed privacy/full installed native navigation and any target data affected by externally applied 0139 still require verification. 0140 restores schema, not dropped records. No release readiness or data recovery is inferred from empty-database success.
- [x] **Handoff:** Clear maintenance copy, operator-only pause/resume SQL, repeatable isolated recovery test, exact candidate/check identities and [rollout/recovery/retirement handoff](evidence/family-qr-attendance/phase-4-2026-10-22/rollout-recovery.md) delivered. Phase 4 **Partially complete — authorized local implementation/verification complete; required target/hardware/actual Auth gates pending**. No dependency, commit, push, deployment, remote migration/config change or real-data deletion by this task. Active Web QR endpoint retained with verified caller/owner/next-cutover retirement gate.

**Progress — October 22, 2026 (Asia/Manila):** Implemented pause/resume recovery controls and clear temporary-unavailability copy, and verified exact stay/receipt preservation, delayed arrival/departure replay and a later active visit. Current staff and actual Android Family components share real local REST/database in a verified two-of-four workflow; both final builds pass. During execution another actor renamed the timestamp migrations to 0137/0138 (same bytes), recorded destructive 0139, then pushed 0140 restoring the definitions. Initial linked catalog lacked the feature; the later read-only catalog/history confirms 0140 and restored boundaries. Independent local 0139→0140 rehearsal plus all 464 SQL assertions, 21 races, recovery and 17 browser groups pass. Pushed history remains untouched; any real data affected before 0140 requires operator reconciliation, which this task neither assumes nor performs. New 0140 pre/postflight checks and deletion-v2 executable anchor were source/XML verified; remaining bodies match the prior tested implementation. Recovery and browser harness failures were diagnosed/corrected and final full scoped reruns pass; failed/alternate-compiler/out-of-base lint attempts remain recorded, not relabeled passes. Known Android type complexity, admin unrelated diagnostics and earlier Metro cache/color tooling warnings remain. Staff browser console errors and resident warnings were captured; the staff warning channel and full native runtime remain attended verification limits. [Report, every acceptance status and manual steps](evidence/family-qr-attendance/phase-4-2026-10-22/README.md), [identities/check evidence](evidence/family-qr-attendance/phase-4-2026-10-22/verification.json). All other phase sections and acceptance definitions are preserved.

**Continued progress — October 22, 2026 (Asia/Manila):** Per user direction, kept remote checks pending and completed available MuMu native work; physical camera remains pending because only software decoding is available. Native real local API arrival/departure, clear error/Retry, theme/font/accent, focus/idle, AppState resume, delayed-account/logout isolation and real conditional add/edit/remove pass. 320dp/130% text controls and input focus pass; full installed release bottom navigation/actual Auth and visual keyboard overlap remain pending. Normal native QR passes with explicitly recorded nearest-neighbor doubling; enlarged settled pixels decode directly using existing staff library. Resolved native environment failures through documented MuMu instance-0 restart, not product changes; exact failures/retries and zero final native warning/error output retained. User/device display settings restored, test app closed, owned reverse ports/servers stopped. External 0141 source/test/target-static-catalog inspected and all nine SQL suites pass 480 assertions; mutation/race/recovery/browser evidence remains valid for unchanged functions. No new product native code, dependencies or remote mutations. Final scoped Repomix/code/diff/preservation/identity audit recorded in Phase 4 evidence.

**Final local audit — October 22, 2026:** Actual PostgREST pause checks return both exact mapped permission errors, commit no stay/receipt changes and restore authenticated grants. All 94 protected baseline inputs and original attendance migration bytes remain preserved; other phase sections and acceptance definitions are unchanged. Final owned diff, current artifacts/logs/source identities, five-entry final Repomix complete-read ledger and every A01–A17 pending release gate verified. No unauthorized remote write, commit, push or deployment.

## 7. Required verification

- **A01:** Holder-only household: scan, arrival, visible status, departure, preserved history.
- **A02:** Partial family: selecting two people out of four creates exactly two stays; unselected people are unchanged.
- **A03:** Duplicate QR events, double confirmation, and two-device concurrent check-in create one active stay per person without resetting arrival time.
- **A04:** Two devices attempting different centers produce one valid active stay and one explicit conflict.
- **A05:** Lost response: retrying the same request returns the original receipt. A delayed arrival retry after checkout does not reopen the visit. Role removal or barangay reassignment denies receipt access even with the original request UUID.
- **A06:** Repeated or delayed checkout closes only its original stay; a subsequent visit remains open.
- **A07:** Mixed invalid selection fails atomically; no partial attendance or orphan receipts are committed. The same request key with changed inputs is rejected.
- **A08:** Forged member IDs, another household's IDs, changed client barangay, inactive/deleted users, anonymous callers, and cross-barangay staff are rejected. Same-barangay lookup does not expose historical records owned by another barangay.
- **A09:** Residents cannot write attendance through direct tables, legacy boolean updates, generic record mutations, old scan endpoints, or queued legacy requests.
- **A10:** Editing a member's name preserves history. Concurrent removal and check-in cannot lose a person or attendance record. Removing an active member fails clearly.
- **A11:** Inactive centers still allow checkout. Center/member archive and household/center barangay reassignment cannot strand active stays, including concurrent lifecycle changes.
- **A12:** Roster conditional saves reject stale editors and preserve member IDs and attendance.
- **A13:** Account deletion and export cover new attendance and receipt data without breaking existing cleanup or actor/time constraints.
- **A14:** QR works at normal and enlarged size in MuMuPlayer as the main Android environment. Verify actual camera decoding from a displayed QR on available hardware; record a physical-device check or explicitly pending hardware gate. Staff permissions and existing directory fallback work without a camera.
- **A15:** Family loading/failure/retry, app resume, logout/account switch, larger text, narrow screens, light/dark themes, and bottom-navigation clearance are usable. Expected failures show plain messages without raw diagnostic codes and never report false success.
- **A16:** Timeouts end busy states; explicit retries retain the request key; callbacks/effects cannot create resubmission or refresh loops. Observe stable request counts after idle, focus changes, close/reopen, and repeated camera callbacks; unrelated state changes do not trigger writes. No newly introduced unhandled exception, stale-account update, or warning attributable to this change remains.
- **A17:** Every replacement has an inspected consumer/retirement record; unused owned code/files/imports/assets/tests are removed, retained compatibility paths have a verified caller and retirement condition, and unrelated work/historical migrations/evidence remain intact. Candidate checks and migration/recovery rehearsal have exact evidence.

Run focused database tests under authenticated roles, including two independent connections for races. Run shared schema tests, app typechecks/lint, relevant existing household/admin lifecycle regressions, and the end-to-end workflow. Mock-only tests do not satisfy concurrency, authorization, or real QR scanning acceptance.

Maintain one coverage row per A01–A17 in the context index with responsible phase, exact test/check, candidate source identities, actual result, and evidence. Reuse results only while their source/dependency/environment identities remain valid. Read-only discovery is not a passing behavioral test. Do not write tests that merely mirror implementation or run unrelated suites for reassurance.

## 8. Rollout, recovery, and definition of done

Before enabling, capture legacy data and counts, verify grants/RLS in staging, and document which old attendance paths are disabled. Do not backfill current presence from old scan timestamps. Release a clear staff message explaining that existing families must be confirmed through the new workflow.

Coordinate backend and client rollout: enforce the new attendance write boundary before enabling staff confirmation, and deploy compatible resident/admin clients with plain fallback messages. Track the old QR image endpoint's active callers during transition. Remove its local implementation and deployment only when consumer verification proves it unused; record an external caller as a specific retirement blocker rather than deleting a working dependency or leaving undocumented dead code. No new monitoring service is required.

If a release fails, disable new attendance actions and show a temporary unavailability message. Keep recorded stays and receipts intact; do not fall back to the old blanket status update. Repair forward or restore a verified backup using the deployment runbook. An additive schema can remain while clients are rolled back, with legacy attendance mutation blocked.

The feature is complete when an authorized admin can scan the resident's actual Family QR, retrieve only an allowed household, check in exactly the selected holder/members once, and check them out with timestamps; the resident sees the resulting per-person records; and cross-barangay access, direct writes, concurrent requests, and retries cannot bypass those rules.

Release readiness requires A01–A17 to pass for the actual candidate and deployment target, with no unresolved scope-related defects or required manual verification. A plan cannot guarantee zero defects; report demonstrated results and concrete remaining limits. Do not claim bug-free execution or production readiness from a successful build, a packet summary, or an unchecked checklist.

This plan adds no new family membership service, staff-role system, or separate backend service. It adds one attendance table and one private retry-receipt table, reusing the existing household and admin foundations.
