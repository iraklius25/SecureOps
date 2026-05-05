-- LDAP Integration Schema — run after schema.sql
-- psql -U infosec_user -d infosec_db -h localhost -f backend/schema_ldap.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_dn TEXT;

-- Default LDAP settings (all disabled/empty until admin configures)
INSERT INTO settings (key, value, description) VALUES
  ('ldap_enabled',         'false',                     'Enable LDAP/AD authentication'),
  ('ldap_url',             '',                          'LDAP server URL e.g. ldap://dc.example.com:389'),
  ('ldap_base_dn',         '',                          'Base DN e.g. DC=example,DC=com'),
  ('ldap_bind_dn',         '',                          'Service account DN used to search directory'),
  ('ldap_bind_password',   '',                          'Service account password'),
  ('ldap_user_filter',     '(sAMAccountName={{username}})', 'User search filter — {{username}} is replaced at runtime'),
  ('ldap_search_base',     '',                          'Search base for users (defaults to ldap_base_dn if empty)'),
  ('ldap_tls',             'false',                     'Use STARTTLS (ldap://) — set false for ldaps://'),
  ('ldap_default_role',    'viewer',                    'Role assigned to auto-provisioned LDAP users'),
  ('ldap_group_map',       '{}',                        'JSON map of AD group CN to SecureOps role e.g. {"SecureOps-Admin":"admin"}')
ON CONFLICT (key) DO NOTHING;
