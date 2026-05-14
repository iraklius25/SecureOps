const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/assets/stats  — ISO 27001 summary (must precede /:id)
router.get('/stats', auth, async (req, res) => {
  try {
    const [classStats, reviewStats, categoryStats, reviewOverdue] = await Promise.all([
      db.query(`SELECT COALESCE(classification,'internal') AS classification, COUNT(*) AS cnt
                FROM assets WHERE status != 'decommissioned'
                GROUP BY 1`),
      db.query(`SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE review_date < NOW() AND review_date IS NOT NULL) AS overdue,
                  COUNT(*) FILTER (WHERE review_date IS NULL) AS never_reviewed
                FROM assets WHERE status != 'decommissioned'`),
      db.query(`SELECT COALESCE(asset_category,'hardware') AS asset_category, COUNT(*) AS cnt
                FROM assets WHERE status != 'decommissioned'
                GROUP BY 1 ORDER BY cnt DESC`),
    ]);
    res.json({
      by_classification: Object.fromEntries(classStats.rows.map(r => [r.classification, parseInt(r.cnt)])),
      review:            reviewStats.rows[0],
      by_category:       Object.fromEntries(categoryStats.rows.map(r => [r.asset_category, parseInt(r.cnt)])),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/assets
router.get('/', auth, async (req, res) => {
  const { page=1, limit=50, search, criticality, status, type, classification, category } = req.query;
  const offset = (page-1) * limit;
  let where = ['1=1']; let params = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(a.hostname ILIKE $${params.length} OR a.ip_address::text ILIKE $${params.length} OR a.os_name ILIKE $${params.length} OR a.owner ILIKE $${params.length} OR a.custodian ILIKE $${params.length} OR a.department ILIKE $${params.length})`);
  }
  if (criticality)    { params.push(criticality);    where.push(`a.criticality = $${params.length}`); }
  if (status)         { params.push(status);         where.push(`a.status = $${params.length}`); }
  if (type)           { params.push(type);           where.push(`a.asset_type = $${params.length}`); }
  if (classification) { params.push(classification); where.push(`a.classification = $${params.length}`); }
  if (category)       { params.push(category);       where.push(`a.asset_category = $${params.length}`); }
  try {
    const countQ = await db.query(`SELECT COUNT(*) FROM assets a WHERE ${where.join(' AND ')}`, params);
    params.push(limit, offset);
    const q = await db.query(`
      SELECT a.*,
        COUNT(DISTINCT ap.id) AS open_ports,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status='open') AS open_vulns,
        COUNT(DISTINCT v.id) FILTER (WHERE v.severity='critical' AND v.status='open') AS critical_vulns,
        COALESCE(SUM(v.ale) FILTER (WHERE v.status='open'), 0) AS total_ale
      FROM assets a
      LEFT JOIN asset_ports ap ON ap.asset_id = a.id
      LEFT JOIN vulnerabilities v ON v.asset_id = a.id
      WHERE ${where.join(' AND ')}
      GROUP BY a.id
      ORDER BY
        CASE a.classification WHEN 'restricted' THEN 1 WHEN 'confidential' THEN 2 WHEN 'internal' THEN 3 ELSE 4 END,
        a.last_seen DESC NULLS LAST
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
  const {
    ip_address, hostname, asset_type, asset_category, criticality,
    classification, department, owner, custodian, location,
    asset_value, notes, tags, data_types, review_date,
    last_reviewed_at, reviewed_by, disposal_notes,
  } = req.body;
  if (!ip_address) return res.status(400).json({ error: 'IP address required' });
  try {
    const r = await db.query(`
      INSERT INTO assets (
        ip_address, hostname, asset_type, asset_category, criticality, classification,
        department, owner, custodian, location, asset_value, notes, tags,
        data_types, review_date, last_reviewed_at, reviewed_by, disposal_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `, [
      ip_address, hostname||null, asset_type||'unknown', asset_category||'hardware',
      criticality||'medium', classification||'internal',
      department||null, owner||null, custodian||null, location||null,
      asset_value||50000, notes||null, tags||[],
      data_types||[], review_date||null, last_reviewed_at||null,
      reviewed_by||null, disposal_notes||null,
    ]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Asset with this IP already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/assets/:id
router.put('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const {
    hostname, asset_type, asset_category, criticality, classification,
    department, owner, custodian, location, asset_value, notes, tags, status,
    data_types, review_date, last_reviewed_at, reviewed_by, disposal_notes,
  } = req.body;
  try {
    const r = await db.query(`
      UPDATE assets SET
        hostname=$2, asset_type=$3, asset_category=$4, criticality=$5, classification=$6,
        department=$7, owner=$8, custodian=$9, location=$10, asset_value=$11,
        notes=$12, tags=$13, status=$14, data_types=$15, review_date=$16,
        last_reviewed_at=$17, reviewed_by=$18, disposal_notes=$19,
        updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [
      req.params.id, hostname||null, asset_type, asset_category||'hardware',
      criticality, classification||'internal',
      department||null, owner||null, custodian||null, location||null,
      asset_value||null, notes||null, tags||[], status,
      data_types||[], review_date||null, last_reviewed_at||null,
      reviewed_by||null, disposal_notes||null,
    ]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/assets/:id/history
router.get('/:id/history', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT h.*, s.name AS scan_name
      FROM asset_history h
      LEFT JOIN scan_jobs s ON s.id = h.scan_job_id
      WHERE h.asset_id = $1
      ORDER BY h.created_at DESC LIMIT 100
    `, [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/assets/:id
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM risks WHERE vulnerability_id IN (SELECT id FROM vulnerabilities WHERE asset_id=$1)`, [req.params.id]);
    await client.query(`DELETE FROM risks WHERE asset_id=$1`, [req.params.id]);
    const r = await client.query('DELETE FROM assets WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Asset not found' }); }
    await client.query('COMMIT');
    res.json({ message: 'Asset deleted' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
