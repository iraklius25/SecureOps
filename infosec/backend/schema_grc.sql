-- GRC Platform Schema — run after schema.sql
-- psql -U infosec_user -d infosec_db -h localhost -f backend/schema_grc.sql

CREATE TABLE IF NOT EXISTS grc_programs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework      VARCHAR(50)  NOT NULL CHECK (framework IN ('ISO27001','NISTCSF','ISO42001','CUSTOM')),
  name           VARCHAR(200) NOT NULL,
  description    TEXT,
  phase          VARCHAR(50)  NOT NULL DEFAULT 'planning'
                   CHECK (phase IN ('planning','gap_analysis','implementation','monitoring','certification','review')),
  owner          VARCHAR(200),
  target_date    DATE,
  completion_pct INTEGER      NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  status         VARCHAR(50)  NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','completed','cancelled')),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grc_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID REFERENCES grc_programs(id) ON DELETE SET NULL,
  source_type  VARCHAR(50)  NOT NULL DEFAULT 'manual'
                 CHECK (source_type IN ('gap','risk','audit','manual','policy')),
  source_id    UUID,
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  owner        VARCHAR(200),
  due_date     DATE,
  priority     VARCHAR(20)  NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('critical','high','medium','low')),
  status       VARCHAR(50)  NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','completed','cancelled')),
  framework    VARCHAR(50),
  clause_ref   VARCHAR(100),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grc_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID REFERENCES grc_programs(id) ON DELETE SET NULL,
  title           VARCHAR(500) NOT NULL,
  category        VARCHAR(50)  NOT NULL DEFAULT 'policy'
                    CHECK (category IN ('policy','procedure','standard','guideline','template','raci','roadmap','report','presentation','training','other')),
  doc_version     VARCHAR(50)  NOT NULL DEFAULT '1.0',
  status          VARCHAR(50)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','review','approved','published','retired')),
  owner           VARCHAR(200),
  review_date     DATE,
  framework_links JSONB        NOT NULL DEFAULT '[]',
  tags            TEXT[],
  description     TEXT,
  original_name   VARCHAR(500),
  stored_name     VARCHAR(500),
  mimetype        VARCHAR(200),
  file_size       BIGINT,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grc_controls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID REFERENCES grc_programs(id) ON DELETE SET NULL,
  control_ref   VARCHAR(100) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  category      VARCHAR(200),
  framework     VARCHAR(50),
  mappings      JSONB        NOT NULL DEFAULT '{}',
  owner         VARCHAR(200),
  status        VARCHAR(50)  NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','in_progress','implemented','not_applicable')),
  effectiveness VARCHAR(50)  NOT NULL DEFAULT 'not_tested'
                  CHECK (effectiveness IN ('effective','partially_effective','ineffective','not_tested','not_applicable')),
  last_tested   DATE,
  next_review   DATE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grc_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID REFERENCES grc_programs(id) ON DELETE SET NULL,
  review_date  DATE         NOT NULL,
  review_type  VARCHAR(50)  NOT NULL DEFAULT 'management_review'
                 CHECK (review_type IN ('management_review','internal_audit','external_audit','surveillance')),
  title        VARCHAR(500) NOT NULL,
  chair        VARCHAR(200),
  attendees    JSONB        NOT NULL DEFAULT '[]',
  agenda       JSONB        NOT NULL DEFAULT '[]',
  inputs       JSONB        NOT NULL DEFAULT '{}',
  decisions    JSONB        NOT NULL DEFAULT '[]',
  action_items JSONB        NOT NULL DEFAULT '[]',
  minutes_text TEXT,
  status       VARCHAR(50)  NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','in_progress','completed','cancelled')),
  approved_by  VARCHAR(200),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grc_tasks_program    ON grc_tasks(program_id);
CREATE INDEX IF NOT EXISTS idx_grc_tasks_status     ON grc_tasks(status);
CREATE INDEX IF NOT EXISTS idx_grc_tasks_due        ON grc_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_grc_docs_program     ON grc_documents(program_id);
CREATE INDEX IF NOT EXISTS idx_grc_docs_category    ON grc_documents(category);
CREATE INDEX IF NOT EXISTS idx_grc_docs_status      ON grc_documents(status);
CREATE INDEX IF NOT EXISTS idx_grc_controls_program ON grc_controls(program_id);
CREATE INDEX IF NOT EXISTS idx_grc_controls_status  ON grc_controls(status);
CREATE INDEX IF NOT EXISTS idx_grc_reviews_program  ON grc_reviews(program_id);
CREATE INDEX IF NOT EXISTS idx_grc_reviews_date     ON grc_reviews(review_date);
