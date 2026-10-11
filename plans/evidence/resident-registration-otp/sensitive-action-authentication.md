# Sensitive-action authentication boundary — Phase 3, 2026-10-11

Scope: resident Android Settings password management and account deletion. This record separates what the **Android application** enforces from what **Supabase Auth** and the **`delete-my-account` endpoint** enforce. It makes no production server-enforced fresh-authentication claim. No hosted Auth setting, Edge Function or migration was changed in Phase 3.

## Observed server policy

| Source | Observation |
| --- | --- |
| Hosted dashboard, project `pwjbucnyqexiepoinoke`, Authentication → Sign In / Providers → Email, read-only on 2026-10-11 | Secure password change **off**; Require current password when updating **off**; leaked-password protection off (Pro-only); minimum length 6; email OTP 3600 s / 6 digits; secure email change on. Matches the Phase 0 (2026-10-08) reading. |
| Local `supabase/config.toml` | `secure_password_change = false`, matching hosted. |
| Local Auth (GoTrue as recorded in Phase 1, same CLI 2.118.0 stack) — `resident_sensitive_actions.auth.mjs` SA-1 | Access-token `amr` holds `{method, timestamp}` set by Auth at sign-in. A token refresh keeps the same `session_id` and `amr` timestamp; a new sign-in issues a new session and a later timestamp. |

## Direct-request results (isolated local stack)

Command: `node supabase/tests/resident_sensitive_actions.auth.mjs` (requires the ignored `.env.phase1.local` from `supabase status --output json` and `supabase functions serve`). Result: **all passed**.

| ID | Direct request | Actual server behavior |
| --- | --- | --- |
| SA-2 | `PUT /auth/v1/user` `{password}` from a refreshed session with no current password or new sign-in | **Accepted.** Old password rejected afterwards, new one accepted; private lifecycle records `password_set=true`. The server does not require fresh authentication or the current password. |
| SA-3a | `POST /functions/v1/delete-my-account` without Authorization | 401. |
| SA-3b | Same, with a refreshed (non-reauthenticated) session and a body naming another user | **200 for the caller only.** Caller profile anonymized and Auth user banned (~100 years); body target ignored; the other resident's profile and password unaffected. The endpoint does not require fresh authentication. |
| SA-3c | Retry with the deleted user's earlier access token | 401 (banned user fails `getUser`). Phase 1 separately proved earlier-JWT rejection for setup/submission RPCs. |

## Enforcement matrix

| Action | Android application (Phase 3 candidate) | Supabase Auth / endpoint |
| --- | --- | --- |
| Change existing password (`passwordSet=true`) | Current password re-entered via `signInWithPassword`; returned user ID must equal the signed-in resident before `updateUser`; status refreshed after success. | No current-password or freshness requirement (SA-2). |
| Manage unknown legacy password (`passwordSet=null`) | Same current-password change, plus email recovery. Never shown as "Password not set"; first-time setup is never offered. | As above; recovery uses the existing recovery OTP flow. |
| First password from Settings (`passwordSet=false`, Google identity) | Requires a completed `reauthenticate` attempt with purpose `set_password`, expected and exchanged user equal to the signed-in resident, started ≤ 5 min ago, **and** an `oauth` entry in the current session's Auth-issued `amr` recorded after that attempt began (2 min clock-skew allowance). Rechecked immediately before `updateUser`; status must still say `passwordSet=false`; the attempt is consumed after success or when leaving. A different Google account's session is discarded before provisioning; cancellation leaves no attempt. | No freshness requirement (SA-2). |
| First password without Google (`passwordSet=false`, no Google identity) | No first-password form; email password recovery only. | Recovery OTP proves mailbox control. |
| Delete account, password users (`true`/`null`) | Confirmation dialog, then password re-entry with same-user check, then endpoint call. | Caller-only; no freshness requirement (SA-3b). |
| Delete account, passwordless Google users | Confirmation dialog, then purpose `delete_account` Google reauthentication (same checks as above), then a second explicit final confirmation; freshness rechecked at the moment of the request; cancelling consumes it. | Same endpoint, same limits. |
| Status loading/error | No password or deletion mode is guessed; retry is offered. | — |

## Live application checks (development device, production backend)

First-password: cancelled Google confirmation, wrong Google account (unintended session discarded) and an expired confirmation each made no password write on either account; a fresh same-account confirmation wrote the password 43 s later. Passwordless deletion: cancelled Google confirmation and cancelled final confirmation made no change; a confirmed deletion anonymized the profile and banned the Auth user. Details and screenshots: [Phase 3 Android proof](phase3-android-proof.md).

## Limits and recommendations

- The five-minute window and fresh-Google requirement are **application-enforced only**. A party holding a valid access/refresh token can call `updateUser` or `delete-my-account` directly. This is the pre-existing server behavior, unchanged by Phase 3.
- A server-enforced guarantee is feasible without trusting client flags: `delete-my-account` could reject tokens whose verified `amr` has no entry newer than N minutes. Enabling hosted **Secure password change** would add Auth's own 24-hour recent-login/nonce rule, but would also affect resumed email registrations older than 24 hours and the web client. Either change needs an explicit owner decision, deployment approval and its own negative direct-request tests. Neither was made here.
- `amr` freshness is read from the token the app received from Auth over TLS. The client does not verify its signature; this is defense in depth for the app's own flow, not server proof.
