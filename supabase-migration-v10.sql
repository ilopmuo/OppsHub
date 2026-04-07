-- Fix 1: project_access policy had an EXISTS subquery on project_members that went
-- through project_members' own RLS, causing newly joined members to fail access.
-- Replace with is_project_member_or_owner() (SECURITY DEFINER) which bypasses RLS.

DROP POLICY IF EXISTS "project_access" ON projects;
CREATE POLICY "project_access" ON projects FOR ALL USING (
  is_project_member_or_owner(id)
);

-- Same fix for tasks and milestones for consistency
DROP POLICY IF EXISTS "task_access" ON tasks;
CREATE POLICY "task_access" ON tasks FOR ALL USING (
  is_project_member_or_owner(project_id)
);

DROP POLICY IF EXISTS "milestone_access" ON milestones;
CREATE POLICY "milestone_access" ON milestones FOR ALL USING (
  is_project_member_or_owner(project_id)
);

-- Fix 2: allow reading project basic info (name) on the /join page
-- before the invited user has accepted (they're not a member yet).
DROP POLICY IF EXISTS "project_select_via_invitation" ON projects;
CREATE POLICY "project_select_via_invitation" ON projects
FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_invitations WHERE project_id = id)
);
