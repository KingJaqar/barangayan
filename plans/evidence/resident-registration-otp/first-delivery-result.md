# Phase 0 first-delivery result

Date: 2026-10-08, Asia/Manila. Status: **Passed — corrected sender; new, returning and resend codes delivered and verified**.
Commit: `a75ee345224ed7f93d57b3e0c4de24e7540ba82c`. Backend: production `pwjbucnyqexiepoinoke`, explicitly authorized for the dedicated owned Gmail test. Auth health: HTTP 200, GoTrue v2.197.0. Android candidate: baseline Hermes export only; no installed/signed binary used.

The original test identity is one confirmed resident with a pre-existing hash. A plus-address variant routes to the same owned Gmail mailbox and supplies the new-account case. Addresses, codes, tokens, hashes, callback URLs and full message bodies are omitted from evidence. No password update, original profile mutation or account deletion was performed.

| Test ID | Action | Client request UTC | Accepted UTC | Result |
| --- | --- | --- | --- | --- |
| OTP-P0-RETURNING | `signInWithOtp`, `shouldCreateUser: false` | 10:09:22.970 | 10:09:25.558 | Accepted; no user or session returned |
| OTP-P0-NEW | `signInWithOtp`, `shouldCreateUser: true`, new owned plus-address | 10:10:17.167 | 10:10:19.815 | Accepted; no user or session returned |
| OTP-P0-RESEND | Same new-account email, `shouldCreateUser: false`, more than 60 seconds later | 10:13:10.345 | 10:13:13.379 | Accepted; no user or session returned |

Corresponding initial hosted Auth log aggregate shows two `/otp` requests with status 200, level info (10:05–10:20 UTC query window); the separate resend client response also reports success. Log success is not recipient delivery. Client time and hosted database time differ: the new account's server creation timestamp is 10:11:41.823837 UTC. Do not calculate inbox latency by subtracting unaligned clocks; obtain server email/log and received timestamps or measure from one monotonic observer.

Read-only SQL after the new send confirms one new Auth account, `email_confirmed_at` present, password hash present, and **no public profile** before entering any OTP. This proves automatic email confirmation and generated hash presence cannot establish entered-code verification or a chosen password. No credential/hash value was returned or saved.

## Initial failure and resolution

Initial Gmail searches (including all folders) returned no matching test messages. A broader Barangayan query returned an unrelated older SMTP-key notification, which is not delivery evidence. Subsequent targeted search returned **FORBIDDEN / RATE_LIMIT_EXCEEDED**, and the error persisted after a cooldown. Browser access opened a different mailbox; its account selector did not offer the dedicated account, so that tab was closed. No different mailbox was used to verify the test.

After the user signed in to the dedicated browser inbox and Brevo, Gmail's all-folder subject search showed no matching messages. Brevo logs showed a Sent and Error event for each of the three initial requests. New/resend detail views explicitly rejected the configured sender as invalid and required sender validation or domain authentication. These messages used the old subject, **Your sign-in link**. The prior template preview had not established persistence: an unsaved-changes dialog exposed the pending edit. The template was then saved using the actual Save control; a success notification, disabled Save state, fresh navigation and the subsequently received messages establish persistence. This corrects the earlier provisional saved-template claim.

The plan required preserving the original sender. The user explicitly authorized **Use the active Gmail sender**, overriding that restriction for this correction. Only the production SMTP sender email was changed to the active connected Gmail sender; name, host, port, credentials and limits were retained. Saved SMTP state was visually confirmed after reload. No domain was purchased. The Gmail connector subsequently recovered, allowing message reads without persisting codes or bodies.

## Bounded retest after configuration correction

| Test ID | Action | Client request / accepted UTC | Provider message Date UTC | Gmail receipt evidence | Verification UTC / result |
| --- | --- | --- | --- | --- | --- |
| OTP-P0-RETURNING-RETEST | Existing dedicated resident; create false | 10:24:11.200 / 10:24:14.448 | 10:25:38 | INBOX, CATEGORY_UPDATES; receiving-server headers 10:25:39–40 | 10:25:26.713; success, intended user and session true |
| OTP-P0-NEW-RETEST | Fresh owned plus-address B; create true | 10:24:23.142 / 10:24:25.442 | 10:25:49 | INBOX, CATEGORY_UPDATES; receiving-server header 10:25:50 | 10:25:16.435; success, intended user and session true |
| OTP-P0-RESEND-RETEST | Same B identity; create false; over 60 seconds after initial send | 10:25:48.324 / 10:25:50.626 | 10:27:14 | INBOX, CATEGORY_UPDATES; Brevo Delivered event at 18:27 Manila | 10:26:51.563; success, intended user and session true |

All three sends returned no user/session. All three emails selected **Your Barangayan verification code**, rendered the saved branded Magic Link body and a real six-digit token, and retained the optional compatibility link. `verifyOtp({ type: 'email' })` succeeded for every code. Each established test session was immediately signed out with scope local; all three sign-outs succeeded. No password update, resident profile mutation or token persistence occurred. Brevo Real time showed three Delivered events, zero bounced, matching the messages.

The actually received sender is Barangayan at Brevo's temporary `brevosend.com` replacement domain, rather than the Gmail domain. Gmail authentication headers show SPF, DKIM and DMARC pass for both initial retest messages. This qualifies this small Gmail sample, not durable domain ownership, Outlook delivery or a delivery SLA. Provider Date to Gmail receiving-server headers is 1–2 seconds for initial retests. The roughly 84-second local/server clock difference makes raw client-to-inbox subtraction invalid; the complete send-to-arrival 60-second target still needs aligned-clock/monotonic measurement during phase 5. Every tested code remained usable within the configured expiry.

Read-only SQL after verification confirms one B Auth identity, confirmed email, hash present and zero public profiles; the original dedicated identity still exists once. The initial plus-address and B test identities are retained; no account deletion was authorized or performed. Detailed password provenance, observer statement order, hash stability, full Google/native/device qualification and public-traffic abuse tests remain later-phase requirements. No further sends or polling are scheduled.
