import React, { useState, useEffect, useContext, useCallback } from 'react';
import { api, AuthContext } from '../App';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const fmt$ = n => '$' + parseFloat(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 });

function downloadCSV(path, filename) {
  api.get(path, { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const a   = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(() => alert('Export failed'));
}

function openHtmlReport(sections, from, to) {
  const token = localStorage.getItem('token') || '';
  const params = new URLSearchParams({ token });
  if (sections.length) params.set('sections', sections.join(','));
  if (from) params.set('from', from);
  if (to)   params.set('to',   to);
  window.open(`/api/reports/html?${params}`, '_blank');
}

/* ─── Delete confirmation banner ─────────────────── */
function DeleteBtn({ onConfirm, label = 'Delete' }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
      <button className="btn btn-danger btn-sm" style={{ padding:'3px 8px', fontSize:11 }}
        onClick={() => { setConfirming(false); onConfirm(); }}>
        Confirm
      </button>
      <button className="btn btn-secondary btn-sm" style={{ padding:'3px 8px', fontSize:11 }}
        onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
  return (
    <button className="btn btn-danger btn-sm" style={{ padding:'3px 8px', fontSize:11 }}
      onClick={() => setConfirming(true)}>
      {label}
    </button>
  );
}

/* ─── Trends Tab ─────────────────────────────────── */
function TrendsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/reports/trends')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load trends'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (err) return <div className="alert alert-error">{err}</div>;
  if (!data.length) return (
    <div className="empty-state">
      <div className="empty-icon">📈</div>
      <p>No trend data available yet. Data will appear after vulnerabilities are tracked over time.</p>
    </div>
  );

  const chartData = data.map(d => ({
    ...d,
    open_vulns:     parseInt(d.open_vulns) || 0,
    critical_vulns: parseInt(d.critical_vulns) || 0,
    high_vulns:     parseInt(d.high_vulns) || 0,
    resolved_vulns: parseInt(d.resolved_vulns) || 0,
    total_ale:      parseFloat(d.total_ale) || 0,
  }));

  const axisStyle = { fontSize: 11, fill: 'var(--text3)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-title">Open Vulnerabilities by Month</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }} labelStyle={{ color:'var(--text)', fontWeight:600 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="critical_vulns" name="Critical" stackId="1" stroke="#ef4444" fill="#ef444455" />
            <Area type="monotone" dataKey="high_vulns" name="High" stackId="1" stroke="#f97316" fill="#f9731655" />
            <Area type="monotone" dataKey="open_vulns" name="Open Total" stackId="2" stroke="#6366f1" fill="#6366f122" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Total ALE Over Time</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={v => fmt$(v)} />
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }} formatter={v => [fmt$(v), 'Total ALE']} labelStyle={{ color:'var(--text)', fontWeight:600 }} />
            <Area type="monotone" dataKey="total_ale" name="Total ALE" stroke="#eab308" fill="#eab30833" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Resolved Vulnerabilities per Month</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }} labelStyle={{ color:'var(--text)', fontWeight:600 }} />
            <Bar dataKey="resolved_vulns" name="Resolved" fill="#22c55e" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">Open vs Resolved Trend</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, fontSize:12 }} labelStyle={{ color:'var(--text)', fontWeight:600 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="open_vulns" name="Open" stroke="#ef4444" strokeWidth={2} dot={{ r:4 }} />
            <Line type="monotone" dataKey="resolved_vulns" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r:4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Report Builder Tab ─────────────────────────── */
const REPORT_SECTIONS = [
  { group: 'Top Management', key:'management_summary', label:'Top Management Summary',  desc:'Board-level view: risk posture, appetite status, critical KPIs, top risks' },
  { group: 'Executive',      key:'executive',          label:'Executive Summary',        desc:'Asset counts, ALE totals, open vulnerabilities by severity' },
  { group: 'Executive',      key:'risk_appetite',      label:'Risk Appetite Status',     desc:'Current posture vs approved thresholds — score, ALE, critical count' },
  { group: 'Executive',      key:'kpi_metrics',        label:'KPI & KRI Metrics',        desc:'Key risk indicators with RAG status: MTTR, ALE, critical counts' },
  { group: 'Risk Register',  key:'risks',              label:'Top Open Risks',           desc:'Open risk register entries ranked by risk score' },
  { group: 'Risk Register',  key:'ale',                label:'ALE Breakdown',            desc:'Top vulnerabilities by annualised loss expectancy (ALE)' },
  { group: 'Security',       key:'vulnstats',          label:'Findings (Date Range)',    desc:'Vulnerabilities detected in the selected reporting period' },
  { group: 'Security',       key:'assets',             label:'Asset Inventory',          desc:'Asset count by type and criticality level' },
  { group: 'Compliance',     key:'compliance',         label:'Compliance Posture',       desc:'Control status and % compliance across all frameworks' },
  { group: 'Compliance',     key:'certifications',     label:'Certification Status',     desc:'Active certifications, phases, and completion percentages' },
];

const PRESETS = {
  management: { label: 'Top Management Pack',  keys: ['management_summary','risk_appetite','kpi_metrics','risks'] },
  full:        { label: 'Full Report',          keys: REPORT_SECTIONS.map(s => s.key) },
  executive:   { label: 'Executive Brief',      keys: ['executive','risk_appetite','risks','ale'] },
  compliance:  { label: 'Compliance Pack',      keys: ['compliance','certifications','risk_appetite'] },
};

function ReportBuilderTab() {
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const thirtyAgoStr = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

  const [selected, setSelected] = useState(new Set(PRESETS.management.keys));
  const [dateFrom, setDateFrom] = useState(thirtyAgoStr);
  const [dateTo,   setDateTo]   = useState(todayStr);

  const toggle = key => setSelected(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const applyPreset = keys => setSelected(new Set(keys));
  const sections = REPORT_SECTIONS.filter(s => selected.has(s.key)).map(s => s.key);

  const exportHtml = () => {
    const token  = localStorage.getItem('token') || '';
    const params = new URLSearchParams({ token });
    if (sections.length) params.set('sections', sections.join(','));
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo)   params.set('to',   dateTo);
    api.get(`/reports/html?${params}`, { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/html' }));
      const a   = document.createElement('a');
      a.href = url; a.download = `secureops-report-${dateFrom}-${dateTo}.html`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    }).catch(() => alert('Export failed'));
  };

  const groups = [...new Set(REPORT_SECTIONS.map(s => s.group))];

  return (
    <div>
      {/* Date range */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Reporting Period</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '6px 10px', fontSize: 13 }} />
          </div>
          <div style={{ fontSize: 18, color: 'var(--text3)', paddingTop: 20 }}>→</div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '6px 10px', fontSize: 13 }} />
          </div>
          <div style={{ paddingTop: 20, display: 'flex', gap: 6 }}>
            {[7, 30, 90].map(d => (
              <button key={d} className="btn btn-secondary btn-sm" onClick={() => {
                const from = new Date(); from.setDate(from.getDate() - d);
                setDateFrom(from.toISOString().slice(0, 10)); setDateTo(todayStr());
              }}>Last {d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>Quick Presets</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} className="btn btn-secondary btn-sm" onClick={() => applyPreset(p.keys)}>
              {p.label}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--text3)' }}
            onClick={() => setSelected(new Set())}>Clear All</button>
        </div>
      </div>

      {/* Section picker */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Select Report Sections</div>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 8 }}>{group}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REPORT_SECTIONS.filter(s => s.group === group).map(s => (
                <label key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
                  background: selected.has(s.key) ? 'rgba(124,111,255,0.08)' : 'var(--bg3)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${selected.has(s.key) ? 'rgba(124,111,255,0.3)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <input type="checkbox" checked={selected.has(s.key)} onChange={() => toggle(s.key)}
                    style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
        {selected.size === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Select at least one section above.</div>
        )}
      </div>

      {/* Actions */}
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={selected.size === 0}
            onClick={() => openHtmlReport(sections, dateFrom, dateTo)}>
            Open Report in Browser
          </button>
          <button className="btn btn-secondary" disabled={selected.size === 0} onClick={exportHtml}>
            Download as HTML
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>
            {selected.size} section{selected.size !== 1 ? 's' : ''} selected
          </span>
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text3)' }}>
          Company logo (if set in Settings → Branding) appears automatically in the report header.
          Use <strong>Ctrl+P → Save as PDF</strong> to create a PDF version.
        </div>
      </div>
    </div>
  );
}

/* ─── Scheduled Reports Tab (admin only) ────────── */
function ScheduledTab() {
  const { user } = useContext(AuthContext);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/scheduled')
      .then(r => { setRows(r.data); })
      .catch(e => setErr(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async id => {
    try { await api.delete(`/reports/scheduled/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  const toggle = async (id, is_active) => {
    try { await api.patch(`/reports/scheduled/${id}`, { is_active: !is_active }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Update failed'); }
  };

  if (user?.role !== 'admin') return (
    <div className="empty-state">
      <div className="empty-icon">🔒</div>
      <p>Admin access required to manage scheduled reports.</p>
    </div>
  );
  if (loading) return <div className="empty-state"><div className="spinner"/></div>;
  if (err)     return <div className="alert alert-error">{err}</div>;

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom:16, fontSize:13 }}>
        Scheduled reports run automatically on their configured interval. Deleting a schedule is permanent.
      </div>
      {rows.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📅</div><p>No scheduled reports configured.</p></div>
      ) : (
        <div className="card" style={{ padding:0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Schedule</th><th>Status</th>
                <th>Last Run</th><th>Next Run</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight:600 }}>{r.name}</td>
                  <td className="mono">{r.report_type}</td>
                  <td><span className="badge badge-info">{r.schedule}</span></td>
                  <td><span className={`badge ${r.is_active ? 'badge-low' : 'badge-false_positive'}`}>{r.is_active ? 'Active' : 'Paused'}</span></td>
                  <td className="text-dim">{r.last_run ? new Date(r.last_run).toLocaleString() : '—'}</td>
                  <td className="text-dim">{r.next_run ? new Date(r.next_run).toLocaleString() : '—'}</td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggle(r.id, r.is_active)}>
                        {r.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <DeleteBtn onConfirm={() => del(r.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Main Reports Page ──────────────────────────── */
export function Reports() {
  const { user } = useContext(AuthContext);
  const [data,    setData]    = useState(null);
  const [ale,     setAle]     = useState(null);
  const [tab,     setTab]     = useState('executive');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/reports/executive'), api.get('/reports/ale')])
      .then(([e, a]) => { setData(e.data); setAle(a.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteVuln = async id => {
    try { await api.delete(`/vulns/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  const deleteRisk = async id => {
    try { await api.delete(`/risks/${id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  };

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  const tabs = [
    { key:'executive',      label:'Executive Summary' },
    { key:'ale',            label:'ALE Breakdown' },
    { key:'trends',         label:'Trends' },
    { key:'report-builder', label:'Report Builder' },
    ...(isAdmin ? [{ key:'scheduled', label:'⚙ Scheduled' }] : []),
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports & Analytics</div>
          {isAdmin && <div className="page-subtitle">Admin — delete buttons visible on all tables</div>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => openHtmlReport(['executive','ale','risks','vulnstats','assets'])}>
            Export HTML Report
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/assets.csv', 'assets.csv')}>Assets CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/vulnerabilities.csv', 'vulnerabilities.csv')}>Vulns CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/risks.csv', 'risks.csv')}>Risks CSV</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn ${tab===t.key?'active':''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* ── Executive Summary ── */}
      {tab === 'executive' && data && (
        <div>
          <div className="stat-grid" style={{ marginBottom:20 }}>
            <div className="stat-card"><div className="stat-label">Total Assets</div><div className="stat-value">{data.summary.total}</div></div>
            <div className="stat-card"><div className="stat-label">Critical Assets</div><div className="stat-value" style={{ color:'var(--critical)' }}>{data.summary.critical_count}</div></div>
            <div className="stat-card"><div className="stat-label">Total ALE</div><div className="stat-value ale-high">{fmt$(data.summary.total_ale)}</div></div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/executive.csv', 'executive_summary.csv')}>Export CSV</button>
          </div>

          {/* Vulns by severity — aggregate, no delete */}
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-title">Open Vulnerabilities by Severity</div>
            <table>
              <thead><tr><th>Severity</th><th>Count</th><th>Total ALE</th></tr></thead>
              <tbody>{data.vulns_by_severity.map(r => (
                <tr key={r.severity}>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono">{r.cnt}</td>
                  <td className={`ale-value ${r.severity==='critical'?'ale-high':r.severity==='high'?'ale-med':'ale-low'}`}>{fmt$(r.total_ale)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {/* Top vulnerabilities by ALE — admin can delete */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div className="card-title" style={{ margin:0 }}>Top Vulnerabilities by ALE</div>
              {isAdmin && <span style={{ fontSize:11, color:'var(--text3)' }}>Admin: delete removes from vulnerability register</span>}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Severity</th><th>Asset</th><th>ALE</th><th>CVE</th>
                  {isAdmin && <th style={{ width:80 }}>Action</th>}
                </tr>
              </thead>
              <tbody>{data.top_ale_risks.map(r => (
                <tr key={r.id ?? r.title}>
                  <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</td>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono" style={{ color:'var(--info)', fontSize:12 }}>{r.ip_address}{r.hostname ? ` (${r.hostname})` : ''}</td>
                  <td className="ale-value ale-high">{fmt$(r.ale)}</td>
                  <td className="mono" style={{ fontSize:12 }}>{r.cve_id || '—'}</td>
                  {isAdmin && <td>{r.id && <DeleteBtn onConfirm={() => deleteVuln(r.id)} />}</td>}
                </tr>
              ))}</tbody>
            </table>
          </div>

          {/* Top risks from risk register — admin can delete */}
          {data.top_risks && data.top_risks.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div className="card-title" style={{ margin:0 }}>Top Open Risks</div>
                {isAdmin && <span style={{ fontSize:11, color:'var(--text3)' }}>Admin: delete removes from risk register</span>}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Score</th><th>Title</th><th>Level</th><th>Treatment</th><th>Asset</th>
                    {isAdmin && <th style={{ width:80 }}>Action</th>}
                  </tr>
                </thead>
                <tbody>{data.top_risks.map(r => (
                  <tr key={r.id}>
                    <td><span className={`risk-score risk-${r.risk_level}`}>{r.risk_score}</span></td>
                    <td style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</td>
                    <td><span className={`badge badge-${r.risk_level}`}>{r.risk_level}</span></td>
                    <td style={{ fontSize:12, color:'var(--text2)' }}>{r.treatment}</td>
                    <td className="mono" style={{ fontSize:12, color:'var(--info)' }}>{r.ip_address || '—'}</td>
                    {isAdmin && <td>{r.id && <DeleteBtn onConfirm={() => deleteRisk(r.id)} />}</td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Recent findings — admin can delete */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div className="card-title" style={{ margin:0 }}>Recent Findings (last 20)</div>
              {isAdmin && <span style={{ fontSize:11, color:'var(--text3)' }}>Admin: delete removes finding</span>}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Severity</th><th>Asset</th><th>Detected</th>
                  {isAdmin && <th style={{ width:80 }}>Action</th>}
                </tr>
              </thead>
              <tbody>{data.recent_findings.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td style={{ maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</td>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono" style={{ color:'var(--info)', fontSize:11 }}>{r.ip_address}</td>
                  <td className="text-dim">{r.detected_at ? new Date(r.detected_at).toLocaleDateString() : '—'}</td>
                  {isAdmin && <td>{r.id && <DeleteBtn onConfirm={() => deleteVuln(r.id)} />}</td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ALE Breakdown ── */}
      {tab === 'ale' && ale && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div className="stat-card" style={{ display:'inline-block', minWidth:220 }}>
              <div className="stat-label">Total Annualised Loss Expectancy</div>
              <div className="stat-value ale-high">{fmt$(ale.total_ale)}</div>
              <div className="stat-sub">{ale.count} open vulnerabilities</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {isAdmin && <span style={{ fontSize:12, color:'var(--text3)', alignSelf:'center' }}>Admin: delete removes vulnerability</span>}
              <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/vulnerabilities.csv', 'vulnerabilities.csv')}>Export CSV</button>
            </div>
          </div>

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th><th>Sev</th><th>Asset</th>
                    <th>Asset Value</th><th>EF%</th><th>ARO</th><th>SLE</th><th>ALE</th>
                    {isAdmin && <th style={{ width:80 }}>Action</th>}
                  </tr>
                </thead>
                <tbody>{ale.items.map(r => (
                  <tr key={r.id}>
                    <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</td>
                    <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                    <td className="mono" style={{ color:'var(--info)', fontSize:11 }}>{r.ip_address}</td>
                    <td className="mono">{fmt$(r.asset_value)}</td>
                    <td className="mono">{r.exposure_factor}%</td>
                    <td className="mono">{r.aro}</td>
                    <td className="mono">{fmt$(r.sle)}</td>
                    <td className={`ale-value ${r.ale > 50000 ? 'ale-high' : r.ale > 10000 ? 'ale-med' : 'ale-low'}`}>{fmt$(r.ale)}</td>
                    {isAdmin && <td>{r.id && <DeleteBtn onConfirm={() => deleteVuln(r.id)} />}</td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'trends'         && <TrendsTab />}
      {tab === 'report-builder' && <ReportBuilderTab />}
      {tab === 'scheduled'      && <ScheduledTab />}
    </div>
  );
}

export default Reports;
