-- Migration 006: repair databases that already recorded the original
-- concurrency migration. The original design attempted to use now() in a
-- partial-index predicate, which PostgreSQL rejects because index membership
-- cannot change as time passes. This migration installs the lease-lock table
-- and recreates all RPCs that participate in acquiring and releasing it.

alter table sync_runs
  add column if not exists lease_expires_at timestamptz(3);

create table if not exists sync_run_locks (
  customer_id uuid primary key references customers(id) on delete cascade,
  sync_run_id uuid not null references sync_runs(id) on delete cascade,
  lease_expires_at timestamptz(3) not null,
  acquired_at timestamptz(3) not null default now()
);
alter table sync_run_locks enable row level security;

drop index if exists sync_runs_one_running_per_customer;

create or replace function start_sync_run(p_customer_id uuid, p_lease_seconds integer default 1800)
returns sync_runs
language plpgsql
as $$
declare
  v_run sync_runs;
  v_lock_customer_id uuid;
begin
  if p_lease_seconds <= 0 then
    raise exception 'p_lease_seconds must be positive';
  end if;

  insert into sync_runs (customer_id, status, lease_expires_at)
  values (p_customer_id, 'RUNNING', now() + make_interval(secs => p_lease_seconds))
  returning * into v_run;

  insert into sync_run_locks (customer_id, sync_run_id, lease_expires_at)
  values (p_customer_id, v_run.id, v_run.lease_expires_at)
  on conflict (customer_id) do update
    set sync_run_id = excluded.sync_run_id,
        lease_expires_at = excluded.lease_expires_at,
        acquired_at = now()
    where sync_run_locks.lease_expires_at <= now()
  returning customer_id into v_lock_customer_id;

  if v_lock_customer_id is null then
    raise exception 'sync_already_running' using errcode = 'P0001';
  end if;

  return v_run;
end;
$$;

create or replace function complete_sync_run(p_sync_run_id uuid, p_customer_id uuid, p_users jsonb)
returns sync_runs
language plpgsql
as $$
declare
  v_created integer;
  v_updated integer;
  v_deleted integer;
  v_run sync_runs;
begin
  select created, updated, deleted
    into v_created, v_updated, v_deleted
    from sync_users(p_customer_id, p_users);

  update sync_runs
  set
    status = 'SUCCESS',
    completed_at = now(),
    records_fetched = jsonb_array_length(p_users),
    records_created = v_created,
    records_updated = v_updated,
    records_deleted = v_deleted
  where id = p_sync_run_id
  returning * into v_run;

  if v_run.id is null then
    raise exception 'sync_run % not found', p_sync_run_id;
  end if;

  delete from sync_run_locks
  where customer_id = p_customer_id
    and sync_run_id = p_sync_run_id;

  return v_run;
end;
$$;

create or replace function fail_sync_run(p_sync_run_id uuid, p_error_code text, p_error_message text)
returns sync_runs
language plpgsql
as $$
declare
  v_run sync_runs;
begin
  update sync_runs
  set
    status = 'FAILED',
    completed_at = now(),
    error_code = p_error_code,
    error_message = p_error_message
  where id = p_sync_run_id
  returning * into v_run;

  if v_run.id is null then
    raise exception 'sync_run % not found', p_sync_run_id;
  end if;

  delete from sync_run_locks
  where customer_id = v_run.customer_id
    and sync_run_id = p_sync_run_id;

  return v_run;
end;
$$;

revoke all on table sync_run_locks from anon, authenticated;
revoke all on function start_sync_run(uuid, integer) from public, anon, authenticated;
revoke all on function complete_sync_run(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function fail_sync_run(uuid, text, text) from public, anon, authenticated;

grant execute on function start_sync_run(uuid, integer) to service_role;
grant execute on function complete_sync_run(uuid, uuid, jsonb) to service_role;
grant execute on function fail_sync_run(uuid, text, text) to service_role;