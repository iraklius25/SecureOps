-- ISO Gap Assessment table
-- Run: psql -U infosec_user -d infosec_db -h localhost -f schema_gap_assessment.sql

CREATE TABLE IF NOT EXISTS gap_assessments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  data        JSONB NOT NULL DEFAULT '{"sheets":[],"charts":[]}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
