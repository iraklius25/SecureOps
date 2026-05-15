import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../App';

const TREAT = ['mitigate','accept','transfer','avoid'];

const CATEGORIES = [
  'Technical', 'Operational', 'Compliance', 'Strategic',
  'Third Party', 'Financial', 'Reputational', 'Legal', 'Human',
];

const MAPPING_STATUS = ['not_assessed','partial','compliant','non_compliant'];
const MAPPING_LABELS = {
  not_assessed: 'Not Assessed',
  partial:      'Partial',
  compliant:    'Compliant',
  non_compliant:'Non-Compliant',
};
const MAPPING_COLORS = {
  compliant:     'var(--low)',
  partial:       'var(--medium)',
  non_compliant: 'var(--critical)',
  not_assessed:  'var(--text3)',
};

function scoreColor(s) {
  return s >= 20 ? 'var(--critical)' : s >= 12 ? 'var(--high)' : s >= 6 ? 'var(--medium)' : 'var(--low)';
}

/* ─── Risk Detail Modal ───────────────────────────────── */
function RiskDetailModal({ risk, onClose }) {
  const sc = scoreColor(risk.risk_score);
  const AI_COLORS = { unacceptable:'#ef4444', high:'#f97316', limited:'#f59e0b', minimal:'#10b981' };

  const Field = ({ label, value, mono }) => !value && value !== 0 ? null : (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
                    letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text1)', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.5 }}>{value}</div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ marginBottom: 8 }}>{risk.title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={`risk-score ${risk.risk_score >= 20 ? 'risk-critical' : risk.risk_score >= 12 ? 'risk-high' : risk.risk_score >= 6 ? 'risk-medium' : 'risk-low'}`}>
                {risk.risk_score}
              </div>
              <span className={`badge badge-${risk.risk_level}`}>{risk.risk_level}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>L{risk.likelihood} × I{risk.impact}</span>
              {risk.category && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{risk.category}</span>}
              {risk.status && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{risk.status}</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {risk.description && (
            <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 20,
                          fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, borderLeft: `3px solid ${sc}` }}>
              {risk.description}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
            <div>
              <Field label="Likelihood"  value={`${risk.likelihood} / 5`} />
              <Field label="Impact"      value={`${risk.impact} / 5`} />
              <Field label="Risk Score"  value={`${risk.risk_score} / 25`} />
              <Field label="Risk Level"  value={risk.risk_level?.toUpperCase()} />
              <Field label="Treatment"   value={risk.treatment} />
            </div>
            <div>
              <Field label="Category"   value={risk.category} />
              <Field label="Owner"      value={risk.owner} />
              <Field label="Review Date" value={risk.review_date ? new Date(risk.review_date).toLocaleDateString('en-GB') : null} />
              <Field label="Asset"      value={risk.ip_address || risk.hostname} mono />
              <Field label="Created"    value={risk.created_at ? new Date(risk.created_at).toLocaleDateString('en-GB') : null} />
            </div>
          </div>

          {risk.notes && (
            <div style={{ marginTop: 4 }}>
              <Field label="Notes" value={risk.notes} />
            </div>
          )}

          {risk.eu_ai_act_tier && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8,
                          background: `${AI_COLORS[risk.eu_ai_act_tier]}15`,
                          border: `1px solid ${AI_COLORS[risk.eu_ai_act_tier]}40` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: AI_COLORS[risk.eu_ai_act_tier] }}>
                EU AI Act — {risk.eu_ai_act_tier.charAt(0).toUpperCase() + risk.eu_ai_act_tier.slice(1)} risk tier
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Compliance Controls Modal ───────────────────────── */
function RiskControlsModal({ risk, onClose }) {
  const [mapped,    setMapped]    = useState([]);
  const [allCtrls,  setAllCtrls]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState('');
  const [addCtrlId, setAddCtrlId] = useState('');
  const [addStatus, setAddStatus] = useState('not_assessed');
  const [addNotes,  setAddNotes]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [saveErr,   setSaveErr]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const [m, all] = await Promise.all([
        api.get(`/compliance/risks/${risk.id}/controls`),
        api.get('/compliance/controls'),
      ]);
      setMapped(m.data);
      setAllCtrls(all.data);
      const mappedIds = new Set(m.data.map(c => c.id));
      const first = all.data.find(c => !mappedIds.has(c.id));
      setAddCtrlId(first?.id || '');
    } catch (e) {
      setLoadErr(e.response?.data?.error || 'Failed to load controls');
    } finally { setLoading(false); }
  }, [risk.id]);

  useEffect(() => { load(); }, [load]);

  const mappedIds = new Set(mapped.map(c => c.id));
  const unmapped  = allCtrls.filter(c => !mappedIds.has(c.id));

  const addMapping = async () => {
    if (!addCtrlId) return;
    setSaving(true); setSaveErr('');
    try {
      await api.post(`/compliance/risks/${risk.id}/controls`, {
        control_id: addCtrlId,
        status: addStatus,
        notes: addNotes,
      });
      setAddNotes('');
      await load();
    } catch (e) {
      setSaveErr(e.response?.data?.error || 'Failed to add control mapping');
    } finally { setSaving(false); }
  };

  const removeMapping = async (controlId) => {
    await api.delete(`/compliance/risks/${risk.id}/controls/${controlId}`);
    load();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h2>Compliance Controls</h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              <span style={{ color: scoreColor(risk.risk_score), fontWeight: 700 }}>{risk.risk_score}</span>
              {' '}· {risk.title}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{loadErr}</div>}
          {saveErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{saveErr}</div>}
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                Mapped Controls ({mapped.length})
              </div>

              {mapped.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, padding: '10px 0' }}>
                  No controls mapped yet. Use the form below to add one.
                </div>
              ) : (
                <table style={{ marginBottom: 20 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Control ID</th>
                      <th>Name</th>
                      <th style={{ width: 80 }}>Framework</th>
                      <th style={{ width: 120 }}>Status</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.map(ctrl => (
                      <tr key={ctrl.id}>
                        <td className="mono" style={{ color: 'var(--info)', fontWeight: 600, fontSize: 11 }}>
                          {ctrl.control_id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 12 }}>{ctrl.name}</div>
                          {ctrl.mapping_notes && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{ctrl.mapping_notes}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {ctrl.framework?.replace('_',' ')}
                        </td>
                        <td>
                          <span style={{ color: MAPPING_COLORS[ctrl.mapping_status] || 'var(--text3)', fontWeight: 600, fontSize: 11 }}>
                            {MAPPING_LABELS[ctrl.mapping_status] || ctrl.mapping_status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => removeMapping(ctrl.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}
                            title="Remove mapping"
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                  + Add Control Mapping
                </div>

                {unmapped.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>All available controls are already mapped to this risk.</div>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label>Control</label>
                      <select value={addCtrlId} onChange={e => setAddCtrlId(e.target.value)}>
                        {unmapped.map(c => (
                          <option key={c.id} value={c.id}>
                            [{c.framework?.replace('_',' ')}] {c.control_id} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row" style={{ marginBottom: 10 }}>
                      <div className="form-group">
                        <label>Compliance Status</label>
                        <select value={addStatus} onChange={e => setAddStatus(e.target.value)}>
                          {MAPPING_STATUS.map(s => (
                            <option key={s} value={s}>{MAPPING_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Notes (optional)</label>
                        <input
                          value={addNotes}
                          onChange={e => setAddNotes(e.target.value)}
                          placeholder="Evidence, action item..."
                        />
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={addMapping}
                      disabled={!addCtrlId || saving}
                    >
                      {saving ? 'Adding…' : 'Add Mapping'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Risk Heatmap ────────────────────────────────────── */
function RiskHeatmap({ risks }) {
  const [selectedCell, setSelectedCell] = useState(null); // {l, i}

  const cellColor = (l, i) => {
    const score = l * i;
    return score >= 20 ? 'rgba(239,68,68,0.75)' :
           score >= 12 ? 'rgba(249,115,22,0.75)' :
           score >= 6  ? 'rgba(234,179,8,0.75)'  :
                         'rgba(34,197,94,0.55)';
  };

  const cellLabel = (l, i) => {
    const score = l * i;
    return score >= 20 ? 'Critical' : score >= 12 ? 'High' : score >= 6 ? 'Medium' : 'Low';
  };

  const risksInCell = (l, i) => risks.filter(r => r.likelihood == l && r.impact == i);

  const selectedRisks = selectedCell ? risksInCell(selectedCell.l, selectedCell.i) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Matrix */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
            Impact →
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Y axis label */}
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, color: 'var(--text3)', userSelect: 'none' }}>
              Likelihood ↑
            </div>
            <div>
              {/* X axis: impact 1-5, Y axis: likelihood 5-1 */}
              {/* Header row */}
              <div style={{ display: 'flex', marginBottom: 2 }}>
                <div style={{ width: 24, flexShrink: 0 }} />
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ width: 80, textAlign: 'center', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{i}</div>
                ))}
              </div>
              {[5,4,3,2,1].map(l => (
                <div key={l} style={{ display: 'flex', marginBottom: 2, alignItems: 'center' }}>
                  <div style={{ width: 24, fontSize: 11, color: 'var(--text3)', fontWeight: 600, flexShrink: 0, textAlign: 'right', paddingRight: 4 }}>{l}</div>
                  {[1,2,3,4,5].map(i => {
                    const inCell = risksInCell(l, i);
                    const isSelected = selectedCell?.l === l && selectedCell?.i === i;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedCell(isSelected ? null : { l, i })}
                        title={`L${l} × I${i} = ${l*i} (${cellLabel(l,i)})\n${inCell.map(r=>r.title).join(', ')}`}
                        style={{
                          width: 80, height: 60,
                          background: cellColor(l, i),
                          border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          margin: '0 2px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: inCell.length > 0 ? 'pointer' : 'default',
                          position: 'relative',
                          transition: 'transform 0.1s',
                          transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{l*i}</div>
                        {inCell.length > 0 && (
                          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 70 }}>
                            {inCell.slice(0, 6).map(r => (
                              <div
                                key={r.id}
                                title={r.title}
                                style={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  background: 'rgba(255,255,255,0.85)',
                                  flexShrink: 0,
                                }}
                              />
                            ))}
                            {inCell.length > 6 && (
                              <div style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>+{inCell.length-6}</div>
                            )}
                          </div>
                        )}
                        {inCell.length === 0 && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Critical (≥20)', color: 'rgba(239,68,68,0.75)' },
              { label: 'High (≥12)', color: 'rgba(249,115,22,0.75)' },
              { label: 'Medium (≥6)', color: 'rgba(234,179,8,0.75)' },
              { label: 'Low (<6)', color: 'rgba(34,197,94,0.55)' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected cell detail */}
        {selectedCell && (
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              L{selectedCell.l} × I{selectedCell.i} = {selectedCell.l * selectedCell.i}
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                {selectedRisks.length} risk{selectedRisks.length !== 1 ? 's' : ''}
              </span>
            </div>
            {selectedRisks.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No risks in this cell.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedRisks.map(r => (
                  <div key={r.id} style={{
                    padding: '10px 12px',
                    background: 'var(--bg3)',
                    borderRadius: 'var(--radius)',
                    borderLeft: `3px solid ${scoreColor(r.risk_score)}`,
                  }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>Score: <strong style={{ color: scoreColor(r.risk_score) }}>{r.risk_score}</strong></span>
                      <span>Treatment: {r.treatment}</span>
                      {r.ip_address && <span className="mono">{r.ip_address}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Risks Page ─────────────────────────────────── */
export function Risks() {
  const [risks,       setRisks]       = useState([]);
  const [modal,       setModal]       = useState(false);
  const [detailRisk,  setDetailRisk]  = useState(null);
  const [ctrlRisk,    setCtrlRisk]    = useState(null);
  const [tab,         setTab]         = useState('list'); // 'list' | 'heatmap'
  const [form,        setForm]        = useState({
    title:'', description:'', category:'',
    likelihood:3, impact:3, treatment:'mitigate',
  });
  const [loading,    setLoading]    = useState(true);
  const [appetite,   setAppetite]   = useState(null);
  const [filterCat,  setFilterCat]  = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = useCallback(() => {
    api.get('/risks').then(r => { setRisks(r.data); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/issc/appetite').then(r => setAppetite(r.data)).catch(() => {});
  }, []);

  const appetiteStatus = score => {
    if (!appetite || score == null) return null;
    const ap  = appetite.max_risk_score  ?? 12;
    const tol = appetite.tolerance_score ?? 15;
    if (score <= ap)  return { label: 'Within Appetite',  color: '#10b981', bg: '#10b98120' };
    if (score <= tol) return { label: 'Within Tolerance', color: '#f59e0b', bg: '#f59e0b20' };
    return              { label: 'Exceeds Tolerance',  color: '#ef4444', bg: '#ef444420' };
  };

  const submit = async e => {
    e.preventDefault();
    await api.post('/risks', form);
    setModal(false); load();
  };

  const update = async (id, patch) => { await api.patch(`/risks/${id}`, patch); load(); };

  const scoreColorClass = s => s >= 20 ? 'risk-critical' : s >= 12 ? 'risk-high' : s >= 6 ? 'risk-medium' : 'risk-low';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Risk Register</div>
          <div className="page-subtitle">{risks.filter(r => r.status === 'open').length} open risks</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Risk</button>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>List View</button>
        <button className={`tab-btn ${tab === 'heatmap' ? 'active' : ''}`} onClick={() => setTab('heatmap')}>Heatmap</button>
      </div>

      {tab === 'heatmap' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Risk Heatmap (5×5 Matrix)</div>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : (
            <RiskHeatmap risks={risks.filter(r => r.status === 'open')} />
          )}
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="filter-bar">
            <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : risks.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📋</div><p>No risks registered</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Score</th><th>Risk</th><th>Category</th>
                    <th>L</th><th>I</th><th>Level</th><th>Appetite</th>
                    <th>AI Act</th><th>Treatment</th><th>Asset</th><th>Status</th><th>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.filter(r =>
                    (!filterCat    || (r.category || '') === filterCat) &&
                    (!filterStatus || (r.status   || 'open') === filterStatus)
                  ).map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetailRisk(r)}
                      title="Click to view risk details">
                      <td><div className={`risk-score ${scoreColorClass(r.risk_score)}`}>{r.risk_score}</div></td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontWeight: 500 }}>{r.title}</div>
                        {r.description && (
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      <td className="text-muted">{r.category || '—'}</td>
                      <td className="mono">{r.likelihood}</td>
                      <td className="mono">{r.impact}</td>
                      <td><span className={`badge badge-${r.risk_level}`}>{r.risk_level}</span></td>
                      <td>
                        {(() => {
                          const st = appetiteStatus(r.risk_score);
                          if (!st) return <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>;
                          return <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:10, background:st.bg, color:st.color, whiteSpace:'nowrap' }}>{st.label}</span>;
                        })()}
                      </td>
                      <td>
                        {r.eu_ai_act_tier ? (
                          <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap',
                            background: r.eu_ai_act_tier==='unacceptable'?'#ef444420':r.eu_ai_act_tier==='high'?'#f9731620':r.eu_ai_act_tier==='limited'?'#f59e0b20':'#10b98120',
                            color: r.eu_ai_act_tier==='unacceptable'?'#ef4444':r.eu_ai_act_tier==='high'?'#f97316':r.eu_ai_act_tier==='limited'?'#f59e0b':'#10b981' }}>
                            {r.eu_ai_act_tier}
                          </span>
                        ) : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          value={r.treatment}
                          onChange={e => update(r.id, { treatment: e.target.value })}
                          style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:'var(--radius)', padding:'3px 6px', fontSize:12, fontFamily:'inherit' }}
                        >
                          {TREAT.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="mono" style={{ color: 'var(--info)', fontSize: 12 }}>{r.ip_address || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select
                          value={r.status || 'open'}
                          onChange={e => update(r.id, { status: e.target.value })}
                          style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:'var(--radius)', padding:'3px 6px', fontSize:12, fontFamily:'inherit' }}
                        >
                          {['open','in_progress','closed'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCtrlRisk(r)}
                          title="Map compliance controls"
                        >
                          🛡 Controls
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </>
      )}

      {/* ── Add Risk Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Add Risk</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title *</label>
                  <input value={form.title} onChange={set('title')} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={set('category')}>
                    <option value="">— Select category —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={form.description} onChange={set('description')} rows={2} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Likelihood (1–5)</label>
                    <input type="number" min="1" max="5" value={form.likelihood} onChange={set('likelihood')} />
                  </div>
                  <div className="form-group">
                    <label>Impact (1–5)</label>
                    <input type="number" min="1" max="5" value={form.impact} onChange={set('impact')} />
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', padding:'8px 12px', borderRadius:'var(--radius)', fontSize:13, marginBottom:12 }}>
                  Risk Score: <strong>{form.likelihood * form.impact}</strong> / 25
                </div>
                <div className="form-group">
                  <label>Treatment</label>
                  <select value={form.treatment} onChange={set('treatment')}>
                    {TREAT.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>EU AI Act Tier <span style={{ fontWeight:400, color:'var(--text3)', fontSize:11 }}>(if this is an AI-related risk)</span></label>
                  <select value={form.eu_ai_act_tier || ''} onChange={set('eu_ai_act_tier')}>
                    <option value="">— Not applicable —</option>
                    <option value="unacceptable">Unacceptable risk</option>
                    <option value="high">High risk</option>
                    <option value="limited">Limited risk</option>
                    <option value="minimal">Minimal risk</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Risk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Risk Detail Modal ── */}
      {detailRisk && (
        <RiskDetailModal risk={detailRisk} onClose={() => setDetailRisk(null)} />
      )}

      {/* ── Compliance Controls Modal ── */}
      {ctrlRisk && (
        <RiskControlsModal risk={ctrlRisk} onClose={() => setCtrlRisk(null)} />
      )}
    </div>
  );
}

export default Risks;
