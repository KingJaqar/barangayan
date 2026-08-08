-- Drops the temporary diagnostic probe created while tracing the
-- "withdrawing deletes the report" bug (see 0032 for the actual fix).
drop function if exists public.__diag_incident_env();
