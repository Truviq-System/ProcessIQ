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
  id          bigserial primary key,
  process_id  text references processes(id) on delete cascade,
  version     text,
  bpmn_xml    text,
  file_name   text,
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

-- 5. Enable Row Level Security (optional — remove if not using auth)
-- alter table processes enable row level security;
-- alter table process_versions enable row level security;
-- alter table org_functions enable row level security;
