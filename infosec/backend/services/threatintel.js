const https   = require('https');
const logger  = require('./logger');
const db      = require('../db');

const ABUSEIPDB_HOST = 'api.abuseipdb.com';
const ABUSEIPDB_PATH = '/api/v2/check';

// Allow disabling TLS verification via env — needed when a corporate proxy
// presents its own certificate (set ABUSEIPDB_REJECT_UNAUTHORIZED=false in .env)
const REJECT_UNAUTHORIZED = process.env.ABUSEIPDB_REJECT_UNAUTHORIZED !== 'false';

async function getApiKey() {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='abuseipdb_api_key'`);
    if (r.rows[0]?.value) return r.rows[0].value;
  } catch (_) {}
  return process.env.ABUSEIPDB_API_KEY || null;
}

function httpsGet(options, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Check an IP address against AbuseIPDB API v2.
 * Returns null if no API key is configured or the request fails.
 */
async function checkIP(ip) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    logger.debug('threatintel: ABUSEIPDB_API_KEY not set, skipping check');
    return null;
  }

  const query = `ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`;

  try {
    const { status, body } = await httpsGet({
      hostname: ABUSEIPDB_HOST,
      path: `${ABUSEIPDB_PATH}?${query}`,
      method: 'GET',
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
      rejectUnauthorized: REJECT_UNAUTHORIZED,
    });

    if (status !== 200) {
      logger.error(`threatintel: AbuseIPDB returned HTTP ${status} for ${ip}: ${body}`);
      return null;
    }

    let json;
    try { json = JSON.parse(body); } catch (_) {
      logger.error(`threatintel: non-JSON response for ${ip}`);
      return null;
    }

    const d = json.data;
    if (!d) {
      logger.warn(`threatintel: unexpected response format for ${ip}`);
      return null;
    }

    return {
      ip_address: d.ipAddress || ip,
      is_malicious: (d.abuseConfidenceScore || 0) >= 50,
      abuse_score: d.abuseConfidenceScore || 0,
      country_code: d.countryCode || null,
      usage_type: d.usageType || null,
      isp: d.isp || null,
      domain_name: d.domain || null,
      total_reports: d.totalReports || 0,
      last_reported_at: d.lastReportedAt || null,
      raw_data: d,
    };
  } catch (e) {
    logger.error(`threatintel: error checking ${ip}: ${e.message}`);
    return null;
  }
}

module.exports = { checkIP };
