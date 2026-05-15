// risks.js
const router   = require('express').Router();
const db       = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const notifier = require('../services/notifier');

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
  const { title, description, category, asset_id, likelihood, impact, treatment, owner, eu_ai_act_tier, ai_system_id } = req.body;
  if (!title || !likelihood || !impact) return res.status(400).json({ error: 'title, likelihood, impact required' });
  try {
    const r = await db.query(`
      INSERT INTO risks (title,description,category,asset_id,likelihood,impact,treatment,owner,eu_ai_act_tier,ai_system_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [title,description,category,asset_id,likelihood,impact,treatment||'mitigate',owner||null,
        eu_ai_act_tier||null,ai_system_id||null]);
    const risk = r.rows[0];
    notifier.notifyNewRisk(risk).catch(() => {});
    // Record initial history entry
    const uname = await db.query('SELECT username FROM users WHERE id=$1', [req.user.id]);
    await db.query(`
      INSERT INTO risk_history (risk_id, changed_by, changed_by_name, risk_score, risk_level, likelihood, impact, treatment, status, change_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [risk.id, req.user.id, uname.rows[0]?.username || null,
        risk.risk_score, risk.risk_level, risk.likelihood, risk.impact,
        risk.treatment, risk.status || 'open', 'Risk registered']).catch(() => {});
    res.status(201).json(risk);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/risks/:id/history
router.get('/:id/history', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM risk_history WHERE risk_id=$1 ORDER BY changed_at ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const {
    status, treatment, likelihood, impact, review_date, eu_ai_act_tier, ai_system_id,
    title, description, category, owner, notes, change_note,
  } = req.body;
  try {
    const oldRow = await db.query('SELECT risk_level, title FROM risks WHERE id=$1', [req.params.id]);
    const oldLevel = oldRow.rows[0]?.risk_level;
    const r = await db.query(`
      UPDATE risks SET
        status=COALESCE($2,status),
        treatment=COALESCE($3,treatment),
        likelihood=COALESCE($4,likelihood),
        impact=COALESCE($5,impact),
        review_date=COALESCE($6,review_date),
        eu_ai_act_tier=COALESCE($7,eu_ai_act_tier),
        ai_system_id=COALESCE($8,ai_system_id),
        title=COALESCE($9,title),
        description=COALESCE($10,description),
        category=COALESCE($11,category),
        owner=COALESCE($12,owner),
        notes=COALESCE($13,notes),
        updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id, status, treatment, likelihood, impact,
        review_date || null, eu_ai_act_tier || null, ai_system_id || null,
        title || null, description || null, category || null,
        owner || null, notes || null]);
    if (!r.rows.length) return res.status(404).json({ error: 'Risk not found' });
    const updated = r.rows[0];

    // Record history
    const uname = await db.query('SELECT username FROM users WHERE id=$1', [req.user.id]);
    await db.query(`
      INSERT INTO risk_history (risk_id, changed_by, changed_by_name, risk_score, risk_level, likelihood, impact, treatment, status, change_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [req.params.id, req.user.id, uname.rows[0]?.username || null,
        updated.risk_score, updated.risk_level, updated.likelihood, updated.impact,
        updated.treatment, updated.status, change_note || null]).catch(() => {});

    const newLevel = updated.risk_level;
    if (oldLevel && newLevel && oldLevel !== newLevel) {
      const ragMap = { critical: 'red', high: 'amber', medium: 'amber', low: 'green' };
      notifier.notifyKpiChange(
        `Risk Level: ${updated.title}`,
        ragMap[oldLevel] || 'amber',
        ragMap[newLevel] || 'amber',
        `Level changed from ${oldLevel} to ${newLevel}`
      ).catch(() => {});
    }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const r = await db.query('DELETE FROM risks WHERE id=$1 RETURNING id', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Risk not found' });
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
