const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const VALID_ACTIONS = ['accept_risk', 'close', 'mitigate'];

// GET /api/approvals — list vuln_approvals
router.get('/', auth, async (req, res) => {
  try {
    let r;
    if (['admin', 'analyst'].includes(req.user.role)) {
      r = await db.query(`
        SELECT
          a.*,
          v.title AS vuln_title, v.severity AS vuln_severity,
          ast.ip_address,
          ru.username AS requested_by_name,
          au.username AS approved_by_name
        FROM vuln_approvals a
        LEFT JOIN vulnerabilities v ON v.id = a.vuln_id
        LEFT JOIN assets ast ON ast.id = v.asset_id
        LEFT JOIN users ru ON ru.id = a.requested_by
        LEFT JOIN users au ON au.id = a.approved_by
        ORDER BY a.created_at DESC
      `);
    } else {
      r = await db.query(`
        SELECT
          a.*,
          v.title AS vuln_title, v.severity AS vuln_severity,
          ast.ip_address,
          ru.username AS requested_by_name,
          au.username AS approved_by_name
        FROM vuln_approvals a
        LEFT JOIN vulnerabilities v ON v.id = a.vuln_id
        LEFT JOIN assets ast ON ast.id = v.asset_id
        LEFT JOIN users ru ON ru.id = a.requested_by
        LEFT JOIN users au ON au.id = a.approved_by
        WHERE a.requested_by = $1
        ORDER BY a.created_at DESC
      `, [req.user.id]);
    }
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/approvals — create approval request
router.post('/', auth, async (req, res) => {
  const { vuln_id, action, request_notes } = req.body;
  if (!vuln_id) return res.status(400).json({ error: 'vuln_id is required' });
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }
  try {
    const r = await db.query(`
      INSERT INTO vuln_approvals (vuln_id, action, requested_by, request_notes, status)
      VALUES ($1, $2, $3, $4, 'pending') RETURNING *
    `, [vuln_id, action, req.user.id, request_notes || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/approvals/:id — approve or reject
router.patch('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { status, review_notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }
  try {
    const approval = await db.query('SELECT * FROM vuln_approvals WHERE id=$1', [req.params.id]);
    if (!approval.rows.length) return res.status(404).json({ error: 'Approval not found' });
    const a = approval.rows[0];

    // Update approval
    const r = await db.query(`
      UPDATE vuln_approvals SET
        status       = $2,
        approved_by  = $3,
        review_notes = COALESCE($4, review_notes),
        reviewed_at  = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, status, req.user.id, review_notes || null]);

    // If approved, update vulnerability status accordingly
    if (status === 'approved') {
      const vulnStatusMap = {
        accept_risk: 'accepted',
        close:       'closed',
        mitigate:    'mitigated',
      };
      const newVulnStatus = vulnStatusMap[a.action];
      if (newVulnStatus) {
        await db.query(`
          UPDATE vulnerabilities SET
            status      = $2,
            resolved_at = CASE WHEN $2 IN ('closed','mitigated') THEN NOW() ELSE resolved_at END,
            updated_at  = NOW()
          WHERE id = $1
        `, [a.vuln_id, newVulnStatus]);
      }
    }

    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/approvals/:id — delete pending approval
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT status FROM vuln_approvals WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Approval not found' });
    await db.query('DELETE FROM vuln_approvals WHERE id=$1', [req.params.id]);
    res.json({ message: 'Approval deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
