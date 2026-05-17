CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS maturity_assessments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  framework   VARCHAR(20) NOT NULL CHECK (framework IN ('ISMS', 'ISO42001', 'NISTCSF', 'PCIDSS', 'SOC2', 'ISO22301', 'GDPR')),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  data        JSONB NOT NULL DEFAULT '{"domains":{}}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maturity_documents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id  UUID NOT NULL REFERENCES maturity_assessments(id) ON DELETE CASCADE,
  original_name  TEXT NOT NULL,
  stored_name    TEXT NOT NULL,
  mimetype       TEXT,
  file_size      INTEGER,
  uploaded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
