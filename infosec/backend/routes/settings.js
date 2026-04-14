const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/settings  — all settings (admin only)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT key, value, description, updated_at FROM settings ORDER BY key');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/settings  — update one or more settings
router.patch('/', auth, requireRole('admin'), async (req, res) => {
  const updates = req.body; // { key: value, ... }
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Body must be a key-value object' });
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ($1,$2,NOW())
        ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
      `, [key, String(value)]);
    }
    const r = await db.query('SELECT key, value, description, updated_at FROM settings ORDER BY key');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/test-webhook  — send a test notification
router.post('/test-webhook', auth, requireRole('admin'), async (req, res) => {
  const { type } = req.body; // 'slack' or 'teams'
  try {
    const r    = await db.query('SELECT key, value FROM settings WHERE key IN ($1)', [type === 'slack' ? 'slack_webhook_url' : 'teams_webhook_url']);
    const url  = r.rows[0]?.value;
    if (!url) return res.status(400).json({ error: 'Webhook URL not configured' });

    const payload = type === 'slack'
      ? JSON.stringify({ attachments: [{ color: '#3fb950', title: 'SecureOps Test', text: 'Webhook is working correctly!', footer: 'SecureOps', ts: Math.floor(Date.now()/1000) }] })
      : JSON.stringify({ '@type': 'MessageCard', '@context': 'http://schema.org/extensions', themeColor: '3fb950', summary: 'SecureOps Test', sections: [{ activityTitle: 'SecureOps Test', activityText: 'Webhook is working correctly!' }] });

    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    if (!resp.ok) return res.status(400).json({ error: `Webhook returned ${resp.status}` });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/settings/scheduled-reports
router.get('/scheduled-reports', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT sr.*, u.username AS created_by_user
      FROM scheduled_reports sr
      LEFT JOIN users u ON u.id = sr.created_by
      ORDER BY sr.created_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/settings/scheduled-reports
router.post('/scheduled-reports', auth, requireRole('admin'), async (req, res) => {
  const { name, report_type, format = 'csv', schedule } = req.body;
  if (!name || !report_type || !schedule) return res.status(400).json({ error: 'name, report_type, schedule required' });
  try {
    const nextRun = computeNextRun(schedule);
    const r = await db.query(`
      INSERT INTO scheduled_reports (name, report_type, format, schedule, next_run, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [name, report_type, format, schedule, nextRun, req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/settings/scheduled-reports/:id
router.delete('/scheduled-reports/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM scheduled_reports WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function computeNextRun(schedule) {
  const now = new Date();
  if (schedule === 'daily')   { const d = new Date(now); d.setDate(d.getDate()+1); d.setHours(6,0,0,0); return d; }
  if (schedule === 'weekly')  { const d = new Date(now); d.setDate(d.getDate()+(7-d.getDay())); d.setHours(6,0,0,0); return d; }
  if (schedule === 'monthly') { const d = new Date(now.getFullYear(), now.getMonth()+1, 1, 6, 0, 0); return d; }
  return null;
}

module.exports = router;
