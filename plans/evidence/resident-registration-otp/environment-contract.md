# Phase 0 environment contract

Observed 2026-10-08, Asia/Manila. Status: **Passed** for Phase 0 environment observation and first OTP integration test; later implementation/release prerequisites are explicitly recorded below. Dedicated-account production testing was authorized; it does not make this environment isolated.

## Hosted environment, read-only evidence

Supabase connector lists one healthy project, Barangayan (`pwjbucnyqexiepoinoke`), region ap-northeast-2, PostgreSQL 17.6.1.155. Branch listing contains only main, pointing to the same project. The dashboard explicitly labels it **PRODUCTION**. Android's ignored environment file targets that project; it is not staging. Local `supabase/config.toml` is a separate local configuration and does not prove hosted settings.

Hosted values were read through the authenticated dashboard, without reading SMTP passwords or Google secrets:

| Setting | Actual hosted value |
| --- | --- |
| New signups / email / Google | Enabled |
| Confirm Email | Disabled; preserved |
| Secure email change | Enabled |
| Secure password change | Disabled |
| Require current password when updating | Disabled |
| Password requirements | Lowercase, uppercase, digits and symbols; minimum length not captured because the text observation redacted that field |
| Email OTP | Six digits, 3,600-second expiry |
| Custom SMTP | Enabled; smtp-relay.brevo.com, port 587, sender name Barangayan; sender and username configured, values omitted |
| Minimum email interval per user | 1 second; Android's planned 60-second cooldown is stricter |
| Email sends | 25/hour, visually confirmed on Rate Limits screen |
| Token verification / signups and sign-ins | Each 30 requests per five minutes per IP |
| Token refresh | 150 requests per five minutes per IP |
| CAPTCHA / anonymous signin / manual linking | Disabled / disabled / disabled |

Site URL is `https://barangayan-resident-web.vercel.app`. Existing redirect entries:

- `https://barangayan-resident-web.vercel.app/auth/callback`
- `https://barangayan-resident-web.vercel.app/auth/callback?next=**`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=**`

**Compatibility defect:** `barangayan://auth/callback` is absent. Add this exact Android entry in the authorized configuration environment while retaining all four entries, then qualify native callbacks. Manual linking is disabled even though Android has a `linkIdentity` flow; resolve provider configuration and test preservation of account/tenant/password before claiming linking works. These settings remain unchanged. Phase 0 hosted changes comprise the Magic Link body/subject and the SMTP sender correction explicitly authorized after provider rejection; see auth-template-and-capacity.md. The numeric email-code test does not require an Android callback or manual linking, so their absence did not prevent that test.

## Locality and observer feasibility

Read-only SQL confirms exactly one enabled locality: Ampid 1, San Mateo, Rizal, with a non-null barangay boundary. Existing Auth tables are owned by `supabase_auth_admin`. `has_table_privilege` reports TRIGGER permission for postgres and supabase_auth_admin on auth.users. Existing AFTER INSERT triggers provision a profile only when barangay metadata exists and provision Google residents after Google identity insertion. These observations establish existing permission/statement constraints, not successful installation of a new observer.

Aggregate-only inventory, without account IDs, emails or hashes:

| Profile category | Google identity | Hash present | Count |
| --- | --- | --- | --- |
| Admin | No | Yes | 4 |
| Admin | Yes | Yes | 1 |
| Resident | No | Yes | 12 |
| Resident | Yes | No | 3 |
| Resident | Yes | Yes | 1 |

A present hash does not establish a chosen password. The 17 hash-present accounts require provenance evidence; no backfill classification was applied. No existing user or password was modified.

Cached linked `supabase/.temp/gotrue-version` says v2.197.0. A fresh network-enabled `/auth/v1/health` request using the app's existing public API key returned HTTP 200, name GoTrue, version **v2.197.0**, independently confirming it. The initial sandbox network attempt failed; the network-enabled probe prints only outcomes and keeps sessions in memory.

[Auth source at that tag](https://github.com/supabase/auth/blob/v2.197.0/internal/api/magic_link.go) creates a random temporary password for a new OTP account, then sends the Magic Link branch when autoconfirm is on. The authorized new Gmail plus-address test actually created one Auth account with a non-empty initial hash, automatic email confirmation, and no public profile before OTP entry. Neither user nor session was returned by the OTP send. This proves auto-confirmation/hash presence cannot stand in for entered OTP or a resident-chosen password. After correcting the sender, a fresh new plus-address B and returning identity both received the Magic Link code template; their codes and B's resend code verified successfully, establishing intended-user sessions. All were signed out locally. B still has one Auth identity and zero profiles after verification. Creation/resend/password-update statement order and safe observer semantics must be proved in isolation before phase 1's design is accepted.

With both hosted password protections disabled, Android current-password/Google checks do not make direct `updateUser` require fresh authentication. Do not claim a five-minute backend guarantee. Phase 1/3 must establish a supported enforcement design and negative direct-request evidence without silently changing shared Auth policy. No credential mutation or nonce test was performed against a real identity.

## Access and unresolved requirements

- User explicitly authorized production testing with the connected dedicated Gmail identity after correcting its spelling. The original confirmed resident account is preserved; a new plus-address test identity routes to the same owned inbox. No separate staging exists, and no paid project/branch was created.
- Gmail connector initially hit `FORBIDDEN / RATE_LIMIT_EXCEEDED`; the wrong browser mailbox was closed without use. User subsequently signed in to the dedicated browser inbox and Brevo, exposing invalid-sender rejection. Connector access recovered; the corrected-sender new/returning/resend messages reached INBOX/CATEGORY_UPDATES and all verified. Brevo transactional balance after refresh is 297 remaining/300 daily, zero queued. Outlook, repeated sessions and native/device delivery qualification remain phase 5 work.
- Deployed Auth version, actual creation/hash presence, delivered template selection and successful code verification are now verified. SQL permission reads are not a tested observer. Initial accepted sends failed downstream and are separately recorded from passing retests.
- Resolve missing Android redirect/manual linking in the authorized configuration scope; no web redirect removal, CAPTCHA weakening, Confirm Email change, signing change or unrelated client work is authorized implicitly.
- Obtain native signing/distribution identity/build access listed in baseline.md; EAS account lookup failed DNS resolution. No signed native route has been verified.

Reviewed [Supabase breaking changes](https://supabase.com/changelog?types=breaking-change): custom SMTP is required for template customization on new free-tier projects; explicit API grants matter for future schema changes, and custom objects must remain outside managed Auth schemas. The markdown index fetch was rejected by the web reader; the official HTML changelog was used instead. Reviewed [password security](https://supabase.com/docs/guides/auth/password-security) and [rate limits](https://supabase.com/docs/guides/auth/rate-limits).
