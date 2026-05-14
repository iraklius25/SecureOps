-- Kanban migration: add priority column + in_review status to cert_workflow_steps
-- Run: psql -U infosec_user -d infosec_db -h localhost -f infosec/backend/migrate_kanban.sql

BEGIN;

ALTER TABLE cert_workflow_steps
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium'
    CHECK (priority IN ('critical','high','medium','low'));

ALTER TABLE cert_workflow_steps
  DROP CONSTRAINT IF EXISTS cert_workflow_steps_status_check;

ALTER TABLE cert_workflow_steps
  ADD CONSTRAINT cert_workflow_steps_status_check
    CHECK (status IN ('pending','in_progress','in_review','completed','blocked','skipped'));

COMMIT;
