-- ============================================================
-- OpsHub — Supabase Schema Setup
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type project_status as enum ('on_track', 'at_risk', 'blocked');
create type task_priority as enum ('high', 'medium', 'low');

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  status      project_status not null default 'on_track',
  deadline    date,
  description text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TASKS TABLE
-- ============================================================
create table public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  due_date    date,
  priority    task_priority not null default 'medium',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

-- Projects: users can only see and modify their own
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Tasks: users can only see and modify their own
create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- ============================================================
-- INDEXES (performance)
-- ============================================================
create index on public.projects(user_id);
create index on public.tasks(project_id);
create index on public.tasks(user_id);
