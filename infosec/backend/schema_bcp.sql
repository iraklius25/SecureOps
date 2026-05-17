CREATE TABLE IF NOT EXISTS bcp_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES cert_organizations(id) ON DELETE SET NULL,
  name             VARCHAR(300) NOT NULL,
  version          VARCHAR(50)  NOT NULL DEFAULT '1.0',
  scope            TEXT,
  objectives       TEXT,
  status           VARCHAR(50)  NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','review','approved','active','retired')),
  classification   VARCHAR(50)  NOT NULL DEFAULT 'confidential'
                     CHECK (classification IN ('public','internal','confidential','restricted')),
  owner            VARCHAR(200),
  approved_by      VARCHAR(200),
  approved_date    DATE,
  review_date      DATE,
  next_test_date   DATE,
  last_tested      DATE,
  test_result      VARCHAR(20)  CHECK (test_result IN ('passed','failed','partial','not_tested')),
  iso_clause_ref   VARCHAR(200),
  frameworks       TEXT[],
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bcp_bia (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES bcp_plans(id) ON DELETE CASCADE,
  process_name     VARCHAR(300) NOT NULL,
  department       VARCHAR(200),
  criticality      VARCHAR(20)  NOT NULL DEFAULT 'medium'
                     CHECK (criticality IN ('critical','high','medium','low')),
  rto_hours        INTEGER,
  rpo_hours        INTEGER,
  mtpd_hours       INTEGER,
  mbco             TEXT,
  dependencies     TEXT,
  impacts_financial TEXT,
  impacts_operational TEXT,
  impacts_reputational TEXT,
  impacts_regulatory TEXT,
  priority_order   INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bcp_strategies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES bcp_plans(id) ON DELETE CASCADE,
  strategy_name    VARCHAR(300) NOT NULL,
  strategy_type    VARCHAR(50)  NOT NULL DEFAULT 'operational'
                     CHECK (strategy_type IN ('operational','technical','communication','people','supplier','facility')),
  description      TEXT,
  resources_required TEXT,
  responsible_party VARCHAR(200),
  cost_estimate    NUMERIC(14,2),
  status           VARCHAR(20)  NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed','approved','implemented','tested')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bcp_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES bcp_plans(id) ON DELETE CASCADE,
  test_name        VARCHAR(300) NOT NULL,
  test_type        VARCHAR(50)  NOT NULL DEFAULT 'tabletop'
                     CHECK (test_type IN ('tabletop','walkthrough','simulation','full_interruption','parallel')),
  test_date        DATE NOT NULL,
  participants     TEXT,
  scenario         TEXT,
  objectives       TEXT,
  result           VARCHAR(20)  NOT NULL DEFAULT 'not_tested'
                     CHECK (result IN ('passed','failed','partial','not_tested')),
  findings         TEXT,
  actions_required TEXT,
  lessons_learned  TEXT,
  next_test_date   DATE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcp_plans_org   ON bcp_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_bcp_bia_plan    ON bcp_bia(plan_id);
CREATE INDEX IF NOT EXISTS idx_bcp_strat_plan  ON bcp_strategies(plan_id);
CREATE INDEX IF NOT EXISTS idx_bcp_tests_plan  ON bcp_tests(plan_id);
