-- Schema for customer-user-sync on Supabase (plain Postgres).
-- Run this once against your Supabase project's database, e.g.:
--   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
-- or paste it into the Supabase SQL Editor.
--
-- Tables use snake_case (Postgres/Supabase convention). The application
-- layer maps rows to camelCase domain types itself (see src/domain/types.ts).

create extension if not exists pgcrypto;

do $$ begin
  create type sync_run_status as enum ('RUNNING', 'SUCCESS', 'FAILED');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type user_status as enum ('active', 'invited', 'suspended');
exception
  when duplicate_object then null;
end $$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_base_url text not null,
  created_at timestamptz(3) not null default now(),
  updated_at timestamptz(3) not null default now(),

  constraint customers_name_key unique (name)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict on update cascade,
  external_user_id text not null,
  name text not null,
  email text not null,
  phone text,
  status user_status not null default 'active',
  company_name text,
  company_industry text,
  company_role text,
  company_website text,
  company_employees integer,
  external_created_at timestamptz(3) not null,
  external_updated_at timestamptz(3) not null,
  created_at timestamptz(3) not null default now(),
  updated_at timestamptz(3) not null default now(),
  deleted_at timestamptz(3),

  constraint users_customer_id_external_user_id_key unique (customer_id, external_user_id)
);

create index if not exists users_customer_id_company_name_idx on users (customer_id, company_name);
create index if not exists users_customer_id_updated_at_idx on users (customer_id, updated_at);
create index if not exists users_customer_id_deleted_at_idx on users (customer_id, deleted_at);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict on update cascade,
  status sync_run_status not null default 'RUNNING',
  started_at timestamptz(3) not null default now(),
  completed_at timestamptz(3),
  records_fetched integer,
  records_created integer,
  records_updated integer,
  records_deleted integer,
  error_code text,
  error_message text
);

create index if not exists sync_runs_customer_id_started_at_idx on sync_runs (customer_id, started_at);
create index if not exists sync_runs_customer_id_status_idx on sync_runs (customer_id, status);

-- Keeps updated_at current on every UPDATE, mirroring Prisma's @updatedAt.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Applies one synchronization fetch atomically: upserts every fetched user
-- (by customer_id + external_user_id), then soft-deletes any previously
-- active user absent from this fetch. Mirrors the transaction that used to
-- live in SyncService via Prisma's `$transaction`, since the Supabase JS
-- client has no client-side multi-statement transaction API.
--
-- p_users is a JSON array of objects shaped like:
--   { "externalUserId", "name", "email", "phone", "status",
--     "companyName", "companyIndustry", "companyRole", "companyWebsite",
--     "companyEmployees", "externalCreatedAt", "externalUpdatedAt" }
create or replace function sync_users(p_customer_id uuid, p_users jsonb)
returns table (created integer, updated integer, deleted integer)
language plpgsql
as $$
declare
  v_created integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
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
