import React, { useState, useEffect } from 'react';
import { api } from '../App';

const STATUS_COLORS = {
  compliant:     'var(--low)',
  partial:       'var(--medium)',
  non_compliant: 'var(--critical)',
  not_assessed:  'var(--text3)',
};

const STATUS_LABELS = {
  compliant:     'Compliant',
  partial:       'Partial',
  non_compliant: 'Non-Compliant',
  not_assessed:  'Not Assessed',
};

function PostureBar({ compliant, partial, non_compliant, total }) {
  const c = parseInt(compliant) || 0;
  const p = parseInt(partial)   || 0;
  const n = parseInt(non_compliant) || 0;
  const score = total > 0 ? Math.round(((c + p * 0.5) / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg3)', gap: 1 }}>
        {c > 0 && <div style={{ flex: c, background: STATUS_COLORS.compliant }} title={`Compliant: ${c}`} />}
        {p > 0 && <div style={{ flex: p, background: STATUS_COLORS.partial  }} title={`Partial: ${p}`} />}
        {n > 0 && <div style={{ flex: n, background: STATUS_COLORS.non_compliant }} title={`Non-Compliant: ${n}`} />}
        {(total - c - p - n) > 0 && <div style={{ flex: total - c - p - n, background: 'var(--bg3)' }} />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        Posture score: <span style={{ color: score >= 70 ? 'var(--low)' : score >= 40 ? 'var(--medium)' : 'var(--critical)', fontWeight: 600 }}>{score}%</span>
        {' · '}{c} compliant · {p} partial · {n} non-compliant · {total - c - p - n} not assessed
      </div>
    </div>
  );
}

export default function Compliance() {
  const [posture,    setPosture]    = useState(null);
  const [framework,  setFramework]  = useState('NIST_CSF');
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(null);

  useEffect(() => {
    api.get('/compliance/posture')
      .then(r => { setPosture(r.data.frameworks); setLoading(false); })
      .catch(console.error);
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;

  const fw = posture?.[framework];
  const categories = fw ? [...new Set(fw.controls.map(c => c.category))].sort() : [];

  const byCategory = {};
  (fw?.controls || []).forEach(c => {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compliance</div>
          <div className="page-subtitle">NIST CSF 2.0 · ISO 27001:2022 control mapping</div>
        </div>
      </div>

      {/* Framework tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {Object.keys(posture || {}).map(f => (
          <button key={f} className={`tab-btn ${framework === f ? 'active' : ''}`} onClick={() => setFramework(f)}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {fw && (
        <>
          {/* Posture summary card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">{framework.replace('_', ' ')} — Overall Posture</div>
            <PostureBar
              compliant={fw.compliant}
              partial={fw.partial}
              non_compliant={fw.non_compliant}
              total={fw.total}
            />
            <div style={{ display: 'flex', gap: 20 }}>
              {Object.entries(STATUS_COLORS).map(([s, color]) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ color: 'var(--text2)' }}>{STATUS_LABELS[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls by category */}
          {categories.map(cat => (
            <div key={cat} className="card" style={{ marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12 }}>{cat}</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Control ID</th>
                    <th>Control Name</th>
                    <th style={{ width: 120 }}>Mapped Risks</th>
                    <th style={{ width: 140 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory[cat].map(ctrl => {
                    const mapped = parseInt(ctrl.mapped_risks) || 0;
                    const status = parseInt(ctrl.compliant) > 0 ? 'compliant'
                      : parseInt(ctrl.partial) > 0 ? 'partial'
                      : parseInt(ctrl.non_compliant) > 0 ? 'non_compliant'
                      : 'not_assessed';
                    return (
                      <tr key={ctrl.control_id} style={{ cursor: 'pointer' }}
                        onClick={() => setExpanded(expanded === ctrl.control_id ? null : ctrl.control_id)}>
                        <td className="mono" style={{ color: 'var(--info)', fontWeight: 600 }}>{ctrl.control_id}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{ctrl.name}</div>
                          {expanded === ctrl.control_id && (
                            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>
                              {ctrl.description}
                            </div>
                          )}
                        </td>
                        <td className="mono">{mapped > 0 ? <span style={{ color: 'var(--info)' }}>{mapped}</span> : <span className="text-dim">0</span>}</td>
                        <td>
                          <span style={{ color: STATUS_COLORS[status], fontWeight: 600, fontSize: 12 }}>
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
