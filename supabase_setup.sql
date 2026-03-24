-- Run this in Supabase Dashboard → SQL Editor

-- 1. Processes table
create table if not exists processes (
  id            text primary key,
  process_name  text not null,
  process_names jsonb default '[]',
  org           text,
  function      jsonb default '[]',
  level         text,
  sub_processes jsonb default '[]',
  version       text default '1.0',
  bpmn_xml      text default '',
  file_name     text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. Process versions (archived diagrams)
create table if not exists process_versions (
  id           bigserial primary key,
  process_id   text references processes(id) on delete cascade,
  version      text,
  bpmn_xml     text,
  file_name    text,
  change_notes text,
  archived_at  timestamptz default now()
);

-- 3. Organization functions (org → function mapping)
create table if not exists org_functions (
  id            bigserial primary key,
  org           text not null,
  function_name text not null,
  sub_processes jsonb default '[]',
  process_names jsonb default '[]',
  unique (org, function_name)
);

-- 4. Auto-update updated_at on processes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on processes;
create trigger set_updated_at
  before update on processes
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. App Users (authorization + role management)
--    Roles:
--      process_analyst      → read, add, edit (changes require Process Owner approval)
--      process_owner        → read, add, edit, delete, approve analyst changes
--      system_administrator → full access including user & org management
--    A user can hold multiple roles simultaneously (roles is a text array).
-- ─────────────────────────────────────────────────────────────────────────────

-- Migration: handle both fresh install and upgrade from v1 (role text → roles text[])
do $$
begin
  -- Fresh install: table does not exist yet
  if not exists (select 1 from information_schema.tables where table_name = 'app_users') then
    create table app_users (
      id         uuid primary key default gen_random_uuid(),
      email      text unique not null,
      name       text,
      roles      text[] not null default ARRAY['process_analyst'],
      is_active  boolean not null default true,
      created_at timestamptz default now()
    );

  -- Upgrade from v1: table exists but has old singular "role" column
  elsif exists (
    select 1 from information_schema.columns
    where table_name = 'app_users' and column_name = 'role'
  ) then
    -- Add new columns
    alter table app_users
      add column if not exists roles     text[] not null default ARRAY['process_analyst'],
      add column if not exists is_active boolean not null default true;

    -- Migrate existing role values into the new array column
    update app_users
    set roles = ARRAY[
      case role
        when 'admin'   then 'system_administrator'
        when 'editor'  then 'process_owner'
        when 'viewer'  then 'process_analyst'
        else role
      end
    ]
    where role is not null;

    -- Drop the old column
    alter table app_users drop column role;

  -- v2 already installed — ensure is_active exists (idempotent)
  else
    alter table app_users
      add column if not exists is_active boolean not null default true;
  end if;
end
$$;

-- Add/refresh the roles validity constraint
alter table app_users
  drop constraint if exists app_users_roles_check;
alter table app_users
  add constraint app_users_roles_check
  check (
    roles <@ ARRAY['process_analyst','process_owner','system_administrator']::text[]
    and array_length(roles, 1) >= 1
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Process Change Requests (approval workflow)
--    When a Process Analyst creates or edits a process the change is stored
--    here as "pending". A Process Owner or System Administrator then approves
--    (which applies the change) or rejects it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists process_change_requests (
  id              bigserial primary key,
  process_id      text references processes(id) on delete cascade,
  requested_by    uuid not null,
  requester_email text not null,
  change_type     text not null check (change_type in ('create', 'update', 'bpmn')),
  change_data     jsonb not null,
  change_notes    text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by     uuid,
  reviewer_email  text,
  review_notes    text,
  created_at      timestamptz default now(),
  reviewed_at     timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table processes              enable row level security;
alter table process_versions       enable row level security;
alter table org_functions          enable row level security;
alter table app_users              enable row level security;
alter table process_change_requests enable row level security;

-- Drop existing policies before recreating
drop policy if exists "auth read processes"       on processes;
drop policy if exists "auth write processes"      on processes;
drop policy if exists "auth read versions"        on process_versions;
drop policy if exists "auth write versions"       on process_versions;
drop policy if exists "auth read orgs"            on org_functions;
drop policy if exists "auth write orgs"           on org_functions;
drop policy if exists "auth read app_users"       on app_users;
drop policy if exists "auth write app_users"      on app_users;
drop policy if exists "auth read change_requests" on process_change_requests;
drop policy if exists "auth write change_requests" on process_change_requests;

-- Authenticated users can read/write all core tables (app enforces role checks)
create policy "auth read processes"  on processes  for select using (auth.role() = 'authenticated');
create policy "auth write processes" on processes  for all    using (auth.role() = 'authenticated');

create policy "auth read versions"   on process_versions for select using (auth.role() = 'authenticated');
create policy "auth write versions"  on process_versions for all    using (auth.role() = 'authenticated');

create policy "auth read orgs"       on org_functions for select using (auth.role() = 'authenticated');
create policy "auth write orgs"      on org_functions for all    using (auth.role() = 'authenticated');

create policy "auth read app_users"  on app_users for select using (auth.role() = 'authenticated');
create policy "auth write app_users" on app_users for all    using (auth.role() = 'authenticated');

create policy "auth read change_requests"  on process_change_requests for select using (auth.role() = 'authenticated');
create policy "auth write change_requests" on process_change_requests for all    using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Seed: insert your first System Administrator
--    Replace with actual email. The user must also exist in Supabase Auth
--    (Authentication → Users → Add user / Invite).
-- ─────────────────────────────────────────────────────────────────────────────
-- insert into app_users (email, name, roles) values
--   ('admin@yourcompany.com', 'System Administrator', ARRAY['system_administrator']);
