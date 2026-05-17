-- Extend the maturity_assessments framework check constraint to include
-- all frameworks supported by the frontend (NISTCSF, PCIDSS, SOC2, ISO22301, GDPR).
ALTER TABLE maturity_assessments
  DROP CONSTRAINT IF EXISTS maturity_assessments_framework_check;

ALTER TABLE maturity_assessments
  ADD CONSTRAINT maturity_assessments_framework_check
  CHECK (framework IN ('ISMS', 'ISO42001', 'NISTCSF', 'PCIDSS', 'SOC2', 'ISO22301', 'GDPR'));
