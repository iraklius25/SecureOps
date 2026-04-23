-- CVE data cache (NVD API results)
-- Run: psql -U infosec_user -d infosec_db -h localhost -f schema_cve_cache.sql

CREATE TABLE IF NOT EXISTS cve_cache (
  cve_id     TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
