import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api } from '../App';
import { format } from 'date-fns';

const fmt$ = n => '$' + (n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(0)+'K' : Math.round(n).toLocaleString());
const SEV_COLORS = { critical: '#f85149', high: '#f0883e', medium: '#e3b341', low: '#3fb950' };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(console.error);
    const t = setInterval(() => api.get('/dashboard').then(r => setData(r.data)), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;
  if (!data)   return <div className="empty-state"><p>Failed to load dashboard</p></div>;

  const vulnBySev = Object.entries(data.open_vulns_by_severity||{}).map(([k,v]) => ({ name: k.charAt(0).toUpperCase()+k.slice(1), value: v, fill: SEV_COLORS[k] }));
  const riskData  = Object.entries(data.risks||{}).map(([k,v]) => ({ name: k.charAt(0).toUpperCase()+k.slice(1), value: v }));
  const trendMap = {};
  (data.vuln_trend||[]).forEach(r => {
    const d = format(new Date(r.day),'MMM dd');
    if (!trendMap[d]) trendMap[d] = { day: d };
    trendMap[d][r.severity] = parseInt(r.cnt);
  });
  const trendData = Object.values(trendMap).slice(-14);

  const aleClass = data.total_ale >= 500000 ? 'ale-high' : data.total_ale >= 100000 ? 'ale-med' : 'ale-low';

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Security Dashboard</div><div className="page-subtitle">Real-time risk posture overview</div></div>
        <span className="text-dim" style={{fontSize:12}}>{format(new Date(),'MMM d, yyyy HH:mm')}</span>
      </div>

      {/* KPI row */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value">{data.assets?.total || 0}</div>
          <div className="stat-sub">{data.assets?.active || 0} active · {data.critical_assets} critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Vulns</div>
          <div className="stat-value" style={{color:'var(--critical)'}}>{data.open_vulns_by_severity?.critical || 0}</div>
          <div className="stat-sub">{data.open_vulns_by_severity?.high || 0} high · {data.open_vulns_by_severity?.medium || 0} medium</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Open Vulns</div>
          <div className="stat-value" style={{color:'var(--high)'}}>
            {Object.values(data.open_vulns_by_severity||{}).reduce((a,b)=>a+b,0)}
          </div>
          <div className="stat-sub">Across all assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Annualised Loss (ALE)</div>
          <div className={`stat-value ${aleClass}`}>{fmt$(data.total_ale || 0)}</div>
          <div className="stat-sub">Expected annual risk exposure</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Risks</div>
          <div className="stat-value">{Object.values(data.risks||{}).reduce((a,b)=>a+b,0)}</div>
          <div className="stat-sub">{data.risks?.critical || 0} critical · {data.risks?.high || 0} high</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20}}>
        {/* Vuln by severity */}
        <div className="card">
          <div className="card-title">Open Vulnerabilities by Severity</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={vulnBySev} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({name,value}) => value > 0 ? `${name}: ${value}` : ''} labelLine={false} fontSize={11}>
                {vulnBySev.map((e,i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={(v,n) => [v, n]} contentStyle={{background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk register */}
        <div className="card">
          <div className="card-title">Risk Register Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskData} margin={{top:5,bottom:0}}>
              <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--text2)'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:'var(--text2)'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12}} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {riskData.map((e,i) => <Cell key={i} fill={SEV_COLORS[e.name.toLowerCase()]||'var(--accent)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 14-day trend */}
        <div className="card">
          <div className="card-title">Vulnerability Trend (14 days)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{top:5,bottom:0}}>
              <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:'var(--text2)'}} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12}} />
              {['critical','high','medium','low'].map(s => (
                <Line key={s} type="monotone" dataKey={s} stroke={SEV_COLORS[s]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent scans */}
      <div className="card">
        <div className="flex-between" style={{marginBottom:12}}>
          <div className="card-title" style={{marginBottom:0}}>Recent Scans</div>
          <a href="/scans" style={{fontSize:12,color:'var(--accent-h)',textDecoration:'none'}}>View all →</a>
        </div>
        {data.recent_scans?.length ? (
          <table>
            <thead><tr><th>Target</th><th>Type</th><th>Status</th><th>Assets</th><th>Vulns</th><th>Time</th></tr></thead>
            <tbody>
              {data.recent_scans.map(s => (
                <tr key={s.id}>
                  <td className="mono">{s.target}</td>
                  <td>{s.scan_type}</td>
                  <td>
                    <span className={`status-dot dot-${s.status}`}/>
                    {s.status}
                  </td>
                  <td>{s.assets_found ?? '-'}</td>
                  <td>{s.vulns_found ?? '-'}</td>
                  <td className="text-dim">{format(new Date(s.created_at),'MMM d HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state"><p>No scans yet</p></div>}
      </div>
    </div>
  );
}
