const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/activity-log — paginated audit trail (admin only)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  const { action, entity_type, user_id, limit = 100, offset = 0 } = req.query;
  const filters = []; const vals = [];
  if (action)      { vals.push(`%${action}%`);      filters.push(`action ILIKE $${vals.length}`); }
  if (entity_type) { vals.push(entity_type);         filters.push(`entity_type=$${vals.length}`); }
  if (user_id)     { vals.push(user_id);             filters.push(`user_id=$${vals.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  vals.push(Math.min(parseInt(limit) || 100, 500));
  vals.push(parseInt(offset) || 0);
  try {
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT l.*, u.username FROM platform_audit_log l
         LEFT JOIN users u ON u.id = l.user_id
         ${where} ORDER BY l.created_at DESC LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals
      ),
      db.query(`SELECT COUNT(*) FROM platform_audit_log ${where}`, vals.slice(0, -2)),
    ]);
    res.json({ rows: rows.rows, total: parseInt(total.rows[0].count, 10) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
