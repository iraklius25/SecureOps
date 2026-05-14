import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { api } from '../App';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const fmt$ = n => '$' + (n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(0)+'K' : Math.round(n).toLocaleString());
const RISK_COLORS   = { critical: '#f85149', high: '#f0883e', medium: '#e3b341', low: '#3fb950' };
const TREAT_COLORS  = { mitigate: '#f0883e', accept: '#3fb950', transfer: '#58a6ff', avoid: '#bc8cff' };

export default function Dashboard() {
  const nav = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(console.error);
    const t = setInterval(() => api.get('/dashboard').then(r => setData(r.data)).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;
  if (!data)   return <div className="empty-state"><p>Failed to load dashboard</p></div>;

  const totalOpenRisks = Object.values(data.risks || {}).reduce((a, b) => a + b, 0);
  const criticalRisks  = data.risks?.critical || 0;
  const highRisks      = data.risks?.high     || 0;
  const aleClass       = data.total_ale >= 500000 ? 'ale-high' : data.total_ale >= 100000 ? 'ale-med' : 'ale-low';

  const riskLevelData = Object.entries(data.risks || {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: RISK_COLORS[k],
  }));

  const riskTreatmentData = Object.entries(data.risk_treatment || {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: TREAT_COLORS[k] || 'var(--accent)',
  }));

  const riskTrendMap = {};
  (data.risk_trend || []).forEach(r => {
    const w = format(new Date(r.week), 'MMM dd');
    if (!riskTrendMap[w]) riskTrendMap[w] = { week: w, critical: 0, high: 0, medium: 0, low: 0 };
    riskTrendMap[w][r.risk_level] = parseInt(r.cnt);
  });
  const riskTrendData = Object.values(riskTrendMap);

  const levelColor = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Security Dashboard</div>
          <div className="page-subtitle">Real-time risk posture overview</div>
        </div>
        <span className="text-dim" style={{ fontSize: 12 }}>{format(new Date(), 'MMM d, yyyy HH:mm')}</span>
      </div>

      {/* KPI row */}
      <div className="stat-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => nav('/assets')}>
          <div className="stat-label">Total Assets</div>
          <div className="stat-value">{data.assets?.total || 0}</div>
          <div className="stat-sub">{data.assets?.active || 0} active · {data.critical_assets} critical/high</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => nav('/risks')}>
          <div className="stat-label">Critical Risks</div>
          <div className="stat-value" style={{ color: 'var(--critical)' }}>{criticalRisks}</div>
          <div className="stat-sub">{highRisks} high · {data.risks?.medium || 0} medium</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => nav('/risks')}>
          <div className="stat-label">Total Open Risks</div>
          <div className="stat-value" style={{ color: 'var(--high)' }}>{totalOpenRisks}</div>
          <div className="stat-sub">Across all categories</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => nav('/reports')}>
          <div className="stat-label">Annualised Loss (ALE)</div>
          <div className={`stat-value ${aleClass}`}>{fmt$(data.total_ale || 0)}</div>
          <div className="stat-sub">Expected annual risk exposure</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--critical)' }}>
          <div className="stat-label">Overdue Reviews</div>
          <div className="stat-value" style={{ color: parseInt(data.overdue_risks) > 0 ? 'var(--critical)' : 'var(--low)', fontSize: 28 }}>
            {data.overdue_risks || 0}
          </div>
          <div className="stat-sub">Risks past review date</div>
        </div>
      </div>

      {/* Risk Appetite vs Actuals */}
      {data.risk_appetite && (() => {
        const ap = data.risk_appetite;
        const actualMaxScore = Math.max(...(data.top_open_risks||[]).map(r => r.risk_score || 0), 0);
        const actualCritical = data.risks?.critical || 0;
        const scoreBreached  = actualMaxScore > ap.max_risk_score;
        const aleBreached    = (data.total_ale || 0) > ap.max_ale;
        const critBreached   = actualCritical > ap.max_open_critical;
        const scoreRatio     = ap.max_risk_score > 0 ? Math.min(actualMaxScore / ap.max_risk_score, 1.5) : 0;
        const aleRatio       = ap.max_ale > 0 ? Math.min((data.total_ale || 0) / ap.max_ale, 1.5) : 0;
        const critRatio      = ap.max_open_critical > 0 ? Math.min(actualCritical / ap.max_open_critical, 1.5) : (actualCritical > 0 ? 1.5 : 0);
        const bar = (ratio, breached) => (
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${Math.min(ratio * 100, 100)}%`, borderRadius: 3,
              background: breached ? 'var(--critical)' : ratio > 0.75 ? 'var(--medium)' : 'var(--low)',
              transition: 'width 0.4s ease' }} />
          </div>
        );
        return (
          <div className="card" style={{ marginBottom: 20, borderLeft: `3px solid ${(scoreBreached||aleBreached||critBreached) ? 'var(--critical)' : 'var(--low)'}` }}>
            <div className="flex-between" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Risk Appetite vs Actuals</div>
              <span style={{ fontSize: 11, color: (scoreBreached||aleBreached||critBreached) ? 'var(--critical)' : 'var(--low)', fontWeight: 600 }}>
                {(scoreBreached||aleBreached||critBreached) ? 'APPETITE BREACHED' : 'WITHIN APPETITE'}
              </span>
            </div>
            {ap.notes && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, fontStyle: 'italic' }}>"{ap.notes}"</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>Max Risk Score</span>
                  <span style={{ fontWeight: 700, color: scoreBreached ? 'var(--critical)' : 'var(--text)' }}>
                    {actualMaxScore} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/ {ap.max_risk_score}</span>
                  </span>
                </div>
                {bar(scoreRatio, scoreBreached)}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Highest open risk score vs tolerance</div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>Annualised Loss (ALE)</span>
                  <span style={{ fontWeight: 700, color: aleBreached ? 'var(--critical)' : 'var(--text)' }}>
                    {fmt$(data.total_ale||0)} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/ {fmt$(ap.max_ale)}</span>
                  </span>
                </div>
                {bar(aleRatio, aleBreached)}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Total ALE vs maximum tolerated</div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>Open Critical Risks</span>
                  <span style={{ fontWeight: 700, color: critBreached ? 'var(--critical)' : 'var(--text)' }}>
                    {actualCritical} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/ {ap.max_open_critical} allowed</span>
                  </span>
                </div>
                {bar(critRatio, critBreached)}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{ap.max_open_critical === 0 ? 'Zero-tolerance policy' : 'Max open critical risks'}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Risk treatment row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {['mitigate', 'accept', 'transfer', 'avoid'].map(t => (
          <div key={t} className="stat-card" style={{ borderLeft: `3px solid ${TREAT_COLORS[t]}` }}>
            <div className="stat-label">{t.charAt(0).toUpperCase() + t.slice(1)}</div>
            <div className="stat-value" style={{ color: TREAT_COLORS[t], fontSize: 28 }}>
              {data.risk_treatment?.[t] || 0}
            </div>
            <div className="stat-sub">Open risks</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/risks')}>
          <div className="card-title">Risk Level Distribution <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>— click to view</span></div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={riskLevelData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false} fontSize={11}>
                {riskLevelData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/risks')}>
          <div className="card-title">Risk Treatment Breakdown <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>— click to view</span></div>
          {riskTreatmentData.length === 0 ? (
            <div className="empty-state" style={{ height: 160 }}><p>No open risks yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={riskTreatmentData} margin={{ top: 5, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {riskTreatmentData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-title">Risk by Category</div>
          {!data.risk_by_category?.length ? (
            <div className="empty-state" style={{ height: 160 }}><p>No categorised risks yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.risk_by_category} layout="vertical" margin={{ top: 0, left: 0, right: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12 }} />
                <Bar dataKey="cnt" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Risk Register Trend (8 weeks)</div>
          {riskTrendData.length === 0 ? (
            <div className="empty-state" style={{ height: 160 }}><p>No risk trend data yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={riskTrendData} margin={{ top: 5, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12 }} />
                {['critical', 'high', 'medium', 'low'].map(s => (
                  <Area key={s} type="monotone" dataKey={s} stackId="1"
                    stroke={RISK_COLORS[s]} fill={RISK_COLORS[s]} fillOpacity={0.3} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-title">Top Open Risks</div>
          {!data.top_open_risks?.length ? (
            <div className="empty-state" style={{ height: 160 }}><p>No open risks yet</p></div>
          ) : (
            <table style={{ fontSize: 12 }}>
              <thead><tr><th>Risk</th><th>Level</th><th>Score</th><th>Treatment</th></tr></thead>
              <tbody>
                {data.top_open_risks.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => nav('/risks')}>
                    <td>
                      <span style={{ color: 'var(--text1)' }}>{r.title}</span>
                      {(r.ip_address || r.hostname) && (
                        <div className="mono" style={{ color: 'var(--text3)', fontSize: 10 }}>
                          {r.ip_address || r.hostname}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: levelColor[r.risk_level], fontWeight: 700, textTransform: 'capitalize' }}>
                        {r.risk_level}
                      </span>
                    </td>
                    <td><span style={{ fontWeight: 600 }}>{r.risk_score}</span></td>
                    <td>
                      <span style={{ color: TREAT_COLORS[r.treatment] || 'var(--text2)', textTransform: 'capitalize' }}>
                        {r.treatment || 'mitigate'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent scans */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Recent Scans</div>
          <a href="/scans" style={{ fontSize: 12, color: 'var(--accent-h)', textDecoration: 'none' }}>View all →</a>
        </div>
        {data.recent_scans?.length ? (
          <table>
            <thead><tr><th>Target</th><th>Type</th><th>Status</th><th>Assets</th><th>Vulns</th><th>Time</th></tr></thead>
            <tbody>
              {data.recent_scans.map(s => (
                <tr key={s.id}>
                  <td className="mono">{s.target}</td>
                  <td>{s.scan_type}</td>
                  <td><span className={`status-dot dot-${s.status}`}/>{s.status}</td>
                  <td>{s.assets_found ?? '-'}</td>
                  <td>{s.vulns_found ?? '-'}</td>
                  <td className="text-dim">{format(new Date(s.created_at), 'MMM d HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state"><p>No scans yet</p></div>}
      </div>
    </div>
  );
}
