-- Fix project_activity.user_id FK to reference profiles instead of auth.users
-- so PostgREST can join profile data (email, display_name, avatar_url) directly.

ALTER TABLE project_activity DROP CONSTRAINT IF EXISTS project_activity_user_id_fkey;

ALTER TABLE project_activity
  ADD CONSTRAINT project_activity_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
