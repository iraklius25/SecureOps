-- =============================================================================
-- schema_platform_v2.sql
-- Platform v2 schema additions: document approval workflow, version tracking,
-- nonconformity (NC) fields on tasks, management review agenda checklist,
-- and EU AI Act tier on risks.
--
-- Safe to re-run: all statements use IF NOT EXISTS or are idempotent.
--
-- Load order:
--   1. schema.sql
--   2. schema_grc.sql        (grc_documents, grc_tasks, grc_reviews must exist)
--   3. schema_platform_v2.sql
--   4. schema_ai_systems.sql (adds risks.ai_system_id FK after ai_systems exists)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- grc_documents: document approval workflow + version tracking
-- -----------------------------------------------------------------------------
ALTER TABLE grc_documents
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE grc_documents
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

ALTER TABLE grc_documents
  ADD COLUMN IF NOT EXISTS current_version  INTEGER NOT NULL DEFAULT 1;

-- -----------------------------------------------------------------------------
-- grc_document_versions: full version history for every document
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grc_document_versions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID         NOT NULL REFERENCES grc_documents(id) ON DELETE CASCADE,
  version_num   INTEGER      NOT NULL,
  doc_version   VARCHAR(20),
  original_name VARCHAR(500),
  stored_name   VARCHAR(500),
  mimetype      VARCHAR(100),
  file_size     BIGINT,
  status        VARCHAR(50),
  uploaded_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc
  ON grc_document_versions(document_id);

-- -----------------------------------------------------------------------------
-- grc_tasks: nonconformity (NC) and corrective-action fields
--
-- nc_type values : action | major_nc | minor_nc | observation
-- source values  : manual | audit | incident | management_review
-- -----------------------------------------------------------------------------
ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS nc_type              VARCHAR(20) DEFAULT 'action';

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS source               VARCHAR(50) DEFAULT 'manual';

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS root_cause           TEXT;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS containment_action   TEXT;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS corrective_action    TEXT;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS verification_evidence TEXT;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS verification_date    DATE;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS verified_by          UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE grc_tasks
  ADD COLUMN IF NOT EXISTS recurrence_check_date DATE;

-- -----------------------------------------------------------------------------
-- grc_reviews: mandatory agenda checklist (ISO 42001 Clause 9.3 — 8 items)
-- Stored as a JSONB object keyed by agenda item identifier.
-- -----------------------------------------------------------------------------
ALTER TABLE grc_reviews
  ADD COLUMN IF NOT EXISTS agenda_checklist JSONB NOT NULL DEFAULT '{}';

-- -----------------------------------------------------------------------------
-- risks: EU AI Act risk tier
--
-- eu_ai_act_tier values: unacceptable | high | limited | minimal
--
-- NOTE: risks.ai_system_id FK is intentionally omitted here.
--       It is added in schema_ai_systems.sql AFTER the ai_systems table
--       has been created, to avoid forward-reference errors.
-- -----------------------------------------------------------------------------
ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS eu_ai_act_tier VARCHAR(20);
