-- =============================================================================
-- schema_audit_log.sql
-- Immutable platform-wide activity audit trail.
--
-- Records every significant user action across the platform.
-- Rows should never be updated or deleted by application code;
-- treat this table as append-only.
--
-- Safe to re-run: all statements use IF NOT EXISTS.
--
-- Load order: after schema.sql (requires users table).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- platform_audit_log
--
-- action      : dot-namespaced verb, e.g. 'document.approve', 'risk.create'
-- entity_type : noun, e.g. 'document', 'risk', 'user', 'scan'
-- entity_id   : TEXT to accommodate both UUID and integer PKs
-- old_value   : state before the change (NULL for create actions)
-- new_value   : state after the change  (NULL for delete actions)
-- ip_address  : supports both IPv4 (15 chars) and IPv6 (39 chars)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(100),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   TEXT,
  entity_name TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Look up all actions by a specific user
CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON platform_audit_log(user_id);

-- Filter / aggregate by action verb
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON platform_audit_log(action);

-- Fetch history for a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON platform_audit_log(entity_type, entity_id);

-- Time-range queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON platform_audit_log(created_at DESC);
