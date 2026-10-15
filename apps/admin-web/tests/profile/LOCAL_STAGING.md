# Admin Profile local staging

Run from `C:\Users\User\barangayan` with the existing local Supabase Docker services running:

```powershell
node apps/admin-web/tests/profile/local-staging.mjs
```

The launcher creates a fresh, separate database, Auth, REST, Storage and Mailpit inbox. It copies the existing local schema and service migration ledgers only; no production or existing local app records/accounts are copied. It applies feature support to the new database and checks the linked admin/resident fixture before opening a signed-in Chrome window. Startup includes a production build and verification, so allow a few minutes.

All app/API/inbox ports bind to `127.0.0.1`. Their assigned URLs and the expiry are printed when ready and recorded in `plans/evidence/admin-profile/local-staging-ready.json`. The app runs the current working tree with profile gates enabled only in its own process. It explicitly blanks the privileged service key so Next cannot reload a real value from `.env.local`. It does not change the usual localhost:3000 app or its environment file.

Only synthetic `example.test` accounts are used. Chrome receives its staging sign-in in memory; account passwords and session cookies are not exported to files. The dedicated Mailpit inbox receives actual staging Auth emails locally. No cloud SMTP service or external recipient is used. These local messages do not prove hosted delivery.

Inspect or stop the current session:

```powershell
node apps/admin-web/tests/profile/local-staging.mjs --status
node apps/admin-web/tests/profile/local-staging.mjs --stop
```

Closing the staging Chrome window or reaching the two-hour limit also stops the session. Shutdown closes the task browser/server/gateway and stops only the task-created containers. The isolated database is preserved, and no account/data deletion occurs. A new start creates a fresh fixture; it does not resume the previous database or run the feature rollback against it.

For Phase 3 manual acceptance, use the signed-in staging Chrome window:

1. Set actual browser zoom to **200%** using Chrome's menu. Check both account labels, expand/collapse the sidebar, edit/cancel, validation, and the security/unlink dialogs. Controls and messages must stay reachable without overlap or horizontal clipping. Restore zoom afterward.
2. With a screen reader running, check the Admin/Resident headings, form labels, loading/error/success announcements and named dialogs. Check Tab/Shift+Tab containment, Escape and focus restoration. Do not submit a password/email change for these presentation checks.
3. Record the browser/screen-reader versions, actions, actual announcements and any defects. An accessibility-tree assertion or opening the window alone does not satisfy actual speech/zoom acceptance.

The optional portable NVDA test tool, if present, is under `tmp/admin-profile-accessibility/portable/`. It is not an app dependency or system installation. Do not change startup/security settings to run these tests.
