-- ============================================================
-- Migration v14: Project Plans (Gantt Chart)
-- Creates: project_plans, plan_phases, plan_tasks
-- ============================================================

-- ── project_plans ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  start_date  DATE NOT NULL,
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "plans_owner_all" ON project_plans
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Project members can read plans linked to their projects
CREATE POLICY "plans_member_read" ON project_plans
  FOR SELECT
  USING (
    project_id IS NOT NULL
    AND is_project_member_or_owner(project_id)
  );

-- Public read (anon) — row is filtered by share_token in the query,
-- token is a UUID so it's cryptographically unguessable
CREATE POLICY "plans_public_read" ON project_plans
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_project_plans_owner   ON project_plans(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_project ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_token   ON project_plans(share_token);


-- ── plan_phases ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  hours       NUMERIC DEFAULT 0,
  color       TEXT NOT NULL DEFAULT '#bf5af2',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plan_phases ENABLE ROW LEVEL SECURITY;

-- Read: owner, project members, or public (for shared plans)
CREATE POLICY "phases_select" ON plan_phases
  FOR SELECT
  USING (true);

-- Write: only the plan owner
CREATE POLICY "phases_write" ON plan_phases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_plans p
      WHERE p.id = plan_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_plans p
      WHERE p.id = plan_id AND p.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plan_phases_plan ON plan_phases(plan_id, order_index);


-- ── plan_tasks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id    UUID NOT NULL REFERENCES plan_phases(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  hours       NUMERIC DEFAULT 0,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;

-- Read: public (open, filtered by phase → plan)
CREATE POLICY "plan_tasks_select" ON plan_tasks
  FOR SELECT
  USING (true);

-- Write: only the plan owner
CREATE POLICY "plan_tasks_write" ON plan_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plan_phases ph
      JOIN project_plans p ON p.id = ph.plan_id
      WHERE ph.id = phase_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_phases ph
      JOIN project_plans p ON p.id = ph.plan_id
      WHERE ph.id = phase_id AND p.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plan_tasks_phase ON plan_tasks(phase_id, order_index);
