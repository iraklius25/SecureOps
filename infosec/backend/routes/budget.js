const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const db      = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const notifier = require('../services/notifier');
const logger   = require('../services/logger');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'budget');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set([
  '.pdf', '.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls',
  '.png', '.jpg', '.jpeg', '.txt', '.csv', '.md',
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
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    cb(new Error('File type not allowed'));
  },
});

/* ── File inline view (before /:id to avoid conflict) ────────── */

// GET /api/budget/files/:fileId/view
router.get('/files/:fileId/view', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM budget_files WHERE id=$1', [req.params.fileId]);
    if (!r.rows.length) return res.status(404).json({ error: 'File not found' });
    const file = r.rows[0];
    const fp   = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    fs.createReadStream(fp).pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/budget/files/:fileId
router.delete('/files/:fileId', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const r = await db.query('SELECT stored_name FROM budget_files WHERE id=$1', [req.params.fileId]);
    if (!r.rows.length) return res.status(404).json({ error: 'File not found' });
    await db.query('DELETE FROM budget_files WHERE id=$1', [req.params.fileId]);
    fs.unlink(path.join(UPLOAD_DIR, r.rows[0].stored_name), () => {});
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Organizations list (for dropdowns) ──────────────────────── */

// GET /api/budget/orgs
router.get('/orgs', auth, async (_req, res) => {
  try {
    const r = await db.query('SELECT id, name FROM cert_organizations ORDER BY name ASC');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Budget item CRUD ─────────────────────────────────────────── */

// GET /api/budget?org_id=&category=&status=&sort=&dir=
router.get('/', auth, async (req, res) => {
  try {
    const { org_id, category, status, sort = 'created_at', dir = 'desc' } = req.query;

    const SORT_COLS = { name: 'b.name', amount: 'b.amount', expiry: 'b.license_expiry_date', created_at: 'b.created_at', updated_at: 'b.updated_at', status: 'b.status' };
    const sortCol  = SORT_COLS[sort] || 'b.created_at';
    const sortDir  = dir === 'asc' ? 'ASC' : 'DESC';

    const conds = [];
    const params = [];

    if (org_id === 'none') {
      conds.push('b.org_id IS NULL');
    } else if (org_id) {
      params.push(org_id);
      conds.push(`b.org_id=$${params.length}`);
    }
    if (category) { params.push(category); conds.push(`b.category=$${params.length}`); }
    if (status)   { params.push(status);   conds.push(`b.status=$${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const r = await db.query(`
      SELECT b.*,
             o.name AS org_name,
             u.username AS created_by_username,
             (SELECT COUNT(*) FROM budget_files f WHERE f.budget_item_id = b.id) AS file_count
        FROM budget_items b
        LEFT JOIN cert_organizations o ON o.id = b.org_id
        LEFT JOIN users u ON u.id = b.created_by
       ${where}
       ORDER BY b.is_important DESC, ${sortCol} ${sortDir}
    `, params);

    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/budget
router.post('/', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    org_id, name, description, category, amount, currency,
    status, license_expiry_date, warn_days_before,
    is_important, notify_smtp, notify_webhook, notes,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const r = await db.query(`
      INSERT INTO budget_items
        (org_id, name, description, category, amount, currency, status,
         license_expiry_date, warn_days_before, is_important, notify_smtp, notify_webhook, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        org_id              || null,
        name.trim(),
        description         || null,
        category            || 'other',
        amount              != null ? amount : null,
        currency            || 'USD',
        status              || 'active',
        license_expiry_date || null,
        warn_days_before    != null ? parseInt(warn_days_before, 10) : 30,
        is_important        ?? false,
        notify_smtp         ?? false,
        notify_webhook      ?? false,
        notes               || null,
        req.user.id,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/budget/:id
router.put('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const {
    org_id, name, description, category, amount, currency,
    status, license_expiry_date, warn_days_before,
    is_important, notify_smtp, notify_webhook, notes,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const r = await db.query(`
      UPDATE budget_items SET
        org_id=$1, name=$2, description=$3, category=$4, amount=$5, currency=$6, status=$7,
        license_expiry_date=$8, warn_days_before=$9, is_important=$10,
        notify_smtp=$11, notify_webhook=$12, notes=$13, updated_at=NOW()
      WHERE id=$14 RETURNING *`,
      [
        org_id              || null,
        name.trim(),
        description         || null,
        category            || 'other',
        amount              != null ? amount : null,
        currency            || 'USD',
        status              || 'active',
        license_expiry_date || null,
        warn_days_before    != null ? parseInt(warn_days_before, 10) : 30,
        is_important        ?? false,
        notify_smtp         ?? false,
        notify_webhook      ?? false,
        notes               || null,
        req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/budget/:id
router.delete('/:id', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const files = await db.query('SELECT stored_name FROM budget_files WHERE budget_item_id=$1', [req.params.id]);
    await db.query('DELETE FROM budget_items WHERE id=$1', [req.params.id]);
    for (const f of files.rows) fs.unlink(path.join(UPLOAD_DIR, f.stored_name), () => {});
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Files for a budget item ──────────────────────────────────── */

// GET /api/budget/:id/files
router.get('/:id/files', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT f.*, u.username AS uploaded_by_username
        FROM budget_files f
        LEFT JOIN users u ON u.id = f.uploaded_by
       WHERE f.budget_item_id=$1
       ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/budget/:id/files
router.post('/:id/files', auth, requireRole('admin', 'analyst'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const exists = await db.query('SELECT id FROM budget_items WHERE id=$1', [req.params.id]);
    if (!exists.rows.length) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Budget item not found' });
    }
    const r = await db.query(`
      INSERT INTO budget_files (budget_item_id, original_name, stored_name, mimetype, file_size, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: e.message });
  }
});

/* ── License expiry checker (called from cron) ───────────────── */
async function checkLicenseExpiry() {
  try {
    const r = await db.query(`
      SELECT b.*, o.name AS org_name
        FROM budget_items b
        LEFT JOIN cert_organizations o ON o.id = b.org_id
       WHERE b.license_expiry_date IS NOT NULL
         AND b.status = 'active'
         AND b.license_expiry_date >= CURRENT_DATE
         AND b.license_expiry_date <= CURRENT_DATE + (b.warn_days_before || ' days')::INTERVAL
         AND (b.notify_smtp = TRUE OR b.notify_webhook = TRUE)`
    );

    for (const item of r.rows) {
      const daysLeft = Math.ceil((new Date(item.license_expiry_date) - new Date()) / 86400000);
      const title    = `License Expiring Soon: ${item.name}`;
      const orgPart  = item.org_name ? ` · Organization: ${item.org_name}` : '';
      const message  = `${item.name} expires on ${item.license_expiry_date}${orgPart} · ${daysLeft} day(s) remaining`;

      if (item.notify_smtp) {
        notifier.notifyEmailDirect(title, message, 'warning').catch(() => {});
      }
      if (item.notify_webhook) {
        notifier.notifyWebhookDirect({ title, message, type: 'warning' }).catch(() => {});
      }

      await notifier.notifyInAppDirect({
        title, message, type: 'warning', resource: 'budget', resource_id: item.id,
        link: '/budget',
      }).catch(() => {});
    }
  } catch (e) {
    logger.error('Budget license expiry check error:', e.message);
  }
}

module.exports = router;
module.exports.checkLicenseExpiry = checkLicenseExpiry;
