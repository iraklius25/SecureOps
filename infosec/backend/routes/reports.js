const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/reports/executive  — executive summary JSON
router.get('/executive', auth, async (req, res) => {
  try {
    const [assets, openVulns, topRisks, topALE, recentVulns] = await Promise.all([
      db.query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='active') active, COUNT(*) FILTER (WHERE criticality='critical') critical_count FROM assets`),
      db.query(`SELECT severity, COUNT(*) cnt, SUM(ale) total_ale FROM vulnerabilities WHERE status='open' GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
      db.query(`SELECT r.*, a.ip_address, a.hostname FROM risks r LEFT JOIN assets a ON a.id=r.asset_id WHERE r.status='open' ORDER BY r.risk_score DESC LIMIT 10`),
      db.query(`SELECT v.title, v.severity, v.ale, v.cve_id, a.ip_address, a.hostname FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE v.status='open' ORDER BY v.ale DESC NULLS LAST LIMIT 10`),
      db.query(`SELECT v.title, v.severity, v.detected_at, a.ip_address FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id ORDER BY v.detected_at DESC LIMIT 20`),
    ]);
    const totalALE = openVulns.rows.reduce((s,r)=>s+parseFloat(r.total_ale||0),0);
    res.json({
      generated_at: new Date(),
      summary: { ...assets.rows[0], total_ale: totalALE },
      vulns_by_severity: openVulns.rows,
      top_risks: topRisks.rows,
      top_ale_risks: topALE.rows,
      recent_findings: recentVulns.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/ale  — full ALE breakdown
router.get('/ale', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT v.id, v.title, v.severity, v.cvss_score, v.cve_id,
        v.asset_value, v.exposure_factor, v.aro, v.sle, v.ale,
        a.ip_address, a.hostname, a.criticality, a.department
      FROM vulnerabilities v
      LEFT JOIN assets a ON a.id=v.asset_id
      WHERE v.status='open'
      ORDER BY v.ale DESC NULLS LAST
    `);
    const total = r.rows.reduce((s,row)=>s+parseFloat(row.ale||0),0);
    res.json({ total_ale: total, count: r.rows.length, items: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
