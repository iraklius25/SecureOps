require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const logger = require('./services/logger');

const app = express();

// ── Security middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/assets',   require('./routes/assets'));
app.use('/api/scans',    require('./routes/scans'));
app.use('/api/vulns',    require('./routes/vulnerabilities'));
app.use('/api/risks',    require('./routes/risks'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/dashboard',require('./routes/dashboard'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/groups',   require('./routes/groups'));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', time: new Date() }));

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
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
