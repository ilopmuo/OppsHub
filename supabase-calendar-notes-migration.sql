-- Personal calendar notes (independent of projects)
CREATE TABLE IF NOT EXISTS calendar_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  priority   TEXT NOT NULL DEFAULT 'low',
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the column:
ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'low';

CREATE INDEX IF NOT EXISTS calendar_notes_user_date ON calendar_notes (user_id, date);

ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_calendar_notes" ON calendar_notes FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
