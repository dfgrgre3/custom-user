-- Migration 004: the sync_users() function — upserts every fetched user and
-- soft-deletes any previously active user absent from the fetch, in one
-- transaction. This is the function complete_sync_run() (migration 003)
-- wraps together with the sync_runs status update.
--
-- p_users is a JSON array of objects shaped like:
--   { "externalUserId", "name", "email", "phone", "status",
--     "companyName", "companyIndustry", "companyRole", "companyWebsite",
--     "companyEmployees", "externalCreatedAt", "externalUpdatedAt" }
--
-- Two defenses added in this version, beyond the original upsert + soft-delete:
--
-- 1. Duplicate external ids within one fetch. The customer API is expected
--    to return each user once, but if it (or a bug in it) ever returns the
--    same external_user_id twice in one page set, a single INSERT ... ON
--    CONFLICT statement raises "ON CONFLICT DO UPDATE command cannot affect
--    row a second time" — a confusing low-level error. Detecting and
--    rejecting the duplicate explicitly, with the id named, fails the sync
--    the same way a contract violation does (visible, actionable) instead
--    of a raw Postgres error leaking into SyncRun.errorMessage.
--
-- 2. Stale writes. Without a check, an older sync run that completes after
--    a newer one (e.g. a slow retried request racing a fresh one) could
--    overwrite already-current data with stale values. The upsert's WHERE
--    clause only lets an incoming row win if its external_updated_at is at
--    least as new as what's already stored — an out-of-order write becomes
--    a no-op for that row instead of clobbering newer data.
create or replace function sync_users(p_customer_id uuid, p_users jsonb)
returns table (created integer, updated integer, deleted integer)
language plpgsql
as $$
declare
  v_created integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
  v_duplicate_id text;
begin
  create temporary table _sync_incoming on commit drop as
  select
    (u->>'externalUserId')::text as external_user_id,
    (u->>'name')::text as name,
    (u->>'email')::text as email,
    nullif(u->>'phone', '')::text as phone,
    (u->>'status')::user_status as status,
    nullif(u->>'companyName', '')::text as company_name,
    nullif(u->>'companyIndustry', '')::text as company_industry,
    nullif(u->>'companyRole', '')::text as company_role,
    nullif(u->>'companyWebsite', '')::text as company_website,
    (u->>'companyEmployees')::integer as company_employees,
    (u->>'externalCreatedAt')::timestamptz as external_created_at,
    (u->>'externalUpdatedAt')::timestamptz as external_updated_at
  from jsonb_array_elements(p_users) as u;

  select external_user_id into v_duplicate_id
  from _sync_incoming
  group by external_user_id
  having count(*) > 1
  limit 1;

  if v_duplicate_id is not null then
    raise exception 'Duplicate external user id in fetch: %', v_duplicate_id
      using errcode = 'P0002';
  end if;

  with existing as (
    select external_user_id from users
    where customer_id = p_customer_id
      and external_user_id in (select external_user_id from _sync_incoming)
  ),
  upserted as (
    insert into users as t (
      customer_id, external_user_id, name, email, phone, status,
      company_name, company_industry, company_role, company_website,
      company_employees, external_created_at, external_updated_at, deleted_at
    )
    select
      p_customer_id, i.external_user_id, i.name, i.email, i.phone, i.status,
      i.company_name, i.company_industry, i.company_role, i.company_website,
      i.company_employees, i.external_created_at, i.external_updated_at, null
    from _sync_incoming i
    on conflict (customer_id, external_user_id) do update set
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      status = excluded.status,
      company_name = excluded.company_name,
      company_industry = excluded.company_industry,
      company_role = excluded.company_role,
      company_website = excluded.company_website,
      company_employees = excluded.company_employees,
      external_created_at = excluded.external_created_at,
      external_updated_at = excluded.external_updated_at,
      deleted_at = null
    -- Stale-write guard: only let this write win if the incoming record is
    -- not older than what's already stored (see migration header).
    where t.external_updated_at <= excluded.external_updated_at
    returning t.external_user_id
  )
  select
    (select count(*) from upserted) - (select count(*) from existing),
    (select count(*) from existing)
  into v_created, v_updated;

  with missing as (
    update users
    set deleted_at = now()
    where customer_id = p_customer_id
      and deleted_at is null
      and external_user_id not in (select external_user_id from _sync_incoming)
    returning id
  )
  select count(*) into v_deleted from missing;

  return query select v_created, v_updated, v_deleted;
end;
$$;
