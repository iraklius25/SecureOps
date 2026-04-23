import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';
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
  const [testEmail, setTestEmail] = useState('');

  const handleTestEmail = async () => {
    const to = window.prompt('Enter email address to send test to:');
    if (!to) return;
    setTestEmail(to);
    await testWebhook('email', to);
  };

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

      <div className="form-group">
        <label>From Address</label>
        <input
          value={form.smtp_from || ''}
          onChange={e => setForm(p => ({ ...p, smtp_from: e.target.value }))}
          placeholder="SecureOps <noreply@yourdomain.com>"
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Email Notifications</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.smtp_enabled === 'true'}
            onChange={e => setForm(p => ({ ...p, smtp_enabled: e.target.checked ? 'true' : 'false' }))}
          />
          <div>
            <div style={{ fontWeight: 500 }}>Enable Email Notifications</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Send automated emails via configured SMTP</div>
          </div>
        </label>

        {[
          { key: 'email_on_assign',   label: 'Email on Assignment',    desc: 'Notify user when a vulnerability is assigned to them' },
          { key: 'email_on_critical', label: 'Email on Critical Vuln', desc: 'Notify admins when a critical vulnerability is discovered' },
          { key: 'email_on_overdue',  label: 'Email on SLA Breach',    desc: 'Notify when vulnerabilities pass their SLA due date' },
        ].map(({ key, label, desc }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, cursor: 'pointer' }}>
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
        <button className="btn btn-secondary" onClick={handleTestEmail} disabled={testing === 'email' || !form.smtp_host}>
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

/* ─── Main Settings Page ─────────────────────────── */
export default function Settings() {
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
              { key: 'notify_on_critical',     label: 'Notify on Critical Vulnerabilities' },
              { key: 'notify_on_high',          label: 'Notify on High Vulnerabilities' },
              { key: 'notify_on_scan_complete', label: 'Notify on Scan Completion' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={form[key] === 'true'}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.checked ? 'true' : 'false' }))} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {settings.find(s => s.key === key)?.description}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>

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
    </div>
  );
}
