ALTER TABLE issc_meetings ADD COLUMN IF NOT EXISTS member_ids JSONB DEFAULT '[]'::jsonb;
