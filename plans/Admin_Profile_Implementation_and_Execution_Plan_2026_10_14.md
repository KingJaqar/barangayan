# Admin Profile — Implementation and Execution Plan

**Prepared:** 14 October 2026 (Asia/Manila)  
**Scope:** Admin web application; Admin Profile and necessary account-association support only.  
**Status:** Implementation and isolated verification are in progress; hosted/manual acceptance and release remain pending. Phase progress and evidence below supersede the original planning inventory.  
**Authorization boundary:** Saving this document does not authorize application changes, database/account mutations, Auth configuration changes, or deployment.

This document merges the evidence-based implementation plan and execution checklist into one source of truth. Each execution phase includes its objective, tasks, deliverables, dependencies, risks, and acceptance gate. Checkboxes record future work; they do not claim that implementation or testing has occurred.

## 1. Intended outcome and boundaries

Add an Admin Profile screen at `/profile`, reached through a **Profile** navigation item directly above the existing Theme control. The screen presents:

- The authenticated administrator's personal profile and read-only staff information.
- Separate admin account-security controls for Supabase Auth email/password changes.
- The associated resident account's profile information on the same page, with an explicit account label and ownership boundary.
- Clear loading, empty, error, viewing, editing, saving, conflict, confirmation, and partial-failure behavior.

**Principal dependency:** The inspected system does not currently establish which resident account belongs to an administrator. A verified relationship must be resolved and recorded before resident information is presented as that administrator's associated account.

Recommended first-release boundaries:

- Keep admin and resident Auth identities and profile records separate.
- Permit narrowly scoped admin personal-profile editing and admin credential changes.
- Keep the resident section read-only unless resident editing is expressly approved.
- Introduce verified association and unlinking only after the relationship policy and ownership proof are approved.
- Keep contact information and credentials independent by default, without automatic cross-account synchronization.
- Exclude self-deletion, self-demotion, self-archive, staff-status changes, and account creation from this screen.

These are recommendations requiring confirmation where identified in Section 9, not already-approved product decisions.

Do not add unrelated Instagram features, general refactors, duplicated resident/staff management screens, or resident mobile UI changes. The permanently cancelled Phase 8 of `Major_Web_AndroidMobile_Improvement_Plan.md` remains cancelled. Its historical interaction standards do not authorize Android work. This document's six phases are a separate plan.

## 2. Evidence baseline

### 2.1 Review method and limitations

The source review inspected current repository files, including existing uncommitted changes, and used read-only Supabase queries against the Barangayan project identified by `supabase/.temp/project-ref`: `pwjbucnyqexiepoinoke`. The live review covered columns, constraints, profile foreign-key relationships, RLS policies, grants, triggers, relevant function definitions, account/provider aggregates, storage settings, and applied migrations.

No application code, migrations, database records, account data, or authentication settings were changed during the review. No implementation tests were executed. Saving this merged Markdown document is a documentation-only action.

Findings are observations as of 14 October 2026 and must be refreshed before implementation. Catalog inspection establishes the inspected database model; it does not exclude an undocumented external ownership process.

### 2.2 Verified findings

| Area | Verified finding | Implementation consequence |
| --- | --- | --- |
| Sidebar | Overview contains Dashboard followed by Theme. Navigation uses Next.js links, pathname active styling, `aria-current`, collapsed accessible labels, and `LinkPendingIndicator`. | Insert Profile between Dashboard and Theme using those conventions. |
| Admin access | The admin layout uses `auth.getUser()`, loads the matching profile, and requires `role = 'admin'`. Its query does not currently check `deleted_at`. | Feature reads and mutations independently require an active admin. Rendering the route is insufficient authorization. |
| Profile identity | `profiles.id` is the primary key and references `auth.users.id` with `ON DELETE CASCADE`. `role` accepts either `admin` or `resident`. | One Auth user has at most one profile row and cannot have separate admin/resident profile rows with the same ID. |
| Account association | No explicit admin-to-resident relationship was found in inspected profile columns, relevant tables/foreign keys, provisioning code, or account metadata keys. | Never associate accounts through name, email, phone, address, or barangay matching. |
| Provisioning | Staff invitation creates an Auth user, admin profile, and `barangay_officials` row. Resident invitation separately creates a resident account. | Neither operation proves that an admin and resident account belong to the same person. |
| Legacy admin data | All five current admin profiles lack populated structured name/address parts. | Preserve current full names and addresses; never automatically split or replace them with blank components. |
| Email differences | Two current admin profiles have contact emails different from Auth sign-in emails. No inspected Auth-user update trigger synchronizes them. | Distinguish contact email and sign-in email; confirm intended ownership before adding synchronization. |
| Staff roster | `barangay_officials.profile_id` is unique and references the profile. Roster fields include job role, active status, hiring date, and notes. | Staff administration remains separate from personal-profile editing. |
| RLS | Profile RLS is enabled. The self-update policy uses `auth.uid() = id` without a resident-role restriction despite its name. Other policies allow same-barangay admin operations. | Evaluate effective policies, grants, and triggers together; policy names do not define ownership. |
| Protected fields | Triggers protect identity, role, tenant, controlled verification fields, and profile/location foundations. | Do not copy broad record-edit payloads or attempt to bypass dedicated operations. |
| Staff self-edit | Staff UI and the record mutation workflow reject editing the administrator's own staff record. | Add a narrow self-profile operation; preserve staff-management safeguards. |
| Derived display fields | Triggers compose names/addresses from structured parts. Configured locality rules fix city/province and reject independent free-text address updates. All current admins belong to a configured locality. | Address editing requires approved structured entry; the staff free-text editor cannot be copied safely. |
| Verification | Contact-email edits reset custom profile verification. The resident verification endpoint requires a resident profile and contact/Auth email equality. | Do not reuse it for admins or present the custom badge as Auth confirmation. |
| Storage | `profile-photos` is public, limited to 2 MiB, and permits JPEG/PNG/WebP MIME types. Ownership policies use the caller's UID folder. `id-documents` is private. | Use the admin's owned namespace for avatar changes; use authorized short-lived access for ID evidence. |
| Deletion | Existing self-deletion anonymizes a profile and bans the Auth user; it is not Auth hard deletion. Its inspected SQL function has no admin-role exclusion. Profile references include restrictive and cascading relationships. | Do not expose the existing workflow as an Admin Profile delete action. |
| Migration history | Repository files and the connected database's migration history extend through `0118_resident_front_id_submission.sql`. | `0119` was the next available repository prefix at review time; recheck before creating any migration. |

### 2.3 Repository evidence

- [Sidebar navigation](../apps/admin-web/src/components/admin/sidebar-nav.tsx), [admin layout](../apps/admin-web/src/app/(admin)/layout.tsx), and [admin shell](../apps/admin-web/src/components/admin/admin-shell.tsx).
- [Staff invitation](../apps/admin-web/src/app/api/admin/staff/invite/route.ts), [resident invitation](../apps/admin-web/src/app/api/admin/residents/route.ts), and [staff editing](../apps/admin-web/src/app/(admin)/staff/staff-table.tsx).
- [Resident web profile form](../apps/admin-web/src/app/resident/profile/profile-form.tsx) and [profile field foundations](../supabase/migrations/0081_resident_profile_field_split.sql).
- [Record mutation conventions](../apps/admin-web/src/actions/admin-record-actions.ts), [record lifecycle operations](../supabase/migrations/0115_admin_record_lifecycle.sql), and [resident conflict protection](../supabase/migrations/0108_resident_profile_completion_conflict_guard.sql).
- [Email verification invalidation](../supabase/migrations/0109_invalidate_changed_profile_email_verification.sql), [resident verification endpoint](../supabase/functions/verify-resident-email/index.ts), and [verification handler](../supabase/functions/verify-resident-email/handler.ts).
- [Account-deletion migration](../supabase/migrations/0074_account_deletion.sql), [deletion function](../supabase/functions/delete-my-account/index.ts), and [avatar storage foundation](../supabase/migrations/0040_profile_avatar.sql).
- [Shared Auth schemas](../packages/shared/src/schemas/auth.ts), [staff schemas](../packages/shared/src/schemas/staff.ts), [password recovery](../apps/admin-web/src/app/reset-password/page.tsx), and [Supabase configuration](../supabase/config.toml).
- [Server Supabase client](../apps/admin-web/src/lib/supabase/server.ts), [browser client](../apps/admin-web/src/lib/supabase/client.ts), [audit helper](../apps/admin-web/src/actions/admin-audit-actions.ts), and [dialog behavior](../apps/admin-web/src/components/admin/table-detail-dialog.tsx).
- [Repository instructions](../AGENTS.md) and [admin-web instructions](../apps/admin-web/AGENTS.md).

Live observations above derive from the read-only review, not solely from migration text. No independently saved live-schema snapshot was created during that review.

### 2.4 Authentication: local evidence and hosted unknowns

| Setting | Repository configuration |
| --- | --- |
| Email signup confirmation | Disabled |
| Confirmation of email changes | Both old and new addresses |
| Secure password change | Disabled |
| Minimum Auth password length | 6 |
| Password composition requirement | None |
| JWT expiry | 3,600 seconds |
| Refresh-token rotation | Enabled |
| Anonymous sign-in | Disabled |
| Manual provider-identity linking | Enabled |
| Local redirect configuration | Loopback URLs |

These values are **local**, not verified hosted settings. Hosted confirmation rules, secure password change, current-password enforcement, password strength checks, SMTP delivery, email templates, redirect allowlists, MFA, and session restrictions remain unresolved.

Live identities include email and Google providers for both account roles. A provider identity does not prove that a usable password exists.

The shared schemas differ:

- `changePasswordSchema`: current password; new password of at least eight characters with uppercase, number, and special character; matching confirmation; new password different from current.
- `newPasswordSchema`: at least eight characters and matching confirmation.

Use the applicable schema and verified hosted requirements explicitly. Do not silently weaken or globally change authentication rules as part of this feature.

### 2.5 Applicable external documentation

- [Instagram public profile](https://www.instagram.com/instagram/): directly inspected for profile hierarchy. Authenticated editing was unavailable in the public session.
- [Supabase user updates](https://supabase.com/docs/reference/javascript/auth-updateuser), [reauthentication](https://supabase.com/docs/reference/javascript/auth-reauthenticate), [sign-out](https://supabase.com/docs/reference/javascript/auth-signout), and [sessions](https://supabase.com/docs/guides/auth/sessions).
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): provider linking concerns identities of one Auth user, not association of two existing profile records.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data): account deletion, storage ownership, and issued-token consequences.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/): reviewed for repository compliance; no Expo/mobile implementation is proposed.
- Installed Next.js guidance was reviewed for route groups and Server Actions. Refresh relevant installed documentation before coding; do not assume older Next.js behavior.

The current Supabase changelog index could not be fetched successfully during review. Recheck it and relevant current documentation in Phase 1; no current-changelog verification is claimed.

## 3. Navigation and screen design

### 3.1 Sidebar behavior

- Add Profile in the Overview group immediately before `ThemeRow`, preserving Dashboard → Profile → Theme order.
- Use a normal Next.js navigation link to `/profile`, not a separate popup or a duplicate settings destination.
- Apply existing active styling and `aria-current="page"` for `/profile` and approved profile subroutes using the established pathname convention.
- Use an existing Lucide icon, collapsed accessible label/title, and `LinkPendingIndicator`.
- Preserve theme toggle, Theme destination, sidebar collapse, scrolling, logout, and all other navigation behavior.

### 3.2 Information hierarchy

Keep both accounts on one page in this order:

1. **Profile header:** admin avatar or initials, display name, Admin account label, barangay, and Edit profile action.
2. **Admin profile:** approved personal/contact fields and read-only staff summary.
3. **Admin account security:** Auth sign-in email, Auth confirmation state, login providers, Change email, and Change password.
4. **Associated resident account:** separately labelled identity, contact, address, household summary, and verification information.
5. **Additional details:** collapsible identifiers, timestamps, relevant preferences, and verification metadata.
6. **Account association:** approved linking/unlinking controls and relationship state.

Use explicit scope text, such as “Changes in this section affect your admin profile only.” Do not combine two accounts into one editable form. Keep security operations separate from personal-profile Save.

### 3.3 Instagram-inspired patterns

| Observed pattern | Proposed adaptation |
| --- | --- |
| Circular avatar alongside identity heading | Existing admin image or initials beside the administrator's name |
| Identity summary above detailed content | Name, account type, barangay, and action above information sections |
| Strong identity/supporting-text hierarchy | Prominent account labels with quieter contact/status text |
| Grouped content under a profile header | Separate admin information, security, and resident sections |
| Restrained spacing and section boundaries | Existing admin typography, borders, theme variables, and form styling |

Edit/Save/Cancel behavior below is a proposed adaptation, not a claim about Instagram's current authenticated editor. Do not add username, biography, website, followers, posts, stories, messaging, or other unsupported fields/features.

## 4. Field ownership and editability

“Editable” below describes proposed behavior in this screen, not every operation permitted elsewhere. Defaults requiring confirmation are listed in Section 9.

| Fields/source | Owner and proposed presentation |
| --- | --- |
| `full_name` | Per-profile display name. Editable for current legacy admin records. Resident value read-only. If structured admin names already exist, edit their parts and display the composed value; never expose competing name editors. |
| `first_name`, `last_name`, `middle_name`, `suffix` | Per-profile structured identity. Display existing values. Admin structured editing requires approval; do not parse legacy names automatically. Resident read-only by default. |
| `mobile_number` | Per-profile contact number. Admin editable; resident read-only. Not automatically an Auth phone credential. |
| `email` | Per-profile contact email. Admin editable under the approved semantics. Resident read-only. Not authoritative for login. |
| Auth `email`, confirmation, pending email change, identities | Individual Auth account. Admin changes through Auth. Resident Auth information needs verified association and narrow server authorization; do not infer it from contact email. |
| Password | Auth credential only. Never readable/displayed. Change admin password through Auth; never store it in profiles, metadata, or logs. |
| `avatar_url` | Per-profile image. Admin editable through owned storage; resident read-only. |
| `birth_date`, `sex`, `employment_status`, `occupation` | Per-profile personal information. Display available values or Not provided. Recommend admin read-only until self-editability is approved; resident read-only. |
| `home_address` | Existing derived/legacy address summary. Read-only; not a separate free-text editor. |
| `house_no`, `street` | Per-profile structured address. Admin editing conditional on approval, with a resulting-address preview. Do not force conversion for unrelated edits. |
| `city`, `province`, `barangay_id`, locality/barangay records | Read-only locality and tenancy. Locality configuration governs city/province; no tenant transfer here. |
| `role`, `id`, `deleted_at` | Protected identity, access, and lifecycle. Read-only; ID may appear in Additional details. No self-role/lifecycle controls. |
| `created_at`, `updated_at`, `profile_completed_at` | Read-only timestamps. Completion is principally relevant to resident setup. |
| `email_verification_status`, `email_verification_requested_at`, `email_verified_at` | Custom contact verification. Read-only and distinct from Auth confirmation. Show Not applicable where no admin verification workflow exists. |
| `id_type`, `id_photo_urls`, `id_verification_status`, `current_id_submission_id`, `approved_id_submission_id`, `id_repair_required` | Resident verification information. Read-only summary and authorized evidence access. No raw paths or editable outcomes; internal IDs only if useful. |
| `registration_location`, `registration_home_location`, `location_verified`, `verified_location`, `location_verified_at`, `verified_location_address` | Read-only registration/location evidence. Prefer status/address; disclose precise coordinates only when needed and authorized. No location editor or new map. |
| `household_members` and related table rows | Resident household summary, read-only. Confirm canonical read projection and existing synchronization conventions; no duplicate editor. |
| `theme_preference`, `accent_color`, `custom_accent_colors`, `font_preference` | Per-profile appearance. Summarize if relevant; use existing Theme destination for editing. |
| `push_notifications_enabled`, `last_data_export_at` | Read-only additional details when relevant. No notification-management or export feature. |
| `barangay_officials.official_role`, `is_active`, `date_hired` | Admin staff summary, read-only. Job role differs from profile access role. |
| `barangay_officials.notes` and roster lifecycle details | Internal staff information. Do not automatically disclose through personal self-service; confirm visibility. |

### 4.1 Separate and shared information

Recommended default: each account remains its own source of truth.

- Matching values do not constitute shared data.
- Admin Save changes only that admin's approved profile fields.
- Resident changes do not update the admin.
- Credentials, contact fields, avatar, verification, preferences, and household records remain account-specific.
- Auth user metadata is not the authoritative profile store or a trusted authorization source.
- Do not add automatic two-way synchronization.

If copying information is approved, provide an explicit operation showing source, target, and field differences. Exclude credentials, roles, tenancy, verification evidence/outcomes, and lifecycle fields. Approved database-only copies must be atomic and compare both record versions. Linking itself must not copy profile information.

### 4.2 Resident association

Recommended model: one-to-one association between distinct active admin and resident profiles in the same barangay, subject to confirmation.

Ownership proof must:

- Preserve the main admin session.
- Authenticate the resident in an isolated Auth context.
- Verify both identities server-side.
- Bind the operation to the initiating admin and an expiring, single-use challenge.
- Recheck roles, tenancy, active status, uniqueness, and proof immediately before commit.
- Commit only the relationship after successful proof.
- Clear temporary credentials/tokens and retire only the temporary session.

The existing resident verification endpoint illustrates independent non-persistent Auth clients, but is not an account-linking API. The exact provider-compatible proof mechanism must be finalized before implementation.

| Condition | Required behavior |
| --- | --- |
| No association | No resident account linked; offer the approved linking workflow, never a guessed match. |
| No resident account exists | Explain that linking requires an existing account; registration/provisioning remains separate. |
| Missing linked profile | Linked resident profile is unavailable; keep admin use available and require controlled investigation/unlinking. |
| Permission/transient failure | Resident-section error and Retry; do not equate inaccessible with nonexistent. |
| Deleted/wrong-role/wrong-tenant target | Suppress details/actions and show invalid association. |
| Duplicate/conflicting association | Reject atomically using non-enumerating feedback. |
| Incorrect link reported | Stop associated-account actions; allow confirmed unlinking and require fresh proof before relinking. |

## 5. Operation definitions and Auth flows

### 5.1 CRUD and account-operation boundaries

| Operation | Applicability and exact effect |
| --- | --- |
| Read admin | Required; authenticated active admin's own profile and approved staff summary. |
| Update admin | Required; approved personal/contact fields only. |
| Read resident | Required after verified association; authorized target and approved projection. |
| Update resident | Decision required; recommended read-only first release. If enabled, a separate association/tenant/role/activity/field/concurrency-checked operation. |
| Create admin profile | Not routine self-service. Missing profile is provisioning/access recovery; never accept client-selected admin role/tenant. |
| Create resident profile/account | Not necessary here. Existing-identity repair differs from new account creation. An empty section must not create either. |
| Create association | Applicable once approved; relationship only, not identity/profile creation. |
| Unlink | Applicable; removes relationship only and preserves both accounts/data. |
| Delete profile record | Excluded recommendation; may cascade/fail while leaving Auth handling unresolved. |
| Delete Auth account | Excluded recommendation; may cascade profile deletion, encounter storage dependencies, and leave issued tokens valid until expiry. |
| Disable/anonymize | Separate lifecycle operation, not either deletion. Requires separate review/authorization. |

### 5.2 Admin email change

1. Show Auth sign-in email, profile contact email, and pending Auth change separately.
2. Validate the new address and explain that resident credentials are unaffected.
3. Require approved recent admin proof according to verified hosted capabilities.
4. Submit through `supabase.auth.updateUser({ email })` with an approved redirect/OTP flow.
5. Follow hosted confirmation requirements; where secure email change is enabled, guide old and new inbox confirmation.
6. Show Awaiting confirmation until a fresh Auth read confirms completion.
7. Re-read the user and revalidate active admin access after completion.
8. Leave contact email unchanged under the recommended independent model.

Handle occupied addresses, invalid/expired confirmation, rate limits, delivery failure, old-inbox loss, session expiry, and provider restrictions. Do not bypass confirmation through the privileged Admin API. Pending/resend/cancellation controls must use verified SDK/server capabilities rather than invented endpoints.

If contact email is approved as an Auth mirror, synchronize only after confirmed Auth completion, using server-verified email and an idempotent repair operation. On Auth success/profile-sync failure, report partial success and retry synchronization only. Auth and profile writes are not one database transaction.

### 5.3 Admin password change

- Use applicable shared validation plus stricter hosted requirements.
- Provide current/new/confirmation fields, accessible visibility controls, and appropriate autocomplete.
- Verify current-password proof in an isolated client and require the resulting user ID to match the active admin.
- If hosted Auth requires `current_password` or a reauthentication nonce, use the supported installed SDK attribute and verified setting.
- Use `reauthenticate()` and nonce submission when required; do not assume the local disabled setting describes production.
- For an account without a password, present Set password after approved provider/account proof, not a nonexistent current-password requirement.
- Clear password values on success and show the approved session consequence.
- Recommend fresh admin login after change; explicitly decide other-admin-session revocation. Never revoke resident sessions as a side effect.

Test actual session behavior. Supabase sign-out scope must be explicit: default is global; local affects the current session. Issued JWTs have an independent expiry window.

Resident credential controls remain excluded from the first-release recommendation. If approved, authenticate the resident separately and target that resident's Auth identity. Calling `updateUser` on the main admin client changes the admin.

### 5.4 Destructive safeguards and partial failures

Do not expose self-delete, demotion, archive, or staff-status controls. Unlink confirmation names both accounts and states that neither is deleted. Replacement requires fresh proof.

Future deletion approval requires a separate gate for last-admin protection, handover, profile dependencies, storage, retained history, session revocation, and recoverable partial failures. Existing anonymization/ban code is not proof of complete or immediate access removal.

| Partial failure | Recovery requirement |
| --- | --- |
| Auth change succeeds; contact mirror fails | Preserve confirmed Auth state; retry approved mirror repair only. |
| Avatar upload succeeds; profile save fails | Keep old reference; remove only the newly uploaded object. |
| Avatar reference commits; old-object cleanup fails | Keep the valid new reference; report/log bounded cleanup recovery without repeating Save. |
| Link commit response times out | Re-read relationship status before resubmission; prevent duplicate links server-side. |
| Profile save succeeds; optional audit fails | Do not report persistence failure; log operational failure separately. Mandatory security auditing requires an approved contract. |
| Password change succeeds; sign-out fails | Explain password success and incomplete session cleanup; do not repeat password change. |

## 6. UI state and engineering contract

### 6.1 Viewing, editing, and unsaved changes

- Default to viewing mode; Edit initializes a draft from saved values.
- Save is available only for valid changes; security/link operations stay separate.
- Cancel restores saved values and exits editing.
- Dirty cancellation/navigation offers Keep editing or Discard changes.
- Cover sidebar, logout, internal links, and supported browser navigation; use unload protection for reload/close. Verify installed Next.js capabilities before promising universal interception.
- Success refreshes relevant profile/header data once and returns to viewing.
- Failure preserves non-secret drafts, retains editing, focuses the error summary, and supports deliberate retry.
- Conflict offers reload/review; never silently overwrite another save.

### 6.2 Required states

| State | Behavior |
| --- | --- |
| Loading | Existing loading/skeleton patterns, stable geometry, accessible announcement. |
| Empty field | Not provided; no fabricated default. |
| Missing association | Explanation and approved link action. |
| Admin load failure | Page-level retry; no misleading empty profile. |
| Resident load failure | Section retry; admin remains usable. |
| Viewing | Labelled values and clearly scoped actions. |
| Editing | Controlled draft, field errors, Save/Cancel. |
| Saving | Disable duplicates/conflicting actions; announce progress. |
| Confirmation | Named target, consequence, safe cancellation, focus containment/restoration. |
| Partial failure | Identify completed/incomplete steps and retry only unfinished work. |
| Expired/revoked access | Stop writes, clear sensitive state, offer one controlled sign-in transition. |

### 6.3 Responsive and accessible behavior

Use the existing shell and breakpoints. Columns may be used on wide screens; stack sections on narrow screens while keeping both account labels visible. Avoid horizontal overflow within profile content.

Require semantic headings, visible field labels, `aria-describedby`, `aria-invalid`, keyboard focus, text status labels, contrast, reduced-motion support, and usable touch targets. Confirmation dialogs contain and restore focus. Verify light/dark themes, collapsed sidebar, 200% zoom, keyboard-only use, and screen-reader announcements.

### 6.4 Maintainability and reliability

- Prefer a server-loaded page and small client form/security components.
- Reuse suitable headers, form styles, dropdowns, loading content, toasts, and dialogs.
- Follow caller-scoped Supabase client conventions; privileged keys never reach the browser.
- Add focused schemas/operations rather than a general profile framework or broad table-editor refactor.
- Authorize within every operation; render-time guards are insufficient.
- Reject unknown fields and client-controlled authorization/lifecycle outcomes.
- Use atomic version/snapshot comparison and exactly-one-row success verification.
- Return safe typed outcomes for validation, permissions, conflict, rate limit, unavailable service, and unexpected failure.
- Do not disclose raw internal errors, SQL, secrets, passwords, tokens, or storage paths.
- Bound reads/retries; never automatically retry mutations.
- Pair local submit prevention with server uniqueness/idempotency where applicable.
- Reconcile ambiguous timeout outcomes before resubmitting.
- Never update profiles from render/load/Auth-event callbacks.
- Avoid reciprocal triggers/subscriptions that form synchronization cycles.
- Clean up listeners, timers, temporary sessions, and abandoned requests.
- Audit appropriate changes without credentials or unnecessary personal-data distribution.

Avatar replacement order: upload new owned object → conditionally commit profile reference → retire old object. Do not overwrite/delete the previous image before reference persistence.

## 7. Execution tracker and sequencing

| Phase | Status | Completion evidence |
| --- | --- | --- |
| 1. Verify prerequisites and decisions | Complete (inventory and decisions) | 2026-10-15 owner follow-up and [verification](evidence/admin-profile/verification.md); known release prerequisites remain in Phases 4/6 |
| 2. Finalize design and contracts | Complete | 2026-10-15 execution note and [verification](evidence/admin-profile/verification.md) |
| 3. Frontend navigation and states | Complete | Automated flow evidence and owner-confirmed attended accessibility checks, 2026-10-15; [verification](evidence/admin-profile/verification.md) |
| 4. Authorized operations and Auth | Partially complete | 2026-10-15 execution note and [verification](evidence/admin-profile/verification.md) |
| 5. Migrations and DB verification | Complete (prepared/tested) | 2026-10-15 execution note and [verification](evidence/admin-profile/verification.md) |
| 6. End-to-end and release verification | Partially complete; release blocked | 2026-10-15 execution note and [verification](evidence/admin-profile/verification.md) |

Sequence: complete Phase 1 decisions, then Phase 2 design/contracts. Phase 3 can develop presentation against those contracts. Design Phase 5 support early and verify it in the test environment before dependent Phase 4/3 integration. Complete integration before Phase 6.

This dependency order does not authorize production migration application or deployment. Do not mark a phase complete until its gate is supported by recorded evidence.

## 8. Execution phases

### Phase 1 — Verify prerequisites and resolve account decisions

**Objective:** Establish authoritative account ownership, field sources, and Auth behavior before implementation.

**Tasks**

- [x] Refresh live schema, constraints, relationships, grants, policies, triggers, relevant functions, storage, and applied migration history.
- [x] Verify hosted Auth settings, SMTP/templates, production callbacks, confirmation rules, password/provider requirements, MFA, and sessions.
- [x] Confirm whether an authoritative external association exists.
- [x] Complete the field source/owner/visibility/edit matrix.
- [x] Resolve Section 9 decisions affecting ownership, authorization, email, names/addresses, and credentials.
- [x] Review current Supabase changelog/docs and applicable installed Next.js guides; read required Expo versioned documentation before writing code.
- [x] Record repository baseline, unrelated changes, and pre-existing verification failures.

**Deliverables:** Verified inventory, approved field/operation contracts, decision record, baseline.

**Dependencies:** Read access to hosted settings and decision confirmation.

**Risks:** Hosted/local drift, undocumented links, legacy data loss, misleading policy names.

**Acceptance gate**

- [x] Each proposed field/operation has an evidenced source and ownership/authorization rule.
- [x] Hosted credential behavior is recorded, not inferred.
- [x] Relationship proof/cardinality/tenancy are approved; no heuristic link exists.
- [x] Security-dependent unknowns are resolved before dependent coding.

**Status: Complete for prerequisite inventory and decisions — known release blockers remain in Phases 4/6.** 2026-10-15 progress: Owner approved D1–D8 and D10–D13, including revocation of other admin sessions, and selected only the six phases in this file. The field/operation matrix and original baseline are in [verification](evidence/admin-profile/verification.md). Root/admin AGENTS and CLAUDE instructions, required Expo v57 and installed framework/API guides were read. The pre-edit baseline passed typecheck/lint and 116 admin tests. Direct signed-in dashboard inspection verified GoTrue v2.197.0, email/Google providers, confirmation/password/MFA/session policies, templates, Brevo SMTP configuration and quotas. A catalog-only SELECT refreshed 109 columns, 42 RLS policies, grants, constraints, triggers and function metadata; all 19 feature function definitions match the tested migration. The live database already contains 0119, later 0120–0124 and an external timestamp migration 20261015003812; none was applied or edited by this task. The earlier un-applied-migration assumption and AGENTS' historical pushed-prefix inventory are stale relative to that evidence; preserve all applied versions. Owner follow-up explicitly confirms no external account-link registry and supplies localhost:3000 plus the exact admin deployment origin https://barangayan-admin-mljmo9xhp-barangayan.vercel.app. Existing-account local sign-in succeeded; /profile displays the intended disabled verification gate. Local environment evidence confirms this app uses the inspected PRODUCTION Supabase project, not isolated staging. The supplied deployment is protected by Vercel's You Need Access screen, so its application version/backend remains unverified. These are now concrete release prerequisites, not guessed account/security contracts: obtain deployment access and approved disposable hosted test accounts/inboxes, separately authorize the prepared callback changes, and verify delivery before enabling gates. Callback inventory was reread and still has five URLs with no admin proof/confirmation entry. The earlier inventory alone did not satisfy this gate; implementation remained disabled pending the now-recorded decisions/findings. No supplied password was written to a file. No project configuration, account/profile data, release, migration application, commit or push was changed; normal authorized sign-in may create its existing session/audit records. Original planning context is retained; current evidence is [hosted settings](evidence/admin-profile/hosted-settings.json), [schema inventory](evidence/admin-profile/hosted-schema-inventory.json) and the dated owner follow-up in verification.

### Phase 2 — Finalize screen design and operation contracts

**Objective:** Make account boundaries, editability, and consequences reviewable.

**Tasks**

- [x] Finalize Section 3 layout and all Section 6 states.
- [x] Adapt observed Instagram hierarchy to existing admin styling.
- [x] Finalize field allowlists and read-only resident policy or approved alternative.
- [x] Define navigation, collapsed/active/pending behavior.
- [x] Specify Edit/Save/Cancel, dirty navigation, conflicts, confirmation, and retry recovery.
- [x] Define safe read/update/Auth/link/unlink request-response contracts.
- [x] Finalize provider-compatible association proof and temporary-session lifecycle.
- [x] Specify legacy name/address and avatar partial-failure behavior.
- [x] Review responsive/accessibility acceptance requirements.

**Deliverables:** Approved screen/state specification, allowlists, operation contracts.

**Dependencies:** Phase 1 decisions.

**Risks:** Contact/login confusion, mixed account forms, mistaken Save scope, incomplete failure UX.

**Acceptance gate**

- [x] Both accounts are identifiable at desktop/narrow widths.
- [x] Every field/action identifies editability, target, and consequence.
- [x] Failure/conflict states preserve recoverable work.
- [x] Dialog focus/cancellation and dirty navigation are specified.
- [x] No unrelated fields/features are introduced.

**Status: Complete.** 2026-10-15 progress: Approved identity separation, field allowlists, native profile/header hierarchy, roster visibility, resident read-only projection, dirty navigation/cancellation, conflict recovery, credential/link/unlink contracts and avatar failure order are implemented and evidenced. Both account labels were visually reviewed at narrow width; desktop/narrow states, draft recovery and dialog focus/cancellation passed real local flows. Ownership proof uses password or existing-only email sign-in with MFA rather than direct Google OAuth, whose SDK/server flow can create unknown accounts. No guessed OAuth option, automatic synchronization, lifecycle editor or unrelated feature was introduced. Detailed contracts are in [verification](evidence/admin-profile/verification.md).

### Phase 3 — Build navigation and frontend behavior

**Objective:** Deliver the scoped route and predictable editing experience.

**Proposed locations:** `apps/admin-web/src/app/(admin)/profile/` and focused feature-local components; these are intended additions, not existing implementation.

**Tasks**

- [x] Add the protected Admin Profile route and appropriate loading/error presentation.
- [x] Insert Profile directly above Theme using existing link conventions.
- [x] Implement active/collapsed/pending behavior without changing theme/logout/navigation semantics.
- [x] Load authenticated admin and approved roster information.
- [x] Resolve resident only through the approved verified association.
- [x] Isolate resident errors from valid admin content.
- [x] Implement drafts, validation, dirty-state handling, Save/Cancel, conflicts, and deliberate retry.
- [x] Prevent repeated/conflicting submissions.
- [x] Integrate separate security/association controls once backend contracts are available.
- [x] Refresh relevant profile/header once after persistence.
- [x] Implement responsive, theme, keyboard, and announcement behavior.

**Deliverables:** Page, sidebar entry, forms, required states.

**Dependencies:** Phase 2; integration requires Phase 4 and Phase 5 support.

**Risks:** Stale drafts, duplicate saves, redirects, session replacement, stale shell identity.

**Acceptance gate**

- [x] Required sidebar order and active state work expanded/collapsed.
- [x] Direct entry, reload, back/forward, and approved subroutes work.
- [x] Failed saves preserve non-secret drafts; Cancel restores saved values.
- [x] Unavailable resident data does not block valid admin use.
- [x] Theme/logout/collapse and existing navigation remain functional.
- [x] Approved responsive/accessibility criteria pass.

**Status: Complete.** 2026-10-15 final progress: Protected route/loading/error states, Dashboard → Profile → Theme ordering, active/collapsed navigation, live admin/roster reads, verified read-only resident projection, drafts/validation/Save/Cancel, dirty navigation/history/logout, atomic conflicts, independent resident retry, bounded conflicting-operation guards and profile/header refresh are implemented. Actual local browser/API/DB evidence verifies those flows; Chrome 39 and Firefox 37 suites passed with zero captured console/page errors or warnings. Responsive 390/768/1440 widths, light/dark themes, reduced motion and keyboard focus containment/restoration passed automated/visual checks. Reusable local staging additionally passed 23 integration groups and dedicated Auth mail delivery; typecheck, lint, 116 admin tests and supported webpack builds pass in the recorded runs. The owner replied “confirmed” to the explicit two-part attended request for actual browser-menu 200% zoom usability and screen-reader headings/labels/loading/error/success/dialog announcements with Tab/Escape focus behavior. Both are recorded as owner-reported passes, not agent-observed speech/zoom evidence. Screen-reader name/version was not supplied and is not inferred. Every Phase 3 task/acceptance item is now met. No code or check rerun was needed for this documentation-only confirmation. Historical follow-ups below retain the investigation; this final owner acceptance supersedes their pending Phase 3 wording. Hosted credential/release gates in Phases 4/6 remain outstanding. Details: [verification](evidence/admin-profile/verification.md).
**2026-10-15 Phase 3 accessibility/staging follow-up:** Owner authorized isolated staging in KingJaqar's Org. Read-only organization metadata reports Free tier; current Supabase docs require Pro for branching. The connector's get_cost call returns UNAVAILABLE (not returned by tools/list), so no exact quote/cost confirmation can be obtained and no paid resource/upgrade was created. Phase 3's independent pre-edit baseline passed typecheck, full lint and 116 admin tests. The existing real local runner gained an opt-in, fifteen-minute bounded desktop review window using synthetic accounts with in-memory session transfer; no production credentials are exported. Official NVDA 2026.2 was downloaded with a valid NV Access signature and created as a workspace-only portable test tool, with no app dependency/system install. The isolated linked-admin/resident Chrome review reached ready state. Desktop capture then stopped with the computer-use safeguard unable to identify the current browser URL confidently. No bypass was attempted; the review was released and the task-owned screen reader stopped. Neither real 200% zoom nor actual screen-reader output was verified, so Phase 3 remains partially complete. Full recorded outcome and cleanup are in the verification evidence.

**2026-10-15 no-cloud-cost local staging:** Owner selected local staging. Added a reusable local-staging launcher around the existing isolated browser/database runner, with synthetic linked accounts, its own Mailpit service, loopback-only app/API/inbox ports, in-memory browser sign-in and a two-hour review limit. Closing the review browser or the documented stop command shuts down only task-created services and preserves the isolated database; this mode skips subsequent credential/rollback test mutations. Start/status/stop and exact attended Phase 3 steps are in apps/admin-web/tests/profile/LOCAL_STAGING.md. Fresh pre-edit typecheck/lint and 116 admin tests passed. Initial staging reached ready after 22 existing integration groups with zero captured console/page warnings/errors; stop verification confirmed zero task containers and zero prior app/API/inbox listeners. A fresh restart and real mail delivery to its dedicated inbox are recorded in verification after completion. No cloud resource, paid plan, production setting/account/data change or application dependency was introduced. Phase 3's actual zoom/screen-reader acceptance remains pending owner verification; a local fixture does not waive it.

**Local staging verification outcome — 2026-10-15:** Fresh restart passed 23 integration groups with zero captured console/page warnings/errors, including real synthetic Auth email delivery into its dedicated Mailpit inbox. The supported production build/typecheck and focused runner lint/syntax pass. Independent port/inbox checks confirm loopback-only service mappings and one delivered local message. The signed-in staging Chrome window is deliberately left available at http://127.0.0.1:65053/profile, with inbox http://127.0.0.1:65056 and expiry approximately 1:57 PM Asia/Manila. The owner was asked to report actual 200% browser zoom and screen-reader announcement outcomes; Phase 3 remains partially complete pending those two attended checks. Local staging creation is complete, with no cloud resource or production change.

### Phase 4 — Implement authorized profile and account operations

**Objective:** Enforce ownership, protect admin access, and recover safely.

**Tasks**

- [x] Add narrow active-admin self-profile reads/updates.
- [x] Derive actor from verified session; reject client-selected identity/tenant/role/outcomes.
- [x] Validate allowlisted input server-side and enforce atomic concurrency.
- [x] Require exactly one affected record before success.
- [x] Add approved relationship create/read/unlink operations with both-account proof.
- [x] Recheck role, active status, tenant, proof, and uniqueness at commit.
- [x] Keep resident Auth isolated; clean up temporary sessions/tokens.
- [x] Implement Auth email change, pending/confirmed feedback, and verified callbacks/OTP.
- [x] Implement password changes, passwordless proof, and approved session policy.
- [x] Keep resident updates disabled unless explicitly approved and separately authorized.
- [x] Implement only approved explicit synchronization and partial-failure repair.
- [x] Implement avatar ownership/reference/cleanup safeguards.
- [x] Add redacted audit events and safe typed failure outcomes.

**Deliverables:** Authorized operations, credential flows, conflict handling, recovery.

**Dependencies:** Phases 1–2; Phase 5 support before runtime integration.

**Risks:** Forged targets, replay, permission bypass, Auth/DB partial failure, key leakage, token revocation assumptions.

**Acceptance gate**

- [x] Anonymous/resident/inactive-admin/other-account/cross-tenant calls fail without writes.
- [x] Protected-field injection and stale writes fail safely.
- [x] Linking proof cannot be replayed or rebound to another actor.
- [x] Credential changes affect only the intended Auth user.
- [x] Contact changes do not silently change login; no implicit synchronization occurs.
- [x] Ambiguous outcomes are reconciled before retry.
- [x] Failures remain actionable without internal errors/unhandled exceptions.

**Status: Complete — implementation and acceptance verified in approved isolated local staging; hosted rollout remains gated in Phase 6.** 2026-10-15 progress: All Phase 4 tasks and seven acceptance criteria are met. Real caller-role, browser, Auth, REST, Storage and database checks verify active-admin ownership, strict allowlists, exactly-one conditional saves, role/tenant/activity/session/MFA rechecks, single-use both-account association, versioned unlink, redacted audits and safe avatar references/cleanup. The expanded Chrome suite passed 48 integration groups with zero captured console warnings/errors and page errors. Password tests reject mismatched/reused/incorrect-current passwords without credential writes; real changes reject the old password, accept the new one, require fresh login and revoke other admin sessions while preserving resident access. Passwordless first-password, email-plus-authenticator proof, ambiguous commits and failed session cleanup pass. Actual local mail delivery and PKCE callbacks confirm only the intended admin Auth user; contact and resident email remain unchanged. A real isolated SMTP outage pauses retries until status reconciliation; real expired confirmation is rejected with actionable callback feedback and no address change. Concurrent writes, unavailable targets, lost responses and mandatory/optional audit failures remain covered. The code retains the stricter eight-character minimum plus the inspected hosted character classes. No new production code, dependency or migration was needed in this completion pass. Non-obvious status correction: Phase 4 concerns implementation/ownership correctness, now directly proven with real services; the missing hosted callback entries, actual hosted SMTP delivery and protected older deployment belong to Phase 6 release readiness and are not claimed passed. Feature gates remain disabled by default. No hosted writes, deployment, resident credential change, synchronization or account deletion occurred. Evidence: [verification](evidence/admin-profile/verification.md), [Chrome results](evidence/admin-profile/phase46-chrome-results.json).

### Phase 5 — Prepare and verify necessary migrations

**Objective:** Add only justified database support.

**Assessment:** Existing display fields and Auth updates do not inherently require new profile columns. Verified association likely requires a new relationship table unless Phase 1 finds an authoritative mechanism. Atomic self-profile editing may justify a focused function. No deletion migration is proposed. Automatic Auth/contact mirroring is not the default.

**Tasks**

- [x] Record the requirement for every proposed schema/function change.
- [x] Define association references, metadata, uniqueness, role/tenant/activity checks, and deletion behavior.
- [x] Ensure unlink/account-reference removal cannot delete the other account.
- [x] Permit owner-scoped reads; prevent arbitrary direct link insertion/reassignment.
- [x] Use narrow grants/RLS and invoker functions where sufficient.
- [x] Review necessary privileged functions for fixed search path, explicit caller checks, and restricted execution.
- [x] Recheck highest repository prefix immediately before file creation.
- [x] Use sequential four-digit naming; `0119_descriptive_name.sql` is provisional until rechecked.
- [x] Preserve all existing order/numbers; never reuse occupied `0095`–`0118` prefixes or timestamp naming.
- [x] Rehearse fresh/existing-database application and caller-role permission tests.
- [x] Review schema/security and define safe deployment/rollback.

**Deliverables:** Justified migration files and verification/rollout evidence, or an evidenced no-migration conclusion.

**Dependencies:** Phase 2 approved relationship/operation design.

**Risks:** Policy overlap, duplicate links, heuristic backfill, ordering conflicts, resident regressions.

**Acceptance gate**

- [x] Every change supports an approved feature requirement.
- [x] No heuristic link backfill occurs.
- [x] Invalid/duplicate/self/forbidden-tenant associations are rejected.
- [x] Fresh and representative existing DB rehearsals pass.
- [x] Real caller-role tests pass; privileged SQL alone is insufficient.
- [x] No new privileged operation is inadvertently exposed.
- [x] Rollback disables feature access without destroying account data.

**Status: Complete for preparation and isolated verification.** 2026-10-15 progress: Added justified, unpushed 0119_admin_profile_and_verified_association.sql after confirming 0118 was the highest prefix at creation. The migration adds association/challenge storage, narrow actor/session/MFA checks, conditional own-profile writes, single-use relationship functions, atomic versioned unlink and referenced-avatar deletion protection; no profile columns or heuristic backfill. Grants/restricted definer paths and real anonymous/resident/admin roles passed. A fresh isolated DB restored from representative 0117 schema applied 0118/0119 successfully; earlier representative local rehearsal was transaction-only and rolled back. Synthetic SQL tests and existing resident conflict/email/setup regressions passed. Resumed 2026-10-15 caller-role SQL also passed challenge expiry/rate limits, seven post-proof target retirement boundaries, and mandatory link/unlink audit rollback. Operational rollback SQL and disabled frontend access were exercised while preserving account records. This is not a claimed replay of every historical migration. Later concurrent pending 0120–0124 remain untouched. Remote migration application is not performed or authorized. Evidence and rollout/rollback steps: [verification](evidence/admin-profile/verification.md).

### Phase 6 — Verify the complete feature and release readiness

**Objective:** Establish evidence for release, not an advance bug-free guarantee.

**Tasks**

- [x] Use disposable accounts and an isolated mutation/email test environment.
- [x] Exercise real Auth/settings/templates and operations, not mocks alone.
- [x] Complete the Section 10 matrix and record outcomes.
- [x] Run relevant tests, lint, typecheck, and production build against the final change.
- [x] Verify responsive/accessibility/theme behavior.
- [x] Compare changes with baseline; separate pre-existing failures.
- [x] Record limitations, recovery instructions, deployment order, and rollback.

**Deliverables:** Final verification record and release-readiness decision.

**Dependencies:** Completed integration and environment matching verified hosted Auth behavior.

**Risks:** Mock-only confidence, settings drift, hidden account effects, pre-existing failure attribution.

**Acceptance gate**

- [x] Agreed feature tests and relevant existing checks pass.
- [x] Real email/password flows pass with verified settings/delivery.
- [x] No unresolved isolation, authorization, or admin-access defect remains.
- [x] No unhandled exceptions, duplicate writes, redirect loops, recursive updates, or unbounded retries occur.
- [x] Regression checks pass for relevant existing admin/resident functionality.
- [x] Final diff stays inside feature/necessary association support.
- [x] No resident Android UI/cancelled usability work is introduced.
- [x] Migration and recovery procedures are verified.
- [x] Remaining limitations are documented and accepted before release.

**Status: Complete for the verified scope — 9/9 acceptance criteria met; subsequent owner-authorized local and hosted activation verified.** On 2026-10-15 the owner explicitly requested “enable it now”, superseding the earlier rollout hold. Local .env.local and persistent Vercel Production configuration now enable Profile and its previously verified security/ownership controls, with exact local/canonical callback origins. Production deployment dpl_HQq2nR7nzYj1Hfopn6zjf5UZ95x4 is Ready at https://barangayan-admin-web.vercel.app/profile; localhost:3000/profile also shows real profile, staff, security and resident-association sections. Non-mutating Edit/Cancel checks pass in both. Activation exposed a Profile timestamp hydration mismatch between server/browser time zones; the scoped correction reuses the existing formatter with explicit en-PH locale and Asia/Manila time zone for created/updated/linked timestamps. The real-service runner now forces UTC server and Asia/Manila browser; its new run passes 47 integration groups, all existing SQL regression suites, zero captured console/page errors, and a successful production webpack build. Final typecheck, full lint and all 116 admin unit tests pass. The corrected hosted webpack build is Ready; fresh local/hosted browser consoles and final hosted runtime warning/error queries are empty. Five task containers are stopped and databases preserved. Deployment hashes match all 350 source inputs; only the Profile workspace production file differs from the prior reviewed snapshot. No dependency, existing account data, remote migration, commit or push changed. Existing 53 dependency advisories and the normal-browser hosted popup check remain explicitly unresolved follow-ups; enabling does not mark them passed. Full record: [activation](evidence/admin-profile/activation.json) and [verification](evidence/admin-profile/verification.md).

**2026-10-15 subsequent owner-authorized activation:** The latest “enable it now” instruction overrides the prior keep-disabled decision. Changed only the three local/hosted Profile settings, the scoped Profile timestamp rendering and its cross-time-zone regression setup. Initial typecheck/lint pass; production activation revealed React hydration error 418 caused by environment-dependent timestamps. Reused formatAdminTimestamp rather than suppressing hydration errors; current UTC-server/Asia-Manila-browser integration passes 47 groups with no baseline failures, console/page errors or server exceptions. The earlier commentary count of 49 was incorrect and corrected against the actual 47-entry report. All 116 admin unit tests, final typecheck/lint and local/hosted webpack builds pass. Both localhost and canonical hosted contents/active controls/Edit/Cancel are directly verified; no credential/profile save was performed against existing hosted accounts. The initial extra local-server launch returned EACCES; privileged read-only inventory found the existing user Next server on port 3000, whose automatic configuration reload was then verified. That server was preserved. A corrected allowlisted deployment is Ready and contains only one production-file change from the prior snapshot. Final browser/server warnings/errors are zero; initial hydration evidence is retained, not silently discarded. All five isolated task containers stop, preserving their DBs. No Git command, commit, push, paid resource, remote migration or unrelated/mobile change was introduced. Remaining advisories/manual-popup limits are unchanged and disclosed; no additional permission is requested.

**2026-10-15 owner acceptance and final Phase 6 closeout (historical gated decision; superseded by activation above):** The owner answered “Accept record; keep rollout disabled (Recommended)” to the explicit final verification/release decision. All nine acceptance criteria are now met for the recorded scope, including acceptance of the documented limitations. Phase 6 is Complete for verification and the gated handoff. Public Profile/security gates remain false; no deployment, configuration or account mutation was needed for this decision. Dependency remediation (existing 53 advisories, including four critical) and a normal-browser hosted popup interaction remain explicit pre-enable follow-ups, not passed tests and not authorized implementation under this acceptance. The original invitation receipt, screen-reader version and default-builder limitations remain disclosed. This documentation-only closeout checked the phase acceptance counts, evidence JSON consistency and preserved boundaries; prior passing application checks were not unnecessarily repeated. No dependency, application code, migration, commit, push or paid resource changed.

**Dated Phase 6 verification note — 2026-10-15 (historical; superseded by current status):** Six of nine acceptance criteria are met; three are pending manual hosted verification. This supersedes older Phase 6 notes reporting six unresolved baseline SQL failures, missing callback entries, unavailable deployment access or absent deployment authorization. The owner-attended local staging session is no longer asserted to be running. The cloud install reports an existing cache-dir warning and 53 workspace dependency advisories; these remain documented out-of-scope limitations, not a clean dependency-audit claim. Subsequent owner follow-up: Gmail is signed in and three requested OTP/recovery messages reached the exact disposable alias. The original invitation was accepted by Auth but was not found in the inbox. The protected review build uses the existing backend and disposable accounts, with no new database or paid resource. Anonymous requests are redirected to Vercel authentication; the public app stays gated. The review origin’s three callbacks bring the preserved allowlist to 17. One plain implicit sign-in-link probe was correctly rejected by the PKCE callback, a harness mismatch established from installed SDK source rather than a production-code defect. The existing recovery screen then delivered its code successfully. Pending owner action: complete the prepared disposable reset form, sign into that account and open Profile; new-password entry/confirmation/submission requires owner attendance. Actual Profile credential/isolation tests and final release acceptance remain pending. No source/dependency/migration changes occurred in this follow-up; unchanged local checks were not unnecessarily repeated. A read-only dependency audit independently confirms the existing 53-advisory failure (16 moderate, 33 high, 4 critical; Next, shell-quote, tinypool and the Vitest aggregate among critical groups). No package/lockfile was modified. This out-of-scope dependency limitation remains visible for release acceptance. All 350 Preview source inputs still match the reviewed source.

**2026-10-15 hosted credential/association verification closeout:** Owner replied “Done — both completed” to the actual Profile password/relogin and sign-in email/both confirmations handoff. New Auth email is barangayan.ampid1+profile-phase6-updated-20261015@gmail.com; independent contact remains barangayan.ampid1+profile-phase6-contact@gmail.com. Agent verified the success callback, confirmed address, empty pending change and unchanged main/resident records through read-only state. The retained pre-change admin session now fails refresh while its independent resident session succeeds; both probe sessions subsequently clean up locally. A second memory-only public-SDK probe authenticates the updated admin and a freshly authenticated resident, commits their exact caller-bound association, reads its projection, rejects proof replay (22023), unlinks with the exact version and proves both whole profiles/Auth emails/sessions survive. All six hosted association checks and local cleanups pass; no privileged key, browser session extraction or credential mutation is used by either probe. Actual audits contain only operation/field names, and final browser/server warnings/errors are zero. Probe syntax and evidence/schema/fingerprint checks pass. The temporary probe is test tooling only; no production code/dependency/migration changed. The in-app popup remains an explicit limitation, not a fabricated UI pass. Section 10 outcomes are recorded; eight acceptance gates are met, with final limitations/release acceptance pending. Evidence: phase6-hosted-session-probe.json, phase6-hosted-association-probe.json, phase6-hosted-final-account-state.txt, phase6-hosted-redacted-audits.txt and phase6-review-runtime-final.jsonl.

**2026-10-15 Phase 6 disposable-account follow-up (historical; superseded above):** The owner privately set the disposable admin password; a read-only boolean check confirms a password exists. The review browser now visibly shows the exact disposable plus-address, not the main account. A real hosted Profile save changed its display name/contact address and showed success; login email stayed unchanged. Read-only whole-profile fingerprints prove the main admin and disposable resident records are identical before/after, while only the intended disposable admin changed. Actual inbox codes established independent admin/resident sessions with public APIs: resident admin-access denial and admin access both pass; both refreshes succeed before and after the profile save. No privileged key or credential mutation was used by that probe. The selected browser did not expose the resident ownership popup after Link was selected; no positive hosted link is claimed. Existing local Chrome/Firefox linking/expiry/cleanup evidence remains applicable. Preview runtime query returned zero warning/error/fatal records; browser warnings/errors remain zero; all 350 deployed source fingerprints still match. No source, dependency or migration changed, so prior passing checks were not repeated without cause. Actual owner-attended Profile email/password changes, post-password session revocation, hosted positive linking and final release acceptance remain pending. The pre-existing dependency audit limitation remains documented. Phase 6 stays Partially complete, 6/9 criteria met and three pending. Evidence: phase6-hosted-profile-isolation.json, phase6-hosted-session-probe.json and phase6-review-runtime.jsonl in the verification directory. This note supersedes the earlier password-bootstrap/sign-in handoff; do not reset the account again.

**Selected Phases 4/6 closeout — 2026-10-15 (historical; superseded by current Phase 6 notes):** Phase 4 is Complete (seven of seven acceptance criteria met). Phase 6 has five criteria met, one not met because of six pre-existing request/payment SQL failures, and three pending manual hosted/release verification. The full local matrix and final Chrome/Firefox production builds are verified. This note supersedes older Phase 4/6 progress that still requested already-supplied origins, registry information, local staging or attended accessibility checks. No hosted release was authorized or performed.

**Final 2026-10-15 verification note for selected Phases 1, 3, 4 and 6:** The baseline and final checks, successful Chrome 39/Firefox 37 suites, production build logs, read-only hosted settings/schema inventory and 19-function comparison are linked in the verification record. The Phase 3 refresh and popup readiness fixes passed both browsers; Phase 4's hosted password requirements passed before any Auth mutation. Prior failed Firefox attempts are retained as investigation evidence and superseded by the passing final run. Actual hosted callback/delivery and attended accessibility criteria remain unverified, so these phases are not marked complete. Phase 5's older preparation note is historical; Phase 1's direct catalog evidence records that 0119 was subsequently applied outside this task. Preserve the applied migration and do not reapply it.

**Subsequent 2026-10-15 owner follow-up:** Phase 1 is now complete for inventory/decisions: owner confirms no external registry and supplies the exact admin target. Existing local sign-in succeeds with no captured browser warning/error; /profile correctly remains gated. Localhost is connected to the inspected PRODUCTION project, and the supplied hosted URL stops at Vercel deployment protection. Phase 4/6 delivery verification therefore still requires deployment access, explicitly disposable hosted test accounts/inboxes and separate configuration/test authorization. Six exact-origin callback additions are prepared in [verification](evidence/admin-profile/verification.md); none was applied. No account credentials were changed or saved to files. Phase 3's attended zoom/screen-reader checks remain pending. Only documentation/evidence changed in this follow-up; the prior final code checks were not unnecessarily rerun.

**2026-10-15 connector follow-up:** Read-only connector discovery identifies the supplied Vercel URL as an old PRODUCTION deployment at 6 October commit 3f9e2d5; its exact git tree lacks this feature. The latest production attempt at 12 October HEAD 2e5681c failed ENOENT/buildStep; its root cause is unverified and not attributed to profile changes. Scoped deployment-file access returns 403 and no local Vercel CLI is available. Supabase lists only Barangayan's main/default branch, with no separate staging target. These findings replace the earlier deployment-version uncertainty with concrete release blockers. Phase 1 inventory remains complete; Phases 3/4/6 keep their unverified gates. No deployment, share-link/protection/configuration change, hosted data mutation or email sending occurred. Details: [connector inventory](evidence/admin-profile/connector-release-inventory.json) and verification record.

## 9. Confirmation and unresolved-decision register

| ID | Decision requiring confirmation | Recommended resolution | Impact/gate |
| --- | --- | --- | --- |
| D1 | Account model | Separate Auth users/profiles with explicit association. | Current schema cannot hold two role profiles under one identity. Blocks relationship design. |
| D2 | Cardinality/tenancy | One-to-one, same barangay, active accounts. | Alternatives change constraints and authorization. |
| D3 | Ownership proof | Both-account authentication with isolated resident context and expiring single-use proof. | Directory selection is insufficient. Blocks linking implementation. |
| D4 | Resident editing | Read-only first release. | Editing adds mutation permissions, validation, audit, and conflict scope. |
| D5 | Contact email | Independent from Auth sign-in email. | Existing differences must not be overwritten without an approved mirror/reconciliation policy. |
| D6 | Admin name/address model | Preserve legacy values; approve structured editing separately. | Automatic splitting/free-text address writes can lose data or violate locality. |
| D7 | Additional personal fields | Read-only initially; confirm birth date/sex/employment edits. | Defines self-update allowlist and validation. |
| D8 | Password/session protection | Applicable current-password/provider proof; fresh login; explicitly choose other-session revocation. | Affects access and recovery. |
| D9 | Hosted Auth settings | Verify before enabling credential controls; separately approve any project-wide changes. | Local settings cannot establish production behavior. |
| D10 | Deletion | Exclude self-profile/Auth deletion, disablement, demotion, archive. | Existing workflow has data/session/admin-access consequences. |
| D11 | Roster notes/precise evidence | Hide internal notes and unnecessary coordinates/identifiers unless approved. | Controls disclosure. |
| D12 | Synchronization | None automatic; separately approve explicit copy/mirroring scope. | Prevents cycles and unintended writes. |
| D13 | Security auditing | Reuse redacted existing conventions; decide which events must be mandatory. | Optional audit failure must not misreport successful persistence. |

Unresolved decisions must remain visible. Do not silently convert recommendations into approvals. Phase 1 refreshes evidence rather than changing settings/data to make assumptions true.

## 10. Verification matrix and release conditions

| Area | Required coverage |
| --- | --- |
| Account isolation | Admin Save changes only admin; resident projection comes only from verified target; credentials/sessions remain separate. |
| Permissions | Anonymous, resident, active/deleted admin, other admin target, cross-tenant target, forged IDs, expired/replayed proof. |
| Validation | Empty/whitespace names, length boundaries, email/mobile rules, optional/null fields, unknown/protected fields, valid/nonfuture dates, approved locality constraints. |
| Legacy data | Full names/free addresses survive unrelated edits; structured records use consistent composed fields. |
| Concurrency | Simultaneous/stale saves, link/unlink races, target deletion/role change, ambiguous response timeouts. |
| Linking | Both-account proof, wrong role/tenant, duplicates, single-use challenge, isolated resident session cleanup. |
| Email | Hosted old/new confirmations, occupied address, pending state, expiry, supported resend behavior, delivery failure, lost old inbox, callback/OTP, approved repair failure. |
| Password | Wrong current password, weak/mismatched/same password, required nonce/current-password behavior, passwordless provider, Auth failure, success/sign-out failure, fresh login. |
| Sessions | Explicit sign-out scope; resident unaffected; expired/revoked admin session handling and issued-token limits understood. |
| Synchronization | No implicit writes; approved explicit copies atomic; contact badge resets; no recursive cycles. |
| Partial failure | Avatar upload/reference/cleanup, Auth success/profile failure, link timeout, resident load failure, optional/mandatory audit behavior. |
| Destructive actions | No self-delete/demotion/archive; unlink preserves accounts/data; replacing link requires fresh proof. |
| UX/accessibility | Every state, dirty Cancel/navigation, conflict recovery, keyboard/screen reader, focus, reduced motion, 200% zoom, light/dark, collapsed sidebar, narrow/tablet/desktop layout. |
| Regression | Dashboard identity, theme destination/toggle, sidebar/logout, staff invitation/self-edit safeguards, resident directory/profile/verification, household behavior, notifications, relevant requests/transactions. |

Use isolated accounts/environment for all mutation, credential, mail, and failure-injection tests. Relevant existing tests include resident profile conflicts/setup/email verification and admin record/table workflows; determine the exact runnable subset from current repository scripts instead of inventing test results.

Deploy required additive database support before enabling dependent frontend actions. Keep feature access disabled until relationship and hosted Auth gates pass. Production deployment/application requires its own authorization. Rollback disables route/actions while preserving accounts and confirmed data.

**Release record requirements:** final commit/diff baseline, environment/settings, migration versions, executed checks and outcomes, tested failure recovery, unverified limitations, and accepted release decision.

“Production-ready” is an objective supported by these acceptance gates and evidence. No bug-free guarantee or test success is claimed in this planning document.
