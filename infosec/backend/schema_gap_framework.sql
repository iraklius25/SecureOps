-- Add framework column to gap_assessments so each standard has its own set of assessments
ALTER TABLE gap_assessments ADD COLUMN IF NOT EXISTS framework VARCHAR(50) DEFAULT 'ISO27001';
UPDATE gap_assessments SET framework = 'ISO27001' WHERE framework IS NULL;
CREATE INDEX IF NOT EXISTS idx_gap_assessments_framework ON gap_assessments(framework);
