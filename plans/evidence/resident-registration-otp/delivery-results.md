# Phase 5 — Delivery results

Status: **In progress** (Gmail: session 1 started 2026-10-11), **Blocked** (Outlook: no owned inbox, owner answer 2026-10-11).

Method: the owner requests each code on the device. Claude records the device request time (screenshot/log timestamp) and reads Gmail message metadata only (internal date, labels for inbox/spam placement) on `barangayan.ampid1@gmail.com` plus-addresses. Codes are never copied into this record. The target is arrival within 60 seconds and usability within the hosted 3,600-second expiry.

| Session | Recipient (redacted) | Type | Requested | Arrived | Delay | Placement | Verified | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `barangayan.ampid1@…` (new account) | New-account registration OTP (candidate 3, LDPlayer) | 13:52:26.821 UTC (`POST /auth/v1/otp` 200) | 13:52:29 UTC (Gmail internal date) | ≈2.2 s | INBOX, IMPORTANT, CATEGORY_UPDATES | Yes: a wrong code was rejected (`/verify` 403, 13:52:52), the delivered code was accepted (`/verify` 200, 13:52:55) | Subject "Your Barangayan verification code"; body shows the six-digit code, 60-minute expiry and single use (saved Magic Link template, new-account branch). Sender `lospollosmaestros@…brevosend.com` (Brevo replacement domain, as recorded in Phase 0). Owner entered the codes. |
