-- v19: milestones, phase descriptions, and dependencies

-- is_milestone: renders as a diamond in the Gantt instead of a bar
ALTER TABLE plan_phases ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false;

-- description: free-text notes visible in the sidebar
ALTER TABLE plan_phases ADD COLUMN IF NOT EXISTS description TEXT;

-- depends_on: soft FK to another phase in the same plan.
-- ON DELETE SET NULL so deleting a phase doesn't break dependents.
ALTER TABLE plan_phases ADD COLUMN IF NOT EXISTS depends_on UUID
  REFERENCES plan_phases(id) ON DELETE SET NULL;
