-- Migration 005: lock down direct table/function access via RLS and
-- explicit grants.
--
-- The backend uses the service_role key, which bypasses RLS by design —
-- but that's not a reason to leave these tables without RLS. Supabase
-- exposes every table in the `public` schema through its Data API by
-- default; without RLS enabled, `anon`/`authenticated` roles (i.e. anyone
-- holding a Supabase anon or user JWT, not just the backend) could read or
-- write these tables directly through that API if they were ever granted
-- privileges on them (explicitly or via a misconfigured default grant).
-- Enabling RLS with no policies denies all access to non-service-role
-- roles by default; the explicit REVOKEs below are defense in depth on top
-- of that, making the intent unambiguous rather than relying on "no
-- policies exist yet."

alter table customers enable row level security;
alter table users enable row level security;
alter table sync_runs enable row level security;

revoke all on table customers from anon, authenticated;
revoke all on table users from anon, authenticated;
revoke all on table sync_runs from anon, authenticated;

-- RLS does not apply to functions themselves (SECURITY DEFINER functions
-- run with the privileges of their owner regardless of RLS on the tables
-- they touch) — access to a function is controlled purely by EXECUTE
-- grants. These functions perform inserts/updates/deletes on behalf of the
-- sync pipeline and must only be callable by the backend's service_role.
revoke all on function start_sync_run(uuid, integer) from public, anon, authenticated;
revoke all on function sync_users(uuid, jsonb) from public, anon, authenticated;
revoke all on function complete_sync_run(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function fail_sync_run(uuid, text, text) from public, anon, authenticated;

grant execute on function start_sync_run(uuid, integer) to service_role;
grant execute on function sync_users(uuid, jsonb) to service_role;
grant execute on function complete_sync_run(uuid, uuid, jsonb) to service_role;
grant execute on function fail_sync_run(uuid, text, text) to service_role;
