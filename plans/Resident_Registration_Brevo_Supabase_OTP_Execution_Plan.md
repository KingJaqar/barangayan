# Android Resident Registration with Brevo and Supabase OTP — Execution Plan

Date: 2026-10-08 (Asia/Manila)

Status: proposal saved; runtime implementation has not started.

Scope revision: resident Android only, as directed by the user. Web implementation and iOS work are deferred.

## 1. Objective and readiness standard

Deliver functional three-step resident registration on resident-android-mobile, using Supabase's built-in email OTP delivered through the configured Brevo SMTP connection. Email registrants must finish personal details and password setup before the app admits them to Home. Google residents may skip personal details and a Barangayan password, browse Home, and complete their setup later through Settings.

Brevo + Supabase SMTP configuration is complete according to the user. Delivery, templates, rate limits, and successful verification have not been independently tested. Configuration complete does not mean the authentication feature or production release is complete.

Readiness means every required phase exit gate has recorded passing evidence against the intended environment and build. A build passing, a mocked email, an emulator session, or a configured SMTP form alone is insufficient. Missing access, unavailable devices, failed delivery, or untested flows remain explicitly pending and prevent a readiness declaration. Do not ship placeholder controls, simulated success, silent failures, or incomplete required steps.

This request authorizes saving and proposing this plan. The execution phases below are prospective; this document does not record implementation, hosted configuration changes, or deployment as already performed.

## 2. Confirmed product behavior

### Email registration

1. **Email confirmation:** enter email, choose **Send code**, enter the six-digit code, and choose **Verify and continue**. Support change-email, resend, a 60-second resend countdown, invalid/expired-code feedback, backend rate limits, delivery errors, loading, and retries.
2. **Personal details:** enter first name, last name, middle name, suffix, sex, date of birth, mobile number, House No., Street, and Employment Status. Show the verified email read-only. Show Barangay **Ampid 1**, City **San Mateo**, and Province **Rizal** read-only, supplied by the existing configured registration locality. Keep the existing optional occupation and location-map behavior. Choose **Next** to validate and save the details.
3. **Create password:** enter password and confirmation; choose **Create account**. Set the password on the account established by OTP, refresh setup status, and route to Home using the verified session. Do not call `signUp` again or sign out after success.

All current required personal fields remain required. Middle name, suffix, and occupation retain their existing optional rules. Preserve existing name, mobile, birth-date, password, and map validation. Back navigation within the wizard retains entered values. Passwords, OTPs, and unsaved personal details are not written to Android AsyncStorage.

Supabase creates an unfinished Auth account during step 1 and establishes a session after successful OTP verification. This replaces the earlier account-at-final-step proposal. Never infer that OTP was entered from `email_confirmed_at` alone when automatic confirmation is enabled. UI advancement requires a successful verified session.

Once an email has been verified, changing it means signing out of that setup session and restarting verification; do not change the existing account's email through the registration wizard. Explain that an unfinished account may remain. Do not automatically delete abandoned accounts as part of this feature.

### Google registration

1. **Sign up with Google:** use the existing external browser, PKCE, and callback flow. Keep sign-up, ordinary sign-in, and identity-linking intents distinct.
2. **Personal details:** use existing saved names first, then available Google names as editable suggestions. Never fabricate missing demographic/address details or names from an email address. Show the authenticated email read-only. **Skip for now** goes to Home; **Confirm personal details** validates and saves the details, then offers password setup if needed.
3. **Optional password:** show password and confirmation with **Finish account setup** and **Skip for now**. Both lead to Home after their corresponding action succeeds. If a resident-chosen password already exists, bypass this step.

Normal returning Google sign-in does not repeatedly force the sign-up wizard. An explicitly resumed profile-completion flow may offer optional password setup once details are saved. Linking Google must retain the current account ID, tenant, role, profile fields, password availability, and verification outcomes.

### Settings and existing accounts

- Signed-in Google users can open Settings, Profile, and password setup without first completing their profile.
- The Profile warning means **Personal details incomplete**. It is separate from email verification, location verification, and ID approval.
- The password row reads **Set Password** with **Password not set** warning text until a resident-chosen password exists, then **Change Password**.
- First-time password setup from Settings requires a fresh Google authentication for the same user. Cancellation, expired callbacks, or switching Google accounts must not set a password on the wrong account. Subsequent changes retain current-password verification and any supported Supabase reauthentication requirements.
- Confirmed details and password changes refresh status across screens; stale warnings must clear without requiring a new login.
- After email OTP verification, existing completed residents enter Home. Unfinished email registrations resume their missing step. Existing Google accounts use their skippable setup rules. Never reset or replace an existing password through registration. Staff/deleted accounts retain their existing authorization behavior and are not provisioned as new residents.
- Keep existing backend profile-completion requirements for document requests, health registration, and incident submission. Optional Google passwords must not become a requirement for these actions.

## 3. Technical decisions and compatibility

### Shared interfaces

Add a shared `ResidentAccountSetupStatus` contract containing `registrationOrigin` (`email_otp`, `google`, or `legacy`), `profileComplete`, `passwordSet`, and `hasGoogleIdentity`. Backend values describe the authenticated caller only. A pure shared routing helper selects the required email step, optional Google setup, or Home from status plus explicit navigation intent.

Add `get_resident_account_setup_status()` as an authenticated RPC with no user-ID, tenant, role, or password parameters. Keep privileged Auth reads in the private schema, with an explicit caller check, fixed search path, minimal grants, and no anonymous execution. Return no hashes, credential material, or other users' data. Reuse the existing completion rules; shared validation and the backend's completeness result must agree.

Use `signInWithOtp` for sending and `verifyOtp({ type: 'email' })` for verification. Resend uses the same normalized email and supported Auth operation; a successful send is not a verified email. Enforce the 60-second UI cooldown and respect stricter backend limits. Reuse the hosted OTP expiry rather than silently changing expiry for recovery/invitation/email-change flows. Use the existing profile-completion operation and Supabase Auth password update instead of inventing a second OTP service or creating another account.

### Password provenance and migration

Introduce a private, server-maintained lifecycle record keyed by Auth user ID. Initialize newly created accounts from this feature's email-OTP registration marker as password-unset even if Supabase has generated an internal temporary hash. Capture the origin at creation; later edits to user metadata cannot replace origin or password state. The initial marker is a flow-classification hint, not a trusted authorization claim. Resolve Google identity from Auth-managed identities, not editable metadata.

Backfill existing account password availability from known existing authentication behavior and stored credentials, with tests covering password users, Google-only users, and linked accounts. Before backfill, inventory whether any earlier passwordless accounts already contain generated hashes; do not label an unknown temporary hash as a resident-chosen password. Inspect the deployed Auth behavior and classify any such accounts conservatively until a real password update is observed.

Observe actual Auth password changes server-side so first setup, change password, and verified recovery all update the lifecycle record. Do not accept client-written `passwordSet` flags. Prove that OTP creation, resend, token refresh, Google linking, and metadata updates do not falsely mark a password as chosen. Status reads and repeated callbacks must be idempotent and preserve existing records.

Use the next unused four-digit migration prefix after the highest repository prefix, currently `0107`. Never renumber pushed migrations. Keep the migration additive and compatible with existing clients. Regenerate/update shared database types and test the RPC grants and migration replay. The status record must follow established deletion/anonymization rules without retaining credential material.

### Sessions, errors, and recovery

Keep OTP/recovery/Google-sign-up navigation intent separate so the new flow cannot hijack password recovery or account linking. Android protected navigation must wait for session and setup status before choosing a destination. A status error presents retry/sign-out rather than assuming completed setup.

Persist only the existing supported session and minimal non-sensitive navigation intent. After Android restart, reload saved profile/setup status from the server. If a session has expired, require authentication again and then resume; never reuse an OTP/password from storage. Unsaved entries may be lost on a restart, while successfully saved details remain intact.

Preserve the existing duplicate-callback protection and same-origin/scheme redirect validation. Reject malformed, expired, replayed, or unsafe callback destinations. Do not trust a locally set “reauthenticated” flag or provider list as proof of fresh Google authentication. Validate the newly completed authentication session and same account before a first-password write. Verify the actual Supabase secure-password-change behavior and nonce handling; do not claim client current-password checking changes Auth's server-wide guarantees.

On timeout or a dropped response, reload server state before repeating a write. Profile saving and password updates are separate operations: if details save but password setup fails, resume the password step rather than clearing details or creating another account. Disable repeated submissions while pending, bound network waits, and keep success navigation dependent on confirmed persisted results.

### Scope boundaries

Preserve `https://barangayan-resident-web.vercel.app`, the configured Brevo sender, existing map/location behavior, locality protections, data-submission gates, roles, and ID approval rules. No domain purchase, hosting migration, or general Android redesign is included.

The permanently cancelled Phase 8 in `Major_Web_AndroidMobile_Improvement_Plan.md` remains excluded. The phases in this document are specific to registration; they do not authorize that cancelled work. Web implementation and all iOS work, including iOS builds and device testing, are deferred. Necessary shared types/database/Auth changes remain in scope for Android and must preserve existing contracts and backward compatibility; this does not authorize work on other clients.

Existing Android configuration, asset deletions, service-screen edits, and staged registration/map edits were present when this plan was saved. Preserve them and refresh the baseline before execution; do not reset or accidentally commit unrelated work.

## 4. Execution phases

Execute phases in order. Each phase records changes, tests, actual environment/build identifiers, remaining risks, and exit-gate results. Keep evidence under `plans/evidence/resident-registration-otp/`; redact emails as appropriate and never include passwords, OTPs, session tokens, SMTP keys, or API secrets.

| Phase | Work | Status |
| --- | --- | --- |
| 0 | Baseline and email configuration verification | Not started |
| 1 | Database lifecycle, status RPC, and shared contracts | Not started |
| 2 | Android registration and authentication routing | Not started |
| 3 | Android Settings, warnings, and password management | Not started |
| 4 | Automated integration and security checks | Not started |
| 5 | Real email, Google, and Android device qualification | Not started |
| 6 | Android release preparation, rollout, and operational verification | Not started |

### Phase 0 — Baseline and email configuration verification

- Read root/app instructions and Expo SDK 57 documentation. Capture staged/unstaged/untracked changes and existing Android/shared test/build results before edits.
- Read the intended hosted Auth settings without exposing secrets: email provider, Confirm Email, six-digit OTP configuration/expiry, secure password change, SMTP send limits, allowed Android redirects, template content, and registration locality. Preserve other clients' existing redirect entries.
- Record user-confirmed Brevo SMTP setup separately from live test results. Verify Brevo transactional sending activation, sender verification, and current quotas.
- Prepare the Magic Link email with `{{ .Token }}`, app branding, expiry information, and no required email-link navigation. Preserve recovery and other templates. Keep the current Confirm Email setting. The template change is a future hosted action, not performed by saving this document.
- Confirm staging/test backend isolation and authorized test identities. A test Android build connected to production is not automatically staging. Use only dedicated, owned test accounts for any intentional hosted qualification.
- Test actual sending and delivery before making verification mandatory. Account creation timing, temporary hashes, template selection, and verification must be confirmed under the hosted Auth version/settings.

**Exit gate:** baseline recorded; hosted settings documented; template/configuration compatibility established; Brevo activation and a real delivery test pass. Any unavailable access or unsuccessful delivery remains a blocking release item.

### Phase 1 — Database lifecycle, status RPC, and shared contracts

- Add the additive lifecycle migration, private server-owned records, Auth lifecycle integration, safe backfill, and authenticated caller-only status RPC.
- Implement shared status types, step validation, error mapping, and Android routing decisions. Reuse existing profile/password rules without changing other clients' registration flows.
- Ensure email OTP accounts without a profile can finish through the existing completion RPC. Preserve existing Google minimal-profile provisioning, tenant assignment, and role/deletion checks.
- Verify no caller can read another user's status, change private lifecycle state, expose hashes, forge Google identity, or bypass profile/tenant restrictions.

**Exit gate:** focused shared/database tests and additive migration replay pass; generated temporary passwords remain unset; real password setup/change/recovery updates status; legacy/Google/linked/staff compatibility passes.

### Phase 2 — Android registration and authentication routing

- Split Android registration into email verification, personal details, and password steps using existing components and shared contracts. Implement sending, verification, resend cooldown, change-email, step/back navigation, and bounded errors/retries. Preserve unrelated registration/map edits and the restored Android design.
- Complete Google details/optional-password flows and both skip paths. Refresh status and navigation after saves. Keep the verified email session through final setup and route to Home after confirmed completion.
- Replace transient registration-only guarding with session/setup-aware guarding that survives app restarts and handles recoverable status errors.
- Preserve PKCE, the `barangayan://auth/callback` scheme, and protection against duplicate browser/deep-link callbacks. Track Google sign-up intent without interfering with ordinary login or identity linking.
- Handle back navigation, keyboard interaction, background/resume, network loss, and retry within the changed registration screens only.

**Exit gate:** Android type/lint checks and development-build smoke tests pass; OTP/browser callbacks, app restart, skipped Google details, and saved details/password transitions work on an actual Android device.

### Phase 3 — Android Settings, warnings, and password management

- Make authentication-only guards available for Settings/Profile/password setup, keeping action-level profile enforcement intact.
- Add accessible warning text/icons for missing personal details and password setup; preserve independent verification indicators. Loading/status errors must not display a false completed state.
- Reuse password setup with fresh same-account Google authentication from Settings; retain current-password checks for existing password users. Preserve recovery and refresh warnings after every successful update.
- Check existing Settings operations that assume a password. Account deletion currently requires password entry; provide the equivalent fresh-Google reauthentication route for passwordless Google users so optional password setup does not leave deletion unusable. Retain deletion confirmation and existing server safeguards; do not broaden unrelated Settings changes.
- Verify profile editing/completion, password creation/change, logout, and supported account-management actions work for incomplete and completed accounts.

**Exit gate:** passwordless Google users can access and use account Settings without inventing a current password; cancelled/mismatched authentication makes no mutation; warnings update correctly; deletion and other existing account-management security checks remain effective.

### Phase 4 — Automated integration and security checks

- Run meaningful shared tests, Android lint/typecheck/production export, and database tests against a disposable local database.
- Cover session restoration, step routing, retry/idempotency, existing-account preservation, password provenance, and profile/password warning consistency.
- Test private-table grants, anonymous/cross-user status access, editable-metadata attacks, tenant/role isolation, deleted profiles, and direct REST/RPC submission attempts with incomplete profiles.
- Verify backend Auth mutation compatibility with linked identities, recovery, existing clients, and staff invitations through contract/database checks. Do not add web or iOS implementation, builds, or device qualification to this Android execution.
- Rehearse migration/backfill on both a fresh database and a representative existing database. Run applicable Supabase security advisors and resolve introduced findings.

**Exit gate:** all required automated checks pass; no introduced regressions or unresolved security defects; remaining live-only acceptance cases are explicitly listed for phase 5.

### Phase 5 — Real-world Android qualification

- Run the acceptance matrix below using real Supabase/Brevo delivery and Google accounts on an actual Android device, including its external authentication browser. Test the signed release candidate as well as the development build; Expo Go/emulator/export alone is insufficient.
- Validate delivery to independently owned Gmail and Outlook test inboxes, including inbox/spam placement, send/arrival/verification times, and at least one resend. Codes must arrive and remain usable within the configured expiry and the promised UI behavior.
- Qualify the current no-owned-domain Brevo sender. Brevo's temporary sender-address replacement is a documented limitation, not a guarantee of reliable delivery. A passing SMTP connection is not enough; if real recipient delivery is unreliable, hold release and resolve sender/provider configuration before verification becomes mandatory.
- Exercise network loss, backgrounding/process termination, expired sessions/callbacks, rate-limit rejection, and recoverable profile/password failures. Do not deliberately exhaust the production quota or disrupt other users.
- Validate signed Android callbacks against the intended backend. Confirm completed email users can subsequently sign in with their chosen password and Google users can continue using Google after setting one.

**Exit gate:** all required matrix rows pass with redacted evidence on the release candidate and intended backend. Unavailable live email/OAuth/device validation cannot be replaced with a mock or marked passed.

### Phase 6 — Android release preparation, rollout, and operational verification

- Prepare a reviewed implementation diff, migration order, template/configuration backup, deployment instructions, Android build identification, and a recovery runbook. No credential values belong in repository artifacts.
- Apply backward-compatible database changes before new client flows. Configure/verify the OTP template before exposing mandatory verification. Keep old clients functional throughout the transition.
- Perform hosted configuration changes/deployment only in the subsequently authorized execution scope. Do not publish anything as part of this proposal-writing request.
- After rollout, smoke-test new email/Google registration, existing login/recovery, Settings, and restricted submissions in the distributed signed Android build against the intended backend.
- Monitor redacted send/verification outcomes, delivery delays, rate-limit errors, setup failures, OAuth callback failures, and migration/RPC errors during the initial release window. Record the time and result of each operational review; do not silently declare readiness from stale pre-release evidence.
- If failures occur, stop exposing the new registration entry and restore the previous client/configuration where compatible. Preserve created accounts, chosen passwords, and saved profiles. Do not roll back by deleting resident data or removing an additive schema still used by clients.

**Exit gate:** deployed smoke tests and operational review pass; recovery instructions are usable; no required acceptance row or unresolved blocker remains. Only then mark the implementation ready for real-world use.

## 5. Acceptance matrix

Run applicable rows on Android. Server-only checks run against the database/API supporting Android. Web and iOS qualification are deferred.

| Scenario | Required result |
| --- | --- |
| New email resident | Real code delivered and verified; details/password saved; Home reached once; password login works afterward. |
| Invalid, expired, or malformed OTP | Stay on verification; readable error; no false success or access to next step. |
| Resend and cooldown | 60-second UI countdown; respect backend limits; latest supported code verifies; no repeated automatic sends. |
| SMTP/Brevo failure or quota rejection | No verification success claim; actionable retry; no infinite spinner. |
| Change email | Verification restarts for the new email; no account-email mutation or reuse of the old verification. |
| Restart after OTP/details | Server-confirmed progress resumes; no premature Home; no saved OTP/password; saved details retained. |
| Existing complete email account | Same user/profile/password retained; successful verification routes to Home. |
| Existing incomplete or Google-linked account | Correct setup policy; no duplicate identity/profile or credential overwrite. |
| Google skip details | Home and Settings usable; missing-details warning; resident submissions still require profile completion. |
| Google save details, skip password | Details persisted; Home usable; only password warning remains. |
| Google set password | Google login and email/password login both work; warning clears. |
| Existing chosen password + Google | Password creation step bypassed; existing credential stays valid. |
| Settings first password | Fresh same-user Google authentication succeeds; cancel/account switch/expired callback cannot write. |
| Change password and recovery | Existing verification checks retained; old/new-password behavior correct; tracking refreshed. |
| Passwordless Google account management | Settings/profile/logout/deletion remain usable through the appropriate authentication path. |
| Concurrent callback or submission | One account/profile; no stale overwrite; safe retry after dropped response. |
| Offline/slow network/background/expired session | Clear recovery path; no unbounded wait, lost saved progress, or authorization bypass. |
| Status unavailable | Retry/sign-out available; no false password/profile success or misleading completed badge. |
| Private-state/metadata/cross-user attack | No secret disclosure, lifecycle-state forgery, tenant/role escalation, or other-user reads. |
| Incomplete-profile direct submission | Backend still rejects document/health/incident submissions; UI guards are not the only protection. |
| Legacy/backend contract compatibility | Existing Auth contracts, login/recovery, invitations, and shared data protections remain valid through backend tests. |
| Delivery on current sender configuration | Gmail/Outlook test recipients receive usable codes reliably within configured expiry; limitations documented. |

## 6. Completion checklist and evidence policy

- [x] User confirms Brevo + Supabase SMTP configuration complete.
- [x] Phased execution proposal saved to Markdown.
- [ ] Android phases 0–6 implemented/verified in order and recorded with actual outcomes.
- [ ] Live OTP, Google OAuth, and signed Android candidate verified.
- [ ] Private password provenance, status authorization, and database submission protections verified.
- [ ] Current no-owned-domain sender, quotas, and delivery limitations qualified for expected resident traffic.
- [ ] Existing contracts/local changes preserved; web/iOS work deferred; cancelled Android work not reintroduced.
- [ ] Rollout, post-deployment smoke tests, operational review, and recovery runbook complete.
- [ ] Ready-for-real-world-use declaration supported by complete evidence, with no pending required test.

Use statuses **Not started**, **In progress**, **Passed**, and **Blocked**. Every blocked gate states the concrete missing capability/evidence and resolution needed. A phase may not mark externally blocked work passed merely because its local implementation is complete.

## 7. References

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) — required before Android implementation.
- [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) — built-in flow, template token, verification, and session behavior.
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) — backend send and verification limits.
- [Supabase password updates](https://supabase.com/docs/reference/javascript/auth-updateuser) — supported credential update and nonce behavior.
- [Supabase Auth temporary password implementation](https://github.com/supabase/auth/blob/master/internal/api/magic_link.go) — reason a non-empty initial hash does not prove a resident-chosen password; inspect the deployed version before relying on implementation details.
- [Brevo sender requirements and temporary replacement](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders) — current no-domain setup limitation.
- [Brevo SMTP troubleshooting and activation](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP) — account activation and delivery failures.
- [Brevo free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) — sending allowance and queue behavior; recheck at execution time.
