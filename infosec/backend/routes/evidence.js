const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'evidence');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/evidence — upload evidence file
router.post('/', auth, requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { control_id, risk_id, notes } = req.body;
  if (!control_id) return res.status(400).json({ error: 'control_id is required' });

  try {
    const r = await db.query(`
      INSERT INTO compliance_evidence
        (control_id, risk_id, filename, mimetype, file_size, file_path, notes, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [
      control_id,
      risk_id || null,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.filename,
      notes || null,
      req.user.id,
    ]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    // Clean up uploaded file if DB insert fails
    fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
    res.status(500).json({ error: e.message });
  }
});

// GET /api/evidence/control/:controlId — list evidence for a control
router.get('/control/:controlId', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT e.*, u.username AS uploaded_by_username, u.full_name AS uploaded_by_fullname
      FROM compliance_evidence e
      LEFT JOIN users u ON u.id = e.uploaded_by
      WHERE e.control_id = $1
      ORDER BY e.created_at DESC
    `, [req.params.controlId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/evidence/risk/:riskId — list evidence for a risk
router.get('/risk/:riskId', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT e.*, u.username AS uploaded_by_username, u.full_name AS uploaded_by_fullname
      FROM compliance_evidence e
      LEFT JOIN users u ON u.id = e.uploaded_by
      WHERE e.risk_id = $1
      ORDER BY e.created_at DESC
    `, [req.params.riskId]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/evidence/:id/download — stream the file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM compliance_evidence WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Evidence not found' });
    const ev = r.rows[0];
    const filePath = path.join(UPLOAD_DIR, ev.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${ev.filename}"`);
    res.setHeader('Content-Type', ev.mimetype || 'application/octet-stream');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/evidence/:id — delete file from disk and DB
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT file_path FROM compliance_evidence WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Evidence not found' });
    const { file_path } = r.rows[0];

    // Delete from DB first
    await db.query('DELETE FROM compliance_evidence WHERE id=$1', [req.params.id]);

    // Then delete file from disk (ignore error if file missing)
    const fullPath = path.join(UPLOAD_DIR, file_path);
    fs.unlink(fullPath, err => {
      if (err) require('../services/logger').warn(`evidence: could not delete file ${fullPath}: ${err.message}`);
    });

    res.json({ message: 'Evidence deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
