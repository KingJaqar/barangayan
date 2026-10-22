# P18-T05 — Published Privacy Policy: Data Retention wording after the PR-14 approval (2026-10-21)

**Decision:** OD-16 (the owner approved the deletion matrix as written and asked for the published policy to stop promising five years of retention after closure). **Status:** **applied** to the hosted project on 2026-10-21 (`updated_at` 05:48:27 UTC). The first attempt was refused by the permission classifier as a production write; the owner then gave explicit permission for that single write and the statement below was run once. It matched exactly one row (`UPDATE 1`); the previous sentence no longer occurs and the new one does; body length 2,669 → 3,120 characters; no other row or paragraph changed. The seed migration was not edited.

**Row:** `public.site_content`, `id = 8253e89a-5f9f-498b-b0e6-d946b45a3f76` (`section = 'privacy_policy'`, `barangay_id = 00000000-0000-0000-0000-000000000001`, the only active privacy row; last updated 2026-09-26). Read-only on 2026-10-21.

## Previous text (section 5)

> Your personal data is saved while your account is active and retained for up to five years after account closure (unless law mandates longer). Anonymized statistical data may be kept indefinitely.

## Replacement text (section 5)

> Your personal data is kept while your account is active. When you delete your account in the app, your sign-in and personal details are erased or de-identified. Your household members, ID verification records and files, attached files, notification history, phone alert devices, medical drive registrations and evacuation check-ins are erased. Document requests and payment records, which the barangay must keep for accounting and audit, and incident reports you filed are kept without your name or contact details. Records that the law requires us to keep longer are kept as the law requires. Anonymized statistical data may be kept indefinitely.

It restates the approved matrix (migration `0136`): erased — household members, ID verification records and files (except the tombstoned submission a version 2 request must keep), request attachments, notification history and settings, push devices, medical drive registrations, check-ins, read marks; de-identified and kept — profile, document requests and payments, incident reports and their corroborations.

## Update that was run (single row, only that paragraph changes; the table's modtime trigger refreshed `updated_at`, which the app shows as "Last updated")

```sql
update public.site_content
set body = replace(
  body,
  'Your personal data is saved while your account is active and retained for up to five years after account closure (unless law mandates longer). Anonymized statistical data may be kept indefinitely.',
  'Your personal data is kept while your account is active. When you delete your account in the app, your sign-in and personal details are erased or de-identified. Your household members, ID verification records and files, attached files, notification history, phone alert devices, medical drive registrations and evacuation check-ins are erased. Document requests and payment records, which the barangay must keep for accounting and audit, and incident reports you filed are kept without your name or contact details. Records that the law requires us to keep longer are kept as the law requires. Anonymized statistical data may be kept indefinitely.'
)
where id = '8253e89a-5f9f-498b-b0e6-d946b45a3f76'
  and section = 'privacy_policy'
  and body like '%retained for up to five years after account closure%';
```

To undo, run the same statement with the two strings swapped.

## Points for the owner

- **Effective date and notice.** The policy's own section 10 says major changes are posted at least 15 days before taking effect, and its "Effective Date: August 21, 2026" line is unchanged. Whether this is a "major change" and what effective date to show is the owner's call; no date was invented.
- **Timing (now live).** The new wording is already published. It describes the approved v2 deletion. Until migrations `0135`/`0136` and the v2 `delete-my-account` function are deployed and the Android/web apps use it, their deletion (v1) only anonymizes the profile and bans the sign-in, so it does not yet match this text. Publishing the wording ahead of the deployment leaves that gap until the v2 deletion is deployed and Android/web use it.
- **Seed.** The retention sentence also exists in the already-pushed seed migration `0062_seed_site_content_and_about_us.sql`. A pushed migration is not edited; the hosted row is the source of truth.
