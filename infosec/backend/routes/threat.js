const router  = require('express').Router();
const https   = require('https');
const db      = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { checkIP } = require('../services/threatintel');
const logger  = require('../services/logger');

// Promisified HTTPS GET — works on all Node.js 18+ without experimental flags.
// rejectUnauthorized defaults to false to handle corporate SSL-inspection proxies
// that replace external certificates with their own CA-signed ones. Set
// HTTPS_REJECT_UNAUTHORIZED=true in .env to enable strict TLS verification.
const rejectUnauthorized = process.env.HTTPS_REJECT_UNAUTHORIZED === 'true';
const tlsAgent = new https.Agent({ rejectUnauthorized });

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: tlsAgent, headers: { 'User-Agent': 'SecureOps/1.0', ...headers } }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { reject(new Error('Invalid JSON from remote API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// GET /api/threat — list threat_intel table joined with assets
router.get('/', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        t.*,
        a.hostname,
        a.criticality
      FROM threat_intel t
      LEFT JOIN assets a ON a.ip_address = t.ip_address
      ORDER BY t.abuse_score DESC, t.fetched_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/threat/check — check single IP
router.post('/check', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'ip is required' });

  try {
    const result = await checkIP(ip);
    if (!result) {
      return res.status(503).json({ error: 'AbuseIPDB check failed — verify API key and that the server can reach api.abuseipdb.com:443 (check firewall rules and backend logs for details)' });
    }

    // Upsert to threat_intel table
    await db.query(`
      INSERT INTO threat_intel
        (ip_address, is_malicious, abuse_score, country_code, usage_type, isp, domain_name,
         total_reports, last_reported_at, raw_data, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (ip_address) DO UPDATE SET
        is_malicious     = EXCLUDED.is_malicious,
        abuse_score      = EXCLUDED.abuse_score,
        country_code     = EXCLUDED.country_code,
        usage_type       = EXCLUDED.usage_type,
        isp              = EXCLUDED.isp,
        domain_name      = EXCLUDED.domain_name,
        total_reports    = EXCLUDED.total_reports,
        last_reported_at = EXCLUDED.last_reported_at,
        raw_data         = EXCLUDED.raw_data,
        fetched_at       = NOW()
    `, [
      result.ip_address, result.is_malicious, result.abuse_score,
      result.country_code, result.usage_type, result.isp, result.domain_name,
      result.total_reports, result.last_reported_at,
      JSON.stringify(result.raw_data),
    ]);

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/threat/scan-all — check all active assets (fire and forget)
router.post('/scan-all', auth, requireRole('admin'), async (req, res) => {
  res.json({ message: 'Threat intelligence scan started for all active assets' });

  // Fire and forget after responding
  (async () => {
    try {
      const assets = await db.query(
        `SELECT ip_address FROM assets WHERE status='active' LIMIT 100`
      );

      for (const asset of assets.rows) {
        const ip = asset.ip_address;
        try {
          const result = await checkIP(ip);
          if (result) {
            await db.query(`
              INSERT INTO threat_intel
                (ip_address, is_malicious, abuse_score, country_code, usage_type, isp, domain_name,
                 total_reports, last_reported_at, raw_data, fetched_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
              ON CONFLICT (ip_address) DO UPDATE SET
                is_malicious     = EXCLUDED.is_malicious,
                abuse_score      = EXCLUDED.abuse_score,
                country_code     = EXCLUDED.country_code,
                usage_type       = EXCLUDED.usage_type,
                isp              = EXCLUDED.isp,
                domain_name      = EXCLUDED.domain_name,
                total_reports    = EXCLUDED.total_reports,
                last_reported_at = EXCLUDED.last_reported_at,
                raw_data         = EXCLUDED.raw_data,
                fetched_at       = NOW()
            `, [
              result.ip_address, result.is_malicious, result.abuse_score,
              result.country_code, result.usage_type, result.isp, result.domain_name,
              result.total_reports, result.last_reported_at,
              JSON.stringify(result.raw_data),
            ]);
            logger.info(`threatintel: checked ${ip} — score: ${result.abuse_score}`);
          }
        } catch (err) {
          logger.error(`threatintel: scan-all error for ${ip}: ${err.message}`);
        }
        // 1100ms delay between calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      logger.info(`threatintel: scan-all complete, checked ${assets.rows.length} assets`);
    } catch (e) {
      logger.error(`threatintel: scan-all fatal error: ${e.message}`);
    }
  })();
});

// DELETE /api/threat/:ip — remove from cache
router.delete('/:ip', auth, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM threat_intel WHERE ip_address=$1', [req.params.ip]);
    res.json({ message: 'Removed from threat intel cache' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/threat/shodan — Shodan host lookup
router.post('/shodan', auth, requireRole('admin', 'analyst'), async (req, res) => {
  const { ip } = req.body;
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim()))
    return res.status(400).json({ error: 'Valid IPv4 address required' });
  try {
    const keyRow = await db.query("SELECT value FROM settings WHERE key='shodan_api_key'");
    const apiKey = keyRow.rows[0]?.value?.trim();
    if (!apiKey) return res.status(503).json({ error: 'Shodan API key not configured. Add it in Settings → Threat Intelligence.' });

    const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(ip.trim())}?key=${apiKey}`;
    const { status, body } = await httpsGet(url);
    if (status === 404) return res.status(404).json({ error: 'No Shodan data available for this IP.' });
    if (status !== 200) return res.status(502).json({ error: body.error || `Shodan API returned ${status}` });
    res.json(body);
  } catch (e) {
    logger.error('Shodan lookup error:', e.message);
    res.status(502).json({ error: `Shodan lookup failed: ${e.message}` });
  }
});

// POST /api/threat/nvd — NVD CVE search
router.post('/nvd', auth, async (req, res) => {
  const { query, cveId } = req.body;
  if (!query && !cveId) return res.status(400).json({ error: 'query or cveId required' });
  if (query && query.length > 200) return res.status(400).json({ error: 'Query too long' });
  try {
    const keyRow = await db.query("SELECT value FROM settings WHERE key='nvd_api_key'");
    const apiKey = keyRow.rows[0]?.value?.trim();

    let url = 'https://services.nvd.nist.gov/rest/json/cves/2.0?';
    if (cveId) url += `cveId=${encodeURIComponent(cveId.trim())}`;
    else url += `keywordSearch=${encodeURIComponent(query.trim())}&resultsPerPage=20`;

    const extraHeaders = apiKey ? { apiKey } : {};
    const { status, body } = await httpsGet(url, extraHeaders);
    if (status !== 200) return res.status(502).json({ error: `NVD API returned ${status} — try again later` });
    res.json(body);
  } catch (e) {
    logger.error('NVD lookup error:', e.message);
    res.status(502).json({ error: `NVD lookup failed: ${e.message}` });
  }
});

module.exports = router;
