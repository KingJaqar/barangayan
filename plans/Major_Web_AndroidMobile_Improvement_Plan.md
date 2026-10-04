# Barangayan: Unified Implementation Plan, Execution Phases, and Quality Gates

## 1. Expected outcome and delivery principles

Improve the resident Android app, resident web platform, and supporting web admin workflows so residents can:

- Access document guidance aligned with Ampid 1’s Citizen’s Charter.
- Request the four specified services with appropriate purposes and supporting requirements.
- Reuse an administrator-verified valid ID.
- Register and log in through Google.
- Check their location on an interactive map showing Ampid 1’s boundary.
- View consistent, protected address information.
- Track document processing against the charter’s processing targets.
- Use Android controls with improved size, spacing, accessibility, and reachability.

Administrators retain responsibility for identity verification, requirement review, eligibility, fees, document release, and priority-score access.

Mobile refactoring is limited to the resident Android app. Implementation tasks, compatibility changes, verification, and release gates cover Android, resident web, supporting web admin, and their shared/backend dependencies.

The source for document-service requirements is the supplied charter, particularly pages 4–6: :codex-file-citation{path="C:/Users/User/barangayan/barangayan project paper/Ampid1_CitizenCharter_DocumentProcessing_Context.pdf" purpose="source"}.

### Confirmed decisions

- Registration location checks remain advisory. Outside results are flagged; unavailable location does not prevent registration.
- Residents upload applicable supporting requirements with their requests.
- Personal appearance remains an in-person requirement.
- Administrators confirm unclear fees before payment begins.
- Android uses browser-based Google OAuth.
- Google signup immediately saves a minimal Auth-linked resident profile with available names/email and permits deferring the remaining details. Incomplete accounts can browse general information; required fields must be completed before document requests, health registrations, or report submissions. An expected profile-repair outage shows a retry notice while preserving authenticated public browsing. Profile completion and administrator ID verification remain separate.
- Priority scores are administrator-only, including APIs, exports, and realtime events.
- The document SLA measures agency processing time, excluding explicitly recorded resident-wait periods. Total turnaround is measured separately.
- Historical requests, payments, approved IDs, applicant numbers, and computed scores must be preserved.
- Changes are scoped to Ampid 1’s configuration while retaining barangay data separation.
- Mobile refactoring and mobile release gates cover Android only.
- Administrator Services retains **Add Document Type**, including when charter services exist. Create and edit share a complete Citizen’s Charter form; new services use the minute-based contract, while historical requests retain their original contracts and recorded fees. The Services screen has no **View service SLA report** link; SLA calculations and dashboard reporting remain available.

### Code quality principles

- Reuse existing authentication clients, map infrastructure, libraries, schemas, and UI primitives.
- Keep shared validation, domain types, and timing calculations in the shared package.
- Keep platform rendering and navigation in their respective applications.
- Maintain one authoritative implementation for submission eligibility, fee assessment, ID approval, and SLA calculations.
- Configure services through the database rather than scattered document-name comparisons.
- Separate request status, verification status, fee assessment, and SLA state.
- Introduce small components for repeated behavior; avoid generic workflow frameworks or universal form engines.
- Add dependencies only when the existing stack cannot provide the required capability.
- Avoid unrelated rewrites, speculative features, unnecessary caching, and broad cleanup.
- Remove obsolete implementations after replacements and compatibility are verified.
- Never suppress type errors, weaken authorization, or disable tests to obtain passing results.

Follow [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) and the installed Next.js documentation during implementation.

## 2. Functional specification

### A. Document services and Citizen’s Charter guidance

Initially configure these four charter services for Ampid 1; authorized administrators may create additional document types through Services:

1. Issuance of Barangay Clearance for Business Establishments
2. Certificate of Indigency
3. First Time Job Seeker
4. Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)

For each service, display:

- Office/Division
- Classification
- Type of Transaction
- Who May Avail
- Checklist of Requirements
- Where to Secure the Requirements
- Client Steps
- Agency Actions
- Fees to Be Paid
- Processing Time
- Person Responsible

Present these as readable sections on Android, the web request drawer, and standalone document-detail routes.

Preserve the initial four services’ source requirements, eligibility, offices, procedure grouping, **Simple** classification, **G2C** transaction type, and **15-minute total**. Administrators can subsequently edit classification and transaction type along with the other charter fields; additional services do not inherit invented charter content.

Do not invent associations between individual actions, durations, and personnel where the source does not establish them. Display missing information explicitly; Certified True Copy’s Person Responsible field is blank in the supplied charter.

Extend web admin to maintain charter information, purposes, requirement rules, and pricing configuration.

Keep **Add Document Type** visible alongside configured charter services. Both create and edit support Name, Description, all eleven charter categories above, Processing Target, Purposes, Supporting Requirement Rules, and Pricing. Creation and updates remain restricted to administrators in their own barangay. Remove obsolete separate processing-hours and checklist inputs; reuse existing structured storage and derive any legacy checklist mirror from the charter input.

Clearly distinguish **Processing Time** (procedure duration prose) from **Processing Target** (positive whole minutes used for agency SLA tracking); **Fees to Be Paid** (published charter guidance) from **Pricing** (confirmed fixed fee, staff assessment/exemption, or the supported CTC per-page calculation); and **Checklist of Requirements** (resident guidance) from **Supporting Requirement Rules** (enforced information and attachments). Classification and transaction type accept editable nonempty text. Person Responsible may remain unspecified when the source provides no person. Purposes have editable labels and explanation requirements, with stable codes.

Use the general service workflow for additional services without specialized business, residency, or records details. Supporting rules and per-page pricing must remain compatible with the selected workflow; existing version-two workflows are fixed to preserve request interpretation. Completing a legacy document’s charter upgrades future requests only. Preserve historical contracts, hour targets, timestamps, payments and original fees, including fees that have not yet been snapshotted. Do not apply the charter SLA retroactively.

Provide required-field and range validation, clear loading/success/error states, duplicate-submission protection and save recovery. Verify every field after actual create/reload and edit/reload, database authorization and historical reconciliation, and compatibility of resident web and Android consumers. Implementation and evidence are recorded in [Admin Document Type Charter Form Update](Admin_Document_Type_Charter_Form_Update.md).

Remove the Services screen's **View service SLA report** shortcut while retaining the underlying reporting functionality. Apply pending migrations in order through `0101_unified_document_type_charter_forms.sql` with the compatible consumers during an authorized release.

Retain equivalent existing service identifiers where possible. Deactivate superseded services without deleting historical requests.

### B. Request forms and supporting requirements

Retain the existing Resident Details section and profile-edit navigation.

Replace Purpose of Request with a required dropdown:

| Service | Initial purposes |
|---|---|
| Business Establishments | New business permit application; Business permit renewal; Others |
| Certificate of Indigency | Medical assistance; Educational assistance; Burial/funeral assistance; Financial or social welfare assistance; Others |
| First Time Job Seeker | First employment application; Pre-employment documentary requirements; Others |
| Certified True Copy | Submission to a government office; Legal documentation; Official or administrative reference; Others |

These proposed labels draw on [government business-permit services](https://www.dagupan.gov.ph/business-permit-processing/), [DSWD assistance guidance](https://fo3.dswd.gov.ph/aics/), [DOLE employment guidance](https://dole.gov.ph/dole-issues-rules-on-free-documentary-requirements-for-first-time-jobseekers/), and [government records services](https://www.dbm.gov.ph/index.php/central-office/services-for-client-agencies/1607-processing-request-for-certified-true-copy-ies-of-record-s).

Selecting **Others** reveals a required explanation field. Trim whitespace, enforce a 1,000-character maximum, and store the purpose separately from optional requester notes. Changing services clears incompatible fields and selections.

Collect applicable supporting information:

- **Business clearance:** Business name, establishment address, and DTI attachment.
- **Indigency/First Time Job Seeker:** HOA certification as alternative or supplementary residency evidence; lessor endorsement when the applicant identifies as a transient/renter.
- **Certified True Copy:** Record description/reference and number of copies.
- **All services:** Acknowledgment of personal appearance where required.

A verified ID satisfies identity verification; it does not automatically establish six-month residency or other service eligibility.

Supporting files accept JPG, PNG, WebP, and PDF up to 5 MB each. Keep existing profile-ID image rules. Store files privately with owner and authorized same-barangay administrator access.

Apply shared validation to Android, the web drawer, standalone routes, and other accessible Android or web resident submission paths. Use transactional submission with an idempotency key to prevent duplicates.

### C. Valid ID verification and reuse

Use the existing verification workflow consistently:

| State | Resident experience |
|---|---|
| Not submitted | Persistent warning, Verify Now, document requests blocked |
| Pending verification | Persistent awaiting-review warning, Verify Now, requests blocked |
| Verification failed | Persistent retry warning, Verify Now, requests blocked |
| Verified | Valid ID Verified indicator, approved-ID preview, Valid ID requirement satisfied |

**Verify Now** opens Profile, scrolls to Upload Valid ID after loading, and moves accessibility focus to the section heading.

Verified residents must not upload another ID for each document request. Replace request-level ID uploads with the approved images, ID type, and verification indicator.

Enforce eligibility at the server/database submission boundary, including direct inserts. Recheck the current approval transactionally.

Bind approval to the reviewed evidence:

- Store replacement uploads under versioned, immutable paths.
- Reset verification to pending when the submitted ID evidence or type changes.
- Record reviewer, decision time, rejection reason, and submission version.
- Reference the approved submission from each request.
- Preserve approved legacy images where the evidence exists.
- Flag inconsistent verified records for administrator repair.
- Prevent residents from assigning verification outcomes or overwriting approved evidence.

Unrelated profile edits do not reset approval. Later revocation or replacement blocks new requests without deleting existing history.

Refresh verification after profile updates, administrator decisions, app foregrounding, and returning to Services. Scope cached profile information to the signed-in user and clear it on logout.

### D. Fee assessment, payment, and release

| Service | Pricing treatment |
|---|---|
| Business clearance | Administrator assessment using the applicable tax code |
| Indigency | Administrator-confirmed fee or exemption |
| First Time Job Seeker | Administrator-confirmed eligibility and applicable exemption |
| Certified True Copy | ₱10 per confirmed billable page |

The supplied PDF omits the business tax code and does not explain the shared certificate page’s “₱100 / No fees” distinction. Keep uncertain pricing in assessment mode. Preserve applicable first-time-job-seeker exemptions described by [DOLE](https://dole.gov.ph/dole-issues-rules-on-free-documentary-requirements-for-first-time-jobseekers/).

Residents may submit requests while pricing is pending. Display **Awaiting fee assessment** and prevent payment until an amount or waiver is confirmed.

Store assessment state, amount, basis, assessor, and timestamp on the request. Payment creation, pickup collection, and receipts use that request amount.

For Certified True Copy, staff confirm the total billable pages across the requested copies. Do not multiply an already-totalled page count again.

Explicit waivers bypass payment. Prevent amount changes after payment begins and preserve payment idempotency.

Administrator review covers attachments, approved-ID evidence, eligibility, requirements, fees, personal appearance, and release readiness.

Preserve existing request status names; requirement review and fee assessment use separate state fields. Historical requests retain their recorded amounts and payment behavior.

### E. Charter-based SLA tracking

Minute-based targets assign **15 minutes** initially to the four Ampid 1 charter services. Administrator-configured services use their explicit Processing Target in minutes; changing a catalog target affects future request snapshots only.

Snapshot the assigned target and timing model on each request.

Timing rules:

- Start when staff formally accept complete requirements, with personal-appearance readiness accounted for where applicable.
- Requests awaiting complete requirements remain in a pre-processing state.
- Stop processing time when the document is ready for release.
- Record actual release/collection separately.
- Exclude only documented resident-dependent waiting periods.
- Keep internal agency delays counted.
- Require pause reasons, actor, start time, and resume time.
- Reject overlapping pauses, invalid transitions, and repeated resumes.
- Use server timestamps and second-level calculations, preserving PostgreSQL microsecond precision at threshold boundaries; round only for display.

Maintain:

| Measure | Definition |
|---|---|
| Agency processing time | Acceptance-to-readiness duration minus recorded resident-wait intervals |
| Resident-wait time | Duration of recorded pauses |
| Total turnaround | Online submission through actual release/collection |

Display:

| Condition | Result |
|---|---|
| Under 80% of the snapshotted target (under 12 minutes for a 15-minute target) | On Track |
| 80% through 100% of the target, inclusive (12 through 15 minutes initially) | Near Target |
| More than the target and unfinished (more than 15 minutes initially) | Overdue |
| Paused | Waiting reason alongside retained SLA position |
| Ready at or within the snapshotted target | Completed Within Target |
| Ready after the snapshotted target | Completed Beyond Target |

Cancellation freezes the elapsed record, closes any open resident wait, and is excluded from successful-completion compliance calculations. If a document was already ready, its agency time remains frozen at readiness; turnaround freezes at cancellation.

Evaluate threshold crossings on the server at least once per minute. Persist tenant-scoped administrator threshold events and deduplicate them by request and threshold, including delayed or concurrent evaluations. Phase 5 requires these durable alerts; it does not add a push or email delivery channel.

While tracking screens are open, refresh server metrics every 15 seconds and project elapsed displays every second using a monotonic device timer. Serialize refreshes, time out stalled calls after 10 seconds, and expose connection errors and recovery controls.

Use one calculation module across Android tracking, web request views, administrator dashboards, and reports.

Reports include average processing time, percentage within target, overdue requests, paused requests, resident-wait duration, and total turnaround. Use UTC start-inclusive/end-exclusive reporting windows. Successful readiness timestamps select processing, compliance and resident-wait samples; actual release timestamps select turnaround samples. Current overdue and paused counts use evaluation time independently of the historical report window. Keep legacy hour-based report trends separate.

Preserve historical results and identify requests using the previous timing model. Do not retroactively apply the new 15-minute clock.

### F. Address defaults and location verification

Registration:

- Remove the editable City input.
- Assign **San Mateo** and **Ampid 1** automatically.

Profile:

- Add **Province: Rizal**.
- Display City, Barangay, and Province as greyed-out, readable, read-only fields.
- Keep house/unit number and street editable.

Derive locality defaults from Ampid 1’s barangay configuration and enforce them server-side. Retain the existing tenant identifier and display “Ampid 1” consistently.

Backfill structured locality data without guessing missing house numbers or streets. Preserve legacy free-text addresses that cannot be reconstructed safely.

Reuse existing map infrastructure and provide:

- Red Ampid 1 boundary outline, light fill, and legend.
- Pan/zoom, Detect My Location, Fit Boundary, and Confirm Location.
- Selectable/draggable home pin.
- Inside, outside, and unable-to-check messages.
- Recovery states for denied permission, GPS timeout, missing boundary, and network failure.

Keep GPS observations separate from the selected home pin. Validate coordinates and boundary results server-side.

Registration checks remain advisory. Preserve the constrained behavior of the separate Settings location picker.

Retain boundary provenance and obtain barangay confirmation before presenting the existing trace as officially certified.

### G. Google authentication

Add **Sign up with Google** to registration and **Sign in with Google** to login, using the shared Google branding on web and Android.

Use Supabase Google OAuth with PKCE:

- Web returns through `/auth/callback` and establishes the existing cookie session.
- Android opens browser authentication and returns through `barangayan://auth/callback`.
- Handle warm/cold starts, cancellation, network/provider errors, expired callbacks, repeated taps, and safe internal redirects.

New Google users immediately receive a minimal resident profile linked to their Supabase Auth user ID and may browse general information without completing the remaining details. Persist available first/last name suggestions from the Auth-managed Google identity and the Auth user's email; assign resident role and the sole enabled registration tenant on the server. Prefer structured names, falling back to editable suggestions from the full display name. Never infer names from the email address or invent missing demographics, address, location or ID evidence. Existing profiles retain all saved information. Repeated sign-ins, retries and concurrent callbacks/completion must leave exactly one profile and preserve completed data. Callback and session startup repair earlier Google accounts without a profile through an authenticated operation that accepts no user, tenant or role payload.

On an expected profile-repair failure during public web navigation, keep the authenticated browsing session and show **Retry account setup** with pending/loading feedback. A failed operation must not be presented as a saved profile. Successful retry clears the notice and restores the saved profile view. Unknown or incomplete profile state continues to block protected submissions. Retain safe diagnostic error codes without exposing database messages; unexpected programming errors remain visible to the normal error handler.

Offer completion from Home and Settings, prefill the persisted name/email information for confirmation, and provide “Skip for now” without ending the session or deleting the minimal profile. Missing name details still require resident input. Require the required resident fields, without a password, before requesting documents, registering for health services, or submitting reports. Enforce this at UI and backend write boundaries; retain a safe intended destination after completion. Existing complete users proceed directly. Profile completion does not approve an ID.

Support authenticated users without registration metadata. Profile completion derives user identity and assigns the permitted resident role/tenant on the server.

Preserve existing profiles through supported identity linking. Google authentication does not satisfy administrator ID verification.

Follow [Supabase Google OAuth guidance](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Expo SDK 57 WebBrowser documentation](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/).

### H. Priority-score privacy

Remove scores from resident confirmations, RegistrationDetailSheet, other views, exports, and accessibility text.

Move scores into administrator-protected storage. Remove them from resident-readable responses and realtime events.

Preserve existing values, applicant numbers, capacity handling, scoring formula, administrator ranking, sorting, and exports.

Update shared interfaces and affected Android, resident web, and web admin consumers before removing obsolete fields.

### I. Android interaction standards

Apply:

- Minimum interactive target: **48 × 48 dp**.
- Primary action minimum height: **56 dp**.
- Minimum adjacent-target spacing: **8 dp**.
- Standard horizontal page padding: **16 dp**.

Update buttons, icons, inputs, dropdowns, chips, uploads, sheets, navigation, and map controls.

Position frequent actions within comfortable reach, separate destructive actions, and account for keyboards, scrolling, and safe areas.

Audit auth, services, health, profile/settings, reports, maps, and emergency screens. Verify large text, TalkBack, small screens, themes, and non-overlapping hit areas using [Android touch-target guidance](https://support.google.com/accessibility/android/answer/7101858).

## 3. Detailed execution phases

Each phase requires implementation, focused tests, regression checks, and evidence before advancing.

### Phase 0 — Baseline and change boundaries

**Actions**

- Review repository instructions and version-specific documentation.
- Inventory all affected UI entry points and backend write/read paths.
- Inspect policies, triggers, storage permissions, payment contracts, profile provisioning, and existing SLA behavior.
- Record baseline tests, typechecks, lint, and builds for Android, resident web, web admin, and shared/backend dependencies.
- Preserve uncommitted work and distinguish pre-existing failures.
- Create a requirement-to-verification checklist.

**Exit gate:** Every affected path is identified, and relevant baseline failures are reproducible.

### Phase 1 — Shared contracts and additive foundations

**Actions**

- Introduce the minimum catalog, locality, ID-version, request, assessment, and SLA data extensions.
- Add shared types and validation.
- Add controlled operations for profile completion, ID publication, submission, assessment, and SLA transitions.
- Derive identity and tenant ownership from the authenticated session.
- Add private attachment storage and access rules.
- Preserve compatibility fields temporarily.

**Exit gate:** Migrations succeed on empty and representative existing databases; historical records remain readable; unauthorized operations fail.

### Phase 2 — Trusted ID evidence and locality

**Actions**

- Implement immutable evidence versions and administrator review.
- Preserve valid legacy approvals and flag inconsistent records.
- Protect approved objects from resident modification.
- Add Province, fixed locality enforcement, and safe backfills.
- Correct account-scoped caching behavior.

**Exit gate:** Approval reliably identifies the reviewed evidence; replacement cannot retain approval; locality tampering and cross-account leakage fail.

### Phase 3 — Catalog and administrator workflows

**Actions**

- Configure the four services and charter content.
- Add catalog editing, requirement review, fee assessment, personal-appearance recording, and readiness controls.
- Deactivate superseded services without removing history.
- Configure confirmed, per-page, and assessment pricing.

**Exit gate:** Administrators can review every service and its required decisions; other barangays remain unchanged.

### Phase 4 — Resident document journey and payments

**Actions**

- Deliver charter screens, purpose dropdowns, supporting uploads, and preserved resident details.
- Add Services warnings, Verify Now, and approved-ID reuse.
- Connect every submission path to the shared transaction.
- Add assessment waiting states and request-level payment amounts.
- Preserve retry and payment idempotency.

**Exit gate:** Each service completes its intended submission and assessment/payment journey on Android and web; direct bypasses and duplicate creation fail.

### Phase 5 — SLA engine and reporting

**Status: complete locally — every assigned requirement and exit-gate condition verified.** See the [Phase 5 completion checklist](Phase_5_SLA_Engine_and_Reporting.md) for the requirement mapping, recorded results, worked cases, screenshots and operational instructions. Production deployment and production scheduler operation remain unverified and require an authorized release.

**Completed actions**

- [x] Snapshot minute targets and timing models; preserve historical hour-based requests and immutable request targets.
- [x] Enforce review-gated acceptance, readiness, release and cancellation; stop agency time at readiness and record collection separately.
- [x] Record resident-wait reasons, actors and timestamps; prevent overlap, repeated resumes and invalid transitions; close waits on cancellation.
- [x] Align shared and database threshold calculations with exact timestamp precision and display-only rounding.
- [x] Run the once-per-minute server evaluator with durable tenant-scoped events and deduplication under delays, retries and concurrency.
- [x] Select readiness and release report samples using the correct UTC windows; retain separate legacy trends and current overdue/paused counts.
- [x] Update Android list/detail, resident web list/drawer/detail, older web portal, administrator detail/dashboard/report surfaces; verify loading, paused, error and recovery states.
- [x] Verify database events, shared calculations, browser and Android displays, reports, migrations and historical reconciliation; pass affected tests, types, lint, production web builds and Android export.

**Exit gate:** Database events, shared calculations, UI displays, and reports agree for deterministic timing cases.

**Exit-gate result: PASS locally.** A deterministic readiness case records 900 agency seconds and 60 resident-wait seconds and displays Completed Within Target, 15m 0s processing and 1m 0s waiting across the web and actual SDK 57 Android screens. A released browser journey records 756.447577 agency seconds, 963.762888 resident-wait seconds and 1866.219840 turnaround seconds; SQL/shared values match and Android displays the corresponding rounded values. Report evidence includes three readiness samples averaging 15 minutes, 100% within target and one minute waiting, alongside a separately preserved 24-hour historical completion.

The Services follow-up is also **complete locally**: Add Document Type remains available, the Services SLA-report shortcut is removed, and create/edit/view share all seventeen requested fields. Migration 0100 removes the four-service-only creation restriction; 0101 supports complete charter forms and general services without duplicate storage or historical rewrites. See the [charter-form checklist](Admin_Document_Type_Charter_Form_Update.md) for create/reload/edit/reload and resident compatibility proof. Underlying dashboard/report functionality remains available.

This completion record does not mark Phases 6–9 complete or waive their acceptance and release gates.

### Phase 6 — Registration, profile, maps, and Google

**Actions**

- Deliver fixed addresses, the advisory registration map, and protected Settings picker behavior.
- Add Google buttons, callbacks, session handling, optional initial profile completion and required completion before document requests, health registrations, and report submissions. Keep public browsing available for incomplete accounts; offer a skip action and safe return to the intended service.
- Save a minimal profile immediately from the Auth-managed Google identity; repair earlier missing rows on callback/session startup, serialize provisioning with completion and preserve existing profiles and tenant boundaries.
- Handle expected public-web profile-repair outages with an explicit retry notice and loading state; verify successful server rendering, retry recovery and retained completion gates without reporting a failed save as success.
- Preserve existing users through supported linking.
- Prepare environment-specific setup instructions.

**Exit gate:** Password and Google flows work on web and Android development/release builds, including failures and restart. New Google residents immediately have one Auth-linked minimal profile with available names/email and server-assigned tenant/role; repeated sign-ins, retries and concurrent callbacks do not duplicate profiles or overwrite saved data. Incomplete accounts can browse general information and skip initial completion, while direct links and API attempts to request documents, register for health services, or submit reports require completed resident fields. Expected profile-repair outages preserve public web browsing with an accurate retry notice; retry restores the profile view without a server-rendering crash or observed React script/hydration errors, and saved theme preferences still apply. Completing the profile resumes the intended service and remains separate from administrator ID verification. Existing complete users proceed directly.

**Current evidence: partially complete.** Deferred completion and immediate minimal Google profiles are implemented on web and Android. The user separately authorized applying migration **0104** to the hosted Barangayan project. Its RPC, enabled identity trigger and execution permissions are verified; all **18 existing profiles** retained identical contents. An anonymous Data API call returned **401 / 42501**, confirming RPC recognition and denied anonymous execution. The connector recorded version `20261004082819` for this migration; alignment with repository version `0104` remains separately unapproved and must not be bypassed by replaying the SQL.

Latest recovery checks passed: **197 shared tests**, shared/resident-web/Android types, resident-web lint with two warnings in unchanged location files, resident-web production build, **11 SSR/browser recovery assertions** with no observed console/page errors, and **9 Android callback unit checks**. These recovery browser checks used a synthetic loopback Auth/API transport and do not prove Google consent or database authorization. Earlier minimal-profile checks remain supporting evidence: **396 SQL regression assertions**, the expanded **42-case** focused suite, **34 actual local Auth/REST/RPC checks**, **11 local browser/database checks**, Android export, and empty/representative-history migration replay through 0104. These are separate suites and are not combined into a test total.

The user reports Google signup works; real provider consent/linking and installed Android development/signed-release journeys remain unverified by this agent and keep the full exit gate open. The web recovery changes are local and still require the normal Vercel release. See the [current Phase 6 evidence and manual checklist](Phase_6_Registration_Profile_Maps_Google.md) and [hosted migration/error recovery report](Web_Auth_Error_Fix_2026_10_04.md). No theme-script source change was needed; normal rendering and preferences were verified after expected profile-repair failure handling.

### Phase 7 — Administrator-only scores

**Actions**

- Backfill and reconcile protected scores.
- Update administrator consumers and resident response types.
- Remove all resident score exposure.
- Update affected Android and web legacy consumers.
- Remove obsolete fields after compatibility checks.

**Exit gate:** Resident REST/RPC/realtime/export access cannot retrieve scores; authorized administrators retain correct values and rankings.

### Phase 8 — Android usability audit

**Actions**

- Improve existing primitives using the interaction tokens.
- Audit every resident screen.
- Correct reachability, spacing, keyboard, safe-area, large-text, and TalkBack issues.

**Exit gate:** Recorded checks show no overlapping targets, clipped labels, or inaccessible primary actions.

### Phase 9 — Integration, cleanup, and release

**Actions**

- Run complete affected Android, web, and shared/backend suites and production builds.
- Rehearse migrations on representative data.
- Execute full resident-to-administrator journeys.
- Review changed code for duplication, unused branches, unnecessary dependencies, weakened types, and scope creep.
- Remove verified obsolete implementations.
- Validate setup documentation against staging.
- Prepare the release and recovery runbook.

**Exit gate:** Critical flows pass, data reconciliation succeeds, and no known release-blocking defects remain.

## 4. Verification and quality evidence

### Required test coverage

| Area | Required scenarios |
|---|---|
| Charter/catalog | Four services, eleven categories, accurate wording/totals, missing information, preserved history |
| Forms/uploads | Others validation, conditional requirements, service switching, limits, failed uploads, unauthorized file references |
| ID verification | All states, legacy images, replacement, stale approval, concurrent review/submission, administrator authorization |
| Requests | Direct-link/direct-insert bypasses, forged identity/tenant, inactive services, retries and concurrent duplicate attempts |
| Payments | Unknown amounts, assessments, per-page totals, exemptions, stable amounts, duplicate prevention, historical transactions |
| SLA | Before/at/after thresholds, pauses, invalid transitions, cancellation, readiness, delayed evaluation, snapshots, reporting windows |
| Address/maps | Fixed values, tampering, legacy addresses, polygon edges, denied permission, failures, separate GPS/home pin |
| Google | New/existing users, linking, profile completion, warm/cold callback, cancellation, replay, expiry, session persistence |
| Scores | Resident REST/RPC/realtime/export denial, same-barangay administrator access, cross-barangay denial, migration reconciliation |
| Android | Target dimensions, spacing, reachability, keyboard/safe areas, large text, TalkBack, themes, map gestures |

Use deterministic unit tests for timing and validation, database tests for authorization and transitions, and end-to-end tests for complete journeys. Avoid tests that merely repeat implementation details or large snapshot collections without meaningful assertions.

### Completion evidence

Deliver:

1. Requirement coverage mapping.
2. Test, lint, typecheck, build, and end-to-end results.
3. Before/after migration reconciliation.
4. Screenshots of key resident and administrator states.
5. Worked SLA examples.
6. Code-review findings and compatibility cleanup results.
7. Manual configuration instructions.
8. Clearly identified external prerequisites and unverified limitations.

Screenshots verify presentation. Authorization, concurrency, payment, and SLA correctness require separate evidence.

### Recorded Phase 5 completion evidence

| Evidence area | Verified result | Record |
|---|---|---|
| SLA authorization, snapshots, transitions, concurrency and threshold parity | 83 authenticated API assertions and 62 Phase 5 SQL assertions PASS; 261 assertions across the original six SQL suites PASS | [Phase 5 requirement evidence](Phase_5_SLA_Engine_and_Reporting.md#requirement-evidence) |
| Shared calculations and affected application checks | Original 138 shared tests, affected typechecks/lint, both web production builds, Android Hermes export and SDK compatibility PASS; final nine-check rerun PASS | [Phase 5 final checks](Phase_5_SLA_Engine_and_Reporting.md#final-checks-and-review) |
| Scheduler, browser/Android agreement and recovery | Active local minute schedule with successful runs; deterministic readiness/release agreement; all six native UI assertions PASS; connection outage/recovery observed | [Phase 5 UI and scheduler evidence](Phase_5_SLA_Engine_and_Reporting.md#requirement-evidence) |
| Report windows and historical reconciliation | Readiness/release window tests and separate 24-hour legacy reporting PASS; empty/existing migration rehearsal preserves historical and other-tenant records | [Phase 5 report and migration evidence](Phase_5_SLA_Engine_and_Reporting.md#requirement-evidence) |
| Latest Services form and compatibility regression | 142 shared tests, 316 SQL assertions and 47 browser/database/resident assertions PASS; affected checks, both web builds and Android export PASS; migration replay through 0101 PASS | [Charter-form verification](Admin_Document_Type_Charter_Form_Update.md#actual-verification-evidence) |

These are recorded executions, not new test runs performed while updating this plan. Root-wide lint failures and local advisor warnings are documented separately in the Phase 5 checklist; affected workspace checks pass. Production deployment, production scheduler operation and later-phase external setup are not implied by local completion.

Quality gates establish confidence in covered behavior; they cannot prove the absence of every possible defect. Release requires no known unresolved defects affecting security, data integrity, verification, financial calculations, SLA accuracy, or the requested journeys.

## 5. Manual setup and release controls

### Google setup guide

Provide instructions to:

1. Create/select the Google Cloud project.
2. Configure branding, domains, audience, test users, and OpenID/email/profile scopes.
3. Create a Web application OAuth client.
4. Register resident web origins and the Supabase callback URI.
5. Enable Google in Supabase and supply its client ID and secret.
6. Configure exact web and Android redirect allowlists.
7. Verify the Android scheme in development and signed release builds.
8. Configure local, staging, and production environments.
9. Complete production audience/branding requirements.

The chosen browser OAuth approach uses the Web OAuth client on Android. Native Android credentials and signing fingerprints are necessary only if native Google sign-in is later adopted.

### Phase 6 release status — 2026-10-04

The hosted Barangayan project (`pwjbucnyqexiepoinoke`) has the authorized 0104 schema installed. Its migration-history entry is `20261004082819 / 0104_google_minimal_resident_profiles`, while the repository filename remains `0104_google_minimal_resident_profiles.sql`. Automatic approval review rejected an attempt to align that new history entry because it would modify production bookkeeping without separate authorization. The action did not run; reconciliation approval remains pending. Preserve earlier history and repository numbering. Confirm actual installed objects and history before future migration operations; do not replay 0104 merely because the versions differ.

The retry notice and typed recovery handling have passed local web checks and require the normal web release before they appear on Vercel. No additional Google credential or redirect change is required by the minimal-profile fix. Use the [Phase 6 setup and manual exit checklist](Phase_6_Registration_Profile_Maps_Google.md) to verify real Google signup/repeat sign-in/linking, profile persistence, protected submissions, failures/restart, and installed Android development/signed-release callbacks. These checks remain open. This documentation update does not authorize deployment, further production changes or migration-history edits.

### SLA and Services release setup

During an authorized release:

1. Apply pending migrations in their existing order: 0095–0098 prerequisites, `0099_phase5_sla_engine_reporting.sql`, `0100_restore_admin_document_type_creation.sql`, then `0101_unified_document_type_charter_forms.sql`. Preserve pushed migration numbers and historical columns; ship compatible Android/web consumers together.
2. Verify `service-request-sla-minute` is active on a pg_cron host, runs every minute and records successful job executions. The [Phase 5 operational instructions](Phase_5_SLA_Engine_and_Reporting.md#decisions-and-operational-setup) provide the scheduler queries.
3. If pg_cron is unavailable, configure a trusted database scheduler to call `barangayan_private.evaluate_service_request_slas()` at least once per minute before release. Keep this operation private; repeated evaluations are safe.
4. Reconcile representative historical fees, timing models, timestamps and other-barangay data. Verify live tenant authorization, Services create/edit persistence and report behavior against the released environment.
5. Monitor evaluator failures and durable threshold events while client screens are closed. Retain documented recovery procedures and the later-phase release gates.

Local completion does not confirm these production steps. No deployment, production write or later-phase implementation is authorized by this plan update.

### Release rules

- Deploy compatible Android and web consumers before removing legacy contracts.
- Keep authorization enforced throughout the transition.
- Use forward fixes for security/data migrations; rollback must not restore score exposure or verification bypasses.
- Do not retry financial operations without idempotency protection.
- Preserve historical requests and their original timing/payment behavior.
- Keep unclear charter fees in assessment mode until administrator confirmation.
- Obtain boundary confirmation before describing the trace as officially certified.
- Preserve other barangays’ configuration and current uncommitted work.
- Do not mark incomplete checks as passed.
- Monitor authentication failures, rejected submissions, upload failures, assessment/payment errors, and SLA evaluator failures without logging ID images, secrets, or tokens.

The unified plan is complete when every requested outcome is implemented, its important failure paths are verified, historical data is reconciled, and transitional code has been removed safely.
