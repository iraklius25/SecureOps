const nodemailer = require('nodemailer');
const db = require('../db');
const logger = require('./logger');

async function getSmtpConfig() {
  try {
    const r = await db.query(
      `SELECT key, value FROM settings WHERE key IN
        ('smtp_host','smtp_port','smtp_user','smtp_password','smtp_from','smtp_to','smtp_enabled',
         'email_on_assign','email_on_critical','email_on_overdue',
         'email_on_new_risk','email_on_risk_delete','email_on_new_asset',
         'email_on_approval','email_on_grc_activity','email_on_cert_change',
         'email_on_kpi_change','email_on_scan_complete')`
    );
    return Object.fromEntries(r.rows.map(x => [x.key, x.value]));
  } catch (e) {
    logger.error('mailer: failed to load SMTP config:', e.message);
    return {};
  }
}

function createTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port || '587'),
    secure: parseInt(cfg.smtp_port || '587') === 465,
    auth: cfg.smtp_user ? { user: cfg.smtp_user, pass: cfg.smtp_password } : undefined,
  });
}

async function sendMail({ to, subject, html }) {
  const cfg = await getSmtpConfig();
  if (cfg.smtp_enabled !== 'true') {
    logger.debug('mailer: smtp_enabled is false, skipping email');
    return;
  }
  if (!cfg.smtp_host || !cfg.smtp_from) {
    logger.debug('mailer: SMTP not configured (missing host or from), skipping');
    return;
  }
  try {
    const transport = createTransport(cfg);
    const info = await transport.sendMail({
      from: cfg.smtp_from,
      to,
      subject,
      html,
    });
    logger.info(`mailer: sent "${subject}" to ${to} (messageId: ${info.messageId})`);
  } catch (e) {
    logger.error(`mailer: failed to send "${subject}" to ${to}: ${e.message}`);
  }
}

async function notifyAssignment(vuln, assigneeEmail, assigneeName) {
  const cfg = await getSmtpConfig();
  if (cfg.email_on_assign !== 'true') return;

  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#e36209">Vulnerability Assigned to You</h2>
      <p>Hi ${assigneeName || assigneeEmail},</p>
      <p>A vulnerability has been assigned to you in SecureOps:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Title</td><td style="padding:8px;border:1px solid #ddd">${vuln.title}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Severity</td><td style="padding:8px;border:1px solid #ddd;text-transform:uppercase;color:${vuln.severity === 'critical' ? '#d73a49' : vuln.severity === 'high' ? '#e36209' : '#b08800'}">${vuln.severity}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Asset</td><td style="padding:8px;border:1px solid #ddd">${vuln.ip_address || '—'}</td></tr>
        ${vuln.due_date ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Due Date</td><td style="padding:8px;border:1px solid #ddd">${new Date(vuln.due_date).toLocaleDateString()}</td></tr>` : ''}
        ${vuln.cve_id ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">CVE</td><td style="padding:8px;border:1px solid #ddd">${vuln.cve_id}</td></tr>` : ''}
      </table>
      <p style="color:#666;font-size:12px">This is an automated notification from SecureOps Risk Management Platform.</p>
    </div>
  `;

  await sendMail({ to: assigneeEmail, subject: `[SecureOps] Vulnerability Assigned: ${vuln.title}`, html });
}

async function notifyCritical(vuln, adminEmails) {
  const cfg = await getSmtpConfig();
  if (cfg.email_on_critical !== 'true') return;
  if (!adminEmails || adminEmails.length === 0) return;

  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#d73a49">&#9888; Critical Vulnerability Detected</h2>
      <p>A critical vulnerability has been detected in your environment:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Title</td><td style="padding:8px;border:1px solid #ddd">${vuln.title}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Severity</td><td style="padding:8px;border:1px solid #ddd;color:#d73a49;font-weight:bold">CRITICAL</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Asset</td><td style="padding:8px;border:1px solid #ddd">${vuln.ip_address || '—'}</td></tr>
        ${vuln.cve_id ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">CVE</td><td style="padding:8px;border:1px solid #ddd">${vuln.cve_id}</td></tr>` : ''}
        ${vuln.cvss_score ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">CVSS Score</td><td style="padding:8px;border:1px solid #ddd">${vuln.cvss_score}</td></tr>` : ''}
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Detected At</td><td style="padding:8px;border:1px solid #ddd">${new Date(vuln.detected_at || Date.now()).toLocaleString()}</td></tr>
      </table>
      <p>Immediate action is required. Log in to SecureOps to review and remediate this finding.</p>
      <p style="color:#666;font-size:12px">This is an automated notification from SecureOps Risk Management Platform.</p>
    </div>
  `;

  for (const email of adminEmails) {
    await sendMail({ to: email, subject: `[SecureOps CRITICAL] ${vuln.title}`, html });
  }
}

async function notifyOverdue(vulns, recipientEmail) {
  const cfg = await getSmtpConfig();
  if (cfg.email_on_overdue !== 'true') return;
  if (!vulns || vulns.length === 0) return;

  const rows = vulns.map(v => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd">${v.title}</td>
      <td style="padding:8px;border:1px solid #ddd;text-transform:uppercase">${v.severity}</td>
      <td style="padding:8px;border:1px solid #ddd">${v.ip_address || '—'}</td>
      <td style="padding:8px;border:1px solid #ddd;color:#d73a49">${v.due_date ? new Date(v.due_date).toLocaleDateString() : '—'}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <h2 style="color:#d73a49">&#9888; Overdue Vulnerabilities — SLA Breach</h2>
      <p>The following ${vulns.length} vulnerabilities have passed their SLA due dates:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <thead>
          <tr style="background:#f6f8fa">
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Title</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Severity</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Asset</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Please log in to SecureOps to review and update these findings.</p>
      <p style="color:#666;font-size:12px">This is an automated notification from SecureOps Risk Management Platform.</p>
    </div>
  `;

  await sendMail({ to: recipientEmail, subject: `[SecureOps] ${vulns.length} Overdue Vulnerabilities — SLA Breach`, html });
}

module.exports = { sendMail, notifyAssignment, notifyCritical, notifyOverdue };
