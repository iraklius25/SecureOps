const db     = require('../db');
const logger = require('./logger');

async function log(req, action, entityType, entityId, entityName, oldValue, newValue) {
  try {
    const userId    = req.user?.id    || null;
    const username  = req.user?.username || null;
    const rawIp     = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '';
    const ipAddress = /^[\d.a-fA-F:]{3,45}$/.test(rawIp) ? rawIp : null;
    const userAgent = req.headers['user-agent'] || null;

    await db.query(
      `INSERT INTO platform_audit_log
         (user_id, username, action, entity_type, entity_id, entity_name,
          old_value, new_value, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        userId,
        username,
        action,
        entityType  || null,
        entityId    || null,
        entityName  || null,
        oldValue    ? JSON.stringify(oldValue)  : null,
        newValue    ? JSON.stringify(newValue)  : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (e) {
    logger.error('auditLog write error:', e.message);
  }
}

module.exports = { log };
