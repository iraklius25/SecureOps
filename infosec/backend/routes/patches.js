const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/patches — list patches with asset coverage stats
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        p.*,
        u.username AS created_by_username,
        COUNT(DISTINCT ap.id)                                      AS total_assets,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.status = 'applied') AS applied_count,
        COUNT(DISTINCT ap.id) FILTER (WHERE ap.status = 'pending') AS pending_count
      FROM patches p
      LEFT JOIN asset_patches ap ON ap.patch_id = p.id
      LEFT JOIN users u ON u.id = p.created_by
      GROUP BY p.id, u.username
      ORDER BY p.created_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/patches — create patch
router.post('/', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, cve_id, severity, vendor, product, patch_url, release_date, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const r = await db.query(`
      INSERT INTO patches (title, cve_id, severity, vendor, product, patch_url, release_date, description, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [title, cve_id || null, severity || 'medium', vendor || null, product || null,
        patch_url || null, release_date || null, description || null, req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/patches/:id — update patch
router.put('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, cve_id, severity, vendor, product, patch_url, release_date, description } = req.body;
  try {
    const r = await db.query(`
      UPDATE patches SET
        title        = COALESCE($2, title),
        cve_id       = COALESCE($3, cve_id),
        severity     = COALESCE($4, severity),
        vendor       = COALESCE($5, vendor),
        product      = COALESCE($6, product),
        patch_url    = COALESCE($7, patch_url),
        release_date = COALESCE($8, release_date),
        description  = COALESCE($9, description)
      WHERE id = $1 RETURNING *
    `, [req.params.id, title, cve_id, severity, vendor, product, patch_url, release_date, description]);
    if (!r.rows.length) return res.status(404).json({ error: 'Patch not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/patches/:id — delete patch
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM patches WHERE id=$1', [req.params.id]);
    res.json({ message: 'Patch deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/patches/:id/assets — list asset_patches for this patch
router.get('/:id/assets', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        ap.*,
        a.ip_address, a.hostname, a.criticality, a.os_name,
        u.username AS applied_by_username, u.full_name AS applied_by_fullname
      FROM asset_patches ap
      JOIN assets a ON a.id = ap.asset_id
      LEFT JOIN users u ON u.id = ap.applied_by
      WHERE ap.patch_id = $1
      ORDER BY a.ip_address
    `, [req.params.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/patches/:id/assets — link asset to patch
router.post('/:id/assets', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { asset_id, status, notes } = req.body;
  if (!asset_id) return res.status(400).json({ error: 'asset_id is required' });
  try {
    const r = await db.query(`
      INSERT INTO asset_patches (asset_id, patch_id, status, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (asset_id, patch_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes  = EXCLUDED.notes
      RETURNING *
    `, [asset_id, req.params.id, status || 'pending', notes || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/patches/:id/assets/:assetId — update status/notes
router.patch('/:id/assets/:assetId', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { status, notes } = req.body;
  try {
    const r = await db.query(`
      UPDATE asset_patches SET
        status     = COALESCE($3, status),
        notes      = COALESCE($4, notes),
        applied_at = CASE WHEN $3 = 'applied' THEN NOW() ELSE applied_at END,
        applied_by = CASE WHEN $3 = 'applied' THEN $5 ELSE applied_by END
      WHERE patch_id = $1 AND asset_id = $2 RETURNING *
    `, [req.params.id, req.params.assetId, status || null, notes || null, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Asset-patch link not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/patches/:id/assets/:assetId — unlink
router.delete('/:id/assets/:assetId', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    await db.query('DELETE FROM asset_patches WHERE patch_id=$1 AND asset_id=$2', [req.params.id, req.params.assetId]);
    res.json({ message: 'Asset unlinked from patch' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
