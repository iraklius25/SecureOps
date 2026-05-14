const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

/* ── Organizations ─────────────────────────────────────────────── */

router.get('/organizations', auth, async (req, res) => {
  try {
    const r = await db.query(`SELECT * FROM cert_organizations ORDER BY name`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/organizations', auth, requireRole('admin','analyst'), async (req, res) => {
  const { name, industry, contact, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const r = await db.query(
      `INSERT INTO cert_organizations (name, industry, contact, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), industry||null, contact||null, description||null, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/organizations/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const { name, industry, contact, description } = req.body;
  try {
    const r = await db.query(
      `UPDATE cert_organizations SET name=$1, industry=$2, contact=$3, description=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, industry||null, contact||null, description||null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/organizations/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query(`DELETE FROM cert_organizations WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Framework Requirements ────────────────────────────────────── */

router.get('/requirements/:framework', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM cert_requirements WHERE framework=$1 ORDER BY sort_order, req_id`,
      [req.params.framework.toUpperCase()]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Timeline (standalone routes — must precede /:id) ─────────── */

router.put('/timeline/:eventId', auth, requireRole('admin','analyst'), async (req, res) => {
  const { title, description, event_date, status, event_type } = req.body;
  try {
    const r = await db.query(
      `UPDATE cert_timeline_events SET title=$1, description=$2, event_date=$3, status=$4, event_type=$5
       WHERE id=$6 RETURNING *`,
      [title, description||null, event_date, status||'planned', event_type||'milestone', req.params.eventId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/timeline/:eventId', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    await db.query(`DELETE FROM cert_timeline_events WHERE id=$1`, [req.params.eventId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Workflow Steps (must precede /workflows/:wfId) ────────────── */

router.put('/workflows/steps/:stepId', auth, requireRole('admin','analyst'), async (req, res) => {
  const { title, description, assignee, due_date, status, notes, step_number } = req.body;
  try {
    const r = await db.query(
      `UPDATE cert_workflow_steps
       SET title=$1, description=$2, assignee=$3, due_date=$4, status=$5, notes=$6,
           step_number=$7,
           completed_at = CASE WHEN $5='completed' AND completed_at IS NULL THEN NOW()
                               WHEN $5 != 'completed' THEN NULL
                               ELSE completed_at END,
           updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, description||null, assignee||null, due_date||null,
       status||'pending', notes||null, step_number||1, req.params.stepId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/workflows/steps/:stepId', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    await db.query(`DELETE FROM cert_workflow_steps WHERE id=$1`, [req.params.stepId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workflows/:wfId/steps', auth, requireRole('admin','analyst'), async (req, res) => {
  const { title, description, assignee, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  try {
    const max = await db.query(
      `SELECT COALESCE(MAX(step_number),0) AS mx FROM cert_workflow_steps WHERE workflow_id=$1`,
      [req.params.wfId]
    );
    const r = await db.query(
      `INSERT INTO cert_workflow_steps (workflow_id, step_number, title, description, assignee, due_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.wfId, max.rows[0].mx + 1, title.trim(), description||null, assignee||null, due_date||null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/workflows/:wfId', auth, requireRole('admin','analyst'), async (req, res) => {
  const { name, description, status } = req.body;
  try {
    const r = await db.query(
      `UPDATE cert_workflows SET name=$1, description=$2, status=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [name, description||null, status||'active', req.params.wfId]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/workflows/:wfId', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    await db.query(`DELETE FROM cert_workflows WHERE id=$1`, [req.params.wfId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Certifications (CRUD — /:id routes last) ──────────────────── */

router.get('/', auth, async (req, res) => {
  const { org_id, framework } = req.query;
  try {
    let q = `SELECT c.*, o.name AS org_name, o.industry AS org_industry
             FROM certifications c LEFT JOIN cert_organizations o ON o.id = c.org_id WHERE 1=1`;
    const p = [];
    if (org_id)    { p.push(org_id);    q += ` AND c.org_id=$${p.length}`; }
    if (framework) { p.push(framework); q += ` AND c.framework=$${p.length}`; }
    q += ' ORDER BY c.updated_at DESC';
    const r = await db.query(q, p);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { org_id, framework, name, scope, phase, target_date, auditor, owner, notes } = req.body;
  if (!framework || !name?.trim()) return res.status(400).json({ error: 'framework and name required' });
  try {
    const r = await db.query(
      `INSERT INTO certifications (org_id, framework, name, scope, phase, target_date, auditor, owner, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [org_id||null, framework, name.trim(), scope||null, phase||'planning',
       target_date||null, auditor||null, owner||null, notes||null, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT c.*, o.name AS org_name FROM certifications c
       LEFT JOIN cert_organizations o ON o.id = c.org_id WHERE c.id=$1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  const { org_id, framework, name, scope, phase, target_date, certified_date,
          expiry_date, auditor, owner, status, completion_pct, notes } = req.body;
  try {
    const r = await db.query(
      `UPDATE certifications SET
         org_id=$1, framework=$2, name=$3, scope=$4, phase=$5, target_date=$6,
         certified_date=$7, expiry_date=$8, auditor=$9, owner=$10, status=$11,
         completion_pct=$12, notes=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [org_id||null, framework, name, scope||null, phase||'planning', target_date||null,
       certified_date||null, expiry_date||null, auditor||null, owner||null,
       status||'active', completion_pct||0, notes||null, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query(`DELETE FROM certifications WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Per-certification sub-resources ───────────────────────────── */

router.get('/:id/requirements', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT cr.*, resp.id AS resp_id, resp.status AS resp_status,
              resp.response, resp.evidence_notes, resp.assignee,
              resp.due_date, resp.completed_date, resp.notes AS resp_notes,
              resp.updated_at AS resp_updated
       FROM cert_requirements cr
       JOIN certifications c ON c.framework = cr.framework AND c.id = $1
       LEFT JOIN cert_req_responses resp
         ON resp.requirement_id = cr.id AND resp.certification_id = $1
       ORDER BY cr.sort_order, cr.req_id`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/requirements/:reqId', auth, requireRole('admin','analyst'), async (req, res) => {
  const { status, response, evidence_notes, assignee, due_date, completed_date, notes } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO cert_req_responses
         (certification_id, requirement_id, status, response, evidence_notes, assignee, due_date, completed_date, notes, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (certification_id, requirement_id) DO UPDATE
         SET status=$3, response=$4, evidence_notes=$5, assignee=$6, due_date=$7,
             completed_date=$8, notes=$9, updated_by=$10, updated_at=NOW()
       RETURNING *`,
      [req.params.id, req.params.reqId, status||'not_assessed', response||null,
       evidence_notes||null, assignee||null, due_date||null, completed_date||null,
       notes||null, req.user.id]
    );
    // Recalculate completion %
    await db.query(`
      UPDATE certifications SET
        completion_pct = (
          SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE resp.status='compliant') /
                 NULLIF(COUNT(*),0)), 0)
          FROM cert_requirements cr
          LEFT JOIN cert_req_responses resp
            ON resp.requirement_id = cr.id AND resp.certification_id = $1
          WHERE cr.framework = (SELECT framework FROM certifications WHERE id = $1)
        ), updated_at = NOW()
      WHERE id = $1
    `, [req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/timeline', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT e.*, u.username, u.full_name
       FROM cert_timeline_events e LEFT JOIN users u ON u.id = e.created_by
       WHERE e.certification_id=$1 ORDER BY e.event_date DESC, e.created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/timeline', auth, requireRole('admin','analyst'), async (req, res) => {
  const { event_type, title, description, event_date, status } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  try {
    const r = await db.query(
      `INSERT INTO cert_timeline_events (certification_id, event_type, title, description, event_date, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, event_type||'milestone', title.trim(), description||null,
       event_date||new Date().toISOString().slice(0,10), status||'planned', req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/workflows', auth, async (req, res) => {
  try {
    const wfs = await db.query(
      `SELECT * FROM cert_workflows WHERE certification_id=$1 ORDER BY created_at`,
      [req.params.id]
    );
    for (const wf of wfs.rows) {
      const steps = await db.query(
        `SELECT * FROM cert_workflow_steps WHERE workflow_id=$1 ORDER BY step_number`,
        [wf.id]
      );
      wf.steps = steps.rows;
    }
    res.json(wfs.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/workflows', auth, requireRole('admin','analyst'), async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const r = await db.query(
      `INSERT INTO cert_workflows (certification_id, name, description, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, name.trim(), description||null, req.user.id]
    );
    r.rows[0].steps = [];
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
