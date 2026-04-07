-- Phase 2c: assignee on tasks + task comments table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own comments" ON task_comments
  FOR ALL USING (auth.uid() = user_id);
