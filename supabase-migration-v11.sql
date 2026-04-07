-- Project notification settings per user per project

CREATE TABLE IF NOT EXISTS project_notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  enabled boolean DEFAULT true,
  notify_task_assigned boolean DEFAULT true,
  notify_task_completed boolean DEFAULT true,
  notify_deadline_soon boolean DEFAULT true,
  notify_member_joined boolean DEFAULT true,
  notify_status_changed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE project_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notification_settings" ON project_notification_settings
  FOR ALL USING (auth.uid() = user_id);
