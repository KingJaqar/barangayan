-- Drops the temporary diagnostic function from 0028 (which was itself never committed —
-- created directly on the remote to inspect the live soft_delete_incident definition
-- while troubleshooting a resident-reported "withdrawal deletes the row" issue).
drop function if exists public.__diag_soft_delete_incident_def();
