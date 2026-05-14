-- ISO 27001:2022 Asset Register Enhancements
-- Annex A 5.9 (Inventory), 5.10 (Acceptable Use), 5.12 (Classification),
-- 5.13 (Labelling), 7.14 (Secure Disposal)

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS classification    VARCHAR(30)  DEFAULT 'internal'
    CHECK (classification IN ('public','internal','confidential','restricted')),
  ADD COLUMN IF NOT EXISTS custodian         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS asset_category    VARCHAR(50)  DEFAULT 'hardware'
    CHECK (asset_category IN ('hardware','software','information','service','people','facility','cloud','mobile_device','virtual','other')),
  ADD COLUMN IF NOT EXISTS data_types        TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review_date       DATE,
  ADD COLUMN IF NOT EXISTS last_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by       VARCHAR(200),
  ADD COLUMN IF NOT EXISTS disposal_notes    TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_classification ON assets(classification);
CREATE INDEX IF NOT EXISTS idx_assets_review_date    ON assets(review_date);
CREATE INDEX IF NOT EXISTS idx_assets_category       ON assets(asset_category);
