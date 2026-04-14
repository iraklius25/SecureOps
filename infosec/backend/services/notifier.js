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

module.exports = { notifyInApp, notifyWebhook, notifyVuln, notifyScanComplete };
