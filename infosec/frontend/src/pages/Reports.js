import React, { useState, useEffect } from 'react';
import { api } from '../App';
const fmt$ = n => '$' + parseFloat(n||0).toLocaleString('en-US',{maximumFractionDigits:0});

function downloadCSV(path, filename) {
  // Use axios with blob to download CSV with auth header
  api.get(path, { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const a   = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(() => alert('Export failed'));
}

export function Reports() {
  const [data,    setData]    = useState(null);
  const [ale,     setAle]     = useState(null);
  const [tab,     setTab]     = useState('executive');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/reports/executive'), api.get('/reports/ale')])
      .then(([e,a]) => { setData(e.data); setAle(a.data); setLoading(false); });
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Reports & Analytics</div></div>
        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => downloadCSV('/reports/export/assets.csv', 'assets.csv')}>
            ↓ Assets CSV
          </button>
          <button className="btn btn-secondary" onClick={() => downloadCSV('/reports/export/vulnerabilities.csv', 'vulnerabilities.csv')}>
            ↓ Vulns CSV
          </button>
          <button className="btn btn-secondary" onClick={() => downloadCSV('/reports/export/risks.csv', 'risks.csv')}>
            ↓ Risks CSV
          </button>
        </div>
      </div>

      <div className="tabs">
        {['executive','ale'].map(t => (
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='ale'?'ALE Breakdown':'Executive Summary'}
          </button>
        ))}
      </div>

      {tab === 'executive' && data && (
        <div>
          <div className="stat-grid" style={{marginBottom:20}}>
            <div className="stat-card"><div className="stat-label">Total Assets</div><div className="stat-value">{data.summary.total}</div></div>
            <div className="stat-card"><div className="stat-label">Critical Assets</div><div className="stat-value" style={{color:'var(--critical)'}}>{data.summary.critical_count}</div></div>
            <div className="stat-card"><div className="stat-label">Total ALE</div><div className="stat-value ale-high">{fmt$(data.summary.total_ale)}</div></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV('/reports/export/executive.csv', 'executive_summary.csv')}>
              ↓ Export CSV
            </button>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">Open Vulnerabilities by Severity</div>
            <table><thead><tr><th>Severity</th><th>Count</th><th>Total ALE</th></tr></thead>
              <tbody>{data.vulns_by_severity.map(r=>(
                <tr key={r.severity}>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono">{r.cnt}</td>
                  <td className={`ale-value ${r.severity==='critical'?'ale-high':r.severity==='high'?'ale-med':'ale-low'}`}>{fmt$(r.total_ale)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">Top Risks by ALE</div>
            <table><thead><tr><th>Title</th><th>Severity</th><th>Asset</th><th>ALE</th><th>CVE</th></tr></thead>
              <tbody>{data.top_ale_risks.map(r=>(
                <tr key={r.id ?? r.title}>
                  <td style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</td>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono" style={{color:'var(--info)'}}>{r.ip_address}{r.hostname?` (${r.hostname})`:''}</td>
                  <td className="ale-value ale-high">{fmt$(r.ale)}</td>
                  <td className="mono">{r.cve_id||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Recent Findings (last 20)</div>
            <table><thead><tr><th>Title</th><th>Severity</th><th>Asset</th><th>Detected</th></tr></thead>
              <tbody>{data.recent_findings.map((r,i)=>(
                <tr key={i}>
                  <td style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</td>
                  <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                  <td className="mono" style={{color:'var(--info)',fontSize:11}}>{r.ip_address}</td>
                  <td className="text-dim">{r.detected_at ? new Date(r.detected_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ale' && ale && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="stat-card" style={{display:'inline-block',minWidth:220}}>
              <div className="stat-label">Total Annualised Loss Expectancy</div>
              <div className="stat-value ale-high">{fmt$(ale.total_ale)}</div>
              <div className="stat-sub">{ale.count} open vulnerabilities</div>
            </div>
            <button className="btn btn-secondary" onClick={() => downloadCSV('/reports/export/vulnerabilities.csv', 'vulnerabilities.csv')}>
              ↓ Export CSV
            </button>
          </div>
          <div className="card" style={{padding:0}}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Sev</th><th>Asset</th><th>Asset Value</th><th>EF%</th><th>ARO</th><th>SLE</th><th>ALE</th></tr></thead>
                <tbody>{ale.items.map(r=>(
                  <tr key={r.id}>
                    <td style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</td>
                    <td><span className={`badge badge-${r.severity}`}>{r.severity}</span></td>
                    <td className="mono" style={{color:'var(--info)',fontSize:11}}>{r.ip_address}</td>
                    <td className="mono">{fmt$(r.asset_value)}</td>
                    <td className="mono">{r.exposure_factor}%</td>
                    <td className="mono">{r.aro}</td>
                    <td className="mono">{fmt$(r.sle)}</td>
                    <td className={`ale-value ${r.ale > 50000 ? 'ale-high' : r.ale > 10000 ? 'ale-med' : 'ale-low'}`}>{fmt$(r.ale)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
