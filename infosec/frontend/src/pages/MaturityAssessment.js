import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../App';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Cell, ResponsiveContainer,
} from 'recharts';

/* ─── Static data ─────────────────────────────────────────── */

const MATURITY_LEVELS = [
  { level: 1, label: 'Initial',    color: '#ef4444', desc: 'Ad-hoc, no formal processes or documentation' },
  { level: 2, label: 'Developing', color: '#f97316', desc: 'Some processes defined, inconsistently applied' },
  { level: 3, label: 'Defined',    color: '#eab308', desc: 'Standardized processes, consistently applied org-wide' },
  { level: 4, label: 'Managed',    color: '#22c55e', desc: 'Quantitatively measured and controlled' },
  { level: 5, label: 'Optimizing', color: '#3b82f6', desc: 'Continuous improvement and innovation-driven' },
];

const ISMS_DOMAINS = [
  { id: 'context',     name: 'Context of Organization', short: 'Context',     clause: '4',  desc: 'Organization context, interested parties, and ISMS scope definition' },
  { id: 'leadership',  name: 'Leadership',              short: 'Leadership',  clause: '5',  desc: 'Top management commitment, information security policy, and organizational roles' },
  { id: 'planning',    name: 'Planning',                short: 'Planning',    clause: '6',  desc: 'Risk assessment, risk treatment plans, and information security objectives' },
  { id: 'support',     name: 'Support',                 short: 'Support',     clause: '7',  desc: 'Resources, competence, awareness, communication, and documented information' },
  { id: 'operation',   name: 'Operation',               short: 'Operation',   clause: '8',  desc: 'Operational planning, control, and risk treatment execution' },
  { id: 'performance', name: 'Performance Evaluation',  short: 'Performance', clause: '9',  desc: 'Monitoring, measurement, internal audit, and management review' },
  { id: 'improvement', name: 'Improvement',             short: 'Improvement', clause: '10', desc: 'Nonconformity handling, corrective actions, and continual improvement' },
];

const ISO42001_DOMAINS = [
  { id: 'context',        name: 'Context of Organization',       short: 'Context',      clause: '4',    desc: 'AI system scope, interested parties, and AI management system boundary' },
  { id: 'leadership',     name: 'Leadership & AI Governance',    short: 'Leadership',   clause: '5',    desc: 'Top management commitment, AI policy, and roles for AI systems' },
  { id: 'planning',       name: 'Planning',                      short: 'Planning',     clause: '6',    desc: 'AI risk assessment, impact assessment, and AI management objectives' },
  { id: 'support',        name: 'Support & Resources',           short: 'Support',      clause: '7',    desc: 'Resources, competence, awareness, and communication for AI systems' },
  { id: 'operation',      name: 'AI System Operation',           short: 'Operation',    clause: '8',    desc: 'AI development, deployment, monitoring, and decommissioning lifecycle' },
  { id: 'performance',    name: 'Performance Evaluation',        short: 'Performance',  clause: '9',    desc: 'AI system monitoring, internal audit, and management review' },
  { id: 'improvement',    name: 'Improvement',                   short: 'Improvement',  clause: '10',   desc: 'Nonconformity handling and continual improvement for AI systems' },
  { id: 'data',           name: 'Data Governance for AI',        short: 'Data',         clause: 'A.8',  desc: 'AI data quality, provenance, privacy, and governance practices' },
  { id: 'transparency',   name: 'Transparency & Explainability', short: 'Transparency', clause: 'A.9',  desc: 'AI system transparency, explainability, and stakeholder documentation' },
  { id: 'responsible',    name: 'Responsible AI Use',            short: 'Responsible',  clause: 'A.10', desc: 'Human oversight, fairness, accountability, and ethical AI deployment' },
];

const FRAMEWORKS = {
  ISMS:     { label: 'ISMS',      subtitle: 'Information Security Management System — ISO 27001:2022', domains: ISMS_DOMAINS },
  ISO42001: { label: 'ISO 42001', subtitle: 'AI Management System — ISO 42001:2023',                  domains: ISO42001_DOMAINS },
};

/* ─── Helpers ─────────────────────────────────────────────── */

function levelColor(score) {
  return MATURITY_LEVELS.find(m => m.level === score)?.color ?? 'var(--text3)';
}

function levelLabel(score) {
  return MATURITY_LEVELS.find(m => m.level === score)?.label ?? 'Not Rated';
}

function computeAvg(data, domains) {
  const scores = domains.map(d => data?.domains?.[d.id]?.score || 0).filter(Boolean);
  if (!scores.length) return 0;
  return +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function avgColor(avg) {
  return avg >= 4 ? '#22c55e' : avg >= 3 ? '#eab308' : avg >= 2 ? '#f97316' : avg > 0 ? '#ef4444' : 'var(--text3)';
}

function avgLabel(avg) {
  return avg >= 4.5 ? 'Optimizing' : avg >= 3.5 ? 'Managed' : avg >= 2.5 ? 'Defined' : avg >= 1.5 ? 'Developing' : avg > 0 ? 'Initial' : '—';
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function docIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'docx' || ext === 'doc')  return '📄';
  if (ext === 'pptx' || ext === 'ppt')  return '📊';
  if (ext === 'xlsx' || ext === 'xls')  return '📋';
  return '📎';
}

/* ─── Radar Chart ─────────────────────────────────────────── */
function MaturityRadar({ data, domains }) {
  const chartData = domains.map(d => ({
    domain:   d.short,
    score:    data?.domains?.[d.id]?.score || 0,
    fullMark: 5,
  }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Maturity Radar</div>
      <ResponsiveContainer width="100%" height={270}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: 'var(--text3)', fontSize: 9 }} />
          <Radar name="Maturity" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} dot={{ r: 3, fill: '#3b82f6' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Bar Chart ───────────────────────────────────────────── */
function MaturityBars({ data, domains }) {
  const chartData = domains.map(d => ({
    name:  d.short,
    score: data?.domains?.[d.id]?.score || 0,
  }));

  const height = Math.max(200, domains.length * 34);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Domain Scores</div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 82 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 5]} ticks={[0,1,2,3,4,5]} tick={{ fill: 'var(--text3)', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={82} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
          <RTooltip
            contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 12 }}
            formatter={(v) => [v ? `Level ${v} — ${levelLabel(v)}` : 'Not Rated', 'Score']}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.score ? levelColor(entry.score) : 'var(--bg3)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Domain Scoring Table ────────────────────────────────── */
function DomainScorer({ data, domains, onChange, readOnly }) {
  const setScore = (id, score) => {
    if (readOnly) return;
    onChange({
      ...data,
      domains: { ...data.domains, [id]: { ...data.domains?.[id], score: data.domains?.[id]?.score === score ? 0 : score } },
    });
  };

  const setNotes = (id, notes) => {
    if (readOnly) return;
    onChange({ ...data, domains: { ...data.domains, [id]: { ...data.domains?.[id], notes } } });
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg3)' }}>
            {['Clause', 'Domain', 'Maturity Level', 'Notes'].map(h => (
              <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Maturity Level' ? 'center' : 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((d, i) => {
            const score = data?.domains?.[d.id]?.score || 0;
            const notes = data?.domains?.[d.id]?.notes || '';
            return (
              <tr key={d.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{d.clause}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text1)' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{d.desc}</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    {MATURITY_LEVELS.map(ml => (
                      <button
                        key={ml.level}
                        onClick={() => setScore(d.id, ml.level)}
                        title={`Level ${ml.level}: ${ml.label} — ${ml.desc}`}
                        disabled={readOnly}
                        style={{
                          width: 30, height: 30, borderRadius: 5, border: 'none', cursor: readOnly ? 'default' : 'pointer',
                          fontWeight: 700, fontSize: 12, transition: 'all 0.12s',
                          background: score === ml.level ? ml.color : 'var(--bg3)',
                          color: score === ml.level ? '#fff' : 'var(--text3)',
                          opacity: readOnly ? 0.7 : 1,
                        }}
                      >{ml.level}</button>
                    ))}
                    {score > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 11, color: levelColor(score), fontWeight: 600, minWidth: 70 }}>
                        {levelLabel(score)}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', minWidth: 160 }}>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(d.id, e.target.value)}
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Add notes...'}
                    style={{
                      width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '4px 8px', color: 'var(--text1)', fontSize: 12,
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Document Section ────────────────────────────────────── */
function DocumentSection({ assessmentId, readOnly }) {
  const [docs,      setDocs]      = useState([]);
  const [uploading, setUploading] = useState(false);
  const [err,       setErr]       = useState('');
  const fileRef = useRef();

  const load = useCallback(() => {
    api.get(`/maturity/${assessmentId}/documents`)
      .then(r => setDocs(r.data))
      .catch(() => {});
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setErr(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/maturity/${assessmentId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.original_name}"?`)) return;
    try {
      await api.delete(`/maturity/documents/${doc.id}`);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (ex) { setErr(ex.response?.data?.error || 'Delete failed'); }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Evidence & Documents</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {err && <span style={{ fontSize: 12, color: 'var(--critical)' }}>{err}</span>}
          {!readOnly && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.pptx,.xlsx,.doc,.ppt,.xls"
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
              <button
                className="btn btn-primary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ fontSize: 12 }}
              >
                {uploading ? 'Uploading...' : '+ Upload Document'}
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        Accepted: .docx · .pptx · .xlsx &nbsp;(max 50 MB per file)
      </div>

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>
          No documents uploaded yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6,
            }}>
              <span style={{ fontSize: 20 }}>{docIcon(doc.original_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.original_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {fmtBytes(doc.file_size)} · {doc.uploaded_by_username || 'Unknown'} · {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => window.open(`/api/maturity/documents/${doc.id}/download`, '_blank')}
                style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
              >Download</button>
              {!readOnly && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(doc)}
                  style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                >Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Assessment Editor ───────────────────────────────────── */
function AssessmentEditor({ assessment, framework, onBack, onSaved }) {
  const domains = FRAMEWORKS[framework].domains;

  const [name,        setName]        = useState(assessment.name);
  const [description, setDescription] = useState(assessment.description || '');
  const [data,        setData]        = useState(assessment.data || { domains: {} });
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');

  const save = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const r = await api.put(`/maturity/${assessment.id}`, { name, description, data });
      setSaveMsg('Saved');
      onSaved(r.data);
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (ex) {
      setSaveMsg(ex.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const avg = computeAvg(data, domains);

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ flexShrink: 0, marginTop: 2 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              display: 'block', width: '100%', fontSize: 18, fontWeight: 600,
              background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
              color: 'var(--text1)', paddingBottom: 4, marginBottom: 6, outline: 'none',
            }}
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Assessment description (optional)"
            style={{
              display: 'block', width: '100%', fontSize: 13,
              background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
              color: 'var(--text2)', paddingBottom: 2, outline: 'none',
            }}
          />
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Overall</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg || '—'}</div>
          <div style={{ fontSize: 11, color: avgColor(avg), marginTop: 2 }}>{avgLabel(avg)}</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flexShrink: 0, marginTop: 2 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {saveMsg && (
        <div className={`alert ${saveMsg === 'Saved' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 14 }}>
          {saveMsg}
        </div>
      )}

      {/* Level legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATURITY_LEVELS.map(ml => (
          <div key={ml.level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ width: 13, height: 13, borderRadius: 3, background: ml.color, flexShrink: 0 }} />
            <span><strong>{ml.level}</strong> — {ml.label}</span>
          </div>
        ))}
      </div>

      {/* Domain scoring */}
      <DomainScorer data={data} domains={domains} onChange={setData} />

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <MaturityRadar data={data} domains={domains} />
        <MaturityBars  data={data} domains={domains} />
      </div>

      {/* Documents */}
      <div style={{ marginTop: 16 }}>
        <DocumentSection assessmentId={assessment.id} />
      </div>
    </div>
  );
}

/* ─── Assessment List ─────────────────────────────────────── */
function AssessmentList({ framework, onSelect }) {
  const domains = FRAMEWORKS[framework].domains;
  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState('');
  const [creating,    setCreating]    = useState(false);
  const [err,         setErr]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/maturity?framework=${framework}`)
      .then(r => setAssessments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [framework]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true); setErr('');
    try {
      const r = await api.post('/maturity', { framework, name: newName.trim(), description: '', data: { domains: {} } });
      onSelect(r.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Create failed');
    } finally { setCreating(false); }
  };

  const del = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? All documents will also be removed.`)) return;
    try {
      await api.delete(`/maturity/${id}`);
      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (ex) { setErr(ex.response?.data?.error || 'Delete failed'); }
  };

  const getAvg = (a) => computeAvg(a.data, domains);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setNewName(''); setErr(''); }}>
          + New Blank Assessment
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            New {FRAMEWORKS[framework].label} Assessment
          </div>
          {err && <div className="alert alert-error" style={{ marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder={`e.g. Q2 2026 ${FRAMEWORKS[framework].label} Review`}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 5, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text1)', fontSize: 13,
              }}
            />
            <button className="btn btn-primary" onClick={create} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Loading…</div>
      ) : assessments.length === 0 && !showCreate ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 6 }}>No assessments yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>
            Start with a blank assessment and score each domain, or upload existing evidence documents
          </div>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setNewName(''); }}>
            + New Blank Assessment
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assessments.map(a => {
            const avg = getAvg(a);
            return (
              <div
                key={a.id}
                onClick={() => onSelect(a)}
                className="card"
                style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)' }}>{a.name}</div>
                  {a.description && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{a.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    Updated {new Date(a.updated_at).toLocaleDateString()}
                  </div>
                </div>
                {avg > 0 ? (
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: avgColor(avg), lineHeight: 1 }}>{avg}</div>
                    <div style={{ fontSize: 10, color: avgColor(avg) }}>{avgLabel(avg)}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>Not started</div>
                )}
                <button
                  className="btn btn-danger"
                  onClick={e => del(a.id, a.name, e)}
                  style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                >Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function MaturityAssessment() {
  const [framework, setFramework] = useState('ISMS');
  const [selected,  setSelected]  = useState(null);

  // Reset selection when switching framework tabs
  useEffect(() => { setSelected(null); }, [framework]);

  const handleSelect = async (a) => {
    try {
      const r = await api.get(`/maturity/${a.id}`);
      setSelected(r.data);
    } catch { setSelected(a); }
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ marginBottom: 2 }}>Maturity Assessment</h1>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{FRAMEWORKS[framework].subtitle}</div>
      </div>

      {/* Framework tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {Object.entries(FRAMEWORKS).map(([key, fw]) => (
          <button
            key={key}
            onClick={() => setFramework(key)}
            style={{
              padding: '8px 22px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: framework === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: framework === key ? 'var(--accent)' : 'var(--text3)',
              fontWeight: framework === key ? 600 : 400,
              fontSize: 14, marginBottom: -1, transition: 'color 0.15s',
            }}
          >{fw.label}</button>
        ))}
      </div>

      {selected ? (
        <AssessmentEditor
          key={selected.id}
          assessment={selected}
          framework={framework}
          onBack={() => setSelected(null)}
          onSaved={updated => setSelected(updated)}
        />
      ) : (
        <AssessmentList
          key={framework}
          framework={framework}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
