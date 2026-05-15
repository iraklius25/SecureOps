import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { api, AuthContext } from '../App';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, ResponsiveContainer, Dot,
} from 'recharts';

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

/* ─── Risk Detail Modal (tabbed: Details / Controls / History) ── */
function RiskDetailModal({ risk: initialRisk, initialTab = 'details', onClose, onSaved, appetite }) {
  const overlayRef     = useRef(null);
  const mouseDownOnBg  = useRef(false);
  const [tab,     setTab]     = useState(initialTab);
  const [risk,    setRisk]    = useState(initialRisk);
  const [editMode, setEditMode] = useState(false);
  const [form,    setForm]    = useState({ ...initialRisk });
  const [changeNote, setChangeNote] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Controls state
  const [mapped,    setMapped]    = useState([]);
  const [allCtrls,  setAllCtrls]  = useState([]);
  const [ctrlLoad,  setCtrlLoad]  = useState(false);
  const [ctrlLoaded, setCtrlLoaded] = useState(false);
  const [addCtrlId, setAddCtrlId] = useState('');
  const [addStatus, setAddStatus] = useState('not_assessed');
  const [addNotes,  setAddNotes]  = useState('');
  const [ctrlSaving, setCtrlSaving] = useState(false);
  const [ctrlErr,   setCtrlErr]   = useState('');

  // History state
  const [history,   setHistory]   = useState([]);
  const [histLoad,  setHistLoad]  = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);

  const AI_COLORS = { unacceptable:'#ef4444', high:'#f97316', limited:'#f59e0b', minimal:'#10b981' };

  // Live preview values — update in real-time while editing L/I
  const previewScore = editMode ? (parseInt(form.likelihood) || 1) * (parseInt(form.impact) || 1) : risk.risk_score;
  const previewLevel = previewScore >= 20 ? 'critical' : previewScore >= 12 ? 'high' : previewScore >= 6 ? 'medium' : 'low';
  const displayScore = editMode ? previewScore : risk.risk_score;
  const displayLevel = editMode ? previewLevel : risk.risk_level;

  const appetiteStatus = score => {
    if (!appetite || score == null) return null;
    const ap  = appetite.max_risk_score  ?? 12;
    const tol = appetite.tolerance_score ?? 15;
    if (score <= ap)  return { label: 'Within Appetite',  color: '#10b981', bg: '#10b98120' };
    if (score <= tol) return { label: 'Within Tolerance', color: '#f59e0b', bg: '#f59e0b20' };
    return              { label: 'Exceeds Tolerance',  color: '#ef4444', bg: '#ef444420' };
  };
  const apStatus = appetiteStatus(displayScore);

  const sc = scoreColor(risk.risk_score);

  const Field = ({ label, value, mono }) => !value && value !== 0 ? null : (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text1)', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.5 }}>{value}</div>
    </div>
  );

  const loadControls = useCallback(async () => {
    setCtrlLoad(true); setCtrlErr('');
    try {
      const [m, all] = await Promise.all([
        api.get(`/compliance/risks/${risk.id}/controls`),
        api.get('/compliance/controls'),
      ]);
      setMapped(m.data);
      setAllCtrls(all.data);
      const ids = new Set(m.data.map(c => c.id));
      setAddCtrlId(all.data.find(c => !ids.has(c.id))?.id || '');
      setCtrlLoaded(true);
    } catch (e) { setCtrlErr(e.response?.data?.error || 'Failed to load controls'); }
    finally { setCtrlLoad(false); }
  }, [risk.id]);

  const loadHistory = useCallback(async () => {
    setHistLoad(true);
    try {
      const r = await api.get(`/risks/${risk.id}/history`);
      setHistory(r.data);
      setHistLoaded(true);
    } catch (e) {}
    finally { setHistLoad(false); }
  }, [risk.id]);

  useEffect(() => {
    if (tab === 'controls' && !ctrlLoaded) loadControls();
    if (tab === 'history'  && !histLoaded) loadHistory();
  }, [tab, ctrlLoaded, histLoaded, loadControls, loadHistory]);

  const save = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const payload = {
        title:         form.title,
        description:   form.description,
        category:      form.category,
        likelihood:    Math.min(5, Math.max(1, parseInt(form.likelihood) || 1)),
        impact:        Math.min(5, Math.max(1, parseInt(form.impact)     || 1)),
        treatment:     form.treatment,
        status:        form.status,
        owner:         form.owner,
        review_date:   form.review_date ? form.review_date.slice(0, 10) : null,
        eu_ai_act_tier: form.eu_ai_act_tier || null,
        notes:         form.notes,
        change_note:   changeNote || null,
      };
      const r = await api.patch(`/risks/${risk.id}`, payload);
      setRisk(r.data);
      setForm(r.data);
      setChangeNote('');
      setSaveMsg('Saved');
      setEditMode(false);
      setHistLoaded(false); // force history reload
      onSaved && onSaved(r.data);
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (ex) { setSaveMsg(ex.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const addMapping = async () => {
    if (!addCtrlId) return;
    setCtrlSaving(true); setCtrlErr('');
    try {
      await api.post(`/compliance/risks/${risk.id}/controls`, { control_id: addCtrlId, status: addStatus, notes: addNotes });
      setAddNotes('');
      setCtrlLoaded(false);
      await loadControls();
    } catch (e) { setCtrlErr(e.response?.data?.error || 'Failed to add'); }
    finally { setCtrlSaving(false); }
  };

  const removeMapping = async ctrlId => {
    await api.delete(`/compliance/risks/${risk.id}/controls/${ctrlId}`);
    setCtrlLoaded(false);
    loadControls();
  };

  const mappedIds = new Set(mapped.map(c => c.id));
  const unmapped  = allCtrls.filter(c => !mappedIds.has(c.id));

  // History chart
  const histChart = history.map((h, i) => ({
    idx:    i + 1,
    score:  h.risk_score,
    level:  h.risk_level,
    date:   new Date(h.changed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
    note:   h.change_note,
    who:    h.changed_by_name,
    treat:  h.treatment,
    status: h.status,
  }));

  const levelColor = l => l === 'critical' ? '#ef4444' : l === 'high' ? '#f97316' : l === 'medium' ? '#eab308' : '#22c55e';

  const CustomDot = ({ cx, cy, payload }) => (
    <circle cx={cx} cy={cy} r={5} fill={levelColor(payload.level)} stroke="#fff" strokeWidth={1.5} />
  );

  const TABS = [
    { key: 'details',  label: 'Details' },
    { key: 'controls', label: `Controls${mapped.length > 0 ? ` (${mapped.length})` : ''}` },
    { key: 'history',  label: `History${history.length > 0 ? ` (${history.length})` : ''}` },
  ];

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onMouseDown={e => { mouseDownOnBg.current = e.target === overlayRef.current; }}
      onClick={e => { if (mouseDownOnBg.current && e.target === overlayRef.current) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <div className={`risk-score ${displayScore >= 20 ? 'risk-critical' : displayScore >= 12 ? 'risk-high' : displayScore >= 6 ? 'risk-medium' : 'risk-low'}`}
                style={{ transition: 'background 0.2s' }}>{displayScore}</div>
              <span className={`badge badge-${displayLevel}`} style={{ transition: 'background 0.2s' }}>{displayLevel}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                L{editMode ? (form.likelihood || 1) : risk.likelihood} × I{editMode ? (form.impact || 1) : risk.impact}
              </span>
              {apStatus && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                               background: apStatus.bg, color: apStatus.color, transition: 'all 0.2s' }}>
                  {apStatus.label}
                </span>
              )}
              {risk.category && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{risk.category}</span>}
              {risk.status  && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{risk.status}</span>}
            </div>
            <h2 style={{ marginBottom: 0 }}>{risk.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 24, flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text3)',
              fontWeight: tab === t.key ? 600 : 400, marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <div>
              {saveMsg && <div className={`alert ${saveMsg === 'Saved' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>{saveMsg}</div>}

              {!editMode && risk.description && (
                <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 16,
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, borderLeft: `3px solid ${sc}` }}>
                  {risk.description}
                </div>
              )}

              {editMode ? (
                <div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Title</label>
                    <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Description</label>
                    <textarea rows={3} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                        <option value="">— None —</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select value={form.status || 'open'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                        {['open','in_progress','closed'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label>Likelihood (1–5)</label>
                      <input
                        type="number" min="1" max="5"
                        value={form.likelihood ?? 1}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onChange={e => {
                          const v = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                          setForm(p => ({ ...p, likelihood: v }));
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Impact (1–5)</label>
                      <input
                        type="number" min="1" max="5"
                        value={form.impact ?? 1}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        onChange={e => {
                          const v = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                          setForm(p => ({ ...p, impact: v }));
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ background: previewScore >= 20 ? '#ef444418' : previewScore >= 12 ? '#f9731618' : previewScore >= 6 ? '#eab30818' : '#22c55e18',
                                border: `1px solid ${scoreColor(previewScore)}40`, padding: '7px 12px', borderRadius: 6, fontSize: 13, marginBottom: 10, transition: 'all 0.2s' }}>
                    Risk score: <strong style={{ color: scoreColor(previewScore) }}>{previewScore}</strong> / 25 —&nbsp;
                    <strong style={{ color: scoreColor(previewScore) }}>{displayLevel}</strong>
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label>Treatment</label>
                      <select value={form.treatment || 'mitigate'} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))}>
                        {TREAT.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>EU AI Act Tier</label>
                      <select value={form.eu_ai_act_tier || ''} onChange={e => setForm(p => ({ ...p, eu_ai_act_tier: e.target.value }))}>
                        <option value="">— Not applicable —</option>
                        <option value="unacceptable">Unacceptable</option>
                        <option value="high">High</option>
                        <option value="limited">Limited</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label>Owner</label>
                      <input value={form.owner || ''} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))} placeholder="Risk owner" />
                    </div>
                    <div className="form-group">
                      <label>Review Date</label>
                      <input type="date" value={form.review_date ? form.review_date.slice(0, 10) : ''} onChange={e => setForm(p => ({ ...p, review_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label>Notes</label>
                    <textarea rows={2} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, padding: '12px', background: 'var(--bg3)', borderRadius: 8, borderLeft: '3px solid var(--accent)' }}>
                    <label>Change note <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>(describe what action was taken — shown in history)</span></label>
                    <input value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder="e.g. Applied firewall rule, updated patch policy, transferred to insurer…" />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
                    <div>
                      <Field label="Likelihood" value={`${risk.likelihood} / 5`} />
                      <Field label="Impact"     value={`${risk.impact} / 5`} />
                      <Field label="Risk Score" value={`${risk.risk_score} / 25`} />
                      <Field label="Risk Level" value={risk.risk_level?.toUpperCase()} />
                      <Field label="Treatment"  value={risk.treatment} />
                    </div>
                    <div>
                      <Field label="Category"    value={risk.category} />
                      <Field label="Owner"       value={risk.owner_name || risk.owner} />
                      <Field label="Review Date" value={risk.review_date ? new Date(risk.review_date).toLocaleDateString('en-GB') : null} />
                      <Field label="Asset"       value={risk.ip_address || risk.hostname} mono />
                      <Field label="Created"     value={risk.created_at ? new Date(risk.created_at).toLocaleDateString('en-GB') : null} />
                    </div>
                  </div>
                  {risk.notes && <div style={{ marginTop: 4 }}><Field label="Notes" value={risk.notes} /></div>}
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
              )}
            </div>
          )}

          {/* ── Controls tab ── */}
          {tab === 'controls' && (
            <div>
              {ctrlErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>{ctrlErr}</div>}
              {ctrlLoad ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Mapped Controls ({mapped.length})</div>
                  {mapped.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>No controls mapped yet.</div>
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
                            <td className="mono" style={{ color: 'var(--info)', fontWeight: 600, fontSize: 11 }}>{ctrl.control_id}</td>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: 12 }}>{ctrl.name}</div>
                              {ctrl.mapping_notes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{ctrl.mapping_notes}</div>}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--text3)' }}>{ctrl.framework?.replace('_',' ')}</td>
                            <td><span style={{ color: MAPPING_COLORS[ctrl.mapping_status] || 'var(--text3)', fontWeight: 600, fontSize: 11 }}>{MAPPING_LABELS[ctrl.mapping_status] || ctrl.mapping_status}</span></td>
                            <td><button onClick={() => removeMapping(ctrl.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }} title="Remove">✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>+ Add Control Mapping</div>
                    {unmapped.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>All available controls are already mapped.</div>
                    ) : (
                      <>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label>Control</label>
                          <select value={addCtrlId} onChange={e => setAddCtrlId(e.target.value)}>
                            {unmapped.map(c => <option key={c.id} value={c.id}>[{c.framework?.replace('_',' ')}] {c.control_id} — {c.name}</option>)}
                          </select>
                        </div>
                        <div className="form-row" style={{ marginBottom: 8 }}>
                          <div className="form-group">
                            <label>Status</label>
                            <select value={addStatus} onChange={e => setAddStatus(e.target.value)}>
                              {MAPPING_STATUS.map(s => <option key={s} value={s}>{MAPPING_LABELS[s]}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Notes</label>
                            <input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Evidence, action…" />
                          </div>
                        </div>
                        <button className="btn btn-primary" onClick={addMapping} disabled={!addCtrlId || ctrlSaving}>
                          {ctrlSaving ? 'Adding…' : 'Add Mapping'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── History tab ── */}
          {tab === 'history' && (
            <div>
              {histLoad ? (
                <div className="empty-state"><div className="spinner" /></div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>
                  No history yet. History is recorded each time the risk is updated.
                </div>
              ) : (
                <>
                  {/* Score chart */}
                  {histChart.length > 1 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Risk Score Trend</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={histChart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                          <YAxis domain={[0, 25]} ticks={[0,6,12,20,25]} tick={{ fill: 'var(--text3)', fontSize: 10 }} width={28} />
                          <RTooltip
                            contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 12 }}
                            formatter={(v, _, props) => [`${v} (${props.payload.level})`, 'Score']}
                            labelFormatter={label => `Date: ${label}`}
                          />
                          <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Critical', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={12} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'High', fill: '#f97316', fontSize: 10 }} />
                          <ReferenceLine y={6}  stroke="#eab308" strokeDasharray="3 3" label={{ value: 'Medium', fill: '#eab308', fontSize: 10 }} />
                          <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2}
                            dot={<CustomDot />} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                      {/* Level legend */}
                      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                        {[['critical','#ef4444'],['high','#f97316'],['medium','#eab308'],['low','#22c55e']].map(([l, c]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                            {l.charAt(0).toUpperCase() + l.slice(1)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
                    Timeline ({history.length} {history.length === 1 ? 'entry' : 'entries'})
                  </div>
                  <div style={{ position: 'relative' }}>
                    {/* vertical line */}
                    <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[...history].reverse().map((h, i) => {
                        const lc = levelColor(h.risk_level);
                        return (
                          <div key={h.id} style={{ display: 'flex', gap: 16, paddingBottom: 18, position: 'relative' }}>
                            {/* dot */}
                            <div style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 2, zIndex: 1 }}>
                              <div style={{ width: 12, height: 12, borderRadius: '50%', background: lc, border: '2px solid var(--bg1)', flexShrink: 0 }} />
                            </div>
                            <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', border: `1px solid var(--border)`, borderLeft: `3px solid ${lc}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: lc, lineHeight: 1 }}>{h.risk_score}</span>
                                  <span className={`badge badge-${h.risk_level}`}>{h.risk_level}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>L{h.likelihood}×I{h.impact}</span>
                                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{h.treatment}</span>
                                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>{h.status}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', flexShrink: 0 }}>
                                  <div>{new Date(h.changed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                  <div>{new Date(h.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </div>
                              {h.change_note && (
                                <div style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 5, marginBottom: 4 }}>
                                  {h.change_note}
                                </div>
                              )}
                              {h.changed_by_name && (
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>by {h.changed_by_name}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ flexShrink: 0 }}>
          {tab === 'details' && !editMode && (
            <button className="btn btn-primary" onClick={() => { setEditMode(true); setForm({ ...risk }); setChangeNote(''); }}>
              Edit
            </button>
          )}
          {tab === 'details' && editMode && (
            <>
              <button className="btn btn-secondary" onClick={() => { setEditMode(false); setForm({ ...risk }); setChangeNote(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </>
          )}
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
  const { user }                       = useContext(AuthContext);
  const canEdit                        = user?.role === 'admin' || user?.role === 'analyst';
  const [risks,        setRisks]       = useState([]);
  const [modal,        setModal]       = useState(false);
  const [detailRisk,   setDetailRisk]  = useState(null);
  const [detailInitTab,setDetailInitTab] = useState('details');
  const [tab,          setTab]         = useState('list'); // 'list' | 'heatmap'
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

  const deleteRisk = async (r, e) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete "${r.title}"?\n\nThis will also remove all history. This cannot be undone.`)) return;
    try {
      await api.delete(`/risks/${r.id}`);
      setRisks(prev => prev.filter(x => x.id !== r.id));
      if (detailRisk?.id === r.id) setDetailRisk(null);
    } catch (ex) { alert(ex.response?.data?.error || 'Delete failed'); }
  };

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
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {risks.filter(r =>
                    (!filterCat    || (r.category || '') === filterCat) &&
                    (!filterStatus || (r.status   || 'open') === filterStatus)
                  ).map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setDetailInitTab('details'); setDetailRisk(r); }}
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
                      <td onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                        <input
                          key={`l-${r.id}-${r.likelihood}`}
                          type="number" min="1" max="5"
                          defaultValue={r.likelihood}
                          onBlur={e => {
                            const v = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                            e.target.value = v;
                            if (v !== r.likelihood) update(r.id, { likelihood: v });
                          }}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          disabled={!canEdit}
                          style={{ width: 44, textAlign: 'center', fontFamily: 'monospace', fontSize: 12,
                                   background: 'var(--bg3)', border: '1px solid var(--border)',
                                   borderRadius: 4, padding: '2px 4px', color: 'var(--text1)',
                                   cursor: canEdit ? 'text' : 'default' }} />
                      </td>
                      <td onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                        <input
                          key={`i-${r.id}-${r.impact}`}
                          type="number" min="1" max="5"
                          defaultValue={r.impact}
                          onBlur={e => {
                            const v = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                            e.target.value = v;
                            if (v !== r.impact) update(r.id, { impact: v });
                          }}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          disabled={!canEdit}
                          style={{ width: 44, textAlign: 'center', fontFamily: 'monospace', fontSize: 12,
                                   background: 'var(--bg3)', border: '1px solid var(--border)',
                                   borderRadius: 4, padding: '2px 4px', color: 'var(--text1)',
                                   cursor: canEdit ? 'text' : 'default' }} />
                      </td>
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
                          onClick={() => { setDetailInitTab('controls'); setDetailRisk(r); }}
                          title="Map compliance controls"
                        >
                          🛡 Controls
                        </button>
                      </td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={e => deleteRisk(r, e)}
                            title="Delete risk"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
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
        <RiskDetailModal
          key={detailRisk.id}
          risk={detailRisk}
          initialTab={detailInitTab}
          appetite={appetite}
          onClose={() => setDetailRisk(null)}
          onSaved={updated => {
            setRisks(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
            setDetailRisk(updated);
          }}
        />
      )}
    </div>
  );
}

export default Risks;
