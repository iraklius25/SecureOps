import React, { useState, useEffect, useContext, useCallback } from 'react';
import { api, AuthContext } from '../App';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const fmt$ = n => '$' + parseFloat(n||0).toLocaleString('en-US',{maximumFractionDigits:0});

function downloadCSV(path, filename) {
  api.get(path, { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const a   = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(() => alert('Export failed'));
}

function openHtmlReport(sections) {
  const token = localStorage.getItem('token') || '';
  const params = new URLSearchParams({ token });
  if (sections.length) params.set('sections', sections.join(','));
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
  { key:'executive',  label:'Executive Summary',  desc:'Asset counts, ALE totals, vulns by severity' },
  { key:'ale',        label:'ALE Breakdown',       desc:'Top 10 vulnerabilities by annualised loss' },
  { key:'risks',      label:'Top Risks',           desc:'Open risk register entries by risk score' },
  { key:'vulnstats',  label:'Recent Findings',     desc:'Last 20 detected vulnerabilities' },
  { key:'assets',     label:'Asset Summary',       desc:'Asset count by type' },
];

function ReportBuilderTab() {
  const [selected, setSelected] = useState(new Set(['executive','ale','risks','vulnstats','assets']));
  const toggle = key => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const sections = Array.from(selected);

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom:16 }}>Select Report Sections</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
        {REPORT_SECTIONS.map(s => (
          <label key={s.key} style={{
            display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
            background: selected.has(s.key) ? 'rgba(124,111,255,0.08)' : 'var(--bg3)',
            borderRadius:'var(--radius)',
            border:`1px solid ${selected.has(s.key) ? 'rgba(124,111,255,0.3)' : 'var(--border)'}`,
            cursor:'pointer', transition:'all 0.15s',
          }}>
            <input type="checkbox" checked={selected.has(s.key)} onChange={() => toggle(s.key)} style={{ width:16, height:16, flexShrink:0 }} />
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{s.label}</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>{s.desc}</div>
            </div>
          </label>
        ))}
      </div>
      {selected.size === 0 && <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>Select at least one section.</div>}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <button className="btn btn-primary" disabled={selected.size === 0} onClick={() => openHtmlReport(sections)}>Generate Report</button>
        <button className="btn btn-secondary" disabled={selected.size === 0} onClick={() => {
          const token = localStorage.getItem('token') || '';
          const params = new URLSearchParams({ token });
          if (sections.length) params.set('sections', sections.join(','));
          api.get(`/reports/html?${params}`, { responseType:'blob' }).then(r => {
            const url = URL.createObjectURL(new Blob([r.data], { type:'text/html' }));
            const a = document.createElement('a');
            a.href = url; a.download = `secureops-report-${Date.now()}.html`;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
          }).catch(() => alert('Export failed'));
        }}>Export HTML</button>
      </div>
      <div style={{ marginTop:20, padding:'12px 14px', background:'var(--bg3)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text3)' }}>
        <strong>Tip:</strong> Use your browser's Print (Ctrl+P) → "Save as PDF" to create a PDF.
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
