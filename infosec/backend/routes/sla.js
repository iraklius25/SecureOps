const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const SEVERITY_ORDER = `CASE severity
  WHEN 'critical' THEN 1
  WHEN 'high' THEN 2
  WHEN 'medium' THEN 3
  WHEN 'low' THEN 4
  ELSE 5 END`;

// GET /api/sla/policies — list sla_policies ordered by severity
router.get('/policies', auth, async (req, res) => {
  try {
    const r = await db.query(`SELECT * FROM sla_policies ORDER BY ${SEVERITY_ORDER}`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sla/policies — update all policies at once
router.put('/policies', auth, requireRole('admin'), async (req, res) => {
  const { policies } = req.body;
  if (!Array.isArray(policies)) return res.status(400).json({ error: 'policies array required' });
  try {
    for (const p of policies) {
      if (!p.severity || p.days_to_remediate == null) continue;
      await db.query(`
        INSERT INTO sla_policies (severity, days_to_remediate, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (severity) DO UPDATE SET
          days_to_remediate = EXCLUDED.days_to_remediate,
          updated_at        = NOW()
      `, [p.severity, parseInt(p.days_to_remediate)]);
    }
    const r = await db.query(`SELECT * FROM sla_policies ORDER BY ${SEVERITY_ORDER}`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sla/appetite — get risk_appetite row
router.get('/appetite', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM risk_appetite LIMIT 1');
    res.json(r.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sla/appetite — update risk_appetite
router.put('/appetite', auth, requireRole('admin'), async (req, res) => {
  const { max_risk_score, max_ale, max_open_critical, notes } = req.body;
  try {
    // Ensure row exists
    const existing = await db.query('SELECT id FROM risk_appetite LIMIT 1');
    let r;
    if (existing.rows.length) {
      r = await db.query(`
        UPDATE risk_appetite SET
          max_risk_score    = COALESCE($1, max_risk_score),
          max_ale           = COALESCE($2, max_ale),
          max_open_critical = COALESCE($3, max_open_critical),
          notes             = COALESCE($4, notes),
          updated_at        = NOW()
        WHERE id = $5 RETURNING *
      `, [max_risk_score, max_ale, max_open_critical, notes, existing.rows[0].id]);
    } else {
      r = await db.query(`
        INSERT INTO risk_appetite (max_risk_score, max_ale, max_open_critical, notes)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [max_risk_score || 12, max_ale || 100000, max_open_critical || 0, notes || '']);
    }
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sla/overdue — list open vulns where due_date < NOW()
router.get('/overdue', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        v.*,
        a.ip_address, a.hostname, a.criticality,
        u.email AS assignee_email,
        u.full_name AS assignee_name,
        u.username AS assignee_username
      FROM vulnerabilities v
      LEFT JOIN assets a ON a.id = v.asset_id
      LEFT JOIN users u ON u.id = v.assigned_to
      WHERE v.status NOT IN ('closed','mitigated','false_positive','accepted')
        AND v.due_date IS NOT NULL
        AND v.due_date < NOW()
      ORDER BY v.due_date ASC, v.severity ASC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
