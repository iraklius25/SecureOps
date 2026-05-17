const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const WRITE = [auth, requireRole('admin', 'analyst')];

/* ── Plans ──────────────────────────────────────────────────────── */

router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.*,
             o.name AS org_name,
             (SELECT COUNT(*) FROM drp_systems  s WHERE s.plan_id = p.id) AS system_count,
             (SELECT COUNT(*) FROM drp_runbooks b WHERE b.plan_id = p.id) AS runbook_count,
             (SELECT COUNT(*) FROM drp_tests    t WHERE t.plan_id = p.id) AS test_count
        FROM drp_plans p
        LEFT JOIN cert_organizations o ON o.id = p.org_id
       ORDER BY p.created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', ...WRITE, async (req, res) => {
  const {
    org_id, name, version, scope, dr_site, dr_site_type, status, classification,
    owner, approved_by, approved_date, review_date, next_test_date, last_tested,
    test_result, overall_rto_hours, overall_rpo_hours, activation_criteria,
    escalation_contacts, notes,
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.query(`
      INSERT INTO drp_plans
        (org_id, name, version, scope, dr_site, dr_site_type, status, classification,
         owner, approved_by, approved_date, review_date, next_test_date, last_tested,
         test_result, overall_rto_hours, overall_rpo_hours, activation_criteria,
         escalation_contacts, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        org_id || null, name.trim(), version || '1.0', scope || null,
        dr_site || null, dr_site_type || 'cold', status || 'draft',
        classification || 'confidential', owner || null, approved_by || null,
        approved_date || null, review_date || null, next_test_date || null,
        last_tested || null, test_result || null,
        overall_rto_hours || null, overall_rpo_hours || null,
        activation_criteria || null,
        escalation_contacts ? JSON.stringify(escalation_contacts) : '[]',
        notes || null, req.user.id,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT p.*, o.name AS org_name
        FROM drp_plans p
        LEFT JOIN cert_organizations o ON o.id = p.org_id
       WHERE p.id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', ...WRITE, async (req, res) => {
  const {
    org_id, name, version, scope, dr_site, dr_site_type, status, classification,
    owner, approved_by, approved_date, review_date, next_test_date, last_tested,
    test_result, overall_rto_hours, overall_rpo_hours, activation_criteria,
    escalation_contacts, notes,
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.query(`
      UPDATE drp_plans SET
        org_id=$1, name=$2, version=$3, scope=$4, dr_site=$5, dr_site_type=$6,
        status=$7, classification=$8, owner=$9, approved_by=$10, approved_date=$11,
        review_date=$12, next_test_date=$13, last_tested=$14, test_result=$15,
        overall_rto_hours=$16, overall_rpo_hours=$17, activation_criteria=$18,
        escalation_contacts=$19, notes=$20, updated_at=NOW()
      WHERE id=$21 RETURNING *`,
      [
        org_id || null, name.trim(), version || '1.0', scope || null,
        dr_site || null, dr_site_type || 'cold', status || 'draft',
        classification || 'confidential', owner || null, approved_by || null,
        approved_date || null, review_date || null, next_test_date || null,
        last_tested || null, test_result || null,
        overall_rto_hours || null, overall_rpo_hours || null,
        activation_criteria || null,
        escalation_contacts ? JSON.stringify(escalation_contacts) : '[]',
        notes || null, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM drp_plans WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Systems ────────────────────────────────────────────────────── */

router.get('/:id/systems', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM drp_systems WHERE plan_id=$1 ORDER BY recovery_priority ASC, created_at ASC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/systems', ...WRITE, async (req, res) => {
  const {
    system_name, system_type, criticality, rto_hours, rpo_hours, recovery_priority,
    recovery_procedure, responsible_team, backup_location, backup_frequency,
    dr_site_target, dependencies, notes,
  } = req.body;
  if (!system_name?.trim()) return res.status(400).json({ error: 'system_name is required' });
  try {
    const r = await db.query(`
      INSERT INTO drp_systems
        (plan_id, system_name, system_type, criticality, rto_hours, rpo_hours, recovery_priority,
         recovery_procedure, responsible_team, backup_location, backup_frequency,
         dr_site_target, dependencies, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        req.params.id, system_name.trim(), system_type || 'application',
        criticality || 'medium', rto_hours || null, rpo_hours || null,
        recovery_priority ?? 0, recovery_procedure || null, responsible_team || null,
        backup_location || null, backup_frequency || null, dr_site_target || null,
        dependencies || null, notes || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/systems/:sid', ...WRITE, async (req, res) => {
  const {
    system_name, system_type, criticality, rto_hours, rpo_hours, recovery_priority,
    recovery_procedure, responsible_team, backup_location, backup_frequency,
    dr_site_target, dependencies, notes,
  } = req.body;
  if (!system_name?.trim()) return res.status(400).json({ error: 'system_name is required' });
  try {
    const r = await db.query(`
      UPDATE drp_systems SET
        system_name=$1, system_type=$2, criticality=$3, rto_hours=$4, rpo_hours=$5,
        recovery_priority=$6, recovery_procedure=$7, responsible_team=$8,
        backup_location=$9, backup_frequency=$10, dr_site_target=$11,
        dependencies=$12, notes=$13, updated_at=NOW()
      WHERE id=$14 AND plan_id=$15 RETURNING *`,
      [
        system_name.trim(), system_type || 'application', criticality || 'medium',
        rto_hours || null, rpo_hours || null, recovery_priority ?? 0,
        recovery_procedure || null, responsible_team || null, backup_location || null,
        backup_frequency || null, dr_site_target || null, dependencies || null,
        notes || null, req.params.sid, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/systems/:sid', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM drp_systems WHERE id=$1 AND plan_id=$2', [req.params.sid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Runbooks ───────────────────────────────────────────────────── */

router.get('/:id/runbooks', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM drp_runbooks WHERE plan_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/runbooks', ...WRITE, async (req, res) => {
  const {
    title, scenario, steps, responsible_role, estimated_hours,
    prerequisites, rollback_procedure, last_reviewed, version,
  } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const r = await db.query(`
      INSERT INTO drp_runbooks
        (plan_id, title, scenario, steps, responsible_role, estimated_hours,
         prerequisites, rollback_procedure, last_reviewed, version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        req.params.id, title.trim(), scenario || null,
        steps ? JSON.stringify(steps) : '[]',
        responsible_role || null, estimated_hours || null,
        prerequisites || null, rollback_procedure || null,
        last_reviewed || null, version || '1.0',
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/runbooks/:rid', ...WRITE, async (req, res) => {
  const {
    title, scenario, steps, responsible_role, estimated_hours,
    prerequisites, rollback_procedure, last_reviewed, version,
  } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  try {
    const r = await db.query(`
      UPDATE drp_runbooks SET
        title=$1, scenario=$2, steps=$3, responsible_role=$4, estimated_hours=$5,
        prerequisites=$6, rollback_procedure=$7, last_reviewed=$8, version=$9, updated_at=NOW()
      WHERE id=$10 AND plan_id=$11 RETURNING *`,
      [
        title.trim(), scenario || null,
        steps ? JSON.stringify(steps) : '[]',
        responsible_role || null, estimated_hours || null,
        prerequisites || null, rollback_procedure || null,
        last_reviewed || null, version || '1.0',
        req.params.rid, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/runbooks/:rid', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM drp_runbooks WHERE id=$1 AND plan_id=$2', [req.params.rid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Tests ──────────────────────────────────────────────────────── */

router.get('/:id/tests', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM drp_tests WHERE plan_id=$1 ORDER BY test_date DESC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/tests', ...WRITE, async (req, res) => {
  const {
    test_name, test_type, test_date, participants, scenario, rto_target_hours,
    rpo_target_hours, rto_achieved_hours, rpo_achieved_hours, result,
    findings, actions_required, lessons_learned, next_test_date,
  } = req.body;
  if (!test_name?.trim()) return res.status(400).json({ error: 'test_name is required' });
  if (!test_date)         return res.status(400).json({ error: 'test_date is required' });
  try {
    const r = await db.query(`
      INSERT INTO drp_tests
        (plan_id, test_name, test_type, test_date, participants, scenario,
         rto_target_hours, rpo_target_hours, rto_achieved_hours, rpo_achieved_hours,
         result, findings, actions_required, lessons_learned, next_test_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        req.params.id, test_name.trim(), test_type || 'tabletop', test_date,
        participants || null, scenario || null, rto_target_hours || null,
        rpo_target_hours || null, rto_achieved_hours || null, rpo_achieved_hours || null,
        result || 'not_tested', findings || null, actions_required || null,
        lessons_learned || null, next_test_date || null, req.user.id,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/tests/:tid', ...WRITE, async (req, res) => {
  const {
    test_name, test_type, test_date, participants, scenario, rto_target_hours,
    rpo_target_hours, rto_achieved_hours, rpo_achieved_hours, result,
    findings, actions_required, lessons_learned, next_test_date,
  } = req.body;
  if (!test_name?.trim()) return res.status(400).json({ error: 'test_name is required' });
  if (!test_date)         return res.status(400).json({ error: 'test_date is required' });
  try {
    const r = await db.query(`
      UPDATE drp_tests SET
        test_name=$1, test_type=$2, test_date=$3, participants=$4, scenario=$5,
        rto_target_hours=$6, rpo_target_hours=$7, rto_achieved_hours=$8,
        rpo_achieved_hours=$9, result=$10, findings=$11, actions_required=$12,
        lessons_learned=$13, next_test_date=$14, updated_at=NOW()
      WHERE id=$15 AND plan_id=$16 RETURNING *`,
      [
        test_name.trim(), test_type || 'tabletop', test_date,
        participants || null, scenario || null, rto_target_hours || null,
        rpo_target_hours || null, rto_achieved_hours || null, rpo_achieved_hours || null,
        result || 'not_tested', findings || null, actions_required || null,
        lessons_learned || null, next_test_date || null,
        req.params.tid, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/tests/:tid', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM drp_tests WHERE id=$1 AND plan_id=$2', [req.params.tid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
