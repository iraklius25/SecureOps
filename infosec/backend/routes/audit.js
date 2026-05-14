const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/audit — paginated audit log (admin/auditor only)
router.get('/', auth, requireRole('admin','auditor'), async (req, res) => {
  const { page = 1, limit = 50, user_id, resource, action, date_from, date_to } = req.query;
  const offset = (page - 1) * limit;
  let where = ['1=1'], params = [];

  if (user_id)   { params.push(user_id);              where.push(`a.user_id=$${params.length}`); }
  if (resource)  { params.push(resource);             where.push(`a.resource=$${params.length}`); }
  if (action)    { params.push(`%${action}%`);        where.push(`a.action ILIKE $${params.length}`); }
  if (date_from) { params.push(date_from);            where.push(`a.created_at >= $${params.length}::date`); }
  if (date_to)   { params.push(date_to);              where.push(`a.created_at <  ($${params.length}::date + INTERVAL '1 day')`); }

  try {
    const count = await db.query(
      `SELECT COUNT(*) FROM audit_log a WHERE ${where.join(' AND ')}`, params
    );
    params.push(limit, offset);
    const r = await db.query(`
      SELECT a.*, u.username, u.full_name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.json({ total: parseInt(count.rows[0].count), page: parseInt(page), data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
