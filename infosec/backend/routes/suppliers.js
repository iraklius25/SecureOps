const router   = require('express').Router();
const db       = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const auditLog = require('../services/auditLog');

const RISK_ORDER = `CASE risk_rating
  WHEN 'critical' THEN 1
  WHEN 'high'     THEN 2
  WHEN 'medium'   THEN 3
  WHEN 'low'      THEN 4
  ELSE 5
END`;

router.get('/', auth, async (_req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM suppliers ORDER BY ${RISK_ORDER}, name ASC`
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    name, supplier_type, contact_name, contact_email, website, country,
    risk_rating, status, contract_start, contract_end,
    data_processing_agreement, security_questionnaire_done,
    last_assessment_date, next_review_date,
    services_provided, data_shared, notes,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const r = await db.query(
      `INSERT INTO suppliers
         (name, supplier_type, contact_name, contact_email, website, country,
          risk_rating, status, contract_start, contract_end,
          data_processing_agreement, security_questionnaire_done,
          last_assessment_date, next_review_date,
          services_provided, data_shared, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        name.trim(),
        supplier_type              || null,
        contact_name               || null,
        contact_email              || null,
        website                    || null,
        country                    || null,
        risk_rating                || 'low',
        status                     || 'active',
        contract_start             || null,
        contract_end               || null,
        data_processing_agreement  ?? false,
        security_questionnaire_done ?? false,
        last_assessment_date       || null,
        next_review_date           || null,
        services_provided          || null,
        data_shared                || null,
        notes                      || null,
        req.user.id,
      ]
    );

    const created = r.rows[0];
    await auditLog.log(req, 'supplier.create', 'supplier', created.id, created.name, null, created);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    name, supplier_type, contact_name, contact_email, website, country,
    risk_rating, status, contract_start, contract_end,
    data_processing_agreement, security_questionnaire_done,
    last_assessment_date, next_review_date,
    services_provided, data_shared, notes,
  } = req.body;

  try {
    const old = await db.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Not found' });

    const r = await db.query(
      `UPDATE suppliers SET
         name=$1, supplier_type=$2, contact_name=$3, contact_email=$4, website=$5,
         country=$6, risk_rating=$7, status=$8, contract_start=$9, contract_end=$10,
         data_processing_agreement=$11, security_questionnaire_done=$12,
         last_assessment_date=$13, next_review_date=$14,
         services_provided=$15, data_shared=$16, notes=$17, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [
        name,
        supplier_type              || null,
        contact_name               || null,
        contact_email              || null,
        website                    || null,
        country                    || null,
        risk_rating                || 'low',
        status                     || 'active',
        contract_start             || null,
        contract_end               || null,
        data_processing_agreement  ?? false,
        security_questionnaire_done ?? false,
        last_assessment_date       || null,
        next_review_date           || null,
        services_provided          || null,
        data_shared                || null,
        notes                      || null,
        req.params.id,
      ]
    );

    const updated = r.rows[0];
    await auditLog.log(req, 'supplier.update', 'supplier', updated.id, updated.name, old.rows[0], updated);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });

    await db.query('DELETE FROM suppliers WHERE id=$1', [req.params.id]);
    await auditLog.log(req, 'supplier.delete', 'supplier', r.rows[0].id, r.rows[0].name, r.rows[0], null);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
