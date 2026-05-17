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
             (SELECT COUNT(*) FROM bcp_bia        b WHERE b.plan_id = p.id) AS bia_count,
             (SELECT COUNT(*) FROM bcp_strategies s WHERE s.plan_id = p.id) AS strategy_count,
             (SELECT COUNT(*) FROM bcp_tests      t WHERE t.plan_id = p.id) AS test_count
        FROM bcp_plans p
        LEFT JOIN cert_organizations o ON o.id = p.org_id
       ORDER BY p.created_at DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', ...WRITE, async (req, res) => {
  const {
    org_id, name, version, scope, objectives, status, classification,
    owner, approved_by, approved_date, review_date, next_test_date,
    last_tested, test_result, iso_clause_ref, frameworks, notes,
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.query(`
      INSERT INTO bcp_plans
        (org_id, name, version, scope, objectives, status, classification, owner,
         approved_by, approved_date, review_date, next_test_date, last_tested,
         test_result, iso_clause_ref, frameworks, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        org_id || null, name.trim(), version || '1.0', scope || null,
        objectives || null, status || 'draft', classification || 'confidential',
        owner || null, approved_by || null, approved_date || null,
        review_date || null, next_test_date || null, last_tested || null,
        test_result || null, iso_clause_ref || null,
        frameworks ? (Array.isArray(frameworks) ? frameworks : [frameworks]) : null,
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
        FROM bcp_plans p
        LEFT JOIN cert_organizations o ON o.id = p.org_id
       WHERE p.id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', ...WRITE, async (req, res) => {
  const {
    org_id, name, version, scope, objectives, status, classification,
    owner, approved_by, approved_date, review_date, next_test_date,
    last_tested, test_result, iso_clause_ref, frameworks, notes,
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.query(`
      UPDATE bcp_plans SET
        org_id=$1, name=$2, version=$3, scope=$4, objectives=$5, status=$6,
        classification=$7, owner=$8, approved_by=$9, approved_date=$10,
        review_date=$11, next_test_date=$12, last_tested=$13, test_result=$14,
        iso_clause_ref=$15, frameworks=$16, notes=$17, updated_at=NOW()
      WHERE id=$18 RETURNING *`,
      [
        org_id || null, name.trim(), version || '1.0', scope || null,
        objectives || null, status || 'draft', classification || 'confidential',
        owner || null, approved_by || null, approved_date || null,
        review_date || null, next_test_date || null, last_tested || null,
        test_result || null, iso_clause_ref || null,
        frameworks ? (Array.isArray(frameworks) ? frameworks : [frameworks]) : null,
        notes || null, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM bcp_plans WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── BIA ────────────────────────────────────────────────────────── */

router.get('/:id/bia', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM bcp_bia WHERE plan_id=$1 ORDER BY priority_order ASC, created_at ASC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/bia', ...WRITE, async (req, res) => {
  const {
    process_name, department, criticality, rto_hours, rpo_hours, mtpd_hours,
    mbco, dependencies, impacts_financial, impacts_operational,
    impacts_reputational, impacts_regulatory, priority_order, notes,
  } = req.body;
  if (!process_name?.trim()) return res.status(400).json({ error: 'process_name is required' });
  try {
    const r = await db.query(`
      INSERT INTO bcp_bia
        (plan_id, process_name, department, criticality, rto_hours, rpo_hours, mtpd_hours,
         mbco, dependencies, impacts_financial, impacts_operational,
         impacts_reputational, impacts_regulatory, priority_order, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        req.params.id, process_name.trim(), department || null,
        criticality || 'medium', rto_hours || null, rpo_hours || null, mtpd_hours || null,
        mbco || null, dependencies || null, impacts_financial || null,
        impacts_operational || null, impacts_reputational || null,
        impacts_regulatory || null, priority_order ?? 0, notes || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/bia/:bid', ...WRITE, async (req, res) => {
  const {
    process_name, department, criticality, rto_hours, rpo_hours, mtpd_hours,
    mbco, dependencies, impacts_financial, impacts_operational,
    impacts_reputational, impacts_regulatory, priority_order, notes,
  } = req.body;
  if (!process_name?.trim()) return res.status(400).json({ error: 'process_name is required' });
  try {
    const r = await db.query(`
      UPDATE bcp_bia SET
        process_name=$1, department=$2, criticality=$3, rto_hours=$4, rpo_hours=$5,
        mtpd_hours=$6, mbco=$7, dependencies=$8, impacts_financial=$9,
        impacts_operational=$10, impacts_reputational=$11, impacts_regulatory=$12,
        priority_order=$13, notes=$14, updated_at=NOW()
      WHERE id=$15 AND plan_id=$16 RETURNING *`,
      [
        process_name.trim(), department || null, criticality || 'medium',
        rto_hours || null, rpo_hours || null, mtpd_hours || null,
        mbco || null, dependencies || null, impacts_financial || null,
        impacts_operational || null, impacts_reputational || null,
        impacts_regulatory || null, priority_order ?? 0, notes || null,
        req.params.bid, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/bia/:bid', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM bcp_bia WHERE id=$1 AND plan_id=$2', [req.params.bid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Strategies ─────────────────────────────────────────────────── */

router.get('/:id/strategies', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM bcp_strategies WHERE plan_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/strategies', ...WRITE, async (req, res) => {
  const {
    strategy_name, strategy_type, description, resources_required,
    responsible_party, cost_estimate, status, notes,
  } = req.body;
  if (!strategy_name?.trim()) return res.status(400).json({ error: 'strategy_name is required' });
  try {
    const r = await db.query(`
      INSERT INTO bcp_strategies
        (plan_id, strategy_name, strategy_type, description, resources_required,
         responsible_party, cost_estimate, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.params.id, strategy_name.trim(), strategy_type || 'operational',
        description || null, resources_required || null, responsible_party || null,
        cost_estimate != null ? cost_estimate : null, status || 'proposed', notes || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/strategies/:sid', ...WRITE, async (req, res) => {
  const {
    strategy_name, strategy_type, description, resources_required,
    responsible_party, cost_estimate, status, notes,
  } = req.body;
  if (!strategy_name?.trim()) return res.status(400).json({ error: 'strategy_name is required' });
  try {
    const r = await db.query(`
      UPDATE bcp_strategies SET
        strategy_name=$1, strategy_type=$2, description=$3, resources_required=$4,
        responsible_party=$5, cost_estimate=$6, status=$7, notes=$8, updated_at=NOW()
      WHERE id=$9 AND plan_id=$10 RETURNING *`,
      [
        strategy_name.trim(), strategy_type || 'operational', description || null,
        resources_required || null, responsible_party || null,
        cost_estimate != null ? cost_estimate : null, status || 'proposed',
        notes || null, req.params.sid, req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/strategies/:sid', ...WRITE, async (req, res) => {
  try {
    await db.query('DELETE FROM bcp_strategies WHERE id=$1 AND plan_id=$2', [req.params.sid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Tests ──────────────────────────────────────────────────────── */

router.get('/:id/tests', auth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM bcp_tests WHERE plan_id=$1 ORDER BY test_date DESC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/tests', ...WRITE, async (req, res) => {
  const {
    test_name, test_type, test_date, participants, scenario, objectives,
    result, findings, actions_required, lessons_learned, next_test_date,
  } = req.body;
  if (!test_name?.trim()) return res.status(400).json({ error: 'test_name is required' });
  if (!test_date)         return res.status(400).json({ error: 'test_date is required' });
  try {
    const r = await db.query(`
      INSERT INTO bcp_tests
        (plan_id, test_name, test_type, test_date, participants, scenario, objectives,
         result, findings, actions_required, lessons_learned, next_test_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        req.params.id, test_name.trim(), test_type || 'tabletop', test_date,
        participants || null, scenario || null, objectives || null,
        result || 'not_tested', findings || null, actions_required || null,
        lessons_learned || null, next_test_date || null, req.user.id,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/tests/:tid', ...WRITE, async (req, res) => {
  const {
    test_name, test_type, test_date, participants, scenario, objectives,
    result, findings, actions_required, lessons_learned, next_test_date,
  } = req.body;
  if (!test_name?.trim()) return res.status(400).json({ error: 'test_name is required' });
  if (!test_date)         return res.status(400).json({ error: 'test_date is required' });
  try {
    const r = await db.query(`
      UPDATE bcp_tests SET
        test_name=$1, test_type=$2, test_date=$3, participants=$4, scenario=$5, objectives=$6,
        result=$7, findings=$8, actions_required=$9, lessons_learned=$10,
        next_test_date=$11, updated_at=NOW()
      WHERE id=$12 AND plan_id=$13 RETURNING *`,
      [
        test_name.trim(), test_type || 'tabletop', test_date,
        participants || null, scenario || null, objectives || null,
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
    await db.query('DELETE FROM bcp_tests WHERE id=$1 AND plan_id=$2', [req.params.tid, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
