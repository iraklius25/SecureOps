CREATE TABLE IF NOT EXISTS risk_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id          UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  changed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name  VARCHAR(100),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  risk_score       INTEGER,
  risk_level       VARCHAR(20),
  likelihood       INTEGER,
  impact           INTEGER,
  treatment        VARCHAR(50),
  status           VARCHAR(30),
  change_note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_risk_history_risk_id ON risk_history(risk_id);
