const { Client } = require('ldapts');
const db = require('../db');

async function getLdapConfig() {
  const r = await db.query(`
    SELECT key, value FROM settings
    WHERE key IN (
      'ldap_enabled','ldap_url','ldap_base_dn','ldap_bind_dn',
      'ldap_bind_password','ldap_user_filter','ldap_search_base',
      'ldap_tls','ldap_default_role','ldap_group_map'
    )
  `);
  const cfg = {};
  for (const row of r.rows) cfg[row.key] = row.value;
  return cfg;
}

function buildClient(cfg) {
  return new Client({
    url: cfg.ldap_url,
    connectTimeout: 8000,
    timeout: 8000,
    tlsOptions: cfg.ldap_tls === 'true' ? { rejectUnauthorized: false } : undefined,
  });
}

// Bind with service account, search for the user entry, return the entry or null.
async function findUser(cfg, username) {
  const client = buildClient(cfg);
  try {
    await client.bind(cfg.ldap_bind_dn, cfg.ldap_bind_password);
    const filter = (cfg.ldap_user_filter || '(sAMAccountName={{username}})').replace('{{username}}', username);
    const base   = cfg.ldap_search_base || cfg.ldap_base_dn;
    const { searchEntries } = await client.search(base, {
      scope: 'sub',
      filter,
      attributes: ['dn', 'cn', 'mail', 'sAMAccountName', 'memberOf', 'displayName'],
    });
    return searchEntries[0] || null;
  } finally {
    await client.unbind();
  }
}

// Attempt to bind as the found user — returns true if password is correct.
async function verifyPassword(cfg, userDn, password) {
  const client = buildClient(cfg);
  try {
    await client.bind(userDn, password);
    return true;
  } catch {
    return false;
  } finally {
    await client.unbind();
  }
}

// Map AD group CNs to a SecureOps role using ldap_group_map setting.
function resolveRole(cfg, memberOf) {
  let groupMap = {};
  try { groupMap = JSON.parse(cfg.ldap_group_map || '{}'); } catch { /* bad JSON — ignore */ }
  if (!Array.isArray(memberOf)) memberOf = memberOf ? [memberOf] : [];
  for (const dn of memberOf) {
    const cn = (dn.match(/^CN=([^,]+)/i) || [])[1];
    if (cn && groupMap[cn]) return groupMap[cn];
  }
  return cfg.ldap_default_role || 'viewer';
}

/**
 * Authenticate a user against LDAP.
 * Returns { user } on success (auto-provisions if new), throws Error otherwise.
 */
async function authenticate(username, password) {
  const cfg = await getLdapConfig();
  if (cfg.ldap_enabled !== 'true') throw new Error('LDAP is not enabled');

  const entry = await findUser(cfg, username);
  if (!entry) throw new Error('User not found in directory');

  const ok = await verifyPassword(cfg, entry.dn, password);
  if (!ok) throw new Error('Invalid credentials');

  const role = resolveRole(cfg, entry.memberOf);
  const email = (Array.isArray(entry.mail) ? entry.mail[0] : entry.mail) || `${username}@ldap`;
  const fullName = (Array.isArray(entry.displayName) ? entry.displayName[0] : entry.displayName) || username;

  // Upsert the local user record (keyed by username).
  const upsert = await db.query(`
    INSERT INTO users (username, email, full_name, role, auth_provider, ldap_dn, password, is_active)
    VALUES ($1, $2, $3, $4, 'ldap', $5, '', TRUE)
    ON CONFLICT (username)
    DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      ldap_dn = EXCLUDED.ldap_dn,
      last_login = NOW(),
      updated_at = NOW()
    RETURNING *
  `, [username, email, fullName, role, entry.dn]);

  return upsert.rows[0];
}

/**
 * Test connectivity — bind with service account and try a search.
 * Returns { ok: true, found: number } or throws.
 */
async function testConnection(overrides = {}) {
  const cfg = { ...(await getLdapConfig()), ...overrides };
  const entry = await findUser(cfg, 'testuser_probe_nonexistent_xx');
  // findUser returns null when not found — that's fine, we just need no exception
  return { ok: true, found: entry ? 1 : 0 };
}

module.exports = { authenticate, testConnection, getLdapConfig };
