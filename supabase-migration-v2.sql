-- ============================================================
-- OpsHub — Migration v2: Project types + Milestones
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add type column to projects
alter table public.projects
  add column if not exists type text not null default 'implementation'
  check (type in ('implementation', 'maintenance'));

-- 2. Add maintenance-specific columns
alter table public.projects
  add column if not exists renewal_date date,
  add column if not exists sla_status text check (sla_status in ('ok', 'at_risk', 'breach')),
  add column if not exists open_tickets integer,
  add column if not exists last_contact date;

-- 3. Create milestones table
create table if not exists public.milestones (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 4. RLS for milestones
alter table public.milestones enable row level security;

create policy "Users can view own milestones"
  on public.milestones for select using (auth.uid() = user_id);

create policy "Users can insert own milestones"
  on public.milestones for insert with check (auth.uid() = user_id);

create policy "Users can update own milestones"
  on public.milestones for update using (auth.uid() = user_id);

create policy "Users can delete own milestones"
  on public.milestones for delete using (auth.uid() = user_id);

-- 5. Indexes
create index if not exists milestones_project_id_idx on public.milestones(project_id);
create index if not exists milestones_user_id_idx on public.milestones(user_id);
