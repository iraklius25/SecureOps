const db     = require('../db');
const logger = require('./logger');

/**
 * Write an audit log entry (fire-and-forget, never throws)
 */
async function auditLog({ userId, action, resource, resourceId, details = {}, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, resource, resource_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId || null, action, resource || null, resourceId || null,
       JSON.stringify(details), ip || null]
    );
  } catch (e) {
    logger.error('auditLog write error:', e.message);
  }
}

module.exports = { auditLog };
