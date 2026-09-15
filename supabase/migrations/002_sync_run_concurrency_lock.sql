-- Migration 002: database-level concurrency lock for sync runs.
--
-- The application previously guarded against overlapping syncs for the same
-- customer with an in-process `Set<string>` (SyncService.runningCustomers).
-- That only protects a single Node process; with more than one instance (or
-- more than one deployment) two overlapping syncs for the same customer
-- could run at once, each fetching a different snapshot and racing to write
-- it. A partial unique index makes "at most one RUNNING sync_run per
-- customer" a database-enforced invariant instead of an in-memory one:
-- inserting a second RUNNING row for a customer that already has one fails
-- with a unique-violation, which the application maps to the existing
-- SyncInProgressError.
--
-- lease_expires_at bounds how long a RUNNING row is honored as "in
-- progress": if the process that created it dies mid-sync, the row would
-- otherwise stay RUNNING forever and permanently lock that customer out of
-- new syncs. The partial index only counts rows whose lease hasn't expired,
-- so a stale RUNNING row (past its lease) no longer blocks a new sync.

alter table sync_runs
  add column if not exists lease_expires_at timestamptz(3);

drop index if exists sync_runs_one_running_per_customer;
create unique index sync_runs_one_running_per_customer
  on sync_runs (customer_id)
  where status = 'RUNNING' and lease_expires_at > now();

-- Starts a sync run, enforcing the lock atomically via the unique index
-- above: if a non-expired RUNNING row already exists for this customer,
-- the insert raises unique_violation, which the caller catches and reports
-- as "sync already in progress" rather than starting a second one.
create or replace function start_sync_run(p_customer_id uuid, p_lease_seconds integer default 1800)
returns sync_runs
language plpgsql
as $$
declare
  v_run sync_runs;
begin
  insert into sync_runs (customer_id, status, lease_expires_at)
  values (p_customer_id, 'RUNNING', now() + make_interval(secs => p_lease_seconds))
  returning * into v_run;

  return v_run;
exception
  when unique_violation then
    raise exception 'sync_already_running' using errcode = 'P0001';
end;
$$;
