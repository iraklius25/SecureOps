-- Add meeting time and duration to ISSC meetings for proper calendar invites
ALTER TABLE issc_meetings ADD COLUMN IF NOT EXISTS meeting_time      TIME;
ALTER TABLE issc_meetings ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER DEFAULT 60;
