-- v20: Status Report — bugs, effort, weekly profitability, and project meta fields

-- ── Extra columns on projects ─────────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_satisfaction INT
  CHECK (customer_satisfaction BETWEEN 1 AND 5);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS opportunities TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS challenges TEXT;

-- ── project_bugs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_bugs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ
);

ALTER TABLE project_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bugs_select" ON project_bugs
  FOR SELECT USING (is_project_member_or_owner(project_id));

CREATE POLICY "bugs_insert" ON project_bugs
  FOR INSERT WITH CHECK (is_project_member_or_owner(project_id));

CREATE POLICY "bugs_update" ON project_bugs
  FOR UPDATE USING (is_project_member_or_owner(project_id));

CREATE POLICY "bugs_delete" ON project_bugs
  FOR DELETE USING (is_project_member_or_owner(project_id));

CREATE INDEX IF NOT EXISTS idx_project_bugs_project ON project_bugs(project_id, created_at);

-- ── project_effort ────────────────────────────────────────────────────────────
-- Stores team effort hours per month (user-entered)
CREATE TABLE IF NOT EXISTS project_effort (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month_year TEXT    NOT NULL,  -- 'YYYY-MM'
  hours      NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE (project_id, month_year)
);

ALTER TABLE project_effort ENABLE ROW LEVEL SECURITY;

CREATE POLICY "effort_select" ON project_effort
  FOR SELECT USING (is_project_member_or_owner(project_id));

CREATE POLICY "effort_insert" ON project_effort
  FOR INSERT WITH CHECK (is_project_member_or_owner(project_id));

CREATE POLICY "effort_update" ON project_effort
  FOR UPDATE USING (is_project_member_or_owner(project_id));

CREATE POLICY "effort_delete" ON project_effort
  FOR DELETE USING (is_project_member_or_owner(project_id));

CREATE INDEX IF NOT EXISTS idx_project_effort_project ON project_effort(project_id, month_year);

-- ── project_weekly_report ─────────────────────────────────────────────────────
-- Weekly financial snapshot for the profitability section
CREATE TABLE IF NOT EXISTS project_weekly_report (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_ending     DATE    NOT NULL,
  total_budget    NUMERIC(14,2),
  to_date_cost    NUMERIC(14,2),
  billed          NUMERIC(14,2),
  effort_to_date  NUMERIC(10,2),
  result_etc      NUMERIC(14,2),
  percent_off     NUMERIC(6,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, week_ending)
);

ALTER TABLE project_weekly_report ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_report_select" ON project_weekly_report
  FOR SELECT USING (is_project_member_or_owner(project_id));

CREATE POLICY "weekly_report_insert" ON project_weekly_report
  FOR INSERT WITH CHECK (is_project_member_or_owner(project_id));

CREATE POLICY "weekly_report_update" ON project_weekly_report
  FOR UPDATE USING (is_project_member_or_owner(project_id));

CREATE POLICY "weekly_report_delete" ON project_weekly_report
  FOR DELETE USING (is_project_member_or_owner(project_id));

CREATE INDEX IF NOT EXISTS idx_weekly_report_project ON project_weekly_report(project_id, week_ending);
