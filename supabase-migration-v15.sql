-- Migration v15: Add hours_per_day to plan_phases for automatic date calculation
-- hours_per_day: how many hours are worked per day in this phase (used to auto-calculate end_date)
ALTER TABLE plan_phases
ADD COLUMN IF NOT EXISTS hours_per_day NUMERIC DEFAULT 8;
