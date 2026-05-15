-- Link maturity assessments to certification organizations for per-org maturity tracking
ALTER TABLE maturity_assessments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cert_organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_maturity_org_id ON maturity_assessments(org_id);
