require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const logger = require('./services/logger');

const app = express();
app.set('trust proxy', 1);

// ── Security middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 });
app.use('/api/', limiter);

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/assets',         require('./routes/assets'));
app.use('/api/scans',          require('./routes/scans'));
app.use('/api/vulns',          require('./routes/vulnerabilities'));
app.use('/api/risks',          require('./routes/risks'));
app.use('/api/reports',        require('./routes/reports'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/groups',         require('./routes/groups'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/audit',          require('./routes/audit'));
app.use('/api/apikeys',        require('./routes/apikeys'));
app.use('/api/compliance',     require('./routes/compliance'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/cve',            require('./routes/cve'));
app.use('/api/threat',         require('./routes/threat'));
app.use('/api/patches',        require('./routes/patches'));
app.use('/api/sla',            require('./routes/sla'));
app.use('/api/approvals',      require('./routes/approvals'));
app.use('/api/totp',           require('./routes/totp'));
app.use('/api/evidence',       require('./routes/evidence'));
app.use('/api/maturity',       require('./routes/maturity'));
app.use('/api/grc',            require('./routes/grc'));
app.use('/api/suppliers',      require('./routes/suppliers'));
app.use('/api/ai-systems',     require('./routes/aiSystems'));
app.use('/api/activity-log',   require('./routes/activityLog'));

// ── Static uploads ──────────────────────────────────────────────
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', time: new Date() }));

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Per-minute cron: trigger scheduled scans & auto-stop ──────
cron.schedule('* * * * *', async () => {
  const db = require('./db');
  const ScanService = require('./services/scanner');
  try {
    // Start pending scans whose scheduled_at has arrived
    const due = await db.query(`
      SELECT * FROM scan_jobs
      WHERE status='pending'
        AND scan_options->>'scheduled_at' IS NOT NULL
        AND (scan_options->>'scheduled_at')::timestamptz <= NOW()
    `);
    for (const job of due.rows) {
      const opts = job.scan_options || {};
      ScanService.runScan(job.target, job.id, { scan_type: job.scan_type, nmapArgs: opts.nmapArgs || '' })
        .catch(e => logger.error('Scheduled scan error:', e.message));
    }
    // Cancel running scans past their stop_at time
    const toStop = await db.query(`
      SELECT id FROM scan_jobs
      WHERE status='running'
        AND scan_options->>'stop_at' IS NOT NULL
        AND (scan_options->>'stop_at')::timestamptz <= NOW()
    `);
    for (const job of toStop.rows) {
      await db.query(`UPDATE scan_jobs SET status='cancelled', completed_at=NOW() WHERE id=$1`, [job.id]);
      logger.info(`Auto-stopped scan ${job.id} (stop_at reached)`);
    }
  } catch (e) { logger.error('Scheduler error:', e.message); }
});

// ── Scheduled reports runner (hourly check) ───────────────────
cron.schedule('0 * * * *', async () => {
  const db2 = require('./db');
  try {
    const due = await db2.query(`
      SELECT * FROM scheduled_reports
      WHERE is_active=TRUE AND next_run <= NOW()
    `);
    for (const sr of due.rows) {
      logger.info(`Running scheduled report: ${sr.name} (${sr.report_type})`);
      // Compute and update next_run
      const now = new Date();
      let nextRun;
      if (sr.schedule === 'daily')   { nextRun = new Date(now.getTime() + 86400000); }
      else if (sr.schedule === 'weekly') { nextRun = new Date(now.getTime() + 7*86400000); }
      else { nextRun = new Date(now.getFullYear(), now.getMonth()+1, 1, 6, 0, 0); }
      await db2.query(
        `UPDATE scheduled_reports SET last_run=NOW(), next_run=$2 WHERE id=$1`,
        [sr.id, nextRun]
      );
    }
  } catch (e) { logger.error('Scheduled reports error:', e.message); }
});

// ── Scheduled scans (daily at 02:00) ──────────────────────────
cron.schedule('0 2 * * *', async () => {
  logger.info('Running scheduled vulnerability scan...');
  // Auto-trigger scans for all active assets
  const { Pool } = require('pg');
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const assets = await db.query("SELECT ip_address FROM assets WHERE status='active' LIMIT 50");
    const ScanService = require('./services/scanner');
    for (const asset of assets.rows) {
      await ScanService.quickScan(asset.ip_address.toString());
    }
  } catch (e) { logger.error('Scheduled scan error:', e.message); }
  finally { await db.end(); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`InfoSec API running on port ${PORT}`));
