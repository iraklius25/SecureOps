const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const ScanService = require('../services/scanner');

// POST /api/scans  — start a new scan
router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { target, scan_type = 'full', name } = req.body;
  if (!target) return res.status(400).json({ error: 'Target IP, range or CIDR required' });

  // Validate target format (IP, CIDR, range)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^(\d{1,3}\.){3}\d{1,3}-\d{1,3}$/;
  if (!ipPattern.test(target.trim())) return res.status(400).json({ error: 'Invalid target format. Use IP (192.168.1.1), CIDR (192.168.1.0/24) or range (192.168.1.1-254)' });

  try {
    const job = await db.query(`
      INSERT INTO scan_jobs (name, scan_type, target, status, initiated_by)
      VALUES ($1,$2,$3,'pending',$4) RETURNING *
    `, [name || `Scan ${target}`, scan_type, target, req.user.id]);

    const scanJob = job.rows[0];
    res.status(202).json({ message: 'Scan queued', job: scanJob });

    // Run scan asynchronously
    ScanService.runScan(target, scanJob.id, { scan_type })
      .catch(err => console.error('Scan error:', err));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/scans
router.get('/', auth, async (req, res) => {
  const { page=1, limit=20 } = req.query;
  try {
    const r = await db.query(`
      SELECT s.*, u.username AS initiated_by_user
      FROM scan_jobs s LEFT JOIN users u ON u.id = s.initiated_by
      ORDER BY s.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, (page-1)*limit]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/scans/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM scan_jobs WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Scan job not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/scans/:id  — cancel
router.delete('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    await db.query(`UPDATE scan_jobs SET status='cancelled' WHERE id=$1 AND status='pending'`, [req.params.id]);
    res.json({ message: 'Cancelled' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
