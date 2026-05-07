const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');

// ── Helpers ────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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

// ── Trends (monthly data for last 6 months) ────────────────────
router.get('/trends', auth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT
        to_char(date_trunc('month', detected_at), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE status = 'open')                AS open_vulns,
        COUNT(*) FILTER (WHERE severity = 'critical')          AS critical_vulns,
        COUNT(*) FILTER (WHERE severity = 'high')              AS high_vulns,
        COUNT(*) FILTER (WHERE status IN ('closed','mitigated')) AS resolved_vulns,
        COALESCE(SUM(ale) FILTER (WHERE status = 'open'), 0)   AS total_ale
      FROM vulnerabilities
      WHERE detected_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', detected_at)
      ORDER BY date_trunc('month', detected_at) ASC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HTML Report ────────────────────────────────────────────────
// Accepts token as query param so window.open() works in the browser
router.get('/html', async (req, res) => {
  const rawToken = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!rawToken) return res.status(401).json({ error: 'Unauthorized' });
  try { require('jsonwebtoken').verify(rawToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
  try {
    const VALID_SECTIONS = new Set(['executive', 'ale', 'risks', 'assets', 'vulnstats']);
    const sections = (req.query.sections || 'executive,ale,risks,assets,vulnstats')
      .split(',')
      .map(s => s.trim())
      .filter(s => VALID_SECTIONS.has(s));

    const [assets, openVulns, topRisks, topALE, recentVulns, assetStats] = await Promise.all([
      db.query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='active') active, COUNT(*) FILTER (WHERE criticality='critical') critical_count FROM assets`),
      db.query(`SELECT severity, COUNT(*) cnt, SUM(ale) total_ale FROM vulnerabilities WHERE status='open' GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
      db.query(`SELECT r.title, r.risk_score, r.risk_level, r.treatment, a.ip_address, a.hostname FROM risks r LEFT JOIN assets a ON a.id=r.asset_id WHERE r.status='open' ORDER BY r.risk_score DESC LIMIT 10`),
      db.query(`SELECT v.title, v.severity, v.ale, v.cve_id, a.ip_address, a.hostname FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE v.status='open' ORDER BY v.ale DESC NULLS LAST LIMIT 10`),
      db.query(`SELECT v.title, v.severity, v.detected_at, a.ip_address FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id ORDER BY v.detected_at DESC LIMIT 20`),
      db.query(`SELECT asset_type, COUNT(*) cnt FROM assets GROUP BY asset_type ORDER BY cnt DESC`),
    ]);

    const totalALE = openVulns.rows.reduce((s, r) => s + parseFloat(r.total_ale || 0), 0);
    const fmt$ = n => '$' + parseFloat(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const sevColor = s => ({ critical: '#d73a49', high: '#e36209', medium: '#b08800', low: '#28a745' }[s] || '#666');

    const esc = escapeHtml;
    const sectionHtml = {
      executive: `
        <h2>Executive Summary</h2>
        <div style="display:flex;gap:24px;margin-bottom:24px">
          <div style="flex:1;background:#f6f8fa;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700">${parseInt(assets.rows[0].total) || 0}</div>
            <div style="color:#666;font-size:13px">Total Assets</div>
          </div>
          <div style="flex:1;background:#ffeef0;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#d73a49">${parseInt(assets.rows[0].critical_count) || 0}</div>
            <div style="color:#666;font-size:13px">Critical Assets</div>
          </div>
          <div style="flex:1;background:#fff3cd;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#d73a49">${fmt$(totalALE)}</div>
            <div style="color:#666;font-size:13px">Total ALE</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Severity</th><th>Open Count</th><th>Total ALE</th></tr></thead>
          <tbody>${openVulns.rows.map(r => `
            <tr>
              <td><span style="background:${sevColor(r.severity)};color:#fff;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600">${esc(r.severity).toUpperCase()}</span></td>
              <td>${parseInt(r.cnt) || 0}</td>
              <td style="font-weight:600;color:${r.severity === 'critical' ? '#d73a49' : '#333'}">${fmt$(r.total_ale)}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      ale: `
        <h2>ALE Breakdown — Top 10 by Risk</h2>
        <table>
          <thead><tr><th>Vulnerability</th><th>Severity</th><th>Asset</th><th>ALE</th><th>CVE</th></tr></thead>
          <tbody>${topALE.rows.map(r => `
            <tr>
              <td>${esc(r.title)}</td>
              <td><span style="background:${sevColor(r.severity)};color:#fff;padding:2px 8px;border-radius:3px;font-size:12px">${esc(r.severity)}</span></td>
              <td style="font-family:monospace">${esc(r.ip_address) || '—'}${r.hostname ? ` (${esc(r.hostname)})` : ''}</td>
              <td style="font-weight:700;color:#d73a49">${fmt$(r.ale)}</td>
              <td style="font-family:monospace;font-size:12px">${esc(r.cve_id) || '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      risks: `
        <h2>Top Open Risks</h2>
        <table>
          <thead><tr><th>Score</th><th>Title</th><th>Level</th><th>Treatment</th><th>Asset</th></tr></thead>
          <tbody>${topRisks.rows.map(r => `
            <tr>
              <td style="font-weight:700;font-size:18px;color:${r.risk_score >= 20 ? '#d73a49' : r.risk_score >= 12 ? '#e36209' : r.risk_score >= 6 ? '#b08800' : '#28a745'}">${parseInt(r.risk_score) || 0}</td>
              <td>${esc(r.title)}</td>
              <td>${esc(r.risk_level)}</td>
              <td>${esc(r.treatment)}</td>
              <td style="font-family:monospace">${esc(r.ip_address) || '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      assets: `
        <h2>Asset Summary by Type</h2>
        <table>
          <thead><tr><th>Asset Type</th><th>Count</th></tr></thead>
          <tbody>${assetStats.rows.map(r => `
            <tr><td>${esc(r.asset_type) || 'Unknown'}</td><td>${parseInt(r.cnt) || 0}</td></tr>
          `).join('')}</tbody>
        </table>`,

      vulnstats: `
        <h2>Recent Findings (Last 20)</h2>
        <table>
          <thead><tr><th>Title</th><th>Severity</th><th>Asset</th><th>Detected</th></tr></thead>
          <tbody>${recentVulns.rows.map(r => `
            <tr>
              <td>${esc(r.title)}</td>
              <td><span style="background:${sevColor(r.severity)};color:#fff;padding:2px 8px;border-radius:3px;font-size:12px">${esc(r.severity)}</span></td>
              <td style="font-family:monospace">${esc(r.ip_address) || '—'}</td>
              <td>${r.detected_at ? new Date(r.detected_at).toLocaleDateString() : '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,
    };

    const body = sections.map(s => sectionHtml[s] || '').join('<hr style="margin:32px 0;border:none;border-top:1px solid #e1e4e8">');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SecureOps Security Report — ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #24292e; background: #fff; padding: 40px; }
    .report-header { border-bottom: 3px solid #0366d6; padding-bottom: 24px; margin-bottom: 32px; }
    .report-header h1 { font-size: 28px; color: #0366d6; }
    .report-header .meta { font-size: 13px; color: #666; margin-top: 6px; }
    h2 { font-size: 20px; color: #24292e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e1e4e8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
    th { background: #f6f8fa; padding: 10px 12px; text-align: left; font-weight: 600; border: 1px solid #e1e4e8; }
    td { padding: 10px 12px; border: 1px solid #e1e4e8; vertical-align: top; }
    tr:nth-child(even) td { background: #fafbfc; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e1e4e8; font-size: 12px; color: #999; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>🛡 SecureOps Security Report</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Sections: ${escapeHtml(sections.join(', '))}</div>
  </div>
  ${body}
  <div class="footer">SecureOps InfoSec Risk Management Platform &nbsp;|&nbsp; Confidential — For Internal Use Only</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="secureops-report.html"');
    res.send(html);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
