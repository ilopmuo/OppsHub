-- Migration v16: Add is_sprint flag to plan_phases
-- Sprint-marked phases cannot be overlapped: if a preceding phase extends past
-- their start date, they automatically shift to start the day after it ends.
ALTER TABLE plan_phases
ADD COLUMN IF NOT EXISTS is_sprint BOOLEAN DEFAULT false;
