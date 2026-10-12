-- Phase 3 prerequisite: expression indexes from 0111 execute these invoker
-- functions during service_requests writes. Existing trusted backend writers
-- need both the reference key and its nested text normalizer. These pure
-- functions read no data; this grants no access to the admin browse views.
begin;
grant usage on schema admin_table_keys to service_role;
grant execute on function admin_table_keys.text_key(text) to service_role;
grant execute on function admin_table_keys.reference_key(text) to service_role;
commit;
