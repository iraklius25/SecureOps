const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/compliance/controls  — list all controls, optionally by framework
router.get('/controls', auth, async (req, res) => {
  const { framework } = req.query;
  try {
    let q = 'SELECT * FROM compliance_controls';
    const params = [];
    if (framework) { params.push(framework); q += ` WHERE framework=$1`; }
    q += ' ORDER BY framework, control_id';
    const r = await db.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/compliance/posture  — compliance posture per framework
router.get('/posture', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        cc.framework,
        cc.control_id,
        cc.name,
        cc.category,
        COUNT(rc.risk_id) AS mapped_risks,
        COUNT(rc.risk_id) FILTER (WHERE rc.status='compliant')     AS compliant,
        COUNT(rc.risk_id) FILTER (WHERE rc.status='partial')       AS partial,
        COUNT(rc.risk_id) FILTER (WHERE rc.status='non_compliant') AS non_compliant,
        COUNT(rc.risk_id) FILTER (WHERE rc.status='not_assessed')  AS not_assessed
      FROM compliance_controls cc
      LEFT JOIN risk_controls rc ON rc.control_id = cc.id
      GROUP BY cc.id, cc.framework, cc.control_id, cc.name, cc.category
      ORDER BY cc.framework, cc.control_id
    `);

    // Build summary per framework
    const byFramework = {};
    for (const row of r.rows) {
      if (!byFramework[row.framework]) byFramework[row.framework] = { controls: [], total: 0, compliant: 0, partial: 0, non_compliant: 0 };
      byFramework[row.framework].controls.push(row);
      byFramework[row.framework].total++;
      if (parseInt(row.compliant) > 0)     byFramework[row.framework].compliant++;
      else if (parseInt(row.partial) > 0)  byFramework[row.framework].partial++;
      else if (parseInt(row.non_compliant) > 0) byFramework[row.framework].non_compliant++;
    }

    res.json({ frameworks: byFramework });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/compliance/risks/:riskId/controls  — controls mapped to a risk
router.get('/risks/:riskId/controls', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT cc.*, rc.status AS mapping_status, rc.notes AS mapping_notes, rc.updated_at AS mapping_updated
      FROM risk_controls rc
      JOIN compliance_controls cc ON cc.id = rc.control_id
      WHERE rc.risk_id = $1
      ORDER BY cc.framework, cc.control_id
    `, [req.params.riskId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/compliance/risks/:riskId/controls  — map a control to a risk
router.post('/risks/:riskId/controls', auth, requireRole('admin','analyst'), async (req, res) => {
  const { control_id, status = 'not_assessed', notes } = req.body;
  if (!control_id) return res.status(400).json({ error: 'control_id required' });
  try {
    await db.query(`
      INSERT INTO risk_controls (risk_id, control_id, status, notes)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (risk_id, control_id) DO UPDATE SET status=$3, notes=$4, updated_at=NOW()
    `, [req.params.riskId, control_id, status, notes]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/compliance/risks/:riskId/controls/:controlId
router.delete('/risks/:riskId/controls/:controlId', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    await db.query(
      `DELETE FROM risk_controls WHERE risk_id=$1 AND control_id=$2`,
      [req.params.riskId, req.params.controlId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── ISO Gap Assessments ──────────────────────────── */

// GET /api/compliance/gap  — list assessments (optionally filtered by framework)
router.get('/gap', auth, async (req, res) => {
  try {
    const { framework } = req.query;
    const params = [];
    let q = `SELECT id, name, description, framework, created_at, updated_at FROM gap_assessments`;
    if (framework) { params.push(framework); q += ` WHERE framework=$1`; }
    q += ` ORDER BY updated_at DESC`;
    const r = await db.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/compliance/gap  — create new assessment
router.post('/gap', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description = '', data = { sheets: [], charts: [] }, framework = 'ISO27001' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await db.query(
      `INSERT INTO gap_assessments (name, description, data, framework, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description, JSON.stringify(data), framework, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/compliance/gap/:id  — get single assessment with full data
router.get('/gap/:id', auth, async (req, res) => {
  try {
    const r = await db.query(`SELECT * FROM gap_assessments WHERE id=$1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/compliance/gap/:id  — update assessment
router.put('/gap/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description, data } = req.body;
  try {
    await db.query(
      `UPDATE gap_assessments SET name=$1, description=$2, data=$3, updated_at=NOW() WHERE id=$4`,
      [name, description || '', JSON.stringify(data), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/compliance/gap/:id
router.delete('/gap/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query(`DELETE FROM gap_assessments WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
