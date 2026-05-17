-- schema_reviews_v2.sql
-- Extend grc_reviews with new fields (org, framework, location, scope, findings, etc.)
-- and broaden framework + review_type constraints.
-- Load order: after schema_grc.sql and schema_certifications.sql.

-- ── New columns on grc_reviews ────────────────────────────────────────────────
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS agenda_checklist   JSONB        NOT NULL DEFAULT '{}';
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS org_id             UUID         REFERENCES cert_organizations(id) ON DELETE SET NULL;
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS framework          VARCHAR(50);
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS location           VARCHAR(200);
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS duration_minutes   INTEGER;
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS next_review_date   DATE;
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS scope              TEXT;
ALTER TABLE grc_reviews ADD COLUMN IF NOT EXISTS findings           TEXT;

CREATE INDEX IF NOT EXISTS idx_grc_reviews_org ON grc_reviews(org_id);

-- ── Extend review_type check (add third_party_audit, self_assessment, tabletop_exercise) ──
ALTER TABLE grc_reviews DROP CONSTRAINT IF EXISTS grc_reviews_review_type_check;
ALTER TABLE grc_reviews ADD CONSTRAINT grc_reviews_review_type_check
  CHECK (review_type IN (
    'management_review','internal_audit','external_audit','surveillance',
    'third_party_audit','self_assessment','tabletop_exercise'
  ));

-- ── Extend grc_programs framework check to include ISO22301 and others ────────
ALTER TABLE grc_programs DROP CONSTRAINT IF EXISTS grc_programs_framework_check;
ALTER TABLE grc_programs ADD CONSTRAINT grc_programs_framework_check
  CHECK (framework IN (
    'ISO27001','NISTCSF','ISO42001','PCIDSS','SOC2','HIPAA','GDPR','ISO22301','CUSTOM'
  ));
