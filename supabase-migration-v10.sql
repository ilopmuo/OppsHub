-- Fix: allow reading project basic info when a valid invitation exists
-- The existing project_access policy (FOR ALL) blocks non-members from any SELECT.
-- Adding a separate SELECT policy so projects with invitations are readable by anyone
-- visiting the invite link (so the project name shows on the /join page).
-- Postgres RLS ORs multiple policies on the same table+command.

CREATE POLICY "project_select_via_invitation" ON projects
FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_invitations WHERE project_id = id)
);
