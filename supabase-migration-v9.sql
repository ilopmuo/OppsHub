-- Phase 3: activity log + notifications
-- (backlog uses 'backlog' as a new text status value, no migration needed)

CREATE TABLE IF NOT EXISTS project_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON project_activity FOR SELECT USING (is_project_member_or_owner(project_id));
CREATE POLICY "activity_insert" ON project_activity FOR INSERT WITH CHECK (is_project_member_or_owner(project_id));

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_access" ON notifications FOR ALL USING (user_id = auth.uid());
