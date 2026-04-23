/**
 * NIST National Vulnerability Database (NVD) API v2 client
 * Free tier: 5 requests / 30 seconds  (no key needed)
 * With key:  50 requests / 30 seconds (set NVD_API_KEY in .env)
 */
const logger = require('./logger');
const db     = require('../db');

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

async function getNvdApiKey() {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='nvd_api_key'`);
    if (r.rows[0]?.value) return r.rows[0].value;
  } catch (_) {}
  return process.env.NVD_API_KEY || null;
}

// Simple rate-limiter: enforce minimum gap between requests
let lastCall = 0;
const delay  = ms => new Promise(r => setTimeout(r, ms));

async function fetchCVE(cveId) {
  const apiKey = await getNvdApiKey();
  const MIN_GAP = apiKey ? 700 : 6500;

  const now  = Date.now();
  const wait = Math.max(0, lastCall + MIN_GAP - now);
  if (wait > 0) await delay(wait);
  lastCall = Date.now();

  const headers = { 'User-Agent': 'SecureOps/2.0' };
  if (apiKey) headers['apiKey'] = apiKey;

  const url  = `${NVD_BASE}?cveId=${encodeURIComponent(cveId)}`;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });

  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`NVD API returned ${resp.status}`);

  const json = await resp.json();
  const cve  = json.vulnerabilities?.[0]?.cve;
  if (!cve) return null;

  return parseCVE(cve);
}

function parseCVE(cve) {
  // Description (English preferred)
  const description = cve.descriptions?.find(d => d.lang === 'en')?.value || '';

  // CVSS — prefer v3.1, then v3.0, then v2
  const m31  = cve.metrics?.cvssMetricV31?.[0];
  const m30  = cve.metrics?.cvssMetricV30?.[0];
  const m2   = cve.metrics?.cvssMetricV2?.[0];
  const best = m31 || m30 || null;

  const cvss_score    = best?.cvssData?.baseScore    ?? m2?.cvssData?.baseScore    ?? null;
  const cvss_severity = best?.cvssData?.baseSeverity ?? m2?.cvssData?.baseSeverity ?? null;
  const cvss_vector   = best?.cvssData?.vectorString ?? m2?.cvssData?.vectorString  ?? null;
  const cvss_version  = m31 ? '3.1' : m30 ? '3.0' : m2 ? '2.0' : null;

  // CWE IDs
  const cwe_ids = (cve.weaknesses || [])
    .flatMap(w => w.description || [])
    .map(d => d.value)
    .filter(v => v.startsWith('CWE-'));

  // References
  const references = (cve.references || []).map(r => ({
    url:  r.url,
    tags: r.tags || [],
  }));

  return {
    cve_id:        cve.id,
    description,
    cvss_score,
    cvss_severity: cvss_severity?.toLowerCase() || null,
    cvss_vector,
    cvss_version,
    cwe_ids:      [...new Set(cwe_ids)],
    references,
    published:     cve.published     || null,
    last_modified: cve.lastModified  || null,
  };
}

module.exports = { fetchCVE };
