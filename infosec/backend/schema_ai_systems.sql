-- =============================================================================
-- schema_ai_systems.sql
-- AI system register (ISO 42001 / EU AI Act compliance).
--
-- Safe to re-run: all statements use IF NOT EXISTS.
--
-- Load order:
--   1. schema.sql              (users, risks tables)
--   2. schema_suppliers.sql    (suppliers table — referenced by ai_systems.supplier_id)
--   3. schema_platform_v2.sql  (adds risks.eu_ai_act_tier)
--   4. schema_ai_systems.sql   (creates ai_systems, then adds risks.ai_system_id FK)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ai_systems
--
-- ai_type values         : generative_ai | ml_predictive | nlp | computer_vision |
--                          rpa_ai | analytics | other
-- decision_role values   : advisory | automated | augmented
-- eu_ai_act_tier values  : unacceptable | high | limited | minimal
-- deployment_status vals : planned | in_use | retired | suspended
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_systems (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(300) NOT NULL,
  version             VARCHAR(50),
  ai_type             VARCHAR(50)  NOT NULL DEFAULT 'ml_predictive',
  vendor              VARCHAR(200),
  supplier_id         UUID         REFERENCES suppliers(id) ON DELETE SET NULL,
  business_purpose    TEXT,
  decision_role       VARCHAR(50)  DEFAULT 'advisory',
  uses_personal_data  BOOLEAN      NOT NULL DEFAULT FALSE,
  eu_ai_act_tier      VARCHAR(20)  NOT NULL DEFAULT 'minimal',
  deployment_status   VARCHAR(30)  NOT NULL DEFAULT 'in_use',
  owner               VARCHAR(200),
  owner_user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  deployed_date       DATE,
  last_review_date    DATE,
  next_review_date    DATE,
  impact_assessed     BOOLEAN      NOT NULL DEFAULT FALSE,
  impact_assessed_at  TIMESTAMPTZ,
  impact_assessed_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  notes               TEXT,
  created_by          UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Filter by EU AI Act classification tier
CREATE INDEX IF NOT EXISTS idx_ai_systems_tier
  ON ai_systems(eu_ai_act_tier);

-- Filter by lifecycle status
CREATE INDEX IF NOT EXISTS idx_ai_systems_status
  ON ai_systems(deployment_status);

-- -----------------------------------------------------------------------------
-- risks.ai_system_id FK
--
-- Added here (after ai_systems is created) to avoid forward-reference errors.
-- The eu_ai_act_tier column on risks is added in schema_platform_v2.sql.
-- -----------------------------------------------------------------------------
ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS ai_system_id UUID REFERENCES ai_systems(id) ON DELETE SET NULL;
