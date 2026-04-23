-- ── schema_fix.sql ─────────────────────────────────────────────
-- Run this to create ALL missing tables in one shot.
-- Safe to run multiple times (all CREATE TABLE IF NOT EXISTS).
-- psql -U infosec_user -d infosec_db -h localhost -f ~/infosec/backend/schema_fix.sql

-- Compliance Controls + Risk Controls (from schema_v2.sql)
CREATE TABLE IF NOT EXISTS compliance_controls (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework   VARCHAR(50) NOT NULL,
    control_id  VARCHAR(50) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(framework, control_id)
);

CREATE TABLE IF NOT EXISTS risk_controls (
    risk_id     UUID REFERENCES risks(id) ON DELETE CASCADE,
    control_id  UUID REFERENCES compliance_controls(id) ON DELETE CASCADE,
    status      VARCHAR(30) DEFAULT 'not_assessed'
                CHECK (status IN ('not_assessed','compliant','partial','non_compliant')),
    notes       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (risk_id, control_id)
);

INSERT INTO compliance_controls (framework, control_id, name, description, category) VALUES
('NIST_CSF','GV.OC-01','Organizational Context','The organizational mission is understood and informs cybersecurity risk management','GOVERN'),
('NIST_CSF','ID.AM-01','IT Asset Inventory','IT hardware assets are inventoried','IDENTIFY'),
('NIST_CSF','ID.AM-02','Software Asset Inventory','Software assets are inventoried','IDENTIFY'),
('NIST_CSF','ID.AM-05','Asset Prioritization','Assets are prioritized based on classification, criticality, and impact','IDENTIFY'),
('NIST_CSF','ID.RA-01','Vulnerability Identification','Vulnerabilities in assets are identified, validated, and recorded','IDENTIFY'),
('NIST_CSF','ID.RA-02','Threat Intelligence','Cyber threat intelligence is received from information sharing forums','IDENTIFY'),
('NIST_CSF','ID.RA-05','Risk Prioritization','Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk','IDENTIFY'),
('NIST_CSF','PR.AA-01','Access Management','Identities and credentials for authorized users are managed by the organization','PROTECT'),
('NIST_CSF','PR.DS-01','Data-at-Rest Protection','The confidentiality, integrity, and availability of data-at-rest are protected','PROTECT'),
('NIST_CSF','PR.IR-01','Network Segmentation','Networks and environments are protected from unauthorized logical access','PROTECT'),
('NIST_CSF','DE.CM-01','Network Monitoring','Networks and network services are monitored to find potentially adverse events','DETECT'),
('NIST_CSF','DE.CM-09','Vulnerability Scanning','Computing hardware and software are monitored to find potentially adverse events','DETECT'),
('NIST_CSF','RS.MA-01','Incident Triage','Incidents are triaged to support analysis and incident handling','RESPOND'),
('NIST_CSF','RC.RP-01','Recovery Planning','The incident recovery plan is executed once initiated by appropriate authority','RECOVER'),
('ISO_27001','A.5.1','Policies for Information Security','Information security policy and topic-specific policies shall be defined','Organization'),
('ISO_27001','A.5.9','Inventory of Information Assets','An inventory of information and other associated assets shall be maintained','Organization'),
('ISO_27001','A.5.30','ICT Readiness for Business Continuity','ICT readiness shall be planned, implemented, monitored and tested','Organization'),
('ISO_27001','A.8.8','Management of Technical Vulnerabilities','Information about technical vulnerabilities shall be obtained in a timely fashion','Technology'),
('ISO_27001','A.8.9','Configuration Management','Security configurations of hardware, software, services and networks shall be established','Technology'),
('ISO_27001','A.8.16','Monitoring Activities','Networks, systems and applications shall be monitored for anomalous behaviour','Technology')
ON CONFLICT (framework, control_id) DO NOTHING;

-- CVE cache (for CVE lookup feature)
CREATE TABLE IF NOT EXISTS cve_cache (
  cve_id     TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gap assessments (for Compliance ISO Gap Assessment tab)
CREATE TABLE IF NOT EXISTS gap_assessments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  data        JSONB NOT NULL DEFAULT '{"sheets":[],"charts":[]}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Threat Intelligence
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

-- Patch Management
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
  asset_id   INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  patch_id   INTEGER REFERENCES patches(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, patch_id)
);

-- Compliance Evidence
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id          SERIAL PRIMARY KEY,
  control_id  INTEGER REFERENCES compliance_controls(id) ON DELETE CASCADE,
  risk_id     INTEGER REFERENCES risks(id) ON DELETE SET NULL,
  filename    TEXT NOT NULL,
  mimetype    TEXT,
  file_size   INTEGER,
  file_path   TEXT NOT NULL,
  notes       TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id                SERIAL PRIMARY KEY,
  severity          TEXT NOT NULL UNIQUE,
  days_to_remediate INTEGER NOT NULL DEFAULT 30,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sla_policies (severity, days_to_remediate) VALUES
  ('critical', 3), ('high', 14), ('medium', 30), ('low', 90)
ON CONFLICT (severity) DO NOTHING;

-- Risk Appetite
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

-- Vulnerability Approvals
CREATE TABLE IF NOT EXISTS vuln_approvals (
  id            SERIAL PRIMARY KEY,
  vuln_id       INTEGER REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'pending',
  request_notes TEXT,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- 2FA columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

-- Notification / Webhook settings (from schema_v2.sql)
INSERT INTO settings (key, value, description) VALUES
  ('slack_webhook_url',       '', 'Slack incoming webhook URL for notifications'),
  ('teams_webhook_url',       '', 'Microsoft Teams incoming webhook URL'),
  ('notify_on_critical',      'true', 'Notify when critical vulnerabilities are found'),
  ('notify_on_high',          'true', 'Notify when high vulnerabilities are found'),
  ('notify_on_scan_complete', 'true', 'Notify when a scan completes')
ON CONFLICT (key) DO NOTHING;

-- Email / SMTP settings
INSERT INTO settings (key, value, description) VALUES
  ('smtp_host',         '',      'SMTP server hostname'),
  ('smtp_port',         '587',   'SMTP port'),
  ('smtp_user',         '',      'SMTP username'),
  ('smtp_password',     '',      'SMTP password'),
  ('smtp_from',         '',      'From address'),
  ('smtp_enabled',      'false', 'Enable email notifications'),
  ('email_on_assign',   'true',  'Email assignee when vuln assigned'),
  ('email_on_critical', 'true',  'Email admins on critical vuln'),
  ('email_on_overdue',  'true',  'Email on SLA breach')
ON CONFLICT (key) DO NOTHING;

-- Threat Intelligence API keys
INSERT INTO settings (key, value, description) VALUES
  ('abuseipdb_api_key', '', 'AbuseIPDB API key for IP reputation lookups'),
  ('nvd_api_key',       '', 'NVD API key for faster CVE lookups (optional)')
ON CONFLICT (key) DO NOTHING;
