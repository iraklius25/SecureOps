// dashboard.js
const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [
      assets, vulns, risks, recentScans, aleTotal, critAssets, trendVulns,
      riskTrend, slaStats, topRiskAssets, riskTreatment, riskByCategory, topOpenRisks, overdueRisks, appetite,
    ] = await Promise.all([
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
      // Risk trend: open risks by level per week (last 8 weeks)
      db.query(`
        SELECT DATE_TRUNC('week', created_at) AS week, risk_level, COUNT(*) AS cnt
        FROM risks
        WHERE created_at > NOW()-INTERVAL '8 weeks'
        GROUP BY 1,2 ORDER BY 1
      `),
      // SLA: overdue open vulns + avg days open
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('closed','mitigated','false_positive')) AS overdue,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-detected_at))/86400) FILTER (WHERE status NOT IN ('closed','mitigated','false_positive'))) AS avg_days_open,
          COUNT(*) FILTER (WHERE status IN ('closed','mitigated') AND resolved_at IS NOT NULL) AS resolved,
          ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-detected_at))/86400) FILTER (WHERE status IN ('closed','mitigated') AND resolved_at IS NOT NULL)) AS avg_days_to_resolve
        FROM vulnerabilities
      `),
      // Top risk assets (assets with most open critical/high vulns)
      db.query(`
        SELECT a.id, a.ip_address, a.hostname, a.criticality,
          COUNT(v.id) FILTER (WHERE v.severity='critical' AND v.status='open') AS critical_count,
          COUNT(v.id) FILTER (WHERE v.severity='high'     AND v.status='open') AS high_count,
          COALESCE(SUM(v.ale) FILTER (WHERE v.status='open'), 0) AS total_ale
        FROM assets a
        JOIN vulnerabilities v ON v.asset_id = a.id
        WHERE v.severity IN ('critical','high') AND v.status='open'
        GROUP BY a.id, a.ip_address, a.hostname, a.criticality
        ORDER BY critical_count DESC, high_count DESC, total_ale DESC
        LIMIT 8
      `),
      // Risk treatment breakdown
      db.query(`SELECT COALESCE(treatment,'mitigate') AS treatment, COUNT(*) AS cnt FROM risks WHERE status='open' GROUP BY 1`),
      // Risk by category
      db.query(`SELECT COALESCE(category,'Uncategorised') AS category, COUNT(*) AS cnt, ROUND(AVG(risk_score)) AS avg_score FROM risks WHERE status='open' GROUP BY 1 ORDER BY cnt DESC LIMIT 8`),
      // Top open risks by score
      db.query(`SELECT r.id, r.title, r.risk_level, r.risk_score, r.treatment, r.category, a.ip_address, a.hostname FROM risks r LEFT JOIN assets a ON a.id=r.asset_id WHERE r.status='open' ORDER BY r.risk_score DESC LIMIT 10`),
      // Risks past review date
      db.query(`SELECT COUNT(*) AS overdue FROM risks WHERE status='open' AND review_date IS NOT NULL AND review_date < NOW()`),
      // Risk appetite thresholds
      db.query(`SELECT max_risk_score, max_ale, max_open_critical, notes FROM risk_appetite LIMIT 1`),
    ]);

    const assetMap = Object.fromEntries(assets.rows.map(r => [r.status, parseInt(r.count)]));
    const vulnMap  = {};
    vulns.rows.forEach(r => {
      if (!vulnMap[r.severity]) vulnMap[r.severity] = {};
      vulnMap[r.severity][r.status] = parseInt(r.count);
    });
    const riskMap = Object.fromEntries(risks.rows.map(r => [r.risk_level, parseInt(r.count)]));

    res.json({
      assets: { ...assetMap, total: Object.values(assetMap).reduce((a,b)=>a+b,0) },
      vulnerabilities: vulnMap,
      open_vulns_by_severity: {
        critical: (vulnMap.critical?.open || 0),
        high:     (vulnMap.high?.open     || 0),
        medium:   (vulnMap.medium?.open   || 0),
        low:      (vulnMap.low?.open      || 0),
      },
      risks: riskMap,
      total_ale:      parseFloat(aleTotal.rows[0].total_ale),
      critical_assets: parseInt(critAssets.rows[0].count),
      recent_scans:   recentScans.rows,
      vuln_trend:     trendVulns.rows,
      risk_trend:     riskTrend.rows,
      sla:             slaStats.rows[0],
      top_risk_assets: topRiskAssets.rows,
      risk_treatment:  Object.fromEntries((riskTreatment.rows||[]).map(r => [r.treatment, parseInt(r.cnt)])),
      risk_by_category: riskByCategory.rows,
      top_open_risks:  topOpenRisks.rows,
      overdue_risks:   parseInt(overdueRisks.rows[0]?.overdue || 0),
      risk_appetite:   appetite.rows[0] || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
