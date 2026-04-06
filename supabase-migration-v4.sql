-- OpsHub — Migration v4: task status (todo / in_progress / done)
-- Replaces the boolean `done` column with a proper status enum

-- 1. Add status column
alter table public.tasks
  add column if not exists status text not null default 'todo'
  check (status in ('todo', 'in_progress', 'done'));

-- 2. Migrate existing data
update public.tasks set status = 'done' where done = true;
update public.tasks set status = 'todo' where done = false;

-- 3. The `done` column is kept for backwards compat but no longer used by the app
