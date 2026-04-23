const logger = require('./logger');
const db     = require('../db');

const ABUSEIPDB_URL = 'https://api.abuseipdb.com/api/v2/check';

async function getApiKey() {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='abuseipdb_api_key'`);
    if (r.rows[0]?.value) return r.rows[0].value;
  } catch (_) {}
  return process.env.ABUSEIPDB_API_KEY || null;
}

/**
 * Check an IP address against AbuseIPDB API v2.
 * Returns null if no API key is configured.
 */
async function checkIP(ip) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    logger.debug('threatintel: ABUSEIPDB_API_KEY not set, skipping check');
    return null;
  }

  const url = `${ABUSEIPDB_URL}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      logger.error(`threatintel: AbuseIPDB returned ${response.status} for ${ip}: ${body}`);
      return null;
    }

    const json = await response.json();
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
    if (e.name === 'AbortError') {
      logger.error(`threatintel: request timed out for ${ip}`);
    } else {
      logger.error(`threatintel: error checking ${ip}: ${e.message}`);
    }
    return null;
  }
}

module.exports = { checkIP };
