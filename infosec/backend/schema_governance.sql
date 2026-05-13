-- Governance schema: ISSC + Risk Appetite/Tolerance extensions
-- Run: psql -U infosec_user -d infosec_db -h localhost -f schema_governance.sql

-- ── Extend risk_appetite with tolerance + governance fields ──────────────────
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS tolerance_score       INTEGER  DEFAULT 15;
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS tolerance_ale         NUMERIC  DEFAULT 250000;
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS appetite_statement    TEXT     DEFAULT '';
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS tolerance_statement   TEXT     DEFAULT '';
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS approved_by           VARCHAR(200) DEFAULT '';
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS approval_date         DATE;
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS review_frequency      VARCHAR(50)  DEFAULT 'annually';
ALTER TABLE risk_appetite ADD COLUMN IF NOT EXISTS category_appetites    JSONB    DEFAULT '{}';

-- ── Information Security Steering Committee — Members ───────────────────────
CREATE TABLE IF NOT EXISTS issc_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    VARCHAR(200) NOT NULL,
  title        VARCHAR(200),
  department   VARCHAR(100),
  email        VARCHAR(255),
  role         VARCHAR(100) DEFAULT 'Member'
                  CHECK (role IN ('Chair','Vice Chair','Secretary','Member','Advisor','Observer')),
  is_active    BOOLEAN      DEFAULT TRUE,
  joined_date  DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Information Security Steering Committee — Meetings ──────────────────────
CREATE TABLE IF NOT EXISTS issc_meetings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(300) NOT NULL,
  meeting_date      DATE         NOT NULL,
  meeting_type      VARCHAR(50)  DEFAULT 'regular'
                       CHECK (meeting_type IN ('regular','extraordinary','annual','emergency')),
  status            VARCHAR(30)  DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','completed','cancelled')),
  location          VARCHAR(200),
  chair             VARCHAR(200),
  quorum_met        BOOLEAN,
  attendees         TEXT,
  agenda            TEXT,
  minutes           TEXT,
  decisions         TEXT,
  action_items      TEXT,
  next_meeting_date DATE,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issc_meetings_date ON issc_meetings (meeting_date DESC);
