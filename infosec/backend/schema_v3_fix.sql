-- Fix for schema_features_v3.sql: correct UUID foreign key types

CREATE TABLE IF NOT EXISTS asset_patches (
  id         SERIAL PRIMARY KEY,
  asset_id   UUID REFERENCES assets(id) ON DELETE CASCADE,
  patch_id   INTEGER REFERENCES patches(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, patch_id)
);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id          SERIAL PRIMARY KEY,
  control_id  UUID REFERENCES compliance_controls(id) ON DELETE CASCADE,
  risk_id     UUID REFERENCES risks(id) ON DELETE SET NULL,
  filename    TEXT NOT NULL,
  mimetype    TEXT,
  file_size   INTEGER,
  file_path   TEXT NOT NULL,
  notes       TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vuln_approvals (
  id            SERIAL PRIMARY KEY,
  vuln_id       UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  status        TEXT DEFAULT 'pending',
  request_notes TEXT,
  review_notes  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);
