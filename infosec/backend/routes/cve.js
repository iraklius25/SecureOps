const router   = require('express').Router();
const db       = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { fetchCVE } = require('../services/nvd');
const logger   = require('../services/logger');

const CVE_RE = /^CVE-\d{4}-\d+$/i;
const CACHE_TTL = "24 hours";

async function getCached(cveId) {
  const r = await db.query(
    `SELECT data FROM cve_cache WHERE cve_id=$1 AND fetched_at > NOW() - INTERVAL '${CACHE_TTL}'`,
    [cveId]
  );
  return r.rows[0]?.data || null;
}

async function upsertCache(cveId, data) {
  await db.query(
    `INSERT INTO cve_cache (cve_id, data) VALUES ($1,$2)
     ON CONFLICT (cve_id) DO UPDATE SET data=$2, fetched_at=NOW()`,
    [cveId, JSON.stringify(data)]
  );
}

/* GET /api/cve/:cveId  — lookup a single CVE with 24-hour cache */
router.get('/:cveId', auth, async (req, res) => {
  const cveId = req.params.cveId.toUpperCase();
  if (!CVE_RE.test(cveId)) return res.status(400).json({ error: 'Invalid CVE ID format (expected CVE-YYYY-NNNNN)' });

  try {
    const cached = await getCached(cveId);
    if (cached) return res.json({ ...cached, cached: true });

    const data = await fetchCVE(cveId);
    if (!data) return res.status(404).json({ error: `${cveId} not found in NVD` });

    await upsertCache(cveId, data);
    res.json({ ...data, cached: false });
  } catch (e) {
    logger.error('CVE lookup error:', e.message);
    res.status(502).json({ error: 'NVD API unavailable: ' + e.message });
  }
});

/* POST /api/cve/enrich-all  — bulk-enrich all vulns that have CVE IDs */
router.post('/enrich-all', auth, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { rows: vulns } = await db.query(
      `SELECT id, cve_id FROM vulnerabilities
       WHERE cve_id IS NOT NULL AND cve_id <> ''
       ORDER BY id`
    );

    let enriched = 0, skipped = 0, failed = 0;

    for (const v of vulns) {
      const cveId = v.cve_id.trim().toUpperCase();
      if (!CVE_RE.test(cveId)) { skipped++; continue; }

      try {
        let data = await getCached(cveId);
        if (!data) {
          data = await fetchCVE(cveId);
          if (data) await upsertCache(cveId, data);
        }
        if (data?.cvss_score != null) {
          await db.query(
            `UPDATE vulnerabilities SET cvss_score=$1 WHERE id=$2`,
            [data.cvss_score, v.id]
          );
        }
        enriched++;
      } catch (e) {
        logger.error(`CVE enrich failed for ${cveId}:`, e.message);
        failed++;
      }
    }

    res.json({ total: vulns.length, enriched, skipped, failed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
