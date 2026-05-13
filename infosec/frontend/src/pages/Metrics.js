import React, { useEffect, useState, useContext } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { format } from 'date-fns';
import { api, AuthContext } from '../App';

// ── Helpers ───────────────────────────────────────────────────

const fmt$ = n =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M`
  : n >= 1000  ? `$${(n / 1000).toFixed(0)}K`
  : `$${Math.round(n).toLocaleString()}`;

const fmtVal = (val, unit) => {
  if (val === null || val === undefined) return '—';
  if (unit === '$')    return fmt$(val);
  if (unit === '%')    return `${val}%`;
  if (unit === 'days') return `${val}d`;
  return String(val);
};

const RAG = {
  green: { bg: 'rgba(63,185,80,0.12)',  border: '#3fb950', text: '#3fb950',  label: 'On Target' },
  amber: { bg: 'rgba(227,179,65,0.12)', border: '#e3b341', text: '#e3b341',  label: 'Warning'   },
  red:   { bg: 'rgba(248,81,73,0.12)',  border: '#f85149', text: '#f85149',  label: 'Critical'  },
  grey:  { bg: 'rgba(139,148,158,0.1)', border: '#8b949e', text: '#8b949e',  label: 'No Data'   },
};

const SEV = { green: '#3fb950', amber: '#e3b341', red: '#f85149', grey: '#8b949e' };

function RagBadge({ status }) {
  const c = RAG[status] || RAG.grey;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`, textTransform: 'uppercase',
    }}>{c.label}</span>
  );
}

function TrendSparkline({ data }) {
  if (!data?.length) return <span style={{ fontSize: 11, color: 'var(--text3)' }}>No history</span>;
  const pts = data.map(d => ({ d: format(new Date(d.day), 'MMM d'), v: Number(d.val) }));
  return (
    <ResponsiveContainer width={120} height={36}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke="var(--accent-h)" strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 10 }}
          formatter={v => [v]} labelFormatter={l => l}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCard({ m, onEdit, canEdit }) {
  const c    = RAG[m.status] || RAG.grey;
  const isUp = m.trend?.length >= 2 &&
    m.trend[m.trend.length - 1].val > m.trend[m.trend.length - 2].val;
  const trendColor = m.direction === 'lower'
    ? (isUp ? '#f85149' : '#3fb950')
    : (isUp ? '#3fb950' : '#f85149');
  const arrow = m.trend?.length >= 2
    ? (isUp ? '↑' : '↓') : '';

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius)', padding: '16px 18px',
      borderLeft: `4px solid ${c.border}`, position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1, paddingRight: 8 }}>
          {m.label}
        </div>
        <RagBadge status={m.status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>
          {fmtVal(m.value, m.unit)}
        </div>
        {arrow && (
          <span style={{ fontSize: 14, fontWeight: 700, color: trendColor }}>{arrow}</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          Target: <strong style={{ color: 'var(--text2)' }}>{fmtVal(m.target_value, m.unit)}</strong>
          &nbsp;·&nbsp;
          Warn: <strong style={{ color: '#e3b341' }}>{fmtVal(m.warning_threshold, m.unit)}</strong>
          &nbsp;·&nbsp;
          Crit: <strong style={{ color: '#f85149' }}>{fmtVal(m.critical_threshold, m.unit)}</strong>
        </div>
      </div>

      <TrendSparkline data={m.trend} />

      {m.description && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
          {m.description}
        </div>
      )}

      {canEdit && (
        <button onClick={() => onEdit(m)}
          style={{ marginTop: 10, fontSize: 11, color: 'var(--accent-h)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Edit thresholds
        </button>
      )}
    </div>
  );
}

function SummaryGauge({ label, red, amber, green, total, color }) {
  const pct = total ? Math.round((green / total) * 100) : 0;
  const data = [{ name: 'score', value: pct }];
  return (
    <div style={{ textAlign: 'center' }}>
      <RadialBarChart width={100} height={100} cx={50} cy={50} innerRadius={30} outerRadius={46}
        startAngle={90} endAngle={-270} data={data}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar background={{ fill: 'var(--bg3)' }} dataKey="value" fill={color} cornerRadius={6} />
      </RadialBarChart>
      <div style={{ marginTop: -8, fontSize: 22, fontWeight: 700, color }}>{pct}%</div>
      <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
        <span style={{ color: '#f85149' }}>{red} red</span>
        {' · '}
        <span style={{ color: '#e3b341' }}>{amber} amber</span>
        {' · '}
        <span style={{ color: '#3fb950' }}>{green} green</span>
      </div>
    </div>
  );
}

function ThresholdModal({ metric, onClose, onSave }) {
  const [form, setForm] = useState({
    target_value:       metric.target_value ?? '',
    warning_threshold:  metric.warning_threshold ?? '',
    critical_threshold: metric.critical_threshold ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      await api.patch(`/metrics/thresholds/${metric.metric_key}`, {
        target_value:       form.target_value       !== '' ? Number(form.target_value)       : null,
        warning_threshold:  form.warning_threshold  !== '' ? Number(form.warning_threshold)  : null,
        critical_threshold: form.critical_threshold !== '' ? Number(form.critical_threshold) : null,
      });
      onSave();
      onClose();
    } catch (ex) { setErr(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Edit Thresholds — {metric.label}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Unit: <strong>{metric.unit || 'count'}</strong> &nbsp;·&nbsp;
              Direction: <strong>{metric.direction === 'lower' ? 'Lower is better' : 'Higher is better'}</strong>
            </div>
            {[
              { key: 'target_value',       label: 'Target (green zone)', color: '#3fb950' },
              { key: 'warning_threshold',  label: 'Warning threshold (amber zone)', color: '#e3b341' },
              { key: 'critical_threshold', label: 'Critical threshold (red zone)',  color: '#f85149' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label style={{ color: f.color }}>{f.label}</label>
                <input
                  type="number" step="any"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="Enter value"
                />
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function Metrics() {
  const { user }               = useContext(AuthContext);
  const [data, setData]        = useState(null);
  const [loading, setLoading]  = useState(true);
  const [tab, setTab]          = useState('overview');
  const [editMetric, setEdit]  = useState(null);
  const canEdit = user?.role === 'admin';

  const load = () => {
    setLoading(true);
    api.get('/metrics').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!data)   return <div className="empty-state"><p>Failed to load metrics</p></div>;

  const { metrics, linkage, summary } = data;
  const kris = metrics.filter(m => m.metric_type === 'kri');
  const kpis = metrics.filter(m => m.metric_type === 'kpi');

  // Build lookup for linkage table
  const mByKey = Object.fromEntries(metrics.map(m => [m.metric_key, m]));

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'kri',      label: `KRIs (${kris.length})` },
    { id: 'kpi',      label: `KPIs (${kpis.length})` },
    { id: 'linkage',  label: 'KRI–KPI Linkage' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">KPI &amp; KRI Metrics</div>
          <div className="page-subtitle">
            Technology risk performance indicators — ISACA COBIT 5 for Risk framework
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }}
              onClick={async () => {
                await api.post('/metrics/snapshot');
                load();
              }}>
              Save Snapshot
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>
            {format(new Date(), 'MMM d, yyyy HH:mm')}
          </span>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>
          <SummaryGauge label="KRIs On Target" red={summary.kri_red} amber={summary.kri_amber} green={summary.kri_green} total={summary.total_kris} color="#3fb950" />
        </div>
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>
          <SummaryGauge label="KPIs On Target" red={summary.kpi_red} amber={summary.kpi_amber} green={summary.kpi_green} total={summary.total_kpis} color="#3b82f6" />
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f85149' }}>
          <div className="stat-label">KRIs in Red Zone</div>
          <div className="stat-value" style={{ color: summary.kri_red > 0 ? '#f85149' : '#3fb950' }}>{summary.kri_red}</div>
          <div className="stat-sub">{summary.kri_amber} in warning</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f85149' }}>
          <div className="stat-label">KPIs Below Target</div>
          <div className="stat-value" style={{ color: summary.kpi_red > 0 ? '#f85149' : '#3fb950' }}>{summary.kpi_red}</div>
          <div className="stat-sub">{summary.kpi_amber} in warning</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--accent-h)' : 'var(--text2)',
              borderBottom: tab === t.id ? '2px solid var(--accent-h)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong>Key Risk Indicators (KRIs)</strong> signal that the organisation is approaching or exceeding its risk appetite.&nbsp;
            <strong>Key Performance Indicators (KPIs)</strong> measure how effectively the security programme is operating.&nbsp;
            Linking them reveals the business impact of risk management performance — per the ISACA COBIT&nbsp;5 for Risk framework.
          </div>

          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key Risk Indicators
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
            {kris.map(m => <MetricCard key={m.metric_key} m={m} onEdit={setEdit} canEdit={canEdit} />)}
          </div>

          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key Performance Indicators
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {kpis.map(m => <MetricCard key={m.metric_key} m={m} onEdit={setEdit} canEdit={canEdit} />)}
          </div>
        </div>
      )}

      {/* KRI tab */}
      {tab === 'kri' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
            KRIs are <em>leading</em> indicators — they warn that the organisation is approaching or has exceeded its risk appetite,
            enabling proactive action before an incident occurs (COBIT&nbsp;5 for Risk).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {kris.map(m => <MetricCard key={m.metric_key} m={m} onEdit={setEdit} canEdit={canEdit} />)}
          </div>
        </div>
      )}

      {/* KPI tab */}
      {tab === 'kpi' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
            KPIs are <em>lagging</em> indicators — they measure the effectiveness of the security programme and inform management
            decisions on resource allocation and process improvement.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {kpis.map(m => <MetricCard key={m.metric_key} m={m} onEdit={setEdit} canEdit={canEdit} />)}
          </div>
        </div>
      )}

      {/* Linkage tab */}
      {tab === 'linkage' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
            Linking KRIs to KPIs enables business managers to appreciate the relationship between risk and business performance.
            It helps gain business buy-in for investment in risk mitigation measures and supports cross-functional collaboration
            — per the ISACA COBIT&nbsp;5 for Risk framework (Figure 2).
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '26%' }}>
                    Key Risk Indicator (KRI)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '8%' }}>
                    KRI Status
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '26%' }}>
                    Linked KPI
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '8%' }}>
                    KPI Status
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                    Business Impact
                  </th>
                </tr>
              </thead>
              <tbody>
                {linkage.map((lnk, i) => {
                  const kri = mByKey[lnk.kri];
                  const kpi = mByKey[lnk.kpi];
                  if (!kri || !kpi) return null;
                  const rowBg = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.06)';
                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{kri.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: SEV[kri.status] }}>
                          {fmtVal(kri.value, kri.unit)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        <RagBadge status={kri.status} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{kpi.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: SEV[kpi.status] }}>
                          {fmtVal(kpi.value, kpi.unit)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center', verticalAlign: 'middle' }}>
                        <RagBadge status={kpi.status} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', verticalAlign: 'middle', lineHeight: 1.5 }}>
                        {lnk.impact}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editMetric && (
        <ThresholdModal metric={editMetric} onClose={() => setEdit(null)} onSave={load} />
      )}
    </div>
  );
}
