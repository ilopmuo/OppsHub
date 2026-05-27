-- v22: Add sprint_report JSONB to projects

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sprint_report JSONB DEFAULT '{}'::jsonb;
