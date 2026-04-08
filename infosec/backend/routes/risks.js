// risks.js
const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT r.*, a.ip_address, a.hostname, u.username AS owner_name
      FROM risks r
      LEFT JOIN assets a ON a.id=r.asset_id
      LEFT JOIN users u ON u.id=r.owner
      ORDER BY r.risk_score DESC, r.created_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { title, description, category, asset_id, likelihood, impact, treatment, owner } = req.body;
  if (!title || !likelihood || !impact) return res.status(400).json({ error: 'title, likelihood, impact required' });
  try {
    const r = await db.query(`
      INSERT INTO risks (title,description,category,asset_id,likelihood,impact,treatment,owner)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [title,description,category,asset_id,likelihood,impact,treatment||'mitigate',owner||null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const { status, treatment, likelihood, impact, review_date } = req.body;
  try {
    const r = await db.query(`
      UPDATE risks SET status=COALESCE($2,status), treatment=COALESCE($3,treatment),
        likelihood=COALESCE($4,likelihood), impact=COALESCE($5,impact),
        review_date=COALESCE($6,review_date), updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id, status, treatment, likelihood, impact, review_date]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
