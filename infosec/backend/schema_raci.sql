-- RACI Matrix Schema — run after schema_grc.sql
-- psql -U infosec_user -d infosec_db -h localhost -f backend/schema_raci.sql

CREATE TABLE IF NOT EXISTS grc_raci_matrices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(300) NOT NULL,
  description TEXT,
  program_id  UUID REFERENCES grc_programs(id) ON DELETE SET NULL,
  framework   VARCHAR(50),
  roles       JSONB NOT NULL DEFAULT '[]',
  processes   JSONB NOT NULL DEFAULT '[]',
  cells       JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grc_raci_program ON grc_raci_matrices(program_id);
