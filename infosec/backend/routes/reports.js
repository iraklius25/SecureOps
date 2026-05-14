const router = require('express').Router();
const db     = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const fs     = require('fs');
const path   = require('path');

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
      db.query(`SELECT r.id, r.title, r.risk_score, r.risk_level, r.treatment, r.status, a.ip_address, a.hostname FROM risks r LEFT JOIN assets a ON a.id=r.asset_id WHERE r.status='open' ORDER BY r.risk_score DESC LIMIT 10`),
      db.query(`SELECT v.id, v.title, v.severity, v.ale, v.cve_id, a.ip_address, a.hostname FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE v.status='open' ORDER BY v.ale DESC NULLS LAST LIMIT 10`),
      db.query(`SELECT v.id, v.title, v.severity, v.detected_at, a.ip_address FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id ORDER BY v.detected_at DESC LIMIT 20`),
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
router.get('/html', async (req, res) => {
  const rawToken = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!rawToken) return res.status(401).json({ error: 'Unauthorized' });
  try { require('jsonwebtoken').verify(rawToken, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  try {
    const VALID_SECTIONS = new Set(['management_summary','executive','risk_appetite','kpi_metrics','risks','ale','vulnstats','assets','compliance','certifications']);
    const sections = (req.query.sections || 'management_summary,executive,risk_appetite,kpi_metrics,risks,ale,vulnstats,assets')
      .split(',').map(s => s.trim()).filter(s => VALID_SECTIONS.has(s));

    // Validate and sanitise date params
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const from = dateRe.test(req.query.from) ? req.query.from : null;
    const to   = dateRe.test(req.query.to)   ? req.query.to   : null;
    const vulnFrom = from ? `AND v.detected_at >= '${from}'::date` : '';
    const vulnTo   = to   ? `AND v.detected_at < ('${to}'::date + INTERVAL '1 day')` : '';

    // Fetch organisation logo (embed as base64)
    let logoTag = '';
    try {
      const logoRow = await db.query("SELECT value FROM settings WHERE key='org_logo'");
      const logoPath = logoRow.rows[0]?.value;
      if (logoPath && fs.existsSync(logoPath)) {
        const ext = path.extname(logoPath).toLowerCase();
        const mimeMap = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp' };
        const mime = mimeMap[ext] || 'image/png';
        const b64  = fs.readFileSync(logoPath).toString('base64');
        logoTag = `<img src="data:${mime};base64,${b64}" alt="Organisation Logo" style="max-height:64px;max-width:220px;display:block;margin-bottom:12px">`;
      }
    } catch {}

    // Run all data queries in parallel
    const [
      assets, openVulns, topRisks, topALE, recentVulns, assetStats,
      riskAppetite, riskKpis, vulnKpis, riskTreatment, complianceData, certData,
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='active') active, COUNT(*) FILTER (WHERE criticality='critical') critical_count FROM assets`),
      db.query(`SELECT severity, COUNT(*) cnt, SUM(ale) total_ale FROM vulnerabilities WHERE status='open' GROUP BY severity ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
      db.query(`SELECT r.title, r.risk_score, r.risk_level, r.treatment, r.category, a.ip_address, a.hostname FROM risks r LEFT JOIN assets a ON a.id=r.asset_id WHERE r.status='open' ORDER BY r.risk_score DESC LIMIT 15`),
      db.query(`SELECT v.title, v.severity, v.ale, v.cve_id, a.ip_address, a.hostname FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE v.status='open' ${vulnFrom} ${vulnTo} ORDER BY v.ale DESC NULLS LAST LIMIT 15`),
      db.query(`SELECT v.title, v.severity, v.detected_at, a.ip_address FROM vulnerabilities v LEFT JOIN assets a ON a.id=v.asset_id WHERE 1=1 ${vulnFrom} ${vulnTo} ORDER BY v.detected_at DESC LIMIT 30`),
      db.query(`SELECT asset_type, COUNT(*) cnt, COUNT(*) FILTER (WHERE criticality='critical') critical_cnt FROM assets GROUP BY asset_type ORDER BY cnt DESC`),
      db.query(`SELECT max_risk_score, max_ale, max_open_critical, notes FROM risk_appetite LIMIT 1`),
      db.query(`SELECT COUNT(*) FILTER (WHERE status='open') AS open_risks, COUNT(*) FILTER (WHERE risk_level='critical' AND status='open') AS critical_risks, COUNT(*) FILTER (WHERE risk_level='high' AND status='open') AS high_risks, ROUND(AVG(risk_score) FILTER (WHERE status='open'),1) AS avg_score FROM risks`),
      db.query(`SELECT COUNT(*) FILTER (WHERE severity='critical' AND status='open') AS crit_vulns, COUNT(*) FILTER (WHERE severity='high' AND status='open') AS high_vulns, COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('closed','mitigated','false_positive','accepted')) AS overdue, ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at-detected_at))/86400) FILTER (WHERE resolved_at IS NOT NULL AND status IN ('closed','mitigated')),1) AS mttr, COALESCE(SUM(ale) FILTER (WHERE status='open'),0) AS total_ale FROM vulnerabilities`),
      db.query(`SELECT COALESCE(treatment,'mitigate') AS treatment, COUNT(*) AS cnt FROM risks WHERE status='open' GROUP BY 1 ORDER BY 1`),
      db.query(`SELECT framework, COUNT(*) total, COUNT(*) FILTER (WHERE status='compliant') compliant, COUNT(*) FILTER (WHERE status='non_compliant') non_compliant FROM compliance_controls GROUP BY framework ORDER BY framework`).catch(() => ({ rows: [] })),
      db.query(`SELECT c.name, c.framework, c.phase, c.status, c.completion_pct, c.target_date, c.expiry_date, o.name AS org_name FROM certifications c LEFT JOIN cert_organizations o ON o.id=c.org_id ORDER BY c.framework, c.name`).catch(() => ({ rows: [] })),
    ]);

    const totalALE  = openVulns.rows.reduce((s, r) => s + parseFloat(r.total_ale || 0), 0);
    const ap        = riskAppetite.rows[0] || { max_risk_score: 0, max_ale: 0, max_open_critical: 0 };
    const kpi       = vulnKpis.rows[0]    || {};
    const rkpi      = riskKpis.rows[0]    || {};
    const critRisks = parseInt(rkpi.critical_risks || 0);
    const aleBreached   = ap.max_ale && parseFloat(kpi.total_ale) > parseFloat(ap.max_ale);
    const critBreached  = ap.max_open_critical !== undefined && critRisks > parseInt(ap.max_open_critical);
    const scoreBreached = ap.max_risk_score && (topRisks.rows[0]?.risk_score || 0) > ap.max_risk_score;
    const appetiteBreached = aleBreached || critBreached || scoreBreached;

    const periodLabel = from && to ? `${from} — ${to}` : from ? `From ${from}` : to ? `Up to ${to}` : 'All time';

    const fmt$     = n  => '$' + parseFloat(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const sevColor = s  => ({ critical: '#d73a49', high: '#e36209', medium: '#b08800', low: '#28a745' }[s] || '#666');
    const ragColor = r  => ({ red: '#d73a49', amber: '#f59e0b', green: '#28a745', grey: '#6b7280' }[r] || '#6b7280');
    const lvlColor = l  => ({ critical: '#d73a49', high: '#e36209', medium: '#b08800', low: '#28a745' }[l] || '#666');
    const badge    = (txt, col) => `<span style="background:${col};color:#fff;padding:2px 9px;border-radius:3px;font-size:11px;font-weight:700">${escapeHtml(txt).toUpperCase()}</span>`;
    const esc = escapeHtml;

    const sectionHtml = {

      management_summary: `
        <h2 style="font-size:22px">Top Management Security Summary</h2>
        <p style="color:#555;font-size:13px;margin-bottom:20px">Period: <strong>${esc(periodLabel)}</strong> &nbsp;|&nbsp; Prepared by SecureOps Risk Management Platform</p>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
          <div style="background:#f6f8fa;border-radius:8px;padding:16px;text-align:center;border-top:4px solid #0366d6">
            <div style="font-size:30px;font-weight:800">${parseInt(assets.rows[0]?.total)||0}</div>
            <div style="color:#555;font-size:12px;margin-top:4px">Total Assets</div>
          </div>
          <div style="background:${critRisks > 0 ? '#ffeef0' : '#f0fff4'};border-radius:8px;padding:16px;text-align:center;border-top:4px solid ${critRisks > 0 ? '#d73a49' : '#28a745'}">
            <div style="font-size:30px;font-weight:800;color:${critRisks > 0 ? '#d73a49' : '#28a745'}">${critRisks}</div>
            <div style="color:#555;font-size:12px;margin-top:4px">Critical Open Risks</div>
          </div>
          <div style="background:${aleBreached ? '#ffeef0' : '#f0fff4'};border-radius:8px;padding:16px;text-align:center;border-top:4px solid ${aleBreached ? '#d73a49' : '#28a745'}">
            <div style="font-size:26px;font-weight:800;color:${aleBreached ? '#d73a49' : '#333'}">${fmt$(kpi.total_ale)}</div>
            <div style="color:#555;font-size:12px;margin-top:4px">Annual Loss Exposure (ALE)</div>
          </div>
          <div style="background:${appetiteBreached ? '#ffeef0' : '#f0fff4'};border-radius:8px;padding:16px;text-align:center;border-top:4px solid ${appetiteBreached ? '#d73a49' : '#28a745'}">
            <div style="font-size:22px;font-weight:800;color:${appetiteBreached ? '#d73a49' : '#28a745'}">${appetiteBreached ? 'BREACHED' : 'WITHIN'}</div>
            <div style="color:#555;font-size:12px;margin-top:4px">Risk Appetite Status</div>
          </div>
        </div>

        <h3 style="font-size:16px;margin-bottom:10px;color:#444">Risk Treatment Overview</h3>
        <div style="display:flex;gap:12px;margin-bottom:24px">
          ${riskTreatment.rows.map(t => `
            <div style="flex:1;background:#f6f8fa;border-radius:6px;padding:12px;text-align:center">
              <div style="font-size:22px;font-weight:700">${parseInt(t.cnt)||0}</div>
              <div style="font-size:12px;color:#555;text-transform:capitalize">${esc(t.treatment)}</div>
            </div>
          `).join('')}
        </div>

        <h3 style="font-size:16px;margin-bottom:10px;color:#444">Top Risks Requiring Immediate Attention</h3>
        <table>
          <thead><tr><th>Score</th><th>Risk Title</th><th>Level</th><th>Treatment</th><th>Category</th></tr></thead>
          <tbody>${topRisks.rows.slice(0,5).map(r => `
            <tr>
              <td style="font-weight:800;font-size:18px;color:${lvlColor(r.risk_level)}">${r.risk_score||0}</td>
              <td style="font-weight:600">${esc(r.title)}</td>
              <td>${badge(r.risk_level, lvlColor(r.risk_level))}</td>
              <td style="text-transform:capitalize">${esc(r.treatment||'mitigate')}</td>
              <td style="color:#666;font-size:12px">${esc(r.category||'Uncategorised')}</td>
            </tr>
          `).join('')}</tbody>
        </table>

        <h3 style="font-size:16px;margin-bottom:10px;color:#444">Key Security Metrics</h3>
        <table>
          <thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Critical Vulnerabilities</td><td><strong>${parseInt(kpi.crit_vulns)||0}</strong></td><td>${badge(parseInt(kpi.crit_vulns)>0?'action required':'ok', parseInt(kpi.crit_vulns)>0?'#d73a49':'#28a745')}</td></tr>
            <tr><td>Overdue Remediation Items</td><td><strong>${parseInt(kpi.overdue)||0}</strong></td><td>${badge(parseInt(kpi.overdue)>0?'overdue':'on track', parseInt(kpi.overdue)>0?'#e36209':'#28a745')}</td></tr>
            <tr><td>Mean Time to Remediate (MTTR)</td><td><strong>${kpi.mttr||'—'} days</strong></td><td>${badge(parseFloat(kpi.mttr||0)>30?'review needed':'acceptable', parseFloat(kpi.mttr||0)>30?'#e36209':'#28a745')}</td></tr>
            <tr><td>Total Open Risks</td><td><strong>${parseInt(rkpi.open_risks)||0}</strong></td><td>${badge(critRisks>0?'critical risks open':'within tolerance', critRisks>0?'#d73a49':'#28a745')}</td></tr>
          </tbody>
        </table>`,

      executive: `
        <h2>Executive Summary</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
          <div style="background:#f6f8fa;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700">${parseInt(assets.rows[0]?.total)||0}</div>
            <div style="color:#666;font-size:13px">Total Assets</div>
            <div style="font-size:12px;color:#999;margin-top:4px">${parseInt(assets.rows[0]?.active)||0} active</div>
          </div>
          <div style="background:#ffeef0;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#d73a49">${parseInt(assets.rows[0]?.critical_count)||0}</div>
            <div style="color:#666;font-size:13px">Critical Assets</div>
          </div>
          <div style="background:#fff3cd;border-radius:8px;padding:16px;text-align:center">
            <div style="font-size:32px;font-weight:700;color:#d73a49">${fmt$(totalALE)}</div>
            <div style="color:#666;font-size:13px">Total ALE</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Severity</th><th>Open Vulnerabilities</th><th>Total ALE</th></tr></thead>
          <tbody>${openVulns.rows.map(r => `
            <tr>
              <td>${badge(r.severity, sevColor(r.severity))}</td>
              <td style="font-weight:600">${parseInt(r.cnt)||0}</td>
              <td style="font-weight:600;color:${r.severity==='critical'?'#d73a49':'#333'}">${fmt$(r.total_ale)}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      risk_appetite: `
        <h2>Risk Appetite vs Actuals</h2>
        ${ap.notes ? `<p style="font-style:italic;color:#555;margin-bottom:16px;padding:10px;background:#f6f8fa;border-radius:6px">"${esc(ap.notes)}"</p>` : ''}
        <table>
          <thead><tr><th>Threshold</th><th>Approved Limit</th><th>Current Actual</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Maximum Risk Score</strong></td>
              <td>${ap.max_risk_score || '—'} / 25</td>
              <td style="font-weight:700">${topRisks.rows[0]?.risk_score || 0}</td>
              <td>${badge(scoreBreached ? 'BREACHED' : 'WITHIN', scoreBreached ? '#d73a49' : '#28a745')}</td>
            </tr>
            <tr>
              <td><strong>Annualised Loss Expectancy (ALE)</strong></td>
              <td>${fmt$(ap.max_ale)}</td>
              <td style="font-weight:700;color:${aleBreached?'#d73a49':'#333'}">${fmt$(kpi.total_ale)}</td>
              <td>${badge(aleBreached ? 'BREACHED' : 'WITHIN', aleBreached ? '#d73a49' : '#28a745')}</td>
            </tr>
            <tr>
              <td><strong>Max Open Critical Risks</strong></td>
              <td>${ap.max_open_critical === 0 ? 'Zero tolerance' : ap.max_open_critical}</td>
              <td style="font-weight:700;color:${critBreached?'#d73a49':'#333'}">${critRisks}</td>
              <td>${badge(critBreached ? 'BREACHED' : 'WITHIN', critBreached ? '#d73a49' : '#28a745')}</td>
            </tr>
          </tbody>
        </table>`,

      kpi_metrics: `
        <h2>KPI &amp; KRI Metrics</h2>
        <table>
          <thead><tr><th>Metric</th><th>Category</th><th>Current Value</th><th>RAG Status</th></tr></thead>
          <tbody>
            <tr><td><strong>Critical Vulnerabilities</strong></td><td>KRI</td><td>${parseInt(kpi.crit_vulns)||0}</td><td>${badge(parseInt(kpi.crit_vulns)>0?'RED':'GREEN', ragColor(parseInt(kpi.crit_vulns)>0?'red':'green'))}</td></tr>
            <tr><td><strong>High Vulnerabilities</strong></td><td>KRI</td><td>${parseInt(kpi.high_vulns)||0}</td><td>${badge(parseInt(kpi.high_vulns)>5?'AMBER':'GREEN', ragColor(parseInt(kpi.high_vulns)>5?'amber':'green'))}</td></tr>
            <tr><td><strong>Overdue Remediations</strong></td><td>KRI</td><td>${parseInt(kpi.overdue)||0}</td><td>${badge(parseInt(kpi.overdue)>0?'AMBER':'GREEN', ragColor(parseInt(kpi.overdue)>0?'amber':'green'))}</td></tr>
            <tr><td><strong>MTTR (Mean Time to Remediate)</strong></td><td>KPI</td><td>${kpi.mttr||'—'} days</td><td>${badge(parseFloat(kpi.mttr||0)>30?'RED':parseFloat(kpi.mttr||0)>14?'AMBER':'GREEN', ragColor(parseFloat(kpi.mttr||0)>30?'red':parseFloat(kpi.mttr||0)>14?'amber':'green'))}</td></tr>
            <tr><td><strong>Total ALE</strong></td><td>KRI</td><td>${fmt$(kpi.total_ale)}</td><td>${badge(aleBreached?'RED':'GREEN', ragColor(aleBreached?'red':'green'))}</td></tr>
            <tr><td><strong>Open Risks (Total)</strong></td><td>KRI</td><td>${parseInt(rkpi.open_risks)||0}</td><td>${badge(critRisks>0?'RED':parseInt(rkpi.open_risks)>10?'AMBER':'GREEN', ragColor(critRisks>0?'red':parseInt(rkpi.open_risks)>10?'amber':'green'))}</td></tr>
            <tr><td><strong>Critical Risks</strong></td><td>KRI</td><td>${critRisks}</td><td>${badge(critRisks>0?'RED':'GREEN', ragColor(critRisks>0?'red':'green'))}</td></tr>
            <tr><td><strong>Average Risk Score</strong></td><td>KPI</td><td>${rkpi.avg_score||'—'} / 25</td><td>${badge(parseFloat(rkpi.avg_score||0)>=12?'RED':parseFloat(rkpi.avg_score||0)>=6?'AMBER':'GREEN', ragColor(parseFloat(rkpi.avg_score||0)>=12?'red':parseFloat(rkpi.avg_score||0)>=6?'amber':'green'))}</td></tr>
            <tr><td><strong>Risk Appetite</strong></td><td>Governance</td><td>${appetiteBreached ? 'Thresholds breached' : 'Within approved limits'}</td><td>${badge(appetiteBreached?'RED':'GREEN', ragColor(appetiteBreached?'red':'green'))}</td></tr>
          </tbody>
        </table>`,

      risks: `
        <h2>Top Open Risks</h2>
        <table>
          <thead><tr><th>Score</th><th>Title</th><th>Level</th><th>Treatment</th><th>Category</th><th>Asset</th></tr></thead>
          <tbody>${topRisks.rows.map(r => `
            <tr>
              <td style="font-weight:800;font-size:18px;color:${lvlColor(r.risk_level)}">${r.risk_score||0}</td>
              <td>${esc(r.title)}</td>
              <td>${badge(r.risk_level, lvlColor(r.risk_level))}</td>
              <td style="text-transform:capitalize">${esc(r.treatment||'mitigate')}</td>
              <td style="color:#666;font-size:12px">${esc(r.category||'—')}</td>
              <td style="font-family:monospace;font-size:12px">${esc(r.ip_address)||'—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      ale: `
        <h2>ALE Breakdown — Top Vulnerabilities by Risk</h2>
        <table>
          <thead><tr><th>Vulnerability</th><th>Severity</th><th>Asset</th><th>ALE</th><th>CVE</th></tr></thead>
          <tbody>${topALE.rows.map(r => `
            <tr>
              <td>${esc(r.title)}</td>
              <td>${badge(r.severity, sevColor(r.severity))}</td>
              <td style="font-family:monospace;font-size:12px">${esc(r.ip_address)||'—'}${r.hostname?` (${esc(r.hostname)})`:''}}</td>
              <td style="font-weight:700;color:#d73a49">${fmt$(r.ale)}</td>
              <td style="font-family:monospace;font-size:12px">${esc(r.cve_id)||'—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      assets: `
        <h2>Asset Inventory by Type</h2>
        <table>
          <thead><tr><th>Asset Type</th><th>Total Count</th><th>Critical</th></tr></thead>
          <tbody>${assetStats.rows.map(r => `
            <tr>
              <td>${esc(r.asset_type)||'Unknown'}</td>
              <td style="font-weight:600">${parseInt(r.cnt)||0}</td>
              <td style="color:${parseInt(r.critical_cnt)>0?'#d73a49':'#28a745'};font-weight:600">${parseInt(r.critical_cnt)||0}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      vulnstats: `
        <h2>Findings${from||to ? ` — Period: ${esc(periodLabel)}` : ' (Last 30)'}</h2>
        <table>
          <thead><tr><th>Title</th><th>Severity</th><th>Asset</th><th>Detected</th></tr></thead>
          <tbody>${recentVulns.rows.map(r => `
            <tr>
              <td>${esc(r.title)}</td>
              <td>${badge(r.severity, sevColor(r.severity))}</td>
              <td style="font-family:monospace;font-size:12px">${esc(r.ip_address)||'—'}</td>
              <td style="font-size:12px">${r.detected_at ? new Date(r.detected_at).toLocaleDateString() : '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,

      compliance: complianceData.rows.length === 0 ? '' : `
        <h2>Compliance Posture</h2>
        <table>
          <thead><tr><th>Framework</th><th>Total Controls</th><th>Compliant</th><th>Non-Compliant</th><th>Compliance %</th></tr></thead>
          <tbody>${complianceData.rows.map(r => {
            const pct = r.total > 0 ? Math.round(100 * r.compliant / r.total) : 0;
            return `
            <tr>
              <td style="font-weight:600">${esc(r.framework)}</td>
              <td>${parseInt(r.total)||0}</td>
              <td style="color:#28a745;font-weight:600">${parseInt(r.compliant)||0}</td>
              <td style="color:${parseInt(r.non_compliant)>0?'#d73a49':'#28a745'};font-weight:600">${parseInt(r.non_compliant)||0}</td>
              <td>${badge(`${pct}%`, pct>=80?'#28a745':pct>=50?'#f59e0b':'#d73a49')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`,

      certifications: certData.rows.length === 0 ? '' : `
        <h2>Certification Status</h2>
        <table>
          <thead><tr><th>Certification</th><th>Framework</th><th>Organisation</th><th>Phase</th><th>Completion</th><th>Target Date</th></tr></thead>
          <tbody>${certData.rows.map(r => `
            <tr>
              <td style="font-weight:600">${esc(r.name)}</td>
              <td>${badge(r.framework, '#0366d6')}</td>
              <td style="color:#555;font-size:12px">${esc(r.org_name||'—')}</td>
              <td style="text-transform:capitalize">${esc(r.phase||'—')}</td>
              <td>
                <div style="background:#e1e4e8;border-radius:4px;height:8px;width:100px;overflow:hidden">
                  <div style="background:${parseInt(r.completion_pct)>=80?'#28a745':parseInt(r.completion_pct)>=50?'#f59e0b':'#0366d6'};height:100%;width:${Math.min(parseInt(r.completion_pct)||0,100)}%"></div>
                </div>
                <span style="font-size:11px;color:#555">${parseInt(r.completion_pct)||0}%</span>
              </td>
              <td style="font-size:12px">${r.target_date ? new Date(r.target_date).toLocaleDateString() : '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table>`,
    };

    const body = sections
      .map(s => sectionHtml[s] || '')
      .filter(Boolean)
      .join('<hr style="margin:32px 0;border:none;border-top:2px solid #e1e4e8">');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SecureOps Security Report — ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#24292e; background:#fff; padding:40px; max-width:1100px; margin:0 auto; }
    .report-header { border-bottom:3px solid #0366d6; padding-bottom:24px; margin-bottom:32px; display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
    .report-header-left h1 { font-size:26px; color:#0366d6; margin-top:8px; }
    .report-header-left .meta { font-size:12px; color:#666; margin-top:8px; line-height:1.8; }
    .report-header-right { text-align:right; font-size:12px; color:#666; }
    h2 { font-size:19px; color:#24292e; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid #e1e4e8; margin-top:4px; }
    h3 { font-size:15px; color:#444; margin:18px 0 10px; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px; }
    th { background:#f6f8fa; padding:9px 12px; text-align:left; font-weight:600; border:1px solid #e1e4e8; font-size:12px; }
    td { padding:9px 12px; border:1px solid #e1e4e8; vertical-align:middle; }
    tr:nth-child(even) td { background:#fafbfc; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e1e4e8; font-size:11px; color:#999; text-align:center; }
    .confidential { display:inline-block; background:#ffeef0; color:#d73a49; border:1px solid #f9c6cb; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.05em; margin-top:6px; }
    @media print { body { padding:20px; } .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="report-header-left">
      ${logoTag}
      <h1>Security &amp; Risk Management Report</h1>
      <div class="meta">
        <strong>Period:</strong> ${escapeHtml(periodLabel)}<br>
        <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
        <strong>Sections:</strong> ${escapeHtml(sections.join(', '))}
      </div>
      <div class="confidential">CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY</div>
    </div>
    <div class="report-header-right">
      <div style="font-size:11px;color:#999">SecureOps Platform</div>
    </div>
  </div>
  ${body}
  <div class="footer">SecureOps InfoSec Risk Management Platform &nbsp;·&nbsp; Confidential — For Internal Use Only &nbsp;·&nbsp; ${new Date().getFullYear()}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="secureops-report-${new Date().toISOString().slice(0,10)}.html"`);
    res.send(html);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Scheduled Reports (admin) ──────────────────────────────────

// GET /api/reports/scheduled
router.get('/scheduled', auth, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query(`
      SELECT id, name, report_type, schedule, is_active, last_run, next_run, created_at
      FROM scheduled_reports
      ORDER BY created_at DESC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/reports/scheduled/:id
router.delete('/scheduled/:id', auth, requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const r = await db.query(`DELETE FROM scheduled_reports WHERE id=$1 RETURNING id`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/reports/scheduled/:id — toggle is_active
router.patch('/scheduled/:id', auth, requireRole('admin'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { is_active } = req.body;
  try {
    const r = await db.query(
      `UPDATE scheduled_reports SET is_active=$2 WHERE id=$1 RETURNING *`,
      [id, is_active]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
