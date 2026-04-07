-- Phase 2c multiuser: profiles, project_members, project_invitations

-- Profiles (espejo de auth.users para poder hacer joins)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_upsert" ON profiles FOR ALL USING (auth.uid() = id);

-- Insertar perfiles para usuarios existentes (ejecutar manualmente)
-- INSERT INTO profiles (id, email) SELECT id, email FROM auth.users ON CONFLICT DO NOTHING;

-- Miembros de proyecto
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Función SECURITY DEFINER para evitar recursión en RLS de project_members
CREATE OR REPLACE FUNCTION is_project_member_or_owner(pid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM projects WHERE id = pid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = pid AND user_id = auth.uid());
$$;

CREATE POLICY "pm_select" ON project_members FOR SELECT USING (is_project_member_or_owner(project_id));
CREATE POLICY "pm_insert" ON project_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pm_delete" ON project_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
);

-- Invitaciones por proyecto
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON project_invitations FOR SELECT USING (true);
CREATE POLICY "inv_insert" ON project_invitations FOR INSERT WITH CHECK (is_project_member_or_owner(project_id));
CREATE POLICY "inv_update" ON project_invitations FOR UPDATE USING (true);

-- assignee_id en tasks (UUID → profiles)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES profiles(id);

-- Actualizar RLS de projects: owner O miembro
DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "project_access" ON projects FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM project_members WHERE project_id = id AND user_id = auth.uid())
);

-- Actualizar RLS de tasks
DROP POLICY IF EXISTS "Users can manage their own tasks" ON tasks;
CREATE POLICY "task_access" ON tasks FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM project_members WHERE project_id = tasks.project_id AND user_id = auth.uid())
);

-- Actualizar RLS de milestones
DROP POLICY IF EXISTS "Users can manage their own milestones" ON milestones;
CREATE POLICY "milestone_access" ON milestones FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_id
    AND (p.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
    ))
  )
);

-- Actualizar RLS de task_comments
DROP POLICY IF EXISTS "Users can manage their own comments" ON task_comments;
CREATE POLICY "comment_access" ON task_comments FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_id
    AND (p.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
    ))
  )
);
