-- =============================================================================
-- schema_suppliers.sql
-- Supplier / vendor register for third-party risk management.
--
-- Safe to re-run: all statements use IF NOT EXISTS.
--
-- Load order: after schema.sql (requires users table).
--             Load before schema_ai_systems.sql (ai_systems references suppliers).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- suppliers
--
-- supplier_type values : vendor | data_provider | infrastructure | saas_ai | consultant
-- risk_rating values   : low | medium | high | critical
-- status values        : active | inactive | under_review
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(300) NOT NULL,
  supplier_type               VARCHAR(50)  NOT NULL DEFAULT 'vendor',
  contact_name                VARCHAR(200),
  contact_email               VARCHAR(200),
  website                     VARCHAR(500),
  country                     VARCHAR(100),
  risk_rating                 VARCHAR(20)  NOT NULL DEFAULT 'medium',
  status                      VARCHAR(20)  NOT NULL DEFAULT 'active',
  contract_start              DATE,
  contract_end                DATE,
  data_processing_agreement   BOOLEAN      NOT NULL DEFAULT FALSE,
  security_questionnaire_done BOOLEAN      NOT NULL DEFAULT FALSE,
  last_assessment_date        DATE,
  next_review_date            DATE,
  services_provided           TEXT,
  data_shared                 TEXT,
  notes                       TEXT,
  created_by                  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Filter suppliers by risk level (primary query path for dashboards)
CREATE INDEX IF NOT EXISTS idx_suppliers_risk
  ON suppliers(risk_rating);

-- Filter by lifecycle status
CREATE INDEX IF NOT EXISTS idx_suppliers_status
  ON suppliers(status);
