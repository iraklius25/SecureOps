-- All new tables for features 2-15
-- Run: psql -U infosec_user -d infosec_db -h localhost -f schema_features_v3.sql

-- Feature 2: Threat Intelligence
CREATE TABLE IF NOT EXISTS threat_intel (
  ip_address       TEXT PRIMARY KEY,
  is_malicious     BOOLEAN DEFAULT FALSE,
  abuse_score      INTEGER DEFAULT 0,
  country_code     TEXT,
  usage_type       TEXT,
  isp              TEXT,
  domain_name      TEXT,
  total_reports    INTEGER DEFAULT 0,
  last_reported_at TIMESTAMPTZ,
  raw_data         JSONB,
  fetched_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Feature 3: Patch Management
CREATE TABLE IF NOT EXISTS patches (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  cve_id       TEXT,
  severity     TEXT DEFAULT 'medium',
  vendor       TEXT,
  product      TEXT,
  patch_url    TEXT,
  release_date DATE,
  description  TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_patches (
  id         SERIAL PRIMARY KEY,
  asset_id   UUID REFERENCES assets(id) ON DELETE CASCADE,
  patch_id   INTEGER REFERENCES patches(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, patch_id)
);

-- Feature 6: Compliance Evidence
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id          SERIAL PRIMARY KEY,
  control_id  UUID REFERENCES compliance_controls(id) ON DELETE CASCADE,
  risk_id     UUID REFERENCES risks(id) ON DELETE SET NULL,
  filename    TEXT NOT NULL,
  mimetype    TEXT,
  file_size   INTEGER,
  file_path   TEXT NOT NULL,
  notes       TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Feature 7: SLA Policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id                SERIAL PRIMARY KEY,
  severity          TEXT NOT NULL UNIQUE,
  days_to_remediate INTEGER NOT NULL DEFAULT 30,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sla_policies (severity, days_to_remediate) VALUES
  ('critical', 3), ('high', 14), ('medium', 30), ('low', 90)
ON CONFLICT (severity) DO NOTHING;

-- Feature 8: Risk Appetite
CREATE TABLE IF NOT EXISTS risk_appetite (
  id                SERIAL PRIMARY KEY,
  max_risk_score    INTEGER DEFAULT 12,
  max_ale           NUMERIC DEFAULT 100000,
  max_open_critical INTEGER DEFAULT 0,
  notes             TEXT DEFAULT '',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO risk_appetite (max_risk_score, max_ale, max_open_critical, notes)
SELECT 12, 100000, 0, 'Default risk appetite'
WHERE NOT EXISTS (SELECT 1 FROM risk_appetite);

-- Feature 10: Vulnerability Approvals
CREATE TABLE IF NOT EXISTS vuln_approvals (
  id            SERIAL PRIMARY KEY,
  vuln_id       UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'pending',
  request_notes TEXT,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- Feature 12: 2FA on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

-- Feature 9: Email + SLA settings
INSERT INTO settings (key, value, description) VALUES
  ('smtp_host',            '',      'SMTP server hostname'),
  ('smtp_port',            '587',   'SMTP port'),
  ('smtp_user',            '',      'SMTP username'),
  ('smtp_password',        '',      'SMTP password'),
  ('smtp_from',            '',      'From address'),
  ('smtp_enabled',         'false', 'Enable email notifications'),
  ('email_on_assign',      'true',  'Email assignee when vuln assigned'),
  ('email_on_critical',    'true',  'Email admins on critical vuln'),
  ('email_on_overdue',     'true',  'Email on SLA breach')
ON CONFLICT (key) DO NOTHING;
