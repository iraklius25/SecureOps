/**
 * Notifier Service
 * Handles in-app notifications + Slack/Teams webhook alerts
 */
const db     = require('../db');
const logger = require('./logger');

// ── In-app: insert a notification row for each admin/analyst ──
async function notifyInApp({ title, message, type = 'info', link, resource, resource_id }) {
  try {
    const users = await db.query(
      `SELECT id FROM users WHERE is_active = TRUE AND role IN ('admin','analyst')`
    );
    for (const user of users.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, link, resource, resource_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [user.id, title, message, type, link, resource, resource_id || null]);
    }
  } catch (e) {
    logger.error('notifyInApp error:', e.message);
  }
}

// ── Webhook: send to Slack and/or Teams if configured ─────────
async function notifyWebhook({ title, message, type = 'info' }) {
  try {
    const r = await db.query(
      `SELECT key, value FROM settings WHERE key IN ('slack_webhook_url','teams_webhook_url')`
    );
    const cfg = Object.fromEntries(r.rows.map(row => [row.key, row.value]));
    const colorMap = { critical: '#f85149', high: '#f0883e', warning: '#e3b341', success: '#3fb950', info: '#1f6feb' };
    const color    = colorMap[type] || colorMap.info;

    if (cfg.slack_webhook_url) {
      const body = JSON.stringify({
        attachments: [{
          color,
          title,
          text: message,
          footer: 'SecureOps',
          ts: Math.floor(Date.now() / 1000),
        }],
      });
      await fetch(cfg.slack_webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }

    if (cfg.teams_webhook_url) {
      const body = JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: color.replace('#', ''),
        summary: title,
        sections: [{ activityTitle: `**${title}**`, activityText: message }],
      });
      await fetch(cfg.teams_webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }
  } catch (e) {
    logger.error('notifyWebhook error:', e.message);
  }
}

// ── Helpers called from scanner / routes ──────────────────────

async function notifyVuln(vuln, assetIp) {
  try {
    const r = await db.query(
      `SELECT key, value FROM settings WHERE key IN ('notify_on_critical','notify_on_high')`
    );
    const cfg = Object.fromEntries(r.rows.map(row => [row.key, row.value]));
    if (vuln.severity === 'critical' && cfg.notify_on_critical !== 'true') return;
    if (vuln.severity === 'high'     && cfg.notify_on_high     !== 'true') return;
    if (!['critical', 'high'].includes(vuln.severity)) return;

    const title   = `${vuln.severity.toUpperCase()} Vulnerability: ${vuln.title}`;
    const message = `Found on ${assetIp}${vuln.cve_id ? ` (${vuln.cve_id})` : ''}. ALE: $${Math.round(vuln.ale || 0).toLocaleString()}`;

    await Promise.all([
      notifyInApp({ title, message, type: vuln.severity === 'critical' ? 'critical' : 'warning',
                    resource: 'vulnerability', link: '/vulnerabilities' }),
      notifyWebhook({ title, message, type: vuln.severity === 'critical' ? 'critical' : 'high' }),
    ]);
  } catch (e) {
    logger.error('notifyVuln error:', e.message);
  }
}

async function notifyScanComplete(scanJob, stats) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_scan_complete'`);
    if (r.rows[0]?.value !== 'true') return;

    const title   = `Scan Completed: ${scanJob.name || scanJob.target}`;
    const message = `Target: ${scanJob.target} | Assets found: ${stats.assetsFound} | Vulnerabilities: ${stats.vulnsFound}`;

    await Promise.all([
      notifyInApp({ title, message, type: 'success', resource: 'scan', link: '/scans' }),
      notifyWebhook({ title, message, type: 'success' }),
    ]);
  } catch (e) {
    logger.error('notifyScanComplete error:', e.message);
  }
}

// ── New-risk notification ─────────────────────────────────────
async function notifyNewRisk(risk) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_new_risk'`);
    if (r.rows[0]?.value !== 'true') return;
    const title   = `New Risk Registered: ${risk.title}`;
    const message = [
      `Level: ${(risk.risk_level || 'unknown').toUpperCase()} | Score: ${risk.risk_score || 0}`,
      `Category: ${risk.category || 'Uncategorised'}`,
      `Treatment: ${risk.treatment || 'mitigate'}`,
    ].join(' · ');
    const type = risk.risk_level === 'critical' ? 'critical' : risk.risk_level === 'high' ? 'warning' : 'info';
    await Promise.all([
      notifyInApp({ title, message, type, resource: 'risk', resource_id: risk.id, link: '/risks' }),
      notifyWebhook({ title, message, type }),
    ]);
  } catch (e) { logger.error('notifyNewRisk error:', e.message); }
}

// ── Approval notification ─────────────────────────────────────
async function notifyApproval(approval, vulnTitle, severity, requestedByName, verdict) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_approval'`);
    if (r.rows[0]?.value !== 'true') return;
    const isNew  = !verdict;
    const title  = isNew
      ? `Approval Request: ${vulnTitle} — ${approval.action}`
      : `Approval ${verdict.charAt(0).toUpperCase() + verdict.slice(1)}: ${vulnTitle}`;
    const message = [
      `Vulnerability: ${vulnTitle} (${severity})`,
      `Action: ${approval.action}`,
      `Requested by: ${requestedByName || 'Unknown'}`,
      !isNew ? `Decision: ${verdict}` : 'Status: Pending review',
      approval.request_notes ? `Notes: ${approval.request_notes}` : null,
    ].filter(Boolean).join(' · ');
    const type = isNew ? 'warning' : (verdict === 'approved' ? 'success' : 'info');
    await Promise.all([
      notifyInApp({ title, message, type, resource: 'approval', resource_id: approval.id, link: '/approvals' }),
      notifyWebhook({ title, message, type }),
    ]);
  } catch (e) { logger.error('notifyApproval error:', e.message); }
}

// ── GRC Hub activity notification ─────────────────────────────
async function notifyGrcActivity(entityType, entityName, action, detail) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_grc_activity'`);
    if (r.rows[0]?.value !== 'true') return;
    const title   = `GRC Hub: ${entityType} ${action} — ${entityName}`;
    const message = detail || `${entityType} "${entityName}" was ${action} in the GRC Hub.`;
    await Promise.all([
      notifyInApp({ title, message, type: 'info', resource: 'grc', link: '/grc' }),
      notifyWebhook({ title, message, type: 'info' }),
    ]);
  } catch (e) { logger.error('notifyGrcActivity error:', e.message); }
}

// ── Certification Tracker change notification ──────────────────
async function notifyCertChange(cert, changeType, extraDetail) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_cert_change'`);
    if (r.rows[0]?.value !== 'true') return;
    const title   = `Certification Update: ${cert.name} (${cert.framework})`;
    const message = [
      `Change: ${changeType}`,
      cert.org_name ? `Organisation: ${cert.org_name}` : null,
      cert.phase    ? `Phase: ${cert.phase}`            : null,
      extraDetail   || null,
    ].filter(Boolean).join(' · ');
    await Promise.all([
      notifyInApp({ title, message, type: 'info', resource: 'certification', resource_id: cert.id, link: '/certifications' }),
      notifyWebhook({ title, message, type: 'info' }),
    ]);
  } catch (e) { logger.error('notifyCertChange error:', e.message); }
}

// ── KPI / KRI metric change notification ─────────────────────
async function notifyKpiChange(metricName, oldRag, newRag, detail) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_kpi_change'`);
    if (r.rows[0]?.value !== 'true') return;
    if (!oldRag || !newRag || oldRag === newRag) return;
    const ragOrder = ['green', 'amber', 'red'];
    const worsened = ragOrder.indexOf(newRag) > ragOrder.indexOf(oldRag);
    const title   = `KPI/KRI Alert: ${metricName}`;
    const message = [
      `Metric: ${metricName}`,
      `Status changed: ${oldRag.toUpperCase()} → ${newRag.toUpperCase()}`,
      worsened ? 'Status degraded — review required.' : 'Status improved.',
      detail || null,
    ].filter(Boolean).join(' · ');
    const type = worsened ? (newRag === 'red' ? 'critical' : 'warning') : 'success';
    await Promise.all([
      notifyInApp({ title, message, type, resource: 'metric', link: '/metrics' }),
      notifyWebhook({ title, message, type }),
    ]);
  } catch (e) { logger.error('notifyKpiChange error:', e.message); }
}

// ── New asset registered notification ────────────────────────
async function notifyNewAsset(asset) {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_new_asset'`);
    if (r.rows[0]?.value !== 'true') return;
    const identifier = asset.hostname || asset.ip_address || asset.id;
    const title   = `New Asset Registered: ${identifier}`;
    const message = [
      asset.ip_address    ? `IP: ${asset.ip_address}`                    : null,
      asset.hostname      ? `Hostname: ${asset.hostname}`                : null,
      `Classification: ${(asset.classification || 'internal').toUpperCase()}`,
      `Category: ${asset.asset_category || 'hardware'}`,
      asset.owner         ? `Owner: ${asset.owner}`                      : null,
    ].filter(Boolean).join(' · ');
    await Promise.all([
      notifyInApp({ title, message, type: 'info', resource: 'asset', resource_id: asset.id, link: '/assets' }),
      notifyWebhook({ title, message, type: 'info' }),
    ]);
  } catch (e) { logger.error('notifyNewAsset error:', e.message); }
}

// ── Daily overdue reviews/tasks notification ──────────────────
async function notifyOverdue() {
  try {
    const r = await db.query(`SELECT value FROM settings WHERE key='notify_on_overdue'`);
    if (r.rows[0]?.value !== 'true') return;

    const [assetReviews, riskReviews] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM assets
                WHERE review_date < NOW() AND review_date IS NOT NULL
                  AND status != 'decommissioned'`),
      db.query(`SELECT COUNT(*) FROM risks
                WHERE review_date < NOW() AND review_date IS NOT NULL
                  AND status = 'open'`),
    ]);

    const overdueAssets = parseInt(assetReviews.rows[0].count);
    const overdueRisks  = parseInt(riskReviews.rows[0].count);

    if (overdueAssets === 0 && overdueRisks === 0) return;

    const parts = [];
    if (overdueAssets > 0) parts.push(`${overdueAssets} asset review(s) overdue`);
    if (overdueRisks  > 0) parts.push(`${overdueRisks} risk review(s) overdue`);

    const title   = 'Daily Overdue Review Alert';
    const message = parts.join(' · ') + ' — immediate attention required.';
    await Promise.all([
      notifyInApp({ title, message, type: 'warning', resource: 'asset', link: '/assets' }),
      notifyWebhook({ title, message, type: 'warning' }),
    ]);
  } catch (e) { logger.error('notifyOverdue error:', e.message); }
}

module.exports = { notifyInApp, notifyWebhook, notifyVuln, notifyScanComplete,
                   notifyNewRisk, notifyApproval, notifyGrcActivity, notifyCertChange,
                   notifyKpiChange, notifyNewAsset, notifyOverdue };
