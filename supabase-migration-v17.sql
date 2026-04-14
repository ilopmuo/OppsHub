-- v17: phase progress (0-100) and status (on_track / at_risk / delayed)
ALTER TABLE plan_phases
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status   TEXT    DEFAULT 'on_track';
