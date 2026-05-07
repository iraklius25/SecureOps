const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const ScanService = require('../services/scanner');

// POST /api/scans  — start or schedule a new scan
router.post('/', auth, requireRole('admin','analyst'), async (req, res) => {
  const { target, scan_type = 'full', name, nmapArgs = '', scheduledAt, stopAfterMinutes } = req.body;
  if (!target) return res.status(400).json({ error: 'Target IP, range or CIDR required' });

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^(\d{1,3}\.){3}\d{1,3}-\d{1,3}$/;
  if (!ipPattern.test(target.trim())) return res.status(400).json({ error: 'Invalid target format. Use IP (192.168.1.1), CIDR (192.168.1.0/24) or range (192.168.1.1-254)' });

  const VALID_SCAN_TYPES = ['full', 'service', 'light'];
  if (!VALID_SCAN_TYPES.includes(scan_type)) return res.status(400).json({ error: 'Invalid scan_type' });
  if (name && name.length > 100) return res.status(400).json({ error: 'Name too long' });

  try {
    const scanOptions = { nmapArgs };
    if (scheduledAt) {
      scanOptions.scheduled_at = new Date(scheduledAt).toISOString();
      if (stopAfterMinutes) {
        const stopAt = new Date(new Date(scheduledAt).getTime() + stopAfterMinutes * 60000);
        scanOptions.stop_at = stopAt.toISOString();
      }
    }

    const job = await db.query(`
      INSERT INTO scan_jobs (name, scan_type, target, status, initiated_by, scan_options)
      VALUES ($1,$2,$3,'pending',$4,$5) RETURNING *
    `, [name || `Scan ${target}`, scan_type, target, req.user.id, JSON.stringify(scanOptions)]);

    const scanJob = job.rows[0];
    res.status(202).json({ message: scheduledAt ? 'Scan scheduled' : 'Scan queued', job: scanJob });

    // Only run immediately if not scheduled
    if (!scheduledAt) {
      ScanService.runScan(target, scanJob.id, { scan_type, nmapArgs })
        .catch(err => console.error('Scan error:', err));
    }
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

// GET /api/scans/:id/results — assets + ports discovered during this scan
router.get('/:id/results', auth, async (req, res) => {
  try {
    const job = await db.query('SELECT started_at, completed_at FROM scan_jobs WHERE id=$1', [req.params.id]);
    if (!job.rows.length) return res.status(404).json({ error: 'Scan not found' });
    const { started_at, completed_at } = job.rows[0];
    if (!started_at) return res.json({ assets: [] });

    const r = await db.query(`
      SELECT
        a.id, a.ip_address, a.hostname, a.os_name, a.asset_type, a.criticality,
        json_agg(
          json_build_object(
            'port', ap.port, 'protocol', ap.protocol, 'service', ap.service,
            'product', ap.product, 'version', ap.version, 'state', ap.state, 'banner', ap.banner
          ) ORDER BY ap.port
        ) FILTER (WHERE ap.id IS NOT NULL) AS ports
      FROM assets a
      LEFT JOIN asset_ports ap ON ap.asset_id = a.id
      WHERE a.last_scanned BETWEEN $1 AND COALESCE($2, NOW())
      GROUP BY a.id
      ORDER BY a.ip_address
    `, [started_at, completed_at]);

    res.json({ assets: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/scans/:id  — cancel if active, permanently delete if terminal
router.delete('/:id', auth, requireRole('admin','analyst'), async (req, res) => {
  try {
    const job = await db.query('SELECT status FROM scan_jobs WHERE id=$1', [req.params.id]);
    if (!job.rows.length) return res.status(404).json({ error: 'Not found' });
    const { status } = job.rows[0];
    if (['pending','running'].includes(status)) {
      await db.query(`UPDATE scan_jobs SET status='cancelled', completed_at=NOW() WHERE id=$1`, [req.params.id]);
      res.json({ message: 'Cancelled' });
    } else {
      await db.query('DELETE FROM scan_jobs WHERE id=$1', [req.params.id]);
      res.json({ message: 'Deleted' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
