const router   = require('express').Router();
const db       = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const auditLog = require('../services/auditLog');

router.get('/', auth, async (req, res) => {
  const { deployment_status, eu_ai_act_tier } = req.query;
  const filters = []; const vals = [];

  if (deployment_status) {
    vals.push(deployment_status);
    filters.push(`a.deployment_status=$${vals.length}`);
  }
  if (eu_ai_act_tier) {
    vals.push(eu_ai_act_tier);
    filters.push(`a.eu_ai_act_tier=$${vals.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const r = await db.query(
      `SELECT a.*, s.name AS supplier_name
       FROM ai_systems a
       LEFT JOIN suppliers s ON s.id = a.supplier_id
       ${where}
       ORDER BY a.name ASC`,
      vals
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    name, version, ai_type, vendor, supplier_id, business_purpose,
    decision_role, uses_personal_data, eu_ai_act_tier, deployment_status,
    owner, owner_user_id, deployed_date, last_review_date, next_review_date,
    impact_assessed, notes,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const r = await db.query(
      `INSERT INTO ai_systems
         (name, version, ai_type, vendor, supplier_id, business_purpose,
          decision_role, uses_personal_data, eu_ai_act_tier, deployment_status,
          owner, owner_user_id, deployed_date, last_review_date, next_review_date,
          impact_assessed, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        name.trim(),
        version             || null,
        ai_type             || null,
        vendor              || null,
        supplier_id         || null,
        business_purpose    || null,
        decision_role       || null,
        uses_personal_data  ?? false,
        eu_ai_act_tier      || null,
        deployment_status   || 'development',
        owner               || null,
        owner_user_id       || null,
        deployed_date       || null,
        last_review_date    || null,
        next_review_date    || null,
        impact_assessed     ?? false,
        notes               || null,
        req.user.id,
      ]
    );

    const created = r.rows[0];
    await auditLog.log(req, 'ai_system.create', 'ai_system', created.id, created.name, null, created);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    name, version, ai_type, vendor, supplier_id, business_purpose,
    decision_role, uses_personal_data, eu_ai_act_tier, deployment_status,
    owner, owner_user_id, deployed_date, last_review_date, next_review_date,
    impact_assessed, notes,
  } = req.body;

  try {
    const old = await db.query('SELECT * FROM ai_systems WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });

    const r = await db.query(
      `UPDATE ai_systems SET
         name=$1, version=$2, ai_type=$3, vendor=$4, supplier_id=$5,
         business_purpose=$6, decision_role=$7, uses_personal_data=$8,
         eu_ai_act_tier=$9, deployment_status=$10, owner=$11, owner_user_id=$12,
         deployed_date=$13, last_review_date=$14, next_review_date=$15,
         impact_assessed=$16, notes=$17, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [
        name,
        version             || null,
        ai_type             || null,
        vendor              || null,
        supplier_id         || null,
        business_purpose    || null,
        decision_role       || null,
        uses_personal_data  ?? false,
        eu_ai_act_tier      || null,
        deployment_status   || 'development',
        owner               || null,
        owner_user_id       || null,
        deployed_date       || null,
        last_review_date    || null,
        next_review_date    || null,
        impact_assessed     ?? false,
        notes               || null,
        req.params.id,
      ]
    );

    const updated = r.rows[0];
    await auditLog.log(req, 'ai_system.update', 'ai_system', updated.id, updated.name, old.rows[0], updated);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/mark-assessed', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const r = await db.query(
      `UPDATE ai_systems SET
         impact_assessed=true, impact_assessed_at=NOW(), impact_assessed_by=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });

    const updated = r.rows[0];
    await auditLog.log(req, 'ai_system.mark_assessed', 'ai_system', updated.id, updated.name, null, { impact_assessed: true });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM ai_systems WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });

    await db.query('DELETE FROM ai_systems WHERE id=$1', [req.params.id]);
    await auditLog.log(req, 'ai_system.delete', 'ai_system', r.rows[0].id, r.rows[0].name, r.rows[0], null);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
