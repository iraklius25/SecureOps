const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/groups — list all groups with member counts
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT g.*,
        u.username AS created_by_username,
        COUNT(DISTINCT gu.user_id)  AS user_count,
        COUNT(DISTINCT ga.asset_id) AS asset_count
      FROM groups g
      LEFT JOIN users u ON u.id = g.created_by
      LEFT JOIN group_users  gu ON gu.group_id = g.id
      LEFT JOIN group_assets ga ON ga.group_id = g.id
      GROUP BY g.id, u.username
      ORDER BY g.created_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/groups — create group (admin only)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await db.query(
      `INSERT INTO groups (name, description, color, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description, color || '#1f6feb', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Group name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/groups/:id — group detail + members
router.get('/:id', auth, async (req, res) => {
  try {
    const g = await db.query('SELECT * FROM groups WHERE id=$1', [req.params.id]);
    if (!g.rows.length) return res.status(404).json({ error: 'Group not found' });

    const users = await db.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.department, u.is_active, gu.added_at
      FROM group_users gu
      JOIN users u ON u.id = gu.user_id
      WHERE gu.group_id = $1
      ORDER BY gu.added_at DESC
    `, [req.params.id]);

    const assets = await db.query(`
      SELECT a.id, a.ip_address, a.hostname, a.asset_type, a.criticality, a.status, ga.added_at
      FROM group_assets ga
      JOIN assets a ON a.id = ga.asset_id
      WHERE ga.group_id = $1
      ORDER BY ga.added_at DESC
    `, [req.params.id]);

    res.json({ ...g.rows[0], users: users.rows, assets: assets.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/groups/:id — update (admin only)
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, description, color } = req.body;
  try {
    const r = await db.query(
      `UPDATE groups SET name=COALESCE($2,name), description=COALESCE($3,description), color=COALESCE($4,color)
       WHERE id=$1 RETURNING *`,
      [req.params.id, name, description, color]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Group not found' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Group name already exists' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/groups/:id (admin only)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('DELETE FROM groups WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Group not found' });
    res.json({ message: 'Group deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/groups/:id/users — add user to group (admin)
router.post('/:id/users', auth, requireRole('admin'), async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    await db.query(
      'INSERT INTO group_users (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    res.status(201).json({ message: 'User added to group' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/groups/:id/users/:userId (admin)
router.delete('/:id/users/:userId', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM group_users WHERE group_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
    res.json({ message: 'User removed from group' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/groups/:id/assets — add asset to group (admin, analyst)
router.post('/:id/assets', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { asset_id } = req.body;
  if (!asset_id) return res.status(400).json({ error: 'asset_id required' });
  try {
    await db.query(
      'INSERT INTO group_assets (group_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, asset_id]
    );
    res.status(201).json({ message: 'Asset added to group' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/groups/:id/assets/:assetId (admin, analyst)
router.delete('/:id/assets/:assetId', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    await db.query('DELETE FROM group_assets WHERE group_id=$1 AND asset_id=$2', [req.params.id, req.params.assetId]);
    res.json({ message: 'Asset removed from group' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
