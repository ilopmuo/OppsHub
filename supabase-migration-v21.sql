-- v21: Add go_live_date to projects

ALTER TABLE projects ADD COLUMN IF NOT EXISTS go_live_date DATE;
