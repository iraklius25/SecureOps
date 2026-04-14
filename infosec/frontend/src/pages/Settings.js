import React, { useState, useEffect } from 'react';
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

export default function Settings() {
  const [settings,  setSettings]  = useState([]);
  const [schedRpts, setSchedRpts] = useState([]);
  const [tab,       setTab]       = useState('notifications');
  const [form,      setForm]      = useState({});
  const [saved,     setSaved]     = useState(false);
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
    await api.patch('/settings', form);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const testWebhook = async type => {
    setTesting(type); setTestMsg('');
    try {
      await api.post('/settings/test-webhook', { type });
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

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Webhook integrations and scheduled reports</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {['notifications', 'scheduled-reports'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'notifications' ? 'Notifications & Webhooks' : 'Scheduled Reports'}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Webhook Integrations</div>

          {testMsg && <div className={`alert ${testMsg.includes('success') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>{testMsg}</div>}
          {saved    && <div className="alert alert-success" style={{ marginBottom: 16 }}>Settings saved.</div>}

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
