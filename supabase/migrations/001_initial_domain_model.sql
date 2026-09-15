-- Migration 001: initial domain model.
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
