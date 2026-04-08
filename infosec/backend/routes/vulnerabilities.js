// vulnerabilities.js
const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { page=1, limit=50, severity, status, asset_id, search } = req.query;
  let where = ['1=1']; let params = [];
  if (severity)  { params.push(severity);  where.push(`v.severity=$${params.length}`); }
  if (status)    { params.push(status);    where.push(`v.status=$${params.length}`); }
  if (asset_id)  { params.push(asset_id);  where.push(`v.asset_id=$${params.length}`); }
  if (search)    { params.push(`%${search}%`); where.push(`(v.title ILIKE $${params.length} OR v.cve_id ILIKE $${params.length})`); }
  try {
    const count = await db.query(`SELECT COUNT(*) FROM vulnerabilities v WHERE ${where.join(' AND ')}`, params);
    params.push(limit, (page-1)*limit);
    const r = await db.query(`
      SELECT v.*, a.ip_address, a.hostname, a.criticality AS asset_criticality
      FROM vulnerabilities v
      LEFT JOIN assets a ON a.id = v.asset_id
      WHERE ${where.join(' AND ')}
      ORDER BY v.cvss_score DESC NULLS LAST, v.detected_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);
    res.json({ total: parseInt(count.rows[0].count), page: parseInt(page), data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT v.*, a.ip_address, a.hostname, a.criticality AS asset_criticality, a.department
      FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE v.id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const { status, assigned_to, due_date, notes, asset_value, exposure_factor, aro } = req.body;
  try {
    const r = await db.query(`
      UPDATE vulnerabilities SET
        status=COALESCE($2,status), assigned_to=COALESCE($3,assigned_to),
        due_date=COALESCE($4,due_date), asset_value=COALESCE($5,asset_value),
        exposure_factor=COALESCE($6,exposure_factor), aro=COALESCE($7,aro),
        resolved_at=CASE WHEN $2 IN ('closed','mitigated') THEN NOW() ELSE resolved_at END,
        updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id, status, assigned_to, due_date, asset_value, exposure_factor, aro]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual vuln creation
router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { asset_id, title, description, severity, cve_id, cvss_score, vuln_type, remediation, asset_value, exposure_factor, aro } = req.body;
  if (!asset_id || !title || !severity) return res.status(400).json({ error: 'asset_id, title, severity required' });
  try {
    const r = await db.query(`
      INSERT INTO vulnerabilities (asset_id,title,description,severity,risk_level,cve_id,cvss_score,vuln_type,remediation,asset_value,exposure_factor,aro,detected_by)
      VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'manual') RETURNING *
    `, [asset_id,title,description,severity,cve_id,cvss_score||null,vuln_type||'Manual',remediation,asset_value||50000,exposure_factor||30,aro||0.25]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
