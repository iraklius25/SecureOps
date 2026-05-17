CREATE TABLE IF NOT EXISTS drp_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES cert_organizations(id) ON DELETE SET NULL,
  name             VARCHAR(300) NOT NULL,
  version          VARCHAR(50)  NOT NULL DEFAULT '1.0',
  scope            TEXT,
  dr_site          VARCHAR(300),
  dr_site_type     VARCHAR(20)  NOT NULL DEFAULT 'cold'
                     CHECK (dr_site_type IN ('hot','warm','cold','cloud','none')),
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
  overall_rto_hours INTEGER,
  overall_rpo_hours INTEGER,
  activation_criteria TEXT,
  escalation_contacts JSONB NOT NULL DEFAULT '[]',
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drp_systems (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES drp_plans(id) ON DELETE CASCADE,
  system_name      VARCHAR(300) NOT NULL,
  system_type      VARCHAR(50)  NOT NULL DEFAULT 'application'
                     CHECK (system_type IN ('application','database','server','network','storage','cloud','other')),
  criticality      VARCHAR(20)  NOT NULL DEFAULT 'medium'
                     CHECK (criticality IN ('critical','high','medium','low')),
  rto_hours        INTEGER,
  rpo_hours        INTEGER,
  recovery_priority INTEGER NOT NULL DEFAULT 0,
  recovery_procedure TEXT,
  responsible_team VARCHAR(200),
  backup_location  VARCHAR(300),
  backup_frequency VARCHAR(100),
  dr_site_target   VARCHAR(200),
  dependencies     TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drp_runbooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES drp_plans(id) ON DELETE CASCADE,
  title            VARCHAR(300) NOT NULL,
  scenario         VARCHAR(300),
  steps            JSONB        NOT NULL DEFAULT '[]',
  responsible_role VARCHAR(200),
  estimated_hours  INTEGER,
  prerequisites    TEXT,
  rollback_procedure TEXT,
  last_reviewed    DATE,
  version          VARCHAR(50)  DEFAULT '1.0',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drp_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES drp_plans(id) ON DELETE CASCADE,
  test_name        VARCHAR(300) NOT NULL,
  test_type        VARCHAR(50)  NOT NULL DEFAULT 'tabletop'
                     CHECK (test_type IN ('tabletop','component','parallel','full_failover','simulation')),
  test_date        DATE NOT NULL,
  participants     TEXT,
  scenario         TEXT,
  rto_target_hours INTEGER,
  rpo_target_hours INTEGER,
  rto_achieved_hours INTEGER,
  rpo_achieved_hours INTEGER,
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

CREATE INDEX IF NOT EXISTS idx_drp_plans_org    ON drp_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_drp_sys_plan     ON drp_systems(plan_id);
CREATE INDEX IF NOT EXISTS idx_drp_rb_plan      ON drp_runbooks(plan_id);
CREATE INDEX IF NOT EXISTS idx_drp_tests_plan   ON drp_tests(plan_id);
