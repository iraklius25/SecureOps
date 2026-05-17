import React, { useState, useEffect, useCallback, useContext } from 'react';
import { api, AuthContext } from '../App';
import { format } from 'date-fns';

const REPORT_TYPES = ['executive', 'ale', 'vulnerabilities', 'risks'];
const SCHEDULES    = ['daily', 'weekly', 'monthly'];
const FORMATS      = ['csv'];

function ScheduledReportModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', report_type: 'executive', format: 'csv', schedule: 'weekly' });
  const [err,  setErr]  = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/settings/scheduled-reports', form);
      onSaved();
    } catch (ex) { setErr(ex.response?.data?.error || 'Error'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>New Scheduled Report</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label>Report Name *</label>
              <input value={form.name} onChange={set('name')} required placeholder="Weekly Risk Summary" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Report Type</label>
                <select value={form.report_type} onChange={set('report_type')}>
                  {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Format</label>
                <select value={form.format} onChange={set('format')}>
                  {FORMATS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Schedule</label>
              <select value={form.schedule} onChange={set('schedule')}>
                {SCHEDULES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Email Tab ──────────────────────────────────── */
function EmailTab({ form, setForm, save, saved, testing, testWebhook, testMsg }) {
  const handleTestEmail = () => testWebhook('email', form.smtp_to || '');

  const EMAIL_TRIGGERS = [
    { key: 'email_on_new_risk',      label: 'New Risk Registered',           desc: 'Send email when a new risk is added to the register' },
    { key: 'email_on_risk_delete',   label: 'Risk Deleted',                  desc: 'Send email when a registered risk is permanently deleted' },
    { key: 'email_on_critical',      label: 'Critical Vulnerability',        desc: 'Send email when a critical-severity vulnerability is discovered' },
    { key: 'email_on_assign',        label: 'Vulnerability Assigned',        desc: 'Send email to the assignee when a vulnerability is assigned to them' },
    { key: 'email_on_overdue',       label: 'Overdue Reviews / SLA Breach',  desc: 'Daily digest of overdue asset reviews and open risks past their due date' },
    { key: 'email_on_scan_complete', label: 'Scan Completed',                desc: 'Send email when a network scan finishes' },
    { key: 'email_on_new_asset',     label: 'New Asset Registered',          desc: 'Send email when a new asset is added to the inventory' },
    { key: 'email_on_approval',      label: 'Approval Required / Decision',  desc: 'Send email when an approval is requested or a decision is made' },
    { key: 'email_on_grc_activity',  label: 'GRC Hub Activity',              desc: 'Send email on GRC program, task, or document changes' },
    { key: 'email_on_cert_change',   label: 'Certification Tracker Change',  desc: 'Send email when a certification phase or status changes' },
    { key: 'email_on_kpi_change',    label: 'KPI / KRI Status Change',       desc: 'Send email when a metric RAG status changes' },
    { key: 'email_on_budget_expiry', label: 'IT Budget License Expiry',       desc: 'Send email when a budget item license is approaching expiry (per-item opt-in)' },
  ];

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 20 }}>SMTP Email Configuration</div>

      {testMsg && (
        <div className={`alert ${testMsg.includes('success') || testMsg.includes('sent') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {testMsg}
        </div>
      )}
      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>Settings saved.</div>}

      <div className="form-row">
        <div className="form-group">
          <label>SMTP Host</label>
          <input
            value={form.smtp_host || ''}
            onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))}
            placeholder="smtp.gmail.com"
          />
        </div>
        <div className="form-group" style={{ maxWidth: 120 }}>
          <label>SMTP Port</label>
          <input
            type="number"
            value={form.smtp_port || '587'}
            onChange={e => setForm(p => ({ ...p, smtp_port: e.target.value }))}
            placeholder="587"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>SMTP Username</label>
          <input
            value={form.smtp_user || ''}
            onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))}
            placeholder="your@email.com"
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label>SMTP Password</label>
          <input
            type="password"
            value={form.smtp_password || ''}
            onChange={e => setForm(p => ({ ...p, smtp_password: e.target.value }))}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>From Address</label>
          <input
            value={form.smtp_from || ''}
            onChange={e => setForm(p => ({ ...p, smtp_from: e.target.value }))}
            placeholder="SecureOps <noreply@yourdomain.com>"
          />
        </div>
        <div className="form-group">
          <label>Send email to:</label>
          <input
            type="email"
            value={form.smtp_to || ''}
            onChange={e => setForm(p => ({ ...p, smtp_to: e.target.value }))}
            placeholder="admin@yourdomain.com"
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Email Notification Triggers</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.smtp_enabled === 'true'}
            onChange={e => setForm(p => ({ ...p, smtp_enabled: e.target.checked ? 'true' : 'false' }))}
          />
          <div>
            <div style={{ fontWeight: 500 }}>Enable Email Notifications</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Send automated emails via the SMTP settings above</div>
          </div>
        </label>

        {EMAIL_TRIGGERS.map(({ key, label, desc }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: form.smtp_enabled === 'true' ? 'pointer' : 'default', opacity: form.smtp_enabled === 'true' ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={form[key] === 'true'}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.checked ? 'true' : 'false' }))}
              disabled={form.smtp_enabled !== 'true'}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, marginTop: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={handleTestEmail}
          disabled={testing === 'email' || !form.smtp_host || !form.smtp_to}
          title={!form.smtp_to ? 'Set "Send email to" before testing' : ''}
        >
          {testing === 'email' ? 'Sending...' : 'Send Test Email'}
        </button>
        <button className="btn btn-primary" onClick={save}>Save Settings</button>
      </div>
    </div>
  );
}

/* ─── SLA Tab ────────────────────────────────────── */
function SLATab() {
  const [policies, setPolicies] = useState([]);
  const [appetite, setAppetite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgApp, setMsgApp] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.get('/sla/policies'),
        api.get('/sla/appetite'),
      ]);
      setPolicies(p.data);
      setAppetite(a.data || { max_risk_score: 12, max_ale: 100000, max_open_critical: 0, notes: '' });
    } catch (e) {
      setPolicies([
        { severity: 'critical', days_to_remediate: 3 },
        { severity: 'high', days_to_remediate: 14 },
        { severity: 'medium', days_to_remediate: 30 },
        { severity: 'low', days_to_remediate: 90 },
      ]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePolicies = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/sla/policies', { policies });
      setMsg('SLA policies saved.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Error: ' + (e.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  const saveAppetite = async () => {
    setSavingApp(true); setMsgApp('');
    try {
      await api.put('/sla/appetite', appetite);
      setMsgApp('Risk appetite saved.');
      setTimeout(() => setMsgApp(''), 3000);
    } catch (e) {
      setMsgApp('Error: ' + (e.response?.data?.error || e.message));
    } finally { setSavingApp(false); }
  };

  const updatePolicy = (severity, days) => {
    setPolicies(prev => prev.map(p => p.severity === severity ? { ...p, days_to_remediate: parseInt(days) || 0 } : p));
  };

  const sevColor = s => ({ critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' }[s] || 'var(--text2)');

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  return (
    <div>
      {/* SLA Policies */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>SLA Policies — Remediation Time Targets</div>
        {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 12 }}>{msg}</div>}
        <table>
          <thead>
            <tr><th>Severity</th><th>Days to Remediate</th><th>Last Updated</th></tr>
          </thead>
          <tbody>
            {policies.map(p => (
              <tr key={p.severity}>
                <td>
                  <span style={{ color: sevColor(p.severity), fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>
                    {p.severity}
                  </span>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={p.days_to_remediate}
                    onChange={e => updatePolicy(p.severity, e.target.value)}
                    style={{ width: 80, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', padding: '4px 8px', fontSize: 13 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 6 }}>days</span>
                </td>
                <td className="text-dim" style={{ fontSize: 12 }}>
                  {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={savePolicies} disabled={saving}>
            {saving ? 'Saving...' : 'Save SLA Policies'}
          </button>
        </div>
      </div>

      {/* Risk Appetite */}
      {appetite && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Risk Appetite Statement</div>
          {msgApp && <div className={`alert ${msgApp.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 12 }}>{msgApp}</div>}

          {/* Visual indicators */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: `4px solid ${appetite.max_risk_score >= 20 ? 'var(--critical)' : appetite.max_risk_score >= 12 ? 'var(--high)' : 'var(--medium)'}` }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Risk Score</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{appetite.max_risk_score}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>of 25 possible</div>
            </div>
            <div style={{ flex: 1, minWidth: 150, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--high)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max ALE</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>${parseFloat(appetite.max_ale||0).toLocaleString('en-US',{maximumFractionDigits:0})}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>annualised loss limit</div>
            </div>
            <div style={{ flex: 1, minWidth: 150, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 'var(--radius)', borderLeft: `4px solid ${appetite.max_open_critical === 0 ? 'var(--critical)' : 'var(--medium)'}` }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Open Critical</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{appetite.max_open_critical}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{appetite.max_open_critical === 0 ? 'zero tolerance' : 'allowed open'}</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Max Risk Score (1–25)</label>
              <input
                type="number" min="1" max="25"
                value={appetite.max_risk_score || 12}
                onChange={e => setAppetite(p => ({ ...p, max_risk_score: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label>Max ALE ($)</label>
              <input
                type="number" min="0"
                value={appetite.max_ale || 100000}
                onChange={e => setAppetite(p => ({ ...p, max_ale: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label>Max Open Critical Vulns</label>
              <input
                type="number" min="0"
                value={appetite.max_open_critical || 0}
                onChange={e => setAppetite(p => ({ ...p, max_open_critical: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Statement</label>
            <textarea
              value={appetite.notes || ''}
              onChange={e => setAppetite(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="Describe the organization's risk tolerance..."
            />
          </div>

          <button className="btn btn-primary" onClick={saveAppetite} disabled={savingApp}>
            {savingApp ? 'Saving...' : 'Save Risk Appetite'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Branding Tab ───────────────────────────────── */
function BrandingTab() {
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/settings/logo', { responseType: 'blob' })
      .then(r => setLogoUrl(URL.createObjectURL(r.data)))
      .catch(() => setLogoUrl(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setMsg('');
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Logo uploaded successfully.');
      load();
    } catch (ex) {
      setMsg(ex.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const removeLogo = async () => {
    if (!window.confirm('Remove the organization logo?')) return;
    await api.delete('/settings/logo').catch(() => {});
    setLogoUrl(null);
    setMsg('Logo removed.');
  };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 20 }}>Organization Branding</div>
      {msg && <div className={`alert ${msg.includes('fail') || msg.includes('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>{msg}</div>}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Current Logo</div>
        {logoUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={logoUrl} alt="Organization logo" style={{ maxHeight: 80, maxWidth: 240, borderRadius: 'var(--radius)', border: '1px solid var(--border2)', padding: 8, background: 'var(--bg3)' }} />
            <button className="btn btn-danger btn-sm" onClick={removeLogo}>Remove</button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No logo uploaded yet.</div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Upload New Logo</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          Accepted formats: PNG, JPG, SVG, WebP. Max size: 2MB. Recommended: transparent PNG, at least 200×60px.
        </div>
        <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
          {uploading ? 'Uploading...' : '📁 Choose Logo File'}
          <input type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

/* ─── Audit Log Tab ──────────────────────────────── */
function AuditLogTab() {
  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState({ action:'', entity_type:'' });
  const [offset,  setOffset]  = useState(0);
  const LIMIT = 50;

  const load = async (off = 0) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: LIMIT, offset: off });
    if (filter.action)      params.set('action', filter.action);
    if (filter.entity_type) params.set('entity_type', filter.entity_type);
    try {
      const r = await api.get(`/activity-log?${params}`);
      setRows(r.data.rows); setTotal(r.data.total); setOffset(off);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(0); }, [filter]);

  const ACTION_COLORS = {
    'document.approve': '#10b981', 'document.create': '#3b82f6', 'document.delete': '#ef4444',
    'risk.create': '#8b5cf6', 'user.login': '#6b7280', 'ai_system.create': '#f59e0b',
  };
  const getColor = a => {
    if (!a) return '#6b7280';
    if (a.includes('delete')) return '#ef4444';
    if (a.includes('create')) return '#3b82f6';
    if (a.includes('approve')) return '#10b981';
    if (a.includes('login')) return '#6b7280';
    return '#8b5cf6';
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginRight: 8 }}>Activity Audit Log</div>
        <input
          placeholder="Filter by action…"
          value={filter.action}
          onChange={e => setFilter(p => ({ ...p, action: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 13, width: 180 }}
        />
        <select
          value={filter.entity_type}
          onChange={e => setFilter(p => ({ ...p, entity_type: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 13 }}
        >
          <option value="">All entities</option>
          {['document','risk','user','supplier','ai_system','task','review'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{total} total events</span>
      </div>
      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No audit events found</td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="text-dim mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{r.username || '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 10,
                        background: `${getColor(r.action)}20`, color: getColor(r.action), fontWeight: 600 }}>
                        {r.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.entity_type && <span style={{ color: 'var(--text3)' }}>{r.entity_type} · </span>}
                      <span style={{ color: 'var(--text2)' }}>{r.entity_name || r.entity_id || '—'}</span>
                    </td>
                    <td className="mono text-dim" style={{ fontSize: 11 }}>{r.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > LIMIT && (
            <div style={{ padding: '12px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => load(offset - LIMIT)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text3)', alignSelf: 'center' }}>
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={offset + LIMIT >= total} onClick={() => load(offset + LIMIT)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── LDAP Tab ───────────────────────────────────── */
function LDAPTab() {
  const ROLE_OPTIONS = ['admin', 'analyst', 'auditor', 'viewer'];

  const [form, setForm] = useState({
    ldap_enabled: 'false',
    ldap_url: '',
    ldap_base_dn: '',
    ldap_bind_dn: '',
    ldap_bind_password: '',
    ldap_user_filter: '(sAMAccountName={{username}})',
    ldap_search_base: '',
    ldap_tls: 'false',
    ldap_default_role: 'viewer',
    ldap_group_map: '{}',
  });
  const [groupMap,  setGroupMap]  = useState([]);  // [{ group:'', role:'' }]
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [testing,   setTesting]   = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [msg,       setMsg]       = useState('');
  const [msgType,   setMsgType]   = useState('');

  useEffect(() => {
    api.get('/settings').then(r => {
      const kv = Object.fromEntries(r.data.map(x => [x.key, x.value]));
      setForm(prev => ({ ...prev, ...kv }));
      try {
        const parsed = JSON.parse(kv.ldap_group_map || '{}');
        setGroupMap(Object.entries(parsed).map(([group, role]) => ({ group, role })));
      } catch { setGroupMap([]); }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCheck = k => e => setForm(p => ({ ...p, [k]: e.target.checked ? 'true' : 'false' }));

  const addGroupRow    = () => setGroupMap(p => [...p, { group: '', role: 'viewer' }]);
  const removeGroupRow = i  => setGroupMap(p => p.filter((_, idx) => idx !== i));
  const updateGroupRow = (i, field, val) => setGroupMap(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const save = async () => {
    setSaving(true); setMsg('');
    const mapObj = {};
    groupMap.filter(r => r.group.trim()).forEach(r => { mapObj[r.group.trim()] = r.role; });
    const payload = { ...form, ldap_group_map: JSON.stringify(mapObj) };
    try {
      await api.patch('/settings', payload);
      setSaved(true); setMsg('LDAP settings saved.'); setMsgType('success');
      setTimeout(() => { setSaved(false); setMsg(''); }, 3000);
    } catch (ex) {
      setMsg(ex.response?.data?.error || 'Save failed'); setMsgType('error');
    } finally { setSaving(false); }
  };

  const testConn = async () => {
    setTesting(true); setMsg(''); setMsgType('');
    const mapObj = {};
    groupMap.filter(r => r.group.trim()).forEach(r => { mapObj[r.group.trim()] = r.role; });
    try {
      await api.post('/settings/ldap-test', { ...form, ldap_group_map: JSON.stringify(mapObj) });
      setMsg('Connected to LDAP server successfully.'); setMsgType('success');
    } catch (ex) {
      setMsg(ex.response?.data?.error || 'Connection failed'); setMsgType('error');
    } finally { setTesting(false); }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 4 }}>LDAP / Active Directory Authentication</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        When enabled, users can sign in with their domain credentials. Local admin account always works as fallback.
      </div>

      {msg && (
        <div className={`alert ${msgType === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>{msg}</div>
      )}

      {/* Enable toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer' }}>
        <input type="checkbox" checked={form.ldap_enabled === 'true'} onChange={setCheck('ldap_enabled')} />
        <div>
          <div style={{ fontWeight: 600 }}>Enable LDAP Authentication</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Allow domain users to log in with their AD credentials</div>
        </div>
      </label>

      <fieldset disabled={form.ldap_enabled !== 'true'} style={{ border: 'none', padding: 0, margin: 0, opacity: form.ldap_enabled === 'true' ? 1 : 0.45 }}>
        {/* Server */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 10 }}>Server</div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>LDAP URL *</label>
            <input value={form.ldap_url} onChange={set('ldap_url')} placeholder="ldap://dc.example.com:389  or  ldaps://dc.example.com:636" />
          </div>
          <div className="form-group" style={{ flex: 0, minWidth: 160 }}>
            <label>STARTTLS</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ldap_tls === 'true'} onChange={setCheck('ldap_tls')} />
              <span style={{ fontSize: 13 }}>Enable STARTTLS</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Base DN *</label>
          <input value={form.ldap_base_dn} onChange={set('ldap_base_dn')} placeholder="DC=example,DC=com" />
        </div>

        {/* Service account */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '20px 0 10px' }}>Service Account (for directory searches)</div>
        <div className="form-row">
          <div className="form-group">
            <label>Bind DN *</label>
            <input value={form.ldap_bind_dn} onChange={set('ldap_bind_dn')} placeholder="CN=svc-secureops,OU=Service Accounts,DC=example,DC=com" autoComplete="off" />
          </div>
          <div className="form-group">
            <label>Bind Password *</label>
            <input type="password" value={form.ldap_bind_password} onChange={set('ldap_bind_password')} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </div>

        {/* Search */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '20px 0 10px' }}>User Search</div>
        <div className="form-row">
          <div className="form-group">
            <label>User Filter</label>
            <input value={form.ldap_user_filter} onChange={set('ldap_user_filter')} placeholder="(sAMAccountName={{username}})" />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{'{{username}}'} is replaced with the login username at runtime.</div>
          </div>
          <div className="form-group">
            <label>Search Base <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(optional — defaults to Base DN)</span></label>
            <input value={form.ldap_search_base} onChange={set('ldap_search_base')} placeholder="OU=Employees,DC=example,DC=com" />
          </div>
        </div>

        {/* Role mapping */}
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '20px 0 10px' }}>Role Mapping</div>

        <div className="form-group" style={{ maxWidth: 280 }}>
          <label>Default Role <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(for new LDAP users with no matching group)</span></label>
          <select value={form.ldap_default_role} onChange={set('ldap_default_role')}>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Group → Role Mapping</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Map Active Directory group CNs (not full DNs) to SecureOps roles. First match wins.
        </div>
        {groupMap.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              style={{ flex: 2 }}
              placeholder="AD Group CN (e.g. SecureOps-Admins)"
              value={row.group}
              onChange={e => updateGroupRow(i, 'group', e.target.value)}
            />
            <span style={{ color: 'var(--text3)', fontSize: 18 }}>→</span>
            <select style={{ flex: 1 }} value={row.role} onChange={e => updateGroupRow(i, 'role', e.target.value)}>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-danger btn-sm" onClick={() => removeGroupRow(i)}>✕</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={addGroupRow} style={{ marginBottom: 8 }}>+ Add Group Mapping</button>
      </fieldset>

      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, marginTop: 20, gap: 10 }}>
        <button className="btn btn-secondary" onClick={testConn} disabled={testing || form.ldap_enabled !== 'true' || !form.ldap_url}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save LDAP Settings'}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_CLASS_LABELS = {
  public:       'Public',
  internal:     'Internal',
  confidential: 'Confidential',
  restricted:   'Restricted',
};

function ClassificationLabelsEditor({ form, setForm }) {
  const labels = (() => {
    try { return { ...DEFAULT_CLASS_LABELS, ...JSON.parse(form.asset_classifications || '{}') }; }
    catch { return { ...DEFAULT_CLASS_LABELS }; }
  })();

  const setLabel = (id, val) => {
    const updated = { ...labels, [id]: val };
    setForm(p => ({ ...p, asset_classifications: JSON.stringify(updated) }));
  };

  const CLASS_COLORS = {
    public: '#10b981', internal: '#3b82f6', confidential: '#f59e0b', restricted: '#ef4444',
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
      <div className="card-title" style={{ marginBottom: 6 }}>Asset Classification Labels</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        Customise the display names for the four ISO 27001 information classification levels.
        The underlying IDs (public / internal / confidential / restricted) remain unchanged.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Object.entries(DEFAULT_CLASS_LABELS).map(([id]) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: CLASS_COLORS[id], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', width: 90, flexShrink: 0, textTransform: 'capitalize' }}>{id}</span>
            <input
              value={labels[id]}
              onChange={e => setLabel(id, e.target.value)}
              maxLength={30}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                       padding: '6px 10px', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Settings Page ─────────────────────────── */
export default function Settings() {
  const { user }    = useContext(AuthContext);
  const isAdmin     = user?.role === 'admin';
  const [settings,  setSettings]  = useState([]);
  const [schedRpts, setSchedRpts] = useState([]);
  const [tab,       setTab]       = useState('notifications');
  const [form,      setForm]      = useState({});
  const [saved,     setSaved]     = useState(false);
  const [saveErr,   setSaveErr]   = useState('');
  const [testing,   setTesting]   = useState('');
  const [testMsg,   setTestMsg]   = useState('');
  const [schedModal,setSchedModal]= useState(false);
  const [loading,   setLoading]   = useState(true);

  const load = () => {
    Promise.all([api.get('/settings'), api.get('/settings/scheduled-reports')])
      .then(([s, r]) => {
        setSettings(s.data);
        const formInit = Object.fromEntries(s.data.map(x => [x.key, x.value]));
        setForm(formInit);
        setSchedRpts(r.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaveErr('');
    try {
      await api.patch('/settings', form);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (ex) {
      setSaveErr(ex.response?.data?.error || 'Failed to save settings');
    }
  };

  const testWebhook = async (type, extra) => {
    setTesting(type); setTestMsg('');
    try {
      await api.post('/settings/test-webhook', { type, to: extra });
      setTestMsg(`${type} test sent successfully!`);
    } catch (ex) {
      setTestMsg(ex.response?.data?.error || 'Test failed');
    } finally { setTesting(''); }
  };

  const deleteScheduled = async id => {
    await api.delete(`/settings/scheduled-reports/${id}`);
    load();
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  const tabs = [
    { key: 'notifications',    label: 'Notifications & Webhooks' },
    { key: 'email',            label: 'Email (SMTP)' },
    { key: 'sla',              label: 'SLA & Risk Appetite' },
    { key: 'threat-intel',     label: 'Threat Intelligence' },
    { key: 'scheduled-reports',label: 'Scheduled Reports' },
    { key: 'branding',         label: 'Branding' },
    { key: 'ldap',             label: 'LDAP / Active Directory' },
    { key: 'audit-log',        label: 'Audit Log' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Platform configuration</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Webhook Integrations</div>

          {testMsg  && <div className={`alert ${testMsg.includes('success') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>{testMsg}</div>}
          {saved    && <div className="alert alert-success" style={{ marginBottom: 16 }}>Settings saved.</div>}
          {saveErr  && <div className="alert alert-error" style={{ marginBottom: 16 }}>{saveErr}</div>}

          <div className="form-group">
            <label>Slack Incoming Webhook URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ flex: 1 }} type="url" value={form.slack_webhook_url || ''} placeholder="https://hooks.slack.com/services/..."
                onChange={e => setForm(p => ({ ...p, slack_webhook_url: e.target.value }))} />
              <button className="btn btn-secondary" disabled={testing === 'slack' || !form.slack_webhook_url}
                onClick={() => testWebhook('slack')}>Test</button>
            </div>
          </div>

          <div className="form-group">
            <label>Microsoft Teams Incoming Webhook URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ flex: 1 }} type="url" value={form.teams_webhook_url || ''} placeholder="https://outlook.office.com/webhook/..."
                onChange={e => setForm(p => ({ ...p, teams_webhook_url: e.target.value }))} />
              <button className="btn btn-secondary" disabled={testing === 'teams' || !form.teams_webhook_url}
                onClick={() => testWebhook('teams')}>Test</button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Notification Triggers</div>
            {[
              { key: 'notify_on_critical',     label: 'Notify on Critical Vulnerabilities',
                desc: 'Alert when a critical-severity vulnerability is discovered on any asset' },
              { key: 'notify_on_high',          label: 'Notify on High Vulnerabilities',
                desc: 'Alert when a high-severity vulnerability is discovered on any asset' },
              { key: 'notify_on_scan_complete', label: 'Notify on Scan Completion',
                desc: 'Alert when a network scan finishes — includes assets found and vuln count' },
              { key: 'notify_on_new_risk',      label: 'Notify on New Risk Register Entry',
                desc: 'Details: risk title, level, score (1–25), category, treatment strategy, owner' },
              { key: 'notify_on_risk_delete',   label: 'Notify on Risk Deletion',
                desc: 'Alert when a registered risk is permanently deleted — includes title, level, score, deleted by' },
              { key: 'notify_on_approval',      label: 'Notify on Approvals',
                desc: 'Details: vulnerability title, severity, action requested, requester name, decision (approved/rejected)' },
              { key: 'notify_on_grc_activity',  label: 'Notify on GRC Hub Activity',
                desc: 'Details: entity type (program/task/document), name, action, framework, owner' },
              { key: 'notify_on_cert_change',   label: 'Notify on Certification Tracker Changes',
                desc: 'Details: certification name, framework, phase transition, organisation, completion %' },
              { key: 'notify_on_kpi_change',    label: 'Notify on KPI & KRI Metrics Changes',
                desc: 'Details: metric name, old/new RAG status (Green/Amber/Red), direction of change' },
              { key: 'notify_on_new_asset',     label: 'Notify on New Asset Registration',
                desc: 'Alert when a new asset is manually added to the inventory — IP/hostname, classification, category, owner' },
              { key: 'notify_on_overdue',       label: 'Notify on Overdue Reviews (Daily at 07:30)',
                desc: 'Daily digest of overdue asset reviews and open risk reviews past their due date' },
              { key: 'notify_on_budget_expiry', label: 'Notify on IT Budget License Expiry',
                desc: 'Send Slack/Teams alert and in-app notification when a budget item license is approaching expiry' },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={form[key] === 'true'}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.checked ? 'true' : 'false' }))} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {settings.find(s => s.key === key)?.description || desc}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          {isAdmin && <ClassificationLabelsEditor form={form} setForm={setForm} />}

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <button className="btn btn-primary" onClick={save}>Save Settings</button>
          </div>
        </div>
      )}

      {tab === 'email' && (
        <EmailTab
          form={form}
          setForm={setForm}
          save={save}
          saved={saved}
          testing={testing}
          testWebhook={testWebhook}
          testMsg={testMsg}
        />
      )}

      {tab === 'sla' && <SLATab />}

      {tab === 'threat-intel' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Threat Intelligence API Keys</div>

          {saved   && <div className="alert alert-success" style={{ marginBottom: 16 }}>Settings saved.</div>}
          {saveErr && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{saveErr}</div>}

          <div className="form-group">
            <label>AbuseIPDB API Key</label>
            <input
              type="password"
              value={form.abuseipdb_api_key || ''}
              onChange={e => setForm(p => ({ ...p, abuseipdb_api_key: e.target.value }))}
              placeholder="Enter your AbuseIPDB v2 API key"
              autoComplete="new-password"
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Used for IP reputation lookups in Threat Intelligence page.
              Get a free key at <span style={{ color: 'var(--accent-h)' }}>abuseipdb.com</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
            <label>NVD API Key <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="password"
              value={form.nvd_api_key || ''}
              onChange={e => setForm(p => ({ ...p, nvd_api_key: e.target.value }))}
              placeholder="Enter your NVD API key for faster CVE lookups"
              autoComplete="new-password"
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Without this key, CVE lookups are rate-limited to 5 requests/30s.
              Get a free key at <span style={{ color: 'var(--accent-h)' }}>nvd.nist.gov/developers/request-an-api-key</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
            <label>Shodan API Key <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="password"
              value={form.shodan_api_key || ''}
              onChange={e => setForm(p => ({ ...p, shodan_api_key: e.target.value }))}
              placeholder="Enter your Shodan API key"
              autoComplete="new-password"
            />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Used for internet-facing asset lookups and exposure intelligence.
              Get a key at <span style={{ color: 'var(--accent-h)' }}>account.shodan.io</span>
            </div>
          </div>

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={save}>Save Settings</button>
          </div>
        </div>
      )}

      {tab === 'scheduled-reports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setSchedModal(true)}>+ New Scheduled Report</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              {schedRpts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📅</div>
                  <p>No scheduled reports. Create one to auto-generate reports on a recurring basis.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Name</th><th>Type</th><th>Format</th><th>Schedule</th><th>Last Run</th><th>Next Run</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {schedRpts.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td><span className="badge badge-info">{r.report_type}</span></td>
                        <td className="mono">{r.format.toUpperCase()}</td>
                        <td>{r.schedule}</td>
                        <td className="text-dim">{r.last_run ? format(new Date(r.last_run), 'MMM d HH:mm') : 'Never'}</td>
                        <td className="text-dim">{r.next_run ? format(new Date(r.next_run), 'MMM d HH:mm') : '—'}</td>
                        <td>
                          <span className={`badge ${r.is_active ? 'badge-low' : ''}`}>{r.is_active ? 'active' : 'paused'}</span>
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Delete this scheduled report?')) deleteScheduled(r.id); }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {schedModal && <ScheduledReportModal onClose={() => setSchedModal(false)} onSaved={() => { setSchedModal(false); load(); }} />}
        </div>
      )}

      {tab === 'branding' && <BrandingTab />}

      {tab === 'ldap' && <LDAPTab />}

      {tab === 'audit-log' && <AuditLogTab />}
    </div>
  );
}
