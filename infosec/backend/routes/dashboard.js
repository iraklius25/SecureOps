// dashboard.js
const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [assets, vulns, risks, recentScans, aleTotal, critAssets, trendVulns] = await Promise.all([
      db.query(`SELECT status, COUNT(*) FROM assets GROUP BY status`),
      db.query(`SELECT severity, status, COUNT(*) FROM vulnerabilities GROUP BY severity, status`),
      db.query(`SELECT risk_level, COUNT(*) FROM risks WHERE status='open' GROUP BY risk_level`),
      db.query(`SELECT id,name,target,status,vulns_found,assets_found,created_at FROM scan_jobs ORDER BY created_at DESC LIMIT 5`),
      db.query(`SELECT COALESCE(SUM(ale),0) AS total_ale FROM vulnerabilities WHERE status='open'`),
      db.query(`SELECT COUNT(*) FROM assets WHERE criticality IN ('critical','high') AND status='active'`),
      db.query(`
        SELECT DATE_TRUNC('day', detected_at) AS day, severity, COUNT(*) AS cnt
        FROM vulnerabilities WHERE detected_at > NOW()-INTERVAL '30 days'
        GROUP BY 1,2 ORDER BY 1
      `),
    ]);

    const assetMap  = Object.fromEntries(assets.rows.map(r => [r.status, parseInt(r.count)]));
    const vulnMap   = {};
    vulns.rows.forEach(r => {
      if (!vulnMap[r.severity]) vulnMap[r.severity] = {};
      vulnMap[r.severity][r.status] = parseInt(r.count);
    });
    const riskMap   = Object.fromEntries(risks.rows.map(r => [r.risk_level, parseInt(r.count)]));

    res.json({
      assets: { ...assetMap, total: Object.values(assetMap).reduce((a,b)=>a+b,0) },
      vulnerabilities: vulnMap,
      open_vulns_by_severity: {
        critical: (vulnMap.critical?.open||0),
        high:     (vulnMap.high?.open||0),
        medium:   (vulnMap.medium?.open||0),
        low:      (vulnMap.low?.open||0),
      },
      risks: riskMap,
      total_ale: parseFloat(aleTotal.rows[0].total_ale),
      critical_assets: parseInt(critAssets.rows[0].count),
      recent_scans: recentScans.rows,
      vuln_trend: trendVulns.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
