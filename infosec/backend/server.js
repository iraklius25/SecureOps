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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Global limiter — all API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Strict limiter — login and TOTP endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/totp-login', authLimiter);

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
app.use('/api/metrics',        require('./routes/metrics'));
app.use('/api/issc',           require('./routes/issc'));
app.use('/api/certifications', require('./routes/certifications'));
app.use('/api/budget',        require('./routes/budget'));

// ── Static uploads (auth-protected) ───────────────────────────
const { auth: uploadAuth } = require('./middleware/auth');
app.use('/uploads', uploadAuth, require('express').static(require('path').join(__dirname, 'uploads')));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  res.status(err.status || 500).json({ error: 'Internal server error' });
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

// ── KPI/KRI daily snapshot (01:00) ────────────────────────────
cron.schedule('0 1 * * *', async () => {
  logger.info('Saving daily KPI/KRI metric snapshot...');
  try {
    const { computeMetrics } = require('./routes/metrics');
    const db2    = require('./db');
    const values = await computeMetrics();
    const rows   = Object.entries(values).map(([k, v]) => `('${k}', ${v}, NOW())`).join(',');
    await db2.query(`INSERT INTO metric_snapshots (metric_key, value, snapped_at) VALUES ${rows}`);
    logger.info(`KPI/KRI snapshot saved: ${Object.keys(values).length} metrics`);
  } catch (e) { logger.error('Metrics snapshot error:', e.message); }
});

// ── Scheduled scans (daily at 02:00) ──────────────────────────
cron.schedule('0 2 * * *', async () => {
  logger.info('Running scheduled vulnerability scan...');
  const { Pool } = require('pg');
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const assets = await db.query("SELECT ip_address FROM assets WHERE status='active' AND ip_address IS NOT NULL LIMIT 50");
    const ScanService = require('./services/scanner');
    for (const asset of assets.rows) {
      await ScanService.quickScan(asset.ip_address.toString());
    }
  } catch (e) { logger.error('Scheduled scan error:', e.message); }
  finally { await db.end(); }
});

// ── Daily overdue reviews/tasks notification (07:30) ──────────
cron.schedule('30 7 * * *', async () => {
  logger.info('Checking overdue asset and risk reviews...');
  const { notifyOverdue } = require('./services/notifier');
  notifyOverdue().catch(e => logger.error('notifyOverdue cron error:', e.message));
});

// ── Budget license expiry warnings (08:00 daily) ──────────────
cron.schedule('0 8 * * *', async () => {
  logger.info('Checking budget license expiry warnings...');
  const { checkLicenseExpiry } = require('./routes/budget');
  checkLicenseExpiry().catch(e => logger.error('Budget expiry check error:', e.message));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info(`InfoSec API running on port ${PORT}`));
