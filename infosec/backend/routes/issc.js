const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// ── Risk Appetite & Tolerance ─────────────────────────────────

router.get('/appetite', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM risk_appetite LIMIT 1');
    res.json(r.rows[0] || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/appetite', auth, requireRole('admin'), async (req, res) => {
  const {
    max_risk_score, tolerance_score,
    max_ale, tolerance_ale,
    max_open_critical,
    appetite_statement, tolerance_statement,
    approved_by, approval_date, review_frequency,
    category_appetites, notes,
  } = req.body;
  try {
    const ex = await db.query('SELECT id FROM risk_appetite LIMIT 1');
    let r;
    if (ex.rows.length) {
      r = await db.query(`
        UPDATE risk_appetite SET
          max_risk_score      = COALESCE($1,  max_risk_score),
          tolerance_score     = COALESCE($2,  tolerance_score),
          max_ale             = COALESCE($3,  max_ale),
          tolerance_ale       = COALESCE($4,  tolerance_ale),
          max_open_critical   = COALESCE($5,  max_open_critical),
          appetite_statement  = COALESCE($6,  appetite_statement),
          tolerance_statement = COALESCE($7,  tolerance_statement),
          approved_by         = COALESCE($8,  approved_by),
          approval_date       = COALESCE($9,  approval_date),
          review_frequency    = COALESCE($10, review_frequency),
          category_appetites  = COALESCE($11, category_appetites),
          notes               = COALESCE($12, notes),
          updated_at          = NOW()
        WHERE id = $13 RETURNING *
      `, [
        max_risk_score ?? null, tolerance_score ?? null,
        max_ale ?? null, tolerance_ale ?? null,
        max_open_critical ?? null,
        appetite_statement ?? null, tolerance_statement ?? null,
        approved_by ?? null, approval_date ?? null, review_frequency ?? null,
        category_appetites ? JSON.stringify(category_appetites) : null,
        notes ?? null,
        ex.rows[0].id,
      ]);
    } else {
      r = await db.query(`
        INSERT INTO risk_appetite
          (max_risk_score, tolerance_score, max_ale, tolerance_ale,
           max_open_critical, appetite_statement, tolerance_statement,
           approved_by, approval_date, review_frequency, category_appetites, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
      `, [
        max_risk_score || 12, tolerance_score || 15,
        max_ale || 100000, tolerance_ale || 250000,
        max_open_critical || 0,
        appetite_statement || '', tolerance_statement || '',
        approved_by || '', approval_date || null, review_frequency || 'annually',
        JSON.stringify(category_appetites || {}), notes || '',
      ]);
    }
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ISSC Members ──────────────────────────────────────────────

router.get('/members', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT * FROM issc_members
      ORDER BY
        CASE role WHEN 'Chair' THEN 1 WHEN 'Vice Chair' THEN 2
                  WHEN 'Secretary' THEN 3 ELSE 4 END,
        full_name
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/members', auth, requireRole('admin'), async (req, res) => {
  const { full_name, title, department, email, role, joined_date, notes } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });
  try {
    const r = await db.query(`
      INSERT INTO issc_members (full_name, title, department, email, role, joined_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [full_name, title||null, department||null, email||null,
        role||'Member', joined_date||null, notes||null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/members/:id', auth, requireRole('admin'), async (req, res) => {
  const { full_name, title, department, email, role, is_active, joined_date, notes } = req.body;
  try {
    const r = await db.query(`
      UPDATE issc_members SET
        full_name   = COALESCE($2, full_name),
        title       = COALESCE($3, title),
        department  = COALESCE($4, department),
        email       = COALESCE($5, email),
        role        = COALESCE($6, role),
        is_active   = COALESCE($7, is_active),
        joined_date = COALESCE($8, joined_date),
        notes       = COALESCE($9, notes),
        updated_at  = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, full_name||null, title||null, department||null,
        email||null, role||null, is_active??null, joined_date||null, notes||null]);
    if (!r.rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/members/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM issc_members WHERE id=$1', [req.params.id]);
    res.json({ message: 'Member removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ISSC Meetings ─────────────────────────────────────────────

router.get('/meetings', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT m.*, u.username AS created_by_username
      FROM issc_meetings m
      LEFT JOIN users u ON u.id = m.created_by
      ORDER BY m.meeting_date DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/meetings', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, meeting_date, meeting_type, status, location, chair,
          quorum_met, attendees, agenda, minutes, decisions,
          action_items, next_meeting_date } = req.body;
  if (!title || !meeting_date) return res.status(400).json({ error: 'title and meeting_date required' });
  try {
    const r = await db.query(`
      INSERT INTO issc_meetings
        (title, meeting_date, meeting_type, status, location, chair, quorum_met,
         attendees, agenda, minutes, decisions, action_items, next_meeting_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
    `, [title, meeting_date, meeting_type||'regular', status||'scheduled',
        location||null, chair||null, quorum_met??null, attendees||null,
        agenda||null, minutes||null, decisions||null, action_items||null,
        next_meeting_date||null, req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/meetings/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, meeting_date, meeting_type, status, location, chair,
          quorum_met, attendees, agenda, minutes, decisions,
          action_items, next_meeting_date } = req.body;
  try {
    const r = await db.query(`
      UPDATE issc_meetings SET
        title             = COALESCE($2,  title),
        meeting_date      = COALESCE($3,  meeting_date),
        meeting_type      = COALESCE($4,  meeting_type),
        status            = COALESCE($5,  status),
        location          = COALESCE($6,  location),
        chair             = COALESCE($7,  chair),
        quorum_met        = COALESCE($8,  quorum_met),
        attendees         = COALESCE($9,  attendees),
        agenda            = COALESCE($10, agenda),
        minutes           = COALESCE($11, minutes),
        decisions         = COALESCE($12, decisions),
        action_items      = COALESCE($13, action_items),
        next_meeting_date = COALESCE($14, next_meeting_date),
        updated_at        = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, title||null, meeting_date||null, meeting_type||null,
        status||null, location||null, chair||null, quorum_met??null,
        attendees||null, agenda||null, minutes||null, decisions||null,
        action_items||null, next_meeting_date||null]);
    if (!r.rows.length) return res.status(404).json({ error: 'Meeting not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/meetings/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM issc_meetings WHERE id=$1', [req.params.id]);
    res.json({ message: 'Meeting deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
