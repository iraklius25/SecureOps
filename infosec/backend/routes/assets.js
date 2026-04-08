const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/assets
router.get('/', auth, async (req, res) => {
  const { page=1, limit=50, search, criticality, status, type } = req.query;
  const offset = (page-1) * limit;
  let where = ['1=1']; let params = [];
  if (search) { params.push(`%${search}%`); where.push(`(a.hostname ILIKE $${params.length} OR a.ip_address::text ILIKE $${params.length} OR a.os_name ILIKE $${params.length})`); }
  if (criticality) { params.push(criticality); where.push(`a.criticality = $${params.length}`); }
  if (status)      { params.push(status);      where.push(`a.status = $${params.length}`); }
  if (type)        { params.push(type);         where.push(`a.asset_type = $${params.length}`); }
  try {
    const countQ = await db.query(`SELECT COUNT(*) FROM assets a WHERE ${where.join(' AND ')}`, params);
    params.push(limit, offset);
    const q = await db.query(`
      SELECT a.*,
        COUNT(DISTINCT ap.id) AS open_ports,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status='open') AS open_vulns,
        COUNT(DISTINCT v.id) FILTER (WHERE v.severity='critical' AND v.status='open') AS critical_vulns
      FROM assets a
      LEFT JOIN asset_ports ap ON ap.asset_id = a.id
      LEFT JOIN vulnerabilities v ON v.asset_id = a.id
      WHERE ${where.join(' AND ')}
      GROUP BY a.id
      ORDER BY a.last_seen DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);
    res.json({ total: parseInt(countQ.rows[0].count), page: parseInt(page), data: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/assets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const asset = await db.query(`
      SELECT a.*,
        json_agg(DISTINCT ap.*) FILTER (WHERE ap.id IS NOT NULL) AS ports,
        json_agg(DISTINCT jsonb_build_object(
          'id',v.id,'title',v.title,'severity',v.severity,'cvss_score',v.cvss_score,
          'status',v.status,'cve_id',v.cve_id,'ale',v.ale,'detected_at',v.detected_at
        )) FILTER (WHERE v.id IS NOT NULL) AS vulnerabilities
      FROM assets a
      LEFT JOIN asset_ports ap ON ap.asset_id = a.id
      LEFT JOIN vulnerabilities v ON v.asset_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
    `, [req.params.id]);
    if (!asset.rows.length) return res.status(404).json({ error: 'Asset not found' });
    res.json(asset.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/assets  — manual add
router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { ip_address, hostname, asset_type, criticality, department, owner, location, asset_value, notes, tags } = req.body;
  if (!ip_address) return res.status(400).json({ error: 'IP address required' });
  try {
    const r = await db.query(`
      INSERT INTO assets (ip_address, hostname, asset_type, criticality, department, owner, location, asset_value, notes, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [ip_address, hostname, asset_type||'unknown', criticality||'medium', department, owner, location, asset_value||50000, notes, tags]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Asset with this IP already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/assets/:id
router.put('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const { hostname, asset_type, criticality, department, owner, location, asset_value, notes, tags, status } = req.body;
  try {
    const r = await db.query(`
      UPDATE assets SET hostname=$2, asset_type=$3, criticality=$4, department=$5, owner=$6,
        location=$7, asset_value=$8, notes=$9, tags=$10, status=$11, updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id, hostname, asset_type, criticality, department, owner, location, asset_value, notes, tags, status]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/assets/:id
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('UPDATE assets SET status=$2 WHERE id=$1', [req.params.id, 'decommissioned']);
    res.json({ message: 'Asset decommissioned' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
