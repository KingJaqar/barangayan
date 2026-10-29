# Resident registration: residency approval gate implementation plan

**Date:** 29 October 2026 (Asia/Manila)
**Status:** Implementation **not started** · Deployment **not started** · Production validation **not started**. Planning complete except open decision Q1 (blocks Phase 5 only).
**App(s):** `apps/resident-android-mobile`, `packages/shared`, `supabase/migrations`, plus a pending message in `apps/resident-web` and `apps/resident-ios-mobile`.
**Builds on:** `plans/Resident_Registration_Proof_of_Residency_Implementation_Plan_2026_10_28.md` (ID step, `0150`, `0151`) and `plans/Resident_Android_Notifications_and_Announcements_Implementation_Plan_2026_10_27.md` (A08/A09 in `0146`; worker and pg_cron live on hosted).
**Precedence:** repository instructions and the owner's requirements override this plan and any tool recommendation. Root `AGENTS.md` is empty; `apps/admin-web/AGENTS.md` only concerns its Next.js version, and admin-web is not touched.

**Evidence labels** (used throughout; resolved decisions keep their D-ids):
- **[F]** verified fact, with the file:line or command it rests on;
- **[A]** assumption, with how execution confirms it;
- **[Q]** open decision;
- **[B]** blocker;
- **[O]** optional improvement, kept out of scope.

Facts were read from the working tree and from hosted (read-only SQL) on 2026-10-28/29.

## 1. Outcome and scope

**Outcome.** A newly registered resident cannot use their account until barangay staff approve the valid ID submitted during registration. They wait on a blocking screen, are told when they are approved or rejected, see a one-time welcome, then reach Home. The database enforces the block.

**In scope:**
- the email and Google flows on Android (4.1);
- the Waiting and Welcome screens;
- per-account review state, two RPCs and the server-side block;
- tolerant status parsing;
- a pending message on resident-web and iOS.

**Out of scope:**
- existing residents and all staff/admin accounts (D3);
- admin-web changes (its ID review is reused unchanged);
- email (Brevo) notices and FCM setup;
- any automatic action at 24 h;
- clean-up of abandoned pending accounts.

Problems found along the way go in the final report, not fixed. Already found: hosted has a leftover barangay row "Synthetic Phase Five QA 96b411fc" [F: hosted `select name from public.barangays`].

## 2. Completion contract (owner requirements made measurable)

No checklist guarantees zero defects, and none is claimed. A phase is **verified** only when all its gates pass. Status comes from evidence, never intent. Implementation, deployment and production validation are separate statuses (header), each claimed only with its own evidence.

| Requirement | Acceptance criterion |
|---|---|
| Works end to end | Journeys J1–J8 (section 6) pass in their stated environments, with no new failures against the Phase 0 baseline. |
| Scope only | Every changed file maps to a row of section 6; anything else is reverted or justified in the report. |
| No errors | No new errors or warnings in the affected surfaces' typecheck, lint, build, tests (pgTAP, vitest) or runtime logs (Metro/device console, Brave console, Postgres logs on the clone) compared with the baseline. |
| Lean | No new dependency. The only new abstractions are the ones section 4 names (settings table, predicate, two RPCs, two screens), each with its reason in section 3. No size or performance claim without a measured baseline. |
| Old code removed | Code replaced by this plan (the strict status parse, the stale "gated per feature" comment at `resident-account-setup.ts:106`, and any route branch made unreachable) is deleted only after rg shows no remaining runtime, build, config, migration or compatibility use. |
| No loops | Waiting-screen refresh: at most 1 in-flight request, one 60 s timer cleared on blur/unmount, and errors wait for the next tick. No retry loops in Welcome or RPC calls. Any check or approach failing twice for the same reason is diagnosed and revised, never rerun unchanged. |
| Accuracy | Each phase re-confirms the facts it uses before editing (section 5, step 3); stale plan references are corrected in the plan. |
| Testing environments | Android on MuMuPlayer; DB/backend in Docker isolation; resident-web/admin-web in Brave (automation approved); iOS by tests only (no signed builds, OD-06). Anything unverifiable is reported as not verified, with the reason. |

## 3. Decisions

**Resolved:**

| ID | Decision | Basis |
|---|---|---|
| D1 | Email flow: Verify email → Your details → Submit valid ID → Create password → Waiting → Welcome → Home. | Owner |
| D2 | Google: Google sign-in → Your details (now required) → Submit valid ID → Waiting → Welcome → Home; no password step (Settings still offers one). | Owner; password skip accepted with "Write the plan" |
| D3 | Only accounts created while the gate switch is on are affected. | Owner |
| D4 | The block is enforced server-side. | Owner |
| D5 | After 24 h pending (from the current submission's `submitted_at`), show "Valid ID approval might take longer than expected." No other action. | Owner |
| D6 | Rejected: "Your ID needs attention", the staff reason, Resubmit ID. `0150` limits apply: immediate retry, and a 1 h lock from `reviewed_at` after the third consecutive rejection [F: `0150_id_resubmission_rate_limit.sql:26,29`]. | Owner |
| D7 | Waiting screen: Back to login, Browse as guest, and `EmergencyEntryLink` [F: `account-setup.tsx:6,25`]. | Owner |
| D8 | Outcome reaches the resident through existing A08/A09 notifications [F: `0146` copy rows], plus a self-refreshing Waiting screen. FCM is not configured [F: no `googleServicesFile` in `app.json`, per the POR Phase 5 note]. | Owner |
| D9 | Welcome: "Proof of residency verified. Account created. Welcome to Barangayan, Ampid 1!" The name comes from `barangay_localities.display_name` = "Ampid 1", not `barangays.name` = "Barangay Ampid I" [F: hosted SQL]. | Owner copy |
| D10 | Approval is permanent for this gate; a later revocation uses the existing A10 path. | Avoids re-locking a resident whose standing was already established; existing per-feature checks still apply. |
| D11 | Gate switch = a single-row private settings table, default off. | Lets `0153` ship before the new build without changing anyone's flow, and gives a one-statement rollback. `notification_hub_settings` is notification-specific. |
| D12 | The screens use a new RPC, not new keys on `get_resident_account_setup_status`. | Installed builds parse that status strictly [F: `resident-account-setup.ts:26`], and a new key broke them once (`0151`). |
| D13 | Main lever for the block: `public.current_barangay_id()` returns null for a pending resident. | It is `select barangay_id from public.profiles where id = auth.uid()`, `security definer` [F: hosted `pg_get_functiondef`], used by 70 of 142 `public`/`storage` policies [F: hosted `pg_policies`]. `current_role()` is used by 0 policies [F], so it is not a lever. |
| D14 | "Welcome shown" is stored server-side. | Survives reinstall and phone changes. |
| D15 | "Browse as guest" on the Waiting screen calls the existing `signOut`, then `setGuest(true)`, then `router.replace('/home')`; no new component. | `GuestBrowseButton` only sets guest without signing out [F: `guest-browse-button.tsx:25`], and guest applies only without a session [F: `use-auth.tsx:192`]. Same calls, no new abstraction. |
| D16 | Phase 1 needs no deleted test: none asserts rejection of unknown keys. | [F: `resident-account-setup.test.ts:29-40` covers routing only] |

**Open:**
- **[Q] Q1 — blocks Phase 5 only.** May a pending resident still delete their account (the existing deletion RPC stays allowed)? Proposed yes, for privacy. No delete button is added to the Waiting screen either way.

## 4. Design

### 4.1 Flows and routing
Returning residents, with a saved login or a fresh login, route by server state:

| Account state | Lands on |
|---|---|
| Setup step unfinished | First unfinished step (as today) |
| Review `pending` (ID pending or rejected) | Waiting |
| Review `approved`, welcome not shown | Welcome |
| Review `approved` with welcome shown, or `not_required` | Home (as today) |

Unfinished steps take precedence over the review gate. A tapped A08 notification lands wherever this table says, so a newly approved resident opens Welcome.

Today, `residentSetupRoute` [F: `resident-account-setup.ts:91`] routes email accounts details → ID → password and leaves Google's details/password `required: false` [F: `:117,:119`]. Its only runtime consumer is `use-auth.tsx:192` [F: rg].

### 4.2 Waiting for staff approval screen

| State | Content |
|---|---|
| Pending, under 24 h | "Your valid ID is being reviewed by barangay staff. We'll notify you once it's approved." |
| Pending, 24 h or more | Same + "Valid ID approval might take longer than expected." |
| Rejected | "Your ID needs attention", `rejection_reason`, Resubmit ID → existing `ResidentIdCaptureStep` |
| Rejected, locked | Same, with Resubmit disabled and a countdown to the unlock time |
| Approved | Goes to Welcome |

- **Always shown:** Back to login, Browse as guest (D15), `EmergencyEntryLink`.
- **Back button:** Android Back stays on the screen (the ID step's BackHandler rule).
- **Refresh:** on mount, on app foreground, and every 60 s while focused, with the limits in section 2. It's a timer because `id_submissions` is not in the realtime publication [F: rg for `supabase_realtime` in migrations].

### 4.3 Welcome screen
Copy per D9. Continue calls `mark_residency_welcome_seen()` and goes Home. If that call fails, Continue still goes Home and the next launch shows Welcome once more; no retry.

### 4.4 Database — `0153_residency_approval_gate.sql` (hosted is at `0152` [F: `supabase db push` output 2026-10-28])

**Review state.** `barangayan_private.resident_account_lifecycle` has one row per Auth user, written by the trigger `observe_resident_auth_password` after insert on `auth.users` [F: `0107_resident_account_setup_lifecycle.sql:48`]. `0153` adds:
- `residency_review text not null default 'not_required'` with a check on `('not_required','pending','approved')`, so every existing row becomes `not_required` (D3);
- `residency_approved_at`, `residency_welcomed_at`;
- the settings table (D11), default off.

The insert path sets `pending` only while the switch is on. Every check also requires `profiles.role='resident'`, so staff are never blocked.

- **[A]** The insert trigger also fires for Google sign-ups, because they create an `auth.users` row. Phase 2's pgTAP confirms this with a Google-shaped user insert.

**Approval.** An `after update of decision` trigger on `id_submissions` moves a `pending` account to `approved` (with a timestamp) when its submission becomes `verified`. A rejection leaves it `pending`.

**RPCs** (caller-only):
- `get_resident_residency_status()` returns `review`, `welcomeShown`, the current submission (`decision`, `submittedAt`, `reviewedAt`, `rejectionReason`), `resubmitLockedUntil` (the `0150` rule), `slowReview` and `barangayName`.
- `mark_residency_welcome_seen()` sets the welcome timestamp once.

**Block.** A predicate `barangayan_private.resident_access_open()` is false only for a pending resident. It's applied through D13, plus explicit checks wherever Phase 0 finds that D13 doesn't cover. The candidates, all [F: hosted]:
- the 33 `authenticated` own-row policies that don't use the lever;
- `active_member_barangay_id()`, used by 1 policy and the hub RPCs;
- the 28 `security definer` functions among the 80 `public` functions executable by `authenticated`;
- storage policies;
- Edge Functions that act on a resident JWT.

**Allowed while pending:**
- own profile read;
- both status RPCs;
- own `id_submissions` read;
- `publish_id_submission` and its storage upload;
- password set;
- notification inbox, summary and mark-read;
- push token upsert/release;
- sign-out;
- public content;
- deletion, if Q1 is yes.

Everything else resident-only is refused.

### 4.5 Client contracts
- `residentAccountSetupStatusSchema` strips unknown keys instead of `.strict()`, along with any other strict status parser Phase 0 finds.
- `residentSetupRoute` gains `awaiting_approval` and `welcome`. For a pending Google account, details and ID are required and `password` is never routed.

## 5. Phase workflow (shared by every phase)

**Git baseline → ripgrep (Repowise-assisted when useful) → Reader validation → scoped Repomix → Reader XML → original-source verification.** Its purpose is lower usage through reuse of verified context; that's an objective, not a measured result.

| Step | Do | Record in the context index |
|---|---|---|
| 1 Git | `git status --short` and a diff stat of the phase's touch list; identify the owners of other changes (HEAD ≠ working copy); save a patch of touched files before editing; keep secrets out of packets. | HEAD, pre-existing changes, patch path |
| 2 ripgrep | Verify prerequisites in code, then run narrow, batched, bounded searches for files, callers, tests, routes, schemas and config. **Repowise:** [A] not exposed here (earlier plans record the same); used only if available and its index is checked against the working copy. | findings, discrepancies |
| 3 Reader | Classify inputs as unchanged, changed, missing or uncertain by `git hash-object`; reuse only verified findings. A matching hash shows identity, not complete analysis. | inspected ranges, open questions |
| 4 Repomix | Only for uncovered context: a scoped packet with Repomix 1.18.1 ([A] the version earlier plans pin; confirm with `npx repomix@1.18.1 --version`), security check on; a supplemental packet beats regenerating. | selectors, included files, hashes, omissions |
| 5 Reader XML | Chunks of at most 12,000 characters or 200 lines, with continuation boundaries recorded; read every required entry fully. | counts, ranges, gaps |
| 6 Source | Resolve gaps in the original source; run baseline checks **once** before editing; make the smallest complete change; review the owned diff; check each gate; rerun only affected checks. | baseline and final results |

- **Context index:** `plans/evidence/residency-approval-gate/context-index.md`, updated in place.
- **Phase evidence:** `…/phase-N/`.
- **After each phase:** update this plan's status and add a progress note.

**Environments:**
- **Docker:** a disposable clone of `notif_p0_20261028` (0144-level [F: earlier rehearsal]) plus `0145`, `0146`, `0148`–`0152`, with the isolated GoTrue/PostgREST stack for app walks.
- **MuMuPlayer:** a dedicated instance if others are busy; never airplane mode; drive by screenshot. **[A]** MuMuManager is available; confirmed at Phase 4 entry.
- **Brave:** web checks.
- **Hosted:** read-only until Phase 7, with owner go-ahead per hosted step. Claude never types credentials or OTPs into an app connected to hosted.

## 6. Requirement → phase → verification

| ID | Requirement / journey | Phase | Verification method → passing condition |
|---|---|---|---|
| R1 | Installed builds keep parsing status | 1, 7 | vitest extra-key payload parses; old-build smoke after `0153` on hosted → setup loads |
| R2 | Existing and staff accounts unaffected; inert while switch off | 2, 5, 7 | pgTAP → `not_required` rows unchanged; hosted query → 0 `pending` before switch-on |
| J1 | New email registrant: code → details → ID → password → Waiting | 3, 4, I1, 7 | routing tests; MuMu walk; owner-run hosted registration |
| J2 | New Google registrant: details required → ID → Waiting, no password | 3, 4, I1, 7 | same |
| J3 | Pending ≥ 24 h shows the slow-review message | 2, 4 | pgTAP backdated `slowReview=true`; MuMu walk on clone |
| J4 | Rejected → reason + Resubmit; third rejection → lock and countdown | 2, 4, I1 | pgTAP lock time = `reviewed_at + 1 h`; MuMu walk |
| J5 | Approved → Welcome once → Home, live and on relaunch | 2, 3, 4, I1, 7 | pgTAP trigger; routing tests; MuMu walk incl. relaunch |
| J6 | Browse as guest / Back to login from Waiting | 4 | MuMu walk → signed out, guest Home / login |
| J7 | Pending resident refused by the DB on blocked paths, allowed on allow-list | 5, I1 | pgTAP allow/deny matrix → all pass |
| J8 | Web/iOS show the pending message | 6, I2 | vitest/harness; Brave walk (web) |
| R3 | No new errors, lean, old code removed, no loops | all | section 2 criteria per phase |

## 7. Phases (dependency order: 0 → 1 → 2 → 3 → 4 → 5 → I1 → 6 → I2 → 7)

### Phase 0 — Inventory and baseline (read-only)
- **Objective:** classify every resident path as allow or block while pending, and record baselines. No edits.
- **Entry:** hosted at `0152` [F]; Docker DB container up.
- **Consumers to inventory:**
  - hosted `pg_policies` (`public`/`storage`);
  - the 80/28 functions;
  - `barangayan_private` helpers;
  - `supabase/functions`;
  - status parsers in shared, Android, web and iOS.
- **Gates:**
  - an inventory table in the context index, each path labelled with its lever (method: SQL + rg; pass: no path unlabelled);
  - baselines recorded: the pgTAP set (hub, producers, session notifications, registration ID notifications, account setup, Apple setup, front ID, `service_foundations`), shared + Android vitest, Android/web/iOS lint and typecheck;
  - pre-existing failures confirmed, not fixed (`service_foundations` 7, `admin_request_row_workflows` 1).
- **Recovery:** none needed (read-only; the clone is disposable).
- **Exit:** inventory complete; Q1 may still be open.

### Phase 1 — Tolerant status parsing
- **Objective:** status parsers strip unknown keys; nothing else.
- **Entry:** the Phase 0 parser list.
- **Consumers:** `getResidentAccountSetupStatus` → `loadAccountSetupStatus` (Android) [F: `account-setup-status.ts`]; any web/iOS parsers from Phase 0.
- **Risks:** invalid input must still fail — wrong types are rejected; only unknown keys are dropped.
- **Gates:**
  - vitest: an extra-key payload parses, and a wrong-typed payload still throws;
  - shared and Android typecheck and lint pass with no new warnings.
- **Recovery:** revert the patch.
- **Exit:** gates pass. This must ship in the Phase 7 build before `0153` adds any key.

### Phase 2 — Review state, RPCs, approval trigger (`0153` part 1, switch off)
- **Objective:** the 4.4 state, settings table, insert-path default, approval trigger and RPCs. No blocking.
- **Entry:** the Phase 0 clone.
- **Consumers:** `observe_resident_auth_password` (insert path); `id_submissions` (new trigger, alongside the `0146` producers); grants for `authenticated`.
- **Risks:**
  - data integrity: existing rows must default to `not_required`;
  - a concurrent decision update and repeated verify must be idempotent;
  - security: the RPCs are caller-only and expose only the caller's own reason.
- **Gates (new pgTAP file, pass = all ok):**
  - existing rows `not_required`;
  - switch off → new accounts `not_required`;
  - switch on → email and Google-shaped resident `pending` (confirms the [A]), staff not blocked;
  - verify → `approved` once;
  - reject → `pending` with reason and lock time;
  - backdated → `slowReview`;
  - welcome-seen set once;
  - no access to another user's status;
  - the Phase 0 pgTAP set stays at baseline.
- **Recovery:** code — revert. Data — on a clone, drop it. On hosted (Phase 7), forward-fix only; the columns stay.
- **Exit:** gates pass.

### Phase 3 — Shared routing
- **Objective:** `awaiting_approval` and `welcome` destinations, D2, the 4.1 precedence; delete the stale comment at `:106`.
- **Entry:** Phases 1–2.
- **Consumers:** `use-auth.tsx:192` (only runtime caller [F]); `account-setup.tsx` switch on `route.destination`.
- **Breaking change:** adding destinations to the `ResidentSetupRoute` union. Phase 4 lands in the same build; until then, `account-setup.tsx` must not compile against the new union without handling both.
- **Risks:**
  - loading/error: the residency status is still loading or failed → `status_loading`/`status_error`, never Home;
  - stale response after sign-out.
- **Gates:**
  - routing tests for every 4.1 row, both origins, plus loading and error cases;
  - existing-account routes unchanged (existing tests pass);
  - typecheck clean in every consumer.
- **Recovery:** revert.
- **Exit:** gates pass.

### Phase 4 — Android screens
- **Objective:** the 4.2 and 4.3 screens, wiring in `account-setup.tsx`, D15, and notification-tap landing. No other UI.
- **Entry:** Phase 3; an isolated stack running `0153` part 1; MuMu available [A].
- **Consumers:**
  - `ResidentIdCaptureStep` (resubmit);
  - `use-id-resubmit-limit.ts`, whose countdown must match the RPC's `resubmitLockedUntil`;
  - the notification-tap handler;
  - `EmergencyEntryLink`;
  - theme conventions: no hardcoded hex; no Reanimated entering/exiting props.
- **Risks:**
  - failure states: offline, timeout, error;
  - duplicate taps on Resubmit and Continue;
  - a stale response after sign-out or the app going to the background;
  - Back navigation;
  - screen-reader labels;
  - large text and dark mode.
- **Gates:**
  - component/harness tests per 4.2 state;
  - a MuMu walk on the isolated stack for J3–J6 with simulated states, including relaunch;
  - network log shows one request per tick;
  - no new Metro/device console warnings;
  - lint, typecheck and vitest pass.
- **Recovery:** revert; the isolated data is disposable.
- **Exit:** gates pass.

### Phase 5 — Server-side block (`0153` part 2)
- **Objective:** the predicate, D13 and the explicit checks from the inventory.
- **Entry:** Phase 2; **Q1 settled**.
- **Consumers:** every inventoried policy and function, read from the clone rather than old migration files; admin and staff paths that call `current_barangay_id()`.
- **Risks:**
  - authorization: over- and under-blocking;
  - data integrity: no existing account changes state;
  - performance: the predicate runs inside many policies, so measure a representative query plan before and after on the clone (pass: no plan regression from the extra lookup).
- **Gates:**
  - a pgTAP allow/deny matrix (J7) for pending, approved, `not_required` and staff;
  - existing suites at baseline;
  - the advisor shows no new findings on the clone;
  - the query-plan comparison is recorded.
- **Recovery:** revert the function changes (re-create the prior definitions saved in the phase patch). The switch-off path covers hosted.
- **Exit:** gates pass.

### Integration gate I1 — Android against the full `0153`
- **Method:** isolated stack with parts 1+2 and the switch on; MuMu runs J1, J2, J4, J5 and J7 (blocked actions show refusals, not crashes).
- **Pass:** all journeys pass, with no new errors against baseline.

### Phase 6 — Resident-web and iOS pending message
- **Objective:** when pending, show "Your account is waiting for ID approval. Open the Barangayan Android app or check back later." with sign-out. Nothing else.
- **Entry:** the Phase 2 RPC; the Phase 0 list of each app's session gate (resident-web uses Google sign-in; iOS has a register screen [F: rg]).
- **Consumers:** each app's session/setup gate.
- **Risks:** loading and error states must not flash feature screens.
- **Gates:**
  - unit/harness tests in both apps;
  - lint and typecheck pass;
  - iOS by tests only (OD-06).
- **Recovery:** revert.
- **Exit:** gates pass.

### Integration gate I2 — Web against the full `0153`
- **Method:** Brave against the isolated stack, with a pending Google-shaped account.
- **Pass:** the pending message shows, feature routes are unreachable, and no new console errors appear.

### Phase 7 — Release and end-to-end (hosted; owner go-ahead per step)
- **Objective:** deploy and validate. Deployment and production validation are recorded as separate statuses.
- **Entry:** Phases 1–6, I1 and I2 pass; EAS quota or a local build available [A].
- **Order:**
  1. Install the new APK on MuMu.
  2. Push `0153` with the switch off; confirm R1 and R2 with a read-only hosted query.
  3. Turn the switch on.
  4. The owner runs J1 and J2 while Claude observes hosted state; staff reject once, then approve (J4, J5).
- **Risks:** a pending account on an old build. The build goes first, so this can't happen unless someone installs an old APK.
- **Gates:**
  - J1, J2, J4 and J5 observed on hosted;
  - existing accounts unchanged (query);
  - no new errors in hosted Postgres logs for the window.
  - J3 stays clone-only: backdating is never done on hosted.
- **Recovery** (rehearsed on a clone first):
  - switch off → new sign-ups use the current flow;
  - stuck accounts → set `residency_review='not_required'`;
  - function changes → re-create the prior definitions;
  - columns stay (forward-fix only).
- **Exit:** final report written.

## 8. Risks not covered by a phase gate
- **Phone alerts:** A08/A09 phone alerts don't arrive until FCM is configured. Residents rely on the inbox and the self-refreshing Waiting screen.
- **[O]** An approval email via Brevo.
- **[O]** Admin-web showing "waiting since" on pending IDs.
- **Concurrent sessions** share the working tree: edit rather than rewrite, re-check files before editing, keep each phase's patch.

## 9. Final execution report
- **What changed:** files changed and deleted.
- **What was verified:** each gate's actual result, including the method and output location.
- **Material limitations:** simulated versus observed on hosted; checks that were unavailable or pending (never reported as passed).
- **Unresolved risks.**
- **Remaining actions:** including decisions made during execution, with reasons.

No "bug free" or "production validated" claim.
