const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const logger = require('../services/logger');

// ── ICS calendar helper ───────────────────────────────────────
function buildICS(meeting) {
  const d = new Date(meeting.meeting_date);
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
  const ymdNext = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp   = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const esc = s => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const desc = [
    meeting.agenda   ? `Agenda:\\n${esc(meeting.agenda)}` : null,
    meeting.location ? `Location: ${esc(meeting.location)}` : null,
    meeting.chair    ? `Chair: ${esc(meeting.chair)}` : null,
  ].filter(Boolean).join('\\n\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SecureOps//ISSC//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:issc-${meeting.id}-${stamp}@secureops`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${ymdNext}`,
    `SUMMARY:${esc(meeting.title)}`,
    meeting.location ? `LOCATION:${esc(meeting.location)}` : null,
    desc ? `DESCRIPTION:${desc}` : null,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// ── Send meeting invitations with .ics attachment ──────────────
async function sendMeetingInvitations(meeting, memberIds) {
  if (!memberIds?.length) {
    logger.info('sendMeetingInvitations: no memberIds provided, skipping');
    return;
  }
  try {
    const ids = memberIds.filter(id => /^[0-9a-f-]{36}$/i.test(id));
    logger.info(`sendMeetingInvitations: ${ids.length} valid UUIDs from ${memberIds.length} provided`);
    if (!ids.length) return;

    // Use individual placeholders — more reliable than ANY($1::uuid[]) with node-postgres
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const r = await db.query(
      `SELECT id, full_name, email, role FROM issc_members WHERE id IN (${placeholders}) AND email IS NOT NULL AND email <> ''`,
      ids
    );
    logger.info(`sendMeetingInvitations: ${r.rows.length} members with email found`);
    if (!r.rows.length) {
      logger.warn('sendMeetingInvitations: no members with email addresses — check issc_members table');
      return;
    }

    const mailer  = require('../services/mailer');
    const ics     = buildICS(meeting);
    const dateStr = new Date(meeting.meeting_date).toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    for (const m of r.rows) {
      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#3b82f6;margin-bottom:4px">ISSC Meeting Invitation</h2>
          <p style="color:#666;font-size:13px;margin-top:0">Information Security Steering Committee</p>
          <p>Dear ${m.full_name},</p>
          <p>You are invited to the following ISSC meeting. A calendar invitation (.ics) is attached.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px">
            <tr style="background:#f6f8fa"><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700;width:130px">Title</td><td style="padding:10px 12px;border:1px solid #e0e0e0">${meeting.title}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700">Date</td><td style="padding:10px 12px;border:1px solid #e0e0e0">${dateStr}</td></tr>
            <tr style="background:#f6f8fa"><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700">Type</td><td style="padding:10px 12px;border:1px solid #e0e0e0;text-transform:capitalize">${meeting.meeting_type || 'regular'}</td></tr>
            ${meeting.location ? `<tr><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700">Location</td><td style="padding:10px 12px;border:1px solid #e0e0e0">${meeting.location}</td></tr>` : ''}
            ${meeting.chair    ? `<tr style="background:#f6f8fa"><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700">Chair</td><td style="padding:10px 12px;border:1px solid #e0e0e0">${meeting.chair}</td></tr>` : ''}
            <tr><td style="padding:10px 12px;border:1px solid #e0e0e0;font-weight:700">Your Role</td><td style="padding:10px 12px;border:1px solid #e0e0e0">${m.role}</td></tr>
          </table>
          ${meeting.agenda ? `<div style="margin:16px 0"><div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:8px">Agenda</div><div style="background:#f6f8fa;padding:12px 14px;border-radius:6px;font-size:13px;white-space:pre-wrap;line-height:1.6;border-left:3px solid #3b82f6">${meeting.agenda}</div></div>` : ''}
          <p style="color:#888;font-size:12px;margin-top:24px">A calendar file (.ics) is attached — import it into your calendar app to add this event.<br>This is an automated invitation from SecureOps.</p>
        </div>`;
      try {
        await mailer.sendMail({
          to: m.email,
          subject: `[ISSC] Meeting Invitation: ${meeting.title} — ${dateStr}`,
          html,
          attachments: [{
            filename: 'issc-meeting.ics',
            content:  ics,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          }],
        });
        logger.info(`sendMeetingInvitations: invite sent to ${m.email} (${m.full_name})`);
      } catch (mailErr) {
        logger.error(`sendMeetingInvitations: failed to send to ${m.email}: ${mailErr.message}`);
      }
    }
  } catch (e) { logger.error('sendMeetingInvitations error:', e.message); }
}

// ── Send minutes/decisions notification ───────────────────────
async function sendMeetingMinutes(meeting) {
  const memberIds = Array.isArray(meeting.member_ids) ? meeting.member_ids : [];
  if (!memberIds.length) {
    logger.info('sendMeetingMinutes: no member_ids on meeting, skipping');
    return;
  }
  if (!meeting.minutes && !meeting.decisions) return;
  try {
    const ids = memberIds.filter(id => /^[0-9a-f-]{36}$/i.test(id));
    if (!ids.length) return;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const r = await db.query(
      `SELECT full_name, email FROM issc_members WHERE id IN (${placeholders}) AND email IS NOT NULL AND email <> ''`,
      ids
    );
    logger.info(`sendMeetingMinutes: ${r.rows.length} recipients found`);
    if (!r.rows.length) return;
    const mailer  = require('../services/mailer');
    const dateStr = new Date(meeting.meeting_date).toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    for (const m of r.rows) {
      const html = `
        <div style="font-family:sans-serif;max-width:600px">
          <h2 style="color:#10b981;margin-bottom:4px">ISSC Meeting — Minutes &amp; Decisions</h2>
          <p style="color:#666;font-size:13px;margin-top:0">Official record for your evidence files</p>
          <p>Dear ${m.full_name},</p>
          <p>Minutes and decisions have been recorded for the following ISSC meeting:</p>
          <div style="background:#f0fdf4;padding:12px 16px;border-radius:8px;margin:16px 0;border-left:4px solid #3b82f6">
            <div style="font-weight:700;color:#1e40af;font-size:14px">${meeting.title}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:3px">${dateStr}${meeting.location ? ` &middot; ${meeting.location}` : ''}${meeting.chair ? ` &middot; Chair: ${meeting.chair}` : ''}</div>
          </div>
          ${meeting.minutes ? `
          <div style="margin:20px 0">
            <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:8px">Minutes / Notes</div>
            <div style="background:#f6f8fa;padding:14px 16px;border-radius:6px;font-size:13px;white-space:pre-wrap;line-height:1.7;border-left:3px solid #10b981">${meeting.minutes}</div>
          </div>` : ''}
          ${meeting.decisions ? `
          <div style="margin:20px 0">
            <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:8px">Decisions Made</div>
            <div style="background:#fffbeb;padding:14px 16px;border-radius:6px;font-size:13px;white-space:pre-wrap;line-height:1.7;border-left:3px solid #f59e0b">${meeting.decisions}</div>
          </div>` : ''}
          ${meeting.action_items ? `
          <div style="margin:20px 0">
            <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#6b7280;margin-bottom:8px">Action Items</div>
            <div style="background:#f6f8fa;padding:14px 16px;border-radius:6px;font-size:13px;white-space:pre-wrap;line-height:1.7;border-left:3px solid #6b7280">${meeting.action_items}</div>
          </div>` : ''}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#888;font-size:12px">This email serves as an official evidence record of ISSC decisions.<br>Automated notification from SecureOps &middot; ${new Date().toLocaleString()}</p>
        </div>`;
      try {
        await mailer.sendMail({
          to: m.email,
          subject: `[ISSC] Meeting Minutes & Decisions: ${meeting.title} — ${dateStr}`,
          html,
        });
        logger.info(`sendMeetingMinutes: minutes sent to ${m.email} (${m.full_name})`);
      } catch (mailErr) {
        logger.error(`sendMeetingMinutes: failed to send to ${m.email}: ${mailErr.message}`);
      }
    }
  } catch (e) { logger.error('sendMeetingMinutes error:', e.message); }
}

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
          action_items, next_meeting_date, member_ids } = req.body;
  if (!title || !meeting_date) return res.status(400).json({ error: 'title and meeting_date required' });
  try {
    const r = await db.query(`
      INSERT INTO issc_meetings
        (title, meeting_date, meeting_type, status, location, chair, quorum_met,
         attendees, agenda, minutes, decisions, action_items, next_meeting_date,
         member_ids, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [title, meeting_date, meeting_type||'regular', status||'scheduled',
        location||null, chair||null, quorum_met??null, attendees||null,
        agenda||null, minutes||null, decisions||null, action_items||null,
        next_meeting_date||null, JSON.stringify(member_ids||[]), req.user.id]);
    const meeting = r.rows[0];

    // Send calendar invitations to selected members (non-blocking)
    if (member_ids?.length) {
      logger.info(`issc POST /meetings: scheduling invitations to ${member_ids.length} member(s) for meeting ${meeting.id}`);
      sendMeetingInvitations(meeting, member_ids).catch(e => logger.error('sendMeetingInvitations unhandled:', e.message));
    }

    res.status(201).json(meeting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/meetings/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, meeting_date, meeting_type, status, location, chair,
          quorum_met, attendees, agenda, minutes, decisions,
          action_items, next_meeting_date, member_ids } = req.body;
  try {
    // Fetch old values to detect minutes/decisions changes
    const prev = await db.query('SELECT minutes, decisions, member_ids FROM issc_meetings WHERE id=$1', [req.params.id]);
    const old  = prev.rows[0];

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
        member_ids        = COALESCE($15, member_ids),
        updated_at        = NOW()
      WHERE id = $1 RETURNING *
    `, [req.params.id, title||null, meeting_date||null, meeting_type||null,
        status||null, location||null, chair||null, quorum_met??null,
        attendees||null, agenda||null, minutes||null, decisions||null,
        action_items||null, next_meeting_date||null,
        member_ids !== undefined ? JSON.stringify(member_ids) : null]);
    if (!r.rows.length) return res.status(404).json({ error: 'Meeting not found' });
    const meeting = r.rows[0];

    // If minutes or decisions were newly added/changed, notify members with the evidence email
    const minutesChanged   = minutes   && minutes   !== (old?.minutes   || '');
    const decisionsChanged = decisions && decisions !== (old?.decisions  || '');
    if (minutesChanged || decisionsChanged) {
      logger.info(`issc PUT /meetings/${req.params.id}: minutes/decisions changed, sending evidence email`);
      sendMeetingMinutes(meeting).catch(e => logger.error('sendMeetingMinutes unhandled:', e.message));
    }

    res.json(meeting);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/meetings/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM issc_meetings WHERE id=$1', [req.params.id]);
    res.json({ message: 'Meeting deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
