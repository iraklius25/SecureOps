-- =============================================================================
-- schema_budget.sql
-- IT Budget & License management.
-- Load order: after schema_certifications.sql (requires cert_organizations).
-- =============================================================================

CREATE TABLE IF NOT EXISTS budget_items (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID         REFERENCES cert_organizations(id) ON DELETE SET NULL,
  name                VARCHAR(300) NOT NULL,
  description         TEXT,
  category            VARCHAR(50)  NOT NULL DEFAULT 'other'
                        CHECK (category IN ('software','hardware','service','license','subscription','other')),
  amount              NUMERIC(14,2),
  currency            VARCHAR(10)  NOT NULL DEFAULT 'USD',
  status              VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','expired','cancelled','pending')),
  license_expiry_date DATE,
  warn_days_before    INTEGER      NOT NULL DEFAULT 30,
  is_important        BOOLEAN      NOT NULL DEFAULT FALSE,
  notify_smtp         BOOLEAN      NOT NULL DEFAULT FALSE,
  notify_webhook      BOOLEAN      NOT NULL DEFAULT FALSE,
  notes               TEXT,
  created_by          UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_org    ON budget_items(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_expiry ON budget_items(license_expiry_date);
CREATE INDEX IF NOT EXISTS idx_budget_status ON budget_items(status);

CREATE TABLE IF NOT EXISTS budget_files (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id  UUID  NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  original_name   TEXT  NOT NULL,
  stored_name     TEXT  NOT NULL,
  mimetype        TEXT,
  file_size       INTEGER,
  uploaded_by     UUID  REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_files_item ON budget_files(budget_item_id);
