const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'maturity');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls']);

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
    cb(new Error('Only .docx, .pptx and .xlsx files are allowed'));
  },
});

/* ── Document routes (declared before /:id to avoid path conflicts) ── */

// GET /api/maturity/documents/:docId/download
router.get('/documents/:docId/download', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM maturity_documents WHERE id=$1', [req.params.docId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Document not found' });
    const doc = r.rows[0];
    const filePath = path.join(UPLOAD_DIR, doc.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
    res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/maturity/documents/:docId
router.delete('/documents/:docId', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const r = await db.query('SELECT stored_name FROM maturity_documents WHERE id=$1', [req.params.docId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Document not found' });
    await db.query('DELETE FROM maturity_documents WHERE id=$1', [req.params.docId]);
    fs.unlink(path.join(UPLOAD_DIR, r.rows[0].stored_name), () => {});
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Assessment CRUD ──────────────────────────────────────────────── */

// GET /api/maturity?framework=ISMS|ISO42001
router.get('/', auth, async (req, res) => {
  try {
    const { framework } = req.query;
    const q = framework
      ? 'SELECT * FROM maturity_assessments WHERE framework=$1 ORDER BY updated_at DESC'
      : 'SELECT * FROM maturity_assessments ORDER BY updated_at DESC';
    const r = await db.query(q, framework ? [framework] : []);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/maturity
router.post('/', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { framework, name, description, data } = req.body;
  if (!framework || !name) return res.status(400).json({ error: 'framework and name are required' });
  const VALID_FRAMEWORKS = ['ISMS', 'ISO42001', 'NISTCSF', 'PCIDSS', 'SOC2', 'ISO22301', 'GDPR'];
  if (!VALID_FRAMEWORKS.includes(framework)) return res.status(400).json({ error: 'Invalid framework' });
  try {
    const r = await db.query(
      `INSERT INTO maturity_assessments (framework, name, description, data, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [framework, name.trim(), description || '', data || { domains: {} }, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/maturity/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM maturity_assessments WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/maturity/:id
router.put('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { name, description, data } = req.body;
  try {
    const r = await db.query(
      `UPDATE maturity_assessments SET name=$1, description=$2, data=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [name, description || '', data, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/maturity/:id
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const docs = await db.query('SELECT stored_name FROM maturity_documents WHERE assessment_id=$1', [req.params.id]);
    await db.query('DELETE FROM maturity_assessments WHERE id=$1', [req.params.id]);
    for (const doc of docs.rows) fs.unlink(path.join(UPLOAD_DIR, doc.stored_name), () => {});
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Assessment document sub-routes ──────────────────────────────── */

// GET /api/maturity/:id/documents
router.get('/:id/documents', auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT d.*, u.username AS uploaded_by_username
       FROM maturity_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.assessment_id=$1 ORDER BY d.created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/maturity/:id/documents
router.post('/:id/documents', auth, requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const chk = await db.query('SELECT id FROM maturity_assessments WHERE id=$1', [req.params.id]);
    if (!chk.rows.length) {
      fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const r = await db.query(
      `INSERT INTO maturity_documents
         (assessment_id, original_name, stored_name, mimetype, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
