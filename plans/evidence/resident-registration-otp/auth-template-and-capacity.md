# Phase 0 templates and capacity

Observed 2026-10-08, Asia/Manila. Status: **Passed** for Phase 0 configuration, first delivery, verification and current capacity observation. Broader release qualification remains in phase 5.

## Confirmed configuration versus delivery

The user's Brevo + Supabase SMTP setup confirmation is retained as a user report. Independent dashboard observation confirms custom SMTP is enabled and points to Brevo. Connected Brevo account lookup additionally reports transactional relay **enabled**, free plan with **300 send-limit credits**, and an **active Barangayan sender** using the connected Gmail mailbox. Account and sender connector responses agree on that mailbox. No keys, relay username, full account profile, or recipient address are stored here.

An active sender is account-side eligibility evidence. Initial production sends exposed a mismatch: Supabase used a different, unvalidated domain sender. Brevo rejected it. After being told this conflicts with the plan's preservation constraint and changes all production Auth email From addresses, the user explicitly authorized using the active connected Gmail sender. The SMTP sender email was changed and saved; the name, host, port, credentials, limits and other Auth settings were preserved. A fresh screenshot verified the persisted setting, but that screenshot is not retained because evidence omits email addresses. No domain was purchased.

[Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders) explain free-mailbox restrictions and temporary replacement. Actual retest messages arrived from Barangayan at the provider's `brevosend.com` replacement domain. Gmail reported SPF/DKIM/DMARC pass on both initial retests, and all three messages arrived in INBOX/CATEGORY_UPDATES. These findings do not establish owned-domain authentication or Outlook/repeated-session reliability.

## Existing templates and consumers

Before editing, the dashboard Magic Link body contained only `{{ .ConfirmationURL }}` and no rendered code; subject was **Your sign-in link**. Its actual editor content was read before saving the change. `templates/magic-link-before.html` and `templates/magic-link-before-subject.txt` preserve that content/subject for rollback (the text file adds a final newline).

Confirm sign up already contains `{{ .Token }}` and an optional `{{ .ConfirmationURL }}` link; subject is `Confirm your email address`. Observed source is recorded in `templates/confirm-sign-up-before.html`; no change is needed until actual selection/delivery is tested. Current Confirm Email stays disabled. No recovery, invitation, email-change, security-notification or reauthentication template was edited.

Repository consumer inventory searched apps/packages/Supabase for `signInWithOtp`, `magiclink`, `magic_link` and `ConfirmationURL`, excluding generated outputs. No current runtime Magic Link send call was found. Android/web recovery use `resetPasswordForEmail` and recovery OTP verification. Google OAuth is a separate PKCE flow. External/older deployed Magic Link consumers cannot be disproved by a repository search, so the prepared template preserves an optional sign-in link.

`templates/magic-link.html` is now the saved hosted Barangayan template, with subject **Your Barangayan verification code**. It presents `{{ .Token }}` as text, states the observed 60-minute expiry, warns against sharing, and requires no email-link navigation for the code path. It retains `{{ .ConfirmationURL }}` as an optional compatibility path. An unsaved-changes dialog showed that the earlier preview did not prove a save. That provisional claim was corrected: the actual Save action produced a success notification and disabled Save state; fresh navigation confirmed the persisted subject/body, and actual delivered messages confirmed the active content. `templates/hosted-preview.png` was recaptured after the successful save. No recovery or confirmation template was changed.

Under freshly confirmed hosted Auth v2.197.0/autoconfirm, actual first-time and returning retests both selected the saved Magic Link code template. Resend selected it too. All three real six-digit codes passed `verifyOtp` with type email and established the intended user's session. Sessions were signed out locally immediately. The initial three accepted sends failed downstream sender validation; their old subject also exposed the unsaved template state. See first-delivery-result.md for the complete failure and retest record. Confirm Email remains disabled.

## Capacity

| Budget item | Evidence / status |
| --- | --- |
| Supabase Auth emails | Actual hosted limit 25/hour; shared across Auth email traffic |
| Brevo relay | Enabled via connected account API |
| Brevo sender | Active connected Gmail sender selected with explicit user authorization; actual received domain `brevosend.com`; three Gmail deliveries and code verifications pass |
| Brevo plan | API reports free, 300 send-limit credits |
| Daily allowance | [Current Brevo free-plan documentation](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) specifies 300/day, daily reset, no carryover |
| Remaining allowance | Freshly reloaded Transactional > Real time > Usage and plan: **297 emails left until 08/10/2026**, zero prepaid credits, **0 paused emails**; three successful retests charged, initial rejected sends not reflected as charged |
| Reset behavior | Official free-plan docs: daily reset, no carryover; dashboard gives the date only. Exact reset clock/timezone is not exposed and is not inferred; obtain provider confirmation before relying on a boundary-time send budget |
| Launch estimate | User reports about 10 registrations/resends per day; treated as approximately 10 combined sends for this baseline, not a contractual maximum |

Use **new registrations + resends + recovery + invitations/email changes/other Auth emails**, plus any other traffic sharing the Brevo account. Ten combined sends/day leaves 287 of the observed 297 for recovery/other traffic in the current daily balance. Even a ten-send burst is below the 25/hour Supabase ceiling; other Auth traffic still shares that ceiling. The initial Brevo seven-day activity showed only the three failed test sends, and subsequent activity matches the three successful retests; no historical launch traffic is assumed. Recheck actual shared/burst demand before opening registration, and resolve excess demand then. No custom cap or rate-limit change was implemented.

Brevo's documented retry queue at daily exhaustion can delay OTPs beyond expiry; queued acceptance does not pass the delivery gate. Do not exhaust production quotas to test failure paths. Backend limits remain authoritative even with the future 60-second Android countdown. Record actual requested/accepted/arrived/verified messages and remaining budget in first-delivery-result.md; Gmail/Outlook multi-session qualification is phase 5.

## Verification and remaining release prerequisites

1. **Done:** recipient spelling resolved and dedicated-account production test explicitly authorized.
2. **Done:** Magic Link source/subject backed up, saved, freshly inspected and actually received. Confirm Email, expiry, recovery and redirects preserved; sender changed only after explicit conflict clarification.
3. **Done:** original failure diagnosed from provider logs; corrected sender; three fresh Supabase sends delivered to the dedicated inbox and codes verified. No mock, generated link or direct Brevo-only send substituted for this.
4. **Done for Phase 0 observation:** actual creation before OTP entry, automatic confirmation, initial hash/no profile, sessionless sending, usable verification sessions and local sign-out established. Observer statement ordering/hash provenance and stability remain phase 1 proof; no credential writes or account deletion were performed.
5. **Done for current capacity:** remaining transactional balance and empty queue observed after refresh; daily reset behavior and approximately ten-send launch estimate recorded. Precise reset clock, broader shared/burst demand, aligned-clock full delivery latency, Outlook and repeated-session/device qualification remain release follow-ups. Do not rely on this sample as a SLA.

Rollback, if needed: restore Magic Link body/subject from the before files, save and reload. Sender rollback is separate and would restore the diagnosed invalid sender; validate/authenticate it before restoring. Retain other settings/templates and all test/resident data. No automated rollback or cleanup has been run.
