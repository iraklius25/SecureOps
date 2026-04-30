-- Force password change flag
-- Run: psql -U infosec_user -d infosec_db -h localhost -f backend/schema_force_password.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- Mark existing seeded admin as requiring a password change if still using default
UPDATE users SET force_password_change = TRUE
WHERE username = 'admin' AND force_password_change IS DISTINCT FROM TRUE;
