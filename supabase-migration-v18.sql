-- v18: plan baselines (snapshots)
-- plan_snapshots stores a named snapshot of a plan at a point in time.
-- plan_snapshot_phases stores the phase dates at the time of the snapshot.
-- phase_id is a soft reference — no FK constraint so phases can be deleted
-- after the snapshot without losing the historical record.

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID        NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_snapshot_phases (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID    NOT NULL REFERENCES plan_snapshots(id) ON DELETE CASCADE,
  phase_id    UUID    NOT NULL,
  phase_name  TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT '#bf5af2',
  start_date  DATE    NOT NULL,
  end_date    DATE    NOT NULL,
  hours       NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_plan_id
  ON plan_snapshots(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_snapshot_phases_snapshot_id
  ON plan_snapshot_phases(snapshot_id);
