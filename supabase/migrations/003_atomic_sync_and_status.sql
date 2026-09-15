-- Migration 003: make the user upsert/soft-delete pass AND the sync_run
-- completion a single atomic transaction.
--
-- Previously, SyncService called `sync_users()` (one transaction: upserts +
-- soft-deletes) and then, in a *separate* statement, updated the sync_runs
-- row to SUCCESS. If that second update failed for any reason (network
-- blip, connection drop), the code fell into its catch block and recorded
-- the run as FAILED — even though the user data had already been
-- committed. That leaves an inconsistent operational record: sync_runs
-- says FAILED, but users were actually synchronized.
--
-- complete_sync_run() folds both steps into one PL/pgSQL function, which
-- Postgres runs as a single transaction: if updating sync_runs after the
-- upsert/soft-delete pass fails, the whole function raises and the user
-- changes roll back with it, so "sync_runs says SUCCESS" and "users were
-- updated" can never disagree.

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

  return v_run;
end;
$$;

-- Companion to complete_sync_run(): records a failed run. Kept as its own
-- function (rather than inline in the application) purely for symmetry —
-- there's no multi-step invariant to protect here since it only touches
-- sync_runs, but having both paths go through functions keeps the "how a
-- sync_run is written" logic in one place.
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

  return v_run;
end;
$$;
