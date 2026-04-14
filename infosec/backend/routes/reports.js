const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');

// ── Helpers ────────────────────────────────────────────────────
function toCSV(rows, columns) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const lines  = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      if (v == null) return '""';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// ── Executive summary ──────────────────────────────────────────
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

// ── ALE breakdown ──────────────────────────────────────────────
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

// ── CSV Exports ────────────────────────────────────────────────

// GET /api/reports/export/vulnerabilities.csv
router.get('/export/vulnerabilities.csv', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT v.title, v.severity, v.cve_id, v.cvss_score, v.status, v.vuln_type,
        v.asset_value, v.exposure_factor, v.aro, v.sle, v.ale,
        v.detected_at, v.due_date, v.resolved_at,
        a.ip_address, a.hostname, a.department, a.criticality
      FROM vulnerabilities v
      LEFT JOIN assets a ON a.id = v.asset_id
      ORDER BY v.cvss_score DESC NULLS LAST, v.detected_at DESC
    `);
    const columns = [
      { key: 'title',           label: 'Title' },
      { key: 'severity',        label: 'Severity' },
      { key: 'cve_id',          label: 'CVE' },
      { key: 'cvss_score',      label: 'CVSS' },
      { key: 'status',          label: 'Status' },
      { key: 'vuln_type',       label: 'Type' },
      { key: 'ip_address',      label: 'Asset IP' },
      { key: 'hostname',        label: 'Hostname' },
      { key: 'department',      label: 'Department' },
      { key: 'criticality',     label: 'Asset Criticality' },
      { key: 'asset_value',     label: 'Asset Value ($)' },
      { key: 'exposure_factor', label: 'Exposure Factor (%)' },
      { key: 'aro',             label: 'ARO' },
      { key: 'sle',             label: 'SLE ($)' },
      { key: 'ale',             label: 'ALE ($)' },
      { key: 'detected_at',     label: 'Detected At' },
      { key: 'due_date',        label: 'Due Date' },
      { key: 'resolved_at',     label: 'Resolved At' },
    ];
    sendCSV(res, 'vulnerabilities.csv', toCSV(r.rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/export/risks.csv
router.get('/export/risks.csv', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT ri.title, ri.description, ri.category, ri.likelihood, ri.impact,
        ri.risk_score, ri.risk_level, ri.treatment, ri.status, ri.review_date,
        ri.created_at,
        a.ip_address, a.hostname,
        u.username AS owner_username
      FROM risks ri
      LEFT JOIN assets a ON a.id = ri.asset_id
      LEFT JOIN users  u ON u.id = ri.owner
      ORDER BY ri.risk_score DESC
    `);
    const columns = [
      { key: 'title',          label: 'Title' },
      { key: 'description',    label: 'Description' },
      { key: 'category',       label: 'Category' },
      { key: 'likelihood',     label: 'Likelihood' },
      { key: 'impact',         label: 'Impact' },
      { key: 'risk_score',     label: 'Risk Score' },
      { key: 'risk_level',     label: 'Risk Level' },
      { key: 'treatment',      label: 'Treatment' },
      { key: 'status',         label: 'Status' },
      { key: 'ip_address',     label: 'Asset IP' },
      { key: 'hostname',       label: 'Hostname' },
      { key: 'owner_username', label: 'Owner' },
      { key: 'review_date',    label: 'Review Date' },
      { key: 'created_at',     label: 'Created At' },
    ];
    sendCSV(res, 'risks.csv', toCSV(r.rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/export/assets.csv
router.get('/export/assets.csv', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT a.ip_address, a.hostname, a.mac_address, a.asset_type, a.os_name, a.os_version,
        a.department, a.owner, a.location, a.criticality, a.asset_value, a.status,
        a.first_seen, a.last_seen, a.last_scanned,
        COUNT(DISTINCT ap.id) AS open_ports,
        COUNT(DISTINCT v.id) FILTER (WHERE v.status='open') AS open_vulns,
        COUNT(DISTINCT v.id) FILTER (WHERE v.severity='critical' AND v.status='open') AS critical_vulns,
        COALESCE(SUM(v.ale) FILTER (WHERE v.status='open'), 0) AS total_ale
      FROM assets a
      LEFT JOIN asset_ports ap ON ap.asset_id = a.id
      LEFT JOIN vulnerabilities v ON v.asset_id = a.id
      GROUP BY a.id
      ORDER BY a.criticality, a.ip_address
    `);
    const columns = [
      { key: 'ip_address',    label: 'IP Address' },
      { key: 'hostname',      label: 'Hostname' },
      { key: 'mac_address',   label: 'MAC Address' },
      { key: 'asset_type',    label: 'Type' },
      { key: 'os_name',       label: 'OS' },
      { key: 'department',    label: 'Department' },
      { key: 'owner',         label: 'Owner' },
      { key: 'location',      label: 'Location' },
      { key: 'criticality',   label: 'Criticality' },
      { key: 'asset_value',   label: 'Asset Value ($)' },
      { key: 'status',        label: 'Status' },
      { key: 'open_ports',    label: 'Open Ports' },
      { key: 'open_vulns',    label: 'Open Vulns' },
      { key: 'critical_vulns',label: 'Critical Vulns' },
      { key: 'total_ale',     label: 'Total ALE ($)' },
      { key: 'first_seen',    label: 'First Seen' },
      { key: 'last_seen',     label: 'Last Seen' },
      { key: 'last_scanned',  label: 'Last Scanned' },
    ];
    sendCSV(res, 'assets.csv', toCSV(r.rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reports/export/executive.csv
router.get('/export/executive.csv', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT v.title, v.severity, v.cve_id, v.ale, a.ip_address, a.hostname
      FROM vulnerabilities v
      LEFT JOIN assets a ON a.id = v.asset_id
      WHERE v.status='open'
      ORDER BY v.ale DESC NULLS LAST
      LIMIT 100
    `);
    const columns = [
      { key: 'title',      label: 'Vulnerability' },
      { key: 'severity',   label: 'Severity' },
      { key: 'cve_id',     label: 'CVE' },
      { key: 'ip_address', label: 'Asset IP' },
      { key: 'hostname',   label: 'Hostname' },
      { key: 'ale',        label: 'ALE ($)' },
    ];
    sendCSV(res, 'executive_summary.csv', toCSV(r.rows, columns));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
