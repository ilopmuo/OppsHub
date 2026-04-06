-- OpsHub — Migration v3: Add start_date to projects
alter table public.projects
  add column if not exists start_date date;
