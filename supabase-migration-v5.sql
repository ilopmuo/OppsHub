-- Phase 2a: Add description to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
