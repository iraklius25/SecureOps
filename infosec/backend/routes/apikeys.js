const router  = require('express').Router();
const crypto  = require('crypto');
const db      = require('../db');
const { auth } = require('../middleware/auth');

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// GET /api/apikeys  — list current user's keys
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT id, name, key_prefix, scopes, last_used, expires_at, is_active, created_at
      FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC
    `, [req.user.id]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/apikeys  — create new key
router.post('/', auth, async (req, res) => {
  const { name, scopes = ['read'], expires_in_days } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const rawKey   = 'sk_' + crypto.randomBytes(32).toString('hex');
    const keyHash  = hashKey(rawKey);
    const prefix   = rawKey.slice(0, 12);
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000)
      : null;

    const r = await db.query(`
      INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, key_prefix, scopes, expires_at, created_at
    `, [req.user.id, name, keyHash, prefix, scopes, expiresAt]);

    // Return raw key only once
    res.status(201).json({ ...r.rows[0], key: rawKey, message: 'Copy this key — it will not be shown again.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/apikeys/:id  — revoke key
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await db.query(
      `DELETE FROM api_keys WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/apikeys/:id  — toggle active
router.patch('/:id', auth, async (req, res) => {
  const { is_active } = req.body;
  try {
    const r = await db.query(
      `UPDATE api_keys SET is_active=$2 WHERE id=$1 AND user_id=$3 RETURNING id, is_active`,
      [req.params.id, is_active, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
