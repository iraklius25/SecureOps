const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'grc');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([
  '.pdf','.docx','.pptx','.xlsx','.doc','.ppt','.xls',
  '.png','.jpg','.jpeg','.txt','.csv','.md',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

/* ── Summary ─────────────────────────────────────────────────── */

router.get('/summary', auth, async (_req, res) => {
  try {
    const [programs, tasks, docs, controls, reviews] = await Promise.all([
      db.query('SELECT status, COUNT(*) FROM grc_programs GROUP BY status'),
      db.query('SELECT status, COUNT(*) FROM grc_tasks GROUP BY status'),
      db.query('SELECT status, COUNT(*) FROM grc_documents GROUP BY status'),
      db.query('SELECT status, COUNT(*) FROM grc_controls GROUP BY status'),
      db.query('SELECT status, COUNT(*) FROM grc_reviews GROUP BY status'),
    ]);
    res.json({
      programs: programs.rows,
      tasks:    tasks.rows,
      documents: docs.rows,
      controls: controls.rows,
      reviews:  reviews.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Programs ─────────────────────────────────────────────────── */

router.get('/programs', auth, async (_req, res) => {
  try {
    const r = await db.query('SELECT * FROM grc_programs ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/programs', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { framework, name, description, phase, owner, target_date, completion_pct, status } = req.body;
  if (!framework || !name) return res.status(400).json({ error: 'framework and name are required' });
  try {
    const r = await db.query(
      `INSERT INTO grc_programs (framework, name, description, phase, owner, target_date, completion_pct, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [framework, name.trim(), description || '', phase || 'planning', owner || '',
       target_date || null, completion_pct || 0, status || 'active', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/programs/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description, phase, owner, target_date, completion_pct, status } = req.body;
  try {
    const r = await db.query(
      `UPDATE grc_programs SET name=$1, description=$2, phase=$3, owner=$4, target_date=$5,
       completion_pct=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name, description || '', phase, owner || '', target_date || null,
       completion_pct || 0, status, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/programs/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM grc_programs WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Tasks ────────────────────────────────────────────────────── */

router.get('/tasks', auth, async (req, res) => {
  const { program_id, status, priority, framework } = req.query;
  const filters = []; const vals = [];
  if (program_id) { vals.push(program_id); filters.push(`program_id=$${vals.length}`); }
  if (status)     { vals.push(status);     filters.push(`status=$${vals.length}`); }
  if (priority)   { vals.push(priority);   filters.push(`priority=$${vals.length}`); }
  if (framework)  { vals.push(framework);  filters.push(`framework=$${vals.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const r = await db.query(
      `SELECT * FROM grc_tasks ${where} ORDER BY due_date ASC NULLS LAST, created_at DESC`, vals
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { program_id, title, description, owner, due_date, priority, status, framework, clause_ref, source_type } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const r = await db.query(
      `INSERT INTO grc_tasks
         (program_id, title, description, owner, due_date, priority, status, framework, clause_ref, source_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [program_id || null, title.trim(), description || '', owner || '', due_date || null,
       priority || 'medium', status || 'open', framework || '', clause_ref || '',
       source_type || 'manual', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/tasks/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { title, description, owner, due_date, priority, status, framework, clause_ref } = req.body;
  try {
    const r = await db.query(
      `UPDATE grc_tasks SET title=$1, description=$2, owner=$3, due_date=$4, priority=$5,
       status=$6, framework=$7, clause_ref=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [title, description || '', owner || '', due_date || null, priority, status,
       framework || '', clause_ref || '', req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tasks/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    await db.query('DELETE FROM grc_tasks WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Documents — download before /:id to avoid path conflict ─── */

router.get('/documents/:docId/download', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM grc_documents WHERE id=$1', [req.params.docId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = r.rows[0];
    if (!doc.stored_name) return res.status(404).json({ error: 'No file attached' });
    const filePath = path.join(UPLOAD_DIR, doc.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
    res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/documents', auth, async (req, res) => {
  const { program_id, category, status } = req.query;
  const filters = []; const vals = [];
  if (program_id) { vals.push(program_id); filters.push(`d.program_id=$${vals.length}`); }
  if (category)   { vals.push(category);   filters.push(`d.category=$${vals.length}`); }
  if (status)     { vals.push(status);     filters.push(`d.status=$${vals.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const r = await db.query(
      `SELECT d.*, u.username AS uploaded_by_username FROM grc_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by ${where} ORDER BY d.created_at DESC`,
      vals
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/documents', auth, requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  const { program_id, title, category, doc_version, status, owner, review_date, framework_links, tags, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    let links = [];
    try { links = JSON.parse(framework_links || '[]'); } catch { links = []; }
    const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const r = await db.query(
      `INSERT INTO grc_documents
         (program_id, title, category, doc_version, status, owner, review_date, framework_links, tags, description,
          original_name, stored_name, mimetype, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [program_id || null, title.trim(), category || 'policy', doc_version || '1.0',
       status || 'draft', owner || '', review_date || null, links, tagArr, description || '',
       req.file?.originalname || null, req.file?.filename || null,
       req.file?.mimetype || null, req.file?.size || null, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    res.status(500).json({ error: e.message });
  }
});

router.put('/documents/:id', auth, requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  const { title, category, doc_version, status, owner, review_date, framework_links, tags, description } = req.body;
  try {
    let links = [];
    try { links = JSON.parse(framework_links || '[]'); } catch { links = []; }
    const tagArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    if (req.file) {
      // delete old file from disk before replacing
      const old = await db.query('SELECT stored_name FROM grc_documents WHERE id=$1', [req.params.id]);
      if (old.rows.length && old.rows[0].stored_name) {
        fs.unlink(path.join(UPLOAD_DIR, old.rows[0].stored_name), () => {});
      }
      const r = await db.query(
        `UPDATE grc_documents SET title=$1, category=$2, doc_version=$3, status=$4, owner=$5,
         review_date=$6, framework_links=$7, tags=$8, description=$9,
         original_name=$10, stored_name=$11, mimetype=$12, file_size=$13, updated_at=NOW()
         WHERE id=$14 RETURNING *`,
        [title, category, doc_version, status, owner || '', review_date || null,
         links, tagArr, description || '',
         req.file.originalname, req.file.filename, req.file.mimetype, req.file.size,
         req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      return res.json(r.rows[0]);
    }

    const r = await db.query(
      `UPDATE grc_documents SET title=$1, category=$2, doc_version=$3, status=$4, owner=$5,
       review_date=$6, framework_links=$7, tags=$8, description=$9, updated_at=NOW() WHERE id=$10 RETURNING *`,
      [title, category, doc_version, status, owner || '', review_date || null,
       links, tagArr, description || '', req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) {
    if (req.file) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    res.status(500).json({ error: e.message });
  }
});

router.delete('/documents/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const r = await db.query('SELECT stored_name FROM grc_documents WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    await db.query('DELETE FROM grc_documents WHERE id=$1', [req.params.id]);
    if (r.rows[0].stored_name) fs.unlink(path.join(UPLOAD_DIR, r.rows[0].stored_name), () => {});
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Controls ─────────────────────────────────────────────────── */

router.get('/controls', auth, async (req, res) => {
  const { program_id, framework, status } = req.query;
  const filters = []; const vals = [];
  if (program_id) { vals.push(program_id); filters.push(`program_id=$${vals.length}`); }
  if (framework)  { vals.push(framework);  filters.push(`framework=$${vals.length}`); }
  if (status)     { vals.push(status);     filters.push(`status=$${vals.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const r = await db.query(`SELECT * FROM grc_controls ${where} ORDER BY control_ref ASC`, vals);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/controls', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { program_id, control_ref, title, description, category, framework, mappings, owner, status, effectiveness, last_tested, next_review, notes } = req.body;
  if (!control_ref || !title) return res.status(400).json({ error: 'control_ref and title are required' });
  try {
    const r = await db.query(
      `INSERT INTO grc_controls
         (program_id, control_ref, title, description, category, framework, mappings, owner, status, effectiveness, last_tested, next_review, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [program_id || null, control_ref, title.trim(), description || '', category || '',
       framework || '', mappings || {}, owner || '', status || 'not_started',
       effectiveness || 'not_tested', last_tested || null, next_review || null,
       notes || '', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/controls/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { control_ref, title, description, category, framework, mappings, owner, status, effectiveness, last_tested, next_review, notes } = req.body;
  try {
    const r = await db.query(
      `UPDATE grc_controls SET control_ref=$1, title=$2, description=$3, category=$4, framework=$5,
       mappings=$6, owner=$7, status=$8, effectiveness=$9, last_tested=$10,
       next_review=$11, notes=$12, updated_at=NOW() WHERE id=$13 RETURNING *`,
      [control_ref, title, description || '', category || '', framework || '',
       mappings || {}, owner || '', status, effectiveness || 'not_tested',
       last_tested || null, next_review || null, notes || '', req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/controls/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM grc_controls WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Management Reviews ───────────────────────────────────────── */

router.get('/reviews', auth, async (_req, res) => {
  try {
    const r = await db.query('SELECT * FROM grc_reviews ORDER BY review_date DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/reviews', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { program_id, review_date, review_type, title, chair, attendees, agenda, inputs, decisions, action_items, minutes_text, status, approved_by } = req.body;
  if (!title || !review_date) return res.status(400).json({ error: 'title and review_date are required' });
  try {
    const r = await db.query(
      `INSERT INTO grc_reviews
         (program_id, review_date, review_type, title, chair, attendees, agenda, inputs, decisions, action_items, minutes_text, status, approved_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [program_id || null, review_date, review_type || 'management_review', title.trim(),
       chair || '', attendees || [], agenda || [], inputs || {}, decisions || [],
       action_items || [], minutes_text || '', status || 'planned', approved_by || '', req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/reviews/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { review_date, review_type, title, chair, attendees, agenda, inputs, decisions, action_items, minutes_text, status, approved_by } = req.body;
  try {
    const r = await db.query(
      `UPDATE grc_reviews SET review_date=$1, review_type=$2, title=$3, chair=$4, attendees=$5,
       agenda=$6, inputs=$7, decisions=$8, action_items=$9, minutes_text=$10,
       status=$11, approved_by=$12, updated_at=NOW() WHERE id=$13 RETURNING *`,
      [review_date, review_type, title, chair || '', attendees || [], agenda || [],
       inputs || {}, decisions || [], action_items || [], minutes_text || '',
       status, approved_by || '', req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reviews/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM grc_reviews WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── RACI Matrices ────────────────────────────────────────────── */

router.get('/raci', auth, async (_req, res) => {
  try {
    const r = await db.query('SELECT * FROM grc_raci_matrices ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/raci', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description, program_id, framework, roles, processes, cells } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await db.query(
      `INSERT INTO grc_raci_matrices (name, description, program_id, framework, roles, processes, cells, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name.trim(), description || '', program_id || null, framework || '',
       JSON.stringify(roles || []), JSON.stringify(processes || []), JSON.stringify(cells || {}), req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/raci/:id', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM grc_raci_matrices WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/raci/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description, program_id, framework, roles, processes, cells } = req.body;
  try {
    const r = await db.query(
      `UPDATE grc_raci_matrices SET name=$1, description=$2, program_id=$3, framework=$4,
       roles=$5, processes=$6, cells=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name, description || '', program_id || null, framework || '',
       JSON.stringify(roles || []), JSON.stringify(processes || []), JSON.stringify(cells || {}), req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/raci/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM grc_raci_matrices WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
