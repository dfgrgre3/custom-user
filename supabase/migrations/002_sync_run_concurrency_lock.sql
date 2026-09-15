-- Migration 002: database-level concurrency lock for sync runs.
--
-- The application previously guarded against overlapping syncs for the same
-- customer with an in-process `Set<string>` (SyncService.runningCustomers).
-- That only protects a single Node process; with more than one instance (or
-- more than one deployment) two overlapping syncs for the same customer
-- could run at once, each fetching a different snapshot and racing to write
-- it. A unique customer_id in a lock table makes "at most one active sync per
-- customer" a database-enforced invariant instead of an in-memory one.
--
-- lease_expires_at bounds how long a RUNNING row is honored as "in
-- progress": if the process that created it dies mid-sync, the row would
-- otherwise stay RUNNING forever and permanently lock that customer out of
-- new syncs. The lease is checked by the atomic upsert below, where `now()`
-- is valid because it is evaluated by a statement, not stored in an index
-- predicate.

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

-- Starts a sync run and acquires its lease atomically. If the existing lease
-- is still active, the conditional ON CONFLICT update returns no row and the
-- function raises the stable error consumed by SyncService. If the lease is
-- stale, the same statement replaces it without a cleanup race.
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
